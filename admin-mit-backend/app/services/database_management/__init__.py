"""
数据库管理服务模块

提供多种关系型数据库（PostgreSQL、MySQL、达梦DM、Oracle）的连接管理、
Schema 浏览、SQL 查询执行等功能。

Requirements: 1.1, 1.3, 1.4, 1.5, 8.1, 8.2, 8.3, 8.4
"""

from .base import (
    DatabaseError,
    DatabaseConnectionError,
    DatabaseQueryError,
    DatabaseTimeoutError,
    UnsupportedDatabaseTypeError
)
from .encryption import DatabasePasswordEncryptionService, db_password_encryption_service
from .connection_manager import DatabaseConnectionManager, database_connection_manager
from .service import DatabaseManagementService, database_management_service

__all__ = [
    # 异常类
    'DatabaseError',
    'DatabaseConnectionError',
    'DatabaseQueryError',
    'DatabaseTimeoutError',
    'UnsupportedDatabaseTypeError',
    # 加密服务
    'DatabasePasswordEncryptionService',
    'db_password_encryption_service',
    # 连接管理器
    'DatabaseConnectionManager',
    'database_connection_manager',
    # 主服务
    'DatabaseManagementService',
    'database_management_service',
]
