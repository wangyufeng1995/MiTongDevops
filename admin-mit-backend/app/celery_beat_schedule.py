"""
Celery Beat 定时任务配置
"""
from celery.schedules import crontab


# Celery Beat 定时任务配置
CELERY_BEAT_SCHEDULE = {
    # ==================== 备份任务 ====================
    
    # 每小时检查一次是否需要执行自动备份
    'schedule-auto-backups': {
        'task': 'app.tasks.backup_tasks.schedule_auto_backups',
        'schedule': crontab(minute=0),  # 每小时整点执行
        'options': {
            'priority': 3
        }
    },
    
    # ==================== 网络探测任务 ====================
    
    # 每分钟调度一次自动探测任务
    'schedule-auto-probes': {
        'task': 'app.tasks.network_probe_tasks.schedule_auto_probes',
        'schedule': 60.0,  # 每 60 秒执行一次
        'options': {
            'queue': 'network_probes',
            'priority': 2
        }
    },
    
    # 每天凌晨 2 点清理 30 天前的探测结果
    'cleanup-old-probe-results': {
        'task': 'app.tasks.network_probe_tasks.cleanup_old_results',
        'schedule': crontab(hour=2, minute=0),  # 每天凌晨 2:00
        'kwargs': {'days': 30},
        'options': {
            'queue': 'network_probes',
            'priority': 1
        }
    },
    
    # 每周日凌晨 3 点清理 90 天前的探测结果（深度清理）
    'deep-cleanup-probe-results': {
        'task': 'app.tasks.network_probe_tasks.cleanup_old_results',
        'schedule': crontab(hour=3, minute=0, day_of_week=0),  # 每周日凌晨 3:00
        'kwargs': {'days': 90},
        'options': {
            'queue': 'network_probes',
            'priority': 1
        }
    },
    
    # ==================== 主机探测任务 ====================
    
    # 每天凌晨 2:30 清理 30 天前的主机探测结果
    'cleanup-old-host-probe-results': {
        'task': 'app.tasks.host_probe_tasks.cleanup_old_host_probe_results',
        'schedule': crontab(hour=2, minute=30),  # 每天凌晨 2:30
        'kwargs': {'days': 30},
        'options': {
            'priority': 1
        }
    },
    
    # 每周日凌晨 3:30 清理 90 天前的主机探测结果（深度清理）
    'deep-cleanup-host-probe-results': {
        'task': 'app.tasks.host_probe_tasks.cleanup_old_host_probe_results',
        'schedule': crontab(hour=3, minute=30, day_of_week=0),  # 每周日凌晨 3:30
        'kwargs': {'days': 90},
        'options': {
            'priority': 1
        }
    },
    
    # ==================== 审计日志清理任务 ====================
    # Feature: webshell-command-audit
    # Requirements: 5.5
    
    # 每天凌晨 4 点清理过期的审计日志
    # 保留天数从系统设置的安全设置中读取（默认90天）
    'cleanup-audit-logs': {
        'task': 'app.tasks.audit_cleanup_tasks.cleanup_audit_logs',
        'schedule': crontab(hour=4, minute=0),  # 每天凌晨 4:00
        'options': {
            'priority': 1
        }
    },
    
    # ==================== Ansible 任务 ====================
    
    # 每小时清理超时的 Ansible 执行记录（超过2小时未完成的任务）
    'cleanup-stale-ansible-executions': {
        'task': 'app.tasks.ansible_tasks.cleanup_stale_executions',
        'schedule': crontab(minute=30),  # 每小时30分执行
        'kwargs': {'timeout_hours': 2},
        'options': {
            'queue': 'ansible',
            'priority': 1
        }
    },
}
