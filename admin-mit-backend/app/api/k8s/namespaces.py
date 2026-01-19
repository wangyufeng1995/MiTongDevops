"""
K8S Namespace Management API
Provides endpoints for managing Kubernetes namespaces
"""
import logging
from flask import Blueprint, request, jsonify, g
from app.core.middleware import tenant_required, role_required
from app.services.k8s.namespace_service import namespace_service
from app.utils.k8s_utils import handle_k8s_errors

logger = logging.getLogger(__name__)
namespaces_bp = Blueprint('k8s_namespaces', __name__)


@namespaces_bp.route('', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_namespaces():
    """
    获取命名空间列表
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - search: 搜索关键词 (可选)
        - page: 页码 (默认: 1)
        - per_page: 每页数量 (默认: 20, 最大: 100)
    
    Returns:
        JSON response with namespace list and pagination info
    """
    try:
        cluster_id = request.args.get('cluster_id', type=int)
        search = request.args.get('search', '')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        if not cluster_id:
            return jsonify({
                'success': False,
                'message': '集群ID不能为空'
            }), 400
        
        # 限制每页最大数量
        per_page = min(per_page, 100)
        
        # 获取命名空间列表
        namespaces = namespace_service.list_namespaces(cluster_id)
        
        # 搜索过滤
        if search:
            search_lower = search.lower()
            namespaces = [
                ns for ns in namespaces 
                if search_lower in ns['name'].lower()
            ]
        
        # 计算分页
        total = len(namespaces)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_namespaces = namespaces[start:end]
        
        # 计算总页数
        pages = (total + per_page - 1) // per_page if per_page > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'namespaces': paginated_namespaces,
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
        logger.warning(f"Get namespaces validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get namespaces error: {e}")
        return jsonify({
            'success': False,
            'message': '获取命名空间列表失败',
            'error': str(e)
        }), 500


@namespaces_bp.route('', methods=['POST'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def create_namespace():
    """
    创建命名空间
    
    Request Body:
        - cluster_id: 集群ID (必需)
        - name: 命名空间名称 (必需)
        - labels: 标签字典 (可选)
    
    Returns:
        JSON response with created namespace info
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        cluster_id = data.get('cluster_id')
        name = data.get('name')
        labels = data.get('labels', {})
        
        if not cluster_id:
            return jsonify({
                'success': False,
                'message': '集群ID不能为空'
            }), 400
        
        if not name:
            return jsonify({
                'success': False,
                'message': '命名空间名称不能为空'
            }), 400
        
        # 创建命名空间
        namespace = namespace_service.create_namespace(cluster_id, name, labels)
        
        return jsonify({
            'success': True,
            'message': '命名空间创建成功',
            'data': namespace
        }), 201
        
    except ValueError as e:
        logger.warning(f"Create namespace validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Create namespace error: {e}")
        return jsonify({
            'success': False,
            'message': '创建命名空间失败',
            'error': str(e)
        }), 500


@namespaces_bp.route('/delete', methods=['POST'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def delete_namespace():
    """
    删除命名空间
    
    Request Body:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间名称 (必需)
    
    Returns:
        JSON response with deletion result
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        cluster_id = data.get('cluster_id')
        namespace = data.get('namespace')
        
        if not cluster_id:
            return jsonify({
                'success': False,
                'message': '集群ID不能为空'
            }), 400
        
        if not namespace:
            return jsonify({
                'success': False,
                'message': '命名空间名称不能为空'
            }), 400
        
        # 删除命名空间
        namespace_service.delete_namespace(cluster_id, namespace)
        
        return jsonify({
            'success': True,
            'message': f'命名空间 {namespace} 删除成功'
        })
        
    except ValueError as e:
        logger.warning(f"Delete namespace validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Delete namespace error: {e}")
        return jsonify({
            'success': False,
            'message': '删除命名空间失败',
            'error': str(e)
        }), 500


@namespaces_bp.route('/quotas', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_namespace_quotas():
    """
    获取命名空间资源配额
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间名称 (必需)
    
    Returns:
        JSON response with namespace quota information
    """
    try:
        cluster_id = request.args.get('cluster_id', type=int)
        namespace = request.args.get('namespace')
        
        if not cluster_id:
            return jsonify({
                'success': False,
                'message': '集群ID不能为空'
            }), 400
        
        if not namespace:
            return jsonify({
                'success': False,
                'message': '命名空间名称不能为空'
            }), 400
        
        # 获取命名空间配额
        quotas = namespace_service.get_namespace_quotas(cluster_id, namespace)
        
        return jsonify({
            'success': True,
            'data': quotas
        })
        
    except ValueError as e:
        logger.warning(f"Get namespace quotas validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get namespace quotas error: {e}")
        return jsonify({
            'success': False,
            'message': '获取命名空间配额失败',
            'error': str(e)
        }), 500
