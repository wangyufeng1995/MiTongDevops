"""
AI助手 API
"""
from flask import Blueprint, request, g
from app.core.middleware import tenant_required
from app.utils.response import success_response, error_response
from app.models.ai_model_config import AIModelConfig
import requests
import json
import logging

logger = logging.getLogger(__name__)

bp = Blueprint('ai_assistant', __name__, url_prefix='/api/ai-assistant')

@bp.route('/test', methods=['GET'])
def test():
    """
    测试端点 - 验证 API 是否正常工作
    """
    return success_response(
        data={'status': 'ok', 'message': 'AI Assistant API 正常工作'},
        message='测试成功'
    )

@bp.route('/chat', methods=['POST'])
@tenant_required
def chat():
    """
    AI对话接口
    """
    try:
        tenant_id = g.tenant_id
        data = request.get_json()
        
        message = data.get('message')
        model_config_id = data.get('model_config_id')
        conversation_history = data.get('conversation_history', [])
        
        if not message:
            return error_response(message='消息内容不能为空')
        
        if not model_config_id:
            return error_response(message='请选择AI模型')
        
        # 获取模型配置
        config = AIModelConfig.query.filter_by(
            id=model_config_id,
            tenant_id=tenant_id,
            is_active=True
        ).first()
        
        if not config:
            return error_response(message='模型配置不存在或已禁用', code=404)
        
        # 构建消息历史
        messages = []
        
        # 添加系统提示词
        if config.system_prompt:
            messages.append({
                'role': 'system',
                'content': config.system_prompt
            })
        
        # 添加对话历史（最多保留最近10轮对话）
        if conversation_history:
            recent_history = conversation_history[-20:]  # 最多10轮对话（每轮2条消息）
            for msg in recent_history:
                if msg.get('role') in ['user', 'assistant']:
                    messages.append({
                        'role': msg['role'],
                        'content': msg['content']
                    })
        
        # 添加当前消息
        messages.append({
            'role': 'user',
            'content': message
        })
        
        # 调用AI API
        try:
            response = call_ai_api(config, messages)
            
            return success_response(
                data={
                    'response': response['content'],
                    'model': config.model_name,
                    'tokens_used': response.get('tokens_used')
                },
                message='对话成功'
            )
        except Exception as api_error:
            logger.error(f"AI API调用失败: {str(api_error)}")
            return error_response(message=f'AI服务调用失败: {str(api_error)}')
    
    except Exception as e:
        logger.error(f"对话处理失败: {str(e)}", exc_info=True)
        return error_response(message=f'对话处理失败: {str(e)}')


def call_ai_api(config: AIModelConfig, messages: list) -> dict:
    """
    调用AI API
    
    Args:
        config: AI模型配置
        messages: 消息列表
    
    Returns:
        dict: AI响应
    """
    # 准备API请求
    api_endpoint = config.api_endpoint or 'https://api.openai.com/v1/chat/completions'
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {config.api_key}'
    }
    
    payload = {
        'model': config.model_name,
        'messages': messages,
        'temperature': config.temperature or 0.7,
        'max_tokens': config.max_tokens or 2000,
        'top_p': config.top_p or 1.0,
        'frequency_penalty': config.frequency_penalty or 0.0,
        'presence_penalty': config.presence_penalty or 0.0
    }
    
    # 发送请求
    timeout = config.timeout or 30
    response = requests.post(
        api_endpoint,
        headers=headers,
        json=payload,
        timeout=timeout
    )
    
    # 检查响应
    if response.status_code != 200:
        error_msg = f"API返回错误: {response.status_code}"
        try:
            error_data = response.json()
            error_msg = error_data.get('error', {}).get('message', error_msg)
        except:
            pass
        raise Exception(error_msg)
    
    # 解析响应
    result = response.json()
    
    # 提取回复内容
    if 'choices' in result and len(result['choices']) > 0:
        content = result['choices'][0]['message']['content']
        tokens_used = result.get('usage', {}).get('total_tokens')
        
        return {
            'content': content,
            'tokens_used': tokens_used
        }
    else:
        raise Exception('AI响应格式错误')


@bp.route('/history', methods=['GET'])
@tenant_required
def get_history():
    """
    获取对话历史（暂未实现持久化）
    """
    return success_response(
        data=[],
        message='对话历史功能暂未实现'
    )


@bp.route('/history', methods=['DELETE'])
@tenant_required
def clear_history():
    """
    清除对话历史（暂未实现持久化）
    """
    return success_response(message='对话历史已清除')
