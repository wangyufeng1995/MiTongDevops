"""
K8S Workload Service
Handles workload operations including Deployments, StatefulSets, DaemonSets
"""
import logging
from typing import List, Dict, Optional
from datetime import datetime
from flask import g
from kubernetes import client
from kubernetes.client.rest import ApiException

from app.extensions import db
from app.models.k8s_cluster import K8sCluster
from app.models.k8s_operation import K8sOperation
from .client_service import K8sClientService

logger = logging.getLogger(__name__)


class WorkloadService:
    """
    工作负载管理服务
    处理Deployment、StatefulSet、DaemonSet等工作负载的操作
    """
    
    def __init__(self):
        self.client_service = K8sClientService()
    
    def list_deployments(self, cluster_id: int, namespace: str) -> List[Dict]:
        """
        获取Deployment列表
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
        
        Returns:
            List[Dict]: Deployment列表
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            apps_v1 = client.AppsV1Api(api_client)
            
            deployments = apps_v1.list_namespaced_deployment(namespace=namespace)
            
            result = []
            for deploy in deployments.items:
                # 计算状态
                replicas = deploy.spec.replicas or 0
                available_replicas = deploy.status.available_replicas or 0
                ready_replicas = deploy.status.ready_replicas or 0
                status = self._calculate_workload_status(replicas, available_replicas, ready_replicas)
                
                deployment_data = {
                    'name': deploy.metadata.name,
                    'namespace': deploy.metadata.namespace,
                    'replicas': replicas,
                    'available_replicas': available_replicas,
                    'ready_replicas': ready_replicas,
                    'updated_replicas': deploy.status.updated_replicas or 0,
                    'unavailable_replicas': deploy.status.unavailable_replicas or 0,
                    'status': status,
                    'image': self._get_container_images(deploy.spec.template.spec.containers),
                    'images': self._get_container_images_list(deploy.spec.template.spec.containers),
                    'created_at': deploy.metadata.creation_timestamp.isoformat() if deploy.metadata.creation_timestamp else None,
                    'labels': deploy.metadata.labels or {},
                    'selector': deploy.spec.selector.match_labels or {},
                    'strategy': deploy.spec.strategy.type if deploy.spec.strategy else 'RollingUpdate',
                    'uid': deploy.metadata.uid
                }
                result.append(deployment_data)
            
            logger.info(f"Listed {len(result)} deployments in namespace '{namespace}' for cluster {cluster_id}")
            return result
            
        except ApiException as e:
            logger.error(f"K8S API error listing deployments: {e}")
            raise Exception(f"获取Deployment列表失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to list deployments: {e}")
            raise Exception(f"获取Deployment列表失败: {str(e)}")
    
    def list_statefulsets(self, cluster_id: int, namespace: str) -> List[Dict]:
        """
        获取StatefulSet列表
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
        
        Returns:
            List[Dict]: StatefulSet列表
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            apps_v1 = client.AppsV1Api(api_client)
            
            statefulsets = apps_v1.list_namespaced_stateful_set(namespace=namespace)
            
            result = []
            for sts in statefulsets.items:
                # 计算状态
                replicas = sts.spec.replicas or 0
                ready_replicas = sts.status.ready_replicas or 0
                current_replicas = sts.status.current_replicas or 0
                status = self._calculate_workload_status(replicas, current_replicas, ready_replicas)
                
                statefulset_data = {
                    'name': sts.metadata.name,
                    'namespace': sts.metadata.namespace,
                    'replicas': replicas,
                    'ready_replicas': ready_replicas,
                    'current_replicas': current_replicas,
                    'available_replicas': ready_replicas,  # StatefulSet使用ready_replicas作为available
                    'updated_replicas': sts.status.updated_replicas or 0,
                    'status': status,
                    'image': self._get_container_images(sts.spec.template.spec.containers),
                    'images': self._get_container_images_list(sts.spec.template.spec.containers),
                    'created_at': sts.metadata.creation_timestamp.isoformat() if sts.metadata.creation_timestamp else None,
                    'labels': sts.metadata.labels or {},
                    'selector': sts.spec.selector.match_labels or {},
                    'service_name': sts.spec.service_name,
                    'uid': sts.metadata.uid
                }
                result.append(statefulset_data)
            
            logger.info(f"Listed {len(result)} statefulsets in namespace '{namespace}' for cluster {cluster_id}")
            return result
            
        except ApiException as e:
            logger.error(f"K8S API error listing statefulsets: {e}")
            raise Exception(f"获取StatefulSet列表失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to list statefulsets: {e}")
            raise Exception(f"获取StatefulSet列表失败: {str(e)}")
    
    def list_daemonsets(self, cluster_id: int, namespace: str) -> List[Dict]:
        """
        获取DaemonSet列表
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
        
        Returns:
            List[Dict]: DaemonSet列表
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            apps_v1 = client.AppsV1Api(api_client)
            
            daemonsets = apps_v1.list_namespaced_daemon_set(namespace=namespace)
            
            result = []
            for ds in daemonsets.items:
                # 计算状态
                desired = ds.status.desired_number_scheduled or 0
                available = ds.status.number_available or 0
                ready = ds.status.number_ready or 0
                status = self._calculate_daemonset_status(desired, available, ready)
                
                daemonset_data = {
                    'name': ds.metadata.name,
                    'namespace': ds.metadata.namespace,
                    'desired_number_scheduled': desired,
                    'current_number_scheduled': ds.status.current_number_scheduled or 0,
                    'number_ready': ready,
                    'number_available': available,
                    'number_unavailable': ds.status.number_unavailable or 0,
                    'replicas': desired,  # DaemonSet使用desired作为replicas
                    'available_replicas': available,
                    'ready_replicas': ready,
                    'status': status,
                    'image': self._get_container_images(ds.spec.template.spec.containers),
                    'images': self._get_container_images_list(ds.spec.template.spec.containers),
                    'created_at': ds.metadata.creation_timestamp.isoformat() if ds.metadata.creation_timestamp else None,
                    'labels': ds.metadata.labels or {},
                    'selector': ds.spec.selector.match_labels or {},
                    'uid': ds.metadata.uid
                }
                result.append(daemonset_data)
            
            logger.info(f"Listed {len(result)} daemonsets in namespace '{namespace}' for cluster {cluster_id}")
            return result
            
        except ApiException as e:
            logger.error(f"K8S API error listing daemonsets: {e}")
            raise Exception(f"获取DaemonSet列表失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to list daemonsets: {e}")
            raise Exception(f"获取DaemonSet列表失败: {str(e)}")
    
    def get_workload_detail(self, cluster_id: int, namespace: str, workload_type: str, name: str) -> Dict:
        """
        获取工作负载详细信息，包括容器、条件、Pod列表等
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            workload_type: 工作负载类型 (deployment/statefulset/daemonset)
            name: 工作负载名称
        
        Returns:
            Dict: 工作负载详情
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            apps_v1 = client.AppsV1Api(api_client)
            core_v1 = client.CoreV1Api(api_client)
            
            workload_data = {}
            label_selector = None
            
            if workload_type == 'deployment':
                deploy = apps_v1.read_namespaced_deployment(name=name, namespace=namespace)
                replicas = deploy.spec.replicas or 0
                available_replicas = deploy.status.available_replicas or 0
                ready_replicas = deploy.status.ready_replicas or 0
                status = self._calculate_workload_status(replicas, available_replicas, ready_replicas)
                
                workload_data = {
                    'name': deploy.metadata.name,
                    'namespace': deploy.metadata.namespace,
                    'type': 'deployment',
                    'replicas': replicas,
                    'available_replicas': available_replicas,
                    'ready_replicas': ready_replicas,
                    'updated_replicas': deploy.status.updated_replicas or 0,
                    'status': status,
                    'images': self._get_container_images_list(deploy.spec.template.spec.containers),
                    'created_at': deploy.metadata.creation_timestamp.isoformat() if deploy.metadata.creation_timestamp else None,
                    'labels': deploy.metadata.labels or {},
                    'selector': deploy.spec.selector.match_labels or {},
                    'strategy': {
                        'type': deploy.spec.strategy.type if deploy.spec.strategy else 'RollingUpdate',
                        'rolling_update': {
                            'max_surge': str(deploy.spec.strategy.rolling_update.max_surge) if deploy.spec.strategy and deploy.spec.strategy.rolling_update else None,
                            'max_unavailable': str(deploy.spec.strategy.rolling_update.max_unavailable) if deploy.spec.strategy and deploy.spec.strategy.rolling_update else None,
                        } if deploy.spec.strategy and deploy.spec.strategy.rolling_update else None
                    },
                    'conditions': self._extract_conditions(deploy.status.conditions),
                    'containers': self._extract_container_specs(deploy.spec.template.spec.containers),
                    'uid': deploy.metadata.uid
                }
                label_selector = deploy.spec.selector.match_labels
                
            elif workload_type == 'statefulset':
                sts = apps_v1.read_namespaced_stateful_set(name=name, namespace=namespace)
                replicas = sts.spec.replicas or 0
                ready_replicas = sts.status.ready_replicas or 0
                current_replicas = sts.status.current_replicas or 0
                status = self._calculate_workload_status(replicas, current_replicas, ready_replicas)
                
                workload_data = {
                    'name': sts.metadata.name,
                    'namespace': sts.metadata.namespace,
                    'type': 'statefulset',
                    'replicas': replicas,
                    'ready_replicas': ready_replicas,
                    'current_replicas': current_replicas,
                    'available_replicas': ready_replicas,
                    'updated_replicas': sts.status.updated_replicas or 0,
                    'status': status,
                    'images': self._get_container_images_list(sts.spec.template.spec.containers),
                    'created_at': sts.metadata.creation_timestamp.isoformat() if sts.metadata.creation_timestamp else None,
                    'labels': sts.metadata.labels or {},
                    'selector': sts.spec.selector.match_labels or {},
                    'service_name': sts.spec.service_name,
                    'conditions': self._extract_conditions(sts.status.conditions) if sts.status.conditions else [],
                    'containers': self._extract_container_specs(sts.spec.template.spec.containers),
                    'volume_claim_templates': self._extract_volume_claim_templates(sts.spec.volume_claim_templates),
                    'uid': sts.metadata.uid
                }
                label_selector = sts.spec.selector.match_labels
                
            elif workload_type == 'daemonset':
                ds = apps_v1.read_namespaced_daemon_set(name=name, namespace=namespace)
                desired = ds.status.desired_number_scheduled or 0
                available = ds.status.number_available or 0
                ready = ds.status.number_ready or 0
                status = self._calculate_daemonset_status(desired, available, ready)
                
                workload_data = {
                    'name': ds.metadata.name,
                    'namespace': ds.metadata.namespace,
                    'type': 'daemonset',
                    'replicas': desired,
                    'available_replicas': available,
                    'ready_replicas': ready,
                    'status': status,
                    'images': self._get_container_images_list(ds.spec.template.spec.containers),
                    'created_at': ds.metadata.creation_timestamp.isoformat() if ds.metadata.creation_timestamp else None,
                    'labels': ds.metadata.labels or {},
                    'selector': ds.spec.selector.match_labels or {},
                    'conditions': self._extract_conditions(ds.status.conditions) if ds.status.conditions else [],
                    'containers': self._extract_container_specs(ds.spec.template.spec.containers),
                    'uid': ds.metadata.uid
                }
                label_selector = ds.spec.selector.match_labels
            else:
                raise ValueError(f"不支持的工作负载类型: {workload_type}")
            
            # 获取关联的Pod列表
            if label_selector:
                label_selector_str = ','.join([f"{k}={v}" for k, v in label_selector.items()])
                pods = core_v1.list_namespaced_pod(namespace=namespace, label_selector=label_selector_str)
                workload_data['pods'] = self._extract_pod_list(pods.items)
            else:
                workload_data['pods'] = []
            
            logger.info(f"Got detail for {workload_type} '{name}' in namespace '{namespace}'")
            return workload_data
            
        except ApiException as e:
            if e.status == 404:
                raise ValueError(f"{workload_type} '{name}' 不存在于命名空间 '{namespace}'")
            logger.error(f"K8S API error getting workload detail: {e}")
            raise Exception(f"获取工作负载详情失败: {e.status} - {e.reason}")
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to get workload detail: {e}")
            raise Exception(f"获取工作负载详情失败: {str(e)}")
    
    def _extract_conditions(self, conditions) -> List[Dict]:
        """提取条件信息"""
        if not conditions:
            return []
        return [
            {
                'type': c.type,
                'status': c.status,
                'reason': c.reason,
                'message': c.message,
                'last_transition_time': c.last_transition_time.isoformat() if c.last_transition_time else None
            }
            for c in conditions
        ]
    
    def _extract_container_specs(self, containers) -> List[Dict]:
        """提取容器规格信息"""
        if not containers:
            return []
        result = []
        for c in containers:
            container_data = {
                'name': c.name,
                'image': c.image,
                'ports': [
                    {
                        'name': p.name,
                        'container_port': p.container_port,
                        'protocol': p.protocol or 'TCP'
                    }
                    for p in (c.ports or [])
                ],
                'resources': {
                    'requests': {
                        'cpu': c.resources.requests.get('cpu') if c.resources and c.resources.requests else None,
                        'memory': c.resources.requests.get('memory') if c.resources and c.resources.requests else None,
                    } if c.resources and c.resources.requests else None,
                    'limits': {
                        'cpu': c.resources.limits.get('cpu') if c.resources and c.resources.limits else None,
                        'memory': c.resources.limits.get('memory') if c.resources and c.resources.limits else None,
                    } if c.resources and c.resources.limits else None,
                } if c.resources else None,
                'env': [
                    {
                        'name': e.name,
                        'value': e.value,
                        'value_from': {
                            'config_map_key_ref': {
                                'name': e.value_from.config_map_key_ref.name,
                                'key': e.value_from.config_map_key_ref.key
                            } if e.value_from and e.value_from.config_map_key_ref else None,
                            'secret_key_ref': {
                                'name': e.value_from.secret_key_ref.name,
                                'key': e.value_from.secret_key_ref.key
                            } if e.value_from and e.value_from.secret_key_ref else None,
                            'field_ref': {
                                'field_path': e.value_from.field_ref.field_path
                            } if e.value_from and e.value_from.field_ref else None,
                        } if e.value_from else None
                    }
                    for e in (c.env or [])
                ],
                'volume_mounts': [
                    {
                        'name': vm.name,
                        'mount_path': vm.mount_path,
                        'sub_path': vm.sub_path,
                        'read_only': vm.read_only or False
                    }
                    for vm in (c.volume_mounts or [])
                ]
            }
            result.append(container_data)
        return result
    
    def _extract_volume_claim_templates(self, templates) -> List[Dict]:
        """提取卷声明模板信息"""
        if not templates:
            return []
        return [
            {
                'name': t.metadata.name,
                'access_modes': t.spec.access_modes or [],
                'storage_class': t.spec.storage_class_name,
                'capacity': t.spec.resources.requests.get('storage') if t.spec.resources and t.spec.resources.requests else None,
                'status': 'Pending'  # 模板状态默认为Pending
            }
            for t in templates
        ]
    
    def _extract_pod_list(self, pods) -> List[Dict]:
        """提取Pod列表信息"""
        if not pods:
            return []
        result = []
        for pod in pods:
            # 计算Pod状态
            phase = pod.status.phase or 'Unknown'
            
            # 计算重启次数
            restart_count = 0
            if pod.status.container_statuses:
                restart_count = sum(cs.restart_count for cs in pod.status.container_statuses)
            
            # 提取容器信息
            containers = []
            if pod.spec.containers:
                for c in pod.spec.containers:
                    container_status = None
                    if pod.status.container_statuses:
                        for cs in pod.status.container_statuses:
                            if cs.name == c.name:
                                container_status = cs
                                break
                    
                    containers.append({
                        'name': c.name,
                        'image': c.image,
                        'ready': container_status.ready if container_status else False,
                        'restart_count': container_status.restart_count if container_status else 0,
                        'state': self._get_container_state(container_status) if container_status else 'unknown'
                    })
            
            pod_data = {
                'name': pod.metadata.name,
                'namespace': pod.metadata.namespace,
                'status': phase.lower(),
                'phase': phase,
                'ip': pod.status.pod_ip or '',
                'node_name': pod.spec.node_name or '',
                'restart_count': restart_count,
                'created_at': pod.metadata.creation_timestamp.isoformat() if pod.metadata.creation_timestamp else None,
                'containers': containers
            }
            result.append(pod_data)
        return result
    
    def _get_container_state(self, container_status) -> str:
        """获取容器状态"""
        if not container_status or not container_status.state:
            return 'unknown'
        if container_status.state.running:
            return 'running'
        elif container_status.state.waiting:
            return 'waiting'
        elif container_status.state.terminated:
            return 'terminated'
        return 'unknown'
    
    def scale_workload(self, cluster_id: int, namespace: str, workload_type: str, 
                      name: str, replicas: int) -> Dict:
        """
        扩缩容工作负载
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            workload_type: 工作负载类型 (deployment/statefulset)
            name: 工作负载名称
            replicas: 目标副本数
        
        Returns:
            Dict: 扩缩容结果
        
        Raises:
            ValueError: 验证失败
            Exception: 操作失败
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        # 验证副本数
        if not isinstance(replicas, int) or replicas < 0:
            raise ValueError(f"副本数必须是非负整数，当前值: {replicas}")
        
        if replicas > 1000:
            raise ValueError(f"副本数不能超过1000，当前值: {replicas}")
        
        # 验证工作负载类型
        if workload_type not in ['deployment', 'statefulset']:
            raise ValueError(f"不支持的工作负载类型: {workload_type}，仅支持 deployment 和 statefulset")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            apps_v1 = client.AppsV1Api(api_client)
            
            # 根据类型执行扩缩容
            if workload_type == 'deployment':
                # 读取当前Deployment
                deployment = apps_v1.read_namespaced_deployment(name=name, namespace=namespace)
                old_replicas = deployment.spec.replicas
                
                # 更新副本数
                deployment.spec.replicas = replicas
                apps_v1.patch_namespaced_deployment(name=name, namespace=namespace, body=deployment)
                
                resource_type = 'deployment'
                
            elif workload_type == 'statefulset':
                # 读取当前StatefulSet
                statefulset = apps_v1.read_namespaced_stateful_set(name=name, namespace=namespace)
                old_replicas = statefulset.spec.replicas
                
                # 更新副本数
                statefulset.spec.replicas = replicas
                apps_v1.patch_namespaced_stateful_set(name=name, namespace=namespace, body=statefulset)
                
                resource_type = 'statefulset'
            
            # 记录操作日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='scale',
                resource_type=resource_type,
                resource_name=name,
                namespace=namespace,
                status='success',
                operation_data={
                    'old_replicas': old_replicas,
                    'new_replicas': replicas
                }
            )
            
            logger.info(f"Scaled {workload_type} '{name}' from {old_replicas} to {replicas} replicas in namespace '{namespace}'")
            
            return {
                'name': name,
                'namespace': namespace,
                'type': workload_type,
                'old_replicas': old_replicas,
                'new_replicas': replicas,
                'message': f'成功将副本数从 {old_replicas} 调整为 {replicas}'
            }
            
        except ApiException as e:
            error_msg = f"K8S API错误: {e.status} - {e.reason}"
            logger.error(f"Failed to scale {workload_type} '{name}': {error_msg}")
            
            # 记录失败日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='scale',
                resource_type=workload_type,
                resource_name=name,
                namespace=namespace,
                status='failed',
                error_message=error_msg,
                operation_data={'target_replicas': replicas}
            )
            
            if e.status == 404:
                raise ValueError(f"{workload_type} '{name}' 不存在于命名空间 '{namespace}'")
            else:
                raise Exception(f"扩缩容失败: {error_msg}")
                
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to scale {workload_type} '{name}': {e}")
            
            # 记录失败日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='scale',
                resource_type=workload_type,
                resource_name=name,
                namespace=namespace,
                status='failed',
                error_message=str(e),
                operation_data={'target_replicas': replicas}
            )
            
            raise Exception(f"扩缩容失败: {str(e)}")
    
    def restart_workload(self, cluster_id: int, namespace: str, workload_type: str, name: str) -> Dict:
        """
        重启工作负载（通过更新Pod模板的注解触发滚动重启）
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            workload_type: 工作负载类型 (deployment/statefulset/daemonset)
            name: 工作负载名称
        
        Returns:
            Dict: 重启结果
        
        Raises:
            ValueError: 验证失败
            Exception: 操作失败
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        # 验证工作负载类型
        if workload_type not in ['deployment', 'statefulset', 'daemonset']:
            raise ValueError(f"不支持的工作负载类型: {workload_type}")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            apps_v1 = client.AppsV1Api(api_client)
            
            # 生成重启时间戳注解
            restart_annotation = {
                'kubectl.kubernetes.io/restartedAt': datetime.utcnow().isoformat()
            }
            
            # 根据类型执行重启
            if workload_type == 'deployment':
                deployment = apps_v1.read_namespaced_deployment(name=name, namespace=namespace)
                
                if not deployment.spec.template.metadata.annotations:
                    deployment.spec.template.metadata.annotations = {}
                deployment.spec.template.metadata.annotations.update(restart_annotation)
                
                apps_v1.patch_namespaced_deployment(name=name, namespace=namespace, body=deployment)
                
            elif workload_type == 'statefulset':
                statefulset = apps_v1.read_namespaced_stateful_set(name=name, namespace=namespace)
                
                if not statefulset.spec.template.metadata.annotations:
                    statefulset.spec.template.metadata.annotations = {}
                statefulset.spec.template.metadata.annotations.update(restart_annotation)
                
                apps_v1.patch_namespaced_stateful_set(name=name, namespace=namespace, body=statefulset)
                
            elif workload_type == 'daemonset':
                daemonset = apps_v1.read_namespaced_daemon_set(name=name, namespace=namespace)
                
                if not daemonset.spec.template.metadata.annotations:
                    daemonset.spec.template.metadata.annotations = {}
                daemonset.spec.template.metadata.annotations.update(restart_annotation)
                
                apps_v1.patch_namespaced_daemon_set(name=name, namespace=namespace, body=daemonset)
            
            # 记录操作日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='restart',
                resource_type=workload_type,
                resource_name=name,
                namespace=namespace,
                status='success'
            )
            
            logger.info(f"Restarted {workload_type} '{name}' in namespace '{namespace}'")
            
            return {
                'name': name,
                'namespace': namespace,
                'type': workload_type,
                'message': f'{workload_type} 重启成功，Pod将进行滚动更新'
            }
            
        except ApiException as e:
            error_msg = f"K8S API错误: {e.status} - {e.reason}"
            logger.error(f"Failed to restart {workload_type} '{name}': {error_msg}")
            
            # 记录失败日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='restart',
                resource_type=workload_type,
                resource_name=name,
                namespace=namespace,
                status='failed',
                error_message=error_msg
            )
            
            if e.status == 404:
                raise ValueError(f"{workload_type} '{name}' 不存在于命名空间 '{namespace}'")
            else:
                raise Exception(f"重启失败: {error_msg}")
                
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to restart {workload_type} '{name}': {e}")
            
            # 记录失败日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='restart',
                resource_type=workload_type,
                resource_name=name,
                namespace=namespace,
                status='failed',
                error_message=str(e)
            )
            
            raise Exception(f"重启失败: {str(e)}")
    
    def get_pod_logs(self, cluster_id: int, namespace: str, pod_name: str, 
                    container: Optional[str] = None, tail_lines: int = 100, 
                    follow: bool = False) -> str:
        """
        获取Pod日志
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            pod_name: Pod名称
            container: 容器名称（可选，如果Pod有多个容器则必需）
            tail_lines: 返回最后N行日志
            follow: 是否实时跟踪日志（流式）
        
        Returns:
            str: 日志内容
        
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
                follow=follow,
                timestamps=True
            )
            
            logger.info(f"Retrieved logs for pod '{pod_name}' in namespace '{namespace}'")
            return logs
            
        except ApiException as e:
            error_msg = f"K8S API错误: {e.status} - {e.reason}"
            logger.error(f"Failed to get pod logs for '{pod_name}': {error_msg}")
            
            if e.status == 404:
                raise ValueError(f"Pod '{pod_name}' 不存在于命名空间 '{namespace}'")
            elif e.status == 400 and 'container' in str(e.reason).lower():
                raise ValueError(f"Pod有多个容器，请指定container参数")
            else:
                raise Exception(f"获取Pod日志失败: {error_msg}")
                
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to get pod logs for '{pod_name}': {e}")
            raise Exception(f"获取Pod日志失败: {str(e)}")
    
    def _get_container_images(self, containers) -> str:
        """
        获取容器镜像列表（逗号分隔）
        
        Args:
            containers: 容器列表
        
        Returns:
            str: 镜像列表字符串
        """
        if not containers:
            return ''
        
        images = [container.image for container in containers if container.image]
        return ', '.join(images)
    
    def _get_container_images_list(self, containers) -> list:
        """
        获取容器镜像列表（数组形式）
        
        Args:
            containers: 容器列表
        
        Returns:
            list: 镜像列表
        """
        if not containers:
            return []
        
        return [container.image for container in containers if container.image]
    
    def _calculate_workload_status(self, replicas: int, available: int, ready: int) -> str:
        """
        计算工作负载状态
        
        Args:
            replicas: 期望副本数
            available: 可用副本数
            ready: 就绪副本数
        
        Returns:
            str: 状态 (running/pending/failed/unknown)
        """
        if replicas == 0:
            return 'stopped'
        
        if available == replicas and ready == replicas:
            return 'running'
        elif available > 0 or ready > 0:
            return 'pending'
        else:
            return 'failed'
    
    def _calculate_daemonset_status(self, desired: int, available: int, ready: int) -> str:
        """
        计算DaemonSet状态
        
        Args:
            desired: 期望调度数
            available: 可用数
            ready: 就绪数
        
        Returns:
            str: 状态 (running/pending/failed/unknown)
        """
        if desired == 0:
            return 'stopped'
        
        if available == desired and ready == desired:
            return 'running'
        elif available > 0 or ready > 0:
            return 'pending'
        else:
            return 'failed'
    
    def apply_yaml(self, cluster_id: int, namespace: str, yaml_content: str) -> Dict:
        """
        通过YAML创建或更新K8S资源
        
        Args:
            cluster_id: 集群ID
            namespace: 默认命名空间（如果YAML中未指定）
            yaml_content: YAML内容
        
        Returns:
            Dict: 操作结果
        
        Raises:
            ValueError: 验证失败
            Exception: 操作失败
        """
        import yaml as pyyaml
        from kubernetes.utils import create_from_yaml
        from kubernetes.client import ApiClient
        
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            # 解析YAML
            try:
                yaml_docs = list(pyyaml.safe_load_all(yaml_content))
            except pyyaml.YAMLError as e:
                raise ValueError(f"YAML格式错误: {str(e)}")
            
            if not yaml_docs or all(doc is None for doc in yaml_docs):
                raise ValueError("YAML内容为空或无效")
            
            # 过滤掉None文档
            yaml_docs = [doc for doc in yaml_docs if doc is not None]
            
            if not yaml_docs:
                raise ValueError("YAML内容为空或无效")
            
            # 获取K8S客户端
            api_client = self.client_service.get_client(cluster)
            
            results = []
            for doc in yaml_docs:
                if not isinstance(doc, dict):
                    continue
                
                kind = doc.get('kind')
                api_version = doc.get('apiVersion')
                metadata = doc.get('metadata', {})
                name = metadata.get('name')
                doc_namespace = metadata.get('namespace') or namespace
                
                if not kind:
                    raise ValueError("YAML缺少kind字段")
                if not api_version:
                    raise ValueError("YAML缺少apiVersion字段")
                if not name:
                    raise ValueError("YAML缺少metadata.name字段")
                
                # 设置命名空间
                if 'metadata' not in doc:
                    doc['metadata'] = {}
                if not doc['metadata'].get('namespace') and doc_namespace:
                    doc['metadata']['namespace'] = doc_namespace
                
                # 根据资源类型选择API
                result = self._apply_resource(api_client, doc, kind, api_version, name, doc_namespace)
                results.append(result)
            
            # 返回结果
            if len(results) == 1:
                return results[0]
            else:
                return {
                    'message': f'成功应用 {len(results)} 个资源',
                    'resources': results,
                    'kind': 'multiple',
                    'name': ', '.join([r.get('name', '') for r in results]),
                    'namespace': namespace
                }
            
        except ValueError:
            raise
        except ApiException as e:
            logger.error(f"K8S API error applying YAML: {e}")
            error_body = ''
            if e.body:
                try:
                    import json
                    body = json.loads(e.body)
                    error_body = body.get('message', str(e.body))
                except:
                    error_body = str(e.body)
            raise Exception(f"应用YAML失败: {e.status} - {e.reason}. {error_body}")
        except Exception as e:
            logger.error(f"Failed to apply YAML: {e}")
            import traceback
            traceback.print_exc()
            raise Exception(f"应用YAML失败: {str(e)}")
    
    def _apply_resource(self, api_client, doc: Dict, kind: str, api_version: str, 
                       name: str, namespace: str) -> Dict:
        """
        应用单个K8S资源
        
        Args:
            api_client: K8S API客户端
            doc: 资源文档
            kind: 资源类型
            api_version: API版本
            name: 资源名称
            namespace: 命名空间
        
        Returns:
            Dict: 操作结果
        """
        # 根据资源类型选择API和方法
        kind_lower = kind.lower()
        
        # 核心API资源
        if api_version == 'v1' or api_version.startswith('v1/'):
            core_v1 = client.CoreV1Api(api_client)
            
            if kind_lower == 'pod':
                return self._apply_namespaced_resource(
                    core_v1, 'pod', name, namespace, doc,
                    core_v1.create_namespaced_pod,
                    core_v1.replace_namespaced_pod,
                    core_v1.read_namespaced_pod
                )
            elif kind_lower == 'service':
                return self._apply_namespaced_resource(
                    core_v1, 'service', name, namespace, doc,
                    core_v1.create_namespaced_service,
                    core_v1.replace_namespaced_service,
                    core_v1.read_namespaced_service
                )
            elif kind_lower == 'configmap':
                return self._apply_namespaced_resource(
                    core_v1, 'configmap', name, namespace, doc,
                    core_v1.create_namespaced_config_map,
                    core_v1.replace_namespaced_config_map,
                    core_v1.read_namespaced_config_map
                )
            elif kind_lower == 'secret':
                return self._apply_namespaced_resource(
                    core_v1, 'secret', name, namespace, doc,
                    core_v1.create_namespaced_secret,
                    core_v1.replace_namespaced_secret,
                    core_v1.read_namespaced_secret
                )
            elif kind_lower == 'namespace':
                return self._apply_cluster_resource(
                    core_v1, 'namespace', name, doc,
                    core_v1.create_namespace,
                    core_v1.replace_namespace,
                    core_v1.read_namespace
                )
            elif kind_lower == 'persistentvolumeclaim' or kind_lower == 'pvc':
                return self._apply_namespaced_resource(
                    core_v1, 'persistentvolumeclaim', name, namespace, doc,
                    core_v1.create_namespaced_persistent_volume_claim,
                    core_v1.replace_namespaced_persistent_volume_claim,
                    core_v1.read_namespaced_persistent_volume_claim
                )
        
        # Apps API资源
        if api_version.startswith('apps/'):
            apps_v1 = client.AppsV1Api(api_client)
            
            if kind_lower == 'deployment':
                return self._apply_namespaced_resource(
                    apps_v1, 'deployment', name, namespace, doc,
                    apps_v1.create_namespaced_deployment,
                    apps_v1.replace_namespaced_deployment,
                    apps_v1.read_namespaced_deployment
                )
            elif kind_lower == 'statefulset':
                return self._apply_namespaced_resource(
                    apps_v1, 'statefulset', name, namespace, doc,
                    apps_v1.create_namespaced_stateful_set,
                    apps_v1.replace_namespaced_stateful_set,
                    apps_v1.read_namespaced_stateful_set
                )
            elif kind_lower == 'daemonset':
                return self._apply_namespaced_resource(
                    apps_v1, 'daemonset', name, namespace, doc,
                    apps_v1.create_namespaced_daemon_set,
                    apps_v1.replace_namespaced_daemon_set,
                    apps_v1.read_namespaced_daemon_set
                )
            elif kind_lower == 'replicaset':
                return self._apply_namespaced_resource(
                    apps_v1, 'replicaset', name, namespace, doc,
                    apps_v1.create_namespaced_replica_set,
                    apps_v1.replace_namespaced_replica_set,
                    apps_v1.read_namespaced_replica_set
                )
        
        # Batch API资源
        if api_version.startswith('batch/'):
            batch_v1 = client.BatchV1Api(api_client)
            
            if kind_lower == 'job':
                return self._apply_namespaced_resource(
                    batch_v1, 'job', name, namespace, doc,
                    batch_v1.create_namespaced_job,
                    batch_v1.replace_namespaced_job,
                    batch_v1.read_namespaced_job
                )
            elif kind_lower == 'cronjob':
                return self._apply_namespaced_resource(
                    batch_v1, 'cronjob', name, namespace, doc,
                    batch_v1.create_namespaced_cron_job,
                    batch_v1.replace_namespaced_cron_job,
                    batch_v1.read_namespaced_cron_job
                )
        
        # Networking API资源
        if api_version.startswith('networking.k8s.io/'):
            networking_v1 = client.NetworkingV1Api(api_client)
            
            if kind_lower == 'ingress':
                return self._apply_namespaced_resource(
                    networking_v1, 'ingress', name, namespace, doc,
                    networking_v1.create_namespaced_ingress,
                    networking_v1.replace_namespaced_ingress,
                    networking_v1.read_namespaced_ingress
                )
        
        # 不支持的资源类型
        raise ValueError(f"不支持的资源类型: {kind} (apiVersion: {api_version})")
    
    def _apply_namespaced_resource(self, api, kind: str, name: str, namespace: str, 
                                   doc: Dict, create_func, replace_func, read_func) -> Dict:
        """
        应用命名空间级别的资源
        """
        try:
            # 尝试读取现有资源
            existing = read_func(name=name, namespace=namespace)
            # 资源存在，执行更新
            # 保留resourceVersion以支持乐观锁
            if 'metadata' not in doc:
                doc['metadata'] = {}
            doc['metadata']['resourceVersion'] = existing.metadata.resource_version
            
            replace_func(name=name, namespace=namespace, body=doc)
            logger.info(f"Updated {kind} '{name}' in namespace '{namespace}'")
            return {
                'action': 'updated',
                'kind': kind,
                'name': name,
                'namespace': namespace,
                'message': f'{kind} "{name}" 更新成功'
            }
        except ApiException as e:
            if e.status == 404:
                # 资源不存在，执行创建
                create_func(namespace=namespace, body=doc)
                logger.info(f"Created {kind} '{name}' in namespace '{namespace}'")
                return {
                    'action': 'created',
                    'kind': kind,
                    'name': name,
                    'namespace': namespace,
                    'message': f'{kind} "{name}" 创建成功'
                }
            raise
    
    def _apply_cluster_resource(self, api, kind: str, name: str, doc: Dict,
                                create_func, replace_func, read_func) -> Dict:
        """
        应用集群级别的资源
        """
        try:
            # 尝试读取现有资源
            existing = read_func(name=name)
            # 资源存在，执行更新
            if 'metadata' not in doc:
                doc['metadata'] = {}
            doc['metadata']['resourceVersion'] = existing.metadata.resource_version
            
            replace_func(name=name, body=doc)
            logger.info(f"Updated {kind} '{name}'")
            return {
                'action': 'updated',
                'kind': kind,
                'name': name,
                'namespace': None,
                'message': f'{kind} "{name}" 更新成功'
            }
        except ApiException as e:
            if e.status == 404:
                # 资源不存在，执行创建
                create_func(body=doc)
                logger.info(f"Created {kind} '{name}'")
                return {
                    'action': 'created',
                    'kind': kind,
                    'name': name,
                    'namespace': None,
                    'message': f'{kind} "{name}" 创建成功'
                }
            raise
    
    def get_workload_yaml(self, cluster_id: int, namespace: str, workload_type: str, name: str) -> Dict:
        """
        获取工作负载的YAML配置
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            workload_type: 工作负载类型 (deployment/statefulset/daemonset)
            name: 工作负载名称
        
        Returns:
            Dict: 包含YAML内容的字典
        """
        import yaml as pyyaml
        
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        if workload_type not in ['deployment', 'statefulset', 'daemonset']:
            raise ValueError(f"不支持的工作负载类型: {workload_type}")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            apps_v1 = client.AppsV1Api(api_client)
            
            if workload_type == 'deployment':
                resource = apps_v1.read_namespaced_deployment(name=name, namespace=namespace)
            elif workload_type == 'statefulset':
                resource = apps_v1.read_namespaced_stateful_set(name=name, namespace=namespace)
            elif workload_type == 'daemonset':
                resource = apps_v1.read_namespaced_daemon_set(name=name, namespace=namespace)
            
            # 转换为字典并清理不需要的字段
            resource_dict = api_client.sanitize_for_serialization(resource)
            
            # 移除状态和管理字段
            if 'status' in resource_dict:
                del resource_dict['status']
            if 'metadata' in resource_dict:
                for key in ['managedFields', 'resourceVersion', 'uid', 'creationTimestamp', 'generation']:
                    resource_dict['metadata'].pop(key, None)
            
            # 转换为YAML
            yaml_content = pyyaml.dump(resource_dict, default_flow_style=False, allow_unicode=True, sort_keys=False)
            
            logger.info(f"Got YAML for {workload_type} '{name}' in namespace '{namespace}'")
            return {
                'yaml': yaml_content,
                'name': name,
                'namespace': namespace,
                'type': workload_type
            }
            
        except ApiException as e:
            if e.status == 404:
                raise ValueError(f"{workload_type} '{name}' 不存在于命名空间 '{namespace}'")
            logger.error(f"K8S API error getting workload YAML: {e}")
            raise Exception(f"获取工作负载YAML失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to get workload YAML: {e}")
            raise Exception(f"获取工作负载YAML失败: {str(e)}")
    
    def update_workload(self, cluster_id: int, namespace: str, workload_type: str, 
                       name: str, yaml_content: str) -> Dict:
        """
        通过YAML更新工作负载
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            workload_type: 工作负载类型 (deployment/statefulset/daemonset)
            name: 工作负载名称
            yaml_content: YAML内容
        
        Returns:
            Dict: 更新结果
        """
        import yaml as pyyaml
        
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        if workload_type not in ['deployment', 'statefulset', 'daemonset']:
            raise ValueError(f"不支持的工作负载类型: {workload_type}")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            # 解析YAML
            try:
                doc = pyyaml.safe_load(yaml_content)
            except pyyaml.YAMLError as e:
                raise ValueError(f"YAML格式错误: {str(e)}")
            
            if not doc or not isinstance(doc, dict):
                raise ValueError("YAML内容无效")
            
            api_client = self.client_service.get_client(cluster)
            apps_v1 = client.AppsV1Api(api_client)
            
            # 获取当前资源的resourceVersion
            if workload_type == 'deployment':
                existing = apps_v1.read_namespaced_deployment(name=name, namespace=namespace)
            elif workload_type == 'statefulset':
                existing = apps_v1.read_namespaced_stateful_set(name=name, namespace=namespace)
            elif workload_type == 'daemonset':
                existing = apps_v1.read_namespaced_daemon_set(name=name, namespace=namespace)
            
            # 设置resourceVersion
            if 'metadata' not in doc:
                doc['metadata'] = {}
            doc['metadata']['resourceVersion'] = existing.metadata.resource_version
            doc['metadata']['namespace'] = namespace
            doc['metadata']['name'] = name
            
            # 执行更新
            if workload_type == 'deployment':
                apps_v1.replace_namespaced_deployment(name=name, namespace=namespace, body=doc)
            elif workload_type == 'statefulset':
                apps_v1.replace_namespaced_stateful_set(name=name, namespace=namespace, body=doc)
            elif workload_type == 'daemonset':
                apps_v1.replace_namespaced_daemon_set(name=name, namespace=namespace, body=doc)
            
            # 记录操作日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='update',
                resource_type=workload_type,
                resource_name=name,
                namespace=namespace,
                status='success'
            )
            
            logger.info(f"Updated {workload_type} '{name}' in namespace '{namespace}'")
            return {
                'name': name,
                'namespace': namespace,
                'type': workload_type,
                'message': f'{workload_type} "{name}" 更新成功'
            }
            
        except ApiException as e:
            error_msg = f"K8S API错误: {e.status} - {e.reason}"
            logger.error(f"Failed to update {workload_type} '{name}': {error_msg}")
            
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='update',
                resource_type=workload_type,
                resource_name=name,
                namespace=namespace,
                status='failed',
                error_message=error_msg
            )
            
            if e.status == 404:
                raise ValueError(f"{workload_type} '{name}' 不存在于命名空间 '{namespace}'")
            raise Exception(f"更新工作负载失败: {error_msg}")
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to update {workload_type} '{name}': {e}")
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='update',
                resource_type=workload_type,
                resource_name=name,
                namespace=namespace,
                status='failed',
                error_message=str(e)
            )
            raise Exception(f"更新工作负载失败: {str(e)}")
    
    def delete_workload(self, cluster_id: int, namespace: str, workload_type: str, name: str) -> Dict:
        """
        删除工作负载
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            workload_type: 工作负载类型 (deployment/statefulset/daemonset)
            name: 工作负载名称
        
        Returns:
            Dict: 删除结果
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        if workload_type not in ['deployment', 'statefulset', 'daemonset']:
            raise ValueError(f"不支持的工作负载类型: {workload_type}")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            apps_v1 = client.AppsV1Api(api_client)
            
            # 执行删除
            if workload_type == 'deployment':
                apps_v1.delete_namespaced_deployment(name=name, namespace=namespace)
            elif workload_type == 'statefulset':
                apps_v1.delete_namespaced_stateful_set(name=name, namespace=namespace)
            elif workload_type == 'daemonset':
                apps_v1.delete_namespaced_daemon_set(name=name, namespace=namespace)
            
            # 记录操作日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='delete',
                resource_type=workload_type,
                resource_name=name,
                namespace=namespace,
                status='success'
            )
            
            logger.info(f"Deleted {workload_type} '{name}' in namespace '{namespace}'")
            return {
                'name': name,
                'namespace': namespace,
                'type': workload_type,
                'message': f'{workload_type} "{name}" 删除成功'
            }
            
        except ApiException as e:
            error_msg = f"K8S API错误: {e.status} - {e.reason}"
            logger.error(f"Failed to delete {workload_type} '{name}': {error_msg}")
            
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='delete',
                resource_type=workload_type,
                resource_name=name,
                namespace=namespace,
                status='failed',
                error_message=error_msg
            )
            
            if e.status == 404:
                raise ValueError(f"{workload_type} '{name}' 不存在于命名空间 '{namespace}'")
            raise Exception(f"删除工作负载失败: {error_msg}")
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to delete {workload_type} '{name}': {e}")
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='delete',
                resource_type=workload_type,
                resource_name=name,
                namespace=namespace,
                status='failed',
                error_message=str(e)
            )
            raise Exception(f"删除工作负载失败: {str(e)}")

    def _log_operation(self, cluster_id: int, operation_type: str, 
                      resource_type: str, resource_name: str, 
                      status: str, namespace: str = None,
                      operation_data: dict = None,
                      error_message: str = None) -> None:
        """
        记录操作日志
        
        Args:
            cluster_id: 集群ID
            operation_type: 操作类型
            resource_type: 资源类型
            resource_name: 资源名称
            status: 状态
            namespace: 命名空间
            operation_data: 操作数据
            error_message: 错误信息
        """
        try:
            tenant_id = getattr(g, 'tenant_id', None)
            user_id = getattr(g, 'user_id', None)
            
            if not tenant_id or not user_id:
                logger.warning("Cannot log operation: tenant_id or user_id not found in context")
                return
            
            operation = K8sOperation()
            operation.tenant_id = tenant_id
            operation.user_id = user_id
            operation.cluster_id = cluster_id
            operation.operation_type = operation_type
            operation.resource_type = resource_type
            operation.resource_name = resource_name
            operation.namespace = namespace
            operation.status = status
            operation.operation_data = operation_data
            operation.error_message = error_message
            
            db.session.add(operation)
            db.session.commit()
            
        except Exception as e:
            logger.error(f"Failed to log operation: {e}")
            # 不抛出异常，避免影响主流程


# 创建全局服务实例
workload_service = WorkloadService()
