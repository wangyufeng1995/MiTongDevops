"""
K8S Cluster Service
Handles cluster CRUD operations and status monitoring
"""
import logging
from datetime import datetime
from typing import Dict, Optional
from flask import g
from kubernetes import client
from kubernetes.client.rest import ApiException

from app.extensions import db
from app.models.k8s_cluster import K8sCluster
from app.models.k8s_operation import K8sOperation
from .client_service import K8sClientService

logger = logging.getLogger(__name__)


class ClusterService:
    """
    集群管理服务
    处理集群的CRUD操作和状态监控
    """
    
    def __init__(self):
        self.client_service = K8sClientService()
    
    def create_cluster(self, data: dict) -> K8sCluster:
        """
        创建集群
        
        Args:
            data: 集群数据字典，包含:
                - name: 集群名称 (必需)
                - api_server: API服务器地址 (必需)
                - auth_type: 认证类型 'token' 或 'kubeconfig' (必需)
                - token: Token (auth_type='token'时必需)
                - kubeconfig: Kubeconfig内容 (auth_type='kubeconfig'时必需)
                - description: 描述 (可选)
        
        Returns:
            K8sCluster: 创建的集群对象
            
        Raises:
            ValueError: 验证失败
            Exception: 创建失败
        """
        # 验证必需字段
        required_fields = ['name', 'api_server', 'auth_type']
        for field in required_fields:
            if not data.get(field):
                raise ValueError(f"字段 {field} 不能为空")
        
        # 验证认证类型
        auth_type = data['auth_type']
        if auth_type not in ['token', 'kubeconfig']:
            raise ValueError(f"不支持的认证类型: {auth_type}")
        
        # 验证认证凭据
        if auth_type == 'token' and not data.get('token'):
            raise ValueError("Token认证需要提供token")
        if auth_type == 'kubeconfig' and not data.get('kubeconfig'):
            raise ValueError("Kubeconfig认证需要提供kubeconfig")
        
        # 获取租户ID
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        try:
            # 测试连接
            credentials = {}
            if auth_type == 'token':
                credentials['token'] = data['token']
            else:
                credentials['kubeconfig'] = data['kubeconfig']
            
            success, message = self.client_service.test_connection(
                data['api_server'],
                auth_type,
                credentials
            )
            
            if not success:
                raise ValueError(f"集群连接测试失败: {message}")
            
            # 创建集群对象
            cluster = K8sCluster()
            cluster.tenant_id = tenant_id
            cluster.name = data['name']
            cluster.api_server = data['api_server']
            cluster.auth_type = auth_type
            cluster.description = data.get('description', '')
            
            # 设置加密的认证信息
            if auth_type == 'token':
                cluster.set_token(data['token'])
            else:
                cluster.set_kubeconfig(data['kubeconfig'])
            
            # 设置初始状态
            cluster.status = 'online'
            cluster.last_connected_at = datetime.utcnow()
            
            # 获取集群版本信息
            try:
                # 临时创建客户端获取版本
                if auth_type == 'token':
                    temp_client = self.client_service.create_client_from_token(
                        data['api_server'], data['token']
                    )
                else:
                    temp_client = self.client_service.create_client_from_kubeconfig(
                        data['kubeconfig']
                    )
                
                version_api = client.VersionApi(temp_client)
                version_info = version_api.get_code()
                cluster.version = f"{version_info.major}.{version_info.minor}"
                
                temp_client.close()
            except Exception as e:
                logger.warning(f"Failed to get cluster version: {e}")
                cluster.version = "unknown"
            
            # 保存到数据库
            db.session.add(cluster)
            db.session.commit()
            
            # 记录操作日志
            self._log_operation(
                cluster_id=cluster.id,
                operation_type='create',
                resource_type='cluster',
                resource_name=cluster.name,
                status='success'
            )
            
            logger.info(f"Created cluster {cluster.id} ({cluster.name}) for tenant {tenant_id}")
            return cluster
            
        except ValueError:
            raise
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to create cluster: {e}")
            raise Exception(f"创建集群失败: {str(e)}")
    
    def update_cluster(self, cluster_id: int, data: dict) -> K8sCluster:
        """
        更新集群
        
        Args:
            cluster_id: 集群ID
            data: 更新数据字典
        
        Returns:
            K8sCluster: 更新后的集群对象
            
        Raises:
            ValueError: 验证失败或集群不存在
            Exception: 更新失败
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        # 获取集群
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            # 检查是否需要重新测试连接
            connection_changed = False
            if 'api_server' in data and data['api_server'] != cluster.api_server:
                connection_changed = True
            if 'auth_type' in data and data['auth_type'] != cluster.auth_type:
                connection_changed = True
            if 'token' in data or 'kubeconfig' in data:
                connection_changed = True
            
            # 如果连接相关字段变更，测试新连接
            if connection_changed:
                api_server = data.get('api_server', cluster.api_server)
                auth_type = data.get('auth_type', cluster.auth_type)
                
                # 验证认证类型
                if auth_type not in ['token', 'kubeconfig']:
                    raise ValueError(f"不支持的认证类型: {auth_type}")
                
                # 准备认证凭据
                credentials = {}
                if auth_type == 'token':
                    token = data.get('token')
                    if not token:
                        # 如果没有提供新token，使用现有的
                        if cluster.auth_type == 'token':
                            token = cluster.get_token()
                        else:
                            raise ValueError("Token认证需要提供token")
                    credentials['token'] = token
                else:
                    kubeconfig = data.get('kubeconfig')
                    if not kubeconfig:
                        # 如果没有提供新kubeconfig，使用现有的
                        if cluster.auth_type == 'kubeconfig':
                            kubeconfig = cluster.get_kubeconfig()
                        else:
                            raise ValueError("Kubeconfig认证需要提供kubeconfig")
                    credentials['kubeconfig'] = kubeconfig
                
                # 测试连接
                success, message = self.client_service.test_connection(
                    api_server,
                    auth_type,
                    credentials
                )
                
                if not success:
                    raise ValueError(f"集群连接测试失败: {message}")
                
                # 关闭旧的客户端连接
                self.client_service.close_client(cluster_id)
                
                # 更新连接状态
                cluster.status = 'online'
                cluster.last_connected_at = datetime.utcnow()
            
            # 更新基本字段
            if 'name' in data:
                cluster.name = data['name']
            if 'api_server' in data:
                cluster.api_server = data['api_server']
            if 'auth_type' in data:
                cluster.auth_type = data['auth_type']
            if 'description' in data:
                cluster.description = data['description']
            
            # 更新认证信息
            if 'token' in data:
                cluster.set_token(data['token'])
            if 'kubeconfig' in data:
                cluster.set_kubeconfig(data['kubeconfig'])
            
            cluster.updated_at = datetime.utcnow()
            
            # 保存到数据库
            db.session.commit()
            
            # 记录操作日志
            self._log_operation(
                cluster_id=cluster.id,
                operation_type='update',
                resource_type='cluster',
                resource_name=cluster.name,
                status='success',
                operation_data=data
            )
            
            logger.info(f"Updated cluster {cluster.id} ({cluster.name})")
            return cluster
            
        except ValueError:
            raise
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to update cluster {cluster_id}: {e}")
            raise Exception(f"更新集群失败: {str(e)}")
    
    def delete_cluster(self, cluster_id: int) -> bool:
        """
        删除集群
        
        Args:
            cluster_id: 集群ID
        
        Returns:
            bool: 是否成功删除
            
        Raises:
            ValueError: 集群不存在
            Exception: 删除失败
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        # 获取集群
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            cluster_name = cluster.name
            
            # 关闭客户端连接
            self.client_service.close_client(cluster_id)
            
            # 删除集群
            db.session.delete(cluster)
            db.session.commit()
            
            # 记录操作日志
            self._log_operation(
                cluster_id=cluster_id,
                operation_type='delete',
                resource_type='cluster',
                resource_name=cluster_name,
                status='success'
            )
            
            logger.info(f"Deleted cluster {cluster_id} ({cluster_name})")
            return True
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to delete cluster {cluster_id}: {e}")
            raise Exception(f"删除集群失败: {str(e)}")
    
    def get_cluster_status(self, cluster_id: int) -> dict:
        """
        获取集群状态
        
        Args:
            cluster_id: 集群ID
        
        Returns:
            dict: 集群状态信息，包含:
                - status: 状态 (online/offline/error)
                - version: K8S版本
                - node_count: 节点数量
                - namespace_count: 命名空间数量
                - pod_count: Pod数量
                - nodes: 节点列表
                - last_connected_at: 最后连接时间
        
        Raises:
            ValueError: 集群不存在
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
            
            # 调试：检查客户端配置
            logger.debug(f"API client configuration - host: {api_client.configuration.host}")
            logger.debug(f"API client configuration - api_key: {bool(api_client.configuration.api_key)}")
            logger.debug(f"API client configuration - api_key_prefix: {api_client.configuration.api_key_prefix}")
            
            # 先测试连接 - 获取版本信息
            version_api = client.VersionApi(api_client)
            version_info = version_api.get_code()
            version_str = f"{version_info.major}.{version_info.minor}"
            
            # 更新版本信息
            cluster.version = version_str
            
            # 获取节点信息
            core_v1 = client.CoreV1Api(api_client)
            nodes_response = core_v1.list_node()
            node_count = len(nodes_response.items)
            
            # 解析节点详情
            nodes_list = []
            for node in nodes_response.items:
                node_info = self._parse_node_info(node)
                nodes_list.append(node_info)
            
            # 获取命名空间信息
            namespaces = core_v1.list_namespace()
            namespace_count = len(namespaces.items)
            
            # 获取所有Pod信息
            pods = core_v1.list_pod_for_all_namespaces()
            pod_count = len(pods.items)
            
            # 更新集群统计信息
            cluster.status = 'online'
            cluster.node_count = node_count
            cluster.namespace_count = namespace_count
            cluster.pod_count = pod_count
            cluster.last_connected_at = datetime.utcnow()
            cluster.last_sync_at = datetime.utcnow()
            
            db.session.commit()
            
            return {
                'status': 'online',
                'version': version_str,
                'node_count': node_count,
                'namespace_count': namespace_count,
                'pod_count': pod_count,
                'nodes': nodes_list,
                'last_connected_at': cluster.last_connected_at.isoformat() if cluster.last_connected_at else None,
                'last_sync_at': cluster.last_sync_at.isoformat() if cluster.last_sync_at else None
            }
            
        except ApiException as e:
            logger.error(f"K8S API error getting cluster status: {e}")
            cluster.status = 'error'
            db.session.commit()
            
            return {
                'status': 'error',
                'version': cluster.version,
                'error': f"K8S API错误: {e.status} - {e.reason}"
            }
            
        except Exception as e:
            error_str = str(e)
            logger.error(f"Failed to get cluster status for {cluster_id}: {error_str}")
            
            # 如果是SSL相关错误，尝试重新获取版本
            if 'SSL' in error_str or 'certificate' in error_str.lower():
                cluster.status = 'error'
                error_msg = f"SSL证书验证失败: {error_str}"
            else:
                cluster.status = 'offline'
                error_msg = error_str
            
            db.session.commit()
            
            return {
                'status': cluster.status,
                'version': cluster.version,
                'error': error_msg
            }
    
    def _parse_node_info(self, node) -> dict:
        """
        解析节点信息
        
        Args:
            node: K8S Node 对象
            
        Returns:
            dict: 节点信息字典
        """
        # 获取节点状态
        status = 'Unknown'
        for condition in node.status.conditions or []:
            if condition.type == 'Ready':
                status = 'Ready' if condition.status == 'True' else 'NotReady'
                break
        
        # 获取节点角色
        roles = []
        for label_key in node.metadata.labels or {}:
            if label_key.startswith('node-role.kubernetes.io/'):
                role = label_key.split('/')[-1]
                roles.append(role)
        if not roles:
            roles = ['worker']
        
        # 获取节点 IP
        internal_ip = ''
        external_ip = ''
        for address in node.status.addresses or []:
            if address.type == 'InternalIP':
                internal_ip = address.address
            elif address.type == 'ExternalIP':
                external_ip = address.address
        
        # 获取节点信息
        node_info = node.status.node_info
        
        # 计算运行时长
        created_at = node.metadata.creation_timestamp
        age = ''
        if created_at:
            from datetime import timezone
            now = datetime.now(timezone.utc)
            delta = now - created_at
            days = delta.days
            if days > 0:
                age = f"{days}d"
            else:
                hours = delta.seconds // 3600
                if hours > 0:
                    age = f"{hours}h"
                else:
                    minutes = delta.seconds // 60
                    age = f"{minutes}m"
        
        return {
            'name': node.metadata.name,
            'status': status,
            'roles': roles,
            'version': node_info.kubelet_version if node_info else '',
            'internal_ip': internal_ip,
            'external_ip': external_ip,
            'os_image': node_info.os_image if node_info else '',
            'container_runtime': node_info.container_runtime_version if node_info else '',
            'age': age,
        }
    
    def _log_operation(self, cluster_id: int, operation_type: str, 
                      resource_type: str, resource_name: str, 
                      status: str, operation_data: dict = None,
                      error_message: str = None) -> None:
        """
        记录操作日志
        
        Args:
            cluster_id: 集群ID
            operation_type: 操作类型
            resource_type: 资源类型
            resource_name: 资源名称
            status: 状态
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
            operation.status = status
            operation.operation_data = operation_data
            operation.error_message = error_message
            
            db.session.add(operation)
            db.session.commit()
            
        except Exception as e:
            logger.error(f"Failed to log operation: {e}")
            # 不抛出异常，避免影响主流程


# 创建全局服务实例
cluster_service = ClusterService()
