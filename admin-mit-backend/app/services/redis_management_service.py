"""
Redis 管理服务

提供 Redis 连接配置的 CRUD 操作，以及连接测试功能。
密码使用 Fernet 对称加密存储。

Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 3.1-3.6, 4.2-4.11
"""
import os
import json
import base64
import logging
from typing import Dict, List, Optional, Tuple, Any

from flask import g
from sqlalchemy.exc import IntegrityError
from cryptography.fernet import Fernet

from app.extensions import db
from app.models.redis_connection import RedisConnection
from app.services.redis_connection_manager import (
    redis_connection_manager,
    RedisConnectionException,
    RedisTimeoutException,
    RedisOperationError,
)

logger = logging.getLogger(__name__)


class PasswordEncryptionService:
    """
    密码加密服务
    
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
        # 尝试从环境变量获取密钥
        key_str = os.environ.get('REDIS_PASSWORD_ENCRYPTION_KEY')
        
        if key_str:
            # 如果是 base64 编码的密钥
            try:
                self._key = base64.urlsafe_b64decode(key_str)
            except Exception:
                # 如果不是 base64，尝试直接使用
                self._key = key_str.encode() if isinstance(key_str, str) else key_str
        else:
            # 生成新密钥（仅用于开发环境）
            self._key = Fernet.generate_key()
            logger.warning(
                "REDIS_PASSWORD_ENCRYPTION_KEY not set, using generated key. "
                "This is not recommended for production!"
            )
        
        # 确保密钥是有效的 Fernet 密钥
        try:
            self._fernet = Fernet(self._key)
        except Exception as e:
            # 如果密钥无效，生成新密钥
            logger.warning(f"Invalid encryption key, generating new one: {e}")
            self._key = Fernet.generate_key()
            self._fernet = Fernet(self._key)
    
    def encrypt(self, plaintext: str) -> str:
        """
        加密明文
        
        Args:
            plaintext: 明文字符串
            
        Returns:
            str: 加密后的字符串（Fernet 格式已经是 base64）
        """
        if not plaintext:
            return ""
        
        encrypted = self._fernet.encrypt(plaintext.encode('utf-8'))
        # Fernet 加密结果已经是 base64 编码，直接返回
        return encrypted.decode('utf-8')
    
    def decrypt(self, ciphertext: str) -> str:
        """
        解密密文
        
        Args:
            ciphertext: 加密后的字符串
            
        Returns:
            str: 解密后的明文
        """
        if not ciphertext:
            return ""
        
        # 检查是否是 Fernet 加密格式（以 gAAAAA 开头）
        if ciphertext.startswith('gAAAAA'):
            try:
                decrypted = self._fernet.decrypt(ciphertext.encode('utf-8'))
                return decrypted.decode('utf-8')
            except Exception as e:
                logger.error(f"Failed to decrypt Fernet password: {e}")
                raise ValueError("密码解密失败，请重新设置密码")
        
        # 检查是否是 Base64 编码的 Fernet 格式（旧格式兼容）
        if ciphertext.startswith('Z0FBQUFB'):
            try:
                decoded = base64.urlsafe_b64decode(ciphertext.encode('utf-8'))
                if decoded.startswith(b'gAAAAA'):
                    decrypted = self._fernet.decrypt(decoded)
                    return decrypted.decode('utf-8')
            except Exception as e:
                logger.error(f"Failed to decrypt Base64+Fernet password: {e}")
                # 继续尝试其他方式
        
        # 不是加密格式，直接返回（明文密码）
        logger.debug(f"Password is not encrypted, using as plaintext")
        return ciphertext


# 全局密码加密服务实例
password_encryption_service = PasswordEncryptionService()


class RedisManagementService:
    """
    Redis 管理服务
    
    提供 Redis 连接配置的 CRUD 操作，以及连接测试功能。
    """
    
    def __init__(self):
        """初始化服务"""
        self._encryption_service = password_encryption_service
        self._connection_manager = redis_connection_manager
    
    # ==================== 连接配置 CRUD ====================
    
    def create_connection(self, config: Dict[str, Any], tenant_id: Optional[int] = None) -> RedisConnection:
        """
        创建 Redis 连接配置
        
        Args:
            config: 连接配置字典，包含:
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
            tenant_id: 租户 ID (可选，默认从 g 中获取)
            
        Returns:
            RedisConnection: 创建的连接配置对象
            
        Raises:
            ValueError: 参数验证失败
            IntegrityError: 连接名称重复
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        # 验证必填字段
        if not config.get('name'):
            raise ValueError("连接名称不能为空")
        
        connection_type = config.get('connection_type', 'standalone')
        
        if connection_type == 'standalone':
            if not config.get('host'):
                raise ValueError("单机模式下主机地址不能为空")
        elif connection_type == 'cluster':
            if not config.get('cluster_nodes'):
                raise ValueError("集群模式下节点列表不能为空")
        else:
            raise ValueError(f"不支持的连接类型: {connection_type}")
        
        try:
            # 加密密码
            password = config.get('password', '')
            encrypted_password = self._encryption_service.encrypt(password) if password else ''
            
            # 处理集群节点
            cluster_nodes = config.get('cluster_nodes')
            if cluster_nodes and isinstance(cluster_nodes, list):
                cluster_nodes = json.dumps(cluster_nodes)
            
            # 创建连接配置
            connection = RedisConnection(
                tenant_id=tenant_id,
                name=config['name'],
                connection_type=connection_type,
                host=config.get('host', ''),
                port=config.get('port', 6379),
                password=encrypted_password,
                database=config.get('database', 0),
                cluster_nodes=cluster_nodes,
                timeout=config.get('timeout', 5),
                description=config.get('description', ''),
                status=config.get('status', 1),
            )
            
            db.session.add(connection)
            db.session.commit()
            
            logger.info(f"Created Redis connection: {connection.name} (ID: {connection.id})")
            return connection
            
        except IntegrityError as e:
            db.session.rollback()
            logger.error(f"Failed to create Redis connection - duplicate name: {e}")
            raise ValueError(f"连接名称 '{config['name']}' 已存在")
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to create Redis connection: {e}")
            raise
    
    def update_connection(
        self,
        connection_id: int,
        config: Dict[str, Any],
        tenant_id: Optional[int] = None
    ) -> RedisConnection:
        """
        更新 Redis 连接配置
        
        Args:
            connection_id: 连接配置 ID
            config: 更新的配置字典
            tenant_id: 租户 ID (可选)
            
        Returns:
            RedisConnection: 更新后的连接配置对象
            
        Raises:
            ValueError: 连接配置不存在或参数验证失败
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        connection = RedisConnection.get_by_tenant(connection_id, tenant_id)
        if not connection:
            raise ValueError(f"连接配置不存在: ID={connection_id}")
        
        try:
            # 更新字段
            if 'name' in config:
                connection.name = config['name']
            
            if 'connection_type' in config:
                connection.connection_type = config['connection_type']
            
            if 'host' in config:
                connection.host = config['host']
            
            if 'port' in config:
                connection.port = config['port']
            
            if 'password' in config:
                # 加密新密码
                password = config['password']
                connection.password = self._encryption_service.encrypt(password) if password else ''
            
            if 'database' in config:
                connection.database = config['database']
            
            if 'cluster_nodes' in config:
                cluster_nodes = config['cluster_nodes']
                if cluster_nodes and isinstance(cluster_nodes, list):
                    cluster_nodes = json.dumps(cluster_nodes)
                connection.cluster_nodes = cluster_nodes
            
            if 'timeout' in config:
                connection.timeout = config['timeout']
            
            if 'description' in config:
                connection.description = config['description']
            
            if 'status' in config:
                connection.status = config['status']
            
            db.session.commit()
            
            # 如果连接已建立，关闭旧连接
            self._connection_manager.close_client(connection_id, tenant_id)
            
            logger.info(f"Updated Redis connection: {connection.name} (ID: {connection.id})")
            return connection
            
        except IntegrityError as e:
            db.session.rollback()
            logger.error(f"Failed to update Redis connection - duplicate name: {e}")
            raise ValueError(f"连接名称 '{config.get('name')}' 已存在")
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to update Redis connection: {e}")
            raise
    
    def delete_connection(self, connection_id: int, tenant_id: Optional[int] = None) -> bool:
        """
        删除 Redis 连接配置
        
        Args:
            connection_id: 连接配置 ID
            tenant_id: 租户 ID (可选)
            
        Returns:
            bool: 是否删除成功
            
        Raises:
            ValueError: 连接配置不存在
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        connection = RedisConnection.get_by_tenant(connection_id, tenant_id)
        if not connection:
            raise ValueError(f"连接配置不存在: ID={connection_id}")
        
        try:
            # 关闭活跃连接
            self._connection_manager.close_client(connection_id, tenant_id)
            
            # 删除配置
            db.session.delete(connection)
            db.session.commit()
            
            logger.info(f"Deleted Redis connection: ID={connection_id}")
            return True
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to delete Redis connection: {e}")
            raise
    
    def get_connection(
        self,
        connection_id: int,
        tenant_id: Optional[int] = None,
        include_password: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        获取 Redis 连接配置
        
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
        
        connection = RedisConnection.get_by_tenant(connection_id, tenant_id)
        if not connection:
            return None
        
        result = connection.to_dict(include_sensitive=include_password)
        
        # 解析集群节点
        if result.get('cluster_nodes'):
            try:
                result['cluster_nodes'] = json.loads(result['cluster_nodes'])
            except json.JSONDecodeError:
                pass
        
        # 解密密码
        if include_password and result.get('password'):
            result['password'] = self._encryption_service.decrypt(result['password'])
        
        # 添加连接状态
        result['is_connected'] = self._connection_manager.is_connected(connection_id, tenant_id)
        
        return result
    
    def list_connections(
        self,
        tenant_id: Optional[int] = None,
        page: int = 1,
        per_page: int = 50,
        search: str = '',
        status: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        获取 Redis 连接配置列表
        
        Args:
            tenant_id: 租户 ID (可选)
            page: 页码 (默认 1)
            per_page: 每页数量 (默认 50)
            search: 搜索关键词
            status: 状态过滤
            
        Returns:
            dict: 包含连接列表和分页信息的字典
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        try:
            query = RedisConnection.query_by_tenant(tenant_id)
            
            # 搜索过滤
            if search:
                query = query.filter(
                    db.or_(
                        RedisConnection.name.ilike(f'%{search}%'),
                        RedisConnection.host.ilike(f'%{search}%'),
                        RedisConnection.description.ilike(f'%{search}%')
                    )
                )
            
            # 状态过滤
            if status is not None:
                query = query.filter(RedisConnection.status == status)
            
            # 按创建时间倒序
            query = query.order_by(RedisConnection.created_at.desc())
            
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
                # 解析集群节点
                if conn_dict.get('cluster_nodes'):
                    try:
                        conn_dict['cluster_nodes'] = json.loads(conn_dict['cluster_nodes'])
                    except json.JSONDecodeError:
                        pass
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
            logger.error(f"Failed to list Redis connections: {e}")
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
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        connection = RedisConnection.get_by_tenant(connection_id, tenant_id)
        if not connection:
            return False, f"连接配置不存在: ID={connection_id}"
        
        # 解密密码
        password = self._encryption_service.decrypt(connection.password) if connection.password else None
        
        # 使用连接管理器测试连接
        return self._connection_manager.test_connection(
            connection_type=connection.connection_type,
            host=connection.host,
            port=connection.port,
            password=password,
            database=connection.database or 0,
            cluster_nodes=connection.cluster_nodes,
            timeout=connection.timeout or 5
        )
    
    def test_connection_config(self, config: Dict[str, Any]) -> Tuple[bool, str]:
        """
        测试连接配置（不保存）
        
        Args:
            config: 连接配置字典
            
        Returns:
            Tuple[bool, str]: (是否成功, 消息)
        """
        connection_type = config.get('connection_type', 'standalone')
        
        # 处理集群节点
        cluster_nodes = config.get('cluster_nodes')
        if cluster_nodes and isinstance(cluster_nodes, list):
            cluster_nodes = json.dumps(cluster_nodes)
        
        return self._connection_manager.test_connection(
            connection_type=connection_type,
            host=config.get('host'),
            port=config.get('port', 6379),
            password=config.get('password'),
            database=config.get('database', 0),
            cluster_nodes=cluster_nodes,
            timeout=config.get('timeout', 5)
        )
    
    # ==================== 键值操作 ====================
    
    def _get_redis_client(self, conn_id: int, tenant_id: Optional[int] = None):
        """
        获取 Redis 客户端
        
        Args:
            conn_id: 连接配置 ID
            tenant_id: 租户 ID (可选)
            
        Returns:
            Redis 客户端实例
            
        Raises:
            ValueError: 租户ID为空或连接配置不存在
            RedisConnectionException: 连接失败
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        # 获取连接配置
        connection = RedisConnection.get_by_tenant(conn_id, tenant_id)
        if not connection:
            raise ValueError(f"连接配置不存在: ID={conn_id}")
        
        # 解密密码
        decrypted_password = None
        if connection.password:
            try:
                decrypted_password = self._encryption_service.decrypt(connection.password)
                logger.debug(f"Password decrypted for connection {conn_id}")
            except Exception as e:
                logger.error(f"Password decryption failed for connection {conn_id}: {e}")
                raise RedisConnectionException("密码解密失败")
        else:
            logger.debug(f"No password set for connection {conn_id}")
        
        # 临时设置解密后的密码用于连接
        original_password = connection.password
        connection.password = decrypted_password
        
        try:
            client = self._connection_manager.get_client(
                conn_id=conn_id,
                tenant_id=tenant_id,
                connection_config=connection
            )
            logger.info(f"Successfully got Redis client for connection {conn_id}")
            return client
        except Exception as e:
            logger.error(f"Failed to get Redis client for connection {conn_id}: {e}")
            raise
        finally:
            # 恢复加密密码
            if original_password is not None:
                connection.password = original_password
    
    def scan_keys(
        self,
        conn_id: int,
        pattern: str = '*',
        cursor: int = 0,
        count: int = 50,
        database: Optional[int] = None,
        tenant_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        扫描 Redis 键列表
        
        使用 SCAN 命令进行增量迭代，避免阻塞服务器。
        
        Args:
            conn_id: 连接配置 ID
            pattern: 键名匹配模式 (默认 '*')
            cursor: 游标位置 (默认 0)
            count: 每次扫描返回的建议数量 (默认 50)
            database: 数据库索引 (可选，仅单机模式有效)
            tenant_id: 租户 ID (可选)
            
        Returns:
            dict: 包含键列表和游标信息的字典
                - cursor: 下一个游标位置 (0 表示扫描完成)
                - keys: 键信息列表
                - total_scanned: 本次扫描的键数量
                
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 3.1, 3.2, 3.3, 3.6
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        # 验证分页参数
        if count < 1:
            count = 50
        if count > 1000:
            count = 1000
        if cursor < 0:
            cursor = 0
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 如果指定了数据库且是单机模式，切换数据库
            connection = RedisConnection.get_by_tenant(conn_id, tenant_id)
            if database is not None and connection.connection_type == 'standalone':
                client.select(database)
            
            # 使用 SCAN 命令扫描键
            next_cursor, keys = client.scan(cursor=cursor, match=pattern, count=count)
            
            # 获取每个键的类型和 TTL
            key_infos = []
            for key in keys:
                try:
                    key_type = client.type(key)
                    ttl = client.ttl(key)
                    key_infos.append({
                        'key': key,
                        'type': key_type,
                        'ttl': ttl  # -1 表示永不过期, -2 表示键不存在
                    })
                except Exception as e:
                    logger.warning(f"Failed to get info for key {key}: {e}")
                    key_infos.append({
                        'key': key,
                        'type': 'unknown',
                        'ttl': -2
                    })
            
            return {
                'cursor': next_cursor,
                'keys': key_infos,
                'total_scanned': len(key_infos)
            }
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except Exception as e:
            logger.error(f"Failed to scan keys: {e}")
            raise RedisOperationError(f"扫描键失败: {str(e)}")
    
    def get_key_info(
        self,
        conn_id: int,
        key: str,
        tenant_id: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """
        获取键的详细信息
        
        Args:
            conn_id: 连接配置 ID
            key: 键名
            tenant_id: 租户 ID (可选)
            
        Returns:
            dict: 键信息字典，如果键不存在返回 None
                - key: 键名
                - type: 键类型
                - ttl: 过期时间
                - encoding: 内部编码
                - size: 大小（元素数量或字符串长度）
                
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 3.4, 3.5
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        if not key:
            raise ValueError("键名不能为空")
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 检查键是否存在
            if not client.exists(key):
                return None
            
            # 获取键类型
            key_type = client.type(key)
            
            # 获取 TTL
            ttl = client.ttl(key)
            
            # 获取内部编码
            try:
                encoding = client.object('encoding', key)
            except Exception:
                encoding = 'unknown'
            
            # 根据类型获取大小
            size = 0
            try:
                if key_type == 'string':
                    size = client.strlen(key)
                elif key_type == 'list':
                    size = client.llen(key)
                elif key_type == 'set':
                    size = client.scard(key)
                elif key_type == 'zset':
                    size = client.zcard(key)
                elif key_type == 'hash':
                    size = client.hlen(key)
                elif key_type == 'stream':
                    size = client.xlen(key)
            except Exception as e:
                logger.warning(f"Failed to get size for key {key}: {e}")
            
            return {
                'key': key,
                'type': key_type,
                'ttl': ttl,
                'encoding': encoding,
                'size': size
            }
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except Exception as e:
            logger.error(f"Failed to get key info: {e}")
            raise RedisOperationError(f"获取键信息失败: {str(e)}")
    
    def get_key_value(
        self,
        conn_id: int,
        key: str,
        tenant_id: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """
        获取键的值
        
        根据键类型返回对应格式的值。
        
        Args:
            conn_id: 连接配置 ID
            key: 键名
            tenant_id: 租户 ID (可选)
            
        Returns:
            dict: 包含键信息和值的字典，如果键不存在返回 None
                - key: 键名
                - type: 键类型
                - ttl: 过期时间
                - value: 键值（格式取决于类型）
                
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 3.4, 4.1
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        if not key:
            raise ValueError("键名不能为空")
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 检查键是否存在
            if not client.exists(key):
                return None
            
            # 获取键类型
            key_type = client.type(key)
            
            # 获取 TTL
            ttl = client.ttl(key)
            
            # 根据类型获取值
            value = None
            if key_type == 'string':
                value = client.get(key)
            elif key_type == 'list':
                # 获取列表所有元素（限制最大数量）
                value = client.lrange(key, 0, 999)
            elif key_type == 'set':
                # 获取集合所有成员（限制最大数量）
                value = list(client.smembers(key))[:1000]
            elif key_type == 'zset':
                # 获取有序集合所有成员及分数
                value = client.zrange(key, 0, 999, withscores=True)
            elif key_type == 'hash':
                # 获取哈希所有字段
                value = client.hgetall(key)
            elif key_type == 'stream':
                # 获取流的最近消息
                value = client.xrange(key, count=100)
            else:
                value = f"不支持的类型: {key_type}"
            
            return {
                'key': key,
                'type': key_type,
                'ttl': ttl,
                'value': value
            }
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except Exception as e:
            logger.error(f"Failed to get key value: {e}")
            raise RedisOperationError(f"获取键值失败: {str(e)}")
    
    # ==================== 键值创建和修改 ====================
    
    def set_key_value(
        self,
        conn_id: int,
        key: str,
        value: Any,
        key_type: str = 'string',
        ttl: Optional[int] = None,
        tenant_id: Optional[int] = None
    ) -> bool:
        """
        设置键值
        
        Args:
            conn_id: 连接配置 ID
            key: 键名
            value: 键值
            key_type: 键类型 ('string', 'list', 'set', 'zset', 'hash')
            ttl: 过期时间（秒），None 表示永不过期
            tenant_id: 租户 ID (可选)
            
        Returns:
            bool: 是否设置成功
            
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 4.2, 4.3
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        if not key:
            raise ValueError("键名不能为空")
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 根据类型设置值
            if key_type == 'string':
                if ttl and ttl > 0:
                    client.setex(key, ttl, str(value))
                else:
                    client.set(key, str(value))
            elif key_type == 'list':
                # 删除旧键并设置新列表
                client.delete(key)
                if isinstance(value, list) and value:
                    client.rpush(key, *value)
                if ttl and ttl > 0:
                    client.expire(key, ttl)
            elif key_type == 'set':
                # 删除旧键并设置新集合
                client.delete(key)
                if isinstance(value, (list, set)) and value:
                    client.sadd(key, *value)
                if ttl and ttl > 0:
                    client.expire(key, ttl)
            elif key_type == 'zset':
                # 删除旧键并设置新有序集合
                client.delete(key)
                if isinstance(value, dict) and value:
                    client.zadd(key, value)
                elif isinstance(value, list) and value:
                    # 支持 [(member, score), ...] 格式
                    mapping = {item[0]: item[1] for item in value if len(item) >= 2}
                    if mapping:
                        client.zadd(key, mapping)
                if ttl and ttl > 0:
                    client.expire(key, ttl)
            elif key_type == 'hash':
                # 删除旧键并设置新哈希
                client.delete(key)
                if isinstance(value, dict) and value:
                    client.hset(key, mapping=value)
                if ttl and ttl > 0:
                    client.expire(key, ttl)
            else:
                raise ValueError(f"不支持的键类型: {key_type}")
            
            logger.info(f"Set key {key} with type {key_type}")
            return True
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to set key value: {e}")
            raise RedisOperationError(f"设置键值失败: {str(e)}")
    
    def delete_keys(
        self,
        conn_id: int,
        keys: List[str],
        tenant_id: Optional[int] = None
    ) -> int:
        """
        删除键（支持批量删除）
        
        Args:
            conn_id: 连接配置 ID
            keys: 要删除的键名列表
            tenant_id: 租户 ID (可选)
            
        Returns:
            int: 实际删除的键数量
            
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 4.8, 4.9
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        if not keys:
            return 0
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 批量删除键
            deleted_count = client.delete(*keys)
            
            logger.info(f"Deleted {deleted_count} keys")
            return deleted_count
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except Exception as e:
            logger.error(f"Failed to delete keys: {e}")
            raise RedisOperationError(f"删除键失败: {str(e)}")
    
    def set_key_ttl(
        self,
        conn_id: int,
        key: str,
        ttl: int,
        tenant_id: Optional[int] = None
    ) -> bool:
        """
        设置键的过期时间
        
        Args:
            conn_id: 连接配置 ID
            key: 键名
            ttl: 过期时间（秒）
            tenant_id: 租户 ID (可选)
            
        Returns:
            bool: 是否设置成功
            
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 4.10
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        if not key:
            raise ValueError("键名不能为空")
        
        if ttl < 1:
            raise ValueError("TTL 必须大于 0")
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 检查键是否存在
            if not client.exists(key):
                raise ValueError(f"键不存在: {key}")
            
            # 设置过期时间
            result = client.expire(key, ttl)
            
            logger.info(f"Set TTL {ttl}s for key {key}")
            return result
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to set key TTL: {e}")
            raise RedisOperationError(f"设置键过期时间失败: {str(e)}")
    
    def remove_key_ttl(
        self,
        conn_id: int,
        key: str,
        tenant_id: Optional[int] = None
    ) -> bool:
        """
        移除键的过期时间（设为永不过期）
        
        Args:
            conn_id: 连接配置 ID
            key: 键名
            tenant_id: 租户 ID (可选)
            
        Returns:
            bool: 是否移除成功
            
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 4.11
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        if not key:
            raise ValueError("键名不能为空")
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 检查键是否存在
            if not client.exists(key):
                raise ValueError(f"键不存在: {key}")
            
            # 移除过期时间
            result = client.persist(key)
            
            logger.info(f"Removed TTL for key {key}")
            return result
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to remove key TTL: {e}")
            raise RedisOperationError(f"移除键过期时间失败: {str(e)}")
    
    # ==================== Hash 类型操作 ====================
    
    def hget_all(
        self,
        conn_id: int,
        key: str,
        tenant_id: Optional[int] = None
    ) -> Optional[Dict[str, str]]:
        """
        获取 Hash 的所有字段和值
        
        Args:
            conn_id: 连接配置 ID
            key: 键名
            tenant_id: 租户 ID (可选)
            
        Returns:
            dict: 字段和值的字典，如果键不存在返回 None
            
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 4.4
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        if not key:
            raise ValueError("键名不能为空")
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 检查键是否存在
            if not client.exists(key):
                return None
            
            # 检查键类型
            key_type = client.type(key)
            if key_type != 'hash':
                raise ValueError(f"键类型不是 hash: {key_type}")
            
            return client.hgetall(key)
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to get hash: {e}")
            raise RedisOperationError(f"获取 Hash 失败: {str(e)}")
    
    def hset(
        self,
        conn_id: int,
        key: str,
        field: str,
        value: str,
        tenant_id: Optional[int] = None
    ) -> bool:
        """
        设置 Hash 字段的值
        
        Args:
            conn_id: 连接配置 ID
            key: 键名
            field: 字段名
            value: 字段值
            tenant_id: 租户 ID (可选)
            
        Returns:
            bool: 是否为新字段 (True 表示新增, False 表示更新)
            
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 4.4
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        if not key:
            raise ValueError("键名不能为空")
        
        if not field:
            raise ValueError("字段名不能为空")
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 如果键存在，检查类型
            if client.exists(key):
                key_type = client.type(key)
                if key_type != 'hash':
                    raise ValueError(f"键类型不是 hash: {key_type}")
            
            result = client.hset(key, field, value)
            
            logger.info(f"Set hash field {key}:{field}")
            return result == 1  # 1 表示新增, 0 表示更新
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to set hash field: {e}")
            raise RedisOperationError(f"设置 Hash 字段失败: {str(e)}")
    
    def hdel(
        self,
        conn_id: int,
        key: str,
        fields: List[str],
        tenant_id: Optional[int] = None
    ) -> int:
        """
        删除 Hash 字段
        
        Args:
            conn_id: 连接配置 ID
            key: 键名
            fields: 要删除的字段名列表
            tenant_id: 租户 ID (可选)
            
        Returns:
            int: 实际删除的字段数量
            
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 4.4
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        if not key:
            raise ValueError("键名不能为空")
        
        if not fields:
            return 0
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 检查键是否存在
            if not client.exists(key):
                return 0
            
            # 检查键类型
            key_type = client.type(key)
            if key_type != 'hash':
                raise ValueError(f"键类型不是 hash: {key_type}")
            
            deleted_count = client.hdel(key, *fields)
            
            logger.info(f"Deleted {deleted_count} hash fields from {key}")
            return deleted_count
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to delete hash fields: {e}")
            raise RedisOperationError(f"删除 Hash 字段失败: {str(e)}")
    
    # ==================== List 类型操作 ====================
    
    def lrange(
        self,
        conn_id: int,
        key: str,
        start: int = 0,
        stop: int = -1,
        tenant_id: Optional[int] = None
    ) -> Optional[List[str]]:
        """
        获取 List 指定范围的元素
        
        Args:
            conn_id: 连接配置 ID
            key: 键名
            start: 起始索引 (默认 0)
            stop: 结束索引 (默认 -1，表示最后一个元素)
            tenant_id: 租户 ID (可选)
            
        Returns:
            list: 元素列表，如果键不存在返回 None
            
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 4.5
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        if not key:
            raise ValueError("键名不能为空")
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 检查键是否存在
            if not client.exists(key):
                return None
            
            # 检查键类型
            key_type = client.type(key)
            if key_type != 'list':
                raise ValueError(f"键类型不是 list: {key_type}")
            
            return client.lrange(key, start, stop)
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to get list range: {e}")
            raise RedisOperationError(f"获取 List 元素失败: {str(e)}")
    
    def lpush(
        self,
        conn_id: int,
        key: str,
        values: List[str],
        tenant_id: Optional[int] = None
    ) -> int:
        """
        向 List 头部添加元素
        
        Args:
            conn_id: 连接配置 ID
            key: 键名
            values: 要添加的值列表
            tenant_id: 租户 ID (可选)
            
        Returns:
            int: 添加后列表的长度
            
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 4.5
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        if not key:
            raise ValueError("键名不能为空")
        
        if not values:
            raise ValueError("值列表不能为空")
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 如果键存在，检查类型
            if client.exists(key):
                key_type = client.type(key)
                if key_type != 'list':
                    raise ValueError(f"键类型不是 list: {key_type}")
            
            result = client.lpush(key, *values)
            
            logger.info(f"Pushed {len(values)} elements to list {key}")
            return result
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to push to list: {e}")
            raise RedisOperationError(f"添加 List 元素失败: {str(e)}")
    
    def lrem(
        self,
        conn_id: int,
        key: str,
        count: int,
        value: str,
        tenant_id: Optional[int] = None
    ) -> int:
        """
        从 List 中删除元素
        
        Args:
            conn_id: 连接配置 ID
            key: 键名
            count: 删除数量 (0 表示全部, 正数从头开始, 负数从尾开始)
            value: 要删除的值
            tenant_id: 租户 ID (可选)
            
        Returns:
            int: 实际删除的元素数量
            
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 4.5
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        if not key:
            raise ValueError("键名不能为空")
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 检查键是否存在
            if not client.exists(key):
                return 0
            
            # 检查键类型
            key_type = client.type(key)
            if key_type != 'list':
                raise ValueError(f"键类型不是 list: {key_type}")
            
            removed_count = client.lrem(key, count, value)
            
            logger.info(f"Removed {removed_count} elements from list {key}")
            return removed_count
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to remove from list: {e}")
            raise RedisOperationError(f"删除 List 元素失败: {str(e)}")
    
    # ==================== Set 类型操作 ====================
    
    def smembers(
        self,
        conn_id: int,
        key: str,
        tenant_id: Optional[int] = None
    ) -> Optional[List[str]]:
        """
        获取 Set 的所有成员
        
        Args:
            conn_id: 连接配置 ID
            key: 键名
            tenant_id: 租户 ID (可选)
            
        Returns:
            list: 成员列表，如果键不存在返回 None
            
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 4.6
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        if not key:
            raise ValueError("键名不能为空")
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 检查键是否存在
            if not client.exists(key):
                return None
            
            # 检查键类型
            key_type = client.type(key)
            if key_type != 'set':
                raise ValueError(f"键类型不是 set: {key_type}")
            
            return list(client.smembers(key))
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to get set members: {e}")
            raise RedisOperationError(f"获取 Set 成员失败: {str(e)}")
    
    def sadd(
        self,
        conn_id: int,
        key: str,
        members: List[str],
        tenant_id: Optional[int] = None
    ) -> int:
        """
        向 Set 添加成员
        
        Args:
            conn_id: 连接配置 ID
            key: 键名
            members: 要添加的成员列表
            tenant_id: 租户 ID (可选)
            
        Returns:
            int: 实际添加的成员数量（不包括已存在的）
            
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 4.6
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        if not key:
            raise ValueError("键名不能为空")
        
        if not members:
            raise ValueError("成员列表不能为空")
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 如果键存在，检查类型
            if client.exists(key):
                key_type = client.type(key)
                if key_type != 'set':
                    raise ValueError(f"键类型不是 set: {key_type}")
            
            added_count = client.sadd(key, *members)
            
            logger.info(f"Added {added_count} members to set {key}")
            return added_count
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to add to set: {e}")
            raise RedisOperationError(f"添加 Set 成员失败: {str(e)}")
    
    def srem(
        self,
        conn_id: int,
        key: str,
        members: List[str],
        tenant_id: Optional[int] = None
    ) -> int:
        """
        从 Set 中删除成员
        
        Args:
            conn_id: 连接配置 ID
            key: 键名
            members: 要删除的成员列表
            tenant_id: 租户 ID (可选)
            
        Returns:
            int: 实际删除的成员数量
            
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 4.6
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        if not key:
            raise ValueError("键名不能为空")
        
        if not members:
            return 0
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 检查键是否存在
            if not client.exists(key):
                return 0
            
            # 检查键类型
            key_type = client.type(key)
            if key_type != 'set':
                raise ValueError(f"键类型不是 set: {key_type}")
            
            removed_count = client.srem(key, *members)
            
            logger.info(f"Removed {removed_count} members from set {key}")
            return removed_count
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to remove from set: {e}")
            raise RedisOperationError(f"删除 Set 成员失败: {str(e)}")
    
    # ==================== ZSet 类型操作 ====================
    
    def zrange(
        self,
        conn_id: int,
        key: str,
        start: int = 0,
        stop: int = -1,
        withscores: bool = True,
        tenant_id: Optional[int] = None
    ) -> Optional[List]:
        """
        获取 ZSet 指定范围的成员
        
        Args:
            conn_id: 连接配置 ID
            key: 键名
            start: 起始索引 (默认 0)
            stop: 结束索引 (默认 -1，表示最后一个元素)
            withscores: 是否包含分数 (默认 True)
            tenant_id: 租户 ID (可选)
            
        Returns:
            list: 成员列表（如果 withscores=True，返回 [(member, score), ...]）
                  如果键不存在返回 None
            
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 4.7
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        if not key:
            raise ValueError("键名不能为空")
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 检查键是否存在
            if not client.exists(key):
                return None
            
            # 检查键类型
            key_type = client.type(key)
            if key_type != 'zset':
                raise ValueError(f"键类型不是 zset: {key_type}")
            
            return client.zrange(key, start, stop, withscores=withscores)
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to get zset range: {e}")
            raise RedisOperationError(f"获取 ZSet 成员失败: {str(e)}")
    
    def zadd(
        self,
        conn_id: int,
        key: str,
        mapping: Dict[str, float],
        tenant_id: Optional[int] = None
    ) -> int:
        """
        向 ZSet 添加成员
        
        Args:
            conn_id: 连接配置 ID
            key: 键名
            mapping: 成员和分数的映射 {member: score, ...}
            tenant_id: 租户 ID (可选)
            
        Returns:
            int: 实际添加的成员数量（不包括已存在的）
            
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 4.7
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        if not key:
            raise ValueError("键名不能为空")
        
        if not mapping:
            raise ValueError("成员映射不能为空")
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 如果键存在，检查类型
            if client.exists(key):
                key_type = client.type(key)
                if key_type != 'zset':
                    raise ValueError(f"键类型不是 zset: {key_type}")
            
            added_count = client.zadd(key, mapping)
            
            logger.info(f"Added {added_count} members to zset {key}")
            return added_count
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to add to zset: {e}")
            raise RedisOperationError(f"添加 ZSet 成员失败: {str(e)}")
    
    def zrem(
        self,
        conn_id: int,
        key: str,
        members: List[str],
        tenant_id: Optional[int] = None
    ) -> int:
        """
        从 ZSet 中删除成员
        
        Args:
            conn_id: 连接配置 ID
            key: 键名
            members: 要删除的成员列表
            tenant_id: 租户 ID (可选)
            
        Returns:
            int: 实际删除的成员数量
            
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 4.7
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        if not key:
            raise ValueError("键名不能为空")
        
        if not members:
            return 0
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 检查键是否存在
            if not client.exists(key):
                return 0
            
            # 检查键类型
            key_type = client.type(key)
            if key_type != 'zset':
                raise ValueError(f"键类型不是 zset: {key_type}")
            
            removed_count = client.zrem(key, *members)
            
            logger.info(f"Removed {removed_count} members from zset {key}")
            return removed_count
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to remove from zset: {e}")
            raise RedisOperationError(f"删除 ZSet 成员失败: {str(e)}")
    
    # ==================== 服务器信息 ====================
    
    def get_server_info(
        self,
        conn_id: int,
        tenant_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        获取 Redis 服务器信息
        
        解析 INFO 命令返回的结果，提取关键信息。
        
        Args:
            conn_id: 连接配置 ID
            tenant_id: 租户 ID (可选)
            
        Returns:
            dict: 服务器信息字典，包含:
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
                - rdb_last_save_time: RDB 最后保存时间
                - rdb_changes_since_last_save: RDB 最后保存后的变更数
                - aof_enabled: AOF 是否启用
                - aof_rewrite_in_progress: AOF 重写是否进行中
                - role: 角色 (master/slave)
                - connected_slaves: 已连接从节点数
                - master_host: 主节点地址（如果是从节点）
                - master_port: 主节点端口（如果是从节点）
                - db_info: 各数据库键数量信息
                
        Raises:
            ValueError: 参数验证失败
            RedisOperationError: Redis 操作失败
            
        Requirements: 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        try:
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 获取 INFO 命令结果
            info = client.info()
            
            # 提取关键信息
            result = {
                # 服务器信息
                'redis_version': info.get('redis_version', 'unknown'),
                'redis_mode': info.get('redis_mode', 'standalone'),
                'os': info.get('os', 'unknown'),
                'arch_bits': info.get('arch_bits', 0),
                'uptime_in_seconds': info.get('uptime_in_seconds', 0),
                'uptime_in_days': info.get('uptime_in_days', 0),
                
                # 客户端信息
                'connected_clients': info.get('connected_clients', 0),
                'blocked_clients': info.get('blocked_clients', 0),
                
                # 内存信息
                'used_memory': info.get('used_memory', 0),
                'used_memory_human': info.get('used_memory_human', '0B'),
                'used_memory_peak': info.get('used_memory_peak', 0),
                'used_memory_peak_human': info.get('used_memory_peak_human', '0B'),
                'used_memory_rss': info.get('used_memory_rss', 0),
                'used_memory_rss_human': info.get('used_memory_rss_human', '0B'),
                'mem_fragmentation_ratio': info.get('mem_fragmentation_ratio', 0),
                'maxmemory': info.get('maxmemory', 0),
                'maxmemory_human': info.get('maxmemory_human', '0B'),
                'maxmemory_policy': info.get('maxmemory_policy', 'noeviction'),
                
                # 统计信息
                'total_connections_received': info.get('total_connections_received', 0),
                'total_commands_processed': info.get('total_commands_processed', 0),
                'instantaneous_ops_per_sec': info.get('instantaneous_ops_per_sec', 0),
                'total_net_input_bytes': info.get('total_net_input_bytes', 0),
                'total_net_output_bytes': info.get('total_net_output_bytes', 0),
                'keyspace_hits': info.get('keyspace_hits', 0),
                'keyspace_misses': info.get('keyspace_misses', 0),
                'expired_keys': info.get('expired_keys', 0),
                'evicted_keys': info.get('evicted_keys', 0),
                
                # 持久化信息
                'rdb_last_save_time': info.get('rdb_last_save_time', 0),
                'rdb_changes_since_last_save': info.get('rdb_changes_since_last_save', 0),
                'rdb_bgsave_in_progress': info.get('rdb_bgsave_in_progress', 0),
                'rdb_last_bgsave_status': info.get('rdb_last_bgsave_status', 'ok'),
                'aof_enabled': info.get('aof_enabled', 0) == 1,
                'aof_rewrite_in_progress': info.get('aof_rewrite_in_progress', 0) == 1,
                'aof_last_rewrite_status': info.get('aof_last_rewrite_status', 'ok'),
                'aof_last_bgrewrite_status': info.get('aof_last_bgrewrite_status', 'ok'),
                
                # 复制信息
                'role': info.get('role', 'master'),
                'connected_slaves': info.get('connected_slaves', 0),
                'master_host': info.get('master_host'),
                'master_port': info.get('master_port'),
                'master_link_status': info.get('master_link_status'),
                'master_sync_in_progress': info.get('master_sync_in_progress', 0),
            }
            
            # 提取数据库信息
            db_info = {}
            for key, value in info.items():
                if key.startswith('db') and isinstance(value, dict):
                    db_info[key] = {
                        'keys': value.get('keys', 0),
                        'expires': value.get('expires', 0),
                        'avg_ttl': value.get('avg_ttl', 0)
                    }
            result['db_info'] = db_info
            
            # 计算命中率
            hits = result['keyspace_hits']
            misses = result['keyspace_misses']
            total = hits + misses
            result['hit_rate'] = round(hits / total * 100, 2) if total > 0 else 0
            
            logger.info(f"Retrieved server info for connection {conn_id}")
            return result
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except Exception as e:
            logger.error(f"Failed to get server info: {e}")
            raise RedisOperationError(f"获取服务器信息失败: {str(e)}")
    
    def get_cluster_info(
        self,
        conn_id: int,
        tenant_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        获取 Redis 集群信息
        
        解析 CLUSTER INFO 命令返回的结果。
        
        Args:
            conn_id: 连接配置 ID
            tenant_id: 租户 ID (可选)
            
        Returns:
            dict: 集群信息字典，包含:
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
                
        Raises:
            ValueError: 参数验证失败或不是集群模式
            RedisOperationError: Redis 操作失败
            
        Requirements: 5.1, 5.3, 5.4
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        try:
            # 检查是否是集群模式
            connection = RedisConnection.get_by_tenant(conn_id, tenant_id)
            if not connection:
                raise ValueError(f"连接配置不存在: ID={conn_id}")
            
            if connection.connection_type != 'cluster':
                raise ValueError("此连接不是集群模式")
            
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 获取 CLUSTER INFO 命令结果
            # 对于集群客户端，需要使用 execute_command
            cluster_info_raw = client.execute_command('CLUSTER', 'INFO')
            
            # 解析 CLUSTER INFO 结果
            # 结果格式为 "key:value\r\n" 的字符串
            result = {}
            if isinstance(cluster_info_raw, str):
                for line in cluster_info_raw.strip().split('\n'):
                    line = line.strip()
                    if ':' in line:
                        key, value = line.split(':', 1)
                        key = key.strip()
                        value = value.strip()
                        # 尝试转换为数字
                        try:
                            if '.' in value:
                                value = float(value)
                            else:
                                value = int(value)
                        except ValueError:
                            pass
                        result[key] = value
            elif isinstance(cluster_info_raw, dict):
                result = cluster_info_raw
            
            # 确保关键字段存在
            cluster_result = {
                'cluster_state': result.get('cluster_state', 'unknown'),
                'cluster_slots_assigned': result.get('cluster_slots_assigned', 0),
                'cluster_slots_ok': result.get('cluster_slots_ok', 0),
                'cluster_slots_pfail': result.get('cluster_slots_pfail', 0),
                'cluster_slots_fail': result.get('cluster_slots_fail', 0),
                'cluster_known_nodes': result.get('cluster_known_nodes', 0),
                'cluster_size': result.get('cluster_size', 0),
                'cluster_current_epoch': result.get('cluster_current_epoch', 0),
                'cluster_my_epoch': result.get('cluster_my_epoch', 0),
                'cluster_stats_messages_sent': result.get('cluster_stats_messages_sent', 0),
                'cluster_stats_messages_received': result.get('cluster_stats_messages_received', 0),
            }
            
            logger.info(f"Retrieved cluster info for connection {conn_id}")
            return cluster_result
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to get cluster info: {e}")
            raise RedisOperationError(f"获取集群信息失败: {str(e)}")
    
    def get_cluster_nodes(
        self,
        conn_id: int,
        tenant_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        获取 Redis 集群节点列表
        
        解析 CLUSTER NODES 命令返回的结果。
        
        Args:
            conn_id: 连接配置 ID
            tenant_id: 租户 ID (可选)
            
        Returns:
            list: 节点信息列表，每个节点包含:
                - id: 节点 ID
                - host: 主机地址
                - port: 端口
                - cport: 集群总线端口
                - flags: 节点标志列表 (master/slave/myself/fail/handshake/noaddr/nofailover)
                - role: 角色 (master/slave)
                - master_id: 主节点 ID（如果是从节点）
                - ping_sent: 最后发送 PING 时间
                - pong_recv: 最后接收 PONG 时间
                - config_epoch: 配置纪元
                - link_state: 连接状态 (connected/disconnected)
                - slots: 槽位范围列表（如果是主节点）
                
        Raises:
            ValueError: 参数验证失败或不是集群模式
            RedisOperationError: Redis 操作失败
            
        Requirements: 5.1, 5.2, 5.4
        """
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        try:
            # 检查是否是集群模式
            connection = RedisConnection.get_by_tenant(conn_id, tenant_id)
            if not connection:
                raise ValueError(f"连接配置不存在: ID={conn_id}")
            
            if connection.connection_type != 'cluster':
                raise ValueError("此连接不是集群模式")
            
            client = self._get_redis_client(conn_id, tenant_id)
            
            # 获取 CLUSTER NODES 命令结果
            cluster_nodes_raw = client.execute_command('CLUSTER', 'NODES')
            
            # 解析 CLUSTER NODES 结果
            # 格式: <id> <ip:port@cport> <flags> <master> <ping-sent> <pong-recv> <config-epoch> <link-state> <slot> <slot> ...
            nodes = []
            if isinstance(cluster_nodes_raw, str):
                for line in cluster_nodes_raw.strip().split('\n'):
                    line = line.strip()
                    if not line:
                        continue
                    
                    parts = line.split(' ')
                    if len(parts) < 8:
                        continue
                    
                    node_id = parts[0]
                    
                    # 解析地址 (ip:port@cport 或 ip:port)
                    addr = parts[1]
                    host = ''
                    port = 0
                    cport = 0
                    
                    if '@' in addr:
                        addr_part, cport_str = addr.split('@')
                        cport = int(cport_str) if cport_str.isdigit() else 0
                    else:
                        addr_part = addr
                    
                    if ':' in addr_part:
                        host, port_str = addr_part.rsplit(':', 1)
                        port = int(port_str) if port_str.isdigit() else 0
                    
                    # 解析标志
                    flags = parts[2].split(',')
                    
                    # 确定角色
                    role = 'slave' if 'slave' in flags else 'master'
                    
                    # 主节点 ID（如果是从节点）
                    master_id = parts[3] if parts[3] != '-' else None
                    
                    # 时间戳
                    ping_sent = int(parts[4]) if parts[4].isdigit() else 0
                    pong_recv = int(parts[5]) if parts[5].isdigit() else 0
                    
                    # 配置纪元
                    config_epoch = int(parts[6]) if parts[6].isdigit() else 0
                    
                    # 连接状态
                    link_state = parts[7]
                    
                    # 槽位（主节点才有）
                    slots = []
                    if len(parts) > 8 and role == 'master':
                        for slot_part in parts[8:]:
                            if slot_part.startswith('['):
                                # 迁移中的槽位，跳过
                                continue
                            slots.append(slot_part)
                    
                    node = {
                        'id': node_id,
                        'host': host,
                        'port': port,
                        'cport': cport,
                        'flags': flags,
                        'role': role,
                        'master_id': master_id,
                        'ping_sent': ping_sent,
                        'pong_recv': pong_recv,
                        'config_epoch': config_epoch,
                        'link_state': link_state,
                        'slots': slots,
                        'is_myself': 'myself' in flags,
                        'is_fail': 'fail' in flags or 'fail?' in flags,
                    }
                    nodes.append(node)
            
            # 按角色排序：主节点在前，从节点在后
            nodes.sort(key=lambda x: (0 if x['role'] == 'master' else 1, x['host'], x['port']))
            
            logger.info(f"Retrieved {len(nodes)} cluster nodes for connection {conn_id}")
            return nodes
            
        except RedisConnectionException:
            raise
        except RedisTimeoutException:
            raise
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to get cluster nodes: {e}")
            raise RedisOperationError(f"获取集群节点失败: {str(e)}")


# 全局 Redis 管理服务实例
redis_management_service = RedisManagementService()
