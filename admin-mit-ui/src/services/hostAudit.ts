/**
 * 主机审计日志和命令过滤配置 API 服务
 * Requirements: 4.1, 5.1, 7.1
 */
import { api } from './api'
import type {
  AuditLog,
  AuditLogQuery,
  AuditLogListResponse,
  AuditLogStats,
  ClearLogsRequest,
  ClearLogsResponse,
  CommandFilterRule,
  CommandFilterRuleResponse,
  SetCommandFilterRequest,
  SetCommandFilterResponse,
  DefaultBlacklistResponse
} from '../types/audit'

export class HostAuditService {
  // ==================== 审计日志 API ====================

  /**
   * 获取主机审计日志列表
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
   */
  async getAuditLogs(hostId: number, params?: AuditLogQuery): Promise<AuditLogListResponse> {
    const searchParams = new URLSearchParams()
    
    if (params) {
      if (params.user_id !== undefined) {
        searchParams.append('user_id', params.user_id.toString())
      }
      if (params.status) {
        searchParams.append('status', params.status)
      }
      if (params.start_date) {
        searchParams.append('start_date', params.start_date)
      }
      if (params.end_date) {
        searchParams.append('end_date', params.end_date)
      }
      if (params.page !== undefined) {
        searchParams.append('page', params.page.toString())
      }
      if (params.page_size !== undefined) {
        searchParams.append('page_size', params.page_size.toString())
      }
    }
    
    const queryString = searchParams.toString()
    const url = queryString 
      ? `/api/hosts/${hostId}/audit-logs?${queryString}`
      : `/api/hosts/${hostId}/audit-logs`
    
    const response = await api.get<AuditLogListResponse>(url)
    return response.data
  }

  /**
   * 清理主机审计日志
   * Requirements: 5.1, 5.2, 5.3
   */
  async clearAuditLogs(hostId: number, daysToKeep: number): Promise<ClearLogsResponse> {
    const response = await api.post<ClearLogsResponse>(
      `/api/hosts/${hostId}/audit-logs/clear`,
      { days_to_keep: daysToKeep }
    )
    return response.data
  }

  /**
   * 获取主机审计日志统计信息
   * Requirements: 4.1
   */
  async getAuditStats(hostId: number, days?: number): Promise<AuditLogStats> {
    const params = days !== undefined ? `?days=${days}` : ''
    const response = await api.get<AuditLogStats>(
      `/api/hosts/${hostId}/audit-logs/stats${params}`
    )
    return response.data
  }

  // ==================== 命令过滤配置 API ====================

  /**
   * 获取主机命令过滤规则
   * Requirements: 7.1, 7.2, 7.3, 7.4
   */
  async getHostFilterRules(hostId: number): Promise<CommandFilterRuleResponse> {
    const response = await api.get<CommandFilterRuleResponse>(
      `/api/hosts/${hostId}/command-filter`
    )
    return response.data
  }

  /**
   * 设置主机命令过滤规则
   * Requirements: 7.1, 7.2, 7.5
   */
  async setHostFilterRules(
    hostId: number, 
    rules: SetCommandFilterRequest
  ): Promise<SetCommandFilterResponse> {
    const response = await api.put<SetCommandFilterResponse>(
      `/api/hosts/${hostId}/command-filter`,
      rules
    )
    return response.data
  }

  /**
   * 删除主机命令过滤规则（回退到全局规则）
   * Requirements: 7.1, 7.4
   */
  async deleteHostFilterRules(hostId: number): Promise<void> {
    await api.delete(`/api/hosts/${hostId}/command-filter`)
  }

  /**
   * 获取全局命令过滤规则
   * Requirements: 7.1, 7.3
   */
  async getGlobalFilterRules(): Promise<{ rules: CommandFilterRule }> {
    const response = await api.get<{ data: { rules: CommandFilterRule } }>(
      '/api/command-filter/global'
    )
    // 后端返回格式: { success: true, data: { rules: {...} } }
    // api.get 已经处理了外层，返回 { success, data }
    return response.data as unknown as { rules: CommandFilterRule }
  }

  /**
   * 设置全局命令过滤规则
   * Requirements: 7.1, 7.3, 7.5
   */
  async setGlobalFilterRules(
    rules: SetCommandFilterRequest
  ): Promise<SetCommandFilterResponse> {
    const response = await api.put<SetCommandFilterResponse>(
      '/api/command-filter/global',
      rules
    )
    // 后端返回格式: { success: true, data: { rules: {...} }, message: '...' }
    return response.data as unknown as SetCommandFilterResponse
  }

  /**
   * 获取默认黑名单命令列表
   */
  async getDefaultBlacklist(): Promise<string[]> {
    const response = await api.get<{ data: { blacklist: string[] } }>(
      '/api/command-filter/default-blacklist'
    )
    // 后端返回格式: { success: true, data: { blacklist: [...] } }
    const data = response.data as unknown as { blacklist: string[] }
    return data.blacklist
  }
}

export const hostAuditService = new HostAuditService()
