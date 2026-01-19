#!/usr/bin/env python3
"""
密钥生成脚本
生成安全的密钥用于生产环境配置
"""
import secrets
import string
import sys
from pathlib import Path

def generate_secret_key(length: int = 64) -> str:
    """生成随机密钥"""
    alphabet = string.ascii_letters + string.digits + string.punctuation
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def generate_password(length: int = 32) -> str:
    """生成强密码"""
    # 确保包含各种字符类型
    password = []
    
    # 至少包含一个大写字母
    password.append(secrets.choice(string.ascii_uppercase))
    
    # 至少包含一个小写字母
    password.append(secrets.choice(string.ascii_lowercase))
    
    # 至少包含一个数字
    password.append(secrets.choice(string.digits))
    
    # 至少包含一个特殊字符
    special_chars = '!@#$%^&*()_+-=[]{}|;:,.<>?'
    password.append(secrets.choice(special_chars))
    
    # 填充剩余长度
    alphabet = string.ascii_letters + string.digits + special_chars
    for _ in range(length - 4):
        password.append(secrets.choice(alphabet))
    
    # 打乱顺序
    secrets.SystemRandom().shuffle(password)
    
    return ''.join(password)

def main():
    """主函数"""
    print("=" * 60)
    print("密钥生成工具")
    print("=" * 60)
    print()
    print("生成的密钥请妥善保管，不要泄露给他人！")
    print()
    
    # 生成各种密钥
    secrets_dict = {
        'SECRET_KEY': generate_secret_key(64),
        'JWT_SECRET_KEY': generate_secret_key(64),
        'DB_PASSWORD': generate_password(32),
        'REDIS_PASSWORD': generate_password(32),
    }
    
    # 输出密钥
    print("生成的密钥：")
    print("-" * 60)
    for key, value in secrets_dict.items():
        print(f"{key}={value}")
    print("-" * 60)
    print()
    
    # 生成 .env 文件内容
    print("可以将以下内容添加到 .env 文件：")
    print("-" * 60)
    env_content = f"""# 安全密钥配置（自动生成）
# 生成时间: {Path(__file__).stat().st_mtime}

# Flask 应用密钥
SECRET_KEY={secrets_dict['SECRET_KEY']}

# JWT 密钥
JWT_SECRET_KEY={secrets_dict['JWT_SECRET_KEY']}

# 数据库密码
DB_PASSWORD={secrets_dict['DB_PASSWORD']}

# Redis 密码
REDIS_PASSWORD={secrets_dict['REDIS_PASSWORD']}
"""
    print(env_content)
    print("-" * 60)
    print()
    
    # 询问是否保存到文件
    response = input("是否将密钥保存到 secrets.txt 文件？(y/N): ").strip().lower()
    if response == 'y':
        secrets_file = Path('secrets.txt')
        with open(secrets_file, 'w') as f:
            f.write(env_content)
        print(f"✓ 密钥已保存到 {secrets_file}")
        print("⚠️  请妥善保管此文件，不要提交到版本控制系统！")
    else:
        print("密钥未保存到文件")
    
    print()
    print("=" * 60)

if __name__ == '__main__':
    main()
