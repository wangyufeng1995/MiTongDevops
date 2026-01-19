"""
健康检查 API
用于 Docker 容器健康检查和监控
"""
from flask import Blueprint, jsonify
from app.extensions import db
from sqlalchemy import text
import redis
from app.core.config_manager import config_manager
from app.services.auth_metrics_service import auth_metrics_service
from app.services.redis_metrics_service import redis_metrics_service
import time
import psutil
import os
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health_check():
    """
    健康检查端点
    检查数据库和 Redis 连接状态
    """
    start_time = time.time()
    
    health_status = {
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'checks': {},
        'metrics': {}
    }
    
    # 检查数据库连接
    db_start = time.time()
    try:
        db.session.execute(text('SELECT 1'))
        db_duration = (time.time() - db_start) * 1000
        health_status['checks']['database'] = {
            'status': 'healthy',
            'response_time_ms': round(db_duration, 2)
        }
    except Exception as e:
        health_status['status'] = 'unhealthy'
        health_status['checks']['database'] = {
            'status': 'unhealthy',
            'error': str(e)
        }
    
    # 检查 Redis 连接
    redis_start = time.time()
    try:
        redis_config = config_manager.get_redis_config()
        r = redis.Redis(
            host=redis_config.get('host', 'localhost'),
            port=redis_config.get('port', 6379),
            db=redis_config.get('db', 0),
            socket_timeout=2
        )
        r.ping()
        redis_duration = (time.time() - redis_start) * 1000
        health_status['checks']['redis'] = {
            'status': 'healthy',
            'response_time_ms': round(redis_duration, 2)
        }
    except Exception as e:
        health_status['status'] = 'unhealthy'
        health_status['checks']['redis'] = {
            'status': 'unhealthy',
            'error': str(e)
        }
    
    # 系统指标
    try:
        health_status['metrics'] = {
            'cpu_percent': psutil.cpu_percent(interval=0.1),
            'memory_percent': psutil.virtual_memory().percent,
            'disk_percent': psutil.disk_usage('/').percent,
            'process_memory_mb': round(psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024, 2)
        }
    except Exception as e:
        health_status['metrics']['error'] = str(e)
    
    # 总响应时间
    health_status['response_time_ms'] = round((time.time() - start_time) * 1000, 2)
    
    status_code = 200 if health_status['status'] == 'healthy' else 503
    return jsonify(health_status), status_code

@health_bp.route('/ready', methods=['GET'])
def readiness_check():
    """
    就绪检查端点
    检查应用是否准备好接收流量
    """
    ready_status = {
        'status': 'ready',
        'timestamp': datetime.utcnow().isoformat(),
        'checks': {}
    }
    
    # 检查数据库连接
    try:
        db.session.execute(text('SELECT 1'))
        ready_status['checks']['database'] = 'ready'
    except Exception as e:
        ready_status['status'] = 'not_ready'
        ready_status['checks']['database'] = f'not_ready: {str(e)}'
    
    # 检查 Redis 连接
    try:
        redis_config = config_manager.get_redis_config()
        r = redis.Redis(
            host=redis_config.get('host', 'localhost'),
            port=redis_config.get('port', 6379),
            db=redis_config.get('db', 0),
            socket_timeout=2
        )
        r.ping()
        ready_status['checks']['redis'] = 'ready'
    except Exception as e:
        ready_status['status'] = 'not_ready'
        ready_status['checks']['redis'] = f'not_ready: {str(e)}'
    
    status_code = 200 if ready_status['status'] == 'ready' else 503
    return jsonify(ready_status), status_code

@health_bp.route('/live', methods=['GET'])
def liveness_check():
    """
    存活检查端点
    检查应用是否仍在运行
    """
    return jsonify({
        'status': 'alive',
        'timestamp': datetime.utcnow().isoformat(),
        'uptime_seconds': round(time.time() - psutil.Process(os.getpid()).create_time(), 2)
    }), 200

@health_bp.route('/metrics', methods=['GET'])
def metrics():
    """
    Prometheus 指标端点
    导出应用指标供 Prometheus 抓取
    """
    try:
        # 系统指标
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        process = psutil.Process(os.getpid())
        
        # 数据库连接池指标
        db_pool_size = db.engine.pool.size()
        db_pool_checked_out = db.engine.pool.checkedout()
        
        # 认证指标
        auth_metrics = auth_metrics_service.export_prometheus_metrics()
        
        # Redis 指标
        redis_metrics = redis_metrics_service.export_prometheus_metrics()
        
        metrics_text = f"""# HELP app_cpu_usage_percent CPU usage percentage
# TYPE app_cpu_usage_percent gauge
app_cpu_usage_percent {cpu_percent}

# HELP app_memory_usage_percent Memory usage percentage
# TYPE app_memory_usage_percent gauge
app_memory_usage_percent {memory.percent}

# HELP app_memory_usage_bytes Memory usage in bytes
# TYPE app_memory_usage_bytes gauge
app_memory_usage_bytes {memory.used}

# HELP app_disk_usage_percent Disk usage percentage
# TYPE app_disk_usage_percent gauge
app_disk_usage_percent {disk.percent}

# HELP app_process_memory_bytes Process memory usage in bytes
# TYPE app_process_memory_bytes gauge
app_process_memory_bytes {process.memory_info().rss}

# HELP app_process_cpu_percent Process CPU usage percentage
# TYPE app_process_cpu_percent gauge
app_process_cpu_percent {process.cpu_percent(interval=0.1)}

# HELP app_db_pool_size Database connection pool size
# TYPE app_db_pool_size gauge
app_db_pool_size {db_pool_size}

# HELP app_db_pool_checked_out Database connections checked out
# TYPE app_db_pool_checked_out gauge
app_db_pool_checked_out {db_pool_checked_out}

# HELP app_uptime_seconds Application uptime in seconds
# TYPE app_uptime_seconds counter
app_uptime_seconds {round(time.time() - process.create_time(), 2)}

{auth_metrics}
{redis_metrics}
"""
        
        return metrics_text, 200, {'Content-Type': 'text/plain; charset=utf-8'}
        
    except Exception as e:
        return f"# Error generating metrics: {str(e)}", 500, {'Content-Type': 'text/plain; charset=utf-8'}


def _check_celery_health() -> dict:
    """
    检查 Celery 健康状态
    
    Returns:
        dict: Celery 健康状态信息
    """
    celery_status = {
        'status': 'unknown',
        'workers': [],
        'queues': {},
        'scheduled_tasks': 0,
        'active_tasks': 0,
        'reserved_tasks': 0
    }
    
    try:
        from app.celery_app import celery
        
        # 检查 Celery 连接
        inspect = celery.control.inspect(timeout=2.0)
        
        # 获取活跃的 workers
        active_workers = inspect.active()
        if active_workers:
            celery_status['status'] = 'healthy'
            for worker_name, tasks in active_workers.items():
                worker_info = {
                    'name': worker_name,
                    'active_tasks': len(tasks),
                    'status': 'online'
                }
                celery_status['workers'].append(worker_info)
                celery_status['active_tasks'] += len(tasks)
        else:
            # 尝试 ping workers
            ping_result = inspect.ping()
            if ping_result:
                celery_status['status'] = 'healthy'
                for worker_name in ping_result.keys():
                    celery_status['workers'].append({
                        'name': worker_name,
                        'active_tasks': 0,
                        'status': 'online'
                    })
            else:
                celery_status['status'] = 'unhealthy'
                celery_status['error'] = 'No workers available'
        
        # 获取预留的任务
        reserved = inspect.reserved()
        if reserved:
            for worker_name, tasks in reserved.items():
                celery_status['reserved_tasks'] += len(tasks)
        
        # 获取调度的任务
        scheduled = inspect.scheduled()
        if scheduled:
            for worker_name, tasks in scheduled.items():
                celery_status['scheduled_tasks'] += len(tasks)
        
        # 获取队列信息
        try:
            redis_config = config_manager.get_redis_config()
            redis_password = redis_config.get('password', '')
            redis_host = redis_config['host']
            redis_port = redis_config['port']
            
            r = redis.Redis(
                host=redis_host,
                port=redis_port,
                db=2,  # Celery 使用 db 2
                password=redis_password if redis_password else None,
                socket_timeout=2
            )
            
            # 检查常用队列
            queues = ['celery', 'network_probes', 'alerts', 'ansible']
            for queue_name in queues:
                queue_length = r.llen(queue_name)
                celery_status['queues'][queue_name] = queue_length
                
        except Exception as e:
            logger.warning(f"获取 Celery 队列信息失败: {str(e)}")
            
    except Exception as e:
        celery_status['status'] = 'unhealthy'
        celery_status['error'] = str(e)
        logger.error(f"检查 Celery 健康状态失败: {str(e)}")
    
    return celery_status


def _check_sse_health() -> dict:
    """
    检查 SSE 服务健康状态
    
    Returns:
        dict: SSE 健康状态信息
    """
    sse_status = {
        'status': 'unknown',
        'total_connections': 0,
        'active_connections': 0,
        'inactive_connections': 0
    }
    
    try:
        from app.services.network_sse_service import network_sse_service
        
        # 获取 SSE 连接统计
        stats = network_sse_service.get_connection_stats()
        
        sse_status['status'] = 'healthy'
        sse_status['total_connections'] = stats.get('total_connections', 0)
        sse_status['active_connections'] = stats.get('active_connections', 0)
        sse_status['inactive_connections'] = stats.get('inactive_connections', 0)
        sse_status['timestamp'] = stats.get('timestamp')
        
    except Exception as e:
        sse_status['status'] = 'unhealthy'
        sse_status['error'] = str(e)
        logger.error(f"检查 SSE 健康状态失败: {str(e)}")
    
    return sse_status


@health_bp.route('/services', methods=['GET'])
def services_health():
    """
    服务健康检查端点
    检查 Celery 和 SSE 服务状态
    """
    start_time = time.time()
    
    services_status = {
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'services': {}
    }
    
    # 检查 Celery 状态
    celery_status = _check_celery_health()
    services_status['services']['celery'] = celery_status
    if celery_status['status'] != 'healthy':
        services_status['status'] = 'degraded'
    
    # 检查 SSE 状态
    sse_status = _check_sse_health()
    services_status['services']['sse'] = sse_status
    if sse_status['status'] != 'healthy':
        services_status['status'] = 'degraded'
    
    # 检查数据库连接
    db_start = time.time()
    try:
        db.session.execute(text('SELECT 1'))
        db_duration = (time.time() - db_start) * 1000
        services_status['services']['database'] = {
            'status': 'healthy',
            'response_time_ms': round(db_duration, 2)
        }
    except Exception as e:
        services_status['status'] = 'unhealthy'
        services_status['services']['database'] = {
            'status': 'unhealthy',
            'error': str(e)
        }
    
    # 检查 Redis 连接
    redis_start = time.time()
    try:
        redis_config = config_manager.get_redis_config()
        r = redis.Redis(
            host=redis_config.get('host', 'localhost'),
            port=redis_config.get('port', 6379),
            db=redis_config.get('db', 0),
            password=redis_config.get('password', '') or None,
            socket_timeout=2
        )
        r.ping()
        redis_duration = (time.time() - redis_start) * 1000
        services_status['services']['redis'] = {
            'status': 'healthy',
            'response_time_ms': round(redis_duration, 2)
        }
    except Exception as e:
        services_status['status'] = 'unhealthy'
        services_status['services']['redis'] = {
            'status': 'unhealthy',
            'error': str(e)
        }
    
    # 总响应时间
    services_status['response_time_ms'] = round((time.time() - start_time) * 1000, 2)
    
    status_code = 200 if services_status['status'] == 'healthy' else (
        503 if services_status['status'] == 'unhealthy' else 200
    )
    
    return jsonify(services_status), status_code


@health_bp.route('/celery', methods=['GET'])
def celery_health():
    """
    Celery 健康检查端点
    """
    start_time = time.time()
    
    celery_status = _check_celery_health()
    celery_status['timestamp'] = datetime.utcnow().isoformat()
    celery_status['response_time_ms'] = round((time.time() - start_time) * 1000, 2)
    
    status_code = 200 if celery_status['status'] == 'healthy' else 503
    return jsonify(celery_status), status_code


@health_bp.route('/sse', methods=['GET'])
def sse_health():
    """
    SSE 服务健康检查端点
    """
    start_time = time.time()
    
    sse_status = _check_sse_health()
    sse_status['timestamp'] = datetime.utcnow().isoformat()
    sse_status['response_time_ms'] = round((time.time() - start_time) * 1000, 2)
    
    status_code = 200 if sse_status['status'] == 'healthy' else 503
    return jsonify(sse_status), status_code
