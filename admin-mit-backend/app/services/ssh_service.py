"""
SSH 连接服务
提供 SSH 连接管理、连接池管理、密码和密钥认证支持
"""
import paramiko
import threading
import time
import logging
from typing import Dict, Optional, Tuple, Any
from datetime import datetime, timedelta
from contextlib import contextmanager
from app.core.config_manager import config_manager
from app.services.password_service import PasswordDecryptService

logger = logging.getLogger(__name__)


class SSHConnectionError(Exception):
    """SSH 连接异常"""
    pass


class SSHConnection:
    """SSH 连接封装类"""
    
    def __init__(self, hostname: str, port: int, username: str, 
                 password: str = None, private_key: str = None, timeout: int = 30):
        self.hostname = hostname
        self.port = port
        self.username = username
        self.password = password
        self.private_key = private_key
        self.timeout = timeout
        self.client = None
        self.last_used = datetime.now()
        self.is_connected = False
        self._lock = threading.Lock()
    
    def connect(self) -> bool:
        """建立 SSH 连接"""
        try:
            with self._lock:
                if self.is_connected and self.client:
                    return True
                
                self.client = paramiko.SSHClient()
                self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                
                # 根据认证类型连接
                if self.private_key:
                    # 密钥认证 - 使用 StringIO 从字符串加载私钥
                    from io import StringIO
                    key_file = StringIO(self.private_key)
                    try:
                        private_key_obj = paramiko.RSAKey.from_private_key(key_file)
                    except paramiko.ssh_exception.SSHException:
                        key_file.seek(0)
                        try:
                            private_key_obj = paramiko.Ed25519Key.from_private_key(key_file)
                        except paramiko.ssh_exception.SSHException:
                            key_file.seek(0)
                            private_key_obj = paramiko.ECDSAKey.from_private_key(key_file)
                    
                    self.client.connect(
                        hostname=self.hostname,
                        port=self.port,
                        username=self.username,
                        pkey=private_key_obj,
                        timeout=self.timeout,
                        allow_agent=False,
                        look_for_keys=False
                    )
                else:
                    # 密码认证
                    self.client.connect(
                        hostname=self.hostname,
                        port=self.port,
                        username=self.username,
                        password=self.password,
                        timeout=self.timeout,
                        allow_agent=False,
                        look_for_keys=False
                    )
                
                self.is_connected = True
                self.last_used = datetime.now()
                logger.info(f"SSH 连接成功: {self.username}@{self.hostname}:{self.port}")
                return True
                
        except Exception as e:
            logger.error(f"SSH 连接失败: {self.username}@{self.hostname}:{self.port}, 错误: {str(e)}")
            self.is_connected = False
            if self.client:
                self.client.close()
                self.client = None
            raise SSHConnectionError(f"SSH 连接失败: {str(e)}")
    
    def disconnect(self):
        """断开 SSH 连接"""
        with self._lock:
            if self.client:
                try:
                    self.client.close()
                    logger.info(f"SSH 连接已断开: {self.username}@{self.hostname}:{self.port}")
                except Exception as e:
                    logger.warning(f"断开 SSH 连接时出错: {str(e)}")
                finally:
                    self.client = None
                    self.is_connected = False
    
    def execute_command(self, command: str, timeout: int = 30) -> Tuple[str, str, int]:
        """执行 SSH 命令"""
        if not self.is_connected or not self.client:
            raise SSHConnectionError("SSH 连接未建立")
        
        try:
            with self._lock:
                stdin, stdout, stderr = self.client.exec_command(command, timeout=timeout)
                
                # 读取输出
                stdout_data = stdout.read().decode('utf-8', errors='ignore')
                stderr_data = stderr.read().decode('utf-8', errors='ignore')
                exit_code = stdout.channel.recv_exit_status()
                
                self.last_used = datetime.now()
                
                return stdout_data, stderr_data, exit_code
                
        except Exception as e:
            logger.error(f"执行 SSH 命令失败: {command}, 错误: {str(e)}")
            raise SSHConnectionError(f"执行命令失败: {str(e)}")
    
    def is_alive(self) -> bool:
        """检查连接是否存活"""
        if not self.is_connected or not self.client:
            return False
        
        try:
            # 发送一个简单的命令来测试连接
            transport = self.client.get_transport()
            if transport and transport.is_active():
                return True
        except Exception:
            pass
        
        return False
    
    def get_sftp(self):
        """获取 SFTP 客户端"""
        if not self.is_connected or not self.client:
            raise SSHConnectionError("SSH 连接未建立")
        
        try:
            return self.client.open_sftp()
        except Exception as e:
            logger.error(f"创建 SFTP 客户端失败: {str(e)}")
            raise SSHConnectionError(f"创建 SFTP 客户端失败: {str(e)}")


class SSHConnectionPool:
    """SSH 连接池管理"""
    
    def __init__(self, max_connections: int = 10, connection_timeout: int = 30, 
                 idle_timeout: int = 300):
        self.max_connections = max_connections
        self.connection_timeout = connection_timeout
        self.idle_timeout = idle_timeout  # 空闲超时时间（秒）
        self.connections: Dict[str, SSHConnection] = {}
        self._lock = threading.Lock()
        self._cleanup_thread = None
        self._start_cleanup_thread()
    
    def _start_cleanup_thread(self):
        """启动清理线程"""
        if self._cleanup_thread is None or not self._cleanup_thread.is_alive():
            self._cleanup_thread = threading.Thread(target=self._cleanup_idle_connections, daemon=True)
            self._cleanup_thread.start()
    
    def _cleanup_idle_connections(self):
        """清理空闲连接"""
        while True:
            try:
                time.sleep(60)  # 每分钟检查一次
                current_time = datetime.now()
                
                with self._lock:
                    connections_to_remove = []
                    
                    for key, connection in self.connections.items():
                        # 检查连接是否超时或不可用
                        if (current_time - connection.last_used).seconds > self.idle_timeout or not connection.is_alive():
                            connections_to_remove.append(key)
                    
                    # 移除超时的连接
                    for key in connections_to_remove:
                        connection = self.connections.pop(key, None)
                        if connection:
                            connection.disconnect()
                            logger.info(f"清理空闲 SSH 连接: {key}")
                            
            except Exception as e:
                logger.error(f"清理空闲连接时出错: {str(e)}")
    
    def _get_connection_key(self, hostname: str, port: int, username: str) -> str:
        """生成连接键"""
        return f"{username}@{hostname}:{port}"
    
    def get_connection(self, hostname: str, port: int, username: str, 
                      password: str = None, private_key: str = None) -> SSHConnection:
        """获取 SSH 连接"""
        connection_key = self._get_connection_key(hostname, port, username)
        
        with self._lock:
            # 检查是否已有可用连接
            if connection_key in self.connections:
                connection = self.connections[connection_key]
                if connection.is_alive():
                    connection.last_used = datetime.now()
                    return connection
                else:
                    # 连接已断开，移除并重新创建
                    connection.disconnect()
                    del self.connections[connection_key]
            
            # 检查连接池是否已满
            if len(self.connections) >= self.max_connections:
                # 移除最旧的连接
                oldest_key = min(self.connections.keys(), 
                               key=lambda k: self.connections[k].last_used)
                oldest_connection = self.connections.pop(oldest_key)
                oldest_connection.disconnect()
                logger.info(f"连接池已满，移除最旧连接: {oldest_key}")
            
            # 创建新连接
            connection = SSHConnection(
                hostname=hostname,
                port=port,
                username=username,
                password=password,
                private_key=private_key,
                timeout=self.connection_timeout
            )
            
            # 建立连接
            connection.connect()
            self.connections[connection_key] = connection
            
            return connection
    
    def remove_connection(self, hostname: str, port: int, username: str):
        """移除指定连接"""
        connection_key = self._get_connection_key(hostname, port, username)
        
        with self._lock:
            connection = self.connections.pop(connection_key, None)
            if connection:
                connection.disconnect()
                logger.info(f"移除 SSH 连接: {connection_key}")
    
    def close_all(self):
        """关闭所有连接"""
        with self._lock:
            for connection in self.connections.values():
                connection.disconnect()
            self.connections.clear()
            logger.info("已关闭所有 SSH 连接")
    
    def get_pool_status(self) -> Dict[str, Any]:
        """获取连接池状态"""
        with self._lock:
            active_connections = sum(1 for conn in self.connections.values() if conn.is_alive())
            return {
                'total_connections': len(self.connections),
                'active_connections': active_connections,
                'max_connections': self.max_connections,
                'connection_keys': list(self.connections.keys())
            }


class SSHService:
    """SSH 服务类"""
    
    def __init__(self):
        # 从配置文件获取连接池配置
        app_config = config_manager.get_app_config()
        ssh_config = app_config.get('ssh', {})
        
        self.connection_pool = SSHConnectionPool(
            max_connections=ssh_config.get('max_connections', 10),
            connection_timeout=ssh_config.get('connection_timeout', 30),
            idle_timeout=ssh_config.get('idle_timeout', 300)
        )
        
        self.password_service = PasswordDecryptService()
        self.retry_attempts = ssh_config.get('retry_attempts', 3)
        self.retry_delay = ssh_config.get('retry_delay', 1)
    
    def test_connection(self, hostname: str, port: int, username: str, 
                       auth_type: str, password: str = None, private_key: str = None) -> Tuple[bool, str]:
        """测试 SSH 连接"""
        try:
            # 密码已经是明文，直接使用
            
            # 创建临时连接进行测试
            connection = SSHConnection(
                hostname=hostname,
                port=port,
                username=username,
                password=password if auth_type == 'password' else None,
                private_key=private_key if auth_type == 'key' else None,
                timeout=10  # 测试连接使用较短超时
            )
            
            # 尝试连接
            connection.connect()
            
            # 执行简单命令测试
            stdout, stderr, exit_code = connection.execute_command('echo "connection test"', timeout=5)
            
            # 断开测试连接
            connection.disconnect()
            
            if exit_code == 0 and 'connection test' in stdout:
                return True, "连接测试成功"
            else:
                return False, f"命令执行失败: {stderr}"
                
        except SSHConnectionError as e:
            return False, str(e)
        except Exception as e:
            logger.error(f"SSH 连接测试异常: {str(e)}")
            return False, f"连接测试异常: {str(e)}"
    
    @contextmanager
    def get_connection(self, hostname: str, port: int, username: str, 
                      auth_type: str, password: str = None, private_key: str = None):
        """获取 SSH 连接上下文管理器"""
        connection = None
        try:
            # 密码已经是明文，直接使用
            
            # 从连接池获取连接
            connection = self.connection_pool.get_connection(
                hostname=hostname,
                port=port,
                username=username,
                password=password if auth_type == 'password' else None,
                private_key=private_key if auth_type == 'key' else None
            )
            
            yield connection
            
        except Exception as e:
            logger.error(f"获取 SSH 连接失败: {str(e)}")
            raise SSHConnectionError(f"获取 SSH 连接失败: {str(e)}")
        finally:
            # 连接会保留在连接池中，不需要手动关闭
            pass
    
    def execute_command_with_retry(self, hostname: str, port: int, username: str, 
                                  auth_type: str, command: str, password: str = None, 
                                  private_key: str = None, timeout: int = 30) -> Tuple[str, str, int]:
        """带重试机制的命令执行"""
        last_error = None
        
        for attempt in range(self.retry_attempts):
            try:
                with self.get_connection(hostname, port, username, auth_type, password, private_key) as connection:
                    return connection.execute_command(command, timeout)
                    
            except Exception as e:
                last_error = e
                if attempt < self.retry_attempts - 1:
                    logger.warning(f"SSH 命令执行失败，第 {attempt + 1} 次重试: {str(e)}")
                    time.sleep(self.retry_delay)
                    # 移除可能有问题的连接
                    self.connection_pool.remove_connection(hostname, port, username)
                else:
                    logger.error(f"SSH 命令执行失败，已达到最大重试次数: {str(e)}")
        
        raise SSHConnectionError(f"命令执行失败: {str(last_error)}")
    
    def get_pool_status(self) -> Dict[str, Any]:
        """获取连接池状态"""
        return self.connection_pool.get_pool_status()
    
    def close_all_connections(self):
        """关闭所有连接"""
        self.connection_pool.close_all()


# 全局 SSH 服务实例
ssh_service = SSHService()