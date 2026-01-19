"""
备份定时任务

提供数据库和网络探测数据的自动备份功能
"""
import os
import gzip
import json
import shutil
import logging
from typing import Dict, Any
from datetime import datetime, timedelta
from celery import Task
from app.celery_app import celery
from app.core.config_manager import config_manager

logger = logging.getLogger(__name__)

# 全局 Flask 应用实例（懒加载）
_flask_app = None


def get_flask_app():
    """获取 Celery 专用的轻量级 Flask 应用实例"""
    global _flask_app
    if _flask_app is None:
        from app.celery_flask_app import create_celery_flask_app
        _flask_app = create_celery_flask_app()
    return _flask_app


def get_database_connection_config() -> dict:
    """从 database.yaml 获取数据库连接配置"""
    try:
        db_config = config_manager.get_database_config('postgresql')
        return {
            'pg_host': db_config.get('host', 'localhost'),
            'pg_port': db_config.get('port', 5432),
            'pg_database': db_config.get('database', 'mitong'),
            'pg_username': db_config.get('username', 'postgres'),
            'pg_password': db_config.get('password', '')
        }
    except Exception as e:
        logger.warning(f"Failed to get database config from yaml: {e}")
        return {
            'pg_host': 'localhost', 'pg_port': 5432,
            'pg_database': 'mitong', 'pg_username': 'postgres', 'pg_password': ''
        }


# 默认配置
DEFAULT_DB_BACKUP_CONFIG = {
    'enabled': True, 'auto_backup': True, 'backup_interval': 24,
    'backup_time': '02:00', 'retention_days': 30,
    'backup_location': './backup/database', 'compression': True,
}

DEFAULT_NETWORK_BACKUP_CONFIG = {
    'enabled': True, 'auto_backup': True, 'backup_interval': 168,
    'backup_time': '03:00', 'retention_days': 60,
    'backup_location': './backup/network', 'compression': True
}


def get_backup_config(tenant_id: int, config_type: str) -> dict:
    """从系统设置中获取备份配置"""
    try:
        from app.models.system import SystemSetting
        setting_key = f'backup.{config_type}'
        setting = SystemSetting.query.filter(
            SystemSetting.tenant_id == tenant_id,
            SystemSetting.key == setting_key,
            SystemSetting.is_enabled == True
        ).first()
        
        if setting and setting.value:
            return json.loads(setting.value)
        return DEFAULT_DB_BACKUP_CONFIG if config_type == 'database' else DEFAULT_NETWORK_BACKUP_CONFIG
    except Exception as e:
        logger.warning(f"Failed to get backup config for tenant {tenant_id}: {e}")
        return DEFAULT_DB_BACKUP_CONFIG if config_type == 'database' else DEFAULT_NETWORK_BACKUP_CONFIG


def ensure_backup_directory(path: str) -> bool:
    """确保备份目录存在"""
    try:
        os.makedirs(path, exist_ok=True)
        return True
    except Exception as e:
        logger.error(f"Failed to create backup directory {path}: {e}")
        return False


def cleanup_old_backups(backup_dir: str, retention_days: int, prefix: str = ''):
    """清理过期的备份文件"""
    try:
        if not os.path.exists(backup_dir):
            return 0
        cutoff_date = datetime.now() - timedelta(days=retention_days)
        deleted_count = 0
        for filename in os.listdir(backup_dir):
            if prefix and not filename.startswith(prefix):
                continue
            filepath = os.path.join(backup_dir, filename)
            if os.path.isfile(filepath):
                file_mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
                if file_mtime < cutoff_date:
                    os.remove(filepath)
                    deleted_count += 1
        return deleted_count
    except Exception as e:
        logger.error(f"Failed to cleanup old backups: {e}")
        return 0


def _verify_backup_file(filepath: str) -> tuple:
    """校验备份文件"""
    if os.path.exists(filepath):
        return True, os.path.getsize(filepath)
    return False, 0


def _format_file_size(size_bytes: int) -> str:
    """格式化文件大小"""
    if not size_bytes:
        return '0 B'
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f'{size_bytes:.2f} {unit}'
        size_bytes /= 1024
    return f'{size_bytes:.2f} TB'


def _save_backup_record(tenant_id: int, category: str, filename: str, filepath: str,
                        file_size: int, backup_type: str, db_host: str = None,
                        db_name: str = None, compression: bool = True,
                        status: str = 'success', message: str = None):
    """保存备份记录到数据库"""
    try:
        from app.extensions import db
        from app.models.backup import BackupRecord
        
        if status == 'success' and not os.path.exists(filepath):
            status = 'failed'
            message = '备份文件不存在'
        
        record = BackupRecord(
            tenant_id=tenant_id or 1,
            filename=filename, filepath=filepath, category=category,
            backup_type=backup_type, file_size=file_size,
            file_size_display=_format_file_size(file_size),
            compression=compression, status=status, message=message,
            db_host=db_host, db_name=db_name
        )
        db.session.add(record)
        db.session.commit()
        logger.info(f"[备份记录] 已保存: {filename}, 状态: {status}")
        return record.id
    except Exception as e:
        from app.extensions import db
        db.session.rollback()
        logger.error(f"[备份记录] 保存失败: {e}")
        return None


class BackupTask(Task):
    """备份任务基类"""
    
    autoretry_for = (Exception,)
    retry_kwargs = {'max_retries': 3, 'countdown': 60}
    retry_backoff = True
    retry_backoff_max = 600
    retry_jitter = True
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """任务失败时的回调"""
        logger.error(f"[备份] 任务失败: task_id={task_id}, error={exc}")
    
    def on_success(self, retval, task_id, args, kwargs):
        """任务成功时的回调"""
        pass


@celery.task(
    base=BackupTask,
    bind=True,
    name='app.tasks.backup_tasks.backup_database',
    queue='celery',
    priority=5
)
def backup_database(self, tenant_id: int = None, config: dict = None) -> Dict[str, Any]:
    """执行数据库备份（使用 Python 导出 SQL）"""
    logger.info(f"[数据库备份] 开始执行, tenant_id={tenant_id}")
    
    app = get_flask_app()
    with app.app_context():
        try:
            # 获取备份策略配置
            if config is None and tenant_id:
                config = get_backup_config(tenant_id, 'database')
            elif config is None:
                config = DEFAULT_DB_BACKUP_CONFIG.copy()
            
            if not config.get('enabled', True):
                return {'success': False, 'message': '数据库备份已禁用'}
            
            # 优先从 database.yaml 获取数据库连接配置
            db_conn_config = get_database_connection_config()
            pg_host = db_conn_config['pg_host']
            pg_port = db_conn_config['pg_port']
            pg_database = db_conn_config['pg_database']
            pg_username = db_conn_config['pg_username']
            pg_password = db_conn_config['pg_password']
            
            # 确保备份目录存在
            backup_dir = config.get('backup_location', DEFAULT_DB_BACKUP_CONFIG['backup_location'])
            if not os.path.isabs(backup_dir):
                backup_dir = os.path.join(os.getcwd(), backup_dir.lstrip('./'))
            
            if not ensure_backup_directory(backup_dir):
                return {'success': False, 'message': f'无法创建备份目录: {backup_dir}'}
            
            # 生成备份文件名
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_filename = f"db_backup_{timestamp}.sql"
            backup_path = os.path.join(backup_dir, backup_filename)
            
            logger.info(f"[数据库备份] 连接: {pg_host}:{pg_port}/{pg_database}")
            
            # 使用 Python 导出数据库
            import psycopg2
            from psycopg2 import sql
            
            conn = psycopg2.connect(
                host=pg_host, port=pg_port, database=pg_database,
                user=pg_username, password=pg_password
            )
            conn.set_session(readonly=True)
            cursor = conn.cursor()
            
            # 获取所有表名
            cursor.execute("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """)
            tables = [row[0] for row in cursor.fetchall()]
            
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(f"-- Database Backup: {pg_database}\n")
                f.write(f"-- Created: {datetime.now().isoformat()}\n")
                f.write(f"-- Host: {pg_host}:{pg_port}\n")
                f.write(f"-- Tables: {len(tables)}\n\n")
                
                total_rows = 0
                for table in tables:
                    try:
                        # 获取表结构
                        cursor.execute(f"""
                            SELECT column_name, data_type, is_nullable, column_default
                            FROM information_schema.columns 
                            WHERE table_name = %s AND table_schema = 'public'
                            ORDER BY ordinal_position
                        """, (table,))
                        columns = cursor.fetchall()
                        
                        f.write(f"\n-- Table: {table}\n")
                        f.write(f"-- Columns: {len(columns)}\n")
                        
                        # 导出数据
                        cursor.execute(sql.SQL("SELECT * FROM {}").format(sql.Identifier(table)))
                        rows = cursor.fetchall()
                        
                        if rows:
                            col_names = [desc[0] for desc in cursor.description]
                            f.write(f"-- Rows: {len(rows)}\n")
                            
                            for row in rows:
                                values = []
                                for val in row:
                                    if val is None:
                                        values.append('NULL')
                                    elif isinstance(val, (int, float)):
                                        values.append(str(val))
                                    elif isinstance(val, bool):
                                        values.append('TRUE' if val else 'FALSE')
                                    elif isinstance(val, datetime):
                                        values.append(f"'{val.isoformat()}'")
                                    else:
                                        escaped = str(val).replace("'", "''")
                                        values.append(f"'{escaped}'")
                                
                                f.write(f"INSERT INTO {table} ({', '.join(col_names)}) VALUES ({', '.join(values)});\n")
                            total_rows += len(rows)
                        else:
                            f.write("-- (empty table)\n")
                            
                    except Exception as e:
                        f.write(f"-- Error exporting table {table}: {e}\n")
                        logger.warning(f"[数据库备份] 导出表 {table} 失败: {e}")
                
                f.write(f"\n-- Backup completed: {total_rows} total rows\n")
            
            cursor.close()
            conn.close()
            
            # 压缩备份文件
            final_path = backup_path
            if config.get('compression', True):
                compressed_path = backup_path + '.gz'
                with open(backup_path, 'rb') as f_in:
                    with gzip.open(compressed_path, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
                os.remove(backup_path)
                final_path = compressed_path
                backup_filename += '.gz'
            
            # 校验文件
            file_exists, file_size = _verify_backup_file(final_path)
            if not file_exists:
                _save_backup_record(
                    tenant_id=tenant_id, category='database', filename=backup_filename,
                    filepath=final_path, file_size=0, backup_type='manual',
                    db_host=pg_host, db_name=pg_database, status='failed', message='备份文件创建失败'
                )
                return {'success': False, 'message': '备份文件创建失败'}
            
            file_size_mb = round(file_size / (1024 * 1024), 2)
            
            # 清理过期备份
            cleanup_old_backups(backup_dir, config.get('retention_days', 30), 'db_backup_')
            
            # 记录备份历史
            _save_backup_record(
                tenant_id=tenant_id, category='database', filename=backup_filename,
                filepath=final_path, file_size=file_size, backup_type='manual',
                db_host=pg_host, db_name=pg_database, compression=config.get('compression', True),
                status='success', message=f'数据库备份成功: {len(tables)}个表, {total_rows}条记录'
            )
            
            logger.info(f"[数据库备份] [OK] {backup_filename} ({file_size_mb} MB), {len(tables)}个表, {total_rows}条记录")
            
            return {
                'success': True, 'message': '数据库备份成功',
                'filename': backup_filename, 'size': f'{file_size_mb} MB',
                'path': final_path, 'tables': len(tables), 'rows': total_rows
            }
            
        except Exception as e:
            logger.error(f"[数据库备份] 异常: {e}")
            raise


@celery.task(
    base=BackupTask,
    bind=True,
    name='app.tasks.backup_tasks.backup_network_data',
    queue='celery',
    priority=5
)
def backup_network_data(self, tenant_id: int = None, config: dict = None) -> Dict[str, Any]:
    """执行网络探测数据备份（从数据库导出）"""
    logger.info(f"[网络探测备份] 开始执行, tenant_id={tenant_id}")
    
    app = get_flask_app()
    with app.app_context():
        try:
            # 获取配置
            if config is None and tenant_id:
                config = get_backup_config(tenant_id, 'network')
            elif config is None:
                config = DEFAULT_NETWORK_BACKUP_CONFIG
            
            if not config.get('enabled', True):
                return {'success': False, 'message': '网络探测备份已禁用'}
            
            # 确保备份目录存在
            backup_dir = config.get('backup_location', DEFAULT_NETWORK_BACKUP_CONFIG['backup_location'])
            if not os.path.isabs(backup_dir):
                backup_dir = os.path.join(os.getcwd(), backup_dir.lstrip('./'))
            
            if not ensure_backup_directory(backup_dir):
                return {'success': False, 'message': f'无法创建备份目录: {backup_dir}'}
            
            # 生成备份文件名
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_filename = f"network_backup_{timestamp}.json"
            backup_path = os.path.join(backup_dir, backup_filename)
            
            # 从数据库导出网络探测数据
            from app.models.network import NetworkProbeGroup, NetworkProbe, NetworkProbeResult, NetworkAlertRule
            
            tid = tenant_id or 1
            
            # 导出探测分组
            groups = NetworkProbeGroup.query.filter_by(tenant_id=tid).all()
            groups_data = [{
                'id': g.id, 'name': g.name, 'description': g.description,
                'is_default': g.is_default, 'color': g.color, 'sort_order': g.sort_order,
                'created_at': g.created_at.isoformat() if g.created_at else None
            } for g in groups]
            
            # 导出探测任务
            probes = NetworkProbe.query.filter_by(tenant_id=tid).all()
            probes_data = [{
                'id': p.id, 'name': p.name, 'group_id': p.group_id,
                'protocol': p.protocol, 'target_url': p.target_url, 'method': p.method,
                'timeout': p.timeout, 'interval_seconds': p.interval_seconds,
                'auto_probe_enabled': p.auto_probe_enabled, 'enabled': p.enabled,
                'created_at': p.created_at.isoformat() if p.created_at else None
            } for p in probes]
            
            # 导出最近30天的探测结果
            cutoff_date = datetime.now() - timedelta(days=30)
            results = NetworkProbeResult.query.filter(
                NetworkProbeResult.tenant_id == tid,
                NetworkProbeResult.probed_at >= cutoff_date
            ).order_by(NetworkProbeResult.probed_at.desc()).limit(10000).all()
            
            results_data = [{
                'id': r.id, 'probe_id': r.probe_id, 'status': r.status,
                'probe_type': r.probe_type, 'response_time': r.response_time, 
                'status_code': r.status_code, 'error_message': r.error_message,
                'probed_at': r.probed_at.isoformat() if r.probed_at else None
            } for r in results]
            
            # 导出告警规则
            alert_rules = NetworkAlertRule.query.filter_by(tenant_id=tid).all()
            rules_data = [{
                'id': r.id, 'name': r.name, 'probe_id': r.probe_id,
                'condition_type': r.condition_type, 'condition_operator': r.condition_operator,
                'threshold_value': float(r.threshold_value) if r.threshold_value else None,
                'consecutive_failures': r.consecutive_failures, 'enabled': r.enabled,
                'created_at': r.created_at.isoformat() if r.created_at else None
            } for r in alert_rules]
            
            # 构建备份数据
            backup_data = {
                'backup_info': {
                    'version': '1.0', 'created_at': datetime.now().isoformat(),
                    'tenant_id': tid, 'type': 'network_probe_backup'
                },
                'statistics': {
                    'groups_count': len(groups_data), 'probes_count': len(probes_data),
                    'results_count': len(results_data), 'alert_rules_count': len(rules_data)
                },
                'data': {
                    'groups': groups_data, 'probes': probes_data,
                    'results': results_data, 'alert_rules': rules_data
                }
            }
            
            # 写入JSON文件
            with open(backup_path, 'w', encoding='utf-8') as f:
                json.dump(backup_data, f, ensure_ascii=False, indent=2)
            
            # 压缩备份
            final_path = backup_path
            if config.get('compression', True):
                compressed_path = backup_path + '.gz'
                with open(backup_path, 'rb') as f_in:
                    with gzip.open(compressed_path, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
                os.remove(backup_path)
                final_path = compressed_path
                backup_filename += '.gz'
            
            # 校验文件
            file_exists, file_size = _verify_backup_file(final_path)
            if not file_exists:
                _save_backup_record(
                    tenant_id=tenant_id, category='network', filename=backup_filename,
                    filepath=final_path, file_size=0, backup_type='manual',
                    status='failed', message='备份文件创建失败'
                )
                return {'success': False, 'message': '备份文件创建失败'}
            
            file_size_mb = round(file_size / (1024 * 1024), 2)
            
            # 清理过期备份
            cleanup_old_backups(backup_dir, config.get('retention_days', 60), 'network_backup_')
            
            stats = backup_data['statistics']
            msg = f"备份成功: {stats['groups_count']}个分组, {stats['probes_count']}个任务, {stats['results_count']}条结果"
            
            # 记录备份历史
            _save_backup_record(
                tenant_id=tenant_id, category='network', filename=backup_filename,
                filepath=final_path, file_size=file_size, backup_type='manual',
                compression=config.get('compression', True), status='success', message=msg
            )
            
            logger.info(f"[网络探测备份] [OK] {backup_filename} ({file_size_mb} MB)")
            
            return {
                'success': True, 'message': '网络探测数据备份成功',
                'filename': backup_filename, 'size': f'{file_size_mb} MB',
                'path': final_path, 'statistics': stats
            }
            
        except Exception as e:
            logger.error(f"[网络探测备份] 异常: {e}")
            raise


@celery.task(
    name='app.tasks.backup_tasks.schedule_auto_backups',
    queue='celery',
    priority=2
)
def schedule_auto_backups() -> Dict[str, Any]:
    """调度自动备份任务（由 Celery Beat 每小时执行）"""
    app = get_flask_app()
    with app.app_context():
        try:
            from app.models.tenant import Tenant
            
            tenants = Tenant.query.filter(Tenant.status == 1).all()
            current_hour = datetime.now().hour
            
            for tenant in tenants:
                # 检查数据库备份
                db_config = get_backup_config(tenant.id, 'database')
                if db_config.get('enabled') and db_config.get('auto_backup'):
                    backup_time = db_config.get('backup_time', '02:00')
                    if _should_run_backup(backup_time, db_config.get('backup_interval', 24)):
                        backup_database.apply_async(kwargs={'tenant_id': tenant.id, 'config': db_config})
                
                # 检查网络探测备份
                network_config = get_backup_config(tenant.id, 'network')
                if network_config.get('enabled') and network_config.get('auto_backup'):
                    backup_time = network_config.get('backup_time', '03:00')
                    if _should_run_backup(backup_time, network_config.get('backup_interval', 168)):
                        backup_network_data.apply_async(kwargs={'tenant_id': tenant.id, 'config': network_config})
            
            return {'success': True, 'message': '自动备份调度完成'}
            
        except Exception as e:
            logger.error(f"[备份] 自动调度失败: {e}")
            return {'success': False, 'message': str(e)}


def _should_run_backup(backup_time: str, interval_hours: int) -> bool:
    """检查是否应该执行备份"""
    try:
        current_time = datetime.now()
        backup_hour, _ = map(int, backup_time.split(':'))
        
        if current_time.hour != backup_hour:
            return False
        
        if interval_hours == 24:
            return True
        elif interval_hours == 168:  # 每周
            return current_time.weekday() == 6
        elif interval_hours == 720:  # 每月
            return current_time.day == 1
        elif interval_hours in [6, 12]:
            return current_time.hour % interval_hours == backup_hour % interval_hours
        
        return True
    except Exception:
        return False


@celery.task(
    name='app.tasks.backup_tasks.get_backup_history',
    queue='celery',
    priority=3
)
def get_backup_history(tenant_id: int, category: str = None, limit: int = 50) -> Dict[str, Any]:
    """获取备份历史记录"""
    app = get_flask_app()
    with app.app_context():
        try:
            from app.models.system import SystemSetting
            
            setting = SystemSetting.query.filter(
                SystemSetting.tenant_id == tenant_id,
                SystemSetting.key == 'backup.history'
            ).first()
            
            if not setting or not setting.value:
                return {'success': True, 'history': []}
            
            history = json.loads(setting.value)
            if category:
                history = [h for h in history if h.get('category') == category]
            
            return {'success': True, 'history': history[:limit]}
            
        except Exception as e:
            logger.error(f"[备份] 获取历史失败: {e}")
            return {'success': False, 'message': str(e), 'history': []}
