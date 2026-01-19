"""
K8S Config Management API
Provides endpoints for managing Kubernetes ConfigMaps and Secrets
"""
import logging
from flask import Blueprint, request, jsonify, g
from app.core.middleware import tenant_required, role_required
from app.services.k8s.config_service import config_service
from app.utils.k8s_utils import handle_k8s_errors

logger = logging.getLogger(__name__)
configs_bp = Blueprint('k8s_configs', __name__)


@configs_bp.route('/configmaps', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_configmaps():
    """
    获取ConfigMap列表
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - page: 页码 (默认: 1)
        - per_page: 每页数量 (默认: 20, 最大: 100)
    
    Returns:
        JSON response with ConfigMap list and pagination info
    """
    try:
        cluster_id = request.args.get('cluster_id', type=int)
        namespace = request.args.get('namespace')
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
        
        # 获取ConfigMap列表
        configmaps = config_service.list_configmaps(cluster_id, namespace)
        
        # 计算分页
        total = len(configmaps)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_configmaps = configmaps[start:end]
        
        # 计算总页数
        pages = (total + per_page - 1) // per_page if per_page > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'configmaps': paginated_configmaps,
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
        logger.warning(f"Get configmaps validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get configmaps error: {e}")
        return jsonify({
            'success': False,
            'message': '获取ConfigMap列表失败',
            'error': str(e)
        }), 500


@configs_bp.route('/secrets', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_secrets():
    """
    获取Secret列表（敏感数据脱敏）
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - page: 页码 (默认: 1)
        - per_page: 每页数量 (默认: 20, 最大: 100)
    
    Returns:
        JSON response with Secret list and pagination info
    """
    try:
        cluster_id = request.args.get('cluster_id', type=int)
        namespace = request.args.get('namespace')
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
        
        # 获取Secret列表
        secrets = config_service.list_secrets(cluster_id, namespace)
        
        # 计算分页
        total = len(secrets)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_secrets = secrets[start:end]
        
        # 计算总页数
        pages = (total + per_page - 1) // per_page if per_page > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'secrets': paginated_secrets,
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
        logger.warning(f"Get secrets validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get secrets error: {e}")
        return jsonify({
            'success': False,
            'message': '获取Secret列表失败',
            'error': str(e)
        }), 500


@configs_bp.route('/configmaps/<name>', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_configmap_detail(name):
    """
    获取ConfigMap详情
    
    Path Parameters:
        - name: ConfigMap名称
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
    
    Returns:
        JSON response with ConfigMap detail
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
                'message': '命名空间不能为空'
            }), 400
        
        # 获取ConfigMap详情
        configmap = config_service.get_configmap_detail(cluster_id, namespace, name)
        
        return jsonify({
            'success': True,
            'data': {
                'configmap': configmap
            }
        })
        
    except ValueError as e:
        logger.warning(f"Get configmap detail validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get configmap detail error: {e}")
        return jsonify({
            'success': False,
            'message': '获取ConfigMap详情失败',
            'error': str(e)
        }), 500


@configs_bp.route('/secrets/<name>', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_secret_detail(name):
    """
    获取Secret详情（敏感数据脱敏）
    
    Path Parameters:
        - name: Secret名称
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
    
    Returns:
        JSON response with Secret detail
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
                'message': '命名空间不能为空'
            }), 400
        
        # 获取Secret详情
        secret = config_service.get_secret_detail(cluster_id, namespace, name)
        
        return jsonify({
            'success': True,
            'data': {
                'secret': secret
            }
        })
        
    except ValueError as e:
        logger.warning(f"Get secret detail validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get secret detail error: {e}")
        return jsonify({
            'success': False,
            'message': '获取Secret详情失败',
            'error': str(e)
        }), 500


@configs_bp.route('/configmaps', methods=['POST'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def create_configmap():
    """
    创建ConfigMap
    
    Request Body:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - name: ConfigMap名称 (必需)
        - data: 配置数据（键值对） (必需)
    
    Returns:
        JSON response with created ConfigMap info
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
        name = data.get('name')
        config_data = data.get('data')
        
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
        
        if not name:
            return jsonify({
                'success': False,
                'message': 'ConfigMap名称不能为空'
            }), 400
        
        if not config_data:
            return jsonify({
                'success': False,
                'message': '配置数据不能为空'
            }), 400
        
        # 创建ConfigMap
        result = config_service.create_configmap(
            cluster_id, namespace, name, config_data
        )
        
        return jsonify({
            'success': True,
            'message': 'ConfigMap创建成功',
            'data': result
        })
        
    except ValueError as e:
        logger.warning(f"Create configmap validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Create configmap error: {e}")
        return jsonify({
            'success': False,
            'message': '创建ConfigMap失败',
            'error': str(e)
        }), 500


@configs_bp.route('/secrets', methods=['POST'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def create_secret():
    """
    创建Secret
    
    Request Body:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - name: Secret名称 (必需)
        - data: 配置数据（键值对） (必需)
        - type: Secret类型 (可选，默认: Opaque)
    
    Returns:
        JSON response with created Secret info
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
        name = data.get('name')
        secret_data = data.get('data')
        secret_type = data.get('type', 'Opaque')
        
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
        
        if not name:
            return jsonify({
                'success': False,
                'message': 'Secret名称不能为空'
            }), 400
        
        if not secret_data:
            return jsonify({
                'success': False,
                'message': '配置数据不能为空'
            }), 400
        
        # 创建Secret
        result = config_service.create_secret(
            cluster_id, namespace, name, secret_data, secret_type
        )
        
        return jsonify({
            'success': True,
            'message': 'Secret创建成功',
            'data': result
        })
        
    except ValueError as e:
        logger.warning(f"Create secret validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Create secret error: {e}")
        return jsonify({
            'success': False,
            'message': '创建Secret失败',
            'error': str(e)
        }), 500


@configs_bp.route('/configmaps/delete', methods=['POST'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def delete_configmap():
    """
    删除ConfigMap
    
    Request Body:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - name: ConfigMap名称 (必需)
    
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
        name = data.get('name')
        
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
        
        if not name:
            return jsonify({
                'success': False,
                'message': 'ConfigMap名称不能为空'
            }), 400
        
        # 检查是否有工作负载正在使用
        using_workloads = config_service.check_config_usage(
            cluster_id, namespace, 'configmap', name
        )
        
        if using_workloads:
            workload_names = [f"{w['type']}/{w['name']}" for w in using_workloads]
            return jsonify({
                'success': False,
                'message': f'ConfigMap正在被以下工作负载使用，无法删除',
                'using_workloads': using_workloads,
                'workload_names': workload_names
            }), 400
        
        # 删除ConfigMap
        from app.services.k8s.client_service import K8sClientService
        from app.models.k8s_cluster import K8sCluster
        from kubernetes import client
        from flask import g
        
        tenant_id = getattr(g, 'tenant_id', None)
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            return jsonify({
                'success': False,
                'message': f'集群 {cluster_id} 不存在'
            }), 404
        
        client_service = K8sClientService()
        api_client = client_service.get_client(cluster)
        core_v1 = client.CoreV1Api(api_client)
        
        core_v1.delete_namespaced_config_map(name=name, namespace=namespace)
        
        # 记录操作日志
        from app.models.k8s_operation import K8sOperation
        from app.extensions import db
        
        user_id = getattr(g, 'user_id', None)
        if tenant_id and user_id:
            operation = K8sOperation()
            operation.tenant_id = tenant_id
            operation.user_id = user_id
            operation.cluster_id = cluster_id
            operation.operation_type = 'delete'
            operation.resource_type = 'configmap'
            operation.resource_name = name
            operation.namespace = namespace
            operation.status = 'success'
            db.session.add(operation)
            db.session.commit()
        
        logger.info(f"Deleted configmap '{name}' from namespace '{namespace}'")
        
        return jsonify({
            'success': True,
            'message': 'ConfigMap删除成功'
        })
        
    except ValueError as e:
        logger.warning(f"Delete configmap validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Delete configmap error: {e}")
        return jsonify({
            'success': False,
            'message': '删除ConfigMap失败',
            'error': str(e)
        }), 500


@configs_bp.route('/secrets/delete', methods=['POST'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def delete_secret():
    """
    删除Secret
    
    Request Body:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - name: Secret名称 (必需)
    
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
        name = data.get('name')
        
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
        
        if not name:
            return jsonify({
                'success': False,
                'message': 'Secret名称不能为空'
            }), 400
        
        # 检查是否有工作负载正在使用
        using_workloads = config_service.check_config_usage(
            cluster_id, namespace, 'secret', name
        )
        
        if using_workloads:
            workload_names = [f"{w['type']}/{w['name']}" for w in using_workloads]
            return jsonify({
                'success': False,
                'message': f'Secret正在被以下工作负载使用，无法删除',
                'using_workloads': using_workloads,
                'workload_names': workload_names
            }), 400
        
        # 删除Secret
        from app.services.k8s.client_service import K8sClientService
        from app.models.k8s_cluster import K8sCluster
        from kubernetes import client
        from flask import g
        
        tenant_id = getattr(g, 'tenant_id', None)
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            return jsonify({
                'success': False,
                'message': f'集群 {cluster_id} 不存在'
            }), 404
        
        client_service = K8sClientService()
        api_client = client_service.get_client(cluster)
        core_v1 = client.CoreV1Api(api_client)
        
        core_v1.delete_namespaced_secret(name=name, namespace=namespace)
        
        # 记录操作日志
        from app.models.k8s_operation import K8sOperation
        from app.extensions import db
        
        user_id = getattr(g, 'user_id', None)
        if tenant_id and user_id:
            operation = K8sOperation()
            operation.tenant_id = tenant_id
            operation.user_id = user_id
            operation.cluster_id = cluster_id
            operation.operation_type = 'delete'
            operation.resource_type = 'secret'
            operation.resource_name = name
            operation.namespace = namespace
            operation.status = 'success'
            db.session.add(operation)
            db.session.commit()
        
        logger.info(f"Deleted secret '{name}' from namespace '{namespace}'")
        
        return jsonify({
            'success': True,
            'message': 'Secret删除成功'
        })
        
    except ValueError as e:
        logger.warning(f"Delete secret validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Delete secret error: {e}")
        return jsonify({
            'success': False,
            'message': '删除Secret失败',
            'error': str(e)
        }), 500


@configs_bp.route('/configs', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_configs():
    """
    获取配置列表（ConfigMap和Secret）
    支持类型筛选
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - type: 配置类型 (可选: configmap/secret/all, 默认: all)
        - page: 页码 (默认: 1)
        - per_page: 每页数量 (默认: 20, 最大: 100)
    
    Returns:
        JSON response with config list and pagination info
    """
    try:
        cluster_id = request.args.get('cluster_id', type=int)
        namespace = request.args.get('namespace')
        config_type = request.args.get('type', 'all')
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
        
        # 获取配置列表
        configs = []
        
        if config_type in ['configmap', 'all']:
            configmaps = config_service.list_configmaps(cluster_id, namespace)
            for cm in configmaps:
                cm['config_type'] = 'configmap'
            configs.extend(configmaps)
        
        if config_type in ['secret', 'all']:
            secrets = config_service.list_secrets(cluster_id, namespace)
            for secret in secrets:
                secret['config_type'] = 'secret'
            configs.extend(secrets)
        
        # 计算分页
        total = len(configs)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_configs = configs[start:end]
        
        # 计算总页数
        pages = (total + per_page - 1) // per_page if per_page > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'configs': paginated_configs,
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
        logger.warning(f"Get configs validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get configs error: {e}")
        return jsonify({
            'success': False,
            'message': '获取配置列表失败',
            'error': str(e)
        }), 500
