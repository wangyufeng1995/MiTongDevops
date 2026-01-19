"""
数据库管理服务
"""
import csv
import io
import logging
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime

from flask import g
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.database_connection import DatabaseConnection

from .base import DatabaseQueryError
from .encryption import db_password_encryption_service
from .connection_manager import database_connection_manager

logger = logging.getLogger(__name__)


class DatabaseManagementService:
    """
    数据库管理服务
    
    提供数据库连接配置的 CRUD 操作，以及连接测试功能。
    """
    
    def __init__(self):
        """初始化服务"""
        self._encryption_service = db_password_encryption_service
        self._connection_manager = database_connection_manager
    
    # ==================== 连接配置 CRUD ====================
    
    def create_connection(self, config: Dict[str, Any], tenant_id: Optional[int] = None) -> DatabaseConnection:
        """创建数据库连接配置"""
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        if not config.get('name'):
            raise ValueError("连接名称不能为空")
        
        db_type = config.get('db_type')
        if not db_type:
            raise ValueError("数据库类型不能为空")
        
        if not DatabaseConnection.is_valid_type(db_type):
            raise ValueError(f"不支持的数据库类型: {db_type}")
        
        if not config.get('host'):
            raise ValueError("主机地址不能为空")
        
        if not config.get('username'):
            raise ValueError("用户名不能为空")
        
        try:
            password = config.get('password', '')
            port = config.get('port') or DatabaseConnection.get_default_port(db_type)
            
            connection = DatabaseConnection(
                tenant_id=tenant_id,
                name=config['name'],
                db_type=db_type,
                host=config['host'],
                port=port,
                username=config['username'],
                password=password,
                database=config.get('database', ''),
                schema=config.get('schema', ''),
                service_name=config.get('service_name', ''),
                sid=config.get('sid', ''),
                timeout=config.get('timeout', 10),
                description=config.get('description', ''),
                status=config.get('status', 1),
            )
            
            db.session.add(connection)
            db.session.commit()
            
            logger.info(f"Created database connection: {connection.name} (ID: {connection.id})")
            return connection
            
        except IntegrityError as e:
            db.session.rollback()
            raise ValueError(f"连接名称 '{config['name']}' 已存在")
        except Exception as e:
            db.session.rollback()
            raise
    
    def update_connection(
        self,
        connection_id: int,
        config: Dict[str, Any],
        tenant_id: Optional[int] = None
    ) -> DatabaseConnection:
        """更新数据库连接配置"""
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        connection = DatabaseConnection.get_by_tenant(connection_id, tenant_id)
        if not connection:
            raise ValueError(f"连接配置不存在: ID={connection_id}")
        
        try:
            for field in ['name', 'db_type', 'host', 'port', 'username', 'password',
                         'database', 'schema', 'service_name', 'sid', 'timeout',
                         'description', 'status']:
                if field in config:
                    if field == 'db_type' and not DatabaseConnection.is_valid_type(config[field]):
                        raise ValueError(f"不支持的数据库类型: {config[field]}")
                    setattr(connection, field, config[field])
            
            connection.updated_at = datetime.utcnow()
            db.session.commit()
            
            self._connection_manager.close_client(connection_id, tenant_id)
            
            logger.info(f"Updated database connection: {connection.name} (ID: {connection.id})")
            return connection
            
        except IntegrityError:
            db.session.rollback()
            raise ValueError(f"连接名称 '{config.get('name')}' 已存在")
        except Exception as e:
            db.session.rollback()
            raise
    
    def delete_connection(self, connection_id: int, tenant_id: Optional[int] = None) -> bool:
        """删除数据库连接配置"""
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        connection = DatabaseConnection.get_by_tenant(connection_id, tenant_id)
        if not connection:
            raise ValueError(f"连接配置不存在: ID={connection_id}")
        
        try:
            self._connection_manager.close_client(connection_id, tenant_id)
            db.session.delete(connection)
            db.session.commit()
            
            logger.info(f"Deleted database connection: ID={connection_id}")
            return True
        except Exception as e:
            db.session.rollback()
            raise
    
    def get_connection(
        self,
        connection_id: int,
        tenant_id: Optional[int] = None,
        include_password: bool = False
    ) -> Optional[Dict[str, Any]]:
        """获取数据库连接配置"""
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        connection = DatabaseConnection.get_by_tenant(connection_id, tenant_id)
        if not connection:
            return None
        
        result = connection.to_dict(include_sensitive=include_password)
        result['is_connected'] = self._connection_manager.is_connected(connection_id, tenant_id)
        
        return result
    
    def list_connections(
        self,
        tenant_id: Optional[int] = None,
        page: int = 1,
        per_page: int = 50,
        search: str = '',
        db_type: Optional[str] = None,
        status: Optional[int] = None
    ) -> Dict[str, Any]:
        """获取数据库连接配置列表"""
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        query = DatabaseConnection.query_by_tenant(tenant_id)
        
        if search:
            query = query.filter(
                db.or_(
                    DatabaseConnection.name.ilike(f'%{search}%'),
                    DatabaseConnection.host.ilike(f'%{search}%'),
                    DatabaseConnection.description.ilike(f'%{search}%')
                )
            )
        
        if db_type:
            query = query.filter(DatabaseConnection.db_type == db_type)
        
        if status is not None:
            query = query.filter(DatabaseConnection.status == status)
        
        query = query.order_by(DatabaseConnection.created_at.desc())
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        connections = []
        for conn in pagination.items:
            conn_dict = conn.to_dict()
            conn_dict['is_connected'] = self._connection_manager.is_connected(conn.id, tenant_id)
            connections.append(conn_dict)
        
        return {
            'connections': connections,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_prev': pagination.has_prev,
                'has_next': pagination.has_next
            }
        }
    
    # ==================== 连接测试 ====================
    
    def test_connection(self, connection_id: int, tenant_id: Optional[int] = None) -> Tuple[bool, str]:
        """测试已保存的连接配置"""
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        connection = DatabaseConnection.get_by_tenant(connection_id, tenant_id)
        if not connection:
            return False, f"连接配置不存在: ID={connection_id}"
        
        return self._connection_manager.test_connection(
            db_type=connection.db_type,
            host=connection.host,
            port=connection.port,
            username=connection.username,
            password=connection.password,
            database=connection.database,
            service_name=connection.service_name,
            sid=connection.sid,
            timeout=connection.timeout or 10
        )
    
    def test_connection_config(self, config: Dict[str, Any]) -> Tuple[bool, str]:
        """测试连接配置（不保存）"""
        db_type = config.get('db_type')
        if not db_type:
            return False, "数据库类型不能为空"
        
        if not DatabaseConnection.is_valid_type(db_type):
            return False, f"不支持的数据库类型: {db_type}"
        
        return self._connection_manager.test_connection(
            db_type=db_type,
            host=config.get('host'),
            port=config.get('port') or DatabaseConnection.get_default_port(db_type),
            username=config.get('username'),
            password=config.get('password'),
            database=config.get('database'),
            service_name=config.get('service_name'),
            sid=config.get('sid'),
            timeout=config.get('timeout', 10)
        )
    
    # ==================== 获取支持的数据库类型 ====================
    
    def get_supported_types(self) -> List[Dict[str, Any]]:
        """获取支持的数据库类型列表"""
        return DatabaseConnection.get_supported_types()
    
    # ==================== Schema 浏览功能 ====================
    
    def _get_client_and_adapter(self, connection_id: int, tenant_id: Optional[int] = None):
        """获取数据库客户端和适配器"""
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        connection = DatabaseConnection.get_by_tenant(connection_id, tenant_id)
        if not connection:
            raise ValueError(f"连接配置不存在: ID={connection_id}")
        
        client = self._connection_manager.get_client(connection_id, tenant_id, connection)
        adapter = self._connection_manager.get_adapter(connection.db_type)
        
        return client, adapter, connection
    
    def get_databases(self, connection_id: int, tenant_id: Optional[int] = None) -> List[str]:
        """获取数据库列表"""
        client, adapter, _ = self._get_client_and_adapter(connection_id, tenant_id)
        return adapter.get_databases(client)
    
    def get_schemas(
        self,
        connection_id: int,
        database: Optional[str] = None,
        tenant_id: Optional[int] = None
    ) -> List[str]:
        """获取 Schema 列表"""
        client, adapter, connection = self._get_client_and_adapter(connection_id, tenant_id)
        
        # MySQL 特殊处理
        if connection.db_type == 'mysql':
            if connection.database:
                return [connection.database]
            return adapter.get_schemas(client, database)
        
        return adapter.get_schemas(client, database)
    
    def get_tables(
        self,
        connection_id: int,
        schema: Optional[str] = None,
        search: Optional[str] = None,
        tenant_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """获取表列表"""
        client, adapter, connection = self._get_client_and_adapter(connection_id, tenant_id)
        
        # 如果没有指定 schema，使用连接配置中的数据库
        if not schema and connection.database:
            schema = connection.database
        
        return adapter.get_tables(client, schema, search)
    
    def get_table_columns(
        self,
        connection_id: int,
        table_name: str,
        schema: Optional[str] = None,
        tenant_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """获取表的列信息"""
        client, adapter, connection = self._get_client_and_adapter(connection_id, tenant_id)
        
        if not schema and connection.database:
            schema = connection.database
        
        return adapter.get_table_columns(client, table_name, schema)
    
    def get_table_indexes(
        self,
        connection_id: int,
        table_name: str,
        schema: Optional[str] = None,
        tenant_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """获取表的索引信息"""
        client, adapter, connection = self._get_client_and_adapter(connection_id, tenant_id)
        
        if not schema and connection.database:
            schema = connection.database
        
        return adapter.get_table_indexes(client, table_name, schema)
    
    # ==================== SQL 查询执行 ====================
    
    def execute_query(
        self,
        connection_id: int,
        sql: str,
        page: int = 1,
        per_page: int = 50,
        max_rows: int = 1000,
        tenant_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """执行 SQL 查询"""
        if not sql or not sql.strip():
            raise ValueError("SQL 语句不能为空")
        
        if page < 1:
            page = 1
        if per_page < 1:
            per_page = 50
        if per_page > max_rows:
            per_page = max_rows
        if max_rows < 1:
            max_rows = 1000
        
        client, adapter, _ = self._get_client_and_adapter(connection_id, tenant_id)
        
        logger.info(f"Executing SQL: {sql[:100]}...")
        
        return adapter.execute_query(client, sql, page, per_page, max_rows)
    
    def get_server_info(self, connection_id: int, tenant_id: Optional[int] = None) -> Dict[str, Any]:
        """获取服务器信息"""
        client, adapter, _ = self._get_client_and_adapter(connection_id, tenant_id)
        return adapter.get_server_info(client)
    
    # ==================== CSV 导出功能 ====================
    
    def export_csv(
        self,
        connection_id: int,
        sql: str,
        max_rows: int = 10000,
        tenant_id: Optional[int] = None
    ) -> str:
        """导出查询结果为 CSV"""
        result = self.execute_query(
            connection_id=connection_id,
            sql=sql,
            page=1,
            per_page=max_rows,
            max_rows=max_rows,
            tenant_id=tenant_id
        )
        
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
        
        # 写入表头
        if result['columns']:
            writer.writerow(result['columns'])
        
        # 写入数据行
        for row in result['rows']:
            writer.writerow(row)
        
        csv_content = output.getvalue()
        output.close()
        
        # 添加 BOM 以支持 Excel 正确识别 UTF-8
        return '\ufeff' + csv_content


# 创建全局服务实例
database_management_service = DatabaseManagementService()
