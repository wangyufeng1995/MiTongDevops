import os
import yaml
from typing import Dict, Any
from pathlib import Path

class ConfigManager:
    def __init__(self, config_dir: str = "config", skip_load: bool = False):
        self.config_dir = Path(config_dir)
        self._configs = {}
        if not skip_load:
            self._load_all_configs()
    
    def _load_all_configs(self):
        """加载所有配置文件"""
        config_files = {
            'database': 'database.yaml',
            'redis': 'redis.yaml', 
            'app': 'app.yaml',
            'logging': 'logging.yaml'
        }
        
        for config_name, filename in config_files.items():
            config_path = self.config_dir / filename
            if config_path.exists():
                with open(config_path, 'r', encoding='utf-8') as f:
                    self._configs[config_name] = yaml.safe_load(f)
            else:
                raise FileNotFoundError(f"配置文件不存在: {config_path}")
    
    def get_database_config(self, env: str = "postgresql") -> Dict[str, Any]:
        """获取数据库配置"""
        if not self._configs:
            return {}
        return self._configs.get('database', {}).get('database', {}).get(env, {})
    
    def get_redis_config(self) -> Dict[str, Any]:
        """获取 Redis 配置"""
        if not self._configs:
            return {}
        return self._configs.get('redis', {}).get('redis', {})
    
    def get_app_config(self) -> Dict[str, Any]:
        """获取应用配置"""
        if not self._configs:
            return {}
        return self._configs.get('app', {}).get('app', {})
    
    def get_logging_config(self) -> Dict[str, Any]:
        """获取日志配置"""
        if not self._configs:
            return {}
        return self._configs.get('logging', {})
    
    def get_jwt_config(self) -> Dict[str, Any]:
        """获取 JWT 配置"""
        if not self._configs:
            return {}
        return self._configs.get('app', {}).get('app', {}).get('jwt', {})
    
    def get_celery_config(self) -> Dict[str, Any]:
        """获取 Celery 配置"""
        if not self._configs:
            return {}
        return self._configs.get('app', {}).get('app', {}).get('celery', {})
    
    def get_password_encryption_config(self) -> Dict[str, Any]:
        """获取密码加密配置"""
        if not self._configs:
            return {}
        return self._configs.get('app', {}).get('app', {}).get('password_encryption', {})
    
    def get_csrf_config(self) -> Dict[str, Any]:
        """获取 CSRF 配置"""
        if not self._configs:
            return {}
        return self._configs.get('app', {}).get('app', {}).get('csrf', {})
    
    def get_cors_config(self) -> Dict[str, Any]:
        """获取 CORS 配置"""
        if not self._configs:
            return {}
        
        # 首先尝试从环境变量获取
        cors_origins_env = os.getenv('CORS_ORIGINS')
        if cors_origins_env:
            origins = [origin.strip() for origin in cors_origins_env.split(',')]
            return {'origins': origins}
        
        # 然后从配置文件获取
        return self._configs.get('app', {}).get('app', {}).get('cors', {})

# 全局配置管理器实例
try:
    config_manager = ConfigManager()
except FileNotFoundError:
    # 测试环境下可能没有配置文件，创建一个空的配置管理器
    config_manager = ConfigManager(skip_load=True)