"""
数据库管理基础类和异常定义
"""
import logging

logger = logging.getLogger(__name__)


# ==================== 异常类定义 ====================

class DatabaseError(Exception):
    """数据库操作基础异常"""
    pass


class DatabaseConnectionError(DatabaseError):
    """数据库连接异常"""
    pass


class DatabaseQueryError(DatabaseError):
    """数据库查询异常"""
    pass


class DatabaseTimeoutError(DatabaseError):
    """数据库超时异常"""
    pass


class UnsupportedDatabaseTypeError(DatabaseError):
    """不支持的数据库类型异常"""
    pass
