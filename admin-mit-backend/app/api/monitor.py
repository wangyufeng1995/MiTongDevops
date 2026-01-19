"""
监控告警管理 API
"""
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import desc, func, or_
from datetime import datetime, timedelta
import logging

from app.extensions import db
from app.models.monitor import AlertChannel, AlertRule, AlertRecord, AlertNotification
from app.models.user import User
from app.services.email_notification_service import email_notification_service
from app.services.dingtalk_notification_service import dingtalk_notification_service
from app.core.middleware import tenant_required


logger = logging.getLogger(__name__)
monitor_bp = Blueprint('monitor', __name__)


# ==================== Helper Functions ====================

def get_current_tenant_id():
    """获取当前租户ID"""
    return getattr(g, 'tenant_id', None)


def validate_channel_config(channel_type: str, config: dict):
    """验证告警渠道配置"""
    try:
        if channel_type == 'email':
            # 验证邮箱配置
            from app.services.email_notification_service import SMTPConfigManager
            return SMTPConfigManager.validate_smtp_config(config)
        elif channel_type == 'dingtalk':
            # 验证钉钉配置
            from app.services.dingtalk_notification_service import DingTalkWebhookManager
            return DingTalkWebhookManager.validate_webhook_config(config)
        else:
            return False, f"不支持的渠道类型: {channel_type}"
    except Exception as e:
        logger.error(f"验证渠道配置失败: {str(e)}", exc_info=True)
        return False, f"配置验证失败: {str(e)}"


def test_channel_connection(channel: AlertChannel):
    """测试告警渠道连接"""
    try:
        if channel.type == 'email':
            return email_notification_service.send_test_notification(channel)
        elif channel.type == 'dingtalk':
            return dingtalk_notification_service.send_test_notification(channel)
        else:
            return False, f"不支持的渠道类型: {channel.type}"
    except Exception as e:
        logger.error(f"测试渠道连接失败: {str(e)}", exc_info=True)
        return False, f"连接测试失败: {str(e)}"


def validate_channel_data(data, required_fields=None):
    """验证渠道数据"""
    if not isinstance(data, dict):
        return False, "数据格式错误"
    
    if required_fields:
        for field in required_fields:
            if field not in data:
                return False, f"缺少必需字段: {field}"
    
    # 验证名称
    if 'name' in data:
        name = data['name']
        if not isinstance(name, str) or not name.strip():
            return False, "渠道名称不能为空"
        if len(name) > 100:
            return False, "渠道名称长度不能超过100个字符"
    
    # 验证类型
    if 'type' in data:
        if data['type'] not in ['email', 'dingtalk']:
            return False, "不支持的渠道类型"
    
    # 验证状态
    if 'status' in data:
        if data['status'] not in [0, 1]:
            return False, "状态值必须为0或1"
    
    # 验证描述
    if 'description' in data and data['description']:
        if len(data['description']) > 500:
            return False, "描述长度不能超过500个字符"
    
    return True, "验证通过"


# ==================== Alert Channel APIs ====================

@monitor_bp.route('/channels', methods=['GET'])
@tenant_required
def get_alert_channels():
    """获取告警渠道列表"""
    try:
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        channel_type = request.args.get('type', '')
        status = request.args.get('status', type=int)
        search = request.args.get('search', '')
        
        # 参数验证
        if page < 1:
            page = 1
        if per_page < 1 or per_page > 100:
            per_page = 10
        
        tenant_id = get_current_tenant_id()
        
        # 构建查询
        query = AlertChannel.query.filter_by(tenant_id=tenant_id)
        
        # 应用筛选条件
        if channel_type and channel_type in ['email', 'dingtalk']:
            query = query.filter(AlertChannel.type == channel_type)
        
        if status is not None and status in [0, 1]:
            query = query.filter(AlertChannel.status == status)
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    AlertChannel.name.ilike(search_term),
                    AlertChannel.description.ilike(search_term)
                )
            )
        
        # 排序
        query = query.order_by(desc(AlertChannel.created_at))
        
        # 分页
        pagination = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        # 格式化返回数据
        channels = []
        for channel in pagination.items:
            channel_data = channel.to_dict()
            # 隐藏敏感配置信息
            if 'config' in channel_data:
                config = channel_data['config'].copy()
                if channel.type == 'email' and 'password' in config:
                    config['password'] = '******'
                elif channel.type == 'dingtalk' and 'secret' in config:
                    config['secret'] = '******'
                channel_data['config'] = config
            channels.append(channel_data)
        
        return jsonify({
            'success': True,
            'data': {
                'channels': channels,
                'pagination': {
                    'page': pagination.page,
                    'per_page': pagination.per_page,
                    'total': pagination.total,
                    'pages': pagination.pages,
                    'has_prev': pagination.has_prev,
                    'has_next': pagination.has_next
                }
            }
        })
        
    except Exception as e:
        logger.error(f"获取告警渠道列表失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'获取告警渠道列表失败: {str(e)}'
        }), 500


@monitor_bp.route('/channels', methods=['POST'])
@tenant_required
def create_alert_channel():
    """创建告警渠道"""
    try:
        # 获取请求数据
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        # 验证必需字段
        required_fields = ['name', 'type', 'config']
        is_valid, error_msg = validate_channel_data(data, required_fields)
        if not is_valid:
            return jsonify({
                'success': False,
                'message': f'参数验证失败: {error_msg}'
            }), 400
        
        tenant_id = get_current_tenant_id()
        current_user_id = get_jwt_identity()
        
        # 检查渠道名称是否重复
        existing_channel = AlertChannel.query.filter_by(
            tenant_id=tenant_id,
            name=data['name']
        ).first()
        
        if existing_channel:
            return jsonify({
                'success': False,
                'message': '告警渠道名称已存在'
            }), 400
        
        # 验证渠道配置
        is_valid, error_msg = validate_channel_config(data['type'], data['config'])
        if not is_valid:
            return jsonify({
                'success': False,
                'message': f'渠道配置验证失败: {error_msg}'
            }), 400
        
        # 创建告警渠道
        channel = AlertChannel(
            tenant_id=tenant_id,
            name=data['name'],
            type=data['type'],
            config=data['config'],
            description=data.get('description'),
            status=data.get('status', 1),
            created_by=current_user_id
        )
        
        db.session.add(channel)
        db.session.commit()
        
        # 记录操作日志
        from app.services.operation_log_service import operation_log_service
        operation_log_service.log_operation(
            action='create',
            resource='alert_channel',
            resource_id=channel.id,
            details={'name': channel.name, 'type': channel.type}
        )
        
        logger.info(f"用户 {current_user_id} 创建告警渠道: {channel.name}")
        
        return jsonify({
            'success': True,
            'message': '告警渠道创建成功',
            'data': channel.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"创建告警渠道失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'创建告警渠道失败: {str(e)}'
        }), 500


@monitor_bp.route('/channels/<int:channel_id>', methods=['PUT'])
@tenant_required
def update_alert_channel(channel_id):
    """更新告警渠道"""
    try:
        # 获取请求数据
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        # 验证数据
        is_valid, error_msg = validate_channel_data(data)
        if not is_valid:
            return jsonify({
                'success': False,
                'message': f'参数验证失败: {error_msg}'
            }), 400
        
        tenant_id = get_current_tenant_id()
        current_user_id = get_jwt_identity()
        
        # 查找告警渠道
        channel = AlertChannel.query.filter_by(
            id=channel_id,
            tenant_id=tenant_id
        ).first()
        
        if not channel:
            return jsonify({
                'success': False,
                'message': '告警渠道不存在'
            }), 404
        
        # 检查名称是否重复（排除当前渠道）
        if 'name' in data:
            existing_channel = AlertChannel.query.filter(
                AlertChannel.tenant_id == tenant_id,
                AlertChannel.name == data['name'],
                AlertChannel.id != channel_id
            ).first()
            
            if existing_channel:
                return jsonify({
                    'success': False,
                    'message': '告警渠道名称已存在'
                }), 400
        
        # 验证渠道配置（如果有更新）
        if 'config' in data:
            channel_type = data.get('type', channel.type)
            is_valid, error_msg = validate_channel_config(channel_type, data['config'])
            if not is_valid:
                return jsonify({
                    'success': False,
                    'message': f'渠道配置验证失败: {error_msg}'
                }), 400
        
        # 记录更新前的数据
        old_data = {
            'name': channel.name,
            'type': channel.type,
            'status': channel.status
        }
        
        # 更新告警渠道
        for key, value in data.items():
            setattr(channel, key, value)
        
        channel.updated_at = datetime.utcnow()
        db.session.commit()
        
        # 记录操作日志
        from app.services.operation_log_service import operation_log_service
        operation_log_service.log_operation(
            action='update',
            resource='alert_channel',
            resource_id=channel.id,
            details={
                'old_data': old_data,
                'new_data': {k: v for k, v in data.items() if k != 'config'}
            }
        )
        
        logger.info(f"用户 {current_user_id} 更新告警渠道: {channel.name}")
        
        return jsonify({
            'success': True,
            'message': '告警渠道更新成功',
            'data': channel.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"更新告警渠道失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'更新告警渠道失败: {str(e)}'
        }), 500


@monitor_bp.route('/channels/<int:channel_id>/delete', methods=['POST'])
@tenant_required
def delete_alert_channel(channel_id):
    """删除告警渠道"""
    try:
        tenant_id = get_current_tenant_id()
        current_user_id = get_jwt_identity()
        
        # 查找告警渠道
        channel = AlertChannel.query.filter_by(
            id=channel_id,
            tenant_id=tenant_id
        ).first()
        
        if not channel:
            return jsonify({
                'success': False,
                'message': '告警渠道不存在'
            }), 404
        
        # 检查是否有告警规则在使用此渠道
        # 使用 PostgreSQL 的 JSON 包含操作符 @> 来查询，需要显式类型转换
        from sqlalchemy import cast, text
        from sqlalchemy.dialects.postgresql import JSONB
        rules_using_channel = AlertRule.query.filter(
            AlertRule.tenant_id == tenant_id,
            cast(AlertRule.channel_ids, JSONB).op('@>')(cast(f'[{channel_id}]', JSONB))
        ).count()
        
        if rules_using_channel > 0:
            return jsonify({
                'success': False,
                'message': f'无法删除告警渠道，有 {rules_using_channel} 个告警规则正在使用此渠道'
            }), 400
        
        # 记录删除的数据
        deleted_data = {
            'name': channel.name,
            'type': channel.type
        }
        
        # 删除告警渠道
        db.session.delete(channel)
        db.session.commit()
        
        # 记录操作日志
        from app.services.operation_log_service import operation_log_service
        operation_log_service.log_operation(
            action='delete',
            resource='alert_channel',
            resource_id=channel_id,
            details=deleted_data
        )
        
        logger.info(f"用户 {current_user_id} 删除告警渠道: {deleted_data['name']}")
        
        return jsonify({
            'success': True,
            'message': '告警渠道删除成功'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"删除告警渠道失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'删除告警渠道失败: {str(e)}'
        }), 500


@monitor_bp.route('/channels/<int:channel_id>/test', methods=['POST'])
@tenant_required
def test_alert_channel(channel_id):
    """测试告警渠道"""
    try:
        tenant_id = get_current_tenant_id()
        current_user_id = get_jwt_identity()
        
        # 查找告警渠道
        channel = AlertChannel.query.filter_by(
            id=channel_id,
            tenant_id=tenant_id
        ).first()
        
        if not channel:
            return jsonify({
                'success': False,
                'message': '告警渠道不存在'
            }), 404
        
        # 检查渠道是否启用
        if not channel.is_enabled():
            return jsonify({
                'success': False,
                'message': '告警渠道已禁用，无法测试'
            }), 400
        
        # 测试渠道连接
        success, message = test_channel_connection(channel)
        
        # 记录操作日志
        from app.services.operation_log_service import operation_log_service
        operation_log_service.log_operation(
            action='test',
            resource='alert_channel',
            resource_id=channel.id,
            details={
                'name': channel.name,
                'type': channel.type,
                'test_result': 'success' if success else 'failed',
                'test_message': message
            }
        )
        
        if success:
            logger.info(f"用户 {current_user_id} 测试告警渠道成功: {channel.name}")
            return jsonify({
                'success': True,
                'message': message
            })
        else:
            logger.warning(f"用户 {current_user_id} 测试告警渠道失败: {channel.name} - {message}")
            return jsonify({
                'success': False,
                'message': message
            }), 400
        
    except Exception as e:
        logger.error(f"测试告警渠道失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'测试告警渠道失败: {str(e)}'
        }), 500


@monitor_bp.route('/channels/<int:channel_id>', methods=['GET'])
@tenant_required
def get_alert_channel(channel_id):
    """获取单个告警渠道详情"""
    try:
        tenant_id = get_current_tenant_id()
        
        # 查找告警渠道
        channel = AlertChannel.query.filter_by(
            id=channel_id,
            tenant_id=tenant_id
        ).first()
        
        if not channel:
            return jsonify({
                'success': False,
                'message': '告警渠道不存在'
            }), 404
        
        # 获取渠道详情（编辑时需要返回完整配置，不隐藏敏感信息）
        channel_data = channel.to_dict()
        
        # 获取使用此渠道的告警规则数量
        # 使用 PostgreSQL 的 JSON 包含操作符 @> 来查询，需要显式类型转换
        from sqlalchemy import cast
        from sqlalchemy.dialects.postgresql import JSONB
        rules_count = AlertRule.query.filter(
            AlertRule.tenant_id == tenant_id,
            cast(AlertRule.channel_ids, JSONB).op('@>')(cast(f'[{channel_id}]', JSONB))
        ).count()
        
        channel_data['rules_count'] = rules_count
        
        # 获取最近的通知统计
        if channel.type == 'email':
            stats = email_notification_service.get_notification_statistics(tenant_id, days=7)
        elif channel.type == 'dingtalk':
            stats = dingtalk_notification_service.get_notification_statistics(tenant_id, days=7)
        else:
            stats = {'total': 0, 'sent': 0, 'failed': 0, 'success_rate': 0.0}
        
        channel_data['notification_stats'] = stats
        
        return jsonify({
            'success': True,
            'data': channel_data
        })
        
    except Exception as e:
        logger.error(f"获取告警渠道详情失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'获取告警渠道详情失败: {str(e)}'
        }), 500


# ==================== Alert Rule APIs ====================

def validate_rule_data(data, required_fields=None):
    """验证告警规则数据"""
    if not isinstance(data, dict):
        return False, "数据格式错误"
    
    if required_fields:
        for field in required_fields:
            if field not in data:
                return False, f"缺少必需字段: {field}"
    
    # 验证名称
    if 'name' in data:
        name = data['name']
        if not isinstance(name, str) or not name.strip():
            return False, "规则名称不能为空"
        if len(name) > 100:
            return False, "规则名称长度不能超过100个字符"
    
    # 验证指标类型
    if 'metric_type' in data:
        valid_metrics = ['cpu', 'memory', 'disk', 'load']
        if data['metric_type'] not in valid_metrics:
            return False, f"不支持的指标类型，支持的类型: {', '.join(valid_metrics)}"
    
    # 验证操作符
    if 'condition_operator' in data:
        valid_operators = ['>', '<', '>=', '<=', '==']
        if data['condition_operator'] not in valid_operators:
            return False, f"不支持的操作符，支持的操作符: {', '.join(valid_operators)}"
    
    # 验证阈值
    if 'threshold_value' in data:
        try:
            threshold = float(data['threshold_value'])
            if threshold < 0:
                return False, "阈值必须为非负数"
            
            # 验证百分比类型的指标
            metric_type = data.get('metric_type')
            if metric_type in ['cpu', 'memory', 'disk'] and threshold > 100:
                return False, f"{metric_type}使用率阈值不能超过100%"
        except (ValueError, TypeError):
            return False, "阈值必须为有效数字"
    
    # 验证严重级别
    if 'severity' in data:
        valid_severities = ['info', 'warning', 'critical']
        if data['severity'] not in valid_severities:
            return False, f"不支持的严重级别，支持的级别: {', '.join(valid_severities)}"
    
    # 验证持续时间
    if 'duration' in data and data['duration'] is not None:
        try:
            duration = int(data['duration'])
            if duration < 0:
                return False, "持续时间不能为负数"
        except (ValueError, TypeError):
            return False, "持续时间必须为有效整数"
    
    # 验证静默期
    if 'silence_period' in data and data['silence_period'] is not None:
        try:
            silence_period = int(data['silence_period'])
            if silence_period < 0:
                return False, "静默期不能为负数"
        except (ValueError, TypeError):
            return False, "静默期必须为有效整数"
    
    # 验证告警渠道
    if 'channel_ids' in data:
        channel_ids = data['channel_ids']
        if not isinstance(channel_ids, list) or len(channel_ids) == 0:
            return False, "至少需要配置一个告警渠道"
        
        # 验证渠道ID是否为整数
        for channel_id in channel_ids:
            if not isinstance(channel_id, int) or channel_id <= 0:
                return False, "告警渠道ID必须为正整数"
    
    # 验证主机ID列表
    if 'host_ids' in data and data['host_ids'] is not None:
        host_ids = data['host_ids']
        if not isinstance(host_ids, list):
            return False, "主机ID列表必须为数组格式"
        
        # 验证主机ID是否为整数
        for host_id in host_ids:
            if not isinstance(host_id, int) or host_id <= 0:
                return False, "主机ID必须为正整数"
    
    # 验证描述
    if 'description' in data and data['description']:
        if len(data['description']) > 500:
            return False, "描述长度不能超过500个字符"
    
    return True, "验证通过"


@monitor_bp.route('/rules', methods=['GET'])
@tenant_required
def get_alert_rules():
    """获取告警规则列表"""
    try:
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        metric_type = request.args.get('metric_type', '')
        severity = request.args.get('severity', '')
        enabled = request.args.get('enabled', type=int)
        search = request.args.get('search', '')
        
        # 参数验证
        if page < 1:
            page = 1
        if per_page < 1 or per_page > 100:
            per_page = 10
        
        tenant_id = get_current_tenant_id()
        
        # 构建查询
        query = AlertRule.query.filter_by(tenant_id=tenant_id)
        
        # 应用筛选条件
        if metric_type and metric_type in ['cpu', 'memory', 'disk', 'load']:
            query = query.filter(AlertRule.metric_type == metric_type)
        
        if severity and severity in ['info', 'warning', 'critical']:
            query = query.filter(AlertRule.severity == severity)
        
        if enabled is not None and enabled in [0, 1]:
            query = query.filter(AlertRule.enabled == bool(enabled))
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    AlertRule.name.ilike(search_term),
                    AlertRule.description.ilike(search_term)
                )
            )
        
        # 排序
        query = query.order_by(desc(AlertRule.created_at))
        
        # 分页
        pagination = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        # 格式化返回数据
        rules = []
        for rule in pagination.items:
            rule_data = rule.to_dict()
            
            # 获取关联的告警渠道信息
            if rule.channel_ids:
                channels = AlertChannel.query.filter(
                    AlertChannel.id.in_(rule.channel_ids),
                    AlertChannel.tenant_id == tenant_id
                ).all()
                rule_data['channels'] = [{'id': c.id, 'name': c.name, 'type': c.type} for c in channels]
            else:
                rule_data['channels'] = []
            
            # 获取关联的主机信息
            if rule.host_ids:
                from app.models.host import SSHHost
                hosts = SSHHost.query.filter(
                    SSHHost.id.in_(rule.host_ids),
                    SSHHost.tenant_id == tenant_id
                ).all()
                rule_data['hosts'] = [{'id': h.id, 'name': h.name, 'hostname': h.hostname} for h in hosts]
            else:
                rule_data['hosts'] = []
                rule_data['applies_to_all_hosts'] = True
            
            # 获取最近的告警统计
            recent_alerts = AlertRecord.query.filter(
                AlertRecord.rule_id == rule.id,
                AlertRecord.created_at >= datetime.utcnow() - timedelta(days=7)
            ).count()
            rule_data['recent_alerts_count'] = recent_alerts
            
            rules.append(rule_data)
        
        return jsonify({
            'success': True,
            'data': {
                'rules': rules,
                'pagination': {
                    'page': pagination.page,
                    'per_page': pagination.per_page,
                    'total': pagination.total,
                    'pages': pagination.pages,
                    'has_prev': pagination.has_prev,
                    'has_next': pagination.has_next
                }
            }
        })
        
    except Exception as e:
        logger.error(f"获取告警规则列表失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'获取告警规则列表失败: {str(e)}'
        }), 500


@monitor_bp.route('/rules', methods=['POST'])
@tenant_required
def create_alert_rule():
    """创建告警规则"""
    try:
        # 获取请求数据
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        # 验证必需字段
        required_fields = ['name', 'metric_type', 'condition_operator', 'threshold_value', 'channel_ids']
        is_valid, error_msg = validate_rule_data(data, required_fields)
        if not is_valid:
            return jsonify({
                'success': False,
                'message': f'参数验证失败: {error_msg}'
            }), 400
        
        tenant_id = get_current_tenant_id()
        current_user_id = get_jwt_identity()
        
        # 检查规则名称是否重复
        existing_rule = AlertRule.query.filter_by(
            tenant_id=tenant_id,
            name=data['name']
        ).first()
        
        if existing_rule:
            return jsonify({
                'success': False,
                'message': '告警规则名称已存在'
            }), 400
        
        # 验证告警渠道是否存在且属于当前租户
        channel_ids = data['channel_ids']
        channels = AlertChannel.query.filter(
            AlertChannel.id.in_(channel_ids),
            AlertChannel.tenant_id == tenant_id,
            AlertChannel.status == 1  # 只能使用启用的渠道
        ).all()
        
        if len(channels) != len(channel_ids):
            return jsonify({
                'success': False,
                'message': '部分告警渠道不存在或已禁用'
            }), 400
        
        # 验证主机ID是否存在且属于当前租户（如果指定了主机）
        host_ids = data.get('host_ids')
        if host_ids:
            from app.models.host import SSHHost
            hosts = SSHHost.query.filter(
                SSHHost.id.in_(host_ids),
                SSHHost.tenant_id == tenant_id
            ).all()
            
            if len(hosts) != len(host_ids):
                return jsonify({
                    'success': False,
                    'message': '部分主机不存在'
                }), 400
        
        # 创建告警规则
        rule = AlertRule(
            tenant_id=tenant_id,
            name=data['name'],
            description=data.get('description'),
            metric_type=data['metric_type'],
            condition_operator=data['condition_operator'],
            threshold_value=data['threshold_value'],
            duration=data.get('duration', 300),
            severity=data.get('severity', 'warning'),
            host_ids=host_ids,
            channel_ids=channel_ids,
            silence_period=data.get('silence_period', 3600),
            enabled=data.get('enabled', True),
            created_by=current_user_id
        )
        
        # 验证规则
        is_valid, error_msg = rule.validate_rule()
        if not is_valid:
            return jsonify({
                'success': False,
                'message': f'规则验证失败: {error_msg}'
            }), 400
        
        db.session.add(rule)
        db.session.commit()
        
        # 记录操作日志
        from app.services.operation_log_service import operation_log_service
        operation_log_service.log_operation(
            action='create',
            resource='alert_rule',
            resource_id=rule.id,
            details={
                'name': rule.name,
                'metric_type': rule.metric_type,
                'threshold_value': float(rule.threshold_value),
                'severity': rule.severity
            }
        )
        
        logger.info(f"用户 {current_user_id} 创建告警规则: {rule.name}")
        
        return jsonify({
            'success': True,
            'message': '告警规则创建成功',
            'data': rule.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"创建告警规则失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'创建告警规则失败: {str(e)}'
        }), 500


@monitor_bp.route('/rules/<int:rule_id>', methods=['PUT'])
@tenant_required
def update_alert_rule(rule_id):
    """更新告警规则"""
    try:
        # 获取请求数据
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        # 验证数据
        is_valid, error_msg = validate_rule_data(data)
        if not is_valid:
            return jsonify({
                'success': False,
                'message': f'参数验证失败: {error_msg}'
            }), 400
        
        tenant_id = get_current_tenant_id()
        current_user_id = get_jwt_identity()
        
        # 查找告警规则
        rule = AlertRule.query.filter_by(
            id=rule_id,
            tenant_id=tenant_id
        ).first()
        
        if not rule:
            return jsonify({
                'success': False,
                'message': '告警规则不存在'
            }), 404
        
        # 检查名称是否重复（排除当前规则）
        if 'name' in data:
            existing_rule = AlertRule.query.filter(
                AlertRule.tenant_id == tenant_id,
                AlertRule.name == data['name'],
                AlertRule.id != rule_id
            ).first()
            
            if existing_rule:
                return jsonify({
                    'success': False,
                    'message': '告警规则名称已存在'
                }), 400
        
        # 验证告警渠道是否存在且属于当前租户（如果有更新）
        if 'channel_ids' in data:
            channel_ids = data['channel_ids']
            channels = AlertChannel.query.filter(
                AlertChannel.id.in_(channel_ids),
                AlertChannel.tenant_id == tenant_id,
                AlertChannel.status == 1  # 只能使用启用的渠道
            ).all()
            
            if len(channels) != len(channel_ids):
                return jsonify({
                    'success': False,
                    'message': '部分告警渠道不存在或已禁用'
                }), 400
        
        # 验证主机ID是否存在且属于当前租户（如果有更新）
        if 'host_ids' in data and data['host_ids']:
            host_ids = data['host_ids']
            from app.models.host import SSHHost
            hosts = SSHHost.query.filter(
                SSHHost.id.in_(host_ids),
                SSHHost.tenant_id == tenant_id
            ).all()
            
            if len(hosts) != len(host_ids):
                return jsonify({
                    'success': False,
                    'message': '部分主机不存在'
                }), 400
        
        # 记录更新前的数据
        old_data = {
            'name': rule.name,
            'metric_type': rule.metric_type,
            'threshold_value': float(rule.threshold_value),
            'enabled': rule.enabled
        }
        
        # 更新告警规则
        for key, value in data.items():
            setattr(rule, key, value)
        
        rule.updated_at = datetime.utcnow()
        
        # 验证更新后的规则
        is_valid, error_msg = rule.validate_rule()
        if not is_valid:
            db.session.rollback()
            return jsonify({
                'success': False,
                'message': f'规则验证失败: {error_msg}'
            }), 400
        
        db.session.commit()
        
        # 记录操作日志
        from app.services.operation_log_service import operation_log_service
        operation_log_service.log_operation(
            action='update',
            resource='alert_rule',
            resource_id=rule.id,
            details={
                'old_data': old_data,
                'new_data': {k: v for k, v in data.items() if k not in ['channel_ids', 'host_ids']}
            }
        )
        
        logger.info(f"用户 {current_user_id} 更新告警规则: {rule.name}")
        
        return jsonify({
            'success': True,
            'message': '告警规则更新成功',
            'data': rule.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"更新告警规则失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'更新告警规则失败: {str(e)}'
        }), 500


@monitor_bp.route('/rules/<int:rule_id>/delete', methods=['POST'])
@tenant_required
def delete_alert_rule(rule_id):
    """删除告警规则"""
    try:
        tenant_id = get_current_tenant_id()
        current_user_id = get_jwt_identity()
        
        # 查找告警规则
        rule = AlertRule.query.filter_by(
            id=rule_id,
            tenant_id=tenant_id
        ).first()
        
        if not rule:
            return jsonify({
                'success': False,
                'message': '告警规则不存在'
            }), 404
        
        # 检查是否有活跃的告警记录
        active_alerts = AlertRecord.query.filter(
            AlertRecord.rule_id == rule_id,
            AlertRecord.status == 'active'
        ).count()
        
        if active_alerts > 0:
            return jsonify({
                'success': False,
                'message': f'无法删除告警规则，有 {active_alerts} 个活跃告警记录'
            }), 400
        
        # 记录删除的数据
        deleted_data = {
            'name': rule.name,
            'metric_type': rule.metric_type,
            'threshold_value': float(rule.threshold_value)
        }
        
        # 删除告警规则（级联删除相关的告警记录）
        db.session.delete(rule)
        db.session.commit()
        
        # 记录操作日志
        from app.services.operation_log_service import operation_log_service
        operation_log_service.log_operation(
            action='delete',
            resource='alert_rule',
            resource_id=rule_id,
            details=deleted_data
        )
        
        logger.info(f"用户 {current_user_id} 删除告警规则: {deleted_data['name']}")
        
        return jsonify({
            'success': True,
            'message': '告警规则删除成功'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"删除告警规则失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'删除告警规则失败: {str(e)}'
        }), 500


@monitor_bp.route('/rules/<int:rule_id>/enable', methods=['POST'])
@tenant_required
def enable_alert_rule(rule_id):
    """启用告警规则"""
    try:
        tenant_id = get_current_tenant_id()
        current_user_id = get_jwt_identity()
        
        # 查找告警规则
        rule = AlertRule.query.filter_by(
            id=rule_id,
            tenant_id=tenant_id
        ).first()
        
        if not rule:
            return jsonify({
                'success': False,
                'message': '告警规则不存在'
            }), 404
        
        if rule.enabled:
            return jsonify({
                'success': False,
                'message': '告警规则已经是启用状态'
            }), 400
        
        # 验证关联的告警渠道是否都可用
        if rule.channel_ids:
            channels = AlertChannel.query.filter(
                AlertChannel.id.in_(rule.channel_ids),
                AlertChannel.tenant_id == tenant_id
            ).all()
            
            disabled_channels = [c.name for c in channels if not c.is_enabled()]
            if disabled_channels:
                return jsonify({
                    'success': False,
                    'message': f'无法启用规则，以下告警渠道已禁用: {", ".join(disabled_channels)}'
                }), 400
        
        # 启用规则
        rule.enabled = True
        rule.updated_at = datetime.utcnow()
        db.session.commit()
        
        # 记录操作日志
        from app.services.operation_log_service import operation_log_service
        operation_log_service.log_operation(
            action='enable',
            resource='alert_rule',
            resource_id=rule.id,
            details={'name': rule.name}
        )
        
        logger.info(f"用户 {current_user_id} 启用告警规则: {rule.name}")
        
        return jsonify({
            'success': True,
            'message': '告警规则启用成功',
            'data': rule.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"启用告警规则失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'启用告警规则失败: {str(e)}'
        }), 500


@monitor_bp.route('/rules/<int:rule_id>/disable', methods=['POST'])
@tenant_required
def disable_alert_rule(rule_id):
    """禁用告警规则"""
    try:
        tenant_id = get_current_tenant_id()
        current_user_id = get_jwt_identity()
        
        # 查找告警规则
        rule = AlertRule.query.filter_by(
            id=rule_id,
            tenant_id=tenant_id
        ).first()
        
        if not rule:
            return jsonify({
                'success': False,
                'message': '告警规则不存在'
            }), 404
        
        if not rule.enabled:
            return jsonify({
                'success': False,
                'message': '告警规则已经是禁用状态'
            }), 400
        
        # 禁用规则
        rule.enabled = False
        rule.updated_at = datetime.utcnow()
        db.session.commit()
        
        # 记录操作日志
        from app.services.operation_log_service import operation_log_service
        operation_log_service.log_operation(
            action='disable',
            resource='alert_rule',
            resource_id=rule.id,
            details={'name': rule.name}
        )
        
        logger.info(f"用户 {current_user_id} 禁用告警规则: {rule.name}")
        
        return jsonify({
            'success': True,
            'message': '告警规则禁用成功',
            'data': rule.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"禁用告警规则失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'禁用告警规则失败: {str(e)}'
        }), 500


@monitor_bp.route('/rules/<int:rule_id>', methods=['GET'])
@tenant_required
def get_alert_rule(rule_id):
    """获取单个告警规则详情"""
    try:
        tenant_id = get_current_tenant_id()
        
        # 查找告警规则
        rule = AlertRule.query.filter_by(
            id=rule_id,
            tenant_id=tenant_id
        ).first()
        
        if not rule:
            return jsonify({
                'success': False,
                'message': '告警规则不存在'
            }), 404
        
        # 获取规则详情
        rule_data = rule.to_dict()
        
        # 获取关联的告警渠道信息
        if rule.channel_ids:
            channels = AlertChannel.query.filter(
                AlertChannel.id.in_(rule.channel_ids),
                AlertChannel.tenant_id == tenant_id
            ).all()
            rule_data['channels'] = [
                {
                    'id': c.id,
                    'name': c.name,
                    'type': c.type,
                    'status': c.status,
                    'is_enabled': c.is_enabled()
                } for c in channels
            ]
        else:
            rule_data['channels'] = []
        
        # 获取关联的主机信息
        if rule.host_ids:
            from app.models.host import SSHHost
            hosts = SSHHost.query.filter(
                SSHHost.id.in_(rule.host_ids),
                SSHHost.tenant_id == tenant_id
            ).all()
            rule_data['hosts'] = [
                {
                    'id': h.id,
                    'name': h.name,
                    'hostname': h.hostname,
                    'status': h.status
                } for h in hosts
            ]
        else:
            rule_data['hosts'] = []
            rule_data['applies_to_all_hosts'] = True
        
        # 获取告警统计信息
        total_alerts = AlertRecord.query.filter_by(rule_id=rule.id).count()
        active_alerts = AlertRecord.query.filter(
            AlertRecord.rule_id == rule.id,
            AlertRecord.status == 'active'
        ).count()
        recent_alerts = AlertRecord.query.filter(
            AlertRecord.rule_id == rule.id,
            AlertRecord.created_at >= datetime.utcnow() - timedelta(days=7)
        ).count()
        
        rule_data['alert_statistics'] = {
            'total_alerts': total_alerts,
            'active_alerts': active_alerts,
            'recent_alerts': recent_alerts
        }
        
        # 获取最近的告警记录
        recent_records = AlertRecord.query.filter_by(rule_id=rule.id)\
            .order_by(desc(AlertRecord.created_at))\
            .limit(5)\
            .all()
        
        rule_data['recent_alert_records'] = [record.to_dict() for record in recent_records]
        
        return jsonify({
            'success': True,
            'data': rule_data
        })
        
    except Exception as e:
        logger.error(f"获取告警规则详情失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'获取告警规则详情失败: {str(e)}'
        }), 500


# ==================== Alert Record APIs ====================

@monitor_bp.route('/alerts', methods=['GET'])
@tenant_required
def get_alert_records():
    """获取告警记录列表"""
    try:
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        status = request.args.get('status', '')
        severity = request.args.get('severity', '')
        rule_id = request.args.get('rule_id', type=int)
        host_id = request.args.get('host_id', type=int)
        metric_type = request.args.get('metric_type', '')
        search = request.args.get('search', '')
        start_date = request.args.get('start_date', '')
        end_date = request.args.get('end_date', '')
        
        # 参数验证
        if page < 1:
            page = 1
        if per_page < 1 or per_page > 100:
            per_page = 10
        
        tenant_id = get_current_tenant_id()
        
        # 构建查询 - 通过rule关联确保租户隔离
        query = AlertRecord.query.join(AlertRule).filter(AlertRule.tenant_id == tenant_id)
        
        # 应用筛选条件
        if status and status in ['active', 'acknowledged', 'ignored', 'resolved']:
            query = query.filter(AlertRecord.status == status)
        
        if severity and severity in ['info', 'warning', 'critical']:
            query = query.filter(AlertRecord.severity == severity)
        
        if rule_id:
            query = query.filter(AlertRecord.rule_id == rule_id)
        
        if host_id:
            query = query.filter(AlertRecord.host_id == host_id)
        
        if metric_type and metric_type in ['cpu', 'memory', 'disk', 'load']:
            query = query.filter(AlertRecord.metric_type == metric_type)
        
        # 时间范围筛选
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(AlertRecord.first_triggered_at >= start_dt)
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': '开始时间格式不正确，请使用ISO格式'
                }), 400
        
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(AlertRecord.first_triggered_at <= end_dt)
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': '结束时间格式不正确，请使用ISO格式'
                }), 400
        
        # 搜索功能
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    AlertRecord.message.ilike(search_term),
                    AlertRule.name.ilike(search_term)
                )
            )
        
        # 排序 - 按最后触发时间倒序
        query = query.order_by(desc(AlertRecord.last_triggered_at))
        
        # 分页
        pagination = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        # 格式化返回数据
        alerts = []
        for record in pagination.items:
            alert_data = record.to_dict()
            
            # 添加主机信息
            if record.host:
                alert_data['host_info'] = {
                    'id': record.host.id,
                    'name': record.host.name,
                    'hostname': record.host.hostname,
                    'status': record.host.status
                }
            
            # 添加规则信息
            if record.rule:
                alert_data['rule_info'] = {
                    'id': record.rule.id,
                    'name': record.rule.name,
                    'enabled': record.rule.enabled
                }
            
            # 获取通知统计
            notification_stats = db.session.query(
                AlertNotification.status,
                func.count(AlertNotification.id).label('count')
            ).filter(
                AlertNotification.alert_record_id == record.id
            ).group_by(AlertNotification.status).all()
            
            alert_data['notification_stats'] = {
                stat.status: stat.count for stat in notification_stats
            }
            
            alerts.append(alert_data)
        
        # 获取统计信息
        stats_query = AlertRecord.query.join(AlertRule).filter(AlertRule.tenant_id == tenant_id)
        
        # 应用相同的筛选条件到统计查询
        if status:
            stats_query = stats_query.filter(AlertRecord.status == status)
        if severity:
            stats_query = stats_query.filter(AlertRecord.severity == severity)
        if rule_id:
            stats_query = stats_query.filter(AlertRecord.rule_id == rule_id)
        if host_id:
            stats_query = stats_query.filter(AlertRecord.host_id == host_id)
        if metric_type:
            stats_query = stats_query.filter(AlertRecord.metric_type == metric_type)
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                stats_query = stats_query.filter(AlertRecord.first_triggered_at >= start_dt)
            except ValueError:
                pass
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                stats_query = stats_query.filter(AlertRecord.first_triggered_at <= end_dt)
            except ValueError:
                pass
        
        # 状态统计
        status_stats = db.session.query(
            AlertRecord.status,
            func.count(AlertRecord.id).label('count')
        ).select_from(stats_query.subquery()).group_by(AlertRecord.status).all()
        
        # 严重级别统计
        severity_stats = db.session.query(
            AlertRecord.severity,
            func.count(AlertRecord.id).label('count')
        ).select_from(stats_query.subquery()).group_by(AlertRecord.severity).all()
        
        return jsonify({
            'success': True,
            'data': {
                'alerts': alerts,
                'pagination': {
                    'page': pagination.page,
                    'per_page': pagination.per_page,
                    'total': pagination.total,
                    'pages': pagination.pages,
                    'has_prev': pagination.has_prev,
                    'has_next': pagination.has_next
                },
                'statistics': {
                    'status_stats': {stat.status: stat.count for stat in status_stats},
                    'severity_stats': {stat.severity: stat.count for stat in severity_stats},
                    'total_count': pagination.total
                }
            }
        })
        
    except Exception as e:
        logger.error(f"获取告警记录列表失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'获取告警记录列表失败: {str(e)}'
        }), 500


@monitor_bp.route('/alerts/<int:alert_id>/ack', methods=['POST'])
@tenant_required
def acknowledge_alert(alert_id):
    """确认告警"""
    try:
        tenant_id = get_current_tenant_id()
        current_user_id = get_jwt_identity()
        
        # 查找告警记录 - 通过rule关联确保租户隔离
        alert_record = AlertRecord.query.join(AlertRule).filter(
            AlertRecord.id == alert_id,
            AlertRule.tenant_id == tenant_id
        ).first()
        
        if not alert_record:
            return jsonify({
                'success': False,
                'message': '告警记录不存在'
            }), 404
        
        # 检查告警状态
        if alert_record.status != 'active':
            return jsonify({
                'success': False,
                'message': f'只能确认活跃状态的告警，当前状态: {alert_record.status}'
            }), 400
        
        # 确认告警
        success = alert_record.acknowledge(current_user_id)
        if not success:
            return jsonify({
                'success': False,
                'message': '告警确认失败'
            }), 400
        
        alert_record.updated_at = datetime.utcnow()
        db.session.commit()
        
        # 记录操作日志
        from app.services.operation_log_service import operation_log_service
        operation_log_service.log_operation(
            action='acknowledge',
            resource='alert_record',
            resource_id=alert_record.id,
            details={
                'rule_name': alert_record.rule.name if alert_record.rule else None,
                'host_name': alert_record.host.name if alert_record.host else None,
                'severity': alert_record.severity,
                'metric_type': alert_record.metric_type
            }
        )
        
        logger.info(f"用户 {current_user_id} 确认告警: {alert_record.id}")
        
        return jsonify({
            'success': True,
            'message': '告警确认成功',
            'data': alert_record.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"确认告警失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'确认告警失败: {str(e)}'
        }), 500


@monitor_bp.route('/alerts/<int:alert_id>/ignore', methods=['POST'])
@tenant_required
def ignore_alert(alert_id):
    """忽略告警"""
    try:
        tenant_id = get_current_tenant_id()
        current_user_id = get_jwt_identity()
        
        # 查找告警记录 - 通过rule关联确保租户隔离
        alert_record = AlertRecord.query.join(AlertRule).filter(
            AlertRecord.id == alert_id,
            AlertRule.tenant_id == tenant_id
        ).first()
        
        if not alert_record:
            return jsonify({
                'success': False,
                'message': '告警记录不存在'
            }), 404
        
        # 检查告警状态
        if alert_record.status not in ['active', 'acknowledged']:
            return jsonify({
                'success': False,
                'message': f'只能忽略活跃或已确认状态的告警，当前状态: {alert_record.status}'
            }), 400
        
        # 忽略告警
        success = alert_record.ignore()
        if not success:
            return jsonify({
                'success': False,
                'message': '告警忽略失败'
            }), 400
        
        alert_record.updated_at = datetime.utcnow()
        db.session.commit()
        
        # 记录操作日志
        from app.services.operation_log_service import operation_log_service
        operation_log_service.log_operation(
            action='ignore',
            resource='alert_record',
            resource_id=alert_record.id,
            details={
                'rule_name': alert_record.rule.name if alert_record.rule else None,
                'host_name': alert_record.host.name if alert_record.host else None,
                'severity': alert_record.severity,
                'metric_type': alert_record.metric_type
            }
        )
        
        logger.info(f"用户 {current_user_id} 忽略告警: {alert_record.id}")
        
        return jsonify({
            'success': True,
            'message': '告警忽略成功',
            'data': alert_record.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"忽略告警失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'忽略告警失败: {str(e)}'
        }), 500


# ==================== Monitor Dashboard API ====================

@monitor_bp.route('/dashboard', methods=['GET'])
@tenant_required
def get_monitor_dashboard():
    """获取监控大屏数据"""
    try:
        tenant_id = get_current_tenant_id()
        
        # 获取时间范围参数
        hours = request.args.get('hours', 24, type=int)
        if hours < 1 or hours > 168:  # 限制在1小时到7天之间
            hours = 24
        
        time_threshold = datetime.utcnow() - timedelta(hours=hours)
        
        # 1. 基础统计数据
        stats = _get_basic_statistics(tenant_id)
        
        # 2. 告警趋势数据
        alert_trends = _get_alert_trends(tenant_id, time_threshold)
        
        # 3. 告警分布数据
        alert_distribution = _get_alert_distribution(tenant_id, time_threshold)
        
        # 4. 主机状态统计
        host_status = _get_host_status_statistics(tenant_id)
        
        # 5. 告警渠道统计
        channel_stats = _get_channel_statistics(tenant_id)
        
        # 6. 最近告警列表
        recent_alerts = _get_recent_alerts(tenant_id, limit=10)
        
        # 7. 系统健康度评分
        health_score = _calculate_system_health_score(tenant_id, time_threshold)
        
        dashboard_data = {
            'statistics': stats,
            'alert_trends': alert_trends,
            'alert_distribution': alert_distribution,
            'host_status': host_status,
            'channel_statistics': channel_stats,
            'recent_alerts': recent_alerts,
            'health_score': health_score,
            'time_range': {
                'hours': hours,
                'start_time': time_threshold.isoformat(),
                'end_time': datetime.utcnow().isoformat()
            }
        }
        
        return jsonify({
            'success': True,
            'data': dashboard_data
        })
        
    except Exception as e:
        logger.error(f"获取监控大屏数据失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'获取监控大屏数据失败: {str(e)}'
        }), 500


def _get_basic_statistics(tenant_id):
    """获取基础统计数据"""
    try:
        # 告警规则统计
        total_rules = AlertRule.query.filter_by(tenant_id=tenant_id).count()
        enabled_rules = AlertRule.query.filter_by(tenant_id=tenant_id, enabled=True).count()
        
        # 告警渠道统计
        total_channels = AlertChannel.query.filter_by(tenant_id=tenant_id).count()
        enabled_channels = AlertChannel.query.filter_by(tenant_id=tenant_id, status=1).count()
        
        # 告警记录统计
        total_alerts = AlertRecord.query.join(AlertRule).filter(AlertRule.tenant_id == tenant_id).count()
        active_alerts = AlertRecord.query.join(AlertRule).filter(
            AlertRule.tenant_id == tenant_id,
            AlertRecord.status == 'active'
        ).count()
        
        # 主机统计
        from app.models.host import SSHHost
        total_hosts = SSHHost.query.filter_by(tenant_id=tenant_id).count()
        active_hosts = SSHHost.query.filter_by(tenant_id=tenant_id, status=1).count()
        
        return {
            'rules': {
                'total': total_rules,
                'enabled': enabled_rules,
                'disabled': total_rules - enabled_rules
            },
            'channels': {
                'total': total_channels,
                'enabled': enabled_channels,
                'disabled': total_channels - enabled_channels
            },
            'alerts': {
                'total': total_alerts,
                'active': active_alerts,
                'resolved': total_alerts - active_alerts
            },
            'hosts': {
                'total': total_hosts,
                'active': active_hosts,
                'inactive': total_hosts - active_hosts
            }
        }
    except Exception as e:
        logger.error(f"获取基础统计数据失败: {str(e)}", exc_info=True)
        return {}


def _get_alert_trends(tenant_id, time_threshold):
    """获取告警趋势数据"""
    try:
        # 检查数据库类型，使用不同的时间截断函数
        from app.extensions import db
        engine_name = db.engine.name
        
        if engine_name == 'postgresql':
            # PostgreSQL 使用 date_trunc
            time_trunc = func.date_trunc('hour', AlertRecord.created_at)
        else:
            # SQLite 使用 strftime
            time_trunc = func.strftime('%Y-%m-%d %H:00:00', AlertRecord.created_at)
        
        # 按小时统计告警数量
        alerts_by_hour = db.session.query(
            time_trunc.label('hour'),
            func.count(AlertRecord.id).label('count'),
            AlertRecord.severity
        ).join(AlertRule).filter(
            AlertRule.tenant_id == tenant_id,
            AlertRecord.created_at >= time_threshold
        ).group_by(
            time_trunc,
            AlertRecord.severity
        ).order_by('hour').all()
        
        # 格式化数据
        trends = {}
        for hour, count, severity in alerts_by_hour:
            if engine_name == 'postgresql':
                hour_str = hour.strftime('%Y-%m-%d %H:00')
            else:
                # SQLite 返回的是字符串，确保格式一致
                if isinstance(hour, str):
                    # 从 "2026-01-06 02:00:00" 格式转换为 "2026-01-06 02:00"
                    hour_str = hour[:16] if len(hour) >= 16 else hour
                else:
                    hour_str = hour.strftime('%Y-%m-%d %H:00')
            
            if hour_str not in trends:
                trends[hour_str] = {'critical': 0, 'warning': 0, 'info': 0, 'total': 0}
            trends[hour_str][severity] = count
            trends[hour_str]['total'] += count
        
        # 转换为图表数据格式
        chart_data = []
        for hour_str, data in sorted(trends.items()):
            chart_data.append({
                'time': hour_str,
                'critical': data['critical'],
                'warning': data['warning'],
                'info': data['info'],
                'total': data['total']
            })
        
        return chart_data
    except Exception as e:
        logger.error(f"获取告警趋势数据失败: {str(e)}", exc_info=True)
        return []


def _get_alert_distribution(tenant_id, time_threshold):
    """获取告警分布数据"""
    try:
        # 按严重级别分布
        severity_distribution = db.session.query(
            AlertRecord.severity,
            func.count(AlertRecord.id).label('count')
        ).join(AlertRule).filter(
            AlertRule.tenant_id == tenant_id,
            AlertRecord.created_at >= time_threshold
        ).group_by(AlertRecord.severity).all()
        
        # 按指标类型分布
        metric_distribution = db.session.query(
            AlertRecord.metric_type,
            func.count(AlertRecord.id).label('count')
        ).join(AlertRule).filter(
            AlertRule.tenant_id == tenant_id,
            AlertRecord.created_at >= time_threshold
        ).group_by(AlertRecord.metric_type).all()
        
        # 按状态分布
        status_distribution = db.session.query(
            AlertRecord.status,
            func.count(AlertRecord.id).label('count')
        ).join(AlertRule).filter(
            AlertRule.tenant_id == tenant_id,
            AlertRecord.created_at >= time_threshold
        ).group_by(AlertRecord.status).all()
        
        return {
            'by_severity': [{'name': severity, 'value': count} for severity, count in severity_distribution],
            'by_metric': [{'name': metric, 'value': count} for metric, count in metric_distribution],
            'by_status': [{'name': status, 'value': count} for status, count in status_distribution]
        }
    except Exception as e:
        logger.error(f"获取告警分布数据失败: {str(e)}", exc_info=True)
        return {'by_severity': [], 'by_metric': [], 'by_status': []}


def _get_host_status_statistics(tenant_id):
    """获取主机状态统计"""
    try:
        from app.models.host import SSHHost, HostMetrics
        
        # 获取所有主机的最新指标
        latest_metrics = db.session.query(
            SSHHost.id,
            SSHHost.name,
            SSHHost.hostname,
            SSHHost.status,
            HostMetrics.cpu_usage,
            HostMetrics.memory_usage,
            HostMetrics.disk_usage,
            HostMetrics.load_average,
            HostMetrics.collected_at
        ).outerjoin(
            HostMetrics,
            SSHHost.id == HostMetrics.host_id
        ).filter(
            SSHHost.tenant_id == tenant_id
        ).order_by(
            SSHHost.id,
            desc(HostMetrics.collected_at)
        ).all()
        
        # 按主机分组，取最新的指标
        host_metrics = {}
        for metric in latest_metrics:
            host_id = metric[0]
            if host_id not in host_metrics:
                host_metrics[host_id] = {
                    'id': metric[0],
                    'name': metric[1],
                    'hostname': metric[2],
                    'status': metric[3],
                    'cpu_usage': float(metric[4]) if metric[4] else 0,
                    'memory_usage': float(metric[5]) if metric[5] else 0,
                    'disk_usage': float(metric[6]) if metric[6] else 0,
                    'load_average': float(metric[7]) if metric[7] else 0,
                    'last_updated': metric[8].isoformat() if metric[8] else None
                }
        
        # 计算健康状态
        healthy_hosts = 0
        warning_hosts = 0
        critical_hosts = 0
        
        for host_data in host_metrics.values():
            if host_data['status'] == 0:  # 禁用的主机
                continue
                
            # 根据指标判断健康状态
            cpu = host_data['cpu_usage']
            memory = host_data['memory_usage']
            disk = host_data['disk_usage']
            
            if cpu > 90 or memory > 90 or disk > 90:
                critical_hosts += 1
            elif cpu > 70 or memory > 70 or disk > 80:
                warning_hosts += 1
            else:
                healthy_hosts += 1
        
        return {
            'total_hosts': len(host_metrics),
            'healthy': healthy_hosts,
            'warning': warning_hosts,
            'critical': critical_hosts,
            'host_details': list(host_metrics.values())
        }
    except Exception as e:
        logger.error(f"获取主机状态统计失败: {str(e)}", exc_info=True)
        return {'total_hosts': 0, 'healthy': 0, 'warning': 0, 'critical': 0, 'host_details': []}


def _get_channel_statistics(tenant_id):
    """获取告警渠道统计"""
    try:
        # 获取渠道类型分布
        channel_types = db.session.query(
            AlertChannel.type,
            func.count(AlertChannel.id).label('count')
        ).filter(
            AlertChannel.tenant_id == tenant_id
        ).group_by(AlertChannel.type).all()
        
        # 获取通知发送统计
        notification_stats = db.session.query(
            AlertNotification.status,
            func.count(AlertNotification.id).label('count')
        ).join(AlertChannel).join(AlertRecord).join(AlertRule).filter(
            AlertRule.tenant_id == tenant_id,
            AlertNotification.created_at >= datetime.utcnow() - timedelta(days=7)
        ).group_by(AlertNotification.status).all()
        
        return {
            'channel_types': [{'name': channel_type, 'value': count} for channel_type, count in channel_types],
            'notification_stats': [{'name': status, 'value': count} for status, count in notification_stats]
        }
    except Exception as e:
        logger.error(f"获取告警渠道统计失败: {str(e)}", exc_info=True)
        return {'channel_types': [], 'notification_stats': []}


def _get_recent_alerts(tenant_id, limit=10):
    """获取最近告警列表"""
    try:
        recent_alerts = AlertRecord.query.join(AlertRule).filter(
            AlertRule.tenant_id == tenant_id
        ).order_by(desc(AlertRecord.created_at)).limit(limit).all()
        
        return [alert.to_dict() for alert in recent_alerts]
    except Exception as e:
        logger.error(f"获取最近告警列表失败: {str(e)}", exc_info=True)
        return []


def _calculate_system_health_score(tenant_id, time_threshold):
    """计算系统健康度评分"""
    try:
        # 基础权重配置
        weights = {
            'alert_rate': 0.4,      # 告警频率权重
            'host_health': 0.3,     # 主机健康权重
            'channel_health': 0.2,  # 渠道健康权重
            'rule_coverage': 0.1    # 规则覆盖权重
        }
        
        # 1. 告警频率评分 (告警越少分数越高)
        total_alerts = AlertRecord.query.join(AlertRule).filter(
            AlertRule.tenant_id == tenant_id,
            AlertRecord.created_at >= time_threshold
        ).count()
        
        from app.models.host import SSHHost
        total_hosts = SSHHost.query.filter_by(tenant_id=tenant_id, status=1).count()
        
        if total_hosts > 0:
            alert_rate = total_alerts / total_hosts
            alert_score = max(0, 100 - (alert_rate * 10))  # 每个主机每小时超过0.1个告警开始扣分
        else:
            alert_score = 100
        
        # 2. 主机健康评分
        host_stats = _get_host_status_statistics(tenant_id)
        total_active_hosts = host_stats['total_hosts']
        if total_active_hosts > 0:
            healthy_ratio = host_stats['healthy'] / total_active_hosts
            warning_ratio = host_stats['warning'] / total_active_hosts
            critical_ratio = host_stats['critical'] / total_active_hosts
            host_score = (healthy_ratio * 100) + (warning_ratio * 70) + (critical_ratio * 30)
        else:
            host_score = 100
        
        # 3. 渠道健康评分
        total_channels = AlertChannel.query.filter_by(tenant_id=tenant_id).count()
        enabled_channels = AlertChannel.query.filter_by(tenant_id=tenant_id, status=1).count()
        
        if total_channels > 0:
            channel_score = (enabled_channels / total_channels) * 100
        else:
            channel_score = 0  # 没有渠道配置扣分
        
        # 4. 规则覆盖评分
        total_rules = AlertRule.query.filter_by(tenant_id=tenant_id).count()
        enabled_rules = AlertRule.query.filter_by(tenant_id=tenant_id, enabled=True).count()
        
        if total_rules > 0:
            rule_score = (enabled_rules / total_rules) * 100
        else:
            rule_score = 0  # 没有规则配置扣分
        
        # 计算综合评分
        health_score = (
            alert_score * weights['alert_rate'] +
            host_score * weights['host_health'] +
            channel_score * weights['channel_health'] +
            rule_score * weights['rule_coverage']
        )
        
        # 确定健康等级
        if health_score >= 90:
            health_level = 'excellent'
            health_color = '#52c41a'
        elif health_score >= 80:
            health_level = 'good'
            health_color = '#1890ff'
        elif health_score >= 60:
            health_level = 'warning'
            health_color = '#faad14'
        else:
            health_level = 'critical'
            health_color = '#f5222d'
        
        return {
            'score': round(health_score, 1),
            'level': health_level,
            'color': health_color,
            'components': {
                'alert_rate': round(alert_score, 1),
                'host_health': round(host_score, 1),
                'channel_health': round(channel_score, 1),
                'rule_coverage': round(rule_score, 1)
            },
            'weights': weights
        }
    except Exception as e:
        logger.error(f"计算系统健康度评分失败: {str(e)}", exc_info=True)
        return {
            'score': 0,
            'level': 'unknown',
            'color': '#d9d9d9',
            'components': {},
            'weights': {}
        }