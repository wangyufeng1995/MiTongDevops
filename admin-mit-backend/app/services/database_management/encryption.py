"""
数据库密码加密服务
"""
import os
import base64
import logging
from typing import Optional
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)


class DatabasePasswordEncryptionService:
    """
    数据库密码加密服务
    
    使用 Fernet 对称加密算法加密和解密密码。
    密钥从环境变量或配置文件中获取。
    """
    
    _instance = None
    _key: Optional[bytes] = None
    _fernet: Optional[Fernet] = None
    
    def __new__(cls):
        """单例模式"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        """初始化加密服务"""
        if self._initialized:
            return
        
        self._initialize_key()
        self._initialized = True
    
    def _initialize_key(self):
        """初始化加密密钥"""
        key_str = os.environ.get('DATABASE_PASSWORD_ENCRYPTION_KEY') or \
                  os.environ.get('REDIS_PASSWORD_ENCRYPTION_KEY')
        
        if key_str:
            try:
                self._key = base64.urlsafe_b64decode(key_str)
            except Exception:
                self._key = key_str.encode() if isinstance(key_str, str) else key_str
        else:
            self._key = Fernet.generate_key()
            logger.warning(
                "DATABASE_PASSWORD_ENCRYPTION_KEY not set, using generated key. "
                "This is not recommended for production!"
            )
        
        try:
            self._fernet = Fernet(self._key)
        except Exception as e:
            logger.warning(f"Invalid encryption key, generating new one: {e}")
            self._key = Fernet.generate_key()
            self._fernet = Fernet(self._key)
    
    def encrypt(self, plaintext: str) -> str:
        """加密明文"""
        if not plaintext:
            return ""
        encrypted = self._fernet.encrypt(plaintext.encode('utf-8'))
        return encrypted.decode('utf-8')
    
    def decrypt(self, ciphertext: str) -> str:
        """解密密文"""
        if not ciphertext:
            return ""
        
        if ciphertext.startswith('gAAAAA'):
            try:
                decrypted = self._fernet.decrypt(ciphertext.encode('utf-8'))
                return decrypted.decode('utf-8')
            except Exception as e:
                logger.error(f"Failed to decrypt Fernet password: {e}")
                raise ValueError("密码解密失败，请重新设置密码")
        
        if ciphertext.startswith('Z0FBQUFB'):
            try:
                decoded = base64.urlsafe_b64decode(ciphertext.encode('utf-8'))
                if decoded.startswith(b'gAAAAA'):
                    decrypted = self._fernet.decrypt(decoded)
                    return decrypted.decode('utf-8')
            except Exception as e:
                logger.error(f"Failed to decrypt Base64+Fernet password: {e}")
        
        logger.debug("Password is not encrypted, using as plaintext")
        return ciphertext


# 全局密码加密服务实例
db_password_encryption_service = DatabasePasswordEncryptionService()
