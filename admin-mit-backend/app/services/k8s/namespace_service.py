"""
K8S Namespace Service
Handles namespace operations including list, create, delete, and quota management
"""
import logging
import re
from typing import List, Dict, Optional
from flask import g
from kubernetes import client
from kubernetes.client.rest import ApiException

from app.extensions import db
from app.models.k8s_cluster import K8sCluster
from app.models.k8s_operation import K8sOperation
from .client_service import K8sClientService

logger = logging.getLogger(__name__)


class NamespaceService:
    """
    命名空间管理服务
    处理命名空间的列表、创建、删除和配额查询操作
    """
    
    def __init__(self):
        self.client_service = K8sClientService()
    
    def list_namespaces(self, cluster_id: int) -> List[Dict]:
        """
        获取命名空间列表
        
        Args:
            cluster_id: 集群ID
        
        Returns:
            List[Dict]: 命名空间列表，每个命名空间包含:
                - name: 命名空间名称
                - status: 状态 (Active/Terminating)
                - created_at: 创建时间
                - labels: 标签
                - annotations: 注解
        
        Raises:
            ValueError: 集群不存在
            Exception: 获取失败
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        # 获取集群
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            # 获取客户端
            api_client = self.client_service.get_client(cluster)
            core_v1 = client.CoreV1Api(api_client)
            
            # 获取命名空间列表
            namespaces = core_v1.list_namespace()
            
            result = []
            for ns in namespaces.items:
                namespace_data = {
                    'name': ns.metadata.name,
                    'status': ns.status.phase if ns.status else 'Unknown',
                    'created_at': ns.metadata.creation_timestamp.isoformat() if ns.metadata.creation_timestamp else None,
                    'labels': ns.metadata.labels or {},
                    'annotations': ns.metadata.annotations or {},
                    'uid': ns.metadata.uid
                }
                result.append(namespace_data)
            
            logger.info(f"Listed {len(result)} namespaces for cluster {cluster_id}")
            return result
            
        except ApiException as e:
            logger.error(f"K8S API error listing namespaces: {e}")
            raise Exception(f"获取命名空间列表失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to list namespaces for cluster {cluster_id}: {e}")
            raise Exception(f"获取命名空间列表失败: {str(e)}")
    
    def create_namespace(self, cluster_id: int, name: str, labels: Optional[Dict] = None) -> Dict:
        """
        创建命名空间
        
        Args:
            cluster_id: 集群ID
            name: 命名空间名称
            labels: 标签字典 (可选)
        
        Returns:
            Dict: 创建的命名空间信息
        
        Raises:
            ValueError: 验证失败或集群不存在
            Exception: 创建失败
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        # 验证命名空间名称
        if not self._validate_namespace_name(name):
            raise ValueError(
                f"命名空间名称 '{name}' 不合法。"
                "名称必须符合DNS-1123标准：小写字母、数字、连字符，"
                "以字母或数字开头和结尾，长度不超过63个字符"
            )
        
        # 获取集群
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            # 获取客户端
            api_client = self.client_service.get_client(cluster)
            core_v1 = client.CoreV1Api(api_client)
            
            # 创建命名空间对象
            namespace = client.V1Namespace(
                metadata=client.V1ObjectMeta(
                    name=name,
                    labels=labels or {}
                )
            )
            
            # 创建命名空间
            created_ns = core_v1.create_namespace(body=namespace)
            
            # 记录操作日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='create',
                resource_type='namespace',
                resource_name=name,
                status='success',
                operation_data={'labels': labels}
            )
            
            logger.info(f"Created namespace '{name}' in cluster {cluster_id}")
            
            return {
                'name': created_ns.metadata.name,
                'status': created_ns.status.phase if created_ns.status else 'Active',
                'created_at': created_ns.metadata.creation_timestamp.isoformat() if created_ns.metadata.creation_timestamp else None,
                'labels': created_ns.metadata.labels or {},
                'uid': created_ns.metadata.uid
            }
            
        except ApiException as e:
            error_msg = f"K8S API错误: {e.status} - {e.reason}"
            logger.error(f"Failed to create namespace '{name}': {error_msg}")
            
            # 记录失败日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='create',
                resource_type='namespace',
                resource_name=name,
                status='failed',
                error_message=error_msg
            )
            
            if e.status == 409:
                raise ValueError(f"命名空间 '{name}' 已存在")
            else:
                raise Exception(f"创建命名空间失败: {error_msg}")
                
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to create namespace '{name}': {e}")
            
            # 记录失败日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='create',
                resource_type='namespace',
                resource_name=name,
                status='failed',
                error_message=str(e)
            )
            
            raise Exception(f"创建命名空间失败: {str(e)}")
    
    def delete_namespace(self, cluster_id: int, name: str) -> bool:
        """
        删除命名空间
        
        Args:
            cluster_id: 集群ID
            name: 命名空间名称
        
        Returns:
            bool: 是否成功删除
        
        Raises:
            ValueError: 集群不存在或命名空间不存在
            Exception: 删除失败
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        # 获取集群
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        # 防止删除系统命名空间
        system_namespaces = ['default', 'kube-system', 'kube-public', 'kube-node-lease']
        if name in system_namespaces:
            raise ValueError(f"不允许删除系统命名空间: {name}")
        
        try:
            # 获取客户端
            api_client = self.client_service.get_client(cluster)
            core_v1 = client.CoreV1Api(api_client)
            
            # 删除命名空间
            core_v1.delete_namespace(name=name)
            
            # 记录操作日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='delete',
                resource_type='namespace',
                resource_name=name,
                status='success'
            )
            
            logger.info(f"Deleted namespace '{name}' from cluster {cluster_id}")
            return True
            
        except ApiException as e:
            error_msg = f"K8S API错误: {e.status} - {e.reason}"
            logger.error(f"Failed to delete namespace '{name}': {error_msg}")
            
            # 记录失败日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='delete',
                resource_type='namespace',
                resource_name=name,
                status='failed',
                error_message=error_msg
            )
            
            if e.status == 404:
                raise ValueError(f"命名空间 '{name}' 不存在")
            else:
                raise Exception(f"删除命名空间失败: {error_msg}")
                
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to delete namespace '{name}': {e}")
            
            # 记录失败日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='delete',
                resource_type='namespace',
                resource_name=name,
                status='failed',
                error_message=str(e)
            )
            
            raise Exception(f"删除命名空间失败: {str(e)}")
    
    def get_namespace_quotas(self, cluster_id: int, name: str) -> Dict:
        """
        获取命名空间资源配额
        
        Args:
            cluster_id: 集群ID
            name: 命名空间名称
        
        Returns:
            Dict: 资源配额信息，包含:
                - resource_quotas: ResourceQuota列表
                - limit_ranges: LimitRange列表
        
        Raises:
            ValueError: 集群不存在或命名空间不存在
            Exception: 获取失败
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        # 获取集群
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            # 获取客户端
            api_client = self.client_service.get_client(cluster)
            core_v1 = client.CoreV1Api(api_client)
            
            # 检查命名空间是否存在
            try:
                core_v1.read_namespace(name=name)
            except ApiException as e:
                if e.status == 404:
                    raise ValueError(f"命名空间 '{name}' 不存在")
                raise
            
            # 获取ResourceQuota
            resource_quotas = []
            try:
                quotas = core_v1.list_namespaced_resource_quota(namespace=name)
                for quota in quotas.items:
                    quota_data = {
                        'name': quota.metadata.name,
                        'hard': quota.status.hard or {},
                        'used': quota.status.used or {}
                    }
                    resource_quotas.append(quota_data)
            except ApiException as e:
                logger.warning(f"Failed to get resource quotas for namespace '{name}': {e}")
            
            # 获取LimitRange
            limit_ranges = []
            try:
                limits = core_v1.list_namespaced_limit_range(namespace=name)
                for limit in limits.items:
                    limit_data = {
                        'name': limit.metadata.name,
                        'limits': []
                    }
                    if limit.spec and limit.spec.limits:
                        for item in limit.spec.limits:
                            limit_item = {
                                'type': item.type,
                                'max': item.max or {},
                                'min': item.min or {},
                                'default': item.default or {},
                                'default_request': item.default_request or {}
                            }
                            limit_data['limits'].append(limit_item)
                    limit_ranges.append(limit_data)
            except ApiException as e:
                logger.warning(f"Failed to get limit ranges for namespace '{name}': {e}")
            
            logger.info(f"Retrieved quotas for namespace '{name}' in cluster {cluster_id}")
            
            return {
                'resource_quotas': resource_quotas,
                'limit_ranges': limit_ranges
            }
            
        except ValueError:
            raise
        except ApiException as e:
            logger.error(f"K8S API error getting namespace quotas: {e}")
            raise Exception(f"获取命名空间配额失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to get namespace quotas for '{name}': {e}")
            raise Exception(f"获取命名空间配额失败: {str(e)}")
    
    def _validate_namespace_name(self, name: str) -> bool:
        """
        验证命名空间名称是否符合DNS-1123标准
        
        Args:
            name: 命名空间名称
        
        Returns:
            bool: 是否合法
        """
        if not name:
            return False
        
        # DNS-1123标准：
        # - 小写字母、数字、连字符
        # - 以字母或数字开头和结尾
        # - 长度不超过63个字符
        if len(name) > 63:
            return False
        
        pattern = r'^[a-z0-9]([-a-z0-9]*[a-z0-9])?$'
        return bool(re.match(pattern, name))
    
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
namespace_service = NamespaceService()
