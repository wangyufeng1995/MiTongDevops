import os
import base64
import hashlib
from datetime import datetime
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from app.core.config_manager import config_manager
import logging

logger = logging.getLogger(__name__)

# Redis 缓存键
REDIS_PUBLIC_KEY_CACHE = 'system:rsa:public_key'
REDIS_PRIVATE_KEY_CACHE = 'system:rsa:private_key'

# 数据库配置键
DB_PRIVATE_KEY = 'rsa_private_key'
DB_PUBLIC_KEY = 'rsa_public_key'
DB_KEY_CREATED_AT = 'rsa_key_created_at'


def _get_redis_client():
    """获取 Redis 客户端"""
    try:
        from app.extensions import redis_client
        if redis_client is not None:
            redis_client.ping()
            return redis_client
    except Exception:
        pass
    return None


class PasswordDecryptService:
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        # 只初始化一次
        if PasswordDecryptService._initialized:
            return
        
        self.private_key = None
        self.public_key = None
        self._public_key_pem = None
        PasswordDecryptService._initialized = True
    
    def initialize(self):
        """
        初始化 RSA 密钥对（应用启动时调用一次）
        
        流程:
        1. 用当前时间戳哈希生成新密钥
        2. 存储到数据库
        3. 更新到 Redis 缓存
        """
        if self.private_key is not None:
            return  # 已初始化
        
        try:
            config = config_manager.get_password_encryption_config()
            key_size = config.get('rsa_key_size', 2048)
            
            # 生成新密钥
            seed = f"rsa_key_seed_{datetime.utcnow().isoformat()}"
            seed_hash = hashlib.sha256(seed.encode()).hexdigest()
            
            self.private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=key_size
            )
            self.public_key = self.private_key.public_key()
            
            # 获取 PEM 格式
            private_key_pem = self.private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ).decode('utf-8')
            
            self._public_key_pem = self.public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            ).decode('utf-8')
            
            # 保存到数据库
            self._save_to_db(private_key_pem, self._public_key_pem)
            
            # 缓存到 Redis
            self._cache_to_redis(private_key_pem, self._public_key_pem)
            
            logger.info("[密钥服务] RSA 密钥已生成并保存")
            
        except Exception as e:
            logger.error(f"[密钥服务] 初始化失败: {e}")
            raise
    
    def _save_to_db(self, private_key_pem: str, public_key_pem: str):
        """保存密钥到数据库"""
        try:
            from app.models.global_config import GlobalConfig
            GlobalConfig.set(DB_PRIVATE_KEY, private_key_pem, 'RSA 私钥')
            GlobalConfig.set(DB_PUBLIC_KEY, public_key_pem, 'RSA 公钥')
            GlobalConfig.set(DB_KEY_CREATED_AT, datetime.utcnow().isoformat(), 'RSA 密钥创建时间')
        except Exception as e:
            logger.warning(f"[密钥服务] 保存到数据库失败: {e}")
    
    def _cache_to_redis(self, private_key_pem: str, public_key_pem: str):
        """缓存密钥到 Redis"""
        redis_client = _get_redis_client()
        if redis_client:
            try:
                redis_client.set(REDIS_PRIVATE_KEY_CACHE, private_key_pem)
                redis_client.set(REDIS_PUBLIC_KEY_CACHE, public_key_pem)
            except Exception as e:
                logger.warning(f"[密钥服务] 缓存到 Redis 失败: {e}")
    
    def get_public_key_pem(self) -> str:
        """获取 PEM 格式的公钥"""
        if not self._public_key_pem:
            self.initialize()
        return self._public_key_pem
    
    def decrypt_password(self, encrypted_password: str, host_name: str = '', host_ip: str = '', log: bool = True) -> str:
        """解密密码"""
        if not self.private_key:
            self.initialize()
        
        if not encrypted_password:
            raise ValueError("密码不能为空")
        
        # 短字符串是明文
        if len(encrypted_password) < 50:
            return encrypted_password
        
        try:
            encrypted_bytes = base64.b64decode(encrypted_password)
            
            # 检查长度
            if len(encrypted_bytes) not in [128, 256]:
                try:
                    return encrypted_bytes.decode('utf-8')
                except:
                    return encrypted_password
            
            # 尝试 PKCS#1 v1.5 解密
            try:
                decrypted = self.private_key.decrypt(encrypted_bytes, padding.PKCS1v15())
                return decrypted.decode('utf-8')
            except Exception:
                pass
            
            # 尝试 OAEP 解密
            try:
                decrypted = self.private_key.decrypt(
                    encrypted_bytes,
                    padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()), algorithm=hashes.SHA256(), label=None)
                )
                return decrypted.decode('utf-8')
            except Exception:
                pass
            
            # 解密失败
            if log:
                host_info = f"{host_name} ({host_ip})" if host_ip else host_name
                logger.warning(f"[解密主机密码] 主机 {host_info} 解密失败，返回原始值")
            return encrypted_password
            
        except Exception:
            return encrypted_password


# 全局单例
password_decrypt_service = PasswordDecryptService()
