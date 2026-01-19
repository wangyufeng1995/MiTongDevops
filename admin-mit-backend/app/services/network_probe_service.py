"""
网络探测服务
"""
import time
import json
import logging
import socket
from typing import Dict, Any, Optional, Tuple
from datetime import datetime
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import websocket
import ssl
from urllib.parse import urlparse
from app.extensions import db
from app.models.network import NetworkProbe, NetworkProbeResult
from app.core.config_manager import config_manager

logger = logging.getLogger(__name__)


class NetworkProbeService:
    """网络探测服务类"""
    
    def __init__(self):
        """初始化网络探测服务"""
        self.session = self._create_session()
        self.app_config = config_manager.get_app_config()
    
    def _create_session(self) -> requests.Session:
        """创建带有重试机制的 requests 会话"""
        session = requests.Session()
        
        # 配置重试策略
        retry_strategy = Retry(
            total=3,  # 总重试次数
            backoff_factor=1,  # 重试间隔倍数
            status_forcelist=[429, 500, 502, 503, 504],  # 需要重试的状态码
            allowed_methods=["HEAD", "GET", "POST", "PUT", "DELETE", "OPTIONS", "TRACE"]
        )
        
        # 创建适配器并挂载到会话
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        return session
    
    def execute_websocket_probe(self, probe: NetworkProbe, probe_type: str = 'manual') -> NetworkProbeResult:
        """
        执行 WebSocket 探测
        
        Args:
            probe: 探测任务对象
            probe_type: 探测类型 ('manual' 或 'auto')
            
        Returns:
            NetworkProbeResult: 探测结果对象
        """
        logger.info(f"开始执行 WebSocket 探测: {probe.name} ({probe.target_url})")
        
        start_time = time.time()
        result = NetworkProbeResult(
            tenant_id=probe.tenant_id,
            probe_id=probe.id,
            probe_type=probe_type,
            probed_at=datetime.utcnow()
        )
        
        try:
            # 执行 WebSocket 连接测试
            connection_data = self._test_websocket_connection(probe)
            
            # 计算响应时间
            response_time = int((time.time() - start_time) * 1000)  # 转换为毫秒
            
            # 设置结果数据
            result.status = 'success'
            result.response_time = response_time
            result.status_code = 101  # WebSocket 升级成功状态码
            result.response_body = connection_data['message']
            
            logger.info(f"WebSocket 探测成功: {probe.name}, 响应时间: {response_time}ms")
            
        except websocket.WebSocketTimeoutException:
            result.status = 'timeout'
            result.error_message = f"WebSocket 连接超时 (超过 {probe.timeout} 秒)"
            logger.warning(f"WebSocket 探测超时: {probe.name}")
            
        except websocket.WebSocketConnectionClosedException as e:
            result.status = 'failed'
            result.error_message = f"WebSocket 连接关闭: {str(e)}"
            logger.error(f"WebSocket 探测连接关闭: {probe.name}, 错误: {str(e)}")
            
        except websocket.WebSocketException as e:
            result.status = 'failed'
            result.error_message = f"WebSocket 错误: {str(e)}"
            logger.error(f"WebSocket 探测错误: {probe.name}, 错误: {str(e)}")
            
        except Exception as e:
            result.status = 'failed'
            result.error_message = f"未知错误: {str(e)}"
            logger.error(f"WebSocket 探测未知错误: {probe.name}, 错误: {str(e)}")
        
        # 保存探测结果到数据库
        try:
            db.session.add(result)
            db.session.commit()
            logger.info(f"WebSocket 探测结果已保存: {probe.name}, 状态: {result.status}")
        except Exception as e:
            db.session.rollback()
            logger.error(f"保存 WebSocket 探测结果失败: {probe.name}, 错误: {str(e)}")
            raise
        
        return result
    
    def _test_websocket_connection(self, probe: NetworkProbe) -> Dict[str, Any]:
        """
        测试 WebSocket 连接
        
        Args:
            probe: 探测任务对象
            
        Returns:
            Dict: 包含连接测试结果的字典
        """
        # 解析 URL
        parsed_url = urlparse(probe.target_url)
        
        # 准备连接选项
        connection_options = {
            'timeout': probe.timeout,
            'enable_multithread': True
        }
        
        # 处理 SSL 配置
        if parsed_url.scheme == 'wss':
            connection_options['sslopt'] = {
                'cert_reqs': ssl.CERT_NONE,  # 暂时不验证证书，可根据需要调整
                'check_hostname': False
            }
        
        # 处理请求头
        headers = self._prepare_websocket_headers(probe.headers)
        if headers:
            connection_options['header'] = headers
        
        # 创建 WebSocket 连接
        ws = websocket.WebSocket()
        
        try:
            # 连接到 WebSocket 服务器
            ws.connect(probe.target_url, **connection_options)
            
            # 检查连接状态
            if not ws.connected:
                raise websocket.WebSocketException("WebSocket 连接失败")
            
            # 发送测试消息（如果配置了请求体）
            test_message = probe.body or '{"type": "ping", "message": "connection_test"}'
            ws.send(test_message)
            
            # 尝试接收响应（设置短超时）
            try:
                ws.settimeout(5)  # 5秒超时
                response = ws.recv()
                response_message = f"连接成功，发送: {test_message[:100]}{'...' if len(test_message) > 100 else ''}, 接收: {response[:100]}{'...' if len(response) > 100 else ''}"
            except websocket.WebSocketTimeoutException:
                response_message = f"连接成功，发送: {test_message[:100]}{'...' if len(test_message) > 100 else ''}, 未收到响应（超时）"
            
            return {
                'message': response_message,
                'connected': True
            }
            
        finally:
            # 确保关闭连接
            try:
                ws.close()
            except Exception:
                pass
    
    def _prepare_websocket_headers(self, headers_data: Optional[Dict[str, Any]]) -> Optional[list]:
        """
        准备 WebSocket 请求头
        
        Args:
            headers_data: 原始请求头数据
            
        Returns:
            list: WebSocket 客户端需要的请求头格式
        """
        if not headers_data:
            return None
        
        header_list = []
        
        # 转换为 websocket-client 需要的格式
        for key, value in headers_data.items():
            if isinstance(value, (str, int, float)):
                header_list.append(f"{key}: {value}")
            else:
                header_list.append(f"{key}: {json.dumps(value)}")
        
        return header_list if header_list else None
    
    def execute_http_probe(self, probe: NetworkProbe, probe_type: str = 'manual') -> NetworkProbeResult:
        """
        执行 HTTP/HTTPS 探测
        
        Args:
            probe: 探测任务对象
            probe_type: 探测类型 ('manual' 或 'auto')
            
        Returns:
            NetworkProbeResult: 探测结果对象
        """
        logger.info(f"开始执行 HTTP/HTTPS 探测: {probe.name} ({probe.target_url})")
        
        start_time = time.time()
        result = NetworkProbeResult(
            tenant_id=probe.tenant_id,
            probe_id=probe.id,
            probe_type=probe_type,
            probed_at=datetime.utcnow()
        )
        
        try:
            # 执行 HTTP 请求
            response_data = self._make_http_request(probe)
            
            # 计算响应时间
            response_time = int((time.time() - start_time) * 1000)  # 转换为毫秒
            
            # 根据状态码判断成功/失败
            # 2xx, 3xx, 4xx → success, 5xx → failed
            status_code = response_data['status_code']
            if status_code >= 500:
                result.status = 'failed'
                result.error_message = f"服务器错误: HTTP {status_code}"
            else:
                result.status = 'success'
            
            result.response_time = response_time
            result.status_code = status_code
            result.response_body = response_data['response_body']
            
            logger.info(f"HTTP/HTTPS 探测完成: {probe.name}, 响应时间: {response_time}ms, 状态码: {status_code}, 状态: {result.status}")
            
        except requests.exceptions.Timeout:
            result.status = 'timeout'
            result.error_message = f"请求超时 (超过 {probe.timeout} 秒)"
            logger.warning(f"HTTP/HTTPS 探测超时: {probe.name}")
            
        except requests.exceptions.ConnectionError as e:
            result.status = 'failed'
            result.error_message = f"连接错误: {str(e)}"
            logger.error(f"HTTP/HTTPS 探测连接错误: {probe.name}, 错误: {str(e)}")
            
        except requests.exceptions.RequestException as e:
            result.status = 'failed'
            result.error_message = f"请求错误: {str(e)}"
            logger.error(f"HTTP/HTTPS 探测请求错误: {probe.name}, 错误: {str(e)}")
            
        except Exception as e:
            result.status = 'failed'
            result.error_message = f"未知错误: {str(e)}"
            logger.error(f"HTTP/HTTPS 探测未知错误: {probe.name}, 错误: {str(e)}")
        
        # 保存探测结果到数据库
        try:
            db.session.add(result)
            db.session.commit()
            logger.info(f"探测结果已保存: {probe.name}, 状态: {result.status}")
        except Exception as e:
            db.session.rollback()
            logger.error(f"保存探测结果失败: {probe.name}, 错误: {str(e)}")
            raise
        
        return result
    
    def _make_http_request(self, probe: NetworkProbe) -> Dict[str, Any]:
        """
        执行 HTTP 请求
        
        Args:
            probe: 探测任务对象
            
        Returns:
            Dict: 包含响应数据的字典
        """
        # 准备请求参数
        request_kwargs = {
            'url': probe.target_url,
            'method': probe.method.upper(),
            'timeout': probe.timeout,
            'allow_redirects': True,
            'verify': True if probe.protocol == 'https' else False  # HTTPS 验证证书
        }
        
        # 处理请求头
        headers = self._prepare_headers(probe.headers)
        if headers:
            request_kwargs['headers'] = headers
        
        # 处理请求体
        if probe.method.upper() in ['POST', 'PUT', 'PATCH'] and probe.body:
            request_kwargs['data'] = self._prepare_request_body(probe.body, headers)
        
        # 执行请求
        response = self.session.request(**request_kwargs)
        
        # 处理响应
        response_body = self._process_response_body(response)
        
        return {
            'status_code': response.status_code,
            'response_body': response_body,
            'headers': dict(response.headers)
        }
    
    def _prepare_headers(self, headers_data: Optional[Dict[str, Any]]) -> Dict[str, str]:
        """
        准备请求头
        
        Args:
            headers_data: 原始请求头数据
            
        Returns:
            Dict: 处理后的请求头
        """
        if not headers_data:
            return {}
        
        processed_headers = {}
        
        # 确保所有头部值都是字符串
        for key, value in headers_data.items():
            if isinstance(value, (str, int, float)):
                processed_headers[str(key)] = str(value)
            else:
                processed_headers[str(key)] = json.dumps(value)
        
        # 添加默认 User-Agent
        if 'User-Agent' not in processed_headers:
            processed_headers['User-Agent'] = 'NetworkProbe/1.0'
        
        return processed_headers
    
    def _prepare_request_body(self, body_data: str, headers: Dict[str, str]) -> str:
        """
        准备请求体
        
        Args:
            body_data: 原始请求体数据
            headers: 请求头
            
        Returns:
            str: 处理后的请求体
        """
        if not body_data:
            return ''
        
        # 检查 Content-Type 来决定如何处理请求体
        content_type = headers.get('Content-Type', '').lower()
        
        if 'application/json' in content_type:
            # 验证 JSON 格式
            try:
                json.loads(body_data)
                return body_data
            except json.JSONDecodeError as e:
                logger.warning(f"无效的 JSON 请求体: {str(e)}")
                return body_data
        
        return body_data
    
    def _process_response_body(self, response: requests.Response) -> str:
        """
        处理响应体
        
        Args:
            response: HTTP 响应对象
            
        Returns:
            str: 处理后的响应体（截取前1000字符）
        """
        try:
            # 获取响应内容
            content = response.text
            
            # 截取前1000字符以节省存储空间
            if len(content) > 1000:
                content = content[:1000] + '...[truncated]'
            
            return content
            
        except Exception as e:
            logger.warning(f"处理响应体失败: {str(e)}")
            return f"[无法解析响应体: {str(e)}]"
    
    def validate_probe_config(self, probe_data: Dict[str, Any]) -> Tuple[bool, str]:
        """
        验证探测配置
        
        Args:
            probe_data: 探测配置数据
            
        Returns:
            Tuple[bool, str]: (是否有效, 错误信息)
        """
        # 验证协议
        if probe_data.get('protocol') not in ['http', 'https']:
            return False, "协议必须是 http 或 https"
        
        # 验证 URL
        target_url = probe_data.get('target_url', '').strip()
        if not target_url:
            return False, "目标 URL 不能为空"
        
        if not target_url.startswith(('http://', 'https://')):
            return False, "目标 URL 必须以 http:// 或 https:// 开头"
        
        # 验证请求方法
        method = probe_data.get('method', 'GET').upper()
        if method not in ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH']:
            return False, "不支持的 HTTP 方法"
        
        # 验证超时时间
        timeout = probe_data.get('timeout', 30)
        if not isinstance(timeout, int) or timeout <= 0 or timeout > 300:
            return False, "超时时间必须是 1-300 秒之间的整数"
        
        # 验证请求头格式
        headers = probe_data.get('headers')
        if headers is not None:
            if not isinstance(headers, dict):
                return False, "请求头必须是字典格式"
            
            for key, value in headers.items():
                if not isinstance(key, str):
                    return False, "请求头的键必须是字符串"
        
        # 验证请求体（仅对支持请求体的方法）
        if method in ['POST', 'PUT', 'PATCH']:
            body = probe_data.get('body')
            if body is not None and not isinstance(body, str):
                return False, "请求体必须是字符串格式"
            
            # 如果指定了 JSON Content-Type，验证 JSON 格式
            if headers and 'application/json' in headers.get('Content-Type', '').lower():
                if body:
                    try:
                        json.loads(body)
                    except json.JSONDecodeError:
                        return False, "请求体不是有效的 JSON 格式"
        
        return True, ""
    
    def test_probe_connection(self, probe_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        测试探测连接
        
        Args:
            probe_data: 探测配置数据
            
        Returns:
            Dict: 测试结果
        """
        # 验证配置
        is_valid, error_msg = self.validate_probe_config(probe_data)
        if not is_valid:
            return {
                'success': False,
                'error': error_msg
            }
        
        # 创建临时探测对象
        temp_probe = NetworkProbe(
            name='测试探测',
            protocol=probe_data['protocol'],
            target_url=probe_data['target_url'],
            method=probe_data.get('method', 'GET'),
            headers=probe_data.get('headers'),
            body=probe_data.get('body'),
            timeout=probe_data.get('timeout', 30)
        )
        
        try:
            start_time = time.time()
            response_data = self._make_http_request(temp_probe)
            response_time = int((time.time() - start_time) * 1000)
            
            return {
                'success': True,
                'response_time': response_time,
                'status_code': response_data['status_code'],
                'response_body': response_data['response_body'][:200] + '...' if len(response_data['response_body']) > 200 else response_data['response_body']
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def execute_tcp_probe(self, probe: NetworkProbe, probe_type: str = 'manual') -> NetworkProbeResult:
        """
        执行 TCP 探测
        
        Args:
            probe: 探测任务对象
            probe_type: 探测类型 ('manual' 或 'auto')
            
        Returns:
            NetworkProbeResult: 探测结果对象
        """
        logger.info(f"开始执行 TCP 探测: {probe.name} ({probe.target_url})")
        
        start_time = time.time()
        result = NetworkProbeResult(
            tenant_id=probe.tenant_id,
            probe_id=probe.id,
            probe_type=probe_type,
            probed_at=datetime.utcnow()
        )
        
        try:
            # 解析目标地址和端口
            host, port = self._parse_tcp_udp_target(probe.target_url)
            
            # 执行 TCP 连接测试
            connection_data = self._test_tcp_connection(host, port, probe.timeout)
            
            # 计算响应时间
            response_time = int((time.time() - start_time) * 1000)  # 转换为毫秒
            
            # 设置结果数据
            result.status = 'success'
            result.response_time = response_time
            result.status_code = 0  # TCP 没有状态码，使用 0 表示成功
            result.response_body = connection_data['message']
            
            logger.info(f"TCP 探测成功: {probe.name}, 响应时间: {response_time}ms")
            
        except socket.timeout:
            result.status = 'timeout'
            result.error_message = f"TCP 连接超时 (超过 {probe.timeout} 秒)"
            logger.warning(f"TCP 探测超时: {probe.name}")
            
        except socket.gaierror as e:
            result.status = 'failed'
            result.error_message = f"DNS 解析失败: {str(e)}"
            logger.error(f"TCP 探测 DNS 解析失败: {probe.name}, 错误: {str(e)}")
            
        except ConnectionRefusedError:
            result.status = 'failed'
            result.error_message = "连接被拒绝，目标端口可能未开放"
            logger.error(f"TCP 探测连接被拒绝: {probe.name}")
            
        except OSError as e:
            result.status = 'failed'
            result.error_message = f"网络错误: {str(e)}"
            logger.error(f"TCP 探测网络错误: {probe.name}, 错误: {str(e)}")
            
        except Exception as e:
            result.status = 'failed'
            result.error_message = f"未知错误: {str(e)}"
            logger.error(f"TCP 探测未知错误: {probe.name}, 错误: {str(e)}")
        
        # 保存探测结果到数据库
        try:
            db.session.add(result)
            db.session.commit()
            logger.info(f"TCP 探测结果已保存: {probe.name}, 状态: {result.status}")
        except Exception as e:
            db.session.rollback()
            logger.error(f"保存 TCP 探测结果失败: {probe.name}, 错误: {str(e)}")
            raise
        
        return result
    
    def execute_udp_probe(self, probe: NetworkProbe, probe_type: str = 'manual') -> NetworkProbeResult:
        """
        执行 UDP 探测
        
        Args:
            probe: 探测任务对象
            probe_type: 探测类型 ('manual' 或 'auto')
            
        Returns:
            NetworkProbeResult: 探测结果对象
        """
        logger.info(f"开始执行 UDP 探测: {probe.name} ({probe.target_url})")
        
        start_time = time.time()
        result = NetworkProbeResult(
            tenant_id=probe.tenant_id,
            probe_id=probe.id,
            probe_type=probe_type,
            probed_at=datetime.utcnow()
        )
        
        try:
            # 解析目标地址和端口
            host, port = self._parse_tcp_udp_target(probe.target_url)
            
            # 执行 UDP 探测
            connection_data = self._test_udp_connection(host, port, probe.timeout, probe.body)
            
            # 计算响应时间
            response_time = int((time.time() - start_time) * 1000)  # 转换为毫秒
            
            # 设置结果数据
            result.status = 'success'
            result.response_time = response_time
            result.status_code = 0  # UDP 没有状态码，使用 0 表示成功
            result.response_body = connection_data['message']
            
            logger.info(f"UDP 探测成功: {probe.name}, 响应时间: {response_time}ms")
            
        except socket.timeout:
            result.status = 'timeout'
            result.error_message = f"UDP 探测超时 (超过 {probe.timeout} 秒)"
            logger.warning(f"UDP 探测超时: {probe.name}")
            
        except socket.gaierror as e:
            result.status = 'failed'
            result.error_message = f"DNS 解析失败: {str(e)}"
            logger.error(f"UDP 探测 DNS 解析失败: {probe.name}, 错误: {str(e)}")
            
        except OSError as e:
            result.status = 'failed'
            result.error_message = f"网络错误: {str(e)}"
            logger.error(f"UDP 探测网络错误: {probe.name}, 错误: {str(e)}")
            
        except Exception as e:
            result.status = 'failed'
            result.error_message = f"未知错误: {str(e)}"
            logger.error(f"UDP 探测未知错误: {probe.name}, 错误: {str(e)}")
        
        # 保存探测结果到数据库
        try:
            db.session.add(result)
            db.session.commit()
            logger.info(f"UDP 探测结果已保存: {probe.name}, 状态: {result.status}")
        except Exception as e:
            db.session.rollback()
            logger.error(f"保存 UDP 探测结果失败: {probe.name}, 错误: {str(e)}")
            raise
        
        return result
    
    def _parse_tcp_udp_target(self, target_url: str) -> Tuple[str, int]:
        """
        解析 TCP/UDP 目标地址和端口
        
        Args:
            target_url: 目标 URL (格式: tcp://host:port 或 udp://host:port 或 host:port)
            
        Returns:
            Tuple[str, int]: (主机地址, 端口号)
            
        Raises:
            ValueError: 如果 URL 格式无效
        """
        # 移除协议前缀（如果存在）
        url = target_url
        if '://' in url:
            url = url.split('://', 1)[1]
        
        # 解析主机和端口
        if ':' not in url:
            raise ValueError("目标地址必须包含端口号，格式: host:port")
        
        parts = url.rsplit(':', 1)
        host = parts[0].strip()
        
        try:
            port = int(parts[1].strip())
        except ValueError:
            raise ValueError(f"无效的端口号: {parts[1]}")
        
        if port < 1 or port > 65535:
            raise ValueError(f"端口号必须在 1-65535 之间: {port}")
        
        if not host:
            raise ValueError("主机地址不能为空")
        
        return host, port
    
    def _test_tcp_connection(self, host: str, port: int, timeout: int) -> Dict[str, Any]:
        """
        测试 TCP 连接
        
        Args:
            host: 目标主机
            port: 目标端口
            timeout: 超时时间（秒）
            
        Returns:
            Dict: 包含连接测试结果的字典
        """
        sock = None
        try:
            # 创建 TCP socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            
            # 记录连接开始时间
            connect_start = time.time()
            
            # 尝试连接
            sock.connect((host, port))
            
            # 计算连接延迟
            connect_time = int((time.time() - connect_start) * 1000)  # 毫秒
            
            return {
                'message': f"TCP 连接成功: {host}:{port}, 连接延迟: {connect_time}ms",
                'connected': True,
                'latency': connect_time
            }
            
        finally:
            # 确保关闭 socket
            if sock:
                try:
                    sock.close()
                except Exception:
                    pass
    
    def _test_udp_connection(self, host: str, port: int, timeout: int, test_data: Optional[str] = None) -> Dict[str, Any]:
        """
        测试 UDP 连接
        
        Args:
            host: 目标主机
            port: 目标端口
            timeout: 超时时间（秒）
            test_data: 测试数据（可选）
            
        Returns:
            Dict: 包含连接测试结果的字典
        """
        sock = None
        try:
            # 创建 UDP socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(timeout)
            
            # 准备测试数据
            if test_data:
                message = test_data.encode('utf-8')
            else:
                message = b'ping'
            
            # 记录发送开始时间
            send_start = time.time()
            
            # 发送数据
            sock.sendto(message, (host, port))
            
            # 尝试接收响应
            try:
                data, addr = sock.recvfrom(4096)
                
                # 计算往返延迟
                rtt = int((time.time() - send_start) * 1000)  # 毫秒
                
                response_preview = data[:100].decode('utf-8', errors='ignore')
                if len(data) > 100:
                    response_preview += '...'
                
                return {
                    'message': f"UDP 探测成功: {host}:{port}, 往返延迟: {rtt}ms, 收到响应: {response_preview}",
                    'connected': True,
                    'latency': rtt,
                    'response_received': True
                }
                
            except socket.timeout:
                # UDP 是无连接协议，没有收到响应不一定表示失败
                # 数据可能已经发送成功，只是没有响应
                send_time = int((time.time() - send_start) * 1000)
                
                return {
                    'message': f"UDP 数据已发送到 {host}:{port}, 发送耗时: {send_time}ms (未收到响应，这对于 UDP 是正常的)",
                    'connected': True,
                    'latency': send_time,
                    'response_received': False
                }
            
        finally:
            # 确保关闭 socket
            if sock:
                try:
                    sock.close()
                except Exception:
                    pass
    
    def get_probe_statistics(self, probe_id: int, days: int = 7) -> Dict[str, Any]:
        """
        获取探测统计信息
        
        Args:
            probe_id: 探测任务 ID
            days: 统计天数
            
        Returns:
            Dict: 统计信息
        """
        from datetime import timedelta
        
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # 查询指定时间范围内的探测结果
        results = NetworkProbeResult.query.filter(
            NetworkProbeResult.probe_id == probe_id,
            NetworkProbeResult.probed_at >= start_date,
            NetworkProbeResult.probed_at <= end_date
        ).all()
        
        if not results:
            return {
                'total_probes': 0,
                'success_rate': 0,
                'average_response_time': 0,
                'status_distribution': {}
            }
        
        # 计算统计信息
        total_probes = len(results)
        success_count = len([r for r in results if r.status == 'success'])
        success_rate = (success_count / total_probes) * 100 if total_probes > 0 else 0
        
        # 计算平均响应时间（仅成功的请求）
        successful_results = [r for r in results if r.status == 'success' and r.response_time is not None]
        average_response_time = sum(r.response_time for r in successful_results) / len(successful_results) if successful_results else 0
        
        # 状态分布
        status_distribution = {}
        for result in results:
            status = result.status
            status_distribution[status] = status_distribution.get(status, 0) + 1
        
        return {
            'total_probes': total_probes,
            'success_rate': round(success_rate, 2),
            'average_response_time': round(average_response_time, 2),
            'status_distribution': status_distribution
        }


# 创建全局服务实例
network_probe_service = NetworkProbeService()