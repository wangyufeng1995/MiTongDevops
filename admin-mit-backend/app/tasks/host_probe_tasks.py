"""
主机探测 Celery 任务
使用 SSH 连接检测主机连通性（支持 Windows 和 Linux）
"""
import os
import sys
import time
import logging
import tempfile
import subprocess
import socket
from typing import Dict, Any, List, Optional
from datetime import datetime
from celery import Task
from app.celery_app import celery

logger = logging.getLogger(__name__)

# 检测是否在 Windows 上运行
IS_WINDOWS = sys.platform == 'win32'

# 全局 Flask 应用实例（懒加载）
_flask_app = None


def get_flask_app():
    """获取 Celery 专用的轻量级 Flask 应用实例"""
    global _flask_app
    if _flask_app is None:
        from app.celery_flask_app import create_celery_flask_app
        _flask_app = create_celery_flask_app()
    return _flask_app


class HostProbeTask(Task):
    """主机探测任务基类"""
    
    autoretry_for = (Exception,)
    retry_kwargs = {'max_retries': 3, 'countdown': 30}
    retry_backoff = True
    retry_backoff_max = 300
    retry_jitter = True
    
    # 任务超时配置
    soft_time_limit = 120  # 软超时 2 分钟
    time_limit = 180  # 硬超时 3 分钟
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """任务失败时的回调"""
        host_id = kwargs.get('host_id', 'unknown')
        logger.error(f"[探测] 任务失败: host_id={host_id}, error={exc}")
    
    def on_success(self, retval, task_id, args, kwargs):
        """任务成功时的回调"""
        pass  # 成功日志已在任务中输出


def _create_ansible_inventory(host, work_dir: str) -> str:
    """
    创建 Ansible inventory 文件
    
    Args:
        host: SSHHost 模型实例
        work_dir: 工作目录路径
        
    Returns:
        inventory 文件路径
    """
    inventory_content = f"""[target]
{host.name} ansible_host={host.hostname} ansible_port={host.port} ansible_user={host.username}"""
    
    # 根据认证类型添加认证信息
    if host.auth_type == 'password' and host.password:
        # 解密密码
        from app.services.password_service import PasswordDecryptService
        password_service = PasswordDecryptService()
        try:
            decrypted_password = password_service.decrypt_password(host.password)
            inventory_content += f" ansible_ssh_pass={decrypted_password}"
        except Exception as e:
            logger.warning(f"解密密码失败: {e}, 使用原始密码")
            inventory_content += f" ansible_ssh_pass={host.password}"
    elif host.auth_type == 'key' and host.private_key:
        # 创建私钥文件
        key_file = os.path.join(work_dir, f"key_{host.id}.pem")
        with open(key_file, 'w') as f:
            f.write(host.private_key)
        os.chmod(key_file, 0o600)
        inventory_content += f" ansible_ssh_private_key_file={key_file}"
    
    # 添加通用 SSH 选项
    inventory_content += " ansible_ssh_common_args='-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null'"
    
    # 写入 inventory 文件
    inventory_file = os.path.join(work_dir, 'inventory')
    with open(inventory_file, 'w') as f:
        f.write(inventory_content)
    
    return inventory_file


def _execute_ansible_ping_command(inventory_file: str, host_name: str, timeout: int = 30) -> Dict[str, Any]:
    """
    执行 ansible ping 命令
    
    Args:
        inventory_file: inventory 文件路径
        host_name: 主机名称
        timeout: 超时时间（秒）
        
    Returns:
        包含执行结果的字典
    """
    start_time = time.time()
    
    # 构建 ansible 命令
    cmd = [
        'ansible',
        host_name,
        '-i', inventory_file,
        '-m', 'ping',
        '--timeout', str(timeout),
        '-v'
    ]
    
    # 设置环境变量
    env = os.environ.copy()
    env.update({
        'ANSIBLE_HOST_KEY_CHECKING': 'False',
        'ANSIBLE_SSH_RETRIES': '2',
        'ANSIBLE_TIMEOUT': str(timeout),
    })
    
    try:
        # 执行命令
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout + 10,  # 给予额外时间
            env=env
        )
        
        response_time = time.time() - start_time
        
        # 解析结果
        if result.returncode == 0:
            return {
                'success': True,
                'status': 'success',
                'message': '主机连接成功',
                'ansible_output': result.stdout,
                'response_time': round(response_time, 3)
            }
        else:
            # 解析错误信息
            error_output = result.stderr or result.stdout
            return {
                'success': False,
                'status': 'failed',
                'message': _parse_ansible_error(error_output),
                'ansible_output': error_output,
                'response_time': round(response_time, 3)
            }
            
    except subprocess.TimeoutExpired:
        response_time = time.time() - start_time
        return {
            'success': False,
            'status': 'timeout',
            'message': f'探测超时（{timeout}秒）',
            'ansible_output': '',
            'response_time': round(response_time, 3)
        }
    except Exception as e:
        response_time = time.time() - start_time
        return {
            'success': False,
            'status': 'failed',
            'message': f'执行错误: {str(e)}',
            'ansible_output': str(e),
            'response_time': round(response_time, 3)
        }


def _parse_ansible_error(output: str) -> str:
    """解析 Ansible 错误输出，提取关键错误信息"""
    if not output:
        return '未知错误'
    
    # 常见错误模式
    error_patterns = [
        ('Permission denied', '认证失败：权限被拒绝'),
        ('Connection refused', '连接被拒绝：目标端口未开放'),
        ('Connection timed out', '连接超时：主机不可达'),
        ('No route to host', '无法路由到主机'),
        ('Name or service not known', '主机名无法解析'),
        ('UNREACHABLE', '主机不可达'),
        ('Authentication failure', '认证失败'),
        ('Host key verification failed', 'SSH 主机密钥验证失败'),
    ]
    
    output_lower = output.lower()
    for pattern, message in error_patterns:
        if pattern.lower() in output_lower:
            return message
    
    # 返回原始输出的前200个字符
    return output[:200] if len(output) > 200 else output


def _execute_ssh_probe_paramiko(host, timeout: int = 30) -> Dict[str, Any]:
    """
    使用 Paramiko 执行 SSH 探测（Windows 兼容）
    
    Args:
        host: SSHHost 模型实例
        timeout: 超时时间（秒）
        
    Returns:
        包含执行结果的字典
    """
    import paramiko
    from io import StringIO
    
    start_time = time.time()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        # 准备连接参数
        connect_kwargs = {
            'hostname': host.hostname,
            'port': host.port,
            'username': host.username,
            'timeout': timeout,
            'allow_agent': False,
            'look_for_keys': False,
        }
        
        # 根据认证类型设置认证信息
        if host.auth_type == 'password' and host.password:
            # 密码已经是明文，直接使用
            connect_kwargs['password'] = host.password
        elif host.auth_type == 'key' and host.private_key:
            # 从字符串加载私钥
            key_content = host.private_key
            logger.info(f"[探测] 私钥长度: {len(key_content)}, 开头: {key_content[:50]}...")
            
            key_file = StringIO(key_content)
            pkey = None
            key_type = None
            
            # 尝试 RSA 密钥
            try:
                pkey = paramiko.RSAKey.from_private_key(key_file)
                key_type = 'RSA'
            except paramiko.SSHException as e:
                logger.warning(f"[探测] RSA 密钥解析失败: {e}")
                key_file.seek(0)
                # 尝试 Ed25519 密钥
                try:
                    pkey = paramiko.Ed25519Key.from_private_key(key_file)
                    key_type = 'Ed25519'
                except paramiko.SSHException as e:
                    logger.warning(f"[探测] Ed25519 密钥解析失败: {e}")
                    key_file.seek(0)
                    # 尝试 ECDSA 密钥
                    try:
                        pkey = paramiko.ECDSAKey.from_private_key(key_file)
                        key_type = 'ECDSA'
                    except paramiko.SSHException as e:
                        logger.error(f"[探测] 所有密钥格式解析都失败: {e}")
                        raise Exception(f"无法解析私钥，请检查私钥格式是否正确")
            
            if pkey:
                logger.info(f"[探测] 成功解析 {key_type} 密钥")
                connect_kwargs['pkey'] = pkey
        
        # 连接并执行测试命令
        client.connect(**connect_kwargs)
        stdin, stdout, stderr = client.exec_command('echo "pong"', timeout=10)
        output = stdout.read().decode('utf-8').strip()
        
        response_time = time.time() - start_time
        
        return {
            'success': True,
            'status': 'success',
            'message': '主机连接成功',
            'ansible_output': f'SSH 连接成功，响应时间: {round(response_time, 3)}s',
            'response_time': round(response_time, 3)
        }
            
    except paramiko.AuthenticationException:
        response_time = time.time() - start_time
        return {
            'success': False,
            'status': 'failed',
            'message': '认证失败：用户名或密码错误',
            'ansible_output': '认证失败',
            'response_time': round(response_time, 3)
        }
    except paramiko.SSHException as e:
        response_time = time.time() - start_time
        error_msg = str(e)
        if 'No existing session' in error_msg:
            message = '连接失败：SSH 会话建立失败'
        elif 'Error reading SSH protocol banner' in error_msg:
            message = '连接失败：无法读取 SSH 协议'
        else:
            message = f'SSH 错误: {error_msg}'
        return {
            'success': False,
            'status': 'failed',
            'message': message,
            'ansible_output': error_msg,
            'response_time': round(response_time, 3)
        }
    except (TimeoutError, socket.timeout):
        response_time = time.time() - start_time
        return {
            'success': False,
            'status': 'timeout',
            'message': f'连接超时（{timeout}秒）',
            'ansible_output': '连接超时',
            'response_time': round(response_time, 3)
        }
    except Exception as e:
        response_time = time.time() - start_time
        error_msg = str(e)
        
        # 解析常见错误
        if 'Connection refused' in error_msg:
            message = '连接被拒绝：目标端口未开放'
        elif 'timed out' in error_msg.lower():
            message = '连接超时：主机不可达'
        elif 'No route to host' in error_msg:
            message = '无法路由到主机'
        elif 'Name or service not known' in error_msg or 'getaddrinfo failed' in error_msg:
            message = '主机名无法解析'
        else:
            message = f'连接错误: {error_msg}'
            
        return {
            'success': False,
            'status': 'failed',
            'message': message,
            'ansible_output': error_msg,
            'response_time': round(response_time, 3)
        }
    finally:
        try:
            client.close()
        except:
            pass


def _save_probe_result(host_id: int, task_id: str, result: Dict[str, Any]) -> None:
    """
    保存探测结果到数据库
    
    Args:
        host_id: 主机 ID
        task_id: Celery 任务 ID
        result: 探测结果字典
    """
    from app.extensions import db
    from app.models.host import SSHHost, HostProbeResult
    
    # 创建探测结果记录
    probe_result = HostProbeResult(
        host_id=host_id,
        task_id=task_id,
        status=result['status'],
        message=result['message'],
        ansible_output=result.get('ansible_output', ''),
        response_time=result.get('response_time'),
        probed_at=datetime.utcnow()
    )
    db.session.add(probe_result)
    
    # 更新主机的探测状态
    host = SSHHost.query.get(host_id)
    if host:
        host.last_probe_status = result['status']
        host.last_probe_at = datetime.utcnow()
        host.last_probe_message = result['message']
    
    db.session.commit()


@celery.task(
    base=HostProbeTask,
    bind=True,
    name='app.tasks.host_probe_tasks.execute_ansible_ping',
    priority=5
)
def execute_ansible_ping(self, host_id: int, tenant_id: int, timeout: int = 30) -> Dict[str, Any]:
    """
    执行主机探测（Windows 使用 Paramiko，Linux 使用 Ansible）
    
    Args:
        host_id: 主机 ID
        tenant_id: 租户 ID
        timeout: 探测超时时间（秒），默认 30 秒
        
    Returns:
        探测结果字典
    """
    app = get_flask_app()
    with app.app_context():
        from app.extensions import db
        from app.models.host import SSHHost
        from app.services.host_info_service import host_info_service
        
        try:
            # 获取主机信息
            host = SSHHost.query.filter_by(
                id=host_id,
                tenant_id=tenant_id
            ).first()
            
            if not host:
                logger.error(f"[探测] 主机不存在: host_id={host_id}")
                return {
                    'success': False,
                    'host_id': host_id,
                    'status': 'failed',
                    'message': '主机不存在'
                }
            
            logger.info(f"[探测] 开始: {host.name} ({host.hostname}:{host.port})")
            
            # 更新主机探测状态为 pending
            host.last_probe_status = 'pending'
            db.session.commit()
            
            # 根据平台选择探测方式
            if IS_WINDOWS:
                result = _execute_ssh_probe_paramiko(host, timeout)
                result['host_id'] = host_id
            else:
                work_dir = tempfile.mkdtemp(prefix=f"host_probe_{host_id}_")
                try:
                    inventory_file = _create_ansible_inventory(host, work_dir)
                    result = _execute_ansible_ping_command(inventory_file, host.name, timeout)
                    result['host_id'] = host_id
                finally:
                    import shutil
                    shutil.rmtree(work_dir, ignore_errors=True)
            
            # 保存探测结果
            _save_probe_result(host_id, self.request.id, result)
            
            # 如果探测成功，收集系统信息
            if result.get('success'):
                try:
                    host_info_service.collect_host_system_info(host)
                except Exception:
                    pass  # 静默处理系统信息收集失败
            
            # 输出简洁的结果日志
            status_icon = '[OK]' if result['status'] == 'success' else '[FAIL]'
            logger.info(f"[探测] {status_icon} {host.name}: {result['message']} ({result.get('response_time', 0)}s)")
            
            return result
                
        except Exception as e:
            logger.error(f"[探测] 异常: host_id={host_id}, error={str(e)}")
            
            error_result = {
                'success': False,
                'host_id': host_id,
                'status': 'failed',
                'message': f'探测任务执行异常: {str(e)}',
                'ansible_output': str(e)
            }
            
            try:
                _save_probe_result(host_id, self.request.id, error_result)
            except Exception:
                pass
            
            raise


@celery.task(
    name='app.tasks.host_probe_tasks.execute_batch_probe',
    priority=3
)
def execute_batch_probe(host_ids: List[int], tenant_id: int, timeout: int = 30) -> Dict[str, Any]:
    """
    批量执行主机探测任务
    """
    logger.info(f"[探测] 批量任务: {len(host_ids)} 台主机")
    
    results = []
    for host_id in host_ids:
        try:
            task = execute_ansible_ping.apply_async(
                kwargs={
                    'host_id': host_id,
                    'tenant_id': tenant_id,
                    'timeout': timeout
                }
            )
            results.append({
                'host_id': host_id,
                'task_id': task.id,
                'status': 'queued'
            })
        except Exception as e:
            results.append({
                'host_id': host_id,
                'status': 'failed',
                'error': str(e)
            })
    
    return {
        'success': True,
        'total': len(host_ids),
        'queued': len([r for r in results if r.get('status') == 'queued']),
        'failed': len([r for r in results if r.get('status') == 'failed']),
        'results': results
    }


@celery.task(
    name='app.tasks.host_probe_tasks.execute_group_probe',
    priority=3
)
def execute_group_probe(group_id: int, tenant_id: int, timeout: int = 30) -> Dict[str, Any]:
    """
    探测分组内所有主机
    """
    app = get_flask_app()
    with app.app_context():
        from app.models.host import SSHHost, HostGroup
        
        group = HostGroup.query.filter_by(
            id=group_id,
            tenant_id=tenant_id
        ).first()
        
        if not group:
            return {
                'success': False,
                'message': f'分组不存在: group_id={group_id}'
            }
        
        hosts = SSHHost.query.filter_by(
            group_id=group_id,
            tenant_id=tenant_id
        ).all()
        
        if not hosts:
            return {
                'success': True,
                'message': '分组内没有主机',
                'total': 0,
                'results': []
            }
        
        logger.info(f"[探测] 分组 {group.name}: {len(hosts)} 台主机")
        host_ids = [host.id for host in hosts]
        return execute_batch_probe(host_ids, tenant_id, timeout)


@celery.task(
    name='app.tasks.host_probe_tasks.cleanup_old_host_probe_results',
    priority=1
)
def cleanup_old_host_probe_results(days: int = 30) -> Dict[str, Any]:
    """
    清理旧的主机探测结果
    """
    from datetime import timedelta
    
    app = get_flask_app()
    with app.app_context():
        from app.extensions import db
        from app.models.host import HostProbeResult
        
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            deleted_count = HostProbeResult.query.filter(
                HostProbeResult.probed_at < cutoff_date
            ).delete()
            db.session.commit()
            
            if deleted_count > 0:
                logger.info(f"[清理] 删除 {deleted_count} 条旧探测记录")
            
            return {
                'success': True,
                'deleted_count': deleted_count,
                'message': f'清理完成'
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"[清理] 失败: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
