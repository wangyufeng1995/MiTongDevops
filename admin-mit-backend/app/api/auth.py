from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity, get_jwt
from app.models.user import User
from app.models.tenant import Tenant
from app.services.password_service import password_decrypt_service
from app.services.csrf_service import csrf_service
from app.services.auth_service import auth_service
from app.core.auth_middleware import auth_middleware
from app.extensions import db
import logging

logger = logging.getLogger(__name__)
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/csrf-token', methods=['GET'])
def get_csrf_token():
    """获取 CSRF token"""
    try:
        token = csrf_service.generate_token()
        return jsonify({
            'success': True,
            'data': {
                'csrf_token': token
            }
        })
    except Exception as e:
        logger.error(f"Get CSRF token error: {e}")
        return jsonify({
            'success': False,
            'message': '获取 CSRF token 失败'
        }), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """用户登录（重构版 - Session + Token）"""
    try:
        data = request.get_json()
        username = data.get('username')
        password_input = data.get('password')
        
        if not username or not password_input:
            logger.warning(f"Login failed: missing credentials")
            return jsonify({
                'success': False,
                'message': '账号密码错误'
            }), 401
        
        # 在测试环境中，直接使用明文密码
        from flask import current_app
        if current_app.config.get('TESTING', False):
            password = password_input
        else:
            # 开发模式：如果密码是明文（长度小于100且不包含base64字符），直接使用
            # 这是临时解决方案，生产环境应该移除
            if len(password_input) < 100 and not any(c in password_input for c in ['+', '/', '=']):
                logger.warning("Using plaintext password in development mode")
                password = password_input
            else:
                # 解密密码
                try:
                    password = password_decrypt_service.decrypt_password(password_input)
                except Exception as e:
                    logger.error(f"Password decryption failed: {e}")
                    return jsonify({
                        'success': False,
                        'message': '账号密码错误'
                    }), 401
        
        # 获取客户端信息
        ip_address = request.remote_addr
        user_agent = request.headers.get('User-Agent', '')
        
        # 使用认证服务进行用户认证
        result = auth_service.authenticate_user(username, password, ip_address, user_agent)
        
        if result['success']:
            # 创建响应
            response = jsonify({
                'success': True,
                'data': {
                    'access_token': result['data']['access_token'],
                    'refresh_token': result['data']['refresh_token'],
                    'user': result['data']['user'],
                    'tenant': result['data']['tenant']
                }
            })
            
            # 设置 Session Cookie
            session_id = result['data']['session_id']
            
            # 判断是否为生产环境
            is_production = current_app.config.get('ENV') == 'production'
            
            # 设置 Cookie 参数
            response.set_cookie(
                key='session_id',
                value=session_id,
                max_age=86400,  # 24 小时
                httponly=True,  # 防止 XSS 攻击
                secure=is_production,  # 生产环境要求 HTTPS
                samesite='Lax',  # 防止 CSRF 攻击
                path='/'
            )
            
            # 记录登录成功日志
            logger.info(f"Login successful: {username}, session: {session_id}, ip: {ip_address}")
            
            return response
        else:
            # 记录登录失败日志
            logger.warning(f"Login failed: {username}, ip: {ip_address}, reason: {result.get('message')}")
            return jsonify(result), 401
        
    except Exception as e:
        logger.error(f"Login error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'message': '账号密码错误'
        }), 401

@auth_bp.route('/refresh', methods=['POST'])
def refresh():
    """刷新 token（重构版 - Session + Token）"""
    try:
        # 从 Cookie 提取 Session ID
        session_id = request.cookies.get('session_id')
        if not session_id:
            logger.warning("Token refresh failed: missing session_id cookie")
            return jsonify({
                'success': False,
                'message': 'Session 已过期，请重新登录'
            }), 401
        
        # 从请求体或 Authorization Header 提取 Refresh Token
        data = request.get_json() or {}
        refresh_token = data.get('refresh_token')
        
        if not refresh_token:
            # 尝试从 Authorization Header 提取
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                refresh_token = auth_header[7:]
        
        if not refresh_token:
            logger.warning("Token refresh failed: missing refresh_token")
            return jsonify({
                'success': False,
                'message': 'Refresh Token 缺失'
            }), 401
        
        # 使用认证服务刷新 token
        result = auth_service.refresh_token(session_id, refresh_token)
        
        if result['success']:
            logger.info(f"Token refresh successful for session: {session_id}")
            return jsonify(result)
        else:
            return jsonify(result), 401
        
    except Exception as e:
        logger.error(f"Token refresh error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Token 刷新失败'
        }), 500

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """用户登出（重构版 - Session + Token）"""
    try:
        # 从 Cookie 提取 Session ID
        session_id = request.cookies.get('session_id')
        
        # 从请求体或 Authorization Header 提取 Refresh Token
        data = request.get_json() or {}
        refresh_token = data.get('refresh_token')
        
        if not refresh_token:
            # 尝试从 Authorization Header 提取
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                refresh_token = auth_header[7:]
        
        # 如果没有 Session ID 和 Refresh Token，仍然返回成功
        # 因为用户可能已经登出或 Session 已过期
        if not session_id and not refresh_token:
            logger.info("Logout called without session_id or refresh_token")
            response = jsonify({
                'success': True,
                'message': '登出成功'
            })
            return response
        
        # 使用认证服务执行登出
        result = auth_service.logout(session_id or '', refresh_token or '')
        
        # 创建响应
        response = jsonify(result)
        
        # 清除 Session Cookie（设置 Max-Age=0）
        from flask import current_app
        is_production = current_app.config.get('ENV') == 'production'
        
        response.set_cookie(
            key='session_id',
            value='',
            max_age=0,  # 立即过期
            httponly=True,
            secure=is_production,
            samesite='Lax',
            path='/'
        )
        
        # 记录登出日志
        logger.info(f"Logout successful, session: {session_id}")
        
        return response
        
    except Exception as e:
        logger.error(f"Logout error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'message': '登出失败'
        }), 500

@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    """获取当前用户信息（重构版 - Session + Token 双重验证）"""
    try:
        from app.core.auth_middleware import auth_middleware
        
        # 使用 AuthMiddleware 进行双重验证
        result = auth_middleware.verify_auth()
        
        if not result['valid']:
            logger.warning(f"Get current user failed: {result['message']}")
            return jsonify({
                'success': False,
                'message': result['message'],
                'error_code': 'UNAUTHORIZED'
            }), 401
        
        # 从验证结果中获取用户和租户
        user = result['user']
        tenant = result['tenant']
        
        # 返回用户信息（确保不包含密码）
        user_dict = user.to_dict()
        
        # 双重确保密码字段不被返回
        if 'password' in user_dict:
            del user_dict['password']
        if 'password_hash' in user_dict:
            del user_dict['password_hash']
        
        tenant_dict = tenant.to_dict() if tenant else None
        
        logger.info(f"Get current user successful: {user.username}")
        
        return jsonify({
            'success': True,
            'data': {
                'user': user_dict,
                'tenant': tenant_dict
            }
        })
        
    except Exception as e:
        logger.error(f"Get current user error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'message': '获取用户信息失败',
            'error_code': 'INTERNAL_ERROR'
        }), 500

@auth_bp.route('/public-key', methods=['GET'])
def get_public_key():
    """获取 RSA 公钥"""
    try:
        public_key = password_decrypt_service.get_public_key_pem()
        response = jsonify({
            'success': True,
            'data': {
                'publicKey': public_key
            }
        })
        # 禁止缓存，确保每次都获取最新公钥
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response
        
    except Exception as e:
        logger.error(f"Get public key error: {e}")
        return jsonify({
            'success': False,
            'message': '获取公钥失败'
        }), 500

@auth_bp.route('/validate', methods=['POST'])
@auth_middleware.require_auth
def validate_token():
    """验证token有效性"""
    try:
        user = auth_service.get_current_user()
        if not user:
            return jsonify({
                'success': False,
                'message': 'Token无效'
            }), 401
        
        claims = get_jwt()
        
        return jsonify({
            'success': True,
            'data': {
                'valid': True,
                'user_id': user.id,
                'tenant_id': claims.get('tenant_id'),
                'roles': claims.get('roles', []),
                'expires_at': claims.get('exp')
            }
        })
        
    except Exception as e:
        logger.error(f"Token validation error: {e}")
        return jsonify({
            'success': False,
            'message': 'Token验证失败'
        }), 500

@auth_bp.route('/csrf-config', methods=['GET'])
def get_csrf_config():
    """获取CSRF配置信息"""
    try:
        config = csrf_service.get_configuration()
        return jsonify({
            'success': True,
            'data': config
        })
        
    except Exception as e:
        logger.error(f"Get CSRF config error: {e}")
        return jsonify({
            'success': False,
            'message': '获取CSRF配置失败'
        }), 500

@auth_bp.route('/csrf-stats', methods=['GET'])
@auth_middleware.require_role('admin')
def get_csrf_stats():
    """获取CSRF攻击统计（需要管理员权限）"""
    try:
        stats = csrf_service.get_attack_statistics()
        return jsonify({
            'success': True,
            'data': stats
        })
        
    except Exception as e:
        logger.error(f"Get CSRF stats error: {e}")
        return jsonify({
            'success': False,
            'message': '获取CSRF统计失败'
        }), 500

@auth_bp.route('/csrf-stats/clear', methods=['POST'])
@auth_middleware.require_role('admin')
def clear_csrf_stats():
    """清除CSRF攻击统计（需要管理员权限）"""
    try:
        csrf_service.clear_attack_log()
        return jsonify({
            'success': True,
            'message': 'CSRF攻击日志已清除'
        })
        
    except Exception as e:
        logger.error(f"Clear CSRF stats error: {e}")
        return jsonify({
            'success': False,
            'message': '清除CSRF统计失败'
        }), 500