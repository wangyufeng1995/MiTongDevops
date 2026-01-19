"""
WebSocket 管理 API
"""
from flask import Blueprint, jsonify, request
from app.services.websocket_service import websocket_service
from app.core.middleware import tenant_required, role_required
import logging

logger = logging.getLogger(__name__)
websocket_bp = Blueprint('websocket', __name__)


@websocket_bp.route('/stats', methods=['GET'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def get_websocket_stats():
    """获取 WebSocket 连接统计"""
    try:
        stats = websocket_service.get_connection_stats()
        
        return jsonify({
            'success': True,
            'data': {
                'connection_stats': stats,
                'server_info': {
                    'websocket_enabled': True,
                    'cors_enabled': True
                }
            }
        })
        
    except Exception as e:
        logger.error(f"Get WebSocket stats error: {e}")
        return jsonify({
            'success': False,
            'message': '获取 WebSocket 统计失败'
        }), 500


@websocket_bp.route('/broadcast', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def broadcast_message():
    """广播消息到租户"""
    try:
        data = request.get_json()
        
        # 验证必需字段
        if not data.get('event') or not data.get('message'):
            return jsonify({
                'success': False,
                'message': '缺少必需字段: event 或 message'
            }), 400
        
        event = data['event']
        message = data['message']
        target_type = data.get('target_type', 'tenant')  # tenant, user, room
        target_id = data.get('target_id')
        
        if target_type == 'tenant':
            if not target_id:
                return jsonify({
                    'success': False,
                    'message': '租户广播需要提供 target_id'
                }), 400
            
            websocket_service.broadcast_to_tenant(target_id, event, message)
            
        elif target_type == 'user':
            if not target_id:
                return jsonify({
                    'success': False,
                    'message': '用户消息需要提供 target_id'
                }), 400
            
            websocket_service.send_to_user(target_id, event, message)
            
        elif target_type == 'room':
            if not target_id:
                return jsonify({
                    'success': False,
                    'message': '房间广播需要提供 target_id'
                }), 400
            
            websocket_service.broadcast_to_room(target_id, event, message)
            
        else:
            return jsonify({
                'success': False,
                'message': '无效的目标类型'
            }), 400
        
        return jsonify({
            'success': True,
            'message': '消息发送成功'
        })
        
    except Exception as e:
        logger.error(f"Broadcast message error: {e}")
        return jsonify({
            'success': False,
            'message': '发送消息失败'
        }), 500


@websocket_bp.route('/disconnect/<int:user_id>', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def disconnect_user(user_id):
    """断开用户连接"""
    try:
        data = request.get_json() or {}
        reason = data.get('reason', 'Admin disconnect')
        
        websocket_service.disconnect_user(user_id, reason)
        
        return jsonify({
            'success': True,
            'message': f'用户 {user_id} 连接已断开'
        })
        
    except Exception as e:
        logger.error(f"Disconnect user error: {e}")
        return jsonify({
            'success': False,
            'message': '断开用户连接失败'
        }), 500