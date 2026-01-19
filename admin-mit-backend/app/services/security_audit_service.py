#!/usr/bin/env python3
"""
安全审计日志服务
记录系统中的安全相关操作
"""

import logging
from datetime import datetime
from typing import Dict, Any, Optional
from flask import request, g
from app.extensions import db
from app.models.operation_log import OperationLog
import json

logger = logging.getLogger(__name__)


class SecurityAuditService:
    """安全审计日志服务"""
    
    # 需要记录的操作类型
    AUDIT_OPERATIONS = {
        'login', 'logout', 'login_failed',
        'user_create', 'user_update', 'user_delete',
        'role_create', 'role_update', 'role_delete',
        'permission_change',
        'host_create', 'host_update', 'host_delete', 'host_connect',
        'playbook_execute',
        'alert_create', 'alert_update',
        'config_change',
        'security_violation'
    }
    
    # 需要脱敏的敏感字段
    SENSITIVE_FIELDS = {
        'password', 'private_key', 'secret_key', 'token',
        'api_key', 'access_token', 'refresh_token',
        'csrf_token', 'session_id'
    }
    
    def __init__(self):
        """初始化审计服务"""
        self.enabled = True  # 可以从配置文件读取
        self.mask_sensitive = True
    
    def log_audit(
        self,
        operation: str,
        resource: str,
        resource_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
        status: str = 'success',
        user_id: Optional[int] = None,
        tenant_id: Optional[int] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> bool:
        """
        记录审计日志
        
        Args:
            operation: 操作类型
            resource: 资源类型
            resource_id: 资源ID
            details: 操作详情
            status: 操作状态 (success, failed, denied)
            user_id: 用户ID
            tenant_id: 租户ID
            ip_address: IP地址
            user_agent: 用户代理
            
        Returns:
            bool: 是否记录成功
        """
        if not self.enabled:
            return True
        
        try:
            # 从请求上下文获取信息
            if user_id is None and hasattr(g, 'current_user_id'):
                user_id = g.current_user_id
            
            if tenant_id is None and hasattr(g, 'tenant_id'):
                tenant_id = g.tenant_id
            
            if ip_address is None:
                ip_address = self._get_client_ip()
            
            if user_agent is None and request:
                user_agent = request.headers.get('User-Agent', '')
            
            # 脱敏处理
            if details and self.mask_sensitive:
                details = self._mask_sensitive_data(details)
            
            # 创建审计日志记录
            audit_log = OperationLog(
                tenant_id=tenant_id,
                user_id=user_id,
                action=operation,
                resource=resource,
                resource_id=resource_id,
                details=details,
                ip_address=ip_address,
                user_agent=user_agent,
                status=status
            )
            
            db.session.add(audit_log)
            db.session.commit()
            
            # 同时记录到文件日志
            self._log_to_file(
                operation=operation,
                resource=resource,
                resource_id=resource_id,
                status=status,
                user_id=user_id,
                tenant_id=tenant_id,
                ip_address=ip_address
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to log audit: {e}")
            db.session.rollback()
            return False
    
    def log_login_attempt(
        self,
        username: str,
        success: bool,
        reason: Optional[str] = None,
        tenant_id: Optional[int] = None
    ) -> bool:
        """
        记录登录尝试
        
        Args:
            username: 用户名
            success: 是否成功
            reason: 失败原因
            tenant_id: 租户ID
            
        Returns:
            bool: 是否记录成功
        """
        operation = 'login' if success else 'login_failed'
        details = {
            'username': username,
            'success': success
        }
        
        if not success and reason:
            details['reason'] = reason
        
        return self.log_audit(
            operation=operation,
            resource='auth',
            details=details,
            status='success' if success else 'failed',
            tenant_id=tenant_id
        )
    
    def log_security_violation(
        self,
        violation_type: str,
        details: Dict[str, Any],
        severity: str = 'warning'
    ) -> bool:
        """
        记录安全违规
        
        Args:
            violation_type: 违规类型 (csrf, rate_limit, permission, etc.)
            details: 违规详情
            severity: 严重程度 (info, warning, critical)
            
        Returns:
            bool: 是否记录成功
        """
        details['violation_type'] = violation_type
        details['severity'] = severity
        
        return self.log_audit(
            operation='security_violation',
            resource='security',
            details=details,
            status='denied'
        )
    
    def log_permission_change(
        self,
        target_user_id: int,
        changes: Dict[str, Any],
        changed_by: Optional[int] = None
    ) -> bool:
        """
        记录权限变更
        
        Args:
            target_user_id: 目标用户ID
            changes: 变更内容
            changed_by: 操作者ID
            
        Returns:
            bool: 是否记录成功
        """
        return self.log_audit(
            operation='permission_change',
            resource='user',
            resource_id=target_user_id,
            details=changes,
            user_id=changed_by
        )
    
    def log_config_change(
        self,
        config_key: str,
        old_value: Any,
        new_value: Any,
        changed_by: Optional[int] = None
    ) -> bool:
        """
        记录配置变更
        
        Args:
            config_key: 配置键
            old_value: 旧值
            new_value: 新值
            changed_by: 操作者ID
            
        Returns:
            bool: 是否记录成功
        """
        # 脱敏配置值
        if self.mask_sensitive:
            old_value = self._mask_value_if_sensitive(config_key, old_value)
            new_value = self._mask_value_if_sensitive(config_key, new_value)
        
        details = {
            'config_key': config_key,
            'old_value': old_value,
            'new_value': new_value
        }
        
        return self.log_audit(
            operation='config_change',
            resource='config',
            details=details,
            user_id=changed_by
        )
    
    def _get_client_ip(self) -> str:
        """
        获取客户端IP地址
        
        Returns:
            str: IP地址
        """
        if not request:
            return '0.0.0.0'
        
        # 考虑代理情况
        if request.headers.get('X-Forwarded-For'):
            return request.headers.get('X-Forwarded-For').split(',')[0].strip()
        elif request.headers.get('X-Real-IP'):
            return request.headers.get('X-Real-IP')
        else:
            return request.remote_addr or '0.0.0.0'
    
    def _mask_sensitive_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        脱敏敏感数据
        
        Args:
            data: 原始数据
            
        Returns:
            Dict: 脱敏后的数据
        """
        if not isinstance(data, dict):
            return data
        
        masked_data = {}
        for key, value in data.items():
            if key.lower() in self.SENSITIVE_FIELDS:
                masked_data[key] = '***MASKED***'
            elif isinstance(value, dict):
                masked_data[key] = self._mask_sensitive_data(value)
            elif isinstance(value, list):
                masked_data[key] = [
                    self._mask_sensitive_data(item) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                masked_data[key] = value
        
        return masked_data
    
    def _mask_value_if_sensitive(self, key: str, value: Any) -> Any:
        """
        如果是敏感字段则脱敏
        
        Args:
            key: 字段名
            value: 字段值
            
        Returns:
            Any: 脱敏后的值
        """
        if key.lower() in self.SENSITIVE_FIELDS:
            return '***MASKED***'
        return value
    
    def _log_to_file(
        self,
        operation: str,
        resource: str,
        resource_id: Optional[int],
        status: str,
        user_id: Optional[int],
        tenant_id: Optional[int],
        ip_address: str
    ):
        """
        记录到文件日志
        
        Args:
            operation: 操作类型
            resource: 资源类型
            resource_id: 资源ID
            status: 状态
            user_id: 用户ID
            tenant_id: 租户ID
            ip_address: IP地址
        """
        try:
            audit_logger = logging.getLogger('audit')
            audit_logger.info(
                f"AUDIT: operation={operation} resource={resource} "
                f"resource_id={resource_id} status={status} "
                f"user_id={user_id} tenant_id={tenant_id} "
                f"ip={ip_address}"
            )
        except Exception as e:
            logger.error(f"Failed to log to file: {e}")
    
    def get_audit_logs(
        self,
        tenant_id: int,
        operation: Optional[str] = None,
        resource: Optional[str] = None,
        user_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        per_page: int = 50
    ) -> Dict[str, Any]:
        """
        查询审计日志
        
        Args:
            tenant_id: 租户ID
            operation: 操作类型
            resource: 资源类型
            user_id: 用户ID
            start_date: 开始日期
            end_date: 结束日期
            page: 页码
            per_page: 每页数量
            
        Returns:
            Dict: 审计日志列表和分页信息
        """
        try:
            query = OperationLog.query.filter_by(tenant_id=tenant_id)
            
            if operation:
                query = query.filter_by(action=operation)
            
            if resource:
                query = query.filter_by(resource=resource)
            
            if user_id:
                query = query.filter_by(user_id=user_id)
            
            if start_date:
                query = query.filter(OperationLog.created_at >= start_date)
            
            if end_date:
                query = query.filter(OperationLog.created_at <= end_date)
            
            # 按时间倒序
            query = query.order_by(OperationLog.created_at.desc())
            
            # 分页
            pagination = query.paginate(
                page=page,
                per_page=per_page,
                error_out=False
            )
            
            return {
                'logs': [log.to_dict() for log in pagination.items],
                'total': pagination.total,
                'page': page,
                'per_page': per_page,
                'pages': pagination.pages
            }
            
        except Exception as e:
            logger.error(f"Failed to get audit logs: {e}")
            return {
                'logs': [],
                'total': 0,
                'page': page,
                'per_page': per_page,
                'pages': 0
            }


# 创建全局审计服务实例
security_audit_service = SecurityAuditService()


def audit_log(operation: str, resource: str, **kwargs):
    """
    审计日志装饰器
    
    Args:
        operation: 操作类型
        resource: 资源类型
        **kwargs: 其他参数
    """
    def decorator(f):
        from functools import wraps
        
        @wraps(f)
        def decorated_function(*args, **func_kwargs):
            result = f(*args, **func_kwargs)
            
            # 记录审计日志
            try:
                resource_id = func_kwargs.get('id') or kwargs.get('resource_id')
                details = kwargs.get('details', {})
                
                security_audit_service.log_audit(
                    operation=operation,
                    resource=resource,
                    resource_id=resource_id,
                    details=details
                )
            except Exception as e:
                logger.error(f"Failed to log audit in decorator: {e}")
            
            return result
        
        return decorated_function
    return decorator
