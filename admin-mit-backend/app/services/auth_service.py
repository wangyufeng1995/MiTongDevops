from flask import current_app, request
from flask_jwt_extended import create_access_token, create_refresh_token, get_jwt_identity, get_jwt, decode_token
from app.models.user import User
from app.models.tenant import Tenant
from app.extensions import db
from app.services.session_service import SessionService
from app.services.token_blacklist_service import TokenBlacklistService
from app.services.auth_metrics_service import auth_metrics_service
from app.core.error_handlers import (
    handle_redis_errors, log_auth_event, log_security_warning,
    ServiceUnavailableError
)
from datetime import timedelta
import logging
import time

logger = logging.getLogger(__name__)

class AuthService:
    """认证服务类（重构版）"""
    
    def __init__(self, session_service: SessionService = None, token_blacklist_service: TokenBlacklistService = None):
        """
        初始化 AuthService
        
        Args:
            session_service: Session 管理服务实例
            token_blacklist_service: Token 黑名单服务实例
        """
        self.session_service = session_service or SessionService()
        self.token_blacklist_service = token_blacklist_service or TokenBlacklistService()
    
    def authenticate_user(self, username: str, password: str, ip_address: str = None, user_agent: str = None) -> dict:
        """
        用户认证（重构版）
        
        Args:
            username: 用户名
            password: 密码
            ip_address: 客户端 IP 地址
            user_agent: 客户端 User-Agent
            
        Returns:
            dict: {
                'success': bool,
                'data': {
                    'session_id': str,
                    'access_token': str,
                    'refresh_token': str,
                    'user': dict,
                    'tenant': dict
                }
            }
        """
        try:
            # 查找用户
            user = User.query.filter_by(username=username).first()
            if not user:
                log_auth_event(
                    event_type='login_failed',
                    username=username,
                    ip_address=ip_address,
                    success=False,
                    reason='user_not_found'
                )
                auth_metrics_service.increment_login_failed('user_not_found')
                return {
                    'success': False,
                    'message': '账号密码错误'
                }
            
            # 验证密码
            if not user.check_password(password):
                log_auth_event(
                    event_type='login_failed',
                    user_id=str(user.id),
                    username=username,
                    ip_address=ip_address,
                    success=False,
                    reason='invalid_password'
                )
                auth_metrics_service.increment_login_failed('invalid_password')
                return {
                    'success': False,
                    'message': '账号密码错误'
                }
            
            # 检查用户状态
            if user.status != 1:
                log_auth_event(
                    event_type='login_failed',
                    user_id=str(user.id),
                    username=username,
                    ip_address=ip_address,
                    success=False,
                    reason='user_disabled'
                )
                auth_metrics_service.increment_login_failed('user_disabled')
                return {
                    'success': False,
                    'message': '账号密码错误'
                }
            
            # 获取租户信息
            tenant = Tenant.query.get(user.tenant_id)
            if not tenant or tenant.status != 1:
                log_auth_event(
                    event_type='login_failed',
                    user_id=str(user.id),
                    username=username,
                    ip_address=ip_address,
                    success=False,
                    reason='tenant_invalid'
                )
                auth_metrics_service.increment_login_failed('tenant_invalid')
                return {
                    'success': False,
                    'message': '账号密码错误'
                }
            
            # 创建 Session
            try:
                session_id = self.session_service.create_session(
                    user=user,
                    tenant=tenant,
                    ip_address=ip_address,
                    user_agent=user_agent
                )
            except ServiceUnavailableError:
                # Session 服务不可用（Redis 错误）
                log_auth_event(
                    event_type='login_failed',
                    user_id=str(user.id),
                    username=username,
                    ip_address=ip_address,
                    success=False,
                    reason='service_unavailable'
                )
                auth_metrics_service.increment_login_failed('service_unavailable')
                return {
                    'success': False,
                    'message': '服务暂时不可用'
                }
            except Exception as e:
                logger.error(f"Failed to create session for {username}: {e}", exc_info=True)
                log_auth_event(
                    event_type='login_failed',
                    user_id=str(user.id),
                    username=username,
                    ip_address=ip_address,
                    success=False,
                    reason='session_creation_error'
                )
                auth_metrics_service.increment_login_failed('session_creation_error')
                return {
                    'success': False,
                    'message': '服务暂时不可用'
                }
            
            # 生成 Tokens
            tokens = self.generate_tokens(user)
            
            # 记录登录成功日志
            log_auth_event(
                event_type='login_success',
                user_id=str(user.id),
                username=username,
                session_id=session_id,
                ip_address=ip_address,
                success=True,
                tenant_id=str(tenant.id)
            )
            
            # 增加登录成功指标
            auth_metrics_service.increment_login_success()
            
            return {
                'success': True,
                'data': {
                    'session_id': session_id,
                    'access_token': tokens['access_token'],
                    'refresh_token': tokens['refresh_token'],
                    'user': user.to_dict(),
                    'tenant': tenant.to_dict()
                }
            }
            
        except Exception as e:
            logger.error(f"Authentication error: {e}", exc_info=True)
            log_auth_event(
                event_type='login_failed',
                username=username,
                ip_address=ip_address,
                success=False,
                reason='unexpected_error'
            )
            auth_metrics_service.increment_login_failed('unexpected_error')
            return {
                'success': False,
                'message': '账号密码错误'
            }
    
    def generate_tokens(self, user: User) -> dict:
        """
        生成JWT tokens
        
        Args:
            user: 用户对象
            
        Returns:
            dict: 包含access_token和refresh_token
        """
        # 创建JWT claims
        additional_claims = {
            'tenant_id': user.tenant_id,
            'roles': [role.name for role in user.get_roles()],
            'username': user.username,
            'email': user.email
        }
        
        # 生成access token
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims=additional_claims
        )
        
        # 生成refresh token
        refresh_token = create_refresh_token(
            identity=str(user.id),
            additional_claims=additional_claims
        )
        
        return {
            'access_token': access_token,
            'refresh_token': refresh_token
        }
    
    def verify_request(self, session_id: str, access_token: str) -> dict:
        """
        验证请求（新增）
        
        同时验证 Session 和 Token
        
        Args:
            session_id: 从 Cookie 中提取的 Session ID
            access_token: 从 Authorization Header 中提取的 Token
            
        Returns:
            dict: {
                'valid': bool,
                'user': User,
                'tenant': Tenant,
                'message': str
            }
        """
        try:
            # 验证 Session
            try:
                session_data = self.session_service.get_session(session_id)
            except ServiceUnavailableError:
                logger.error("Session verification failed: Redis unavailable")
                return {
                    'valid': False,
                    'user': None,
                    'tenant': None,
                    'message': '服务暂时不可用'
                }
            
            if session_data is None:
                logger.warning(f"Verification failed: invalid session - {session_id}")
                auth_metrics_service.increment_auth_verification_failed('session_invalid')
                return {
                    'valid': False,
                    'user': None,
                    'tenant': None,
                    'message': 'Session 无效或已过期'
                }
            
            # 验证 Token
            try:
                decoded_token = decode_token(access_token)
            except Exception as e:
                logger.warning(f"Verification failed: invalid token - {e}")
                auth_metrics_service.increment_auth_verification_failed('token_invalid')
                return {
                    'valid': False,
                    'user': None,
                    'tenant': None,
                    'message': 'Token 无效或已过期'
                }
            
            # 比对 Session 和 Token 中的用户信息
            session_user_id = session_data.get('user_id')
            token_user_id = decoded_token.get('sub')
            
            if session_user_id != token_user_id:
                log_security_warning(
                    warning_type='user_mismatch',
                    message=f'Session user {session_user_id} does not match token user {token_user_id}',
                    user_id=session_user_id,
                    session_id=session_id
                )
                auth_metrics_service.increment_auth_verification_failed('user_mismatch')
                return {
                    'valid': False,
                    'user': None,
                    'tenant': None,
                    'message': '认证信息不匹配'
                }
            
            # 获取用户和租户对象
            user = User.query.get(session_user_id)
            if not user or user.status != 1:
                logger.warning(f"Verification failed: user not found or disabled - {session_user_id}")
                return {
                    'valid': False,
                    'user': None,
                    'tenant': None,
                    'message': '用户不存在或已被禁用'
                }
            
            tenant = Tenant.query.get(session_data.get('tenant_id'))
            if not tenant or tenant.status != 1:
                logger.warning(f"Verification failed: tenant not found or disabled - {session_data.get('tenant_id')}")
                return {
                    'valid': False,
                    'user': None,
                    'tenant': None,
                    'message': '租户不存在或已被禁用'
                }
            
            # 延长 Session（如果需要）
            try:
                self.session_service.extend_session(session_id)
            except Exception as e:
                logger.warning(f"Failed to extend session {session_id}: {e}")
                # 延期失败不影响验证结果
            
            # 增加认证验证成功指标
            auth_metrics_service.increment_auth_verification()
            
            return {
                'valid': True,
                'user': user,
                'tenant': tenant,
                'message': '验证成功'
            }
            
        except Exception as e:
            logger.error(f"Verification error: {e}", exc_info=True)
            return {
                'valid': False,
                'user': None,
                'tenant': None,
                'message': '验证失败'
            }
    
    def refresh_token(self, session_id: str, refresh_token: str) -> dict:
        """
        刷新 Token（重构版）
        
        Args:
            session_id: Session ID
            refresh_token: Refresh Token
            
        Returns:
            dict: {
                'success': bool,
                'data': {'access_token': str}
            }
        """
        try:
            # 验证 Session 有效性
            session_data = self.session_service.get_session(session_id)
            if session_data is None:
                logger.warning(f"Token refresh failed: invalid session - {session_id}")
                auth_metrics_service.increment_token_refresh_failed('session_expired')
                return {
                    'success': False,
                    'message': 'Session 已过期，请重新登录'
                }
            
            # 验证 Refresh Token
            try:
                decoded_token = decode_token(refresh_token)
            except Exception as e:
                logger.warning(f"Token refresh failed: invalid refresh token - {e}")
                auth_metrics_service.increment_token_refresh_failed('token_invalid')
                return {
                    'success': False,
                    'message': 'Refresh Token 无效或已过期'
                }
            
            # 检查 Token 是否在黑名单中
            if self.token_blacklist_service.is_blacklisted(refresh_token):
                logger.warning(f"Token refresh failed: token in blacklist")
                auth_metrics_service.increment_token_refresh_failed('token_blacklisted')
                return {
                    'success': False,
                    'message': 'Token 已失效，请重新登录'
                }
            
            # 比对 Session 和 Token 中的用户信息
            session_user_id = session_data.get('user_id')
            token_user_id = decoded_token.get('sub')
            
            if session_user_id != token_user_id:
                logger.error(f"Security warning: user mismatch during refresh - session: {session_user_id}, token: {token_user_id}")
                auth_metrics_service.increment_token_refresh_failed('user_mismatch')
                return {
                    'success': False,
                    'message': '认证信息不匹配'
                }
            
            # 验证用户是否仍然有效
            user = User.query.get(session_user_id)
            if not user or user.status != 1:
                logger.warning(f"Token refresh failed: user not found or disabled - {session_user_id}")
                return {
                    'success': False,
                    'message': '用户不存在或已被禁用'
                }
            
            # 验证租户是否仍然有效
            tenant = Tenant.query.get(user.tenant_id)
            if not tenant or tenant.status != 1:
                logger.warning(f"Token refresh failed: tenant not found or disabled - {user.tenant_id}")
                return {
                    'success': False,
                    'message': '租户不存在或已被禁用'
                }
            
            # 创建新的 Access Token，使用最新的用户信息
            additional_claims = {
                'tenant_id': user.tenant_id,
                'roles': [role.name for role in user.get_roles()],
                'username': user.username,
                'email': user.email
            }
            
            access_token = create_access_token(
                identity=str(user.id),
                additional_claims=additional_claims
            )
            
            # 更新 Session 的 last_active 时间
            try:
                self.session_service.update_session(session_id, {
                    'last_active': int(time.time())
                })
            except Exception as e:
                logger.warning(f"Failed to update session last_active: {e}")
                # 更新失败不影响刷新结果
            
            logger.info(f"Token refreshed successfully for user {user.username}")
            
            # 增加 Token 刷新成功指标
            auth_metrics_service.increment_token_refresh()
            
            return {
                'success': True,
                'data': {
                    'access_token': access_token
                }
            }
            
        except Exception as e:
            logger.error(f"Token refresh error: {e}", exc_info=True)
            return {
                'success': False,
                'message': 'Token刷新失败'
            }
    
    def logout(self, session_id: str, refresh_token: str) -> dict:
        """
        用户登出（重构版）
        
        Args:
            session_id: Session ID
            refresh_token: Refresh Token
            
        Returns:
            dict: {'success': bool, 'message': str}
        """
        try:
            # 获取 Session 数据用于日志记录
            session_data = None
            try:
                session_data = self.session_service.get_session(session_id)
            except Exception:
                pass  # 忽略获取 Session 的错误
            
            # 删除 Session
            try:
                session_deleted = self.session_service.delete_session(session_id)
                if not session_deleted:
                    logger.warning(f"Session not found during logout: {session_id}")
            except ServiceUnavailableError:
                logger.error(f"Failed to delete session during logout: Redis unavailable")
                # 继续执行，尝试将 Token 加入黑名单
            except Exception as e:
                logger.error(f"Failed to delete session during logout: {e}", exc_info=True)
                # 继续执行，尝试将 Token 加入黑名单
            
            # 将 Refresh Token 加入黑名单
            try:
                blacklisted = self.token_blacklist_service.add_to_blacklist(refresh_token)
                if not blacklisted:
                    logger.warning(f"Failed to add refresh token to blacklist")
            except Exception as e:
                logger.error(f"Failed to blacklist token during logout: {e}", exc_info=True)
                # 继续执行
            
            # 记录登出日志
            log_auth_event(
                event_type='logout',
                user_id=session_data.get('user_id') if session_data else None,
                username=session_data.get('username') if session_data else None,
                session_id=session_id,
                success=True
            )
            
            # 增加登出指标
            auth_metrics_service.increment_logout()
            
            return {
                'success': True,
                'message': '登出成功'
            }
            
        except Exception as e:
            logger.error(f"Logout error: {e}", exc_info=True)
            return {
                'success': False,
                'message': '登出失败'
            }
    
    @staticmethod
    def get_current_user() -> User:
        """
        获取当前用户
        
        Returns:
            User: 当前用户对象，如果未找到返回None
        """
        try:
            current_user_id = get_jwt_identity()
            if current_user_id:
                return User.query.get(current_user_id)
        except Exception as e:
            logger.error(f"Get current user error: {e}")
        
        return None
    
    @staticmethod
    def get_current_tenant() -> Tenant:
        """
        获取当前租户
        
        Returns:
            Tenant: 当前租户对象，如果未找到返回None
        """
        try:
            claims = get_jwt()
            tenant_id = claims.get('tenant_id')
            if tenant_id:
                return Tenant.query.get(tenant_id)
        except Exception as e:
            logger.error(f"Get current tenant error: {e}")
        
        return None
    
    @staticmethod
    def validate_user_permissions(required_permissions: list) -> bool:
        """
        验证用户权限
        
        Args:
            required_permissions: 需要的权限列表
            
        Returns:
            bool: 是否有权限
        """
        try:
            user = AuthService.get_current_user()
            if not user:
                return False
            
            # 获取用户所有权限
            user_permissions = set()
            for role in user.roles:
                permissions = role.get_permissions()
                user_permissions.update(permissions)
            
            # 检查是否有所需权限
            return all(perm in user_permissions for perm in required_permissions)
            
        except Exception as e:
            logger.error(f"Permission validation error: {e}")
            return False
    
    @staticmethod
    def has_role(role_name: str) -> bool:
        """
        检查用户是否有指定角色
        
        Args:
            role_name: 角色名称
            
        Returns:
            bool: 是否有该角色
        """
        try:
            claims = get_jwt()
            roles = claims.get('roles', [])
            return role_name in roles
        except Exception as e:
            logger.error(f"Role check error: {e}")
            return False

# 创建全局认证服务实例
auth_service = AuthService()
