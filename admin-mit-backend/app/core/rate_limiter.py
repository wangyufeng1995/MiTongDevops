#!/usr/bin/env python3
"""
API请求频率限制
实现基于Redis的请求频率限制功能
"""

from functools import wraps
from flask import request, jsonify, g
from app.extensions import redis_client
import time
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """请求频率限制器"""
    
    def __init__(self, redis_client=None):
        """
        初始化频率限制器
        
        Args:
            redis_client: Redis客户端实例
        """
        self.redis = redis_client
        self.default_limit = 100  # 默认每分钟100次请求
        self.default_window = 60  # 默认时间窗口60秒
    
    def get_client_identifier(self):
        """
        获取客户端标识符
        
        Returns:
            str: 客户端标识符（IP地址或用户ID）
        """
        # 优先使用用户ID（如果已认证）
        if hasattr(g, 'current_user_id') and g.current_user_id:
            return f"user:{g.current_user_id}"
        
        # 否则使用IP地址
        # 考虑代理情况
        if request.headers.get('X-Forwarded-For'):
            ip = request.headers.get('X-Forwarded-For').split(',')[0].strip()
        else:
            ip = request.remote_addr
        
        return f"ip:{ip}"
    
    def get_rate_limit_key(self, identifier, endpoint=None):
        """
        生成频率限制的Redis键
        
        Args:
            identifier: 客户端标识符
            endpoint: API端点（可选）
            
        Returns:
            str: Redis键
        """
        if endpoint:
            return f"rate_limit:{identifier}:{endpoint}"
        return f"rate_limit:{identifier}:global"
    
    def is_rate_limited(self, identifier, limit=None, window=None, endpoint=None):
        """
        检查是否超过频率限制
        
        Args:
            identifier: 客户端标识符
            limit: 请求限制次数
            window: 时间窗口（秒）
            endpoint: API端点
            
        Returns:
            tuple: (是否限制, 剩余次数, 重置时间)
        """
        if not self.redis:
            # 如果Redis不可用，不进行限制
            return False, limit or self.default_limit, 0
        
        limit = limit or self.default_limit
        window = window or self.default_window
        
        key = self.get_rate_limit_key(identifier, endpoint)
        
        try:
            # 使用Redis的INCR和EXPIRE实现滑动窗口
            current = self.redis.get(key)
            
            if current is None:
                # 第一次请求
                self.redis.setex(key, window, 1)
                return False, limit - 1, window
            
            current = int(current)
            
            if current >= limit:
                # 超过限制
                ttl = self.redis.ttl(key)
                return True, 0, ttl
            
            # 增加计数
            self.redis.incr(key)
            ttl = self.redis.ttl(key)
            
            return False, limit - current - 1, ttl
            
        except Exception as e:
            logger.error(f"Rate limit check error: {e}")
            # 出错时不限制
            return False, limit, 0
    
    def record_request(self, identifier, endpoint=None):
        """
        记录请求
        
        Args:
            identifier: 客户端标识符
            endpoint: API端点
        """
        if not self.redis:
            return
        
        try:
            key = self.get_rate_limit_key(identifier, endpoint)
            self.redis.incr(key)
            
            # 设置过期时间（如果还没有）
            if self.redis.ttl(key) == -1:
                self.redis.expire(key, self.default_window)
                
        except Exception as e:
            logger.error(f"Record request error: {e}")
    
    def get_rate_limit_info(self, identifier, endpoint=None):
        """
        获取频率限制信息
        
        Args:
            identifier: 客户端标识符
            endpoint: API端点
            
        Returns:
            dict: 频率限制信息
        """
        if not self.redis:
            return {
                'limit': self.default_limit,
                'remaining': self.default_limit,
                'reset': 0
            }
        
        key = self.get_rate_limit_key(identifier, endpoint)
        
        try:
            current = self.redis.get(key)
            current = int(current) if current else 0
            
            ttl = self.redis.ttl(key)
            ttl = ttl if ttl > 0 else self.default_window
            
            return {
                'limit': self.default_limit,
                'remaining': max(0, self.default_limit - current),
                'reset': int(time.time()) + ttl
            }
            
        except Exception as e:
            logger.error(f"Get rate limit info error: {e}")
            return {
                'limit': self.default_limit,
                'remaining': self.default_limit,
                'reset': 0
            }
    
    def reset_rate_limit(self, identifier, endpoint=None):
        """
        重置频率限制
        
        Args:
            identifier: 客户端标识符
            endpoint: API端点
        """
        if not self.redis:
            return
        
        try:
            key = self.get_rate_limit_key(identifier, endpoint)
            self.redis.delete(key)
            
        except Exception as e:
            logger.error(f"Reset rate limit error: {e}")


# 创建全局频率限制器实例
rate_limiter = RateLimiter(redis_client)


def rate_limit(limit=100, window=60, per_endpoint=True):
    """
    频率限制装饰器
    
    Args:
        limit: 请求限制次数
        window: 时间窗口（秒）
        per_endpoint: 是否按端点限制
        
    Returns:
        装饰器函数
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # 获取客户端标识符
            identifier = rate_limiter.get_client_identifier()
            
            # 获取端点名称
            endpoint = request.endpoint if per_endpoint else None
            
            # 检查频率限制
            is_limited, remaining, reset_time = rate_limiter.is_rate_limited(
                identifier,
                limit=limit,
                window=window,
                endpoint=endpoint
            )
            
            # 添加频率限制头
            response_headers = {
                'X-RateLimit-Limit': str(limit),
                'X-RateLimit-Remaining': str(remaining),
                'X-RateLimit-Reset': str(reset_time)
            }
            
            if is_limited:
                # 超过限制，返回429错误
                response = jsonify({
                    'success': False,
                    'message': '请求过于频繁，请稍后再试',
                    'error_code': 'RATE_LIMIT_EXCEEDED',
                    'retry_after': reset_time
                })
                response.status_code = 429
                
                for key, value in response_headers.items():
                    response.headers[key] = value
                
                return response
            
            # 执行原函数
            response = f(*args, **kwargs)
            
            # 添加频率限制头到响应
            if hasattr(response, 'headers'):
                for key, value in response_headers.items():
                    response.headers[key] = value
            
            return response
        
        return decorated_function
    return decorator


def get_rate_limit_status(identifier=None):
    """
    获取频率限制状态
    
    Args:
        identifier: 客户端标识符（可选）
        
    Returns:
        dict: 频率限制状态
    """
    if identifier is None:
        identifier = rate_limiter.get_client_identifier()
    
    return rate_limiter.get_rate_limit_info(identifier)
