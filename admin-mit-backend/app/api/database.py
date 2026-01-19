"""
数据库管理 API

提供数据库连接配置的 CRUD 操作，Schema 浏览，SQL 查询执行等 API。
注意：所有 API 只使用 GET 和 POST 方法，不使用 PUT/DELETE。

Requirements: 1.1, 1.3, 1.4, 1.5, 3.1-3.6, 4.2-4.8, 6.1, 6.2, 6.3, 6.4
"""
from flask import Blueprint, request, jsonify, g, Response
from app.core.middleware import tenant_required, role_required
from app.services.database_management import (
    database_management_service,
    DatabaseError,
    DatabaseConnectionError,
    DatabaseQueryError,
    DatabaseTimeoutError,
    UnsupportedDatabaseTypeError,
)
from app.services.operation_log_service import operation_log_service
import logging

logger = logging.getLogger(__name__)
database_bp = Blueprint('database', __name__)


def log_database_operation(action, resource, resource_id=None, details=None):
    """记录数据库操作日志的辅助函数"""
    try:
        operation_log_service.log_operation(
            action=action,
            resource=resource,
            resource_id=resource_id,
            details=details
        )
    except Exception as e:
        logger.warning(f"Failed to log database operation: {e}")


# ==================== 数据库类型 API ====================

@database_bp.route('/types', methods=['GET'])
@tenant_required
def get_database_types():
    """
    获取支持的数据库类型列表
    
    Returns:
        JSON: 数据库类型列表
        
    Requirements: 8.5, 8.6
    """
    try:
        types = database_management_service.get_supported_types()
        
        return jsonify({
            'success': True,
            'data': {
                'types': types
            }
        })
        
    except Exception as e:
        logger.error(f"Get database types error: {e}")
        return jsonify({
            'success': False,
            'message': '获取数据库类型列表失败'
        }), 500


# ==================== 连接配置管理 API ====================

@database_bp.route('/connections', methods=['GET'])
@tenant_required
def list_connections():
    """
    获取数据库连接配置列表
    
    Query Parameters:
        - page: 页码 (默认 1)
        - per_page: 每页数量 (默认 50)
        - search: 搜索关键词
        - db_type: 数据库类型过滤
        - status: 状态过滤 (0-禁用, 1-启用)
    
    Returns:
        JSON: 连接列表和分页信息
        
    Requirements: 1.1
    """
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        search = request.args.get('search', '')
        db_type = request.args.get('db_type', '')
        status = request.args.get('status', type=int)
        
        # 限制每页最大数量
        per_page = min(per_page, 100)
        
        result = database_management_service.list_connections(
            tenant_id=g.tenant_id,
            page=page,
            per_page=per_page,
            search=search,
            db_type=db_type if db_type else None,
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


@database_bp.route('/connections', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def create_connection():
    """
    创建数据库连接配置
    
    Request Body:
        - name: 连接名称 (必填)
        - db_type: 数据库类型 ('postgresql', 'mysql', 'dm', 'oracle')
        - host: 主机地址 (必填)
        - port: 端口 (可选，使用默认端口)
        - username: 用户名 (必填)
        - password: 密码 (可选)
        - database: 数据库名 (可选)
        - schema: Schema 名称 (可选)
        - service_name: Oracle Service Name (可选)
        - sid: Oracle SID (可选)
        - timeout: 连接超时 (默认 10)
        - description: 描述 (可选)
        - status: 状态 (默认 1)
    
    Returns:
        JSON: 创建的连接配置
        
    Requirements: 1.1, 6.1, 6.2, 6.4
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        connection = database_management_service.create_connection(
            config=data,
            tenant_id=g.tenant_id
        )
        
        # 记录操作日志
        log_database_operation(
            action='create',
            resource='database_connection',
            resource_id=connection.id,
            details={
                'name': data.get('name'),
                'db_type': data.get('db_type'),
                'host': data.get('host'),
                'port': data.get('port')
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


@database_bp.route('/connections/<int:connection_id>', methods=['GET'])
@tenant_required
def get_connection(connection_id):
    """
    获取数据库连接配置详情
    
    Path Parameters:
        - connection_id: 连接配置 ID
    
    Returns:
        JSON: 连接配置详情
        
    Requirements: 1.1
    """
    try:
        connection = database_management_service.get_connection(
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


@database_bp.route('/connections/<int:connection_id>/update', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def update_connection(connection_id):
    """
    更新数据库连接配置
    
    Path Parameters:
        - connection_id: 连接配置 ID
    
    Request Body:
        - name: 连接名称
        - db_type: 数据库类型
        - host: 主机地址
        - port: 端口
        - username: 用户名
        - password: 密码
        - database: 数据库名
        - schema: Schema 名称
        - service_name: Oracle Service Name
        - sid: Oracle SID
        - timeout: 连接超时
        - description: 描述
        - status: 状态
    
    Returns:
        JSON: 更新后的连接配置
        
    Requirements: 1.3, 6.1, 6.2, 6.4
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        connection = database_management_service.update_connection(
            connection_id=connection_id,
            config=data,
            tenant_id=g.tenant_id
        )
        
        # 记录操作日志
        log_database_operation(
            action='update',
            resource='database_connection',
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


@database_bp.route('/connections/<int:connection_id>/delete', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def delete_connection(connection_id):
    """
    删除数据库连接配置
    
    Path Parameters:
        - connection_id: 连接配置 ID
    
    Returns:
        JSON: 删除结果
        
    Requirements: 1.4, 6.1, 6.2, 6.4
    """
    try:
        result = database_management_service.delete_connection(
            connection_id=connection_id,
            tenant_id=g.tenant_id
        )
        
        if result:
            # 记录操作日志
            log_database_operation(
                action='delete',
                resource='database_connection',
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


@database_bp.route('/connections/<int:connection_id>/test', methods=['POST'])
@tenant_required
def test_connection(connection_id):
    """
    测试已保存的数据库连接
    
    Path Parameters:
        - connection_id: 连接配置 ID
    
    Returns:
        JSON: 测试结果
        
    Requirements: 1.5
    """
    try:
        success, message = database_management_service.test_connection(
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


@database_bp.route('/connections/test', methods=['POST'])
@tenant_required
def test_connection_config():
    """
    测试连接配置（不保存）
    
    Request Body:
        - db_type: 数据库类型 ('postgresql', 'mysql', 'dm', 'oracle')
        - host: 主机地址
        - port: 端口
        - username: 用户名
        - password: 密码 (可选)
        - database: 数据库名 (可选)
        - service_name: Oracle Service Name (可选)
        - sid: Oracle SID (可选)
        - timeout: 连接超时 (默认 10)
    
    Returns:
        JSON: 测试结果
        
    Requirements: 1.5
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        success, message = database_management_service.test_connection_config(config=data)
        
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

@database_bp.route('/connections/<int:connection_id>/connect', methods=['POST'])
@tenant_required
def connect_database(connection_id):
    """
    建立数据库连接
    
    Path Parameters:
        - connection_id: 连接配置 ID
    
    Returns:
        JSON: 连接结果
        
    Requirements: 2.1, 2.2, 2.3
    """
    try:
        from app.services.database_management import database_connection_manager
        from app.models.database_connection import DatabaseConnection
        
        # 获取连接配置
        connection_config = DatabaseConnection.get_by_tenant(connection_id, g.tenant_id)
        if not connection_config:
            return jsonify({
                'success': False,
                'message': '连接配置不存在'
            }), 404
        
        # 建立连接
        client = database_connection_manager.get_client(
            conn_id=connection_id,
            tenant_id=g.tenant_id,
            connection_config=connection_config
        )
        
        # 记录操作日志
        log_database_operation(
            action='connect',
            resource='database_connection',
            resource_id=connection_id,
            details={
                'name': connection_config.name,
                'db_type': connection_config.db_type,
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
        logger.warning(f"Connect database validation error: {e}")
        return jsonify({
            'success': False,
            'data': {
                'connected': False,
                'connection_id': connection_id
            },
            'message': str(e)
        }), 400
    except DatabaseConnectionError as e:
        logger.warning(f"Database connection error: {e}")
        return jsonify({
            'success': False,
            'data': {
                'connected': False,
                'connection_id': connection_id
            },
            'message': str(e),
            'error_code': 'DB_CONNECTION_FAILED'
        }), 400
    except DatabaseTimeoutError as e:
        logger.warning(f"Database timeout error: {e}")
        return jsonify({
            'success': False,
            'data': {
                'connected': False,
                'connection_id': connection_id
            },
            'message': str(e),
            'error_code': 'DB_CONNECTION_TIMEOUT'
        }), 408
    except UnsupportedDatabaseTypeError as e:
        logger.warning(f"Unsupported database type error: {e}")
        return jsonify({
            'success': False,
            'data': {
                'connected': False,
                'connection_id': connection_id
            },
            'message': str(e),
            'error_code': 'UNSUPPORTED_DB_TYPE'
        }), 400
    except Exception as e:
        logger.error(f"Connect database error: {e}")
        return jsonify({
            'success': False,
            'data': {
                'connected': False,
                'connection_id': connection_id
            },
            'message': '连接失败'
        }), 500


@database_bp.route('/connections/<int:connection_id>/disconnect', methods=['POST'])
@tenant_required
def disconnect_database(connection_id):
    """
    断开数据库连接
    
    Path Parameters:
        - connection_id: 连接配置 ID
    
    Returns:
        JSON: 断开结果
        
    Requirements: 2.4
    """
    try:
        from app.services.database_management import database_connection_manager
        
        # 关闭连接
        result = database_connection_manager.close_client(
            conn_id=connection_id,
            tenant_id=g.tenant_id
        )
        
        # 记录操作日志
        log_database_operation(
            action='disconnect',
            resource='database_connection',
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


# ==================== Schema 浏览 API ====================

@database_bp.route('/<int:conn_id>/databases', methods=['GET'])
@tenant_required
def get_databases(conn_id):
    """
    获取数据库列表
    
    Path Parameters:
        - conn_id: 连接配置 ID
    
    Returns:
        JSON: 数据库列表
        
    Requirements: 3.1
    """
    try:
        databases = database_management_service.get_databases(
            connection_id=conn_id,
            tenant_id=g.tenant_id
        )
        
        return jsonify({
            'success': True,
            'data': {
                'databases': databases
            }
        })
        
    except ValueError as e:
        logger.warning(f"Get databases validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except DatabaseConnectionError as e:
        logger.warning(f"Database connection error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'DB_CONNECTION_FAILED'
        }), 400
    except DatabaseQueryError as e:
        logger.warning(f"Database query error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'DB_QUERY_ERROR'
        }), 400
    except Exception as e:
        logger.error(f"Get databases error: {e}")
        return jsonify({
            'success': False,
            'message': '获取数据库列表失败'
        }), 500


@database_bp.route('/<int:conn_id>/schemas', methods=['GET'])
@tenant_required
def get_schemas(conn_id):
    """
    获取 Schema 列表
    
    Path Parameters:
        - conn_id: 连接配置 ID
    
    Query Parameters:
        - database: 数据库名（可选，用于 PostgreSQL）
    
    Returns:
        JSON: Schema 列表
        
    Requirements: 3.2
    """
    try:
        database = request.args.get('database', '')
        
        schemas = database_management_service.get_schemas(
            connection_id=conn_id,
            database=database if database else None,
            tenant_id=g.tenant_id
        )
        
        return jsonify({
            'success': True,
            'data': {
                'schemas': schemas
            }
        })
        
    except ValueError as e:
        logger.warning(f"Get schemas validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except DatabaseConnectionError as e:
        logger.warning(f"Database connection error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'DB_CONNECTION_FAILED'
        }), 400
    except DatabaseQueryError as e:
        logger.warning(f"Database query error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'DB_QUERY_ERROR'
        }), 400
    except Exception as e:
        logger.error(f"Get schemas error: {e}")
        return jsonify({
            'success': False,
            'message': '获取 Schema 列表失败'
        }), 500


@database_bp.route('/<int:conn_id>/tables', methods=['GET'])
@tenant_required
def get_tables(conn_id):
    """
    获取表列表
    
    Path Parameters:
        - conn_id: 连接配置 ID
    
    Query Parameters:
        - schema: Schema 名称（可选）
        - search: 搜索关键词（可选）
    
    Returns:
        JSON: 表列表
        
    Requirements: 3.3, 3.6
    """
    try:
        schema = request.args.get('schema', '')
        search = request.args.get('search', '')
        
        tables = database_management_service.get_tables(
            connection_id=conn_id,
            schema=schema if schema else None,
            search=search if search else None,
            tenant_id=g.tenant_id
        )
        
        return jsonify({
            'success': True,
            'data': {
                'tables': tables
            }
        })
        
    except ValueError as e:
        logger.warning(f"Get tables validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except DatabaseConnectionError as e:
        logger.warning(f"Database connection error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'DB_CONNECTION_FAILED'
        }), 400
    except DatabaseQueryError as e:
        logger.warning(f"Database query error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'DB_QUERY_ERROR'
        }), 400
    except Exception as e:
        logger.error(f"Get tables error: {e}")
        return jsonify({
            'success': False,
            'message': '获取表列表失败'
        }), 500


@database_bp.route('/<int:conn_id>/tables/<path:table_name>/columns', methods=['GET'])
@tenant_required
def get_table_columns(conn_id, table_name):
    """
    获取表的列信息
    
    Path Parameters:
        - conn_id: 连接配置 ID
        - table_name: 表名
    
    Query Parameters:
        - schema: Schema 名称（可选）
    
    Returns:
        JSON: 列信息列表
        
    Requirements: 3.4
    """
    try:
        schema = request.args.get('schema', '')
        
        columns = database_management_service.get_table_columns(
            connection_id=conn_id,
            table_name=table_name,
            schema=schema if schema else None,
            tenant_id=g.tenant_id
        )
        
        return jsonify({
            'success': True,
            'data': {
                'columns': columns
            }
        })
        
    except ValueError as e:
        logger.warning(f"Get table columns validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except DatabaseConnectionError as e:
        logger.warning(f"Database connection error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'DB_CONNECTION_FAILED'
        }), 400
    except DatabaseQueryError as e:
        logger.warning(f"Database query error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'DB_QUERY_ERROR'
        }), 400
    except Exception as e:
        logger.error(f"Get table columns error: {e}")
        return jsonify({
            'success': False,
            'message': '获取表列信息失败'
        }), 500


@database_bp.route('/<int:conn_id>/tables/<path:table_name>/indexes', methods=['GET'])
@tenant_required
def get_table_indexes(conn_id, table_name):
    """
    获取表的索引信息
    
    Path Parameters:
        - conn_id: 连接配置 ID
        - table_name: 表名
    
    Query Parameters:
        - schema: Schema 名称（可选）
    
    Returns:
        JSON: 索引信息列表
        
    Requirements: 3.5
    """
    try:
        schema = request.args.get('schema', '')
        
        indexes = database_management_service.get_table_indexes(
            connection_id=conn_id,
            table_name=table_name,
            schema=schema if schema else None,
            tenant_id=g.tenant_id
        )
        
        return jsonify({
            'success': True,
            'data': {
                'indexes': indexes
            }
        })
        
    except ValueError as e:
        logger.warning(f"Get table indexes validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except DatabaseConnectionError as e:
        logger.warning(f"Database connection error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'DB_CONNECTION_FAILED'
        }), 400
    except DatabaseQueryError as e:
        logger.warning(f"Database query error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'DB_QUERY_ERROR'
        }), 400
    except Exception as e:
        logger.error(f"Get table indexes error: {e}")
        return jsonify({
            'success': False,
            'message': '获取表索引信息失败'
        }), 500


# ==================== SQL 查询 API ====================

@database_bp.route('/<int:conn_id>/query', methods=['POST'])
@tenant_required
def execute_query(conn_id):
    """
    执行 SQL 查询
    
    Path Parameters:
        - conn_id: 连接配置 ID
    
    Request Body:
        - sql: SQL 查询语句 (必填)
        - page: 页码 (默认 1)
        - per_page: 每页数量 (默认 50)
        - max_rows: 最大返回行数 (默认 1000)
    
    Returns:
        JSON: 查询结果
            - columns: 列名列表
            - rows: 数据行列表
            - row_count: 返回行数
            - total_count: 总行数
            - execution_time: 执行时间（毫秒）
            - affected_rows: 受影响行数（对于 INSERT/UPDATE/DELETE）
            - is_select: 是否为 SELECT 查询
            - pagination: 分页信息
        
    Requirements: 4.2, 4.3, 4.4, 4.5, 4.8
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        sql = data.get('sql', '').strip()
        if not sql:
            return jsonify({
                'success': False,
                'message': 'SQL 语句不能为空'
            }), 400
        
        page = data.get('page', 1)
        per_page = data.get('per_page', 50)
        max_rows = data.get('max_rows', 1000)
        
        # 限制每页最大数量
        per_page = min(per_page, 100)
        max_rows = min(max_rows, 10000)
        
        result = database_management_service.execute_query(
            connection_id=conn_id,
            sql=sql,
            page=page,
            per_page=per_page,
            max_rows=max_rows,
            tenant_id=g.tenant_id
        )
        
        # 记录操作日志（仅记录非 SELECT 查询）
        sql_upper = sql.upper()
        if not sql_upper.startswith('SELECT') and not sql_upper.startswith('WITH'):
            log_database_operation(
                action='execute_query',
                resource='database_query',
                resource_id=conn_id,
                details={
                    'sql_type': sql.split()[0].upper() if sql.split() else 'UNKNOWN',
                    'affected_rows': result.get('affected_rows')
                }
            )
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except ValueError as e:
        logger.warning(f"Execute query validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except DatabaseConnectionError as e:
        logger.warning(f"Database connection error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'DB_CONNECTION_FAILED'
        }), 400
    except DatabaseQueryError as e:
        logger.warning(f"Database query error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'DB_QUERY_ERROR'
        }), 400
    except DatabaseTimeoutError as e:
        logger.warning(f"Database timeout error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'DB_CONNECTION_TIMEOUT'
        }), 408
    except Exception as e:
        logger.error(f"Execute query error: {e}")
        return jsonify({
            'success': False,
            'message': '查询执行失败'
        }), 500


@database_bp.route('/<int:conn_id>/export', methods=['POST'])
@tenant_required
def export_csv(conn_id):
    """
    导出查询结果为 CSV 格式
    
    Path Parameters:
        - conn_id: 连接配置 ID
    
    Request Body:
        - sql: SQL 查询语句 (必填，只支持 SELECT)
        - max_rows: 最大导出行数 (默认 10000)
    
    Returns:
        CSV 文件下载
        
    Requirements: 4.7
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        sql = data.get('sql', '').strip()
        if not sql:
            return jsonify({
                'success': False,
                'message': 'SQL 语句不能为空'
            }), 400
        
        max_rows = data.get('max_rows', 10000)
        max_rows = min(max_rows, 100000)  # 限制最大导出行数
        
        csv_content = database_management_service.export_csv(
            connection_id=conn_id,
            sql=sql,
            max_rows=max_rows,
            tenant_id=g.tenant_id
        )
        
        # 记录操作日志
        log_database_operation(
            action='export_csv',
            resource='database_query',
            resource_id=conn_id,
            details={
                'sql': sql[:100] + '...' if len(sql) > 100 else sql,
                'max_rows': max_rows
            }
        )
        
        # 返回 CSV 文件
        return Response(
            csv_content,
            mimetype='text/csv',
            headers={
                'Content-Disposition': 'attachment; filename=query_result.csv',
                'Content-Type': 'text/csv; charset=utf-8'
            }
        )
        
    except ValueError as e:
        logger.warning(f"Export CSV validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except DatabaseConnectionError as e:
        logger.warning(f"Database connection error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'DB_CONNECTION_FAILED'
        }), 400
    except DatabaseQueryError as e:
        logger.warning(f"Database query error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'DB_QUERY_ERROR'
        }), 400
    except Exception as e:
        logger.error(f"Export CSV error: {e}")
        return jsonify({
            'success': False,
            'message': 'CSV 导出失败'
        }), 500


# ==================== 服务器信息 API ====================

@database_bp.route('/<int:conn_id>/info', methods=['GET'])
@tenant_required
def get_server_info(conn_id):
    """
    获取数据库服务器信息
    
    Path Parameters:
        - conn_id: 连接配置 ID
    
    Returns:
        JSON: 服务器信息
            - version: 数据库版本
            - uptime: 运行时间
            - connections: 当前连接数
            - database_size: 数据库大小
            - db_type: 数据库类型
            - max_connections: 最大连接数
            - server_encoding: 服务器编码
        
    Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
    """
    try:
        server_info = database_management_service.get_server_info(
            connection_id=conn_id,
            tenant_id=g.tenant_id
        )
        
        return jsonify({
            'success': True,
            'data': server_info
        })
        
    except ValueError as e:
        logger.warning(f"Get server info validation error: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except DatabaseConnectionError as e:
        logger.warning(f"Database connection error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'DB_CONNECTION_FAILED'
        }), 400
    except DatabaseQueryError as e:
        logger.warning(f"Database query error: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'error_code': 'DB_QUERY_ERROR'
        }), 400
    except Exception as e:
        logger.error(f"Get server info error: {e}")
        return jsonify({
            'success': False,
            'message': '获取服务器信息失败'
        }), 500
