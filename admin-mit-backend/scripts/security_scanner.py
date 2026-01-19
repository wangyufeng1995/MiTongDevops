#!/usr/bin/env python3
"""
安全漏洞扫描脚本
扫描系统中的常见安全漏洞和配置问题
"""

import os
import sys
import re
import json
from pathlib import Path
from typing import List, Dict, Tuple
from datetime import datetime

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class SecurityScanner:
    """安全扫描器"""
    
    def __init__(self, project_root: str):
        """
        初始化安全扫描器
        
        Args:
            project_root: 项目根目录
        """
        self.project_root = Path(project_root)
        self.issues = []
        self.severity_colors = {
            'CRITICAL': '\033[91m',  # 红色
            'HIGH': '\033[93m',      # 黄色
            'MEDIUM': '\033[94m',    # 蓝色
            'LOW': '\033[92m',       # 绿色
            'INFO': '\033[90m',      # 灰色
            'RESET': '\033[0m'       # 重置
        }
    
    def add_issue(self, severity: str, category: str, description: str, 
                  file_path: str = None, line_number: int = None, 
                  recommendation: str = None):
        """
        添加安全问题
        
        Args:
            severity: 严重程度 (CRITICAL, HIGH, MEDIUM, LOW, INFO)
            category: 问题类别
            description: 问题描述
            file_path: 文件路径
            line_number: 行号
            recommendation: 修复建议
        """
        issue = {
            'severity': severity,
            'category': category,
            'description': description,
            'file_path': file_path,
            'line_number': line_number,
            'recommendation': recommendation,
            'timestamp': datetime.now().isoformat()
        }
        self.issues.append(issue)
    
    def scan_hardcoded_secrets(self):
        """扫描硬编码的密钥和敏感信息"""
        print("\n[*] 扫描硬编码的密钥和敏感信息...")
        
        # 敏感信息模式
        patterns = {
            'password': r'password\s*=\s*["\'](?!.*\{.*\})[^"\']{8,}["\']',
            'api_key': r'api[_-]?key\s*=\s*["\'][^"\']{20,}["\']',
            'secret_key': r'secret[_-]?key\s*=\s*["\'](?!.*\{.*\})[^"\']{20,}["\']',
            'private_key': r'-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----',
            'aws_key': r'AKIA[0-9A-Z]{16}',
            'jwt_secret': r'jwt[_-]?secret\s*=\s*["\'][^"\']{20,}["\']',
        }
        
        # 排除的文件和目录
        exclude_patterns = [
            '*.pyc', '__pycache__', '.git', 'node_modules', 
            'venv', '.env.example', 'test_*.py', '*_test.py',
            'migrations', 'alembic'
        ]
        
        python_files = []
        for pattern in ['**/*.py', '**/*.yaml', '**/*.yml', '**/*.json']:
            python_files.extend(self.project_root.glob(pattern))
        
        for file_path in python_files:
            # 跳过排除的文件
            if any(file_path.match(pattern) for pattern in exclude_patterns):
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    lines = content.split('\n')
                    
                    for pattern_name, pattern in patterns.items():
                        matches = re.finditer(pattern, content, re.IGNORECASE)
                        for match in matches:
                            # 计算行号
                            line_number = content[:match.start()].count('\n') + 1
                            line_content = lines[line_number - 1].strip()
                            
                            # 跳过注释和示例
                            if line_content.startswith('#') or 'example' in line_content.lower():
                                continue
                            
                            self.add_issue(
                                severity='CRITICAL',
                                category='Hardcoded Secrets',
                                description=f'发现硬编码的{pattern_name}: {match.group()[:50]}...',
                                file_path=str(file_path.relative_to(self.project_root)),
                                line_number=line_number,
                                recommendation='使用环境变量或配置文件管理敏感信息'
                            )
            except Exception as e:
                print(f"[!] 扫描文件失败 {file_path}: {e}")
    
    def scan_sql_injection_vulnerabilities(self):
        """扫描SQL注入漏洞"""
        print("\n[*] 扫描SQL注入漏洞...")
        
        # 危险的SQL模式
        dangerous_patterns = [
            r'execute\s*\(\s*f["\'].*\{.*\}',  # f-string in execute
            r'execute\s*\(\s*["\'].*%s.*["\'].*%',  # % formatting
            r'execute\s*\(\s*["\'].*\+',  # string concatenation
            r'raw\s*\(\s*f["\']',  # raw query with f-string
        ]
        
        python_files = list(self.project_root.glob('**/*.py'))
        
        for file_path in python_files:
            if '__pycache__' in str(file_path) or 'test_' in file_path.name:
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    lines = content.split('\n')
                    
                    for pattern in dangerous_patterns:
                        matches = re.finditer(pattern, content, re.IGNORECASE)
                        for match in matches:
                            line_number = content[:match.start()].count('\n') + 1
                            
                            self.add_issue(
                                severity='HIGH',
                                category='SQL Injection',
                                description=f'可能存在SQL注入风险: {match.group()[:50]}...',
                                file_path=str(file_path.relative_to(self.project_root)),
                                line_number=line_number,
                                recommendation='使用参数化查询或ORM的安全方法'
                            )
            except Exception as e:
                print(f"[!] 扫描文件失败 {file_path}: {e}")
    
    def scan_xss_vulnerabilities(self):
        """扫描XSS漏洞"""
        print("\n[*] 扫描XSS漏洞...")
        
        # 危险的模板渲染模式
        dangerous_patterns = [
            r'\{\{\s*[^|]*\s*\|\s*safe\s*\}\}',  # Jinja2 safe filter
            r'dangerouslySetInnerHTML',  # React
            r'v-html',  # Vue
            r'innerHTML\s*=',  # JavaScript
        ]
        
        template_files = []
        for pattern in ['**/*.html', '**/*.jsx', '**/*.tsx', '**/*.vue']:
            template_files.extend(self.project_root.glob(pattern))
        
        for file_path in template_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    lines = content.split('\n')
                    
                    for pattern in dangerous_patterns:
                        matches = re.finditer(pattern, content, re.IGNORECASE)
                        for match in matches:
                            line_number = content[:match.start()].count('\n') + 1
                            
                            self.add_issue(
                                severity='HIGH',
                                category='XSS Vulnerability',
                                description=f'可能存在XSS风险: {match.group()[:50]}...',
                                file_path=str(file_path.relative_to(self.project_root)),
                                line_number=line_number,
                                recommendation='使用自动转义或内容安全策略(CSP)'
                            )
            except Exception as e:
                print(f"[!] 扫描文件失败 {file_path}: {e}")
    
    def scan_weak_crypto(self):
        """扫描弱加密算法"""
        print("\n[*] 扫描弱加密算法...")
        
        weak_crypto_patterns = {
            'MD5': r'hashlib\.md5\(',
            'SHA1': r'hashlib\.sha1\(',
            'DES': r'Crypto\.Cipher\.DES',
            'RC4': r'Crypto\.Cipher\.ARC4',
        }
        
        python_files = list(self.project_root.glob('**/*.py'))
        
        for file_path in python_files:
            if '__pycache__' in str(file_path) or 'test_' in file_path.name:
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                    for algo_name, pattern in weak_crypto_patterns.items():
                        matches = re.finditer(pattern, content)
                        for match in matches:
                            line_number = content[:match.start()].count('\n') + 1
                            
                            self.add_issue(
                                severity='MEDIUM',
                                category='Weak Cryptography',
                                description=f'使用了弱加密算法: {algo_name}',
                                file_path=str(file_path.relative_to(self.project_root)),
                                line_number=line_number,
                                recommendation=f'使用更强的加密算法，如SHA-256或bcrypt'
                            )
            except Exception as e:
                print(f"[!] 扫描文件失败 {file_path}: {e}")
    
    def scan_insecure_configurations(self):
        """扫描不安全的配置"""
        print("\n[*] 扫描不安全的配置...")
        
        # 检查配置文件
        config_patterns = {
            'DEBUG = True': ('HIGH', '生产环境不应启用DEBUG模式'),
            'TESTING = True': ('MEDIUM', '生产环境不应启用TESTING模式'),
            'SECRET_KEY = ["\']test': ('CRITICAL', '使用了测试密钥'),
            'SSL_VERIFY = False': ('HIGH', '禁用了SSL验证'),
            'VERIFY_SSL = False': ('HIGH', '禁用了SSL验证'),
        }
        
        config_files = []
        for pattern in ['**/*.py', '**/*.yaml', '**/*.yml', '**/*.json']:
            config_files.extend(self.project_root.glob(pattern))
        
        for file_path in config_files:
            if '__pycache__' in str(file_path):
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                    for pattern, (severity, description) in config_patterns.items():
                        if re.search(pattern, content, re.IGNORECASE):
                            line_number = content[:content.find(pattern)].count('\n') + 1 if pattern in content else None
                            
                            self.add_issue(
                                severity=severity,
                                category='Insecure Configuration',
                                description=description,
                                file_path=str(file_path.relative_to(self.project_root)),
                                line_number=line_number,
                                recommendation='修改配置以符合生产环境安全要求'
                            )
            except Exception as e:
                print(f"[!] 扫描文件失败 {file_path}: {e}")
    
    def scan_dependency_vulnerabilities(self):
        """扫描依赖包漏洞"""
        print("\n[*] 扫描依赖包漏洞...")
        
        # 检查requirements.txt
        requirements_file = self.project_root / 'requirements.txt'
        if requirements_file.exists():
            try:
                with open(requirements_file, 'r') as f:
                    content = f.read()
                    
                    # 检查是否固定版本
                    unfixed_deps = re.findall(r'^([a-zA-Z0-9_-]+)(?![=<>])', content, re.MULTILINE)
                    if unfixed_deps:
                        self.add_issue(
                            severity='MEDIUM',
                            category='Dependency Management',
                            description=f'发现未固定版本的依赖包: {", ".join(unfixed_deps[:5])}...',
                            file_path='requirements.txt',
                            recommendation='固定依赖包版本以确保可重现的构建'
                        )
            except Exception as e:
                print(f"[!] 扫描requirements.txt失败: {e}")
        
        # 检查package.json
        package_json = self.project_root / 'package.json'
        if package_json.exists():
            self.add_issue(
                severity='INFO',
                category='Dependency Management',
                description='建议定期运行npm audit检查前端依赖漏洞',
                file_path='package.json',
                recommendation='运行: npm audit fix'
            )
    
    def scan_authentication_issues(self):
        """扫描认证相关问题"""
        print("\n[*] 扫描认证相关问题...")
        
        # 检查JWT配置
        patterns = {
            r'JWT_SECRET_KEY\s*=\s*["\'](?!.*\{.*\})[^"\']{1,20}["\']': (
                'HIGH', 'JWT密钥过短', '使用至少32字符的强密钥'
            ),
            r'JWT_ACCESS_TOKEN_EXPIRES\s*=\s*timedelta\(days=\d+\)': (
                'MEDIUM', 'Access token过期时间过长', '建议设置为1小时以内'
            ),
        }
        
        python_files = list(self.project_root.glob('**/*.py'))
        
        for file_path in python_files:
            if '__pycache__' in str(file_path):
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                    for pattern, (severity, description, recommendation) in patterns.items():
                        matches = re.finditer(pattern, content)
                        for match in matches:
                            line_number = content[:match.start()].count('\n') + 1
                            
                            self.add_issue(
                                severity=severity,
                                category='Authentication',
                                description=description,
                                file_path=str(file_path.relative_to(self.project_root)),
                                line_number=line_number,
                                recommendation=recommendation
                            )
            except Exception as e:
                print(f"[!] 扫描文件失败 {file_path}: {e}")
    
    def generate_report(self, output_format='console'):
        """
        生成扫描报告
        
        Args:
            output_format: 输出格式 (console, json, html)
        """
        if output_format == 'console':
            self._print_console_report()
        elif output_format == 'json':
            self._print_json_report()
        elif output_format == 'html':
            self._generate_html_report()
    
    def _print_console_report(self):
        """打印控制台报告"""
        print("\n" + "="*80)
        print("安全扫描报告")
        print("="*80)
        
        # 按严重程度分组
        severity_counts = {}
        for issue in self.issues:
            severity = issue['severity']
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        print(f"\n总计发现 {len(self.issues)} 个安全问题:")
        for severity in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']:
            count = severity_counts.get(severity, 0)
            if count > 0:
                color = self.severity_colors[severity]
                reset = self.severity_colors['RESET']
                print(f"  {color}{severity}: {count}{reset}")
        
        # 打印详细问题
        print("\n" + "-"*80)
        print("详细问题列表:")
        print("-"*80)
        
        for i, issue in enumerate(self.issues, 1):
            color = self.severity_colors[issue['severity']]
            reset = self.severity_colors['RESET']
            
            print(f"\n{i}. {color}[{issue['severity']}]{reset} {issue['category']}")
            print(f"   描述: {issue['description']}")
            if issue['file_path']:
                location = f"{issue['file_path']}"
                if issue['line_number']:
                    location += f":{issue['line_number']}"
                print(f"   位置: {location}")
            if issue['recommendation']:
                print(f"   建议: {issue['recommendation']}")
        
        print("\n" + "="*80)
    
    def _print_json_report(self):
        """打印JSON格式报告"""
        report = {
            'scan_time': datetime.now().isoformat(),
            'total_issues': len(self.issues),
            'issues': self.issues
        }
        print(json.dumps(report, indent=2, ensure_ascii=False))
    
    def _generate_html_report(self):
        """生成HTML格式报告"""
        html_template = """
<!DOCTYPE html>
<html>
<head>
    <title>安全扫描报告</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        h1 {{ color: #333; }}
        .summary {{ background: #f5f5f5; padding: 15px; border-radius: 5px; }}
        .issue {{ margin: 20px 0; padding: 15px; border-left: 4px solid #ddd; }}
        .critical {{ border-left-color: #d32f2f; }}
        .high {{ border-left-color: #f57c00; }}
        .medium {{ border-left-color: #1976d2; }}
        .low {{ border-left-color: #388e3c; }}
        .info {{ border-left-color: #757575; }}
        .severity {{ font-weight: bold; padding: 2px 8px; border-radius: 3px; }}
        .severity.critical {{ background: #d32f2f; color: white; }}
        .severity.high {{ background: #f57c00; color: white; }}
        .severity.medium {{ background: #1976d2; color: white; }}
        .severity.low {{ background: #388e3c; color: white; }}
        .severity.info {{ background: #757575; color: white; }}
    </style>
</head>
<body>
    <h1>安全扫描报告</h1>
    <div class="summary">
        <p>扫描时间: {scan_time}</p>
        <p>总计发现: {total_issues} 个安全问题</p>
    </div>
    <h2>问题列表</h2>
    {issues_html}
</body>
</html>
        """
        
        issues_html = ""
        for issue in self.issues:
            severity_class = issue['severity'].lower()
            location = issue['file_path'] or 'N/A'
            if issue['line_number']:
                location += f":{issue['line_number']}"
            
            issues_html += f"""
    <div class="issue {severity_class}">
        <span class="severity {severity_class}">{issue['severity']}</span>
        <strong>{issue['category']}</strong>
        <p>{issue['description']}</p>
        <p><em>位置: {location}</em></p>
        {f'<p><strong>建议:</strong> {issue["recommendation"]}</p>' if issue['recommendation'] else ''}
    </div>
            """
        
        html_content = html_template.format(
            scan_time=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            total_issues=len(self.issues),
            issues_html=issues_html
        )
        
        output_file = self.project_root / 'security_scan_report.html'
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"\n[+] HTML报告已生成: {output_file}")
    
    def run_all_scans(self):
        """运行所有扫描"""
        print("\n" + "="*80)
        print("开始安全扫描...")
        print("="*80)
        
        self.scan_hardcoded_secrets()
        self.scan_sql_injection_vulnerabilities()
        self.scan_xss_vulnerabilities()
        self.scan_weak_crypto()
        self.scan_insecure_configurations()
        self.scan_dependency_vulnerabilities()
        self.scan_authentication_issues()
        
        print("\n[+] 扫描完成!")


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='安全漏洞扫描工具')
    parser.add_argument('--path', default='.', help='项目根目录路径')
    parser.add_argument('--format', choices=['console', 'json', 'html'], 
                       default='console', help='报告输出格式')
    
    args = parser.parse_args()
    
    # 创建扫描器
    scanner = SecurityScanner(args.path)
    
    # 运行扫描
    scanner.run_all_scans()
    
    # 生成报告
    scanner.generate_report(output_format=args.format)
    
    # 返回退出码（如果有严重问题则返回1）
    critical_issues = [i for i in scanner.issues if i['severity'] == 'CRITICAL']
    if critical_issues:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == '__main__':
    main()
