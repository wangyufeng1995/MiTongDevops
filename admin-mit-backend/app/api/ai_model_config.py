"""
AI模型配置 API
"""
from flask import Blueprint, request, jsonify, g
from app.extensions import db
from app.models.ai_model_config import AIModelConfig
from app.core.middleware import tenant_required
from app.utils.response import success_response, error_response
from sqlalchemy import and_

bp = Blueprint('ai_model_config', __name__, url_prefix='/api/ai-model-config')

@bp.route('', methods=['GET'])
@tenant_required
def get_configs():
    """
    获取AI模型配置列表
    """
    try:
        tenant_id = g.tenant_id
        
        # 查询参数
        is_active = request.args.get('is_active', type=lambda v: v.lower() == 'true')
        
        # 构建查询
        query = AIModelConfig.query.filter_by(tenant_id=tenant_id)
        
        if is_active is not None:
            query = query.filter_by(is_active=is_active)
        
        # 排序：默认配置优先，然后按创建时间倒序
        configs = query.order_by(
            AIModelConfig.is_default.desc(),
            AIModelConfig.created_at.desc()
        ).all()
        
        return success_response(
            data=[config.to_dict() for config in configs],
            message='获取配置列表成功'
        )
    
    except Exception as e:
        return error_response(message=f'获取配置列表失败: {str(e)}')

@bp.route('/<int:config_id>', methods=['GET'])
@tenant_required
def get_config(config_id):
    """
    获取单个AI模型配置（包含API密钥）
    """
    try:
        tenant_id = g.tenant_id
        
        config = AIModelConfig.query.filter_by(
            id=config_id,
            tenant_id=tenant_id
        ).first()
        
        if not config:
            return error_response(message='配置不存在', code=404)
        
        return success_response(
            data=config.to_dict(include_api_key=True),
            message='获取配置成功'
        )
    
    except Exception as e:
        return error_response(message=f'获取配置失败: {str(e)}')

@bp.route('', methods=['POST'])
@tenant_required
def create_config():
    """
    创建AI模型配置
    """
    try:
        tenant_id = g.tenant_id
        user_id = g.user_id
        
        data = request.get_json()
        
        # 验证必填字段
        required_fields = ['name', 'api_key', 'model_name']
        for field in required_fields:
            if not data.get(field):
                return error_response(message=f'缺少必填字段: {field}')
        
        # 如果设置为默认配置，取消其他默认配置
        if data.get('is_default'):
            AIModelConfig.query.filter_by(
                tenant_id=tenant_id,
                is_default=True
            ).update({'is_default': False})
        
        # 创建配置
        config = AIModelConfig(
            tenant_id=tenant_id,
            name=data['name'],
            description=data.get('description'),
            api_key=data['api_key'],
            api_endpoint=data.get('api_endpoint'),
            timeout=data.get('timeout', 30),
            model_name=data['model_name'],
            temperature=data.get('temperature', 0.7),
            max_tokens=data.get('max_tokens', 2000),
            top_p=data.get('top_p', 1.0),
            frequency_penalty=data.get('frequency_penalty', 0.0),
            presence_penalty=data.get('presence_penalty', 0.0),
            system_prompt=data.get('system_prompt'),
            is_active=data.get('is_active', True),
            is_default=data.get('is_default', False),
            created_by=user_id
        )
        
        db.session.add(config)
        db.session.commit()
        
        return success_response(
            data=config.to_dict(),
            message='创建配置成功'
        )
    
    except Exception as e:
        db.session.rollback()
        return error_response(message=f'创建配置失败: {str(e)}')

@bp.route('/<int:config_id>', methods=['PUT'])
@tenant_required
def update_config(config_id):
    """
    更新AI模型配置
    """
    try:
        tenant_id = g.tenant_id
        user_id = g.user_id
        
        config = AIModelConfig.query.filter_by(
            id=config_id,
            tenant_id=tenant_id
        ).first()
        
        if not config:
            return error_response(message='配置不存在', code=404)
        
        data = request.get_json()
        
        # 如果设置为默认配置，取消其他默认配置
        if data.get('is_default') and not config.is_default:
            AIModelConfig.query.filter(
                and_(
                    AIModelConfig.tenant_id == tenant_id,
                    AIModelConfig.is_default == True,
                    AIModelConfig.id != config_id
                )
            ).update({'is_default': False})
        
        # 更新字段
        if 'name' in data:
            config.name = data['name']
        if 'description' in data:
            config.description = data['description']
        if 'api_key' in data:
            config.api_key = data['api_key']
        if 'api_endpoint' in data:
            config.api_endpoint = data['api_endpoint']
        if 'timeout' in data:
            config.timeout = data['timeout']
        if 'model_name' in data:
            config.model_name = data['model_name']
        if 'temperature' in data:
            config.temperature = data['temperature']
        if 'max_tokens' in data:
            config.max_tokens = data['max_tokens']
        if 'top_p' in data:
            config.top_p = data['top_p']
        if 'frequency_penalty' in data:
            config.frequency_penalty = data['frequency_penalty']
        if 'presence_penalty' in data:
            config.presence_penalty = data['presence_penalty']
        if 'system_prompt' in data:
            config.system_prompt = data['system_prompt']
        if 'is_active' in data:
            config.is_active = data['is_active']
        if 'is_default' in data:
            config.is_default = data['is_default']
        
        config.updated_by = user_id
        
        db.session.commit()
        
        return success_response(
            data=config.to_dict(),
            message='更新配置成功'
        )
    
    except Exception as e:
        db.session.rollback()
        return error_response(message=f'更新配置失败: {str(e)}')

@bp.route('/<int:config_id>', methods=['DELETE'])
@tenant_required
def delete_config(config_id):
    """
    删除AI模型配置
    """
    try:
        tenant_id = g.tenant_id
        
        config = AIModelConfig.query.filter_by(
            id=config_id,
            tenant_id=tenant_id
        ).first()
        
        if not config:
            return error_response(message='配置不存在', code=404)
        
        # 不允许删除默认配置
        if config.is_default:
            return error_response(message='不能删除默认配置，请先设置其他配置为默认')
        
        db.session.delete(config)
        db.session.commit()
        
        return success_response(message='删除配置成功')
    
    except Exception as e:
        db.session.rollback()
        return error_response(message=f'删除配置失败: {str(e)}')

@bp.route('/<int:config_id>/delete', methods=['POST'])
@tenant_required
def delete_config_post(config_id):
    """
    删除AI模型配置 (POST方法)
    """
    try:
        tenant_id = g.tenant_id
        
        config = AIModelConfig.query.filter_by(
            id=config_id,
            tenant_id=tenant_id
        ).first()
        
        if not config:
            return error_response(message='配置不存在', code=404)
        
        # 不允许删除默认配置
        if config.is_default:
            return error_response(message='不能删除默认配置，请先设置其他配置为默认')
        
        db.session.delete(config)
        db.session.commit()
        
        return success_response(message='删除配置成功')
    
    except Exception as e:
        db.session.rollback()
        return error_response(message=f'删除配置失败: {str(e)}')

@bp.route('/<int:config_id>/set-default', methods=['POST'])
@tenant_required
def set_default(config_id):
    """
    设置为默认配置
    """
    try:
        tenant_id = g.tenant_id
        user_id = g.user_id
        
        config = AIModelConfig.query.filter_by(
            id=config_id,
            tenant_id=tenant_id
        ).first()
        
        if not config:
            return error_response(message='配置不存在', code=404)
        
        # 取消其他默认配置
        AIModelConfig.query.filter(
            and_(
                AIModelConfig.tenant_id == tenant_id,
                AIModelConfig.is_default == True,
                AIModelConfig.id != config_id
            )
        ).update({'is_default': False})
        
        # 设置为默认
        config.is_default = True
        config.updated_by = user_id
        
        db.session.commit()
        
        return success_response(
            data=config.to_dict(),
            message='设置默认配置成功'
        )
    
    except Exception as e:
        db.session.rollback()
        return error_response(message=f'设置默认配置失败: {str(e)}')

@bp.route('/default', methods=['GET'])
@tenant_required
def get_default_config():
    """
    获取默认配置
    """
    try:
        tenant_id = g.tenant_id
        
        config = AIModelConfig.query.filter_by(
            tenant_id=tenant_id,
            is_default=True,
            is_active=True
        ).first()
        
        if not config:
            return error_response(message='未设置默认配置', code=404)
        
        return success_response(
            data=config.to_dict(),
            message='获取默认配置成功'
        )
    
    except Exception as e:
        return error_response(message=f'获取默认配置失败: {str(e)}')
