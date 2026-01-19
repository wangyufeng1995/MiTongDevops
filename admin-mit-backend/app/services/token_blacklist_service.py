"""
Token 黑名单服务

负责管理 Token 黑名单，用于登出时废弃 Refresh Token。
使用 Redis 存储黑名单，支持自动过期清理。
"""
import json
import time
import logging
from typing import Optional
import redis
from flask_jwt_extended import decode_token

from app.extensions import redis_client

logger = logging.getLogger(__name__)


class TokenBlacklistService:
    """Token 黑名单服务"""
    
    # 黑名单配置常量
    BLACKLIST_KEY_PREFIX = "token_blacklist:"
    
    def __init__(self, redis_client=None):
        """
        初始化 TokenBlacklistService
        
        Args:
            redis_client: Redis 客户端实例，如果为 None 则使用全局客户端
        """
        self.redis = redis_client if redis_client is not None else globals().get('redis_client')
        if self.redis is None:
            from app.extensions import get_redis_client
            self.redis = get_redis_client()
    
    def add_to_blacklist(self, token: str, expires_at: int = None) -> bool:
        """
        将 Token 加入黑名单
        
        Args:
            token: Refresh Token 字符串
            expires_at: Token 过期时间戳（可选），如果不提供则从 Token 中解析
            
        Returns:
            bool: 是否添加成功
            
        Raises:
            redis.ConnectionError: Redis 连接失败
            redis.TimeoutError: Redis 操作超时
        """
        try:
            # 解析 Token 获取 JTI 和过期时间
            try:
                decoded = decode_token(token)
                jti = decoded.get('jti')
                if not jti:
                    logger.error("Token does not contain JTI claim")
                    return False
                
                # 如果未提供过期时间，从 Token 中获取
                if expires_at is None:
                    expires_at = decoded.get('exp')
                    if not expires_at:
                        logger.error("Token does not contain exp claim")
                        return False
            except Exception as e:
                logger.error(f"Failed to decode token: {e}")
                return False
            
            # 计算 TTL（剩余有效时间）
            current_time = int(time.time())
            ttl = expires_at - current_time
            
            # 如果 Token 已经过期，不需要加入黑名单
            if ttl <= 0:
                logger.debug(f"Token already expired, not adding to blacklist: {jti}")
                return True
            
            # 构建黑名单数据
            blacklist_data = {
                'jti': jti,
                'blacklisted_at': current_time,
                'expires_at': expires_at,
                'reason': 'user_logout'
            }
            
            # 序列化为 JSON
            blacklist_json = json.dumps(blacklist_data)
            
            # 存储到 Redis，设置 TTL 为 Token 剩余有效时间
            redis_key = self._get_redis_key(jti)
            self.redis.setex(redis_key, ttl, blacklist_json)
            
            logger.info(f"Token added to blacklist: {jti}, TTL: {ttl}s")
            return True
            
        except (redis.ConnectionError, redis.TimeoutError) as e:
            logger.error(f"Redis error adding token to blacklist: {e}")
            raise
        except Exception as e:
            logger.error(f"Error adding token to blacklist: {e}", exc_info=True)
            return False
    
    def is_blacklisted(self, token: str) -> bool:
        """
        检查 Token 是否在黑名单中
        
        Args:
            token: Token 字符串（可以是完整 Token 或 JTI）
            
        Returns:
            bool: 是否在黑名单中
            
        Raises:
            redis.ConnectionError: Redis 连接失败
            redis.TimeoutError: Redis 操作超时
        """
        try:
            # 尝试从 Token 中提取 JTI
            jti = token
            if '.' in token:  # 看起来像是完整的 JWT Token
                try:
                    decoded = decode_token(token)
                    jti = decoded.get('jti')
                    if not jti:
                        logger.warning("Token does not contain JTI claim")
                        return False
                except Exception as e:
                    logger.error(f"Failed to decode token for blacklist check: {e}")
                    return False
            
            # 检查 Redis 中是否存在
            redis_key = self._get_redis_key(jti)
            exists = self.redis.exists(redis_key)
            
            if exists:
                logger.debug(f"Token found in blacklist: {jti}")
                return True
            else:
                logger.debug(f"Token not in blacklist: {jti}")
                return False
                
        except (redis.ConnectionError, redis.TimeoutError) as e:
            logger.error(f"Redis error checking blacklist: {e}")
            raise
        except Exception as e:
            logger.error(f"Error checking blacklist: {e}", exc_info=True)
            return False
    
    def cleanup_expired(self) -> int:
        """
        清理已过期的黑名单记录
        
        注意：由于使用了 Redis TTL 自动过期机制，此方法主要用于手动清理或统计。
        正常情况下，Redis 会自动删除过期的键。
        
        Returns:
            int: 清理的记录数
            
        Raises:
            redis.ConnectionError: Redis 连接失败
            redis.TimeoutError: Redis 操作超时
        """
        try:
            # 扫描所有黑名单键
            pattern = f"{self.BLACKLIST_KEY_PREFIX}*"
            cursor = 0
            cleaned_count = 0
            current_time = int(time.time())
            
            while True:
                # 使用 SCAN 命令分批扫描
                cursor, keys = self.redis.scan(cursor, match=pattern, count=100)
                
                for key in keys:
                    try:
                        # 获取黑名单数据
                        data_json = self.redis.get(key)
                        if data_json is None:
                            # 键已经不存在（可能被 TTL 自动删除）
                            continue
                        
                        # 解析数据
                        data = json.loads(data_json)
                        expires_at = data.get('expires_at', 0)
                        
                        # 检查是否过期
                        if expires_at <= current_time:
                            # 删除过期记录
                            self.redis.delete(key)
                            cleaned_count += 1
                            logger.debug(f"Cleaned expired blacklist entry: {key}")
                    except json.JSONDecodeError:
                        # 数据损坏，删除
                        self.redis.delete(key)
                        cleaned_count += 1
                        logger.warning(f"Cleaned corrupted blacklist entry: {key}")
                    except Exception as e:
                        logger.error(f"Error processing blacklist entry {key}: {e}")
                
                # 如果 cursor 为 0，表示扫描完成
                if cursor == 0:
                    break
            
            if cleaned_count > 0:
                logger.info(f"Cleaned {cleaned_count} expired blacklist entries")
            
            return cleaned_count
            
        except (redis.ConnectionError, redis.TimeoutError) as e:
            logger.error(f"Redis error cleaning blacklist: {e}")
            raise
        except Exception as e:
            logger.error(f"Error cleaning blacklist: {e}", exc_info=True)
            return 0
    
    def _get_redis_key(self, jti: str) -> str:
        """
        生成 Redis 键名
        
        Args:
            jti: Token JTI (JWT ID)
            
        Returns:
            str: Redis 键名，格式为 "token_blacklist:{jti}"
        """
        return f"{self.BLACKLIST_KEY_PREFIX}{jti}"


# 创建全局 TokenBlacklistService 实例
token_blacklist_service = TokenBlacklistService()
