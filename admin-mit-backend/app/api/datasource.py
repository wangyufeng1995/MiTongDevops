"""
数据源管理 API

提供 Prometheus/VictoriaMetrics 等时序数据库的配置管理、PromQL 查询执行等 API。
注意：所有 API 只使用 GET 和 POST 方法，不使用 PUT/DELETE。

Requirements: 1.1-1.8, 2.2-2.9
"""
from flask import Blueprint, request, jsonify, g
from app.core.middleware import tenant_required, role_required
from app.services.operation_log_service import operation_log_service
from app.models.datasource import (
    DatasourceConfig, 
    SavedPromQLQuery, 
    DATASOURCE_TYPES, 
    AUTH_TYPES,
    PROMQL_TEMPLATES
)
from app.extensions import db
import logging
import requests
import time

logger = logging.getLogger(__name__)
datasource_bp = Blueprint('datasource', __name__)


def log_datasource_operation(action, resource, resource_id=None, details=None):
    """记录数据源操作日志的辅助函数"""
    try:
        operation_log_service.log_operation(
            action=action,
            resource=resource,
            resource_id=resource_id,
            details=details
        )
    except Exception as e:
        logger.warning(f"Failed to log datasource operation: {e}")


# ==================== 数据源配置管理 API ====================

@datasource_bp.route('/configs', methods=['GET'])
@tenant_required
def list_configs():
    """
    获取数据源配置列表
    
    Query Parameters:
        - page: 页码 (默认 1)
        - per_page: 每页数量 (默认 50)
        - search: 搜索关键词
        - type: 数据源类型过滤
        - status: 状态过滤 (0-禁用, 1-启用)
    
    Returns:
        JSON: 配置列表和分页信息
        
    Requirements: 1.1
    """
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        search = request.args.get('search', '')
        ds_type = request.args.get('type', '')
        status = request.args.get('status', type=int)
        
        # 限制每页最大数量
        per_page = min(per_page, 100)
        
        # 构建查询
        query = DatasourceConfig.query.filter_by(tenant_id=g.tenant_id)
        
        # 搜索过滤
        if search:
            query = query.filter(
                db.or_(
                    DatasourceConfig.name.ilike(f'%{search}%'),
                    DatasourceConfig.url.ilike(f'%{search}%')
                )
            )
        
        # 类型过滤
        if ds_type:
            query = query.filter_by(type=ds_type)
        
        # 状态过滤
        if status is not None:
            query = query.filter_by(status=status)
        
        # 排序：默认配置优先，然后按创建时间倒序
        query = query.order_by(
            DatasourceConfig.is_default.desc(),
            DatasourceConfig.created_at.desc()
        )
        
        # 分页
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        configs = [config.to_dict() for config in pagination.items]
        
        return jsonify({
            'success': True,
            'data': {
                'configs': configs,
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
        logger.error(f"List datasource configs error: {e}")
        return jsonify({
            'success': False,
            'message': '获取数据源配置列表失败'
        }), 500


@datasource_bp.route('/configs/<int:config_id>', methods=['GET'])
@tenant_required
def get_config(config_id):
    """
    获取单个数据源配置
    
    Args:
        config_id: 配置 ID
    
    Returns:
        JSON: 配置详情
        
    Requirements: 1.1
    """
    try:
        config = DatasourceConfig.query.filter_by(
            id=config_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not config:
            return jsonify({
                'success': False,
                'message': '数据源配置不存在'
            }), 404
        
        return jsonify({
            'success': True,
            'data': {
                'config': config.to_dict()
            }
        })
        
    except Exception as e:
        logger.error(f"Get datasource config error: {e}")
        return jsonify({
            'success': False,
            'message': '获取数据源配置失败'
        }), 500


@datasource_bp.route('/configs', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def create_config():
    """
    创建数据源配置
    
    Request Body:
        - name: 配置名称 (必需)
        - type: 数据源类型 (prometheus/victoriametrics, 默认 prometheus)
        - url: 服务器 URL (必需)
        - auth_type: 认证类型 (none/basic/bearer, 默认 none)
        - username: 用户名 (Basic Auth 时必需)
        - password: 密码 (Basic Auth 时必需)
        - token: Token (Bearer Token 时必需)
        - is_default: 是否设为默认 (默认 false)
        - status: 状态 (0-禁用, 1-启用, 默认 1)
    
    Returns:
        JSON: 创建的配置
        
    Requirements: 1.1, 1.2, 1.3
    """
    try:
        data = request.get_json()
        
        # 验证必需字段
        if not data.get('name'):
            return jsonify({
                'success': False,
                'message': '配置名称不能为空'
            }), 400
        
        if not data.get('url'):
            return jsonify({
                'success': False,
                'message': '服务器 URL 不能为空'
            }), 400
        
        # 检查名称是否已存在
        existing = DatasourceConfig.query.filter_by(
            tenant_id=g.tenant_id,
            name=data['name']
        ).first()
        
        if existing:
            return jsonify({
                'success': False,
                'message': '配置名称已存在'
            }), 400
        
        # 创建配置
        config = DatasourceConfig(
            tenant_id=g.tenant_id,
            name=data['name'],
            type=data.get('type', 'prometheus'),
            url=data['url'],
            auth_type=data.get('auth_type', 'none'),
            username=data.get('username'),
            password=data.get('password'),
            token=data.get('token'),
            is_default=data.get('is_default', False),
            status=data.get('status', 1),
            created_by=g.user_id
        )
        
        # 验证配置
        is_valid, error_msg = config.validate_config()
        if not is_valid:
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400
        
        # 如果设为默认，取消其他默认配置
        if config.is_default:
            DatasourceConfig.query.filter_by(
                tenant_id=g.tenant_id,
                is_default=True
            ).update({'is_default': False})
        
        db.session.add(config)
        db.session.commit()
        
        # 记录操作日志
        log_datasource_operation(
            action='create',
            resource='datasource_config',
            resource_id=config.id,
            details={'name': config.name, 'type': config.type, 'url': config.url}
        )
        
        return jsonify({
            'success': True,
            'data': {
                'config': config.to_dict()
            },
            'message': '数据源配置创建成功'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Create datasource config error: {e}")
        return jsonify({
            'success': False,
            'message': '创建数据源配置失败'
        }), 500


@datasource_bp.route('/configs/<int:config_id>', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def update_config(config_id):
    """
    更新数据源配置
    
    Args:
        config_id: 配置 ID
    
    Request Body:
        - name: 配置名称
        - type: 数据源类型
        - url: 服务器 URL
        - auth_type: 认证类型
        - username: 用户名
        - password: 密码
        - token: Token
        - is_default: 是否设为默认
        - status: 状态
    
    Returns:
        JSON: 更新后的配置
        
    Requirements: 1.4
    """
    try:
        config = DatasourceConfig.query.filter_by(
            id=config_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not config:
            return jsonify({
                'success': False,
                'message': '数据源配置不存在'
            }), 404
        
        data = request.get_json()
        
        # 检查名称是否与其他配置冲突
        if 'name' in data and data['name'] != config.name:
            existing = DatasourceConfig.query.filter_by(
                tenant_id=g.tenant_id,
                name=data['name']
            ).first()
            if existing:
                return jsonify({
                    'success': False,
                    'message': '配置名称已存在'
                }), 400
            config.name = data['name']
        
        # 更新字段
        if 'type' in data:
            config.type = data['type']
        if 'url' in data:
            config.url = data['url']
        if 'auth_type' in data:
            config.auth_type = data['auth_type']
        if 'username' in data:
            config.username = data['username']
        if 'password' in data:
            config.password = data['password']
        if 'token' in data:
            config.token = data['token']
        if 'status' in data:
            config.status = data['status']
        
        # 处理默认配置
        if 'is_default' in data:
            if data['is_default'] and not config.is_default:
                # 取消其他默认配置
                DatasourceConfig.query.filter(
                    DatasourceConfig.tenant_id == g.tenant_id,
                    DatasourceConfig.id != config_id,
                    DatasourceConfig.is_default == True
                ).update({'is_default': False})
            config.is_default = data['is_default']
        
        # 验证配置
        is_valid, error_msg = config.validate_config()
        if not is_valid:
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400
        
        db.session.commit()
        
        # 记录操作日志
        log_datasource_operation(
            action='update',
            resource='datasource_config',
            resource_id=config.id,
            details={'name': config.name, 'type': config.type, 'url': config.url}
        )
        
        return jsonify({
            'success': True,
            'data': {
                'config': config.to_dict()
            },
            'message': '数据源配置更新成功'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Update datasource config error: {e}")
        return jsonify({
            'success': False,
            'message': '更新数据源配置失败'
        }), 500


@datasource_bp.route('/configs/<int:config_id>/delete', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def delete_config(config_id):
    """
    删除数据源配置
    
    Args:
        config_id: 配置 ID
    
    Returns:
        JSON: 删除结果
        
    Requirements: 1.5
    """
    try:
        config = DatasourceConfig.query.filter_by(
            id=config_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not config:
            return jsonify({
                'success': False,
                'message': '数据源配置不存在'
            }), 404
        
        config_name = config.name
        config_type = config.type
        
        # 删除配置（级联删除关联的保存查询）
        db.session.delete(config)
        db.session.commit()
        
        # 记录操作日志
        log_datasource_operation(
            action='delete',
            resource='datasource_config',
            resource_id=config_id,
            details={'name': config_name, 'type': config_type}
        )
        
        return jsonify({
            'success': True,
            'message': '数据源配置删除成功'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Delete datasource config error: {e}")
        return jsonify({
            'success': False,
            'message': '删除数据源配置失败'
        }), 500


# ==================== 测试连接和默认设置 API ====================

@datasource_bp.route('/configs/<int:config_id>/test', methods=['POST'])
@tenant_required
def test_config_connection(config_id):
    """
    测试数据源连接
    
    Args:
        config_id: 配置 ID
    
    Returns:
        JSON: 连接测试结果
        
    Requirements: 1.6
    """
    try:
        config = DatasourceConfig.query.filter_by(
            id=config_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not config:
            return jsonify({
                'success': False,
                'message': '数据源配置不存在'
            }), 404
        
        # 构建测试 URL (使用 Prometheus 的 /-/ready 或 /api/v1/status/buildinfo 端点)
        test_url = config.url.rstrip('/') + '/api/v1/status/buildinfo'
        
        # 获取认证头
        headers = config.get_auth_headers()
        
        start_time = time.time()
        
        try:
            response = requests.get(
                test_url,
                headers=headers,
                timeout=10,
                verify=False  # 允许自签名证书
            )
            
            elapsed_time = round((time.time() - start_time) * 1000, 2)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    version = data.get('data', {}).get('version', 'unknown')
                except:
                    version = 'unknown'
                
                return jsonify({
                    'success': True,
                    'data': {
                        'connected': True,
                        'response_time_ms': elapsed_time,
                        'version': version,
                        'status_code': response.status_code
                    },
                    'message': '连接成功'
                })
            else:
                return jsonify({
                    'success': False,
                    'data': {
                        'connected': False,
                        'response_time_ms': elapsed_time,
                        'status_code': response.status_code
                    },
                    'message': f'连接失败: HTTP {response.status_code}'
                })
                
        except requests.exceptions.Timeout:
            return jsonify({
                'success': False,
                'data': {
                    'connected': False,
                    'error': 'timeout'
                },
                'message': '连接超时'
            })
        except requests.exceptions.ConnectionError as e:
            return jsonify({
                'success': False,
                'data': {
                    'connected': False,
                    'error': 'connection_error'
                },
                'message': f'连接失败: 无法连接到服务器'
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'data': {
                    'connected': False,
                    'error': str(e)
                },
                'message': f'连接失败: {str(e)}'
            })
        
    except Exception as e:
        logger.error(f"Test datasource connection error: {e}")
        return jsonify({
            'success': False,
            'message': '测试连接失败'
        }), 500


@datasource_bp.route('/configs/<int:config_id>/default', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def set_default_config(config_id):
    """
    设置默认数据源配置
    
    Args:
        config_id: 配置 ID
    
    Returns:
        JSON: 设置结果
        
    Requirements: 1.8
    """
    try:
        config = DatasourceConfig.query.filter_by(
            id=config_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not config:
            return jsonify({
                'success': False,
                'message': '数据源配置不存在'
            }), 404
        
        # 取消其他默认配置
        DatasourceConfig.query.filter(
            DatasourceConfig.tenant_id == g.tenant_id,
            DatasourceConfig.id != config_id
        ).update({'is_default': False})
        
        # 设置当前配置为默认
        config.is_default = True
        db.session.commit()
        
        # 记录操作日志
        log_datasource_operation(
            action='set_default',
            resource='datasource_config',
            resource_id=config.id,
            details={'name': config.name}
        )
        
        return jsonify({
            'success': True,
            'data': {
                'config': config.to_dict()
            },
            'message': '已设置为默认数据源'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Set default datasource config error: {e}")
        return jsonify({
            'success': False,
            'message': '设置默认数据源失败'
        }), 500


# ==================== PromQL 查询 API ====================

@datasource_bp.route('/query', methods=['POST'])
@tenant_required
def execute_instant_query():
    """
    执行即时查询 (Instant Query)
    
    Request Body:
        - config_id: 数据源配置 ID (必需)
        - query: PromQL 查询语句 (必需)
        - time: 查询时间点 (可选, RFC3339 格式或 Unix 时间戳)
    
    Returns:
        JSON: 查询结果
        
    Requirements: 2.2
    """
    try:
        data = request.get_json()
        
        config_id = data.get('config_id')
        query = data.get('query', '').strip()
        query_time = data.get('time')
        
        if not config_id:
            return jsonify({
                'success': False,
                'message': '请指定数据源配置'
            }), 400
        
        if not query:
            return jsonify({
                'success': False,
                'message': 'PromQL 查询语句不能为空'
            }), 400
        
        # 获取配置
        config = DatasourceConfig.query.filter_by(
            id=config_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not config:
            return jsonify({
                'success': False,
                'message': '数据源配置不存在'
            }), 404
        
        if not config.is_enabled():
            return jsonify({
                'success': False,
                'message': '数据源配置已禁用'
            }), 400
        
        # 构建查询 URL
        query_url = config.url.rstrip('/') + '/api/v1/query'
        
        # 构建查询参数
        params = {'query': query}
        if query_time:
            params['time'] = query_time
        
        # 获取认证头
        headers = config.get_auth_headers()
        
        start_time = time.time()
        
        try:
            response = requests.get(
                query_url,
                params=params,
                headers=headers,
                timeout=30,
                verify=False
            )
            
            elapsed_time = round((time.time() - start_time) * 1000, 2)
            
            result = response.json()
            
            if result.get('status') == 'success':
                # 记录操作日志
                log_datasource_operation(
                    action='query',
                    resource='promql_instant',
                    resource_id=config.id,
                    details={'query': query[:200]}  # 截断长查询
                )
                
                return jsonify({
                    'success': True,
                    'data': {
                        'status': 'success',
                        'data': result.get('data'),
                        'execution_time_ms': elapsed_time
                    }
                })
            else:
                return jsonify({
                    'success': False,
                    'data': {
                        'status': 'error',
                        'error': result.get('error', '未知错误'),
                        'errorType': result.get('errorType', 'unknown'),
                        'execution_time_ms': elapsed_time
                    },
                    'message': result.get('error', '查询执行失败')
                })
                
        except requests.exceptions.Timeout:
            return jsonify({
                'success': False,
                'message': '查询超时'
            }), 504
        except requests.exceptions.ConnectionError:
            return jsonify({
                'success': False,
                'message': '无法连接到数据源服务器'
            }), 503
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'查询执行失败: {str(e)}'
            }), 500
        
    except Exception as e:
        logger.error(f"Execute instant query error: {e}")
        return jsonify({
            'success': False,
            'message': '执行查询失败'
        }), 500


@datasource_bp.route('/query_range', methods=['POST'])
@tenant_required
def execute_range_query():
    """
    执行范围查询 (Range Query)
    
    Request Body:
        - config_id: 数据源配置 ID (必需)
        - query: PromQL 查询语句 (必需)
        - start: 开始时间 (必需, RFC3339 格式或 Unix 时间戳)
        - end: 结束时间 (必需, RFC3339 格式或 Unix 时间戳)
        - step: 步长 (必需, 如 "15s", "1m", "5m")
    
    Returns:
        JSON: 查询结果
        
    Requirements: 2.3
    """
    try:
        data = request.get_json()
        
        config_id = data.get('config_id')
        query = data.get('query', '').strip()
        start = data.get('start')
        end = data.get('end')
        step = data.get('step')
        
        if not config_id:
            return jsonify({
                'success': False,
                'message': '请指定数据源配置'
            }), 400
        
        if not query:
            return jsonify({
                'success': False,
                'message': 'PromQL 查询语句不能为空'
            }), 400
        
        if not start or not end:
            return jsonify({
                'success': False,
                'message': '请指定查询时间范围'
            }), 400
        
        if not step:
            return jsonify({
                'success': False,
                'message': '请指定查询步长'
            }), 400
        
        # 获取配置
        config = DatasourceConfig.query.filter_by(
            id=config_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not config:
            return jsonify({
                'success': False,
                'message': '数据源配置不存在'
            }), 404
        
        if not config.is_enabled():
            return jsonify({
                'success': False,
                'message': '数据源配置已禁用'
            }), 400
        
        # 构建查询 URL
        query_url = config.url.rstrip('/') + '/api/v1/query_range'
        
        # 构建查询参数
        params = {
            'query': query,
            'start': start,
            'end': end,
            'step': step
        }
        
        # 获取认证头
        headers = config.get_auth_headers()
        
        start_time = time.time()
        
        try:
            response = requests.get(
                query_url,
                params=params,
                headers=headers,
                timeout=60,  # 范围查询可能需要更长时间
                verify=False
            )
            
            elapsed_time = round((time.time() - start_time) * 1000, 2)
            
            result = response.json()
            
            if result.get('status') == 'success':
                # 记录操作日志
                log_datasource_operation(
                    action='query',
                    resource='promql_range',
                    resource_id=config.id,
                    details={'query': query[:200], 'start': start, 'end': end, 'step': step}
                )
                
                return jsonify({
                    'success': True,
                    'data': {
                        'status': 'success',
                        'data': result.get('data'),
                        'execution_time_ms': elapsed_time
                    }
                })
            else:
                return jsonify({
                    'success': False,
                    'data': {
                        'status': 'error',
                        'error': result.get('error', '未知错误'),
                        'errorType': result.get('errorType', 'unknown'),
                        'execution_time_ms': elapsed_time
                    },
                    'message': result.get('error', '查询执行失败')
                })
                
        except requests.exceptions.Timeout:
            return jsonify({
                'success': False,
                'message': '查询超时'
            }), 504
        except requests.exceptions.ConnectionError:
            return jsonify({
                'success': False,
                'message': '无法连接到数据源服务器'
            }), 503
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'查询执行失败: {str(e)}'
            }), 500
        
    except Exception as e:
        logger.error(f"Execute range query error: {e}")
        return jsonify({
            'success': False,
            'message': '执行查询失败'
        }), 500


# ==================== 保存查询和模板 API ====================

@datasource_bp.route('/saved-queries', methods=['GET'])
@tenant_required
def list_saved_queries():
    """
    获取保存的查询列表
    
    Query Parameters:
        - config_id: 数据源配置 ID (可选)
        - page: 页码 (默认 1)
        - per_page: 每页数量 (默认 50)
    
    Returns:
        JSON: 保存的查询列表
        
    Requirements: 2.8
    """
    try:
        config_id = request.args.get('config_id', type=int)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        # 限制每页最大数量
        per_page = min(per_page, 100)
        
        # 构建查询
        query = SavedPromQLQuery.query.filter_by(tenant_id=g.tenant_id)
        
        # 按配置过滤
        if config_id:
            query = query.filter_by(config_id=config_id)
        
        # 排序
        query = query.order_by(SavedPromQLQuery.created_at.desc())
        
        # 分页
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        queries = [q.to_dict() for q in pagination.items]
        
        return jsonify({
            'success': True,
            'data': {
                'queries': queries,
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
        logger.error(f"List saved queries error: {e}")
        return jsonify({
            'success': False,
            'message': '获取保存的查询列表失败'
        }), 500


@datasource_bp.route('/saved-queries', methods=['POST'])
@tenant_required
def save_query():
    """
    保存 PromQL 查询
    
    Request Body:
        - config_id: 数据源配置 ID (必需)
        - name: 查询名称 (必需)
        - query: PromQL 查询语句 (必需)
        - description: 查询描述 (可选)
    
    Returns:
        JSON: 保存的查询
        
    Requirements: 2.8
    """
    try:
        data = request.get_json()
        
        config_id = data.get('config_id')
        name = data.get('name', '').strip()
        query = data.get('query', '').strip()
        description = data.get('description', '').strip()
        
        if not config_id:
            return jsonify({
                'success': False,
                'message': '请指定数据源配置'
            }), 400
        
        if not name:
            return jsonify({
                'success': False,
                'message': '查询名称不能为空'
            }), 400
        
        if not query:
            return jsonify({
                'success': False,
                'message': 'PromQL 查询语句不能为空'
            }), 400
        
        # 验证配置存在
        config = DatasourceConfig.query.filter_by(
            id=config_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not config:
            return jsonify({
                'success': False,
                'message': '数据源配置不存在'
            }), 404
        
        # 检查名称是否已存在
        existing = SavedPromQLQuery.query.filter_by(
            tenant_id=g.tenant_id,
            config_id=config_id,
            name=name
        ).first()
        
        if existing:
            return jsonify({
                'success': False,
                'message': '该配置下已存在同名查询'
            }), 400
        
        # 创建保存的查询
        saved_query = SavedPromQLQuery(
            tenant_id=g.tenant_id,
            config_id=config_id,
            name=name,
            query=query,
            description=description,
            created_by=g.user_id
        )
        
        db.session.add(saved_query)
        db.session.commit()
        
        # 记录操作日志
        log_datasource_operation(
            action='create',
            resource='saved_query',
            resource_id=saved_query.id,
            details={'name': name, 'config_id': config_id}
        )
        
        return jsonify({
            'success': True,
            'data': {
                'query': saved_query.to_dict()
            },
            'message': '查询保存成功'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Save query error: {e}")
        return jsonify({
            'success': False,
            'message': '保存查询失败'
        }), 500


@datasource_bp.route('/saved-queries/<int:query_id>/delete', methods=['POST'])
@tenant_required
def delete_saved_query(query_id):
    """
    删除保存的查询
    
    Args:
        query_id: 查询 ID
    
    Returns:
        JSON: 删除结果
        
    Requirements: 2.8
    """
    try:
        saved_query = SavedPromQLQuery.query.filter_by(
            id=query_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not saved_query:
            return jsonify({
                'success': False,
                'message': '保存的查询不存在'
            }), 404
        
        query_name = saved_query.name
        
        db.session.delete(saved_query)
        db.session.commit()
        
        # 记录操作日志
        log_datasource_operation(
            action='delete',
            resource='saved_query',
            resource_id=query_id,
            details={'name': query_name}
        )
        
        return jsonify({
            'success': True,
            'message': '查询删除成功'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Delete saved query error: {e}")
        return jsonify({
            'success': False,
            'message': '删除查询失败'
        }), 500


@datasource_bp.route('/templates', methods=['GET'])
@tenant_required
def get_query_templates():
    """
    获取 PromQL 查询模板
    
    Returns:
        JSON: 查询模板列表
        
    Requirements: 2.9
    """
    try:
        return jsonify({
            'success': True,
            'data': {
                'templates': PROMQL_TEMPLATES
            }
        })
        
    except Exception as e:
        logger.error(f"Get query templates error: {e}")
        return jsonify({
            'success': False,
            'message': '获取查询模板失败'
        }), 500


# ==================== 辅助 API ====================

@datasource_bp.route('/types', methods=['GET'])
@tenant_required
def get_datasource_types():
    """
    获取支持的数据源类型
    
    Returns:
        JSON: 数据源类型列表
    """
    try:
        types = [
            {'value': 'prometheus', 'label': 'Prometheus'},
            {'value': 'victoriametrics', 'label': 'VictoriaMetrics'}
        ]
        
        return jsonify({
            'success': True,
            'data': {
                'types': types
            }
        })
        
    except Exception as e:
        logger.error(f"Get datasource types error: {e}")
        return jsonify({
            'success': False,
            'message': '获取数据源类型失败'
        }), 500


@datasource_bp.route('/auth-types', methods=['GET'])
@tenant_required
def get_auth_types():
    """
    获取支持的认证类型
    
    Returns:
        JSON: 认证类型列表
    """
    try:
        types = [
            {'value': 'none', 'label': '无认证'},
            {'value': 'basic', 'label': 'Basic Auth'},
            {'value': 'bearer', 'label': 'Bearer Token'}
        ]
        
        return jsonify({
            'success': True,
            'data': {
                'types': types
            }
        })
        
    except Exception as e:
        logger.error(f"Get auth types error: {e}")
        return jsonify({
            'success': False,
            'message': '获取认证类型失败'
        }), 500
