/**
 * 告警相关类型定义
 */

export interface Alert {
  id: string
  title: string
  description: string
  level: AlertLevel
  status: AlertStatus
  source: string
  created_at: string
  updated_at: string
  acknowledged_by?: string
  acknowledged_at?: string
  resolved_by?: string
  resolved_at?: string
  tags: string[]
  metadata?: Record<string, any>
  history?: AlertHistoryItem[]
  metrics?: AlertMetric[]
}

export type AlertLevel = 'critical' | 'warning' | 'info'

export type AlertStatus = 'active' | 'acknowledged' | 'resolved'

export interface AlertHistoryItem {
  id: string
  action: AlertAction
  user: string
  timestamp: string
  comment?: string
}

export type AlertAction = 'created' | 'acknowledged' | 'resolved' | 'updated'

export interface AlertMetric {
  name: string
  value: number
  unit: string
  timestamp: string
}

export interface AlertListParams {
  page?: number
  limit?: number
  level?: AlertLevel | 'all'
  status?: AlertStatus | 'all'
  source?: string
  search?: string
  start_date?: string
  end_date?: string
  sort_by?: 'created_at' | 'updated_at' | 'level' | 'status'
  sort_order?: 'asc' | 'desc'
}

export interface AlertListResponse {
  alerts: Alert[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export interface AlertStatistics {
  total_alerts: number
  active_alerts: number
  acknowledged_alerts: number
  resolved_alerts: number
  critical_alerts: number
  warning_alerts: number
  info_alerts: number
  avg_resolution_time: number
  resolution_rate: number
  trend_data: TrendData[]
  level_distribution: LevelDistribution[]
  source_distribution: SourceDistribution[]
  daily_stats: DailyStats[]
}

export interface TrendData {
  date: string
  active: number
  resolved: number
  total: number
}

export interface LevelDistribution {
  level: AlertLevel
  count: number
  percentage: number
}

export interface SourceDistribution {
  source: string
  count: number
  percentage: number
}

export interface DailyStats {
  date: string
  created: number
  resolved: number
  avg_resolution_time: number
}

export interface AlertRule {
  id: string
  name: string
  description: string
  condition: string
  level: AlertLevel
  enabled: boolean
  source: string
  threshold: number
  duration: number
  channels: string[]
  created_at: string
  updated_at: string
  created_by: string
}

export interface AlertChannel {
  id: string
  name: string
  type: ChannelType
  config: Record<string, any>
  enabled: boolean
  created_at: string
  updated_at: string
}

export type ChannelType = 'email' | 'webhook' | 'slack' | 'dingtalk' | 'wechat' | 'sms'

export interface AlertActionRequest {
  action: 'acknowledge' | 'resolve'
  comment?: string
}

export interface BatchAlertActionRequest {
  alert_ids: string[]
  action: 'acknowledge' | 'resolve'
  comment?: string
}

export interface AlertExportParams {
  format?: 'csv' | 'excel'
  start_date?: string
  end_date?: string
  level?: AlertLevel
  status?: AlertStatus
}

// 告警级别配置
export const ALERT_LEVELS: Record<AlertLevel, {
  label: string
  color: string
  bgColor: string
  borderColor: string
  priority: number
}> = {
  critical: {
    label: '严重',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    priority: 1
  },
  warning: {
    label: '警告',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    priority: 2
  },
  info: {
    label: '信息',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    priority: 3
  }
}

// 告警状态配置
export const ALERT_STATUSES: Record<AlertStatus, {
  label: string
  color: string
  bgColor: string
}> = {
  active: {
    label: '活跃',
    color: 'text-red-600',
    bgColor: 'bg-red-100'
  },
  acknowledged: {
    label: '已确认',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100'
  },
  resolved: {
    label: '已解决',
    color: 'text-green-600',
    bgColor: 'bg-green-100'
  }
}

// 渠道类型配置
export const CHANNEL_TYPES: Record<ChannelType, {
  label: string
  icon: string
  description: string
}> = {
  email: {
    label: '邮件',
    icon: '📧',
    description: '通过邮件发送告警通知'
  },
  webhook: {
    label: 'Webhook',
    icon: '🔗',
    description: '通过HTTP请求发送告警数据'
  },
  slack: {
    label: 'Slack',
    icon: '💬',
    description: '发送消息到Slack频道'
  },
  dingtalk: {
    label: '钉钉',
    icon: '📱',
    description: '发送消息到钉钉群'
  },
  wechat: {
    label: '企业微信',
    icon: '💼',
    description: '发送消息到企业微信群'
  },
  sms: {
    label: '短信',
    icon: '📲',
    description: '发送短信通知'
  }
}