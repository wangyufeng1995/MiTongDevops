#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
批量解密已存储的主机密码
将加密的密码解密后重新存储为明文
"""
import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.models.host import SSHHost
from app.services.password_service import PasswordDecryptService

def decrypt_all_host_passwords():
    """解密所有主机的密码"""
    app = create_app()
    
    with app.app_context():
        password_service = PasswordDecryptService()
        
        # 获取所有使用密码认证的主机
        hosts = SSHHost.query.filter_by(auth_type='password').all()
        
        print(f"找到 {len(hosts)} 个使用密码认证的主机")
        
        updated_count = 0
        for host in hosts:
            if not host.password:
                print(f"  跳过 {host.name}: 密码为空")
                continue
            
            # 检查密码是否已经是明文（长度小于50通常是明文）
            if len(host.password) < 50:
                print(f"  跳过 {host.name}: 密码可能已是明文 (长度={len(host.password)})")
                continue
            
            try:
                # 尝试解密
                decrypted = password_service.decrypt_password(host.password)
                
                # 如果解密后和原来一样，说明本来就是明文
                if decrypted == host.password:
                    print(f"  跳过 {host.name}: 密码已是明文")
                    continue
                
                # 更新为解密后的密码
                old_len = len(host.password)
                host.password = decrypted
                updated_count += 1
                print(f"  更新 {host.name}: {old_len} -> {len(decrypted)} 字符")
                
            except Exception as e:
                print(f"  错误 {host.name}: {e}")
        
        if updated_count > 0:
            db.session.commit()
            print(f"\n成功更新 {updated_count} 个主机的密码")
        else:
            print("\n没有需要更新的主机")

if __name__ == '__main__':
    decrypt_all_host_passwords()
