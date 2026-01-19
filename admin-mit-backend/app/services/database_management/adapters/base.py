"""
数据库适配器基类
"""
import logging
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger(__name__)


class BaseDatabaseAdapter(ABC):
    """数据库适配器基类"""
    
    db_type: str = ""
    default_port: int = 0
    
    @abstractmethod
    def create_connection(
        self,
        host: str,
        port: int,
        username: str,
        password: Optional[str],
        database: Optional[str],
        timeout: int,
        **kwargs
    ) -> Any:
        """创建数据库连接"""
        pass
    
    @abstractmethod
    def ping(self, client: Any) -> bool:
        """验证连接是否有效"""
        pass
    
    @abstractmethod
    def get_version(self, client: Any) -> str:
        """获取数据库版本"""
        pass
    
    @abstractmethod
    def get_databases(self, client: Any) -> List[str]:
        """获取数据库列表"""
        pass
    
    @abstractmethod
    def get_schemas(self, client: Any, database: Optional[str] = None) -> List[str]:
        """获取 Schema 列表"""
        pass
    
    @abstractmethod
    def get_tables(
        self,
        client: Any,
        schema: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """获取表列表"""
        pass
    
    @abstractmethod
    def get_table_columns(
        self,
        client: Any,
        table_name: str,
        schema: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """获取表的列信息"""
        pass
    
    @abstractmethod
    def get_table_indexes(
        self,
        client: Any,
        table_name: str,
        schema: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """获取表的索引信息"""
        pass
    
    @abstractmethod
    def execute_query(
        self,
        client: Any,
        sql: str,
        page: int = 1,
        per_page: int = 50,
        max_rows: int = 1000
    ) -> Dict[str, Any]:
        """执行 SQL 查询"""
        pass
    
    @abstractmethod
    def get_server_info(self, client: Any) -> Dict[str, Any]:
        """获取服务器信息"""
        pass
    
    def build_paginated_sql(self, sql: str, limit: int, offset: int) -> str:
        """构建分页 SQL（子类可覆盖）"""
        return f"{sql} LIMIT {limit} OFFSET {offset}"
    
    def convert_row_to_json(self, row: List[Any]) -> List[Any]:
        """将数据行转换为 JSON 可序列化格式"""
        from datetime import datetime, date, time
        from decimal import Decimal
        import uuid
        
        result = []
        for value in row:
            if value is None:
                result.append(None)
            elif isinstance(value, datetime):
                result.append(value.isoformat())
            elif isinstance(value, date):
                result.append(value.isoformat())
            elif isinstance(value, time):
                result.append(value.isoformat())
            elif isinstance(value, Decimal):
                result.append(float(value))
            elif isinstance(value, uuid.UUID):
                result.append(str(value))
            elif isinstance(value, bytes):
                try:
                    result.append(value.decode('utf-8'))
                except UnicodeDecodeError:
                    result.append(f"<binary: {len(value)} bytes>")
            elif isinstance(value, (dict, list)):
                result.append(value)
            else:
                result.append(value)
        return result
