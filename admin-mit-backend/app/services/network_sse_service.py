"""
网络探测 SSE 实时推送服务
"""
import json
import logging
import time
import queue
import threading
from typing import Dict, Any, Optional, Generator
from datetime import datetime
from flask import Response
from app.services.network_cache_service import network_cache_service
from app.models.network import NetworkProbe, NetworkProbeResult
from app.extensions import db

logger = logging.getLogger(__name__)


class SSEConnection:
    """SSE 连接对象"""
    
    def __init__(self, probe_id: int, tenant_id: int):
        """
        初始化 SSE 连接
        
        Args:
            probe_id: 探测任务 ID
            tenant_id: 租户 ID
        """
        self.probe_id = probe_id
        self.tenant_id = tenant_id
        self.message_queue = queue.Queue(maxsize=100)
        self.is_active = True
        self.created_at = datetime.utcnow()
        self.last_activity = datetime.utcnow()
        
        logger.info(f"SSE 连接已创建: probe_id={probe_id}, tenant_id={tenant_id}")
    
    def send_message(self, event: str, data: Dict[str, Any]) -> bool:
        """
        发送消息到队列
        
        Args:
            event: 事件类型
            data: 消息数据
            
        Returns:
            bool: 是否发送成功
        """
        if not self.is_active:
            logger.warning(f"SSE 连接已关闭，无法发送消息: probe_id={self.probe_id}")
            return False
        
        try:
            message = {
                'event': event,
                'data': data,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            # 非阻塞方式放入队列
            self.message_queue.put_nowait(message)
            self.last_activity = datetime.utcnow()
            
            logger.debug(f"消息已加入队列: probe_id={self.probe_id}, event={event}")
            return True
            
        except queue.Full:
            logger.warning(f"消息队列已满: probe_id={self.probe_id}, event={event}")
            return False
        except Exception as e:
            logger.error(f"发送消息失败: probe_id={self.probe_id}, 错误: {str(e)}")
            return False
    
    def get_message(self, timeout: float = 30.0) -> Optional[Dict[str, Any]]:
        """
        从队列获取消息
        
        Args:
            timeout: 超时时间（秒）
            
        Returns:
            Optional[Dict]: 消息数据，如果超时则返回 None
        """
        try:
            message = self.message_queue.get(timeout=timeout)
            self.last_activity = datetime.utcnow()
            return message
        except queue.Empty:
            return None
        except Exception as e:
            logger.error(f"获取消息失败: probe_id={self.probe_id}, 错误: {str(e)}")
            return None
    
    def close(self):
        """关闭连接"""
        self.is_active = False
        logger.info(f"SSE 连接已关闭: probe_id={self.probe_id}")


class NetworkSSEService:
    """网络探测 SSE 实时推送服务类"""
    
    def __init__(self):
        """初始化 SSE 服务"""
        self.connections: Dict[str, SSEConnection] = {}
        self.lock = threading.Lock()
        
        # 启动清理线程
        self._start_cleanup_thread()
        
        logger.info("网络探测 SSE 服务已初始化")
    
    def _get_connection_key(self, probe_id: int, tenant_id: int) -> str:
        """
        获取连接键
        
        Args:
            probe_id: 探测任务 ID
            tenant_id: 租户 ID
            
        Returns:
            str: 连接键
        """
        return f"{tenant_id}:{probe_id}"
    
    def create_connection(self, probe_id: int, tenant_id: int) -> SSEConnection:
        """
        创建 SSE 连接
        
        Args:
            probe_id: 探测任务 ID
            tenant_id: 租户 ID
            
        Returns:
            SSEConnection: SSE 连接对象
        """
        connection_key = self._get_connection_key(probe_id, tenant_id)
        
        with self.lock:
            # 如果已存在连接，先关闭旧连接
            if connection_key in self.connections:
                old_connection = self.connections[connection_key]
                old_connection.close()
                logger.info(f"关闭旧的 SSE 连接: {connection_key}")
            
            # 创建新连接
            connection = SSEConnection(probe_id, tenant_id)
            self.connections[connection_key] = connection
            
            logger.info(f"创建新的 SSE 连接: {connection_key}, 当前连接数: {len(self.connections)}")
            
            return connection
    
    def get_connection(self, probe_id: int, tenant_id: int) -> Optional[SSEConnection]:
        """
        获取 SSE 连接
        
        Args:
            probe_id: 探测任务 ID
            tenant_id: 租户 ID
            
        Returns:
            Optional[SSEConnection]: SSE 连接对象，如果不存在则返回 None
        """
        connection_key = self._get_connection_key(probe_id, tenant_id)
        
        with self.lock:
            return self.connections.get(connection_key)
    
    def remove_connection(self, probe_id: int, tenant_id: int):
        """
        移除 SSE 连接
        
        Args:
            probe_id: 探测任务 ID
            tenant_id: 租户 ID
        """
        connection_key = self._get_connection_key(probe_id, tenant_id)
        
        with self.lock:
            if connection_key in self.connections:
                connection = self.connections[connection_key]
                connection.close()
                del self.connections[connection_key]
                
                logger.info(f"移除 SSE 连接: {connection_key}, 剩余连接数: {len(self.connections)}")
    
    def broadcast_probe_result(self, probe_id: int, result_data: Dict[str, Any]):
        """
        广播探测结果到所有相关连接
        
        Args:
            probe_id: 探测任务 ID
            result_data: 探测结果数据
        """
        # 获取探测任务的租户 ID
        try:
            probe = NetworkProbe.query.get(probe_id)
            if not probe:
                logger.warning(f"探测任务不存在: probe_id={probe_id}")
                return
            
            tenant_id = probe.tenant_id
            connection = self.get_connection(probe_id, tenant_id)
            
            if connection and connection.is_active:
                # 格式化推送数据
                formatted_data = self._format_probe_result(result_data)
                
                # 发送消息
                success = connection.send_message('probe_result', formatted_data)
                
                if success:
                    logger.info(f"探测结果已推送: probe_id={probe_id}, tenant_id={tenant_id}")
                    
                    # 同步到 Redis 缓存
                    network_cache_service.sync_probe_result_to_cache(probe_id, result_data)
                else:
                    logger.warning(f"探测结果推送失败: probe_id={probe_id}")
            else:
                logger.debug(f"无活跃的 SSE 连接: probe_id={probe_id}, tenant_id={tenant_id}")
                
        except Exception as e:
            logger.error(f"广播探测结果失败: probe_id={probe_id}, 错误: {str(e)}")
    
    def broadcast_probe_status(self, probe_id: int, tenant_id: int, status: str, message: str = ""):
        """
        广播探测状态更新
        
        Args:
            probe_id: 探测任务 ID
            tenant_id: 租户 ID
            status: 状态值
            message: 状态消息
        """
        connection = self.get_connection(probe_id, tenant_id)
        
        if connection and connection.is_active:
            status_data = {
                'probe_id': probe_id,
                'status': status,
                'message': message,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            success = connection.send_message('probe_status', status_data)
            
            if success:
                logger.info(f"探测状态已推送: probe_id={probe_id}, status={status}")
                
                # 更新 Redis 缓存中的状态
                network_cache_service.update_probe_status(probe_id, status)
            else:
                logger.warning(f"探测状态推送失败: probe_id={probe_id}")
        else:
            logger.debug(f"无活跃的 SSE 连接: probe_id={probe_id}, tenant_id={tenant_id}")
    
    def broadcast_probe_error(self, probe_id: int, tenant_id: int, error_message: str):
        """
        广播探测错误
        
        Args:
            probe_id: 探测任务 ID
            tenant_id: 租户 ID
            error_message: 错误消息
        """
        connection = self.get_connection(probe_id, tenant_id)
        
        if connection and connection.is_active:
            error_data = {
                'probe_id': probe_id,
                'error': error_message,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            success = connection.send_message('probe_error', error_data)
            
            if success:
                logger.info(f"探测错误已推送: probe_id={probe_id}")
            else:
                logger.warning(f"探测错误推送失败: probe_id={probe_id}")
        else:
            logger.debug(f"无活跃的 SSE 连接: probe_id={probe_id}, tenant_id={tenant_id}")
    
    def _format_probe_result(self, result_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        格式化探测结果数据
        
        Args:
            result_data: 原始探测结果数据
            
        Returns:
            Dict: 格式化后的数据
        """
        return {
            'id': result_data.get('id'),
            'probe_id': result_data.get('probe_id'),
            'probe_name': result_data.get('probe_name'),
            'probe_type': result_data.get('probe_type'),
            'status': result_data.get('status'),
            'response_time': result_data.get('response_time'),
            'status_code': result_data.get('status_code'),
            'error_message': result_data.get('error_message'),
            'probed_at': result_data.get('probed_at'),
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def generate_sse_stream(self, probe_id: int, tenant_id: int) -> Generator[str, None, None]:
        """
        生成 SSE 数据流
        
        Args:
            probe_id: 探测任务 ID
            tenant_id: 租户 ID
            
        Yields:
            str: SSE 格式的消息
        """
        # 创建连接
        connection = self.create_connection(probe_id, tenant_id)
        
        try:
            # 发送初始连接消息
            yield self._format_sse_message('connected', {
                'probe_id': probe_id,
                'message': 'SSE 连接已建立',
                'timestamp': datetime.utcnow().isoformat()
            })
            
            # 发送初始探测状态
            initial_status = self._get_initial_probe_status(probe_id)
            if initial_status:
                yield self._format_sse_message('probe_status', initial_status)
            
            # 发送最近的探测结果
            recent_result = self._get_recent_probe_result(probe_id)
            if recent_result:
                yield self._format_sse_message('probe_result', recent_result)
            
            # 持续监听消息
            heartbeat_interval = 30  # 心跳间隔（秒）
            last_heartbeat = time.time()
            
            while connection.is_active:
                # 获取消息（带超时）
                message = connection.get_message(timeout=5.0)
                
                if message:
                    # 发送消息
                    yield self._format_sse_message(message['event'], message['data'])
                    last_heartbeat = time.time()
                else:
                    # 发送心跳消息
                    current_time = time.time()
                    if current_time - last_heartbeat >= heartbeat_interval:
                        yield self._format_sse_message('heartbeat', {
                            'timestamp': datetime.utcnow().isoformat()
                        })
                        last_heartbeat = current_time
                
        except GeneratorExit:
            logger.info(f"SSE 客户端断开连接: probe_id={probe_id}, tenant_id={tenant_id}")
        except Exception as e:
            logger.error(f"SSE 流生成错误: probe_id={probe_id}, 错误: {str(e)}")
            yield self._format_sse_message('error', {
                'message': '服务器错误',
                'timestamp': datetime.utcnow().isoformat()
            })
        finally:
            # 清理连接
            self.remove_connection(probe_id, tenant_id)
    
    def _format_sse_message(self, event: str, data: Dict[str, Any]) -> str:
        """
        格式化 SSE 消息
        
        Args:
            event: 事件类型
            data: 消息数据
            
        Returns:
            str: SSE 格式的消息
        """
        # SSE 消息格式：
        # event: <event_type>
        # data: <json_data>
        # \n\n
        
        json_data = json.dumps(data, ensure_ascii=False)
        return f"event: {event}\ndata: {json_data}\n\n"
    
    def _get_initial_probe_status(self, probe_id: int) -> Optional[Dict[str, Any]]:
        """
        获取初始探测状态
        
        Args:
            probe_id: 探测任务 ID
            
        Returns:
            Optional[Dict]: 状态数据
        """
        try:
            # 先从缓存获取
            cached_status = network_cache_service.get_probe_status(probe_id)
            if cached_status:
                return {
                    'probe_id': probe_id,
                    'status': cached_status,
                    'message': '从缓存获取状态',
                    'timestamp': datetime.utcnow().isoformat()
                }
            
            # 从数据库获取探测任务
            probe = NetworkProbe.query.get(probe_id)
            if probe:
                status = 'running' if probe.auto_probe_enabled else 'stopped'
                return {
                    'probe_id': probe_id,
                    'status': status,
                    'message': '从数据库获取状态',
                    'timestamp': datetime.utcnow().isoformat()
                }
            
            return None
            
        except Exception as e:
            logger.error(f"获取初始探测状态失败: probe_id={probe_id}, 错误: {str(e)}")
            return None
    
    def _get_recent_probe_result(self, probe_id: int) -> Optional[Dict[str, Any]]:
        """
        获取最近的探测结果
        
        Args:
            probe_id: 探测任务 ID
            
        Returns:
            Optional[Dict]: 探测结果数据
        """
        try:
            # 先从缓存获取
            cached_result = network_cache_service.get_cached_probe_result(probe_id)
            if cached_result:
                return self._format_probe_result(cached_result)
            
            # 从数据库获取最近的结果
            recent_result = NetworkProbeResult.query.filter_by(
                probe_id=probe_id
            ).order_by(
                NetworkProbeResult.probed_at.desc()
            ).first()
            
            if recent_result:
                result_data = recent_result.to_dict()
                
                # 缓存结果
                network_cache_service.cache_probe_result(probe_id, result_data)
                
                return self._format_probe_result(result_data)
            
            return None
            
        except Exception as e:
            logger.error(f"获取最近探测结果失败: probe_id={probe_id}, 错误: {str(e)}")
            return None
    
    def _start_cleanup_thread(self):
        """启动清理线程，定期清理不活跃的连接"""
        def cleanup_inactive_connections():
            while True:
                try:
                    time.sleep(60)  # 每分钟检查一次
                    
                    current_time = datetime.utcnow()
                    inactive_keys = []
                    
                    with self.lock:
                        for key, connection in self.connections.items():
                            # 如果连接超过 5 分钟没有活动，标记为不活跃
                            inactive_duration = (current_time - connection.last_activity).total_seconds()
                            if inactive_duration > 300:  # 5 分钟
                                inactive_keys.append(key)
                        
                        # 移除不活跃的连接
                        for key in inactive_keys:
                            connection = self.connections[key]
                            connection.close()
                            del self.connections[key]
                            logger.info(f"清理不活跃的 SSE 连接: {key}")
                    
                    if inactive_keys:
                        logger.info(f"清理了 {len(inactive_keys)} 个不活跃的 SSE 连接")
                        
                except Exception as e:
                    logger.error(f"清理 SSE 连接时出错: {str(e)}")
        
        # 启动守护线程
        cleanup_thread = threading.Thread(target=cleanup_inactive_connections, daemon=True)
        cleanup_thread.start()
        logger.info("SSE 连接清理线程已启动")
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """
        获取连接统计信息
        
        Returns:
            Dict: 统计信息
        """
        with self.lock:
            active_connections = sum(1 for conn in self.connections.values() if conn.is_active)
            
            return {
                'total_connections': len(self.connections),
                'active_connections': active_connections,
                'inactive_connections': len(self.connections) - active_connections,
                'timestamp': datetime.utcnow().isoformat()
            }


# 创建全局服务实例
network_sse_service = NetworkSSEService()
