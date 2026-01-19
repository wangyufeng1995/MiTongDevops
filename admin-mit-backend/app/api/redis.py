"""
Redis 管理 API

提供 Redis 连接配置的 CRUD 操作，连接管理，以及键值操作等 API。
注意：所有 API 只使用 GET 和 POST 方法，不使用 PUT/DELETE。

Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 7.1, 7.2, 7.3, 7.4
"""
from flask import Blueprint, request, jsonify, g
from app.core.middleware import tenant_required, role_required
from app.services.redis_management_service import redis_management_service
from app.services.redis_connection_manager import (
    RedisConnectionException,
    RedisTimeoutException,
    RedisOperationError,
)
from app.services.operation_log_service import operation_log_service
import logging

logger = logging.getLogger(__name__)
redis_bp = Blueprint('redis', __name__)


def log_redis_operation(action, resource, resource_id=None, details=None):
    """
    记录 Redis 操作日志的辅助函数
    
    Args:
        action: 操作类型 (create, update, delete, connect, disconnect, etc.)
        resource: 资源类型 (redis_connection, redis_key, redis_hash, etc.)
        resource_id: 资源 ID
        details: 操作详情
    """
    try:
        operation_log_service.log_operation(
            action=action,
            resource=resource,
            resource_id=resource_id,
            details=details
        )
    except Exception as e:
        logger.warning(f"Failed to log Redis operation: {e}")


# ==================== 连接配置管理 API ====================

@redis_bp.route('/connections', methods=['GET'])
@tenant_required
def list_connections():
    """
    获取 Redis 连接配置列表
    
    Query Parameters:
        - page: 页码 (默认 1)
        - per_page: 每页数量 (默认 50)
        - search: 搜索关键词
        - status: 状态过滤 (0-禁用, 1-启用)
    
    Returns:
        JSON: 连接列表和分页信息
        
    Requirements: 1.1, 7.1
    """
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        search = request.args.get('search', '')
        status = request.args.get('status', type=int)
        
        # 限制每页最大数量
        per_page = min(per_page, 100)
        
        result = redis_management_service.list_connections(
            tenant_id=g.tenant_id,
            page=page,
            per_page=per_page,
            search=search,
            status=status
        )
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except ValueError as e:
        logger.warning(f"List connections validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"List connections error: {e}")
        return jsonify({
            'success': False,
            'message': '获取连接列表失败'
        }), 500


@redis_bp.route('/connections', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def create_connection():
    """
    创建 Redis 连接配置
    
    Request Body:
        - name: 连接名称 (必填)
        - connection_type: 连接类型 ('standalone' | 'cluster')
        - host: 主机地址 (单机模式必填)
        - port: 端口 (默认 6379)
        - password: 密码 (可选)
        - database: 数据库索引 (默认 0)
        - cluster_nodes: 集群节点列表 (集群模式必填)
        - timeout: 连接超时 (默认 5)
        - description: 描述 (可选)
        - status: 状态 (默认 1)
    
    Returns:
        JSON: 创建的连接配置
        
    Requirements: 1.1, 7.1, 7.2, 7.3, 7.4
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        connection = redis_management_service.create_connection(
            config=data,
            tenant_id=g.tenant_id
        )
        
        # 记录操作日志
        log_redis_operation(
            action='create',
            resource='redis_connection',
            resource_id=connection.id,
            details={
                'name': data.get('name'),
                'connection_type': data.get('connection_type', 'standalone'),
                'host': data.get('host'),
                'port': data.get('port', 6379)
            }
        )
        
        return jsonify({
            'success': True,
            'data': {
                'connection': connection.to_dict()
            },
            'message': '连接配置创建成功'
        })
        
    except ValueError as e:
        logger.warning(f"Create connection validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Create connection error: {e}")
        return jsonify({
            'success': False,
            'message': '创建连接配置失败'
        }), 500


@redis_bp.route('/connections/<int:connection_id>', methods=['GET'])
@tenant_required
def get_connection(connection_id):
    """
    获取 Redis 连接配置详情
    
    Path Parameters:
        - connection_id: 连接配置 ID
    
    Returns:
        JSON: 连接配置详情
        
    Requirements: 1.1, 7.1
    """
    try:
        connection = redis_management_service.get_connection(
            connection_id=connection_id,
            tenant_id=g.tenant_id,
            include_password=False
        )
        
        if not connection:
            return jsonify({
                'success': False,
                'message': '连接配置不存在'
            }), 404
        
        return jsonify({
            'success': True,
            'data': {
                'connection': connection
            }
        })
        
    except ValueError as e:
        logger.warning(f"Get connection validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Get connection error: {e}")
        return jsonify({
            'success': False,
            'message': '获取连接配置失败'
        }), 500


@redis_bp.route('/connections/<int:connection_id>/update', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def update_connection(connection_id):
    """
    更新 Redis 连接配置
    
    Path Parameters:
        - connection_id: 连接配置 ID
    
    Request Body:
        - name: 连接名称
        - connection_type: 连接类型
        - host: 主机地址
        - port: 端口
        - password: 密码
        - database: 数据库索引
        - cluster_nodes: 集群节点列表
        - timeout: 连接超时
        - description: 描述
        - status: 状态
    
    Returns:
        JSON: 更新后的连接配置
        
    Requirements: 1.3, 7.1, 7.2, 7.3
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        connection = redis_management_service.update_connection(
            connection_id=connection_id,
            config=data,
            tenant_id=g.tenant_id
        )
        
        # 记录操作日志
        log_redis_operation(
            action='update',
            resource='redis_connection',
            resource_id=connection_id,
            details={
                'updated_fields': list(data.keys())
            }
        )
        
        return jsonify({
            'success': True,
            'data': {
                'connection': connection.to_dict()
            },
            'message': '连接配置更新成功'
        })
        
    except ValueError as e:
        logger.warning(f"Update connection validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Update connection error: {e}")
        return jsonify({
            'success': False,
            'message': '更新连接配置失败'
        }), 500


@redis_bp.route('/connections/<int:connection_id>/delete', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def delete_connection(connection_id):
    """
    删除 Redis 连接配置
    
    Path Parameters:
        - connection_id: 连接配置 ID
    
    Returns:
        JSON: 删除结果
        
    Requirements: 1.4, 7.1, 7.2, 7.3, 7.4
    """
    try:
        result = redis_management_service.delete_connection(
            connection_id=connection_id,
            tenant_id=g.tenant_id
        )
        
        if result:
            # 记录操作日志
            log_redis_operation(
                action='delete',
                resource='redis_connection',
                resource_id=connection_id,
                details={'success': True}
            )
            return jsonify({
                'success': True,
                'message': '连接配置删除成功'
            })
        else:
            return jsonify({
                'success': False,
                'message': '删除连接配置失败'
            }), 500
        
    except ValueError as e:
        logger.warning(f"Delete connection validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Delete connection error: {e}")
        return jsonify({
            'success': False,
            'message': '删除连接配置失败'
        }), 500


@redis_bp.route('/connections/<int:connection_id>/test', methods=['POST'])
@tenant_required
def test_connection(connection_id):
    """
    测试 Redis 连接
    
    Path Parameters:
        - connection_id: 连接配置 ID
    
    Returns:
        JSON: 测试结果
        
    Requirements: 1.5, 7.1
    """
    try:
        success, message = redis_management_service.test_connection(
            connection_id=connection_id,
            tenant_id=g.tenant_id
        )
        
        return jsonify({
            'success': success,
            'data': {
                'connected': success,
                'message': message
            },
            'message': message
        })
        
    except ValueError as e:
        logger.warning(f"Test connection validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Test connection error: {e}")
        return jsonify({
            'success': False,
            'message': '测试连接失败'
        }), 500


@redis_bp.route('/connections/test', methods=['POST'])
@tenant_required
def test_connection_config():
    """
    测试连接配置（不保存）
    
    Request Body:
        - connection_type: 连接类型 ('standalone' | 'cluster')
        - host: 主机地址 (单机模式)
        - port: 端口 (默认 6379)
        - password: 密码 (可选)
        - database: 数据库索引 (默认 0)
        - cluster_nodes: 集群节点列表 (集群模式)
        - timeout: 连接超时 (默认 5)
    
    Returns:
        JSON: 测试结果
        
    Requirements: 1.5, 7.1
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        success, message = redis_management_service.test_connection_config(config=data)
        
        return jsonify({
            'success': success,
            'data': {
                'connected': success,
                'message': message
            },
            'message': message
        })
        
    except ValueError as e:
        logger.warning(f"Test connection config validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Test connection config error: {e}")
        return jsonify({
            'success': False,
            'message': '测试连接失败'
        }), 500


# ==================== 连接操作 API ====================

@redis_bp.route('/connections/<int:connection_id>/connect', methods=['POST'])
@tenant_required
def connect_redis(connection_id):
    """
    建立 Redis 连接
    
    Path Parameters:
        - connection_id: 连接配置 ID
    
    Returns:
        JSON: 连接结果
        
    Requirements: 2.1, 2.2, 2.3, 7.1, 7.4
    """
    try:
        # 直接使用 _get_redis_client 建立连接
        # 这会正确处理密码解密和连接缓存
        client = redis_management_service._get_redis_client(
            conn_id=connection_id,
            tenant_id=g.tenant_id
        )
        
        # 测试连接
        client.ping()
        
        # 获取连接配置用于日志
        connection = redis_management_service.get_connection(
            connection_id=connection_id,
            tenant_id=g.tenant_id,
            include_password=False
        )
        
        # 记录操作日志
        log_redis_operation(
            action='connect',
            resource='redis_connection',
            resource_id=connection_id,
            details={
                'name': connection['name'] if connection else f'Connection {connection_id}',
                'success': True
            }
        )
        
        return jsonify({
            'success': True,
            'data': {
                'connected': True,
                'connection_id': connection_id
            },
            'message': '连接成功'
        })
        
    except ValueError as e:
        logger.warning(f"Connect Redis validation error: {e}")
        return jsonify({
            'success': False,
            'data': {
                'connected': False,
                'connection_id': connection_id
            },
            'message': str(e)
        }), 400
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'data': {
                'connected': False,
                'connection_id': connection_id
            },
            'message': str(e)
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'data': {
                'connected': False,
                'connection_id': connection_id
            },
            'message': str(e)
        }), 408
    except Exception as e:
        logger.error(f"Connect Redis error: {e}")
        return jsonify({
            'success': False,
            'data': {
                'connected': False,
                'connection_id': connection_id
            },
            'message': '连接失败'
        }), 500


@redis_bp.route('/connections/<int:connection_id>/disconnect', methods=['POST'])
@tenant_required
def disconnect_redis(connection_id):
    """
    断开 Redis 连接
    
    Path Parameters:
        - connection_id: 连接配置 ID
    
    Returns:
        JSON: 断开结果
        
    Requirements: 2.4, 7.1, 7.4
    """
    try:
        from app.services.redis_connection_manager import redis_connection_manager
        
        # 关闭连接
        result = redis_connection_manager.close_client(
            conn_id=connection_id,
            tenant_id=g.tenant_id
        )
        
        # 记录操作日志
        log_redis_operation(
            action='disconnect',
            resource='redis_connection',
            resource_id=connection_id,
            details={'disconnected': result}
        )
        
        return jsonify({
            'success': True,
            'data': {
                'connection_id': connection_id,
                'disconnected': result
            },
            'message': '已断开连接' if result else '连接已经断开'
        })
        
    except ValueError as e:
        logger.warning(f"Disconnect validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Disconnect error: {e}")
        return jsonify({
            'success': False,
            'message': '断开连接失败'
        }), 500


# ==================== 键值操作 API ====================

@redis_bp.route('/<int:conn_id>/keys', methods=['GET'])
@tenant_required
def scan_keys(conn_id):
    """
    扫描 Redis 键列表
    
    使用 SCAN 命令进行增量迭代，避免阻塞服务器。
    
    Path Parameters:
        - conn_id: 连接配置 ID
    
    Query Parameters:
        - pattern: 键名匹配模式 (默认 '*')
        - cursor: 游标位置 (默认 0)
        - count: 每次扫描返回的建议数量 (默认 50)
        - database: 数据库索引 (可选，仅单机模式有效)
    
    Returns:
        JSON: 包含键列表和游标信息
            - cursor: 下一个游标位置 (0 表示扫描完成)
            - keys: 键信息列表 [{key, type, ttl}, ...]
            - total_scanned: 本次扫描的键数量
        
    Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
    """
    try:
        pattern = request.args.get('pattern', '*')
        cursor = request.args.get('cursor', 0, type=int)
        count = request.args.get('count', 50, type=int)
        database = request.args.get('database', type=int)
        
        # 限制每次扫描数量
        count = min(max(count, 1), 1000)
        
        result = redis_management_service.scan_keys(
            conn_id=conn_id,
            pattern=pattern,
            cursor=cursor,
            count=count,
            database=database,
            tenant_id=g.tenant_id
        )
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Scan keys validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Scan keys error: {e}")
        return jsonify({
            'success': False,
            'message': '扫描键列表失败'
        }), 500


@redis_bp.route('/<int:conn_id>/keys/<path:key>', methods=['GET'])
@tenant_required
def get_key_detail(conn_id, key):
    """
    获取键详情（包含键信息和值）
    
    Path Parameters:
        - conn_id: 连接配置 ID
        - key: 键名
    
    Returns:
        JSON: 键详情
            - key: 键名
            - type: 键类型
            - ttl: 过期时间
            - encoding: 内部编码
            - size: 大小
            - value: 键值
        
    Requirements: 3.4, 3.5, 4.1
    """
    try:
        # 获取键信息
        key_info = redis_management_service.get_key_info(
            conn_id=conn_id,
            key=key,
            tenant_id=g.tenant_id
        )
        
        if not key_info:
            return jsonify({
                'success': False,
                'message': f'键不存在: {key}',
                'error_code': 'REDIS_KEY_NOT_FOUND'
            }), 404
        
        # 获取键值
        key_value = redis_management_service.get_key_value(
            conn_id=conn_id,
            key=key,
            tenant_id=g.tenant_id
        )
        
        # 合并信息
        result = {
            **key_info,
            'value': key_value.get('value') if key_value else None
        }
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Get key detail validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Get key detail error: {e}")
        return jsonify({
            'success': False,
            'message': '获取键详情失败'
        }), 500



@redis_bp.route('/<int:conn_id>/keys', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def create_key(conn_id):
    """
    创建新键
    
    Path Parameters:
        - conn_id: 连接配置 ID
    
    Request Body:
        - key: 键名 (必填)
        - value: 键值 (必填)
        - type: 键类型 ('string', 'list', 'set', 'zset', 'hash')，默认 'string'
        - ttl: 过期时间（秒），可选
    
    Returns:
        JSON: 创建结果
        
    Requirements: 4.2, 4.3, 7.2, 7.3
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        key = data.get('key')
        value = data.get('value')
        key_type = data.get('type', 'string')
        ttl = data.get('ttl')
        
        if not key:
            return jsonify({
                'success': False,
                'message': '键名不能为空'
            }), 400
        
        if value is None:
            return jsonify({
                'success': False,
                'message': '键值不能为空'
            }), 400
        
        result = redis_management_service.set_key_value(
            conn_id=conn_id,
            key=key,
            value=value,
            key_type=key_type,
            ttl=ttl,
            tenant_id=g.tenant_id
        )
        
        # 记录操作日志
        log_redis_operation(
            action='create_key',
            resource='redis_key',
            resource_id=conn_id,
            details={
                'key': key,
                'type': key_type,
                'ttl': ttl
            }
        )
        
        return jsonify({
            'success': True,
            'data': {
                'key': key,
                'type': key_type,
                'created': result
            },
            'message': '键创建成功'
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Create key validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Create key error: {e}")
        return jsonify({
            'success': False,
            'message': '创建键失败'
        }), 500


@redis_bp.route('/<int:conn_id>/keys/<path:key>/update', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def update_key(conn_id, key):
    """
    更新键值
    
    Path Parameters:
        - conn_id: 连接配置 ID
        - key: 键名
    
    Request Body:
        - value: 新的键值 (必填)
        - type: 键类型 (可选，默认保持原类型)
        - ttl: 过期时间（秒），可选
    
    Returns:
        JSON: 更新结果
        
    Requirements: 4.3, 7.2, 7.3
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        value = data.get('value')
        key_type = data.get('type', 'string')
        ttl = data.get('ttl')
        
        if value is None:
            return jsonify({
                'success': False,
                'message': '键值不能为空'
            }), 400
        
        result = redis_management_service.set_key_value(
            conn_id=conn_id,
            key=key,
            value=value,
            key_type=key_type,
            ttl=ttl,
            tenant_id=g.tenant_id
        )
        
        # 记录操作日志
        log_redis_operation(
            action='update_key',
            resource='redis_key',
            resource_id=conn_id,
            details={
                'key': key,
                'type': key_type,
                'ttl': ttl
            }
        )
        
        return jsonify({
            'success': True,
            'data': {
                'key': key,
                'updated': result
            },
            'message': '键值更新成功'
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Update key validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Update key error: {e}")
        return jsonify({
            'success': False,
            'message': '更新键值失败'
        }), 500


@redis_bp.route('/<int:conn_id>/keys/delete', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def delete_keys(conn_id):
    """
    删除键（支持批量删除）
    
    Path Parameters:
        - conn_id: 连接配置 ID
    
    Request Body:
        - keys: 要删除的键名列表 (必填)
    
    Returns:
        JSON: 删除结果
            - deleted_count: 实际删除的键数量
        
    Requirements: 4.8, 4.9, 7.2, 7.3
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        keys = data.get('keys')
        
        if not keys or not isinstance(keys, list):
            return jsonify({
                'success': False,
                'message': '键列表不能为空'
            }), 400
        
        deleted_count = redis_management_service.delete_keys(
            conn_id=conn_id,
            keys=keys,
            tenant_id=g.tenant_id
        )
        
        # 记录操作日志
        log_redis_operation(
            action='delete_keys',
            resource='redis_key',
            resource_id=conn_id,
            details={
                'keys': keys,
                'deleted_count': deleted_count
            }
        )
        
        return jsonify({
            'success': True,
            'data': {
                'deleted_count': deleted_count,
                'requested_count': len(keys)
            },
            'message': f'成功删除 {deleted_count} 个键'
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Delete keys validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Delete keys error: {e}")
        return jsonify({
            'success': False,
            'message': '删除键失败'
        }), 500


@redis_bp.route('/<int:conn_id>/keys/<path:key>/ttl', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def set_key_ttl(conn_id, key):
    """
    设置键的过期时间
    
    Path Parameters:
        - conn_id: 连接配置 ID
        - key: 键名
    
    Request Body:
        - ttl: 过期时间（秒），设为 -1 或 0 表示移除过期时间
    
    Returns:
        JSON: 设置结果
        
    Requirements: 4.10, 4.11, 7.2, 7.3
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        ttl = data.get('ttl')
        
        if ttl is None:
            return jsonify({
                'success': False,
                'message': 'TTL 不能为空'
            }), 400
        
        # 如果 TTL <= 0，移除过期时间
        if ttl <= 0:
            result = redis_management_service.remove_key_ttl(
                conn_id=conn_id,
                key=key,
                tenant_id=g.tenant_id
            )
            message = '已移除过期时间'
        else:
            result = redis_management_service.set_key_ttl(
                conn_id=conn_id,
                key=key,
                ttl=ttl,
                tenant_id=g.tenant_id
            )
            message = f'已设置过期时间为 {ttl} 秒'
        
        # 记录操作日志
        log_redis_operation(
            action='set_ttl',
            resource='redis_key',
            resource_id=conn_id,
            details={
                'key': key,
                'ttl': ttl if ttl > 0 else -1,
                'action': 'remove' if ttl <= 0 else 'set'
            }
        )
        
        return jsonify({
            'success': True,
            'data': {
                'key': key,
                'ttl': ttl if ttl > 0 else -1,
                'updated': result
            },
            'message': message
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Set TTL validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Set TTL error: {e}")
        return jsonify({
            'success': False,
            'message': '设置过期时间失败'
        }), 500



# ==================== Hash 类型操作 API ====================

@redis_bp.route('/<int:conn_id>/hash/<path:key>', methods=['GET'])
@tenant_required
def get_hash(conn_id, key):
    """
    获取 Hash 的所有字段和值
    
    Path Parameters:
        - conn_id: 连接配置 ID
        - key: 键名
    
    Returns:
        JSON: Hash 字段和值
        
    Requirements: 4.4
    """
    try:
        result = redis_management_service.hget_all(
            conn_id=conn_id,
            key=key,
            tenant_id=g.tenant_id
        )
        
        if result is None:
            return jsonify({
                'success': False,
                'message': f'键不存在: {key}',
                'error_code': 'REDIS_KEY_NOT_FOUND'
            }), 404
        
        return jsonify({
            'success': True,
            'data': {
                'key': key,
                'type': 'hash',
                'fields': result,
                'field_count': len(result)
            }
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Get hash validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Get hash error: {e}")
        return jsonify({
            'success': False,
            'message': '获取 Hash 失败'
        }), 500


@redis_bp.route('/<int:conn_id>/hash/<path:key>', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def set_hash_field(conn_id, key):
    """
    设置 Hash 字段的值
    
    Path Parameters:
        - conn_id: 连接配置 ID
        - key: 键名
    
    Request Body:
        - field: 字段名 (必填)
        - value: 字段值 (必填)
    
    Returns:
        JSON: 设置结果
        
    Requirements: 4.4, 7.2, 7.3
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        field = data.get('field')
        value = data.get('value')
        
        if not field:
            return jsonify({
                'success': False,
                'message': '字段名不能为空'
            }), 400
        
        if value is None:
            return jsonify({
                'success': False,
                'message': '字段值不能为空'
            }), 400
        
        is_new = redis_management_service.hset(
            conn_id=conn_id,
            key=key,
            field=field,
            value=str(value),
            tenant_id=g.tenant_id
        )
        
        # 记录操作日志
        log_redis_operation(
            action='hset',
            resource='redis_hash',
            resource_id=conn_id,
            details={
                'key': key,
                'field': field,
                'is_new': is_new
            }
        )
        
        return jsonify({
            'success': True,
            'data': {
                'key': key,
                'field': field,
                'is_new': is_new
            },
            'message': '字段新增成功' if is_new else '字段更新成功'
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Set hash field validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Set hash field error: {e}")
        return jsonify({
            'success': False,
            'message': '设置 Hash 字段失败'
        }), 500


@redis_bp.route('/<int:conn_id>/hash/<path:key>/delete-fields', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def delete_hash_fields(conn_id, key):
    """
    删除 Hash 字段
    
    Path Parameters:
        - conn_id: 连接配置 ID
        - key: 键名
    
    Request Body:
        - fields: 要删除的字段名列表 (必填)
    
    Returns:
        JSON: 删除结果
        
    Requirements: 4.4, 7.2, 7.3
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        fields = data.get('fields')
        
        if not fields or not isinstance(fields, list):
            return jsonify({
                'success': False,
                'message': '字段列表不能为空'
            }), 400
        
        deleted_count = redis_management_service.hdel(
            conn_id=conn_id,
            key=key,
            fields=fields,
            tenant_id=g.tenant_id
        )
        
        # 记录操作日志
        log_redis_operation(
            action='hdel',
            resource='redis_hash',
            resource_id=conn_id,
            details={
                'key': key,
                'fields': fields,
                'deleted_count': deleted_count
            }
        )
        
        return jsonify({
            'success': True,
            'data': {
                'key': key,
                'deleted_count': deleted_count,
                'requested_count': len(fields)
            },
            'message': f'成功删除 {deleted_count} 个字段'
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Delete hash fields validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Delete hash fields error: {e}")
        return jsonify({
            'success': False,
            'message': '删除 Hash 字段失败'
        }), 500


# ==================== List 类型操作 API ====================

@redis_bp.route('/<int:conn_id>/list/<path:key>', methods=['GET'])
@tenant_required
def get_list(conn_id, key):
    """
    获取 List 元素
    
    Path Parameters:
        - conn_id: 连接配置 ID
        - key: 键名
    
    Query Parameters:
        - start: 起始索引 (默认 0)
        - stop: 结束索引 (默认 -1，表示最后一个元素)
    
    Returns:
        JSON: List 元素列表
        
    Requirements: 4.5
    """
    try:
        start = request.args.get('start', 0, type=int)
        stop = request.args.get('stop', -1, type=int)
        
        result = redis_management_service.lrange(
            conn_id=conn_id,
            key=key,
            start=start,
            stop=stop,
            tenant_id=g.tenant_id
        )
        
        if result is None:
            return jsonify({
                'success': False,
                'message': f'键不存在: {key}',
                'error_code': 'REDIS_KEY_NOT_FOUND'
            }), 404
        
        return jsonify({
            'success': True,
            'data': {
                'key': key,
                'type': 'list',
                'elements': result,
                'element_count': len(result)
            }
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Get list validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Get list error: {e}")
        return jsonify({
            'success': False,
            'message': '获取 List 失败'
        }), 500


@redis_bp.route('/<int:conn_id>/list/<path:key>', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def add_list_elements(conn_id, key):
    """
    向 List 添加元素
    
    Path Parameters:
        - conn_id: 连接配置 ID
        - key: 键名
    
    Request Body:
        - values: 要添加的值列表 (必填)
        - position: 添加位置 ('head' 或 'tail'，默认 'head')
    
    Returns:
        JSON: 添加结果
        
    Requirements: 4.5, 7.2, 7.3
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        values = data.get('values')
        
        if not values or not isinstance(values, list):
            return jsonify({
                'success': False,
                'message': '值列表不能为空'
            }), 400
        
        # 将所有值转换为字符串
        values = [str(v) for v in values]
        
        new_length = redis_management_service.lpush(
            conn_id=conn_id,
            key=key,
            values=values,
            tenant_id=g.tenant_id
        )
        
        # 记录操作日志
        log_redis_operation(
            action='lpush',
            resource='redis_list',
            resource_id=conn_id,
            details={
                'key': key,
                'added_count': len(values),
                'new_length': new_length
            }
        )
        
        return jsonify({
            'success': True,
            'data': {
                'key': key,
                'added_count': len(values),
                'new_length': new_length
            },
            'message': f'成功添加 {len(values)} 个元素'
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Add list elements validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Add list elements error: {e}")
        return jsonify({
            'success': False,
            'message': '添加 List 元素失败'
        }), 500


@redis_bp.route('/<int:conn_id>/list/<path:key>/delete-elements', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def delete_list_elements(conn_id, key):
    """
    从 List 中删除元素
    
    Path Parameters:
        - conn_id: 连接配置 ID
        - key: 键名
    
    Request Body:
        - value: 要删除的值 (必填)
        - count: 删除数量 (默认 0，表示删除所有匹配的元素)
    
    Returns:
        JSON: 删除结果
        
    Requirements: 4.5, 7.2, 7.3
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        value = data.get('value')
        count = data.get('count', 0)
        
        if value is None:
            return jsonify({
                'success': False,
                'message': '值不能为空'
            }), 400
        
        removed_count = redis_management_service.lrem(
            conn_id=conn_id,
            key=key,
            count=count,
            value=str(value),
            tenant_id=g.tenant_id
        )
        
        # 记录操作日志
        log_redis_operation(
            action='lrem',
            resource='redis_list',
            resource_id=conn_id,
            details={
                'key': key,
                'value': str(value),
                'removed_count': removed_count
            }
        )
        
        return jsonify({
            'success': True,
            'data': {
                'key': key,
                'removed_count': removed_count
            },
            'message': f'成功删除 {removed_count} 个元素'
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Delete list elements validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Delete list elements error: {e}")
        return jsonify({
            'success': False,
            'message': '删除 List 元素失败'
        }), 500


# ==================== Set 类型操作 API ====================

@redis_bp.route('/<int:conn_id>/set/<path:key>', methods=['GET'])
@tenant_required
def get_set(conn_id, key):
    """
    获取 Set 的所有成员
    
    Path Parameters:
        - conn_id: 连接配置 ID
        - key: 键名
    
    Returns:
        JSON: Set 成员列表
        
    Requirements: 4.6
    """
    try:
        result = redis_management_service.smembers(
            conn_id=conn_id,
            key=key,
            tenant_id=g.tenant_id
        )
        
        if result is None:
            return jsonify({
                'success': False,
                'message': f'键不存在: {key}',
                'error_code': 'REDIS_KEY_NOT_FOUND'
            }), 404
        
        return jsonify({
            'success': True,
            'data': {
                'key': key,
                'type': 'set',
                'members': result,
                'member_count': len(result)
            }
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Get set validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Get set error: {e}")
        return jsonify({
            'success': False,
            'message': '获取 Set 失败'
        }), 500


@redis_bp.route('/<int:conn_id>/set/<path:key>', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def add_set_members(conn_id, key):
    """
    向 Set 添加成员
    
    Path Parameters:
        - conn_id: 连接配置 ID
        - key: 键名
    
    Request Body:
        - members: 要添加的成员列表 (必填)
    
    Returns:
        JSON: 添加结果
        
    Requirements: 4.6, 7.2, 7.3
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        members = data.get('members')
        
        if not members or not isinstance(members, list):
            return jsonify({
                'success': False,
                'message': '成员列表不能为空'
            }), 400
        
        # 将所有成员转换为字符串
        members = [str(m) for m in members]
        
        added_count = redis_management_service.sadd(
            conn_id=conn_id,
            key=key,
            members=members,
            tenant_id=g.tenant_id
        )
        
        # 记录操作日志
        log_redis_operation(
            action='sadd',
            resource='redis_set',
            resource_id=conn_id,
            details={
                'key': key,
                'added_count': added_count,
                'requested_count': len(members)
            }
        )
        
        return jsonify({
            'success': True,
            'data': {
                'key': key,
                'added_count': added_count,
                'requested_count': len(members)
            },
            'message': f'成功添加 {added_count} 个成员'
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Add set members validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Add set members error: {e}")
        return jsonify({
            'success': False,
            'message': '添加 Set 成员失败'
        }), 500


@redis_bp.route('/<int:conn_id>/set/<path:key>/delete-members', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def delete_set_members(conn_id, key):
    """
    从 Set 中删除成员
    
    Path Parameters:
        - conn_id: 连接配置 ID
        - key: 键名
    
    Request Body:
        - members: 要删除的成员列表 (必填)
    
    Returns:
        JSON: 删除结果
        
    Requirements: 4.6, 7.2, 7.3
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        members = data.get('members')
        
        if not members or not isinstance(members, list):
            return jsonify({
                'success': False,
                'message': '成员列表不能为空'
            }), 400
        
        # 将所有成员转换为字符串
        members = [str(m) for m in members]
        
        removed_count = redis_management_service.srem(
            conn_id=conn_id,
            key=key,
            members=members,
            tenant_id=g.tenant_id
        )
        
        # 记录操作日志
        log_redis_operation(
            action='srem',
            resource='redis_set',
            resource_id=conn_id,
            details={
                'key': key,
                'removed_count': removed_count,
                'requested_count': len(members)
            }
        )
        
        return jsonify({
            'success': True,
            'data': {
                'key': key,
                'removed_count': removed_count,
                'requested_count': len(members)
            },
            'message': f'成功删除 {removed_count} 个成员'
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Delete set members validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Delete set members error: {e}")
        return jsonify({
            'success': False,
            'message': '删除 Set 成员失败'
        }), 500


# ==================== ZSet 类型操作 API ====================

@redis_bp.route('/<int:conn_id>/zset/<path:key>', methods=['GET'])
@tenant_required
def get_zset(conn_id, key):
    """
    获取 ZSet 成员
    
    Path Parameters:
        - conn_id: 连接配置 ID
        - key: 键名
    
    Query Parameters:
        - start: 起始索引 (默认 0)
        - stop: 结束索引 (默认 -1，表示最后一个元素)
        - withscores: 是否包含分数 (默认 true)
    
    Returns:
        JSON: ZSet 成员列表
        
    Requirements: 4.7
    """
    try:
        start = request.args.get('start', 0, type=int)
        stop = request.args.get('stop', -1, type=int)
        withscores = request.args.get('withscores', 'true').lower() == 'true'
        
        result = redis_management_service.zrange(
            conn_id=conn_id,
            key=key,
            start=start,
            stop=stop,
            withscores=withscores,
            tenant_id=g.tenant_id
        )
        
        if result is None:
            return jsonify({
                'success': False,
                'message': f'键不存在: {key}',
                'error_code': 'REDIS_KEY_NOT_FOUND'
            }), 404
        
        # 格式化结果
        if withscores:
            members = [{'member': m, 'score': s} for m, s in result]
        else:
            members = result
        
        return jsonify({
            'success': True,
            'data': {
                'key': key,
                'type': 'zset',
                'members': members,
                'member_count': len(members)
            }
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Get zset validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Get zset error: {e}")
        return jsonify({
            'success': False,
            'message': '获取 ZSet 失败'
        }), 500


@redis_bp.route('/<int:conn_id>/zset/<path:key>', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def add_zset_members(conn_id, key):
    """
    向 ZSet 添加成员
    
    Path Parameters:
        - conn_id: 连接配置 ID
        - key: 键名
    
    Request Body:
        - members: 成员和分数的映射 {member: score, ...} 或列表 [{member, score}, ...]
    
    Returns:
        JSON: 添加结果
        
    Requirements: 4.7, 7.2, 7.3
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        members = data.get('members')
        
        if not members:
            return jsonify({
                'success': False,
                'message': '成员数据不能为空'
            }), 400
        
        # 转换为 {member: score} 格式
        if isinstance(members, list):
            mapping = {}
            for item in members:
                if isinstance(item, dict) and 'member' in item and 'score' in item:
                    mapping[str(item['member'])] = float(item['score'])
                else:
                    return jsonify({
                        'success': False,
                        'message': '成员格式错误，需要 {member, score} 格式'
                    }), 400
        elif isinstance(members, dict):
            mapping = {str(k): float(v) for k, v in members.items()}
        else:
            return jsonify({
                'success': False,
                'message': '成员数据格式错误'
            }), 400
        
        added_count = redis_management_service.zadd(
            conn_id=conn_id,
            key=key,
            mapping=mapping,
            tenant_id=g.tenant_id
        )
        
        # 记录操作日志
        log_redis_operation(
            action='zadd',
            resource='redis_zset',
            resource_id=conn_id,
            details={
                'key': key,
                'added_count': added_count,
                'requested_count': len(mapping)
            }
        )
        
        return jsonify({
            'success': True,
            'data': {
                'key': key,
                'added_count': added_count,
                'requested_count': len(mapping)
            },
            'message': f'成功添加 {added_count} 个成员'
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Add zset members validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Add zset members error: {e}")
        return jsonify({
            'success': False,
            'message': '添加 ZSet 成员失败'
        }), 500


@redis_bp.route('/<int:conn_id>/zset/<path:key>/delete-members', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def delete_zset_members(conn_id, key):
    """
    从 ZSet 中删除成员
    
    Path Parameters:
        - conn_id: 连接配置 ID
        - key: 键名
    
    Request Body:
        - members: 要删除的成员列表 (必填)
    
    Returns:
        JSON: 删除结果
        
    Requirements: 4.7, 7.2, 7.3
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        members = data.get('members')
        
        if not members or not isinstance(members, list):
            return jsonify({
                'success': False,
                'message': '成员列表不能为空'
            }), 400
        
        # 将所有成员转换为字符串
        members = [str(m) for m in members]
        
        removed_count = redis_management_service.zrem(
            conn_id=conn_id,
            key=key,
            members=members,
            tenant_id=g.tenant_id
        )
        
        # 记录操作日志
        log_redis_operation(
            action='zrem',
            resource='redis_zset',
            resource_id=conn_id,
            details={
                'key': key,
                'removed_count': removed_count,
                'requested_count': len(members)
            }
        )
        
        return jsonify({
            'success': True,
            'data': {
                'key': key,
                'removed_count': removed_count,
                'requested_count': len(members)
            },
            'message': f'成功删除 {removed_count} 个成员'
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Delete zset members validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Delete zset members error: {e}")
        return jsonify({
            'success': False,
            'message': '删除 ZSet 成员失败'
        }), 500


# ==================== 服务器信息 API ====================

@redis_bp.route('/<int:conn_id>/info', methods=['GET'])
@tenant_required
def get_server_info(conn_id):
    """
    获取 Redis 服务器信息
    
    解析 INFO 命令返回的结果，提取关键信息。
    
    Path Parameters:
        - conn_id: 连接配置 ID
    
    Returns:
        JSON: 服务器信息
            - redis_version: Redis 版本
            - redis_mode: 运行模式 (standalone/cluster/sentinel)
            - os: 操作系统
            - arch_bits: 架构位数
            - uptime_in_seconds: 运行时间（秒）
            - uptime_in_days: 运行时间（天）
            - connected_clients: 已连接客户端数
            - blocked_clients: 阻塞客户端数
            - used_memory: 已用内存（字节）
            - used_memory_human: 已用内存（人类可读）
            - used_memory_peak: 内存峰值（字节）
            - used_memory_peak_human: 内存峰值（人类可读）
            - mem_fragmentation_ratio: 内存碎片率
            - total_connections_received: 总连接数
            - total_commands_processed: 总命令数
            - instantaneous_ops_per_sec: 每秒操作数
            - keyspace_hits: 键空间命中数
            - keyspace_misses: 键空间未命中数
            - hit_rate: 命中率（百分比）
            - rdb_last_save_time: RDB 最后保存时间
            - aof_enabled: AOF 是否启用
            - role: 角色 (master/slave)
            - connected_slaves: 已连接从节点数
            - db_info: 各数据库键数量信息
        
    Requirements: 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
    """
    try:
        result = redis_management_service.get_server_info(
            conn_id=conn_id,
            tenant_id=g.tenant_id
        )
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Get server info validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Get server info error: {e}")
        return jsonify({
            'success': False,
            'message': '获取服务器信息失败'
        }), 500


@redis_bp.route('/<int:conn_id>/cluster/info', methods=['GET'])
@tenant_required
def get_cluster_info(conn_id):
    """
    获取 Redis 集群信息
    
    解析 CLUSTER INFO 命令返回的结果。仅适用于集群模式的连接。
    
    Path Parameters:
        - conn_id: 连接配置 ID
    
    Returns:
        JSON: 集群信息
            - cluster_state: 集群状态 (ok/fail)
            - cluster_slots_assigned: 已分配槽位数
            - cluster_slots_ok: 正常槽位数
            - cluster_slots_pfail: 可能失败槽位数
            - cluster_slots_fail: 失败槽位数
            - cluster_known_nodes: 已知节点数
            - cluster_size: 集群大小（主节点数）
            - cluster_current_epoch: 当前纪元
            - cluster_my_epoch: 本节点纪元
            - cluster_stats_messages_sent: 发送消息数
            - cluster_stats_messages_received: 接收消息数
        
    Requirements: 5.1, 5.3, 5.4
    """
    try:
        result = redis_management_service.get_cluster_info(
            conn_id=conn_id,
            tenant_id=g.tenant_id
        )
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Get cluster info validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Get cluster info error: {e}")
        return jsonify({
            'success': False,
            'message': '获取集群信息失败'
        }), 500


@redis_bp.route('/<int:conn_id>/cluster/nodes', methods=['GET'])
@tenant_required
def get_cluster_nodes(conn_id):
    """
    获取 Redis 集群节点列表
    
    解析 CLUSTER NODES 命令返回的结果。仅适用于集群模式的连接。
    
    Path Parameters:
        - conn_id: 连接配置 ID
    
    Returns:
        JSON: 节点列表
            - nodes: 节点信息列表，每个节点包含:
                - id: 节点 ID
                - host: 主机地址
                - port: 端口
                - cport: 集群总线端口
                - flags: 节点标志列表
                - role: 角色 (master/slave)
                - master_id: 主节点 ID（如果是从节点）
                - ping_sent: 最后发送 PING 时间
                - pong_recv: 最后接收 PONG 时间
                - config_epoch: 配置纪元
                - link_state: 连接状态 (connected/disconnected)
                - slots: 槽位范围列表（如果是主节点）
                - is_myself: 是否是当前连接的节点
                - is_fail: 是否处于失败状态
            - total_nodes: 节点总数
            - master_count: 主节点数
            - slave_count: 从节点数
        
    Requirements: 5.1, 5.2, 5.4
    """
    try:
        nodes = redis_management_service.get_cluster_nodes(
            conn_id=conn_id,
            tenant_id=g.tenant_id
        )
        
        # 统计节点数量
        master_count = sum(1 for n in nodes if n['role'] == 'master')
        slave_count = sum(1 for n in nodes if n['role'] == 'slave')
        
        return jsonify({
            'success': True,
            'data': {
                'nodes': nodes,
                'total_nodes': len(nodes),
                'master_count': master_count,
                'slave_count': slave_count
            }
        })
        
    except RedisConnectionException as e:
        logger.warning(f"Redis connection error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}',
            'error_code': 'REDIS_CONNECTION_FAILED'
        }), 400
    except RedisTimeoutException as e:
        logger.warning(f"Redis timeout error: {e}")
        return jsonify({
            'success': False,
            'message': f'连接超时: {str(e)}',
            'error_code': 'REDIS_CONNECTION_TIMEOUT'
        }), 408
    except RedisOperationError as e:
        logger.warning(f"Redis operation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'REDIS_OPERATION_FAILED'
        }), 400
    except ValueError as e:
        logger.warning(f"Get cluster nodes validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Get cluster nodes error: {e}")
        return jsonify({
            'success': False,
            'message': '获取集群节点失败'
        }), 500
