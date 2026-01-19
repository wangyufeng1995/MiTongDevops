/**
 * 监控告警 API 服务
 */
import { BaseApiService } from './base'
import { api } from './api'
import { ApiResponse, PaginatedResponse } from '../types/api'
import {
  AlertChannel,
  AlertRule,
  AlertRecord,
  AlertNotification,
  MonitorDashboardData,
  CreateAlertChannelRequest,
  UpdateAlertChannelRequest,
  CreateAlertRuleRequest,
  UpdateAlertRuleRequest,
  AlertChannelQueryParams,
  AlertRuleQueryParams,
  AlertRecordQueryParams,
  AcknowledgeAlertRequest,
  IgnoreAlertRequest,
  NotificationStats
} from '../types/monitor'

/**
 * 告警渠道服务
 */
export class AlertChannelService extends BaseApiService<
  AlertChannel,
  CreateAlertChannelRequest,
  UpdateAlertChannelRequest
> {
  constructor() {
    super('/api/monitor/channels')
  }

  /**
   * 获取告警渠道列表（支持筛选）
   */
  async getChannels(params?: AlertChannelQueryParams): Promise<ApiResponse<PaginatedResponse<AlertChannel>>> {
    const queryParams = new URLSearchParams()
    
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.per_page) queryParams.append('per_page', params.per_page.toString())
    if (params?.type) queryParams.append('type', params.type)
    if (params?.status !== undefined) queryParams.append('status', params.status.toString())
    if (params?.search) queryParams.append('search', params.search)

    const url = queryParams.toString() ? `${this.baseUrl}?${queryParams}` : this.baseUrl
    const response = await api.get<{
      channels: AlertChannel[]
      pagination: {
        page: number
        per_page: number
        total: number
        pages: number
        has_prev: boolean
        has_next: boolean
      }
    }>(url)

    // 转换为标准分页格式
    return {
      ...response,
      data: {
        items: response.data.channels,
        total: response.data.pagination.total,
        page: response.data.pagination.page,
        per_page: response.data.pagination.per_page,
        pages: response.data.pagination.pages
      }
    }
  }

  /**
   * 测试告警渠道
   */
  async testChannel(id: number): Promise<ApiResponse<{ message: string }>> {
    return api.post<{ message: string }>(`${this.baseUrl}/${id}/test`)
  }

  /**
   * 获取渠道通知统计
   */
  async getChannelStats(id: number, days: number = 7): Promise<ApiResponse<NotificationStats>> {
    return api.get<NotificationStats>(`${this.baseUrl}/${id}/stats?days=${days}`)
  }

  /**
   * 批量启用渠道
   */
  async batchEnable(ids: number[]): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.baseUrl}/batch-enable`, { ids })
  }

  /**
   * 批量禁用渠道
   */
  async batchDisable(ids: number[]): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.baseUrl}/batch-disable`, { ids })
  }
}

/**
 * 告警规则服务
 */
export class AlertRuleService extends BaseApiService<
  AlertRule,
  CreateAlertRuleRequest,
  UpdateAlertRuleRequest
> {
  constructor() {
    super('/api/monitor/rules')
  }

  /**
   * 获取告警规则列表（支持筛选）
   */
  async getRules(params?: AlertRuleQueryParams): Promise<ApiResponse<PaginatedResponse<AlertRule>>> {
    const queryParams = new URLSearchParams()
    
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.per_page) queryParams.append('per_page', params.per_page.toString())
    if (params?.metric_type) queryParams.append('metric_type', params.metric_type)
    if (params?.severity) queryParams.append('severity', params.severity)
    if (params?.enabled !== undefined) queryParams.append('enabled', params.enabled.toString())
    if (params?.search) queryParams.append('search', params.search)

    const url = queryParams.toString() ? `${this.baseUrl}?${queryParams}` : this.baseUrl
    const response = await api.get<{
      rules: AlertRule[]
      pagination: {
        page: number
        per_page: number
        total: number
        pages: number
        has_prev: boolean
        has_next: boolean
      }
    }>(url)

    // 转换为标准分页格式
    return {
      ...response,
      data: {
        items: response.data.rules,
        total: response.data.pagination.total,
        page: response.data.pagination.page,
        per_page: response.data.pagination.per_page,
        pages: response.data.pagination.pages
      }
    }
  }

  /**
   * 启用告警规则
   */
  async enableRule(id: number): Promise<ApiResponse<AlertRule>> {
    return api.post<AlertRule>(`${this.baseUrl}/${id}/enable`)
  }

  /**
   * 禁用告警规则
   */
  async disableRule(id: number): Promise<ApiResponse<AlertRule>> {
    return api.post<AlertRule>(`${this.baseUrl}/${id}/disable`)
  }

  /**
   * 批量启用规则
   */
  async batchEnable(ids: number[]): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.baseUrl}/batch-enable`, { ids })
  }

  /**
   * 批量禁用规则
   */
  async batchDisable(ids: number[]): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.baseUrl}/batch-disable`, { ids })
  }

  /**
   * 复制告警规则
   */
  async duplicateRule(id: number, name: string): Promise<ApiResponse<AlertRule>> {
    return api.post<AlertRule>(`${this.baseUrl}/${id}/duplicate`, { name })
  }

  /**
   * 获取规则告警统计
   */
  async getRuleStats(id: number, days: number = 30): Promise<ApiResponse<{
    total_alerts: number
    active_alerts: number
    resolved_alerts: number
    alert_trends: Array<{
      date: string
      count: number
    }>
  }>> {
    return api.get(`${this.baseUrl}/${id}/stats?days=${days}`)
  }
}

/**
 * 告警记录服务
 */
export class AlertRecordService {
  private baseUrl = '/api/monitor/alerts'

  /**
   * 获取告警记录列表
   */
  async getAlerts(params?: AlertRecordQueryParams): Promise<ApiResponse<PaginatedResponse<AlertRecord>>> {
    const queryParams = new URLSearchParams()
    
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.per_page) queryParams.append('per_page', params.per_page.toString())
    if (params?.rule_id) queryParams.append('rule_id', params.rule_id.toString())
    if (params?.host_id) queryParams.append('host_id', params.host_id.toString())
    if (params?.severity) queryParams.append('severity', params.severity)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.start_date) queryParams.append('start_date', params.start_date)
    if (params?.end_date) queryParams.append('end_date', params.end_date)
    if (params?.search) queryParams.append('search', params.search)

    const url = queryParams.toString() ? `${this.baseUrl}?${queryParams}` : this.baseUrl
    const response = await api.get<{
      alerts: AlertRecord[]
      pagination: {
        page: number
        per_page: number
        total: number
        pages: number
        has_prev: boolean
        has_next: boolean
      }
    }>(url)

    // 转换为标准分页格式
    return {
      ...response,
      data: {
        items: response.data.alerts,
        total: response.data.pagination.total,
        page: response.data.pagination.page,
        per_page: response.data.pagination.per_page,
        pages: response.data.pagination.pages
      }
    }
  }

  /**
   * 获取告警记录详情
   */
  async getAlert(id: number): Promise<ApiResponse<AlertRecord>> {
    return api.get<AlertRecord>(`${this.baseUrl}/${id}`)
  }

  /**
   * 确认告警
   */
  async acknowledgeAlert(id: number, data?: AcknowledgeAlertRequest): Promise<ApiResponse<AlertRecord>> {
    return api.post<AlertRecord>(`${this.baseUrl}/${id}/ack`, data)
  }

  /**
   * 忽略告警
   */
  async ignoreAlert(id: number, data?: IgnoreAlertRequest): Promise<ApiResponse<AlertRecord>> {
    return api.post<AlertRecord>(`${this.baseUrl}/${id}/ignore`, data)
  }

  /**
   * 批量确认告警
   */
  async batchAcknowledge(ids: number[], data?: AcknowledgeAlertRequest): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.baseUrl}/batch-ack`, { ids, ...data })
  }

  /**
   * 批量忽略告警
   */
  async batchIgnore(ids: number[], data?: IgnoreAlertRequest): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.baseUrl}/batch-ignore`, { ids, ...data })
  }

  /**
   * 获取告警通知记录
   */
  async getAlertNotifications(alertId: number): Promise<ApiResponse<AlertNotification[]>> {
    return api.get<AlertNotification[]>(`${this.baseUrl}/${alertId}/notifications`)
  }

  /**
   * 重新发送告警通知
   */
  async resendNotification(alertId: number, channelIds?: number[]): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.baseUrl}/${alertId}/resend`, { channel_ids: channelIds })
  }
}

/**
 * 监控大屏服务
 */
export class MonitorDashboardService {
  private baseUrl = '/api/monitor/dashboard'

  /**
   * 获取监控大屏数据
   */
  async getDashboardData(): Promise<ApiResponse<MonitorDashboardData>> {
    return api.get<MonitorDashboardData>(this.baseUrl)
  }

  /**
   * 获取实时告警统计
   */
  async getRealtimeStats(): Promise<ApiResponse<{
    active_alerts: number
    critical_alerts: number
    warning_alerts: number
    info_alerts: number
    recent_alerts: AlertRecord[]
  }>> {
    return api.get(`${this.baseUrl}/realtime`)
  }

  /**
   * 获取告警趋势数据
   */
  async getAlertTrends(days: number = 7): Promise<ApiResponse<Array<{
    date: string
    count: number
    severity_breakdown: {
      info: number
      warning: number
      critical: number
    }
  }>>> {
    return api.get(`${this.baseUrl}/trends?days=${days}`)
  }

  /**
   * 获取主机状态概览
   */
  async getHostStatusOverview(): Promise<ApiResponse<Array<{
    id: number
    name: string
    hostname: string
    status: 'online' | 'offline'
    cpu_usage?: number
    memory_usage?: number
    disk_usage?: number
    last_check: string
    active_alerts: number
  }>>> {
    return api.get(`${this.baseUrl}/hosts`)
  }

  /**
   * 获取渠道统计
   */
  async getChannelStats(): Promise<ApiResponse<Array<{
    channel_id: number
    channel_name: string
    channel_type: string
    total_notifications: number
    success_rate: number
    last_notification: string
  }>>> {
    return api.get(`${this.baseUrl}/channels`)
  }
}

/**
 * 监控告警综合服务类
 */
export class MonitorService {
  public channels: AlertChannelService
  public rules: AlertRuleService
  public alerts: AlertRecordService
  public dashboard: MonitorDashboardService

  constructor() {
    this.channels = new AlertChannelService()
    this.rules = new AlertRuleService()
    this.alerts = new AlertRecordService()
    this.dashboard = new MonitorDashboardService()
  }

  /**
   * 获取监控概览数据
   */
  async getOverview(): Promise<ApiResponse<{
    channels: {
      total: number
      enabled: number
      email: number
      dingtalk: number
    }
    rules: {
      total: number
      enabled: number
      by_severity: {
        info: number
        warning: number
        critical: number
      }
    }
    alerts: {
      active: number
      resolved: number
      acknowledged: number
      ignored: number
    }
  }>> {
    return api.get('/api/monitor/overview')
  }

  /**
   * 获取系统健康状态
   */
  async getHealthStatus(): Promise<ApiResponse<{
    status: 'healthy' | 'warning' | 'critical'
    issues: Array<{
      type: string
      message: string
      severity: string
    }>
    last_check: string
  }>> {
    return api.get('/api/monitor/health')
  }
}

// 导出服务实例
export const alertChannelService = new AlertChannelService()
export const alertRuleService = new AlertRuleService()
export const alertRecordService = new AlertRecordService()
export const monitorDashboardService = new MonitorDashboardService()
export const monitorService = new MonitorService()

// 默认导出
export default monitorService