"""
K8S Utility Functions
Provides helper functions for Kubernetes operations
"""

from functools import wraps
from flask import jsonify, g
import logging
import socket
import requests

logger = logging.getLogger(__name__)


# ============================================================================
# Error Handling Utilities
# Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
# ============================================================================

class K8sError(Exception):
    """Base exception for K8S operations"""
    def __init__(self, message, error_code=None, details=None, suggestions=None, status_code=500):
        self.message = message
        self.error_code = error_code or 'K8S_ERROR'
        self.details = details
        self.suggestions = suggestions or []
        self.status_code = status_code
        super().__init__(self.message)
    
    def to_dict(self):
        """Convert error to dictionary for JSON response"""
        result = {
            'success': False,
            'error_code': self.error_code,
            'message': self.message
        }
        if self.details:
            result['details'] = self.details
        if self.suggestions:
            result['suggestions'] = self.suggestions
        return result


class K8sConnectionError(K8sError):
    """
    Connection error to K8S cluster
    Requirements: 10.1 - Connection error messages
    """
    def __init__(self, message=None, details=None):
        super().__init__(
            message=message or '无法连接到K8S集群',
            error_code='CONNECTION_ERROR',
            details=details,
            suggestions=[
                '检查API服务器地址是否正确',
                '验证网络连接是否正常',
                '确认防火墙规则是否允许访问',
                '检查K8S集群是否正常运行'
            ],
            status_code=503
        )


class K8sAuthenticationError(K8sError):
    """
    Authentication error with K8S cluster
    Requirements: 10.3 - Permission error messages
    """
    def __init__(self, message=None, details=None):
        super().__init__(
            message=message or 'K8S集群认证失败',
            error_code='AUTHENTICATION_ERROR',
            details=details,
            suggestions=[
                '检查Token是否正确',
                '验证Token是否过期',
                '确认ServiceAccount权限是否足够',
                '检查Kubeconfig文件格式是否正确'
            ],
            status_code=401
        )


class K8sPermissionError(K8sError):
    """
    Permission denied error
    Requirements: 10.3 - Permission error messages
    """
    def __init__(self, message=None, details=None):
        super().__init__(
            message=message or '权限不足',
            error_code='PERMISSION_DENIED',
            details=details,
            suggestions=[
                '联系管理员获取相应权限',
                '使用具有相应权限的账号登录'
            ],
            status_code=403
        )


class K8sResourceNotFoundError(K8sError):
    """
    Resource not found error
    Requirements: 10.4 - Not found error messages
    """
    def __init__(self, resource_type=None, resource_name=None, namespace=None, details=None):
        if resource_type and resource_name:
            if namespace:
                message = f'{resource_type} "{resource_name}" 不存在于命名空间 "{namespace}" 中'
            else:
                message = f'{resource_type} "{resource_name}" 不存在'
        else:
            message = '资源不存在'
        
        super().__init__(
            message=message,
            error_code='RESOURCE_NOT_FOUND',
            details=details,
            suggestions=[
                '检查资源名称是否正确',
                '确认资源所在的命名空间',
                '验证资源是否已被删除'
            ],
            status_code=404
        )


class K8sValidationError(K8sError):
    """
    Validation error for request parameters
    Requirements: 10.5 - Operation error messages
    """
    def __init__(self, message=None, field=None, details=None):
        super().__init__(
            message=message or '参数验证失败',
            error_code='VALIDATION_ERROR',
            details=details,
            suggestions=[
                '检查参数格式是否正确',
                '确认参数值在有效范围内',
                '参考API文档了解参数要求'
            ],
            status_code=400
        )
        self.field = field
    
    def to_dict(self):
        result = super().to_dict()
        if self.field:
            result['field'] = self.field
        return result


class K8sConflictError(K8sError):
    """
    Resource conflict error
    Requirements: 10.5 - Operation error messages
    """
    def __init__(self, message=None, details=None):
        super().__init__(
            message=message or '操作冲突',
            error_code='CONFLICT_ERROR',
            details=details,
            suggestions=[
                '稍后重试',
                '刷新资源状态后再操作',
                '检查是否有其他操作正在进行'
            ],
            status_code=409
        )


class K8sTimeoutError(K8sError):
    """
    Operation timeout error
    Requirements: 10.2 - Timeout error handling
    """
    def __init__(self, message=None, details=None, timeout=None):
        if timeout:
            details = details or f'操作超过{timeout}秒未响应'
        
        super().__init__(
            message=message or '操作超时',
            error_code='TIMEOUT_ERROR',
            details=details,
            suggestions=[
                '检查集群负载是否过高',
                '增加超时时间',
                '稍后重试',
                '检查网络延迟'
            ],
            status_code=504
        )


def convert_k8s_api_exception(e):
    """
    Convert Kubernetes API exception to K8sError
    
    Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
    
    Args:
        e: Kubernetes ApiException
    
    Returns:
        K8sError: Converted error object
    """
    try:
        from kubernetes.client.exceptions import ApiException
        
        if not isinstance(e, ApiException):
            return None
        
        status = e.status
        reason = e.reason
        body = e.body
        
        # Parse error details from response body
        details = str(e)
        try:
            import json
            if body:
                body_dict = json.loads(body)
                if 'message' in body_dict:
                    details = body_dict['message']
        except:
            pass
        
        # Map status codes to specific error types
        if status == 401:
            return K8sAuthenticationError(details=details)
        elif status == 403:
            return K8sPermissionError(details=details)
        elif status == 404:
            return K8sResourceNotFoundError(details=details)
        elif status == 409:
            return K8sConflictError(details=details)
        elif status == 504:
            return K8sTimeoutError(details=details)
        else:
            return K8sError(
                message='Kubernetes API调用失败',
                error_code='K8S_API_ERROR',
                details=details,
                status_code=status
            )
    
    except ImportError:
        return None


def handle_k8s_errors(func):
    """
    Decorator for handling Kubernetes API errors uniformly
    
    Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
    
    Catches common K8S exceptions and returns standardized error responses
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        
        except K8sError as e:
            # Already a K8sError, just log and return
            logger.error(f"K8S error in {func.__name__}: {e.message} - {e.details}")
            return jsonify(e.to_dict()), e.status_code
        
        except Exception as e:
            # Try to convert Kubernetes API exceptions
            try:
                from kubernetes.client.exceptions import ApiException
                if isinstance(e, ApiException):
                    k8s_error = convert_k8s_api_exception(e)
                    if k8s_error:
                        logger.error(f"K8S API error in {func.__name__}: {k8s_error.message} - {k8s_error.details}")
                        return jsonify(k8s_error.to_dict()), k8s_error.status_code
            except ImportError:
                pass
            
            # Handle connection errors
            if isinstance(e, (ConnectionError, socket.error, socket.timeout)):
                error = K8sConnectionError(details=str(e))
                logger.error(f"Connection error in {func.__name__}: {error.details}")
                return jsonify(error.to_dict()), error.status_code
            
            # Handle timeout errors
            if isinstance(e, TimeoutError):
                error = K8sTimeoutError(details=str(e))
                logger.error(f"Timeout error in {func.__name__}: {error.details}")
                return jsonify(error.to_dict()), error.status_code
            
            # Handle requests library errors
            try:
                if isinstance(e, requests.exceptions.ConnectionError):
                    error = K8sConnectionError(details=str(e))
                    logger.error(f"Connection error in {func.__name__}: {error.details}")
                    return jsonify(error.to_dict()), error.status_code
                elif isinstance(e, requests.exceptions.Timeout):
                    error = K8sTimeoutError(details=str(e))
                    logger.error(f"Timeout error in {func.__name__}: {error.details}")
                    return jsonify(error.to_dict()), error.status_code
            except:
                pass
            
            # Handle validation errors
            if isinstance(e, ValueError):
                error = K8sValidationError(message=str(e), details=str(e))
                logger.warning(f"Validation error in {func.__name__}: {error.details}")
                return jsonify(error.to_dict()), error.status_code
            
            # Handle generic errors
            logger.error(f"Unexpected error in {func.__name__}: {e}", exc_info=True)
            error = K8sError(
                message='服务器内部错误',
                error_code='INTERNAL_ERROR',
                details=str(e),
                suggestions=['请联系系统管理员', '查看日志获取详细信息'],
                status_code=500
            )
            return jsonify(error.to_dict()), error.status_code
    
    return wrapper


def k8s_tenant_required(func):
    """
    K8S tenant validation decorator
    Validates tenant access for K8S operations
    
    Requirements: 9.1 - Tenant validation for K8S operations
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        # Import here to avoid circular dependencies
        from app.core.middleware import tenant_required
        
        # Apply tenant_required decorator
        decorated = tenant_required(func)
        result = decorated(*args, **kwargs)
        
        # Additional K8S-specific tenant validation can be added here
        # For now, we rely on the base tenant_required decorator
        
        return result
    
    return wrapper


def k8s_role_required(*roles):
    """
    K8S role validation decorator
    Validates user roles for K8S operations
    
    Supported roles:
    - 普通用户: Read-only access (Requirements 9.2)
    - 运维管理员: Read-write access (Requirements 9.3)
    - 超级管理员: Full access including cluster management (Requirements 9.4)
    
    Args:
        *roles: Variable number of role names that are allowed
    
    Usage:
        @k8s_role_required('超级管理员', '运维管理员')
        def some_write_operation():
            pass
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Import here to avoid circular dependencies
            from app.core.middleware import role_required
            
            # Apply role_required decorator with specified roles
            decorated = role_required(*roles)(func)
            result = decorated(*args, **kwargs)
            
            return result
        
        return wrapper
    return decorator


def k8s_read_only(func):
    """
    K8S read-only access decorator
    Allows all authenticated users to read K8S resources
    
    Requirements: 9.2 - Regular users have read-only access
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        # Import here to avoid circular dependencies
        from app.core.middleware import tenant_required
        
        # Only require tenant validation for read operations
        decorated = tenant_required(func)
        result = decorated(*args, **kwargs)
        
        return result
    
    return wrapper


def k8s_write_required(func):
    """
    K8S write access decorator
    Requires ops admin or super admin role for write operations
    
    Requirements: 9.3, 9.4 - Write operations require admin roles
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        # Import here to avoid circular dependencies
        from app.core.middleware import role_required
        
        # Require ops admin or super admin role
        decorated = role_required('超级管理员', '运维管理员')(func)
        result = decorated(*args, **kwargs)
        
        return result
    
    return wrapper


def k8s_cluster_admin_required(func):
    """
    K8S cluster admin decorator
    Requires super admin role for cluster management operations
    
    Requirements: 9.4 - Only super admins can manage clusters
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        # Import here to avoid circular dependencies
        from app.core.middleware import role_required
        
        # Require super admin role for cluster management
        decorated = role_required('超级管理员')(func)
        result = decorated(*args, **kwargs)
        
        return result
    
    return wrapper


def validate_k8s_permissions(operation_type='read'):
    """
    Validate K8S permissions based on operation type
    
    Args:
        operation_type: Type of operation ('read', 'write', 'cluster_admin')
    
    Returns:
        bool: True if user has permission, False otherwise
    """
    if not hasattr(g, 'user_roles'):
        return False
    
    user_roles = g.user_roles
    
    # Super admin has all permissions
    if '超级管理员' in user_roles:
        return True
    
    # Ops admin has read and write permissions
    if operation_type in ['read', 'write'] and '运维管理员' in user_roles:
        return True
    
    # Regular users only have read permissions
    if operation_type == 'read':
        return True
    
    return False




def log_k8s_operation(cluster_id, operation_type, resource_type, resource_name=None, 
                      namespace=None, operation_data=None, status='success', error_message=None):
    """
    Log K8S operation to audit log
    
    Requirements: 9.5 - Record all K8S operations in audit log
    
    Args:
        cluster_id: ID of the K8S cluster
        operation_type: Type of operation (create, update, delete, scale, restart, etc.)
        resource_type: Type of K8S resource (deployment, service, configmap, etc.)
        resource_name: Name of the resource (optional)
        namespace: Kubernetes namespace (optional)
        operation_data: Additional operation data as dict (optional)
        status: Operation status ('success' or 'failed')
        error_message: Error message if operation failed (optional)
    
    Returns:
        K8sOperation: The created audit log entry
    """
    try:
        from app.models.k8s_operation import K8sOperation
        from app.extensions import db
        
        # Get user and tenant from context
        tenant_id = g.tenant_id if hasattr(g, 'tenant_id') else None
        user_id = g.user_id if hasattr(g, 'user_id') else None
        
        if not tenant_id or not user_id:
            logger.warning("Cannot log K8S operation: tenant_id or user_id not found in context")
            return None
        
        # Create audit log entry
        operation = K8sOperation(
            tenant_id=tenant_id,
            user_id=user_id,
            cluster_id=cluster_id,
            operation_type=operation_type,
            resource_type=resource_type,
            resource_name=resource_name,
            namespace=namespace,
            operation_data=operation_data,
            status=status,
            error_message=error_message
        )
        
        db.session.add(operation)
        db.session.commit()
        
        logger.info(f"K8S operation logged: {operation_type} {resource_type}/{resource_name} - {status}")
        
        return operation
        
    except Exception as e:
        logger.error(f"Failed to log K8S operation: {e}", exc_info=True)
        # Don't fail the main operation if logging fails
        try:
            db.session.rollback()
        except:
            pass
        return None


def k8s_audit_log(operation_type, resource_type):
    """
    Decorator for automatic K8S operation audit logging
    
    Requirements: 9.5 - Automatically log all write operations
    
    Args:
        operation_type: Type of operation (create, update, delete, scale, restart)
        resource_type: Type of K8S resource (deployment, service, configmap, etc.)
    
    Usage:
        @k8s_audit_log('create', 'deployment')
        def create_deployment(cluster_id, namespace, data):
            pass
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cluster_id = None
            namespace = None
            resource_name = None
            operation_data = None
            
            # Try to extract common parameters from kwargs
            if 'cluster_id' in kwargs:
                cluster_id = kwargs['cluster_id']
            elif len(args) > 0:
                cluster_id = args[0]
            
            if 'namespace' in kwargs:
                namespace = kwargs['namespace']
            
            if 'name' in kwargs:
                resource_name = kwargs['name']
            elif 'resource_name' in kwargs:
                resource_name = kwargs['resource_name']
            
            # Try to get operation data from request body
            try:
                from flask import request
                if request.is_json:
                    operation_data = request.get_json()
            except:
                pass
            
            # Execute the function
            try:
                result = func(*args, **kwargs)
                
                # Log successful operation
                log_k8s_operation(
                    cluster_id=cluster_id,
                    operation_type=operation_type,
                    resource_type=resource_type,
                    resource_name=resource_name,
                    namespace=namespace,
                    operation_data=operation_data,
                    status='success'
                )
                
                return result
                
            except Exception as e:
                # Log failed operation
                log_k8s_operation(
                    cluster_id=cluster_id,
                    operation_type=operation_type,
                    resource_type=resource_type,
                    resource_name=resource_name,
                    namespace=namespace,
                    operation_data=operation_data,
                    status='failed',
                    error_message=str(e)
                )
                
                # Re-raise the exception
                raise
        
        return wrapper
    return decorator


def get_k8s_operation_logs(cluster_id=None, user_id=None, operation_type=None, 
                           resource_type=None, status=None, page=1, per_page=20):
    """
    Query K8S operation audit logs
    
    Args:
        cluster_id: Filter by cluster ID (optional)
        user_id: Filter by user ID (optional)
        operation_type: Filter by operation type (optional)
        resource_type: Filter by resource type (optional)
        status: Filter by status (optional)
        page: Page number for pagination
        per_page: Number of records per page
    
    Returns:
        dict: Paginated audit log results
    """
    try:
        from app.models.k8s_operation import K8sOperation
        
        # Build query with tenant isolation
        query = K8sOperation.query.filter_by(tenant_id=g.tenant_id)
        
        # Apply filters
        if cluster_id:
            query = query.filter_by(cluster_id=cluster_id)
        if user_id:
            query = query.filter_by(user_id=user_id)
        if operation_type:
            query = query.filter_by(operation_type=operation_type)
        if resource_type:
            query = query.filter_by(resource_type=resource_type)
        if status:
            query = query.filter_by(status=status)
        
        # Paginate
        pagination = query.order_by(K8sOperation.created_at.desc()).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        return {
            'logs': [log.to_dict() for log in pagination.items],
            'pagination': {
                'page': pagination.page,
                'per_page': pagination.per_page,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_prev': pagination.has_prev,
                'has_next': pagination.has_next
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to query K8S operation logs: {e}", exc_info=True)
        return {
            'logs': [],
            'pagination': {
                'page': 1,
                'per_page': per_page,
                'total': 0,
                'pages': 0,
                'has_prev': False,
                'has_next': False
            }
        }
