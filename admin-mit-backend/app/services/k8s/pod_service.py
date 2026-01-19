"""
K8S Pod Service
Handles Pod operations including listing, details, logs, containers, and shell exec
"""
import logging
import re
import threading
import queue
import time
from typing import List, Dict, Optional, Tuple, Callable
from datetime import datetime
from flask import g
from kubernetes import client
from kubernetes.client.rest import ApiException
from kubernetes.stream import stream
from kubernetes.stream.ws_client import WSClient

from app.models.k8s_cluster import K8sCluster
from .client_service import K8sClientService

logger = logging.getLogger(__name__)


class PodService:
    """
    Pod管理服务
    处理Pod列表、详情、日志、容器等操作
    """
    
    def __init__(self):
        self.client_service = K8sClientService()
    
    def list_pods(self, cluster_id: int, namespace: str, 
                  label_selector: Optional[str] = None) -> List[Dict]:
        """
        获取Pod列表，支持标签选择器过滤
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            label_selector: 标签选择器 (可选，格式: "app=nginx,version=v1")
        
        Returns:
            List[Dict]: Pod列表
        
        Raises:
            ValueError: 验证失败
            Exception: 获取失败
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            core_v1 = client.CoreV1Api(api_client)
            
            # 获取Pod列表
            if label_selector:
                pods = core_v1.list_namespaced_pod(
                    namespace=namespace,
                    label_selector=label_selector
                )
            else:
                pods = core_v1.list_namespaced_pod(namespace=namespace)
            
            result = []
            for pod in pods.items:
                pod_data = self._format_pod_basic(pod)
                result.append(pod_data)
            
            logger.info(f"Listed {len(result)} pods in namespace '{namespace}' for cluster {cluster_id}")
            return result
            
        except ApiException as e:
            logger.error(f"K8S API error listing pods: {e}")
            raise Exception(f"获取Pod列表失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to list pods: {e}")
            raise Exception(f"获取Pod列表失败: {str(e)}")
    
    def get_pod_detail(self, cluster_id: int, namespace: str, 
                       pod_name: str) -> Dict:
        """
        获取Pod详细信息，包括容器、标签、注解、事件
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            pod_name: Pod名称
        
        Returns:
            Dict: Pod详细信息
        
        Raises:
            ValueError: 验证失败或Pod不存在
            Exception: 获取失败
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            core_v1 = client.CoreV1Api(api_client)
            
            # 获取Pod详情
            pod = core_v1.read_namespaced_pod(name=pod_name, namespace=namespace)
            
            # 获取Pod事件
            events = self._get_pod_events(core_v1, namespace, pod_name)
            
            # 构建详细信息
            pod_detail = {
                'name': pod.metadata.name,
                'namespace': pod.metadata.namespace,
                'uid': pod.metadata.uid,
                'status': self._get_pod_status(pod),
                'phase': pod.status.phase,
                'ip': pod.status.pod_ip or '',
                'host_ip': pod.status.host_ip or '',
                'node_name': pod.spec.node_name or '',
                'restart_count': self._get_total_restart_count(pod),
                'created_at': pod.metadata.creation_timestamp.isoformat() if pod.metadata.creation_timestamp else None,
                'labels': pod.metadata.labels or {},
                'annotations': pod.metadata.annotations or {},
                'containers': self._format_containers(pod),
                'conditions': self._format_conditions(pod),
                'events': events,
                'owner_references': self._format_owner_references(pod),
                'qos_class': pod.status.qos_class or '',
                'service_account': pod.spec.service_account_name or '',
            }
            
            logger.info(f"Retrieved pod detail for '{pod_name}' in namespace '{namespace}'")
            return pod_detail
            
        except ApiException as e:
            logger.error(f"K8S API error getting pod detail: {e}")
            if e.status == 404:
                raise ValueError(f"Pod '{pod_name}' 不存在于命名空间 '{namespace}'")
            raise Exception(f"获取Pod详情失败: {e.status} - {e.reason}")
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to get pod detail: {e}")
            raise Exception(f"获取Pod详情失败: {str(e)}")
    
    def get_pod_containers(self, cluster_id: int, namespace: str, 
                           pod_name: str) -> List[Dict]:
        """
        获取Pod的容器列表
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            pod_name: Pod名称
        
        Returns:
            List[Dict]: 容器列表
        
        Raises:
            ValueError: 验证失败或Pod不存在
            Exception: 获取失败
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            core_v1 = client.CoreV1Api(api_client)
            
            # 获取Pod
            pod = core_v1.read_namespaced_pod(name=pod_name, namespace=namespace)
            
            # 获取容器列表
            containers = self._format_containers(pod)
            
            logger.info(f"Retrieved {len(containers)} containers for pod '{pod_name}'")
            return containers
            
        except ApiException as e:
            logger.error(f"K8S API error getting pod containers: {e}")
            if e.status == 404:
                raise ValueError(f"Pod '{pod_name}' 不存在于命名空间 '{namespace}'")
            raise Exception(f"获取Pod容器列表失败: {e.status} - {e.reason}")
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to get pod containers: {e}")
            raise Exception(f"获取Pod容器列表失败: {str(e)}")

    def get_pod_logs(self, cluster_id: int, namespace: str, pod_name: str,
                     container: Optional[str] = None, tail_lines: int = 100,
                     timestamps: bool = True, search: Optional[str] = None) -> Dict:
        """
        获取Pod日志，支持容器选择、行数限制、搜索
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            pod_name: Pod名称
            container: 容器名称（可选，如果Pod有多个容器则必需）
            tail_lines: 返回最后N行日志（默认100，最大10000）
            timestamps: 是否包含时间戳（默认True）
            search: 搜索关键词（可选）
        
        Returns:
            Dict: 包含日志内容和元数据
        
        Raises:
            ValueError: 验证失败
            Exception: 获取失败
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        # 验证tail_lines
        if not isinstance(tail_lines, int) or tail_lines < 1:
            raise ValueError(f"tail_lines必须是正整数，当前值: {tail_lines}")
        
        if tail_lines > 10000:
            raise ValueError(f"tail_lines不能超过10000，当前值: {tail_lines}")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            core_v1 = client.CoreV1Api(api_client)
            
            # 获取Pod日志
            logs = core_v1.read_namespaced_pod_log(
                name=pod_name,
                namespace=namespace,
                container=container,
                tail_lines=tail_lines,
                timestamps=timestamps
            )
            
            # 如果有搜索关键词，过滤日志
            filtered_logs = logs
            matched_lines = []
            if search and logs:
                lines = logs.split('\n')
                matched_lines = [
                    {'line_number': i + 1, 'content': line}
                    for i, line in enumerate(lines)
                    if search.lower() in line.lower()
                ]
                # 返回匹配的行
                filtered_logs = '\n'.join([m['content'] for m in matched_lines])
            
            result = {
                'pod_name': pod_name,
                'namespace': namespace,
                'container': container,
                'logs': filtered_logs,
                'total_lines': len(logs.split('\n')) if logs else 0,
                'search': search,
                'matched_count': len(matched_lines) if search else None,
                'matched_lines': matched_lines if search else None
            }
            
            logger.info(f"Retrieved logs for pod '{pod_name}' in namespace '{namespace}'")
            return result
            
        except ApiException as e:
            logger.error(f"K8S API error getting pod logs: {e}")
            if e.status == 404:
                raise ValueError(f"Pod '{pod_name}' 不存在于命名空间 '{namespace}'")
            elif e.status == 400:
                # 检查是否是容器相关错误
                error_body = str(e.body) if e.body else ''
                if 'container' in error_body.lower():
                    raise ValueError(f"Pod有多个容器，请指定container参数")
                raise ValueError(f"请求参数错误: {e.reason}")
            raise Exception(f"获取Pod日志失败: {e.status} - {e.reason}")
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to get pod logs: {e}")
            raise Exception(f"获取Pod日志失败: {str(e)}")
    
    def _format_pod_basic(self, pod) -> Dict:
        """
        格式化Pod基本信息
        
        Args:
            pod: K8S Pod对象
        
        Returns:
            Dict: Pod基本信息
        """
        return {
            'name': pod.metadata.name,
            'namespace': pod.metadata.namespace,
            'uid': pod.metadata.uid,
            'status': self._get_pod_status(pod),
            'phase': pod.status.phase,
            'ip': pod.status.pod_ip or '',
            'node_name': pod.spec.node_name or '',
            'restart_count': self._get_total_restart_count(pod),
            'created_at': pod.metadata.creation_timestamp.isoformat() if pod.metadata.creation_timestamp else None,
            'labels': pod.metadata.labels or {},
            'containers': [
                {
                    'name': c.name,
                    'image': c.image,
                    'ready': self._is_container_ready(pod, c.name)
                }
                for c in (pod.spec.containers or [])
            ]
        }
    
    def _get_pod_status(self, pod) -> str:
        """
        获取Pod状态
        
        Args:
            pod: K8S Pod对象
        
        Returns:
            str: Pod状态
        """
        if pod.metadata.deletion_timestamp:
            return 'Terminating'
        
        if pod.status.phase == 'Pending':
            # 检查是否有等待的容器
            if pod.status.container_statuses:
                for cs in pod.status.container_statuses:
                    if cs.state.waiting:
                        return cs.state.waiting.reason or 'Pending'
            return 'Pending'
        
        if pod.status.phase == 'Running':
            # 检查所有容器是否就绪
            if pod.status.container_statuses:
                all_ready = all(cs.ready for cs in pod.status.container_statuses)
                if not all_ready:
                    # 检查是否有容器在等待或终止
                    for cs in pod.status.container_statuses:
                        if cs.state.waiting:
                            return cs.state.waiting.reason or 'NotReady'
                        if cs.state.terminated:
                            return cs.state.terminated.reason or 'Terminated'
                    return 'NotReady'
            return 'Running'
        
        if pod.status.phase == 'Succeeded':
            return 'Completed'
        
        if pod.status.phase == 'Failed':
            # 检查失败原因
            if pod.status.container_statuses:
                for cs in pod.status.container_statuses:
                    if cs.state.terminated and cs.state.terminated.reason:
                        return cs.state.terminated.reason
            return 'Failed'
        
        return pod.status.phase or 'Unknown'
    
    def _get_total_restart_count(self, pod) -> int:
        """
        获取Pod总重启次数
        
        Args:
            pod: K8S Pod对象
        
        Returns:
            int: 总重启次数
        """
        total = 0
        if pod.status.container_statuses:
            for cs in pod.status.container_statuses:
                total += cs.restart_count or 0
        return total
    
    def _is_container_ready(self, pod, container_name: str) -> bool:
        """
        检查容器是否就绪
        
        Args:
            pod: K8S Pod对象
            container_name: 容器名称
        
        Returns:
            bool: 是否就绪
        """
        if pod.status.container_statuses:
            for cs in pod.status.container_statuses:
                if cs.name == container_name:
                    return cs.ready or False
        return False

    def _format_containers(self, pod) -> List[Dict]:
        """
        格式化容器列表
        
        Args:
            pod: K8S Pod对象
        
        Returns:
            List[Dict]: 容器列表
        """
        containers = []
        
        # 获取容器状态映射
        status_map = {}
        if pod.status.container_statuses:
            for cs in pod.status.container_statuses:
                status_map[cs.name] = cs
        
        # 格式化每个容器
        for c in (pod.spec.containers or []):
            cs = status_map.get(c.name)
            
            container_data = {
                'name': c.name,
                'image': c.image,
                'ready': cs.ready if cs else False,
                'restart_count': cs.restart_count if cs else 0,
                'state': self._get_container_state(cs) if cs else 'unknown',
                'state_reason': self._get_container_state_reason(cs) if cs else None,
                'resources': {
                    'requests': {},
                    'limits': {}
                }
            }
            
            # 获取资源配置
            if c.resources:
                if c.resources.requests:
                    container_data['resources']['requests'] = {
                        'cpu': c.resources.requests.get('cpu', ''),
                        'memory': c.resources.requests.get('memory', '')
                    }
                if c.resources.limits:
                    container_data['resources']['limits'] = {
                        'cpu': c.resources.limits.get('cpu', ''),
                        'memory': c.resources.limits.get('memory', '')
                    }
            
            # 获取端口配置
            if c.ports:
                container_data['ports'] = [
                    {
                        'name': p.name or '',
                        'container_port': p.container_port,
                        'protocol': p.protocol or 'TCP'
                    }
                    for p in c.ports
                ]
            
            containers.append(container_data)
        
        return containers
    
    def _get_container_state(self, container_status) -> str:
        """
        获取容器状态
        
        Args:
            container_status: 容器状态对象
        
        Returns:
            str: 容器状态
        """
        if not container_status or not container_status.state:
            return 'unknown'
        
        state = container_status.state
        if state.running:
            return 'running'
        elif state.waiting:
            return 'waiting'
        elif state.terminated:
            return 'terminated'
        
        return 'unknown'
    
    def _get_container_state_reason(self, container_status) -> Optional[str]:
        """
        获取容器状态原因
        
        Args:
            container_status: 容器状态对象
        
        Returns:
            Optional[str]: 状态原因
        """
        if not container_status or not container_status.state:
            return None
        
        state = container_status.state
        if state.waiting and state.waiting.reason:
            return state.waiting.reason
        elif state.terminated and state.terminated.reason:
            return state.terminated.reason
        
        return None
    
    def _format_conditions(self, pod) -> List[Dict]:
        """
        格式化Pod条件列表
        
        Args:
            pod: K8S Pod对象
        
        Returns:
            List[Dict]: 条件列表
        """
        conditions = []
        
        if pod.status.conditions:
            for cond in pod.status.conditions:
                conditions.append({
                    'type': cond.type,
                    'status': cond.status,
                    'reason': cond.reason or '',
                    'message': cond.message or '',
                    'last_transition_time': cond.last_transition_time.isoformat() if cond.last_transition_time else None
                })
        
        return conditions
    
    def _format_owner_references(self, pod) -> List[Dict]:
        """
        格式化所有者引用列表
        
        Args:
            pod: K8S Pod对象
        
        Returns:
            List[Dict]: 所有者引用列表
        """
        owner_refs = []
        
        if pod.metadata.owner_references:
            for ref in pod.metadata.owner_references:
                owner_refs.append({
                    'kind': ref.kind,
                    'name': ref.name,
                    'uid': ref.uid,
                    'controller': ref.controller or False
                })
        
        return owner_refs
    
    def delete_pod(self, cluster_id: int, namespace: str, pod_name: str,
                   grace_period_seconds: Optional[int] = None) -> Dict:
        """
        删除Pod
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            pod_name: Pod名称
            grace_period_seconds: 优雅终止等待时间（秒），默认使用Pod配置的值
        
        Returns:
            Dict: 删除结果
        
        Raises:
            ValueError: 验证失败或Pod不存在
            Exception: 删除失败
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            core_v1 = client.CoreV1Api(api_client)
            
            # 构建删除选项
            delete_options = client.V1DeleteOptions()
            if grace_period_seconds is not None:
                delete_options.grace_period_seconds = grace_period_seconds
            
            # 删除Pod
            core_v1.delete_namespaced_pod(
                name=pod_name,
                namespace=namespace,
                body=delete_options
            )
            
            logger.info(f"Deleted pod '{pod_name}' in namespace '{namespace}' for cluster {cluster_id}")
            
            return {
                'success': True,
                'message': f"Pod '{pod_name}' 删除成功",
                'pod_name': pod_name,
                'namespace': namespace
            }
            
        except ApiException as e:
            logger.error(f"K8S API error deleting pod: {e}")
            if e.status == 404:
                raise ValueError(f"Pod '{pod_name}' 不存在于命名空间 '{namespace}'")
            elif e.status == 403:
                raise ValueError(f"没有权限删除Pod '{pod_name}'")
            raise Exception(f"删除Pod失败: {e.status} - {e.reason}")
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to delete pod: {e}")
            raise Exception(f"删除Pod失败: {str(e)}")

    def _get_pod_events(self, core_v1, namespace: str, pod_name: str) -> List[Dict]:
        """
        获取Pod相关事件
        
        Args:
            core_v1: CoreV1Api实例
            namespace: 命名空间
            pod_name: Pod名称
        
        Returns:
            List[Dict]: 事件列表
        """
        events = []
        
        try:
            # 获取命名空间中的事件，过滤与Pod相关的
            field_selector = f"involvedObject.name={pod_name},involvedObject.kind=Pod"
            event_list = core_v1.list_namespaced_event(
                namespace=namespace,
                field_selector=field_selector
            )
            
            for event in event_list.items:
                events.append({
                    'type': event.type,
                    'reason': event.reason,
                    'message': event.message,
                    'count': event.count or 1,
                    'first_timestamp': event.first_timestamp.isoformat() if event.first_timestamp else None,
                    'last_timestamp': event.last_timestamp.isoformat() if event.last_timestamp else None,
                    'source': event.source.component if event.source else ''
                })
            
            # 按最后时间戳排序（最新的在前）
            events.sort(key=lambda x: x['last_timestamp'] or '', reverse=True)
            
        except Exception as e:
            logger.warning(f"Failed to get events for pod '{pod_name}': {e}")
        
        return events


class K8sPodShellBridge:
    """
    K8S Pod Shell 桥接
    负责在 K8S Pod exec 和 WebSocket 之间进行数据转发
    """
    
    def __init__(
        self,
        session_id: str,
        ws_client: WSClient,
        cluster_id: int,
        namespace: str,
        pod_name: str,
        container: str,
        user_id: int,
        tenant_id: int,
        socket_sid: str = None
    ):
        self.session_id = session_id
        self.ws_client = ws_client
        self.cluster_id = cluster_id
        self.namespace = namespace
        self.pod_name = pod_name
        self.container = container
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.socket_sid = socket_sid
        
        # 状态
        self.is_active = False
        self.created_at = datetime.utcnow()
        self.last_activity = datetime.utcnow()
        
        # 线程控制
        self._stop_event = threading.Event()
        self._read_thread: Optional[threading.Thread] = None
        
        # 回调函数
        self._on_data_callback: Optional[Callable[[str], None]] = None
        self._on_close_callback: Optional[Callable[[str], None]] = None
        
        # 空闲超时（秒）
        self.idle_timeout = 1800
        
        logger.info(f"K8S Pod Shell Bridge created: {session_id}")
    
    def start(self) -> bool:
        """启动桥接"""
        if self.is_active:
            return True
        
        try:
            self.is_active = True
            self._stop_event.clear()
            
            # 启动读取线程（K8S -> WebSocket）
            self._read_thread = threading.Thread(
                target=self._read_loop,
                name=f"k8s-pod-read-{self.session_id[:8]}",
                daemon=True
            )
            self._read_thread.start()
            
            logger.info(f"K8S Pod Shell Bridge started: {self.session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start K8S Pod Shell Bridge: {e}")
            import traceback
            traceback.print_exc()
            self.is_active = False
            return False
    
    def stop(self, reason: str = "Bridge stopped"):
        """停止桥接"""
        if not self.is_active:
            return
        
        logger.info(f"Stopping K8S Pod Shell Bridge: {self.session_id}, reason: {reason}")
        
        self.is_active = False
        self._stop_event.set()
        
        # 等待线程结束
        if self._read_thread and self._read_thread.is_alive():
            self._read_thread.join(timeout=2)
        
        # 关闭 WebSocket 连接
        try:
            if self.ws_client:
                self.ws_client.close()
        except Exception as e:
            logger.warning(f"Error closing K8S WebSocket: {e}")
        
        # 触发关闭回调
        if self._on_close_callback:
            try:
                self._on_close_callback(reason)
            except Exception as e:
                logger.error(f"Error in close callback: {e}")
        
        logger.info(f"K8S Pod Shell Bridge stopped: {self.session_id}")
    
    def send_input(self, data: str) -> Tuple[bool, str]:
        """
        发送输入数据到 K8S Pod
        
        Args:
            data: 输入数据
            
        Returns:
            (success, error_message)
        """
        if not self.is_active:
            return False, "Bridge is not active"
        
        try:
            if not self.ws_client or not self.ws_client.is_open():
                return False, "WebSocket connection is closed"
            
            # 发送数据到 K8S Pod (stdin channel = 0)
            self.ws_client.write_stdin(data)
            self.last_activity = datetime.utcnow()
            return True, ""
            
        except Exception as e:
            logger.error(f"Error sending input to K8S Pod: {e}")
            return False, str(e)
    
    def resize(self, cols: int, rows: int) -> bool:
        """调整终端大小"""
        if not self.is_active or not self.ws_client:
            return False
        
        try:
            # K8S exec resize 需要发送特殊的 resize 消息
            # 格式: {"Width": cols, "Height": rows}
            import json
            resize_msg = json.dumps({"Width": cols, "Height": rows})
            # 发送到 resize channel (channel 4)
            self.ws_client.write_channel(4, resize_msg)
            self.last_activity = datetime.utcnow()
            logger.debug(f"Terminal resized: {self.session_id} -> {cols}x{rows}")
            return True
        except Exception as e:
            logger.error(f"Error resizing terminal: {e}")
            return False
    
    def set_on_data_callback(self, callback: Callable[[str], None]):
        """设置数据回调"""
        self._on_data_callback = callback
    
    def set_on_close_callback(self, callback: Callable[[str], None]):
        """设置关闭回调"""
        self._on_close_callback = callback
    
    def _read_loop(self):
        """读取循环：从 K8S Pod 读取数据并发送到 WebSocket"""
        logger.info(f"Read loop started for K8S Pod Shell session: {self.session_id}")
        
        while not self._stop_event.is_set() and self.is_active:
            try:
                if not self.ws_client or not self.ws_client.is_open():
                    logger.info(f"K8S WebSocket closed: {self.session_id}")
                    self.stop("K8S WebSocket connection closed")
                    break
                
                # 读取数据（带超时）
                self.ws_client.update(timeout=0.1)
                
                # 读取 stdout
                if self.ws_client.peek_stdout():
                    data = self.ws_client.read_stdout()
                    if data:
                        self._send_output(data)
                
                # 读取 stderr
                if self.ws_client.peek_stderr():
                    data = self.ws_client.read_stderr()
                    if data:
                        self._send_output(data)
                
            except Exception as e:
                if self.is_active:
                    error_str = str(e)
                    # 忽略超时错误
                    if 'timed out' not in error_str.lower():
                        logger.error(f"Error in K8S Pod Shell read loop: {e}")
                        self.stop(f"Read error: {e}")
                break
        
        logger.info(f"Read loop ended for K8S Pod Shell session: {self.session_id}")
    
    def _send_output(self, data: str):
        """发送输出到 WebSocket"""
        if not data:
            return
        
        self.last_activity = datetime.utcnow()
        
        # 触发数据回调
        if self._on_data_callback:
            try:
                self._on_data_callback(data)
            except Exception as e:
                logger.error(f"Error in data callback: {e}")
    
    def is_idle_timeout(self) -> bool:
        """检查是否空闲超时"""
        if not self.last_activity:
            return True
        
        elapsed = (datetime.utcnow() - self.last_activity).total_seconds()
        return elapsed > self.idle_timeout


class K8sPodShellManager:
    """K8S Pod Shell 管理器"""
    
    def __init__(self):
        self.bridges: Dict[str, K8sPodShellBridge] = {}
        self._lock = threading.Lock()
        self._cleanup_thread: Optional[threading.Thread] = None
        self._start_cleanup_thread()
        
        logger.info("K8S Pod Shell Manager initialized")
    
    def _start_cleanup_thread(self):
        """启动清理线程"""
        if self._cleanup_thread is None or not self._cleanup_thread.is_alive():
            self._cleanup_thread = threading.Thread(
                target=self._cleanup_loop,
                name="k8s-pod-shell-cleanup",
                daemon=True
            )
            self._cleanup_thread.start()
    
    def _cleanup_loop(self):
        """清理循环"""
        while True:
            try:
                time.sleep(60)  # 每分钟检查一次
                
                with self._lock:
                    bridges_to_remove = []
                    
                    for session_id, bridge in self.bridges.items():
                        # 检查空闲超时
                        if bridge.is_idle_timeout():
                            bridges_to_remove.append(session_id)
                            logger.info(f"K8S Pod Shell bridge idle timeout: {session_id}")
                        # 检查是否已停止
                        elif not bridge.is_active:
                            bridges_to_remove.append(session_id)
                    
                    for session_id in bridges_to_remove:
                        bridge = self.bridges.pop(session_id, None)
                        if bridge and bridge.is_active:
                            bridge.stop("Idle timeout")
                    
                    if bridges_to_remove:
                        logger.info(f"Cleaned up {len(bridges_to_remove)} K8S Pod Shell bridges")
                        
            except Exception as e:
                logger.error(f"Error in K8S Pod Shell cleanup loop: {e}")
    
    def create_bridge(
        self,
        session_id: str,
        cluster_id: int,
        namespace: str,
        pod_name: str,
        container: str,
        user_id: int,
        tenant_id: int,
        cols: int = 80,
        rows: int = 24,
        socket_sid: str = None
    ) -> Tuple[bool, str, Optional[K8sPodShellBridge]]:
        """
        创建 Pod Shell 桥接
        
        Returns:
            (success, message, bridge)
        """
        try:
            with self._lock:
                # 检查是否已存在
                if session_id in self.bridges:
                    return False, "Bridge already exists", None
            
            # 获取集群信息
            cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
            if not cluster:
                return False, f"集群 {cluster_id} 不存在", None
            
            # 获取 K8S API 客户端
            client_service = K8sClientService()
            api_client = client_service.get_client(cluster)
            core_v1 = client.CoreV1Api(api_client)
            
            # 验证 Pod 存在
            try:
                pod = core_v1.read_namespaced_pod(name=pod_name, namespace=namespace)
            except ApiException as e:
                if e.status == 404:
                    return False, f"Pod '{pod_name}' 不存在于命名空间 '{namespace}'", None
                raise
            
            # 验证容器存在
            container_names = [c.name for c in pod.spec.containers]
            if container and container not in container_names:
                return False, f"容器 '{container}' 不存在于 Pod '{pod_name}'", None
            
            # 如果没有指定容器，使用第一个容器
            if not container:
                container = container_names[0]
            
            # 检查 Pod 状态
            if pod.status.phase != 'Running':
                return False, f"Pod '{pod_name}' 状态为 {pod.status.phase}，无法连接终端", None
            
            # 创建 exec 连接
            try:
                exec_command = ['/bin/sh', '-c', 
                    f'TERM=xterm-256color; export TERM; stty cols {cols} rows {rows}; exec /bin/sh -i']
                
                ws_client = stream(
                    core_v1.connect_get_namespaced_pod_exec,
                    pod_name,
                    namespace,
                    container=container,
                    command=exec_command,
                    stderr=True,
                    stdin=True,
                    stdout=True,
                    tty=True,
                    _preload_content=False
                )
            except ApiException as e:
                return False, f"无法连接到 Pod 终端: {e.reason}", None
            except Exception as e:
                return False, f"创建 exec 连接失败: {str(e)}", None
            
            # 创建桥接
            bridge = K8sPodShellBridge(
                session_id=session_id,
                ws_client=ws_client,
                cluster_id=cluster_id,
                namespace=namespace,
                pod_name=pod_name,
                container=container,
                user_id=user_id,
                tenant_id=tenant_id,
                socket_sid=socket_sid
            )
            
            # 启动桥接
            if not bridge.start():
                bridge.stop("Failed to start")
                return False, "启动桥接失败", None
            
            # 添加到管理器
            with self._lock:
                self.bridges[session_id] = bridge
            
            logger.info(f"K8S Pod Shell bridge created: {session_id}, pod: {pod_name}, container: {container}")
            return True, "连接成功", bridge
            
        except Exception as e:
            logger.error(f"Error creating K8S Pod Shell bridge: {e}")
            import traceback
            traceback.print_exc()
            return False, f"创建连接失败: {str(e)}", None
    
    def get_bridge(self, session_id: str) -> Optional[K8sPodShellBridge]:
        """获取桥接"""
        with self._lock:
            return self.bridges.get(session_id)
    
    def remove_bridge(self, session_id: str, reason: str = "Removed") -> bool:
        """移除桥接"""
        with self._lock:
            bridge = self.bridges.pop(session_id, None)
        
        if bridge:
            bridge.stop(reason)
            return True
        return False
    
    def send_input(self, session_id: str, data: str) -> Tuple[bool, str]:
        """发送输入"""
        bridge = self.get_bridge(session_id)
        if not bridge:
            return False, "Bridge not found"
        return bridge.send_input(data)
    
    def resize(self, session_id: str, cols: int, rows: int) -> bool:
        """调整终端大小"""
        bridge = self.get_bridge(session_id)
        if not bridge:
            return False
        return bridge.resize(cols, rows)
    
    def get_stats(self) -> Dict:
        """获取统计信息"""
        with self._lock:
            active_count = sum(1 for b in self.bridges.values() if b.is_active)
            return {
                'total_bridges': len(self.bridges),
                'active_bridges': active_count,
                'session_ids': list(self.bridges.keys())
            }
    
    def close_all(self):
        """关闭所有桥接"""
        with self._lock:
            for bridge in self.bridges.values():
                bridge.stop("Manager shutdown")
            self.bridges.clear()
        
        logger.info("All K8S Pod Shell bridges closed")


# 全局 Pod Shell 管理器实例
k8s_pod_shell_manager = K8sPodShellManager()


# 创建全局服务实例
pod_service = PodService()
