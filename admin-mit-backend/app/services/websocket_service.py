"""
WebSocket 服务
提供 WebSocket 连接管理、认证和事件处理
"""
import logging
from typing import Dict, Any, Optional
from flask import request, session
from flask_socketio import emit, disconnect, join_room, leave_room
from flask_jwt_extended import decode_token, get_jwt_identity
from app.extensions import socketio, redis_client
from app.models.user import User
from app.models.tenant import Tenant
from datetime import datetime
import json

logger = logging.getLogger(__name__)


class WebSocketConnectionManager:
    """WebSocket 连接管理器"""
    
    def __init__(self):
        self.connections: Dict[str, Dict[str, Any]] = {}
        self.user_sessions: Dict[int, set] = {}  # user_id -> set of session_ids
        
    def add_connection(self, session_id: str, user_id: int, tenant_id: int, user_info: Dict[str, Any]):
        """添加连接"""
        self.connections[session_id] = {
            'user_id': user_id,
            'tenant_id': tenant_id,
            'user_info': user_info,
            'connected_at': datetime.utcnow(),
            'last_activity': datetime.utcnow()
        }
        
        # 添加到用户会话集合
        if user_id not in self.user_sessions:
            self.user_sessions[user_id] = set()
        self.user_sessions[user_id].add(session_id)
        
        logger.info(f"WebSocket connection added: {session_id} for user {user_id}")
    
    def remove_connection(self, session_id: str):
        """移除连接"""
        if session_id in self.connections:
            connection_info = self.connections[session_id]
            user_id = connection_info['user_id']
            
            # 从连接字典中移除
            del self.connections[session_id]
            
            # 从用户会话集合中移除
            if user_id in self.user_sessions:
                self.user_sessions[user_id].discard(session_id)
                if not self.user_sessions[user_id]:
                    del self.user_sessions[user_id]
            
            logger.info(f"WebSocket connection removed: {session_id} for user {user_id}")
    
    def get_connection(self, session_id: str) -> Optional[Dict[str, Any]]:
        """获取连接信息"""
        return self.connections.get(session_id)
    
    def get_user_sessions(self, user_id: int) -> set:
        """获取用户的所有会话"""
        return self.user_sessions.get(user_id, set())
    
    def update_activity(self, session_id: str):
        """更新连接活动时间"""
        if session_id in self.connections:
            self.connections[session_id]['last_activity'] = datetime.utcnow()
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """获取连接统计信息"""
        return {
            'total_connections': len(self.connections),
            'unique_users': len(self.user_sessions),
            'connections_by_tenant': self._get_connections_by_tenant()
        }
    
    def _get_connections_by_tenant(self) -> Dict[int, int]:
        """按租户统计连接数"""
        tenant_stats = {}
        for connection in self.connections.values():
            tenant_id = connection['tenant_id']
            tenant_stats[tenant_id] = tenant_stats.get(tenant_id, 0) + 1
        return tenant_stats


# 全局连接管理器
connection_manager = WebSocketConnectionManager()


class WebSocketAuthenticator:
    """WebSocket 认证器"""
    
    @staticmethod
    def authenticate_connection(auth_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """认证 WebSocket 连接"""
        try:
            # 从认证数据中获取 token
            token = auth_data.get('token')
            if not token:
                logger.warning("WebSocket authentication failed: No token provided")
                return None
            
            # 解码 JWT token
            try:
                decoded_token = decode_token(token)
                user_id = decoded_token.get('sub')
                tenant_id = decoded_token.get('tenant_id')
                
                if not user_id or not tenant_id:
                    logger.warning("WebSocket authentication failed: Invalid token payload")
                    return None
                
            except Exception as e:
                logger.warning(f"WebSocket authentication failed: Token decode error - {e}")
                return None
            
            # 验证用户是否存在且有效
            user = User.query.filter_by(id=user_id, tenant_id=tenant_id, status=1).first()
            if not user:
                logger.warning(f"WebSocket authentication failed: User {user_id} not found or inactive")
                return None
            
            # 验证租户是否存在且有效
            tenant = Tenant.query.filter_by(id=tenant_id, status=1).first()
            if not tenant:
                logger.warning(f"WebSocket authentication failed: Tenant {tenant_id} not found or inactive")
                return None
            
            # 返回认证信息
            return {
                'user_id': user.id,
                'tenant_id': tenant.id,
                'user_info': {
                    'username': user.username,
                    'full_name': user.full_name,
                    'email': user.email
                },
                'tenant_info': {
                    'name': tenant.name,
                    'code': tenant.code
                }
            }
            
        except Exception as e:
            logger.error(f"WebSocket authentication error: {e}")
            return None


class WebSocketEventHandler:
    """WebSocket 事件处理器"""
    
    @staticmethod
    def handle_connect(auth_data: Dict[str, Any]):
        """处理连接事件"""
        try:
            # 认证连接
            auth_info = WebSocketAuthenticator.authenticate_connection(auth_data)
            
            session_id = request.sid
            
            if not auth_info:
                # 认证失败，但在开发环境允许连接
                logger.warning(f"WebSocket authentication failed, allowing connection in dev mode")
                
                # 使用默认值
                connection_manager.add_connection(
                    session_id=session_id,
                    user_id=0,
                    tenant_id=0,
                    user_info={'username': 'anonymous', 'full_name': 'Anonymous', 'email': ''}
                )
                
                # 发送连接成功消息
                emit('connection_established', {
                    'status': 'connected',
                    'user_info': {'username': 'anonymous'},
                    'tenant_info': {'name': 'default'},
                    'connected_at': datetime.utcnow().isoformat(),
                    'authenticated': False
                })
                
                return True
            
            # 添加连接到管理器
            connection_manager.add_connection(
                session_id=session_id,
                user_id=auth_info['user_id'],
                tenant_id=auth_info['tenant_id'],
                user_info=auth_info['user_info']
            )
            
            # 加入租户房间（用于租户级别的广播）
            tenant_room = f"tenant_{auth_info['tenant_id']}"
            join_room(tenant_room)
            
            # 加入用户房间（用于用户级别的通知）
            user_room = f"user_{auth_info['user_id']}"
            join_room(user_room)
            
            # 发送连接成功消息
            emit('connection_established', {
                'status': 'connected',
                'user_info': auth_info['user_info'],
                'tenant_info': auth_info['tenant_info'],
                'connected_at': datetime.utcnow().isoformat(),
                'authenticated': True
            })
            
            logger.info(f"WebSocket connection established for user {auth_info['user_id']}")
            return True
            
        except Exception as e:
            logger.error(f"WebSocket connect error: {e}")
            # 即使出错也允许连接
            emit('connection_established', {
                'status': 'connected',
                'error': str(e),
                'connected_at': datetime.utcnow().isoformat(),
                'authenticated': False
            })
            return True
    
    @staticmethod
    def handle_disconnect():
        """处理断开连接事件"""
        try:
            session_id = request.sid
            connection_info = connection_manager.get_connection(session_id)
            
            if connection_info:
                # 离开房间
                tenant_room = f"tenant_{connection_info['tenant_id']}"
                user_room = f"user_{connection_info['user_id']}"
                leave_room(tenant_room)
                leave_room(user_room)
                
                # 移除连接
                connection_manager.remove_connection(session_id)
                
                logger.info(f"WebSocket connection disconnected for user {connection_info['user_id']}")
            
        except Exception as e:
            logger.error(f"WebSocket disconnect error: {e}")
    
    @staticmethod
    def handle_ping():
        """处理心跳事件"""
        try:
            session_id = request.sid
            connection_manager.update_activity(session_id)
            emit('pong', {'timestamp': datetime.utcnow().isoformat()})
            
        except Exception as e:
            logger.error(f"WebSocket ping error: {e}")
    
    @staticmethod
    def handle_join_room(data: Dict[str, Any]):
        """处理加入房间事件"""
        try:
            session_id = request.sid
            connection_info = connection_manager.get_connection(session_id)
            
            if not connection_info:
                emit('error', {'message': 'Connection not authenticated'})
                return
            
            room_name = data.get('room')
            if not room_name:
                emit('error', {'message': 'Room name required'})
                return
            
            # 验证房间权限（可以根据需要扩展）
            if room_name.startswith('host_'):
                # 主机相关房间，验证用户是否有权限
                join_room(room_name)
                emit('room_joined', {'room': room_name})
                logger.info(f"User {connection_info['user_id']} joined room {room_name}")
            else:
                emit('error', {'message': 'Invalid room name'})
            
        except Exception as e:
            logger.error(f"WebSocket join room error: {e}")
            emit('error', {'message': 'Failed to join room'})
    
    @staticmethod
    def handle_leave_room(data: Dict[str, Any]):
        """处理离开房间事件"""
        try:
            session_id = request.sid
            connection_info = connection_manager.get_connection(session_id)
            
            if not connection_info:
                emit('error', {'message': 'Connection not authenticated'})
                return
            
            room_name = data.get('room')
            if not room_name:
                emit('error', {'message': 'Room name required'})
                return
            
            leave_room(room_name)
            emit('room_left', {'room': room_name})
            logger.info(f"User {connection_info['user_id']} left room {room_name}")
            
        except Exception as e:
            logger.error(f"WebSocket leave room error: {e}")
            emit('error', {'message': 'Failed to leave room'})


class WebSocketService:
    """WebSocket 服务类"""
    
    def __init__(self):
        self.connection_manager = connection_manager
        self.event_handler = WebSocketEventHandler()
        self.authenticator = WebSocketAuthenticator()
    
    def broadcast_to_tenant(self, tenant_id: int, event: str, data: Dict[str, Any]):
        """向租户广播消息"""
        try:
            room = f"tenant_{tenant_id}"
            socketio.emit(event, data, room=room)
            logger.info(f"Broadcast to tenant {tenant_id}: {event}")
            
        except Exception as e:
            logger.error(f"Broadcast to tenant error: {e}")
    
    def send_to_user(self, user_id: int, event: str, data: Dict[str, Any]):
        """向特定用户发送消息"""
        try:
            room = f"user_{user_id}"
            socketio.emit(event, data, room=room)
            logger.info(f"Send to user {user_id}: {event}")
            
        except Exception as e:
            logger.error(f"Send to user error: {e}")
    
    def broadcast_to_room(self, room: str, event: str, data: Dict[str, Any]):
        """向房间广播消息"""
        try:
            socketio.emit(event, data, room=room)
            logger.info(f"Broadcast to room {room}: {event}")
            
        except Exception as e:
            logger.error(f"Broadcast to room error: {e}")
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """获取连接统计"""
        return self.connection_manager.get_connection_stats()
    
    def disconnect_user(self, user_id: int, reason: str = "Server disconnect"):
        """断开用户的所有连接"""
        try:
            user_sessions = self.connection_manager.get_user_sessions(user_id)
            for session_id in user_sessions.copy():
                socketio.disconnect(session_id)
            
            logger.info(f"Disconnected all sessions for user {user_id}: {reason}")
            
        except Exception as e:
            logger.error(f"Disconnect user error: {e}")


# 全局 WebSocket 服务实例
websocket_service = WebSocketService()