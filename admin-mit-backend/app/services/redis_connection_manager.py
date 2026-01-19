"""
Redis 连接管理器

管理活跃的 Redis 连接，支持单机和集群模式。
使用连接池管理连接，确保连接复用和资源释放。

Requirements: 2.1, 2.4, 2.5
"""
import json
import logging
from typing import Dict, Optional, Tuple, Union
from threading import Lock

import redis
from redis.cluster import RedisCluster
from redis.exceptions import (
    ConnectionError as RedisConnectionError,
    TimeoutError as RedisTimeoutError,
    AuthenticationError,
    ClusterError,
)

from app.models.redis_connection import RedisConnection

logger = logging.getLogger(__name__)


class RedisError(Exception):
    """Redis 操作基础异常"""
    pass


class RedisConnectionException(RedisError):
    """Redis 连接异常"""
    pass


class RedisOperationError(RedisError):
    """Redis 操作异常"""
    pass


class RedisTimeoutException(RedisError):
    """Redis 超时异常"""
    pass


class RedisConnectionManager:
    """
    Redis 连接管理器
    
    管理活跃的 Redis 连接，支持单机和集群模式。
    使用连接池管理连接，确保连接复用和资源释放。
    
    连接键格式: "{tenant_id}:{conn_id}"
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
        
        self._connections: Dict[str, Union[redis.Redis, RedisCluster]] = {}
        self._connection_lock = Lock()
        self._initialized = True
        logger.info("Redis Connection Manager initialized")
    
    def _get_connection_key(self, conn_id: int, tenant_id: int) -> str:
        """
        生成连接键
        
        Args:
            conn_id: 连接配置 ID
            tenant_id: 租户 ID
            
        Returns:
            str: 连接键
        """
        return f"{tenant_id}:{conn_id}"
    
    def _create_standalone_client(
        self,
        host: str,
        port: int,
        password: Optional[str],
        database: int,
        timeout: int
    ) -> redis.Redis:
        """
        创建单机模式 Redis 客户端
        
        Args:
            host: 主机地址
            port: 端口
            password: 密码（可选）
            database: 数据库索引
            timeout: 连接超时（秒）
            
        Returns:
            redis.Redis: Redis 客户端实例
            
        Raises:
            RedisConnectionException: 连接失败
            RedisTimeoutException: 连接超时
        """
        try:
            # 处理密码：如果密码为空字符串或 None，不设置密码
            redis_password = password if password and password.strip() else None
            
            client = redis.Redis(
                host=host,
                port=port,
                password=redis_password,
                db=database,
                socket_timeout=timeout,
                socket_connect_timeout=timeout,
                decode_responses=True,
                retry_on_timeout=True,
            )
            # 测试连接
            client.ping()
            logger.info(f"Connected to Redis standalone at {host}:{port}")
            return client
        except RedisTimeoutError as e:
            logger.error(f"Redis connection timeout: {host}:{port} - {e}")
            raise RedisTimeoutException(f"连接超时: {host}:{port}")
        except AuthenticationError as e:
            logger.error(f"Redis authentication failed: {host}:{port} - {e}")
            if redis_password:
                raise RedisConnectionException(f"认证失败: 密码错误")
            else:
                raise RedisConnectionException(f"认证失败: 服务器需要密码")
        except RedisConnectionError as e:
            logger.error(f"Redis connection failed: {host}:{port} - {e}")
            raise RedisConnectionException(f"连接失败: {host}:{port} - {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error connecting to Redis: {e}")
            raise RedisConnectionException(f"连接失败: {str(e)}")
    
    def _create_cluster_client(
        self,
        cluster_nodes: str,
        password: Optional[str],
        timeout: int
    ) -> RedisCluster:
        """
        创建集群模式 Redis 客户端
        
        Args:
            cluster_nodes: 集群节点列表（JSON 格式）
            password: 密码（可选）
            timeout: 连接超时（秒）
            
        Returns:
            RedisCluster: Redis 集群客户端实例
            
        Raises:
            RedisConnectionException: 连接失败
            RedisTimeoutException: 连接超时
        """
        try:
            # 解析集群节点
            nodes = json.loads(cluster_nodes) if isinstance(cluster_nodes, str) else cluster_nodes
            if not nodes:
                raise RedisConnectionException("集群节点列表不能为空")
            
            # 构建启动节点列表
            startup_nodes = []
            for node in nodes:
                if isinstance(node, dict):
                    startup_nodes.append({
                        'host': node.get('host'),
                        'port': node.get('port', 6379)
                    })
                elif isinstance(node, str):
                    # 支持 "host:port" 格式
                    parts = node.split(':')
                    startup_nodes.append({
                        'host': parts[0],
                        'port': int(parts[1]) if len(parts) > 1 else 6379
                    })
            
            if not startup_nodes:
                raise RedisConnectionException("无法解析集群节点列表")
            
            # 使用第一个节点作为入口
            first_node = startup_nodes[0]
            
            # 处理密码：如果密码为空字符串或 None，不设置密码
            redis_password = password if password and password.strip() else None
            
            client = RedisCluster(
                host=first_node['host'],
                port=first_node['port'],
                password=redis_password,
                socket_timeout=timeout,
                socket_connect_timeout=timeout,
                decode_responses=True,
                skip_full_coverage_check=True,
            )
            # 测试连接
            client.ping()
            logger.info(f"Connected to Redis cluster via {first_node['host']}:{first_node['port']}")
            return client
        except json.JSONDecodeError as e:
            logger.error(f"Invalid cluster nodes JSON: {e}")
            raise RedisConnectionException(f"集群节点配置格式错误: {str(e)}")
        except RedisTimeoutError as e:
            logger.error(f"Redis cluster connection timeout: {e}")
            raise RedisTimeoutException(f"集群连接超时")
        except AuthenticationError as e:
            logger.error(f"Redis cluster authentication failed: {e}")
            if redis_password:
                raise RedisConnectionException(f"集群认证失败: 密码错误")
            else:
                raise RedisConnectionException(f"集群认证失败: 服务器需要密码")
        except ClusterError as e:
            logger.error(f"Redis cluster error: {e}")
            raise RedisConnectionException(f"集群错误: {str(e)}")
        except RedisConnectionError as e:
            logger.error(f"Redis cluster connection failed: {e}")
            raise RedisConnectionException(f"集群连接失败: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error connecting to Redis cluster: {e}")
            raise RedisConnectionException(f"集群连接失败: {str(e)}")
    
    def get_client(
        self,
        conn_id: int,
        tenant_id: int,
        connection_config: Optional[RedisConnection] = None
    ) -> Union[redis.Redis, RedisCluster]:
        """
        获取 Redis 客户端
        
        如果连接已存在且有效，返回现有连接；否则创建新连接。
        
        Args:
            conn_id: 连接配置 ID
            tenant_id: 租户 ID
            connection_config: 连接配置对象（可选，如果不提供则从数据库查询）
            
        Returns:
            Union[redis.Redis, RedisCluster]: Redis 客户端实例
            
        Raises:
            RedisConnectionException: 连接失败
            RedisTimeoutException: 连接超时
            ValueError: 连接配置不存在
        """
        connection_key = self._get_connection_key(conn_id, tenant_id)
        
        with self._connection_lock:
            # 检查是否已有连接
            if connection_key in self._connections:
                client = self._connections[connection_key]
                try:
                    # 验证连接是否有效
                    client.ping()
                    return client
                except Exception as e:
                    logger.warning(f"Existing connection invalid, reconnecting: {e}")
                    # 连接无效，移除并重新创建
                    self._close_client_internal(connection_key)
            
            # 获取连接配置
            if connection_config is None:
                connection_config = RedisConnection.get_by_tenant(conn_id, tenant_id)
                if connection_config is None:
                    raise ValueError(f"连接配置不存在: ID={conn_id}")
            
            # 检查连接配置状态
            if connection_config.status != 1:
                raise RedisConnectionException("连接配置已禁用")
            
            # 根据连接类型创建客户端
            if connection_config.connection_type == 'cluster':
                client = self._create_cluster_client(
                    cluster_nodes=connection_config.cluster_nodes,
                    password=connection_config.password,
                    timeout=connection_config.timeout or 5
                )
            else:
                client = self._create_standalone_client(
                    host=connection_config.host,
                    port=connection_config.port or 6379,
                    password=connection_config.password,
                    database=connection_config.database or 0,
                    timeout=connection_config.timeout or 5
                )
            
            # 保存连接
            self._connections[connection_key] = client
            logger.info(f"Created new Redis connection: {connection_key}")
            
            return client
    
    def _close_client_internal(self, connection_key: str) -> bool:
        """
        内部方法：关闭指定连接（不加锁）
        
        Args:
            connection_key: 连接键
            
        Returns:
            bool: 是否成功关闭
        """
        if connection_key not in self._connections:
            return False
        
        try:
            client = self._connections.pop(connection_key)
            client.close()
            logger.info(f"Closed Redis connection: {connection_key}")
            return True
        except Exception as e:
            logger.error(f"Error closing Redis connection {connection_key}: {e}")
            return False
    
    def close_client(self, conn_id: int, tenant_id: int) -> bool:
        """
        关闭指定连接
        
        Args:
            conn_id: 连接配置 ID
            tenant_id: 租户 ID
            
        Returns:
            bool: 是否成功关闭
        """
        connection_key = self._get_connection_key(conn_id, tenant_id)
        
        with self._connection_lock:
            return self._close_client_internal(connection_key)
    
    def close_all_clients(self, tenant_id: Optional[int] = None) -> int:
        """
        关闭所有连接或指定租户的所有连接
        
        Args:
            tenant_id: 租户 ID（可选，如果不提供则关闭所有连接）
            
        Returns:
            int: 关闭的连接数量
        """
        closed_count = 0
        
        with self._connection_lock:
            keys_to_close = []
            
            for key in self._connections.keys():
                if tenant_id is None:
                    keys_to_close.append(key)
                else:
                    # 检查是否属于指定租户
                    key_tenant_id = int(key.split(':')[0])
                    if key_tenant_id == tenant_id:
                        keys_to_close.append(key)
            
            for key in keys_to_close:
                if self._close_client_internal(key):
                    closed_count += 1
        
        logger.info(f"Closed {closed_count} Redis connections" + 
                   (f" for tenant {tenant_id}" if tenant_id else ""))
        return closed_count
    
    def is_connected(self, conn_id: int, tenant_id: int) -> bool:
        """
        检查连接是否有效
        
        Args:
            conn_id: 连接配置 ID
            tenant_id: 租户 ID
            
        Returns:
            bool: 连接是否有效
        """
        connection_key = self._get_connection_key(conn_id, tenant_id)
        
        with self._connection_lock:
            if connection_key not in self._connections:
                return False
            
            try:
                client = self._connections[connection_key]
                client.ping()
                return True
            except Exception as e:
                logger.warning(f"Connection check failed for {connection_key}: {e}")
                return False
    
    def test_connection(
        self,
        connection_type: str,
        host: Optional[str] = None,
        port: Optional[int] = None,
        password: Optional[str] = None,
        database: int = 0,
        cluster_nodes: Optional[str] = None,
        timeout: int = 5
    ) -> Tuple[bool, str]:
        """
        测试连接配置（不保存连接）
        
        Args:
            connection_type: 连接类型 ('standalone' | 'cluster')
            host: 主机地址（单机模式）
            port: 端口（单机模式）
            password: 密码（可选）
            database: 数据库索引（单机模式）
            cluster_nodes: 集群节点列表（集群模式，JSON 格式）
            timeout: 连接超时（秒）
            
        Returns:
            Tuple[bool, str]: (是否成功, 消息)
        """
        client = None
        try:
            if connection_type == 'cluster':
                client = self._create_cluster_client(
                    cluster_nodes=cluster_nodes,
                    password=password,
                    timeout=timeout
                )
                # 获取集群信息
                info = client.info()
                version = info.get('redis_version', 'unknown')
                return True, f"集群连接成功，Redis 版本: {version}"
            else:
                client = self._create_standalone_client(
                    host=host,
                    port=port or 6379,
                    password=password,
                    database=database,
                    timeout=timeout
                )
                # 获取服务器信息
                info = client.info()
                version = info.get('redis_version', 'unknown')
                return True, f"连接成功，Redis 版本: {version}"
        except RedisTimeoutException as e:
            return False, str(e)
        except RedisConnectionException as e:
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
    
    def get_active_connections_count(self, tenant_id: Optional[int] = None) -> int:
        """
        获取活跃连接数量
        
        Args:
            tenant_id: 租户 ID（可选，如果不提供则返回所有连接数量）
            
        Returns:
            int: 活跃连接数量
        """
        with self._connection_lock:
            if tenant_id is None:
                return len(self._connections)
            
            count = 0
            for key in self._connections.keys():
                key_tenant_id = int(key.split(':')[0])
                if key_tenant_id == tenant_id:
                    count += 1
            return count


# 创建全局连接管理器实例
redis_connection_manager = RedisConnectionManager()
