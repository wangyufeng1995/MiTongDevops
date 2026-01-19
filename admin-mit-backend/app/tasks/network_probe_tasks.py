"""
网络探测 Celery 任务
"""
import logging
from typing import Dict, Any
from celery import Task
from app.celery_app import celery

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


class NetworkProbeTask(Task):
    """网络探测任务基类"""
    
    autoretry_for = (Exception,)
    retry_kwargs = {'max_retries': 3, 'countdown': 60}
    retry_backoff = True
    retry_backoff_max = 600
    retry_jitter = True
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """任务失败时的回调"""
        probe_id = kwargs.get('probe_id', 'unknown')
        logger.error(f"[网络探测] 任务失败: probe_id={probe_id}, error={exc}")
    
    def on_success(self, retval, task_id, args, kwargs):
        """任务成功时的回调"""
        pass  # 成功日志已在任务中输出


@celery.task(
    base=NetworkProbeTask,
    bind=True,
    name='app.tasks.network_probe_tasks.execute_probe',
    queue='network_probes',
    priority=5
)
def execute_probe(self, probe_id: int, tenant_id: int, probe_type: str = 'auto') -> Dict[str, Any]:
    """执行网络探测任务"""
    app = get_flask_app()
    with app.app_context():
        from app.extensions import db
        from app.models.network import NetworkProbe, NetworkProbeResult
        from app.services.network_probe_service import NetworkProbeService
        from app.services.network_cache_service import network_cache_service
        
        try:
            probe = NetworkProbe.query.filter_by(
                id=probe_id,
                tenant_id=tenant_id
            ).first()
            
            if not probe:
                logger.error(f"[网络探测] 任务不存在: probe_id={probe_id}")
                raise ValueError(f"探测任务不存在: probe_id={probe_id}")
            
            if not probe.enabled:
                return {'success': False, 'message': '探测任务已禁用', 'probe_id': probe_id}
            
            probe_service = NetworkProbeService()
            
            if probe.protocol in ['http', 'https']:
                result = probe_service.execute_http_probe(probe, probe_type)
            elif probe.protocol == 'websocket':
                result = probe_service.execute_websocket_probe(probe, probe_type)
            elif probe.protocol == 'tcp':
                result = probe_service.execute_tcp_probe(probe, probe_type)
            elif probe.protocol == 'udp':
                result = probe_service.execute_udp_probe(probe, probe_type)
            else:
                raise ValueError(f"不支持的协议类型: {probe.protocol}")
            
            db.session.add(result)
            db.session.commit()
            
            # 同步结果到缓存（静默处理错误）
            try:
                result_data = {
                    'id': result.id,
                    'probe_id': probe_id,
                    'status': result.status,
                    'response_time': result.response_time,
                    'status_code': result.status_code,
                    'error_message': result.error_message,
                    'probed_at': result.probed_at.isoformat() if result.probed_at else None,
                    'probe_type': probe_type
                }
                network_cache_service.sync_probe_result_to_cache(probe_id, result_data)
                status_map = {'success': 'success', 'timeout': 'timeout'}
                network_cache_service.update_probe_status(
                    probe_id, 
                    status_map.get(result.status, 'failed')
                )
            except Exception:
                pass  # 缓存同步失败不影响主流程
            
            # 输出简洁日志
            status_icon = '[OK]' if result.status == 'success' else '[FAIL]'
            logger.info(f"[网络探测] {status_icon} {probe.name}: {result.status} ({result.response_time or 0}ms)")
            
            return {
                'success': True,
                'probe_id': probe_id,
                'result_id': result.id,
                'status': result.status,
                'response_time': result.response_time,
                'message': '探测任务执行成功'
            }
            
        except Exception as e:
            logger.error(f"[网络探测] 异常: probe_id={probe_id}, error={str(e)}")
            raise


@celery.task(
    name='app.tasks.network_probe_tasks.execute_batch_probes',
    queue='network_probes',
    priority=3
)
def execute_batch_probes(probe_ids: list, tenant_id: int, probe_type: str = 'auto') -> Dict[str, Any]:
    """批量执行网络探测任务"""
    logger.info(f"[网络探测] 批量任务: {len(probe_ids)} 个探测")
    
    results = []
    for probe_id in probe_ids:
        try:
            task = execute_probe.apply_async(
                kwargs={'probe_id': probe_id, 'tenant_id': tenant_id, 'probe_type': probe_type}
            )
            results.append({'probe_id': probe_id, 'task_id': task.id, 'status': 'queued'})
        except Exception as e:
            results.append({'probe_id': probe_id, 'status': 'failed', 'error': str(e)})
    
    return {'success': True, 'total': len(probe_ids), 'results': results}


@celery.task(
    name='app.tasks.network_probe_tasks.schedule_auto_probes',
    queue='network_probes',
    priority=2
)
def schedule_auto_probes() -> Dict[str, Any]:
    """
    调度所有启用自动探测的任务
    
    此任务每 60 秒由 Celery Beat 调用一次，
    为每个启用自动探测的任务创建独立的定时调度。
    """
    app = get_flask_app()
    with app.app_context():
        from app.models.network import NetworkProbe
        
        try:
            probes = NetworkProbe.query.filter_by(
                enabled=True,
                auto_probe_enabled=True
            ).all()
            
            if not probes:
                return {'success': True, 'total_probes': 0, 'scheduled_count': 0}
            
            scheduled_count = 0
            for probe in probes:
                try:
                    # 为每个探测任务创建独立的定时调度
                    schedule_single_probe.apply_async(
                        kwargs={
                            'probe_id': probe.id,
                            'tenant_id': probe.tenant_id,
                            'interval_seconds': probe.interval_seconds
                        }
                    )
                    scheduled_count += 1
                except Exception as e:
                    logger.warning(f"[网络探测] 调度失败: probe_id={probe.id}, error={str(e)}")
            
            if scheduled_count > 0:
                logger.info(f"[网络探测] 初始化调度: {scheduled_count} 个任务")
            
            return {
                'success': True,
                'total_probes': len(probes),
                'scheduled_count': scheduled_count
            }
            
        except Exception as e:
            logger.error(f"[网络探测] 自动调度失败: {str(e)}")
            return {'success': False, 'error': str(e)}


@celery.task(
    name='app.tasks.network_probe_tasks.schedule_single_probe',
    queue='network_probes',
    priority=3
)
def schedule_single_probe(probe_id: int, tenant_id: int, interval_seconds: int) -> Dict[str, Any]:
    """
    为单个探测任务创建独立的定时调度
    
    使用 Redis 锁机制确保每个探测任务按照自己的间隔独立执行，
    避免重复调度。
    """
    import redis
    from datetime import datetime
    from app.core.config_manager import config_manager
    
    app = get_flask_app()
    with app.app_context():
        from app.models.network import NetworkProbe
        
        try:
            # 获取 Redis 连接
            redis_config = config_manager.get_redis_config()
            redis_password = redis_config.get('password', '')
            redis_client = redis.Redis(
                host=redis_config['host'],
                port=redis_config['port'],
                password=redis_password if redis_password else None,
                db=3,  # 使用独立的 db
                decode_responses=True
            )
            
            # 检查探测任务是否仍然启用
            probe = NetworkProbe.query.filter_by(
                id=probe_id,
                tenant_id=tenant_id,
                enabled=True,
                auto_probe_enabled=True
            ).first()
            
            if not probe:
                # 任务已禁用，清理调度锁
                redis_client.delete(f"probe_schedule:{probe_id}")
                return {'success': False, 'message': '探测任务已禁用或不存在'}
            
            # 使用 Redis 检查是否需要执行（基于间隔时间）
            schedule_key = f"probe_schedule:{probe_id}"
            last_run_key = f"probe_last_run:{probe_id}"
            
            # 尝试获取调度锁（防止并发调度）
            lock_key = f"probe_lock:{probe_id}"
            if not redis_client.set(lock_key, "1", nx=True, ex=interval_seconds):
                # 已有调度在运行，跳过
                return {'success': True, 'message': '调度已在运行中', 'skipped': True}
            
            try:
                # 检查上次执行时间
                last_run = redis_client.get(last_run_key)
                now = datetime.utcnow().timestamp()
                
                should_execute = False
                if last_run is None:
                    should_execute = True
                else:
                    time_since_last = now - float(last_run)
                    if time_since_last >= interval_seconds:
                        should_execute = True
                
                if should_execute:
                    # 更新上次执行时间
                    redis_client.set(last_run_key, str(now), ex=interval_seconds * 2)
                    
                    # 执行探测
                    execute_probe.apply_async(
                        kwargs={
                            'probe_id': probe_id,
                            'tenant_id': tenant_id,
                            'probe_type': 'auto'
                        }
                    )
                    
                    # 调度下一次执行
                    schedule_single_probe.apply_async(
                        kwargs={
                            'probe_id': probe_id,
                            'tenant_id': tenant_id,
                            'interval_seconds': interval_seconds
                        },
                        countdown=interval_seconds  # 延迟 interval_seconds 秒后执行
                    )
                    
                    return {
                        'success': True,
                        'probe_id': probe_id,
                        'executed': True,
                        'next_run_in': interval_seconds
                    }
                else:
                    # 还没到执行时间，计算剩余时间后重新调度
                    remaining = interval_seconds - (now - float(last_run))
                    if remaining > 0:
                        schedule_single_probe.apply_async(
                            kwargs={
                                'probe_id': probe_id,
                                'tenant_id': tenant_id,
                                'interval_seconds': interval_seconds
                            },
                            countdown=int(remaining)
                        )
                    
                    return {
                        'success': True,
                        'probe_id': probe_id,
                        'executed': False,
                        'next_run_in': int(remaining) if remaining > 0 else interval_seconds
                    }
                    
            finally:
                # 释放锁
                redis_client.delete(lock_key)
                
        except Exception as e:
            logger.error(f"[网络探测] 单任务调度失败: probe_id={probe_id}, error={str(e)}")
            return {'success': False, 'error': str(e)}


@celery.task(
    name='app.tasks.network_probe_tasks.cleanup_old_results',
    queue='network_probes',
    priority=1
)
def cleanup_old_results(days: int = 30) -> Dict[str, Any]:
    """清理旧的探测结果"""
    from datetime import datetime, timedelta
    
    app = get_flask_app()
    with app.app_context():
        from app.extensions import db
        from app.models.network import NetworkProbeResult
        
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            deleted_count = NetworkProbeResult.query.filter(
                NetworkProbeResult.probed_at < cutoff_date
            ).delete()
            db.session.commit()
            
            if deleted_count > 0:
                logger.info(f"[网络探测] 清理: 删除 {deleted_count} 条旧记录")
            
            return {'success': True, 'deleted_count': deleted_count}
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"[网络探测] 清理失败: {str(e)}")
            return {'success': False, 'error': str(e)}
