import { api } from './api'

export interface Alert {
  id: string
  title: string
  description: string
  level: 'critical' | 'warning' | 'info'
  status: 'active' | 'acknowledged' | 'resolved'
  source: string
  created_at: string
  updated_at: string
  acknowledged_by?: string
  acknowledged_at?: string
  resolved_by?: string
  resolved_at?: string
  tags: string[]
  metadata?: Record<string, any>
}

export interface AlertListParams {
  page?: number
  limit?: number
  level?: string
  status?: string
  source?: string
  search?: string
  start_date?: string
  end_date?: string
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
  trend_data: Array<{
    date: string
    active: number
    resolved: number
    total: number
  }>
  level_distribution: Array<{
    level: string
    count: number
    percentage: number
  }>
  source_distribution: Array<{
    source: string
    count: number
    percentage: number
  }>
}

export interface AlertAction {
  action: 'acknowledge' | 'resolve'
  comment?: string
}

export class AlertService {
  /**
   * 获取告警列表
   */
  async getAlerts(params?: AlertListParams) {
    const response = await api.get('/api/alerts', { params })
    return response
  }

  /**
   * 获取告警详情
   */
  async getAlert(id: string) {
    const response = await api.get(`/api/alerts/${id}`)
    return response
  }

  /**
   * 获取告警统计数据
   */
  async getAlertStatistics(timeRange: '7d' | '30d' | '90d' = '30d') {
    const response = await api.get('/api/alerts/statistics', {
      params: { time_range: timeRange }
    })
    return response
  }

  /**
   * 处理告警操作（确认/解决）
   */
  async handleAlert(id: string, action: AlertAction) {
    const response = await api.post(`/api/alerts/${id}/action`, action)
    return response
  }

  /**
   * 批量处理告警
   */
  async batchHandleAlerts(ids: string[], action: AlertAction) {
    const response = await api.post('/api/alerts/batch-action', {
      alert_ids: ids,
      ...action
    })
    return response
  }

  /**
   * 创建告警规则
   */
  async createAlertRule(rule: any) {
    const response = await api.post('/api/alerts/rules', rule)
    return response
  }

  /**
   * 更新告警规则
   */
  async updateAlertRule(id: string, rule: any) {
    const response = await api.put(`/api/alerts/rules/${id}`, rule)
    return response
  }

  /**
   * 删除告警规则
   */
  async deleteAlertRule(id: string) {
    const response = await api.delete(`/api/alerts/rules/${id}`)
    return response
  }

  /**
   * 获取告警规则列表
   */
  async getAlertRules() {
    const response = await api.get('/api/alerts/rules')
    return response
  }

  /**
   * 测试告警规则
   */
  async testAlertRule(rule: any) {
    const response = await api.post('/api/alerts/rules/test', rule)
    return response
  }

  /**
   * 获取告警渠道列表
   */
  async getAlertChannels() {
    const response = await api.get('/api/alerts/channels')
    return response
  }

  /**
   * 创建告警渠道
   */
  async createAlertChannel(channel: any) {
    const response = await api.post('/api/alerts/channels', channel)
    return response
  }

  /**
   * 更新告警渠道
   */
  async updateAlertChannel(id: string, channel: any) {
    const response = await api.put(`/api/alerts/channels/${id}`, channel)
    return response
  }

  /**
   * 删除告警渠道
   */
  async deleteAlertChannel(id: string) {
    const response = await api.delete(`/api/alerts/channels/${id}`)
    return response
  }

  /**
   * 测试告警渠道
   */
  async testAlertChannel(id: string) {
    const response = await api.post(`/api/alerts/channels/${id}/test`)
    return response
  }

  /**
   * 获取告警历史
   */
  async getAlertHistory(params?: {
    page?: number
    limit?: number
    start_date?: string
    end_date?: string
  }) {
    const response = await api.get('/api/alerts/history', { params })
    return response
  }

  /**
   * 导出告警数据
   */
  async exportAlerts(params?: {
    format?: 'csv' | 'excel'
    start_date?: string
    end_date?: string
    level?: string
    status?: string
  }) {
    const response = await api.get('/api/alerts/export', { 
      params,
      responseType: 'blob'
    })
    return response
  }
}

export const alertService = new AlertService()