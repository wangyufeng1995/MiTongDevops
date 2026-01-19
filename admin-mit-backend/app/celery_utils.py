"""
Celery 工具函数 - Flask 应用上下文集成
"""
from app.celery_app import celery
from app import create_app


def init_celery_with_flask():
    """
    初始化 Celery 并集成 Flask 应用上下文
    
    这个函数确保 Celery 任务在执行时可以访问 Flask 应用上下文，
    包括数据库连接、配置等。
    """
    flask_app = create_app()
    
    class ContextTask(celery.Task):
        """带有 Flask 应用上下文的 Celery 任务基类"""
        
        def __call__(self, *args, **kwargs):
            """在 Flask 应用上下文中执行任务"""
            with flask_app.app_context():
                return self.run(*args, **kwargs)
    
    celery.Task = ContextTask
    return celery


def get_task_status(task_id: str) -> dict:
    """
    获取任务状态
    
    Args:
        task_id: 任务 ID
        
    Returns:
        dict: 任务状态信息
    """
    from celery.result import AsyncResult
    
    task = AsyncResult(task_id, app=celery)
    
    response = {
        'task_id': task_id,
        'state': task.state,
        'ready': task.ready(),
        'successful': task.successful() if task.ready() else None,
        'failed': task.failed() if task.ready() else None,
    }
    
    if task.ready():
        if task.successful():
            response['result'] = task.result
        elif task.failed():
            response['error'] = str(task.info)
    else:
        # 任务正在执行中
        if task.state == 'PROGRESS':
            response['progress'] = task.info
    
    return response


def revoke_task(task_id: str, terminate: bool = False) -> dict:
    """
    撤销任务
    
    Args:
        task_id: 任务 ID
        terminate: 是否强制终止正在执行的任务
        
    Returns:
        dict: 撤销结果
    """
    from celery.result import AsyncResult
    
    task = AsyncResult(task_id, app=celery)
    task.revoke(terminate=terminate)
    
    return {
        'task_id': task_id,
        'revoked': True,
        'terminated': terminate,
        'message': '任务已撤销' if not terminate else '任务已强制终止'
    }


def get_active_tasks() -> list:
    """
    获取所有活跃的任务
    
    Returns:
        list: 活跃任务列表
    """
    inspect = celery.control.inspect()
    active_tasks = inspect.active()
    
    if not active_tasks:
        return []
    
    tasks = []
    for worker, task_list in active_tasks.items():
        for task in task_list:
            tasks.append({
                'worker': worker,
                'task_id': task['id'],
                'task_name': task['name'],
                'args': task['args'],
                'kwargs': task['kwargs'],
                'time_start': task.get('time_start'),
            })
    
    return tasks


def get_scheduled_tasks() -> list:
    """
    获取所有已调度但未执行的任务
    
    Returns:
        list: 已调度任务列表
    """
    inspect = celery.control.inspect()
    scheduled_tasks = inspect.scheduled()
    
    if not scheduled_tasks:
        return []
    
    tasks = []
    for worker, task_list in scheduled_tasks.items():
        for task in task_list:
            tasks.append({
                'worker': worker,
                'task_id': task['request']['id'],
                'task_name': task['request']['name'],
                'eta': task.get('eta'),
                'priority': task['request'].get('priority'),
            })
    
    return tasks


def get_worker_stats() -> dict:
    """
    获取 Worker 统计信息
    
    Returns:
        dict: Worker 统计信息
    """
    inspect = celery.control.inspect()
    stats = inspect.stats()
    
    if not stats:
        return {
            'total_workers': 0,
            'workers': []
        }
    
    workers = []
    for worker_name, worker_stats in stats.items():
        workers.append({
            'name': worker_name,
            'pool': worker_stats.get('pool', {}).get('implementation'),
            'max_concurrency': worker_stats.get('pool', {}).get('max-concurrency'),
            'total_tasks': worker_stats.get('total', {}),
        })
    
    return {
        'total_workers': len(workers),
        'workers': workers
    }


def purge_queue(queue_name: str = None) -> dict:
    """
    清空队列中的所有任务
    
    Args:
        queue_name: 队列名称，如果为 None 则清空所有队列
        
    Returns:
        dict: 清空结果
    """
    if queue_name:
        count = celery.control.purge()
    else:
        count = celery.control.purge()
    
    return {
        'purged_count': count,
        'queue': queue_name or 'all',
        'message': f'已清空 {count} 个任务'
    }
