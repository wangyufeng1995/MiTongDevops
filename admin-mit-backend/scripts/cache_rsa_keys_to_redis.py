#!/usr/bin/env python
"""
初始化 RSA 密钥到数据库

使用方法:
    python scripts/cache_rsa_keys_to_redis.py

功能:
    1. 创建 global_configs 表（如果不存在）
    2. 检查数据库中是否已有密钥
    3. 如果没有，生成新密钥并存入数据库
    4. 将密钥同步到 Redis
"""

import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config_manager import config_manager
from app.extensions import init_redis
import redis

# 数据库配置键
DB_PRIVATE_KEY = 'rsa_private_key'
DB_PUBLIC_KEY = 'rsa_public_key'

# Redis 缓存键
REDIS_PUBLIC_KEY_CACHE = 'system:rsa:public_key'
REDIS_PRIVATE_KEY_CACHE = 'system:rsa:private_key'


def main():
    print("=" * 60)
    print("RSA 密钥初始化工具")
    print("=" * 60)
    
    # 初始化 Flask 应用上下文
    print("\n[1] 初始化应用...")
    from app import create_app
    app = create_app()
    
    with app.app_context():
        from app.extensions import db
        
        # 创建表
        print("\n[2] 检查/创建 global_configs 表...")
        try:
            db.create_all()
            print("   ✓ 数据库表已就绪")
        except Exception as e:
            print(f"   ✗ 创建表失败: {e}")
            return
        
        # 检查数据库中是否已有密钥
        print("\n[3] 检查数据库中的密钥...")
        from app.models.global_config import GlobalConfig
        
        existing_private = GlobalConfig.get(DB_PRIVATE_KEY)
        existing_public = GlobalConfig.get(DB_PUBLIC_KEY)
        
        if existing_private and existing_public:
            print("   ✓ 数据库中已有密钥")
            print(f"   私钥长度: {len(existing_private)} 字符")
            print(f"   公钥长度: {len(existing_public)} 字符")
            
            # 显示公钥预览
            lines = existing_public.strip().split('\n')
            print(f"\n   公钥预览:")
            for line in lines[:3]:
                print(f"   {line}")
            print("   ...")
        else:
            print("   数据库中没有密钥，将生成新密钥...")
            
            # 初始化密钥服务（会自动生成并保存密钥）
            from app.services.password_service import get_password_decrypt_service
            service = get_password_decrypt_service()
            
            # 重新读取
            existing_private = GlobalConfig.get(DB_PRIVATE_KEY)
            existing_public = GlobalConfig.get(DB_PUBLIC_KEY)
            
            if existing_private and existing_public:
                print("   ✓ 新密钥已生成并保存到数据库")
            else:
                print("   ✗ 密钥生成失败")
                return
        
        # 同步到 Redis
        print("\n[4] 同步密钥到 Redis...")
        init_redis()
        
        redis_config = config_manager.get_redis_config()
        r = redis.Redis(
            host=redis_config['host'],
            port=redis_config['port'],
            password=redis_config.get('password') or None,
            db=redis_config['db'],
            decode_responses=True
        )
        
        try:
            r.ping()
            r.set(REDIS_PRIVATE_KEY_CACHE, existing_private)
            r.set(REDIS_PUBLIC_KEY_CACHE, existing_public)
            print(f"   ✓ 密钥已同步到 Redis: {redis_config['host']}:{redis_config['port']}")
        except Exception as e:
            print(f"   ✗ Redis 同步失败: {e}")
            return
        
        # 显示最终公钥
        print("\n[5] 当前公钥:")
        print("-" * 60)
        print(existing_public)
        print("-" * 60)
        
        print("\n完成！")
        print("\n提示:")
        print("  1. 密钥已存储在数据库 global_configs 表中")
        print("  2. 重启后端服务后，密钥会从数据库加载并同步到 Redis")
        print("  3. 前端需要清除 sessionStorage 中的 'rsa_public_key' 缓存")
        print("  4. 重新保存主机密码即可正常使用")


if __name__ == '__main__':
    main()
