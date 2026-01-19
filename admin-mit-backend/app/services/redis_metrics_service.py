"""
Redis 性能监控服务
用于收集和导出 Redis 相关的 Prometheus 指标
"""
import redis
from app.core.config_manager import config_manager
from typing import Dict, Any
import logging
import time

logger = logging.getLogger(__name__)


class RedisMetricsService:
    """Redis 性能监控服务"""
    
    def __init__(self):
        """初始化 Redis 指标服务"""
        try:
            redis_config = config_manager.get_redis_config()
            self.redis_client = redis.Redis(
                host=redis_config.get('host', 'localhost'),
                port=redis_config.get('port', 6379),
                db=redis_config.get('db', 0),
                password=redis_config.get('password'),
                decode_responses=True,
                socket_timeout=5
            )
            # 测试连接
            self.redis_client.ping()
            logger.info("RedisMetricsService initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize RedisMetricsService: {e}")
            self.redis_client = None
    
    def get_redis_info(self) -> Dict[str, Any]:
        """
        获取 Redis INFO 信息
        
        Returns:
            Dict[str, Any]: Redis 信息字典
        """
        try:
            if not self.redis_client:
                return {}
            
            info = self.redis_client.info()
            return info
        except Exception as e:
            logger.error(f"Failed to get Redis info: {e}")
            return {}
    
    def get_connection_pool_stats(self) -> Dict[str, int]:
        """
        获取连接池统计信息
        
        Returns:
            Dict[str, int]: 连接池统计
        """
        try:
            if not self.redis_client:
                return {}
            
            pool = self.redis_client.connection_pool
            return {
                'max_connections': pool.max_connections,
                'created_connections': len(pool._created_connections) if hasattr(pool, '_created_connections') else 0,
                'available_connections': len(pool._available_connections) if hasattr(pool, '_available_connections') else 0,
                'in_use_connections': len(pool._in_use_connections) if hasattr(pool, '_in_use_connections') else 0
            }
        except Exception as e:
            logger.error(f"Failed to get connection pool stats: {e}")
            return {}
    
    def measure_response_time(self, operation: str = 'ping') -> float:
        """
        测量 Redis 响应时间
        
        Args:
            operation: 操作类型 (ping, get, set)
            
        Returns:
            float: 响应时间（毫秒）
        """
        try:
            if not self.redis_client:
                return -1.0
            
            start_time = time.time()
            
            if operation == 'ping':
                self.redis_client.ping()
            elif operation == 'get':
                self.redis_client.get('_metrics_test_key')
            elif operation == 'set':
                self.redis_client.set('_metrics_test_key', 'test', ex=60)
            
            elapsed = (time.time() - start_time) * 1000  # 转换为毫秒
            return round(elapsed, 2)
        except Exception as e:
            logger.error(f"Failed to measure Redis response time: {e}")
            return -1.0
    
    def get_all_metrics(self) -> Dict[str, Any]:
        """
        获取所有 Redis 指标
        
        Returns:
            Dict[str, Any]: 所有指标的字典
        """
        try:
            if not self.redis_client:
                return {
                    'available': False,
                    'error': 'Redis client not initialized'
                }
            
            # 获取 Redis INFO
            info = self.get_redis_info()
            
            # 获取连接池统计
            pool_stats = self.get_connection_pool_stats()
            
            # 测量响应时间
            ping_time = self.measure_response_time('ping')
            get_time = self.measure_response_time('get')
            set_time = self.measure_response_time('set')
            
            return {
                'available': True,
                # 服务器信息
                'redis_version': info.get('redis_version', 'unknown'),
                'uptime_seconds': info.get('uptime_in_seconds', 0),
                
                # 客户端连接
                'connected_clients': info.get('connected_clients', 0),
                'blocked_clients': info.get('blocked_clients', 0),
                'max_clients': info.get('maxclients', 0),
                
                # 内存使用
                'used_memory': info.get('used_memory', 0),
                'used_memory_rss': info.get('used_memory_rss', 0),
                'used_memory_peak': info.get('used_memory_peak', 0),
                'maxmemory': info.get('maxmemory', 0),
                'mem_fragmentation_ratio': info.get('mem_fragmentation_ratio', 0),
                
                # 性能统计
                'total_commands_processed': info.get('total_commands_processed', 0),
                'instantaneous_ops_per_sec': info.get('instantaneous_ops_per_sec', 0),
                'keyspace_hits': info.get('keyspace_hits', 0),
                'keyspace_misses': info.get('keyspace_misses', 0),
                'evicted_keys': info.get('evicted_keys', 0),
                'expired_keys': info.get('expired_keys', 0),
                
                # 持久化
                'rdb_changes_since_last_save': info.get('rdb_changes_since_last_save', 0),
                'rdb_last_save_time': info.get('rdb_last_save_time', 0),
                
                # 复制
                'role': info.get('role', 'unknown'),
                'connected_slaves': info.get('connected_slaves', 0),
                
                # 连接池
                'pool_max_connections': pool_stats.get('max_connections', 0),
                'pool_created_connections': pool_stats.get('created_connections', 0),
                'pool_available_connections': pool_stats.get('available_connections', 0),
                'pool_in_use_connections': pool_stats.get('in_use_connections', 0),
                
                # 响应时间
                'response_time_ping_ms': ping_time,
                'response_time_get_ms': get_time,
                'response_time_set_ms': set_time,
                
                # 计算缓存命中率
                'cache_hit_rate': self._calculate_hit_rate(
                    info.get('keyspace_hits', 0),
                    info.get('keyspace_misses', 0)
                )
            }
        except Exception as e:
            logger.error(f"Failed to get all Redis metrics: {e}")
            return {
                'available': False,
                'error': str(e)
            }
    
    def _calculate_hit_rate(self, hits: int, misses: int) -> float:
        """
        计算缓存命中率
        
        Args:
            hits: 命中次数
            misses: 未命中次数
            
        Returns:
            float: 命中率百分比
        """
        total = hits + misses
        if total == 0:
            return 100.0
        return round((hits / total) * 100, 2)
    
    def export_prometheus_metrics(self) -> str:
        """
        导出 Prometheus 格式的 Redis 指标
        
        Returns:
            str: Prometheus 格式的指标文本
        """
        try:
            metrics = self.get_all_metrics()
            
            if not metrics.get('available'):
                return f"# Redis metrics unavailable: {metrics.get('error', 'unknown error')}\n"
            
            lines = [
                "# HELP redis_up Redis server availability (1 = up, 0 = down)",
                "# TYPE redis_up gauge",
                "redis_up 1",
                "",
                "# HELP redis_uptime_seconds Redis server uptime in seconds",
                "# TYPE redis_uptime_seconds counter",
                f"redis_uptime_seconds {metrics.get('uptime_seconds', 0)}",
                "",
                "# HELP redis_connected_clients Number of connected clients",
                "# TYPE redis_connected_clients gauge",
                f"redis_connected_clients {metrics.get('connected_clients', 0)}",
                "",
                "# HELP redis_blocked_clients Number of blocked clients",
                "# TYPE redis_blocked_clients gauge",
                f"redis_blocked_clients {metrics.get('blocked_clients', 0)}",
                "",
                "# HELP redis_used_memory_bytes Used memory in bytes",
                "# TYPE redis_used_memory_bytes gauge",
                f"redis_used_memory_bytes {metrics.get('used_memory', 0)}",
                "",
                "# HELP redis_used_memory_rss_bytes Used memory RSS in bytes",
                "# TYPE redis_used_memory_rss_bytes gauge",
                f"redis_used_memory_rss_bytes {metrics.get('used_memory_rss', 0)}",
                "",
                "# HELP redis_used_memory_peak_bytes Peak used memory in bytes",
                "# TYPE redis_used_memory_peak_bytes gauge",
                f"redis_used_memory_peak_bytes {metrics.get('used_memory_peak', 0)}",
                "",
                "# HELP redis_mem_fragmentation_ratio Memory fragmentation ratio",
                "# TYPE redis_mem_fragmentation_ratio gauge",
                f"redis_mem_fragmentation_ratio {metrics.get('mem_fragmentation_ratio', 0)}",
                "",
                "# HELP redis_commands_processed_total Total number of commands processed",
                "# TYPE redis_commands_processed_total counter",
                f"redis_commands_processed_total {metrics.get('total_commands_processed', 0)}",
                "",
                "# HELP redis_ops_per_sec Instantaneous operations per second",
                "# TYPE redis_ops_per_sec gauge",
                f"redis_ops_per_sec {metrics.get('instantaneous_ops_per_sec', 0)}",
                "",
                "# HELP redis_keyspace_hits_total Total number of keyspace hits",
                "# TYPE redis_keyspace_hits_total counter",
                f"redis_keyspace_hits_total {metrics.get('keyspace_hits', 0)}",
                "",
                "# HELP redis_keyspace_misses_total Total number of keyspace misses",
                "# TYPE redis_keyspace_misses_total counter",
                f"redis_keyspace_misses_total {metrics.get('keyspace_misses', 0)}",
                "",
                "# HELP redis_cache_hit_rate Cache hit rate percentage",
                "# TYPE redis_cache_hit_rate gauge",
                f"redis_cache_hit_rate {metrics.get('cache_hit_rate', 100.0)}",
                "",
                "# HELP redis_evicted_keys_total Total number of evicted keys",
                "# TYPE redis_evicted_keys_total counter",
                f"redis_evicted_keys_total {metrics.get('evicted_keys', 0)}",
                "",
                "# HELP redis_expired_keys_total Total number of expired keys",
                "# TYPE redis_expired_keys_total counter",
                f"redis_expired_keys_total {metrics.get('expired_keys', 0)}",
                "",
                "# HELP redis_connected_slaves Number of connected slaves",
                "# TYPE redis_connected_slaves gauge",
                f"redis_connected_slaves {metrics.get('connected_slaves', 0)}",
                "",
                "# HELP redis_pool_max_connections Maximum number of connections in pool",
                "# TYPE redis_pool_max_connections gauge",
                f"redis_pool_max_connections {metrics.get('pool_max_connections', 0)}",
                "",
                "# HELP redis_pool_created_connections Number of created connections in pool",
                "# TYPE redis_pool_created_connections gauge",
                f"redis_pool_created_connections {metrics.get('pool_created_connections', 0)}",
                "",
                "# HELP redis_pool_available_connections Number of available connections in pool",
                "# TYPE redis_pool_available_connections gauge",
                f"redis_pool_available_connections {metrics.get('pool_available_connections', 0)}",
                "",
                "# HELP redis_pool_in_use_connections Number of in-use connections in pool",
                "# TYPE redis_pool_in_use_connections gauge",
                f"redis_pool_in_use_connections {metrics.get('pool_in_use_connections', 0)}",
                "",
                "# HELP redis_response_time_ping_ms Redis PING response time in milliseconds",
                "# TYPE redis_response_time_ping_ms gauge",
                f"redis_response_time_ping_ms {metrics.get('response_time_ping_ms', -1)}",
                "",
                "# HELP redis_response_time_get_ms Redis GET response time in milliseconds",
                "# TYPE redis_response_time_get_ms gauge",
                f"redis_response_time_get_ms {metrics.get('response_time_get_ms', -1)}",
                "",
                "# HELP redis_response_time_set_ms Redis SET response time in milliseconds",
                "# TYPE redis_response_time_set_ms gauge",
                f"redis_response_time_set_ms {metrics.get('response_time_set_ms', -1)}",
                ""
            ]
            
            return "\n".join(lines)
            
        except Exception as e:
            logger.error(f"Failed to export Redis prometheus metrics: {e}")
            return f"# Error exporting Redis metrics: {str(e)}\n"


# 全局 Redis 指标服务实例
redis_metrics_service = RedisMetricsService()
