"""
API响应工具函数
"""
from flask import jsonify
from typing import Any, Dict, Optional


def success_response(data: Any = None, message: str = "操作成功", code: int = 200) -> Dict:
    """
    成功响应格式
    
    Args:
        data: 响应数据
        message: 响应消息
        code: 状态码
    
    Returns:
        Dict: 格式化的响应数据
    """
    response = {
        "success": True,
        "code": code,
        "message": message
    }
    
    if data is not None:
        response["data"] = data
    
    return jsonify(response)


def error_response(message: str = "操作失败", code: int = 400, details: Optional[str] = None) -> Dict:
    """
    错误响应格式
    
    Args:
        message: 错误消息
        code: 状态码
        details: 详细错误信息
    
    Returns:
        Dict: 格式化的错误响应
    """
    response = {
        "success": False,
        "code": code,
        "message": message
    }
    
    if details:
        response["details"] = details
    
    return jsonify(response)


def paginated_response(items: list, pagination: Dict, message: str = "获取成功") -> Dict:
    """
    分页响应格式
    
    Args:
        items: 数据列表
        pagination: 分页信息
        message: 响应消息
    
    Returns:
        Dict: 格式化的分页响应
    """
    return success_response(
        data={
            "items": items,
            "pagination": pagination
        },
        message=message
    )