"""
邮箱告警通知服务
"""
import smtplib
import ssl
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
from typing import Dict, List, Optional, Tuple
from jinja2 import Template, Environment, BaseLoader
import logging

from app.extensions import db
from app.models.monitor import AlertChannel, AlertNotification, AlertRecord


logger = logging.getLogger(__name__)


class EmailTemplateEngine:
    """邮件模板引擎"""
    
    def __init__(self):
        self.env = Environment(loader=BaseLoader())
        self._templates = {
            'alert_notification': self._get_alert_template(),
            'test_notification': self._get_test_template()
        }
    
    def _get_alert_template(self) -> str:
        """获取告警通知邮件模板"""
        return """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{{ subject }}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background-color: {% if severity == 'critical' %}#ff4d4f{% elif severity == 'warning' %}#faad14{% else %}#1890ff{% endif %}; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .alert-info { background-color: #f6f8fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .alert-info h3 { margin-top: 0; color: #333; }
        .info-row { display: flex; justify-content: space-between; margin: 8px 0; }
        .info-label { font-weight: bold; color: #666; }
        .info-value { color: #333; }
        .footer { background-color: #f6f8fa; padding: 15px; text-align: center; color: #666; font-size: 12px; }
        .severity-critical { color: #ff4d4f; font-weight: bold; }
        .severity-warning { color: #faad14; font-weight: bold; }
        .severity-info { color: #1890ff; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 系统告警通知</h1>
            <p>{{ subject }}</p>
        </div>
        <div class="content">
            <div class="alert-info">
                <h3>告警详情</h3>
                <div class="info-row">
                    <span class="info-label">告警规则:</span>
                    <span class="info-value">{{ rule_name }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">主机名称:</span>
                    <span class="info-value">{{ host_name }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">监控指标:</span>
                    <span class="info-value">{{ metric_type_display }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">当前值:</span>
                    <span class="info-value">{{ current_value }}{{ unit }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">阈值:</span>
                    <span class="info-value">{{ condition_operator }} {{ threshold_value }}{{ unit }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">严重级别:</span>
                    <span class="info-value severity-{{ severity }}">{{ severity_display }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">触发时间:</span>
                    <span class="info-value">{{ triggered_at }}</span>
                </div>
            </div>
            
            <div class="alert-info">
                <h3>告警描述</h3>
                <p>{{ message }}</p>
            </div>
            
            {% if rule_description %}
            <div class="alert-info">
                <h3>规则说明</h3>
                <p>{{ rule_description }}</p>
            </div>
            {% endif %}
        </div>
        <div class="footer">
            <p>此邮件由 MiTong运维平台 自动发送，请勿回复</p>
            <p>发送时间: {{ sent_at }}</p>
        </div>
    </div>
</body>
</html>
        """
    
    def _get_test_template(self) -> str:
        """获取测试邮件模板"""
        return """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>邮箱告警渠道测试</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background-color: #52c41a; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .test-info { background-color: #f6f8fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .footer { background-color: #f6f8fa; padding: 15px; text-align: center; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ 邮箱告警渠道测试</h1>
            <p>测试邮件发送成功</p>
        </div>
        <div class="content">
            <div class="test-info">
                <h3>测试信息</h3>
                <p><strong>渠道名称:</strong> {{ channel_name }}</p>
                <p><strong>测试时间:</strong> {{ test_time }}</p>
                <p><strong>发送状态:</strong> 成功</p>
            </div>
            <p>如果您收到此邮件，说明邮箱告警渠道配置正确，可以正常发送告警通知。</p>
        </div>
        <div class="footer">
            <p>此邮件由 MiTong运维平台 自动发送，请勿回复</p>
        </div>
    </div>
</body>
</html>
        """
    
    def render_template(self, template_name: str, **kwargs) -> str:
        """渲染邮件模板"""
        if template_name not in self._templates:
            raise ValueError(f"未找到模板: {template_name}")
        
        template = self.env.from_string(self._templates[template_name])
        return template.render(**kwargs)
    
    def get_alert_subject(self, alert_record: AlertRecord) -> str:
        """生成告警邮件主题"""
        severity_map = {
            'critical': '【严重】',
            'warning': '【警告】',
            'info': '【信息】'
        }
        severity_prefix = severity_map.get(alert_record.severity, '【告警】')
        
        return f"{severity_prefix}{alert_record.host.name} - {alert_record.rule.name}"


class SMTPConfigManager:
    """SMTP 配置管理器"""
    
    @staticmethod
    def validate_smtp_config(config: Dict) -> Tuple[bool, str]:
        """验证 SMTP 配置"""
        required_fields = ['smtp_server', 'smtp_port', 'username', 'password', 'from_email', 'to_emails']
        
        for field in required_fields:
            if field not in config:
                return False, f"缺少必需字段: {field}"
        
        # 验证端口号
        try:
            port = int(config['smtp_port'])
            if port <= 0 or port > 65535:
                return False, "SMTP端口号必须在1-65535之间"
        except (ValueError, TypeError):
            return False, "SMTP端口号必须为有效数字"
        
        # 验证收件人邮箱列表
        to_emails = config.get('to_emails')
        if not isinstance(to_emails, list) or not to_emails:
            return False, "收件人邮箱列表不能为空"
        
        # 验证邮箱格式
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        
        if not re.match(email_pattern, config['from_email']):
            return False, "发件人邮箱格式不正确"
        
        for email in to_emails:
            if not isinstance(email, str) or not re.match(email_pattern, email):
                return False, f"收件人邮箱格式不正确: {email}"
        
        return True, "配置验证通过"
    
    @staticmethod
    def test_smtp_connection(config: Dict) -> Tuple[bool, str]:
        """测试 SMTP 连接"""
        try:
            smtp_server = config['smtp_server']
            smtp_port = int(config['smtp_port'])
            username = config['username']
            password = config['password']
            use_tls = config.get('use_tls', True)
            use_ssl = config.get('use_ssl', False)
            
            # 创建 SMTP 连接
            if use_ssl:
                server = smtplib.SMTP_SSL(smtp_server, smtp_port)
            else:
                server = smtplib.SMTP(smtp_server, smtp_port)
                if use_tls:
                    server.starttls()
            
            # 登录验证
            server.login(username, password)
            server.quit()
            
            return True, "SMTP连接测试成功"
            
        except smtplib.SMTPAuthenticationError:
            return False, "SMTP认证失败，请检查用户名和密码"
        except smtplib.SMTPConnectError:
            return False, "无法连接到SMTP服务器，请检查服务器地址和端口"
        except smtplib.SMTPException as e:
            return False, f"SMTP错误: {str(e)}"
        except Exception as e:
            return False, f"连接测试失败: {str(e)}"


class EmailNotificationService:
    """邮箱告警通知服务"""
    
    def __init__(self):
        self.template_engine = EmailTemplateEngine()
        self.smtp_manager = SMTPConfigManager()
    
    def send_alert_notification(self, alert_record: AlertRecord, channel: AlertChannel) -> Tuple[bool, str]:
        """发送告警通知邮件"""
        try:
            # 验证渠道类型
            if channel.type != 'email':
                return False, f"渠道类型不匹配，期望email，实际{channel.type}"
            
            # 验证渠道状态
            if not channel.is_enabled():
                return False, "告警渠道已禁用"
            
            # 验证配置
            is_valid, error_msg = channel.validate_config()
            if not is_valid:
                return False, f"渠道配置无效: {error_msg}"
            
            # 准备邮件数据
            email_data = self._prepare_alert_email_data(alert_record)
            
            # 生成邮件内容
            subject = self.template_engine.get_alert_subject(alert_record)
            html_content = self.template_engine.render_template('alert_notification', **email_data)
            
            # 发送邮件
            success, message = self._send_email(
                channel.config,
                subject,
                html_content,
                channel.config['to_emails']
            )
            
            # 记录发送状态
            self._record_notification_status(alert_record, channel, success, message)
            
            return success, message
            
        except Exception as e:
            error_msg = f"发送告警邮件失败: {str(e)}"
            logger.error(error_msg, exc_info=True)
            self._record_notification_status(alert_record, channel, False, error_msg)
            return False, error_msg
    
    def send_test_notification(self, channel: AlertChannel) -> Tuple[bool, str]:
        """发送测试通知邮件"""
        try:
            # 验证渠道类型
            if channel.type != 'email':
                return False, f"渠道类型不匹配，期望email，实际{channel.type}"
            
            # 验证配置
            is_valid, error_msg = channel.validate_config()
            if not is_valid:
                return False, f"渠道配置无效: {error_msg}"
            
            # 准备测试邮件数据
            test_data = {
                'channel_name': channel.name,
                'test_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
            
            # 生成邮件内容
            subject = f"【测试】{channel.name} - 邮箱告警渠道测试"
            html_content = self.template_engine.render_template('test_notification', **test_data)
            
            # 发送邮件
            return self._send_email(
                channel.config,
                subject,
                html_content,
                channel.config['to_emails']
            )
            
        except Exception as e:
            error_msg = f"发送测试邮件失败: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return False, error_msg
    
    def _prepare_alert_email_data(self, alert_record: AlertRecord) -> Dict:
        """准备告警邮件数据"""
        # 指标类型显示名称映射
        metric_display_map = {
            'cpu': 'CPU使用率',
            'memory': '内存使用率',
            'disk': '磁盘使用率',
            'load': '系统负载'
        }
        
        # 严重级别显示名称映射
        severity_display_map = {
            'critical': '严重',
            'warning': '警告',
            'info': '信息'
        }
        
        # 单位映射
        unit_map = {
            'cpu': '%',
            'memory': '%',
            'disk': '%',
            'load': ''
        }
        
        return {
            'subject': self.template_engine.get_alert_subject(alert_record),
            'rule_name': alert_record.rule.name,
            'rule_description': alert_record.rule.description,
            'host_name': alert_record.host.name,
            'metric_type': alert_record.metric_type,
            'metric_type_display': metric_display_map.get(alert_record.metric_type, alert_record.metric_type),
            'current_value': float(alert_record.current_value),
            'threshold_value': float(alert_record.threshold_value),
            'condition_operator': alert_record.rule.condition_operator,
            'severity': alert_record.severity,
            'severity_display': severity_display_map.get(alert_record.severity, alert_record.severity),
            'unit': unit_map.get(alert_record.metric_type, ''),
            'message': alert_record.message,
            'triggered_at': alert_record.first_triggered_at.strftime('%Y-%m-%d %H:%M:%S'),
            'sent_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
    
    def _send_email(self, config: Dict, subject: str, html_content: str, to_emails: List[str]) -> Tuple[bool, str]:
        """发送邮件"""
        try:
            # 获取配置参数
            smtp_server = config['smtp_server']
            smtp_port = int(config['smtp_port'])
            username = config['username']
            password = config['password']
            from_email = config['from_email']
            use_tls = config.get('use_tls', True)
            use_ssl = config.get('use_ssl', False)
            
            # 创建邮件消息
            msg = MIMEMultipart('alternative')
            msg['Subject'] = Header(subject, 'utf-8')
            msg['From'] = from_email
            msg['To'] = ', '.join(to_emails)
            
            # 添加HTML内容
            html_part = MIMEText(html_content, 'html', 'utf-8')
            msg.attach(html_part)
            
            # 创建SMTP连接并发送邮件
            if use_ssl:
                server = smtplib.SMTP_SSL(smtp_server, smtp_port)
            else:
                server = smtplib.SMTP(smtp_server, smtp_port)
                if use_tls:
                    server.starttls()
            
            server.login(username, password)
            server.send_message(msg, from_addr=from_email, to_addrs=to_emails)
            server.quit()
            
            logger.info(f"邮件发送成功: {subject} -> {', '.join(to_emails)}")
            return True, "邮件发送成功"
            
        except smtplib.SMTPAuthenticationError:
            error_msg = "SMTP认证失败，请检查用户名和密码"
            logger.error(error_msg)
            return False, error_msg
        except smtplib.SMTPRecipientsRefused:
            error_msg = "收件人地址被拒绝"
            logger.error(error_msg)
            return False, error_msg
        except smtplib.SMTPSenderRefused:
            error_msg = "发件人地址被拒绝"
            logger.error(error_msg)
            return False, error_msg
        except smtplib.SMTPConnectError:
            error_msg = "无法连接到SMTP服务器"
            logger.error(error_msg)
            return False, error_msg
        except smtplib.SMTPException as e:
            error_msg = f"SMTP错误: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
        except Exception as e:
            error_msg = f"发送邮件失败: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return False, error_msg
    
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
            
            # 查询统计数据
            stats = db.session.query(
                AlertNotification.status,
                func.count(AlertNotification.id).label('count')
            ).filter(
                AlertNotification.tenant_id == tenant_id,
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
            logger.error(f"获取通知统计失败: {str(e)}", exc_info=True)
            return {
                'total': 0,
                'sent': 0,
                'failed': 0,
                'pending': 0,
                'success_rate': 0.0
            }


# 全局服务实例
email_notification_service = EmailNotificationService()


# 扩展方法：支持网络探测告警通知
def _send_network_alert_notification(self, notification_data: Dict[str, Any], channel: AlertChannel) -> Tuple[bool, str]:
    """发送网络探测告警通知邮件"""
    try:
        # 验证渠道类型
        if channel.type != 'email':
            return False, f"渠道类型不匹配，期望email，实际{channel.type}"
        
        # 验证渠道状态
        if not channel.is_enabled():
            return False, "告警渠道已禁用"
        
        # 验证配置
        is_valid, error_msg = channel.validate_config()
        if not is_valid:
            return False, f"渠道配置无效: {error_msg}"
        
        # 准备邮件数据
        email_data = {
            'alert_type': notification_data.get('alert_type', 'network_probe'),
            'rule_name': notification_data.get('rule_name', 'Unknown'),
            'probe_name': notification_data.get('probe_name', 'Unknown'),
            'probe_url': notification_data.get('probe_url', ''),
            'status': notification_data.get('status', 'active'),
            'message': notification_data.get('message', ''),
            'triggered_value': notification_data.get('triggered_value'),
            'first_triggered_at': notification_data.get('first_triggered_at', ''),
            'last_triggered_at': notification_data.get('last_triggered_at', ''),
            'timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
        }
        
        # 生成邮件内容
        subject = f"【网络探测告警】{notification_data.get('probe_name', 'Unknown')}"
        html_content = self.template_engine.render_template('network_alert_notification', **email_data)
        
        # 发送邮件
        success, message = self._send_email(
            channel.config,
            subject,
            html_content
        )
        
        return success, message
        
    except Exception as e:
        error_msg = f"发送网络探测告警通知邮件失败: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return False, error_msg


# 动态添加方法到EmailNotificationService类
EmailNotificationService.send_network_alert_notification = _send_network_alert_notification
