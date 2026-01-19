#!/usr/bin/env python3
"""
配置验证脚本
验证生产环境配置文件的完整性和安全性
"""
import os
import sys
import yaml
import re
from pathlib import Path
from typing import Dict, List, Tuple

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

class ConfigValidator:
    def __init__(self, config_dir: str = "config"):
        self.config_dir = Path(config_dir)
        self.errors: List[str] = []
        self.warnings: List[str] = []
        
    def validate_all(self) -> bool:
        """验证所有配置文件"""
        print("=" * 60)
        print("配置验证工具")
        print("=" * 60)
        print()
        
        # 检查配置文件是否存在
        self._check_config_files_exist()
        
        # 验证数据库配置
        self._validate_database_config()
        
        # 验证 Redis 配置
        self._validate_redis_config()
        
        # 验证应用配置
        self._validate_app_config()
        
        # 验证日志配置
        self._validate_logging_config()
        
        # 输出结果
        self._print_results()
        
        return len(self.errors) == 0
    
    def _check_config_files_exist(self):
        """检查必需的配置文件是否存在"""
        required_files = [
            'database.yaml',
            'redis.yaml',
            'app.yaml',
            'logging.yaml'
        ]
        
        for filename in required_files:
            filepath = self.config_dir / filename
            if not filepath.exists():
                self.errors.append(f"配置文件不存在: {filepath}")
            else:
                print(f"✓ 找到配置文件: {filename}")
    
    def _load_yaml(self, filename: str) -> Dict:
        """加载 YAML 配置文件"""
        try:
            with open(self.config_dir / filename, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except Exception as e:
            self.errors.append(f"无法加载 {filename}: {str(e)}")
            return {}
    
    def _validate_database_config(self):
        """验证数据库配置"""
        print("\n检查数据库配置...")
        config = self._load_yaml('database.yaml')
        
        if not config:
            return
        
        db_config = config.get('database', {}).get('postgresql', {})
        
        # 检查必需字段
        required_fields = ['host', 'port', 'database', 'username', 'password']
        for field in required_fields:
            if not db_config.get(field):
                self.errors.append(f"数据库配置缺少字段: {field}")
        
        # 检查密码强度
        password = db_config.get('password', '')
        if password and (password == 'your_password' or password == 'CHANGE_THIS_PASSWORD'):
            self.errors.append("数据库密码使用默认值，必须修改！")
        elif password and len(password) < 12:
            self.warnings.append("数据库密码长度建议至少 12 位")
        
        # 检查连接池配置
        pool_size = db_config.get('pool_size', 0)
        if pool_size < 10:
            self.warnings.append(f"数据库连接池大小 ({pool_size}) 可能不足，建议至少 10")
        
        print("✓ 数据库配置检查完成")
    
    def _validate_redis_config(self):
        """验证 Redis 配置"""
        print("\n检查 Redis 配置...")
        config = self._load_yaml('redis.yaml')
        
        if not config:
            return
        
        redis_config = config.get('redis', {})
        
        # 检查必需字段
        required_fields = ['host', 'port']
        for field in required_fields:
            if not redis_config.get(field):
                self.errors.append(f"Redis 配置缺少字段: {field}")
        
        # 检查密码
        if not redis_config.get('password'):
            self.warnings.append("Redis 未设置密码，生产环境建议设置密码")
        
        # 检查连接池配置
        pool_config = redis_config.get('connection_pool', {})
        max_connections = pool_config.get('max_connections', 0)
        if max_connections < 50:
            self.warnings.append(f"Redis 连接池大小 ({max_connections}) 可能不足，建议至少 50")
        
        print("✓ Redis 配置检查完成")
    
    def _validate_app_config(self):
        """验证应用配置"""
        print("\n检查应用配置...")
        config = self._load_yaml('app.yaml')
        
        if not config:
            return
        
        app_config = config.get('app', {})
        
        # 检查 debug 模式
        if app_config.get('debug', False):
            self.errors.append("生产环境不能启用 debug 模式！")
        
        # 检查 secret_key
        secret_key = app_config.get('secret_key', '')
        if not secret_key or 'CHANGE' in secret_key.upper():
            self.errors.append("SECRET_KEY 使用默认值，必须修改！")
        elif len(secret_key) < 32:
            self.warnings.append("SECRET_KEY 长度建议至少 32 位")
        
        # 检查 JWT 配置
        jwt_config = app_config.get('jwt', {})
        jwt_secret = jwt_config.get('secret_key', '')
        if not jwt_secret or 'CHANGE' in jwt_secret.upper():
            self.errors.append("JWT_SECRET_KEY 使用默认值，必须修改！")
        elif len(jwt_secret) < 32:
            self.warnings.append("JWT_SECRET_KEY 长度建议至少 32 位")
        
        # 检查 CORS 配置
        cors_config = app_config.get('cors', {})
        origins = cors_config.get('origins', [])
        if 'http://localhost' in origins or '*' in origins:
            self.warnings.append("CORS 配置包含不安全的源，生产环境应限制为特定域名")
        
        # 检查安全配置
        security_config = app_config.get('security', {})
        if not security_config.get('session_cookie_secure', False):
            self.warnings.append("建议启用 session_cookie_secure（需要 HTTPS）")
        
        # 检查速率限制
        rate_limit = app_config.get('rate_limit', {})
        if not rate_limit.get('enabled', False):
            self.warnings.append("建议启用 API 速率限制")
        
        print("✓ 应用配置检查完成")
    
    def _validate_logging_config(self):
        """验证日志配置"""
        print("\n检查日志配置...")
        config = self._load_yaml('logging.yaml')
        
        if not config:
            return
        
        # 检查日志级别
        root_level = config.get('root', {}).get('level', 'INFO')
        if root_level == 'DEBUG':
            self.warnings.append("生产环境日志级别建议使用 INFO 或 WARNING")
        
        # 检查日志处理器
        handlers = config.get('handlers', {})
        if not handlers:
            self.errors.append("日志配置缺少处理器")
        
        # 检查日志文件路径
        for handler_name, handler_config in handlers.items():
            if 'filename' in handler_config:
                log_file = Path(handler_config['filename'])
                log_dir = log_file.parent
                if not log_dir.exists():
                    self.warnings.append(f"日志目录不存在: {log_dir}")
        
        print("✓ 日志配置检查完成")
    
    def _print_results(self):
        """输出验证结果"""
        print("\n" + "=" * 60)
        print("验证结果")
        print("=" * 60)
        
        if self.errors:
            print(f"\n❌ 发现 {len(self.errors)} 个错误:")
            for i, error in enumerate(self.errors, 1):
                print(f"  {i}. {error}")
        
        if self.warnings:
            print(f"\n⚠️  发现 {len(self.warnings)} 个警告:")
            for i, warning in enumerate(self.warnings, 1):
                print(f"  {i}. {warning}")
        
        if not self.errors and not self.warnings:
            print("\n✅ 所有配置验证通过！")
        elif not self.errors:
            print("\n✅ 配置验证通过（有警告）")
        else:
            print("\n❌ 配置验证失败，请修复错误后重试")
        
        print("=" * 60)

def main():
    """主函数"""
    validator = ConfigValidator()
    success = validator.validate_all()
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
