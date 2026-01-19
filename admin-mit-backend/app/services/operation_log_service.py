"""
操作日志服务
"""
from flask import g, request
from sqlalchemy import desc, and_, or_
from app.extensions import db
from app.models.operation_log import OperationLog
from app.models.user import User
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class OperationLogService:
    """操作日志服务类"""
    
    @staticmethod
    def log_operation(action, resource, resource_id=None, details=None, user_id=None, tenant_id=None):
        """
        记录操作日志
        
        Args:
            action: 操作类型 (create, update, delete, login, logout, view, etc.)
            resource: 资源类型 (user, role, menu, host, etc.)
            resource_id: 资源ID
            details: 操作详情
            user_id: 用户ID (如果不提供，从g中获取)
            tenant_id: 租户ID (如果不提供，从g中获取)
        """
        try:
            # 获取用户和租户信息
            if user_id is None:
                user_id = getattr(g, 'user_id', None)
            if tenant_id is None:
                tenant_id = getattr(g, 'tenant_id', None)
            
            # 如果没有用户信息，跳过记录
            if not user_id or not tenant_id:
                logger.debug(f"Skipping operation log - missing user_id: {user_id} or tenant_id: {tenant_id}")
                return None
            
            # 获取请求信息
            ip_address = request.remote_addr if request else None
            user_agent = request.headers.get('User-Agent') if request else None
            
            # 创建操作日志
            log = OperationLog.log_operation(
                tenant_id=tenant_id,
                user_id=user_id,
                action=action,
                resource=resource,
                resource_id=resource_id,
                details=details,
                ip_address=ip_address,
                user_agent=user_agent
            )
            
            db.session.commit()
            logger.info(f"Operation logged: {action} {resource} by user {user_id}")
            return log
            
        except Exception as e:
            logger.error(f"Failed to log operation: {e}")
            db.session.rollback()
            return None
    
    @staticmethod
    def get_logs(page=1, per_page=20, search=None, action=None, resource=None, 
                 user_id=None, start_date=None, end_date=None, tenant_id=None):
        """
        获取操作日志列表
        
        Args:
            page: 页码
            per_page: 每页数量
            search: 搜索关键词
            action: 操作类型过滤
            resource: 资源类型过滤
            user_id: 用户ID过滤
            start_date: 开始日期
            end_date: 结束日期
            tenant_id: 租户ID (如果不提供，从g中获取)
        
        Returns:
            分页的操作日志数据
        """
        try:
            # 获取租户信息
            if tenant_id is None:
                tenant_id = getattr(g, 'tenant_id', None)
            
            if not tenant_id:
                raise ValueError("租户ID不能为空")
            
            # 构建查询
            query = db.session.query(OperationLog).join(User).filter(
                OperationLog.tenant_id == tenant_id
            )
            
            # 应用过滤条件
            if search:
                search_filter = or_(
                    User.username.ilike(f'%{search}%'),
                    User.full_name.ilike(f'%{search}%'),
                    OperationLog.action.ilike(f'%{search}%'),
                    OperationLog.resource.ilike(f'%{search}%'),
                    OperationLog.ip_address.ilike(f'%{search}%')
                )
                query = query.filter(search_filter)
            
            if action:
                query = query.filter(OperationLog.action == action)
            
            if resource:
                query = query.filter(OperationLog.resource == resource)
            
            if user_id:
                query = query.filter(OperationLog.user_id == user_id)
            
            if start_date:
                if isinstance(start_date, str):
                    start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(OperationLog.created_at >= start_date)
            
            if end_date:
                if isinstance(end_date, str):
                    end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(OperationLog.created_at <= end_date)
            
            # 按创建时间倒序排列
            query = query.order_by(desc(OperationLog.created_at))
            
            # 分页
            pagination = query.paginate(
                page=page,
                per_page=per_page,
                error_out=False
            )
            
            # 转换为字典格式
            logs = []
            for log in pagination.items:
                log_dict = log.to_dict()
                logs.append(log_dict)
            
            return {
                'logs': logs,
                'total': pagination.total,
                'pages': pagination.pages,
                'current_page': page,
                'per_page': per_page,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev
            }
            
        except Exception as e:
            logger.error(f"Failed to get operation logs: {e}")
            raise
    
    @staticmethod
    def get_log_statistics(days=30, tenant_id=None):
        """
        获取操作日志统计信息
        
        Args:
            days: 统计天数
            tenant_id: 租户ID (如果不提供，从g中获取)
        
        Returns:
            统计信息字典
        """
        try:
            # 获取租户信息
            if tenant_id is None:
                tenant_id = getattr(g, 'tenant_id', None)
            
            if not tenant_id:
                raise ValueError("租户ID不能为空")
            
            # 总日志数
            total_logs = OperationLog.query.filter(
                OperationLog.tenant_id == tenant_id
            ).count()
            
            # 今日日志数
            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            today_logs = OperationLog.query.filter(
                and_(
                    OperationLog.tenant_id == tenant_id,
                    OperationLog.created_at >= today_start
                )
            ).count()
            
            # 错误日志数 (action 包含 error/fail/delete)
            error_logs = OperationLog.query.filter(
                and_(
                    OperationLog.tenant_id == tenant_id,
                    or_(
                        OperationLog.action.ilike('%error%'),
                        OperationLog.action.ilike('%fail%'),
                        OperationLog.action == 'delete'
                    )
                )
            ).count()
            
            # 成功率
            success_rate = 100.0
            if total_logs > 0:
                success_rate = ((total_logs - error_logs) / total_logs) * 100
            
            # 活跃用户 TOP 5
            user_stats = db.session.query(
                User.username,
                db.func.count(OperationLog.id).label('count')
            ).join(OperationLog).filter(
                OperationLog.tenant_id == tenant_id
            ).group_by(User.id, User.username)\
             .order_by(db.func.count(OperationLog.id).desc())\
             .limit(5).all()
            
            # 热门操作 TOP 5
            action_stats = db.session.query(
                OperationLog.action,
                db.func.count(OperationLog.id).label('count')
            ).filter(
                OperationLog.tenant_id == tenant_id
            ).group_by(OperationLog.action)\
             .order_by(db.func.count(OperationLog.id).desc())\
             .limit(5).all()
            
            return {
                'total_logs': total_logs,
                'today_logs': today_logs,
                'error_logs': error_logs,
                'success_rate': success_rate,
                'top_users': [
                    {'username': stat.username, 'count': stat.count}
                    for stat in user_stats
                ],
                'top_actions': [
                    {'action': stat.action, 'count': stat.count}
                    for stat in action_stats
                ]
            }
            
        except Exception as e:
            logger.error(f"Failed to get operation log statistics: {e}")
            raise
    
    @staticmethod
    def get_available_actions(tenant_id=None):
        """
        获取可用的操作类型列表
        
        Args:
            tenant_id: 租户ID (如果不提供，从g中获取)
        
        Returns:
            操作类型列表
        """
        try:
            # 获取租户信息
            if tenant_id is None:
                tenant_id = getattr(g, 'tenant_id', None)
            
            if not tenant_id:
                raise ValueError("租户ID不能为空")
            
            actions = db.session.query(OperationLog.action.distinct()).filter(
                OperationLog.tenant_id == tenant_id
            ).all()
            
            return [action[0] for action in actions if action[0]]
            
        except Exception as e:
            logger.error(f"Failed to get available actions: {e}")
            raise
    
    @staticmethod
    def get_available_resources(tenant_id=None):
        """
        获取可用的资源类型列表
        
        Args:
            tenant_id: 租户ID (如果不提供，从g中获取)
        
        Returns:
            资源类型列表
        """
        try:
            # 获取租户信息
            if tenant_id is None:
                tenant_id = getattr(g, 'tenant_id', None)
            
            if not tenant_id:
                raise ValueError("租户ID不能为空")
            
            resources = db.session.query(OperationLog.resource.distinct()).filter(
                OperationLog.tenant_id == tenant_id
            ).all()
            
            return [resource[0] for resource in resources if resource[0]]
            
        except Exception as e:
            logger.error(f"Failed to get available resources: {e}")
            raise

    @staticmethod
    def delete_log(log_id, tenant_id=None):
        """
        删除单条操作日志
        
        Args:
            log_id: 日志ID
            tenant_id: 租户ID (如果不提供，从g中获取)
        
        Returns:
            是否删除成功
        """
        try:
            if tenant_id is None:
                tenant_id = getattr(g, 'tenant_id', None)
            
            if not tenant_id:
                raise ValueError("租户ID不能为空")
            
            log = OperationLog.query.filter(
                OperationLog.id == log_id,
                OperationLog.tenant_id == tenant_id
            ).first()
            
            if not log:
                return False
            
            db.session.delete(log)
            db.session.commit()
            logger.info(f"Deleted operation log: {log_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete operation log {log_id}: {e}")
            db.session.rollback()
            raise

    @staticmethod
    def batch_delete_logs(log_ids, tenant_id=None):
        """
        批量删除操作日志
        
        Args:
            log_ids: 日志ID列表
            tenant_id: 租户ID (如果不提供，从g中获取)
        
        Returns:
            删除的数量
        """
        try:
            if tenant_id is None:
                tenant_id = getattr(g, 'tenant_id', None)
            
            if not tenant_id:
                raise ValueError("租户ID不能为空")
            
            deleted_count = OperationLog.query.filter(
                OperationLog.id.in_(log_ids),
                OperationLog.tenant_id == tenant_id
            ).delete(synchronize_session=False)
            
            db.session.commit()
            logger.info(f"Batch deleted {deleted_count} operation logs")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Failed to batch delete operation logs: {e}")
            db.session.rollback()
            raise

    @staticmethod
    def clear_logs(days=0, tenant_id=None):
        """
        清空操作日志
        
        Args:
            days: 保留最近多少天的日志 (0表示全部清空)
            tenant_id: 租户ID (如果不提供，从g中获取)
        
        Returns:
            删除的数量
        """
        try:
            if tenant_id is None:
                tenant_id = getattr(g, 'tenant_id', None)
            
            if not tenant_id:
                raise ValueError("租户ID不能为空")
            
            if days > 0:
                cutoff_date = datetime.utcnow() - timedelta(days=days)
                deleted_count = OperationLog.query.filter(
                    and_(
                        OperationLog.tenant_id == tenant_id,
                        OperationLog.created_at < cutoff_date
                    )
                ).delete(synchronize_session='fetch')
            else:
                deleted_count = OperationLog.query.filter(
                    OperationLog.tenant_id == tenant_id
                ).delete(synchronize_session='fetch')
            
            db.session.commit()
            logger.info(f"Cleared {deleted_count} operation logs (kept last {days} days)")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Failed to clear operation logs: {e}")
            db.session.rollback()
            raise


# 全局操作日志服务实例
operation_log_service = OperationLogService()