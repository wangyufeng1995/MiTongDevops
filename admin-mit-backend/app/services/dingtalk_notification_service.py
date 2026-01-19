"""
钉钉机器人告警通知服务
"""
import json
import time
import hashlib
import hmac
import base64
import urllib.parse
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
import requests
import logging

from app.extensions import db
from app.models.monitor import AlertChannel, AlertNotification, AlertRecord


logger = logging.getLogger(__name__)


class DingTalkMessageFormatter:
    """钉钉消息格式化器"""
    
    def __init__(self):
        self.severity_emoji_map = {
            'critical': '🔴',
            'warning': '🟡',
            'info': '🔵'
        }
        
        self.severity_display_map = {
            'critical': '严重',
            'warning': '警告',
            'info': '信息'
        }
        
        self.metric_display_map = {
            'cpu': 'CPU使用率',
            'memory': '内存使用率',
            'disk': '磁盘使用率',
            'load': '系统负载'
        }
        
        self.unit_map = {
            'cpu': '%',
            'memory': '%',
            'disk': '%',
            'load': ''
        }
        
        # 默认告警模板
        self.default_template = """### {{severity_emoji}} {{title}}

**告警规则:** {{rule_name}}

**主机名称:** {{host_name}}

**监控指标:** {{metric_type}}

**当前值:** {{current_value}}{{unit}}

**阈值:** {{condition}} {{threshold_value}}{{unit}}

**严重级别:** {{severity}}

**触发时间:** {{triggered_at}}

---

**告警描述:** {{message}}

---
*发送时间: {{send_time}}*
*此消息由 MiTong运维平台 自动发送*"""
    
    def format_alert_message(self, alert_record: AlertRecord, custom_template: str = None) -> Dict:
        """格式化告警消息
        
        Args:
            alert_record: 告警记录
            custom_template: 自定义模板，如果为None则使用默认模板
        """
        severity_emoji = self.severity_emoji_map.get(alert_record.severity, '⚠️')
        severity_display = self.severity_display_map.get(alert_record.severity, alert_record.severity)
        metric_display = self.metric_display_map.get(alert_record.metric_type, alert_record.metric_type)
        unit = self.unit_map.get(alert_record.metric_type, '')
        
        # 构建模板变量
        template_vars = {
            'title': '系统告警通知',
            'rule_name': alert_record.rule.name if alert_record.rule else 'Unknown',
            'host_name': alert_record.host.name if alert_record.host else 'Unknown',
            'metric_type': metric_display,
            'current_value': str(float(alert_record.current_value)),
            'threshold_value': str(float(alert_record.threshold_value)),
            'unit': unit,
            'condition': alert_record.rule.condition_operator if alert_record.rule else '>',
            'severity': severity_display,
            'severity_emoji': severity_emoji,
            'triggered_at': alert_record.first_triggered_at.strftime('%Y-%m-%d %H:%M:%S') if alert_record.first_triggered_at else '',
            'send_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'message': alert_record.message or '',
        }
        
        # 使用自定义模板或默认模板
        template = custom_template if custom_template else self.default_template
        
        # 替换模板变量
        content = self._render_template(template, template_vars)
        
        # 构建消息标题
        title = f"{severity_emoji} 系统告警通知"
        
        return {
            "msgtype": "markdown",
            "markdown": {
                "title": title,
                "text": content
            }
        }
    
    def _render_template(self, template: str, variables: Dict[str, str]) -> str:
        """渲染模板，替换变量
        
        Args:
            template: 模板字符串
            variables: 变量字典
        
        Returns:
            渲染后的字符串
        """
        result = template
        for key, value in variables.items():
            placeholder = '{{' + key + '}}'
            result = result.replace(placeholder, str(value))
        return result
    
    def format_test_message(self, channel_name: str) -> Dict:
        """格式化测试消息"""
        title = "✅ 钉钉告警渠道测试"
        
        content_lines = [
            "**钉钉告警渠道测试成功**",
            "",
            f"**渠道名称:** {channel_name}",
            f"**测试时间:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"**发送状态:** 成功",
            "",
            "如果您收到此消息，说明钉钉告警渠道配置正确，可以正常发送告警通知。",
            "",
            "---",
            "此消息由 MiTong运维平台 自动发送"
        ]
        
        content = "\n".join(content_lines)
        
        return {
            "msgtype": "markdown",
            "markdown": {
                "title": title,
                "text": content
            }
        }
    
    def format_at_message(self, message: Dict, at_mobiles: List[str] = None, 
                         at_user_ids: List[str] = None, is_at_all: bool = False) -> Dict:
        """添加@功能到消息"""
        if at_mobiles or at_user_ids or is_at_all:
            message["at"] = {}
            
            if at_mobiles:
                message["at"]["atMobiles"] = at_mobiles
            
            if at_user_ids:
                message["at"]["atUserIds"] = at_user_ids
            
            if is_at_all:
                message["at"]["isAtAll"] = True
        
        return message


class DingTalkWebhookManager:
    """钉钉Webhook管理器"""
    
    @staticmethod
    def validate_webhook_config(config: Dict) -> Tuple[bool, str]:
        """验证钉钉Webhook配置"""
        # 验证必需字段
        if 'webhook_url' not in config:
            return False, "缺少必需字段: webhook_url"
        
        webhook_url = config['webhook_url']
        
        # 验证URL格式
        if not webhook_url.startswith('https://oapi.dingtalk.com/robot/send'):
            return False, "钉钉webhook_url格式不正确，必须以 https://oapi.dingtalk.com/robot/send 开头"
        
        # 验证机器人名称（可选）
        robot_name = config.get('robot_name', '')
        if robot_name and len(robot_name.strip()) == 0:
            return False, "机器人名称不能为空字符串"
        
        # 验证安全设置
        security_type = config.get('security_type', 'none')
        valid_security_types = ['none', 'keyword', 'signature', 'ip']
        
        if security_type not in valid_security_types:
            return False, f"不支持的安全类型: {security_type}，支持的类型: {', '.join(valid_security_types)}"
        
        # 验证关键词安全设置
        if security_type == 'keyword':
            keywords = config.get('keywords', [])
            if not isinstance(keywords, list) or len(keywords) == 0:
                return False, "关键词安全设置需要至少配置一个关键词"
        
        # 验证签名安全设置
        if security_type == 'signature':
            secret = config.get('secret', '')
            if not secret or len(secret.strip()) == 0:
                return False, "签名安全设置需要配置密钥"
        
        # 验证IP白名单安全设置
        if security_type == 'ip':
            ip_whitelist = config.get('ip_whitelist', [])
            if not isinstance(ip_whitelist, list) or len(ip_whitelist) == 0:
                return False, "IP白名单安全设置需要至少配置一个IP地址"
        
        # 验证@功能配置
        at_mobiles = config.get('at_mobiles', [])
        if at_mobiles and not isinstance(at_mobiles, list):
            return False, "@手机号列表必须为数组格式"
        
        at_user_ids = config.get('at_user_ids', [])
        if at_user_ids and not isinstance(at_user_ids, list):
            return False, "@用户ID列表必须为数组格式"
        
        # 验证超时设置
        timeout = config.get('timeout', 10)
        try:
            timeout = int(timeout)
            if timeout <= 0 or timeout > 60:
                return False, "超时时间必须在1-60秒之间"
        except (ValueError, TypeError):
            return False, "超时时间必须为有效数字"
        
        return True, "配置验证通过"
    
    @staticmethod
    def generate_signature(secret: str, timestamp: int) -> str:
        """生成钉钉签名"""
        string_to_sign = f"{timestamp}\n{secret}"
        hmac_code = hmac.new(
            secret.encode('utf-8'),
            string_to_sign.encode('utf-8'),
            digestmod=hashlib.sha256
        ).digest()
        sign = urllib.parse.quote_plus(base64.b64encode(hmac_code))
        return sign
    
    @staticmethod
    def build_webhook_url(config: Dict) -> str:
        """构建完整的Webhook URL"""
        webhook_url = config['webhook_url']
        security_type = config.get('security_type', 'none')
        
        # 如果使用签名安全设置，需要添加签名参数
        if security_type == 'signature':
            secret = config.get('secret', '')
            timestamp = int(time.time() * 1000)
            sign = DingTalkWebhookManager.generate_signature(secret, timestamp)
            
            # 添加时间戳和签名参数
            separator = '&' if '?' in webhook_url else '?'
            webhook_url = f"{webhook_url}{separator}timestamp={timestamp}&sign={sign}"
        
        return webhook_url
    
    @staticmethod
    def test_webhook_connection(config: Dict) -> Tuple[bool, str]:
        """测试钉钉Webhook连接"""
        try:
            # 验证配置
            is_valid, error_msg = DingTalkWebhookManager.validate_webhook_config(config)
            if not is_valid:
                return False, f"配置验证失败: {error_msg}"
            
            # 构建测试消息
            test_message = {
                "msgtype": "text",
                "text": {
                    "content": f"钉钉机器人连接测试 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                }
            }
            
            # 构建请求URL
            webhook_url = DingTalkWebhookManager.build_webhook_url(config)
            
            # 发送测试请求
            timeout = config.get('timeout', 10)
            response = requests.post(
                webhook_url,
                json=test_message,
                timeout=timeout,
                headers={'Content-Type': 'application/json'}
            )
            
            # 检查响应
            if response.status_code == 200:
                result = response.json()
                if result.get('errcode') == 0:
                    return True, "钉钉Webhook连接测试成功"
                else:
                    error_msg = result.get('errmsg', '未知错误')
                    return False, f"钉钉API返回错误: {error_msg}"
            else:
                return False, f"HTTP请求失败，状态码: {response.status_code}"
        
        except requests.exceptions.Timeout:
            return False, "请求超时，请检查网络连接或增加超时时间"
        except requests.exceptions.ConnectionError:
            return False, "连接失败，请检查网络连接和Webhook URL"
        except requests.exceptions.RequestException as e:
            return False, f"请求异常: {str(e)}"
        except Exception as e:
            return False, f"连接测试失败: {str(e)}"


class DingTalkNotificationService:
    """钉钉告警通知服务"""
    
    def __init__(self):
        self.message_formatter = DingTalkMessageFormatter()
        self.webhook_manager = DingTalkWebhookManager()
        self.max_retries = 3  # 最大重试次数
        self.retry_delay = 1  # 重试延迟（秒）
    
    def send_alert_notification(self, alert_record: AlertRecord, channel: AlertChannel) -> Tuple[bool, str]:
        """发送告警通知消息"""
        try:
            # 验证渠道类型
            if channel.type != 'dingtalk':
                return False, f"渠道类型不匹配，期望dingtalk，实际{channel.type}"
            
            # 验证渠道状态
            if not channel.is_enabled():
                return False, "告警渠道已禁用"
            
            # 验证配置
            is_valid, error_msg = channel.validate_config()
            if not is_valid:
                return False, f"渠道配置无效: {error_msg}"
            
            # 获取自定义模板
            custom_template = channel.config.get('message_template') if channel.config else None
            
            # 格式化消息（使用自定义模板）
            message = self.message_formatter.format_alert_message(alert_record, custom_template)
            
            # 添加@功能
            message = self._add_at_functionality(message, channel.config)
            
            # 发送消息（带重试机制）
            success, response_msg = self._send_message_with_retry(channel.config, message)
            
            # 记录发送状态
            self._record_notification_status(alert_record, channel, success, response_msg)
            
            return success, response_msg
            
        except Exception as e:
            error_msg = f"发送钉钉告警消息失败: {str(e)}"
            logger.error(error_msg, exc_info=True)
            self._record_notification_status(alert_record, channel, False, error_msg)
            return False, error_msg
    
    def send_test_notification(self, channel: AlertChannel) -> Tuple[bool, str]:
        """发送测试通知消息"""
        try:
            # 验证渠道类型
            if channel.type != 'dingtalk':
                return False, f"渠道类型不匹配，期望dingtalk，实际{channel.type}"
            
            # 验证配置
            is_valid, error_msg = channel.validate_config()
            if not is_valid:
                return False, f"渠道配置无效: {error_msg}"
            
            # 格式化测试消息
            message = self.message_formatter.format_test_message(channel.name)
            
            # 添加@功能
            message = self._add_at_functionality(message, channel.config)
            
            # 发送消息（带重试机制）
            return self._send_message_with_retry(channel.config, message)
            
        except Exception as e:
            error_msg = f"发送钉钉测试消息失败: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return False, error_msg
    
    def _add_at_functionality(self, message: Dict, config: Dict) -> Dict:
        """添加@功能到消息"""
        at_mobiles = config.get('at_mobiles', [])
        at_user_ids = config.get('at_user_ids', [])
        is_at_all = config.get('is_at_all', False)
        
        return self.message_formatter.format_at_message(
            message, at_mobiles, at_user_ids, is_at_all
        )
    
    def _send_message_with_retry(self, config: Dict, message: Dict) -> Tuple[bool, str]:
        """发送消息（带重试机制）"""
        last_error = None
        
        for attempt in range(self.max_retries):
            try:
                success, response_msg = self._send_message(config, message)
                
                if success:
                    if attempt > 0:
                        logger.info(f"钉钉消息发送成功（重试{attempt}次后）")
                    return True, response_msg
                else:
                    last_error = response_msg
                    # 如果是配置错误或API错误，不进行重试
                    if "配置" in response_msg or "API返回错误" in response_msg:
                        break
                
            except Exception as e:
                last_error = str(e)
                logger.warning(f"钉钉消息发送失败（第{attempt + 1}次尝试）: {last_error}")
            
            # 如果不是最后一次尝试，等待后重试
            if attempt < self.max_retries - 1:
                time.sleep(self.retry_delay * (attempt + 1))  # 递增延迟
        
        error_msg = f"钉钉消息发送失败（已重试{self.max_retries}次）: {last_error}"
        logger.error(error_msg)
        return False, error_msg
    
    def _send_message(self, config: Dict, message: Dict) -> Tuple[bool, str]:
        """发送单条消息"""
        try:
            # 构建请求URL
            webhook_url = self.webhook_manager.build_webhook_url(config)
            
            # 发送请求
            timeout = config.get('timeout', 10)
            response = requests.post(
                webhook_url,
                json=message,
                timeout=timeout,
                headers={'Content-Type': 'application/json'}
            )
            
            # 检查HTTP状态码
            if response.status_code != 200:
                return False, f"HTTP请求失败，状态码: {response.status_code}"
            
            # 解析响应
            try:
                result = response.json()
            except json.JSONDecodeError:
                return False, "响应格式错误，无法解析JSON"
            
            # 检查钉钉API响应
            errcode = result.get('errcode', -1)
            errmsg = result.get('errmsg', '未知错误')
            
            if errcode == 0:
                logger.info("钉钉消息发送成功")
                return True, "钉钉消息发送成功"
            else:
                error_msg = f"钉钉API返回错误 (errcode: {errcode}): {errmsg}"
                logger.error(error_msg)
                return False, error_msg
        
        except requests.exceptions.Timeout:
            return False, "请求超时"
        except requests.exceptions.ConnectionError:
            return False, "连接失败，请检查网络连接"
        except requests.exceptions.RequestException as e:
            return False, f"请求异常: {str(e)}"
        except Exception as e:
            return False, f"发送消息失败: {str(e)}"
    
    def _record_notification_status(self, alert_record: AlertRecord, channel: AlertChannel, 
                                  success: bool, message: str):
        """记录通知发送状态"""
        try:
            notification = AlertNotification(
                tenant_id=alert_record.tenant_id,
                alert_record_id=alert_record.id,
                channel_id=channel.id,
                status='sent' if success else 'failed',
                sent_at=datetime.now(timezone.utc) if success else None,
                error_message=None if success else message
            )
            
            db.session.add(notification)
            db.session.commit()
            
        except Exception as e:
            logger.error(f"记录通知状态失败: {str(e)}", exc_info=True)
            db.session.rollback()
    
    def get_notification_statistics(self, tenant_id: int, days: int = 7) -> Dict:
        """获取通知发送统计"""
        try:
            from datetime import timedelta
            from sqlalchemy import func
            
            start_date = datetime.now(timezone.utc) - timedelta(days=days)
            
            # 查询钉钉渠道的统计数据
            stats = db.session.query(
                AlertNotification.status,
                func.count(AlertNotification.id).label('count')
            ).join(
                AlertChannel, AlertNotification.channel_id == AlertChannel.id
            ).filter(
                AlertNotification.tenant_id == tenant_id,
                AlertChannel.type == 'dingtalk',
                AlertNotification.created_at >= start_date
            ).group_by(AlertNotification.status).all()
            
            # 格式化统计结果
            result = {
                'total': 0,
                'sent': 0,
                'failed': 0,
                'pending': 0,
                'success_rate': 0.0
            }
            
            for status, count in stats:
                result[status] = count
                result['total'] += count
            
            # 计算成功率
            if result['total'] > 0:
                result['success_rate'] = round((result['sent'] / result['total']) * 100, 2)
            
            return result
            
        except Exception as e:
            logger.error(f"获取钉钉通知统计失败: {str(e)}", exc_info=True)
            return {
                'total': 0,
                'sent': 0,
                'failed': 0,
                'pending': 0,
                'success_rate': 0.0
            }
    
    def get_supported_message_types(self) -> List[str]:
        """获取支持的消息类型"""
        return ['text', 'markdown', 'link', 'actionCard', 'feedCard']
    
    def validate_message_format(self, message: Dict) -> Tuple[bool, str]:
        """验证消息格式"""
        if not isinstance(message, dict):
            return False, "消息必须为字典格式"
        
        if 'msgtype' not in message:
            return False, "消息缺少msgtype字段"
        
        msgtype = message['msgtype']
        supported_types = self.get_supported_message_types()
        
        if msgtype not in supported_types:
            return False, f"不支持的消息类型: {msgtype}，支持的类型: {', '.join(supported_types)}"
        
        # 验证具体消息类型的格式
        if msgtype == 'text' and 'text' not in message:
            return False, "text类型消息缺少text字段"
        elif msgtype == 'markdown' and 'markdown' not in message:
            return False, "markdown类型消息缺少markdown字段"
        elif msgtype == 'link' and 'link' not in message:
            return False, "link类型消息缺少link字段"
        
        return True, "消息格式验证通过"


# 全局服务实例
dingtalk_notification_service = DingTalkNotificationService()


# 扩展方法：支持网络探测告警通知
def _send_network_alert_notification(self, notification_data: Dict[str, Any], channel: AlertChannel) -> Tuple[bool, str]:
    """发送网络探测告警通知到钉钉"""
    try:
        # 验证渠道类型
        if channel.type != 'dingtalk':
            return False, f"渠道类型不匹配，期望dingtalk，实际{channel.type}"
        
        # 验证渠道状态
        if not channel.is_enabled():
            return False, "告警渠道已禁用"
        
        # 验证配置
        is_valid, error_msg = channel.validate_config()
        if not is_valid:
            return False, f"渠道配置无效: {error_msg}"
        
        # 准备钉钉消息
        message_data = {
            'msgtype': 'markdown',
            'markdown': {
                'title': f"网络探测告警 - {notification_data.get('probe_name', 'Unknown')}",
                'text': self._format_network_alert_markdown(notification_data)
            }
        }
        
        # 发送消息
        success, message = self._send_message(channel.config, message_data)
        
        return success, message
        
    except Exception as e:
        error_msg = f"发送网络探测告警通知到钉钉失败: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return False, error_msg


def _format_network_alert_markdown(self, notification_data: Dict[str, Any]) -> str:
    """格式化网络探测告警为Markdown格式"""
    try:
        probe_name = notification_data.get('probe_name', 'Unknown')
        probe_url = notification_data.get('probe_url', '')
        rule_name = notification_data.get('rule_name', 'Unknown')
        status = notification_data.get('status', 'active')
        message = notification_data.get('message', '')
        triggered_value = notification_data.get('triggered_value')
        first_triggered_at = notification_data.get('first_triggered_at', '')
        last_triggered_at = notification_data.get('last_triggered_at', '')
        
        # 状态映射
        status_map = {
            'active': '🔴 活跃',
            'acknowledged': '🟡 已确认',
            'resolved': '🟢 已解决'
        }
        status_text = status_map.get(status, status)
        
        # 构建Markdown消息
        markdown_text = f"### 🚨 网络探测告警\n\n"
        markdown_text += f"**探测任务：** {probe_name}\n\n"
        
        if probe_url:
            markdown_text += f"**目标地址：** {probe_url}\n\n"
        
        markdown_text += f"**告警规则：** {rule_name}\n\n"
        markdown_text += f"**告警状态：** {status_text}\n\n"
        markdown_text += f"**告警信息：** {message}\n\n"
        
        if triggered_value is not None:
            markdown_text += f"**触发值：** {triggered_value}\n\n"
        
        if first_triggered_at:
            markdown_text += f"**首次触发：** {first_triggered_at}\n\n"
        
        if last_triggered_at:
            markdown_text += f"**最后触发：** {last_triggered_at}\n\n"
        
        markdown_text += f"---\n\n"
        markdown_text += f"*告警时间：{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}*"
        
        return markdown_text
        
    except Exception as e:
        logger.error(f"格式化网络探测告警Markdown失败: {str(e)}", exc_info=True)
        return f"网络探测告警 - {notification_data.get('probe_name', 'Unknown')}"


# 动态添加方法到DingTalkNotificationService类
DingTalkNotificationService.send_network_alert_notification = _send_network_alert_notification
DingTalkNotificationService._format_network_alert_markdown = _format_network_alert_markdown
