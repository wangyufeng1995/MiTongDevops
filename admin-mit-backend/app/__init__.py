from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from app.extensions import db, jwt, socketio, csrf, init_redis
from app.core.config_manager import config_manager
from app.core.middleware import setup_middleware
import logging.config
from datetime import timedelta

def create_app(config_name='default'):
    app = Flask(__name__)
    
    # 加载配置
    setup_config(app, config_name)
    
    # 设置日志
    setup_logging()
    
    # 初始化扩展
    setup_extensions(app)
    
    # 设置中间件
    setup_middleware(app)
    
    # 注册蓝图
    register_blueprints(app)
    
    return app

def setup_config(app, config_name='default'):
    """配置应用"""
    # 测试环境配置
    if config_name == 'testing':
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        app.config['SECRET_KEY'] = 'test-secret-key'
        app.config['JWT_SECRET_KEY'] = 'test-jwt-secret-key'
        app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(seconds=3600)
        app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(seconds=2592000)
        app.config['JWT_ALGORITHM'] = 'HS256'
        app.config['WTF_CSRF_ENABLED'] = False  # 测试时禁用CSRF
        return
    
    # 数据库配置
    db_config = config_manager.get_database_config()
    # URL编码密码中的特殊字符
    from urllib.parse import quote_plus
    encoded_password = quote_plus(db_config['password'])
    app.config['SQLALCHEMY_DATABASE_URI'] = (
        f"postgresql://{db_config['username']}:{encoded_password}"
        f"@{db_config['host']}:{db_config['port']}/{db_config['database']}"
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_size': db_config.get('pool_size', 10),
        'max_overflow': db_config.get('max_overflow', 20),
        'pool_timeout': db_config.get('pool_timeout', 30),
        'pool_recycle': db_config.get('pool_recycle', 3600),
        'echo': db_config.get('echo', False)
    }
    
    # 应用配置
    app_config = config_manager.get_app_config()
    app.config['SECRET_KEY'] = app_config['secret_key']
    app.config['DEBUG'] = app_config.get('debug', False)
    
    # JWT 配置
    jwt_config = config_manager.get_jwt_config()
    app.config['JWT_SECRET_KEY'] = jwt_config['secret_key']
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(seconds=jwt_config.get('access_token_expires', 3600))
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(seconds=jwt_config.get('refresh_token_expires', 2592000))
    app.config['JWT_ALGORITHM'] = jwt_config.get('algorithm', 'HS256')
    
    # CSRF 配置
    csrf_config = config_manager.get_csrf_config()
    app.config['WTF_CSRF_SECRET_KEY'] = csrf_config.get('secret_key', app_config['secret_key'])
    app.config['WTF_CSRF_TIME_LIMIT'] = csrf_config.get('time_limit', 3600)
    app.config['WTF_CSRF_ENABLED'] = True
    
    # 文件上传配置
    upload_config = app_config.get('upload', {})
    app.config['MAX_CONTENT_LENGTH'] = upload_config.get('max_content_length', 16777216)

def setup_logging():
    """设置日志配置"""
    try:
        logging_config = config_manager.get_logging_config()
        logging.config.dictConfig(logging_config)
    except Exception as e:
        # 如果日志配置失败，使用基本配置
        logging.basicConfig(level=logging.INFO)
        logging.error(f"Failed to setup logging: {e}")

def setup_extensions(app):
    """初始化扩展"""
    db.init_app(app)
    jwt.init_app(app)
    
    # 初始化 Redis
    init_redis()
    
    # Socket.IO 配置 - 支持 WebSocket 和轮询
    socketio.init_app(
        app, 
        cors_allowed_origins="*",
        async_mode='threading',  # 使用线程模式
        ping_timeout=60,
        ping_interval=25,
        logger=False,  # 关闭 socketio 日志
        engineio_logger=False  # 关闭 engineio 日志
    )
    
    csrf.init_app(app)
    Migrate(app, db)
    
    # 获取 CORS 配置
    cors_config = config_manager.get_cors_config()
    cors_origins = cors_config.get('origins', ['http://localhost:3000', 'http://localhost:3001'])
    
    # 如果是开发环境，添加默认的本地开发地址
    if app.config.get('DEBUG', False):
        default_dev_origins = ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001']
        cors_origins = list(set(cors_origins + default_dev_origins))
    
    CORS(app, 
         supports_credentials=True,
         origins=cors_origins,
         allow_headers=['Content-Type', 'Authorization', 'X-CSRFToken'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
    
    # 初始化操作日志中间件
    from app.core.operation_logger import operation_logger_middleware
    operation_logger_middleware.init_app(app)
    
    # 注册 WebSocket 事件
    from app.core.websocket_events import register_websocket_events
    register_websocket_events()
    
    # 初始化密码加密服务（生成 RSA 密钥并存储到数据库和 Redis）
    with app.app_context():
        try:
            from app.services.password_service import password_decrypt_service
            password_decrypt_service.initialize()
        except Exception as e:
            logging.getLogger(__name__).error(f"Failed to initialize password service: {e}")

def register_blueprints(app):
    """注册蓝图"""
    from app.api.auth import auth_bp
    from app.api.users import users_bp
    from app.api.roles import roles_bp
    from app.api.menus import menus_bp
    from app.api.logs import logs_bp
    from app.api.hosts import hosts_bp
    from app.api.host_groups import host_groups_bp
    from app.api.websocket import websocket_bp
    from app.api.ansible import ansible_bp
    from app.api.monitor import monitor_bp
    from app.api.network import network_bp
    from app.api.system import system_bp
    from app.api.system_notifications import bp as notifications_bp
    from app.api.test import test_bp
    from app.api.health import health_bp
    from app.api.dashboard import dashboard_bp
    from app.api.host_audit import host_audit_bp
    from app.api.backup import backup_bp
    from app.api.redis import redis_bp
    from app.api.database import database_bp
    from app.api.datasource import datasource_bp
    from app.api.grafana import grafana_bp
    from app.api.k8s.clusters import clusters_bp
    from app.api.k8s.namespaces import namespaces_bp
    from app.api.k8s.workloads import workloads_bp
    from app.api.k8s.services import services_bp
    from app.api.k8s.configs import configs_bp
    from app.api.k8s.storage import storage_bp
    from app.api.k8s.audit import audit_bp
    from app.api.ai_model_config import bp as ai_model_config_bp
    from app.api.ai_assistant import bp as ai_assistant_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(roles_bp, url_prefix='/api/roles')
    app.register_blueprint(menus_bp, url_prefix='/api/menus')
    app.register_blueprint(logs_bp, url_prefix='/api/logs')
    app.register_blueprint(hosts_bp, url_prefix='/api/hosts')
    app.register_blueprint(host_groups_bp)
    app.register_blueprint(websocket_bp, url_prefix='/api/websocket')
    app.register_blueprint(ansible_bp, url_prefix='/api/ansible')
    app.register_blueprint(monitor_bp, url_prefix='/api/monitor')
    app.register_blueprint(network_bp, url_prefix='/api/network')
    app.register_blueprint(system_bp, url_prefix='/api/system')
    app.register_blueprint(notifications_bp)
    app.register_blueprint(test_bp, url_prefix='/api/test')
    app.register_blueprint(health_bp, url_prefix='/api')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(host_audit_bp, url_prefix='/api')
    app.register_blueprint(backup_bp)
    app.register_blueprint(redis_bp, url_prefix='/api/redis')
    app.register_blueprint(database_bp, url_prefix='/api/database')
    app.register_blueprint(datasource_bp, url_prefix='/api/datasource')
    app.register_blueprint(grafana_bp, url_prefix='/api/grafana')
    app.register_blueprint(clusters_bp, url_prefix='/api/k8s/clusters')
    app.register_blueprint(namespaces_bp, url_prefix='/api/k8s/namespaces')
    app.register_blueprint(workloads_bp, url_prefix='/api/k8s/workloads')
    app.register_blueprint(services_bp, url_prefix='/api/k8s/services')
    app.register_blueprint(configs_bp, url_prefix='/api/k8s')
    app.register_blueprint(storage_bp, url_prefix='/api/k8s')
    app.register_blueprint(audit_bp, url_prefix='/api/k8s/audit')
    app.register_blueprint(ai_model_config_bp)
    app.register_blueprint(ai_assistant_bp)