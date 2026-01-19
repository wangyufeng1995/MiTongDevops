"""
K8S Client Service
Manages Kubernetes API client connections with connection pooling and authentication
"""
import logging
import tempfile
import os
import ssl
from typing import Tuple, Optional, Dict
from kubernetes import client, config
from kubernetes.client.rest import ApiException
import yaml
import urllib3
from urllib3.util.ssl_ import create_urllib3_context

# 全局禁用SSL警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
urllib3.disable_warnings()

# 设置环境变量禁用SSL验证
os.environ['PYTHONHTTPSVERIFY'] = '0'
os.environ['CURL_CA_BUNDLE'] = ''
os.environ['REQUESTS_CA_BUNDLE'] = ''

# 创建不验证证书的SSL上下文
try:
    _ssl_context = ssl.create_default_context()
    _ssl_context.check_hostname = False
    _ssl_context.verify_mode = ssl.CERT_NONE
except Exception:
    _ssl_context = None

# Monkey-patch urllib3 HTTPSConnectionPool 以默认禁用SSL验证
_original_init = urllib3.HTTPSConnectionPool.__init__

def _patched_init(self, *args, **kwargs):
    # 强制设置不验证SSL
    kwargs['cert_reqs'] = 'CERT_NONE'
    kwargs['assert_hostname'] = False
    _original_init(self, *args, **kwargs)

# 应用 monkey-patch
urllib3.HTTPSConnectionPool.__init__ = _patched_init

logger = logging.getLogger(__name__)


class K8sClientService:
    """
    Kubernetes客户端服务
    负责管理K8S API客户端连接，提供连接池和认证管理
    """
    
    # 客户端连接池 - 缓存已创建的客户端
    _client_pool: Dict[int, client.ApiClient] = {}
    
    @classmethod
    def get_client(cls, cluster) -> client.ApiClient:
        """
        获取或创建K8S API客户端
        
        Args:
            cluster: K8sCluster模型实例
            
        Returns:
            kubernetes.client.ApiClient实例
            
        Raises:
            ValueError: 认证类型不支持或配置无效
            Exception: 客户端创建失败
        """
        cluster_id = cluster.id
        
        # 每次都重新创建客户端，确保 SSL 设置正确
        # 先清除旧的缓存
        if cluster_id in cls._client_pool:
            try:
                cls._client_pool[cluster_id].close()
            except:
                pass
            del cls._client_pool[cluster_id]
        
        # 根据认证类型创建新客户端
        try:
            if cluster.auth_type == 'token':
                token = cluster.get_token()
                if not token:
                    raise ValueError("Token is required for token authentication")
                # 调试日志：显示 token 信息（不显示完整 token）
                token_preview = token[:50] + '...' if len(token) > 50 else token
                logger.info(f"Creating K8S client with TOKEN for cluster {cluster_id}, api_server: {cluster.api_server}, token_length: {len(token)}, token_preview: {token_preview}")
                api_client = cls.create_client_from_token(cluster.api_server, token)
            elif cluster.auth_type == 'kubeconfig':
                kubeconfig = cluster.get_kubeconfig()
                if not kubeconfig:
                    raise ValueError("Kubeconfig is required for kubeconfig authentication")
                logger.info(f"Creating K8S client with KUBECONFIG for cluster {cluster_id}, kubeconfig_length: {len(kubeconfig)}")
                api_client = cls.create_client_from_kubeconfig(kubeconfig)
            else:
                raise ValueError(f"Unsupported authentication type: {cluster.auth_type}")
            
            # 缓存客户端到连接池
            cls._client_pool[cluster_id] = api_client
            logger.info(f"Created new K8S client for cluster {cluster_id} ({cluster.name})")
            
            return api_client
            
        except ValueError as ve:
            logger.error(f"Failed to create K8S client for cluster {cluster_id}: ValueError - {ve}")
            raise
        except Exception as e:
            error_type = type(e).__name__
            error_msg = str(e) if str(e) else repr(e)
            logger.error(f"Failed to create K8S client for cluster {cluster_id}: {error_type} - {error_msg}")
            raise Exception(f"创建K8S客户端失败: {error_type} - {error_msg}")
    
    @classmethod
    def create_client_from_token(cls, api_server: str, token: str) -> client.ApiClient:
        """
        使用Token认证创建K8S客户端
        
        Args:
            api_server: K8S API服务器地址 (例如: https://k8s.example.com:6443)
            token: Bearer token
            
        Returns:
            kubernetes.client.ApiClient实例
        """
        # 规范化 API 服务器地址（移除尾部斜杠和空白字符）
        api_server = api_server.strip().rstrip('/')
        
        # 清理 token（移除空白字符）
        token = token.strip()
        
        # 如果 token 已经包含 "Bearer " 前缀，移除它
        if token.lower().startswith('bearer '):
            token = token[7:].strip()
        
        logger.info(f"Creating K8S client - Token length: {len(token)}, first 30 chars: {token[:30] if len(token) > 30 else token}...")
        
        # 创建配置对象
        configuration = client.Configuration()
        configuration.host = api_server
        
        # 设置 Bearer Token 认证 - 直接设置 Authorization header
        # kubernetes 客户端会自动将 api_key["authorization"] 添加到请求头
        configuration.api_key = {"authorization": f"Bearer {token}"}
        
        # 彻底禁用SSL验证
        configuration.verify_ssl = False
        configuration.ssl_ca_cert = None
        configuration.assert_hostname = False
        configuration.cert_file = None
        configuration.key_file = None
        
        # 设置代理相关（避免代理干扰）
        configuration.proxy = None
        
        # 不设置为默认配置，避免影响其他客户端
        # client.Configuration.set_default(configuration)
        
        # 创建API客户端
        api_client = client.ApiClient(configuration)
        
        # 验证配置是否正确设置
        logger.debug(f"Configuration host: {configuration.host}")
        logger.debug(f"Configuration api_key keys: {list(configuration.api_key.keys()) if configuration.api_key else 'None'}")
        logger.debug(f"Configuration verify_ssl: {configuration.verify_ssl}")
        
        # 强制修改rest_client的SSL设置
        try:
            if hasattr(api_client, 'rest_client') and api_client.rest_client:
                rest_client = api_client.rest_client
                if hasattr(rest_client, 'pool_manager'):
                    # 重新创建不验证SSL的连接池
                    rest_client.pool_manager = urllib3.PoolManager(
                        num_pools=4,
                        maxsize=4,
                        cert_reqs='CERT_NONE',
                        assert_hostname=False
                    )
        except Exception as e:
            logger.warning(f"Could not modify pool_manager SSL settings: {e}")
        
        logger.info(f"Created K8S client with token authentication for {api_server}")
        return api_client
    
    @classmethod
    def create_client_from_kubeconfig(cls, kubeconfig_content: str) -> client.ApiClient:
        """
        使用Kubeconfig认证创建K8S客户端
        
        Args:
            kubeconfig_content: Kubeconfig文件内容（YAML格式）
            
        Returns:
            kubernetes.client.ApiClient实例
        """
        logger.info(f"Parsing kubeconfig, content length: {len(kubeconfig_content)}")
        
        # 解析 kubeconfig 内容
        try:
            kubeconfig = yaml.safe_load(kubeconfig_content)
        except Exception as e:
            logger.error(f"Failed to parse kubeconfig YAML: {e}")
            raise ValueError(f"无法解析 Kubeconfig YAML: {e}")
        
        if not kubeconfig:
            raise ValueError("Kubeconfig 内容为空")
        
        logger.info(f"Kubeconfig keys: {kubeconfig.keys() if isinstance(kubeconfig, dict) else 'not a dict'}")
        
        # 获取当前上下文
        current_context_name = kubeconfig.get('current-context')
        if not current_context_name:
            # 如果没有 current-context，尝试使用第一个上下文
            contexts = kubeconfig.get('contexts', [])
            if contexts and len(contexts) > 0:
                current_context_name = contexts[0].get('name')
                logger.warning(f"No current-context specified, using first context: {current_context_name}")
            else:
                raise ValueError("Kubeconfig 中未指定 current-context 且没有可用的上下文")
        
        logger.info(f"Using context: {current_context_name}")
        
        # 查找当前上下文
        contexts = kubeconfig.get('contexts', [])
        current_context = None
        for ctx in contexts:
            if ctx.get('name') == current_context_name:
                current_context = ctx.get('context', {})
                break
        
        if not current_context:
            raise ValueError(f"找不到上下文: {current_context_name}")
        
        # 获取集群和用户名称
        cluster_name = current_context.get('cluster')
        user_name = current_context.get('user')
        
        logger.info(f"Context cluster: {cluster_name}, user: {user_name}")
        
        # 查找集群配置
        clusters = kubeconfig.get('clusters', [])
        cluster_config = None
        for c in clusters:
            if c.get('name') == cluster_name:
                cluster_config = c.get('cluster', {})
                break
        
        if not cluster_config:
            raise ValueError(f"找不到集群配置: {cluster_name}")
        
        api_server = cluster_config.get('server')
        if not api_server:
            raise ValueError("Kubeconfig 中未指定 server")
        
        logger.info(f"API server: {api_server}")
        
        # 查找用户配置
        users = kubeconfig.get('users', [])
        user_config = None
        for u in users:
            if u.get('name') == user_name:
                user_config = u.get('user', {})
                break
        
        if not user_config:
            raise ValueError(f"找不到用户配置: {user_name}")
        
        # 获取认证信息
        token = user_config.get('token')
        client_cert_data = user_config.get('client-certificate-data')
        client_key_data = user_config.get('client-key-data')
        
        logger.info(f"User config - has token: {bool(token)}, has client-certificate-data: {bool(client_cert_data)}, has client-key-data: {bool(client_key_data)}")
        
        # 如果有 token，直接使用 token 方式创建客户端
        if token:
            logger.info(f"Using token authentication from kubeconfig for {api_server}")
            return cls.create_client_from_token(api_server, token)
        
        # 如果有证书认证，使用证书方式
        if client_cert_data and client_key_data:
            logger.info(f"Using certificate authentication from kubeconfig for {api_server}")
            return cls._create_client_with_cert(api_server, client_cert_data, client_key_data, kubeconfig_content)
        
        # 如果都没有，尝试使用 kubeconfig 文件方式（可能有其他认证方式）
        logger.info(f"Using kubeconfig file authentication for {api_server}")
        return cls._create_client_from_kubeconfig_file(kubeconfig_content)
    
    @classmethod
    def _create_client_with_cert(cls, api_server: str, client_cert_data: str, client_key_data: str, kubeconfig_content: str) -> client.ApiClient:
        """
        使用证书认证创建K8S客户端
        """
        import base64
        
        # 创建临时文件保存证书和密钥
        cert_file = None
        key_file = None
        
        try:
            # 解码证书
            cert_content = base64.b64decode(client_cert_data)
            key_content = base64.b64decode(client_key_data)
            
            # 创建临时证书文件
            with tempfile.NamedTemporaryFile(mode='wb', suffix='.crt', delete=False) as f:
                f.write(cert_content)
                cert_file = f.name
            
            # 创建临时密钥文件
            with tempfile.NamedTemporaryFile(mode='wb', suffix='.key', delete=False) as f:
                f.write(key_content)
                key_file = f.name
            
            logger.info(f"Created temp cert file: {cert_file}, key file: {key_file}")
            
            # 创建配置对象
            configuration = client.Configuration()
            configuration.host = api_server.strip().rstrip('/')
            
            # 设置证书认证
            configuration.cert_file = cert_file
            configuration.key_file = key_file
            
            # 禁用SSL验证（但保留证书认证）
            configuration.verify_ssl = False
            configuration.ssl_ca_cert = None
            configuration.assert_hostname = False
            
            # 创建API客户端
            api_client = client.ApiClient(configuration)
            
            # 注意：不能删除临时文件，因为客户端还需要使用它们
            # 将文件路径保存到客户端对象中，以便后续清理
            api_client._temp_cert_file = cert_file
            api_client._temp_key_file = key_file
            
            logger.info(f"Created K8S client with certificate authentication for {api_server}")
            return api_client
            
        except Exception as e:
            # 清理临时文件
            if cert_file and os.path.exists(cert_file):
                os.unlink(cert_file)
            if key_file and os.path.exists(key_file):
                os.unlink(key_file)
            
            error_type = type(e).__name__
            error_msg = str(e) if str(e) else repr(e)
            logger.error(f"Failed to create client with certificate: {error_type} - {error_msg}")
            raise ValueError(f"证书认证创建客户端失败: {error_type} - {error_msg}")
    
    @classmethod
    def _create_client_from_kubeconfig_file(cls, kubeconfig_content: str) -> client.ApiClient:
        """
        使用 kubeconfig 文件创建客户端（作为后备方案）
        """
        # 创建临时文件保存kubeconfig
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as temp_file:
            temp_file.write(kubeconfig_content)
            temp_file_path = temp_file.name
        
        try:
            # 从kubeconfig文件加载配置
            api_client = config.new_client_from_config(config_file=temp_file_path)
            
            # 禁用SSL验证
            api_client.configuration.verify_ssl = False
            api_client.configuration.ssl_ca_cert = None
            api_client.configuration.assert_hostname = False
            
            logger.info("Created K8S client from kubeconfig file")
            return api_client
        except Exception as e:
            error_type = type(e).__name__
            error_msg = str(e) if str(e) else repr(e)
            logger.error(f"Failed to create client from kubeconfig file: {error_type} - {error_msg}")
            raise ValueError(f"从 Kubeconfig 文件创建客户端失败: {error_type} - {error_msg}")
        finally:
            # 清理临时文件
            try:
                os.unlink(temp_file_path)
            except Exception as e:
                logger.warning(f"Failed to delete temporary kubeconfig file: {e}")
    
    @classmethod
    def close_client(cls, cluster_id: int) -> None:
        """
        关闭并移除客户端连接
        
        Args:
            cluster_id: 集群ID
        """
        if cluster_id in cls._client_pool:
            try:
                api_client = cls._client_pool[cluster_id]
                api_client.close()
                del cls._client_pool[cluster_id]
                logger.info(f"Closed K8S client for cluster {cluster_id}")
            except Exception as e:
                logger.error(f"Error closing K8S client for cluster {cluster_id}: {e}")
    
    @classmethod
    def clear_pool(cls) -> None:
        """
        清空所有客户端连接池
        用于测试或重置连接
        """
        for cluster_id in list(cls._client_pool.keys()):
            cls.close_client(cluster_id)
        logger.info("Cleared all K8S client connections")
    
    @classmethod
    def test_connection(cls, api_server: str, auth_type: str, credentials: dict, 
                       timeout: int = 10) -> Tuple[bool, str]:
        """
        测试K8S集群连接
        
        Args:
            api_server: K8S API服务器地址
            auth_type: 认证类型 ('token' 或 'kubeconfig')
            credentials: 认证凭据字典
                - 对于token认证: {'token': 'xxx'}
                - 对于kubeconfig认证: {'kubeconfig': 'xxx'}
            timeout: 连接超时时间（秒）
            
        Returns:
            Tuple[bool, str]: (是否成功, 消息)
        """
        api_client = None
        
        try:
            # 创建临时客户端
            if auth_type == 'token':
                token = credentials.get('token')
                if not token:
                    return False, "Token不能为空"
                api_client = cls.create_client_from_token(api_server, token)
            elif auth_type == 'kubeconfig':
                kubeconfig = credentials.get('kubeconfig')
                if not kubeconfig:
                    return False, "Kubeconfig不能为空"
                api_client = cls.create_client_from_kubeconfig(kubeconfig)
            else:
                return False, f"不支持的认证类型: {auth_type}"
            
            # 再次确保SSL验证已禁用
            api_client.configuration.verify_ssl = False
            api_client.configuration.ssl_ca_cert = None
            api_client.configuration.assert_hostname = False
            
            # 强制重建不验证SSL的连接池
            try:
                if hasattr(api_client, 'rest_client') and api_client.rest_client:
                    api_client.rest_client.pool_manager = urllib3.PoolManager(
                        num_pools=4,
                        maxsize=4,
                        cert_reqs='CERT_NONE',
                        assert_hostname=False,
                        timeout=urllib3.Timeout(connect=timeout, read=timeout)
                    )
            except Exception as e:
                logger.warning(f"Could not modify pool_manager: {e}")
            
            # 尝试获取版本信息来测试连接
            version_api = client.VersionApi(api_client)
            version_info = version_api.get_code()
            
            version_str = f"{version_info.major}.{version_info.minor}"
            logger.info(f"Successfully connected to K8S cluster at {api_server}, version: {version_str}")
            
            return True, f"连接成功，集群版本: {version_str}"
            
        except ApiException as e:
            error_msg = f"K8S API错误: {e.status} - {e.reason}"
            logger.error(f"Connection test failed for {api_server}: {error_msg}")
            
            if e.status == 401:
                return False, "认证失败，请检查Token或Kubeconfig是否正确"
            elif e.status == 403:
                return False, "权限不足，请确认ServiceAccount具有足够的权限"
            else:
                return False, error_msg
                
        except Exception as e:
            error_msg = f"连接失败: {str(e)}"
            logger.error(f"Connection test failed for {api_server}: {error_msg}")
            
            # 检查是否是超时错误
            if "timeout" in str(e).lower() or "timed out" in str(e).lower():
                return False, f"连接超时（{timeout}秒），请检查网络连接和API服务器地址"
            
            return False, error_msg
            
        finally:
            # 清理临时客户端
            if api_client:
                try:
                    api_client.close()
                except Exception:
                    pass


# 创建全局服务实例
k8s_client_service = K8sClientService()
