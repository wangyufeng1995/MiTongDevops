"""
K8S Storage Service
Handles PersistentVolume, PersistentVolumeClaim, and StorageClass operations
"""
import logging
from typing import List, Dict
from flask import g
from kubernetes import client
from kubernetes.client.rest import ApiException

from app.models.k8s_cluster import K8sCluster
from .client_service import K8sClientService

logger = logging.getLogger(__name__)


class StorageService:
    """
    存储管理服务
    处理PV、PVC、StorageClass的操作
    """
    
    def __init__(self):
        self.client_service = K8sClientService()
    
    def list_persistent_volumes(self, cluster_id: int) -> List[Dict]:
        """
        获取PersistentVolume列表
        
        Args:
            cluster_id: 集群ID
        
        Returns:
            List[Dict]: PV列表
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
            
            pvs = core_v1.list_persistent_volume()
            
            result = []
            for pv in pvs.items:
                # 获取容量
                capacity = pv.spec.capacity.get('storage', 'N/A') if pv.spec.capacity else 'N/A'
                
                # 获取访问模式
                access_modes = pv.spec.access_modes or []
                
                # 获取回收策略
                reclaim_policy = pv.spec.persistent_volume_reclaim_policy or 'N/A'
                
                # 获取状态
                status = pv.status.phase if pv.status else 'Unknown'
                
                # 获取StorageClass
                storage_class = pv.spec.storage_class_name or 'N/A'
                
                # 获取绑定的PVC
                claim_ref = None
                if pv.spec.claim_ref:
                    claim_ref = {
                        'name': pv.spec.claim_ref.name,
                        'namespace': pv.spec.claim_ref.namespace
                    }
                
                pv_data = {
                    'name': pv.metadata.name,
                    'capacity': capacity,
                    'access_modes': access_modes,
                    'reclaim_policy': reclaim_policy,
                    'status': status,
                    'storage_class': storage_class,
                    'claim_ref': claim_ref,
                    'created_at': pv.metadata.creation_timestamp.isoformat() if pv.metadata.creation_timestamp else None,
                    'labels': pv.metadata.labels or {},
                    'uid': pv.metadata.uid
                }
                result.append(pv_data)
            
            logger.info(f"Listed {len(result)} persistent volumes for cluster {cluster_id}")
            return result
            
        except ApiException as e:
            logger.error(f"K8S API error listing persistent volumes: {e}")
            raise Exception(f"获取PV列表失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to list persistent volumes: {e}")
            raise Exception(f"获取PV列表失败: {str(e)}")
    
    def list_persistent_volume_claims(self, cluster_id: int, namespace: str) -> List[Dict]:
        """
        获取PersistentVolumeClaim列表
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
        
        Returns:
            List[Dict]: PVC列表
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
            
            pvcs = core_v1.list_namespaced_persistent_volume_claim(namespace=namespace)
            
            result = []
            for pvc in pvcs.items:
                # 获取请求容量
                requested_capacity = pvc.spec.resources.requests.get('storage', 'N/A') if pvc.spec.resources and pvc.spec.resources.requests else 'N/A'
                
                # 获取访问模式
                access_modes = pvc.spec.access_modes or []
                
                # 获取状态
                status = pvc.status.phase if pvc.status else 'Unknown'
                
                # 获取绑定的PV
                bound_pv = pvc.spec.volume_name if pvc.spec else None
                
                # 获取StorageClass
                storage_class = pvc.spec.storage_class_name or 'N/A'
                
                # 获取实际容量（如果已绑定）
                actual_capacity = None
                if pvc.status and pvc.status.capacity:
                    actual_capacity = pvc.status.capacity.get('storage', 'N/A')
                
                pvc_data = {
                    'name': pvc.metadata.name,
                    'namespace': pvc.metadata.namespace,
                    'requested_capacity': requested_capacity,
                    'actual_capacity': actual_capacity,
                    'access_modes': access_modes,
                    'status': status,
                    'bound_pv': bound_pv,
                    'storage_class': storage_class,
                    'created_at': pvc.metadata.creation_timestamp.isoformat() if pvc.metadata.creation_timestamp else None,
                    'labels': pvc.metadata.labels or {},
                    'uid': pvc.metadata.uid
                }
                result.append(pvc_data)
            
            logger.info(f"Listed {len(result)} persistent volume claims in namespace '{namespace}' for cluster {cluster_id}")
            return result
            
        except ApiException as e:
            logger.error(f"K8S API error listing persistent volume claims: {e}")
            raise Exception(f"获取PVC列表失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to list persistent volume claims: {e}")
            raise Exception(f"获取PVC列表失败: {str(e)}")
    
    def list_storage_classes(self, cluster_id: int) -> List[Dict]:
        """
        获取StorageClass列表
        
        Args:
            cluster_id: 集群ID
        
        Returns:
            List[Dict]: StorageClass列表
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            storage_v1 = client.StorageV1Api(api_client)
            
            storage_classes = storage_v1.list_storage_class()
            
            result = []
            for sc in storage_classes.items:
                # 获取供应商
                provisioner = sc.provisioner or 'N/A'
                
                # 获取回收策略
                reclaim_policy = sc.reclaim_policy or 'Delete'
                
                # 获取卷绑定模式
                volume_binding_mode = sc.volume_binding_mode or 'Immediate'
                
                # 获取参数
                parameters = sc.parameters or {}
                
                # 是否允许卷扩展
                allow_volume_expansion = sc.allow_volume_expansion or False
                
                # 是否为默认StorageClass
                is_default = False
                if sc.metadata.annotations:
                    is_default = sc.metadata.annotations.get('storageclass.kubernetes.io/is-default-class') == 'true'
                
                sc_data = {
                    'name': sc.metadata.name,
                    'provisioner': provisioner,
                    'reclaim_policy': reclaim_policy,
                    'volume_binding_mode': volume_binding_mode,
                    'parameters': parameters,
                    'allow_volume_expansion': allow_volume_expansion,
                    'is_default': is_default,
                    'created_at': sc.metadata.creation_timestamp.isoformat() if sc.metadata.creation_timestamp else None,
                    'labels': sc.metadata.labels or {},
                    'uid': sc.metadata.uid
                }
                result.append(sc_data)
            
            logger.info(f"Listed {len(result)} storage classes for cluster {cluster_id}")
            return result
            
        except ApiException as e:
            logger.error(f"K8S API error listing storage classes: {e}")
            raise Exception(f"获取StorageClass列表失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to list storage classes: {e}")
            raise Exception(f"获取StorageClass列表失败: {str(e)}")


# 创建全局服务实例
storage_service = StorageService()
