"""
认证指标监控服务
用于收集和导出认证相关的 Prometheus 指标
"""
import redis
from app.core.config_manager import config_manager
from typing import Dict, Any
import logging
import time

logger = logging.getLogger(__name__)


class AuthMetricsService:
    """认证指标监控服务"""
    
    # Redis 键前缀
    METRICS_PREFIX = "auth_metrics"
    
    # 指标键名
    LOGIN_SUCCESS_KEY = f"{METRICS_PREFIX}:login_success"
    LOGIN_FAILED_KEY = f"{METRICS_PREFIX}:login_failed"
    LOGOUT_KEY = f"{METRICS_PREFIX}:logout"
    TOKEN_REFRESH_KEY = f"{METRICS_PREFIX}:token_refresh"
    TOKEN_REFRESH_FAILED_KEY = f"{METRICS_PREFIX}:token_refresh_failed"
    AUTH_VERIFICATION_KEY = f"{METRICS_PREFIX}:auth_verification"
    AUTH_VERIFICATION_FAILED_KEY = f"{METRICS_PREFIX}:auth_verification_failed"
    ACTIVE_SESSIONS_KEY = f"{METRICS_PREFIX}:active_sessions"
    
    # 失败原因计数器键前缀
    FAILURE_REASON_PREFIX = f"{METRICS_PREFIX}:failure_reason"
    
    def __init__(self):
        """初始化认证指标服务"""
        try:
            redis_config = config_manager.get_redis_config()
            self.redis_client = redis.Redis(
                host=redis_config.get('host', 'localhost'),
                port=redis_config.get('port', 6379),
                db=redis_config.get('db', 0),
                password=redis_config.get('password'),
                decode_responses=True,
                socket_timeout=5
            )
            # 测试连接
            self.redis_client.ping()
            logger.info("AuthMetricsService initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize AuthMetricsService: {e}")
            self.redis_client = None
    
    def increment_login_success(self) -> None:
        """增加登录成功计数"""
        try:
            if self.redis_client:
                self.redis_client.incr(self.LOGIN_SUCCESS_KEY)
        except Exception as e:
            logger.error(f"Failed to increment login success: {e}")
    
    def increment_login_failed(self, reason: str = "unknown") -> None:
        """
        增加登录失败计数
        
        Args:
            reason: 失败原因 (user_not_found, invalid_password, user_disabled, etc.)
        """
        try:
            if self.redis_client:
                self.redis_client.incr(self.LOGIN_FAILED_KEY)
                # 记录失败原因
                reason_key = f"{self.FAILURE_REASON_PREFIX}:login:{reason}"
                self.redis_client.incr(reason_key)
        except Exception as e:
            logger.error(f"Failed to increment login failed: {e}")
    
    def increment_logout(self) -> None:
        """增加登出计数"""
        try:
            if self.redis_client:
                self.redis_client.incr(self.LOGOUT_KEY)
        except Exception as e:
            logger.error(f"Failed to increment logout: {e}")
    
    def increment_token_refresh(self) -> None:
        """增加 Token 刷新成功计数"""
        try:
            if self.redis_client:
                self.redis_client.incr(self.TOKEN_REFRESH_KEY)
        except Exception as e:
            logger.error(f"Failed to increment token refresh: {e}")
    
    def increment_token_refresh_failed(self, reason: str = "unknown") -> None:
        """
        增加 Token 刷新失败计数
        
        Args:
            reason: 失败原因 (session_expired, token_invalid, user_mismatch, etc.)
        """
        try:
            if self.redis_client:
                self.redis_client.incr(self.TOKEN_REFRESH_FAILED_KEY)
                # 记录失败原因
                reason_key = f"{self.FAILURE_REASON_PREFIX}:refresh:{reason}"
                self.redis_client.incr(reason_key)
        except Exception as e:
            logger.error(f"Failed to increment token refresh failed: {e}")
    
    def increment_auth_verification(self) -> None:
        """增加认证验证成功计数"""
        try:
            if self.redis_client:
                self.redis_client.incr(self.AUTH_VERIFICATION_KEY)
        except Exception as e:
            logger.error(f"Failed to increment auth verification: {e}")
    
    def increment_auth_verification_failed(self, reason: str = "unknown") -> None:
        """
        增加认证验证失败计数
        
        Args:
            reason: 失败原因 (session_invalid, token_invalid, user_mismatch, etc.)
        """
        try:
            if self.redis_client:
                self.redis_client.incr(self.AUTH_VERIFICATION_FAILED_KEY)
                # 记录失败原因
                reason_key = f"{self.FAILURE_REASON_PREFIX}:verification:{reason}"
                self.redis_client.incr(reason_key)
        except Exception as e:
            logger.error(f"Failed to increment auth verification failed: {e}")
    
    def get_active_sessions_count(self) -> int:
        """
        获取活跃 Session 数量
        
        Returns:
            int: 活跃 Session 数量
        """
        try:
            if self.redis_client:
                # 扫描所有 session:* 键
                cursor = 0
                count = 0
                while True:
                    cursor, keys = self.redis_client.scan(
                        cursor=cursor,
                        match="session:*",
                        count=100
                    )
                    count += len(keys)
                    if cursor == 0:
                        break
                return count
            return 0
        except Exception as e:
            logger.error(f"Failed to get active sessions count: {e}")
            return 0
    
    def get_all_metrics(self) -> Dict[str, Any]:
        """
        获取所有认证指标
        
        Returns:
            Dict[str, Any]: 所有指标的字典
        """
        try:
            if not self.redis_client:
                return {}
            
            # 获取基础计数器
            login_success = int(self.redis_client.get(self.LOGIN_SUCCESS_KEY) or 0)
            login_failed = int(self.redis_client.get(self.LOGIN_FAILED_KEY) or 0)
            logout = int(self.redis_client.get(self.LOGOUT_KEY) or 0)
            token_refresh = int(self.redis_client.get(self.TOKEN_REFRESH_KEY) or 0)
            token_refresh_failed = int(self.redis_client.get(self.TOKEN_REFRESH_FAILED_KEY) or 0)
            auth_verification = int(self.redis_client.get(self.AUTH_VERIFICATION_KEY) or 0)
            auth_verification_failed = int(self.redis_client.get(self.AUTH_VERIFICATION_FAILED_KEY) or 0)
            
            # 计算认证成功率
            total_logins = login_success + login_failed
            login_success_rate = (login_success / total_logins * 100) if total_logins > 0 else 100.0
            
            # 计算 Token 刷新成功率
            total_refreshes = token_refresh + token_refresh_failed
            refresh_success_rate = (token_refresh / total_refreshes * 100) if total_refreshes > 0 else 100.0
            
            # 计算认证验证成功率
            total_verifications = auth_verification + auth_verification_failed
            verification_success_rate = (auth_verification / total_verifications * 100) if total_verifications > 0 else 100.0
            
            # 获取活跃 Session 数量
            active_sessions = self.get_active_sessions_count()
            
            # 获取失败原因统计
            failure_reasons = self._get_failure_reasons()
            
            return {
                'login_success_total': login_success,
                'login_failed_total': login_failed,
                'login_success_rate': round(login_success_rate, 2),
                'logout_total': logout,
                'token_refresh_success_total': token_refresh,
                'token_refresh_failed_total': token_refresh_failed,
                'token_refresh_success_rate': round(refresh_success_rate, 2),
                'auth_verification_success_total': auth_verification,
                'auth_verification_failed_total': auth_verification_failed,
                'auth_verification_success_rate': round(verification_success_rate, 2),
                'active_sessions_count': active_sessions,
                'failure_reasons': failure_reasons
            }
        except Exception as e:
            logger.error(f"Failed to get all metrics: {e}")
            return {}
    
    def _get_failure_reasons(self) -> Dict[str, Dict[str, int]]:
        """
        获取失败原因统计
        
        Returns:
            Dict[str, Dict[str, int]]: 按类型分组的失败原因统计
        """
        try:
            if not self.redis_client:
                return {}
            
            failure_reasons = {
                'login': {},
                'refresh': {},
                'verification': {}
            }
            
            # 扫描所有失败原因键
            cursor = 0
            while True:
                cursor, keys = self.redis_client.scan(
                    cursor=cursor,
                    match=f"{self.FAILURE_REASON_PREFIX}:*",
                    count=100
                )
                
                for key in keys:
                    # 解析键名: auth_metrics:failure_reason:login:user_not_found
                    parts = key.split(':')
                    if len(parts) >= 4:
                        failure_type = parts[2]  # login, refresh, verification
                        reason = parts[3]
                        count = int(self.redis_client.get(key) or 0)
                        
                        if failure_type in failure_reasons:
                            failure_reasons[failure_type][reason] = count
                
                if cursor == 0:
                    break
            
            return failure_reasons
        except Exception as e:
            logger.error(f"Failed to get failure reasons: {e}")
            return {}
    
    def export_prometheus_metrics(self) -> str:
        """
        导出 Prometheus 格式的指标
        
        Returns:
            str: Prometheus 格式的指标文本
        """
        try:
            metrics = self.get_all_metrics()
            
            lines = [
                "# HELP auth_login_success_total Total number of successful logins",
                "# TYPE auth_login_success_total counter",
                f"auth_login_success_total {metrics.get('login_success_total', 0)}",
                "",
                "# HELP auth_login_failed_total Total number of failed logins",
                "# TYPE auth_login_failed_total counter",
                f"auth_login_failed_total {metrics.get('login_failed_total', 0)}",
                "",
                "# HELP auth_login_success_rate Login success rate percentage",
                "# TYPE auth_login_success_rate gauge",
                f"auth_login_success_rate {metrics.get('login_success_rate', 100.0)}",
                "",
                "# HELP auth_logout_total Total number of logouts",
                "# TYPE auth_logout_total counter",
                f"auth_logout_total {metrics.get('logout_total', 0)}",
                "",
                "# HELP auth_token_refresh_success_total Total number of successful token refreshes",
                "# TYPE auth_token_refresh_success_total counter",
                f"auth_token_refresh_success_total {metrics.get('token_refresh_success_total', 0)}",
                "",
                "# HELP auth_token_refresh_failed_total Total number of failed token refreshes",
                "# TYPE auth_token_refresh_failed_total counter",
                f"auth_token_refresh_failed_total {metrics.get('token_refresh_failed_total', 0)}",
                "",
                "# HELP auth_token_refresh_success_rate Token refresh success rate percentage",
                "# TYPE auth_token_refresh_success_rate gauge",
                f"auth_token_refresh_success_rate {metrics.get('token_refresh_success_rate', 100.0)}",
                "",
                "# HELP auth_verification_success_total Total number of successful auth verifications",
                "# TYPE auth_verification_success_total counter",
                f"auth_verification_success_total {metrics.get('auth_verification_success_total', 0)}",
                "",
                "# HELP auth_verification_failed_total Total number of failed auth verifications",
                "# TYPE auth_verification_failed_total counter",
                f"auth_verification_failed_total {metrics.get('auth_verification_failed_total', 0)}",
                "",
                "# HELP auth_verification_success_rate Auth verification success rate percentage",
                "# TYPE auth_verification_success_rate gauge",
                f"auth_verification_success_rate {metrics.get('auth_verification_success_rate', 100.0)}",
                "",
                "# HELP auth_active_sessions_count Number of active sessions",
                "# TYPE auth_active_sessions_count gauge",
                f"auth_active_sessions_count {metrics.get('active_sessions_count', 0)}",
                ""
            ]
            
            # 添加失败原因指标
            failure_reasons = metrics.get('failure_reasons', {})
            
            # 登录失败原因
            if failure_reasons.get('login'):
                lines.append("# HELP auth_login_failed_by_reason Login failures by reason")
                lines.append("# TYPE auth_login_failed_by_reason counter")
                for reason, count in failure_reasons['login'].items():
                    lines.append(f'auth_login_failed_by_reason{{reason="{reason}"}} {count}')
                lines.append("")
            
            # Token 刷新失败原因
            if failure_reasons.get('refresh'):
                lines.append("# HELP auth_token_refresh_failed_by_reason Token refresh failures by reason")
                lines.append("# TYPE auth_token_refresh_failed_by_reason counter")
                for reason, count in failure_reasons['refresh'].items():
                    lines.append(f'auth_token_refresh_failed_by_reason{{reason="{reason}"}} {count}')
                lines.append("")
            
            # 认证验证失败原因
            if failure_reasons.get('verification'):
                lines.append("# HELP auth_verification_failed_by_reason Auth verification failures by reason")
                lines.append("# TYPE auth_verification_failed_by_reason counter")
                for reason, count in failure_reasons['verification'].items():
                    lines.append(f'auth_verification_failed_by_reason{{reason="{reason}"}} {count}')
                lines.append("")
            
            return "\n".join(lines)
            
        except Exception as e:
            logger.error(f"Failed to export prometheus metrics: {e}")
            return f"# Error exporting metrics: {str(e)}\n"
    
    def reset_metrics(self) -> bool:
        """
        重置所有指标（仅用于测试）
        
        Returns:
            bool: 是否重置成功
        """
        try:
            if not self.redis_client:
                return False
            
            # 删除所有指标键
            keys_to_delete = [
                self.LOGIN_SUCCESS_KEY,
                self.LOGIN_FAILED_KEY,
                self.LOGOUT_KEY,
                self.TOKEN_REFRESH_KEY,
                self.TOKEN_REFRESH_FAILED_KEY,
                self.AUTH_VERIFICATION_KEY,
                self.AUTH_VERIFICATION_FAILED_KEY
            ]
            
            # 删除所有失败原因键
            cursor = 0
            while True:
                cursor, keys = self.redis_client.scan(
                    cursor=cursor,
                    match=f"{self.FAILURE_REASON_PREFIX}:*",
                    count=100
                )
                keys_to_delete.extend(keys)
                if cursor == 0:
                    break
            
            if keys_to_delete:
                self.redis_client.delete(*keys_to_delete)
            
            logger.info("Auth metrics reset successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to reset metrics: {e}")
            return False


# 全局认证指标服务实例
auth_metrics_service = AuthMetricsService()
