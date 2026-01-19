"""
系统设置服务
"""
import os
import platform
import time
from datetime import datetime, timedelta
from flask import g
from app.extensions import db
from app.models.system import SystemSetting
from app.models.user import User

# 尝试导入psutil，如果不存在则使用备用方案
try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False


class SystemService:
    """系统设置服务类"""
    
    # 默认系统配置
    DEFAULT_SETTINGS = {
        'system': {
            'system_name': 'MiTong运维管理系统',
            'system_version': '2.1.0',
            'system_description': '企业级运维管理平台，提供主机管理、监控告警、网络探测等功能',
            'company_name': '米通科技有限公司',
            'company_logo': None,
            'timezone': 'Asia/Shanghai',
            'language': 'zh-CN',
            'maintenance_mode': False,
            'maintenance_message': '系统正在维护中，预计30分钟后恢复正常'
        },
        'security': {
            'max_login_attempts': 5,
            'session_timeout': 7200,  # 2小时
            'password_policy': {
                'min_length': 8,
                'require_uppercase': True,
                'require_lowercase': True,
                'require_numbers': True,
                'require_symbols': False,
                'expiry_days': 90
            },
            'audit_log_retention_days': 90  # 审计日志保留天数，默认90天
        },
        'backup': {
            'auto_backup': True,
            'backup_interval': 24,  # 小时
            'backup_retention': 30,  # 天
            'backup_location': '/var/backups/mitong'
        },
        'notification': {
            'email_enabled': True,
            'sms_enabled': False,
            'system_notifications': True,
            'email_config': {
                'smtp_host': '',
                'smtp_port': 587,
                'smtp_user': '',
                'smtp_password': '',
                'use_tls': True
            }
        }
    }
    
    @classmethod
    def initialize_default_settings(cls, tenant_id, user_id):
        """初始化默认系统设置"""
        try:
            for category, settings in cls.DEFAULT_SETTINGS.items():
                for key, value in settings.items():
                    setting_key = f"{category}.{key}"
                    
                    # 检查设置是否已存在
                    existing = SystemSetting.query.filter(
                        SystemSetting.tenant_id == tenant_id,
                        SystemSetting.key == setting_key
                    ).first()
                    
                    if not existing:
                        setting = SystemSetting(
                            tenant_id=tenant_id,
                            key=setting_key,
                            value=value,
                            category=category,
                            description=f"系统默认{category}设置",
                            is_system=True,
                            created_by=user_id
                        )
                        db.session.add(setting)
            
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            raise e
    
    @classmethod
    def get_system_config(cls, tenant_id=None):
        """获取系统配置"""
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        # 获取所有系统设置
        settings = SystemSetting.query.filter(
            SystemSetting.tenant_id == tenant_id,
            SystemSetting.is_enabled == True
        ).all()
        
        # 按分类组织配置
        config = {}
        for setting in settings:
            category, key = setting.key.split('.', 1) if '.' in setting.key else ('general', setting.key)
            
            if category not in config:
                config[category] = {}
            
            config[category][key] = setting.value
        
        # 合并默认配置（如果某些设置不存在）
        for category, default_settings in cls.DEFAULT_SETTINGS.items():
            if category not in config:
                config[category] = {}
            
            for key, default_value in default_settings.items():
                if key not in config[category]:
                    config[category][key] = default_value
        
        return config
    
    @classmethod
    def update_system_config(cls, config_data, tenant_id=None, user_id=None):
        """更新系统配置"""
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        if user_id is None:
            user_id = getattr(g, 'user_id', None)
        
        if tenant_id is None or user_id is None:
            raise ValueError("租户ID和用户ID不能为空")
        
        try:
            for category, settings in config_data.items():
                for key, value in settings.items():
                    setting_key = f"{category}.{key}"
                    
                    # 查找现有设置
                    setting = SystemSetting.query.filter(
                        SystemSetting.tenant_id == tenant_id,
                        SystemSetting.key == setting_key
                    ).first()
                    
                    if setting:
                        # 更新现有设置
                        setting.value = value
                        setting.updated_by = user_id
                        setting.updated_at = datetime.utcnow()
                    else:
                        # 创建新设置
                        setting = SystemSetting(
                            tenant_id=tenant_id,
                            key=setting_key,
                            value=value,
                            category=category,
                            description=f"用户自定义{category}设置",
                            created_by=user_id
                        )
                        db.session.add(setting)
            
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            raise e
    
    @classmethod
    def get_system_info(cls):
        """获取系统信息"""
        try:
            # 获取系统基本信息
            system_info = {
                'hostname': platform.node(),
                'os_version': f"{platform.system()} {platform.release()}",
                'python_version': platform.python_version(),
                'cpu_cores': os.cpu_count() or 1,
                'memory_total': cls._get_memory_info(),
                'disk_total': cls._get_disk_info(),
                'uptime': cls._get_uptime(),
                'load_average': cls._get_load_average()
            }
            
            # 获取用户统计
            tenant_id = getattr(g, 'tenant_id', None)
            if tenant_id:
                total_users = User.query_by_tenant(tenant_id).count()
                # 简化活跃用户统计（这里可以根据实际需求调整）
                active_users = User.query_by_tenant(tenant_id).filter(User.status == 1).count()
                
                system_info.update({
                    'total_users': total_users,
                    'active_users': active_users
                })
            else:
                system_info.update({
                    'total_users': 0,
                    'active_users': 0
                })
            
            return system_info
        except Exception as e:
            # 返回默认信息
            return {
                'hostname': 'unknown',
                'os_version': 'unknown',
                'python_version': platform.python_version(),
                'cpu_cores': 1,
                'memory_total': '0 GB',
                'disk_total': '0 GB',
                'uptime': '0天 0小时 0分钟',
                'load_average': [0.0, 0.0, 0.0],
                'total_users': 0,
                'active_users': 0
            }
    
    @classmethod
    def _get_memory_info(cls):
        """获取内存信息"""
        if HAS_PSUTIL:
            try:
                return cls._format_bytes(psutil.virtual_memory().total)
            except:
                pass
        return "未知"
    
    @classmethod
    def _get_disk_info(cls):
        """获取磁盘信息"""
        if HAS_PSUTIL:
            try:
                # Windows使用C:，Linux使用/
                path = 'C:' if platform.system() == 'Windows' else '/'
                return cls._format_bytes(psutil.disk_usage(path).total)
            except:
                pass
        return "未知"
    
    @classmethod
    def _get_load_average(cls):
        """获取负载平均值"""
        if hasattr(os, 'getloadavg'):
            try:
                return list(os.getloadavg())
            except:
                pass
        return [0.0, 0.0, 0.0]
    
    @classmethod
    def _format_bytes(cls, bytes_value):
        """格式化字节数"""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if bytes_value < 1024.0:
                return f"{bytes_value:.1f} {unit}"
            bytes_value /= 1024.0
        return f"{bytes_value:.1f} PB"
    
    @classmethod
    def _get_uptime(cls):
        """获取系统运行时间"""
        if HAS_PSUTIL:
            try:
                boot_time = psutil.boot_time()
                uptime_seconds = time.time() - boot_time
                uptime_delta = timedelta(seconds=uptime_seconds)
                
                days = uptime_delta.days
                hours, remainder = divmod(uptime_delta.seconds, 3600)
                minutes, _ = divmod(remainder, 60)
                
                return f"{days}天 {hours}小时 {minutes}分钟"
            except:
                pass
        return "未知"
    
    @classmethod
    def get_maintenance_status(cls, tenant_id=None):
        """获取维护模式状态"""
        maintenance_mode = SystemSetting.get_setting('system.maintenance_mode', tenant_id, False)
        maintenance_message = SystemSetting.get_setting('system.maintenance_message', tenant_id, '系统正在维护中')
        
        return {
            'maintenance_mode': maintenance_mode,
            'maintenance_message': maintenance_message
        }
    
    @classmethod
    def set_maintenance_mode(cls, enabled, message=None, tenant_id=None, user_id=None):
        """设置维护模式"""
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        if user_id is None:
            user_id = getattr(g, 'user_id', None)
        
        try:
            # 设置维护模式状态
            SystemSetting.set_setting(
                'system.maintenance_mode',
                enabled,
                'system',
                '维护模式开关',
                user_id
            )
            
            # 设置维护消息
            if message:
                SystemSetting.set_setting(
                    'system.maintenance_message',
                    message,
                    'system',
                    '维护模式提示消息',
                    user_id
                )
            
            return True
        except Exception as e:
            raise e
    
    @classmethod
    def export_settings(cls, tenant_id=None):
        """导出系统设置"""
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        settings = SystemSetting.query.filter(
            SystemSetting.tenant_id == tenant_id,
            SystemSetting.is_enabled == True
        ).all()
        
        export_data = {
            'export_time': datetime.utcnow().isoformat(),
            'tenant_id': tenant_id,
            'settings': {}
        }
        
        for setting in settings:
            export_data['settings'][setting.key] = {
                'value': setting.value,
                'category': setting.category,
                'description': setting.description,
                'is_system': setting.is_system
            }
        
        return export_data
    
    @classmethod
    def import_settings(cls, import_data, tenant_id=None, user_id=None):
        """导入系统设置"""
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        if user_id is None:
            user_id = getattr(g, 'user_id', None)
        
        if tenant_id is None or user_id is None:
            raise ValueError("租户ID和用户ID不能为空")
        
        try:
            settings_data = import_data.get('settings', {})
            
            for key, setting_info in settings_data.items():
                # 跳过系统级设置的导入（安全考虑）
                if setting_info.get('is_system', False):
                    continue
                
                SystemSetting.set_setting(
                    key,
                    setting_info['value'],
                    setting_info.get('category', 'general'),
                    setting_info.get('description', '导入的设置'),
                    user_id
                )
            
            return True
        except Exception as e:
            raise e