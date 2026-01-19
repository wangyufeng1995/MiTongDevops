"""
备份管理 API
"""
import os
import json
from datetime import datetime
from flask import Blueprint, request, g, send_file
from flask_jwt_extended import jwt_required
from app.core.middleware import tenant_required, role_required, csrf_required
from app.core.config_manager import config_manager
from app.models.system import SystemSetting
from app.extensions import db
from app.utils.response import success_response, error_response
import logging

logger = logging.getLogger(__name__)

backup_bp = Blueprint('backup', __name__, url_prefix='/api/backup')


def _get_database_yaml_config() -> dict:
    """从 database.yaml 获取数据库连接配置"""
    try:
        db_config = config_manager.get_database_config('postgresql')
        return {
            'pg_host': db_config.get('host', 'localhost'),
            'pg_port': db_config.get('port', 5432),
            'pg_database': db_config.get('database', 'mitong'),
            'pg_username': db_config.get('username', 'postgres'),
        }
    except Exception as e:
        logger.warning(f"Failed to get database config from yaml: {e}")
        return {'pg_host': 'localhost', 'pg_port': 5432, 'pg_database': 'mitong', 'pg_username': 'postgres'}


@backup_bp.route('/config/database', methods=['GET'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def get_database_backup_config():
    """获取数据库备份配置"""
    try:
        config = _get_backup_config(g.tenant_id, 'database')
        return success_response(data=config, message="获取数据库备份配置成功")
    except Exception as e:
        logger.error(f"获取数据库备份配置失败: {e}")
        return error_response(message=str(e)), 500


@backup_bp.route('/config/database', methods=['POST'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
@csrf_required
def save_database_backup_config():
    """保存数据库备份配置"""
    try:
        data = request.get_json()
        if not data:
            return error_response(message="请求数据不能为空"), 400
        _save_backup_config(g.tenant_id, g.user_id, 'database', data)
        return success_response(message="数据库备份配置保存成功")
    except Exception as e:
        logger.error(f"保存数据库备份配置失败: {e}")
        return error_response(message=str(e)), 500


@backup_bp.route('/config/network', methods=['GET'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def get_network_backup_config():
    """获取网络探测备份配置"""
    try:
        config = _get_backup_config(g.tenant_id, 'network')
        return success_response(data=config, message="获取网络探测备份配置成功")
    except Exception as e:
        logger.error(f"获取网络探测备份配置失败: {e}")
        return error_response(message=str(e)), 500


@backup_bp.route('/config/network', methods=['POST'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
@csrf_required
def save_network_backup_config():
    """保存网络探测备份配置"""
    try:
        data = request.get_json()
        if not data:
            return error_response(message="请求数据不能为空"), 400
        _save_backup_config(g.tenant_id, g.user_id, 'network', data)
        return success_response(message="网络探测备份配置保存成功")
    except Exception as e:
        logger.error(f"保存网络探测备份配置失败: {e}")
        return error_response(message=str(e)), 500


@backup_bp.route('/execute/database', methods=['POST'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
@csrf_required
def execute_database_backup():
    """立即执行数据库备份"""
    try:
        config = _get_backup_config(g.tenant_id, 'database')
        from app.celery_app import celery
        task = celery.send_task('app.tasks.backup_tasks.backup_database', args=[g.tenant_id, config])
        return success_response(data={'task_id': task.id}, message="数据库备份任务已提交")
    except Exception as e:
        logger.error(f"执行数据库备份失败: {e}")
        return error_response(message=str(e)), 500


@backup_bp.route('/execute/network', methods=['POST'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
@csrf_required
def execute_network_backup():
    """立即执行网络探测数据备份"""
    try:
        config = _get_backup_config(g.tenant_id, 'network')
        from app.celery_app import celery
        task = celery.send_task('app.tasks.backup_tasks.backup_network_data', args=[g.tenant_id, config])
        return success_response(data={'task_id': task.id}, message="网络探测数据备份任务已提交")
    except Exception as e:
        logger.error(f"执行网络探测数据备份失败: {e}")
        return error_response(message=str(e)), 500


@backup_bp.route('/task/<task_id>', methods=['GET'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def get_backup_task_status(task_id):
    """获取备份任务状态"""
    try:
        from app.celery_app import celery
        task = celery.AsyncResult(task_id)
        result = {'task_id': task_id, 'status': task.status, 'result': task.result if task.ready() else None}
        return success_response(data=result, message="获取任务状态成功")
    except Exception as e:
        logger.error(f"获取备份任务状态失败: {e}")
        return error_response(message=str(e)), 500


@backup_bp.route('/history', methods=['GET'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def get_backup_history():
    """获取备份历史记录（分页，每页5条）"""
    try:
        from app.models.backup import BackupRecord
        
        category = request.args.get('category')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 5))
        
        query = BackupRecord.query_by_tenant(g.tenant_id).order_by(BackupRecord.created_at.desc())
        if category:
            query = query.filter(BackupRecord.category == category)
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        backups = [record.to_dict() for record in pagination.items]
        
        return success_response(data={
            'backups': backups,
            'pagination': {
                'page': page, 'per_page': per_page, 'total': pagination.total,
                'pages': pagination.pages, 'has_prev': pagination.has_prev, 'has_next': pagination.has_next
            }
        }, message="获取备份历史成功")
    except Exception as e:
        logger.error(f"获取备份历史失败: {e}")
        return error_response(message=str(e)), 500


@backup_bp.route('/download/<int:backup_id>', methods=['GET'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def download_backup(backup_id):
    """下载备份文件"""
    try:
        from app.models.backup import BackupRecord
        
        record = BackupRecord.query.filter(
            BackupRecord.id == backup_id, BackupRecord.tenant_id == g.tenant_id, BackupRecord.status != 'deleted'
        ).first()
        
        if not record:
            return error_response(message="备份记录不存在"), 404
        if not os.path.exists(record.filepath):
            return error_response(message="备份文件不存在"), 404
        
        return send_file(record.filepath, as_attachment=True, download_name=record.filename)
    except Exception as e:
        logger.error(f"下载备份文件失败: {e}")
        return error_response(message=str(e)), 500


@backup_bp.route('/delete/<int:backup_id>', methods=['DELETE'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
@csrf_required
def delete_backup(backup_id):
    """删除备份文件"""
    try:
        from app.models.backup import BackupRecord
        
        record = BackupRecord.query.filter(
            BackupRecord.id == backup_id, BackupRecord.tenant_id == g.tenant_id, BackupRecord.status != 'deleted'
        ).first()
        
        if not record:
            return error_response(message="备份记录不存在"), 404
        
        if os.path.exists(record.filepath):
            os.remove(record.filepath)
        
        record.status = 'deleted'
        record.deleted_at = datetime.utcnow()
        db.session.commit()
        
        return success_response(message="备份文件删除成功")
    except Exception as e:
        logger.error(f"删除备份文件失败: {e}")
        return error_response(message=str(e)), 500


def _get_backup_config(tenant_id: int, config_type: str) -> dict:
    """获取备份配置"""
    db_yaml_config = _get_database_yaml_config()
    
    default_configs = {
        'database': {
            'enabled': True, 'auto_backup': True, 'backup_interval': 24, 'backup_time': '02:00',
            'retention_days': 30, 'backup_location': './backup/database', 'compression': True,
            'pg_host': db_yaml_config['pg_host'], 'pg_port': db_yaml_config['pg_port'],
            'pg_database': db_yaml_config['pg_database'], 'pg_username': db_yaml_config['pg_username']
        },
        'network': {
            'enabled': True, 'auto_backup': True, 'backup_interval': 168, 'backup_time': '03:00',
            'retention_days': 60, 'backup_location': './backup/network', 'compression': True
        }
    }
    
    setting = SystemSetting.query.filter(SystemSetting.tenant_id == tenant_id, SystemSetting.key == f'backup.{config_type}').first()
    
    if setting and setting.value:
        try:
            saved_config = json.loads(setting.value)
            if config_type == 'database':
                saved_config.update({k: db_yaml_config[k] for k in ['pg_host', 'pg_port', 'pg_database', 'pg_username']})
            if saved_config.get('backup_location', '').startswith('/data/backups/'):
                saved_config['backup_location'] = default_configs[config_type]['backup_location']
            return saved_config
        except:
            pass
    
    return default_configs.get(config_type, {})


def _save_backup_config(tenant_id: int, user_id: int, config_type: str, config: dict):
    """保存备份配置"""
    setting_key = f'backup.{config_type}'
    setting = SystemSetting.query.filter(SystemSetting.tenant_id == tenant_id, SystemSetting.key == setting_key).first()
    
    if setting:
        setting.value = json.dumps(config)
        setting.updated_by = user_id
        setting.updated_at = datetime.utcnow()
    else:
        setting = SystemSetting(tenant_id=tenant_id, key=setting_key, value=json.dumps(config),
                                category='backup', description=f'{config_type} 备份配置', is_enabled=True, created_by=user_id)
        db.session.add(setting)
    
    db.session.commit()
