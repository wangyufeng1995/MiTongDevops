"""
Ansible 管理 API
提供 Ansible Playbook 和执行管理的 REST API 接口
"""
from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
import logging
import json
import time

from app.extensions import db
from app.models.ansible import AnsiblePlaybook, PlaybookExecution
from app.models.host import SSHHost
from app.core.middleware import tenant_required
from app.services.ansible_service import ansible_service
from app.services.operation_log_service import OperationLogService

logger = logging.getLogger(__name__)

ansible_bp = Blueprint('ansible', __name__, url_prefix='/api/ansible')


@ansible_bp.route('/playbooks', methods=['POST'])
@jwt_required()
@tenant_required
def create_playbook():
    """创建 Playbook"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        user_id = int(current_user_id)
        
        # 获取请求数据
        data = request.get_json()
        if not data:
            return jsonify({
                'code': 400,
                'message': '请求数据不能为空'
            }), 400
        
        # 验证必需字段
        required_fields = ['name', 'content']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'code': 400,
                    'message': f'缺少必需字段: {field}'
                }), 400
        
        # 验证 YAML 内容
        try:
            import yaml
            yaml.safe_load(data['content'])
        except yaml.YAMLError as e:
            return jsonify({
                'code': 400,
                'message': f'YAML 格式错误: {str(e)}'
            }), 400
        
        # 检查名称是否重复
        existing_playbook = AnsiblePlaybook.query_by_tenant(tenant_id).filter_by(name=data['name']).first()
        if existing_playbook:
            return jsonify({
                'code': 400,
                'message': 'Playbook 名称已存在'
            }), 400
        
        # 创建 Playbook
        playbook = AnsiblePlaybook(
            tenant_id=tenant_id,
            name=data['name'],
            description=data.get('description', ''),
            content=data['content'],
            variables=data.get('variables', {}),
            version=data.get('version', '1.0'),
            tags=data.get('tags', []),
            category=data.get('category', ''),
            is_active=data.get('is_active', True),
            created_by=user_id
        )
        
        db.session.add(playbook)
        db.session.commit()
        
        # 记录操作日志
        OperationLogService.log_operation(
            user_id=user_id,
            action='create',
            resource='ansible_playbook',
            resource_id=playbook.id,
            details={
                'name': playbook.name,
                'version': playbook.version,
                'category': playbook.category
            }
        )
        
        return jsonify({
            'code': 200,
            'message': '创建成功',
            'data': playbook.to_dict(include_content=False, include_stats=False)
        })
        
    except Exception as e:
        logger.error(f"创建 Playbook 失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'创建失败: {str(e)}'
        }), 500


@ansible_bp.route('/playbooks/<int:playbook_id>/history', methods=['GET'])
@jwt_required()
@tenant_required
def get_playbook_history(playbook_id):
    """获取 Playbook 历史版本"""
    try:
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        
        # 获取 Playbook
        playbook = AnsiblePlaybook.query_by_tenant(tenant_id).filter_by(id=playbook_id).first()
        if not playbook:
            return jsonify({
                'code': 404,
                'message': 'Playbook 不存在'
            }), 404
        
        # 获取历史版本
        history_versions = playbook.get_history_versions()
        
        return jsonify({
            'code': 200,
            'data': {
                'current': {
                    'id': playbook.id,
                    'name': playbook.name,
                    'version': playbook.version,
                    'updated_at': playbook.updated_at.isoformat() if playbook.updated_at else None
                },
                'history': [{
                    'id': v.id,
                    'version': v.version,
                    'created_at': v.created_at.isoformat() if v.created_at else None,
                    'content': v.content
                } for v in history_versions]
            }
        })
        
    except Exception as e:
        logger.error(f"获取 Playbook 历史版本失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'获取失败: {str(e)}'
        }), 500


@ansible_bp.route('/playbooks/versions', methods=['GET'])
@jwt_required()
@tenant_required
def get_all_playbook_versions():
    """获取所有 Playbook 的版本历史"""
    try:
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        
        # 获取所有非历史版本的 Playbook
        playbooks = AnsiblePlaybook.query_by_tenant(tenant_id).filter(
            db.or_(AnsiblePlaybook.is_history == False, AnsiblePlaybook.is_history == None)
        ).order_by(AnsiblePlaybook.updated_at.desc()).all()
        
        result = []
        for playbook in playbooks:
            history_versions = playbook.get_history_versions()
            result.append({
                'id': playbook.id,
                'name': playbook.name,
                'version': playbook.version,
                'updated_at': playbook.updated_at.isoformat() if playbook.updated_at else None,
                'creator': {
                    'username': playbook.creator.username,
                    'full_name': playbook.creator.full_name
                } if playbook.creator else None,
                'history': [{
                    'id': v.id,
                    'version': v.version,
                    'created_at': v.created_at.isoformat() if v.created_at else None,
                    'content': v.content
                } for v in history_versions]
            })
        
        return jsonify({
            'code': 200,
            'data': result
        })
        
    except Exception as e:
        logger.error(f"获取所有 Playbook 版本历史失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'获取失败: {str(e)}'
        }), 500


@ansible_bp.route('/playbooks/<int:playbook_id>/restore/<int:version_id>', methods=['POST'])
@jwt_required()
@tenant_required
def restore_playbook_version(playbook_id, version_id):
    """恢复 Playbook 到指定版本"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        user_id = int(current_user_id)
        
        # 获取当前 Playbook
        playbook = AnsiblePlaybook.query_by_tenant(tenant_id).filter_by(id=playbook_id).first()
        if not playbook:
            return jsonify({
                'code': 404,
                'message': 'Playbook 不存在'
            }), 404
        
        # 获取要恢复的版本
        version = AnsiblePlaybook.query_by_tenant(tenant_id).filter_by(
            id=version_id, 
            parent_id=playbook_id,
            is_history=True
        ).first()
        if not version:
            return jsonify({
                'code': 404,
                'message': '历史版本不存在'
            }), 404
        
        # 保存当前版本为历史
        version_copy = playbook.create_version_copy()
        db.session.add(version_copy)
        
        # 恢复内容
        playbook.content = version.content
        playbook.increment_version()
        
        # 清理旧版本
        playbook.cleanup_old_versions(keep_count=5)
        
        db.session.commit()
        
        # 记录操作日志
        OperationLogService.log_operation(
            user_id=user_id,
            action='restore_version',
            resource='ansible_playbook',
            resource_id=playbook_id,
            details={
                'restored_version': version.version,
                'new_version': playbook.version
            }
        )
        
        return jsonify({
            'code': 200,
            'message': f'已恢复到版本 v{version.version}'
        })
        
    except Exception as e:
        logger.error(f"恢复 Playbook 版本失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'恢复失败: {str(e)}'
        }), 500


@ansible_bp.route('/playbooks/<int:playbook_id>', methods=['PUT'])
@jwt_required()
@tenant_required
def update_playbook(playbook_id):
    """更新 Playbook"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        user_id = int(current_user_id)
        
        # 获取 Playbook
        playbook = AnsiblePlaybook.query_by_tenant(tenant_id).filter_by(id=playbook_id).first()
        if not playbook:
            return jsonify({
                'code': 404,
                'message': 'Playbook 不存在'
            }), 404
        
        # 获取请求数据
        data = request.get_json()
        if not data:
            return jsonify({
                'code': 400,
                'message': '请求数据不能为空'
            }), 400
        
        # 验证 YAML 内容（如果提供）
        if 'content' in data:
            try:
                import yaml
                yaml.safe_load(data['content'])
            except yaml.YAMLError as e:
                return jsonify({
                    'code': 400,
                    'message': f'YAML 格式错误: {str(e)}'
                }), 400
        
        # 检查名称是否重复（如果修改了名称）
        if 'name' in data and data['name'] != playbook.name:
            existing_playbook = AnsiblePlaybook.query_by_tenant(tenant_id).filter_by(name=data['name']).first()
            if existing_playbook:
                return jsonify({
                    'code': 400,
                    'message': 'Playbook 名称已存在'
                }), 400
        
        # 创建版本副本（如果内容发生变化）
        if 'content' in data and data['content'] != playbook.content:
            version_copy = playbook.create_version_copy()
            db.session.add(version_copy)
            playbook.increment_version()
            # 清理旧版本，只保留最近5个
            playbook.cleanup_old_versions(keep_count=5)
        
        # 更新字段
        updatable_fields = ['name', 'description', 'content', 'variables', 'tags', 'category', 'is_active']
        updated_fields = {}
        
        for field in updatable_fields:
            if field in data:
                old_value = getattr(playbook, field)
                new_value = data[field]
                if old_value != new_value:
                    setattr(playbook, field, new_value)
                    updated_fields[field] = {'old': old_value, 'new': new_value}
        
        if updated_fields:
            db.session.commit()
            
            # 记录操作日志
            OperationLogService.log_operation(
                user_id=user_id,
                action='update',
                resource='ansible_playbook',
                resource_id=playbook.id,
                details={
                    'updated_fields': updated_fields,
                    'new_version': playbook.version
                }
            )
            
            return jsonify({
                'code': 200,
                'message': '更新成功',
                'data': playbook.to_dict(include_content=False, include_stats=False)
            })
        else:
            return jsonify({
                'code': 200,
                'message': '没有需要更新的内容',
                'data': playbook.to_dict(include_content=False, include_stats=False)
            })
        
    except Exception as e:
        logger.error(f"更新 Playbook 失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'更新失败: {str(e)}'
        }), 500


@ansible_bp.route('/playbooks/<int:playbook_id>/toggle-active', methods=['POST'])
@jwt_required()
@tenant_required
def toggle_playbook_active(playbook_id):
    """切换 Playbook 激活状态"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        user_id = int(current_user_id)
        
        data = request.get_json()
        is_active = data.get('is_active', True)
        
        # 获取 Playbook
        playbook = AnsiblePlaybook.query_by_tenant(tenant_id).filter_by(id=playbook_id).first()
        if not playbook:
            return jsonify({
                'code': 404,
                'message': 'Playbook 不存在'
            }), 404
        
        # 更新状态
        playbook.is_active = is_active
        db.session.commit()
        
        # 记录操作日志
        OperationLogService.log_operation(
            user_id=user_id,
            action='toggle_active',
            resource='ansible_playbook',
            resource_id=playbook_id,
            details={'is_active': is_active}
        )
        
        return jsonify({
            'code': 200,
            'message': f'Playbook 已{"激活" if is_active else "停用"}'
        })
        
    except Exception as e:
        logger.error(f"切换 Playbook 状态失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'操作失败: {str(e)}'
        }), 500


@ansible_bp.route('/playbooks/<int:playbook_id>/delete', methods=['POST'])
@jwt_required()
@tenant_required
def delete_playbook(playbook_id):
    """删除 Playbook"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        user_id = int(current_user_id)
        
        # 获取 Playbook
        playbook = AnsiblePlaybook.query_by_tenant(tenant_id).filter_by(id=playbook_id).first()
        if not playbook:
            return jsonify({
                'code': 404,
                'message': 'Playbook 不存在'
            }), 404
        
        # 检查是否有正在运行的执行
        running_executions = PlaybookExecution.query_by_tenant(tenant_id).filter(
            PlaybookExecution.playbook_id == playbook_id,
            PlaybookExecution.status.in_(['pending', 'running'])
        ).count()
        
        if running_executions > 0:
            return jsonify({
                'code': 400,
                'message': f'无法删除，该 Playbook 有 {running_executions} 个正在执行的任务'
            }), 400
        
        # 记录删除信息
        playbook_info = {
            'name': playbook.name,
            'version': playbook.version,
            'category': playbook.category,
            'execution_count': playbook.executions.count()
        }
        
        # 删除 Playbook（级联删除执行记录）
        db.session.delete(playbook)
        db.session.commit()
        
        # 记录操作日志
        OperationLogService.log_operation(
            user_id=user_id,
            action='delete',
            resource='ansible_playbook',
            resource_id=playbook_id,
            details=playbook_info
        )
        
        return jsonify({
            'code': 200,
            'message': '删除成功'
        })
        
    except Exception as e:
        logger.error(f"删除 Playbook 失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'删除失败: {str(e)}'
        }), 500


@ansible_bp.route('/playbooks/<int:playbook_id>/copy', methods=['POST'])
@jwt_required()
@tenant_required
def copy_playbook(playbook_id):
    """复制 Playbook"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        user_id = int(current_user_id)
        
        # 获取原 Playbook
        original_playbook = AnsiblePlaybook.query_by_tenant(tenant_id).filter_by(id=playbook_id).first()
        if not original_playbook:
            return jsonify({
                'code': 404,
                'message': 'Playbook 不存在'
            }), 404
        
        # 获取请求数据
        data = request.get_json() or {}
        
        # 生成新名称
        new_name = data.get('name', f"{original_playbook.name}_copy")
        
        # 检查名称是否重复
        counter = 1
        base_name = new_name
        while AnsiblePlaybook.query_by_tenant(tenant_id).filter_by(name=new_name).first():
            new_name = f"{base_name}_{counter}"
            counter += 1
        
        # 创建副本
        new_playbook = AnsiblePlaybook(
            tenant_id=tenant_id,
            name=new_name,
            description=data.get('description', f"复制自 {original_playbook.name}"),
            content=original_playbook.content,
            variables=original_playbook.variables.copy() if original_playbook.variables else {},
            version='1.0',  # 新版本从 1.0 开始
            tags=original_playbook.tags.copy() if original_playbook.tags else [],
            category=original_playbook.category,
            is_active=data.get('is_active', True),
            created_by=user_id
        )
        
        db.session.add(new_playbook)
        db.session.commit()
        
        # 记录操作日志
        OperationLogService.log_operation(
            user_id=user_id,
            action='copy',
            resource='ansible_playbook',
            resource_id=new_playbook.id,
            details={
                'original_playbook_id': playbook_id,
                'original_name': original_playbook.name,
                'new_name': new_playbook.name
            }
        )
        
        return jsonify({
            'code': 200,
            'message': '复制成功',
            'data': new_playbook.to_dict(include_content=False, include_stats=False)
        })
        
    except Exception as e:
        logger.error(f"复制 Playbook 失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'复制失败: {str(e)}'
        }), 500


@ansible_bp.route('/playbooks/categories', methods=['GET'])
@jwt_required()
@tenant_required
def get_playbook_categories():
    """获取 Playbook 分类列表"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        
        # 查询所有不为空的分类
        categories = db.session.query(AnsiblePlaybook.category).filter(
            AnsiblePlaybook.tenant_id == tenant_id,
            AnsiblePlaybook.category.isnot(None),
            AnsiblePlaybook.category != ''
        ).distinct().all()
        
        category_list = [cat[0] for cat in categories if cat[0]]
        
        return jsonify({
            'code': 200,
            'message': '获取成功',
            'data': {
                'categories': sorted(category_list)
            }
        })
        
    except Exception as e:
        logger.error(f"获取 Playbook 分类失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'获取失败: {str(e)}'
        }), 500


@ansible_bp.route('/playbooks/validate', methods=['POST', 'OPTIONS'])
@jwt_required(optional=True)
def validate_playbook_content():
    """验证 Playbook 内容（不需要 ID）"""
    # 处理 OPTIONS 预检请求
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        data = request.get_json()
        content = data.get('content', '')
        
        if not content:
            return jsonify({
                'code': 400,
                'message': '内容不能为空',
                'data': {'valid': False, 'errors': ['内容不能为空']}
            }), 400
        
        # 验证 YAML 格式
        import yaml
        try:
            playbook_data = yaml.safe_load(content)
            
            errors = []
            
            # 检查是否为列表格式
            if not isinstance(playbook_data, list):
                errors.append('Playbook 必须是一个列表（以 - 开头）')
            elif len(playbook_data) == 0:
                errors.append('Playbook 不能为空')
            else:
                # 检查每个 play
                for i, play in enumerate(playbook_data):
                    if not isinstance(play, dict):
                        errors.append(f'Play {i+1} 必须是一个字典')
                        continue
                    
                    # 检查必要字段
                    if 'hosts' not in play:
                        errors.append(f'Play {i+1} 缺少 hosts 字段')
                    
                    if 'tasks' not in play and 'roles' not in play:
                        errors.append(f'Play {i+1} 缺少 tasks 或 roles 字段')
            
            if errors:
                return jsonify({
                    'code': 200,
                    'data': {'valid': False, 'errors': errors}
                })
            
            return jsonify({
                'code': 200,
                'data': {'valid': True, 'errors': []}
            })
            
        except yaml.YAMLError as e:
            return jsonify({
                'code': 200,
                'data': {'valid': False, 'errors': [f'YAML 格式错误: {str(e)}']}
            })
        
    except Exception as e:
        logger.error(f"验证 Playbook 内容失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'验证失败: {str(e)}'
        }), 500


@ansible_bp.route('/playbooks/<int:playbook_id>/validate', methods=['POST'])
@jwt_required()
@tenant_required
def validate_playbook(playbook_id):
    """验证 Playbook"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        
        # 获取 Playbook
        playbook = AnsiblePlaybook.query_by_tenant(tenant_id).filter_by(id=playbook_id).first()
        if not playbook:
            return jsonify({
                'code': 404,
                'message': 'Playbook 不存在'
            }), 404
        
        # 验证 YAML 格式
        is_valid, message = playbook.validate_yaml_content()
        
        if is_valid:
            # 获取任务列表和变量
            tasks = playbook.get_playbook_tasks()
            required_variables = playbook.get_required_variables()
            
            return jsonify({
                'code': 200,
                'message': '验证成功',
                'data': {
                    'is_valid': True,
                    'message': message,
                    'task_count': len(tasks),
                    'required_variables': required_variables,
                    'tasks': tasks[:5]  # 只返回前5个任务作为预览
                }
            })
        else:
            return jsonify({
                'code': 400,
                'message': '验证失败',
                'data': {
                    'is_valid': False,
                    'message': message
                }
            })
        
    except Exception as e:
        logger.error(f"验证 Playbook 失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'验证失败: {str(e)}'
        }), 500


@ansible_bp.route('/playbooks', methods=['GET'])
@jwt_required()
@tenant_required
def get_playbooks():
    """获取 Playbook 列表"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '')
        category = request.args.get('category', '')
        is_active = request.args.get('is_active', '')
        
        # 构建查询
        query = AnsiblePlaybook.query_by_tenant(tenant_id)
        
        # 排除历史版本
        query = query.filter(
            db.or_(AnsiblePlaybook.is_history == False, AnsiblePlaybook.is_history == None)
        )
        
        # 搜索过滤
        if search:
            query = query.filter(
                AnsiblePlaybook.name.ilike(f'%{search}%') |
                AnsiblePlaybook.description.ilike(f'%{search}%')
            )
        
        # 分类过滤
        if category:
            query = query.filter(AnsiblePlaybook.category == category)
        
        # 状态过滤
        if is_active:
            active_value = is_active.lower() == 'true'
            query = query.filter(AnsiblePlaybook.is_active == active_value)
        
        # 排序
        query = query.order_by(AnsiblePlaybook.updated_at.desc())
        
        # 分页
        pagination = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        playbooks = [
            playbook.to_dict(include_content=False, include_stats=True)
            for playbook in pagination.items
        ]
        
        return jsonify({
            'code': 200,
            'message': '获取成功',
            'data': {
                'playbooks': playbooks,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': pagination.total,
                    'pages': pagination.pages,
                    'has_prev': pagination.has_prev,
                    'has_next': pagination.has_next
                }
            }
        })
        
    except Exception as e:
        logger.error(f"获取 Playbook 列表失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'获取失败: {str(e)}'
        }), 500


@ansible_bp.route('/playbooks/<int:playbook_id>', methods=['GET'])
@jwt_required()
@tenant_required
def get_playbook(playbook_id):
    """获取 Playbook 详情"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        
        playbook = AnsiblePlaybook.query_by_tenant(tenant_id).filter_by(id=playbook_id).first()
        if not playbook:
            return jsonify({
                'code': 404,
                'message': 'Playbook 不存在'
            }), 404
        
        return jsonify({
            'code': 200,
            'message': '获取成功',
            'data': playbook.to_dict(include_content=True, include_stats=True)
        })
        
    except Exception as e:
        logger.error(f"获取 Playbook 详情失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'获取失败: {str(e)}'
        }), 500


@ansible_bp.route('/playbooks/statistics', methods=['GET'])
@jwt_required()
@tenant_required
def get_playbook_statistics():
    """获取 Playbook 统计信息"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        
        # 获取总 Playbook 数量（排除历史版本）
        total_playbooks = AnsiblePlaybook.query_by_tenant(tenant_id).filter(
            db.or_(AnsiblePlaybook.is_history == False, AnsiblePlaybook.is_history == None)
        ).count()
        
        # 获取总执行次数
        total_executions = PlaybookExecution.query_by_tenant(tenant_id).count()
        
        # 计算成功率
        success_executions = PlaybookExecution.query_by_tenant(tenant_id).filter_by(status='success').count()
        success_rate = round((success_executions / total_executions * 100) if total_executions > 0 else 0, 2)
        
        # 获取最常用的 Playbook（按执行次数排序，排除历史版本）
        most_used_playbooks = db.session.query(
            AnsiblePlaybook.id,
            AnsiblePlaybook.name,
            db.func.count(PlaybookExecution.id).label('execution_count')
        ).join(
            PlaybookExecution, AnsiblePlaybook.id == PlaybookExecution.playbook_id
        ).filter(
            AnsiblePlaybook.tenant_id == tenant_id,
            db.or_(AnsiblePlaybook.is_history == False, AnsiblePlaybook.is_history == None)
        ).group_by(
            AnsiblePlaybook.id, AnsiblePlaybook.name
        ).order_by(
            db.func.count(PlaybookExecution.id).desc()
        ).limit(5).all()
        
        # 获取最近的执行记录
        recent_executions = PlaybookExecution.query_by_tenant(tenant_id).order_by(
            PlaybookExecution.created_at.desc()
        ).limit(10).all()
        
        return jsonify({
            'success': True,
            'data': {
                'total_playbooks': total_playbooks,
                'total_executions': total_executions,
                'success_rate': success_rate,
                'most_used_playbooks': [
                    {
                        'id': playbook.id,
                        'name': playbook.name,
                        'execution_count': playbook.execution_count
                    }
                    for playbook in most_used_playbooks
                ],
                'recent_executions': [execution.to_dict() for execution in recent_executions]
            }
        })
        
    except Exception as e:
        logger.error(f"获取 Playbook 统计信息失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'获取失败: {str(e)}'
        }), 500


@ansible_bp.route('/playbooks/<int:playbook_id>/execute', methods=['POST'])
@jwt_required()
@tenant_required
def execute_playbook(playbook_id):
    """执行 Playbook"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        user_id = int(current_user_id)
        
        # 获取请求数据
        data = request.get_json()
        host_ids = data.get('host_ids', [])
        variables = data.get('variables', {})
        
        if not host_ids:
            return jsonify({
                'code': 400,
                'message': '请选择目标主机'
            }), 400
        
        # 验证 Playbook 是否存在
        playbook = AnsiblePlaybook.query_by_tenant(tenant_id).filter_by(id=playbook_id).first()
        if not playbook:
            return jsonify({
                'code': 404,
                'message': 'Playbook 不存在'
            }), 404
        
        if not playbook.is_active:
            return jsonify({
                'code': 400,
                'message': 'Playbook 未激活，无法执行'
            }), 400
        
        # 验证主机是否存在
        hosts = SSHHost.query_by_tenant(tenant_id).filter(SSHHost.id.in_(host_ids)).all()
        if len(hosts) != len(host_ids):
            return jsonify({
                'code': 400,
                'message': '部分主机不存在或无权限访问'
            }), 400
        
        # 创建执行记录
        execution = PlaybookExecution(
            tenant_id=tenant_id,
            playbook_id=playbook_id,
            host_ids=host_ids,
            variables=variables,
            created_by=user_id
        )
        
        db.session.add(execution)
        db.session.commit()
        
        # 启动执行
        success = ansible_service.execute_by_id(execution.id)
        
        # 重新获取执行记录以获取最新状态
        db.session.refresh(execution)
        
        # 记录操作日志
        OperationLogService.log_operation(
            user_id=user_id,
            action='execute',
            resource='ansible_playbook',
            resource_id=playbook_id,
            details={
                'execution_id': execution.id,
                'host_ids': host_ids,
                'variables': variables,
                'success': success
            }
        )
        
        return jsonify({
            'code': 200,
            'message': '执行成功' if success else '执行失败',
            'data': {
                'id': execution.id,
                'execution_id': execution.execution_id,
                'status': execution.status,
                'output': execution.output,
                'error_message': execution.error_message
            }
        })
        
    except Exception as e:
        logger.error(f"执行 Playbook 失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'执行失败: {str(e)}'
        }), 500


@ansible_bp.route('/executions/<int:execution_id>/stream', methods=['GET'])
def stream_execution_logs(execution_id):
    """SSE 实时日志流"""
    def generate():
        last_output_len = 0
        max_wait = 300  # 最大等待5分钟
        waited = 0
        
        while waited < max_wait:
            try:
                # 刷新数据库会话以获取最新数据
                db.session.expire_all()
                execution = PlaybookExecution.query.get(execution_id)
                if not execution:
                    yield f"data: {json.dumps({'type': 'error', 'message': '执行记录不存在'})}\n\n"
                    break
                
                # 发送状态更新
                current_output = execution.output or ''
                if len(current_output) > last_output_len:
                    new_content = current_output[last_output_len:]
                    last_output_len = len(current_output)
                    yield f"data: {json.dumps({'type': 'log', 'content': new_content})}\n\n"
                
                # 发送状态
                yield f"data: {json.dumps({'type': 'status', 'status': execution.status, 'progress': execution.progress or 0})}\n\n"
                
                # 检查是否完成
                if execution.status in ['success', 'failed', 'cancelled']:
                    yield f"data: {json.dumps({'type': 'complete', 'status': execution.status, 'output': execution.output, 'error': execution.error_message})}\n\n"
                    break
                
                time.sleep(1)
                waited += 1
                
            except Exception as e:
                logger.error(f"SSE stream error: {str(e)}")
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                break
        
        yield f"data: {json.dumps({'type': 'end'})}\n\n"
    
    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no'
        }
    )


@ansible_bp.route('/executions', methods=['GET'])
@jwt_required()
@tenant_required
def get_executions():
    """获取执行记录列表"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        playbook_id = request.args.get('playbook_id', type=int)
        status = request.args.get('status', '')
        
        # 构建查询
        query = PlaybookExecution.query_by_tenant(tenant_id)
        
        # Playbook 过滤
        if playbook_id:
            query = query.filter(PlaybookExecution.playbook_id == playbook_id)
        
        # 状态过滤
        if status:
            query = query.filter(PlaybookExecution.status == status)
        
        # 排序
        query = query.order_by(PlaybookExecution.created_at.desc())
        
        # 分页
        pagination = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        executions = [
            execution.to_dict(include_output=False, include_hosts=True)
            for execution in pagination.items
        ]
        
        return jsonify({
            'code': 200,
            'message': '获取成功',
            'data': {
                'executions': executions,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': pagination.total,
                    'pages': pagination.pages,
                    'has_prev': pagination.has_prev,
                    'has_next': pagination.has_next
                }
            }
        })
        
    except Exception as e:
        logger.error(f"获取执行记录列表失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'获取失败: {str(e)}'
        }), 500


@ansible_bp.route('/executions/<int:execution_id>', methods=['GET'])
@jwt_required()
@tenant_required
def get_execution(execution_id):
    """获取执行记录详情"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        
        execution = PlaybookExecution.query_by_tenant(tenant_id).filter_by(id=execution_id).first()
        if not execution:
            return jsonify({
                'code': 404,
                'message': '执行记录不存在'
            }), 404
        
        return jsonify({
            'code': 200,
            'message': '获取成功',
            'data': execution.to_dict(include_output=True, include_hosts=True)
        })
        
    except Exception as e:
        logger.error(f"获取执行记录详情失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'获取失败: {str(e)}'
        }), 500


@ansible_bp.route('/executions/<execution_uuid>/cancel', methods=['POST'])
@jwt_required()
@tenant_required
def cancel_execution(execution_uuid):
    """取消执行"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        user_id = int(current_user_id)
        
        # 获取执行记录
        execution = PlaybookExecution.query_by_tenant(tenant_id).filter_by(execution_id=execution_uuid).first()
        if not execution:
            # 也尝试通过 ID 查找
            try:
                exec_id = int(execution_uuid)
                execution = PlaybookExecution.query_by_tenant(tenant_id).filter_by(id=exec_id).first()
            except ValueError:
                pass
        
        if not execution:
            return jsonify({
                'code': 404,
                'message': '执行记录不存在'
            }), 404
        
        # 强制取消执行
        execution.cancel_execution("用户取消")
        db.session.commit()
        
        # 记录操作日志
        OperationLogService.log_operation(
            user_id=user_id,
            action='cancel',
            resource='ansible_execution',
            resource_id=execution.id,
            details={'reason': '用户取消'}
        )
        
        return jsonify({
            'code': 200,
            'message': '执行已取消'
        })
        
    except Exception as e:
        logger.error(f"取消执行失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'取消失败: {str(e)}'
        }), 500


@ansible_bp.route('/executions/force-stop-all', methods=['POST'])
@jwt_required()
@tenant_required
def force_stop_all_executions():
    """强制停止所有运行中的执行"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        user_id = int(current_user_id)
        
        # 获取所有运行中的执行
        running_executions = PlaybookExecution.query_by_tenant(tenant_id).filter(
            PlaybookExecution.status.in_(['pending', 'running'])
        ).all()
        
        stopped_count = 0
        for execution in running_executions:
            execution.cancel_execution("管理员强制停止")
            stopped_count += 1
        
        db.session.commit()
        
        # 记录操作日志
        OperationLogService.log_operation(
            user_id=user_id,
            action='force_stop_all',
            resource='ansible_execution',
            resource_id=0,
            details={'stopped_count': stopped_count}
        )
        
        logger.info(f"强制停止了 {stopped_count} 个执行任务")
        
        return jsonify({
            'code': 200,
            'message': f'已停止 {stopped_count} 个执行任务',
            'data': {'stopped_count': stopped_count}
        })
        
    except Exception as e:
        logger.error(f"强制停止所有执行失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'停止失败: {str(e)}'
        }), 500


@ansible_bp.route('/executions/<int:execution_id>/delete', methods=['POST'])
@jwt_required()
@tenant_required
def delete_execution(execution_id):
    """删除执行记录"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        user_id = int(current_user_id)
        
        # 获取执行记录
        execution = PlaybookExecution.query_by_tenant(tenant_id).filter_by(id=execution_id).first()
        if not execution:
            return jsonify({
                'code': 404,
                'message': '执行记录不存在'
            }), 404
        
        # 如果正在运行，先取消
        if execution.status in ['pending', 'running']:
            execution.cancel_execution("删除前取消")
        
        # 记录删除信息
        execution_info = {
            'playbook_id': execution.playbook_id,
            'playbook_name': execution.playbook.name if execution.playbook else None,
            'status': execution.status
        }
        
        # 删除执行记录
        db.session.delete(execution)
        db.session.commit()
        
        # 记录操作日志
        OperationLogService.log_operation(
            user_id=user_id,
            action='delete',
            resource='ansible_execution',
            resource_id=execution_id,
            details=execution_info
        )
        
        return jsonify({
            'code': 200,
            'message': '删除成功'
        })
        
    except Exception as e:
        logger.error(f"删除执行记录失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'删除失败: {str(e)}'
        }), 500


@ansible_bp.route('/executions/batch-delete', methods=['POST'])
@jwt_required()
@tenant_required
def batch_delete_executions():
    """批量删除执行记录"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        user_id = int(current_user_id)
        
        data = request.get_json()
        ids = data.get('ids', [])
        
        if not ids:
            return jsonify({
                'code': 400,
                'message': '请选择要删除的执行记录'
            }), 400
        
        # 获取执行记录
        executions = PlaybookExecution.query_by_tenant(tenant_id).filter(
            PlaybookExecution.id.in_(ids)
        ).all()
        
        deleted_count = 0
        for execution in executions:
            # 如果正在运行，先取消
            if execution.status in ['pending', 'running']:
                execution.cancel_execution("批量删除前取消")
            db.session.delete(execution)
            deleted_count += 1
        
        db.session.commit()
        
        # 记录操作日志
        OperationLogService.log_operation(
            user_id=user_id,
            action='batch_delete',
            resource='ansible_execution',
            resource_id=0,
            details={'deleted_ids': ids, 'deleted_count': deleted_count}
        )
        
        logger.info(f"批量删除了 {deleted_count} 条执行记录")
        
        return jsonify({
            'code': 200,
            'message': f'已删除 {deleted_count} 条执行记录',
            'data': {'deleted_count': deleted_count}
        })
        
    except Exception as e:
        logger.error(f"批量删除执行记录失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'删除失败: {str(e)}'
        }), 500


@ansible_bp.route('/executions/<execution_uuid>/status', methods=['GET'])
@jwt_required()
@tenant_required
def get_execution_status(execution_uuid):
    """获取执行状态"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        
        # 验证执行记录是否存在且属于当前租户
        execution = PlaybookExecution.query_by_tenant(tenant_id).filter_by(execution_id=execution_uuid).first()
        if not execution:
            return jsonify({
                'code': 404,
                'message': '执行记录不存在'
            }), 404
        
        # 获取执行状态
        status = ansible_service.get_execution_status(execution_uuid)
        
        if status:
            return jsonify({
                'code': 200,
                'message': '获取成功',
                'data': status
            })
        else:
            return jsonify({
                'code': 404,
                'message': '执行状态不存在'
            }), 404
        
    except Exception as e:
        logger.error(f"获取执行状态失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'获取失败: {str(e)}'
        }), 500


@ansible_bp.route('/service/status', methods=['GET'])
@jwt_required()
@tenant_required
def get_service_status():
    """获取 Ansible 服务状态"""
    try:
        running_executions = ansible_service.get_running_executions()
        
        return jsonify({
            'code': 200,
            'message': '获取成功',
            'data': {
                'running_executions': len(running_executions),
                'max_concurrent_executions': ansible_service.max_concurrent_executions,
                'running_execution_ids': running_executions
            }
        })
        
    except Exception as e:
        logger.error(f"获取服务状态失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'获取失败: {str(e)}'
        }), 500


@ansible_bp.route('/service/cleanup', methods=['POST'])
@jwt_required()
@tenant_required
def cleanup_service():
    """清理已完成的执行记录"""
    try:
        ansible_service.cleanup_finished_executions()
        
        return jsonify({
            'code': 200,
            'message': '清理完成'
        })
        
    except Exception as e:
        logger.error(f"清理服务失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'清理失败: {str(e)}'
        }), 500


@ansible_bp.route('/executions/history', methods=['GET'])
@jwt_required()
@tenant_required
def get_execution_history():
    """获取执行历史记录"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        playbook_id = request.args.get('playbook_id', type=int)
        status = request.args.get('status', '')
        start_date = request.args.get('start_date', '')
        end_date = request.args.get('end_date', '')
        executor_id = request.args.get('executor_id', type=int)
        
        # 构建查询
        query = PlaybookExecution.query_by_tenant(tenant_id)
        
        # Playbook 过滤
        if playbook_id:
            query = query.filter(PlaybookExecution.playbook_id == playbook_id)
        
        # 状态过滤
        if status:
            query = query.filter(PlaybookExecution.status == status)
        
        # 执行者过滤
        if executor_id:
            query = query.filter(PlaybookExecution.created_by == executor_id)
        
        # 日期范围过滤
        if start_date:
            try:
                from datetime import datetime
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(PlaybookExecution.created_at >= start_dt)
            except ValueError:
                return jsonify({
                    'code': 400,
                    'message': '开始日期格式错误'
                }), 400
        
        if end_date:
            try:
                from datetime import datetime
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(PlaybookExecution.created_at <= end_dt)
            except ValueError:
                return jsonify({
                    'code': 400,
                    'message': '结束日期格式错误'
                }), 400
        
        # 排序
        query = query.order_by(PlaybookExecution.created_at.desc())
        
        # 分页
        pagination = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        executions = [
            execution.to_dict(include_output=False, include_hosts=True)
            for execution in pagination.items
        ]
        
        # 获取统计信息
        total_executions = PlaybookExecution.query_by_tenant(tenant_id).count()
        success_executions = PlaybookExecution.query_by_tenant(tenant_id).filter_by(status='success').count()
        failed_executions = PlaybookExecution.query_by_tenant(tenant_id).filter_by(status='failed').count()
        running_executions = PlaybookExecution.query_by_tenant(tenant_id).filter_by(status='running').count()
        
        return jsonify({
            'code': 200,
            'message': '获取成功',
            'data': {
                'executions': executions,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': pagination.total,
                    'pages': pagination.pages,
                    'has_prev': pagination.has_prev,
                    'has_next': pagination.has_next
                },
                'statistics': {
                    'total_executions': total_executions,
                    'success_executions': success_executions,
                    'failed_executions': failed_executions,
                    'running_executions': running_executions,
                    'success_rate': round((success_executions / total_executions * 100) if total_executions > 0 else 0, 2)
                }
            }
        })
        
    except Exception as e:
        logger.error(f"获取执行历史失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'获取失败: {str(e)}'
        }), 500


@ansible_bp.route('/executions/statistics', methods=['GET'])
@jwt_required()
@tenant_required
def get_execution_statistics():
    """获取执行统计信息"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        
        # 获取查询参数
        days = request.args.get('days', 30, type=int)  # 默认最近30天
        
        from datetime import datetime, timedelta
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # 基础查询
        base_query = PlaybookExecution.query_by_tenant(tenant_id).filter(
            PlaybookExecution.created_at >= start_date,
            PlaybookExecution.created_at <= end_date
        )
        
        # 总体统计
        total_executions = base_query.count()
        success_executions = base_query.filter_by(status='success').count()
        failed_executions = base_query.filter_by(status='failed').count()
        cancelled_executions = base_query.filter_by(status='cancelled').count()
        running_executions = base_query.filter_by(status='running').count()
        
        # 按 Playbook 统计
        playbook_stats = db.session.query(
            AnsiblePlaybook.name,
            AnsiblePlaybook.id,
            db.func.count(PlaybookExecution.id).label('execution_count'),
            db.func.sum(db.case([(PlaybookExecution.status == 'success', 1)], else_=0)).label('success_count'),
            db.func.sum(db.case([(PlaybookExecution.status == 'failed', 1)], else_=0)).label('failed_count')
        ).join(
            PlaybookExecution, AnsiblePlaybook.id == PlaybookExecution.playbook_id
        ).filter(
            AnsiblePlaybook.tenant_id == tenant_id,
            PlaybookExecution.created_at >= start_date,
            PlaybookExecution.created_at <= end_date
        ).group_by(
            AnsiblePlaybook.id, AnsiblePlaybook.name
        ).order_by(
            db.func.count(PlaybookExecution.id).desc()
        ).limit(10).all()
        
        # 按日期统计（最近7天）
        daily_stats = []
        for i in range(7):
            day_start = (end_date - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            day_executions = PlaybookExecution.query_by_tenant(tenant_id).filter(
                PlaybookExecution.created_at >= day_start,
                PlaybookExecution.created_at < day_end
            )
            
            daily_stats.append({
                'date': day_start.strftime('%Y-%m-%d'),
                'total': day_executions.count(),
                'success': day_executions.filter_by(status='success').count(),
                'failed': day_executions.filter_by(status='failed').count()
            })
        
        daily_stats.reverse()  # 按时间正序排列
        
        return jsonify({
            'code': 200,
            'message': '获取成功',
            'data': {
                'period': {
                    'days': days,
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                },
                'overall': {
                    'total_executions': total_executions,
                    'success_executions': success_executions,
                    'failed_executions': failed_executions,
                    'cancelled_executions': cancelled_executions,
                    'running_executions': running_executions,
                    'success_rate': round((success_executions / total_executions * 100) if total_executions > 0 else 0, 2)
                },
                'by_playbook': [
                    {
                        'playbook_id': stat.id,
                        'playbook_name': stat.name,
                        'execution_count': stat.execution_count,
                        'success_count': stat.success_count or 0,
                        'failed_count': stat.failed_count or 0,
                        'success_rate': round(((stat.success_count or 0) / stat.execution_count * 100) if stat.execution_count > 0 else 0, 2)
                    }
                    for stat in playbook_stats
                ],
                'daily_trend': daily_stats
            }
        })
        
    except Exception as e:
        logger.error(f"获取执行统计失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'获取失败: {str(e)}'
        }), 500


@ansible_bp.route('/playbooks/<int:playbook_id>/executions', methods=['GET'])
@jwt_required()
@tenant_required
def get_playbook_executions(playbook_id):
    """获取特定 Playbook 的执行记录"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        
        # 验证 Playbook 是否存在
        playbook = AnsiblePlaybook.query_by_tenant(tenant_id).filter_by(id=playbook_id).first()
        if not playbook:
            return jsonify({
                'code': 404,
                'message': 'Playbook 不存在'
            }), 404
        
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        status = request.args.get('status', '')
        
        # 构建查询
        query = PlaybookExecution.query_by_tenant(tenant_id).filter_by(playbook_id=playbook_id)
        
        # 状态过滤
        if status:
            query = query.filter(PlaybookExecution.status == status)
        
        # 排序
        query = query.order_by(PlaybookExecution.created_at.desc())
        
        # 分页
        pagination = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        executions = [
            execution.to_dict(include_output=False, include_hosts=True)
            for execution in pagination.items
        ]
        
        return jsonify({
            'code': 200,
            'message': '获取成功',
            'data': {
                'playbook': playbook.to_dict(include_content=False, include_stats=True),
                'executions': executions,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': pagination.total,
                    'pages': pagination.pages,
                    'has_prev': pagination.has_prev,
                    'has_next': pagination.has_next
                }
            }
        })
        
    except Exception as e:
        logger.error(f"获取 Playbook 执行记录失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'获取失败: {str(e)}'
        }), 500


@ansible_bp.route('/executions/<int:execution_id>/retry', methods=['POST'])
@jwt_required()
@tenant_required
def retry_execution(execution_id):
    """重试执行"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        tenant_id = claims['tenant_id']
        user_id = current_user['user_id']
        
        # 获取原执行记录
        original_execution = PlaybookExecution.query_by_tenant(tenant_id).filter_by(id=execution_id).first()
        if not original_execution:
            return jsonify({
                'code': 404,
                'message': '执行记录不存在'
            }), 404
        
        # 检查是否可以重试
        if original_execution.status in ['pending', 'running']:
            return jsonify({
                'code': 400,
                'message': '该执行正在进行中，无法重试'
            }), 400
        
        # 验证 Playbook 是否仍然存在且激活
        playbook = original_execution.playbook
        if not playbook or not playbook.is_active:
            return jsonify({
                'code': 400,
                'message': 'Playbook 不存在或未激活，无法重试'
            }), 400
        
        # 验证主机是否仍然存在
        hosts = SSHHost.query_by_tenant(tenant_id).filter(SSHHost.id.in_(original_execution.host_ids)).all()
        if len(hosts) != len(original_execution.host_ids):
            return jsonify({
                'code': 400,
                'message': '部分目标主机不存在，无法重试'
            }), 400
        
        # 创建新的执行记录
        new_execution = PlaybookExecution(
            tenant_id=tenant_id,
            playbook_id=original_execution.playbook_id,
            host_ids=original_execution.host_ids,
            variables=original_execution.variables,
            created_by=user_id
        )
        
        db.session.add(new_execution)
        db.session.commit()
        
        # 启动执行
        success = ansible_service.execute_playbook(new_execution.id)
        
        if success:
            # 记录操作日志
            OperationLogService.log_operation(
                user_id=user_id,
                action='retry',
                resource='ansible_execution',
                resource_id=new_execution.id,
                details={
                    'original_execution_id': execution_id,
                    'playbook_id': original_execution.playbook_id,
                    'host_ids': original_execution.host_ids
                }
            )
            
            return jsonify({
                'code': 200,
                'message': '重试执行已启动',
                'data': {
                    'execution_id': new_execution.id,
                    'execution_uuid': new_execution.execution_id,
                    'status': new_execution.status,
                    'original_execution_id': execution_id
                }
            })
        else:
            return jsonify({
                'code': 500,
                'message': '启动重试执行失败'
            }), 500
        
    except Exception as e:
        logger.error(f"重试执行失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'重试失败: {str(e)}'
        }), 500