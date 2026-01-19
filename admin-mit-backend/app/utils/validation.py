"""
数据验证工具函数
"""
from typing import List, Dict, Any, Optional
import re


def validate_required_fields(data: Dict[str, Any], required_fields: List[str]) -> Optional[str]:
    """
    验证必需字段
    
    Args:
        data: 要验证的数据
        required_fields: 必需字段列表
    
    Returns:
        Optional[str]: 验证错误信息，如果验证通过则返回None
    """
    missing_fields = []
    
    for field in required_fields:
        if field not in data or data[field] is None or data[field] == "":
            missing_fields.append(field)
    
    if missing_fields:
        return f"缺少必需字段: {', '.join(missing_fields)}"
    
    return None


def validate_email(email: str) -> bool:
    """
    验证邮箱格式
    
    Args:
        email: 邮箱地址
    
    Returns:
        bool: 是否为有效邮箱
    """
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_phone(phone: str) -> bool:
    """
    验证手机号格式
    
    Args:
        phone: 手机号
    
    Returns:
        bool: 是否为有效手机号
    """
    pattern = r'^1[3-9]\d{9}$'
    return re.match(pattern, phone) is not None


def validate_password_strength(password: str, policy: Dict[str, Any]) -> Optional[str]:
    """
    验证密码强度
    
    Args:
        password: 密码
        policy: 密码策略
    
    Returns:
        Optional[str]: 验证错误信息，如果验证通过则返回None
    """
    min_length = policy.get('min_length', 8)
    require_uppercase = policy.get('require_uppercase', False)
    require_lowercase = policy.get('require_lowercase', False)
    require_numbers = policy.get('require_numbers', False)
    require_symbols = policy.get('require_symbols', False)
    
    if len(password) < min_length:
        return f"密码长度不能少于{min_length}位"
    
    if require_uppercase and not re.search(r'[A-Z]', password):
        return "密码必须包含大写字母"
    
    if require_lowercase and not re.search(r'[a-z]', password):
        return "密码必须包含小写字母"
    
    if require_numbers and not re.search(r'\d', password):
        return "密码必须包含数字"
    
    if require_symbols and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return "密码必须包含特殊字符"
    
    return None


def validate_ip_address(ip: str) -> bool:
    """
    验证IP地址格式
    
    Args:
        ip: IP地址
    
    Returns:
        bool: 是否为有效IP地址
    """
    pattern = r'^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$'
    return re.match(pattern, ip) is not None


def validate_port(port: int) -> bool:
    """
    验证端口号
    
    Args:
        port: 端口号
    
    Returns:
        bool: 是否为有效端口号
    """
    return 1 <= port <= 65535


def validate_url(url: str) -> bool:
    """
    验证URL格式
    
    Args:
        url: URL地址
    
    Returns:
        bool: 是否为有效URL
    """
    pattern = r'^https?://(?:[-\w.])+(?:\:[0-9]+)?(?:/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:\#(?:[\w.])*)?)?$'
    return re.match(pattern, url) is not None


def sanitize_input(text: str) -> str:
    """
    清理输入文本，防止XSS攻击
    
    Args:
        text: 输入文本
    
    Returns:
        str: 清理后的文本
    """
    if not text:
        return ""
    
    # 移除潜在的危险字符
    dangerous_chars = ['<', '>', '"', "'", '&', 'javascript:', 'vbscript:', 'onload=', 'onerror=']
    
    for char in dangerous_chars:
        text = text.replace(char, '')
    
    return text.strip()


def validate_json_structure(data: Dict[str, Any], required_structure: Dict[str, type]) -> Optional[str]:
    """
    验证JSON数据结构
    
    Args:
        data: 要验证的数据
        required_structure: 期望的数据结构
    
    Returns:
        Optional[str]: 验证错误信息，如果验证通过则返回None
    """
    for key, expected_type in required_structure.items():
        if key not in data:
            return f"缺少字段: {key}"
        
        if not isinstance(data[key], expected_type):
            return f"字段 {key} 类型错误，期望 {expected_type.__name__}"
    
    return None