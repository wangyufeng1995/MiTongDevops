"""
认证系统错误处理模块

提供统一的错误处理装饰器和错误响应格式。
确保客户端不会收到敏感错误信息，同时记录详细的服务端日志。
"""
import logging
import redis
from functools import wraps
from flask import jsonify
from typing import Callable, Any, Tuple

logger = logging.getLogger(__name__)


class AuthError(Exception):
    """认证错误基类"""
    def __init__(self, message: str, error_code: str = 'AUTH_ERROR', status_code: int = 401):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        super().__init__(self.message)


class SessionError(AuthError):
    """Session 相关错误"""
    def __init__(self, message: str, error_code: str = 'SESSION_ERROR'):
        super().__init__(message, error_code, 401)


class TokenError(AuthError):
    """Token 相关错误"""
    def __init__(self, message: str, error_code: str = 'TOKEN_ERROR'):
        super().__init__(message, error_code, 401)


class ServiceUnavailableError(Exception):
    """服务不可用错误"""
    def __init__(self, message: str = '服务暂时不可用'):
        self.message = message
        super().__init__(self.message)


def handle_redis_errors(f: Callable) -> Callable:
    """
    Redis 错误处理装饰器
    
    捕获 Redis 连接错误和超时错误，返回 503 Service Unavailable。
    记录详细的错误信息到日志，但只返回通用错误消息给客户端。
    
    **Validates: Requirements 5.5, 10.4**
    """
    @wraps(f)
    def wrapper(*args, **kwargs) -> Any:
        try:
            return f(*args, **kwargs)
        except redis.ConnectionError as e:
            logger.error(
                f"Redis connection error in {f.__name__}: {str(e)}",
                exc_info=True,
                extra={
                    'function_name': f.__name__,
                    'error_type': 'redis_connection_error',
                    'function_args': str(args)[:200],  # 限制长度避免日志过大
                }
            )
            raise ServiceUnavailableError('服务暂时不可用，请稍后重试')
        except redis.TimeoutError as e:
            logger.error(
                f"Redis timeout error in {f.__name__}: {str(e)}",
                exc_info=True,
                extra={
                    'function_name': f.__name__,
                    'error_type': 'redis_timeout_error',
                    'function_args': str(args)[:200],
                }
            )
            raise ServiceUnavailableError('服务响应超时，请稍后重试')
        except redis.RedisError as e:
            logger.error(
                f"Redis error in {f.__name__}: {str(e)}",
                exc_info=True,
                extra={
                    'function_name': f.__name__,
                    'error_type': 'redis_error',
                    'function_args': str(args)[:200],
                }
            )
            raise ServiceUnavailableError('服务暂时不可用')
    
    return wrapper


def handle_auth_errors(f: Callable) -> Callable:
    """
    认证错误处理装饰器
    
    捕获所有认证相关的异常，记录详细日志，返回安全的错误响应。
    确保不泄露敏感信息（如堆栈跟踪、内部错误详情）。
    
    **Validates: Requirements 10.1, 10.4, 10.6**
    """
    @wraps(f)
    def wrapper(*args, **kwargs) -> Tuple[dict, int]:
        try:
            return f(*args, **kwargs)
        except ServiceUnavailableError as e:
            # 服务不可用错误（已经记录过日志）
            return {
                'success': False,
                'message': e.message,
                'error_code': 'SERVICE_UNAVAILABLE'
            }, 503
        except AuthError as e:
            # 认证相关错误（预期的错误）
            logger.warning(
                f"Authentication error in {f.__name__}: {e.message}",
                extra={
                    'function_name': f.__name__,
                    'error_code': e.error_code,
                    'error_msg': e.message,
                }
            )
            return {
                'success': False,
                'message': e.message,
                'error_code': e.error_code
            }, e.status_code
        except Exception as e:
            # 未预期的错误 - 记录详细信息但返回通用消息
            logger.error(
                f"Unexpected error in {f.__name__}: {str(e)}",
                exc_info=True,
                extra={
                    'function_name': f.__name__,
                    'error_type': type(e).__name__,
                    'error_msg': str(e),
                }
            )
            # 返回通用错误消息，不泄露内部错误详情
            return {
                'success': False,
                'message': '系统错误，请稍后重试',
                'error_code': 'INTERNAL_ERROR'
            }, 500
    
    return wrapper


def log_auth_event(event_type: str, user_id: str = None, username: str = None, 
                   session_id: str = None, ip_address: str = None, 
                   success: bool = True, reason: str = None, **extra_data):
    """
    记录认证事件日志
    
    统一的认证事件日志记录函数，用于记录登录、登出、Session 创建/销毁等事件。
    
    **Validates: Requirements 10.1, 10.2**
    
    Args:
        event_type: 事件类型（login, logout, session_created, session_destroyed, etc.）
        user_id: 用户 ID
        username: 用户名
        session_id: Session ID
        ip_address: IP 地址
        success: 是否成功
        reason: 失败原因（如果失败）
        **extra_data: 额外的数据
    """
    log_data = {
        'event_type': event_type,
        'user_id': user_id,
        'username': username,
        'session_id': session_id,
        'ip_address': ip_address,
        'success': success,
        'reason': reason,
    }
    
    # 添加额外数据
    log_data.update(extra_data)
    
    # 移除 None 值
    log_data = {k: v for k, v in log_data.items() if v is not None}
    
    if success:
        logger.info(
            f"Auth event: {event_type}",
            extra=log_data
        )
    else:
        logger.warning(
            f"Auth event failed: {event_type} - {reason}",
            extra=log_data
        )


def log_security_warning(warning_type: str, message: str, user_id: str = None, 
                        session_id: str = None, ip_address: str = None, **extra_data):
    """
    记录安全警告日志
    
    用于记录异常认证行为、安全威胁等。
    
    **Validates: Requirements 10.3, 4.6**
    
    Args:
        warning_type: 警告类型（user_mismatch, blacklisted_token, etc.）
        message: 警告消息
        user_id: 用户 ID
        session_id: Session ID
        ip_address: IP 地址
        **extra_data: 额外的数据
    """
    log_data = {
        'warning_type': warning_type,
        'warning_message': message,
        'user_id': user_id,
        'session_id': session_id,
        'ip_address': ip_address,
    }
    
    # 添加额外数据
    log_data.update(extra_data)
    
    # 移除 None 值
    log_data = {k: v for k, v in log_data.items() if v is not None}
    
    logger.warning(
        f"Security warning: {warning_type} - {message}",
        extra=log_data
    )


def create_error_response(message: str, error_code: str = 'ERROR', 
                         status_code: int = 400, **extra_data) -> Tuple[dict, int]:
    """
    创建统一格式的错误响应
    
    **Validates: Requirements 10.6**
    
    Args:
        message: 错误消息（面向用户的安全消息）
        error_code: 错误代码
        status_code: HTTP 状态码
        **extra_data: 额外的响应数据（可选）
    
    Returns:
        Tuple[dict, int]: (响应字典, 状态码)
    """
    response = {
        'success': False,
        'message': message,
        'error_code': error_code
    }
    
    # 添加额外数据（如果有）
    if extra_data:
        response.update(extra_data)
    
    return response, status_code


def create_success_response(data: Any = None, message: str = '操作成功') -> dict:
    """
    创建统一格式的成功响应
    
    Args:
        data: 响应数据
        message: 成功消息
    
    Returns:
        dict: 响应字典
    """
    response = {
        'success': True,
        'message': message
    }
    
    if data is not None:
        response['data'] = data
    
    return response
