"""
SSH 终端桥接服务
优化的 xterm.js + Flask-SocketIO + Paramiko + WebSocket 转发桥接模式
提供高性能、低延迟的 SSH 终端连接
集成命令过滤和审计日志功能
"""
import threading
import time
import logging
import queue
import select
from typing import Dict, Optional, Any, Tuple, Callable
from datetime import datetime
from dataclasses import dataclass
import paramiko
from app.services.ssh_service import ssh_service, SSHConnectionError
from app.services.websocket_service import websocket_service
from app.services.command_filter_service import command_filter_service
from app.services.webshell_audit_service import webshell_audit_service
from app.extensions import socketio

logger = logging.getLogger(__name__)


@dataclass
class TerminalBridgeConfig:
    """终端桥接配置"""
    buffer_size: int = 4096  # 读取缓冲区大小
    read_timeout: float = 0.01  # 读取超时（秒）
    write_queue_size: int = 1000  # 写入队列大小
    heartbeat_interval: int = 30  # 心跳间隔（秒）
    idle_timeout: int = 1800  # 空闲超时（秒）
    max_output_rate: int = 100000  # 最大输出速率（字节/秒）


class SSHTerminalBridge:
    """
    SSH 终端桥接
    负责在 SSH 通道和 WebSocket 之间进行数据转发
    """
    
    def __init__(
        self,
        session_id: str,
        ssh_channel: paramiko.Channel,
        user_id: int,
        host_id: int,
        tenant_id: int,
        config: TerminalBridgeConfig = None,
        socket_sid: str = None
    ):
        self.session_id = session_id
        self.ssh_channel = ssh_channel
        self.user_id = user_id
        self.host_id = host_id
        self.tenant_id = tenant_id
        self.config = config or TerminalBridgeConfig()
        self.socket_sid = socket_sid  # Socket.IO session ID，用于直接发送消息
        
        # 状态
        self.is_active = False
        self.created_at = datetime.utcnow()
        self.last_activity = datetime.utcnow()
        
        # 线程控制
        self._stop_event = threading.Event()
        self._read_thread: Optional[threading.Thread] = None
        self._write_thread: Optional[threading.Thread] = None
        
        # 写入队列
        self._write_queue: queue.Queue = queue.Queue(maxsize=self.config.write_queue_size)
        
        # 输出速率控制
        self._output_bytes = 0
        self._output_start_time = time.time()
        
        # 回调函数
        self._on_data_callback: Optional[Callable[[str], None]] = None
        self._on_close_callback: Optional[Callable[[str], None]] = None
        
        # 命令缓冲区（用于命令过滤）
        self._command_buffer = ""
        
        # 客户端 IP 地址（用于审计日志）
        self._ip_address: Optional[str] = None
        
        logger.info(f"SSH Terminal Bridge created: {session_id}")
    
    def start(self) -> bool:
        """启动桥接"""
        if self.is_active:
            return True
        
        try:
            # 设置通道为非阻塞模式
            self.ssh_channel.settimeout(self.config.read_timeout)
            self.ssh_channel.setblocking(False)
            
            self.is_active = True
            self._stop_event.clear()
            
            # 启动读取线程（SSH -> WebSocket）
            self._read_thread = threading.Thread(
                target=self._read_loop,
                name=f"ssh-read-{self.session_id[:8]}",
                daemon=True
            )
            self._read_thread.start()
            
            # 启动写入线程（WebSocket -> SSH）
            self._write_thread = threading.Thread(
                target=self._write_loop,
                name=f"ssh-write-{self.session_id[:8]}",
                daemon=True
            )
            self._write_thread.start()
            
            logger.info(f"SSH Terminal Bridge started: {self.session_id}, socket_sid: {self.socket_sid}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start SSH Terminal Bridge: {e}")
            import traceback
            traceback.print_exc()
            self.is_active = False
            return False
    
    def stop(self, reason: str = "Bridge stopped"):
        """停止桥接"""
        if not self.is_active:
            return
        
        logger.info(f"Stopping SSH Terminal Bridge: {self.session_id}, reason: {reason}")
        
        self.is_active = False
        self._stop_event.set()
        
        # 等待线程结束
        if self._read_thread and self._read_thread.is_alive():
            self._read_thread.join(timeout=2)
        
        if self._write_thread and self._write_thread.is_alive():
            # 发送空数据唤醒写入线程
            try:
                self._write_queue.put_nowait(None)
            except queue.Full:
                pass
            self._write_thread.join(timeout=2)
        
        # 关闭 SSH 通道
        try:
            if self.ssh_channel:
                self.ssh_channel.close()
        except Exception as e:
            logger.warning(f"Error closing SSH channel: {e}")
        
        # 触发关闭回调
        if self._on_close_callback:
            try:
                self._on_close_callback(reason)
            except Exception as e:
                logger.error(f"Error in close callback: {e}")
        
        logger.info(f"SSH Terminal Bridge stopped: {self.session_id}")
    
    def send_input(self, data: str) -> Tuple[bool, str]:
        """
        发送输入数据到 SSH
        
        对于命令输入（以回车结尾），会进行命令过滤检查。
        被阻止的命令会返回错误信息，不会发送到服务器。
        
        Args:
            data: 输入数据
            
        Returns:
            (success, error_message)
        """
        if not self.is_active:
            return False, "Bridge is not active"
        
        try:
            # 检测是否是命令输入（以回车结尾）
            # 回车符可能是 \r, \n, 或 \r\n
            is_command_submit = data.endswith('\r') or data.endswith('\n')
            
            # 处理特殊控制字符和 ESC 序列
            if len(data) >= 1:
                first_char = ord(data[0])
                
                # ESC 序列（方向键等）- 直接发送，可能需要清除缓冲区
                if first_char == 27:  # ESC
                    # 方向键上下会调用历史命令，清除当前缓冲区
                    if len(data) >= 3 and data[1] == '[':
                        if data[2] in ('A', 'B'):  # 上下方向键
                            self._command_buffer = ""
                    self._write_queue.put(data, timeout=1)
                    self.last_activity = datetime.utcnow()
                    return True, ""
                
                # 单个控制字符处理
                if len(data) == 1 and first_char < 32 and first_char not in (10, 13):
                    # 退格键处理 (DEL=127 在下面处理)
                    if first_char == 8:  # BS
                        if self._command_buffer:
                            self._command_buffer = self._command_buffer[:-1]
                    # Ctrl+U 清除行
                    elif first_char == 21:
                        self._command_buffer = ""
                    # Ctrl+C 中断
                    elif first_char == 3:
                        self._command_buffer = ""
                    # Ctrl+W 删除前一个单词
                    elif first_char == 23:
                        self._command_buffer = self._command_buffer.rsplit(None, 1)[0] if ' ' in self._command_buffer else ""
                    
                    # 直接发送控制字符
                    self._write_queue.put(data, timeout=1)
                    self.last_activity = datetime.utcnow()
                    return True, ""
                
                # DEL 键 (127)
                if len(data) == 1 and first_char == 127:
                    if self._command_buffer:
                        self._command_buffer = self._command_buffer[:-1]
                    self._write_queue.put(data, timeout=1)
                    self.last_activity = datetime.utcnow()
                    return True, ""
            
            if is_command_submit:
                # 添加回车前的内容到缓冲区
                self._command_buffer += data.rstrip('\r\n')
                
                # 提取完整命令
                command = self._command_buffer.strip()
                self._command_buffer = ""  # 清空缓冲区
                
                if command:
                    # 进行命令过滤检查
                    is_allowed, block_reason = self._check_command_filter(command)
                    
                    if not is_allowed:
                        # 命令被阻止，记录审计日志
                        self._log_blocked_command(command, block_reason)
                        
                        # 发送 Ctrl+U 和 Ctrl+C 清除并中断当前命令
                        self._cancel_and_block_command(command, block_reason)
                        
                        logger.warning(f"命令被阻止: {command}, 原因: {block_reason}")
                        return False, f"命令被阻止: {block_reason}"
                    
                    # 命令允许执行，记录审计日志
                    self._log_command_execution(command)
                
                # 发送回车执行命令
                self._write_queue.put(data, timeout=1)
                self.last_activity = datetime.utcnow()
                return True, ""
            else:
                # 非回车输入，累积到缓冲区并发送
                self._command_buffer += data
                self._write_queue.put(data, timeout=1)
                self.last_activity = datetime.utcnow()
                return True, ""
            
        except queue.Full:
            logger.warning(f"Write queue full for session: {self.session_id}")
            return False, "Write queue full"
        except Exception as e:
            logger.error(f"Error sending input: {e}")
            return False, str(e)
    
    def _cancel_and_block_command(self, command: str, block_reason: str):
        """
        取消当前命令并发送阻止消息
        
        发送 Ctrl+U 清除当前行，然后发送 Ctrl+C 确保中断，最后显示阻止消息
        
        Args:
            command: 被阻止的命令
            block_reason: 阻止原因
        """
        try:
            if self.ssh_channel and self.is_active:
                # 发送 Ctrl+U (ASCII 21) 清除当前行输入
                self.ssh_channel.send('\x15')
                time.sleep(0.03)
                
                # 发送 Ctrl+C (ASCII 3) 确保中断并显示新提示符
                self.ssh_channel.send('\x03')
                time.sleep(0.03)
            
            # 发送阻止消息到客户端
            self._send_blocked_message(command, block_reason)
            
        except Exception as e:
            logger.error(f"取消命令失败: {str(e)}")
            # 即使取消失败，也要发送阻止消息
            try:
                self._send_blocked_message(command, block_reason)
            except:
                pass
    
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
                session_id=self.session_id,
                block_reason=block_reason,
                ip_address=self._ip_address
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
                session_id=self.session_id,
                output=output,
                error=error,
                ip_address=self._ip_address,
                execution_time=execution_time
            )
        except Exception as e:
            logger.error(f"记录命令执行失败: {str(e)}")
    
    def _send_blocked_message(self, command: str, block_reason: str):
        """
        发送命令被阻止的消息到 WebSocket 客户端
        
        Args:
            command: 被阻止的命令
            block_reason: 阻止原因
        """
        try:
            # 发送阻止消息（红色文本）
            error_message = f"\r\n\033[31m[命令被阻止] {block_reason}\033[0m\r\n"
            
            output_data = {
                'session_id': self.session_id,
                'data': error_message,
                'timestamp': datetime.utcnow().isoformat(),
                'type': 'blocked'
            }
            
            # 优先使用 Socket.IO session ID 直接发送
            if self.socket_sid:
                socketio.emit('webshell_output', output_data, to=self.socket_sid)
            else:
                # 回退到用户房间广播
                websocket_service.send_to_user(
                    self.user_id,
                    'webshell_output',
                    output_data
                )
                
        except Exception as e:
            logger.error(f"发送阻止消息到客户端失败: {str(e)}")
    
    def resize(self, cols: int, rows: int) -> bool:
        """调整终端大小"""
        if not self.is_active or not self.ssh_channel:
            return False
        
        try:
            self.ssh_channel.resize_pty(width=cols, height=rows)
            self.last_activity = datetime.utcnow()
            logger.debug(f"Terminal resized: {self.session_id} -> {cols}x{rows}")
            return True
        except Exception as e:
            logger.error(f"Error resizing terminal: {e}")
            return False
    
    def set_on_data_callback(self, callback: Callable[[str], None]):
        """设置数据回调"""
        self._on_data_callback = callback
    
    def set_on_close_callback(self, callback: Callable[[str], None]):
        """设置关闭回调"""
        self._on_close_callback = callback
    
    def _read_loop(self):
        """读取循环：从 SSH 读取数据并发送到 WebSocket"""
        buffer = b""
        logger.info(f"Read loop started for session: {self.session_id}")
        
        while not self._stop_event.is_set() and self.is_active:
            try:
                # 检查通道是否有数据可读
                if self.ssh_channel.recv_ready():
                    data = self.ssh_channel.recv(self.config.buffer_size)
                    
                    if not data:
                        # 连接已关闭
                        logger.info(f"SSH channel closed: {self.session_id}")
                        self.stop("SSH connection closed")
                        break
                    
                    buffer += data
                    logger.debug(f"Received {len(data)} bytes from SSH for session: {self.session_id}")
                    
                    # 速率控制
                    self._output_bytes += len(data)
                    elapsed = time.time() - self._output_start_time
                    
                    if elapsed >= 1.0:
                        # 重置计数器
                        self._output_bytes = 0
                        self._output_start_time = time.time()
                    elif self._output_bytes > self.config.max_output_rate:
                        # 超过速率限制，等待
                        time.sleep(0.1)
                    
                    # 尝试解码并发送
                    try:
                        text = buffer.decode('utf-8')
                        buffer = b""
                        self._send_output(text)
                    except UnicodeDecodeError:
                        # 可能是不完整的 UTF-8 序列，保留在缓冲区
                        if len(buffer) > self.config.buffer_size * 2:
                            # 缓冲区太大，强制解码
                            text = buffer.decode('utf-8', errors='replace')
                            buffer = b""
                            self._send_output(text)
                
                # 检查 stderr
                if self.ssh_channel.recv_stderr_ready():
                    stderr_data = self.ssh_channel.recv_stderr(self.config.buffer_size)
                    if stderr_data:
                        try:
                            text = stderr_data.decode('utf-8', errors='replace')
                            self._send_output(text)
                        except Exception as e:
                            logger.warning(f"Error decoding stderr: {e}")
                
                # 检查通道状态
                if self.ssh_channel.exit_status_ready():
                    exit_status = self.ssh_channel.recv_exit_status()
                    logger.info(f"SSH channel exit status: {exit_status}")
                    self.stop(f"SSH process exited with status {exit_status}")
                    break
                
                # 短暂休眠避免 CPU 占用过高
                time.sleep(0.001)
                
            except socket.timeout:
                continue
            except Exception as e:
                if self.is_active:
                    logger.error(f"Error in read loop: {e}")
                    import traceback
                    traceback.print_exc()
                    self.stop(f"Read error: {e}")
                break
        
        # 发送剩余缓冲区数据
        if buffer:
            try:
                text = buffer.decode('utf-8', errors='replace')
                self._send_output(text)
            except Exception:
                pass
        
        logger.info(f"Read loop ended for session: {self.session_id}")
    
    def _write_loop(self):
        """写入循环：从队列读取数据并发送到 SSH"""
        while not self._stop_event.is_set() and self.is_active:
            try:
                # 从队列获取数据
                data = self._write_queue.get(timeout=0.1)
                
                if data is None:
                    # 停止信号
                    break
                
                if not self.ssh_channel or not self.is_active:
                    break
                
                # 发送数据到 SSH
                if isinstance(data, str):
                    data = data.encode('utf-8')
                
                self.ssh_channel.send(data)
                self.last_activity = datetime.utcnow()
                
            except queue.Empty:
                continue
            except Exception as e:
                if self.is_active:
                    logger.error(f"Error in write loop: {e}")
                    self.stop(f"Write error: {e}")
                break
    
    def _send_output(self, data: str):
        """发送输出到 WebSocket"""
        if not data:
            return
        
        self.last_activity = datetime.utcnow()
        
        # 触发数据回调
        if self._on_data_callback:
            try:
                self._on_data_callback(data)
            except Exception as e:
                logger.error(f"Error in data callback: {e}")
        
        # 发送到 WebSocket
        try:
            output_data = {
                'session_id': self.session_id,
                'data': data,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            # 优先使用 Socket.IO session ID 直接发送
            if self.socket_sid:
                socketio.emit('webshell_output', output_data, to=self.socket_sid)
                logger.debug(f"Sent output to socket_sid: {self.socket_sid}")
            else:
                # 回退到用户房间广播
                websocket_service.send_to_user(
                    self.user_id,
                    'webshell_output',
                    output_data
                )
        except Exception as e:
            logger.error(f"Error sending output to WebSocket: {e}")
    
    def is_idle_timeout(self) -> bool:
        """检查是否空闲超时"""
        if not self.last_activity:
            return True
        
        elapsed = (datetime.utcnow() - self.last_activity).total_seconds()
        return elapsed > self.config.idle_timeout


class SSHTerminalBridgeManager:
    """SSH 终端桥接管理器"""
    
    def __init__(self):
        self.bridges: Dict[str, SSHTerminalBridge] = {}
        self._lock = threading.Lock()
        self._cleanup_thread: Optional[threading.Thread] = None
        self._start_cleanup_thread()
        
        logger.info("SSH Terminal Bridge Manager initialized")
    
    def _start_cleanup_thread(self):
        """启动清理线程"""
        if self._cleanup_thread is None or not self._cleanup_thread.is_alive():
            self._cleanup_thread = threading.Thread(
                target=self._cleanup_loop,
                name="ssh-bridge-cleanup",
                daemon=True
            )
            self._cleanup_thread.start()
    
    def _cleanup_loop(self):
        """清理循环"""
        while True:
            try:
                time.sleep(60)  # 每分钟检查一次
                
                with self._lock:
                    bridges_to_remove = []
                    
                    for session_id, bridge in self.bridges.items():
                        # 检查空闲超时
                        if bridge.is_idle_timeout():
                            bridges_to_remove.append(session_id)
                            logger.info(f"Bridge idle timeout: {session_id}")
                        # 检查是否已停止
                        elif not bridge.is_active:
                            bridges_to_remove.append(session_id)
                    
                    for session_id in bridges_to_remove:
                        bridge = self.bridges.pop(session_id, None)
                        if bridge and bridge.is_active:
                            bridge.stop("Idle timeout")
                    
                    if bridges_to_remove:
                        logger.info(f"Cleaned up {len(bridges_to_remove)} bridges")
                        
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
    
    def create_bridge(
        self,
        session_id: str,
        hostname: str,
        port: int,
        username: str,
        auth_type: str,
        password: str = None,
        private_key: str = None,
        user_id: int = None,
        host_id: int = None,
        tenant_id: int = None,
        cols: int = 80,
        rows: int = 24,
        config: TerminalBridgeConfig = None,
        socket_sid: str = None,
        ip_address: str = None
    ) -> Tuple[bool, str, Optional[SSHTerminalBridge]]:
        """
        创建终端桥接
        
        Returns:
            (success, message, bridge)
        """
        try:
            with self._lock:
                # 检查是否已存在
                if session_id in self.bridges:
                    return False, "Bridge already exists", None
            
            # 密码已经是明文，直接使用
            
            # 获取 SSH 连接
            try:
                ssh_connection = ssh_service.connection_pool.get_connection(
                    hostname=hostname,
                    port=port,
                    username=username,
                    password=password if auth_type == 'password' else None,
                    private_key=private_key if auth_type == 'key' else None
                )
            except SSHConnectionError as e:
                return False, f"SSH connection failed: {e}", None
            
            # 创建 shell 通道
            try:
                ssh_channel = ssh_connection.client.invoke_shell(
                    term='xterm-256color',
                    width=cols,
                    height=rows
                )
            except Exception as e:
                return False, f"Failed to create shell: {e}", None
            
            # 创建桥接
            bridge = SSHTerminalBridge(
                session_id=session_id,
                ssh_channel=ssh_channel,
                user_id=user_id,
                host_id=host_id,
                tenant_id=tenant_id,
                config=config,
                socket_sid=socket_sid
            )
            
            # 设置 IP 地址（用于审计日志）
            bridge._ip_address = ip_address
            
            # 启动桥接
            if not bridge.start():
                bridge.stop("Failed to start")
                return False, "Failed to start bridge", None
            
            # 添加到管理器
            with self._lock:
                self.bridges[session_id] = bridge
            
            logger.info(f"Bridge created: {session_id}, socket_sid: {socket_sid}")
            return True, "Bridge created successfully", bridge
            
        except Exception as e:
            logger.error(f"Error creating bridge: {e}")
            return False, f"Error: {e}", None
    
    def get_bridge(self, session_id: str) -> Optional[SSHTerminalBridge]:
        """获取桥接"""
        with self._lock:
            return self.bridges.get(session_id)
    
    def update_socket_sid(self, session_id: str, socket_sid: str) -> bool:
        """更新桥接的 Socket.IO session ID"""
        with self._lock:
            bridge = self.bridges.get(session_id)
            if bridge:
                bridge.socket_sid = socket_sid
                logger.info(f"Updated socket_sid for bridge {session_id}: {socket_sid}")
                return True
            return False
    
    def remove_bridge(self, session_id: str, reason: str = "Removed") -> bool:
        """移除桥接"""
        with self._lock:
            bridge = self.bridges.pop(session_id, None)
        
        if bridge:
            bridge.stop(reason)
            return True
        return False
    
    def send_input(self, session_id: str, data: str) -> Tuple[bool, str]:
        """发送输入"""
        bridge = self.get_bridge(session_id)
        if not bridge:
            return False, "Bridge not found"
        return bridge.send_input(data)
    
    def resize(self, session_id: str, cols: int, rows: int) -> bool:
        """调整终端大小"""
        bridge = self.get_bridge(session_id)
        if not bridge:
            return False
        return bridge.resize(cols, rows)
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        with self._lock:
            active_count = sum(1 for b in self.bridges.values() if b.is_active)
            return {
                'total_bridges': len(self.bridges),
                'active_bridges': active_count,
                'session_ids': list(self.bridges.keys())
            }
    
    def close_all(self):
        """关闭所有桥接"""
        with self._lock:
            for bridge in self.bridges.values():
                bridge.stop("Manager shutdown")
            self.bridges.clear()
        
        logger.info("All bridges closed")


# 需要导入 socket 模块
import socket

# 全局桥接管理器实例
ssh_terminal_bridge_manager = SSHTerminalBridgeManager()
