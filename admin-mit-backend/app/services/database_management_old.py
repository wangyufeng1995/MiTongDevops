"""
数据库管理服务

提供多种关系型数据库（PostgreSQL、MySQL、达梦DM、Oracle）的连接管理、
Schema 浏览、SQL 查询执行等功能。

Requirements: 1.1, 1.3, 1.4, 1.5, 8.1, 8.2, 8.3, 8.4
"""
import os
import csv
import io
import json
import base64
import logging
from typing import Dict, List, Optional, Tuple, Any, Union
from threading import Lock
from datetime import datetime

from flask import g
from sqlalchemy.exc import IntegrityError
from cryptography.fernet import Fernet

from app.extensions import db
from app.models.database_connection import DatabaseConnection, DATABASE_TYPES

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


# ==================== 密码加密服务 ====================

class DatabasePasswordEncryptionService:
    """
    数据库密码加密服务
    
    使用 Fernet 对称加密算法加密和解密密码。
    密钥从环境变量或配置文件中获取。
    """
    
    _instance = None
    _key: Optional[bytes] = None
    _fernet: Optional[Fernet] = None
    
    def __new__(cls):
        """单例模式"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        """初始化加密服务"""
        if self._initialized:
            return
        
        self._initialize_key()
        self._initialized = True
    
    def _initialize_key(self):
        """初始化加密密钥"""
        # 尝试从环境变量获取密钥（优先使用数据库专用密钥，否则使用 Redis 密钥）
        key_str = os.environ.get('DATABASE_PASSWORD_ENCRYPTION_KEY') or \
                  os.environ.get('REDIS_PASSWORD_ENCRYPTION_KEY')
        
        if key_str:
            try:
                self._key = base64.urlsafe_b64decode(key_str)
            except Exception:
                self._key = key_str.encode() if isinstance(key_str, str) else key_str
        else:
            self._key = Fernet.generate_key()
            logger.warning(
                "DATABASE_PASSWORD_ENCRYPTION_KEY not set, using generated key. "
                "This is not recommended for production!"
            )
        
        try:
            self._fernet = Fernet(self._key)
        except Exception as e:
            logger.warning(f"Invalid encryption key, generating new one: {e}")
            self._key = Fernet.generate_key()
            self._fernet = Fernet(self._key)
    
    def encrypt(self, plaintext: str) -> str:
        """加密明文"""
        if not plaintext:
            return ""
        encrypted = self._fernet.encrypt(plaintext.encode('utf-8'))
        return encrypted.decode('utf-8')
    
    def decrypt(self, ciphertext: str) -> str:
        """解密密文"""
        if not ciphertext:
            return ""
        
        if ciphertext.startswith('gAAAAA'):
            try:
                decrypted = self._fernet.decrypt(ciphertext.encode('utf-8'))
                return decrypted.decode('utf-8')
            except Exception as e:
                logger.error(f"Failed to decrypt Fernet password: {e}")
                raise ValueError("密码解密失败，请重新设置密码")
        
        if ciphertext.startswith('Z0FBQUFB'):
            try:
                decoded = base64.urlsafe_b64decode(ciphertext.encode('utf-8'))
                if decoded.startswith(b'gAAAAA'):
                    decrypted = self._fernet.decrypt(decoded)
                    return decrypted.decode('utf-8')
            except Exception as e:
                logger.error(f"Failed to decrypt Base64+Fernet password: {e}")
        
        logger.debug("Password is not encrypted, using as plaintext")
        return ciphertext


# 全局密码加密服务实例
db_password_encryption_service = DatabasePasswordEncryptionService()


# ==================== 数据库连接管理器 ====================

class DatabaseConnectionManager:
    """
    数据库连接管理器
    
    管理活跃的数据库连接，支持 PostgreSQL、MySQL、达梦DM、Oracle。
    使用连接池管理连接，确保连接复用和资源释放。
    
    连接键格式: "{tenant_id}:{conn_id}"
    
    Requirements: 8.1, 8.2, 8.3, 8.4
    """
    
    _instance = None
    _lock = Lock()
    
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
    
    def _create_postgresql_client(
        self,
        host: str,
        port: int,
        username: str,
        password: Optional[str],
        database: str,
        timeout: int
    ):
        """
        创建 PostgreSQL 客户端
        
        Requirements: 8.1
        """
        try:
            import psycopg2
        except ImportError:
            raise UnsupportedDatabaseTypeError("未安装 psycopg2 驱动，请安装: pip install psycopg2-binary")
        
        try:
            conn = psycopg2.connect(
                host=host,
                port=port,
                user=username,
                password=password or '',
                database=database or 'postgres',
                connect_timeout=timeout,
                options='-c statement_timeout=30000'
            )
            conn.autocommit = False
            logger.info(f"Connected to PostgreSQL at {host}:{port}")
            return conn
        except psycopg2.OperationalError as e:
            error_msg = str(e)
            if 'timeout' in error_msg.lower():
                raise DatabaseTimeoutError(f"连接超时: {host}:{port}")
            elif 'authentication' in error_msg.lower() or 'password' in error_msg.lower():
                raise DatabaseConnectionError(f"认证失败: 用户名或密码错误")
            else:
                raise DatabaseConnectionError(f"连接失败: {error_msg}")
        except Exception as e:
            raise DatabaseConnectionError(f"连接失败: {str(e)}")
    
    def _create_mysql_client(
        self,
        host: str,
        port: int,
        username: str,
        password: Optional[str],
        database: str,
        timeout: int
    ):
        """
        创建 MySQL 客户端
        
        Requirements: 8.2
        """
        try:
            import pymysql
            import pymysql.err
        except ImportError:
            raise UnsupportedDatabaseTypeError("未安装 pymysql 驱动，请安装: pip install pymysql")
        
        try:
            conn = pymysql.connect(
                host=host,
                port=port,
                user=username,
                password=password or '',
                database=database or None,
                connect_timeout=timeout,
                read_timeout=30,
                write_timeout=30,
                charset='utf8mb4',
                cursorclass=pymysql.cursors.DictCursor
            )
            logger.info(f"Connected to MySQL at {host}:{port}")
            return conn
        except pymysql.err.OperationalError as e:
            error_code = e.args[0] if e.args else 0
            if error_code == 2003:
                raise DatabaseConnectionError(f"无法连接到服务器: {host}:{port}")
            elif error_code == 1045:
                raise DatabaseConnectionError(f"认证失败: 用户名或密码错误")
            elif error_code == 1049:
                raise DatabaseConnectionError(f"数据库不存在: {database}")
            else:
                raise DatabaseConnectionError(f"连接失败: {str(e)}")
        except Exception as e:
            raise DatabaseConnectionError(f"连接失败: {str(e)}")
    
    def _create_dm_client(
        self,
        host: str,
        port: int,
        username: str,
        password: Optional[str],
        database: str,
        timeout: int
    ):
        """
        创建达梦 DM 客户端
        
        Requirements: 8.3
        """
        try:
            import dmPython
            
            conn = dmPython.connect(
                host=host,
                port=port,
                user=username,
                password=password or '',
                database=database or None,
                login_timeout=timeout
            )
            logger.info(f"Connected to DM at {host}:{port}")
            return conn
        except ImportError:
            raise UnsupportedDatabaseTypeError("未安装 dmPython 驱动，请联系管理员安装达梦数据库驱动")
        except Exception as e:
            error_msg = str(e)
            if 'timeout' in error_msg.lower():
                raise DatabaseTimeoutError(f"连接超时: {host}:{port}")
            elif 'login' in error_msg.lower() or 'password' in error_msg.lower():
                raise DatabaseConnectionError(f"认证失败: 用户名或密码错误")
            else:
                raise DatabaseConnectionError(f"连接失败: {error_msg}")
    
    def _create_oracle_client(
        self,
        host: str,
        port: int,
        username: str,
        password: Optional[str],
        database: str,
        service_name: Optional[str],
        sid: Optional[str],
        timeout: int
    ):
        """
        创建 Oracle 客户端
        
        Requirements: 8.4
        """
        try:
            import cx_Oracle
            
            # 构建 DSN
            if service_name:
                dsn = cx_Oracle.makedsn(host, port, service_name=service_name)
            elif sid:
                dsn = cx_Oracle.makedsn(host, port, sid=sid)
            else:
                dsn = cx_Oracle.makedsn(host, port, service_name=database or 'ORCL')
            
            conn = cx_Oracle.connect(
                user=username,
                password=password or '',
                dsn=dsn,
                encoding='UTF-8'
            )
            logger.info(f"Connected to Oracle at {host}:{port}")
            return conn
        except ImportError:
            raise UnsupportedDatabaseTypeError("未安装 cx_Oracle 驱动，请安装: pip install cx_Oracle")
        except Exception as e:
            error_msg = str(e)
            if 'timeout' in error_msg.lower() or 'TNS' in error_msg:
                raise DatabaseTimeoutError(f"连接超时或 TNS 错误: {host}:{port}")
            elif 'ORA-01017' in error_msg:
                raise DatabaseConnectionError(f"认证失败: 用户名或密码错误")
            elif 'ORA-12154' in error_msg:
                raise DatabaseConnectionError(f"TNS 名称解析失败")
            else:
                raise DatabaseConnectionError(f"连接失败: {error_msg}")
    
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
                    # 验证连接是否有效
                    self._ping_connection(client, connection_config.db_type if connection_config else 'postgresql')
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
            
            # 直接使用明文密码
            password = connection_config.password
            
            # 根据数据库类型创建客户端
            db_type = connection_config.db_type
            
            if db_type == 'postgresql':
                client = self._create_postgresql_client(
                    host=connection_config.host,
                    port=connection_config.port or 5432,
                    username=connection_config.username,
                    password=password,
                    database=connection_config.database,
                    timeout=connection_config.timeout or 10
                )
            elif db_type == 'mysql':
                client = self._create_mysql_client(
                    host=connection_config.host,
                    port=connection_config.port or 3306,
                    username=connection_config.username,
                    password=password,
                    database=connection_config.database,
                    timeout=connection_config.timeout or 10
                )
            elif db_type == 'dm':
                client = self._create_dm_client(
                    host=connection_config.host,
                    port=connection_config.port or 5236,
                    username=connection_config.username,
                    password=password,
                    database=connection_config.database,
                    timeout=connection_config.timeout or 10
                )
            elif db_type == 'oracle':
                client = self._create_oracle_client(
                    host=connection_config.host,
                    port=connection_config.port or 1521,
                    username=connection_config.username,
                    password=password,
                    database=connection_config.database,
                    service_name=connection_config.service_name,
                    sid=connection_config.sid,
                    timeout=connection_config.timeout or 10
                )
            else:
                raise UnsupportedDatabaseTypeError(f"不支持的数据库类型: {db_type}")
            
            self._connections[connection_key] = client
            logger.info(f"Created new database connection: {connection_key}")
            
            return client
    
    def _ping_connection(self, client, db_type: str) -> bool:
        """验证连接是否有效"""
        try:
            cursor = client.cursor()
            if db_type == 'oracle':
                cursor.execute("SELECT 1 FROM DUAL")
            else:
                cursor.execute("SELECT 1")
            cursor.fetchone()
            cursor.close()
            return True
        except Exception:
            return False
    
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
                # 获取数据库类型
                config = DatabaseConnection.get_by_tenant(conn_id, tenant_id)
                db_type = config.db_type if config else 'postgresql'
                return self._ping_connection(client, db_type)
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
        """
        测试连接配置（不保存连接）
        
        Requirements: 1.5
        """
        client = None
        try:
            if db_type == 'postgresql':
                client = self._create_postgresql_client(
                    host=host, port=port, username=username,
                    password=password, database=database, timeout=timeout
                )
                cursor = client.cursor()
                cursor.execute("SELECT version()")
                version = cursor.fetchone()[0]
                cursor.close()
                return True, f"连接成功，PostgreSQL 版本: {version.split(',')[0]}"
            
            elif db_type == 'mysql':
                client = self._create_mysql_client(
                    host=host, port=port, username=username,
                    password=password, database=database, timeout=timeout
                )
                cursor = client.cursor()
                cursor.execute("SELECT VERSION()")
                version = cursor.fetchone()
                version_str = version.get('VERSION()') if isinstance(version, dict) else version[0]
                cursor.close()
                return True, f"连接成功，MySQL 版本: {version_str}"
            
            elif db_type == 'dm':
                client = self._create_dm_client(
                    host=host, port=port, username=username,
                    password=password, database=database, timeout=timeout
                )
                cursor = client.cursor()
                cursor.execute("SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1")
                version = cursor.fetchone()[0]
                cursor.close()
                return True, f"连接成功，达梦版本: {version}"
            
            elif db_type == 'oracle':
                client = self._create_oracle_client(
                    host=host, port=port, username=username,
                    password=password, database=database,
                    service_name=service_name, sid=sid, timeout=timeout
                )
                cursor = client.cursor()
                cursor.execute("SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1")
                version = cursor.fetchone()[0]
                cursor.close()
                return True, f"连接成功，Oracle 版本: {version}"
            
            else:
                return False, f"不支持的数据库类型: {db_type}"
                
        except DatabaseTimeoutError as e:
            return False, str(e)
        except DatabaseConnectionError as e:
            return False, str(e)
        except UnsupportedDatabaseTypeError as e:
            return False, str(e)
        except Exception as e:
            logger.error(f"Test connection failed: {e}")
            return False, f"连接测试失败: {str(e)}"
        finally:
            if client:
                try:
                    client.close()
                except Exception:
                    pass


# 创建全局连接管理器实例
database_connection_manager = DatabaseConnectionManager()


# ==================== 数据库管理服务 ====================

class DatabaseManagementService:
    """
    数据库管理服务
    
    提供数据库连接配置的 CRUD 操作，以及连接测试功能。
    
    Requirements: 1.1, 1.3, 1.4, 1.5
    """
    
    def __init__(self):
        """初始化服务"""
        self._encryption_service = db_password_encryption_service
        self._connection_manager = database_connection_manager
    
    # ==================== 连接配置 CRUD ====================
    
    def create_connection(self, config: Dict[str, Any], tenant_id: Optional[int] = None) -> DatabaseConnection:
        """
        创建数据库连接配置
        
        Args:
            config: 连接配置字典，包含:
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
            tenant_id: 租户 ID (可选，默认从 g 中获取)
            
        Returns:
            DatabaseConnection: 创建的连接配置对象
            
        Raises:
            ValueError: 参数验证失败
            IntegrityError: 连接名称重复
            
        Requirements: 1.1
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        # 验证必填字段
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
            # 直接使用明文密码（不加密）
            password = config.get('password', '')
            
            # 获取默认端口
            port = config.get('port')
            if port is None:
                port = DatabaseConnection.get_default_port(db_type)
            
            # 创建连接配置
            connection = DatabaseConnection(
                tenant_id=tenant_id,
                name=config['name'],
                db_type=db_type,
                host=config['host'],
                port=port,
                username=config['username'],
                password=password,  # 明文存储
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
            logger.error(f"Failed to create database connection - duplicate name: {e}")
            raise ValueError(f"连接名称 '{config['name']}' 已存在")
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to create database connection: {e}")
            raise
    
    def update_connection(
        self,
        connection_id: int,
        config: Dict[str, Any],
        tenant_id: Optional[int] = None
    ) -> DatabaseConnection:
        """
        更新数据库连接配置
        
        Args:
            connection_id: 连接配置 ID
            config: 更新的配置字典
            tenant_id: 租户 ID (可选)
            
        Returns:
            DatabaseConnection: 更新后的连接配置对象
            
        Raises:
            ValueError: 连接配置不存在或参数验证失败
            
        Requirements: 1.3
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        connection = DatabaseConnection.get_by_tenant(connection_id, tenant_id)
        if not connection:
            raise ValueError(f"连接配置不存在: ID={connection_id}")
        
        try:
            # 更新字段
            if 'name' in config:
                connection.name = config['name']
            
            if 'db_type' in config:
                if not DatabaseConnection.is_valid_type(config['db_type']):
                    raise ValueError(f"不支持的数据库类型: {config['db_type']}")
                connection.db_type = config['db_type']
            
            if 'host' in config:
                connection.host = config['host']
            
            if 'port' in config:
                connection.port = config['port']
            
            if 'username' in config:
                connection.username = config['username']
            
            if 'password' in config:
                password = config['password']
                connection.password = password  # 明文存储
            
            if 'database' in config:
                connection.database = config['database']
            
            if 'schema' in config:
                connection.schema = config['schema']
            
            if 'service_name' in config:
                connection.service_name = config['service_name']
            
            if 'sid' in config:
                connection.sid = config['sid']
            
            if 'timeout' in config:
                connection.timeout = config['timeout']
            
            if 'description' in config:
                connection.description = config['description']
            
            if 'status' in config:
                connection.status = config['status']
            
            connection.updated_at = datetime.utcnow()
            db.session.commit()
            
            # 如果连接已建立，关闭旧连接
            self._connection_manager.close_client(connection_id, tenant_id)
            
            logger.info(f"Updated database connection: {connection.name} (ID: {connection.id})")
            return connection
            
        except IntegrityError as e:
            db.session.rollback()
            logger.error(f"Failed to update database connection - duplicate name: {e}")
            raise ValueError(f"连接名称 '{config.get('name')}' 已存在")
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to update database connection: {e}")
            raise
    
    def delete_connection(self, connection_id: int, tenant_id: Optional[int] = None) -> bool:
        """
        删除数据库连接配置
        
        Args:
            connection_id: 连接配置 ID
            tenant_id: 租户 ID (可选)
            
        Returns:
            bool: 是否删除成功
            
        Raises:
            ValueError: 连接配置不存在
            
        Requirements: 1.4
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        connection = DatabaseConnection.get_by_tenant(connection_id, tenant_id)
        if not connection:
            raise ValueError(f"连接配置不存在: ID={connection_id}")
        
        try:
            # 关闭活跃连接
            self._connection_manager.close_client(connection_id, tenant_id)
            
            # 删除配置
            db.session.delete(connection)
            db.session.commit()
            
            logger.info(f"Deleted database connection: ID={connection_id}")
            return True
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to delete database connection: {e}")
            raise
    
    def get_connection(
        self,
        connection_id: int,
        tenant_id: Optional[int] = None,
        include_password: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        获取数据库连接配置
        
        Args:
            connection_id: 连接配置 ID
            tenant_id: 租户 ID (可选)
            include_password: 是否包含解密后的密码
            
        Returns:
            dict: 连接配置字典，如果不存在返回 None
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        connection = DatabaseConnection.get_by_tenant(connection_id, tenant_id)
        if not connection:
            return None
        
        result = connection.to_dict(include_sensitive=include_password)
        
        # 密码已经是明文，无需解密
        
        # 添加连接状态
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
        """
        获取数据库连接配置列表
        
        Args:
            tenant_id: 租户 ID (可选)
            page: 页码 (默认 1)
            per_page: 每页数量 (默认 50)
            search: 搜索关键词
            db_type: 数据库类型过滤
            status: 状态过滤
            
        Returns:
            dict: 包含连接列表和分页信息的字典
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        try:
            query = DatabaseConnection.query_by_tenant(tenant_id)
            
            # 搜索过滤
            if search:
                query = query.filter(
                    db.or_(
                        DatabaseConnection.name.ilike(f'%{search}%'),
                        DatabaseConnection.host.ilike(f'%{search}%'),
                        DatabaseConnection.description.ilike(f'%{search}%')
                    )
                )
            
            # 数据库类型过滤
            if db_type:
                query = query.filter(DatabaseConnection.db_type == db_type)
            
            # 状态过滤
            if status is not None:
                query = query.filter(DatabaseConnection.status == status)
            
            # 按创建时间倒序
            query = query.order_by(DatabaseConnection.created_at.desc())
            
            # 分页
            pagination = query.paginate(
                page=page,
                per_page=per_page,
                error_out=False
            )
            
            # 转换为字典列表
            connections = []
            for conn in pagination.items:
                conn_dict = conn.to_dict()
                # 添加连接状态
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
            
        except Exception as e:
            logger.error(f"Failed to list database connections: {e}")
            raise
    
    # ==================== 连接测试 ====================
    
    def test_connection(
        self,
        connection_id: int,
        tenant_id: Optional[int] = None
    ) -> Tuple[bool, str]:
        """
        测试已保存的连接配置
        
        Args:
            connection_id: 连接配置 ID
            tenant_id: 租户 ID (可选)
            
        Returns:
            Tuple[bool, str]: (是否成功, 消息)
            
        Requirements: 1.5
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        connection = DatabaseConnection.get_by_tenant(connection_id, tenant_id)
        if not connection:
            return False, f"连接配置不存在: ID={connection_id}"
        
        # 直接使用明文密码
        password = connection.password
        
        # 使用连接管理器测试连接
        return self._connection_manager.test_connection(
            db_type=connection.db_type,
            host=connection.host,
            port=connection.port,
            username=connection.username,
            password=password,
            database=connection.database,
            service_name=connection.service_name,
            sid=connection.sid,
            timeout=connection.timeout or 10
        )
    
    def test_connection_config(self, config: Dict[str, Any]) -> Tuple[bool, str]:
        """
        测试连接配置（不保存）
        
        Args:
            config: 连接配置字典
            
        Returns:
            Tuple[bool, str]: (是否成功, 消息)
            
        Requirements: 1.5
        """
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
        """
        获取支持的数据库类型列表
        
        Returns:
            list: 数据库类型配置列表
        """
        return DatabaseConnection.get_supported_types()
    
    # ==================== Schema 浏览功能 ====================
    
    def _get_client_and_type(
        self,
        connection_id: int,
        tenant_id: Optional[int] = None
    ) -> Tuple[Any, str, DatabaseConnection]:
        """
        获取数据库客户端和类型
        
        Args:
            connection_id: 连接配置 ID
            tenant_id: 租户 ID (可选)
            
        Returns:
            Tuple[client, db_type, connection]: 数据库客户端、类型和连接配置
            
        Raises:
            ValueError: 连接配置不存在
            DatabaseConnectionError: 连接失败
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        connection = DatabaseConnection.get_by_tenant(connection_id, tenant_id)
        if not connection:
            raise ValueError(f"连接配置不存在: ID={connection_id}")
        
        # 解密密码并设置到连接对象
        if connection.password:
            decrypted_password = self._encryption_service.decrypt(connection.password)
            # 创建一个临时对象来存储解密后的密码
            connection._decrypted_password = decrypted_password
        else:
            connection._decrypted_password = None
        
        # 获取客户端
        client = self._connection_manager.get_client(connection_id, tenant_id, connection)
        
        return client, connection.db_type, connection
    
    def get_databases(
        self,
        connection_id: int,
        tenant_id: Optional[int] = None
    ) -> List[str]:
        """
        获取数据库列表
        
        对于支持多数据库的类型（PostgreSQL、MySQL），返回数据库列表。
        对于 Oracle 和达梦，返回当前连接的数据库。
        
        Args:
            connection_id: 连接配置 ID
            tenant_id: 租户 ID (可选)
            
        Returns:
            List[str]: 数据库名称列表
            
        Requirements: 3.1
        """
        client, db_type, connection = self._get_client_and_type(connection_id, tenant_id)
        
        try:
            cursor = client.cursor()
            databases = []
            
            if db_type == 'postgresql':
                cursor.execute("""
                    SELECT datname FROM pg_database 
                    WHERE datistemplate = false 
                    ORDER BY datname
                """)
                databases = [row[0] for row in cursor.fetchall()]
                
            elif db_type == 'mysql':
                cursor.execute("SHOW DATABASES")
                result = cursor.fetchall()
                # MySQL with DictCursor returns dict
                if result and isinstance(result[0], dict):
                    databases = [row.get('Database') or list(row.values())[0] for row in result]
                else:
                    databases = [row[0] for row in result]
                
            elif db_type == 'dm':
                # 达梦数据库获取所有 Schema（类似数据库）
                cursor.execute("""
                    SELECT DISTINCT OWNER FROM ALL_TABLES 
                    ORDER BY OWNER
                """)
                databases = [row[0] for row in cursor.fetchall()]
                
            elif db_type == 'oracle':
                # Oracle 返回当前用户可访问的 Schema
                cursor.execute("""
                    SELECT DISTINCT OWNER FROM ALL_TABLES 
                    ORDER BY OWNER
                """)
                databases = [row[0] for row in cursor.fetchall()]
            
            cursor.close()
            return databases
            
        except Exception as e:
            logger.error(f"Failed to get databases: {e}")
            raise DatabaseQueryError(f"获取数据库列表失败: {str(e)}")
    
    def get_schemas(
        self,
        connection_id: int,
        database: Optional[str] = None,
        tenant_id: Optional[int] = None
    ) -> List[str]:
        """
        获取 Schema 列表
        
        Args:
            connection_id: 连接配置 ID
            database: 数据库名（可选，用于 PostgreSQL）
            tenant_id: 租户 ID (可选)
            
        Returns:
            List[str]: Schema 名称列表
            
        Requirements: 3.2
        """
        client, db_type, connection = self._get_client_and_type(connection_id, tenant_id)
        
        try:
            cursor = client.cursor()
            schemas = []
            
            if db_type == 'postgresql':
                cursor.execute("""
                    SELECT schema_name FROM information_schema.schemata 
                    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
                    ORDER BY schema_name
                """)
                schemas = [row[0] for row in cursor.fetchall()]
                
            elif db_type == 'mysql':
                # MySQL 没有 Schema 概念，直接返回当前连接的数据库
                # 如果连接配置了数据库，返回该数据库名
                if connection.database:
                    schemas = [connection.database]
                else:
                    # 否则返回所有数据库
                    try:
                        cursor.execute("SHOW DATABASES")
                        result = cursor.fetchall()
                        if result:
                            if isinstance(result[0], dict):
                                schemas = [row.get('Database') or list(row.values())[0] for row in result]
                            else:
                                schemas = [row[0] for row in result]
                    except Exception:
                        # 如果查询失败，返回空列表
                        schemas = []
                
            elif db_type == 'dm':
                # 达梦数据库的 Schema
                cursor.execute("""
                    SELECT DISTINCT OWNER FROM ALL_TABLES 
                    ORDER BY OWNER
                """)
                schemas = [row[0] for row in cursor.fetchall()]
                
            elif db_type == 'oracle':
                # Oracle Schema
                cursor.execute("""
                    SELECT DISTINCT OWNER FROM ALL_TABLES 
                    ORDER BY OWNER
                """)
                schemas = [row[0] for row in cursor.fetchall()]
            
            cursor.close()
            return schemas
            
        except Exception as e:
            logger.error(f"Failed to get schemas: {e}")
            raise DatabaseQueryError(f"获取 Schema 列表失败: {str(e)}")
    
    def get_tables(
        self,
        connection_id: int,
        schema: Optional[str] = None,
        search: Optional[str] = None,
        tenant_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        获取表列表
        
        Args:
            connection_id: 连接配置 ID
            schema: Schema 名称（可选）
            search: 搜索关键词（可选）
            tenant_id: 租户 ID (可选)
            
        Returns:
            List[Dict]: 表信息列表，每个元素包含:
                - name: 表名
                - type: 类型 ('table' 或 'view')
                - schema: Schema 名称
                - row_count: 行数估计（可选）
                
        Requirements: 3.3, 3.6
        """
        client, db_type, connection = self._get_client_and_type(connection_id, tenant_id)
        
        try:
            cursor = client.cursor()
            tables = []
            
            if db_type == 'postgresql':
                # 默认使用 public schema
                schema = schema or 'public'
                
                query = """
                    SELECT 
                        t.table_name,
                        t.table_type,
                        t.table_schema,
                        COALESCE(s.n_live_tup, 0) as row_count
                    FROM information_schema.tables t
                    LEFT JOIN pg_stat_user_tables s 
                        ON t.table_name = s.relname AND t.table_schema = s.schemaname
                    WHERE t.table_schema = %s
                """
                params = [schema]
                
                if search:
                    query += " AND t.table_name ILIKE %s"
                    params.append(f'%{search}%')
                
                query += " ORDER BY t.table_name"
                
                cursor.execute(query, params)
                for row in cursor.fetchall():
                    tables.append({
                        'name': row[0],
                        'type': 'view' if row[1] == 'VIEW' else 'table',
                        'schema': row[2],
                        'row_count': row[3]
                    })
                    
            elif db_type == 'mysql':
                # 使用连接配置中的数据库或指定的 schema
                db_name = schema or connection.database
                
                if db_name:
                    query = """
                        SELECT 
                            TABLE_NAME,
                            TABLE_TYPE,
                            TABLE_SCHEMA,
                            TABLE_ROWS
                        FROM information_schema.TABLES 
                        WHERE TABLE_SCHEMA = %s
                    """
                    params = [db_name]
                    
                    if search:
                        query += " AND TABLE_NAME LIKE %s"
                        params.append(f'%{search}%')
                    
                    query += " ORDER BY TABLE_NAME"
                    
                    cursor.execute(query, params)
                    result = cursor.fetchall()
                    
                    for row in result:
                        if isinstance(row, dict):
                            tables.append({
                                'name': row.get('TABLE_NAME'),
                                'type': 'view' if row.get('TABLE_TYPE') == 'VIEW' else 'table',
                                'schema': row.get('TABLE_SCHEMA'),
                                'row_count': row.get('TABLE_ROWS') or 0
                            })
                        else:
                            tables.append({
                                'name': row[0],
                                'type': 'view' if row[1] == 'VIEW' else 'table',
                                'schema': row[2],
                                'row_count': row[3] or 0
                            })
                            
            elif db_type == 'dm':
                # 达梦数据库
                schema = schema or connection.username.upper()
                
                query = """
                    SELECT 
                        TABLE_NAME,
                        'TABLE' as TABLE_TYPE,
                        OWNER,
                        NUM_ROWS
                    FROM ALL_TABLES 
                    WHERE OWNER = :1
                """
                params = [schema]
                
                if search:
                    query += " AND TABLE_NAME LIKE :2"
                    params.append(f'%{search.upper()}%')
                
                query += " ORDER BY TABLE_NAME"
                
                cursor.execute(query, params)
                for row in cursor.fetchall():
                    tables.append({
                        'name': row[0],
                        'type': 'table',
                        'schema': row[2],
                        'row_count': row[3] or 0
                    })
                
                # 获取视图
                view_query = """
                    SELECT 
                        VIEW_NAME,
                        'VIEW' as TABLE_TYPE,
                        OWNER
                    FROM ALL_VIEWS 
                    WHERE OWNER = :1
                """
                view_params = [schema]
                
                if search:
                    view_query += " AND VIEW_NAME LIKE :2"
                    view_params.append(f'%{search.upper()}%')
                
                view_query += " ORDER BY VIEW_NAME"
                
                cursor.execute(view_query, view_params)
                for row in cursor.fetchall():
                    tables.append({
                        'name': row[0],
                        'type': 'view',
                        'schema': row[2],
                        'row_count': 0
                    })
                    
            elif db_type == 'oracle':
                # Oracle
                schema = schema or connection.username.upper()
                
                query = """
                    SELECT 
                        TABLE_NAME,
                        'TABLE' as TABLE_TYPE,
                        OWNER,
                        NUM_ROWS
                    FROM ALL_TABLES 
                    WHERE OWNER = :1
                """
                params = [schema]
                
                if search:
                    query += " AND TABLE_NAME LIKE :2"
                    params.append(f'%{search.upper()}%')
                
                query += " ORDER BY TABLE_NAME"
                
                cursor.execute(query, params)
                for row in cursor.fetchall():
                    tables.append({
                        'name': row[0],
                        'type': 'table',
                        'schema': row[2],
                        'row_count': row[3] or 0
                    })
                
                # 获取视图
                view_query = """
                    SELECT 
                        VIEW_NAME,
                        'VIEW' as TABLE_TYPE,
                        OWNER
                    FROM ALL_VIEWS 
                    WHERE OWNER = :1
                """
                view_params = [schema]
                
                if search:
                    view_query += " AND VIEW_NAME LIKE :2"
                    view_params.append(f'%{search.upper()}%')
                
                view_query += " ORDER BY VIEW_NAME"
                
                cursor.execute(view_query, view_params)
                for row in cursor.fetchall():
                    tables.append({
                        'name': row[0],
                        'type': 'view',
                        'schema': row[2],
                        'row_count': 0
                    })
            
            cursor.close()
            return tables
            
        except Exception as e:
            logger.error(f"Failed to get tables: {e}")
            raise DatabaseQueryError(f"获取表列表失败: {str(e)}")
    
    def get_table_columns(
        self,
        connection_id: int,
        table_name: str,
        schema: Optional[str] = None,
        tenant_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        获取表的列信息
        
        Args:
            connection_id: 连接配置 ID
            table_name: 表名
            schema: Schema 名称（可选）
            tenant_id: 租户 ID (可选)
            
        Returns:
            List[Dict]: 列信息列表，每个元素包含:
                - name: 列名
                - type: 数据类型
                - nullable: 是否可空
                - default_value: 默认值
                - is_primary_key: 是否主键
                - comment: 注释
                
        Requirements: 3.4
        """
        client, db_type, connection = self._get_client_and_type(connection_id, tenant_id)
        
        try:
            cursor = client.cursor()
            columns = []
            
            if db_type == 'postgresql':
                schema = schema or 'public'
                
                # 获取列信息和主键信息
                query = """
                    SELECT 
                        c.column_name,
                        c.data_type,
                        c.is_nullable,
                        c.column_default,
                        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
                        pgd.description as column_comment
                    FROM information_schema.columns c
                    LEFT JOIN (
                        SELECT kcu.column_name
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.key_column_usage kcu 
                            ON tc.constraint_name = kcu.constraint_name
                            AND tc.table_schema = kcu.table_schema
                        WHERE tc.constraint_type = 'PRIMARY KEY'
                            AND tc.table_schema = %s
                            AND tc.table_name = %s
                    ) pk ON c.column_name = pk.column_name
                    LEFT JOIN pg_catalog.pg_statio_all_tables st 
                        ON c.table_schema = st.schemaname AND c.table_name = st.relname
                    LEFT JOIN pg_catalog.pg_description pgd 
                        ON pgd.objoid = st.relid 
                        AND pgd.objsubid = c.ordinal_position
                    WHERE c.table_schema = %s AND c.table_name = %s
                    ORDER BY c.ordinal_position
                """
                
                cursor.execute(query, [schema, table_name, schema, table_name])
                for row in cursor.fetchall():
                    columns.append({
                        'name': row[0],
                        'type': row[1],
                        'nullable': row[2] == 'YES',
                        'default_value': row[3],
                        'is_primary_key': row[4],
                        'comment': row[5]
                    })
                    
            elif db_type == 'mysql':
                db_name = schema or connection.database
                
                # 获取列信息
                query = """
                    SELECT 
                        COLUMN_NAME,
                        COLUMN_TYPE,
                        IS_NULLABLE,
                        COLUMN_DEFAULT,
                        COLUMN_KEY,
                        COLUMN_COMMENT
                    FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
                    ORDER BY ORDINAL_POSITION
                """
                
                cursor.execute(query, [db_name, table_name])
                result = cursor.fetchall()
                
                for row in result:
                    if isinstance(row, dict):
                        columns.append({
                            'name': row.get('COLUMN_NAME'),
                            'type': row.get('COLUMN_TYPE'),
                            'nullable': row.get('IS_NULLABLE') == 'YES',
                            'default_value': row.get('COLUMN_DEFAULT'),
                            'is_primary_key': row.get('COLUMN_KEY') == 'PRI',
                            'comment': row.get('COLUMN_COMMENT')
                        })
                    else:
                        columns.append({
                            'name': row[0],
                            'type': row[1],
                            'nullable': row[2] == 'YES',
                            'default_value': row[3],
                            'is_primary_key': row[4] == 'PRI',
                            'comment': row[5]
                        })
                        
            elif db_type == 'dm':
                schema = schema or connection.username.upper()
                
                # 获取列信息
                query = """
                    SELECT 
                        c.COLUMN_NAME,
                        c.DATA_TYPE,
                        c.NULLABLE,
                        c.DATA_DEFAULT,
                        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'Y' ELSE 'N' END as IS_PK,
                        cc.COMMENTS
                    FROM ALL_TAB_COLUMNS c
                    LEFT JOIN (
                        SELECT acc.COLUMN_NAME
                        FROM ALL_CONSTRAINTS ac
                        JOIN ALL_CONS_COLUMNS acc ON ac.CONSTRAINT_NAME = acc.CONSTRAINT_NAME
                        WHERE ac.CONSTRAINT_TYPE = 'P'
                            AND ac.OWNER = :1
                            AND ac.TABLE_NAME = :2
                    ) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
                    LEFT JOIN ALL_COL_COMMENTS cc 
                        ON c.OWNER = cc.OWNER 
                        AND c.TABLE_NAME = cc.TABLE_NAME 
                        AND c.COLUMN_NAME = cc.COLUMN_NAME
                    WHERE c.OWNER = :3 AND c.TABLE_NAME = :4
                    ORDER BY c.COLUMN_ID
                """
                
                cursor.execute(query, [schema, table_name.upper(), schema, table_name.upper()])
                for row in cursor.fetchall():
                    columns.append({
                        'name': row[0],
                        'type': row[1],
                        'nullable': row[2] == 'Y',
                        'default_value': row[3],
                        'is_primary_key': row[4] == 'Y',
                        'comment': row[5]
                    })
                    
            elif db_type == 'oracle':
                schema = schema or connection.username.upper()
                
                # 获取列信息
                query = """
                    SELECT 
                        c.COLUMN_NAME,
                        c.DATA_TYPE,
                        c.NULLABLE,
                        c.DATA_DEFAULT,
                        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'Y' ELSE 'N' END as IS_PK,
                        cc.COMMENTS
                    FROM ALL_TAB_COLUMNS c
                    LEFT JOIN (
                        SELECT acc.COLUMN_NAME
                        FROM ALL_CONSTRAINTS ac
                        JOIN ALL_CONS_COLUMNS acc ON ac.CONSTRAINT_NAME = acc.CONSTRAINT_NAME
                        WHERE ac.CONSTRAINT_TYPE = 'P'
                            AND ac.OWNER = :1
                            AND ac.TABLE_NAME = :2
                    ) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
                    LEFT JOIN ALL_COL_COMMENTS cc 
                        ON c.OWNER = cc.OWNER 
                        AND c.TABLE_NAME = cc.TABLE_NAME 
                        AND c.COLUMN_NAME = cc.COLUMN_NAME
                    WHERE c.OWNER = :3 AND c.TABLE_NAME = :4
                    ORDER BY c.COLUMN_ID
                """
                
                cursor.execute(query, [schema, table_name.upper(), schema, table_name.upper()])
                for row in cursor.fetchall():
                    columns.append({
                        'name': row[0],
                        'type': row[1],
                        'nullable': row[2] == 'Y',
                        'default_value': row[3],
                        'is_primary_key': row[4] == 'Y',
                        'comment': row[5]
                    })
            
            cursor.close()
            return columns
            
        except Exception as e:
            logger.error(f"Failed to get table columns: {e}")
            raise DatabaseQueryError(f"获取表列信息失败: {str(e)}")
    
    def get_table_indexes(
        self,
        connection_id: int,
        table_name: str,
        schema: Optional[str] = None,
        tenant_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        获取表的索引信息
        
        Args:
            connection_id: 连接配置 ID
            table_name: 表名
            schema: Schema 名称（可选）
            tenant_id: 租户 ID (可选)
            
        Returns:
            List[Dict]: 索引信息列表，每个元素包含:
                - name: 索引名
                - columns: 索引列列表
                - is_unique: 是否唯一索引
                - is_primary: 是否主键索引
                
        Requirements: 3.5
        """
        client, db_type, connection = self._get_client_and_type(connection_id, tenant_id)
        
        try:
            cursor = client.cursor()
            indexes = []
            
            if db_type == 'postgresql':
                schema = schema or 'public'
                
                query = """
                    SELECT 
                        i.relname as index_name,
                        array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns,
                        ix.indisunique as is_unique,
                        ix.indisprimary as is_primary
                    FROM pg_class t
                    JOIN pg_index ix ON t.oid = ix.indrelid
                    JOIN pg_class i ON i.oid = ix.indexrelid
                    JOIN pg_namespace n ON n.oid = t.relnamespace
                    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
                    WHERE n.nspname = %s AND t.relname = %s
                    GROUP BY i.relname, ix.indisunique, ix.indisprimary
                    ORDER BY i.relname
                """
                
                cursor.execute(query, [schema, table_name])
                for row in cursor.fetchall():
                    indexes.append({
                        'name': row[0],
                        'columns': row[1] if isinstance(row[1], list) else [row[1]],
                        'is_unique': row[2],
                        'is_primary': row[3]
                    })
                    
            elif db_type == 'mysql':
                db_name = schema or connection.database
                
                query = """
                    SELECT 
                        INDEX_NAME,
                        GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as columns,
                        CASE WHEN NON_UNIQUE = 0 THEN 1 ELSE 0 END as is_unique,
                        CASE WHEN INDEX_NAME = 'PRIMARY' THEN 1 ELSE 0 END as is_primary
                    FROM information_schema.STATISTICS 
                    WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
                    GROUP BY INDEX_NAME, NON_UNIQUE
                    ORDER BY INDEX_NAME
                """
                
                cursor.execute(query, [db_name, table_name])
                result = cursor.fetchall()
                
                for row in result:
                    if isinstance(row, dict):
                        columns_str = row.get('columns', '')
                        indexes.append({
                            'name': row.get('INDEX_NAME'),
                            'columns': columns_str.split(',') if columns_str else [],
                            'is_unique': bool(row.get('is_unique')),
                            'is_primary': bool(row.get('is_primary'))
                        })
                    else:
                        columns_str = row[1] or ''
                        indexes.append({
                            'name': row[0],
                            'columns': columns_str.split(',') if columns_str else [],
                            'is_unique': bool(row[2]),
                            'is_primary': bool(row[3])
                        })
                        
            elif db_type == 'dm':
                schema = schema or connection.username.upper()
                
                query = """
                    SELECT 
                        i.INDEX_NAME,
                        LISTAGG(ic.COLUMN_NAME, ',') WITHIN GROUP (ORDER BY ic.COLUMN_POSITION) as columns,
                        CASE WHEN i.UNIQUENESS = 'UNIQUE' THEN 1 ELSE 0 END as is_unique,
                        CASE WHEN c.CONSTRAINT_TYPE = 'P' THEN 1 ELSE 0 END as is_primary
                    FROM ALL_INDEXES i
                    JOIN ALL_IND_COLUMNS ic ON i.INDEX_NAME = ic.INDEX_NAME AND i.OWNER = ic.INDEX_OWNER
                    LEFT JOIN ALL_CONSTRAINTS c ON i.INDEX_NAME = c.CONSTRAINT_NAME AND i.OWNER = c.OWNER
                    WHERE i.OWNER = :1 AND i.TABLE_NAME = :2
                    GROUP BY i.INDEX_NAME, i.UNIQUENESS, c.CONSTRAINT_TYPE
                    ORDER BY i.INDEX_NAME
                """
                
                cursor.execute(query, [schema, table_name.upper()])
                for row in cursor.fetchall():
                    columns_str = row[1] or ''
                    indexes.append({
                        'name': row[0],
                        'columns': columns_str.split(',') if columns_str else [],
                        'is_unique': bool(row[2]),
                        'is_primary': bool(row[3])
                    })
                    
            elif db_type == 'oracle':
                schema = schema or connection.username.upper()
                
                query = """
                    SELECT 
                        i.INDEX_NAME,
                        LISTAGG(ic.COLUMN_NAME, ',') WITHIN GROUP (ORDER BY ic.COLUMN_POSITION) as columns,
                        CASE WHEN i.UNIQUENESS = 'UNIQUE' THEN 1 ELSE 0 END as is_unique,
                        CASE WHEN c.CONSTRAINT_TYPE = 'P' THEN 1 ELSE 0 END as is_primary
                    FROM ALL_INDEXES i
                    JOIN ALL_IND_COLUMNS ic ON i.INDEX_NAME = ic.INDEX_NAME AND i.OWNER = ic.INDEX_OWNER
                    LEFT JOIN ALL_CONSTRAINTS c ON i.INDEX_NAME = c.CONSTRAINT_NAME AND i.OWNER = c.OWNER
                    WHERE i.OWNER = :1 AND i.TABLE_NAME = :2
                    GROUP BY i.INDEX_NAME, i.UNIQUENESS, c.CONSTRAINT_TYPE
                    ORDER BY i.INDEX_NAME
                """
                
                cursor.execute(query, [schema, table_name.upper()])
                for row in cursor.fetchall():
                    columns_str = row[1] or ''
                    indexes.append({
                        'name': row[0],
                        'columns': columns_str.split(',') if columns_str else [],
                        'is_unique': bool(row[2]),
                        'is_primary': bool(row[3])
                    })
            
            cursor.close()
            return indexes
            
        except Exception as e:
            logger.error(f"Failed to get table indexes: {e}")
            raise DatabaseQueryError(f"获取表索引信息失败: {str(e)}")

    
    # ==================== 服务器信息获取 ====================
    
    def get_server_info(
        self,
        connection_id: int,
        tenant_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        获取数据库服务器信息
        
        Args:
            connection_id: 连接配置 ID
            tenant_id: 租户 ID (可选)
            
        Returns:
            Dict: 服务器信息，包含:
                - version: 数据库版本
                - uptime: 运行时间（可选）
                - connections: 当前连接数
                - database_size: 数据库大小（可选）
                - db_type: 数据库类型
                
        Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
        """
        client, db_type, connection = self._get_client_and_type(connection_id, tenant_id)
        
        try:
            cursor = client.cursor()
            server_info = {
                'db_type': db_type,
                'version': '',
                'uptime': None,
                'connections': 0,
                'database_size': None,
                'max_connections': None,
                'server_encoding': None
            }
            
            if db_type == 'postgresql':
                # 获取版本信息
                cursor.execute("SELECT version()")
                version_row = cursor.fetchone()
                server_info['version'] = version_row[0].split(',')[0] if version_row else ''
                
                # 获取服务器启动时间和运行时间
                cursor.execute("SELECT pg_postmaster_start_time()")
                start_time_row = cursor.fetchone()
                if start_time_row and start_time_row[0]:
                    start_time = start_time_row[0]
                    # 计算运行时间
                    cursor.execute("SELECT now() - pg_postmaster_start_time()")
                    uptime_row = cursor.fetchone()
                    if uptime_row:
                        server_info['uptime'] = str(uptime_row[0])
                
                # 获取当前连接数
                cursor.execute("SELECT count(*) FROM pg_stat_activity")
                conn_count_row = cursor.fetchone()
                server_info['connections'] = conn_count_row[0] if conn_count_row else 0
                
                # 获取最大连接数
                cursor.execute("SHOW max_connections")
                max_conn_row = cursor.fetchone()
                server_info['max_connections'] = int(max_conn_row[0]) if max_conn_row else None
                
                # 获取数据库大小
                if connection.database:
                    cursor.execute("SELECT pg_size_pretty(pg_database_size(%s))", [connection.database])
                    size_row = cursor.fetchone()
                    server_info['database_size'] = size_row[0] if size_row else None
                
                # 获取服务器编码
                cursor.execute("SHOW server_encoding")
                encoding_row = cursor.fetchone()
                server_info['server_encoding'] = encoding_row[0] if encoding_row else None
                
            elif db_type == 'mysql':
                # 获取版本信息
                cursor.execute("SELECT VERSION()")
                version_row = cursor.fetchone()
                if isinstance(version_row, dict):
                    server_info['version'] = version_row.get('VERSION()') or list(version_row.values())[0]
                else:
                    server_info['version'] = version_row[0] if version_row else ''
                
                # 获取运行时间
                cursor.execute("SHOW GLOBAL STATUS LIKE 'Uptime'")
                uptime_row = cursor.fetchone()
                if uptime_row:
                    if isinstance(uptime_row, dict):
                        uptime_seconds = int(uptime_row.get('Value', 0))
                    else:
                        uptime_seconds = int(uptime_row[1]) if len(uptime_row) > 1 else 0
                    
                    # 转换为可读格式
                    days = uptime_seconds // 86400
                    hours = (uptime_seconds % 86400) // 3600
                    minutes = (uptime_seconds % 3600) // 60
                    seconds = uptime_seconds % 60
                    server_info['uptime'] = f"{days}d {hours}h {minutes}m {seconds}s"
                
                # 获取当前连接数
                cursor.execute("SHOW GLOBAL STATUS LIKE 'Threads_connected'")
                conn_row = cursor.fetchone()
                if conn_row:
                    if isinstance(conn_row, dict):
                        server_info['connections'] = int(conn_row.get('Value', 0))
                    else:
                        server_info['connections'] = int(conn_row[1]) if len(conn_row) > 1 else 0
                
                # 获取最大连接数
                cursor.execute("SHOW VARIABLES LIKE 'max_connections'")
                max_conn_row = cursor.fetchone()
                if max_conn_row:
                    if isinstance(max_conn_row, dict):
                        server_info['max_connections'] = int(max_conn_row.get('Value', 0))
                    else:
                        server_info['max_connections'] = int(max_conn_row[1]) if len(max_conn_row) > 1 else None
                
                # 获取数据库大小
                if connection.database:
                    cursor.execute("""
                        SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
                        FROM information_schema.TABLES 
                        WHERE table_schema = %s
                    """, [connection.database])
                    size_row = cursor.fetchone()
                    if size_row:
                        if isinstance(size_row, dict):
                            size_mb = size_row.get('size_mb')
                        else:
                            size_mb = size_row[0]
                        if size_mb:
                            server_info['database_size'] = f"{size_mb} MB"
                
                # 获取字符集
                cursor.execute("SHOW VARIABLES LIKE 'character_set_server'")
                charset_row = cursor.fetchone()
                if charset_row:
                    if isinstance(charset_row, dict):
                        server_info['server_encoding'] = charset_row.get('Value')
                    else:
                        server_info['server_encoding'] = charset_row[1] if len(charset_row) > 1 else None
                
            elif db_type == 'dm':
                # 达梦数据库
                # 获取版本信息
                cursor.execute("SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1")
                version_row = cursor.fetchone()
                server_info['version'] = version_row[0] if version_row else ''
                
                # 获取实例启动时间
                try:
                    cursor.execute("SELECT STARTUP_TIME FROM V$INSTANCE")
                    startup_row = cursor.fetchone()
                    if startup_row and startup_row[0]:
                        server_info['uptime'] = f"Started at: {startup_row[0]}"
                except Exception:
                    pass
                
                # 获取当前会话数
                try:
                    cursor.execute("SELECT COUNT(*) FROM V$SESSION")
                    session_row = cursor.fetchone()
                    server_info['connections'] = session_row[0] if session_row else 0
                except Exception:
                    pass
                
                # 获取数据库大小
                try:
                    cursor.execute("""
                        SELECT ROUND(SUM(BYTES) / 1024 / 1024, 2) 
                        FROM DBA_DATA_FILES
                    """)
                    size_row = cursor.fetchone()
                    if size_row and size_row[0]:
                        server_info['database_size'] = f"{size_row[0]} MB"
                except Exception:
                    pass
                
            elif db_type == 'oracle':
                # Oracle
                # 获取版本信息
                cursor.execute("SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1")
                version_row = cursor.fetchone()
                server_info['version'] = version_row[0] if version_row else ''
                
                # 获取实例启动时间
                try:
                    cursor.execute("SELECT STARTUP_TIME FROM V$INSTANCE")
                    startup_row = cursor.fetchone()
                    if startup_row and startup_row[0]:
                        server_info['uptime'] = f"Started at: {startup_row[0]}"
                except Exception:
                    pass
                
                # 获取当前会话数
                try:
                    cursor.execute("SELECT COUNT(*) FROM V$SESSION WHERE TYPE = 'USER'")
                    session_row = cursor.fetchone()
                    server_info['connections'] = session_row[0] if session_row else 0
                except Exception:
                    pass
                
                # 获取最大会话数
                try:
                    cursor.execute("SELECT VALUE FROM V$PARAMETER WHERE NAME = 'sessions'")
                    max_session_row = cursor.fetchone()
                    if max_session_row:
                        server_info['max_connections'] = int(max_session_row[0])
                except Exception:
                    pass
                
                # 获取数据库大小
                try:
                    cursor.execute("""
                        SELECT ROUND(SUM(BYTES) / 1024 / 1024, 2) 
                        FROM DBA_DATA_FILES
                    """)
                    size_row = cursor.fetchone()
                    if size_row and size_row[0]:
                        server_info['database_size'] = f"{size_row[0]} MB"
                except Exception:
                    pass
                
                # 获取字符集
                try:
                    cursor.execute("SELECT VALUE FROM NLS_DATABASE_PARAMETERS WHERE PARAMETER = 'NLS_CHARACTERSET'")
                    charset_row = cursor.fetchone()
                    if charset_row:
                        server_info['server_encoding'] = charset_row[0]
                except Exception:
                    pass
            
            cursor.close()
            return server_info
            
        except Exception as e:
            logger.error(f"Failed to get server info: {e}")
            raise DatabaseQueryError(f"获取服务器信息失败: {str(e)}")
    
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
        """
        执行 SQL 查询
        
        Args:
            connection_id: 连接配置 ID
            sql: SQL 查询语句
            page: 页码 (默认 1)
            per_page: 每页数量 (默认 50)
            max_rows: 最大返回行数 (默认 1000)
            tenant_id: 租户 ID (可选)
            
        Returns:
            Dict: 查询结果，包含:
                - columns: 列名列表
                - rows: 数据行列表
                - row_count: 返回行数
                - total_count: 总行数（如果可获取）
                - execution_time: 执行时间（毫秒）
                - affected_rows: 受影响行数（对于 INSERT/UPDATE/DELETE）
                - is_select: 是否为 SELECT 查询
                - pagination: 分页信息
                
        Requirements: 4.2, 4.3, 4.4, 4.5, 4.8
        """
        import time
        
        if not sql or not sql.strip():
            raise ValueError("SQL 语句不能为空")
        
        # 验证分页参数
        if page < 1:
            page = 1
        if per_page < 1:
            per_page = 50
        if per_page > max_rows:
            per_page = max_rows
        if max_rows < 1:
            max_rows = 1000
        
        client, db_type, connection = self._get_client_and_type(connection_id, tenant_id)
        
        try:
            cursor = client.cursor()
            
            # 记录开始时间
            start_time = time.time()
            
            # 判断是否为 SELECT 查询
            sql_upper = sql.strip().upper()
            is_select = sql_upper.startswith('SELECT') or sql_upper.startswith('WITH')
            is_dml = sql_upper.startswith(('INSERT', 'UPDATE', 'DELETE'))
            is_ddl = sql_upper.startswith(('CREATE', 'ALTER', 'DROP', 'TRUNCATE'))
            
            # 检查是否是特殊命令（SHOW, DESCRIBE 等）- 这些命令返回结果但不能分页
            special_commands = ('SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN')
            is_special = any(sql_upper.startswith(cmd) for cmd in special_commands)
            
            logger.info(f"Executing SQL: {sql[:100]}... | is_select={is_select}, is_special={is_special}, is_dml={is_dml}, is_ddl={is_ddl}")
            
            result = {
                'columns': [],
                'rows': [],
                'row_count': 0,
                'total_count': None,
                'execution_time': 0,
                'affected_rows': None,
                'is_select': is_select or is_special,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': 0,
                    'pages': 0,
                    'has_prev': False,
                    'has_next': False
                }
            }
            
            # 处理特殊命令（SHOW, DESCRIBE 等）- 直接执行，不分页
            if is_special:
                cursor.execute(sql)
                
                if cursor.description:
                    result['columns'] = [desc[0] for desc in cursor.description]
                    rows = cursor.fetchall()
                    
                    for row in rows:
                        if isinstance(row, dict):
                            row_data = [row.get(col) for col in result['columns']]
                        else:
                            row_data = list(row)
                        row_data = self._convert_row_to_json(row_data)
                        result['rows'].append(row_data)
                    
                    result['row_count'] = len(result['rows'])
                    result['total_count'] = result['row_count']
                    result['pagination']['total'] = result['row_count']
                    result['pagination']['pages'] = 1
                
                result['execution_time'] = int((time.time() - start_time) * 1000)
                cursor.close()
                return result
            
            elif is_select:
                # 对于 SELECT 查询，实现分页
                # 首先获取总行数（如果可能）
                total_count = None
                
                # 去掉 SQL 末尾的分号
                sql_clean = sql.rstrip().rstrip(';')
                
                # 尝试获取总行数（包装原始查询）
                try:
                    count_sql = f"SELECT COUNT(*) FROM ({sql_clean}) AS count_query"
                    if db_type == 'oracle':
                        count_sql = f"SELECT COUNT(*) FROM ({sql_clean})"
                    elif db_type == 'dm':
                        count_sql = f"SELECT COUNT(*) FROM ({sql_clean})"
                    elif db_type == 'mysql':
                        count_sql = f"SELECT COUNT(*) FROM ({sql_clean}) AS count_query"
                    
                    cursor.execute(count_sql)
                    count_row = cursor.fetchone()
                    if count_row:
                        if isinstance(count_row, dict):
                            total_count = list(count_row.values())[0]
                        else:
                            total_count = count_row[0]
                except Exception as e:
                    # 如果无法获取总行数，继续执行查询
                    logger.debug(f"Could not get total count: {e}")
                
                # 构建分页查询
                offset = (page - 1) * per_page
                limit = min(per_page, max_rows - offset) if offset < max_rows else 0
                
                if limit <= 0:
                    # 超出最大行数限制
                    result['execution_time'] = int((time.time() - start_time) * 1000)
                    result['total_count'] = total_count
                    cursor.close()
                    return result
                
                # 去掉 SQL 末尾的分号，以便添加 LIMIT/OFFSET
                sql_for_pagination = sql.rstrip().rstrip(';')
                
                # 根据数据库类型构建分页 SQL
                if db_type == 'postgresql':
                    paginated_sql = f"{sql_for_pagination} LIMIT {limit} OFFSET {offset}"
                elif db_type == 'mysql':
                    paginated_sql = f"{sql_for_pagination} LIMIT {limit} OFFSET {offset}"
                elif db_type == 'dm':
                    # 达梦使用 LIMIT OFFSET 或 ROWNUM
                    paginated_sql = f"SELECT * FROM ({sql_for_pagination}) WHERE ROWNUM <= {offset + limit}"
                    if offset > 0:
                        paginated_sql = f"""
                            SELECT * FROM (
                                SELECT t.*, ROWNUM AS rn FROM ({sql_for_pagination}) t WHERE ROWNUM <= {offset + limit}
                            ) WHERE rn > {offset}
                        """
                elif db_type == 'oracle':
                    # Oracle 12c+ 支持 OFFSET FETCH，旧版本使用 ROWNUM
                    paginated_sql = f"""
                        SELECT * FROM (
                            SELECT t.*, ROWNUM AS rn FROM ({sql_for_pagination}) t WHERE ROWNUM <= {offset + limit}
                        ) WHERE rn > {offset}
                    """
                else:
                    paginated_sql = sql_for_pagination
                
                # 执行分页查询
                cursor.execute(paginated_sql)
                
                # 获取列名
                if cursor.description:
                    if db_type == 'mysql':
                        # MySQL DictCursor 返回字典
                        result['columns'] = [desc[0] for desc in cursor.description]
                    else:
                        result['columns'] = [desc[0] for desc in cursor.description]
                    
                    # 过滤掉分页辅助列（如 rn）
                    if db_type in ('oracle', 'dm') and 'rn' in [c.lower() for c in result['columns']]:
                        rn_index = [c.lower() for c in result['columns']].index('rn')
                        result['columns'] = result['columns'][:rn_index] + result['columns'][rn_index+1:]
                
                # 获取数据行
                rows = cursor.fetchall()
                
                for row in rows:
                    if isinstance(row, dict):
                        # MySQL DictCursor
                        row_data = [row.get(col) for col in result['columns']]
                    else:
                        row_data = list(row)
                        # 过滤掉分页辅助列
                        if db_type in ('oracle', 'dm') and len(row_data) > len(result['columns']):
                            row_data = row_data[:len(result['columns'])]
                    
                    # 转换数据类型为 JSON 可序列化格式
                    row_data = self._convert_row_to_json(row_data)
                    result['rows'].append(row_data)
                
                result['row_count'] = len(result['rows'])
                result['total_count'] = total_count if total_count is not None else result['row_count']
                
                # 计算分页信息
                if total_count is not None:
                    total_pages = (total_count + per_page - 1) // per_page
                    result['pagination'] = {
                        'page': page,
                        'per_page': per_page,
                        'total': total_count,
                        'pages': total_pages,
                        'has_prev': page > 1,
                        'has_next': page < total_pages
                    }
                else:
                    result['pagination'] = {
                        'page': page,
                        'per_page': per_page,
                        'total': result['row_count'],
                        'pages': 1,
                        'has_prev': False,
                        'has_next': False
                    }
                
            elif is_dml:
                # 对于 INSERT/UPDATE/DELETE，执行并获取受影响行数
                cursor.execute(sql)
                result['affected_rows'] = cursor.rowcount
                
                # 提交事务
                client.commit()
                
            elif is_ddl:
                # 对于 DDL 语句，执行并提交
                cursor.execute(sql)
                result['affected_rows'] = 0
                
                # 提交事务
                client.commit()
                
            else:
                # 其他类型的 SQL
                cursor.execute(sql)
                
                if cursor.description:
                    # 有返回结果
                    result['columns'] = [desc[0] for desc in cursor.description]
                    rows = cursor.fetchmany(max_rows)
                    
                    for row in rows:
                        if isinstance(row, dict):
                            row_data = [row.get(col) for col in result['columns']]
                        else:
                            row_data = list(row)
                        row_data = self._convert_row_to_json(row_data)
                        result['rows'].append(row_data)
                    
                    result['row_count'] = len(result['rows'])
                else:
                    result['affected_rows'] = cursor.rowcount
            
            # 计算执行时间
            result['execution_time'] = int((time.time() - start_time) * 1000)
            
            cursor.close()
            return result
            
        except Exception as e:
            # 回滚事务
            try:
                client.rollback()
            except Exception:
                pass
            
            error_msg = str(e)
            logger.error(f"Failed to execute query: {error_msg}")
            
            # 解析错误信息
            if 'syntax' in error_msg.lower():
                raise DatabaseQueryError(f"SQL 语法错误: {error_msg}")
            else:
                raise DatabaseQueryError(f"查询执行失败: {error_msg}")
    
    def _convert_row_to_json(self, row: List[Any]) -> List[Any]:
        """
        将数据行转换为 JSON 可序列化格式
        
        Args:
            row: 数据行
            
        Returns:
            List: 转换后的数据行
        """
        result = []
        for value in row:
            if value is None:
                result.append(None)
            elif isinstance(value, datetime):
                result.append(value.isoformat())
            elif isinstance(value, (bytes, bytearray)):
                # 二进制数据转为 Base64
                result.append(base64.b64encode(value).decode('utf-8'))
            elif isinstance(value, (int, float, str, bool)):
                result.append(value)
            else:
                # 其他类型转为字符串
                result.append(str(value))
        return result

    
    # ==================== CSV 导出功能 ====================
    
    def export_csv(
        self,
        connection_id: int,
        sql: str,
        max_rows: int = 10000,
        tenant_id: Optional[int] = None
    ) -> bytes:
        """
        将查询结果导出为 CSV 格式
        
        Args:
            connection_id: 连接配置 ID
            sql: SQL 查询语句
            max_rows: 最大导出行数 (默认 10000)
            tenant_id: 租户 ID (可选)
            
        Returns:
            bytes: CSV 文件内容
            
        Requirements: 4.7
        """
        if not sql or not sql.strip():
            raise ValueError("SQL 语句不能为空")
        
        # 只允许 SELECT 查询导出
        sql_upper = sql.strip().upper()
        if not (sql_upper.startswith('SELECT') or sql_upper.startswith('WITH')):
            raise ValueError("只能导出 SELECT 查询结果")
        
        if max_rows < 1:
            max_rows = 10000
        
        client, db_type, connection = self._get_client_and_type(connection_id, tenant_id)
        
        try:
            cursor = client.cursor()
            
            # 执行查询
            cursor.execute(sql)
            
            # 获取列名
            columns = []
            if cursor.description:
                columns = [desc[0] for desc in cursor.description]
            
            # 创建 CSV 输出
            output = io.StringIO()
            writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
            
            # 写入表头
            writer.writerow(columns)
            
            # 写入数据行
            row_count = 0
            while row_count < max_rows:
                rows = cursor.fetchmany(1000)  # 批量获取
                if not rows:
                    break
                
                for row in rows:
                    if row_count >= max_rows:
                        break
                    
                    if isinstance(row, dict):
                        row_data = [row.get(col) for col in columns]
                    else:
                        row_data = list(row)
                    
                    # 转换数据类型
                    csv_row = self._convert_row_to_csv(row_data)
                    writer.writerow(csv_row)
                    row_count += 1
            
            cursor.close()
            
            # 返回 UTF-8 编码的 CSV 内容（带 BOM 以支持 Excel）
            csv_content = output.getvalue()
            return ('\ufeff' + csv_content).encode('utf-8')
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to export CSV: {error_msg}")
            raise DatabaseQueryError(f"CSV 导出失败: {error_msg}")
    
    def _convert_row_to_csv(self, row: List[Any]) -> List[str]:
        """
        将数据行转换为 CSV 格式
        
        Args:
            row: 数据行
            
        Returns:
            List[str]: 转换后的字符串列表
        """
        result = []
        for value in row:
            if value is None:
                result.append('')
            elif isinstance(value, datetime):
                result.append(value.strftime('%Y-%m-%d %H:%M:%S'))
            elif isinstance(value, (bytes, bytearray)):
                # 二进制数据显示为 [BINARY]
                result.append('[BINARY]')
            elif isinstance(value, bool):
                result.append('TRUE' if value else 'FALSE')
            elif isinstance(value, (int, float)):
                result.append(str(value))
            else:
                result.append(str(value))
        return result


# 创建全局服务实例
database_management_service = DatabaseManagementService()
