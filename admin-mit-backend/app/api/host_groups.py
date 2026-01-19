"""
主机分组管理 API
"""
import logging
from flask import Blueprint, request, jsonify, g
from app.models.host import HostGroup, SSHHost
from app.extensions import db
from app.core.middleware import tenant_required, role_required
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger(__name__)

# 创建蓝图
host_groups_bp = Blueprint('host_groups', __name__, url_prefix='/api/host-groups')


@host_groups_bp.route('', methods=['GET'])
@tenant_required
def get_groups():
    """获取分组列表"""
    try:
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '', type=str)
        all_groups = request.args.get('all', False, type=bool)
        
        # 限制每页数量
        per_page = min(per_page, 100)
        
        # 构建查询
        query = HostGroup.query.filter_by(tenant_id=g.tenant_id)
        
        # 搜索功能
        if search:
            search_pattern = f'%{search}%'
            query = query.filter(
                db.or_(
                    HostGroup.name.ilike(search_pattern),
                    HostGroup.description.ilike(search_pattern)
                )
            )
        
        if all_groups:
            # 获取所有分组（不分页）
            groups = query.order_by(HostGroup.created_at.desc()).all()
            return jsonify({
                'success': True,
                'data': {
                    'groups': [group.to_dict() for group in groups],
                    'total': len(groups)
                }
            })
        else:
            # 分页查询
            pagination = query.order_by(HostGroup.created_at.desc()).paginate(
                page=page,
                per_page=per_page,
                error_out=False
            )
            
            return jsonify({
                'success': True,
                'data': {
                    'groups': [group.to_dict() for group in pagination.items],
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
        logger.error(f"Get host groups error: {e}")
        return jsonify({
            'success': False,
            'message': f'获取分组列表失败: {str(e)}'
        }), 500


@host_groups_bp.route('/<int:group_id>', methods=['GET'])
@tenant_required
def get_group(group_id):
    """获取单个分组详情"""
    try:
        group = HostGroup.query.filter_by(
            id=group_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not group:
            return jsonify({
                'success': False,
                'message': '分组不存在'
            }), 404
        
        return jsonify({
            'success': True,
            'message': '获取分组详情成功',
            'data': group.to_dict()
        })
        
    except Exception as e:
        logger.error(f"Get host group error: {e}")
        return jsonify({
            'success': False,
            'message': f'获取分组详情失败: {str(e)}'
        }), 500


@host_groups_bp.route('', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def create_group():
    """创建分组"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        # 验证必填字段
        name = data.get('name', '').strip()
        if not name:
            return jsonify({
                'success': False,
                'message': '分组名称不能为空'
            }), 400
        
        # 检查分组名称是否已存在
        existing_group = HostGroup.query.filter_by(
            tenant_id=g.tenant_id,
            name=name
        ).first()
        
        if existing_group:
            return jsonify({
                'success': False,
                'message': '分组名称已存在'
            }), 400
        
        # 创建分组
        group = HostGroup(
            tenant_id=g.tenant_id,
            name=name,
            description=data.get('description', '').strip()
        )
        
        db.session.add(group)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '创建分组成功',
            'data': group.to_dict()
        })
        
    except IntegrityError as e:
        db.session.rollback()
        logger.error(f"Create host group integrity error: {e}")
        return jsonify({
            'success': False,
            'message': '分组名称已存在'
        }), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"Create host group error: {e}")
        return jsonify({
            'success': False,
            'message': f'创建分组失败: {str(e)}'
        }), 500


@host_groups_bp.route('/<int:group_id>/update', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def update_group(group_id):
    """更新分组"""
    try:
        group = HostGroup.query.filter_by(
            id=group_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not group:
            return jsonify({
                'success': False,
                'message': '分组不存在'
            }), 404
        
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        # 更新名称
        if 'name' in data:
            name = data['name'].strip()
            if not name:
                return jsonify({
                    'success': False,
                    'message': '分组名称不能为空'
                }), 400
            
            # 检查名称是否与其他分组重复
            existing_group = HostGroup.query.filter(
                HostGroup.tenant_id == g.tenant_id,
                HostGroup.name == name,
                HostGroup.id != group_id
            ).first()
            
            if existing_group:
                return jsonify({
                    'success': False,
                    'message': '分组名称已存在'
                }), 400
            
            group.name = name
        
        # 更新描述
        if 'description' in data:
            group.description = data['description'].strip() if data['description'] else ''
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '更新分组成功',
            'data': group.to_dict()
        })
        
    except IntegrityError as e:
        db.session.rollback()
        logger.error(f"Update host group integrity error: {e}")
        return jsonify({
            'success': False,
            'message': '分组名称已存在'
        }), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"Update host group error: {e}")
        return jsonify({
            'success': False,
            'message': f'更新分组失败: {str(e)}'
        }), 500


@host_groups_bp.route('/<int:group_id>/delete', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def delete_group(group_id):
    """删除分组"""
    try:
        group = HostGroup.query.filter_by(
            id=group_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not group:
            return jsonify({
                'success': False,
                'message': '分组不存在'
            }), 404
        
        # 将该分组下的主机设置为未分组状态
        SSHHost.query.filter_by(
            tenant_id=g.tenant_id,
            group_id=group_id
        ).update({'group_id': None})
        
        # 删除分组
        db.session.delete(group)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '删除分组成功'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Delete host group error: {e}")
        return jsonify({
            'success': False,
            'message': f'删除分组失败: {str(e)}'
        }), 500


@host_groups_bp.route('/<int:group_id>/hosts', methods=['GET'])
@tenant_required
def get_group_hosts(group_id):
    """获取分组内的主机列表"""
    try:
        group = HostGroup.query.filter_by(
            id=group_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not group:
            return jsonify({
                'success': False,
                'message': '分组不存在'
            }), 404
        
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        # 限制每页数量
        per_page = min(per_page, 100)
        
        # 分页查询分组内的主机
        pagination = SSHHost.query.filter_by(
            tenant_id=g.tenant_id,
            group_id=group_id
        ).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        return jsonify({
            'success': True,
            'data': {
                'group': group.to_dict(),
                'hosts': [host.to_dict(include_sensitive=False) for host in pagination.items],
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
        logger.error(f"Get group hosts error: {e}")
        return jsonify({
            'success': False,
            'message': f'获取分组主机列表失败: {str(e)}'
        }), 500
