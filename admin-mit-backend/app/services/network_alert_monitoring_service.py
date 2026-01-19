"""
网络探测告警监控服务
提供网络探测告警规则监控、告警条件评估、告警触发和通知等功能
"""
import logging
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple, Any
from decimal import Decimal
from sqlalchemy import and_, or_

from app.extensions import db
from app.models.network import NetworkProbe, NetworkProbeResult, NetworkAlertRule, NetworkAlertRecord
from app.models.monitor import AlertChannel
from app.services.email_notification_service import email_notification_service
from app.services.dingtalk_notification_service import dingtalk_notification_service
from app.core.config_manager import config_manager

logger = logging.getLogger(__name__)


class NetworkAlertEvaluationError(Exception):
    """网络探测告警评估异常"""
    pass


class NetworkProbeResultCollector:
    """网络探测结果收集服务"""
    
    def __init__(self):
        self.collection_timeout = 30  # 数据收集超时时间（秒）
    
    def get_probe_latest_result(self, probe_id: int) -> Optional[NetworkProbeResult]:
        """获取探测任务的最新结果"""
        try:
            latest_result = NetworkProbeResult.query.filter(
                NetworkProbeResult.probe_id == probe_id
            ).order_by(NetworkProbeResult.probed_at.desc()).first()
            
            return latest_result
            
        except Exception as e:
            logger.error(f"获取探测任务 {probe_id} 最新结果失败: {str(e)}")
            return None
    
    def get_probe_recent_results(self, probe_id: int, count: int = 10) -> List[NetworkProbeResult]:
        """获取探测任务的最近N次结果"""
        try:
            recent_results = NetworkProbeResult.query.filter(
                NetworkProbeResult.probe_id == probe_id
            ).order_by(NetworkProbeResult.probed_at.desc()).limit(count).all()
            
            return recent_results
            
        except Exception as e:
            logger.error(f"获取探测任务 {probe_id} 最近结果失败: {str(e)}")
            return []
    
    def collect_all_probes_results(self, tenant_id: int) -> Dict[int, NetworkProbeResult]:
        """收集租户下所有探测任务的最新结果"""
        try:
            # 获取租户下所有启用的探测任务
            probes = NetworkProbe.query.filter(
                NetworkProbe.tenant_id == tenant_id,
                NetworkProbe.enabled == True
            ).all()
            
            results_data = {}
            
            for probe in probes:
                latest_result = self.get_probe_latest_result(probe.id)
                if latest_result:
                    results_data[probe.id] = latest_result
                else:
                    logger.debug(f"探测任务 {probe.name} 没有可用的结果数据")
            
            return results_data
            
        except Exception as e:
            logger.error(f"收集租户 {tenant_id} 所有探测结果失败: {str(e)}")
            return {}


class NetworkAlertRuleEvaluator:
    """网络探测告警规则评估引擎"""
    
    def __init__(self):
        self.evaluation_cache = {}  # 评估结果缓存
        self.failure_count_cache = {}  # 连续失败次数缓存
        self.cache_ttl = 60  # 缓存TTL（秒）
    
    def evaluate_rule(self, rule: NetworkAlertRule, probe_results: Dict[int, NetworkProbeResult]) -> List[Dict[str, Any]]:
        """评估单个网络探测告警规则"""
        try:
            if not rule.enabled:
                return []
            
            triggered_alerts = []
            
            # 获取规则对应的探测任务
            probe_id = rule.probe_id
            
            if probe_id not in probe_results:
                logger.debug(f"探测任务 {probe_id} 没有可用的结果数据，跳过评估")
                return []
            
            probe_result = probe_results[probe_id]
            
            # 评估规则条件
            is_triggered, current_value = self._evaluate_condition(rule, probe_result)
            
            if is_triggered:
                # 检查连续失败次数
                if self._check_consecutive_failures(rule, probe_id, is_triggered):
                    alert_info = {
                        'rule': rule,
                        'probe': probe_result.probe,
                        'probe_result': probe_result,
                        'current_value': current_value,
                        'threshold_value': rule.threshold_value,
                        'condition_type': rule.condition_type,
                        'message': self._generate_alert_message(rule, probe_result, current_value)
                    }
                    triggered_alerts.append(alert_info)
                    logger.info(f"触发网络探测告警: {rule.name} - {probe_result.probe.name}")
                else:
                    logger.debug(f"探测任务 {probe_result.probe.name} 规则 {rule.name} 未满足连续失败次数条件")
            else:
                # 如果条件不满足，清理失败次数缓存
                self._clear_failure_count_cache(rule, probe_id)
            
            return triggered_alerts
            
        except Exception as e:
            logger.error(f"评估网络探测告警规则 {rule.name} 失败: {str(e)}")
            raise NetworkAlertEvaluationError(f"评估网络探测告警规则失败: {str(e)}")
    
    def _evaluate_condition(self, rule: NetworkAlertRule, probe_result: NetworkProbeResult) -> Tuple[bool, Optional[Decimal]]:
        """评估规则条件"""
        try:
            condition_type = rule.condition_type
            current_value = None
            
            # 根据条件类型获取当前值
            if condition_type == 'response_time':
                if probe_result.response_time is None:
                    return False, None
                current_value = Decimal(str(probe_result.response_time))
                threshold_value = rule.threshold_value
                
            elif condition_type == 'status_code':
                if probe_result.status_code is None:
                    return False, None
                current_value = Decimal(str(probe_result.status_code))
                threshold_value = rule.threshold_value
                
            elif condition_type == 'availability':
                # 可用性检查：success 为可用，其他为不可用
                is_available = probe_result.status == 'success'
                # threshold_value: 1 表示期望可用，0 表示期望不可用
                expected_available = rule.threshold_value == 1
                
                is_triggered = is_available != expected_available
                current_value = Decimal('1' if is_available else '0')
                
                return is_triggered, current_value
                
            else:
                logger.warning(f"不支持的条件类型: {condition_type}")
                return False, None
            
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
            elif rule.condition_operator == '!=':
                is_triggered = current_value != threshold_value
            else:
                logger.warning(f"不支持的操作符: {rule.condition_operator}")
                return False, current_value
            
            return is_triggered, current_value
            
        except Exception as e:
            logger.error(f"评估规则条件失败: {str(e)}")
            return False, None
    
    def _check_consecutive_failures(self, rule: NetworkAlertRule, probe_id: int, is_triggered: bool) -> bool:
        """检查连续失败次数条件"""
        try:
            if not rule.consecutive_failures or rule.consecutive_failures <= 0:
                return True  # 没有连续失败次数要求，立即触发
            
            cache_key = f"failures_{rule.id}_{probe_id}"
            
            if is_triggered:
                # 增加失败计数
                if cache_key in self.failure_count_cache:
                    self.failure_count_cache[cache_key] += 1
                else:
                    self.failure_count_cache[cache_key] = 1
                
                # 检查是否达到连续失败次数
                if self.failure_count_cache[cache_key] >= rule.consecutive_failures:
                    # 重置计数器（避免重复触发）
                    self.failure_count_cache[cache_key] = 0
                    return True
                else:
                    return False
            else:
                # 条件不满足，清理计数器
                self._clear_failure_count_cache(rule, probe_id)
                return False
                
        except Exception as e:
            logger.error(f"检查连续失败次数条件失败: {str(e)}")
            return True  # 出错时默认触发
    
    def _clear_failure_count_cache(self, rule: NetworkAlertRule, probe_id: int):
        """清理连续失败次数缓存"""
        cache_key = f"failures_{rule.id}_{probe_id}"
        if cache_key in self.failure_count_cache:
            del self.failure_count_cache[cache_key]
    
    def _generate_alert_message(self, rule: NetworkAlertRule, probe_result: NetworkProbeResult, current_value: Decimal) -> str:
        """生成告警消息"""
        try:
            probe = probe_result.probe
            condition_type = rule.condition_type
            
            if condition_type == 'response_time':
                message = (
                    f"网络探测 {probe.name} 响应时间异常：当前值为 {float(current_value)}ms，"
                    f"超过阈值 {rule.condition_operator} {float(rule.threshold_value)}ms"
                )
            elif condition_type == 'status_code':
                message = (
                    f"网络探测 {probe.name} 状态码异常：当前值为 {int(current_value)}，"
                    f"不符合预期 {rule.condition_operator} {int(rule.threshold_value)}"
                )
            elif condition_type == 'availability':
                status_text = '可用' if current_value == 1 else '不可用'
                message = f"网络探测 {probe.name} 可用性异常：当前状态为 {status_text}"
            else:
                message = f"网络探测 {probe.name} 触发告警规则 {rule.name}"
            
            # 添加探测结果详情
            if probe_result.error_message:
                message += f"，错误信息：{probe_result.error_message}"
            
            return message
            
        except Exception as e:
            logger.error(f"生成告警消息失败: {str(e)}")
            return f"网络探测 {probe_result.probe.name if probe_result.probe else 'Unknown'} 触发告警规则 {rule.name}"
    
    def cleanup_cache(self, max_age_minutes: int = 30):
        """清理过期的缓存条目"""
        try:
            # 对于网络探测告警，我们主要清理失败计数缓存
            # 由于失败计数是基于连续性的，不需要基于时间清理
            # 这里保留方法以保持接口一致性
            logger.debug("网络探测告警评估缓存清理完成")
                
        except Exception as e:
            logger.error(f"清理评估缓存失败: {str(e)}")


class NetworkAlertTriggerManager:
    """网络探测告警触发逻辑管理器"""
    
    def __init__(self):
        self.notification_services = {
            'email': email_notification_service,
            'dingtalk': dingtalk_notification_service
        }
    
    def trigger_alert(self, alert_info: Dict[str, Any]) -> NetworkAlertRecord:
        """触发网络探测告警"""
        try:
            rule = alert_info['rule']
            probe = alert_info['probe']
            probe_result = alert_info['probe_result']
            current_value = alert_info['current_value']
            
            # 检查是否已存在活跃的告警记录
            existing_alert = NetworkAlertRecord.query.filter(
                NetworkAlertRecord.rule_id == rule.id,
                NetworkAlertRecord.probe_id == probe.id,
                NetworkAlertRecord.status.in_(['active', 'acknowledged'])
            ).first()
            
            if existing_alert:
                # 更新现有告警记录
                existing_alert.triggered_value = current_value
                existing_alert.last_triggered_at = datetime.now(timezone.utc)
                existing_alert.message = alert_info['message']
                
                db.session.commit()
                
                logger.info(f"更新现有网络探测告警记录: {rule.name} - {probe.name}")
                return existing_alert
            else:
                # 创建新的告警记录
                alert_record = NetworkAlertRecord(
                    tenant_id=rule.tenant_id,
                    rule_id=rule.id,
                    probe_id=probe.id,
                    status='active',
                    message=alert_info['message'],
                    triggered_value=current_value,
                    first_triggered_at=datetime.now(timezone.utc),
                    last_triggered_at=datetime.now(timezone.utc)
                )
                
                db.session.add(alert_record)
                db.session.commit()
                
                logger.info(f"创建新网络探测告警记录: {rule.name} - {probe.name}")
                
                # 发送告警通知
                self._send_alert_notifications(alert_record)
                
                return alert_record
                
        except Exception as e:
            logger.error(f"触发网络探测告警失败: {str(e)}")
            db.session.rollback()
            raise NetworkAlertEvaluationError(f"触发网络探测告警失败: {str(e)}")
    
    def _send_alert_notifications(self, alert_record: NetworkAlertRecord):
        """发送网络探测告警通知"""
        try:
            rule = alert_record.rule
            
            # 获取告警渠道
            channels = AlertChannel.query.filter(
                AlertChannel.tenant_id == rule.tenant_id,
                AlertChannel.id.in_(rule.channel_ids),
                AlertChannel.status == 1
            ).all()
            
            if not channels:
                logger.warning(f"网络探测告警规则 {rule.name} 没有可用的通知渠道")
                return
            
            # 为每个渠道发送通知
            for channel in channels:
                try:
                    service = self.notification_services.get(channel.type)
                    if not service:
                        logger.warning(f"不支持的通知渠道类型: {channel.type}")
                        continue
                    
                    # 构造告警通知数据（适配现有通知服务接口）
                    notification_data = self._prepare_notification_data(alert_record, channel)
                    
                    success, message = service.send_network_alert_notification(notification_data, channel)
                    
                    if success:
                        logger.info(f"网络探测告警通知发送成功: {channel.name}")
                    else:
                        logger.error(f"网络探测告警通知发送失败: {channel.name} - {message}")
                        
                except Exception as e:
                    logger.error(f"发送网络探测告警通知异常: {channel.name} - {str(e)}")
                    
        except Exception as e:
            logger.error(f"发送网络探测告警通知失败: {str(e)}")
    
    def _prepare_notification_data(self, alert_record: NetworkAlertRecord, channel: AlertChannel) -> Dict[str, Any]:
        """准备通知数据"""
        try:
            probe = alert_record.probe
            rule = alert_record.rule
            
            return {
                'alert_type': 'network_probe',
                'alert_id': alert_record.id,
                'rule_name': rule.name,
                'probe_name': probe.name if probe else 'Unknown',
                'probe_url': probe.target_url if probe else '',
                'status': alert_record.status,
                'message': alert_record.message,
                'triggered_value': float(alert_record.triggered_value) if alert_record.triggered_value else None,
                'first_triggered_at': alert_record.first_triggered_at.isoformat() if alert_record.first_triggered_at else None,
                'last_triggered_at': alert_record.last_triggered_at.isoformat() if alert_record.last_triggered_at else None
            }
            
        except Exception as e:
            logger.error(f"准备通知数据失败: {str(e)}")
            return {}
    
    def resolve_alerts_for_probe(self, probe_id: int):
        """解决探测任务的告警"""
        try:
            # 查找该探测任务的活跃告警
            active_alerts = NetworkAlertRecord.query.filter(
                NetworkAlertRecord.probe_id == probe_id,
                NetworkAlertRecord.status.in_(['active', 'acknowledged'])
            ).all()
            
            for alert in active_alerts:
                alert.status = 'resolved'
                alert.resolved_at = datetime.now(timezone.utc)
                
                probe_name = alert.probe.name if alert.probe else f"探测任务ID:{alert.probe_id}"
                rule_name = alert.rule.name if alert.rule else f"规则ID:{alert.rule_id}"
                logger.info(f"自动解决网络探测告警: {rule_name} - {probe_name}")
            
            if active_alerts:
                db.session.commit()
                
        except Exception as e:
            logger.error(f"解决探测任务告警失败: {str(e)}")
            db.session.rollback()


class NetworkAlertMonitoringEngine:
    """网络探测告警监控引擎"""
    
    def __init__(self):
        self.result_collector = NetworkProbeResultCollector()
        self.rule_evaluator = NetworkAlertRuleEvaluator()
        self.trigger_manager = NetworkAlertTriggerManager()
        
        # 监控配置
        app_config = config_manager.get_app_config()
        monitoring_config = app_config.get('network_alert_monitoring', {})
        
        self.evaluation_interval = monitoring_config.get('evaluation_interval', 60)  # 评估间隔（秒）
        self.max_concurrent_evaluations = monitoring_config.get('max_concurrent_evaluations', 10)
        self.cache_cleanup_interval = monitoring_config.get('cache_cleanup_interval', 1800)  # 缓存清理间隔（秒）
        
        # 运行状态
        self._monitoring_threads = {}
        self._stop_monitoring = {}
        self._is_running = False
        self._last_cache_cleanup = datetime.now(timezone.utc)
    
    def start_monitoring(self, tenant_id: int):
        """启动租户的网络探测告警监控"""
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
            
            logger.info(f"启动租户 {tenant_id} 的网络探测告警监控")
            
        except Exception as e:
            logger.error(f"启动网络探测告警监控失败: {str(e)}")
            raise NetworkAlertEvaluationError(f"启动网络探测告警监控失败: {str(e)}")
    
    def stop_monitoring(self, tenant_id: int):
        """停止租户的网络探测告警监控"""
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
            
            logger.info(f"停止租户 {tenant_id} 的网络探测告警监控")
            
        except Exception as e:
            logger.error(f"停止网络探测告警监控失败: {str(e)}")
    
    def _monitoring_worker(self, tenant_id: int, tenant_key: str):
        """监控工作线程"""
        stop_event = self._stop_monitoring[tenant_key]
        
        logger.info(f"租户 {tenant_id} 网络探测告警监控线程已启动")
        
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
                logger.error(f"租户 {tenant_id} 网络探测告警监控异常: {str(e)}")
                # 出错后等待一段时间再重试
                if stop_event.wait(timeout=30):
                    break
        
        logger.info(f"租户 {tenant_id} 网络探测告警监控线程已停止")
    
    def _perform_monitoring_cycle(self, tenant_id: int):
        """执行一轮监控评估"""
        try:
            start_time = time.time()
            
            # 1. 收集所有探测任务的最新结果
            probe_results = self.result_collector.collect_all_probes_results(tenant_id)
            
            if not probe_results:
                logger.debug(f"租户 {tenant_id} 没有可用的探测结果数据")
                return
            
            # 2. 获取所有启用的告警规则
            rules = NetworkAlertRule.query.filter(
                NetworkAlertRule.tenant_id == tenant_id,
                NetworkAlertRule.enabled == True
            ).all()
            
            if not rules:
                logger.debug(f"租户 {tenant_id} 没有启用的网络探测告警规则")
                return
            
            # 3. 评估每个规则
            total_triggered = 0
            for rule in rules:
                try:
                    triggered_alerts = self.rule_evaluator.evaluate_rule(rule, probe_results)
                    
                    # 4. 触发告警
                    for alert_info in triggered_alerts:
                        self.trigger_manager.trigger_alert(alert_info)
                        total_triggered += 1
                        
                except Exception as e:
                    logger.error(f"评估网络探测规则 {rule.name} 失败: {str(e)}")
                    continue
            
            # 5. 记录监控周期统计
            cycle_time = time.time() - start_time
            logger.debug(
                f"租户 {tenant_id} 网络探测告警监控周期完成: "
                f"评估 {len(rules)} 个规则, "
                f"收集 {len(probe_results)} 个探测结果, "
                f"触发 {total_triggered} 个告警, "
                f"耗时 {cycle_time:.2f}s"
            )
            
        except Exception as e:
            logger.error(f"执行网络探测告警监控周期失败: {str(e)}")
    
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
        """单次评估指定网络探测告警规则"""
        try:
            rule = NetworkAlertRule.query.get(rule_id)
            if not rule:
                raise NetworkAlertEvaluationError(f"网络探测告警规则不存在: {rule_id}")
            
            if not rule.enabled:
                return {
                    'rule_id': rule_id,
                    'rule_name': rule.name,
                    'status': 'disabled',
                    'triggered_alerts': []
                }
            
            # 收集相关探测任务的结果数据
            probe_results = self.result_collector.collect_all_probes_results(rule.tenant_id)
            
            # 评估规则
            triggered_alerts = self.rule_evaluator.evaluate_rule(rule, probe_results)
            
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
            logger.error(f"单次评估网络探测规则失败: {str(e)}")
            raise NetworkAlertEvaluationError(f"单次评估网络探测规则失败: {str(e)}")
    
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
                'failure_count_cache_entries': len(self.rule_evaluator.failure_count_cache)
            }
            
        except Exception as e:
            logger.error(f"获取网络探测告警监控状态失败: {str(e)}")
            return {}
    
    def get_monitoring_statistics(self, tenant_id: int, days: int = 7) -> Dict[str, Any]:
        """获取网络探测告警监控统计信息"""
        try:
            from sqlalchemy import func
            
            start_date = datetime.now(timezone.utc) - timedelta(days=days)
            
            # 统计告警记录
            alert_stats = db.session.query(
                NetworkAlertRecord.status,
                func.count(NetworkAlertRecord.id).label('count')
            ).filter(
                NetworkAlertRecord.tenant_id == tenant_id,
                NetworkAlertRecord.created_at >= start_date
            ).group_by(NetworkAlertRecord.status).all()
            
            # 统计按探测任务分组的告警
            probe_alert_stats = db.session.query(
                NetworkAlertRecord.probe_id,
                func.count(NetworkAlertRecord.id).label('count')
            ).filter(
                NetworkAlertRecord.tenant_id == tenant_id,
                NetworkAlertRecord.created_at >= start_date
            ).group_by(NetworkAlertRecord.probe_id).all()
            
            # 格式化统计结果
            result = {
                'period_days': days,
                'alerts': {
                    'total': 0,
                    'by_status': {'active': 0, 'acknowledged': 0, 'resolved': 0}
                },
                'top_probes': []
            }
            
            # 处理告警统计
            for status, count in alert_stats:
                result['alerts']['total'] += count
                result['alerts']['by_status'][status] = count
            
            # 处理探测任务告警统计（取前10个）
            probe_stats_list = []
            for probe_id, count in probe_alert_stats:
                probe = NetworkProbe.query.get(probe_id)
                if probe:
                    probe_stats_list.append({
                        'probe_id': probe_id,
                        'probe_name': probe.name,
                        'alert_count': count
                    })
            
            # 按告警数量排序，取前10个
            probe_stats_list.sort(key=lambda x: x['alert_count'], reverse=True)
            result['top_probes'] = probe_stats_list[:10]
            
            return result
            
        except Exception as e:
            logger.error(f"获取网络探测告警监控统计失败: {str(e)}")
            return {}
    
    def stop_all_monitoring(self):
        """停止所有网络探测告警监控"""
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
            
            logger.info("已停止所有网络探测告警监控")
            
        except Exception as e:
            logger.error(f"停止所有网络探测告警监控失败: {str(e)}")


# 全局网络探测告警监控引擎实例
network_alert_monitoring_engine = NetworkAlertMonitoringEngine()
