from flask import current_app, session, request, g
from flask_wtf.csrf import generate_csrf, validate_csrf, CSRFError
from werkzeug.exceptions import BadRequest
from app.core.config_manager import config_manager
import logging
import time
import hashlib

logger = logging.getLogger(__name__)

class CSRFService:
    """CSRF 服务类"""
    
    def __init__(self):
        self._token_cache = {}
        self._attack_log = []
    
    def generate_token(self):
        """生成 CSRF token"""
        try:
            token = generate_csrf()
            
            # 记录token生成
            self._log_token_activity('generate', token)
            
            return token
        except Exception as e:
            logger.error(f"Failed to generate CSRF token: {e}")
            raise
    
    def validate_token(self, token, secret_key=None):
        """验证 CSRF token"""
        try:
            validate_csrf(token, secret_key)
            
            # 记录成功验证
            self._log_token_activity('validate_success', token)
            
            return True
        except CSRFError as e:
            # 记录验证失败
            self._log_token_activity('validate_failed', token, str(e))
            
            # 记录可能的攻击
            self._log_potential_attack(token, str(e))
            
            logger.warning(f"CSRF token validation failed: {e}")
            return False
        except Exception as e:
            logger.error(f"CSRF token validation error: {e}")
            return False
    
    def is_exempt_endpoint(self, endpoint):
        """检查端点是否免除 CSRF 检查"""
        csrf_config = config_manager.get_csrf_config()
        exempt_endpoints = csrf_config.get('exempt_endpoints', [])
        
        # 默认免除的端点
        default_exempt = [
            'auth.get_public_key',  # 获取公钥不需要 CSRF
            'auth.get_csrf_token',  # 获取 CSRF token 本身不需要验证
            'test.health_check',    # 健康检查
            'test.no_csrf_test',    # 测试端点
        ]
        
        # WebShell 相关端点免除 CSRF（已有 JWT 认证保护）
        webshell_exempt = [
            'hosts.create_webshell_session',
            'hosts.get_webshell_session',
            'hosts.get_webshell_session_status',
            'hosts.get_webshell_command_history',
            'hosts.execute_webshell_command',
            'hosts.resize_webshell_terminal',
            'hosts.terminate_webshell_session',
            'hosts.list_webshell_sessions',
        ]
        
        return endpoint in exempt_endpoints or endpoint in default_exempt or endpoint in webshell_exempt
    
    def should_protect_request(self):
        """判断请求是否需要CSRF保护"""
        # 检查是否在测试环境中禁用了 CSRF
        if not current_app.config.get('WTF_CSRF_ENABLED', True):
            return False
        
        # GET、HEAD、OPTIONS 请求不需要保护
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return False
        
        # 检查端点是否免除
        if request.endpoint and self.is_exempt_endpoint(request.endpoint):
            return False
        
        return True
    
    def get_token_from_request(self):
        """从请求中获取CSRF token"""
        # 优先从请求头获取
        token = request.headers.get('X-CSRFToken')
        if token:
            return token
        
        # 从表单数据获取
        token = request.form.get('csrf_token')
        if token:
            return token
        
        # 从JSON数据获取
        if request.is_json:
            data = request.get_json(silent=True)
            if data and 'csrf_token' in data:
                return data['csrf_token']
        
        return None
    
    def validate_request(self):
        """验证请求的CSRF token"""
        if not self.should_protect_request():
            return True
        
        token = self.get_token_from_request()
        if not token:
            self._log_potential_attack(None, "Missing CSRF token")
            return False
        
        return self.validate_token(token)
    
    def _log_token_activity(self, action, token, error=None):
        """记录token活动"""
        try:
            # 只记录token的哈希值，不记录完整token
            token_hash = hashlib.sha256(token.encode()).hexdigest()[:16] if token else 'None'
            
            log_entry = {
                'timestamp': time.time(),
                'action': action,
                'token_hash': token_hash,
                'ip': request.remote_addr if request else 'Unknown',
                'user_agent': request.headers.get('User-Agent', 'Unknown') if request else 'Unknown',
                'endpoint': request.endpoint if request else 'Unknown',
                'error': error
            }
            
            # 记录到日志
            if action == 'validate_failed':
                logger.warning(f"CSRF validation failed: {log_entry}")
            else:
                logger.debug(f"CSRF activity: {log_entry}")
                
        except Exception as e:
            logger.error(f"Failed to log CSRF activity: {e}")
    
    def _log_potential_attack(self, token, reason):
        """记录潜在的CSRF攻击"""
        try:
            attack_entry = {
                'timestamp': time.time(),
                'ip': request.remote_addr if request else 'Unknown',
                'user_agent': request.headers.get('User-Agent', 'Unknown') if request else 'Unknown',
                'endpoint': request.endpoint if request else 'Unknown',
                'method': request.method if request else 'Unknown',
                'reason': reason,
                'token_provided': token is not None
            }
            
            # 添加到攻击日志
            self._attack_log.append(attack_entry)
            
            # 保持攻击日志大小
            if len(self._attack_log) > 1000:
                self._attack_log = self._attack_log[-500:]
            
            # 记录到日志
            logger.warning(f"Potential CSRF attack detected: {attack_entry}")
            
        except Exception as e:
            logger.error(f"Failed to log potential CSRF attack: {e}")
    
    def get_attack_statistics(self):
        """获取攻击统计信息"""
        try:
            current_time = time.time()
            
            # 最近1小时的攻击
            recent_attacks = [
                attack for attack in self._attack_log
                if current_time - attack['timestamp'] < 3600
            ]
            
            # 按IP统计
            ip_stats = {}
            for attack in recent_attacks:
                ip = attack['ip']
                if ip not in ip_stats:
                    ip_stats[ip] = 0
                ip_stats[ip] += 1
            
            return {
                'total_attacks': len(self._attack_log),
                'recent_attacks_1h': len(recent_attacks),
                'top_attacking_ips': sorted(ip_stats.items(), key=lambda x: x[1], reverse=True)[:10]
            }
            
        except Exception as e:
            logger.error(f"Failed to get attack statistics: {e}")
            return {
                'total_attacks': 0,
                'recent_attacks_1h': 0,
                'top_attacking_ips': []
            }
    
    def clear_attack_log(self):
        """清除攻击日志"""
        self._attack_log.clear()
        logger.info("CSRF attack log cleared")
    
    def get_configuration(self):
        """获取CSRF配置信息"""
        try:
            csrf_config = config_manager.get_csrf_config()
            return {
                'time_limit': csrf_config.get('time_limit', 3600),
                'exempt_endpoints': csrf_config.get('exempt_endpoints', []),
                'protection_enabled': True
            }
        except Exception as e:
            logger.error(f"Failed to get CSRF configuration: {e}")
            return {
                'time_limit': 3600,
                'exempt_endpoints': [],
                'protection_enabled': False
            }

# 全局 CSRF 服务实例
csrf_service = CSRFService()