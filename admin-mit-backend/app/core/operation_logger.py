"""
操作日志记录装饰器和中间件
"""
from functools import wraps
from flask import request, g
from app.services.operation_log_service import operation_log_service
import logging

logger = logging.getLogger(__name__)


def log_operation(action, resource, get_resource_id=None, get_details=None):
    """
    操作日志记录装饰器
    
    Args:
        action: 操作类型 (create, update, delete, view, etc.)
        resource: 资源类型 (user, role, menu, host, etc.)
        get_resource_id: 获取资源ID的函数，接收(*args, **kwargs)参数
        get_details: 获取操作详情的函数，接收(*args, **kwargs, result)参数
    
    Usage:
        @log_operation('create', 'user')
        def create_user():
            pass
        
        @log_operation('update', 'user', 
                      get_resource_id=lambda *args, **kwargs: kwargs.get('user_id'),
                      get_details=lambda *args, **kwargs, result=None: {'updated_fields': ['name', 'email']})
        def update_user(user_id):
            pass
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # 执行原函数
                result = f(*args, **kwargs)
                
                # 获取资源ID
                resource_id = None
                if get_resource_id:
                    try:
                        resource_id = get_resource_id(*args, **kwargs)
                    except Exception as e:
                        logger.warning(f"Failed to get resource_id: {e}")
                
                # 获取操作详情
                details = None
                if get_details:
                    try:
                        details = get_details(*args, **kwargs, result=result)
                    except Exception as e:
                        logger.warning(f"Failed to get operation details: {e}")
                
                # 记录操作日志
                operation_log_service.log_operation(
                    action=action,
                    resource=resource,
                    resource_id=resource_id,
                    details=details
                )
                
                return result
                
            except Exception as e:
                # 即使记录日志失败，也不影响原函数执行
                logger.error(f"Operation logging failed: {e}")
                # 重新抛出原函数的异常
                raise
        
        return decorated_function
    return decorator


def log_api_operation(action, resource):
    """
    API操作日志记录装饰器（简化版）
    自动从请求中提取资源ID和操作详情
    
    Args:
        action: 操作类型
        resource: 资源类型
    
    Usage:
        @log_api_operation('create', 'user')
        def create_user():
            pass
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # 执行原函数
                result = f(*args, **kwargs)
                
                # 尝试从URL参数中获取资源ID
                resource_id = None
                if 'id' in kwargs:
                    resource_id = kwargs['id']
                elif hasattr(request, 'view_args') and request.view_args and 'id' in request.view_args:
                    resource_id = request.view_args['id']
                
                # 构建操作详情
                details = {}
                
                # 添加请求方法
                if request:
                    details['method'] = request.method
                    
                    # 对于POST/PUT请求，记录请求数据（敏感信息除外）
                    if request.method in ['POST', 'PUT', 'PATCH'] and request.is_json:
                        request_data = request.get_json() or {}
                        # 过滤敏感信息
                        filtered_data = {k: v for k, v in request_data.items() 
                                       if k not in ['password', 'password_hash', 'token', 'secret']}
                        if filtered_data:
                            details['request_data'] = filtered_data
                    
                    # 记录查询参数
                    if request.args:
                        details['query_params'] = dict(request.args)
                
                # 如果返回结果是JSON响应，尝试提取有用信息
                if hasattr(result, 'get_json'):
                    try:
                        response_data = result.get_json()
                        if isinstance(response_data, dict):
                            if response_data.get('success'):
                                details['success'] = True
                                # 对于创建操作，记录新创建的资源ID
                                if action == 'create' and 'data' in response_data:
                                    data = response_data['data']
                                    if isinstance(data, dict) and 'id' in data:
                                        resource_id = data['id']
                            else:
                                details['success'] = False
                                details['error'] = response_data.get('message', 'Unknown error')
                    except Exception:
                        pass
                
                # 记录操作日志
                operation_log_service.log_operation(
                    action=action,
                    resource=resource,
                    resource_id=resource_id,
                    details=details if details else None
                )
                
                return result
                
            except Exception as e:
                # 记录失败的操作
                try:
                    operation_log_service.log_operation(
                        action=action,
                        resource=resource,
                        details={
                            'success': False,
                            'error': str(e),
                            'method': request.method if request else None
                        }
                    )
                except Exception as log_error:
                    logger.error(f"Failed to log failed operation: {log_error}")
                
                # 重新抛出原异常
                raise
        
        return decorated_function
    return decorator


class OperationLoggerMiddleware:
    """操作日志记录中间件"""
    
    def __init__(self, app=None):
        self.app = app
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        """初始化中间件"""
        app.before_request(self.before_request)
        app.after_request(self.after_request)
    
    def before_request(self):
        """请求前处理"""
        # 在g中存储请求开始时间，用于计算请求耗时
        import time
        g.request_start_time = time.time()
    
    def after_request(self, response):
        """请求后处理"""
        try:
            # 只记录API请求
            if not request.path.startswith('/api/'):
                return response
            
            # 跳过日志相关的API，避免无限循环
            if request.path.startswith('/api/logs'):
                return response
            
            # 跳过健康检查等不需要记录的端点
            skip_endpoints = [
                '/api/test/health',
                '/api/auth/csrf-token',
                '/api/auth/public-key'
            ]
            
            if any(request.path.startswith(endpoint) for endpoint in skip_endpoints):
                return response
            
            # 只记录有用户信息的请求
            if not hasattr(g, 'user_id') or not g.user_id:
                return response
            
            # 计算请求耗时
            request_duration = None
            if hasattr(g, 'request_start_time'):
                import time
                request_duration = round((time.time() - g.request_start_time) * 1000, 2)  # 毫秒
            
            # 确定操作类型和资源类型
            action, resource = self._determine_action_and_resource(request, response)
            
            if action and resource:
                # 构建操作详情
                details = {
                    'method': request.method,
                    'path': request.path,
                    'status_code': response.status_code,
                    'success': 200 <= response.status_code < 400
                }
                
                if request_duration is not None:
                    details['duration_ms'] = request_duration
                
                # 添加查询参数
                if request.args:
                    details['query_params'] = dict(request.args)
                
                # 对于POST/PUT请求，记录请求数据（过滤敏感信息）
                if request.method in ['POST', 'PUT', 'PATCH'] and request.is_json:
                    try:
                        request_data = request.get_json() or {}
                        filtered_data = {k: v for k, v in request_data.items() 
                                       if k not in ['password', 'password_hash', 'token', 'secret', 'private_key']}
                        if filtered_data:
                            details['request_data'] = filtered_data
                    except Exception:
                        pass
                
                # 记录操作日志
                operation_log_service.log_operation(
                    action=action,
                    resource=resource,
                    details=details
                )
        
        except Exception as e:
            logger.error(f"Operation logging middleware error: {e}")
        
        return response
    
    def _determine_action_and_resource(self, request, response):
        """
        根据请求路径和方法确定操作类型和资源类型
        
        Returns:
            tuple: (action, resource)
        """
        try:
            path = request.path
            method = request.method
            
            # 解析路径
            path_parts = [part for part in path.split('/') if part]
            
            if len(path_parts) < 2 or path_parts[0] != 'api':
                return None, None
            
            resource_mapping = {
                'users': 'user',
                'roles': 'role', 
                'menus': 'menu',
                'hosts': 'host',
                'playbooks': 'playbook',
                'monitor': 'monitor',
                'network': 'network',
                'logs': 'log'
            }
            
            # 获取资源类型
            resource_path = path_parts[1]
            resource = resource_mapping.get(resource_path, resource_path)
            
            # 特殊处理认证相关操作
            if resource_path == 'auth':
                if len(path_parts) > 2:
                    auth_action = path_parts[2]
                    if auth_action == 'login':
                        return 'login', 'auth'
                    elif auth_action == 'logout':
                        return 'logout', 'auth'
                    elif auth_action == 'refresh':
                        return 'refresh_token', 'auth'
                return 'auth', 'auth'
            
            # 根据HTTP方法确定操作类型
            if method == 'GET':
                # 区分列表查询和详情查询
                if len(path_parts) > 2 and path_parts[2].isdigit():
                    return 'view', resource
                else:
                    return 'list', resource
            elif method == 'POST':
                # 检查是否是删除操作（软删除）
                if len(path_parts) > 3 and path_parts[3] == 'delete':
                    return 'delete', resource
                # 检查是否是特殊操作
                elif len(path_parts) > 3:
                    action_name = path_parts[3]
                    return action_name, resource
                else:
                    return 'create', resource
            elif method == 'PUT':
                return 'update', resource
            elif method == 'DELETE':
                return 'delete', resource
            elif method == 'PATCH':
                return 'update', resource
            
            return None, None
            
        except Exception as e:
            logger.error(f"Failed to determine action and resource: {e}")
            return None, None


# 全局操作日志中间件实例
operation_logger_middleware = OperationLoggerMiddleware()