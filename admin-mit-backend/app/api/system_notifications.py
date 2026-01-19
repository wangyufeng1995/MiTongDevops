"""
系统通知 API 路由
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from datetime import datetime, timedelta
from app.extensions import db
from app.models.system_notification import SystemNotification
from app.core.middleware import tenant_required, admin_required

bp = Blueprint('system_notifications', __name__, url_prefix='/api/notifications')


@bp.route('', methods=['GET'])
@tenant_required
def get_notifications():
    """获取通知列表"""
    try:
        user_id = get_jwt_identity()  # 返回字符串用户ID
        claims = get_jwt()
        tenant_id = claims.get('tenant_id')
        
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        is_read = request.args.get('is_read', type=str)
        category = request.args.get('category', type=str)
        
        # 构建查询
        query = SystemNotification.query.filter_by(tenant_id=tenant_id)
        
        # 只获取全局通知或发给当前用户的通知
        query = query.filter(
            db.or_(
                SystemNotification.is_global == True,
                SystemNotification.target_user_id == user_id
            )
        )
        
        # 过滤已读/未读
        if is_read is not None:
            query = query.filter_by(is_read=is_read.lower() == 'true')
        
        # 过滤分类
        if category:
            query = query.filter_by(category=category)
        
        # 过滤未过期的通知
        query = query.filter(
            db.or_(
                SystemNotification.expires_at == None,
                SystemNotification.expires_at > datetime.utcnow()
            )
        )
        
        # 按创建时间倒序排列
        query = query.order_by(SystemNotification.created_at.desc())
        
        # 分页
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # 获取未读数量
        unread_count = SystemNotification.query.filter_by(
            tenant_id=tenant_id,
            is_read=False
        ).filter(
            db.or_(
                SystemNotification.is_global == True,
                SystemNotification.target_user_id == user_id
            )
        ).filter(
            db.or_(
                SystemNotification.expires_at == None,
                SystemNotification.expires_at > datetime.utcnow()
            )
        ).count()
        
        return jsonify({
            'success': True,
            'data': {
                'items': [n.to_dict() for n in pagination.items],
                'pagination': {
                    'page': pagination.page,
                    'per_page': pagination.per_page,
                    'total': pagination.total,
                    'pages': pagination.pages,
                    'has_prev': pagination.has_prev,
                    'has_next': pagination.has_next
                },
                'unread_count': unread_count
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'获取通知列表失败: {str(e)}'
        }), 500


@bp.route('/<int:notification_id>/read', methods=['POST'])
@tenant_required
def mark_as_read(notification_id):
    """标记通知为已读"""
    try:
        claims = get_jwt()
        tenant_id = claims.get('tenant_id')
        
        notification = SystemNotification.query.filter_by(
            id=notification_id,
            tenant_id=tenant_id
        ).first()
        
        if not notification:
            return jsonify({
                'success': False,
                'message': '通知不存在'
            }), 404
        
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': notification.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'标记已读失败: {str(e)}'
        }), 500


@bp.route('/read-all', methods=['POST'])
@tenant_required
def mark_all_as_read():
    """标记所有通知为已读"""
    try:
        user_id = get_jwt_identity()  # 返回字符串用户ID
        claims = get_jwt()
        tenant_id = claims.get('tenant_id')
        
        # 更新所有未读通知
        SystemNotification.query.filter_by(
            tenant_id=tenant_id,
            is_read=False
        ).filter(
            db.or_(
                SystemNotification.is_global == True,
                SystemNotification.target_user_id == user_id
            )
        ).update({
            'is_read': True,
            'read_at': datetime.utcnow()
        })
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '所有通知已标记为已读'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'标记已读失败: {str(e)}'
        }), 500


@bp.route('', methods=['POST'])
@tenant_required
@admin_required
def create_notification():
    """创建通知（管理员）"""
    try:
        claims = get_jwt()
        tenant_id = claims.get('tenant_id')
        
        data = request.get_json()
        
        # 验证必需字段
        if not data.get('title') or not data.get('message'):
            return jsonify({
                'success': False,
                'message': '标题和内容不能为空'
            }), 400
        
        # 创建通知
        notification = SystemNotification(
            tenant_id=tenant_id,
            title=data['title'],
            message=data['message'],
            type=data.get('type', 'info'),
            category=data.get('category', 'system'),
            is_global=data.get('is_global', False),
            target_user_id=data.get('target_user_id'),
            related_type=data.get('related_type'),
            related_id=data.get('related_id')
        )
        
        # 设置过期时间
        if data.get('expires_in_days'):
            notification.expires_at = datetime.utcnow() + timedelta(days=data['expires_in_days'])
        
        db.session.add(notification)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': notification.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'创建通知失败: {str(e)}'
        }), 500


@bp.route('/<int:notification_id>', methods=['PUT'])
@tenant_required
@admin_required
def update_notification(notification_id):
    """更新通知（管理员）"""
    try:
        claims = get_jwt()
        tenant_id = claims.get('tenant_id')
        
        notification = SystemNotification.query.filter_by(
            id=notification_id,
            tenant_id=tenant_id
        ).first()
        
        if not notification:
            return jsonify({
                'success': False,
                'message': '通知不存在'
            }), 404
        
        data = request.get_json()
        
        # 更新字段
        if 'title' in data:
            notification.title = data['title']
        if 'message' in data:
            notification.message = data['message']
        if 'type' in data:
            notification.type = data['type']
        if 'category' in data:
            notification.category = data['category']
        if 'is_global' in data:
            notification.is_global = data['is_global']
        if 'target_user_id' in data:
            notification.target_user_id = data['target_user_id']
        
        # 更新过期时间
        if 'expires_in_days' in data:
            if data['expires_in_days']:
                notification.expires_at = datetime.utcnow() + timedelta(days=data['expires_in_days'])
            else:
                notification.expires_at = None
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': notification.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'更新通知失败: {str(e)}'
        }), 500


@bp.route('/<int:notification_id>', methods=['DELETE'])
@tenant_required
@admin_required
def delete_notification(notification_id):
    """删除通知（管理员）"""
    try:
        claims = get_jwt()
        tenant_id = claims.get('tenant_id')
        
        notification = SystemNotification.query.filter_by(
            id=notification_id,
            tenant_id=tenant_id
        ).first()
        
        if not notification:
            return jsonify({
                'success': False,
                'message': '通知不存在'
            }), 404
        
        db.session.delete(notification)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '通知已删除'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'删除通知失败: {str(e)}'
        }), 500


@bp.route('/stats', methods=['GET'])
@tenant_required
def get_notification_stats():
    """获取通知统计"""
    try:
        user_id = get_jwt_identity()  # 返回字符串用户ID
        claims = get_jwt()
        tenant_id = claims.get('tenant_id')
        
        # 基础查询
        base_query = SystemNotification.query.filter_by(tenant_id=tenant_id).filter(
            db.or_(
                SystemNotification.is_global == True,
                SystemNotification.target_user_id == user_id
            )
        ).filter(
            db.or_(
                SystemNotification.expires_at == None,
                SystemNotification.expires_at > datetime.utcnow()
            )
        )
        
        # 统计各类通知数量
        total = base_query.count()
        unread = base_query.filter_by(is_read=False).count()
        
        # 按分类统计
        categories = {}
        for category in ['system', 'alert', 'task', 'security']:
            count = base_query.filter_by(category=category).count()
            categories[category] = count
        
        return jsonify({
            'success': True,
            'data': {
                'total': total,
                'unread': unread,
                'read': total - unread,
                'categories': categories
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'获取统计失败: {str(e)}'
        }), 500
