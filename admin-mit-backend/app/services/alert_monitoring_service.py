"""
告警规则监控引擎
提供告警规则评估、指标数据收集、告警触发逻辑、告警静默期控制等功能
"""
import logging
import threading
import time
from datetime import datetime, timedelta, timezone, timezone
from typing import Dict, List, Optional, Tuple, Any
from decimal import Decimal
from sqlalchemy import and_, or_

from app.extensions import db
from app.models.host import SSHHost, HostMetrics
from app.models.monitor import AlertRule, AlertRecord, AlertChannel, AlertNotification
from app.services.host_info_service import host_info_service, HostInfoCollectionError
from app.services.email_notification_service import email_notification_service
from app.services.dingtalk_notification_service import dingtalk_notification_service
from app.core.config_manager import config_manager

logger = logging.getLogger(__name__)


class AlertEvaluationError(Exception):
    """告警评估异常"""
    pass


class MetricDataCollector:
    """指标数据收集服务"""
    
    def __init__(self):
        self.collection_timeout = 30  # 数据收集超时时间（秒）
    
    def collect_host_metrics(self, host: SSHHost) -> Optional[Dict[str, Any]]:
        """收集单个主机的性能指标"""
        try:
            # 尝试获取最新的性能指标
            latest_metrics = host_info_service.get_host_latest_metrics(host.id)
            
            # 如果没有最新数据或数据过期，尝试实时收集
            if not latest_metrics or self._is_metrics_stale(latest_metrics):
                logger.info(f"主机 {host.name} 指标数据过期，开始实时收集")
                try:
                    latest_metrics = host_info_service.collect_host_performance_metrics(host)
                except HostInfoCollectionError as e:
                    logger.warning(f"实时收集主机 {host.name} 指标失败: {str(e)}")
                    # 如果实时收集失败，使用最后可用的数据
                    if latest_metrics:
                        logger.info(f"使用主机 {host.name} 的历史指标数据")
                    else:
                        return None
            
            return latest_metrics
            
        except Exception as e:
            logger.error(f"收集主机 {host.name} 指标数据失败: {str(e)}")
            return None
    
    def _is_metrics_stale(self, metrics: Dict[str, Any], max_age_minutes: int = 5) -> bool:
        """检查指标数据是否过期"""
        try:
            if not metrics.get('collected_at'):
                return True
            
            collected_at = datetime.fromisoformat(metrics['collected_at'].replace('Z', '+00:00'))
            age = datetime.now(timezone.utc) - collected_at
            
            return age > timedelta(minutes=max_age_minutes)
            
        except Exception:
            return True
    
    def collect_all_hosts_metrics(self, tenant_id: int) -> Dict[int, Dict[str, Any]]:
        """收集租户下所有主机的性能指标"""
        try:
            # 获取租户下所有启用的主机
            hosts = SSHHost.query.filter(
                SSHHost.tenant_id == tenant_id,
                SSHHost.status == 1
            ).all()
            
            metrics_data = {}
            
            for host in hosts:
                metrics = self.collect_host_metrics(host)
                if metrics:
                    metrics_data[host.id] = metrics
                else:
                    logger.warning(f"无法获取主机 {host.name} 的指标数据")
            
            return metrics_data
            
        except Exception as e:
            logger.error(f"收集租户 {tenant_id} 所有主机指标失败: {str(e)}")
            return {}


class AlertRuleEvaluator:
    """告警规则评估引擎"""
    
    def __init__(self):
        self.evaluation_cache = {}  # 评估结果缓存
        self.cache_ttl = 60  # 缓存TTL（秒）
    
    def evaluate_rule(self, rule: AlertRule, host_metrics: Dict[int, Dict[str, Any]]) -> List[Dict[str, Any]]:
        """评估单个告警规则"""
        try:
            if not rule.is_enabled():
                return []
            
            triggered_alerts = []
            
            # 获取规则适用的主机列表
            target_hosts = self._get_target_hosts(rule)
            
            for host in target_hosts:
                if host.id not in host_metrics:
                    logger.debug(f"主机 {host.name} 没有可用的指标数据，跳过评估")
                    continue
                
                metrics = host_metrics[host.id]
                
                # 评估规则条件
                is_triggered, current_value = self._evaluate_condition(rule, metrics)
                
                if is_triggered:
                    # 检查是否在静默期内
                    if self._is_in_silence_period(rule, host):
                        logger.debug(f"主机 {host.name} 规则 {rule.name} 在静默期内，跳过告警")
                        continue
                    
                    # 检查持续时间条件
                    if self._check_duration_condition(rule, host, current_value):
                        alert_info = {
                            'rule': rule,
                            'host': host,
                            'current_value': current_value,
                            'threshold_value': rule.threshold_value,
                            'metric_type': rule.metric_type,
                            'severity': rule.severity,
                            'message': self._generate_alert_message(rule, host, current_value)
                        }
                        triggered_alerts.append(alert_info)
                        logger.info(f"触发告警: {rule.name} - {host.name}")
                    else:
                        logger.debug(f"主机 {host.name} 规则 {rule.name} 未满足持续时间条件")
                else:
                    # 如果条件不满足，清理持续时间缓存
                    self._clear_duration_cache(rule, host)
            
            return triggered_alerts
            
        except Exception as e:
            logger.error(f"评估告警规则 {rule.name} 失败: {str(e)}")
            raise AlertEvaluationError(f"评估告警规则失败: {str(e)}")
    
    def _get_target_hosts(self, rule: AlertRule) -> List[SSHHost]:
        """获取规则适用的主机列表"""
        try:
            if not rule.host_ids:
                # 空数组表示适用于所有主机
                return SSHHost.query.filter(
                    SSHHost.tenant_id == rule.tenant_id,
                    SSHHost.status == 1
                ).all()
            else:
                # 指定主机ID列表
                return SSHHost.query.filter(
                    SSHHost.tenant_id == rule.tenant_id,
                    SSHHost.id.in_(rule.host_ids),
                    SSHHost.status == 1
                ).all()
                
        except Exception as e:
            logger.error(f"获取规则 {rule.name} 目标主机失败: {str(e)}")
            return []
    
    def _evaluate_condition(self, rule: AlertRule, metrics: Dict[str, Any]) -> Tuple[bool, Optional[Decimal]]:
        """评估规则条件"""
        try:
            # 指标类型映射
            metric_key_mapping = {
                'cpu': 'cpu_usage',
                'memory': 'memory_usage',
                'disk': 'disk_usage',
                'load': 'load_average'
            }
            
            # 获取实际的指标键名
            metric_key = metric_key_mapping.get(rule.metric_type, rule.metric_type)
            
            # 获取当前指标值
            current_value = metrics.get(metric_key)
            if current_value is None:
                return False, None
            
            current_value = Decimal(str(current_value))
            threshold_value = rule.threshold_value
            
            # 根据操作符评估条件
            if rule.condition_operator == '>':
                is_triggered = current_value > threshold_value
            elif rule.condition_operator == '<':
                is_triggered = current_value < threshold_value
            elif rule.condition_operator == '>=':
                is_triggered = current_value >= threshold_value
            elif rule.condition_operator == '<=':
                is_triggered = current_value <= threshold_value
            elif rule.condition_operator == '==':
                is_triggered = current_value == threshold_value
            else:
                logger.warning(f"不支持的操作符: {rule.condition_operator}")
                return False, current_value
            
            return is_triggered, current_value
            
        except Exception as e:
            logger.error(f"评估规则条件失败: {str(e)}")
            return False, None
    
    def _is_in_silence_period(self, rule: AlertRule, host: SSHHost) -> bool:
        """检查是否在静默期内"""
        try:
            if not rule.silence_period or rule.silence_period <= 0:
                return False
            
            # 查找最近的告警记录
            recent_alert = AlertRecord.query.filter(
                AlertRecord.rule_id == rule.id,
                AlertRecord.host_id == host.id,
                AlertRecord.status.in_(['active', 'acknowledged'])
            ).order_by(AlertRecord.last_triggered_at.desc()).first()
            
            if not recent_alert:
                return False
            
            # 计算静默期结束时间
            silence_end_time = recent_alert.last_triggered_at + timedelta(seconds=rule.silence_period)
            
            # 确保时间比较使用相同的时区
            current_time = datetime.now(timezone.utc)
            if recent_alert.last_triggered_at.tzinfo is None:
                # 如果数据库时间是naive，假设它是UTC
                silence_end_time = silence_end_time.replace(tzinfo=timezone.utc)
            
            return current_time < silence_end_time
            
        except Exception as e:
            logger.error(f"检查静默期失败: {str(e)}")
            return False
    
    def _check_duration_condition(self, rule: AlertRule, host: SSHHost, current_value: Decimal) -> bool:
        """检查持续时间条件"""
        try:
            if not rule.duration or rule.duration <= 0:
                return True  # 没有持续时间要求，立即触发
            
            cache_key = f"duration_{rule.id}_{host.id}"
            current_time = datetime.now(timezone.utc)
            
            # 检查缓存中的持续时间记录
            if cache_key in self.evaluation_cache:
                cache_entry = self.evaluation_cache[cache_key]
                first_trigger_time = cache_entry['first_trigger_time']
                
                # 检查是否已满足持续时间
                duration_seconds = (current_time - first_trigger_time).total_seconds()
                if duration_seconds >= rule.duration:
                    # 清理缓存
                    del self.evaluation_cache[cache_key]
                    return True
                else:
                    # 更新最后触发时间
                    cache_entry['last_trigger_time'] = current_time
                    cache_entry['current_value'] = current_value
                    return False
            else:
                # 首次触发，记录到缓存
                self.evaluation_cache[cache_key] = {
                    'first_trigger_time': current_time,
                    'last_trigger_time': current_time,
                    'current_value': current_value
                }
                return False
                
        except Exception as e:
            logger.error(f"检查持续时间条件失败: {str(e)}")
            return True  # 出错时默认触发
    
    def _clear_duration_cache(self, rule: AlertRule, host: SSHHost):
        """清理持续时间缓存"""
        cache_key = f"duration_{rule.id}_{host.id}"
        if cache_key in self.evaluation_cache:
            del self.evaluation_cache[cache_key]
    
    def _generate_alert_message(self, rule: AlertRule, host: SSHHost, current_value: Decimal) -> str:
        """生成告警消息"""
        try:
            metric_display_map = {
                'cpu': 'CPU使用率',
                'memory': '内存使用率',
                'disk': '磁盘使用率',
                'load': '系统负载'
            }
            
            unit_map = {
                'cpu': '%',
                'memory': '%',
                'disk': '%',
                'load': ''
            }
            
            metric_display = metric_display_map.get(rule.metric_type, rule.metric_type)
            unit = unit_map.get(rule.metric_type, '')
            
            message = (
                f"主机 {host.name} 的 {metric_display} 当前值为 {float(current_value)}{unit}，"
                f"超过阈值 {rule.condition_operator} {float(rule.threshold_value)}{unit}"
            )
            
            return message
            
        except Exception as e:
            logger.error(f"生成告警消息失败: {str(e)}")
            return f"主机 {host.name} 触发告警规则 {rule.name}"
    
    def cleanup_cache(self, max_age_minutes: int = 30):
        """清理过期的缓存条目"""
        try:
            current_time = datetime.now(timezone.utc)
            expired_keys = []
            
            for key, entry in self.evaluation_cache.items():
                last_trigger_time = entry['last_trigger_time']
                # 确保时间比较使用相同的时区
                if last_trigger_time.tzinfo is None:
                    last_trigger_time = last_trigger_time.replace(tzinfo=timezone.utc)
                
                age = (current_time - last_trigger_time).total_seconds() / 60
                if age > max_age_minutes:
                    expired_keys.append(key)
            
            for key in expired_keys:
                del self.evaluation_cache[key]
            
            if expired_keys:
                logger.info(f"清理了 {len(expired_keys)} 个过期的评估缓存条目")
                
        except Exception as e:
            logger.error(f"清理评估缓存失败: {str(e)}")


class AlertTriggerManager:
    """告警触发逻辑管理器"""
    
    def __init__(self):
        self.notification_services = {
            'email': email_notification_service,
            'dingtalk': dingtalk_notification_service
        }
    
    def trigger_alert(self, alert_info: Dict[str, Any]) -> AlertRecord:
        """触发告警"""
        try:
            rule = alert_info['rule']
            host = alert_info['host']
            current_value = alert_info['current_value']
            
            # 检查是否已存在活跃的告警记录
            existing_alert = AlertRecord.query.filter(
                AlertRecord.rule_id == rule.id,
                AlertRecord.host_id == host.id,
                AlertRecord.status.in_(['active', 'acknowledged'])
            ).first()
            
            if existing_alert:
                # 更新现有告警记录
                existing_alert.current_value = current_value
                existing_alert.last_triggered_at = datetime.now(timezone.utc)
                existing_alert.update_last_triggered()
                
                db.session.commit()
                
                logger.info(f"更新现有告警记录: {rule.name} - {host.name}")
                return existing_alert
            else:
                # 创建新的告警记录
                alert_record = AlertRecord(
                    tenant_id=rule.tenant_id,
                    rule_id=rule.id,
                    host_id=host.id,
                    metric_type=alert_info['metric_type'],
                    current_value=current_value,
                    threshold_value=alert_info['threshold_value'],
                    severity=alert_info['severity'],
                    status='active',
                    message=alert_info['message'],
                    first_triggered_at=datetime.now(timezone.utc),
                    last_triggered_at=datetime.now(timezone.utc)
                )
                
                db.session.add(alert_record)
                db.session.commit()
                
                logger.info(f"创建新告警记录: {rule.name} - {host.name}")
                
                # 发送告警通知
                self._send_alert_notifications(alert_record)
                
                return alert_record
                
        except Exception as e:
            logger.error(f"触发告警失败: {str(e)}")
            db.session.rollback()
            raise AlertEvaluationError(f"触发告警失败: {str(e)}")
    
    def _send_alert_notifications(self, alert_record: AlertRecord):
        """发送告警通知"""
        try:
            rule = alert_record.rule
            
            # 获取告警渠道
            channels = AlertChannel.query.filter(
                AlertChannel.tenant_id == rule.tenant_id,
                AlertChannel.id.in_(rule.channel_ids),
                AlertChannel.status == 1
            ).all()
            
            if not channels:
                logger.warning(f"告警规则 {rule.name} 没有可用的通知渠道")
                return
            
            # 为每个渠道发送通知
            for channel in channels:
                try:
                    service = self.notification_services.get(channel.type)
                    if not service:
                        logger.warning(f"不支持的通知渠道类型: {channel.type}")
                        continue
                    
                    success, message = service.send_alert_notification(alert_record, channel)
                    
                    if success:
                        logger.info(f"告警通知发送成功: {channel.name}")
                    else:
                        logger.error(f"告警通知发送失败: {channel.name} - {message}")
                        
                except Exception as e:
                    logger.error(f"发送告警通知异常: {channel.name} - {str(e)}")
                    
        except Exception as e:
            logger.error(f"发送告警通知失败: {str(e)}")
    
    def resolve_alerts_for_host(self, host_id: int, metric_type: str):
        """解决主机的特定指标告警"""
        try:
            # 查找该主机该指标的活跃告警
            active_alerts = AlertRecord.query.filter(
                AlertRecord.host_id == host_id,
                AlertRecord.metric_type == metric_type,
                AlertRecord.status.in_(['active', 'acknowledged'])
            ).all()
            
            for alert in active_alerts:
                alert.resolve()
                # 获取主机名称用于日志
                host_name = alert.host.name if alert.host else f"主机ID:{alert.host_id}"
                rule_name = alert.rule.name if alert.rule else f"规则ID:{alert.rule_id}"
                logger.info(f"自动解决告警: {rule_name} - {host_name}")
            
            if active_alerts:
                db.session.commit()
                
        except Exception as e:
            logger.error(f"解决主机告警失败: {str(e)}")
            db.session.rollback()


class AlertMonitoringEngine:
    """告警规则监控引擎"""
    
    def __init__(self):
        self.metric_collector = MetricDataCollector()
        self.rule_evaluator = AlertRuleEvaluator()
        self.trigger_manager = AlertTriggerManager()
        
        # 监控配置
        app_config = config_manager.get_app_config()
        monitoring_config = app_config.get('alert_monitoring', {})
        
        self.evaluation_interval = monitoring_config.get('evaluation_interval', 60)  # 评估间隔（秒）
        self.max_concurrent_evaluations = monitoring_config.get('max_concurrent_evaluations', 10)
        self.cache_cleanup_interval = monitoring_config.get('cache_cleanup_interval', 1800)  # 缓存清理间隔（秒）
        
        # 运行状态
        self._monitoring_threads = {}
        self._stop_monitoring = {}
        self._is_running = False
        self._last_cache_cleanup = datetime.now(timezone.utc)
    
    def start_monitoring(self, tenant_id: int):
        """启动租户的告警监控"""
        try:
            tenant_key = f"tenant_{tenant_id}"
            
            # 如果已经在监控，先停止
            if tenant_key in self._monitoring_threads:
                self.stop_monitoring(tenant_id)
            
            # 创建停止标志
            self._stop_monitoring[tenant_key] = threading.Event()
            
            # 创建监控线程
            monitoring_thread = threading.Thread(
                target=self._monitoring_worker,
                args=(tenant_id, tenant_key),
                daemon=True
            )
            
            self._monitoring_threads[tenant_key] = monitoring_thread
            monitoring_thread.start()
            
            logger.info(f"启动租户 {tenant_id} 的告警监控")
            
        except Exception as e:
            logger.error(f"启动告警监控失败: {str(e)}")
            raise AlertEvaluationError(f"启动告警监控失败: {str(e)}")
    
    def stop_monitoring(self, tenant_id: int):
        """停止租户的告警监控"""
        try:
            tenant_key = f"tenant_{tenant_id}"
            
            # 设置停止标志
            if tenant_key in self._stop_monitoring:
                self._stop_monitoring[tenant_key].set()
            
            # 等待线程结束
            if tenant_key in self._monitoring_threads:
                thread = self._monitoring_threads[tenant_key]
                if thread.is_alive():
                    thread.join(timeout=10)  # 最多等待10秒
                
                del self._monitoring_threads[tenant_key]
            
            # 清理停止标志
            if tenant_key in self._stop_monitoring:
                del self._stop_monitoring[tenant_key]
            
            logger.info(f"停止租户 {tenant_id} 的告警监控")
            
        except Exception as e:
            logger.error(f"停止告警监控失败: {str(e)}")
    
    def _monitoring_worker(self, tenant_id: int, tenant_key: str):
        """监控工作线程"""
        stop_event = self._stop_monitoring[tenant_key]
        
        logger.info(f"租户 {tenant_id} 告警监控线程已启动")
        
        while not stop_event.is_set():
            try:
                # 执行一轮监控评估
                self._perform_monitoring_cycle(tenant_id)
                
                # 定期清理缓存
                self._cleanup_cache_if_needed()
                
                # 等待下次评估
                if stop_event.wait(timeout=self.evaluation_interval):
                    break  # 收到停止信号
                    
            except Exception as e:
                logger.error(f"租户 {tenant_id} 告警监控异常: {str(e)}")
                # 出错后等待一段时间再重试
                if stop_event.wait(timeout=30):
                    break
        
        logger.info(f"租户 {tenant_id} 告警监控线程已停止")
    
    def _perform_monitoring_cycle(self, tenant_id: int):
        """执行一轮监控评估"""
        try:
            start_time = time.time()
            
            # 1. 收集所有主机的指标数据
            host_metrics = self.metric_collector.collect_all_hosts_metrics(tenant_id)
            
            if not host_metrics:
                logger.debug(f"租户 {tenant_id} 没有可用的主机指标数据")
                return
            
            # 2. 获取所有启用的告警规则
            rules = AlertRule.query.filter(
                AlertRule.tenant_id == tenant_id,
                AlertRule.enabled == True
            ).all()
            
            if not rules:
                logger.debug(f"租户 {tenant_id} 没有启用的告警规则")
                return
            
            # 3. 评估每个规则
            total_triggered = 0
            for rule in rules:
                try:
                    triggered_alerts = self.rule_evaluator.evaluate_rule(rule, host_metrics)
                    
                    # 4. 触发告警
                    for alert_info in triggered_alerts:
                        self.trigger_manager.trigger_alert(alert_info)
                        total_triggered += 1
                        
                except Exception as e:
                    logger.error(f"评估规则 {rule.name} 失败: {str(e)}")
                    continue
            
            # 5. 记录监控周期统计
            cycle_time = time.time() - start_time
            logger.debug(
                f"租户 {tenant_id} 监控周期完成: "
                f"评估 {len(rules)} 个规则, "
                f"收集 {len(host_metrics)} 个主机指标, "
                f"触发 {total_triggered} 个告警, "
                f"耗时 {cycle_time:.2f}s"
            )
            
        except Exception as e:
            logger.error(f"执行监控周期失败: {str(e)}")
    
    def _cleanup_cache_if_needed(self):
        """根据需要清理缓存"""
        try:
            current_time = datetime.now(timezone.utc)
            time_since_cleanup = (current_time - self._last_cache_cleanup).total_seconds()
            
            if time_since_cleanup >= self.cache_cleanup_interval:
                self.rule_evaluator.cleanup_cache()
                self._last_cache_cleanup = current_time
                
        except Exception as e:
            logger.error(f"清理缓存失败: {str(e)}")
    
    def evaluate_rule_once(self, rule_id: int) -> Dict[str, Any]:
        """单次评估指定规则"""
        try:
            rule = AlertRule.query.get(rule_id)
            if not rule:
                raise AlertEvaluationError(f"告警规则不存在: {rule_id}")
            
            if not rule.is_enabled():
                return {
                    'rule_id': rule_id,
                    'rule_name': rule.name,
                    'status': 'disabled',
                    'triggered_alerts': []
                }
            
            # 收集相关主机的指标数据
            host_metrics = self.metric_collector.collect_all_hosts_metrics(rule.tenant_id)
            
            # 评估规则
            triggered_alerts = self.rule_evaluator.evaluate_rule(rule, host_metrics)
            
            # 触发告警
            alert_records = []
            for alert_info in triggered_alerts:
                alert_record = self.trigger_manager.trigger_alert(alert_info)
                alert_records.append(alert_record.to_dict())
            
            return {
                'rule_id': rule_id,
                'rule_name': rule.name,
                'status': 'evaluated',
                'triggered_alerts': alert_records,
                'evaluation_time': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"单次评估规则失败: {str(e)}")
            raise AlertEvaluationError(f"单次评估规则失败: {str(e)}")
    
    def get_monitoring_status(self) -> Dict[str, Any]:
        """获取监控状态"""
        try:
            return {
                'is_running': len(self._monitoring_threads) > 0,
                'active_tenants': len(self._monitoring_threads),
                'monitoring_tenants': list(self._monitoring_threads.keys()),
                'evaluation_interval': self.evaluation_interval,
                'cache_cleanup_interval': self.cache_cleanup_interval,
                'last_cache_cleanup': self._last_cache_cleanup.isoformat(),
                'cache_entries': len(self.rule_evaluator.evaluation_cache)
            }
            
        except Exception as e:
            logger.error(f"获取监控状态失败: {str(e)}")
            return {}
    
    def get_monitoring_statistics(self, tenant_id: int, days: int = 7) -> Dict[str, Any]:
        """获取监控统计信息"""
        try:
            from sqlalchemy import func
            
            start_date = datetime.now(timezone.utc) - timedelta(days=days)
            
            # 统计告警记录
            alert_stats = db.session.query(
                AlertRecord.severity,
                AlertRecord.status,
                func.count(AlertRecord.id).label('count')
            ).filter(
                AlertRecord.tenant_id == tenant_id,
                AlertRecord.created_at >= start_date
            ).group_by(AlertRecord.severity, AlertRecord.status).all()
            
            # 统计通知发送
            notification_stats = db.session.query(
                AlertNotification.status,
                func.count(AlertNotification.id).label('count')
            ).filter(
                AlertNotification.tenant_id == tenant_id,
                AlertNotification.created_at >= start_date
            ).group_by(AlertNotification.status).all()
            
            # 格式化统计结果
            result = {
                'period_days': days,
                'alerts': {
                    'total': 0,
                    'by_severity': {'critical': 0, 'warning': 0, 'info': 0},
                    'by_status': {'active': 0, 'acknowledged': 0, 'ignored': 0, 'resolved': 0}
                },
                'notifications': {
                    'total': 0,
                    'sent': 0,
                    'failed': 0,
                    'pending': 0,
                    'success_rate': 0.0
                }
            }
            
            # 处理告警统计
            for severity, status, count in alert_stats:
                result['alerts']['total'] += count
                result['alerts']['by_severity'][severity] = result['alerts']['by_severity'].get(severity, 0) + count
                result['alerts']['by_status'][status] = result['alerts']['by_status'].get(status, 0) + count
            
            # 处理通知统计
            for status, count in notification_stats:
                result['notifications']['total'] += count
                result['notifications'][status] = count
            
            # 计算通知成功率
            if result['notifications']['total'] > 0:
                success_rate = (result['notifications']['sent'] / result['notifications']['total']) * 100
                result['notifications']['success_rate'] = round(success_rate, 2)
            
            return result
            
        except Exception as e:
            logger.error(f"获取监控统计失败: {str(e)}")
            return {}
    
    def stop_all_monitoring(self):
        """停止所有监控"""
        try:
            tenant_keys = list(self._monitoring_threads.keys())
            
            # 设置所有停止标志
            for tenant_key in tenant_keys:
                if tenant_key in self._stop_monitoring:
                    self._stop_monitoring[tenant_key].set()
            
            # 等待所有线程结束
            for tenant_key in tenant_keys:
                if tenant_key in self._monitoring_threads:
                    thread = self._monitoring_threads[tenant_key]
                    if thread.is_alive():
                        thread.join(timeout=10)
            
            self._monitoring_threads.clear()
            self._stop_monitoring.clear()
            self._is_running = False
            
            logger.info("已停止所有告警监控")
            
        except Exception as e:
            logger.error(f"停止所有监控失败: {str(e)}")


# 全局告警监控引擎实例
alert_monitoring_engine = AlertMonitoringEngine()