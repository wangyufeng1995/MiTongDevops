"""
仪表盘 API
提供系统概览统计数据
"""
import logging
from flask import Blueprint, jsonify, g
from flask_jwt_extended import jwt_required
from sqlalchemy import text, func
from datetime import datetime, timedelta
from app.extensions import db
from app.core.middleware import tenant_required
from app.models.user import User
from app.models.role import Role
from app.models.menu import Menu
from app.models.host import SSHHost
from app.models.network import NetworkProbe, NetworkProbeResult, NetworkAlertRecord

logger = logging.getLogger(__name__)

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/stats', methods=['GET'])
@tenant_required
@jwt_required()
def get_dashboard_stats():
    """
    获取仪表盘统计数据
    
    Returns:
        {
            "success": true,
            "data": {
                "users": 156,
                "roles": 8,
                "menus": 24,
                "hosts": 32,
                "probes": 50,
                "alerts": 3,
                "uptime": "99.9%"
            }
        }
    """
    try:
        tenant_id = g.tenant_id
        
        # 用户统计
        user_count = User.query.filter(
            User.tenant_id == tenant_id,
            User.status == 1  # 只统计活跃用户
        ).count()
        
        # 角色统计
        role_count = Role.query.filter(
            Role.tenant_id == tenant_id
        ).count()
        
        # 菜单统计
        menu_count = Menu.query.filter(
            Menu.tenant_id == tenant_id
        ).count()
        
        # 主机统计
        host_count = SSHHost.query.filter(
            SSHHost.tenant_id == tenant_id
        ).count()
        
        # 网络探测统计
        probe_count = NetworkProbe.query.filter(
            NetworkProbe.tenant_id == tenant_id
        ).count()
        
        # 活跃告警统计（未解决的告警）
        alert_count = NetworkAlertRecord.query.filter(
            NetworkAlertRecord.tenant_id == tenant_id,
            NetworkAlertRecord.status.in_(['active', 'acknowledged'])
        ).count()
        
        # 计算系统可用性（基于最近24小时的探测成功率）
        yesterday = datetime.utcnow() - timedelta(days=1)
        total_results = NetworkProbeResult.query.filter(
            NetworkProbeResult.tenant_id == tenant_id,
            NetworkProbeResult.probed_at >= yesterday
        ).count()
        
        success_results = NetworkProbeResult.query.filter(
            NetworkProbeResult.tenant_id == tenant_id,
            NetworkProbeResult.probed_at >= yesterday,
            NetworkProbeResult.status == 'success'
        ).count()
        
        if total_results > 0:
            uptime = round((success_results / total_results) * 100, 1)
        else:
            uptime = 100.0
        
        return jsonify({
            'success': True,
            'data': {
                'users': user_count,
                'roles': role_count,
                'menus': menu_count,
                'hosts': host_count,
                'probes': probe_count,
                'alerts': alert_count,
                'uptime': f'{uptime}%'
            }
        }), 200
        
    except Exception as e:
        logger.error(f"获取仪表盘统计数据失败: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'获取统计数据失败: {str(e)}'
        }), 500


@dashboard_bp.route('/trends', methods=['GET'])
@tenant_required
@jwt_required()
def get_dashboard_trends():
    """
    获取仪表盘趋势数据
    
    Returns:
        {
            "success": true,
            "data": {
                "system_usage": [...],
                "alert_trend": [...]
            }
        }
    """
    try:
        tenant_id = g.tenant_id
        
        # 获取最近7天的系统使用率（基于探测成功率）
        system_usage = []
        weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
        
        for i in range(6, -1, -1):
            day = datetime.utcnow() - timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            total = NetworkProbeResult.query.filter(
                NetworkProbeResult.tenant_id == tenant_id,
                NetworkProbeResult.probed_at >= day_start,
                NetworkProbeResult.probed_at < day_end
            ).count()
            
            success = NetworkProbeResult.query.filter(
                NetworkProbeResult.tenant_id == tenant_id,
                NetworkProbeResult.probed_at >= day_start,
                NetworkProbeResult.probed_at < day_end,
                NetworkProbeResult.status == 'success'
            ).count()
            
            rate = round((success / total) * 100, 1) if total > 0 else 100
            weekday_index = day.weekday()
            
            system_usage.append({
                'label': weekdays[weekday_index],
                'value': rate,
                'color': 'bg-blue-500'
            })
        
        # 获取最近6个月的告警趋势
        alert_trend = []
        months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
        
        for i in range(5, -1, -1):
            # 计算月份
            target_date = datetime.utcnow() - timedelta(days=i * 30)
            month_start = target_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            if month_start.month == 12:
                month_end = month_start.replace(year=month_start.year + 1, month=1)
            else:
                month_end = month_start.replace(month=month_start.month + 1)
            
            alert_count = NetworkAlertRecord.query.filter(
                NetworkAlertRecord.tenant_id == tenant_id,
                NetworkAlertRecord.first_triggered_at >= month_start,
                NetworkAlertRecord.first_triggered_at < month_end
            ).count()
            
            alert_trend.append({
                'label': months[month_start.month - 1],
                'value': alert_count
            })
        
        return jsonify({
            'success': True,
            'data': {
                'system_usage': system_usage,
                'alert_trend': alert_trend
            }
        }), 200
        
    except Exception as e:
        logger.error(f"获取仪表盘趋势数据失败: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'获取趋势数据失败: {str(e)}'
        }), 500


@dashboard_bp.route('/recent-activities', methods=['GET'])
@tenant_required
@jwt_required()
def get_recent_activities():
    """
    获取最近活动
    
    Returns:
        {
            "success": true,
            "data": {
                "activities": [...]
            }
        }
    """
    try:
        tenant_id = g.tenant_id
        
        # 获取最近的探测结果作为活动
        recent_results = NetworkProbeResult.query.filter(
            NetworkProbeResult.tenant_id == tenant_id
        ).order_by(
            NetworkProbeResult.probed_at.desc()
        ).limit(10).all()
        
        activities = []
        for result in recent_results:
            probe = NetworkProbe.query.get(result.probe_id)
            if probe:
                activities.append({
                    'id': result.id,
                    'type': 'probe',
                    'title': f'探测任务: {probe.name}',
                    'status': result.status,
                    'response_time': result.response_time,
                    'timestamp': result.probed_at.isoformat() if result.probed_at else None
                })
        
        return jsonify({
            'success': True,
            'data': {
                'activities': activities
            }
        }), 200
        
    except Exception as e:
        logger.error(f"获取最近活动失败: {e}")
        return jsonify({
            'success': False,
            'message': f'获取最近活动失败: {str(e)}'
        }), 500
