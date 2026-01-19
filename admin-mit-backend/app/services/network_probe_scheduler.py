"""
网络探测任务调度服务
"""
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from celery import current_app as celery_app
from celery.result import AsyncResult
from app.extensions import db
from app.models.network import NetworkProbe
from app.services.network_cache_service import network_cache_service

logger = logging.getLogger(__name__)


class NetworkProbeScheduler:
    """网络探测任务调度器"""
    
    def __init__(self):
        """初始化调度器"""
        self.cache_service = network_cache_service
        self._task_registry = {}  # 任务注册表：{probe_id: task_info}
    
    def start_auto_probe(self, probe_id: int, tenant_id: int) -> Dict[str, Any]:
        """
        启动自动探测任务
        
        Args:
            probe_id: 探测任务 ID
            tenant_id: 租户 ID
            
        Returns:
            Dict: 启动结果
        """
        logger.info(f"启动自动探测任务: probe_id={probe_id}, tenant_id={tenant_id}")
        
        try:
            # 查询探测任务
            probe = NetworkProbe.query.filter_by(
                id=probe_id,
                tenant_id=tenant_id
            ).first()
            
            if not probe:
                return {
                    'success': False,
                    'message': '探测任务不存在'
                }
            
            if not probe.enabled:
                return {
                    'success': False,
                    'message': '探测任务已禁用，无法启动自动探测'
                }
            
            # 更新数据库状态
            probe.auto_probe_enabled = True
            db.session.commit()
            
            # 更新缓存中的探测状态
            self.cache_service.update_probe_status(probe_id, 'running')
            
            # 立即执行一次探测
            self._execute_immediate_probe(probe_id, tenant_id)
            
            # 注册到任务注册表
            self._register_probe_task(probe_id, probe.interval_seconds)
            
            logger.info(f"自动探测任务已启动: probe_id={probe_id}, interval={probe.interval_seconds}s")
            
            return {
                'success': True,
                'message': '自动探测任务已启动',
                'probe_id': probe_id,
                'interval_seconds': probe.interval_seconds
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"启动自动探测任务失败: probe_id={probe_id}, error={str(e)}")
            return {
                'success': False,
                'message': f'启动失败: {str(e)}'
            }
    
    def stop_auto_probe(self, probe_id: int, tenant_id: int) -> Dict[str, Any]:
        """
        停止自动探测任务
        
        Args:
            probe_id: 探测任务 ID
            tenant_id: 租户 ID
            
        Returns:
            Dict: 停止结果
        """
        logger.info(f"停止自动探测任务: probe_id={probe_id}, tenant_id={tenant_id}")
        
        try:
            # 查询探测任务
            probe = NetworkProbe.query.filter_by(
                id=probe_id,
                tenant_id=tenant_id
            ).first()
            
            if not probe:
                return {
                    'success': False,
                    'message': '探测任务不存在'
                }
            
            # 更新数据库状态
            probe.auto_probe_enabled = False
            db.session.commit()
            
            # 更新缓存中的探测状态
            self.cache_service.update_probe_status(probe_id, 'stopped')
            
            # 从任务注册表中移除
            self._unregister_probe_task(probe_id)
            
            logger.info(f"自动探测任务已停止: probe_id={probe_id}")
            
            return {
                'success': True,
                'message': '自动探测任务已停止',
                'probe_id': probe_id
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"停止自动探测任务失败: probe_id={probe_id}, error={str(e)}")
            return {
                'success': False,
                'message': f'停止失败: {str(e)}'
            }
    
    def execute_manual_probe(self, probe_id: int, tenant_id: int) -> Dict[str, Any]:
        """
        执行主动探测（立即执行）
        
        Args:
            probe_id: 探测任务 ID
            tenant_id: 租户 ID
            
        Returns:
            Dict: 执行结果
        """
        logger.info(f"执行主动探测: probe_id={probe_id}, tenant_id={tenant_id}")
        
        try:
            # 查询探测任务
            probe = NetworkProbe.query.filter_by(
                id=probe_id,
                tenant_id=tenant_id
            ).first()
            
            if not probe:
                return {
                    'success': False,
                    'message': '探测任务不存在'
                }
            
            if not probe.enabled:
                return {
                    'success': False,
                    'message': '探测任务已禁用'
                }
            
            # 提交探测任务到 Celery 队列
            from app.tasks.network_probe_tasks import execute_probe
            
            task = execute_probe.apply_async(
                kwargs={
                    'probe_id': probe_id,
                    'tenant_id': tenant_id,
                    'probe_type': 'manual'
                },
                queue='network_probes',
                priority=8  # 主动探测优先级较高
            )
            
            # 更新缓存中的探测状态
            self.cache_service.update_probe_status(probe_id, 'running')
            
            logger.info(f"主动探测任务已提交: probe_id={probe_id}, task_id={task.id}")
            
            return {
                'success': True,
                'message': '探测任务已提交',
                'probe_id': probe_id,
                'task_id': task.id
            }
            
        except Exception as e:
            logger.error(f"执行主动探测失败: probe_id={probe_id}, error={str(e)}")
            return {
                'success': False,
                'message': f'执行失败: {str(e)}'
            }
    
    def update_probe_interval(self, probe_id: int, tenant_id: int, interval_seconds: int) -> Dict[str, Any]:
        """
        更新探测间隔
        
        Args:
            probe_id: 探测任务 ID
            tenant_id: 租户 ID
            interval_seconds: 新的间隔时间（秒）
            
        Returns:
            Dict: 更新结果
        """
        logger.info(f"更新探测间隔: probe_id={probe_id}, interval={interval_seconds}s")
        
        try:
            # 验证间隔时间
            if interval_seconds < 10 or interval_seconds > 86400:
                return {
                    'success': False,
                    'message': '探测间隔必须在 10 秒到 86400 秒（24小时）之间'
                }
            
            # 查询探测任务
            probe = NetworkProbe.query.filter_by(
                id=probe_id,
                tenant_id=tenant_id
            ).first()
            
            if not probe:
                return {
                    'success': False,
                    'message': '探测任务不存在'
                }
            
            # 更新间隔时间
            old_interval = probe.interval_seconds
            probe.interval_seconds = interval_seconds
            db.session.commit()
            
            # 如果自动探测已启用，需要重新注册任务
            if probe.auto_probe_enabled:
                self._unregister_probe_task(probe_id)
                self._register_probe_task(probe_id, interval_seconds)
            
            logger.info(
                f"探测间隔已更新: probe_id={probe_id}, "
                f"old_interval={old_interval}s, new_interval={interval_seconds}s"
            )
            
            return {
                'success': True,
                'message': '探测间隔已更新',
                'probe_id': probe_id,
                'old_interval': old_interval,
                'new_interval': interval_seconds
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"更新探测间隔失败: probe_id={probe_id}, error={str(e)}")
            return {
                'success': False,
                'message': f'更新失败: {str(e)}'
            }
    
    def get_probe_status(self, probe_id: int) -> Dict[str, Any]:
        """
        获取探测任务状态
        
        Args:
            probe_id: 探测任务 ID
            
        Returns:
            Dict: 探测状态信息
        """
        try:
            # 从缓存获取状态
            cached_status = self.cache_service.get_probe_status(probe_id)
            
            # 从数据库获取任务信息
            probe = NetworkProbe.query.get(probe_id)
            
            if not probe:
                return {
                    'success': False,
                    'message': '探测任务不存在'
                }
            
            # 获取最近的探测结果
            last_result = probe.probe_results.order_by(
                db.desc('probed_at')
            ).first()
            
            # 检查任务注册表
            task_info = self._task_registry.get(probe_id)
            
            status_info = {
                'success': True,
                'probe_id': probe_id,
                'probe_name': probe.name,
                'enabled': probe.enabled,
                'auto_probe_enabled': probe.auto_probe_enabled,
                'interval_seconds': probe.interval_seconds,
                'status': cached_status or ('running' if probe.auto_probe_enabled else 'stopped'),
                'last_result': last_result.to_dict() if last_result else None,
                'task_registered': task_info is not None,
                'next_run_time': self._calculate_next_run_time(probe_id, last_result)
            }
            
            return status_info
            
        except Exception as e:
            logger.error(f"获取探测状态失败: probe_id={probe_id}, error={str(e)}")
            return {
                'success': False,
                'message': f'获取状态失败: {str(e)}'
            }
    
    def get_all_active_probes(self, tenant_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        获取所有活跃的探测任务
        
        Args:
            tenant_id: 租户 ID（可选，用于过滤）
            
        Returns:
            List[Dict]: 活跃探测任务列表
        """
        try:
            query = NetworkProbe.query.filter_by(
                enabled=True,
                auto_probe_enabled=True
            )
            
            if tenant_id:
                query = query.filter_by(tenant_id=tenant_id)
            
            probes = query.all()
            
            active_probes = []
            for probe in probes:
                status = self.get_probe_status(probe.id)
                if status.get('success'):
                    active_probes.append(status)
            
            return active_probes
            
        except Exception as e:
            logger.error(f"获取活跃探测任务失败: error={str(e)}")
            return []
    
    def restart_all_auto_probes(self, tenant_id: Optional[int] = None) -> Dict[str, Any]:
        """
        重启所有自动探测任务（用于系统启动或配置更新后）
        
        Args:
            tenant_id: 租户 ID（可选，用于过滤）
            
        Returns:
            Dict: 重启结果
        """
        logger.info(f"重启所有自动探测任务: tenant_id={tenant_id}")
        
        try:
            query = NetworkProbe.query.filter_by(
                enabled=True,
                auto_probe_enabled=True
            )
            
            if tenant_id:
                query = query.filter_by(tenant_id=tenant_id)
            
            probes = query.all()
            
            restarted_count = 0
            failed_count = 0
            
            for probe in probes:
                try:
                    # 重新注册任务
                    self._register_probe_task(probe.id, probe.interval_seconds)
                    
                    # 更新缓存状态
                    self.cache_service.update_probe_status(probe.id, 'running')
                    
                    restarted_count += 1
                    
                except Exception as e:
                    logger.error(f"重启探测任务失败: probe_id={probe.id}, error={str(e)}")
                    failed_count += 1
            
            logger.info(
                f"自动探测任务重启完成: "
                f"total={len(probes)}, restarted={restarted_count}, failed={failed_count}"
            )
            
            return {
                'success': True,
                'total': len(probes),
                'restarted': restarted_count,
                'failed': failed_count,
                'message': f'成功重启 {restarted_count} 个自动探测任务'
            }
            
        except Exception as e:
            logger.error(f"重启所有自动探测任务失败: error={str(e)}")
            return {
                'success': False,
                'message': f'重启失败: {str(e)}'
            }
    
    def _execute_immediate_probe(self, probe_id: int, tenant_id: int) -> None:
        """
        立即执行一次探测（内部方法）
        
        Args:
            probe_id: 探测任务 ID
            tenant_id: 租户 ID
        """
        try:
            from app.tasks.network_probe_tasks import execute_probe
            
            execute_probe.apply_async(
                kwargs={
                    'probe_id': probe_id,
                    'tenant_id': tenant_id,
                    'probe_type': 'auto'
                },
                queue='network_probes',
                priority=5
            )
            
            logger.debug(f"立即执行探测任务: probe_id={probe_id}")
            
        except Exception as e:
            logger.error(f"立即执行探测任务失败: probe_id={probe_id}, error={str(e)}")
    
    def _register_probe_task(self, probe_id: int, interval_seconds: int) -> None:
        """
        注册探测任务到任务注册表
        
        Args:
            probe_id: 探测任务 ID
            interval_seconds: 探测间隔（秒）
        """
        self._task_registry[probe_id] = {
            'interval_seconds': interval_seconds,
            'registered_at': datetime.utcnow(),
            'last_executed_at': None
        }
        
        logger.debug(f"探测任务已注册: probe_id={probe_id}, interval={interval_seconds}s")
    
    def _unregister_probe_task(self, probe_id: int) -> None:
        """
        从任务注册表中移除探测任务
        
        Args:
            probe_id: 探测任务 ID
        """
        if probe_id in self._task_registry:
            del self._task_registry[probe_id]
            logger.debug(f"探测任务已注销: probe_id={probe_id}")
    
    def _calculate_next_run_time(self, probe_id: int, last_result) -> Optional[str]:
        """
        计算下次执行时间
        
        Args:
            probe_id: 探测任务 ID
            last_result: 最近的探测结果
            
        Returns:
            str: 下次执行时间（ISO 格式）
        """
        try:
            task_info = self._task_registry.get(probe_id)
            
            if not task_info:
                return None
            
            if last_result and last_result.probed_at:
                next_run = last_result.probed_at + timedelta(
                    seconds=task_info['interval_seconds']
                )
                return next_run.isoformat()
            
            return None
            
        except Exception as e:
            logger.error(f"计算下次执行时间失败: probe_id={probe_id}, error={str(e)}")
            return None
    
    def get_scheduler_statistics(self) -> Dict[str, Any]:
        """
        获取调度器统计信息
        
        Returns:
            Dict: 统计信息
        """
        try:
            # 统计数据库中的探测任务
            total_probes = NetworkProbe.query.filter_by(enabled=True).count()
            auto_enabled_probes = NetworkProbe.query.filter_by(
                enabled=True,
                auto_probe_enabled=True
            ).count()
            
            # 统计任务注册表
            registered_tasks = len(self._task_registry)
            
            # 获取 Celery 队列信息
            try:
                inspect = celery_app.control.inspect()
                active_tasks = inspect.active()
                scheduled_tasks = inspect.scheduled()
                
                network_probe_active = 0
                network_probe_scheduled = 0
                
                if active_tasks:
                    for worker, tasks in active_tasks.items():
                        network_probe_active += len([
                            t for t in tasks 
                            if 'network_probe' in t.get('name', '')
                        ])
                
                if scheduled_tasks:
                    for worker, tasks in scheduled_tasks.items():
                        network_probe_scheduled += len([
                            t for t in tasks 
                            if 'network_probe' in t.get('name', '')
                        ])
                
                celery_info = {
                    'active_tasks': network_probe_active,
                    'scheduled_tasks': network_probe_scheduled,
                    'available': True
                }
                
            except Exception as e:
                logger.warning(f"获取 Celery 信息失败: {str(e)}")
                celery_info = {
                    'available': False,
                    'error': str(e)
                }
            
            return {
                'success': True,
                'total_probes': total_probes,
                'auto_enabled_probes': auto_enabled_probes,
                'registered_tasks': registered_tasks,
                'celery_info': celery_info,
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"获取调度器统计信息失败: error={str(e)}")
            return {
                'success': False,
                'message': f'获取统计信息失败: {str(e)}'
            }


# 创建全局调度器实例
network_probe_scheduler = NetworkProbeScheduler()
