"""
认证中间件

提供基于 Session + Token 双重验证的认证中间件。
支持从 Cookie 提取 Session ID，从 Authorization Header 提取 Token。
"""
from flask import request, g, jsonify
from functools import wraps
import logging

from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)


class AuthMiddleware:
    """认证中间件"""
    
    def __init__(self, auth_service: AuthService = None):
        """
        初始化 AuthMiddleware
        
        Args:
            auth_service: AuthService 实例，如果为 None 则创建新实例
        """
        self.auth_service = auth_service or AuthService()
    
    def extract_session_id(self) -> str:
        """
        从 Cookie 中提取 Session ID
        
        Returns:
            str: Session ID，如果不存在返回 None
        """
        try:
            session_id = request.cookies.get('session_id')
            if session_id:
                logger.debug(f"Session ID extracted from cookie: {session_id}")
                return session_id
            else:
                logger.debug("No session_id cookie found")
                return None
        except Exception as e:
            logger.error(f"Error extracting session ID: {e}")
            return None
    
    def extract_token(self) -> str:
        """
        从 Authorization Header 中提取 Token
        
        Returns:
            str: Access Token，如果不存在返回 None
        """
        try:
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header[7:]  # Remove 'Bearer ' prefix
                logger.debug("Access token extracted from Authorization header")
                return token
            else:
                logger.debug("No Authorization header or invalid format")
                return None
        except Exception as e:
            logger.error(f"Error extracting token: {e}")
            return None
    
    def verify_auth(self) -> dict:
        """
        验证当前请求的认证信息
        
        从 Cookie 提取 Session ID
        从 Authorization Header 提取 Token
        调用 AuthService 进行双重验证
        如果验证成功，自动延长 Session（如果需要）
        
        Returns:
            dict: 验证结果 {
                'valid': bool,
                'user': User,
                'tenant': Tenant,
                'message': str
            }
        """
        try:
            # 提取 Session ID
            session_id = self.extract_session_id()
            if not session_id:
                logger.warning(f"Authentication failed: missing session_id cookie, path: {request.path}")
                return {
                    'valid': False,
                    'user': None,
                    'tenant': None,
                    'message': '缺少 Session ID，请重新登录'
                }
            
            # 提取 Access Token
            access_token = self.extract_token()
            if not access_token:
                logger.warning("Authentication failed: missing access token")
                return {
                    'valid': False,
                    'user': None,
                    'tenant': None,
                    'message': '缺少 Access Token'
                }
            
            # 调用 AuthService 进行双重验证
            result = self.auth_service.verify_request(session_id, access_token)
            
            # 如果验证成功，设置全局上下文并自动延长 Session
            if result['valid']:
                g.user = result['user']
                g.tenant = result['tenant']
                g.user_id = result['user'].id
                g.tenant_id = result['tenant'].id
                g.user_roles = [role.name for role in result['user'].get_roles()]
                
                # 自动延长 Session（如果需要）
                # 这个操作是异步的，不影响请求性能
                try:
                    from app.services.session_service import session_service
                    session_service.extend_session(session_id)
                except Exception as extend_error:
                    # 延期失败不应该影响请求，只记录日志
                    logger.warning(f"Failed to extend session {session_id}: {extend_error}")
            
            return result
            
        except Exception as e:
            logger.error(f"Authentication verification error: {e}", exc_info=True)
            return {
                'valid': False,
                'user': None,
                'tenant': None,
                'message': '认证验证失败'
            }
    
    def require_auth(self, f):
        """
        装饰器：要求认证
        
        用法：
        @auth_middleware.require_auth
        def protected_route():
            pass
        """
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # 验证认证信息
            result = self.verify_auth()
            
            if not result['valid']:
                return jsonify({
                    'success': False,
                    'message': result['message'],
                    'error_code': 'UNAUTHORIZED'
                }), 401
            
            # 认证成功，继续执行
            return f(*args, **kwargs)
        
        return decorated_function
    
    def require_role(self, role_name: str):
        """
        装饰器：要求特定角色
        
        用法：
        @auth_middleware.require_role('admin')
        def admin_route():
            pass
        
        Args:
            role_name: 需要的角色名称
        """
        def decorator(f):
            @wraps(f)
            def decorated_function(*args, **kwargs):
                # 首先验证认证信息
                result = self.verify_auth()
                
                if not result['valid']:
                    return jsonify({
                        'success': False,
                        'message': result['message'],
                        'error_code': 'UNAUTHORIZED'
                    }), 401
                
                # 检查用户角色
                user = result['user']
                user_roles = [role.name for role in user.get_roles()]
                
                if role_name not in user_roles:
                    logger.warning(f"Authorization failed: user {user.username} does not have role {role_name}")
                    return jsonify({
                        'success': False,
                        'message': f'需要 {role_name} 角色权限',
                        'error_code': 'FORBIDDEN'
                    }), 403
                
                # 角色验证成功，继续执行
                return f(*args, **kwargs)
            
            return decorated_function
        
        return decorator


# 创建全局 AuthMiddleware 实例
auth_middleware = AuthMiddleware()
