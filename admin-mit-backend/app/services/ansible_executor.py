"""
Ansible 执行器
提供 Ansible Playbook 执行环境管理和执行功能
"""
import os
import yaml
import tempfile
import subprocess
import logging
from typing import Dict, List, Optional, Tuple, Any, Callable
from pathlib import Path

from app.core.config_manager import config_manager

logger = logging.getLogger(__name__)


class AnsibleExecutionError(Exception):
    """Ansible 执行异常"""
    pass


class AnsibleExecutionEnvironment:
    """Ansible 执行环境管理"""
    
    def __init__(self, execution_id: str):
        self.execution_id = execution_id
        self.work_dir = None
        self.inventory_file = None
        self.playbook_file = None
        self.vars_file = None
        self.ssh_config_file = None
        self.created_files = []
    
    def __enter__(self):
        """进入上下文管理器"""
        self.setup_environment()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """退出上下文管理器"""
        self.cleanup_environment()
    
    def setup_environment(self):
        """设置执行环境"""
        try:
            # 创建临时工作目录
            self.work_dir = Path(tempfile.mkdtemp(prefix=f"ansible_{self.execution_id}_"))
            logger.info(f"创建 Ansible 执行环境: {self.work_dir}")
            
            # 设置目录权限
            os.chmod(self.work_dir, 0o700)
            
        except Exception as e:
            logger.error(f"设置 Ansible 执行环境失败: {str(e)}")
            raise AnsibleExecutionError(f"设置执行环境失败: {str(e)}")
    
    def cleanup_environment(self):
        """清理执行环境"""
        try:
            if self.work_dir and self.work_dir.exists():
                # 删除所有创建的文件
                import shutil
                shutil.rmtree(self.work_dir, ignore_errors=True)
                logger.info(f"清理 Ansible 执行环境: {self.work_dir}")
                
        except Exception as e:
            logger.warning(f"清理 Ansible 执行环境失败: {str(e)}")
    
    def create_inventory(self, hosts: List) -> str:
        """创建 Ansible inventory 文件"""
        try:
            inventory_data = {
                'all': {
                    'hosts': {},
                    'vars': {
                        'ansible_ssh_common_args': '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null'
                    }
                }
            }
            
            # 添加主机信息
            for host in hosts:
                host_vars = {
                    'ansible_host': host.hostname,
                    'ansible_port': host.port,
                    'ansible_user': host.username,
                    'ansible_ssh_timeout': 30
                }
                
                # 根据认证类型设置认证信息
                if host.auth_type == 'password' and host.password:
                    # 解密密码
                    from app.services.password_service import PasswordDecryptService
                    password_service = PasswordDecryptService()
                    decrypted_password = password_service.decrypt_password(host.password)
                    host_vars['ansible_ssh_pass'] = decrypted_password
                elif host.auth_type == 'key' and host.private_key:
                    # 创建私钥文件
                    key_file = self.work_dir / f"key_{host.id}.pem"
                    with open(key_file, 'w') as f:
                        f.write(host.private_key)
                    os.chmod(key_file, 0o600)
                    host_vars['ansible_ssh_private_key_file'] = str(key_file)
                    self.created_files.append(key_file)
                
                inventory_data['all']['hosts'][host.name] = host_vars
            
            # 写入 inventory 文件
            self.inventory_file = self.work_dir / 'inventory.yml'
            with open(self.inventory_file, 'w') as f:
                yaml.dump(inventory_data, f, default_flow_style=False)
            
            self.created_files.append(self.inventory_file)
            logger.info(f"创建 Ansible inventory 文件: {self.inventory_file}")
            
            return str(self.inventory_file)
            
        except Exception as e:
            logger.error(f"创建 Ansible inventory 失败: {str(e)}")
            raise AnsibleExecutionError(f"创建 inventory 失败: {str(e)}")
    
    def create_playbook(self, content: str) -> str:
        """创建 Playbook 文件"""
        try:
            # 验证 YAML 格式
            yaml.safe_load(content)
            
            # 写入 Playbook 文件
            self.playbook_file = self.work_dir / 'playbook.yml'
            with open(self.playbook_file, 'w') as f:
                f.write(content)
            
            self.created_files.append(self.playbook_file)
            logger.info(f"创建 Ansible Playbook 文件: {self.playbook_file}")
            
            return str(self.playbook_file)
            
        except yaml.YAMLError as e:
            logger.error(f"Playbook YAML 格式错误: {str(e)}")
            raise AnsibleExecutionError(f"Playbook YAML 格式错误: {str(e)}")
        except Exception as e:
            logger.error(f"创建 Playbook 文件失败: {str(e)}")
            raise AnsibleExecutionError(f"创建 Playbook 文件失败: {str(e)}")
    
    def create_vars_file(self, variables: Dict[str, Any]) -> Optional[str]:
        """创建变量文件"""
        if not variables:
            return None
        
        try:
            self.vars_file = self.work_dir / 'vars.yml'
            with open(self.vars_file, 'w') as f:
                yaml.dump(variables, f, default_flow_style=False)
            
            self.created_files.append(self.vars_file)
            logger.info(f"创建 Ansible 变量文件: {self.vars_file}")
            
            return str(self.vars_file)
            
        except Exception as e:
            logger.error(f"创建变量文件失败: {str(e)}")
            raise AnsibleExecutionError(f"创建变量文件失败: {str(e)}")


class AnsibleExecutor:
    """Ansible 执行器"""
    
    def __init__(self, execution_id: str, progress_callback: Optional[Callable] = None):
        self.execution_id = execution_id
        self.progress_callback = progress_callback
        self.process = None
        self.is_cancelled = False
        
        # 从配置获取 Ansible 设置
        app_config = config_manager.get_app_config()
        self.ansible_config = app_config.get('ansible', {})
        self.ansible_timeout = self.ansible_config.get('timeout', 3600)  # 默认1小时超时
        self.ansible_forks = self.ansible_config.get('forks', 5)  # 默认5个并发
    
    def execute_playbook(self, playbook_file: str, inventory_file: str, 
                        vars_file: Optional[str] = None, extra_vars: Optional[Dict] = None) -> Tuple[str, str, int]:
        """执行 Ansible Playbook"""
        try:
            # 构建 ansible-playbook 命令
            cmd = [
                'ansible-playbook',
                '-i', inventory_file,
                playbook_file,
                '--timeout', str(self.ansible_timeout),
                '--forks', str(self.ansible_forks),
                '-v'  # 详细输出
            ]
            
            # 添加变量文件
            if vars_file:
                cmd.extend(['-e', f'@{vars_file}'])
            
            # 添加额外变量
            if extra_vars:
                for key, value in extra_vars.items():
                    cmd.extend(['-e', f'{key}={value}'])
            
            logger.info(f"执行 Ansible 命令: {' '.join(cmd)}")
            
            # 设置环境变量
            env = os.environ.copy()
            env.update({
                'ANSIBLE_HOST_KEY_CHECKING': 'False',
                'ANSIBLE_SSH_RETRIES': '3',
                'ANSIBLE_TIMEOUT': str(self.ansible_timeout),
                'ANSIBLE_GATHERING': 'smart',
                'ANSIBLE_CACHE_PLUGIN': 'memory'
            })
            
            # 执行命令
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                env=env,
                cwd=os.path.dirname(playbook_file)
            )
            
            # 实时读取输出
            output_lines = []
            while True:
                if self.is_cancelled:
                    self.process.terminate()
                    return '\n'.join(output_lines), "执行被取消", -1
                
                line = self.process.stdout.readline()
                if not line and self.process.poll() is not None:
                    break
                
                if line:
                    line = line.strip()
                    output_lines.append(line)
                    
                    # 解析进度信息
                    self._parse_progress(line)
                    
                    # 调用进度回调
                    if self.progress_callback:
                        self.progress_callback(line)
            
            # 获取退出码
            exit_code = self.process.poll()
            output = '\n'.join(output_lines)
            
            logger.info(f"Ansible 执行完成，退出码: {exit_code}")
            
            return output, "", exit_code
            
        except Exception as e:
            logger.error(f"执行 Ansible Playbook 失败: {str(e)}")
            return "", str(e), 1
    
    def _parse_progress(self, line: str):
        """解析执行进度"""
        try:
            # 解析 Ansible 输出中的任务信息
            if "TASK [" in line:
                # 提取任务名称
                task_name = line.split("TASK [")[1].split("]")[0]
                logger.debug(f"执行任务: {task_name}")
            elif "PLAY RECAP" in line:
                # 执行完成
                logger.debug("Ansible 执行完成")
        except Exception:
            pass
    
    def cancel(self):
        """取消执行"""
        self.is_cancelled = True
        if self.process:
            try:
                self.process.terminate()
                logger.info(f"取消 Ansible 执行: {self.execution_id}")
            except Exception as e:
                logger.warning(f"取消 Ansible 执行失败: {str(e)}")
