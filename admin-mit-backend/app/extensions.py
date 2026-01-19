from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from flask_wtf.csrf import CSRFProtect
import redis
from app.core.config_manager import config_manager

# 数据库
db = SQLAlchemy()

# JWT
jwt = JWTManager()

# WebSocket
socketio = SocketIO()

# CSRF 保护
csrf = CSRFProtect()

# Redis 连接
def get_redis_client():
    """获取 Redis 客户端"""
    try:
        redis_config = config_manager.get_redis_config()
        return redis.Redis(
            host=redis_config['host'],
            port=redis_config['port'],
            password=redis_config.get('password') or None,
            db=redis_config['db'],
            decode_responses=redis_config.get('decode_responses', True),
            socket_timeout=redis_config.get('socket_timeout', 5),
            socket_connect_timeout=redis_config.get('socket_connect_timeout', 5),
            retry_on_timeout=redis_config.get('retry_on_timeout', True),
            health_check_interval=redis_config.get('health_check_interval', 30)
        )
    except (KeyError, AttributeError):
        # 测试环境下返回 Mock Redis 客户端
        from unittest.mock import MagicMock
        return MagicMock()

# 全局 Redis 客户端
redis_client = None

def init_redis():
    """初始化 Redis 连接"""
    global redis_client
    redis_client = get_redis_client()
    return redis_client