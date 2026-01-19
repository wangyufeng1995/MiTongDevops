"""
网络探测 Redis 缓存服务
"""
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from app.extensions import redis_client
from app.core.config_manager import config_manager

logger = logging.getLogger(__name__)


class NetworkCacheService:
    """网络探测缓存服务类"""
    
    def __init__(self):
        """初始化缓存服务"""
        self.redis = redis_client
        redis_config = config_manager.get_redis_config()
        self.cache_config = redis_config.get('cache', {})
        self.probe_result_ttl = self.cache_config.get('network_probe_ttl', 180)  # 默认180秒
        self.default_ttl = self.cache_config.get('default_timeout', 300)
    
    def _get_probe_result_key(self, probe_id: int) -> str:
        """
        获取探测结果缓存键
        
        Args:
            probe_id: 探测任务 ID
            
        Returns:
            str: Redis 缓存键
        """
        return f"network:probe:result:{probe_id}"
    
    def _get_probe_results_list_key(self, probe_id: int) -> str:
        """
        获取探测结果列表缓存键
        
        Args:
            probe_id: 探测任务 ID
            
        Returns:
            str: Redis 缓存键
        """
        return f"network:probe:results:list:{probe_id}"
    
    def _get_probe_statistics_key(self, probe_id: int) -> str:
        """
        获取探测统计信息缓存键
        
        Args:
            probe_id: 探测任务 ID
            
        Returns:
            str: Redis 缓存键
        """
        return f"network:probe:statistics:{probe_id}"
    
    def _get_probe_config_key(self, probe_id: int) -> str:
        """
        获取探测配置缓存键
        
        Args:
            probe_id: 探测任务 ID
            
        Returns:
            str: Redis 缓存键
        """
        return f"network:probe:config:{probe_id}"
    
    def _get_probe_group_key(self, group_id: int) -> str:
        """
        获取探测分组缓存键
        
        Args:
            group_id: 分组 ID
            
        Returns:
            str: Redis 缓存键
        """
        return f"network:probe:group:{group_id}"
    
    def _get_probe_status_key(self, probe_id: int) -> str:
        """
        获取探测状态缓存键
        
        Args:
            probe_id: 探测任务 ID
            
        Returns:
            str: Redis 缓存键
        """
        return f"network:probe:status:{probe_id}"
    
    def cache_probe_result(self, probe_id: int, result_data: Dict[str, Any]) -> bool:
        """
        缓存探测结果
        
        Args:
            probe_id: 探测任务 ID
            result_data: 探测结果数据
            
        Returns:
            bool: 是否缓存成功
        """
        try:
            cache_key = self._get_probe_result_key(probe_id)
            
            # 添加缓存时间戳
            result_data['cached_at'] = datetime.utcnow().isoformat()
            
            # 序列化并存储
            self.redis.setex(
                cache_key,
                self.probe_result_ttl,
                json.dumps(result_data, ensure_ascii=False)
            )
            
            logger.info(f"探测结果已缓存: probe_id={probe_id}, ttl={self.probe_result_ttl}s")
            return True
            
        except Exception as e:
            logger.error(f"缓存探测结果失败: probe_id={probe_id}, 错误: {str(e)}")
            return False
    
    def get_cached_probe_result(self, probe_id: int) -> Optional[Dict[str, Any]]:
        """
        获取缓存的探测结果
        
        Args:
            probe_id: 探测任务 ID
            
        Returns:
            Optional[Dict]: 探测结果数据，如果不存在则返回 None
        """
        try:
            cache_key = self._get_probe_result_key(probe_id)
            cached_data = self.redis.get(cache_key)
            
            if cached_data:
                result = json.loads(cached_data)
                logger.debug(f"从缓存获取探测结果: probe_id={probe_id}")
                return result
            
            logger.debug(f"缓存中无探测结果: probe_id={probe_id}")
            return None
            
        except Exception as e:
            logger.error(f"获取缓存探测结果失败: probe_id={probe_id}, 错误: {str(e)}")
            return None
    
    def cache_probe_results_list(self, probe_id: int, results: List[Dict[str, Any]], 
                                  page: int = 1, limit: int = 10) -> bool:
        """
        缓存探测结果列表（分页）
        
        Args:
            probe_id: 探测任务 ID
            results: 探测结果列表
            page: 页码
            limit: 每页数量
            
        Returns:
            bool: 是否缓存成功
        """
        try:
            cache_key = f"{self._get_probe_results_list_key(probe_id)}:page:{page}:limit:{limit}"
            
            cache_data = {
                'results': results,
                'page': page,
                'limit': limit,
                'total': len(results),
                'cached_at': datetime.utcnow().isoformat()
            }
            
            # 序列化并存储
            self.redis.setex(
                cache_key,
                self.probe_result_ttl,
                json.dumps(cache_data, ensure_ascii=False)
            )
            
            logger.info(f"探测结果列表已缓存: probe_id={probe_id}, page={page}, limit={limit}")
            return True
            
        except Exception as e:
            logger.error(f"缓存探测结果列表失败: probe_id={probe_id}, 错误: {str(e)}")
            return False
    
    def get_cached_probe_results_list(self, probe_id: int, page: int = 1, 
                                       limit: int = 10) -> Optional[Dict[str, Any]]:
        """
        获取缓存的探测结果列表
        
        Args:
            probe_id: 探测任务 ID
            page: 页码
            limit: 每页数量
            
        Returns:
            Optional[Dict]: 探测结果列表数据，如果不存在则返回 None
        """
        try:
            cache_key = f"{self._get_probe_results_list_key(probe_id)}:page:{page}:limit:{limit}"
            cached_data = self.redis.get(cache_key)
            
            if cached_data:
                result = json.loads(cached_data)
                logger.debug(f"从缓存获取探测结果列表: probe_id={probe_id}, page={page}")
                return result
            
            logger.debug(f"缓存中无探测结果列表: probe_id={probe_id}, page={page}")
            return None
            
        except Exception as e:
            logger.error(f"获取缓存探测结果列表失败: probe_id={probe_id}, 错误: {str(e)}")
            return None
    
    def cache_probe_statistics(self, probe_id: int, statistics: Dict[str, Any]) -> bool:
        """
        缓存探测统计信息
        
        Args:
            probe_id: 探测任务 ID
            statistics: 统计信息
            
        Returns:
            bool: 是否缓存成功
        """
        try:
            cache_key = self._get_probe_statistics_key(probe_id)
            
            # 添加缓存时间戳
            statistics['cached_at'] = datetime.utcnow().isoformat()
            
            # 序列化并存储
            self.redis.setex(
                cache_key,
                self.probe_result_ttl,
                json.dumps(statistics, ensure_ascii=False)
            )
            
            logger.info(f"探测统计信息已缓存: probe_id={probe_id}")
            return True
            
        except Exception as e:
            logger.error(f"缓存探测统计信息失败: probe_id={probe_id}, 错误: {str(e)}")
            return False
    
    def get_cached_probe_statistics(self, probe_id: int) -> Optional[Dict[str, Any]]:
        """
        获取缓存的探测统计信息
        
        Args:
            probe_id: 探测任务 ID
            
        Returns:
            Optional[Dict]: 统计信息，如果不存在则返回 None
        """
        try:
            cache_key = self._get_probe_statistics_key(probe_id)
            cached_data = self.redis.get(cache_key)
            
            if cached_data:
                result = json.loads(cached_data)
                logger.debug(f"从缓存获取探测统计信息: probe_id={probe_id}")
                return result
            
            logger.debug(f"缓存中无探测统计信息: probe_id={probe_id}")
            return None
            
        except Exception as e:
            logger.error(f"获取缓存探测统计信息失败: probe_id={probe_id}, 错误: {str(e)}")
            return None
    
    def cache_probe_config(self, probe_id: int, config_data: Dict[str, Any]) -> bool:
        """
        缓存探测配置信息
        
        Args:
            probe_id: 探测任务 ID
            config_data: 配置数据
            
        Returns:
            bool: 是否缓存成功
        """
        try:
            cache_key = self._get_probe_config_key(probe_id)
            
            # 添加缓存时间戳
            config_data['cached_at'] = datetime.utcnow().isoformat()
            
            # 序列化并存储（配置信息使用默认TTL）
            self.redis.setex(
                cache_key,
                self.default_ttl,
                json.dumps(config_data, ensure_ascii=False)
            )
            
            logger.info(f"探测配置已缓存: probe_id={probe_id}")
            return True
            
        except Exception as e:
            logger.error(f"缓存探测配置失败: probe_id={probe_id}, 错误: {str(e)}")
            return False
    
    def get_cached_probe_config(self, probe_id: int) -> Optional[Dict[str, Any]]:
        """
        获取缓存的探测配置信息
        
        Args:
            probe_id: 探测任务 ID
            
        Returns:
            Optional[Dict]: 配置数据，如果不存在则返回 None
        """
        try:
            cache_key = self._get_probe_config_key(probe_id)
            cached_data = self.redis.get(cache_key)
            
            if cached_data:
                result = json.loads(cached_data)
                logger.debug(f"从缓存获取探测配置: probe_id={probe_id}")
                return result
            
            logger.debug(f"缓存中无探测配置: probe_id={probe_id}")
            return None
            
        except Exception as e:
            logger.error(f"获取缓存探测配置失败: probe_id={probe_id}, 错误: {str(e)}")
            return None
    
    def invalidate_probe_cache(self, probe_id: int) -> bool:
        """
        使探测任务的所有缓存失效
        
        Args:
            probe_id: 探测任务 ID
            
        Returns:
            bool: 是否成功
        """
        try:
            # 获取所有相关的缓存键
            pattern = f"network:probe:*:{probe_id}*"
            keys = self.redis.keys(pattern)
            
            if keys:
                # 删除所有匹配的键
                self.redis.delete(*keys)
                logger.info(f"已清除探测任务缓存: probe_id={probe_id}, 清除键数量={len(keys)}")
            else:
                logger.debug(f"无需清除缓存: probe_id={probe_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"清除探测任务缓存失败: probe_id={probe_id}, 错误: {str(e)}")
            return False
    
    def invalidate_probe_results_cache(self, probe_id: int) -> bool:
        """
        使探测结果缓存失效（保留配置缓存）
        
        Args:
            probe_id: 探测任务 ID
            
        Returns:
            bool: 是否成功
        """
        try:
            # 只清除结果相关的缓存
            patterns = [
                f"network:probe:result:{probe_id}",
                f"network:probe:results:list:{probe_id}*",
                f"network:probe:statistics:{probe_id}"
            ]
            
            deleted_count = 0
            for pattern in patterns:
                keys = self.redis.keys(pattern)
                if keys:
                    self.redis.delete(*keys)
                    deleted_count += len(keys)
            
            logger.info(f"已清除探测结果缓存: probe_id={probe_id}, 清除键数量={deleted_count}")
            return True
            
        except Exception as e:
            logger.error(f"清除探测结果缓存失败: probe_id={probe_id}, 错误: {str(e)}")
            return False
    
    def refresh_cache_ttl(self, cache_key: str, ttl_ms: int) -> bool:
        """
        使用 PEXPIRE 刷新缓存 TTL（毫秒级精度）
        
        Args:
            cache_key: 缓存键
            ttl_ms: 过期时间（毫秒）
            
        Returns:
            bool: 如果键存在且 TTL 已更新返回 True，否则返回 False
        """
        try:
            # PEXPIRE 返回 1 表示成功设置，0 表示键不存在
            result = self.redis.pexpire(cache_key, ttl_ms)
            
            if result:
                logger.debug(f"缓存 TTL 已刷新: key={cache_key}, ttl_ms={ttl_ms}")
                return True
            else:
                logger.debug(f"缓存键不存在，跳过 TTL 刷新: key={cache_key}")
                return False
                
        except Exception as e:
            logger.error(f"刷新缓存 TTL 失败: key={cache_key}, 错误: {str(e)}")
            return False
    
    def refresh_probe_results_ttl(self, probe_id: int) -> bool:
        """
        使用 PEXPIRE 刷新探测结果相关缓存的 TTL
        
        Args:
            probe_id: 探测任务 ID
            
        Returns:
            bool: 是否成功
        """
        try:
            # 转换为毫秒
            ttl_ms = self.probe_result_ttl * 1000
            
            # 刷新结果列表缓存的 TTL
            patterns = [
                f"network:probe:results:list:{probe_id}*",
                f"network:probe:statistics:{probe_id}"
            ]
            
            refreshed_count = 0
            for pattern in patterns:
                keys = self.redis.keys(pattern)
                for key in keys:
                    # 确保 key 是字符串类型
                    key_str = key.decode('utf-8') if isinstance(key, bytes) else key
                    if self.refresh_cache_ttl(key_str, ttl_ms):
                        refreshed_count += 1
            
            logger.info(f"探测结果缓存 TTL 已刷新: probe_id={probe_id}, 刷新键数量={refreshed_count}")
            return True
            
        except Exception as e:
            logger.error(f"刷新探测结果缓存 TTL 失败: probe_id={probe_id}, 错误: {str(e)}")
            return False
    
    def sync_probe_config_to_cache(self, probe_id: int, probe_data: Dict[str, Any]) -> bool:
        """
        同步探测配置到缓存（页面数据变更时调用）
        
        Args:
            probe_id: 探测任务 ID
            probe_data: 探测配置数据
            
        Returns:
            bool: 是否成功
        """
        try:
            # 缓存新的配置
            success = self.cache_probe_config(probe_id, probe_data)
            
            if success:
                logger.info(f"探测配置已同步到缓存: probe_id={probe_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"同步探测配置到缓存失败: probe_id={probe_id}, 错误: {str(e)}")
            return False
    
    def sync_probe_result_to_cache(self, probe_id: int, result_data: Dict[str, Any]) -> bool:
        """
        同步探测结果到缓存（新结果产生时调用）
        
        使用 PEXPIRE 刷新结果列表缓存的 TTL，而不是清除缓存，
        这样可以保持缓存连续性并减少数据库查询。
        
        Args:
            probe_id: 探测任务 ID
            result_data: 探测结果数据
            
        Returns:
            bool: 是否成功
        """
        try:
            # 缓存最新结果
            success = self.cache_probe_result(probe_id, result_data)
            
            # 使用 PEXPIRE 刷新结果列表缓存的 TTL，保留现有缓存数据
            self.refresh_probe_results_ttl(probe_id)
            
            if success:
                logger.info(f"探测结果已同步到缓存: probe_id={probe_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"同步探测结果到缓存失败: probe_id={probe_id}, 错误: {str(e)}")
            return False
    
    def cache_probe_group(self, group_id: int, group_data: Dict[str, Any]) -> bool:
        """
        缓存探测分组信息
        
        Args:
            group_id: 分组 ID
            group_data: 分组数据
            
        Returns:
            bool: 是否缓存成功
        """
        try:
            cache_key = self._get_probe_group_key(group_id)
            
            # 添加缓存时间戳
            group_data['cached_at'] = datetime.utcnow().isoformat()
            
            # 序列化并存储
            self.redis.setex(
                cache_key,
                self.default_ttl,
                json.dumps(group_data, ensure_ascii=False)
            )
            
            logger.info(f"探测分组已缓存: group_id={group_id}")
            return True
            
        except Exception as e:
            logger.error(f"缓存探测分组失败: group_id={group_id}, 错误: {str(e)}")
            return False
    
    def get_cached_probe_group(self, group_id: int) -> Optional[Dict[str, Any]]:
        """
        获取缓存的探测分组信息
        
        Args:
            group_id: 分组 ID
            
        Returns:
            Optional[Dict]: 分组数据，如果不存在则返回 None
        """
        try:
            cache_key = self._get_probe_group_key(group_id)
            cached_data = self.redis.get(cache_key)
            
            if cached_data:
                result = json.loads(cached_data)
                logger.debug(f"从缓存获取探测分组: group_id={group_id}")
                return result
            
            logger.debug(f"缓存中无探测分组: group_id={group_id}")
            return None
            
        except Exception as e:
            logger.error(f"获取缓存探测分组失败: group_id={group_id}, 错误: {str(e)}")
            return None
    
    def invalidate_probe_group_cache(self, group_id: int) -> bool:
        """
        使探测分组缓存失效
        
        Args:
            group_id: 分组 ID
            
        Returns:
            bool: 是否成功
        """
        try:
            cache_key = self._get_probe_group_key(group_id)
            self.redis.delete(cache_key)
            
            logger.info(f"已清除探测分组缓存: group_id={group_id}")
            return True
            
        except Exception as e:
            logger.error(f"清除探测分组缓存失败: group_id={group_id}, 错误: {str(e)}")
            return False
    
    def update_probe_status(self, probe_id: int, status: str) -> bool:
        """
        更新探测任务状态
        
        Args:
            probe_id: 探测任务 ID
            status: 状态值 ('running', 'stopped', 'error')
            
        Returns:
            bool: 是否成功
        """
        try:
            cache_key = self._get_probe_status_key(probe_id)
            
            status_data = {
                'status': status,
                'updated_at': datetime.utcnow().isoformat()
            }
            
            # 状态缓存使用较短的TTL（5分钟）
            self.redis.setex(
                cache_key,
                300,
                json.dumps(status_data, ensure_ascii=False)
            )
            
            logger.debug(f"探测状态已更新: probe_id={probe_id}, status={status}")
            return True
            
        except Exception as e:
            logger.error(f"更新探测状态失败: probe_id={probe_id}, 错误: {str(e)}")
            return False
    
    def get_probe_status(self, probe_id: int) -> Optional[str]:
        """
        获取探测任务状态
        
        Args:
            probe_id: 探测任务 ID
            
        Returns:
            Optional[str]: 状态值，如果不存在则返回 None
        """
        try:
            cache_key = self._get_probe_status_key(probe_id)
            cached_data = self.redis.get(cache_key)
            
            if cached_data:
                status_data = json.loads(cached_data)
                logger.debug(f"从缓存获取探测状态: probe_id={probe_id}, status={status_data['status']}")
                return status_data['status']
            
            logger.debug(f"缓存中无探测状态: probe_id={probe_id}")
            return None
            
        except Exception as e:
            logger.error(f"获取探测状态失败: probe_id={probe_id}, 错误: {str(e)}")
            return None
    
    def get_cache_info(self) -> Dict[str, Any]:
        """
        获取缓存配置信息
        
        Returns:
            Dict: 缓存配置信息
        """
        return {
            'probe_result_ttl': self.probe_result_ttl,
            'default_ttl': self.default_ttl,
            'redis_connected': self._check_redis_connection()
        }
    
    def _check_redis_connection(self) -> bool:
        """
        检查 Redis 连接状态
        
        Returns:
            bool: 是否连接正常
        """
        try:
            self.redis.ping()
            return True
        except Exception as e:
            logger.error(f"Redis 连接检查失败: {str(e)}")
            return False


# 创建全局服务实例
network_cache_service = NetworkCacheService()
