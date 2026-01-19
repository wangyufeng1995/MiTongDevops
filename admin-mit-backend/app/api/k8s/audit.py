"""
K8S Audit Log API
Provides endpoints for querying Kubernetes operation audit logs
"""
import logging
from flask import Blueprint, request, jsonify, g
from app.core.middleware import tenant_required, role_required
from app.utils.k8s_utils import get_k8s_operation_logs, handle_k8s_errors

logger = logging.getLogger(__name__)
audit_bp = Blueprint('k8s_audit', __name__)


@audit_bp.route('/operations', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_operation_logs():
    """
    获取K8S操作审计日志
    
    Query Parameters:
        - cluster_id: 集群ID (可选)
        - user_id: 用户ID (可选)
        - operation_type: 操作类型 (可选)
        - resource_type: 资源类型 (可选)
        - status: 状态 (可选)
        - page: 页码 (默认: 1)
        - per_page: 每页数量 (默认: 20, 最大: 100)
    
    Returns:
        JSON response with audit logs and pagination info
    """
    try:
        # Get query parameters
        cluster_id = request.args.get('cluster_id', type=int)
        user_id = request.args.get('user_id', type=int)
        operation_type = request.args.get('operation_type')
        resource_type = request.args.get('resource_type')
        status = request.args.get('status')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Limit per_page
        per_page = min(per_page, 100)
        
        # Query audit logs
        result = get_k8s_operation_logs(
            cluster_id=cluster_id,
            user_id=user_id,
            operation_type=operation_type,
            resource_type=resource_type,
            status=status,
            page=page,
            per_page=per_page
        )
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except Exception as e:
        logger.error(f"Get operation logs error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'message': '获取审计日志失败',
            'error': str(e)
        }), 500


@audit_bp.route('/operations/stats', methods=['GET'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def get_operation_stats():
    """
    获取K8S操作统计信息
    
    Query Parameters:
        - cluster_id: 集群ID (可选)
        - days: 统计天数 (默认: 7)
    
    Returns:
        JSON response with operation statistics
    """
    try:
        from app.models.k8s_operation import K8sOperation
        from app.extensions import db
        from datetime import datetime, timedelta
        from sqlalchemy import func
        
        cluster_id = request.args.get('cluster_id', type=int)
        days = request.args.get('days', 7, type=int)
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Build base query
        query = K8sOperation.query.filter_by(tenant_id=g.tenant_id)
        query = query.filter(K8sOperation.created_at >= start_date)
        
        if cluster_id:
            query = query.filter_by(cluster_id=cluster_id)
        
        # Get total operations
        total_operations = query.count()
        
        # Get operations by type
        operations_by_type = db.session.query(
            K8sOperation.operation_type,
            func.count(K8sOperation.id).label('count')
        ).filter(
            K8sOperation.tenant_id == g.tenant_id,
            K8sOperation.created_at >= start_date
        )
        
        if cluster_id:
            operations_by_type = operations_by_type.filter(K8sOperation.cluster_id == cluster_id)
        
        operations_by_type = operations_by_type.group_by(K8sOperation.operation_type).all()
        
        # Get operations by resource type
        operations_by_resource = db.session.query(
            K8sOperation.resource_type,
            func.count(K8sOperation.id).label('count')
        ).filter(
            K8sOperation.tenant_id == g.tenant_id,
            K8sOperation.created_at >= start_date
        )
        
        if cluster_id:
            operations_by_resource = operations_by_resource.filter(K8sOperation.cluster_id == cluster_id)
        
        operations_by_resource = operations_by_resource.group_by(K8sOperation.resource_type).all()
        
        # Get success/failure counts
        success_count = query.filter_by(status='success').count()
        failed_count = query.filter_by(status='failed').count()
        
        # Get operations by user
        operations_by_user = db.session.query(
            K8sOperation.user_id,
            func.count(K8sOperation.id).label('count')
        ).filter(
            K8sOperation.tenant_id == g.tenant_id,
            K8sOperation.created_at >= start_date
        )
        
        if cluster_id:
            operations_by_user = operations_by_user.filter(K8sOperation.cluster_id == cluster_id)
        
        operations_by_user = operations_by_user.group_by(K8sOperation.user_id).all()
        
        return jsonify({
            'success': True,
            'data': {
                'total_operations': total_operations,
                'success_count': success_count,
                'failed_count': failed_count,
                'success_rate': round(success_count / total_operations * 100, 2) if total_operations > 0 else 0,
                'operations_by_type': [
                    {'type': op_type, 'count': count}
                    for op_type, count in operations_by_type
                ],
                'operations_by_resource': [
                    {'resource_type': res_type, 'count': count}
                    for res_type, count in operations_by_resource
                ],
                'operations_by_user': [
                    {'user_id': user_id, 'count': count}
                    for user_id, count in operations_by_user
                ],
                'date_range': {
                    'start': start_date.isoformat(),
                    'end': end_date.isoformat(),
                    'days': days
                }
            }
        })
        
    except Exception as e:
        logger.error(f"Get operation stats error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'message': '获取操作统计失败',
            'error': str(e)
        }), 500
