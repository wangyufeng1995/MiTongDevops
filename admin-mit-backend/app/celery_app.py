"""
Celery 应用配置
"""
from celery import Celery
from app.core.config_manager import config_manager


def create_celery_app() -> Celery:
    """
    创建并配置 Celery 应用实例
    
    Returns:
        Celery: 配置好的 Celery 应用实例
    """
    # 获取 Celery 配置
    celery_config = config_manager.get_celery_config()
    redis_config = config_manager.get_redis_config()
    
    # 构建 Redis 连接 URL（使用密码）
    redis_password = redis_config.get('password', '')
    redis_host = redis_config['host']
    redis_port = redis_config['port']
    
    # 如果有密码，使用带密码的 URL 格式
    if redis_password:
        broker_url = f"redis://:{redis_password}@{redis_host}:{redis_port}/2"
        result_backend = f"redis://:{redis_password}@{redis_host}:{redis_port}/2"
    else:
        broker_url = f"redis://{redis_host}:{redis_port}/2"
        result_backend = f"redis://{redis_host}:{redis_port}/2"
    
    # 创建 Celery 应用
    celery_app = Celery('admin_system')
    
    # 配置 Celery
    celery_app.conf.update(
        broker_url=broker_url,
        result_backend=result_backend,
        task_serializer=celery_config.get('task_serializer', 'json'),
        result_serializer=celery_config.get('result_serializer', 'json'),
        accept_content=celery_config.get('accept_content', ['json']),
        timezone=celery_config.get('timezone', 'Asia/Shanghai'),
        enable_utc=True,
        
        # 任务结果配置
        result_expires=3600,  # 结果过期时间（秒）
        result_persistent=True,  # 持久化结果
        
        # 任务执行配置
        task_acks_late=True,  # 任务执行完成后才确认
        task_reject_on_worker_lost=True,  # worker 丢失时拒绝任务
        task_track_started=True,  # 跟踪任务开始状态
        
        # 任务重试配置
        task_default_retry_delay=60,  # 默认重试延迟（秒）
        task_max_retries=3,  # 默认最大重试次数
        
        # Worker 配置
        worker_prefetch_multiplier=4,  # 预取任务数量
        worker_max_tasks_per_child=1000,  # 每个 worker 子进程最多执行的任务数
        
        # 任务路由配置
        task_routes={
            'app.tasks.network_probe_tasks.*': {'queue': 'network_probes'},
            'app.tasks.alert_tasks.*': {'queue': 'alerts'},
            'app.tasks.ansible_tasks.*': {'queue': 'ansible'},
        },
        
        # 任务优先级配置
        task_default_priority=5,
        task_queue_max_priority=10,
        
        # 任务时间限制
        task_soft_time_limit=300,  # 软时间限制（秒）
        task_time_limit=600,  # 硬时间限制（秒）
        
        # 结果后端配置
        result_backend_transport_options={
            'master_name': 'mymaster',
            'visibility_timeout': 3600,
        },
        
        # Broker 配置
        broker_connection_retry_on_startup=True,
        broker_connection_retry=True,
        broker_connection_max_retries=10,
        
        # Windows + Python 3.14 兼容性配置
        # 禁用 worker 优化以避免 fast_trace_task 错误
        worker_pool='solo',  # 使用 solo pool 替代 prefork
        
        # 任务模块自动发现 - 在 Worker 启动时加载
        imports=[
            'app.tasks.network_probe_tasks',
            'app.tasks.host_probe_tasks',
            'app.tasks.audit_cleanup_tasks',
            'app.tasks.backup_tasks',
            'app.tasks.ansible_tasks',
        ],
    )
    
    return celery_app


# 创建全局 Celery 应用实例
celery = create_celery_app()
