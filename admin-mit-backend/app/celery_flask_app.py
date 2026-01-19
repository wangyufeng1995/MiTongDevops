"""
Celery 专用的轻量级 Flask 应用工厂
只初始化数据库连接和 Redis，不加载其他扩展
"""
from flask import Flask
from app.extensions import db, init_redis
from app.core.config_manager import config_manager
from datetime import timedelta
from urllib.parse import quote_plus


def create_celery_flask_app():
    """创建 Celery 专用的轻量级 Flask 应用"""
    app = Flask(__name__)
    
    # 数据库配置
    db_config = config_manager.get_database_config()
    encoded_password = quote_plus(db_config['password'])
    app.config['SQLALCHEMY_DATABASE_URI'] = (
        f"postgresql://{db_config['username']}:{encoded_password}"
        f"@{db_config['host']}:{db_config['port']}/{db_config['database']}"
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_size': 5,
        'max_overflow': 10,
        'pool_timeout': 30,
        'pool_recycle': 1800,
    }
    
    # 基本配置
    app_config = config_manager.get_app_config()
    app.config['SECRET_KEY'] = app_config['secret_key']
    
    # 初始化数据库
    db.init_app(app)
    
    # 初始化 Redis
    init_redis()
    
    return app
