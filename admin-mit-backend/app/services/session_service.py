"""
Session 管理服务

负责 Session 的创建、读取、更新和删除操作。
使用 Redis 存储 Session 数据，支持自动过期和延期机制。
"""
import json
import uuid
import time
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import redis

from app.extensions import redis_client
from app.models.user import User
from app.models.tenant import Tenant
from app.core.error_handlers import handle_redis_errors, log_auth_event

logger = logging.getLogger(__name__)


class SessionService:
    """Session 管理服务"""
    
    # Session 配置常量
    SESSION_TTL = 86400  # 24 小时（秒）
    SESSION_KEY_PREFIX = "session:"
    EXTENSION_THRESHOLD = 3600  # 1 小时（秒）
    
    def __init__(self, redis_client=None):
        """
        初始化 SessionService
        
        Args:
            redis_client: Redis 客户端实例，如果为 None 则使用全局客户端
        """
        self.redis = redis_client if redis_client is not None else globals().get('redis_client')
        if self.redis is None:
            from app.extensions import get_redis_client
            self.redis = get_redis_client()
    
    @handle_redis_errors
    def create_session(self, user: User, tenant: Tenant, ip_address: str = None, user_agent: str = None) -> str:
        """
        创建新的 Session
        
        Args:
            user: 用户对象
            tenant: 租户对象
            ip_address: 客户端 IP 地址
            user_agent: 客户端 User-Agent
            
        Returns:
            str: Session ID (UUID v4)
            
        Raises:
            redis.ConnectionError: Redis 连接失败
            redis.TimeoutError: Redis 操作超时
        """
        try:
            # 生成 Session ID (UUID v4)
            session_id = str(uuid.uuid4())
            
            # 获取用户角色和权限
            roles = [role.name for role in user.get_roles()]
            permissions = []
            for role in user.get_roles():
                if role.permissions:
                    permissions.extend(role.permissions)
            permissions = list(set(permissions))  # 去重
            
            # 构建 Session 数据
            current_time = int(time.time())
            session_data = {
                'user_id': str(user.id),
                'username': user.username,
                'email': user.email,
                'tenant_id': str(tenant.id),
                'tenant_name': tenant.name,
                'roles': roles,
                'permissions': permissions,
                'created_at': current_time,
                'last_active': current_time,
                'ip_address': ip_address or '',
                'user_agent': user_agent or ''
            }
            
            # 序列化为 JSON
            session_json = json.dumps(session_data)
            
            # 存储到 Redis，设置 TTL
            redis_key = self._get_redis_key(session_id)
            self.redis.setex(redis_key, self.SESSION_TTL, session_json)
            
            # 记录 Session 创建日志
            log_auth_event(
                event_type='session_created',
                user_id=str(user.id),
                username=user.username,
                session_id=session_id,
                ip_address=ip_address,
                success=True,
                tenant_id=str(tenant.id)
            )
            
            logger.info(f"Session created: {session_id} for user {user.username}")
            return session_id
            
        except (redis.ConnectionError, redis.TimeoutError):
            # 让装饰器处理 Redis 错误
            raise
        except Exception as e:
            logger.error(f"Error creating session: {e}", exc_info=True)
            raise
    
    @handle_redis_errors
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        获取 Session 数据
        
        Args:
            session_id: Session ID
            
        Returns:
            Optional[dict]: Session 数据，不存在或已过期返回 None
            
        Raises:
            redis.ConnectionError: Redis 连接失败
            redis.TimeoutError: Redis 操作超时
        """
        try:
            redis_key = self._get_redis_key(session_id)
            session_json = self.redis.get(redis_key)
            
            if session_json is None:
                logger.debug(f"Session not found: {session_id}")
                return None
            
            # 反序列化 JSON
            session_data = json.loads(session_json)
            return session_data
            
        except json.JSONDecodeError as e:
            logger.error(
                f"Invalid session data for {session_id}: {e}",
                exc_info=True,
                extra={'session_id': session_id, 'error_type': 'json_decode_error'}
            )
            # 删除损坏的 Session
            self.delete_session(session_id)
            return None
        except (redis.ConnectionError, redis.TimeoutError):
            # 让装饰器处理 Redis 错误
            raise
        except Exception as e:
            logger.error(f"Error getting session: {e}", exc_info=True)
            return None
    
    @handle_redis_errors
    def update_session(self, session_id: str, data: Dict[str, Any]) -> bool:
        """
        更新 Session 数据
        
        Args:
            session_id: Session ID
            data: 要更新的数据（部分更新）
            
        Returns:
            bool: 是否更新成功
            
        Raises:
            redis.ConnectionError: Redis 连接失败
            redis.TimeoutError: Redis 操作超时
        """
        try:
            # 获取现有 Session
            session_data = self.get_session(session_id)
            if session_data is None:
                logger.warning(f"Cannot update non-existent session: {session_id}")
                return False
            
            # 更新数据
            session_data.update(data)
            
            # 序列化为 JSON
            session_json = json.dumps(session_data)
            
            # 获取当前 TTL
            redis_key = self._get_redis_key(session_id)
            ttl = self.redis.ttl(redis_key)
            
            # 如果 TTL 有效，保持原有 TTL；否则使用默认 TTL
            if ttl > 0:
                self.redis.setex(redis_key, ttl, session_json)
            else:
                self.redis.setex(redis_key, self.SESSION_TTL, session_json)
            
            logger.debug(f"Session updated: {session_id}")
            return True
            
        except (redis.ConnectionError, redis.TimeoutError):
            # 让装饰器处理 Redis 错误
            raise
        except Exception as e:
            logger.error(f"Error updating session: {e}", exc_info=True)
            return False
    
    @handle_redis_errors
    def delete_session(self, session_id: str) -> bool:
        """
        删除 Session
        
        Args:
            session_id: Session ID
            
        Returns:
            bool: 是否删除成功
            
        Raises:
            redis.ConnectionError: Redis 连接失败
            redis.TimeoutError: Redis 操作超时
        """
        try:
            redis_key = self._get_redis_key(session_id)
            result = self.redis.delete(redis_key)
            
            if result > 0:
                # 记录 Session 销毁日志
                log_auth_event(
                    event_type='session_destroyed',
                    session_id=session_id,
                    success=True
                )
                logger.info(f"Session deleted: {session_id}")
                return True
            else:
                logger.debug(f"Session not found for deletion: {session_id}")
                return False
                
        except (redis.ConnectionError, redis.TimeoutError):
            # 让装饰器处理 Redis 错误
            raise
        except Exception as e:
            logger.error(f"Error deleting session: {e}", exc_info=True)
            return False
    
    @handle_redis_errors
    def extend_session(self, session_id: str) -> bool:
        """
        延长 Session 过期时间
        
        检查 Session 的 last_active 时间，如果超过阈值则更新时间并重置 TTL。
        
        Args:
            session_id: Session ID
            
        Returns:
            bool: 是否延长成功
            
        Raises:
            redis.ConnectionError: Redis 连接失败
            redis.TimeoutError: Redis 操作超时
        """
        try:
            # 获取 Session 数据
            session_data = self.get_session(session_id)
            if session_data is None:
                logger.debug(f"Cannot extend non-existent session: {session_id}")
                return False
            
            # 检查是否需要延期
            current_time = int(time.time())
            last_active = session_data.get('last_active', 0)
            
            if current_time - last_active >= self.EXTENSION_THRESHOLD:
                # 更新 last_active 时间
                session_data['last_active'] = current_time
                
                # 序列化为 JSON
                session_json = json.dumps(session_data)
                
                # 重置 TTL
                redis_key = self._get_redis_key(session_id)
                self.redis.setex(redis_key, self.SESSION_TTL, session_json)
                
                logger.debug(f"Session extended: {session_id}")
                return True
            else:
                # 不需要延期
                logger.debug(f"Session does not need extension: {session_id}")
                return True
                
        except (redis.ConnectionError, redis.TimeoutError):
            # 让装饰器处理 Redis 错误
            raise
        except Exception as e:
            logger.error(f"Error extending session: {e}", exc_info=True)
            return False
    
    def _get_redis_key(self, session_id: str) -> str:
        """
        生成 Redis 键名
        
        Args:
            session_id: Session ID
            
        Returns:
            str: Redis 键名，格式为 "session:{uuid}"
        """
        return f"{self.SESSION_KEY_PREFIX}{session_id}"


# 创建全局 SessionService 实例
session_service = SessionService()
