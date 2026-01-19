"""
K8S Config Service
Handles ConfigMap and Secret operations
"""
import logging
import base64
from typing import List, Dict, Optional
from flask import g
from kubernetes import client
from kubernetes.client.rest import ApiException

from app.extensions import db
from app.models.k8s_cluster import K8sCluster
from app.models.k8s_operation import K8sOperation
from .client_service import K8sClientService

logger = logging.getLogger(__name__)


class ConfigService:
    """
    配置管理服务
    处理ConfigMap和Secret的操作
    """
    
    def __init__(self):
        self.client_service = K8sClientService()
    
    def list_configmaps(self, cluster_id: int, namespace: str) -> List[Dict]:
        """
        获取ConfigMap列表
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
        
        Returns:
            List[Dict]: ConfigMap列表
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
            
            configmaps = core_v1.list_namespaced_config_map(namespace=namespace)
            
            result = []
            for cm in configmaps.items:
                configmap_data = {
                    'name': cm.metadata.name,
                    'namespace': cm.metadata.namespace,
                    'data': cm.data or {},
                    'data_count': len(cm.data) if cm.data else 0,
                    'created_at': cm.metadata.creation_timestamp.isoformat() if cm.metadata.creation_timestamp else None,
                    'labels': cm.metadata.labels or {},
                    'uid': cm.metadata.uid
                }
                result.append(configmap_data)
            
            logger.info(f"Listed {len(result)} configmaps in namespace '{namespace}' for cluster {cluster_id}")
            return result
            
        except ApiException as e:
            logger.error(f"K8S API error listing configmaps: {e}")
            raise Exception(f"获取ConfigMap列表失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to list configmaps: {e}")
            raise Exception(f"获取ConfigMap列表失败: {str(e)}")
    
    def get_configmap_detail(self, cluster_id: int, namespace: str, name: str) -> Dict:
        """
        获取ConfigMap详情
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            name: ConfigMap名称
        
        Returns:
            Dict: ConfigMap详情
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
            
            cm = core_v1.read_namespaced_config_map(name=name, namespace=namespace)
            
            configmap_data = {
                'name': cm.metadata.name,
                'namespace': cm.metadata.namespace,
                'data': cm.data or {},
                'data_count': len(cm.data) if cm.data else 0,
                'created_at': cm.metadata.creation_timestamp.isoformat() if cm.metadata.creation_timestamp else None,
                'labels': cm.metadata.labels or {},
                'annotations': cm.metadata.annotations or {},
                'uid': cm.metadata.uid
            }
            
            logger.info(f"Retrieved configmap detail for '{name}' in namespace '{namespace}'")
            return configmap_data
            
        except ApiException as e:
            if e.status == 404:
                raise ValueError(f"ConfigMap '{name}' 不存在于命名空间 '{namespace}'")
            logger.error(f"K8S API error getting configmap detail: {e}")
            raise Exception(f"获取ConfigMap详情失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to get configmap detail: {e}")
            raise Exception(f"获取ConfigMap详情失败: {str(e)}")
    
    def list_secrets(self, cluster_id: int, namespace: str) -> List[Dict]:
        """
        获取Secret列表（包含数据脱敏）
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
        
        Returns:
            List[Dict]: Secret列表（敏感数据已脱敏）
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
            
            secrets = core_v1.list_namespaced_secret(namespace=namespace)
            
            result = []
            for secret in secrets.items:
                # 脱敏处理：将所有数据值替换为 ******
                masked_data = {}
                if secret.data:
                    for key in secret.data.keys():
                        masked_data[key] = '******'
                
                secret_data = {
                    'name': secret.metadata.name,
                    'namespace': secret.metadata.namespace,
                    'type': secret.type,
                    'data': masked_data,
                    'data_count': len(secret.data) if secret.data else 0,
                    'created_at': secret.metadata.creation_timestamp.isoformat() if secret.metadata.creation_timestamp else None,
                    'labels': secret.metadata.labels or {},
                    'uid': secret.metadata.uid
                }
                result.append(secret_data)
            
            logger.info(f"Listed {len(result)} secrets in namespace '{namespace}' for cluster {cluster_id}")
            return result
            
        except ApiException as e:
            logger.error(f"K8S API error listing secrets: {e}")
            raise Exception(f"获取Secret列表失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to list secrets: {e}")
            raise Exception(f"获取Secret列表失败: {str(e)}")
    
    def get_secret_detail(self, cluster_id: int, namespace: str, name: str) -> Dict:
        """
        获取Secret详情（敏感数据脱敏）
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            name: Secret名称
        
        Returns:
            Dict: Secret详情（敏感数据已脱敏）
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
            
            secret = core_v1.read_namespaced_secret(name=name, namespace=namespace)
            
            # 脱敏处理：将所有数据值替换为 ******
            masked_data = {}
            if secret.data:
                for key in secret.data.keys():
                    masked_data[key] = '******'
            
            secret_data = {
                'name': secret.metadata.name,
                'namespace': secret.metadata.namespace,
                'type': secret.type,
                'data': masked_data,
                'data_count': len(secret.data) if secret.data else 0,
                'created_at': secret.metadata.creation_timestamp.isoformat() if secret.metadata.creation_timestamp else None,
                'labels': secret.metadata.labels or {},
                'annotations': secret.metadata.annotations or {},
                'uid': secret.metadata.uid
            }
            
            logger.info(f"Retrieved secret detail for '{name}' in namespace '{namespace}'")
            return secret_data
            
        except ApiException as e:
            if e.status == 404:
                raise ValueError(f"Secret '{name}' 不存在于命名空间 '{namespace}'")
            logger.error(f"K8S API error getting secret detail: {e}")
            raise Exception(f"获取Secret详情失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to get secret detail: {e}")
            raise Exception(f"获取Secret详情失败: {str(e)}")
    
    def create_configmap(self, cluster_id: int, namespace: str, name: str, data: dict) -> Dict:
        """
        创建ConfigMap
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            name: ConfigMap名称
            data: 配置数据（键值对）
        
        Returns:
            Dict: 创建的ConfigMap信息
        
        Raises:
            ValueError: 验证失败
            Exception: 创建失败
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        # 验证参数
        if not name:
            raise ValueError("ConfigMap名称不能为空")
        
        if not isinstance(data, dict):
            raise ValueError("配置数据必须是键值对格式")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            core_v1 = client.CoreV1Api(api_client)
            
            # 创建ConfigMap对象
            configmap = client.V1ConfigMap(
                metadata=client.V1ObjectMeta(name=name),
                data=data
            )
            
            # 创建ConfigMap
            created_cm = core_v1.create_namespaced_config_map(
                namespace=namespace,
                body=configmap
            )
            
            # 记录操作日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='create',
                resource_type='configmap',
                resource_name=name,
                namespace=namespace,
                status='success',
                operation_data={'data_keys': list(data.keys())}
            )
            
            logger.info(f"Created configmap '{name}' in namespace '{namespace}'")
            
            return {
                'name': created_cm.metadata.name,
                'namespace': created_cm.metadata.namespace,
                'data': created_cm.data or {},
                'data_count': len(created_cm.data) if created_cm.data else 0,
                'created_at': created_cm.metadata.creation_timestamp.isoformat() if created_cm.metadata.creation_timestamp else None,
                'uid': created_cm.metadata.uid
            }
            
        except ApiException as e:
            error_msg = f"K8S API错误: {e.status} - {e.reason}"
            logger.error(f"Failed to create configmap '{name}': {error_msg}")
            
            # 记录失败日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='create',
                resource_type='configmap',
                resource_name=name,
                namespace=namespace,
                status='failed',
                error_message=error_msg,
                operation_data={'data_keys': list(data.keys())}
            )
            
            if e.status == 409:
                raise ValueError(f"ConfigMap '{name}' 已存在于命名空间 '{namespace}'")
            else:
                raise Exception(f"创建ConfigMap失败: {error_msg}")
                
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to create configmap '{name}': {e}")
            
            # 记录失败日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='create',
                resource_type='configmap',
                resource_name=name,
                namespace=namespace,
                status='failed',
                error_message=str(e),
                operation_data={'data_keys': list(data.keys()) if isinstance(data, dict) else []}
            )
            
            raise Exception(f"创建ConfigMap失败: {str(e)}")
    
    def create_secret(self, cluster_id: int, namespace: str, name: str, 
                     data: dict, secret_type: str = 'Opaque') -> Dict:
        """
        创建Secret（包含Base64编码）
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            name: Secret名称
            data: 配置数据（键值对，将自动进行Base64编码）
            secret_type: Secret类型（默认: Opaque）
        
        Returns:
            Dict: 创建的Secret信息
        
        Raises:
            ValueError: 验证失败
            Exception: 创建失败
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        # 验证参数
        if not name:
            raise ValueError("Secret名称不能为空")
        
        if not isinstance(data, dict):
            raise ValueError("配置数据必须是键值对格式")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            core_v1 = client.CoreV1Api(api_client)
            
            # Base64编码数据
            encoded_data = {}
            for key, value in data.items():
                if isinstance(value, str):
                    encoded_data[key] = base64.b64encode(value.encode('utf-8')).decode('utf-8')
                else:
                    # 如果已经是bytes，直接编码
                    encoded_data[key] = base64.b64encode(value).decode('utf-8')
            
            # 创建Secret对象
            secret = client.V1Secret(
                metadata=client.V1ObjectMeta(name=name),
                type=secret_type,
                data=encoded_data
            )
            
            # 创建Secret
            created_secret = core_v1.create_namespaced_secret(
                namespace=namespace,
                body=secret
            )
            
            # 记录操作日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='create',
                resource_type='secret',
                resource_name=name,
                namespace=namespace,
                status='success',
                operation_data={'data_keys': list(data.keys()), 'type': secret_type}
            )
            
            logger.info(f"Created secret '{name}' in namespace '{namespace}'")
            
            # 返回脱敏后的数据
            masked_data = {key: '******' for key in encoded_data.keys()}
            
            return {
                'name': created_secret.metadata.name,
                'namespace': created_secret.metadata.namespace,
                'type': created_secret.type,
                'data': masked_data,
                'data_count': len(created_secret.data) if created_secret.data else 0,
                'created_at': created_secret.metadata.creation_timestamp.isoformat() if created_secret.metadata.creation_timestamp else None,
                'uid': created_secret.metadata.uid
            }
            
        except ApiException as e:
            error_msg = f"K8S API错误: {e.status} - {e.reason}"
            logger.error(f"Failed to create secret '{name}': {error_msg}")
            
            # 记录失败日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='create',
                resource_type='secret',
                resource_name=name,
                namespace=namespace,
                status='failed',
                error_message=error_msg,
                operation_data={'data_keys': list(data.keys()), 'type': secret_type}
            )
            
            if e.status == 409:
                raise ValueError(f"Secret '{name}' 已存在于命名空间 '{namespace}'")
            else:
                raise Exception(f"创建Secret失败: {error_msg}")
                
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to create secret '{name}': {e}")
            
            # 记录失败日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='create',
                resource_type='secret',
                resource_name=name,
                namespace=namespace,
                status='failed',
                error_message=str(e),
                operation_data={'data_keys': list(data.keys()) if isinstance(data, dict) else [], 'type': secret_type}
            )
            
            raise Exception(f"创建Secret失败: {str(e)}")
    
    def check_config_usage(self, cluster_id: int, namespace: str, 
                          config_type: str, name: str) -> List[Dict]:
        """
        检查配置是否被工作负载使用
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            config_type: 配置类型 ('configmap' 或 'secret')
            name: 配置名称
        
        Returns:
            List[Dict]: 使用该配置的工作负载列表
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        if config_type not in ['configmap', 'secret']:
            raise ValueError(f"不支持的配置类型: {config_type}")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            apps_v1 = client.AppsV1Api(api_client)
            core_v1 = client.CoreV1Api(api_client)
            
            using_workloads = []
            
            # 检查Deployments
            deployments = apps_v1.list_namespaced_deployment(namespace=namespace)
            for deploy in deployments.items:
                if self._workload_uses_config(deploy.spec.template.spec, config_type, name):
                    using_workloads.append({
                        'type': 'deployment',
                        'name': deploy.metadata.name,
                        'namespace': deploy.metadata.namespace
                    })
            
            # 检查StatefulSets
            statefulsets = apps_v1.list_namespaced_stateful_set(namespace=namespace)
            for sts in statefulsets.items:
                if self._workload_uses_config(sts.spec.template.spec, config_type, name):
                    using_workloads.append({
                        'type': 'statefulset',
                        'name': sts.metadata.name,
                        'namespace': sts.metadata.namespace
                    })
            
            # 检查DaemonSets
            daemonsets = apps_v1.list_namespaced_daemon_set(namespace=namespace)
            for ds in daemonsets.items:
                if self._workload_uses_config(ds.spec.template.spec, config_type, name):
                    using_workloads.append({
                        'type': 'daemonset',
                        'name': ds.metadata.name,
                        'namespace': ds.metadata.namespace
                    })
            
            # 检查Pods
            pods = core_v1.list_namespaced_pod(namespace=namespace)
            for pod in pods.items:
                if self._workload_uses_config(pod.spec, config_type, name):
                    using_workloads.append({
                        'type': 'pod',
                        'name': pod.metadata.name,
                        'namespace': pod.metadata.namespace
                    })
            
            logger.info(f"Found {len(using_workloads)} workloads using {config_type} '{name}'")
            return using_workloads
            
        except ApiException as e:
            logger.error(f"K8S API error checking config usage: {e}")
            raise Exception(f"检查配置使用情况失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to check config usage: {e}")
            raise Exception(f"检查配置使用情况失败: {str(e)}")
    
    def _workload_uses_config(self, pod_spec, config_type: str, config_name: str) -> bool:
        """
        检查Pod规格是否使用了指定的配置
        
        Args:
            pod_spec: Pod规格对象
            config_type: 配置类型 ('configmap' 或 'secret')
            config_name: 配置名称
        
        Returns:
            bool: 是否使用了该配置
        """
        if not pod_spec:
            return False
        
        # 检查volumes
        if pod_spec.volumes:
            for volume in pod_spec.volumes:
                if config_type == 'configmap' and volume.config_map:
                    if volume.config_map.name == config_name:
                        return True
                elif config_type == 'secret' and volume.secret:
                    if volume.secret.secret_name == config_name:
                        return True
        
        # 检查容器的环境变量
        if pod_spec.containers:
            for container in pod_spec.containers:
                if container.env:
                    for env in container.env:
                        if config_type == 'configmap' and env.value_from and env.value_from.config_map_key_ref:
                            if env.value_from.config_map_key_ref.name == config_name:
                                return True
                        elif config_type == 'secret' and env.value_from and env.value_from.secret_key_ref:
                            if env.value_from.secret_key_ref.name == config_name:
                                return True
                
                # 检查envFrom
                if container.env_from:
                    for env_from in container.env_from:
                        if config_type == 'configmap' and env_from.config_map_ref:
                            if env_from.config_map_ref.name == config_name:
                                return True
                        elif config_type == 'secret' and env_from.secret_ref:
                            if env_from.secret_ref.name == config_name:
                                return True
        
        return False
    
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
config_service = ConfigService()
