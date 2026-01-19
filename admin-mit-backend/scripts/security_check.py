#!/usr/bin/env python3
"""
安全配置检查脚本
检查系统安全配置是否符合最佳实践
"""
import os
import sys
import yaml
import subprocess
from pathlib import Path
from typing import List, Dict, Tuple

class SecurityChecker:
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.passed: List[str] = []
    
    def check_all(self) -> bool:
        """运行所有安全检查"""
        print("=" * 60)
        print("安全配置检查工具")
        print("=" * 60)
        print()
        
        self.check_file_permissions()
        self.check_environment_variables()
        self.check_ssl_configuration()
        self.check_firewall_rules()
        self.check_docker_security()
        self.check_dependencies()
        
        self._print_results()
        
        return len(self.errors) == 0
    
    def check_file_permissions(self):
        """检查文件权限"""
        print("检查文件权限...")
        
        sensitive_files = [
            'config/database.yaml',
            'config/redis.yaml',
            'config/app.yaml',
            'keys/private_key.pem',
            '.env'
        ]
        
        for filepath in sensitive_files:
            if os.path.exists(filepath):
                stat_info = os.stat(filepath)
                mode = oct(stat_info.st_mode)[-3:]
                
                if mode != '600' and mode != '400':
                    self.warnings.append(
                        f"文件 {filepath} 权限过于宽松 ({mode})，建议设置为 600"
                    )
                else:
                    self.passed.append(f"文件 {filepath} 权限正确")
        
        print("✓ 文件权限检查完成")
    
    def check_environment_variables(self):
        """检查环境变量"""
        print("\n检查环境变量...")
        
        required_vars = [
            'SECRET_KEY',
            'JWT_SECRET_KEY',
            'DB_PASSWORD'
        ]
        
        for var in required_vars:
            value = os.environ.get(var, '')
            
            if not value:
                self.warnings.append(f"环境变量 {var} 未设置")
            elif 'CHANGE' in value.upper() or 'your' in value.lower():
                self.errors.append(f"环境变量 {var} 使用默认值，必须修改！")
            elif len(value) < 32:
                self.warnings.append(f"环境变量 {var} 长度不足 32 位")
            else:
                self.passed.append(f"环境变量 {var} 配置正确")
        
        print("✓ 环境变量检查完成")
    
    def check_ssl_configuration(self):
        """检查 SSL 配置"""
        print("\n检查 SSL 配置...")
        
        # 检查 SSL 证书文件
        ssl_files = [
            '/etc/nginx/ssl/cert.pem',
            '/etc/nginx/ssl/key.pem'
        ]
        
        ssl_configured = all(os.path.exists(f) for f in ssl_files)
        
        if not ssl_configured:
            self.warnings.append(
                "SSL 证书未配置，生产环境必须启用 HTTPS"
            )
        else:
            self.passed.append("SSL 证书已配置")
        
        print("✓ SSL 配置检查完成")
    
    def check_firewall_rules(self):
        """检查防火墙规则"""
        print("\n检查防火墙规则...")
        
        try:
            # 检查 iptables 规则
            result = subprocess.run(
                ['iptables', '-L', '-n'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                self.passed.append("防火墙规则已配置")
            else:
                self.warnings.append("无法检查防火墙规则")
        except (subprocess.TimeoutExpired, FileNotFoundError):
            self.warnings.append("防火墙检查工具不可用")
        
        print("✓ 防火墙规则检查完成")
    
    def check_docker_security(self):
        """检查 Docker 安全配置"""
        print("\n检查 Docker 安全配置...")
        
        # 检查 Docker 是否以 root 运行
        try:
            result = subprocess.run(
                ['docker', 'info'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if 'rootless' in result.stdout.lower():
                self.passed.append("Docker 使用 rootless 模式")
            else:
                self.warnings.append(
                    "Docker 以 root 运行，建议使用 rootless 模式"
                )
        except (subprocess.TimeoutExpired, FileNotFoundError):
            self.warnings.append("无法检查 Docker 配置")
        
        print("✓ Docker 安全配置检查完成")
    
    def check_dependencies(self):
        """检查依赖漏洞"""
        print("\n检查依赖漏洞...")
        
        # 检查 Python 依赖
        try:
            result = subprocess.run(
                ['pip', 'list', '--outdated'],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.stdout:
                outdated_count = len(result.stdout.strip().split('\n')) - 2
                if outdated_count > 0:
                    self.warnings.append(
                        f"发现 {outdated_count} 个过时的 Python 包"
                    )
            else:
                self.passed.append("Python 依赖都是最新的")
        except (subprocess.TimeoutExpired, FileNotFoundError):
            self.warnings.append("无法检查 Python 依赖")
        
        print("✓ 依赖漏洞检查完成")
    
    def _print_results(self):
        """输出检查结果"""
        print("\n" + "=" * 60)
        print("检查结果")
        print("=" * 60)
        
        if self.passed:
            print(f"\n✅ 通过 {len(self.passed)} 项检查:")
            for item in self.passed[:5]:  # 只显示前5项
                print(f"  • {item}")
            if len(self.passed) > 5:
                print(f"  ... 还有 {len(self.passed) - 5} 项")
        
        if self.warnings:
            print(f"\n⚠️  发现 {len(self.warnings)} 个警告:")
            for i, warning in enumerate(self.warnings, 1):
                print(f"  {i}. {warning}")
        
        if self.errors:
            print(f"\n❌ 发现 {len(self.errors)} 个错误:")
            for i, error in enumerate(self.errors, 1):
                print(f"  {i}. {error}")
        
        if not self.errors and not self.warnings:
            print("\n✅ 所有安全检查通过！")
        elif not self.errors:
            print("\n✅ 安全检查通过（有警告）")
        else:
            print("\n❌ 安全检查失败，请修复错误后重试")
        
        print("=" * 60)

def main():
    """主函数"""
    checker = SecurityChecker()
    success = checker.check_all()
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
