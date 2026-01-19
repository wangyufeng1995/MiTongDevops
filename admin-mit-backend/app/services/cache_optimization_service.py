"""
Redis Cache Optimization Service
Implements advanced caching strategies for performance optimization
"""
import json
import time
from typing import Any, Optional, Callable, List
from functools import wraps
from flask import current_app
from app.extensions import redis_client


class CacheOptimizationService:
    """Service for optimizing Redis cache usage"""
    
    # Cache TTL configurations (in seconds)
    TTL_SHORT = 60  # 1 minute
    TTL_MEDIUM = 300  # 5 minutes
    TTL_LONG = 1800  # 30 minutes
    TTL_NETWORK_PROBE = 180  # 3 minutes (as per requirements)
    
    @staticmethod
    def generate_cache_key(prefix: str, *args, **kwargs) -> str:
        """
        Generate a consistent cache key from prefix and parameters
        
        Args:
            prefix: Cache key prefix
            *args: Positional arguments to include in key
            **kwargs: Keyword arguments to include in key
            
        Returns:
            Generated cache key
        """
        key_parts = [prefix]
        
        # Add positional arguments
        for arg in args:
            key_parts.append(str(arg))
        
        # Add keyword arguments (sorted for consistency)
        for k, v in sorted(kwargs.items()):
            key_parts.append(f"{k}:{v}")
        
        return ":".join(key_parts)
    
    @staticmethod
    def cache_result(ttl: int = TTL_MEDIUM, key_prefix: str = "cache"):
        """
        Decorator to cache function results in Redis
        
        Args:
            ttl: Time to live in seconds
            key_prefix: Prefix for cache key
            
        Returns:
            Decorated function
        """
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def wrapper(*args, **kwargs):
                # Generate cache key
                cache_key = CacheOptimizationService.generate_cache_key(
                    key_prefix,
                    func.__name__,
                    *args,
                    **kwargs
                )
                
                # Try to get from cache
                try:
                    cached_value = redis_client.get(cache_key)
                    if cached_value:
                        return json.loads(cached_value)
                except Exception as e:
                    current_app.logger.warning(f"Cache read error: {e}")
                
                # Execute function
                result = func(*args, **kwargs)
                
                # Store in cache
                try:
                    redis_client.setex(
                        cache_key,
                        ttl,
                        json.dumps(result, default=str)
                    )
                except Exception as e:
                    current_app.logger.warning(f"Cache write error: {e}")
                
                return result
            
            return wrapper
        return decorator
    
    @staticmethod
    def invalidate_cache(key_pattern: str):
        """
        Invalidate cache keys matching a pattern
        
        Args:
            key_pattern: Pattern to match (e.g., "user:*")
        """
        try:
            keys = redis_client.keys(key_pattern)
            if keys:
                redis_client.delete(*keys)
                current_app.logger.info(f"Invalidated {len(keys)} cache keys matching {key_pattern}")
        except Exception as e:
            current_app.logger.error(f"Cache invalidation error: {e}")
    
    @staticmethod
    def get_or_set(key: str, value_func: Callable, ttl: int = TTL_MEDIUM) -> Any:
        """
        Get value from cache or compute and store it
        
        Args:
            key: Cache key
            value_func: Function to compute value if not cached
            ttl: Time to live in seconds
            
        Returns:
            Cached or computed value
        """
        try:
            # Try to get from cache
            cached_value = redis_client.get(key)
            if cached_value:
                return json.loads(cached_value)
        except Exception as e:
            current_app.logger.warning(f"Cache read error: {e}")
        
        # Compute value
        value = value_func()
        
        # Store in cache
        try:
            redis_client.setex(key, ttl, json.dumps(value, default=str))
        except Exception as e:
            current_app.logger.warning(f"Cache write error: {e}")
        
        return value
    
    @staticmethod
    def batch_get(keys: List[str]) -> dict:
        """
        Get multiple values from cache in one operation
        
        Args:
            keys: List of cache keys
            
        Returns:
            Dictionary of key-value pairs
        """
        try:
            values = redis_client.mget(keys)
            result = {}
            for key, value in zip(keys, values):
                if value:
                    try:
                        result[key] = json.loads(value)
                    except:
                        result[key] = value
            return result
        except Exception as e:
            current_app.logger.error(f"Batch cache read error: {e}")
            return {}
    
    @staticmethod
    def batch_set(data: dict, ttl: int = TTL_MEDIUM):
        """
        Set multiple values in cache in one operation
        
        Args:
            data: Dictionary of key-value pairs
            ttl: Time to live in seconds
        """
        try:
            pipe = redis_client.pipeline()
            for key, value in data.items():
                pipe.setex(key, ttl, json.dumps(value, default=str))
            pipe.execute()
        except Exception as e:
            current_app.logger.error(f"Batch cache write error: {e}")
    
    @staticmethod
    def increment_counter(key: str, amount: int = 1, ttl: Optional[int] = None) -> int:
        """
        Increment a counter in cache
        
        Args:
            key: Cache key
            amount: Amount to increment
            ttl: Time to live in seconds (optional)
            
        Returns:
            New counter value
        """
        try:
            new_value = redis_client.incr(key, amount)
            if ttl and new_value == amount:  # First increment
                redis_client.expire(key, ttl)
            return new_value
        except Exception as e:
            current_app.logger.error(f"Counter increment error: {e}")
            return 0
    
    @staticmethod
    def get_cache_stats() -> dict:
        """
        Get cache statistics
        
        Returns:
            Dictionary with cache statistics
        """
        try:
            info = redis_client.info('stats')
            return {
                'total_commands_processed': info.get('total_commands_processed', 0),
                'keyspace_hits': info.get('keyspace_hits', 0),
                'keyspace_misses': info.get('keyspace_misses', 0),
                'hit_rate': (
                    info.get('keyspace_hits', 0) / 
                    (info.get('keyspace_hits', 0) + info.get('keyspace_misses', 1))
                ) * 100,
                'used_memory': info.get('used_memory_human', 'N/A'),
                'connected_clients': redis_client.info('clients').get('connected_clients', 0)
            }
        except Exception as e:
            current_app.logger.error(f"Error getting cache stats: {e}")
            return {}
    
    @staticmethod
    def warm_cache(data_loader: Callable, key_prefix: str, ttl: int = TTL_LONG):
        """
        Pre-warm cache with frequently accessed data
        
        Args:
            data_loader: Function that returns data to cache
            key_prefix: Prefix for cache keys
            ttl: Time to live in seconds
        """
        try:
            start_time = time.time()
            data = data_loader()
            
            if isinstance(data, dict):
                CacheOptimizationService.batch_set(
                    {f"{key_prefix}:{k}": v for k, v in data.items()},
                    ttl
                )
            elif isinstance(data, list):
                CacheOptimizationService.batch_set(
                    {f"{key_prefix}:{i}": item for i, item in enumerate(data)},
                    ttl
                )
            
            elapsed = (time.time() - start_time) * 1000
            current_app.logger.info(f"Cache warmed in {elapsed:.2f}ms")
        except Exception as e:
            current_app.logger.error(f"Cache warming error: {e}")


class NetworkProbeCacheService:
    """Specialized cache service for network probe results"""
    
    @staticmethod
    def cache_probe_result(probe_id: int, result: dict):
        """
        Cache network probe result
        
        Args:
            probe_id: Probe ID
            result: Probe result data
        """
        key = f"network:probe:{probe_id}:latest_result"
        try:
            redis_client.setex(
                key,
                CacheOptimizationService.TTL_NETWORK_PROBE,
                json.dumps(result, default=str)
            )
        except Exception as e:
            current_app.logger.error(f"Error caching probe result: {e}")
    
    @staticmethod
    def get_cached_probe_result(probe_id: int) -> Optional[dict]:
        """
        Get cached probe result
        
        Args:
            probe_id: Probe ID
            
        Returns:
            Cached result or None
        """
        key = f"network:probe:{probe_id}:latest_result"
        try:
            cached = redis_client.get(key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            current_app.logger.error(f"Error reading cached probe result: {e}")
        return None
    
    @staticmethod
    def cache_probe_statistics(probe_id: int, stats: dict):
        """
        Cache probe statistics
        
        Args:
            probe_id: Probe ID
            stats: Statistics data
        """
        key = f"network:probe:{probe_id}:stats"
        try:
            redis_client.setex(
                key,
                CacheOptimizationService.TTL_NETWORK_PROBE,
                json.dumps(stats, default=str)
            )
        except Exception as e:
            current_app.logger.error(f"Error caching probe stats: {e}")
    
    @staticmethod
    def invalidate_probe_cache(probe_id: int):
        """
        Invalidate all cache for a specific probe
        
        Args:
            probe_id: Probe ID
        """
        pattern = f"network:probe:{probe_id}:*"
        CacheOptimizationService.invalidate_cache(pattern)
    
    @staticmethod
    def update_probe_status(probe_id: int, status: str):
        """
        Update probe status in cache
        
        Args:
            probe_id: Probe ID
            status: Status string (running, stopped, error)
        """
        key = f"network:probe:{probe_id}:status"
        try:
            redis_client.setex(
                key,
                CacheOptimizationService.TTL_MEDIUM,
                status
            )
        except Exception as e:
            current_app.logger.error(f"Error updating probe status: {e}")
