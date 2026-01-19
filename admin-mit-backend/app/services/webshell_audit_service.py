"""
WebShell 审计日志服务

提供命令执行日志的记录、查询和清理功能。
Feature: webshell-command-audit
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, List, Dict, Any
from flask import g, request
from sqlalchemy import desc, and_, or_
from app.extensions import db
from app.models.webshell_audit import WebShellAuditLog
import logging

logger = logging.getLogger(__name__)

# 输出截断最大长度
MAX_OUTPUT_LENGTH = 10000
TRUNCATION_MARKER = "\n...[truncated]"


class WebShellAuditService:
    """WebShell 审计日志服务类
    
    提供以下功能：
    - 记录命令执行日志 (log_command)
    - 查询审计日志 (query_logs)
    - 清理审计日志 (clear_logs)
    - 自动清理过期日志 (auto_cleanup)
    """
    
    @staticmethod
    def truncate_output(output: Optional[str]) -> Optional[str]:
        """
        截断输出到最大长度
        
        Args:
            output: 原始输出字符串
            
        Returns:
            截断后的输出字符串，如果超过最大长度则添加截断标记
        """
        if output is None:
            return None
        
        if len(output) <= MAX_OUTPUT_LENGTH:
            return output
        
        # 截断并添加标记
        truncate_at = MAX_OUTPUT_LENGTH - len(TRUNCATION_MARKER)
        return output[:truncate_at] + TRUNCATION_MARKER
    
    @staticmethod
    def log_command(
        user_id: int,
        host_id: int,
        command: str,
        status: str,
        tenant_id: Optional[int] = None,
        session_id: Optional[str] = None,
        output: Optional[str] = None,
        error: Optional[str] = None,
        block_reason: Optional[str] = None,
        ip_address: Optional[str] = None,
        execution_time: Optional[float] = None
    ) -> Optional[WebShellAuditLog]:
        """
        记录命令执行日志
        
        Args:
            user_id: 用户ID
            host_id: 主机ID
            command: 执行的命令
            status: 状态 ('success', 'blocked', 'failed')
            tenant_id: 租户ID (如果不提供，从g中获取)
            session_id: WebShell 会话ID
            output: 命令输出
            error: 错误信息
            block_reason: 阻止原因
            ip_address: 客户端IP地址
            execution_time: 执行时间（秒）
            
        Returns:
            创建的审计日志对象，失败返回None
        """
        try:
            # 获取租户ID
            if tenant_id is None:
                tenant_id = getattr(g, 'tenant_id', None)
            
            if tenant_id is None:
                logger.error("Cannot log command: tenant_id is required")
                return None
            
            # 获取IP地址
            if ip_address is None:
                ip_address = request.remote_addr if request else None
            
            # 截断输出
            output_summary = WebShellAuditService.truncate_output(output)
            
            # 创建审计日志
            audit_log = WebShellAuditLog(
                tenant_id=tenant_id,
                user_id=user_id,
                host_id=host_id,
                session_id=session_id,
                command=command,
                status=status,
                output_summary=output_summary,
                error_message=error,
                block_reason=block_reason,
                ip_address=ip_address,
                execution_time=execution_time,
                executed_at=datetime.now(timezone.utc)
            )
            
            db.session.add(audit_log)
            db.session.commit()
            
            logger.info(f"Audit log created: user={user_id}, host={host_id}, status={status}, command={command[:50]}...")
            return audit_log
            
        except Exception as e:
            logger.error(f"Failed to log command: {e}")
            db.session.rollback()
            return None

    @staticmethod
    def query_logs(
        host_id: int,
        tenant_id: Optional[int] = None,
        user_id: Optional[int] = None,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Tuple[List[WebShellAuditLog], int]:
        """
        查询审计日志
        
        Args:
            host_id: 主机ID
            tenant_id: 租户ID (如果不提供，从g中获取)
            user_id: 用户ID过滤
            status: 状态过滤 ('success', 'blocked', 'failed')
            start_date: 开始日期
            end_date: 结束日期
            page: 页码 (从1开始)
            page_size: 每页数量
            
        Returns:
            (日志列表, 总数量)
        """
        try:
            # 获取租户ID
            if tenant_id is None:
                tenant_id = getattr(g, 'tenant_id', None)
            
            if tenant_id is None:
                raise ValueError("租户ID不能为空")
            
            # 构建基础查询
            query = WebShellAuditLog.query.filter(
                and_(
                    WebShellAuditLog.tenant_id == tenant_id,
                    WebShellAuditLog.host_id == host_id
                )
            )
            
            # 应用过滤条件
            if user_id is not None:
                query = query.filter(WebShellAuditLog.user_id == user_id)
            
            if status is not None:
                query = query.filter(WebShellAuditLog.status == status)
            
            if start_date is not None:
                # 确保有时区信息
                if start_date.tzinfo is None:
                    start_date = start_date.replace(tzinfo=timezone.utc)
                query = query.filter(WebShellAuditLog.executed_at >= start_date)
            
            if end_date is not None:
                # 确保有时区信息
                if end_date.tzinfo is None:
                    end_date = end_date.replace(tzinfo=timezone.utc)
                query = query.filter(WebShellAuditLog.executed_at <= end_date)
            
            # 按执行时间倒序排列 (最新的在前)
            query = query.order_by(desc(WebShellAuditLog.executed_at))
            
            # 获取总数
            total = query.count()
            
            # 分页
            offset = (page - 1) * page_size
            logs = query.offset(offset).limit(page_size).all()
            
            return logs, total
            
        except Exception as e:
            logger.error(f"Failed to query audit logs: {e}")
            raise
    
    @staticmethod
    def clear_logs(
        host_id: int,
        days_to_keep: int = 0,
        tenant_id: Optional[int] = None,
        operator_user_id: Optional[int] = None
    ) -> int:
        """
        清理指定主机的审计日志
        
        Args:
            host_id: 主机ID
            days_to_keep: 保留最近N天的日志 (0表示清理所有)
            tenant_id: 租户ID (如果不提供，从g中获取)
            operator_user_id: 执行清理操作的用户ID
            
        Returns:
            删除的日志数量
        """
        try:
            # 获取租户ID
            if tenant_id is None:
                tenant_id = getattr(g, 'tenant_id', None)
            
            if tenant_id is None:
                raise ValueError("租户ID不能为空")
            
            # 获取操作用户ID
            if operator_user_id is None:
                operator_user_id = getattr(g, 'user_id', None)
            
            # 构建删除查询
            query = WebShellAuditLog.query.filter(
                and_(
                    WebShellAuditLog.tenant_id == tenant_id,
                    WebShellAuditLog.host_id == host_id
                )
            )
            
            # 如果指定保留天数，只删除更早的日志
            if days_to_keep > 0:
                cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_to_keep)
                query = query.filter(WebShellAuditLog.executed_at < cutoff_date)
            
            # 获取要删除的数量
            deleted_count = query.count()
            
            # 执行删除
            if deleted_count > 0:
                query.delete(synchronize_session=False)
                db.session.commit()
                
                logger.info(f"Cleared {deleted_count} audit logs for host {host_id}, kept last {days_to_keep} days")
                
                # 记录清理操作本身作为审计日志
                if operator_user_id:
                    WebShellAuditService.log_command(
                        user_id=operator_user_id,
                        host_id=host_id,
                        command=f"[SYSTEM] Clear audit logs (kept {days_to_keep} days)",
                        status='success',
                        tenant_id=tenant_id,
                        output=f"Deleted {deleted_count} log entries"
                    )
            
            return deleted_count
            
        except Exception as e:
            logger.error(f"Failed to clear audit logs: {e}")
            db.session.rollback()
            raise
    
    @staticmethod
    def auto_cleanup(retention_days: int = 90, tenant_id: Optional[int] = None) -> int:
        """
        自动清理过期日志
        
        Args:
            retention_days: 保留天数 (默认90天)
            tenant_id: 租户ID (如果不提供，清理所有租户)
            
        Returns:
            删除的日志总数
        """
        try:
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)
            
            # 构建删除查询
            query = WebShellAuditLog.query.filter(
                WebShellAuditLog.executed_at < cutoff_date
            )
            
            # 如果指定租户，只清理该租户的日志
            if tenant_id is not None:
                query = query.filter(WebShellAuditLog.tenant_id == tenant_id)
            
            # 获取要删除的数量
            deleted_count = query.count()
            
            # 执行删除
            if deleted_count > 0:
                query.delete(synchronize_session=False)
                db.session.commit()
                
                logger.info(f"Auto cleanup: deleted {deleted_count} audit logs older than {retention_days} days")
            
            return deleted_count
            
        except Exception as e:
            logger.error(f"Failed to auto cleanup audit logs: {e}")
            db.session.rollback()
            raise
    
    @staticmethod
    def get_stats(
        host_id: int,
        tenant_id: Optional[int] = None,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        获取审计日志统计信息
        
        Args:
            host_id: 主机ID
            tenant_id: 租户ID (如果不提供，从g中获取)
            days: 统计天数
            
        Returns:
            统计信息字典
        """
        try:
            # 获取租户ID
            if tenant_id is None:
                tenant_id = getattr(g, 'tenant_id', None)
            
            if tenant_id is None:
                raise ValueError("租户ID不能为空")
            
            # 计算开始日期
            start_date = datetime.now(timezone.utc) - timedelta(days=days)
            
            # 基础查询
            base_query = WebShellAuditLog.query.filter(
                and_(
                    WebShellAuditLog.tenant_id == tenant_id,
                    WebShellAuditLog.host_id == host_id,
                    WebShellAuditLog.executed_at >= start_date
                )
            )
            
            # 总命令数
            total_commands = base_query.count()
            
            # 按状态统计
            success_count = base_query.filter(WebShellAuditLog.status == 'success').count()
            blocked_count = base_query.filter(WebShellAuditLog.status == 'blocked').count()
            failed_count = base_query.filter(WebShellAuditLog.status == 'failed').count()
            
            # 按用户统计（前10名）
            from app.models.user import User
            user_stats = db.session.query(
                User.username,
                User.full_name,
                db.func.count(WebShellAuditLog.id).label('count')
            ).join(WebShellAuditLog).filter(
                and_(
                    WebShellAuditLog.tenant_id == tenant_id,
                    WebShellAuditLog.host_id == host_id,
                    WebShellAuditLog.executed_at >= start_date
                )
            ).group_by(User.id, User.username, User.full_name)\
             .order_by(db.func.count(WebShellAuditLog.id).desc())\
             .limit(10).all()
            
            return {
                'total_commands': total_commands,
                'success_count': success_count,
                'blocked_count': blocked_count,
                'failed_count': failed_count,
                'days': days,
                'start_date': start_date.isoformat(),
                'user_stats': [
                    {
                        'username': stat.username,
                        'full_name': stat.full_name,
                        'count': stat.count
                    } for stat in user_stats
                ]
            }
            
        except Exception as e:
            logger.error(f"Failed to get audit log stats: {e}")
            raise


# 全局审计日志服务实例
webshell_audit_service = WebShellAuditService()
