"""
网络探测管理 API
"""
from flask import Blueprint, request, jsonify, g, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import desc, func, or_
from datetime import datetime
import logging

from app.extensions import db
from app.models.network import NetworkProbeGroup, NetworkProbe
from app.models.user import User
from app.services.network_group_service import NetworkGroupService
from app.core.middleware import tenant_required


logger = logging.getLogger(__name__)
network_bp = Blueprint('network', __name__)


# ==================== Helper Functions ====================

def get_current_tenant_id():
    """获取当前租户ID"""
    return getattr(g, 'tenant_id', None)


def get_current_user_id():
    """获取当前用户ID"""
    return getattr(g, 'user_id', None)


# ==================== Network Probe Group APIs ====================

@network_bp.route('/groups', methods=['GET'])
@tenant_required
@jwt_required()
def get_groups():
    """
    获取网络探测分组列表
    
    Query Parameters:
        - page: 页码（默认1）
        - per_page: 每页数量（默认20）
        - search: 搜索关键词
    
    Returns:
        {
            "success": true,
            "data": {
                "groups": [...],
                "total": 100,
                "page": 1,
                "per_page": 20,
                "statistics": {...}
            }
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return jsonify({
                'success': False,
                'message': '租户信息缺失'
            }), 400
        
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        search = request.args.get('search', '', type=str)
        
        # 限制每页数量
        per_page = min(per_page, 100)
        
        # 获取分组列表
        groups, total = NetworkGroupService.get_group_list(
            tenant_id=tenant_id,
            page=page,
            per_page=per_page,
            search=search if search else None
        )
        
        # 获取统计信息
        statistics = NetworkGroupService.get_group_statistics(tenant_id)
        
        return jsonify({
            'success': True,
            'data': {
                'groups': [group.to_dict() for group in groups],
                'total': total,
                'page': page,
                'per_page': per_page,
                'statistics': statistics
            }
        }), 200
        
    except Exception as e:
        logger.error(f"获取分组列表失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'获取分组列表失败: {str(e)}'
        }), 500


@network_bp.route('/groups/all', methods=['GET'])
@tenant_required
@jwt_required()
def get_all_groups():
    """
    获取所有网络探测分组（不分页）
    
    Returns:
        {
            "success": true,
            "data": [...]
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return jsonify({
                'success': False,
                'message': '租户信息缺失'
            }), 400
        
        # 获取所有分组
        groups = NetworkProbeGroup.query.filter(
            NetworkProbeGroup.tenant_id == tenant_id
        ).order_by(NetworkProbeGroup.sort_order.asc(), NetworkProbeGroup.created_at.desc()).all()
        
        return jsonify({
            'success': True,
            'data': [group.to_dict() for group in groups]
        }), 200
        
    except Exception as e:
        logger.error(f"获取所有分组失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'获取所有分组失败: {str(e)}'
        }), 500


@network_bp.route('/groups/<int:group_id>', methods=['GET'])
@tenant_required
@jwt_required()
def get_group(group_id):
    """
    获取单个分组详情
    
    Args:
        group_id: 分组ID
    
    Returns:
        {
            "success": true,
            "data": {...}
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return jsonify({
                'success': False,
                'message': '租户信息缺失'
            }), 400
        
        # 获取分组
        group = NetworkGroupService.get_group_by_id(group_id, tenant_id)
        if not group:
            return jsonify({
                'success': False,
                'message': '分组不存在'
            }), 404
        
        return jsonify({
            'success': True,
            'data': group.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"获取分组详情失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'获取分组详情失败: {str(e)}'
        }), 500


@network_bp.route('/groups', methods=['POST'])
@tenant_required
@jwt_required()
def create_group():
    """
    创建网络探测分组
    
    Request Body:
        {
            "name": "分组名称",
            "description": "分组描述",
            "color": "#1890ff",
            "sort_order": 0
        }
    
    Returns:
        {
            "success": true,
            "message": "创建成功",
            "data": {...}
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        user_id = get_current_user_id()
        
        if not tenant_id or not user_id:
            return jsonify({
                'success': False,
                'message': '租户或用户信息缺失'
            }), 400
        
        # 获取请求数据
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        # 创建分组
        success, message, group = NetworkGroupService.create_group(
            data=data,
            tenant_id=tenant_id,
            user_id=user_id
        )
        
        if not success:
            return jsonify({
                'success': False,
                'message': message
            }), 400
        
        return jsonify({
            'success': True,
            'message': message,
            'data': group.to_dict()
        }), 201
        
    except Exception as e:
        logger.error(f"创建分组失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'创建分组失败: {str(e)}'
        }), 500


@network_bp.route('/groups/<int:group_id>', methods=['PUT'])
@tenant_required
@jwt_required()
def update_group(group_id):
    """
    更新网络探测分组
    
    Args:
        group_id: 分组ID
    
    Request Body:
        {
            "name": "新分组名称",
            "description": "新描述",
            "color": "#ff0000",
            "sort_order": 1
        }
    
    Returns:
        {
            "success": true,
            "message": "更新成功",
            "data": {...}
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return jsonify({
                'success': False,
                'message': '租户信息缺失'
            }), 400
        
        # 获取请求数据
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        # 更新分组
        success, message, group = NetworkGroupService.update_group(
            group_id=group_id,
            data=data,
            tenant_id=tenant_id
        )
        
        if not success:
            status_code = 404 if message == "分组不存在" else 400
            return jsonify({
                'success': False,
                'message': message
            }), status_code
        
        return jsonify({
            'success': True,
            'message': message,
            'data': group.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"更新分组失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'更新分组失败: {str(e)}'
        }), 500


@network_bp.route('/groups/<int:group_id>/delete', methods=['POST'])
@tenant_required
@jwt_required()
def delete_group(group_id):
    """
    删除网络探测分组
    
    Args:
        group_id: 分组ID
    
    Returns:
        {
            "success": true,
            "message": "删除成功，已将 X 个探测目标移动到默认分组"
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return jsonify({
                'success': False,
                'message': '租户信息缺失'
            }), 400
        
        # 删除分组
        success, message = NetworkGroupService.delete_group(
            group_id=group_id,
            tenant_id=tenant_id
        )
        
        if not success:
            status_code = 404 if message == "分组不存在" else 400
            return jsonify({
                'success': False,
                'message': message
            }), status_code
        
        return jsonify({
            'success': True,
            'message': message
        }), 200
        
    except Exception as e:
        logger.error(f"删除分组失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'删除分组失败: {str(e)}'
        }), 500


@network_bp.route('/groups/statistics', methods=['GET'])
@tenant_required
@jwt_required()
def get_group_statistics():
    """
    获取分组统计信息
    
    Returns:
        {
            "success": true,
            "data": {
                "total_groups": 10,
                "total_probes": 50,
                "ungrouped_count": 5,
                "grouped_count": 45
            }
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return jsonify({
                'success': False,
                'message': '租户信息缺失'
            }), 400
        
        # 获取统计信息
        statistics = NetworkGroupService.get_group_statistics(tenant_id)
        
        return jsonify({
            'success': True,
            'data': statistics
        }), 200
        
    except Exception as e:
        logger.error(f"获取统计信息失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'获取统计信息失败: {str(e)}'
        }), 500


@network_bp.route('/groups/ensure-default', methods=['POST'])
@tenant_required
@jwt_required()
def ensure_default_group():
    """
    确保默认分组存在
    
    Returns:
        {
            "success": true,
            "message": "默认分组已存在" 或 "默认分组创建成功",
            "data": {...}
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        user_id = get_current_user_id()
        
        if not tenant_id or not user_id:
            return jsonify({
                'success': False,
                'message': '租户或用户信息缺失'
            }), 400
        
        # 检查默认分组是否存在
        existing_group = NetworkGroupService.get_default_group(tenant_id)
        
        if existing_group:
            return jsonify({
                'success': True,
                'message': '默认分组已存在',
                'data': existing_group.to_dict()
            }), 200
        
        # 创建默认分组
        default_group = NetworkGroupService.ensure_default_group(tenant_id, user_id)
        
        return jsonify({
            'success': True,
            'message': '默认分组创建成功',
            'data': default_group.to_dict()
        }), 201
        
    except Exception as e:
        logger.error(f"确保默认分组失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'确保默认分组失败: {str(e)}'
        }), 500


# ==================== Network Probe Task APIs ====================

@network_bp.route('/probes', methods=['GET'])
@tenant_required
@jwt_required()
def get_probes():
    """
    获取网络探测任务列表
    
    Query Parameters:
        - page: 页码（默认1）
        - per_page: 每页数量（默认10，最大100）
        - search: 搜索关键词
        - group_id: 按分组筛选
        - protocol: 按协议筛选
        - enabled: 按启用状态筛选
    
    Returns:
        {
            "success": true,
            "data": {
                "probes": [...],
                "total": 100,
                "page": 1,
                "per_page": 10
            }
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return jsonify({
                'success': False,
                'message': '租户信息缺失'
            }), 400
        
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '', type=str)
        group_id = request.args.get('group_id', type=int)
        protocol = request.args.get('protocol', type=str)
        enabled = request.args.get('enabled', type=str)
        
        # 限制每页数量
        per_page = min(per_page, 100)
        
        # 构建查询
        query = NetworkProbe.query.filter(NetworkProbe.tenant_id == tenant_id)
        
        # 按分组筛选
        if group_id:
            query = query.filter(NetworkProbe.group_id == group_id)
        
        # 按协议筛选
        if protocol:
            query = query.filter(NetworkProbe.protocol == protocol)
        
        # 按启用状态筛选
        if enabled:
            enabled_bool = enabled.lower() in ['true', '1', 'yes']
            query = query.filter(NetworkProbe.enabled == enabled_bool)
        
        # 搜索过滤
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    NetworkProbe.name.ilike(search_pattern),
                    NetworkProbe.description.ilike(search_pattern),
                    NetworkProbe.target_url.ilike(search_pattern)
                )
            )
        
        # 排序：按创建时间倒序
        query = query.order_by(NetworkProbe.created_at.desc())
        
        # 分页
        total = query.count()
        probes = query.offset((page - 1) * per_page).limit(per_page).all()
        
        return jsonify({
            'success': True,
            'data': {
                'probes': [probe.to_dict() for probe in probes],
                'total': total,
                'page': page,
                'per_page': per_page
            }
        }), 200
        
    except Exception as e:
        logger.error(f"获取探测任务列表失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'获取探测任务列表失败: {str(e)}'
        }), 500


@network_bp.route('/probes/all', methods=['GET'])
@tenant_required
@jwt_required()
def get_all_probes():
    """
    获取所有网络探测任务（不分页）
    
    Returns:
        {
            "success": true,
            "data": [...]
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return jsonify({
                'success': False,
                'message': '租户信息缺失'
            }), 400
        
        # 获取所有探测任务
        probes = NetworkProbe.query.filter(
            NetworkProbe.tenant_id == tenant_id
        ).order_by(NetworkProbe.created_at.desc()).all()
        
        return jsonify({
            'success': True,
            'data': [probe.to_dict() for probe in probes]
        }), 200
        
    except Exception as e:
        logger.error(f"获取所有探测任务失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'获取所有探测任务失败: {str(e)}'
        }), 500


@network_bp.route('/probes/<int:probe_id>', methods=['GET'])
@tenant_required
@jwt_required()
def get_probe(probe_id):
    """
    获取单个探测任务详情
    
    Args:
        probe_id: 探测任务ID
    
    Returns:
        {
            "success": true,
            "data": {...}
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return jsonify({
                'success': False,
                'message': '租户信息缺失'
            }), 400
        
        # 获取探测任务
        probe = NetworkProbe.query.filter(
            NetworkProbe.id == probe_id,
            NetworkProbe.tenant_id == tenant_id
        ).first()
        
        if not probe:
            return jsonify({
                'success': False,
                'message': '探测任务不存在'
            }), 404
        
        return jsonify({
            'success': True,
            'data': probe.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"获取探测任务详情失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'获取探测任务详情失败: {str(e)}'
        }), 500


@network_bp.route('/probes', methods=['POST'])
@tenant_required
@jwt_required()
def create_probe():
    """
    创建网络探测任务
    
    Request Body:
        {
            "group_id": 1,  # 可选，不提供则分配到默认分组
            "name": "探测任务名称",
            "description": "任务描述",
            "protocol": "http",  # http, https, websocket, tcp, udp
            "target_url": "http://example.com",
            "method": "GET",  # 可选，默认GET
            "headers": {},  # 可选
            "body": "",  # 可选
            "timeout": 30,  # 可选，默认30秒
            "interval_seconds": 60,  # 可选，默认60秒
            "auto_probe_enabled": false,  # 可选，默认false
            "enabled": true  # 可选，默认true
        }
    
    Returns:
        {
            "success": true,
            "message": "创建成功",
            "data": {...}
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        user_id = get_current_user_id()
        
        if not tenant_id or not user_id:
            return jsonify({
                'success': False,
                'message': '租户或用户信息缺失'
            }), 400
        
        # 获取请求数据
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        # 验证必需字段
        required_fields = ['name', 'protocol', 'target_url']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({
                    'success': False,
                    'message': f'缺少必需字段: {field}'
                }), 400
        
        # 验证协议
        valid_protocols = ['http', 'https', 'websocket', 'tcp', 'udp']
        if data['protocol'] not in valid_protocols:
            return jsonify({
                'success': False,
                'message': f'无效的协议类型，支持: {", ".join(valid_protocols)}'
            }), 400
        
        # 处理分组ID
        group_id = data.get('group_id')
        if not group_id:
            # 如果未指定分组，分配到默认分组
            default_group = NetworkGroupService.get_default_group(tenant_id)
            if not default_group:
                default_group = NetworkGroupService.ensure_default_group(tenant_id, user_id)
            group_id = default_group.id
        else:
            # 验证分组是否存在
            group = NetworkGroupService.get_group_by_id(group_id, tenant_id)
            if not group:
                return jsonify({
                    'success': False,
                    'message': '指定的分组不存在'
                }), 400
        
        # 创建探测任务
        probe = NetworkProbe(
            tenant_id=tenant_id,
            group_id=group_id,
            name=data['name'],
            description=data.get('description', ''),
            protocol=data['protocol'],
            target_url=data['target_url'],
            method=data.get('method', 'GET').upper(),
            headers=data.get('headers'),
            body=data.get('body'),
            timeout=data.get('timeout', 30),
            interval_seconds=data.get('interval_seconds', 60),
            auto_probe_enabled=data.get('auto_probe_enabled', False),
            enabled=data.get('enabled', True),
            created_by=user_id
        )
        
        db.session.add(probe)
        db.session.commit()
        
        logger.info(f"创建探测任务成功: {probe.name} (ID: {probe.id})")
        return jsonify({
            'success': True,
            'message': '创建成功',
            'data': probe.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"创建探测任务失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'创建失败: {str(e)}'
        }), 500


@network_bp.route('/probes/<int:probe_id>', methods=['PUT'])
@tenant_required
@jwt_required()
def update_probe(probe_id):
    """
    更新网络探测任务
    
    Args:
        probe_id: 探测任务ID
    
    Request Body:
        {
            "name": "新任务名称",
            "description": "新描述",
            "group_id": 2,
            "target_url": "http://newexample.com",
            ...
        }
    
    Returns:
        {
            "success": true,
            "message": "更新成功",
            "data": {...}
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return jsonify({
                'success': False,
                'message': '租户信息缺失'
            }), 400
        
        # 获取探测任务
        probe = NetworkProbe.query.filter(
            NetworkProbe.id == probe_id,
            NetworkProbe.tenant_id == tenant_id
        ).first()
        
        if not probe:
            return jsonify({
                'success': False,
                'message': '探测任务不存在'
            }), 404
        
        # 获取请求数据
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        # 验证协议（如果提供）
        if 'protocol' in data:
            valid_protocols = ['http', 'https', 'websocket', 'tcp', 'udp']
            if data['protocol'] not in valid_protocols:
                return jsonify({
                    'success': False,
                    'message': f'无效的协议类型，支持: {", ".join(valid_protocols)}'
                }), 400
        
        # 验证分组（如果提供）
        if 'group_id' in data and data['group_id']:
            group = NetworkGroupService.get_group_by_id(data['group_id'], tenant_id)
            if not group:
                return jsonify({
                    'success': False,
                    'message': '指定的分组不存在'
                }), 400
        
        # 更新字段
        updatable_fields = [
            'name', 'description', 'group_id', 'protocol', 'target_url',
            'method', 'headers', 'body', 'timeout', 'interval_seconds',
            'auto_probe_enabled', 'enabled'
        ]
        
        for field in updatable_fields:
            if field in data:
                if field == 'method' and data[field]:
                    setattr(probe, field, data[field].upper())
                else:
                    setattr(probe, field, data[field])
        
        probe.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"更新探测任务成功: {probe.name} (ID: {probe.id})")
        return jsonify({
            'success': True,
            'message': '更新成功',
            'data': probe.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"更新探测任务失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'更新失败: {str(e)}'
        }), 500


@network_bp.route('/probes/<int:probe_id>/delete', methods=['POST'])
@tenant_required
@jwt_required()
def delete_probe(probe_id):
    """
    删除网络探测任务
    
    Args:
        probe_id: 探测任务ID
    
    Returns:
        {
            "success": true,
            "message": "删除成功"
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return jsonify({
                'success': False,
                'message': '租户信息缺失'
            }), 400
        
        # 获取探测任务
        probe = NetworkProbe.query.filter(
            NetworkProbe.id == probe_id,
            NetworkProbe.tenant_id == tenant_id
        ).first()
        
        if not probe:
            return jsonify({
                'success': False,
                'message': '探测任务不存在'
            }), 404
        
        probe_name = probe.name
        
        # 删除探测任务（级联删除相关的结果和告警规则）
        db.session.delete(probe)
        db.session.commit()
        
        logger.info(f"删除探测任务成功: {probe_name} (ID: {probe_id})")
        return jsonify({
            'success': True,
            'message': '删除成功'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"删除探测任务失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'删除失败: {str(e)}'
        }), 500


@network_bp.route('/probes/<int:probe_id>/start', methods=['POST'])
@tenant_required
@jwt_required()
def start_probe(probe_id):
    """
    启动自动探测任务
    
    Args:
        probe_id: 探测任务ID
    
    Returns:
        {
            "success": true,
            "message": "自动探测已启动"
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return jsonify({
                'success': False,
                'message': '租户信息缺失'
            }), 400
        
        # 获取探测任务
        probe = NetworkProbe.query.filter(
            NetworkProbe.id == probe_id,
            NetworkProbe.tenant_id == tenant_id
        ).first()
        
        if not probe:
            return jsonify({
                'success': False,
                'message': '探测任务不存在'
            }), 404
        
        # 启用自动探测
        probe.auto_probe_enabled = True
        probe.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"启动自动探测: {probe.name} (ID: {probe.id}), 间隔: {probe.interval_seconds}秒")
        
        # 立即触发独立的定时调度任务
        try:
            from app.tasks.network_probe_tasks import schedule_single_probe
            schedule_single_probe.apply_async(
                kwargs={
                    'probe_id': probe.id,
                    'tenant_id': tenant_id,
                    'interval_seconds': probe.interval_seconds
                }
            )
        except Exception as e:
            logger.warning(f"触发调度任务失败: {str(e)}")
        
        return jsonify({
            'success': True,
            'message': '自动探测已启动',
            'interval_seconds': probe.interval_seconds
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"启动自动探测失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'启动失败: {str(e)}'
        }), 500


@network_bp.route('/probes/<int:probe_id>/stop', methods=['POST'])
@tenant_required
@jwt_required()
def stop_probe(probe_id):
    """
    停止自动探测任务
    
    Args:
        probe_id: 探测任务ID
    
    Returns:
        {
            "success": true,
            "message": "自动探测已停止"
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return jsonify({
                'success': False,
                'message': '租户信息缺失'
            }), 400
        
        # 获取探测任务
        probe = NetworkProbe.query.filter(
            NetworkProbe.id == probe_id,
            NetworkProbe.tenant_id == tenant_id
        ).first()
        
        if not probe:
            return jsonify({
                'success': False,
                'message': '探测任务不存在'
            }), 404
        
        # 停止自动探测
        probe.auto_probe_enabled = False
        probe.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"停止自动探测: {probe.name} (ID: {probe.id})")
        
        # 清理 Redis 中的调度状态
        try:
            import redis
            from app.core.config_manager import config_manager
            redis_config = config_manager.get_redis_config()
            redis_password = redis_config.get('password', '')
            redis_client = redis.Redis(
                host=redis_config['host'],
                port=redis_config['port'],
                password=redis_password if redis_password else None,
                db=3,
                decode_responses=True
            )
            # 删除调度相关的 key
            redis_client.delete(f"probe_schedule:{probe_id}")
            redis_client.delete(f"probe_last_run:{probe_id}")
            redis_client.delete(f"probe_lock:{probe_id}")
        except Exception as e:
            logger.warning(f"清理调度状态失败: {str(e)}")
        
        return jsonify({
            'success': True,
            'message': '自动探测已停止'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"停止自动探测失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'停止失败: {str(e)}'
        }), 500


@network_bp.route('/probes/<int:probe_id>/probe', methods=['POST'])
@tenant_required
@jwt_required()
def execute_manual_probe(probe_id):
    """
    执行主动探测（立即执行）
    
    Args:
        probe_id: 探测任务ID
    
    Returns:
        {
            "success": true,
            "message": "探测任务已提交",
            "data": {
                "result": {...}  # 探测结果
            }
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return jsonify({
                'success': False,
                'message': '租户信息缺失'
            }), 400
        
        # 获取探测任务
        probe = NetworkProbe.query.filter(
            NetworkProbe.id == probe_id,
            NetworkProbe.tenant_id == tenant_id
        ).first()
        
        if not probe:
            return jsonify({
                'success': False,
                'message': '探测任务不存在'
            }), 404
        
        if not probe.enabled:
            return jsonify({
                'success': False,
                'message': '探测任务已禁用'
            }), 400
        
        # 导入探测服务
        from app.services.network_probe_service import network_probe_service
        
        # 根据协议类型执行相应的探测
        logger.info(f"执行主动探测: {probe.name} (ID: {probe.id}), 协议: {probe.protocol}")
        
        if probe.protocol in ['http', 'https']:
            result = network_probe_service.execute_http_probe(probe, probe_type='manual')
        elif probe.protocol == 'websocket':
            result = network_probe_service.execute_websocket_probe(probe, probe_type='manual')
        elif probe.protocol == 'tcp':
            result = network_probe_service.execute_tcp_probe(probe, probe_type='manual')
        elif probe.protocol == 'udp':
            result = network_probe_service.execute_udp_probe(probe, probe_type='manual')
        else:
            return jsonify({
                'success': False,
                'message': f'不支持的协议类型: {probe.protocol}'
            }), 400
        
        logger.info(f"主动探测完成: {probe.name}, 状态: {result.status}")
        
        return jsonify({
            'success': True,
            'message': '探测完成',
            'data': {
                'result': result.to_dict()
            }
        }), 200
        
    except Exception as e:
        logger.error(f"执行主动探测失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'探测失败: {str(e)}'
        }), 500


# ==================== Network Probe Result APIs ====================

@network_bp.route('/probes/<int:probe_id>/results', methods=['GET'])
@tenant_required
@jwt_required()
def get_probe_results(probe_id):
    """
    获取探测结果列表（支持分页，limit=10）
    
    Args:
        probe_id: 探测任务ID
    
    Query Parameters:
        - page: 页码（默认1）
        - limit: 每页数量（默认10，最大100）
        - probe_type: 按探测类型筛选 ('manual', 'auto')
        - status: 按状态筛选 ('success', 'failed', 'timeout')
        - start_date: 开始日期（ISO格式）
        - end_date: 结束日期（ISO格式）
    
    Returns:
        {
            "success": true,
            "data": {
                "results": [...],
                "total": 100,
                "page": 1,
                "limit": 10,
                "probe_info": {...}
            }
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return jsonify({
                'success': False,
                'message': '租户信息缺失'
            }), 400
        
        # 验证探测任务是否存在
        probe = NetworkProbe.query.filter(
            NetworkProbe.id == probe_id,
            NetworkProbe.tenant_id == tenant_id
        ).first()
        
        if not probe:
            return jsonify({
                'success': False,
                'message': '探测任务不存在'
            }), 404
        
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 10, type=int)
        probe_type = request.args.get('probe_type', type=str)
        status = request.args.get('status', type=str)
        start_date = request.args.get('start_date', type=str)
        end_date = request.args.get('end_date', type=str)
        
        # 限制每页数量
        limit = min(limit, 100)
        
        # 导入探测结果模型
        from app.models.network import NetworkProbeResult
        
        # 构建查询
        query = NetworkProbeResult.query.filter(
            NetworkProbeResult.probe_id == probe_id,
            NetworkProbeResult.tenant_id == tenant_id
        )
        
        # 按探测类型筛选
        if probe_type:
            query = query.filter(NetworkProbeResult.probe_type == probe_type)
        
        # 按状态筛选
        if status:
            query = query.filter(NetworkProbeResult.status == status)
        
        # 按日期范围筛选
        if start_date:
            try:
                start_datetime = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(NetworkProbeResult.probed_at >= start_datetime)
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': '无效的开始日期格式'
                }), 400
        
        if end_date:
            try:
                end_datetime = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(NetworkProbeResult.probed_at <= end_datetime)
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': '无效的结束日期格式'
                }), 400
        
        # 排序：按探测时间倒序
        query = query.order_by(NetworkProbeResult.probed_at.desc())
        
        # 分页
        total = query.count()
        results = query.offset((page - 1) * limit).limit(limit).all()
        
        return jsonify({
            'success': True,
            'data': {
                'results': [result.to_dict() for result in results],
                'total': total,
                'page': page,
                'limit': limit,
                'probe_info': {
                    'id': probe.id,
                    'name': probe.name,
                    'protocol': probe.protocol,
                    'target_url': probe.target_url
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"获取探测结果列表失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'获取探测结果失败: {str(e)}'
        }), 500


@network_bp.route('/probes/<int:probe_id>/statistics', methods=['GET'])
@tenant_required
@jwt_required()
def get_probe_statistics(probe_id):
    """
    获取探测统计数据
    
    Args:
        probe_id: 探测任务ID
    
    Query Parameters:
        - days: 统计天数（默认7天，最大90天）
    
    Returns:
        {
            "success": true,
            "data": {
                "total_probes": 100,
                "success_rate": 95.5,
                "average_response_time": 123.45,
                "status_distribution": {
                    "success": 95,
                    "failed": 3,
                    "timeout": 2
                },
                "probe_info": {...}
            }
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return jsonify({
                'success': False,
                'message': '租户信息缺失'
            }), 400
        
        # 验证探测任务是否存在
        probe = NetworkProbe.query.filter(
            NetworkProbe.id == probe_id,
            NetworkProbe.tenant_id == tenant_id
        ).first()
        
        if not probe:
            return jsonify({
                'success': False,
                'message': '探测任务不存在'
            }), 404
        
        # 获取统计天数
        days = request.args.get('days', 7, type=int)
        days = min(days, 90)  # 最大90天
        
        # 导入探测服务
        from app.services.network_probe_service import network_probe_service
        
        # 获取统计数据
        statistics = network_probe_service.get_probe_statistics(probe_id, days)
        
        # 添加探测任务信息
        statistics['probe_info'] = {
            'id': probe.id,
            'name': probe.name,
            'protocol': probe.protocol,
            'target_url': probe.target_url,
            'enabled': probe.enabled,
            'auto_probe_enabled': probe.auto_probe_enabled
        }
        
        return jsonify({
            'success': True,
            'data': statistics
        }), 200
        
    except Exception as e:
        logger.error(f"获取探测统计数据失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'获取统计数据失败: {str(e)}'
        }), 500


@network_bp.route('/probes/<int:probe_id>/history', methods=['GET'])
@tenant_required
@jwt_required()
def get_probe_history(probe_id):
    """
    获取探测历史查询（时间序列数据）
    
    Args:
        probe_id: 探测任务ID
    
    Query Parameters:
        - hours: 查询小时数（默认24小时，最大168小时即7天）
        - interval: 数据点间隔（分钟，默认60分钟）
    
    Returns:
        {
            "success": true,
            "data": {
                "history": [
                    {
                        "timestamp": "2024-01-01T00:00:00Z",
                        "success_count": 10,
                        "failed_count": 1,
                        "timeout_count": 0,
                        "average_response_time": 123.45,
                        "min_response_time": 100,
                        "max_response_time": 150
                    },
                    ...
                ],
                "probe_info": {...}
            }
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return jsonify({
                'success': False,
                'message': '租户信息缺失'
            }), 400
        
        # 验证探测任务是否存在
        probe = NetworkProbe.query.filter(
            NetworkProbe.id == probe_id,
            NetworkProbe.tenant_id == tenant_id
        ).first()
        
        if not probe:
            return jsonify({
                'success': False,
                'message': '探测任务不存在'
            }), 404
        
        # 获取查询参数
        hours = request.args.get('hours', 24, type=int)
        hours = min(hours, 168)  # 最大7天
        interval = request.args.get('interval', 60, type=int)  # 默认60分钟
        interval = max(interval, 5)  # 最小5分钟
        
        # 导入探测结果模型
        from app.models.network import NetworkProbeResult
        from datetime import timedelta
        
        # 计算时间范围
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=hours)
        
        # 查询时间范围内的所有结果
        results = NetworkProbeResult.query.filter(
            NetworkProbeResult.probe_id == probe_id,
            NetworkProbeResult.tenant_id == tenant_id,
            NetworkProbeResult.probed_at >= start_time,
            NetworkProbeResult.probed_at <= end_time
        ).order_by(NetworkProbeResult.probed_at.asc()).all()
        
        # 按时间间隔分组统计
        history = []
        current_bucket_start = start_time
        interval_delta = timedelta(minutes=interval)
        
        while current_bucket_start < end_time:
            bucket_end = current_bucket_start + interval_delta
            
            # 筛选当前时间桶内的结果
            bucket_results = [
                r for r in results
                if current_bucket_start <= r.probed_at < bucket_end
            ]
            
            if bucket_results:
                # 统计当前时间桶
                success_results = [r for r in bucket_results if r.status == 'success']
                failed_results = [r for r in bucket_results if r.status == 'failed']
                timeout_results = [r for r in bucket_results if r.status == 'timeout']
                
                # 计算响应时间统计（仅成功的请求）
                response_times = [r.response_time for r in success_results if r.response_time is not None]
                
                history.append({
                    'timestamp': current_bucket_start.isoformat() + 'Z',
                    'success_count': len(success_results),
                    'failed_count': len(failed_results),
                    'timeout_count': len(timeout_results),
                    'average_response_time': round(sum(response_times) / len(response_times), 2) if response_times else None,
                    'min_response_time': min(response_times) if response_times else None,
                    'max_response_time': max(response_times) if response_times else None
                })
            else:
                # 没有数据的时间桶
                history.append({
                    'timestamp': current_bucket_start.isoformat() + 'Z',
                    'success_count': 0,
                    'failed_count': 0,
                    'timeout_count': 0,
                    'average_response_time': None,
                    'min_response_time': None,
                    'max_response_time': None
                })
            
            current_bucket_start = bucket_end
        
        return jsonify({
            'success': True,
            'data': {
                'history': history,
                'probe_info': {
                    'id': probe.id,
                    'name': probe.name,
                    'protocol': probe.protocol,
                    'target_url': probe.target_url
                },
                'query_params': {
                    'hours': hours,
                    'interval_minutes': interval,
                    'start_time': start_time.isoformat() + 'Z',
                    'end_time': end_time.isoformat() + 'Z'
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"获取探测历史失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'获取探测历史失败: {str(e)}'
        }), 500


# ==================== SSE Status Push API ====================

@network_bp.route('/probes/<int:probe_id>/status', methods=['GET'])
@tenant_required
@jwt_required()
def get_probe_status_stream(probe_id):
    """
    获取探测状态 SSE 推送（Server-Sent Events）
    
    Args:
        probe_id: 探测任务ID
    
    Returns:
        SSE 数据流，包含以下事件类型：
        - connected: 连接建立
        - probe_status: 探测状态更新
        - probe_result: 探测结果推送
        - heartbeat: 心跳消息
        - error: 错误消息
    
    事件数据格式：
        event: <event_type>
        data: <json_data>
    """
    try:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return jsonify({
                'success': False,
                'message': '租户信息缺失'
            }), 400
        
        # 验证探测任务是否存在
        probe = NetworkProbe.query.filter(
            NetworkProbe.id == probe_id,
            NetworkProbe.tenant_id == tenant_id
        ).first()
        
        if not probe:
            return jsonify({
                'success': False,
                'message': '探测任务不存在'
            }), 404
        
        # 导入 SSE 服务
        from app.services.network_sse_service import network_sse_service
        
        # 生成 SSE 数据流
        logger.info(f"建立 SSE 连接: probe_id={probe_id}, tenant_id={tenant_id}")
        
        return Response(
            network_sse_service.generate_sse_stream(probe_id, tenant_id),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no',  # 禁用 Nginx 缓冲
                'Connection': 'keep-alive'
            }
        )
        
    except Exception as e:
        logger.error(f"建立 SSE 连接失败: probe_id={probe_id}, 错误: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'建立 SSE 连接失败: {str(e)}'
        }), 500


# ==================== Network Dashboard API ====================

@network_bp.route('/dashboard', methods=['GET'])
@tenant_required
@jwt_required()
def get_network_dashboard():
    """
    获取网络监控大屏数据
    
    Returns:
        {
            "success": true,
            "data": {
                "overview": {
                    "total_probes": 50,
                    "active_probes": 30,
                    "total_groups": 10,
                    "total_results_today": 1000
                },
                "probe_status": {
                    "running": 30,
                    "stopped": 20,
                    "error": 0
                },
                "recent_results": {
                    "success": 950,
                    "failed": 30,
                    "timeout": 20,
                    "success_rate": 95.0
                },
                "protocol_distribution": {
                    "http": 20,
                    "https": 15,
                    "websocket": 5,
                    "tcp": 7,
                    "udp": 3
                },
                "top_slow_probes": [
                    {
                        "id": 1,
                        "name": "探测任务1",
                        "average_response_time": 500.5,
                        "protocol": "http",
                        "target_url": "http://example.com"
                    },
                    ...
                ],
                "top_failed_probes": [
                    {
                        "id": 2,
                        "name": "探测任务2",
                        "failed_count": 10,
                        "protocol": "https",
                        "target_url": "https://example.com"
                    },
                    ...
                ],
                "recent_alerts": [
                    {
                        "probe_id": 3,
                        "probe_name": "探测任务3",
                        "status": "failed",
                        "error_message": "连接超时",
                        "probed_at": "2024-01-01T00:00:00Z"
                    },
                    ...
                ],
                "timestamp": "2024-01-01T00:00:00Z"
            }
        }
    """
    try:
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return jsonify({
                'success': False,
                'message': '租户信息缺失'
            }), 400
        
        # 导入必要的模型和服务
        from app.models.network import NetworkProbeResult
        from datetime import timedelta
        
        # 计算时间范围（今天）
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # 1. 概览统计
        total_probes = NetworkProbe.query.filter(
            NetworkProbe.tenant_id == tenant_id
        ).count()
        
        active_probes = NetworkProbe.query.filter(
            NetworkProbe.tenant_id == tenant_id,
            NetworkProbe.auto_probe_enabled == True,
            NetworkProbe.enabled == True
        ).count()
        
        total_groups = NetworkProbeGroup.query.filter(
            NetworkProbeGroup.tenant_id == tenant_id
        ).count()
        
        total_results_today = NetworkProbeResult.query.filter(
            NetworkProbeResult.tenant_id == tenant_id,
            NetworkProbeResult.probed_at >= today_start
        ).count()
        
        overview = {
            'total_probes': total_probes,
            'active_probes': active_probes,
            'total_groups': total_groups,
            'total_results_today': total_results_today
        }
        
        # 2. 探测任务状态分布
        running_count = NetworkProbe.query.filter(
            NetworkProbe.tenant_id == tenant_id,
            NetworkProbe.auto_probe_enabled == True,
            NetworkProbe.enabled == True
        ).count()
        
        stopped_count = NetworkProbe.query.filter(
            NetworkProbe.tenant_id == tenant_id,
            or_(
                NetworkProbe.auto_probe_enabled == False,
                NetworkProbe.enabled == False
            )
        ).count()
        
        probe_status = {
            'running': running_count,
            'stopped': stopped_count,
            'error': 0  # 可以根据实际情况统计错误状态
        }
        
        # 3. 最近探测结果统计（最近24小时）
        last_24h_start = now - timedelta(hours=24)
        recent_results_query = NetworkProbeResult.query.filter(
            NetworkProbeResult.tenant_id == tenant_id,
            NetworkProbeResult.probed_at >= last_24h_start
        )
        
        success_count = recent_results_query.filter(
            NetworkProbeResult.status == 'success'
        ).count()
        
        failed_count = recent_results_query.filter(
            NetworkProbeResult.status == 'failed'
        ).count()
        
        timeout_count = recent_results_query.filter(
            NetworkProbeResult.status == 'timeout'
        ).count()
        
        total_recent = success_count + failed_count + timeout_count
        success_rate = (success_count / total_recent * 100) if total_recent > 0 else 0
        
        recent_results = {
            'success': success_count,
            'failed': failed_count,
            'timeout': timeout_count,
            'success_rate': round(success_rate, 2)
        }
        
        # 4. 协议分布
        protocol_distribution = {}
        protocol_counts = db.session.query(
            NetworkProbe.protocol,
            func.count(NetworkProbe.id)
        ).filter(
            NetworkProbe.tenant_id == tenant_id
        ).group_by(
            NetworkProbe.protocol
        ).all()
        
        for protocol, count in protocol_counts:
            protocol_distribution[protocol] = count
        
        # 5. 响应时间最慢的探测任务（Top 5）
        # 查询最近24小时内平均响应时间最慢的探测任务
        slow_probes_query = db.session.query(
            NetworkProbe.id,
            NetworkProbe.name,
            NetworkProbe.protocol,
            NetworkProbe.target_url,
            func.avg(NetworkProbeResult.response_time).label('avg_response_time')
        ).join(
            NetworkProbeResult,
            NetworkProbe.id == NetworkProbeResult.probe_id
        ).filter(
            NetworkProbe.tenant_id == tenant_id,
            NetworkProbeResult.status == 'success',
            NetworkProbeResult.response_time.isnot(None),
            NetworkProbeResult.probed_at >= last_24h_start
        ).group_by(
            NetworkProbe.id,
            NetworkProbe.name,
            NetworkProbe.protocol,
            NetworkProbe.target_url
        ).order_by(
            desc('avg_response_time')
        ).limit(5).all()
        
        top_slow_probes = [
            {
                'id': probe_id,
                'name': name,
                'average_response_time': round(float(avg_time), 2),
                'protocol': protocol,
                'target_url': target_url
            }
            for probe_id, name, protocol, target_url, avg_time in slow_probes_query
        ]
        
        # 6. 失败次数最多的探测任务（Top 5）
        failed_probes_query = db.session.query(
            NetworkProbe.id,
            NetworkProbe.name,
            NetworkProbe.protocol,
            NetworkProbe.target_url,
            func.count(NetworkProbeResult.id).label('failed_count')
        ).join(
            NetworkProbeResult,
            NetworkProbe.id == NetworkProbeResult.probe_id
        ).filter(
            NetworkProbe.tenant_id == tenant_id,
            NetworkProbeResult.status.in_(['failed', 'timeout']),
            NetworkProbeResult.probed_at >= last_24h_start
        ).group_by(
            NetworkProbe.id,
            NetworkProbe.name,
            NetworkProbe.protocol,
            NetworkProbe.target_url
        ).order_by(
            desc('failed_count')
        ).limit(5).all()
        
        top_failed_probes = [
            {
                'id': probe_id,
                'name': name,
                'failed_count': failed_count,
                'protocol': protocol,
                'target_url': target_url
            }
            for probe_id, name, protocol, target_url, failed_count in failed_probes_query
        ]
        
        # 7. 最近的告警（最近10条失败或超时的探测结果）
        recent_alert_results = NetworkProbeResult.query.join(
            NetworkProbe,
            NetworkProbeResult.probe_id == NetworkProbe.id
        ).filter(
            NetworkProbeResult.tenant_id == tenant_id,
            NetworkProbeResult.status.in_(['failed', 'timeout'])
        ).order_by(
            NetworkProbeResult.probed_at.desc()
        ).limit(10).all()
        
        recent_alerts = []
        for result in recent_alert_results:
            probe = NetworkProbe.query.get(result.probe_id)
            if probe:
                recent_alerts.append({
                    'probe_id': result.probe_id,
                    'probe_name': probe.name,
                    'status': result.status,
                    'error_message': result.error_message or '未知错误',
                    'probed_at': result.probed_at.isoformat() + 'Z'
                })
        
        # 组装响应数据
        dashboard_data = {
            'overview': overview,
            'probe_status': probe_status,
            'recent_results': recent_results,
            'protocol_distribution': protocol_distribution,
            'top_slow_probes': top_slow_probes,
            'top_failed_probes': top_failed_probes,
            'recent_alerts': recent_alerts,
            'timestamp': now.isoformat() + 'Z'
        }
        
        logger.info(f"获取网络监控大屏数据成功: tenant_id={tenant_id}")
        
        return jsonify({
            'success': True,
            'data': dashboard_data
        }), 200
        
    except Exception as e:
        logger.error(f"获取网络监控大屏数据失败: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'获取大屏数据失败: {str(e)}'
        }), 500
