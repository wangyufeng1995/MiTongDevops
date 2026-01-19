"""
审计日志清理定时任务

Feature: webshell-command-audit
Requirements: 5.5

提供 WebShell 审计日志的自动清理功能，从系统设置的安全设置中读取保留天数配置。
"""
import logging
from datetime import datetime, timedelta
from celery import shared_task
from app.extensions import db
from app.models.webshell_audit import WebShellAuditLog
from app.models.system import SystemSetting
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)

# 默认审计日志保留天数
DEFAULT_AUDIT_LOG_RETENTION_DAYS = 90


def get_audit_log_retention_days(tenant_id: int) -> int:
    """
    从系统设置中获取审计日志保留天数
    
    Args:
        tenant_id: 租户ID
        
    Returns:
        保留天数，默认90天
    """
    try:
        # 查询系统设置中的审计日志保留天数
        setting = SystemSetting.query.filter(
            SystemSetting.tenant_id == tenant_id,
            SystemSetting.key == 'security.audit_log_retention_days',
            SystemSetting.is_enabled == True
        ).first()
        
        if setting and setting.value is not None:
            retention_days = int(setting.value)
            # 确保保留天数在合理范围内 (1-365天)
            return max(1, min(retention_days, 365))
        
        return DEFAULT_AUDIT_LOG_RETENTION_DAYS
        
    except Exception as e:
        logger.warning(f"Failed to get audit log retention days for tenant {tenant_id}: {e}")
        return DEFAULT_AUDIT_LOG_RETENTION_DAYS


@shared_task(bind=True, name='app.tasks.audit_cleanup_tasks.cleanup_audit_logs')
def cleanup_audit_logs(self, tenant_id: int = None, retention_days: int = None):
    """
    清理过期的审计日志
    
    如果指定了 tenant_id，只清理该租户的日志；
    如果未指定，清理所有租户的日志（每个租户使用各自的保留天数配置）。
    
    Args:
        tenant_id: 可选，指定租户ID
        retention_days: 可选，指定保留天数（覆盖系统设置）
        
    Returns:
        清理结果字典
    """
    from app import create_app
    app = create_app()
    
    with app.app_context():
        try:
            total_deleted = 0
            results = []
            
            if tenant_id:
                # 清理指定租户的日志
                days = retention_days if retention_days is not None else get_audit_log_retention_days(tenant_id)
                deleted = _cleanup_tenant_audit_logs(tenant_id, days)
                total_deleted = deleted
                results.append({
                    'tenant_id': tenant_id,
                    'retention_days': days,
                    'deleted_count': deleted
                })
                logger.info(f"Cleaned up {deleted} audit logs for tenant {tenant_id} (retention: {days} days)")
            else:
                # 清理所有租户的日志
                tenants = Tenant.query.filter(Tenant.status == 1).all()
                
                for tenant in tenants:
                    days = retention_days if retention_days is not None else get_audit_log_retention_days(tenant.id)
                    deleted = _cleanup_tenant_audit_logs(tenant.id, days)
                    total_deleted += deleted
                    results.append({
                        'tenant_id': tenant.id,
                        'tenant_name': tenant.name,
                        'retention_days': days,
                        'deleted_count': deleted
                    })
                    
                    if deleted > 0:
                        logger.info(f"Cleaned up {deleted} audit logs for tenant {tenant.name} (retention: {days} days)")
            
            logger.info(f"Audit log cleanup completed. Total deleted: {total_deleted}")
            
            return {
                'success': True,
                'total_deleted': total_deleted,
                'details': results,
                'executed_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Audit log cleanup failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'executed_at': datetime.utcnow().isoformat()
            }


def _cleanup_tenant_audit_logs(tenant_id: int, retention_days: int) -> int:
    """
    清理指定租户的过期审计日志
    
    Args:
        tenant_id: 租户ID
        retention_days: 保留天数
        
    Returns:
        删除的记录数
    """
    try:
        # 计算截止日期
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        
        # 查询并删除过期日志
        deleted_count = WebShellAuditLog.query.filter(
            WebShellAuditLog.tenant_id == tenant_id,
            WebShellAuditLog.executed_at < cutoff_date
        ).delete(synchronize_session=False)
        
        db.session.commit()
        
        return deleted_count
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to cleanup audit logs for tenant {tenant_id}: {e}")
        raise


@shared_task(bind=True, name='app.tasks.audit_cleanup_tasks.auto_cleanup_all_tenants')
def auto_cleanup_all_tenants(self):
    """
    自动清理所有租户的审计日志
    
    此任务由 Celery Beat 定时调度，每天执行一次。
    每个租户使用各自在系统设置中配置的保留天数。
    
    Requirements: 5.5
    """
    logger.info("Starting automatic audit log cleanup for all tenants")
    return cleanup_audit_logs.delay()


@shared_task(bind=True, name='app.tasks.audit_cleanup_tasks.get_cleanup_stats')
def get_cleanup_stats(self, tenant_id: int = None):
    """
    获取审计日志清理统计信息
    
    Args:
        tenant_id: 可选，指定租户ID
        
    Returns:
        统计信息字典
    """
    from app import create_app
    app = create_app()
    
    with app.app_context():
        try:
            stats = []
            
            if tenant_id:
                tenants = [Tenant.query.get(tenant_id)]
            else:
                tenants = Tenant.query.filter(Tenant.status == 1).all()
            
            for tenant in tenants:
                if not tenant:
                    continue
                    
                retention_days = get_audit_log_retention_days(tenant.id)
                cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
                
                # 统计总日志数
                total_logs = WebShellAuditLog.query.filter(
                    WebShellAuditLog.tenant_id == tenant.id
                ).count()
                
                # 统计将被清理的日志数
                logs_to_cleanup = WebShellAuditLog.query.filter(
                    WebShellAuditLog.tenant_id == tenant.id,
                    WebShellAuditLog.executed_at < cutoff_date
                ).count()
                
                # 获取最早和最新的日志时间
                oldest_log = WebShellAuditLog.query.filter(
                    WebShellAuditLog.tenant_id == tenant.id
                ).order_by(WebShellAuditLog.executed_at.asc()).first()
                
                newest_log = WebShellAuditLog.query.filter(
                    WebShellAuditLog.tenant_id == tenant.id
                ).order_by(WebShellAuditLog.executed_at.desc()).first()
                
                stats.append({
                    'tenant_id': tenant.id,
                    'tenant_name': tenant.name,
                    'retention_days': retention_days,
                    'total_logs': total_logs,
                    'logs_to_cleanup': logs_to_cleanup,
                    'oldest_log_date': oldest_log.executed_at.isoformat() if oldest_log else None,
                    'newest_log_date': newest_log.executed_at.isoformat() if newest_log else None,
                    'cutoff_date': cutoff_date.isoformat()
                })
            
            return {
                'success': True,
                'stats': stats,
                'queried_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get cleanup stats: {e}")
            return {
                'success': False,
                'error': str(e)
            }
