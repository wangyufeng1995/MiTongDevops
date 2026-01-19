"""
K8S Workload Management API
Provides endpoints for managing Kubernetes workloads (Deployments, StatefulSets, DaemonSets)
and Pod operations (list, detail, logs, containers)
"""
import logging
from flask import Blueprint, request, jsonify, g
from app.core.middleware import tenant_required, role_required
from app.services.k8s.workload_service import workload_service
from app.services.k8s.pod_service import pod_service
from app.utils.k8s_utils import log_k8s_operation, handle_k8s_errors

logger = logging.getLogger(__name__)
workloads_bp = Blueprint('k8s_workloads', __name__)


@workloads_bp.route('', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_workloads():
    """
    获取工作负载列表
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - type: 工作负载类型 (可选: deployment/statefulset/daemonset/all, 默认: all)
        - page: 页码 (默认: 1)
        - per_page: 每页数量 (默认: 20, 最大: 100)
    
    Returns:
        JSON response with workload list and pagination info
    """
    try:
        cluster_id = request.args.get('cluster_id', type=int)
        namespace = request.args.get('namespace')
        workload_type = request.args.get('type', 'all')
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
        
        # 获取工作负载列表
        workloads = []
        
        if workload_type in ['deployment', 'all']:
            deployments = workload_service.list_deployments(cluster_id, namespace)
            for deploy in deployments:
                deploy['type'] = 'deployment'
            workloads.extend(deployments)
        
        if workload_type in ['statefulset', 'all']:
            statefulsets = workload_service.list_statefulsets(cluster_id, namespace)
            for sts in statefulsets:
                sts['type'] = 'statefulset'
            workloads.extend(statefulsets)
        
        if workload_type in ['daemonset', 'all']:
            daemonsets = workload_service.list_daemonsets(cluster_id, namespace)
            for ds in daemonsets:
                ds['type'] = 'daemonset'
            workloads.extend(daemonsets)
        
        # 计算分页
        total = len(workloads)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_workloads = workloads[start:end]
        
        # 计算总页数
        pages = (total + per_page - 1) // per_page if per_page > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'workloads': paginated_workloads,
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
        logger.warning(f"Get workloads validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get workloads error: {e}")
        return jsonify({
            'success': False,
            'message': '获取工作负载列表失败',
            'error': str(e)
        }), 500


@workloads_bp.route('/detail', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_workload_detail():
    """
    获取工作负载详情
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - type: 工作负载类型 (必需: deployment/statefulset/daemonset)
        - name: 工作负载名称 (必需)
    
    Returns:
        JSON response with workload detail including pods
    """
    try:
        cluster_id = request.args.get('cluster_id', type=int)
        namespace = request.args.get('namespace')
        workload_type = request.args.get('type')
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
        
        if not workload_type:
            return jsonify({
                'success': False,
                'message': '工作负载类型不能为空'
            }), 400
        
        if not name:
            return jsonify({
                'success': False,
                'message': '工作负载名称不能为空'
            }), 400
        
        # 获取工作负载详情（使用新的详情方法）
        workload = workload_service.get_workload_detail(cluster_id, namespace, workload_type, name)
        
        return jsonify({
            'success': True,
            'data': workload
        })
        
    except ValueError as e:
        logger.warning(f"Get workload detail validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get workload detail error: {e}")
        return jsonify({
            'success': False,
            'message': '获取工作负载详情失败',
            'error': str(e)
        }), 500


@workloads_bp.route('/scale', methods=['POST'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def scale_workload():
    """
    扩缩容工作负载
    
    Request Body:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - type: 工作负载类型 (必需: deployment/statefulset)
        - name: 工作负载名称 (必需)
        - replicas: 目标副本数 (必需)
    
    Returns:
        JSON response with scaling result
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
        workload_type = data.get('type')
        name = data.get('name')
        replicas = data.get('replicas')
        
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
        
        if not workload_type:
            return jsonify({
                'success': False,
                'message': '工作负载类型不能为空'
            }), 400
        
        if not name:
            return jsonify({
                'success': False,
                'message': '工作负载名称不能为空'
            }), 400
        
        if replicas is None:
            return jsonify({
                'success': False,
                'message': '副本数不能为空'
            }), 400
        
        # 执行扩缩容
        result = workload_service.scale_workload(
            cluster_id, namespace, workload_type, name, replicas
        )
        
        # 记录审计日志
        log_k8s_operation(
            cluster_id=cluster_id,
            operation_type='scale',
            resource_type=workload_type,
            resource_name=name,
            namespace=namespace,
            operation_data={'replicas': replicas},
            status='success'
        )
        
        return jsonify({
            'success': True,
            'message': result['message'],
            'data': result
        })
        
    except ValueError as e:
        logger.warning(f"Scale workload validation error: {e}")
        # 记录失败的审计日志
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='scale',
                resource_type=data.get('type'),
                resource_name=data.get('name'),
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
        logger.error(f"Scale workload error: {e}")
        # 记录失败的审计日志
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='scale',
                resource_type=data.get('type'),
                resource_name=data.get('name'),
                namespace=data.get('namespace'),
                operation_data=data,
                status='failed',
                error_message=str(e)
            )
        return jsonify({
            'success': False,
            'message': '扩缩容失败',
            'error': str(e)
        }), 500



@workloads_bp.route('/restart', methods=['POST'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def restart_workload():
    """
    重启工作负载
    
    Request Body:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - type: 工作负载类型 (必需: deployment/statefulset/daemonset)
        - name: 工作负载名称 (必需)
    
    Returns:
        JSON response with restart result
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
        workload_type = data.get('type')
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
        
        if not workload_type:
            return jsonify({
                'success': False,
                'message': '工作负载类型不能为空'
            }), 400
        
        if not name:
            return jsonify({
                'success': False,
                'message': '工作负载名称不能为空'
            }), 400
        
        # 执行重启
        result = workload_service.restart_workload(
            cluster_id, namespace, workload_type, name
        )
        
        # 记录审计日志
        log_k8s_operation(
            cluster_id=cluster_id,
            operation_type='restart',
            resource_type=workload_type,
            resource_name=name,
            namespace=namespace,
            operation_data={'type': workload_type, 'name': name},
            status='success'
        )
        
        return jsonify({
            'success': True,
            'message': result['message'],
            'data': result
        })
        
    except ValueError as e:
        logger.warning(f"Restart workload validation error: {e}")
        # 记录失败的审计日志
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='restart',
                resource_type=data.get('type'),
                resource_name=data.get('name'),
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
        logger.error(f"Restart workload error: {e}")
        # 记录失败的审计日志
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='restart',
                resource_type=data.get('type'),
                resource_name=data.get('name'),
                namespace=data.get('namespace'),
                operation_data=data,
                status='failed',
                error_message=str(e)
            )
        return jsonify({
            'success': False,
            'message': '重启失败',
            'error': str(e)
        }), 500


@workloads_bp.route('/pods', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_pods():
    """
    获取Pod列表
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - label_selector: 标签选择器 (可选，格式: "app=nginx,version=v1")
    
    Returns:
        JSON response with pod list
    
    Requirements: 1.1, 1.2, 5.1, 5.2
    """
    try:
        cluster_id = request.args.get('cluster_id', type=int)
        namespace = request.args.get('namespace')
        label_selector = request.args.get('label_selector')
        
        if not cluster_id:
            return jsonify({
                'success': False,
                'error_code': 'VALIDATION_ERROR',
                'message': '集群ID不能为空'
            }), 400
        
        if not namespace:
            return jsonify({
                'success': False,
                'error_code': 'VALIDATION_ERROR',
                'message': '命名空间不能为空'
            }), 400
        
        # 获取Pod列表
        pods = pod_service.list_pods(cluster_id, namespace, label_selector)
        
        return jsonify({
            'success': True,
            'data': {
                'pods': pods
            }
        })
        
    except ValueError as e:
        logger.warning(f"Get pods validation error: {e}")
        return jsonify({
            'success': False,
            'error_code': 'VALIDATION_ERROR',
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get pods error: {e}")
        return jsonify({
            'success': False,
            'error_code': 'INTERNAL_ERROR',
            'message': '获取Pod列表失败',
            'details': str(e)
        }), 500


@workloads_bp.route('/pods/detail', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_pod_detail():
    """
    获取Pod详细信息
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - pod_name: Pod名称 (必需)
    
    Returns:
        JSON response with pod detail including containers, labels, annotations, events
    
    Requirements: 2.2, 5.1, 5.2
    """
    try:
        cluster_id = request.args.get('cluster_id', type=int)
        namespace = request.args.get('namespace')
        pod_name = request.args.get('pod_name')
        
        if not cluster_id:
            return jsonify({
                'success': False,
                'error_code': 'VALIDATION_ERROR',
                'message': '集群ID不能为空'
            }), 400
        
        if not namespace:
            return jsonify({
                'success': False,
                'error_code': 'VALIDATION_ERROR',
                'message': '命名空间不能为空'
            }), 400
        
        if not pod_name:
            return jsonify({
                'success': False,
                'error_code': 'VALIDATION_ERROR',
                'message': 'Pod名称不能为空'
            }), 400
        
        # 获取Pod详情
        pod_detail = pod_service.get_pod_detail(cluster_id, namespace, pod_name)
        
        return jsonify({
            'success': True,
            'data': pod_detail
        })
        
    except ValueError as e:
        logger.warning(f"Get pod detail validation error: {e}")
        error_message = str(e)
        # 检查是否是Pod不存在的错误
        if '不存在' in error_message:
            return jsonify({
                'success': False,
                'error_code': 'POD_NOT_FOUND',
                'message': 'Pod不存在',
                'details': error_message
            }), 404
        return jsonify({
            'success': False,
            'error_code': 'VALIDATION_ERROR',
            'message': error_message
        }), 400
        
    except Exception as e:
        logger.error(f"Get pod detail error: {e}")
        return jsonify({
            'success': False,
            'error_code': 'INTERNAL_ERROR',
            'message': '获取Pod详情失败',
            'details': str(e)
        }), 500


@workloads_bp.route('/pods/containers', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_pod_containers():
    """
    获取Pod的容器列表
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - pod_name: Pod名称 (必需)
    
    Returns:
        JSON response with container list
    
    Requirements: 1.2, 5.1, 5.2
    """
    try:
        cluster_id = request.args.get('cluster_id', type=int)
        namespace = request.args.get('namespace')
        pod_name = request.args.get('pod_name')
        
        if not cluster_id:
            return jsonify({
                'success': False,
                'error_code': 'VALIDATION_ERROR',
                'message': '集群ID不能为空'
            }), 400
        
        if not namespace:
            return jsonify({
                'success': False,
                'error_code': 'VALIDATION_ERROR',
                'message': '命名空间不能为空'
            }), 400
        
        if not pod_name:
            return jsonify({
                'success': False,
                'error_code': 'VALIDATION_ERROR',
                'message': 'Pod名称不能为空'
            }), 400
        
        # 获取容器列表
        containers = pod_service.get_pod_containers(cluster_id, namespace, pod_name)
        
        return jsonify({
            'success': True,
            'data': {
                'containers': containers
            }
        })
        
    except ValueError as e:
        logger.warning(f"Get pod containers validation error: {e}")
        error_message = str(e)
        # 检查是否是Pod不存在的错误
        if '不存在' in error_message:
            return jsonify({
                'success': False,
                'error_code': 'POD_NOT_FOUND',
                'message': 'Pod不存在',
                'details': error_message
            }), 404
        return jsonify({
            'success': False,
            'error_code': 'VALIDATION_ERROR',
            'message': error_message
        }), 400
        
    except Exception as e:
        logger.error(f"Get pod containers error: {e}")
        return jsonify({
            'success': False,
            'error_code': 'INTERNAL_ERROR',
            'message': '获取Pod容器列表失败',
            'details': str(e)
        }), 500


@workloads_bp.route('/pods/logs', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_pod_logs():
    """
    获取Pod日志
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - pod_name: Pod名称 (必需)
        - container: 容器名称 (可选，多容器Pod必需)
        - tail_lines: 返回最后N行日志 (默认: 100, 最大: 10000)
        - timestamps: 是否包含时间戳 (默认: true)
        - search: 搜索关键词 (可选)
    
    Returns:
        JSON response with pod logs
    
    Requirements: 3.3, 3.7, 5.1, 5.2
    """
    try:
        cluster_id = request.args.get('cluster_id', type=int)
        namespace = request.args.get('namespace')
        pod_name = request.args.get('pod_name')
        container = request.args.get('container')
        tail_lines = request.args.get('tail_lines', 100, type=int)
        timestamps = request.args.get('timestamps', 'true').lower() == 'true'
        search = request.args.get('search')
        
        if not cluster_id:
            return jsonify({
                'success': False,
                'error_code': 'VALIDATION_ERROR',
                'message': '集群ID不能为空'
            }), 400
        
        if not namespace:
            return jsonify({
                'success': False,
                'error_code': 'VALIDATION_ERROR',
                'message': '命名空间不能为空'
            }), 400
        
        if not pod_name:
            return jsonify({
                'success': False,
                'error_code': 'VALIDATION_ERROR',
                'message': 'Pod名称不能为空'
            }), 400
        
        # 限制tail_lines范围
        tail_lines = min(max(tail_lines, 1), 10000)
        
        # 获取Pod日志（使用pod_service的增强版本）
        result = pod_service.get_pod_logs(
            cluster_id=cluster_id,
            namespace=namespace,
            pod_name=pod_name,
            container=container,
            tail_lines=tail_lines,
            timestamps=timestamps,
            search=search
        )
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except ValueError as e:
        logger.warning(f"Get pod logs validation error: {e}")
        error_message = str(e)
        # 检查是否是Pod不存在的错误
        if '不存在' in error_message:
            return jsonify({
                'success': False,
                'error_code': 'POD_NOT_FOUND',
                'message': 'Pod不存在',
                'details': error_message
            }), 404
        # 检查是否是容器相关错误
        if '容器' in error_message or 'container' in error_message.lower():
            return jsonify({
                'success': False,
                'error_code': 'CONTAINER_NOT_FOUND',
                'message': '容器不存在或需要指定容器',
                'details': error_message
            }), 400
        return jsonify({
            'success': False,
            'error_code': 'VALIDATION_ERROR',
            'message': error_message
        }), 400
        
    except Exception as e:
        logger.error(f"Get pod logs error: {e}")
        return jsonify({
            'success': False,
            'error_code': 'INTERNAL_ERROR',
            'message': '获取Pod日志失败',
            'details': str(e)
        }), 500



@workloads_bp.route('/pods/delete', methods=['POST'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def delete_pod():
    """
    删除Pod
    
    Request Body:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - pod_name: Pod名称 (必需)
        - grace_period_seconds: 优雅终止等待时间（秒）(可选)
    
    Returns:
        JSON response with delete result
    
    Requirements: 5.3, 5.4, 5.5
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error_code': 'VALIDATION_ERROR',
                'message': '请求数据不能为空'
            }), 400
        
        cluster_id = data.get('cluster_id')
        namespace = data.get('namespace')
        pod_name = data.get('pod_name')
        grace_period_seconds = data.get('grace_period_seconds')
        
        if not cluster_id:
            return jsonify({
                'success': False,
                'error_code': 'VALIDATION_ERROR',
                'message': '集群ID不能为空'
            }), 400
        
        if not namespace:
            return jsonify({
                'success': False,
                'error_code': 'VALIDATION_ERROR',
                'message': '命名空间不能为空'
            }), 400
        
        if not pod_name:
            return jsonify({
                'success': False,
                'error_code': 'VALIDATION_ERROR',
                'message': 'Pod名称不能为空'
            }), 400
        
        # 验证grace_period_seconds
        if grace_period_seconds is not None:
            try:
                grace_period_seconds = int(grace_period_seconds)
                if grace_period_seconds < 0:
                    return jsonify({
                        'success': False,
                        'error_code': 'VALIDATION_ERROR',
                        'message': '优雅终止等待时间不能为负数'
                    }), 400
            except (TypeError, ValueError):
                return jsonify({
                    'success': False,
                    'error_code': 'VALIDATION_ERROR',
                    'message': '优雅终止等待时间必须是整数'
                }), 400
        
        # 执行删除
        result = pod_service.delete_pod(
            cluster_id=cluster_id,
            namespace=namespace,
            pod_name=pod_name,
            grace_period_seconds=grace_period_seconds
        )
        
        # 记录审计日志
        log_k8s_operation(
            cluster_id=cluster_id,
            operation_type='delete',
            resource_type='pod',
            resource_name=pod_name,
            namespace=namespace,
            operation_data={
                'pod_name': pod_name,
                'grace_period_seconds': grace_period_seconds
            },
            status='success'
        )
        
        return jsonify({
            'success': True,
            'message': result['message'],
            'data': result
        })
        
    except ValueError as e:
        logger.warning(f"Delete pod validation error: {e}")
        error_message = str(e)
        # 记录失败的审计日志
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='delete',
                resource_type='pod',
                resource_name=data.get('pod_name'),
                namespace=data.get('namespace'),
                operation_data=data,
                status='failed',
                error_message=error_message
            )
        # 检查是否是Pod不存在的错误
        if '不存在' in error_message:
            return jsonify({
                'success': False,
                'error_code': 'POD_NOT_FOUND',
                'message': 'Pod不存在',
                'details': error_message
            }), 404
        # 检查是否是权限错误
        if '权限' in error_message:
            return jsonify({
                'success': False,
                'error_code': 'PERMISSION_DENIED',
                'message': '权限不足',
                'details': error_message
            }), 403
        return jsonify({
            'success': False,
            'error_code': 'VALIDATION_ERROR',
            'message': error_message
        }), 400
        
    except Exception as e:
        logger.error(f"Delete pod error: {e}")
        # 记录失败的审计日志
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='delete',
                resource_type='pod',
                resource_name=data.get('pod_name'),
                namespace=data.get('namespace'),
                operation_data=data,
                status='failed',
                error_message=str(e)
            )
        return jsonify({
            'success': False,
            'error_code': 'INTERNAL_ERROR',
            'message': '删除Pod失败',
            'details': str(e)
        }), 500



@workloads_bp.route('/<name>/yaml', methods=['GET'])
@tenant_required
@handle_k8s_errors
def get_workload_yaml(name):
    """
    获取工作负载的YAML配置
    
    Path Parameters:
        - name: 工作负载名称
    
    Query Parameters:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - type: 工作负载类型 (必需: deployment/statefulset/daemonset)
    
    Returns:
        JSON response with YAML content
    """
    try:
        cluster_id = request.args.get('cluster_id', type=int)
        namespace = request.args.get('namespace')
        workload_type = request.args.get('type')
        
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
        
        if not workload_type:
            return jsonify({
                'success': False,
                'message': '工作负载类型不能为空'
            }), 400
        
        result = workload_service.get_workload_yaml(cluster_id, namespace, workload_type, name)
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except ValueError as e:
        logger.warning(f"Get workload YAML validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Get workload YAML error: {e}")
        return jsonify({
            'success': False,
            'message': '获取工作负载YAML失败',
            'error': str(e)
        }), 500


@workloads_bp.route('/<name>', methods=['PUT'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def update_workload(name):
    """
    更新工作负载
    
    Path Parameters:
        - name: 工作负载名称
    
    Request Body:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - type: 工作负载类型 (必需: deployment/statefulset/daemonset)
        - yaml_content: YAML内容 (必需)
    
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
        workload_type = data.get('type')
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
        
        if not workload_type:
            return jsonify({
                'success': False,
                'message': '工作负载类型不能为空'
            }), 400
        
        if not yaml_content:
            return jsonify({
                'success': False,
                'message': 'YAML内容不能为空'
            }), 400
        
        result = workload_service.update_workload(
            cluster_id, namespace, workload_type, name, yaml_content
        )
        
        log_k8s_operation(
            cluster_id=cluster_id,
            operation_type='update',
            resource_type=workload_type,
            resource_name=name,
            namespace=namespace,
            operation_data={'yaml_length': len(yaml_content)},
            status='success'
        )
        
        return jsonify({
            'success': True,
            'message': result['message'],
            'data': result
        })
        
    except ValueError as e:
        logger.warning(f"Update workload validation error: {e}")
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='update',
                resource_type=data.get('type'),
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
        logger.error(f"Update workload error: {e}")
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='update',
                resource_type=data.get('type'),
                resource_name=name,
                namespace=data.get('namespace'),
                operation_data=data,
                status='failed',
                error_message=str(e)
            )
        return jsonify({
            'success': False,
            'message': '更新工作负载失败',
            'error': str(e)
        }), 500


@workloads_bp.route('/<name>/delete', methods=['POST'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def delete_workload(name):
    """
    删除工作负载 (使用POST请求)
    
    Path Parameters:
        - name: 工作负载名称
    
    Request Body:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需)
        - type: 工作负载类型 (必需: deployment/statefulset/daemonset)
    
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
        workload_type = data.get('type')
        
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
        
        if not workload_type:
            return jsonify({
                'success': False,
                'message': '工作负载类型不能为空'
            }), 400
        
        result = workload_service.delete_workload(cluster_id, namespace, workload_type, name)
        
        log_k8s_operation(
            cluster_id=cluster_id,
            operation_type='delete',
            resource_type=workload_type,
            resource_name=name,
            namespace=namespace,
            operation_data={'type': workload_type, 'name': name},
            status='success'
        )
        
        return jsonify({
            'success': True,
            'message': result['message'],
            'data': result
        })
        
    except ValueError as e:
        logger.warning(f"Delete workload validation error: {e}")
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='delete',
                resource_type=data.get('type'),
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
        logger.error(f"Delete workload error: {e}")
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='delete',
                resource_type=data.get('type'),
                resource_name=name,
                namespace=data.get('namespace'),
                operation_data=data,
                status='failed',
                error_message=str(e)
            )
        return jsonify({
            'success': False,
            'message': '删除工作负载失败',
            'error': str(e)
        }), 500


@workloads_bp.route('/apply', methods=['POST'])
@role_required('超级管理员', '运维管理员')
@handle_k8s_errors
def apply_yaml():
    """
    通过YAML创建或更新K8S资源
    
    Request Body:
        - cluster_id: 集群ID (必需)
        - namespace: 命名空间 (必需，如果YAML中未指定)
        - yaml_content: YAML内容 (必需)
    
    Returns:
        JSON response with apply result
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error_code': 'VALIDATION_ERROR',
                'message': '请求数据不能为空'
            }), 400
        
        cluster_id = data.get('cluster_id')
        namespace = data.get('namespace')
        yaml_content = data.get('yaml_content')
        
        if not cluster_id:
            return jsonify({
                'success': False,
                'error_code': 'VALIDATION_ERROR',
                'message': '集群ID不能为空'
            }), 400
        
        if not yaml_content:
            return jsonify({
                'success': False,
                'error_code': 'VALIDATION_ERROR',
                'message': 'YAML内容不能为空'
            }), 400
        
        # 执行YAML应用
        result = workload_service.apply_yaml(
            cluster_id=cluster_id,
            namespace=namespace,
            yaml_content=yaml_content
        )
        
        # 记录审计日志
        log_k8s_operation(
            cluster_id=cluster_id,
            operation_type='apply',
            resource_type=result.get('kind', 'unknown'),
            resource_name=result.get('name', 'unknown'),
            namespace=result.get('namespace', namespace),
            operation_data={
                'yaml_length': len(yaml_content),
                'kind': result.get('kind'),
                'name': result.get('name')
            },
            status='success'
        )
        
        return jsonify({
            'success': True,
            'message': result.get('message', '资源创建/更新成功'),
            'data': result
        })
        
    except ValueError as e:
        logger.warning(f"Apply YAML validation error: {e}")
        error_message = str(e)
        # 记录失败的审计日志
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='apply',
                resource_type='yaml',
                resource_name='unknown',
                namespace=data.get('namespace'),
                operation_data={'error': error_message},
                status='failed',
                error_message=error_message
            )
        return jsonify({
            'success': False,
            'error_code': 'VALIDATION_ERROR',
            'message': error_message
        }), 400
        
    except Exception as e:
        logger.error(f"Apply YAML error: {e}")
        import traceback
        traceback.print_exc()
        # 记录失败的审计日志
        if data:
            log_k8s_operation(
                cluster_id=data.get('cluster_id'),
                operation_type='apply',
                resource_type='yaml',
                resource_name='unknown',
                namespace=data.get('namespace'),
                operation_data={'error': str(e)},
                status='failed',
                error_message=str(e)
            )
        return jsonify({
            'success': False,
            'error_code': 'INTERNAL_ERROR',
            'message': '应用YAML失败',
            'details': str(e)
        }), 500
