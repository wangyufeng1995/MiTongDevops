"""
WebShell 会话管理服务
提供 WebShell 会话创建、销毁、状态跟踪和超时处理
"""
import uuid
import threading
import time
import logging
from typing import Dict, Optional, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from app.services.ssh_service import ssh_service, SSHConnectionError
from app.services.websocket_service import websocket_service
from app.models.host import SSHHost
from app.extensions import db
import json

logger = logging.getLogger(__name__)


@dataclass
class WebShellSession:
    """WebShell 会话数据类"""
    session_id: str
    host_id: int
    user_id: int
    tenant_id: int
    hostname: str
    port: int
    username: str
    auth_type: str
    password: Optional[str] = None
    private_key: Optional[str] = None
    status: str = 'pending'  # pending, active, inactive, terminated
    created_at: datetime = None
    last_activity: datetime = None
    websocket_session_id: Optional[str] = None
    terminal_size: Dict[str, int] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.last_activity is None:
            self.last_activity = datetime.utcnow()
        if self.terminal_size is None:
            self.terminal_size = {'cols': 80, 'rows': 24}
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        data = asdict(self)
        # 转换 datetime 对象为 ISO 格式字符串
        if self.created_at:
            data['created_at'] = self.created_at.isoformat()
        if self.last_activity:
            data['last_activity'] = self.last_activity.isoformat()
        # 移除敏感信息
        data.pop('password', None)
        data.pop('private_key', None)
        return data
    
    def update_activity(self):
        """更新活动时间"""
        self.last_activity = datetime.utcnow()
    
    def is_expired(self, timeout_minutes: int = 30) -> bool:
        """检查会话是否过期"""
        if not self.last_activity:
            return True
        
        timeout_delta = timedelta(minutes=timeout_minutes)
        return datetime.utcnow() - self.last_activity > timeout_delta


class WebShellSessionManager:
    """WebShell 会话管理器"""
    
    def __init__(self, session_timeout: int = 30, cleanup_interval: int = 60):
        self.sessions: Dict[str, WebShellSession] = {}
        self.user_sessions: Dict[int, set] = {}  # user_id -> set of session_ids
        self.host_sessions: Dict[int, set] = {}  # host_id -> set of session_ids
        self.websocket_sessions: Dict[str, str] = {}  # websocket_session_id -> webshell_session_id
        
        self.session_timeout = session_timeout  # 会话超时时间（分钟）
        self.cleanup_interval = cleanup_interval  # 清理间隔（秒）
        
        self._lock = threading.Lock()
        self._cleanup_thread = None
        self._start_cleanup_thread()
    
    def _start_cleanup_thread(self):
        """启动清理线程"""
        if self._cleanup_thread is None or not self._cleanup_thread.is_alive():
            self._cleanup_thread = threading.Thread(target=self._cleanup_expired_sessions, daemon=True)
            self._cleanup_thread.start()
            logger.info("WebShell 会话清理线程已启动")
    
    def _cleanup_expired_sessions(self):
        """清理过期会话"""
        while True:
            try:
                time.sleep(self.cleanup_interval)
                
                with self._lock:
                    expired_sessions = []
                    
                    for session_id, session in self.sessions.items():
                        if session.is_expired(self.session_timeout):
                            expired_sessions.append(session_id)
                    
                    # 清理过期会话
                    for session_id in expired_sessions:
                        self._remove_session_internal(session_id, reason="会话超时")
                        
                    if expired_sessions:
                        logger.info(f"清理了 {len(expired_sessions)} 个过期的 WebShell 会话")
                        
            except Exception as e:
                logger.error(f"清理过期会话时出错: {str(e)}")
    
    def create_session(self, host_id: int, user_id: int, tenant_id: int, 
                      websocket_session_id: Optional[str] = None) -> Tuple[bool, str, Optional[WebShellSession]]:
        """创建 WebShell 会话"""
        try:
            # 获取主机信息（不再强制要求 status=1，允许连接到任何主机）
            host = SSHHost.query.filter_by(
                id=host_id,
                tenant_id=tenant_id
            ).first()
            
            if not host:
                return False, "主机不存在", None
            
            # 如果主机被禁用，给出警告但仍允许连接
            if host.status != 1:
                logger.warning(f"尝试连接到已禁用的主机: {host_id}")
            
            # 生成会话 ID
            session_id = str(uuid.uuid4())
            
            # 创建会话对象
            session = WebShellSession(
                session_id=session_id,
                host_id=host.id,
                user_id=user_id,
                tenant_id=tenant_id,
                hostname=host.hostname,
                port=host.port,
                username=host.username,
                auth_type=host.auth_type,
                password=host.password,
                private_key=host.private_key,
                websocket_session_id=websocket_session_id,
                status='pending'
            )
            
            # 测试 SSH 连接（可选，如果测试失败仍然允许创建会话，让终端连接时再处理）
            try:
                success, message = ssh_service.test_connection(
                    hostname=host.hostname,
                    port=host.port,
                    username=host.username,
                    auth_type=host.auth_type,
                    password=host.password,
                    private_key=host.private_key
                )
                
                if not success:
                    logger.warning(f"SSH 连接预测试失败: {message}，但仍创建会话")
                    # 不再阻止会话创建，让终端连接时再处理
                    # return False, f"SSH 连接失败: {message}", None
                    
            except Exception as e:
                logger.warning(f"SSH 连接测试异常: {str(e)}，但仍创建会话")
            
            with self._lock:
                # 检查用户是否已有太多会话
                user_session_count = len(self.user_sessions.get(user_id, set()))
                if user_session_count >= 5:  # 限制每个用户最多5个会话
                    return False, "用户会话数量已达上限", None
                
                # 添加会话到管理器
                self.sessions[session_id] = session
                
                # 更新用户会话映射
                if user_id not in self.user_sessions:
                    self.user_sessions[user_id] = set()
                self.user_sessions[user_id].add(session_id)
                
                # 更新主机会话映射
                if host_id not in self.host_sessions:
                    self.host_sessions[host_id] = set()
                self.host_sessions[host_id].add(session_id)
                
                # 更新 WebSocket 会话映射
                if websocket_session_id:
                    self.websocket_sessions[websocket_session_id] = session_id
                
                # 更新会话状态为活跃
                session.status = 'active'
                session.update_activity()
                
                logger.info(f"创建 WebShell 会话成功: {session_id} for user {user_id} on host {host_id}")
                
                return True, "会话创建成功", session
                
        except Exception as e:
            logger.error(f"创建 WebShell 会话失败: {str(e)}")
            return False, f"创建会话失败: {str(e)}", None
    
    def get_session(self, session_id: str) -> Optional[WebShellSession]:
        """获取会话"""
        with self._lock:
            return self.sessions.get(session_id)
    
    def get_session_by_websocket(self, websocket_session_id: str) -> Optional[WebShellSession]:
        """通过 WebSocket 会话 ID 获取 WebShell 会话"""
        with self._lock:
            webshell_session_id = self.websocket_sessions.get(websocket_session_id)
            if webshell_session_id:
                return self.sessions.get(webshell_session_id)
            return None
    
    def update_session_activity(self, session_id: str) -> bool:
        """更新会话活动时间"""
        with self._lock:
            session = self.sessions.get(session_id)
            if session:
                session.update_activity()
                return True
            return False
    
    def update_terminal_size(self, session_id: str, cols: int, rows: int) -> bool:
        """更新终端大小"""
        with self._lock:
            session = self.sessions.get(session_id)
            if session:
                session.terminal_size = {'cols': cols, 'rows': rows}
                session.update_activity()
                logger.info(f"更新终端大小: {session_id} -> {cols}x{rows}")
                return True
            return False
    
    def set_session_websocket(self, session_id: str, websocket_session_id: str) -> bool:
        """设置会话的 WebSocket 连接"""
        with self._lock:
            session = self.sessions.get(session_id)
            if session:
                # 移除旧的 WebSocket 映射
                if session.websocket_session_id:
                    self.websocket_sessions.pop(session.websocket_session_id, None)
                
                # 设置新的 WebSocket 映射
                session.websocket_session_id = websocket_session_id
                self.websocket_sessions[websocket_session_id] = session_id
                session.update_activity()
                return True
            return False
    
    def remove_session(self, session_id: str, reason: str = "用户主动断开") -> bool:
        """移除会话"""
        with self._lock:
            return self._remove_session_internal(session_id, reason)
    
    def _remove_session_internal(self, session_id: str, reason: str = "会话结束") -> bool:
        """内部移除会话方法（不加锁）"""
        session = self.sessions.pop(session_id, None)
        if not session:
            return False
        
        try:
            # 更新会话状态
            session.status = 'terminated'
            
            # 从用户会话映射中移除
            if session.user_id in self.user_sessions:
                self.user_sessions[session.user_id].discard(session_id)
                if not self.user_sessions[session.user_id]:
                    del self.user_sessions[session.user_id]
            
            # 从主机会话映射中移除
            if session.host_id in self.host_sessions:
                self.host_sessions[session.host_id].discard(session_id)
                if not self.host_sessions[session.host_id]:
                    del self.host_sessions[session.host_id]
            
            # 从 WebSocket 会话映射中移除
            if session.websocket_session_id:
                self.websocket_sessions.pop(session.websocket_session_id, None)
            
            # 通知 WebSocket 客户端会话已结束
            if session.websocket_session_id:
                try:
                    websocket_service.send_to_user(
                        session.user_id,
                        'webshell_session_terminated',
                        {
                            'session_id': session_id,
                            'reason': reason,
                            'terminated_at': datetime.utcnow().isoformat()
                        }
                    )
                except Exception as e:
                    logger.warning(f"通知 WebSocket 客户端会话结束失败: {str(e)}")
            
            logger.info(f"移除 WebShell 会话: {session_id}, 原因: {reason}")
            return True
            
        except Exception as e:
            logger.error(f"移除 WebShell 会话时出错: {str(e)}")
            return False
    
    def get_user_sessions(self, user_id: int) -> list[WebShellSession]:
        """获取用户的所有会话"""
        with self._lock:
            session_ids = self.user_sessions.get(user_id, set())
            return [self.sessions[sid] for sid in session_ids if sid in self.sessions]
    
    def get_host_sessions(self, host_id: int) -> list[WebShellSession]:
        """获取主机的所有会话"""
        with self._lock:
            session_ids = self.host_sessions.get(host_id, set())
            return [self.sessions[sid] for sid in session_ids if sid in self.sessions]
    
    def terminate_user_sessions(self, user_id: int, reason: str = "管理员终止") -> int:
        """终止用户的所有会话"""
        with self._lock:
            session_ids = self.user_sessions.get(user_id, set()).copy()
            terminated_count = 0
            
            for session_id in session_ids:
                if self._remove_session_internal(session_id, reason):
                    terminated_count += 1
            
            logger.info(f"终止用户 {user_id} 的 {terminated_count} 个 WebShell 会话")
            return terminated_count
    
    def terminate_host_sessions(self, host_id: int, reason: str = "主机维护") -> int:
        """终止主机的所有会话"""
        with self._lock:
            session_ids = self.host_sessions.get(host_id, set()).copy()
            terminated_count = 0
            
            for session_id in session_ids:
                if self._remove_session_internal(session_id, reason):
                    terminated_count += 1
            
            logger.info(f"终止主机 {host_id} 的 {terminated_count} 个 WebShell 会话")
            return terminated_count
    
    def get_session_stats(self) -> Dict[str, Any]:
        """获取会话统计信息"""
        with self._lock:
            active_sessions = sum(1 for s in self.sessions.values() if s.status == 'active')
            
            # 按租户统计
            tenant_stats = {}
            for session in self.sessions.values():
                tenant_id = session.tenant_id
                tenant_stats[tenant_id] = tenant_stats.get(tenant_id, 0) + 1
            
            # 按主机统计
            host_stats = {}
            for session in self.sessions.values():
                host_id = session.host_id
                host_stats[host_id] = host_stats.get(host_id, 0) + 1
            
            return {
                'total_sessions': len(self.sessions),
                'active_sessions': active_sessions,
                'unique_users': len(self.user_sessions),
                'unique_hosts': len(self.host_sessions),
                'sessions_by_tenant': tenant_stats,
                'sessions_by_host': host_stats,
                'websocket_connections': len(self.websocket_sessions)
            }
    
    def cleanup_websocket_session(self, websocket_session_id: str) -> bool:
        """清理 WebSocket 会话关联"""
        with self._lock:
            webshell_session_id = self.websocket_sessions.pop(websocket_session_id, None)
            if webshell_session_id:
                session = self.sessions.get(webshell_session_id)
                if session:
                    session.websocket_session_id = None
                    # 如果会话没有 WebSocket 连接，标记为非活跃
                    if session.status == 'active':
                        session.status = 'inactive'
                    logger.info(f"清理 WebSocket 会话关联: {websocket_session_id} -> {webshell_session_id}")
                return True
            return False


class WebShellService:
    """WebShell 服务类"""
    
    def __init__(self):
        self.session_manager = WebShellSessionManager()
        logger.info("WebShell 服务已初始化")
    
    def create_session(self, host_id: int, user_id: int, tenant_id: int, 
                      websocket_session_id: Optional[str] = None) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        """创建 WebShell 会话"""
        try:
            success, message, session = self.session_manager.create_session(
                host_id, user_id, tenant_id, websocket_session_id
            )
            
            if success and session:
                return True, message, session.to_dict()
            else:
                return False, message, None
                
        except Exception as e:
            logger.error(f"WebShell 服务创建会话失败: {str(e)}")
            return False, f"创建会话失败: {str(e)}", None
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """获取会话信息"""
        session = self.session_manager.get_session(session_id)
        return session.to_dict() if session else None
    
    def get_session_by_websocket(self, websocket_session_id: str) -> Optional[Dict[str, Any]]:
        """通过 WebSocket 会话 ID 获取会话信息"""
        session = self.session_manager.get_session_by_websocket(websocket_session_id)
        return session.to_dict() if session else None
    
    def terminate_session(self, session_id: str, reason: str = "用户主动断开") -> bool:
        """终止会话"""
        return self.session_manager.remove_session(session_id, reason)
    
    def update_session_activity(self, session_id: str) -> bool:
        """更新会话活动时间"""
        return self.session_manager.update_session_activity(session_id)
    
    def update_terminal_size(self, session_id: str, cols: int, rows: int) -> bool:
        """更新终端大小"""
        return self.session_manager.update_terminal_size(session_id, cols, rows)
    
    def set_session_websocket(self, session_id: str, websocket_session_id: str) -> bool:
        """设置会话的 WebSocket 连接"""
        return self.session_manager.set_session_websocket(session_id, websocket_session_id)
    
    def get_user_sessions(self, user_id: int) -> list[Dict[str, Any]]:
        """获取用户的所有会话"""
        sessions = self.session_manager.get_user_sessions(user_id)
        return [session.to_dict() for session in sessions]
    
    def get_host_sessions(self, host_id: int) -> list[Dict[str, Any]]:
        """获取主机的所有会话"""
        sessions = self.session_manager.get_host_sessions(host_id)
        return [session.to_dict() for session in sessions]
    
    def terminate_user_sessions(self, user_id: int, reason: str = "管理员终止") -> int:
        """终止用户的所有会话"""
        return self.session_manager.terminate_user_sessions(user_id, reason)
    
    def terminate_host_sessions(self, host_id: int, reason: str = "主机维护") -> int:
        """终止主机的所有会话"""
        return self.session_manager.terminate_host_sessions(host_id, reason)
    
    def get_session_stats(self) -> Dict[str, Any]:
        """获取会话统计信息"""
        return self.session_manager.get_session_stats()
    
    def cleanup_websocket_session(self, websocket_session_id: str) -> bool:
        """清理 WebSocket 会话关联"""
        return self.session_manager.cleanup_websocket_session(websocket_session_id)
    
    def handle_websocket_disconnect(self, websocket_session_id: str):
        """处理 WebSocket 断开连接"""
        try:
            # 获取关联的 WebShell 会话
            session = self.session_manager.get_session_by_websocket(websocket_session_id)
            if session:
                logger.info(f"WebSocket 断开，WebShell 会话变为非活跃: {session.session_id}")
                
                # 清理终端会话
                from app.services.webshell_terminal_service import webshell_terminal_service
                webshell_terminal_service.cleanup_session(session.session_id)
                
                # 清理 WebSocket 关联，但保留会话（允许重新连接）
                self.cleanup_websocket_session(websocket_session_id)
            else:
                # 直接清理 WebSocket 关联
                self.cleanup_websocket_session(websocket_session_id)
                
        except Exception as e:
            logger.error(f"处理 WebSocket 断开连接失败: {str(e)}")


# 全局 WebShell 服务实例
webshell_service = WebShellService()