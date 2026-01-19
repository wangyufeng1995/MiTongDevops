"""
K8S Service Discovery API
Provides endpoints for managing Kubernetes Services and Ingresses
"""
import logging
from flask import Blueprint, request, jsonify
from app.core.middleware import tenant_required, role_required
from app.services.k8s.service_discovery_service import service_discovery_service
from app.utils.k8s_utils import handle_k8s_errors, log_k8s_operation

logger = logging.getLogger(__name__)
services_bp = Blueprint('k8s_services', __name__)


@services_bp.route('', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_services():
    """
    获取Service列表
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - type: 服务类型筛选 (可选: ClusterIP/NodePort/LoadBalancer/ExternalName)
        - page: 页码 (默认: 1)
        - per_page: 每页数量 (默认: 20, 最大: 100)
    
    Returns:
        JSON response with service list and pagination info
    """
    try:
        cluster_id = request.args.get('cluster_id', type=int)
        namespace = request.args.get('namespace')
        service_type = request.args.get('type')
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
        
        # 获取Service列表
        services = service_discovery_service.list_services(cluster_id, namespace)
        
        # 按类型筛选
        if service_type:
            services = [svc for svc in services if svc['type'] == service_type]
        
        # 计算分页
        total = len(services)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_services = services[start:end]
        
        # 计算总页数
        pages = (total + per_page - 1) // per_page if per_page > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'services': paginated_services,
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
        logger.warning(f"Get services validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get services error: {e}")
        return jsonify({
            'success': False,
            'message': '获取Service列表失败',
            'error': str(e)
        }), 500


@services_bp.route('/detail/<name>', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_service_detail(name):
    """
    获取Service详情
    
    Path Parameters:
        - name: Service名称
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
    
    Returns:
        JSON response with service detail
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
        
        # 获取Service详情
        service = service_discovery_service.get_service_detail(
            cluster_id, namespace, name
        )
        
        return jsonify({
            'success': True,
            'data': {
                'service': service
            }
        })
        
    except ValueError as e:
        logger.warning(f"Get service detail validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get service detail error: {e}")
        return jsonify({
            'success': False,
            'message': '获取Service详情失败',
            'error': str(e)
        }), 500


@services_bp.route('/ingresses', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_ingresses():
    """
    获取Ingress列表
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - page: 页码 (默认: 1)
        - per_page: 每页数量 (默认: 20, 最大: 100)
    
    Returns:
        JSON response with ingress list and pagination info
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
        
        # 获取Ingress列表
        ingresses = service_discovery_service.list_ingresses(cluster_id, namespace)
        
        # 计算分页
        total = len(ingresses)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_ingresses = ingresses[start:end]
        
        # 计算总页数
        pages = (total + per_page - 1) // per_page if per_page > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'ingresses': paginated_ingresses,
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
        logger.warning(f"Get ingresses validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get ingresses error: {e}")
        return jsonify({
            'success': False,
            'message': '获取Ingress列表失败',
            'error': str(e)
        }), 500


@services_bp.route('/endpoints', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_service_endpoints():
    """
    获取Service的Endpoints信息
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - name: Service名称 (必需)
    
    Returns:
        JSON response with service endpoints and associated pods
    """
    try:
        cluster_id = request.args.get('cluster_id', type=int)
        namespace = request.args.get('namespace')
        name = request.args.get('name')
        
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
                'message': 'Service名称不能为空'
            }), 400
        
        # 获取Service Endpoints
        endpoints_data = service_discovery_service.get_service_endpoints(
            cluster_id, namespace, name
        )
        
        return jsonify({
            'success': True,
            'data': endpoints_data
        })
        
    except ValueError as e:
        logger.warning(f"Get service endpoints validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get service endpoints error: {e}")
        return jsonify({
            'success': False,
            'message': '获取Service Endpoints失败',
            'error': str(e)
        }), 500



@services_bp.route('/<name>/yaml', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_service_yaml(name):
    """
    获取Service的YAML配置
    
    Path Parameters:
        - name: Service名称
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
    
    Returns:
        JSON response with YAML content
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
        
        # 获取Service YAML
        yaml_content = service_discovery_service.get_service_yaml(
            cluster_id, namespace, name
        )
        
        return jsonify({
            'success': True,
            'data': {
                'yaml': yaml_content,
                'name': name,
                'namespace': namespace,
                'kind': 'Service'
            }
        })
        
    except ValueError as e:
        logger.warning(f"Get service YAML validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get service YAML error: {e}")
        return jsonify({
            'success': False,
            'message': '获取Service YAML失败',
            'error': str(e)
        }), 500


@services_bp.route('/<name>', methods=['PUT'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def update_service(name):
    """
    更新Service配置
    
    Path Parameters:
        - name: Service名称
    
    Request Body:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - yaml_content: YAML配置内容 (必需)
    
    Returns:
        JSON response with update result
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
        yaml_content = data.get('yaml_content')
        
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
        
        if not yaml_content:
            return jsonify({
                'success': False,
                'message': 'YAML内容不能为空'
            }), 400
        
        # 更新Service
        result = service_discovery_service.update_service(
            cluster_id, namespace, name, yaml_content
        )
        
        # 记录审计日志
        log_k8s_operation(
            cluster_id=cluster_id,
            operation_type='update',
            resource_type='service',
            resource_name=name,
            namespace=namespace,
            operation_data={'yaml_length': len(yaml_content)},
            status='success'
        )
        
        return jsonify({
            'success': True,
            'message': result.get('message', 'Service更新成功'),
            'data': result
        })
        
    except ValueError as e:
        logger.warning(f"Update service validation error: {e}")
        # 记录失败的审计日志
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='update',
                resource_type='service',
                resource_name=name,
                namespace=data.get('namespace'),
                operation_data=data,
                status='failed',
                error_message=str(e)
            )
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Update service error: {e}")
        # 记录失败的审计日志
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='update',
                resource_type='service',
                resource_name=name,
                namespace=data.get('namespace'),
                operation_data=data,
                status='failed',
                error_message=str(e)
            )
        return jsonify({
            'success': False,
            'message': '更新Service失败',
            'error': str(e)
        }), 500


@services_bp.route('/ingresses/<name>/yaml', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_ingress_yaml(name):
    """
    获取Ingress的YAML配置
    
    Path Parameters:
        - name: Ingress名称
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
    
    Returns:
        JSON response with YAML content
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
        
        # 获取Ingress YAML
        yaml_content = service_discovery_service.get_ingress_yaml(
            cluster_id, namespace, name
        )
        
        return jsonify({
            'success': True,
            'data': {
                'yaml': yaml_content,
                'name': name,
                'namespace': namespace,
                'kind': 'Ingress'
            }
        })
        
    except ValueError as e:
        logger.warning(f"Get ingress YAML validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get ingress YAML error: {e}")
        return jsonify({
            'success': False,
            'message': '获取Ingress YAML失败',
            'error': str(e)
        }), 500


@services_bp.route('/<name>/delete', methods=['POST'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def delete_service(name):
    """
    删除Service
    
    Path Parameters:
        - name: Service名称
    
    Request Body:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
    
    Returns:
        JSON response with delete result
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
                'message': '命名空间不能为空'
            }), 400
        
        # 删除Service
        result = service_discovery_service.delete_service(
            cluster_id, namespace, name
        )
        
        # 记录审计日志
        log_k8s_operation(
            cluster_id=cluster_id,
            operation_type='delete',
            resource_type='service',
            resource_name=name,
            namespace=namespace,
            operation_data={},
            status='success'
        )
        
        return jsonify({
            'success': True,
            'message': result.get('message', 'Service删除成功'),
            'data': result
        })
        
    except ValueError as e:
        logger.warning(f"Delete service validation error: {e}")
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='delete',
                resource_type='service',
                resource_name=name,
                namespace=data.get('namespace'),
                operation_data=data,
                status='failed',
                error_message=str(e)
            )
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Delete service error: {e}")
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='delete',
                resource_type='service',
                resource_name=name,
                namespace=data.get('namespace'),
                operation_data=data,
                status='failed',
                error_message=str(e)
            )
        return jsonify({
            'success': False,
            'message': '删除Service失败',
            'error': str(e)
        }), 500


@services_bp.route('/ingresses/<name>', methods=['PUT'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def update_ingress(name):
    """
    更新Ingress配置
    
    Path Parameters:
        - name: Ingress名称
    
    Request Body:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - yaml_content: YAML配置内容 (必需)
    
    Returns:
        JSON response with update result
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
        yaml_content = data.get('yaml_content')
        
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
        
        if not yaml_content:
            return jsonify({
                'success': False,
                'message': 'YAML内容不能为空'
            }), 400
        
        # 更新Ingress
        result = service_discovery_service.update_ingress(
            cluster_id, namespace, name, yaml_content
        )
        
        # 记录审计日志
        log_k8s_operation(
            cluster_id=cluster_id,
            operation_type='update',
            resource_type='ingress',
            resource_name=name,
            namespace=namespace,
            operation_data={'yaml_length': len(yaml_content)},
            status='success'
        )
        
        return jsonify({
            'success': True,
            'message': result.get('message', 'Ingress更新成功'),
            'data': result
        })
        
    except ValueError as e:
        logger.warning(f"Update ingress validation error: {e}")
        # 记录失败的审计日志
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='update',
                resource_type='ingress',
                resource_name=name,
                namespace=data.get('namespace'),
                operation_data=data,
                status='failed',
                error_message=str(e)
            )
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Update ingress error: {e}")
        # 记录失败的审计日志
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='update',
                resource_type='ingress',
                resource_name=name,
                namespace=data.get('namespace'),
                operation_data=data,
                status='failed',
                error_message=str(e)
            )
        return jsonify({
            'success': False,
            'message': '更新Ingress失败',
            'error': str(e)
        }), 500


@services_bp.route('/ingresses/<name>/delete', methods=['POST'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def delete_ingress(name):
    """
    删除Ingress
    
    Path Parameters:
        - name: Ingress名称
    
    Request Body:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
    
    Returns:
        JSON response with delete result
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
                'message': '命名空间不能为空'
            }), 400
        
        # 删除Ingress
        result = service_discovery_service.delete_ingress(
            cluster_id, namespace, name
        )
        
        # 记录审计日志
        log_k8s_operation(
            cluster_id=cluster_id,
            operation_type='delete',
            resource_type='ingress',
            resource_name=name,
            namespace=namespace,
            operation_data={},
            status='success'
        )
        
        return jsonify({
            'success': True,
            'message': result.get('message', 'Ingress删除成功'),
            'data': result
        })
        
    except ValueError as e:
        logger.warning(f"Delete ingress validation error: {e}")
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='delete',
                resource_type='ingress',
                resource_name=name,
                namespace=data.get('namespace'),
                operation_data=data,
                status='failed',
                error_message=str(e)
            )
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Delete ingress error: {e}")
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='delete',
                resource_type='ingress',
                resource_name=name,
                namespace=data.get('namespace'),
                operation_data=data,
                status='failed',
                error_message=str(e)
            )
        return jsonify({
            'success': False,
            'message': '删除Ingress失败',
            'error': str(e)
        }), 500
