from flask import request, g, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required, get_jwt, verify_jwt_in_request
from flask_wtf.csrf import validate_csrf, CSRFError
from functools import wraps
import logging

logger = logging.getLogger(__name__)

def setup_middleware(app):
    """设置中间件"""
    
    @app.before_request
    def before_request():
        """请求前处理"""
        # 记录请求信息
        logger.info(f"{request.method} {request.path} - {request.remote_addr}")
        
        # 初始化租户上下文
        g.tenant_id = None
        g.user_id = None
        g.user_roles = []
        
        # 全局CSRF保护
        if _should_apply_global_csrf_protection():
            try:
                from app.services.csrf_service import csrf_service
                if not csrf_service.validate_request():
                    return jsonify({
                        'success': False,
                        'message': 'CSRF token 验证失败',
                        'error_code': 'CSRF_ERROR'
                    }), 400
            except Exception as e:
                logger.error(f"Global CSRF protection error: {e}")
                return jsonify({
                    'success': False,
                    'message': 'CSRF 验证失败',
                    'error_code': 'CSRF_ERROR'
                }), 400
        
        # 如果是受保护的路由，解析 JWT 获取租户信息
        if request.endpoint and not _is_public_endpoint(request.endpoint):
            try:
                # 检查是否有 JWT token
                auth_header = request.headers.get('Authorization')
                if auth_header and auth_header.startswith('Bearer '):
                    # 验证JWT token但不要求必须存在
                    try:
                        verify_jwt_in_request(optional=True)
                        if get_jwt_identity():
                            claims = get_jwt()
                            g.user_id = get_jwt_identity()
                            g.tenant_id = claims.get('tenant_id')
                            g.user_roles = claims.get('roles', [])
                    except Exception as jwt_error:
                        logger.debug(f"JWT verification failed: {jwt_error}")
            except Exception as e:
                logger.warning(f"Failed to parse JWT in middleware: {e}")
    
    @app.errorhandler(CSRFError)
    def handle_csrf_error(e):
        """处理 CSRF 错误"""
        logger.warning(f"CSRF error: {e.description}")
        
        # 记录攻击尝试
        try:
            from app.services.csrf_service import csrf_service
            csrf_service._log_potential_attack(None, f"CSRFError: {e.description}")
        except Exception as log_error:
            logger.error(f"Failed to log CSRF error: {log_error}")
        
        return jsonify({
            'success': False,
            'message': 'CSRF token 验证失败',
            'error_code': 'CSRF_ERROR'
        }), 400

def _should_apply_global_csrf_protection():
    """判断是否应用全局CSRF保护"""
    try:
        from app.services.csrf_service import csrf_service
        return csrf_service.should_protect_request()
    except Exception as e:
        logger.error(f"Error checking CSRF protection: {e}")
        return False

def _is_public_endpoint(endpoint):
    """检查是否是公开端点"""
    public_endpoints = [
        'auth.login',
        'auth.get_public_key',
        'auth.get_csrf_token',
        'test.health_check',
        'test.no_csrf_test',
        'static',
        'health_check'
    ]
    
    # 检查是否是公开端点
    for public_ep in public_endpoints:
        if endpoint.startswith(public_ep):
            return True
    
    return False

def tenant_required(f):
    """租户验证装饰器 - 使用新的 Session + Token 双重验证"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Import here to avoid circular dependency
            from app.core.auth_middleware import auth_middleware
            
            # 使用新的双重验证
            result = auth_middleware.verify_auth()
            
            if not result['valid']:
                return jsonify({
                    'success': False,
                    'message': result['message'],
                    'error_code': 'UNAUTHORIZED'
                }), 401
            
            # 设置全局上下文（已在 verify_auth 中设置，这里再次确认）
            g.user = result['user']
            g.tenant = result['tenant']
            g.user_id = result['user'].id
            g.tenant_id = result['tenant'].id
            g.user_roles = [role.name for role in result['user'].get_roles()]
            
            # 验证租户状态
            if result['tenant'].status != 1:
                return jsonify({
                    'success': False,
                    'message': '租户已被禁用',
                    'error_code': 'TENANT_DISABLED'
                }), 401
                
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Tenant validation error: {e}", exc_info=True)
            return jsonify({
                'success': False,
                'message': '租户验证失败',
                'error_code': 'TENANT_VALIDATION_ERROR'
            }), 401
    
    return decorated_function

def admin_required(f):
    """管理员权限装饰器 - 使用新的 Session + Token 双重验证"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Import here to avoid circular dependency
            from app.core.auth_middleware import auth_middleware
            
            # 使用新的双重验证
            result = auth_middleware.verify_auth()
            
            if not result['valid']:
                return jsonify({
                    'success': False,
                    'message': result['message'],
                    'error_code': 'UNAUTHORIZED'
                }), 401
            
            # 设置全局上下文
            g.user = result['user']
            g.tenant = result['tenant']
            g.user_id = result['user'].id
            g.tenant_id = result['tenant'].id
            
            # 检查用户角色
            user_roles = [role.name for role in result['user'].get_roles()]
            g.user_roles = user_roles
            
            # 验证租户状态
            if result['tenant'].status != 1:
                return jsonify({
                    'success': False,
                    'message': '租户已被禁用',
                    'error_code': 'TENANT_DISABLED'
                }), 401
            
            # 检查是否有管理员角色
            if 'admin' not in user_roles and 'super_admin' not in user_roles:
                logger.warning(f"Authorization failed: user {result['user'].username} is not an admin")
                return jsonify({
                    'success': False,
                    'message': '权限不足，需要管理员权限',
                    'error_code': 'FORBIDDEN'
                }), 403
                
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Admin validation error: {e}", exc_info=True)
            return jsonify({
                'success': False,
                'message': '权限验证失败',
                'error_code': 'ADMIN_VALIDATION_ERROR'
            }), 401
    
    return decorated_function

def role_required(*required_roles):
    """角色验证装饰器 - 使用新的 Session + Token 双重验证"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Import here to avoid circular dependency
                from app.core.auth_middleware import auth_middleware
                
                # 使用新的双重验证
                result = auth_middleware.verify_auth()
                
                if not result['valid']:
                    return jsonify({
                        'success': False,
                        'message': result['message'],
                        'error_code': 'UNAUTHORIZED'
                    }), 401
                
                # 设置全局上下文
                g.user = result['user']
                g.tenant = result['tenant']
                g.user_id = result['user'].id
                g.tenant_id = result['tenant'].id
                
                # 检查用户角色
                user_roles = [role.name for role in result['user'].get_roles()]
                g.user_roles = user_roles
                
                # 验证租户状态
                if result['tenant'].status != 1:
                    return jsonify({
                        'success': False,
                        'message': '租户已被禁用',
                        'error_code': 'TENANT_DISABLED'
                    }), 401
                
                # 检查是否有所需角色
                if not any(role in user_roles for role in required_roles):
                    logger.warning(f"Authorization failed: user {result['user'].username} does not have required roles {required_roles}")
                    return jsonify({
                        'success': False,
                        'message': f'需要以下角色之一: {", ".join(required_roles)}',
                        'error_code': 'FORBIDDEN'
                    }), 403
                    
                return f(*args, **kwargs)
            except Exception as e:
                logger.error(f"Role validation error: {e}", exc_info=True)
                return jsonify({
                    'success': False,
                    'message': '角色验证失败',
                    'error_code': 'ROLE_VALIDATION_ERROR'
                }), 401
        
        return decorated_function
    return decorator

def permission_required(*required_permissions):
    """权限验证装饰器 - 使用新的 Session + Token 双重验证"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Import here to avoid circular dependency
                from app.core.auth_middleware import auth_middleware
                from app.services.auth_service import auth_service
                
                # 使用新的双重验证
                result = auth_middleware.verify_auth()
                
                if not result['valid']:
                    return jsonify({
                        'success': False,
                        'message': result['message'],
                        'error_code': 'UNAUTHORIZED'
                    }), 401
                
                # 设置全局上下文
                g.user = result['user']
                g.tenant = result['tenant']
                g.user_id = result['user'].id
                g.tenant_id = result['tenant'].id
                g.user_roles = [role.name for role in result['user'].get_roles()]
                
                # 验证租户状态
                if result['tenant'].status != 1:
                    return jsonify({
                        'success': False,
                        'message': '租户已被禁用',
                        'error_code': 'TENANT_DISABLED'
                    }), 401
                
                # 验证用户权限
                if not auth_service.validate_user_permissions(list(required_permissions)):
                    logger.warning(f"Authorization failed: user {result['user'].username} does not have required permissions {required_permissions}")
                    return jsonify({
                        'success': False,
                        'message': f'需要以下权限: {", ".join(required_permissions)}',
                        'error_code': 'FORBIDDEN'
                    }), 403
                    
                return f(*args, **kwargs)
            except Exception as e:
                logger.error(f"Permission validation error: {e}", exc_info=True)
                return jsonify({
                    'success': False,
                    'message': '权限验证失败',
                    'error_code': 'PERMISSION_VALIDATION_ERROR'
                }), 401
        
        return decorated_function
    return decorator

def csrf_required(f):
    """CSRF 验证装饰器（手动使用）"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            from app.services.csrf_service import csrf_service
            
            # 验证CSRF token
            if not csrf_service.validate_request():
                return jsonify({
                    'success': False,
                    'message': 'CSRF token 验证失败'
                }), 400
            
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"CSRF validation error: {e}")
            return jsonify({
                'success': False,
                'message': 'CSRF 验证失败'
            }), 500
    
    return decorated_function

def csrf_exempt(f):
    """CSRF 免除装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 标记为免除CSRF检查
        g.csrf_exempt = True
        return f(*args, **kwargs)
    
    return decorated_function

def tenant_isolation_filter(query, model_class):
    """
    租户隔离查询过滤器
    
    Args:
        query: SQLAlchemy查询对象
        model_class: 模型类
        
    Returns:
        过滤后的查询对象
    """
    if hasattr(g, 'tenant_id') and g.tenant_id and hasattr(model_class, 'tenant_id'):
        return query.filter(model_class.tenant_id == g.tenant_id)
    return query