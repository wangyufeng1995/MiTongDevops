#!/usr/bin/env python
"""
Celery Worker 启动脚本
"""
import os
import sys

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.celery_app import celery
from app.celery_beat_schedule import CELERY_BEAT_SCHEDULE
from app import create_app

# 创建 Flask 应用上下文
flask_app = create_app()

# 配置 Celery Beat 定时任务
celery.conf.beat_schedule = CELERY_BEAT_SCHEDULE

# 在 Flask 应用上下文中自动发现任务模块
with flask_app.app_context():
    # 显式导入任务模块以确保任务被注册
    from app.tasks import network_probe_tasks
    from app.tasks import host_probe_tasks
    from app.tasks import audit_cleanup_tasks
    from app.tasks import backup_tasks
    from app.tasks import ansible_tasks
    
    # 自动发现任务模块
    celery.autodiscover_tasks(['app.tasks'])


if __name__ == '__main__':
    # 启动 Celery Worker
    # 使用方式:
    # python celery_worker.py worker --loglevel=info
    # python celery_worker.py beat --loglevel=info
    # python celery_worker.py worker --beat --loglevel=info  # 同时启动 worker 和 beat
    celery.start()
