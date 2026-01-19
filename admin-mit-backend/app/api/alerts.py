"""
告警管理 API 端点

提供告警的增删改查、统计分析等功能
包含完整的认证和权限检查
"""

from flask import Blueprint, request, jsonify, current_app, g
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import logging
from app.core.middleware import tenant_required

# 创建蓝图
alerts_bp = Blueprint('alerts', __name__, url_prefix='/api/alerts')

# 配置日志
logger = logging.getLogger(__name__)

# 模拟告警数据存储（实际项目中应该使用数据库）
MOCK_ALERTS = [
    {
        'id': '1',
        'title': 'CPU使用率过高',
        'description': '服务器 web-01 的CPU使用率持续超过90%',
        'level': 'critical',
        'status': 'active',
        'source': 'system-monitor',
        'created_at': '2024-01-08T10:30:00Z',
        'updated_at': '2024-01-08T10:30:00Z',
        'tags': ['cpu', 'performance', 'web-01'],
        'metadata': {
            'hostname': 'web-01.example.com',
            'ip_address': '192.168.1.100',
            'current_cpu_usage': 94.5,
            'threshold': 90
        }
    },
    {
        'id': '2',
        'title': '内存使用率告警',
        'description': '数据库服务器内存使用率达到85%',
        'level': 'warning',
        'status': 'acknowledged',
        'source': 'database-monitor',
        'created_at': '2024-01-08T09:15:00Z',
        'updated_at': '2024-01-08T09:45:00Z',
        'acknowledged_by': 'admin',
        'acknowledged_at': '2024-01-08T09:45:00Z',
        'tags': ['memory', 'database', 'db-01']
    }
]

@alerts_bp.route('', methods=['GET'])
@tenant_required
def get_alerts():
    """
    获取告警列表
    
    支持的查询参数：
    - page: 页码
    - limit: 每页数量
    - level: 告警级别 (critical, warning, info)
    - status: 告警状态 (active, acknowledged, resolved)
    - source: 告警来源
    - search: 搜索关键词
    - start_date: 开始日期
    - end_date: 结束日期
    """
    try:
        # 获取当前用户
        current_user = get_jwt_identity()
        logger.info(f"用户 {current_user} 请求告警列表")
        
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        level = request.args.get('level')
        status = request.args.get('status')
        source = request.args.get('source')
        search = request.args.get('search')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # 过滤告警数据
        filtered_alerts = MOCK_ALERTS.copy()
        
        if level and level != 'all':
            filtered_alerts = [a for a in filtered_alerts if a['level'] == level]
        
        if status and status != 'all':
            filtered_alerts = [a for a in filtered_alerts if a['status'] == status]
        
        if source:
            filtered_alerts = [a for a in filtered_alerts if a['source'] == source]
        
        if search:
            search_lower = search.lower()
            filtered_alerts = [
                a for a in filtered_alerts 
                if search_lower in a['title'].lower() 
                or search_lower in a['description'].lower()
                or search_lower in a['source'].lower()
            ]
        
        # 分页
        total = len(filtered_alerts)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        alerts = filtered_alerts[start_idx:end_idx]
        
        return jsonify({
            'success': True,
            'data': {
                'alerts': alerts,
                'total': total,
                'page': page,
                'limit': limit,
                'total_pages': (total + limit - 1) // limit
            }
        })
        
    except Exception as e:
        logger.error(f"获取告警列表失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': '获取告警列表失败',
            'error': str(e)
        }), 500

@alerts_bp.route('/<alert_id>', methods=['GET'])
@tenant_required
def get_alert(alert_id: str):
    """获取告警详情"""
    try:
        current_user = get_jwt_identity()
        logger.info(f"用户 {current_user} 请求告警详情: {alert_id}")
        
        # 查找告警
        alert = next((a for a in MOCK_ALERTS if a['id'] == alert_id), None)
        if not alert:
            return jsonify({
                'success': False,
                'message': '告警不存在'
            }), 404
        
        # 添加历史记录和指标数据
        alert_detail = alert.copy()
        alert_detail['history'] = [
            {
                'id': '1',
                'action': 'created',
                'user': 'system',
                'timestamp': alert['created_at']
            }
        ]
        
        if alert.get('acknowledged_by'):
            alert_detail['history'].append({
                'id': '2',
                'action': 'acknowledged',
                'user': alert['acknowledged_by'],
                'timestamp': alert.get('acknowledged_at', alert['updated_at'])
            })
        
        alert_detail['metrics'] = [
            {'name': 'CPU使用率', 'value': 94.5, 'unit': '%', 'timestamp': alert['updated_at']},
            {'name': '内存使用率', 'value': 67.8, 'unit': '%', 'timestamp': alert['updated_at']},
            {'name': '负载平均值', 'value': 3.2, 'unit': '', 'timestamp': alert['updated_at']}
        ]
        
        return jsonify({
            'success': True,
            'data': alert_detail
        })
        
    except Exception as e:
        logger.error(f"获取告警详情失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': '获取告警详情失败',
            'error': str(e)
        }), 500

@alerts_bp.route('/<alert_id>/action', methods=['POST'])
@tenant_required
def handle_alert_action(alert_id: str):
    """处理告警操作（确认/解决）"""
    try:
        current_user = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'action' not in data:
            return jsonify({
                'success': False,
                'message': '缺少操作参数'
            }), 400
        
        action = data['action']
        comment = data.get('comment', '')
        
        if action not in ['acknowledge', 'resolve']:
            return jsonify({
                'success': False,
                'message': '无效的操作类型'
            }), 400
        
        # 查找告警
        alert_idx = next((i for i, a in enumerate(MOCK_ALERTS) if a['id'] == alert_id), None)
        if alert_idx is None:
            return jsonify({
                'success': False,
                'message': '告警不存在'
            }), 404
        
        # 更新告警状态
        now = datetime.utcnow().isoformat() + 'Z'
        MOCK_ALERTS[alert_idx]['updated_at'] = now
        
        if action == 'acknowledge':
            MOCK_ALERTS[alert_idx]['status'] = 'acknowledged'
            MOCK_ALERTS[alert_idx]['acknowledged_by'] = current_user
            MOCK_ALERTS[alert_idx]['acknowledged_at'] = now
        elif action == 'resolve':
            MOCK_ALERTS[alert_idx]['status'] = 'resolved'
            MOCK_ALERTS[alert_idx]['resolved_by'] = current_user
            MOCK_ALERTS[alert_idx]['resolved_at'] = now
        
        logger.info(f"用户 {current_user} 对告警 {alert_id} 执行了 {action} 操作")
        
        return jsonify({
            'success': True,
            'message': f'告警已{action}',
            'data': MOCK_ALERTS[alert_idx]
        })
        
    except Exception as e:
        logger.error(f"处理告警操作失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': '处理告警操作失败',
            'error': str(e)
        }), 500

@alerts_bp.route('/statistics', methods=['GET'])
@tenant_required
def get_alert_statistics():
    """获取告警统计数据"""
    try:
        current_user = get_jwt_identity()
        time_range = request.args.get('time_range', '30d')
        
        logger.info(f"用户 {current_user} 请求告警统计数据，时间范围: {time_range}")
        
        # 计算统计数据
        total_alerts = len(MOCK_ALERTS)
        active_alerts = len([a for a in MOCK_ALERTS if a['status'] == 'active'])
        acknowledged_alerts = len([a for a in MOCK_ALERTS if a['status'] == 'acknowledged'])
        resolved_alerts = len([a for a in MOCK_ALERTS if a['status'] == 'resolved'])
        
        critical_alerts = len([a for a in MOCK_ALERTS if a['level'] == 'critical'])
        warning_alerts = len([a for a in MOCK_ALERTS if a['level'] == 'warning'])
        info_alerts = len([a for a in MOCK_ALERTS if a['level'] == 'info'])
        
        resolution_rate = (resolved_alerts / total_alerts * 100) if total_alerts > 0 else 0
        
        # 模拟趋势数据
        trend_data = []
        for i in range(7):
            date = (datetime.now() - timedelta(days=6-i)).strftime('%Y-%m-%d')
            trend_data.append({
                'date': date,
                'active': 15 + i * 2,
                'resolved': 10 + i,
                'total': 25 + i * 3
            })
        
        # 级别分布
        level_distribution = [
            {'level': 'critical', 'count': critical_alerts, 'percentage': critical_alerts / total_alerts * 100 if total_alerts > 0 else 0},
            {'level': 'warning', 'count': warning_alerts, 'percentage': warning_alerts / total_alerts * 100 if total_alerts > 0 else 0},
            {'level': 'info', 'count': info_alerts, 'percentage': info_alerts / total_alerts * 100 if total_alerts > 0 else 0}
        ]
        
        # 来源分布
        sources = {}
        for alert in MOCK_ALERTS:
            source = alert['source']
            sources[source] = sources.get(source, 0) + 1
        
        source_distribution = [
            {
                'source': source,
                'count': count,
                'percentage': count / total_alerts * 100 if total_alerts > 0 else 0
            }
            for source, count in sources.items()
        ]
        
        statistics = {
            'total_alerts': total_alerts,
            'active_alerts': active_alerts,
            'acknowledged_alerts': acknowledged_alerts,
            'resolved_alerts': resolved_alerts,
            'critical_alerts': critical_alerts,
            'warning_alerts': warning_alerts,
            'info_alerts': info_alerts,
            'avg_resolution_time': 4.2,  # 小时
            'resolution_rate': resolution_rate,
            'trend_data': trend_data,
            'level_distribution': level_distribution,
            'source_distribution': source_distribution,
            'daily_stats': [
                {
                    'date': (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d'),
                    'created': 20 + i,
                    'resolved': 15 + i,
                    'avg_resolution_time': 3.5 + i * 0.2
                }
                for i in range(7)
            ]
        }
        
        return jsonify({
            'success': True,
            'data': statistics
        })
        
    except Exception as e:
        logger.error(f"获取告警统计数据失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': '获取告警统计数据失败',
            'error': str(e)
        }), 500

@alerts_bp.route('/batch-action', methods=['POST'])
@tenant_required
def batch_handle_alerts():
    """批量处理告警"""
    try:
        current_user = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'alert_ids' not in data or 'action' not in data:
            return jsonify({
                'success': False,
                'message': '缺少必要参数'
            }), 400
        
        alert_ids = data['alert_ids']
        action = data['action']
        comment = data.get('comment', '')
        
        if action not in ['acknowledge', 'resolve']:
            return jsonify({
                'success': False,
                'message': '无效的操作类型'
            }), 400
        
        # 批量更新告警
        updated_count = 0
        now = datetime.utcnow().isoformat() + 'Z'
        
        for i, alert in enumerate(MOCK_ALERTS):
            if alert['id'] in alert_ids:
                MOCK_ALERTS[i]['updated_at'] = now
                
                if action == 'acknowledge':
                    MOCK_ALERTS[i]['status'] = 'acknowledged'
                    MOCK_ALERTS[i]['acknowledged_by'] = current_user
                    MOCK_ALERTS[i]['acknowledged_at'] = now
                elif action == 'resolve':
                    MOCK_ALERTS[i]['status'] = 'resolved'
                    MOCK_ALERTS[i]['resolved_by'] = current_user
                    MOCK_ALERTS[i]['resolved_at'] = now
                
                updated_count += 1
        
        logger.info(f"用户 {current_user} 批量{action}了 {updated_count} 个告警")
        
        return jsonify({
            'success': True,
            'message': f'成功{action}了 {updated_count} 个告警',
            'data': {
                'updated_count': updated_count,
                'total_requested': len(alert_ids)
            }
        })
        
    except Exception as e:
        logger.error(f"批量处理告警失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': '批量处理告警失败',
            'error': str(e)
        }), 500

@alerts_bp.route('/export', methods=['GET'])
@tenant_required
def export_alerts():
    """导出告警数据"""
    try:
        current_user = get_jwt_identity()
        format_type = request.args.get('format', 'csv')
        
        logger.info(f"用户 {current_user} 请求导出告警数据，格式: {format_type}")
        
        # 这里应该实现实际的导出逻辑
        # 返回文件下载响应
        
        return jsonify({
            'success': True,
            'message': '导出功能正在开发中',
            'data': {
                'format': format_type,
                'total_alerts': len(MOCK_ALERTS)
            }
        })
        
    except Exception as e:
        logger.error(f"导出告警数据失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': '导出告警数据失败',
            'error': str(e)
        }), 500

# 错误处理
@alerts_bp.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'message': '请求的资源不存在'
    }), 404

@alerts_bp.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'message': '服务器内部错误'
    }), 500