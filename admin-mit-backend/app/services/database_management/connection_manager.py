"""
数据库连接管理器
"""
import logging
from typing import Dict, Any, Optional, Tuple
from threading import Lock

from app.models.database_connection import DatabaseConnection

from .base import (
    DatabaseConnectionError,
    UnsupportedDatabaseTypeError
)
from .adapters import (
    PostgreSQLAdapter,
    MySQLAdapter,
    DMAdapter,
    OracleAdapter
)

logger = logging.getLogger(__name__)


class DatabaseConnectionManager:
    """
    数据库连接管理器
    
    管理活跃的数据库连接，支持 PostgreSQL、MySQL、达梦DM、Oracle。
    使用连接池管理连接，确保连接复用和资源释放。
    
    连接键格式: "{tenant_id}:{conn_id}"
    """
    
    _instance = None
    _lock = Lock()
    
    # 数据库适配器映射
    ADAPTERS = {
        'postgresql': PostgreSQLAdapter(),
        'mysql': MySQLAdapter(),
        'dm': DMAdapter(),
        'oracle': OracleAdapter(),
    }
    
    def __new__(cls):
        """单例模式"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        """初始化连接管理器"""
        if self._initialized:
            return
        
        self._connections: Dict[str, Any] = {}
        self._connection_lock = Lock()
        self._initialized = True
        logger.info("Database Connection Manager initialized")
    
    def _get_connection_key(self, conn_id: int, tenant_id: int) -> str:
        """生成连接键"""
        return f"{tenant_id}:{conn_id}"
    
    def get_adapter(self, db_type: str):
        """获取数据库适配器"""
        adapter = self.ADAPTERS.get(db_type)
        if not adapter:
            raise UnsupportedDatabaseTypeError(f"不支持的数据库类型: {db_type}")
        return adapter
    
    def get_client(
        self,
        conn_id: int,
        tenant_id: int,
        connection_config: Optional[DatabaseConnection] = None
    ):
        """
        获取数据库客户端
        
        如果连接已存在且有效，返回现有连接；否则创建新连接。
        """
        connection_key = self._get_connection_key(conn_id, tenant_id)
        
        with self._connection_lock:
            if connection_key in self._connections:
                client = self._connections[connection_key]
                try:
                    db_type = connection_config.db_type if connection_config else 'postgresql'
                    adapter = self.get_adapter(db_type)
                    if adapter.ping(client):
                        return client
                except Exception as e:
                    logger.warning(f"Existing connection invalid, reconnecting: {e}")
                self._close_client_internal(connection_key)
            
            if connection_config is None:
                connection_config = DatabaseConnection.get_by_tenant(conn_id, tenant_id)
                if connection_config is None:
                    raise ValueError(f"连接配置不存在: ID={conn_id}")
            
            if connection_config.status != 1:
                raise DatabaseConnectionError("连接配置已禁用")
            
            # 获取适配器并创建连接
            adapter = self.get_adapter(connection_config.db_type)
            
            client = adapter.create_connection(
                host=connection_config.host,
                port=connection_config.port or adapter.default_port,
                username=connection_config.username,
                password=connection_config.password,
                database=connection_config.database,
                timeout=connection_config.timeout or 10,
                service_name=getattr(connection_config, 'service_name', None),
                sid=getattr(connection_config, 'sid', None)
            )
            
            self._connections[connection_key] = client
            logger.info(f"Created new database connection: {connection_key}")
            
            return client
    
    def _close_client_internal(self, connection_key: str) -> bool:
        """内部方法：关闭指定连接（不加锁）"""
        if connection_key not in self._connections:
            return False
        
        try:
            client = self._connections.pop(connection_key)
            client.close()
            logger.info(f"Closed database connection: {connection_key}")
            return True
        except Exception as e:
            logger.error(f"Error closing database connection {connection_key}: {e}")
            return False
    
    def close_client(self, conn_id: int, tenant_id: int) -> bool:
        """关闭指定连接"""
        connection_key = self._get_connection_key(conn_id, tenant_id)
        
        with self._connection_lock:
            return self._close_client_internal(connection_key)
    
    def close_all_clients(self, tenant_id: Optional[int] = None) -> int:
        """关闭所有连接或指定租户的所有连接"""
        closed_count = 0
        
        with self._connection_lock:
            keys_to_close = []
            
            for key in self._connections.keys():
                if tenant_id is None:
                    keys_to_close.append(key)
                else:
                    key_tenant_id = int(key.split(':')[0])
                    if key_tenant_id == tenant_id:
                        keys_to_close.append(key)
            
            for key in keys_to_close:
                if self._close_client_internal(key):
                    closed_count += 1
        
        logger.info(f"Closed {closed_count} database connections" + 
                   (f" for tenant {tenant_id}" if tenant_id else ""))
        return closed_count
    
    def is_connected(self, conn_id: int, tenant_id: int) -> bool:
        """检查连接是否有效"""
        connection_key = self._get_connection_key(conn_id, tenant_id)
        
        with self._connection_lock:
            if connection_key not in self._connections:
                return False
            
            try:
                client = self._connections[connection_key]
                config = DatabaseConnection.get_by_tenant(conn_id, tenant_id)
                db_type = config.db_type if config else 'postgresql'
                adapter = self.get_adapter(db_type)
                return adapter.ping(client)
            except Exception as e:
                logger.warning(f"Connection check failed for {connection_key}: {e}")
                return False
    
    def test_connection(
        self,
        db_type: str,
        host: str,
        port: int,
        username: str,
        password: Optional[str],
        database: Optional[str] = None,
        service_name: Optional[str] = None,
        sid: Optional[str] = None,
        timeout: int = 10
    ) -> Tuple[bool, str]:
        """测试连接配置（不保存连接）"""
        client = None
        try:
            adapter = self.get_adapter(db_type)
            
            client = adapter.create_connection(
                host=host,
                port=port,
                username=username,
                password=password,
                database=database,
                timeout=timeout,
                service_name=service_name,
                sid=sid
            )
            
            version = adapter.get_version(client)
            return True, f"连接成功，{db_type.upper()} 版本: {version}"
            
        except Exception as e:
            return False, str(e)
        finally:
            if client:
                try:
                    client.close()
                except Exception:
                    pass


# 创建全局连接管理器实例
database_connection_manager = DatabaseConnectionManager()
