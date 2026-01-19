"""
K8S Service Discovery Service
Handles Service and Ingress operations
"""
import logging
from typing import List, Dict, Optional
from flask import g
from kubernetes import client
from kubernetes.client.rest import ApiException

from app.models.k8s_cluster import K8sCluster
from .client_service import K8sClientService

logger = logging.getLogger(__name__)


class ServiceDiscoveryService:
    """
    服务发现管理服务
    处理Service和Ingress的操作
    """
    
    def __init__(self):
        self.client_service = K8sClientService()
    
    def list_services(self, cluster_id: int, namespace: str) -> List[Dict]:
        """
        获取Service列表
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
        
        Returns:
            List[Dict]: Service列表
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
            
            services = core_v1.list_namespaced_service(namespace=namespace)
            
            result = []
            for svc in services.items:
                # 获取端口映射
                ports = []
                if svc.spec.ports:
                    for port in svc.spec.ports:
                        port_info = {
                            'name': port.name,
                            'protocol': port.protocol,
                            'port': port.port,
                            'target_port': str(port.target_port) if port.target_port else None,
                            'node_port': port.node_port
                        }
                        ports.append(port_info)
                
                service_data = {
                    'name': svc.metadata.name,
                    'namespace': svc.metadata.namespace,
                    'type': svc.spec.type,
                    'cluster_ip': svc.spec.cluster_ip,
                    'external_ips': svc.spec.external_i_ps or [],
                    'ports': ports,
                    'selector': svc.spec.selector or {},
                    'session_affinity': svc.spec.session_affinity,
                    'created_at': svc.metadata.creation_timestamp.isoformat() if svc.metadata.creation_timestamp else None,
                    'labels': svc.metadata.labels or {},
                    'uid': svc.metadata.uid
                }
                
                # 添加LoadBalancer特定信息
                if svc.spec.type == 'LoadBalancer' and svc.status.load_balancer:
                    ingress_list = svc.status.load_balancer.ingress or []
                    external_ips = []
                    for ing in ingress_list:
                        if ing.ip:
                            external_ips.append(ing.ip)
                        elif ing.hostname:
                            external_ips.append(ing.hostname)
                    service_data['load_balancer_ips'] = external_ips
                
                result.append(service_data)
            
            logger.info(f"Listed {len(result)} services in namespace '{namespace}' for cluster {cluster_id}")
            return result
            
        except ApiException as e:
            logger.error(f"K8S API error listing services: {e}")
            raise Exception(f"获取Service列表失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to list services: {e}")
            raise Exception(f"获取Service列表失败: {str(e)}")
    
    def get_service_detail(self, cluster_id: int, namespace: str, name: str) -> Dict:
        """
        获取Service详情
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            name: Service名称
        
        Returns:
            Dict: Service详情
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
            
            # 获取Service
            svc = core_v1.read_namespaced_service(name=name, namespace=namespace)
            
            # 获取端口映射
            ports = []
            if svc.spec.ports:
                for port in svc.spec.ports:
                    port_info = {
                        'name': port.name,
                        'protocol': port.protocol,
                        'port': port.port,
                        'target_port': str(port.target_port) if port.target_port else None,
                        'node_port': port.node_port
                    }
                    ports.append(port_info)
            
            service_data = {
                'name': svc.metadata.name,
                'namespace': svc.metadata.namespace,
                'type': svc.spec.type,
                'cluster_ip': svc.spec.cluster_ip,
                'external_ips': svc.spec.external_i_ps or [],
                'ports': ports,
                'selector': svc.spec.selector or {},
                'session_affinity': svc.spec.session_affinity,
                'created_at': svc.metadata.creation_timestamp.isoformat() if svc.metadata.creation_timestamp else None,
                'labels': svc.metadata.labels or {},
                'annotations': svc.metadata.annotations or {},
                'uid': svc.metadata.uid
            }
            
            # 添加LoadBalancer特定信息
            if svc.spec.type == 'LoadBalancer' and svc.status.load_balancer:
                ingress_list = svc.status.load_balancer.ingress or []
                external_ips = []
                for ing in ingress_list:
                    if ing.ip:
                        external_ips.append(ing.ip)
                    elif ing.hostname:
                        external_ips.append(ing.hostname)
                service_data['load_balancer_ips'] = external_ips
            
            logger.info(f"Retrieved service detail for '{name}' in namespace '{namespace}'")
            return service_data
            
        except ApiException as e:
            if e.status == 404:
                raise ValueError(f"Service '{name}' 不存在于命名空间 '{namespace}'")
            logger.error(f"K8S API error getting service detail: {e}")
            raise Exception(f"获取Service详情失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to get service detail: {e}")
            raise Exception(f"获取Service详情失败: {str(e)}")
    
    def list_ingresses(self, cluster_id: int, namespace: str) -> List[Dict]:
        """
        获取Ingress列表
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
        
        Returns:
            List[Dict]: Ingress列表
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            networking_v1 = client.NetworkingV1Api(api_client)
            
            ingresses = networking_v1.list_namespaced_ingress(namespace=namespace)
            
            result = []
            for ing in ingresses.items:
                # 获取规则
                rules = []
                if ing.spec.rules:
                    for rule in ing.spec.rules:
                        rule_info = {
                            'host': rule.host,
                            'paths': []
                        }
                        
                        if rule.http and rule.http.paths:
                            for path in rule.http.paths:
                                path_info = {
                                    'path': path.path,
                                    'path_type': path.path_type,
                                    'backend': {
                                        'service_name': path.backend.service.name if path.backend.service else None,
                                        'service_port': path.backend.service.port.number if path.backend.service and path.backend.service.port else None
                                    }
                                }
                                rule_info['paths'].append(path_info)
                        
                        rules.append(rule_info)
                
                # 获取TLS配置
                tls_configs = []
                if ing.spec.tls:
                    for tls in ing.spec.tls:
                        tls_info = {
                            'hosts': tls.hosts or [],
                            'secret_name': tls.secret_name
                        }
                        tls_configs.append(tls_info)
                
                # 获取负载均衡器地址
                load_balancer_ips = []
                if ing.status.load_balancer and ing.status.load_balancer.ingress:
                    for lb_ing in ing.status.load_balancer.ingress:
                        if lb_ing.ip:
                            load_balancer_ips.append(lb_ing.ip)
                        elif lb_ing.hostname:
                            load_balancer_ips.append(lb_ing.hostname)
                
                ingress_data = {
                    'name': ing.metadata.name,
                    'namespace': ing.metadata.namespace,
                    'rules': rules,
                    'tls': tls_configs,
                    'ingress_class': ing.spec.ingress_class_name,
                    'load_balancer_ips': load_balancer_ips,
                    'created_at': ing.metadata.creation_timestamp.isoformat() if ing.metadata.creation_timestamp else None,
                    'labels': ing.metadata.labels or {},
                    'annotations': ing.metadata.annotations or {},
                    'uid': ing.metadata.uid
                }
                
                result.append(ingress_data)
            
            logger.info(f"Listed {len(result)} ingresses in namespace '{namespace}' for cluster {cluster_id}")
            return result
            
        except ApiException as e:
            logger.error(f"K8S API error listing ingresses: {e}")
            raise Exception(f"获取Ingress列表失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to list ingresses: {e}")
            raise Exception(f"获取Ingress列表失败: {str(e)}")
    
    def get_service_endpoints(self, cluster_id: int, namespace: str, name: str) -> Dict:
        """
        获取Service的Endpoints信息
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            name: Service名称
        
        Returns:
            Dict: Endpoints信息，包含关联的Pod列表
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
            
            # 获取Service信息
            try:
                service = core_v1.read_namespaced_service(name=name, namespace=namespace)
            except ApiException as e:
                if e.status == 404:
                    raise ValueError(f"Service '{name}' 不存在于命名空间 '{namespace}'")
                raise
            
            # 获取Endpoints
            try:
                endpoints = core_v1.read_namespaced_endpoints(name=name, namespace=namespace)
            except ApiException as e:
                if e.status == 404:
                    # Endpoints不存在，返回空列表
                    endpoints = None
                else:
                    raise
            
            # 解析Endpoints
            endpoint_list = []
            pod_list = []
            
            if endpoints and endpoints.subsets:
                for subset in endpoints.subsets:
                    # 获取端口信息
                    ports = []
                    if subset.ports:
                        for port in subset.ports:
                            ports.append({
                                'name': port.name,
                                'port': port.port,
                                'protocol': port.protocol
                            })
                    
                    # 获取就绪的地址
                    if subset.addresses:
                        for addr in subset.addresses:
                            endpoint_info = {
                                'ip': addr.ip,
                                'hostname': addr.hostname,
                                'node_name': addr.node_name,
                                'ports': ports
                            }
                            
                            # 如果有关联的Pod，获取Pod信息
                            if addr.target_ref and addr.target_ref.kind == 'Pod':
                                pod_name = addr.target_ref.name
                                endpoint_info['pod_name'] = pod_name
                                
                                # 获取Pod详细信息
                                try:
                                    pod = core_v1.read_namespaced_pod(name=pod_name, namespace=namespace)
                                    pod_info = {
                                        'name': pod.metadata.name,
                                        'namespace': pod.metadata.namespace,
                                        'ip': pod.status.pod_ip,
                                        'node': pod.spec.node_name,
                                        'phase': pod.status.phase,
                                        'ready': self._is_pod_ready(pod),
                                        'created_at': pod.metadata.creation_timestamp.isoformat() if pod.metadata.creation_timestamp else None
                                    }
                                    pod_list.append(pod_info)
                                except ApiException:
                                    # Pod可能已被删除，忽略错误
                                    pass
                            
                            endpoint_list.append(endpoint_info)
                    
                    # 获取未就绪的地址
                    if subset.not_ready_addresses:
                        for addr in subset.not_ready_addresses:
                            endpoint_info = {
                                'ip': addr.ip,
                                'hostname': addr.hostname,
                                'node_name': addr.node_name,
                                'ports': ports,
                                'ready': False
                            }
                            
                            if addr.target_ref and addr.target_ref.kind == 'Pod':
                                endpoint_info['pod_name'] = addr.target_ref.name
                            
                            endpoint_list.append(endpoint_info)
            
            result = {
                'service_name': name,
                'namespace': namespace,
                'service_type': service.spec.type,
                'cluster_ip': service.spec.cluster_ip,
                'selector': service.spec.selector or {},
                'endpoints': endpoint_list,
                'pods': pod_list,
                'endpoint_count': len(endpoint_list),
                'ready_pod_count': len([p for p in pod_list if p.get('ready')])
            }
            
            logger.info(f"Retrieved endpoints for service '{name}' in namespace '{namespace}'")
            return result
            
        except ValueError:
            raise
        except ApiException as e:
            logger.error(f"K8S API error getting service endpoints: {e}")
            raise Exception(f"获取Service Endpoints失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to get service endpoints: {e}")
            raise Exception(f"获取Service Endpoints失败: {str(e)}")
    
    def _is_pod_ready(self, pod) -> bool:
        """
        检查Pod是否就绪
        
        Args:
            pod: Pod对象
        
        Returns:
            bool: Pod是否就绪
        """
        if not pod.status.conditions:
            return False
        
        for condition in pod.status.conditions:
            if condition.type == 'Ready':
                return condition.status == 'True'
        
        return False
    
    def get_service_yaml(self, cluster_id: int, namespace: str, name: str) -> str:
        """
        获取Service的YAML配置
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            name: Service名称
        
        Returns:
            str: YAML格式的配置
        """
        import yaml as pyyaml
        
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            core_v1 = client.CoreV1Api(api_client)
            
            # 获取Service
            service = core_v1.read_namespaced_service(name=name, namespace=namespace)
            
            # 转换为字典并清理不需要的字段
            service_dict = api_client.sanitize_for_serialization(service)
            
            # 清理管理字段
            if 'metadata' in service_dict:
                service_dict['metadata'].pop('managedFields', None)
                service_dict['metadata'].pop('resourceVersion', None)
                service_dict['metadata'].pop('uid', None)
                service_dict['metadata'].pop('creationTimestamp', None)
                service_dict['metadata'].pop('selfLink', None)
            
            # 清理status字段
            service_dict.pop('status', None)
            
            # 转换为YAML
            yaml_content = pyyaml.dump(service_dict, default_flow_style=False, allow_unicode=True, sort_keys=False)
            
            logger.info(f"Retrieved YAML for service '{name}' in namespace '{namespace}'")
            return yaml_content
            
        except ApiException as e:
            if e.status == 404:
                raise ValueError(f"Service '{name}' 不存在于命名空间 '{namespace}'")
            logger.error(f"K8S API error getting service YAML: {e}")
            raise Exception(f"获取Service YAML失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to get service YAML: {e}")
            raise Exception(f"获取Service YAML失败: {str(e)}")
    
    def get_ingress_yaml(self, cluster_id: int, namespace: str, name: str) -> str:
        """
        获取Ingress的YAML配置
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            name: Ingress名称
        
        Returns:
            str: YAML格式的配置
        """
        import yaml as pyyaml
        
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            networking_v1 = client.NetworkingV1Api(api_client)
            
            # 获取Ingress
            ingress = networking_v1.read_namespaced_ingress(name=name, namespace=namespace)
            
            # 转换为字典并清理不需要的字段
            ingress_dict = api_client.sanitize_for_serialization(ingress)
            
            # 清理管理字段
            if 'metadata' in ingress_dict:
                ingress_dict['metadata'].pop('managedFields', None)
                ingress_dict['metadata'].pop('resourceVersion', None)
                ingress_dict['metadata'].pop('uid', None)
                ingress_dict['metadata'].pop('creationTimestamp', None)
                ingress_dict['metadata'].pop('selfLink', None)
                ingress_dict['metadata'].pop('generation', None)
            
            # 清理status字段
            ingress_dict.pop('status', None)
            
            # 转换为YAML
            yaml_content = pyyaml.dump(ingress_dict, default_flow_style=False, allow_unicode=True, sort_keys=False)
            
            logger.info(f"Retrieved YAML for ingress '{name}' in namespace '{namespace}'")
            return yaml_content
            
        except ApiException as e:
            if e.status == 404:
                raise ValueError(f"Ingress '{name}' 不存在于命名空间 '{namespace}'")
            logger.error(f"K8S API error getting ingress YAML: {e}")
            raise Exception(f"获取Ingress YAML失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to get ingress YAML: {e}")
            raise Exception(f"获取Ingress YAML失败: {str(e)}")
    
    def update_service(self, cluster_id: int, namespace: str, name: str, yaml_content: str) -> Dict:
        """
        更新Service配置
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            name: Service名称
            yaml_content: YAML配置内容
        
        Returns:
            Dict: 更新结果
        """
        import yaml as pyyaml
        
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            # 解析YAML
            try:
                service_spec = pyyaml.safe_load(yaml_content)
            except pyyaml.YAMLError as e:
                raise ValueError(f"YAML格式错误: {str(e)}")
            
            if not service_spec:
                raise ValueError("YAML内容为空")
            
            # 验证资源类型
            kind = service_spec.get('kind', '').lower()
            if kind != 'service':
                raise ValueError(f"资源类型不匹配，期望Service，实际为{service_spec.get('kind')}")
            
            api_client = self.client_service.get_client(cluster)
            core_v1 = client.CoreV1Api(api_client)
            
            # 确保metadata中的name和namespace正确
            if 'metadata' not in service_spec:
                service_spec['metadata'] = {}
            service_spec['metadata']['name'] = name
            service_spec['metadata']['namespace'] = namespace
            
            # 更新Service
            result = core_v1.replace_namespaced_service(
                name=name,
                namespace=namespace,
                body=service_spec
            )
            
            logger.info(f"Updated service '{name}' in namespace '{namespace}'")
            
            return {
                'success': True,
                'message': f"Service '{name}' 更新成功",
                'name': name,
                'namespace': namespace,
                'kind': 'Service'
            }
            
        except ValueError:
            raise
        except ApiException as e:
            if e.status == 404:
                raise ValueError(f"Service '{name}' 不存在于命名空间 '{namespace}'")
            error_body = ''
            if e.body:
                try:
                    import json
                    body = json.loads(e.body)
                    error_body = body.get('message', str(e.body))
                except:
                    error_body = str(e.body)
            logger.error(f"K8S API error updating service: {e}")
            raise Exception(f"更新Service失败: {e.status} - {e.reason}. {error_body}")
        except Exception as e:
            logger.error(f"Failed to update service: {e}")
            raise Exception(f"更新Service失败: {str(e)}")
    
    def update_ingress(self, cluster_id: int, namespace: str, name: str, yaml_content: str) -> Dict:
        """
        更新Ingress配置
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            name: Ingress名称
            yaml_content: YAML配置内容
        
        Returns:
            Dict: 更新结果
        """
        import yaml as pyyaml
        
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            # 解析YAML
            try:
                ingress_spec = pyyaml.safe_load(yaml_content)
            except pyyaml.YAMLError as e:
                raise ValueError(f"YAML格式错误: {str(e)}")
            
            if not ingress_spec:
                raise ValueError("YAML内容为空")
            
            # 验证资源类型
            kind = ingress_spec.get('kind', '').lower()
            if kind != 'ingress':
                raise ValueError(f"资源类型不匹配，期望Ingress，实际为{ingress_spec.get('kind')}")
            
            api_client = self.client_service.get_client(cluster)
            networking_v1 = client.NetworkingV1Api(api_client)
            
            # 确保metadata中的name和namespace正确
            if 'metadata' not in ingress_spec:
                ingress_spec['metadata'] = {}
            ingress_spec['metadata']['name'] = name
            ingress_spec['metadata']['namespace'] = namespace
            
            # 更新Ingress
            result = networking_v1.replace_namespaced_ingress(
                name=name,
                namespace=namespace,
                body=ingress_spec
            )
            
            logger.info(f"Updated ingress '{name}' in namespace '{namespace}'")
            
            return {
                'success': True,
                'message': f"Ingress '{name}' 更新成功",
                'name': name,
                'namespace': namespace,
                'kind': 'Ingress'
            }
            
        except ValueError:
            raise
        except ApiException as e:
            if e.status == 404:
                raise ValueError(f"Ingress '{name}' 不存在于命名空间 '{namespace}'")
            error_body = ''
            if e.body:
                try:
                    import json
                    body = json.loads(e.body)
                    error_body = body.get('message', str(e.body))
                except:
                    error_body = str(e.body)
            logger.error(f"K8S API error updating ingress: {e}")
            raise Exception(f"更新Ingress失败: {e.status} - {e.reason}. {error_body}")
        except Exception as e:
            logger.error(f"Failed to update ingress: {e}")
            raise Exception(f"更新Ingress失败: {str(e)}")
    
    def delete_service(self, cluster_id: int, namespace: str, name: str) -> Dict:
        """
        删除Service
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            name: Service名称
        
        Returns:
            Dict: 删除结果
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
            
            # 删除Service
            core_v1.delete_namespaced_service(name=name, namespace=namespace)
            
            logger.info(f"Deleted service '{name}' in namespace '{namespace}'")
            
            return {
                'success': True,
                'message': f"Service '{name}' 删除成功",
                'name': name,
                'namespace': namespace,
                'kind': 'Service'
            }
            
        except ApiException as e:
            if e.status == 404:
                raise ValueError(f"Service '{name}' 不存在于命名空间 '{namespace}'")
            logger.error(f"K8S API error deleting service: {e}")
            raise Exception(f"删除Service失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to delete service: {e}")
            raise Exception(f"删除Service失败: {str(e)}")
    
    def delete_ingress(self, cluster_id: int, namespace: str, name: str) -> Dict:
        """
        删除Ingress
        
        Args:
            cluster_id: 集群ID
            namespace: 命名空间
            name: Ingress名称
        
        Returns:
            Dict: 删除结果
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if not tenant_id:
            raise ValueError("租户ID不能为空")
        
        cluster = K8sCluster.get_by_tenant(cluster_id, tenant_id)
        if not cluster:
            raise ValueError(f"集群 {cluster_id} 不存在")
        
        try:
            api_client = self.client_service.get_client(cluster)
            networking_v1 = client.NetworkingV1Api(api_client)
            
            # 删除Ingress
            networking_v1.delete_namespaced_ingress(name=name, namespace=namespace)
            
            logger.info(f"Deleted ingress '{name}' in namespace '{namespace}'")
            
            return {
                'success': True,
                'message': f"Ingress '{name}' 删除成功",
                'name': name,
                'namespace': namespace,
                'kind': 'Ingress'
            }
            
        except ApiException as e:
            if e.status == 404:
                raise ValueError(f"Ingress '{name}' 不存在于命名空间 '{namespace}'")
            logger.error(f"K8S API error deleting ingress: {e}")
            raise Exception(f"删除Ingress失败: {e.status} - {e.reason}")
        except Exception as e:
            logger.error(f"Failed to delete ingress: {e}")
            raise Exception(f"删除Ingress失败: {str(e)}")


# 创建全局服务实例
service_discovery_service = ServiceDiscoveryService()
