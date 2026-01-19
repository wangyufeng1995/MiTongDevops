/**
 * 监控告警相关类型定义
 */

// 告警渠道类型
export type AlertChannelType = 'email' | 'dingtalk'

// 告警严重级别
export type AlertSeverity = 'info' | 'warning' | 'critical'

// 指标类型
export type MetricType = 'cpu' | 'memory' | 'disk' | 'load'

// 条件操作符
export type ConditionOperator = '>' | '<' | '>=' | '<=' | '=='

// 告警状态
export type AlertStatus = 'active' | 'acknowledged' | 'ignored' | 'resolved'

// 通知状态
export type NotificationStatus = 'pending' | 'sent' | 'failed'

// 邮箱配置
export interface EmailConfig {
  smtp_server: string
  smtp_port: number
  username: string
  password: string
  from_email: string
  to_emails: string[]
  use_tls?: boolean
  use_ssl?: boolean
}

// 钉钉配置
export interface DingTalkConfig {
  webhook_url: string
  secret?: string
  name?: string
  at_mobiles?: string[]
  at_all?: boolean
  message_template?: string  // 自定义告警模板
  security_type?: 'none' | 'keyword' | 'signature' | 'ip'  // 安全类型
  keywords?: string[]  // 关键词（当security_type为keyword时使用）
}

// 告警渠道
export interface AlertChannel {
  id: number
  tenant_id: number
  name: string
  type: AlertChannelType
  config: EmailConfig | DingTalkConfig
  description?: string
  status: number
  created_by: number
  creator_name?: string
  created_at: string
  updated_at: string
  rules_count?: number
  notification_stats?: NotificationStats
}

// 创建告警渠道请求
export interface CreateAlertChannelRequest {
  name: string
  type: AlertChannelType
  config: EmailConfig | DingTalkConfig
  description?: string
  status?: number
}

// 更新告警渠道请求
export interface UpdateAlertChannelRequest {
  name?: string
  type?: AlertChannelType
  config?: EmailConfig | DingTalkConfig
  description?: string
  status?: number
}

// 告警规则
export interface AlertRule {
  id: number
  tenant_id: number
  name: string
  description?: string
  metric_type: MetricType
  condition_operator: ConditionOperator
  threshold_value: number
  duration: number
  severity: AlertSeverity
  host_ids?: number[]
  channel_ids: number[]
  silence_period: number
  enabled: boolean
  created_by: number
  creator_name?: string
  created_at: string
  updated_at: string
  channels?: Array<{
    id: number
    name: string
    type: AlertChannelType
  }>
  hosts?: Array<{
    id: number
    name: string
    hostname: string
  }>
  applies_to_all_hosts?: boolean
  recent_alerts_count?: number
}

// 创建告警规则请求
export interface CreateAlertRuleRequest {
  name: string
  description?: string
  metric_type: MetricType
  condition_operator: ConditionOperator
  threshold_value: number
  duration?: number
  severity?: AlertSeverity
  host_ids?: number[]
  channel_ids: number[]
  silence_period?: number
  enabled?: boolean
}

// 更新告警规则请求
export interface UpdateAlertRuleRequest {
  name?: string
  description?: string
  metric_type?: MetricType
  condition_operator?: ConditionOperator
  threshold_value?: number
  duration?: number
  severity?: AlertSeverity
  host_ids?: number[]
  channel_ids?: number[]
  silence_period?: number
  enabled?: boolean
}

// 告警记录
export interface AlertRecord {
  id: number
  tenant_id: number
  rule_id: number
  host_id: number
  metric_type: MetricType
  current_value: number
  threshold_value: number
  severity: AlertSeverity
  status: AlertStatus
  message: string
  first_triggered_at: string
  last_triggered_at: string
  acknowledged_at?: string
  acknowledged_by?: number
  resolved_at?: string
  created_at: string
  rule?: {
    id: number
    name: string
  }
  host?: {
    id: number
    name: string
    hostname: string
  }
  acknowledger?: {
    id: number
    username: string
  }
}

// 告警通知记录
export interface AlertNotification {
  id: number
  tenant_id: number
  alert_record_id: number
  channel_id: number
  status: NotificationStatus
  sent_at?: string
  error_message?: string
  created_at: string
  channel?: {
    id: number
    name: string
    type: AlertChannelType
  }
}

// 通知统计
export interface NotificationStats {
  total: number
  sent: number
  failed: number
  success_rate: number
}

// 监控大屏数据
export interface MonitorDashboardData {
  summary: {
    total_hosts: number
    online_hosts: number
    offline_hosts: number
    total_rules: number
    enabled_rules: number
    active_alerts: number
    resolved_alerts: number
  }
  host_status: Array<{
    id: number
    name: string
    hostname: string
    status: 'online' | 'offline'
    cpu_usage?: number
    memory_usage?: number
    disk_usage?: number
    last_check: string
  }>
  recent_alerts: AlertRecord[]
  alert_trends: Array<{
    date: string
    count: number
    severity_breakdown: {
      info: number
      warning: number
      critical: number
    }
  }>
  channel_stats: Array<{
    channel_id: number
    channel_name: string
    channel_type: AlertChannelType
    total_notifications: number
    success_rate: number
  }>
}

// 告警渠道查询参数
export interface AlertChannelQueryParams {
  page?: number
  per_page?: number
  type?: AlertChannelType
  status?: number
  search?: string
}

// 告警规则查询参数
export interface AlertRuleQueryParams {
  page?: number
  per_page?: number
  metric_type?: MetricType
  severity?: AlertSeverity
  enabled?: number
  search?: string
}

// 告警记录查询参数
export interface AlertRecordQueryParams {
  page?: number
  per_page?: number
  rule_id?: number
  host_id?: number
  severity?: AlertSeverity
  status?: AlertStatus
  start_date?: string
  end_date?: string
  search?: string
}

// 告警确认请求
export interface AcknowledgeAlertRequest {
  message?: string
}

// 告警忽略请求
export interface IgnoreAlertRequest {
  reason?: string
}