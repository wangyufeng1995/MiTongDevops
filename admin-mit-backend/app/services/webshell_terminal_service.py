"""
WebShell 终端功能服务
提供终端命令执行、输入输出处理、大小调整和历史记录功能
集成命令过滤和审计日志功能
"""
import threading
import time
import logging
import json
import queue
from typing import Dict, Optional, Any, Tuple, List
from datetime import datetime
from dataclasses import dataclass, asdict
from app.services.ssh_service import ssh_service, SSHConnectionError
from app.services.webshell_service import webshell_service
from app.services.websocket_service import websocket_service
from app.services.command_filter_service import command_filter_service
from app.services.webshell_audit_service import webshell_audit_service
from app.extensions import db, redis_client
import paramiko

logger = logging.getLogger(__name__)


@dataclass
class TerminalCommand:
    """终端命令记录"""
    session_id: str
    command: str
    output: str
    error: str
    exit_code: int
    executed_at: datetime
    execution_time: float  # 执行时间（秒）
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        data = asdict(self)
        data['executed_at'] = self.executed_at.isoformat()
        return data


class TerminalSession:
    """终端会话类"""
    
    def __init__(self, webshell_session_id: str, ssh_connection, user_id: int = None, 
                 host_id: int = None, tenant_id: int = None, ip_address: str = None):
        self.webshell_session_id = webshell_session_id
        self.ssh_connection = ssh_connection
        self.shell_channel = None
        self.is_active = False
        self.command_history: List[TerminalCommand] = []
        self.current_directory = "~"
        self.environment_vars = {}
        self._lock = threading.Lock()
        
        # 用户和主机信息（用于命令过滤和审计）
        self.user_id = user_id
        self.host_id = host_id
        self.tenant_id = tenant_id
        self.ip_address = ip_address
        
        # 命令缓冲区（用于检测完整命令）
        self._command_buffer = ""
        
        # 输入输出队列
        self.input_queue = queue.Queue()
        self.output_queue = queue.Queue()
        
        # 线程控制
        self.input_thread = None
        self.output_thread = None
        self.stop_threads = threading.Event()
        
    def start_shell(self, cols: int = 80, rows: int = 24) -> Tuple[bool, str]:
        """启动 shell 会话"""
        try:
            with self._lock:
                if self.is_active:
                    return True, "Shell 已经启动"
                
                # 创建 shell 通道
                self.shell_channel = self.ssh_connection.client.invoke_shell(
                    term='xterm',
                    width=cols,
                    height=rows
                )
                
                # 设置非阻塞模式
                self.shell_channel.settimeout(0.1)
                
                self.is_active = True
                
                # 启动输入输出处理线程
                self._start_io_threads()
                
                logger.info(f"Shell 会话启动成功: {self.webshell_session_id}")
                return True, "Shell 启动成功"
                
        except Exception as e:
            logger.error(f"启动 Shell 会话失败: {str(e)}")
            return False, f"启动 Shell 失败: {str(e)}"
    
    def _start_io_threads(self):
        """启动输入输出处理线程"""
        self.stop_threads.clear()
        
        # 启动输出处理线程
        self.output_thread = threading.Thread(
            target=self._handle_output,
            daemon=True
        )
        self.output_thread.start()
        
        # 启动输入处理线程
        self.input_thread = threading.Thread(
            target=self._handle_input,
            daemon=True
        )
        self.input_thread.start()
    
    def _handle_output(self):
        """处理 SSH 输出"""
        buffer = ""
        
        while not self.stop_threads.is_set() and self.is_active:
            try:
                if self.shell_channel and self.shell_channel.recv_ready():
                    data = self.shell_channel.recv(4096).decode('utf-8', errors='ignore')
                    if data:
                        buffer += data
                        
                        # 发送输出到 WebSocket 客户端
                        self._send_output_to_client(data)
                        
                        # 检查是否有完整的行（用于命令历史记录）
                        if '\n' in buffer or '\r' in buffer:
                            lines = buffer.split('\n')
                            buffer = lines[-1]  # 保留最后一行（可能不完整）
                            
                            for line in lines[:-1]:
                                line = line.strip('\r')
                                if line:
                                    self._process_output_line(line)
                
                time.sleep(0.01)  # 避免过度占用 CPU
                
            except Exception as e:
                if self.is_active:
                    logger.error(f"处理输出时出错: {str(e)}")
                break
    
    def _handle_input(self):
        """处理输入队列"""
        while not self.stop_threads.is_set() and self.is_active:
            try:
                # 从队列获取输入数据
                input_data = self.input_queue.get(timeout=0.1)
                
                if self.shell_channel and input_data:
                    self.shell_channel.send(input_data)
                    
                    # 更新会话活动时间
                    webshell_service.update_session_activity(self.webshell_session_id)
                    
            except queue.Empty:
                continue
            except Exception as e:
                if self.is_active:
                    logger.error(f"处理输入时出错: {str(e)}")
                break
    
    def _send_output_to_client(self, data: str):
        """发送输出到 WebSocket 客户端"""
        try:
            # 获取 WebShell 会话信息
            session_info = webshell_service.get_session(self.webshell_session_id)
            if session_info:
                user_id = session_info['user_id']
                
                # 发送输出数据到客户端
                websocket_service.send_to_user(
                    user_id,
                    'webshell_output',
                    {
                        'session_id': self.webshell_session_id,
                        'data': data,
                        'timestamp': datetime.utcnow().isoformat()
                    }
                )
                
        except Exception as e:
            logger.error(f"发送输出到客户端失败: {str(e)}")
    
    def _process_output_line(self, line: str):
        """处理输出行（用于命令历史等）"""
        # 这里可以添加命令识别和历史记录逻辑
        # 目前只是记录日志
        logger.debug(f"Terminal output: {line}")
    
    def send_input(self, data: str) -> Tuple[bool, str]:
        """
        发送输入数据
        
        对于命令输入（以回车结尾），会进行命令过滤检查。
        被阻止的命令会返回错误信息，不会发送到服务器。
        
        Args:
            data: 输入数据
            
        Returns:
            (success, message) 元组
            - success: 是否成功发送
            - message: 错误信息（如果被阻止）
        """
        try:
            if not self.is_active:
                return False, "终端会话未激活"
            
            # 检测是否是命令输入（以回车结尾）
            # 回车符可能是 \r, \n, 或 \r\n
            is_command_submit = data.endswith('\r') or data.endswith('\n')
            
            # 累积命令缓冲区
            self._command_buffer += data
            
            if is_command_submit:
                # 提取完整命令（去除回车符）
                command = self._command_buffer.strip('\r\n')
                self._command_buffer = ""  # 清空缓冲区
                
                if command:
                    # 进行命令过滤检查
                    is_allowed, block_reason = self._check_command_filter(command)
                    
                    if not is_allowed:
                        # 命令被阻止，记录审计日志
                        self._log_blocked_command(command, block_reason)
                        
                        # 发送阻止消息到客户端
                        self._send_blocked_message_to_client(command, block_reason)
                        
                        logger.warning(f"命令被阻止: {command}, 原因: {block_reason}")
                        return False, f"命令被阻止: {block_reason}"
                    
                    # 命令允许执行，记录审计日志（状态为 pending，后续更新）
                    # 注意：这里只记录命令提交，实际执行结果在输出处理中更新
                    self._log_command_execution(command)
            
            # 发送输入到队列
            self.input_queue.put(data)
            return True, ""
            
        except Exception as e:
            logger.error(f"发送输入失败: {str(e)}")
            return False, f"发送输入失败: {str(e)}"
    
    def _check_command_filter(self, command: str) -> Tuple[bool, str]:
        """
        检查命令是否允许执行
        
        Args:
            command: 要检查的命令
            
        Returns:
            (is_allowed, reason) 元组
        """
        try:
            if not self.host_id or not self.tenant_id:
                # 如果没有主机或租户信息，允许执行（向后兼容）
                return True, ""
            
            return command_filter_service.check_command(
                host_id=self.host_id,
                tenant_id=self.tenant_id,
                command=command
            )
        except Exception as e:
            logger.error(f"命令过滤检查失败: {str(e)}")
            # 过滤检查失败时，允许执行（fail-open）
            return True, ""
    
    def _log_blocked_command(self, command: str, block_reason: str):
        """
        记录被阻止的命令到审计日志
        
        Args:
            command: 被阻止的命令
            block_reason: 阻止原因
        """
        try:
            if not self.user_id or not self.host_id or not self.tenant_id:
                return
            
            webshell_audit_service.log_command(
                user_id=self.user_id,
                host_id=self.host_id,
                command=command,
                status='blocked',
                tenant_id=self.tenant_id,
                session_id=self.webshell_session_id,
                block_reason=block_reason,
                ip_address=self.ip_address
            )
        except Exception as e:
            logger.error(f"记录被阻止命令失败: {str(e)}")
    
    def _log_command_execution(self, command: str, status: str = 'success', 
                               output: str = None, error: str = None,
                               execution_time: float = None):
        """
        记录命令执行到审计日志
        
        Args:
            command: 执行的命令
            status: 状态 ('success', 'failed')
            output: 命令输出
            error: 错误信息
            execution_time: 执行时间
        """
        try:
            if not self.user_id or not self.host_id or not self.tenant_id:
                return
            
            webshell_audit_service.log_command(
                user_id=self.user_id,
                host_id=self.host_id,
                command=command,
                status=status,
                tenant_id=self.tenant_id,
                session_id=self.webshell_session_id,
                output=output,
                error=error,
                ip_address=self.ip_address,
                execution_time=execution_time
            )
        except Exception as e:
            logger.error(f"记录命令执行失败: {str(e)}")
    
    def _send_blocked_message_to_client(self, command: str, block_reason: str):
        """
        发送命令被阻止的消息到 WebSocket 客户端
        
        Args:
            command: 被阻止的命令
            block_reason: 阻止原因
        """
        try:
            session_info = webshell_service.get_session(self.webshell_session_id)
            if session_info:
                user_id = session_info['user_id']
                
                # 发送阻止消息
                error_message = f"\r\n\033[31m[命令被阻止] {block_reason}\033[0m\r\n"
                
                websocket_service.send_to_user(
                    user_id,
                    'webshell_output',
                    {
                        'session_id': self.webshell_session_id,
                        'data': error_message,
                        'timestamp': datetime.utcnow().isoformat(),
                        'type': 'blocked'
                    }
                )
        except Exception as e:
            logger.error(f"发送阻止消息到客户端失败: {str(e)}")
    
    def execute_command(self, command: str, timeout: int = 30) -> Tuple[bool, str, TerminalCommand]:
        """执行命令并记录历史"""
        start_time = time.time()
        
        try:
            if not self.ssh_connection or not self.ssh_connection.is_connected:
                return False, "SSH 连接未建立", None
            
            # 进行命令过滤检查
            is_allowed, block_reason = self._check_command_filter(command)
            
            if not is_allowed:
                # 命令被阻止，记录审计日志
                self._log_blocked_command(command, block_reason)
                
                # 创建被阻止的命令记录
                cmd_record = TerminalCommand(
                    session_id=self.webshell_session_id,
                    command=command,
                    output="",
                    error=f"命令被阻止: {block_reason}",
                    exit_code=-1,
                    executed_at=datetime.utcnow(),
                    execution_time=0
                )
                
                logger.warning(f"命令被阻止: {command}, 原因: {block_reason}")
                return False, f"命令被阻止: {block_reason}", cmd_record
            
            # 执行命令
            stdout, stderr, exit_code = self.ssh_connection.execute_command(command, timeout)
            
            execution_time = time.time() - start_time
            
            # 创建命令记录
            cmd_record = TerminalCommand(
                session_id=self.webshell_session_id,
                command=command,
                output=stdout,
                error=stderr,
                exit_code=exit_code,
                executed_at=datetime.utcnow(),
                execution_time=execution_time
            )
            
            # 添加到历史记录
            with self._lock:
                self.command_history.append(cmd_record)
                
                # 限制历史记录数量
                if len(self.command_history) > 1000:
                    self.command_history = self.command_history[-1000:]
            
            # 保存到 Redis 缓存
            self._save_command_to_cache(cmd_record)
            
            # 更新会话活动时间
            webshell_service.update_session_activity(self.webshell_session_id)
            
            # 记录审计日志
            status = 'success' if exit_code == 0 else 'failed'
            self._log_command_execution(
                command=command,
                status=status,
                output=stdout,
                error=stderr if exit_code != 0 else None,
                execution_time=execution_time
            )
            
            logger.info(f"命令执行完成: {command} (exit_code: {exit_code}, time: {execution_time:.2f}s)")
            
            return True, "命令执行成功", cmd_record
            
        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"命令执行失败: {str(e)}"
            
            # 创建错误记录
            cmd_record = TerminalCommand(
                session_id=self.webshell_session_id,
                command=command,
                output="",
                error=error_msg,
                exit_code=-1,
                executed_at=datetime.utcnow(),
                execution_time=execution_time
            )
            
            # 添加到历史记录
            with self._lock:
                self.command_history.append(cmd_record)
            
            # 记录审计日志
            self._log_command_execution(
                command=command,
                status='failed',
                error=error_msg,
                execution_time=execution_time
            )
            
            logger.error(f"命令执行失败: {command}, 错误: {str(e)}")
            
            return False, error_msg, cmd_record
    
    def _save_command_to_cache(self, cmd_record: TerminalCommand):
        """保存命令记录到 Redis 缓存"""
        try:
            cache_key = f"webshell:history:{self.webshell_session_id}"
            
            # 获取现有历史记录
            existing_history = redis_client.lrange(cache_key, 0, -1)
            
            # 添加新记录
            redis_client.lpush(cache_key, json.dumps(cmd_record.to_dict()))
            
            # 限制缓存数量
            redis_client.ltrim(cache_key, 0, 999)  # 保留最新的1000条记录
            
            # 设置过期时间（7天）
            redis_client.expire(cache_key, 7 * 24 * 3600)
            
        except Exception as e:
            logger.error(f"保存命令历史到缓存失败: {str(e)}")
    
    def resize_terminal(self, cols: int, rows: int) -> bool:
        """调整终端大小"""
        try:
            if self.shell_channel and self.is_active:
                self.shell_channel.resize_pty(width=cols, height=rows)
                
                # 更新 WebShell 会话的终端大小
                webshell_service.update_terminal_size(self.webshell_session_id, cols, rows)
                
                logger.info(f"终端大小已调整: {self.webshell_session_id} -> {cols}x{rows}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"调整终端大小失败: {str(e)}")
            return False
    
    def get_command_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        """获取命令历史记录"""
        with self._lock:
            # 从内存获取最新记录
            recent_history = [cmd.to_dict() for cmd in self.command_history[-limit:]]
            
            if len(recent_history) < limit:
                # 从 Redis 缓存获取更多历史记录
                try:
                    cache_key = f"webshell:history:{self.webshell_session_id}"
                    cached_history = redis_client.lrange(cache_key, 0, limit - len(recent_history) - 1)
                    
                    for cached_cmd in cached_history:
                        try:
                            cmd_data = json.loads(cached_cmd)
                            recent_history.insert(0, cmd_data)
                        except json.JSONDecodeError:
                            continue
                            
                except Exception as e:
                    logger.error(f"从缓存获取命令历史失败: {str(e)}")
            
            return recent_history[-limit:]  # 返回最新的记录
    
    def stop_shell(self):
        """停止 shell 会话"""
        try:
            with self._lock:
                if not self.is_active:
                    return
                
                self.is_active = False
                
                # 停止线程
                self.stop_threads.set()
                
                # 关闭 shell 通道
                if self.shell_channel:
                    try:
                        self.shell_channel.close()
                    except Exception as e:
                        logger.warning(f"关闭 shell 通道时出错: {str(e)}")
                    finally:
                        self.shell_channel = None
                
                # 等待线程结束
                if self.output_thread and self.output_thread.is_alive():
                    self.output_thread.join(timeout=2)
                
                if self.input_thread and self.input_thread.is_alive():
                    self.input_thread.join(timeout=2)
                
                logger.info(f"Shell 会话已停止: {self.webshell_session_id}")
                
        except Exception as e:
            logger.error(f"停止 Shell 会话时出错: {str(e)}")


class WebShellTerminalService:
    """WebShell 终端服务"""
    
    def __init__(self):
        self.terminal_sessions: Dict[str, TerminalSession] = {}
        self._lock = threading.Lock()
        logger.info("WebShell 终端服务已初始化")
    
    def create_terminal_session(self, webshell_session_id: str, cols: int = 80, rows: int = 24,
                                 ip_address: str = None) -> Tuple[bool, str]:
        """创建终端会话"""
        try:
            # 获取 WebShell 会话信息（需要获取原始会话对象以访问密码）
            session = webshell_service.session_manager.get_session(webshell_session_id)
            if not session:
                return False, "WebShell 会话不存在"
            
            # 检查是否已有终端会话
            with self._lock:
                if webshell_session_id in self.terminal_sessions:
                    return False, "终端会话已存在"
            
            # 密码已经是明文，直接使用
            
            # 获取 SSH 连接
            try:
                ssh_connection = ssh_service.connection_pool.get_connection(
                    hostname=session.hostname,
                    port=session.port,
                    username=session.username,
                    password=session.password if session.auth_type == 'password' else None,
                    private_key=session.private_key if session.auth_type == 'key' else None
                )
            except Exception as e:
                return False, f"获取 SSH 连接失败: {str(e)}"
            
            # 创建终端会话（传递用户、主机、租户信息用于命令过滤和审计）
            terminal_session = TerminalSession(
                webshell_session_id=webshell_session_id,
                ssh_connection=ssh_connection,
                user_id=session.user_id,
                host_id=session.host_id,
                tenant_id=session.tenant_id,
                ip_address=ip_address
            )
            
            # 启动 shell
            success, message = terminal_session.start_shell(cols, rows)
            if not success:
                return False, message
            
            # 添加到会话管理
            with self._lock:
                self.terminal_sessions[webshell_session_id] = terminal_session
            
            logger.info(f"终端会话创建成功: {webshell_session_id}")
            return True, "终端会话创建成功"
            
        except Exception as e:
            logger.error(f"创建终端会话失败: {str(e)}")
            return False, f"创建终端会话失败: {str(e)}"
    
    def get_terminal_session(self, webshell_session_id: str) -> Optional[TerminalSession]:
        """获取终端会话"""
        with self._lock:
            return self.terminal_sessions.get(webshell_session_id)
    
    def send_input(self, webshell_session_id: str, data: str) -> Tuple[bool, str]:
        """
        发送输入到终端
        
        Args:
            webshell_session_id: WebShell 会话 ID
            data: 输入数据
            
        Returns:
            (success, message) 元组
            - success: 是否成功发送
            - message: 错误信息（如果被阻止或失败）
        """
        terminal_session = self.get_terminal_session(webshell_session_id)
        if terminal_session:
            return terminal_session.send_input(data)
        return False, "终端会话不存在"
    
    def execute_command(self, webshell_session_id: str, command: str, timeout: int = 30) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        """执行命令"""
        terminal_session = self.get_terminal_session(webshell_session_id)
        if not terminal_session:
            return False, "终端会话不存在", None
        
        success, message, cmd_record = terminal_session.execute_command(command, timeout)
        
        if cmd_record:
            return success, message, cmd_record.to_dict()
        else:
            return success, message, None
    
    def resize_terminal(self, webshell_session_id: str, cols: int, rows: int) -> bool:
        """调整终端大小"""
        terminal_session = self.get_terminal_session(webshell_session_id)
        if terminal_session:
            return terminal_session.resize_terminal(cols, rows)
        return False
    
    def get_command_history(self, webshell_session_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """获取命令历史记录"""
        terminal_session = self.get_terminal_session(webshell_session_id)
        if terminal_session:
            return terminal_session.get_command_history(limit)
        return []
    
    def terminate_terminal_session(self, webshell_session_id: str) -> bool:
        """终止终端会话"""
        try:
            with self._lock:
                terminal_session = self.terminal_sessions.pop(webshell_session_id, None)
                
                if terminal_session:
                    terminal_session.stop_shell()
                    logger.info(f"终端会话已终止: {webshell_session_id}")
                    return True
                
                return False
                
        except Exception as e:
            logger.error(f"终止终端会话失败: {str(e)}")
            return False
    
    def get_terminal_stats(self) -> Dict[str, Any]:
        """获取终端统计信息"""
        with self._lock:
            active_sessions = sum(1 for session in self.terminal_sessions.values() if session.is_active)
            
            return {
                'total_terminal_sessions': len(self.terminal_sessions),
                'active_terminal_sessions': active_sessions,
                'session_ids': list(self.terminal_sessions.keys())
            }
    
    def cleanup_session(self, webshell_session_id: str):
        """清理会话（当 WebShell 会话结束时调用）"""
        self.terminate_terminal_session(webshell_session_id)


# 全局 WebShell 终端服务实例
webshell_terminal_service = WebShellTerminalService()