"""
K8S Storage Management API
Provides endpoints for managing Kubernetes storage resources (PV, PVC, StorageClass)
"""
import logging
from flask import Blueprint, request, jsonify
from app.core.middleware import tenant_required
from app.services.k8s.storage_service import storage_service
from app.utils.k8s_utils import handle_k8s_errors

logger = logging.getLogger(__name__)
storage_bp = Blueprint('k8s_storage', __name__)


@storage_bp.route('/persistent-volumes', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_persistent_volumes():
    """
    获取PersistentVolume列表
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - status: 状态筛选 (可选: Available/Bound/Released/Failed)
        - page: 页码 (默认: 1)
        - per_page: 每页数量 (默认: 20, 最大: 100)
    
    Returns:
        JSON response with PV list and pagination info
    """
    try:
        cluster_id = request.args.get('cluster_id', type=int)
        status_filter = request.args.get('status')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        if not cluster_id:
            return jsonify({
                'success': False,
                'message': '集群ID不能为空'
            }), 400
        
        # 限制每页最大数量
        per_page = min(per_page, 100)
        
        # 获取PV列表
        pvs = storage_service.list_persistent_volumes(cluster_id)
        
        # 状态筛选
        if status_filter:
            pvs = [pv for pv in pvs if pv.get('status') == status_filter]
        
        # 计算分页
        total = len(pvs)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_pvs = pvs[start:end]
        
        # 计算总页数
        pages = (total + per_page - 1) // per_page if per_page > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'persistent_volumes': paginated_pvs,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': total,
                    'pages': pages,
                    'has_prev': page > 1,
                    'has_next': page < pages
                }
            }
        })
        
    except ValueError as e:
        logger.warning(f"Get persistent volumes validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get persistent volumes error: {e}")
        return jsonify({
            'success': False,
            'message': '获取PV列表失败',
            'error': str(e)
        }), 500


@storage_bp.route('/persistent-volume-claims', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_persistent_volume_claims():
    """
    获取PersistentVolumeClaim列表
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - status: 状态筛选 (可选: Pending/Bound/Lost)
        - page: 页码 (默认: 1)
        - per_page: 每页数量 (默认: 20, 最大: 100)
    
    Returns:
        JSON response with PVC list and pagination info
    """
    try:
        cluster_id = request.args.get('cluster_id', type=int)
        namespace = request.args.get('namespace')
        status_filter = request.args.get('status')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        if not cluster_id:
            return jsonify({
                'success': False,
                'message': '集群ID不能为空'
            }), 400
        
        if not namespace:
            return jsonify({
                'success': False,
                'message': '命名空间不能为空'
            }), 400
        
        # 限制每页最大数量
        per_page = min(per_page, 100)
        
        # 获取PVC列表
        pvcs = storage_service.list_persistent_volume_claims(cluster_id, namespace)
        
        # 状态筛选
        if status_filter:
            pvcs = [pvc for pvc in pvcs if pvc.get('status') == status_filter]
        
        # 计算分页
        total = len(pvcs)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_pvcs = pvcs[start:end]
        
        # 计算总页数
        pages = (total + per_page - 1) // per_page if per_page > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'persistent_volume_claims': paginated_pvcs,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': total,
                    'pages': pages,
                    'has_prev': page > 1,
                    'has_next': page < pages
                }
            }
        })
        
    except ValueError as e:
        logger.warning(f"Get persistent volume claims validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get persistent volume claims error: {e}")
        return jsonify({
            'success': False,
            'message': '获取PVC列表失败',
            'error': str(e)
        }), 500


@storage_bp.route('/storage-classes', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_storage_classes():
    """
    获取StorageClass列表
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - page: 页码 (默认: 1)
        - per_page: 每页数量 (默认: 20, 最大: 100)
    
    Returns:
        JSON response with StorageClass list and pagination info
    """
    try:
        cluster_id = request.args.get('cluster_id', type=int)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        if not cluster_id:
            return jsonify({
                'success': False,
                'message': '集群ID不能为空'
            }), 400
        
        # 限制每页最大数量
        per_page = min(per_page, 100)
        
        # 获取StorageClass列表
        storage_classes = storage_service.list_storage_classes(cluster_id)
        
        # 计算分页
        total = len(storage_classes)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_scs = storage_classes[start:end]
        
        # 计算总页数
        pages = (total + per_page - 1) // per_page if per_page > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'storage_classes': paginated_scs,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': total,
                    'pages': pages,
                    'has_prev': page > 1,
                    'has_next': page < pages
                }
            }
        })
        
    except ValueError as e:
        logger.warning(f"Get storage classes validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get storage classes error: {e}")
        return jsonify({
            'success': False,
            'message': '获取StorageClass列表失败',
            'error': str(e)
        }), 500


@storage_bp.route('/storage', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_storage_resources():
    """
    获取所有存储资源（PV、PVC、StorageClass）
    支持类型筛选
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (PVC需要，可选)
        - type: 资源类型 (可选: pv/pvc/storageclass/all, 默认: all)
        - status: 状态筛选 (可选)
        - page: 页码 (默认: 1)
        - per_page: 每页数量 (默认: 20, 最大: 100)
    
    Returns:
        JSON response with storage resources and pagination info
    """
    try:
        cluster_id = request.args.get('cluster_id', type=int)
        namespace = request.args.get('namespace')
        resource_type = request.args.get('type', 'all')
        status_filter = request.args.get('status')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        if not cluster_id:
            return jsonify({
                'success': False,
                'message': '集群ID不能为空'
            }), 400
        
        # 限制每页最大数量
        per_page = min(per_page, 100)
        
        # 获取存储资源列表
        resources = []
        
        if resource_type in ['pv', 'all']:
            pvs = storage_service.list_persistent_volumes(cluster_id)
            for pv in pvs:
                pv['resource_type'] = 'pv'
            resources.extend(pvs)
        
        if resource_type in ['pvc', 'all']:
            if not namespace:
                return jsonify({
                    'success': False,
                    'message': '获取PVC需要指定命名空间'
                }), 400
            pvcs = storage_service.list_persistent_volume_claims(cluster_id, namespace)
            for pvc in pvcs:
                pvc['resource_type'] = 'pvc'
            resources.extend(pvcs)
        
        if resource_type in ['storageclass', 'all']:
            storage_classes = storage_service.list_storage_classes(cluster_id)
            for sc in storage_classes:
                sc['resource_type'] = 'storageclass'
            resources.extend(storage_classes)
        
        # 状态筛选
        if status_filter:
            resources = [r for r in resources if r.get('status') == status_filter]
        
        # 计算分页
        total = len(resources)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_resources = resources[start:end]
        
        # 计算总页数
        pages = (total + per_page - 1) // per_page if per_page > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'storage_resources': paginated_resources,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': total,
                    'pages': pages,
                    'has_prev': page > 1,
                    'has_next': page < pages
                }
            }
        })
        
    except ValueError as e:
        logger.warning(f"Get storage resources validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get storage resources error: {e}")
        return jsonify({
            'success': False,
            'message': '获取存储资源列表失败',
            'error': str(e)
        }), 500
