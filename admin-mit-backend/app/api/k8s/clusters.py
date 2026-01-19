"""
K8S Cluster Management API
Provides endpoints for managing Kubernetes clusters
"""
import logging
from flask import Blueprint, request, jsonify, g
from app.core.middleware import tenant_required, role_required
from app.services.k8s.cluster_service import cluster_service
from app.services.k8s.client_service import k8s_client_service
from app.models.k8s_cluster import K8sCluster
from app.extensions import db
from app.utils.k8s_utils import log_k8s_operation, handle_k8s_errors

logger = logging.getLogger(__name__)
clusters_bp = Blueprint('k8s_clusters', __name__)


@clusters_bp.route('', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_clusters():
    """
    获取集群列表
    
    Query Parameters:
        - page: 页码 (默认: 1)
        - per_page: 每页数量 (默认: 10, 最大: 100)
        - search: 搜索关键词 (可选)
    
    Returns:
        JSON response with cluster list and pagination info
    """
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '')
        
        # 限制每页最大数量
        per_page = min(per_page, 100)
        
        # 构建查询
        query = K8sCluster.query.filter_by(tenant_id=g.tenant_id)
        
        # 搜索功能
        if search:
            search_pattern = f'%{search}%'
            query = query.filter(
                db.or_(
                    K8sCluster.name.ilike(search_pattern),
                    K8sCluster.api_server.ilike(search_pattern),
                    K8sCluster.description.ilike(search_pattern)
                )
            )
        
        # 分页
        pagination = query.order_by(K8sCluster.created_at.desc()).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        # 转换为字典列表
        clusters = [cluster.to_dict(include_sensitive=False) for cluster in pagination.items]
        
        return jsonify({
            'success': True,
            'data': {
                'clusters': clusters,
                'pagination': {
                    'page': pagination.page,
                    'per_page': pagination.per_page,
                    'total': pagination.total,
                    'pages': pagination.pages,
                    'has_prev': pagination.has_prev,
                    'has_next': pagination.has_next
                }
            }
        })
        
    except Exception as e:
        logger.error(f"Get clusters error: {e}")
        return jsonify({
            'success': False,
            'message': '获取集群列表失败',
            'error': str(e)
        }), 500


@clusters_bp.route('/detail', methods=['GET'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def get_cluster_detail():
    """
    获取集群详情（包含敏感信息，用于编辑）
    
    Query Parameters:
        - id: 集群ID (必需)
    
    Returns:
        JSON response with cluster details including sensitive data
    """
    try:
        cluster_id = request.args.get('id', type=int)
        
        if not cluster_id:
            return jsonify({
                'success': False,
                'message': '集群ID不能为空'
            }), 400
        
        # 获取集群
        cluster = K8sCluster.get_by_tenant(cluster_id, g.tenant_id)
        if not cluster:
            return jsonify({
                'success': False,
                'message': f'集群 {cluster_id} 不存在'
            }), 404
        
        # 返回包含敏感信息的集群数据
        return jsonify({
            'success': True,
            'data': cluster.to_dict(include_sensitive=True)
        })
        
    except Exception as e:
        logger.error(f"Get cluster detail error: {e}")
        return jsonify({
            'success': False,
            'message': '获取集群详情失败',
            'error': str(e)
        }), 500


@clusters_bp.route('', methods=['POST'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def create_cluster():
    """
    创建集群
    
    Request Body:
        - name: 集群名称 (必需)
        - api_server: API服务器地址 (必需)
        - auth_type: 认证类型 'token' 或 'kubeconfig' (必需)
        - token: Token (auth_type='token'时必需)
        - kubeconfig: Kubeconfig内容 (auth_type='kubeconfig'时必需)
        - description: 描述 (可选)
    
    Returns:
        JSON response with created cluster info
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        # 创建集群
        cluster = cluster_service.create_cluster(data)
        
        # 记录审计日志
        log_k8s_operation(
            cluster_id=cluster.id,
            operation_type='create',
            resource_type='cluster',
            resource_name=cluster.name,
            operation_data={'name': cluster.name, 'api_server': cluster.api_server},
            status='success'
        )
        
        return jsonify({
            'success': True,
            'message': '集群创建成功',
            'data': cluster.to_dict(include_sensitive=False)
        }), 201
        
    except ValueError as e:
        logger.warning(f"Create cluster validation error: {e}")
        # 记录失败的审计日志
        log_k8s_operation(
            cluster_id=None,
            operation_type='create',
            resource_type='cluster',
            resource_name=data.get('name') if data else None,
            operation_data=data,
            status='failed',
            error_message=str(e)
        )
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Create cluster error: {e}")
        # 记录失败的审计日志
        log_k8s_operation(
            cluster_id=None,
            operation_type='create',
            resource_type='cluster',
            resource_name=data.get('name') if data else None,
            operation_data=data,
            status='failed',
            error_message=str(e)
        )
        return jsonify({
            'success': False,
            'message': '创建集群失败',
            'error': str(e)
        }), 500


@clusters_bp.route('/update', methods=['POST'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def update_cluster():
    """
    更新集群
    
    Request Body:
        - id: 集群ID (必需)
        - name: 集群名称 (可选)
        - api_server: API服务器地址 (可选)
        - auth_type: 认证类型 (可选)
        - token: Token (可选)
        - kubeconfig: Kubeconfig内容 (可选)
        - description: 描述 (可选)
    
    Returns:
        JSON response with updated cluster info
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        cluster_id = data.get('id')
        if not cluster_id:
            return jsonify({
                'success': False,
                'message': '集群ID不能为空'
            }), 400
        
        # 更新集群
        cluster = cluster_service.update_cluster(cluster_id, data)
        
        # 记录审计日志
        log_k8s_operation(
            cluster_id=cluster.id,
            operation_type='update',
            resource_type='cluster',
            resource_name=cluster.name,
            operation_data=data,
            status='success'
        )
        
        return jsonify({
            'success': True,
            'message': '集群更新成功',
            'data': cluster.to_dict(include_sensitive=False)
        })
        
    except ValueError as e:
        logger.warning(f"Update cluster validation error: {e}")
        # 记录失败的审计日志
        log_k8s_operation(
            cluster_id=data.get('id') if data else None,
            operation_type='update',
            resource_type='cluster',
            operation_data=data,
            status='failed',
            error_message=str(e)
        )
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Update cluster error: {e}")
        # 记录失败的审计日志
        log_k8s_operation(
            cluster_id=data.get('id') if data else None,
            operation_type='update',
            resource_type='cluster',
            operation_data=data,
            status='failed',
            error_message=str(e)
        )
        return jsonify({
            'success': False,
            'message': '更新集群失败',
            'error': str(e)
        }), 500


@clusters_bp.route('/delete', methods=['POST'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def delete_cluster():
    """
    删除集群
    
    Request Body:
        - id: 集群ID (必需)
    
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
        
        cluster_id = data.get('id')
        if not cluster_id:
            return jsonify({
                'success': False,
                'message': '集群ID不能为空'
            }), 400
        
        # 获取集群信息用于日志记录
        cluster = K8sCluster.query.filter_by(id=cluster_id, tenant_id=g.tenant_id).first()
        cluster_name = cluster.name if cluster else None
        
        # 删除集群
        cluster_service.delete_cluster(cluster_id)
        
        # 记录审计日志
        log_k8s_operation(
            cluster_id=cluster_id,
            operation_type='delete',
            resource_type='cluster',
            resource_name=cluster_name,
            operation_data={'id': cluster_id},
            status='success'
        )
        
        return jsonify({
            'success': True,
            'message': '集群删除成功'
        })
        
    except ValueError as e:
        logger.warning(f"Delete cluster validation error: {e}")
        # 记录失败的审计日志
        log_k8s_operation(
            cluster_id=data.get('id') if data else None,
            operation_type='delete',
            resource_type='cluster',
            operation_data=data,
            status='failed',
            error_message=str(e)
        )
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Delete cluster error: {e}")
        # 记录失败的审计日志
        log_k8s_operation(
            cluster_id=data.get('id') if data else None,
            operation_type='delete',
            resource_type='cluster',
            operation_data=data,
            status='failed',
            error_message=str(e)
        )
        return jsonify({
            'success': False,
            'message': '删除集群失败',
            'error': str(e)
        }), 500


@clusters_bp.route('/test', methods=['POST'])
@tenant_required
@handle_k8s_errors
def test_connection():
    """
    测试集群连接
    
    Request Body (Option 1 - Test existing cluster):
        - id: 集群ID
    
    Request Body (Option 2 - Test new connection):
        - api_server: API服务器地址
        - auth_type: 认证类型 'token' 或 'kubeconfig'
        - token: Token (auth_type='token'时)
        - kubeconfig: Kubeconfig内容 (auth_type='kubeconfig'时)
    
    Returns:
        JSON response with connection test result
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        # 获取连接参数并自动剔除前后空格
        api_server = data.get('api_server', '').strip() if data.get('api_server') else None
        auth_type = data.get('auth_type', '').strip() if data.get('auth_type') else None
        token = data.get('token', '').strip() if data.get('token') else None
        kubeconfig = data.get('kubeconfig', '').strip() if data.get('kubeconfig') else None
        cluster_id = data.get('id')
        
        # 如果提供了新的连接参数，优先使用新参数测试
        if api_server and auth_type:
            # 准备认证凭据
            credentials = {}
            if auth_type == 'token':
                if token:
                    credentials['token'] = token
                elif cluster_id:
                    # 如果没有提供新token，尝试使用现有集群的token
                    cluster = K8sCluster.get_by_tenant(cluster_id, g.tenant_id)
                    if cluster and cluster.auth_type == 'token':
                        credentials['token'] = cluster.get_token()
                    else:
                        return jsonify({
                            'success': False,
                            'message': 'Token认证需要提供token'
                        }), 400
                else:
                    return jsonify({
                        'success': False,
                        'message': 'Token认证需要提供token'
                    }), 400
            elif auth_type == 'kubeconfig':
                if kubeconfig:
                    credentials['kubeconfig'] = kubeconfig
                elif cluster_id:
                    # 如果没有提供新kubeconfig，尝试使用现有集群的kubeconfig
                    cluster = K8sCluster.get_by_tenant(cluster_id, g.tenant_id)
                    if cluster and cluster.auth_type == 'kubeconfig':
                        credentials['kubeconfig'] = cluster.get_kubeconfig()
                    else:
                        return jsonify({
                            'success': False,
                            'message': 'Kubeconfig认证需要提供kubeconfig'
                        }), 400
                else:
                    return jsonify({
                        'success': False,
                        'message': 'Kubeconfig认证需要提供kubeconfig'
                    }), 400
            else:
                return jsonify({
                    'success': False,
                    'message': f'不支持的认证类型: {auth_type}'
                }), 400
            
            success, message = k8s_client_service.test_connection(
                api_server,
                auth_type,
                credentials
            )
        
        # 如果只提供了集群ID，使用现有集群配置测试
        elif cluster_id:
            cluster = K8sCluster.get_by_tenant(cluster_id, g.tenant_id)
            
            if not cluster:
                return jsonify({
                    'success': False,
                    'message': f'集群 {cluster_id} 不存在'
                }), 404
            
            # 准备认证凭据
            credentials = {}
            if cluster.auth_type == 'token':
                credentials['token'] = cluster.get_token()
            else:
                credentials['kubeconfig'] = cluster.get_kubeconfig()
            
            success, message = k8s_client_service.test_connection(
                cluster.api_server,
                cluster.auth_type,
                credentials
            )
        
        else:
            return jsonify({
                'success': False,
                'message': 'api_server和auth_type不能为空'
            }), 400
        
        if success:
            return jsonify({
                'success': True,
                'message': message
            })
        else:
            return jsonify({
                'success': False,
                'message': message
            }), 400
        
    except Exception as e:
        logger.error(f"Test connection error: {e}")
        return jsonify({
            'success': False,
            'message': '测试连接失败',
            'error': str(e)
        }), 500


@clusters_bp.route('/status', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_cluster_status():
    """
    获取集群状态
    
    Query Parameters:
        - id: 集群ID (必需)
    
    Returns:
        JSON response with cluster status and statistics
    """
    try:
        cluster_id = request.args.get('id', type=int)
        
        if not cluster_id:
            return jsonify({
                'success': False,
                'message': '集群ID不能为空'
            }), 400
        
        # 获取集群状态
        status_info = cluster_service.get_cluster_status(cluster_id)
        
        return jsonify({
            'success': True,
            'data': status_info
        })
        
    except ValueError as e:
        logger.warning(f"Get cluster status validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get cluster status error: {e}")
        return jsonify({
            'success': False,
            'message': '获取集群状态失败',
            'error': str(e)
        }), 500


@clusters_bp.route('/stats', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_cluster_stats():
    """
    获取集群统计信息（用于仪表盘）
    
    Returns:
        JSON response with cluster statistics:
        - healthy: 健康集群数量（在线）
        - warning: 警告集群数量（暂无此状态）
        - error: 异常集群数量（离线或错误）
        - total: 总集群数量
    """
    try:
        # 获取当前租户的所有集群
        clusters = K8sCluster.query.filter_by(tenant_id=g.tenant_id).all()
        
        stats = {
            'healthy': 0,
            'warning': 0,
            'error': 0,
            'total': len(clusters)
        }
        
        # 统计各状态的集群数量
        # status字段值: online, offline, error
        for cluster in clusters:
            if cluster.status == 'online':
                stats['healthy'] += 1
            elif cluster.status == 'offline':
                stats['warning'] += 1
            elif cluster.status == 'error':
                stats['error'] += 1
            else:
                # 如果status为空或其他值，默认归为警告
                stats['warning'] += 1
        
        return jsonify({
            'success': True,
            'data': stats
        })
        
    except Exception as e:
        logger.error(f"Get cluster stats error: {e}")
        return jsonify({
            'success': False,
            'message': '获取集群统计失败',
            'error': str(e)
        }), 500
