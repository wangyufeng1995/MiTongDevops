# -*- coding: utf-8 -*-
"""
Ansible 执行服务
"""
import os
import yaml
import uuid
import tempfile
import subprocess
import logging
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path

from app.extensions import db
from app.models.ansible import AnsiblePlaybook, PlaybookExecution
from app.models.host import SSHHost
from app.core.config_manager import config_manager

logger = logging.getLogger(__name__)


class AnsibleExecutionError(Exception):
    pass


class AnsibleExecutionEnvironment:
    def __init__(self, execution_id: str):
        self.execution_id = execution_id
        self.work_dir = None
        self.inventory_file = None
        self.playbook_file = None
        self.vars_file = None
        self.created_files = []

    def __enter__(self):
        self.setup_environment()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.cleanup_environment()

    def setup_environment(self):
        try:
            import platform
            # Windows 下使用 C:\temp 避免用户名中文路径问题
            if platform.system() == 'Windows':
                base_temp = Path('C:/temp/ansible')
                base_temp.mkdir(parents=True, exist_ok=True)
                self.work_dir = Path(tempfile.mkdtemp(prefix=f"exec_{self.execution_id[:8]}_", dir=base_temp))
            else:
                self.work_dir = Path(tempfile.mkdtemp(prefix=f"ansible_{self.execution_id}_"))
            logger.info(f"Created Ansible execution environment: {self.work_dir}")
            os.chmod(self.work_dir, 0o700)
        except Exception as e:
            logger.error(f"Failed to setup Ansible environment: {str(e)}")
            raise AnsibleExecutionError(f"Setup failed: {str(e)}")

    def cleanup_environment(self):
        try:
            if self.work_dir and self.work_dir.exists():
                import shutil
                shutil.rmtree(self.work_dir, ignore_errors=True)
                logger.info(f"Cleaned up Ansible environment: {self.work_dir}")
        except Exception as e:
            logger.warning(f"Failed to cleanup environment: {str(e)}")

    def create_inventory(self, hosts: List) -> str:
        try:
            inventory_data = {
                'all': {
                    'hosts': {},
                    'vars': {
                        'ansible_ssh_common_args': '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null'
                    }
                }
            }
            
            # 统计需要解密的主机
            password_hosts = [h for h in hosts if h.auth_type == 'password' and h.password]
            if password_hosts:
                from app.services.password_service import password_decrypt_service
                logger.info(f"[解密主机密码] 共 {len(password_hosts)} 台主机")
            
            for host in hosts:
                host_vars = {
                    'ansible_host': host.hostname,
                    'ansible_port': host.port,
                    'ansible_user': host.username,
                    'ansible_ssh_timeout': 30
                }
                if host.auth_type == 'password' and host.password:
                    # log=False 避免每台主机都打印日志
                    decrypted_password = password_decrypt_service.decrypt_password(host.password, host.name, host.hostname, log=False)
                    host_vars['ansible_ssh_pass'] = decrypted_password
                elif host.auth_type == 'key' and host.private_key:
                    key_file = self.work_dir / f"key_{host.id}.pem"
                    with open(key_file, 'w', encoding='utf-8') as f:
                        f.write(host.private_key)
                    os.chmod(key_file, 0o600)
                    host_vars['ansible_ssh_private_key_file'] = str(key_file)
                    self.created_files.append(key_file)
                # 使用主机 IP 作为 inventory 中的主机名，避免中文名称问题
                host_key = host.hostname  # 使用 IP 地址作为 key
                inventory_data['all']['hosts'][host_key] = host_vars

            self.inventory_file = self.work_dir / 'inventory.yml'
            with open(self.inventory_file, 'w', encoding='utf-8') as f:
                yaml.dump(inventory_data, f, default_flow_style=False, allow_unicode=True)
            self.created_files.append(self.inventory_file)
            logger.info(f"Created inventory file: {self.inventory_file}")
            return str(self.inventory_file)
        except Exception as e:
            logger.error(f"Failed to create inventory: {str(e)}")
            raise AnsibleExecutionError(f"Create inventory failed: {str(e)}")

    def create_playbook(self, content: str) -> str:
        try:
            playbook_data = yaml.safe_load(content)
            
            # 如果 playbook 是字典格式，自动转换为列表格式
            if isinstance(playbook_data, dict):
                # 将字典包装成列表
                playbook_data = [playbook_data]
                content = yaml.dump(playbook_data, default_flow_style=False, allow_unicode=True)
                logger.info("Converted playbook from dict to list format")
            elif not isinstance(playbook_data, list):
                raise AnsibleExecutionError("Playbook must be a list of plays")
            
            self.playbook_file = self.work_dir / 'playbook.yml'
            with open(self.playbook_file, 'w', encoding='utf-8') as f:
                f.write(content)
            self.created_files.append(self.playbook_file)
            logger.info(f"Created playbook file: {self.playbook_file}")
            return str(self.playbook_file)
        except yaml.YAMLError as e:
            logger.error(f"Playbook YAML error: {str(e)}")
            raise AnsibleExecutionError(f"Playbook YAML error: {str(e)}")
        except Exception as e:
            logger.error(f"Failed to create playbook: {str(e)}")
            raise AnsibleExecutionError(f"Create playbook failed: {str(e)}")

    def create_vars_file(self, variables: Dict[str, Any]) -> Optional[str]:
        if not variables:
            return None
        try:
            self.vars_file = self.work_dir / 'vars.yml'
            with open(self.vars_file, 'w', encoding='utf-8') as f:
                yaml.dump(variables, f, default_flow_style=False, allow_unicode=True)
            self.created_files.append(self.vars_file)
            logger.info(f"Created vars file: {self.vars_file}")
            return str(self.vars_file)
        except Exception as e:
            logger.error(f"Failed to create vars file: {str(e)}")
            raise AnsibleExecutionError(f"Create vars file failed: {str(e)}")



class AnsibleExecutor:
    def __init__(self, execution_id: str):
        self.execution_id = execution_id
        self.process = None
        self.is_cancelled = False
        app_config = config_manager.get_app_config()
        self.ansible_config = app_config.get('ansible', {})
        self.ansible_timeout = self.ansible_config.get('timeout', 3600)
        self.ansible_forks = self.ansible_config.get('forks', 5)

    def execute_playbook(self, playbook_file: str, inventory_file: str,
                        vars_file: Optional[str] = None) -> Tuple[str, str, int]:
        try:
            import platform
            is_windows = platform.system() == 'Windows'
            
            if is_windows:
                # Windows: convert paths to WSL format and use wsl
                def to_wsl_path(win_path: str) -> str:
                    # 确保路径是 ASCII 安全的
                    path = str(win_path).replace('\\', '/')
                    if len(path) > 1 and path[1] == ':':
                        drive = path[0].lower()
                        path = f'/mnt/{drive}{path[2:]}'
                    return path
                
                wsl_inventory = to_wsl_path(inventory_file)
                wsl_playbook = to_wsl_path(playbook_file)
                wsl_vars = to_wsl_path(vars_file) if vars_file else None
                
                # 使用 wsl 执行，设置 LANG 环境变量避免编码问题
                cmd = [
                    'wsl', '-e', 'bash', '-c',
                    f'export LANG=C.UTF-8 && export LC_ALL=C.UTF-8 && ansible-playbook -i "{wsl_inventory}" "{wsl_playbook}" --timeout {self.ansible_timeout} --forks {self.ansible_forks} -v' + (f' -e "@{wsl_vars}"' if wsl_vars else '')
                ]
            else:
                # Linux/Mac: use ansible directly
                cmd = [
                    'ansible-playbook',
                    '-i', inventory_file,
                    playbook_file,
                    '--timeout', str(self.ansible_timeout),
                    '--forks', str(self.ansible_forks),
                    '-v'
                ]
                if vars_file:
                    cmd.extend(['-e', f'@{vars_file}'])

            logger.info(f"Executing Ansible command: {' '.join(cmd)}")

            env = os.environ.copy()
            env.update({
                'ANSIBLE_HOST_KEY_CHECKING': 'False',
                'ANSIBLE_SSH_RETRIES': '3',
                'ANSIBLE_TIMEOUT': str(self.ansible_timeout),
                'ANSIBLE_GATHERING': 'smart',
                'ANSIBLE_CACHE_PLUGIN': 'memory',
                'PYTHONIOENCODING': 'utf-8',
                'LANG': 'C.UTF-8',
                'LC_ALL': 'C.UTF-8'
            })

            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                env=env,
                cwd=os.path.dirname(playbook_file),
                encoding='utf-8',
                errors='replace'
            )

            output_lines = []
            while True:
                if self.is_cancelled:
                    self.process.terminate()
                    return '\n'.join(output_lines), "Execution cancelled", -1

                line = self.process.stdout.readline()
                if not line and self.process.poll() is not None:
                    break
                if line:
                    output_lines.append(line.strip())

            exit_code = self.process.poll()
            output = '\n'.join(output_lines)
            logger.info(f"Ansible execution completed, exit code: {exit_code}")
            return output, "", exit_code

        except Exception as e:
            logger.error(f"Failed to execute Ansible playbook: {str(e)}")
            return "", str(e), 1

    def cancel(self):
        self.is_cancelled = True
        if self.process:
            try:
                self.process.terminate()
                logger.info(f"Cancelled Ansible execution: {self.execution_id}")
            except Exception as e:
                logger.warning(f"Failed to cancel execution: {str(e)}")



class AnsibleService:
    _running_executors: Dict[int, AnsibleExecutor] = {}

    @classmethod
    def _update_execution_output(cls, execution_id: int, output: str):
        """实时更新执行输出到数据库"""
        try:
            # 使用新的数据库会话避免冲突
            execution = PlaybookExecution.query.get(execution_id)
            if execution:
                # 清理 NUL 字符
                clean_output = output.replace('\x00', '').replace('\0', '') if output else ''
                execution.output = clean_output
                db.session.commit()
        except Exception as e:
            logger.warning(f"Failed to update execution output: {str(e)}")
            try:
                db.session.rollback()
            except:
                pass

    @classmethod
    def _determine_success(cls, exit_code: int, output: str, is_cancelled: bool) -> bool:
        """智能判定执行是否成功"""
        if is_cancelled:
            return False
        
        # 如果退出码为0，直接成功
        if exit_code == 0:
            return True
        
        # 检查输出中的统计信息
        if output:
            # 查找 PLAY RECAP 后的统计行
            lines = output.split('\n')
            for line in lines:
                # 格式: hostname : ok=X changed=X unreachable=X failed=X
                if 'failed=' in line and 'unreachable=' in line:
                    try:
                        # 提取 failed 和 unreachable 的值
                        import re
                        failed_match = re.search(r'failed=(\d+)', line)
                        unreachable_match = re.search(r'unreachable=(\d+)', line)
                        
                        failed = int(failed_match.group(1)) if failed_match else 0
                        unreachable = int(unreachable_match.group(1)) if unreachable_match else 0
                        
                        # 如果有任何失败或不可达，返回失败
                        if failed > 0 or unreachable > 0:
                            return False
                    except:
                        pass
            
            # 如果找到了统计信息且没有失败，认为成功
            if 'PLAY RECAP' in output and 'failed=0' in output:
                return True
        
        # 默认根据退出码判断
        return exit_code == 0

    @classmethod
    def _execute_with_realtime_log(cls, executor: AnsibleExecutor, execution: PlaybookExecution,
                                    playbook_file: str, inventory_file: str, vars_file: str = None):
        """执行 Playbook 并实时更新日志到数据库"""
        try:
            import platform
            is_windows = platform.system() == 'Windows'
            
            if is_windows:
                def to_wsl_path(win_path: str) -> str:
                    path = str(win_path).replace('\\', '/')
                    if len(path) > 1 and path[1] == ':':
                        drive = path[0].lower()
                        path = f'/mnt/{drive}{path[2:]}'
                    return path
                
                wsl_inventory = to_wsl_path(inventory_file)
                wsl_playbook = to_wsl_path(playbook_file)
                wsl_vars = to_wsl_path(vars_file) if vars_file else None
                
                cmd = [
                    'wsl', '-e', 'bash', '-c',
                    f'export LANG=C.UTF-8 && export LC_ALL=C.UTF-8 && ansible-playbook -i "{wsl_inventory}" "{wsl_playbook}" --timeout {executor.ansible_timeout} --forks {executor.ansible_forks} -v' + (f' -e "@{wsl_vars}"' if wsl_vars else '')
                ]
            else:
                cmd = [
                    'ansible-playbook',
                    '-i', inventory_file,
                    playbook_file,
                    '--timeout', str(executor.ansible_timeout),
                    '--forks', str(executor.ansible_forks),
                    '-v'
                ]
                if vars_file:
                    cmd.extend(['-e', f'@{vars_file}'])

            logger.info(f"Executing Ansible command with realtime log: {' '.join(cmd)}")

            env = os.environ.copy()
            env.update({
                'ANSIBLE_HOST_KEY_CHECKING': 'False',
                'ANSIBLE_SSH_RETRIES': '3',
                'ANSIBLE_TIMEOUT': str(executor.ansible_timeout),
                'ANSIBLE_GATHERING': 'smart',
                'ANSIBLE_CACHE_PLUGIN': 'memory',
                'PYTHONIOENCODING': 'utf-8',
                'LANG': 'C.UTF-8',
                'LC_ALL': 'C.UTF-8'
            })

            executor.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                env=env,
                cwd=os.path.dirname(playbook_file),
                encoding='utf-8',
                errors='replace'
            )

            output_lines = []
            line_count = 0
            update_interval = 5  # 每5行更新一次数据库
            
            while True:
                if executor.is_cancelled:
                    executor.process.terminate()
                    return '\n'.join(output_lines), "Execution cancelled", -1

                line = executor.process.stdout.readline()
                if not line and executor.process.poll() is not None:
                    break
                if line:
                    clean_line = line.strip()
                    output_lines.append(clean_line)
                    line_count += 1
                    
                    # 每隔一定行数更新数据库，让 SSE 可以读取到最新日志
                    if line_count % update_interval == 0:
                        cls._update_execution_output(execution.id, '\n'.join(output_lines))

            # 最终更新
            exit_code = executor.process.poll()
            output = '\n'.join(output_lines)
            cls._update_execution_output(execution.id, output)
            
            logger.info(f"Ansible execution completed, exit code: {exit_code}")
            return output, "", exit_code

        except Exception as e:
            logger.error(f"Failed to execute Ansible playbook with realtime log: {str(e)}")
            return "", str(e), 1

    @classmethod
    def execute_by_id(cls, execution_id: int) -> bool:
        """Execute playbook by execution record ID"""
        try:
            execution = PlaybookExecution.query.get(execution_id)
            if not execution:
                logger.error(f"[Ansible] Execution record not found: {execution_id}")
                return False

            playbook = AnsiblePlaybook.query.get(execution.playbook_id)
            if not playbook:
                execution.status = 'failed'
                execution.error_message = 'Playbook not found'
                db.session.commit()
                return False

            hosts = SSHHost.query.filter(SSHHost.id.in_(execution.host_ids)).all()
            if not hosts:
                execution.status = 'failed'
                execution.error_message = 'Target hosts not found'
                db.session.commit()
                return False

            execution_uuid = str(uuid.uuid4())
            execution.execution_id = execution_uuid
            execution.start_execution()
            db.session.commit()

            logger.info(f"[Ansible] Starting execution: id={execution.id}, playbook={playbook.name}, hosts={len(hosts)}")

            executor = AnsibleExecutor(execution_uuid)
            cls._running_executors[execution.id] = executor

            with AnsibleExecutionEnvironment(execution_uuid) as env:
                inventory_file = env.create_inventory(hosts)
                playbook_file = env.create_playbook(playbook.content)
                vars_file = env.create_vars_file(execution.variables) if execution.variables else None

                try:
                    playbook_data = yaml.safe_load(playbook.content)
                    if isinstance(playbook_data, list) and len(playbook_data) > 0:
                        tasks = playbook_data[0].get('tasks', [])
                        execution.total_tasks = len(tasks) * len(hosts)
                        db.session.commit()
                except Exception:
                    execution.total_tasks = len(hosts)
                    db.session.commit()

                # 执行并实时更新日志
                output, error, exit_code = cls._execute_with_realtime_log(
                    executor, execution, playbook_file, inventory_file, vars_file
                )

                # 清理输出中的 NUL 字符（PostgreSQL 不支持）
                def clean_string(s):
                    if s:
                        return s.replace('\x00', '').replace('\0', '')
                    return s
                
                output = clean_string(output)
                error = clean_string(error)

                execution.output = output
                if error:
                    execution.error_message = error

                cls._parse_execution_results(execution, output)

                # 更智能的成功判定：检查输出中是否有 failed=0
                success = cls._determine_success(exit_code, output, executor.is_cancelled)
                execution.finish_execution(success=success, error_message=error if not success else None)

                playbook.last_execution_status = 'success' if success else 'failed'
                playbook.last_executed_at = execution.finished_at
                playbook.execution_count = (playbook.execution_count or 0) + 1

                db.session.commit()

            cls._running_executors.pop(execution.id, None)
            logger.info(f"[Ansible] Execution completed: id={execution.id}, status={'success' if success else 'failed'}")
            return success

        except Exception as e:
            logger.error(f"[Ansible] Execution error: {str(e)}")
            try:
                db.session.rollback()  # 先回滚之前的事务
                execution = PlaybookExecution.query.get(execution_id)
                if execution:
                    error_msg = str(e).replace('\x00', '').replace('\0', '')
                    execution.finish_execution(success=False, error_message=error_msg)
                    db.session.commit()
                    cls._running_executors.pop(execution_id, None)
            except Exception:
                pass
            return False


    @classmethod
    def cancel_execution(cls, execution_id: int, reason: str = "User cancelled") -> Dict[str, Any]:
        try:
            execution = PlaybookExecution.query.get(execution_id)
            if not execution:
                return {'success': False, 'message': 'Execution record not found'}

            if not execution.can_be_cancelled():
                return {'success': False, 'message': 'Cannot cancel this execution'}

            executor = cls._running_executors.get(execution_id)
            if executor:
                executor.cancel()
                cls._running_executors.pop(execution_id, None)

            execution.cancel_execution(reason)
            db.session.commit()

            logger.info(f"[Ansible] Cancelled execution: id={execution_id}, reason={reason}")
            return {'success': True, 'message': 'Execution cancelled'}

        except Exception as e:
            logger.error(f"[Ansible] Failed to cancel execution: {str(e)}")
            return {'success': False, 'message': f'Cancel failed: {str(e)}'}

    @classmethod
    def get_execution_status(cls, execution_id: int) -> Optional[Dict[str, Any]]:
        try:
            execution = PlaybookExecution.query.get(execution_id)
            if not execution:
                return None

            return {
                'id': execution.id,
                'execution_id': execution.execution_id,
                'status': execution.status,
                'started_at': execution.started_at.isoformat() if execution.started_at else None,
                'finished_at': execution.finished_at.isoformat() if execution.finished_at else None,
                'duration': execution.duration,
                'total_tasks': execution.total_tasks,
                'completed_tasks': execution.completed_tasks,
                'failed_tasks': execution.failed_tasks,
                'output': execution.output,
                'error_message': execution.error_message
            }
        except Exception as e:
            logger.error(f"[Ansible] Failed to get execution status: {str(e)}")
            return None

    @classmethod
    def get_running_executions(cls) -> List[Dict[str, Any]]:
        try:
            executions = PlaybookExecution.query.filter(
                PlaybookExecution.status == 'running'
            ).all()

            return [{
                'id': e.id,
                'execution_id': e.execution_id,
                'playbook_id': e.playbook_id,
                'playbook_name': e.playbook.name if e.playbook else None,
                'started_at': e.started_at.isoformat() if e.started_at else None,
                'host_count': len(e.host_ids) if e.host_ids else 0
            } for e in executions]
        except Exception as e:
            logger.error(f"[Ansible] Failed to get running executions: {str(e)}")
            return []

    @classmethod
    def _parse_execution_results(cls, execution: PlaybookExecution, output: str):
        try:
            completed_tasks = 0
            failed_tasks = 0
            skipped_tasks = 0

            lines = output.split('\n')
            for line in lines:
                if 'ok=' in line and 'changed=' in line:
                    parts = line.split()
                    for part in parts:
                        if part.startswith('ok='):
                            completed_tasks += int(part.split('=')[1])
                        elif part.startswith('failed='):
                            failed_tasks += int(part.split('=')[1])
                        elif part.startswith('skipped='):
                            skipped_tasks += int(part.split('=')[1])

            execution.update_progress(
                completed_tasks=completed_tasks,
                failed_tasks=failed_tasks,
                skipped_tasks=skipped_tasks
            )
        except Exception as e:
            logger.warning(f"[Ansible] Failed to parse execution results: {str(e)}")

    @classmethod
    def cleanup_finished_executions(cls):
        finished_ids = []
        for exec_id, executor in cls._running_executors.items():
            execution = PlaybookExecution.query.get(exec_id)
            if execution and execution.status in ['success', 'failed', 'cancelled']:
                finished_ids.append(exec_id)

        for exec_id in finished_ids:
            cls._running_executors.pop(exec_id, None)

        if finished_ids:
            logger.info(f"[Ansible] Cleaned up finished execution refs: {len(finished_ids)}")


ansible_service = AnsibleService()
