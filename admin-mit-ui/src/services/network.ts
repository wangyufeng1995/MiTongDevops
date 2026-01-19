import { BaseApiService } from './base'
import { api } from './api'
import { ApiResponse } from '../types/api'
import {
  NetworkProbeGroup,
  CreateNetworkProbeGroupRequest,
  UpdateNetworkProbeGroupRequest,
  NetworkProbe,
  CreateNetworkProbeRequest,
  UpdateNetworkProbeRequest,
  NetworkProbeResult,
  NetworkAlertRule,
  NetworkAlertRecord,
  NetworkDashboardStats,
} from '../types/network'

/**
 * Network Probe Group Service
 */
export class NetworkProbeGroupService extends BaseApiService<
  NetworkProbeGroup,
  CreateNetworkProbeGroupRequest,
  UpdateNetworkProbeGroupRequest
> {
  constructor() {
    super('/api/network/groups')
  }

  /**
   * Get all groups (excluding default group for selection)
   */
  async getSelectableGroups(): Promise<ApiResponse<NetworkProbeGroup[]>> {
    const response = await this.getAll()
    if (response.success && response.data) {
      // Filter out the default "未分组" group
      const selectableGroups = response.data.filter(group => !group.is_default)
      return {
        ...response,
        data: selectableGroups,
      }
    }
    return response
  }

  /**
   * Check if group can be deleted (has probes)
   */
  async checkDeletion(id: number): Promise<ApiResponse<{ can_delete: boolean; probe_count: number }>> {
    return api.get<{ can_delete: boolean; probe_count: number }>(`${this.baseUrl}/${id}/check-deletion`)
  }

  /**
   * Delete group and migrate probes to default group
   */
  async deleteWithMigration(id: number): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.baseUrl}/${id}/delete`)
  }
}

/**
 * Network Probe Service
 */
export class NetworkProbeService extends BaseApiService<
  NetworkProbe,
  CreateNetworkProbeRequest,
  UpdateNetworkProbeRequest
> {
  constructor() {
    super('/api/network/probes')
  }

  /**
   * Get probes by group
   */
  async getByGroup(groupId: number, params?: { page?: number; per_page?: number }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams()
    queryParams.append('group_id', groupId.toString())
    
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.per_page) queryParams.append('per_page', params.per_page.toString())

    return api.get(`${this.baseUrl}?${queryParams}`)
  }

  /**
   * Start auto probe
   */
  async start(id: number): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.baseUrl}/${id}/start`)
  }

  /**
   * Stop auto probe
   */
  async stop(id: number): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.baseUrl}/${id}/stop`)
  }

  /**
   * Execute manual probe
   */
  async probe(id: number): Promise<ApiResponse<NetworkProbeResult>> {
    return api.post<NetworkProbeResult>(`${this.baseUrl}/${id}/probe`)
  }

  /**
   * Get probe results
   */
  async getResults(id: number, params?: { page?: number; limit?: number }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams()
    
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())

    return api.get(`${this.baseUrl}/${id}/results?${queryParams}`)
  }

  /**
   * Get probe status (SSE endpoint - returns EventSource URL)
   */
  getStatusSSEUrl(id: number): string {
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
    return `${baseURL}/api/network/probes/${id}/status`
  }

  /**
   * Get probe statistics
   */
  async getStatistics(id: number, days?: number): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams()
    if (days) queryParams.append('days', days.toString())

    return api.get(`${this.baseUrl}/${id}/statistics?${queryParams}`)
  }

  /**
   * Get probe history
   */
  async getHistory(id: number, hours?: number, interval?: number): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams()
    if (hours) queryParams.append('hours', hours.toString())
    if (interval) queryParams.append('interval', interval.toString())

    return api.get(`${this.baseUrl}/${id}/history?${queryParams}`)
  }
}

/**
 * Network Alert Rule Service
 */
export class NetworkAlertRuleService extends BaseApiService<
  NetworkAlertRule,
  Partial<NetworkAlertRule>,
  Partial<NetworkAlertRule>
> {
  constructor() {
    super('/api/network/alert-rules')
  }

  /**
   * Enable alert rule
   */
  async enable(id: number): Promise<ApiResponse<NetworkAlertRule>> {
    return api.post<NetworkAlertRule>(`${this.baseUrl}/${id}/enable`)
  }

  /**
   * Disable alert rule
   */
  async disable(id: number): Promise<ApiResponse<NetworkAlertRule>> {
    return api.post<NetworkAlertRule>(`${this.baseUrl}/${id}/disable`)
  }
}

/**
 * Network Alert Record Service
 */
export class NetworkAlertRecordService extends BaseApiService<
  NetworkAlertRecord,
  never,
  never
> {
  constructor() {
    super('/api/network/alert-records')
  }

  /**
   * Acknowledge alert
   */
  async acknowledge(id: number): Promise<ApiResponse<NetworkAlertRecord>> {
    return api.post<NetworkAlertRecord>(`${this.baseUrl}/${id}/ack`)
  }

  /**
   * Resolve alert
   */
  async resolve(id: number): Promise<ApiResponse<NetworkAlertRecord>> {
    return api.post<NetworkAlertRecord>(`${this.baseUrl}/${id}/resolve`)
  }
}

/**
 * Network Dashboard Service
 */
export class NetworkDashboardService {
  private baseUrl = '/api/network'

  /**
   * Get dashboard statistics
   */
  async getStats(): Promise<ApiResponse<NetworkDashboardStats>> {
    return api.get<NetworkDashboardStats>(`${this.baseUrl}/dashboard`)
  }

  /**
   * Get statistics data
   */
  async getStatistics(params?: { start_date?: string; end_date?: string }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams()
    
    if (params?.start_date) queryParams.append('start_date', params.start_date)
    if (params?.end_date) queryParams.append('end_date', params.end_date)

    const url = queryParams.toString() ? `${this.baseUrl}/statistics?${queryParams}` : `${this.baseUrl}/statistics`
    return api.get(url)
  }
}

// Export service instances
export const networkProbeGroupService = new NetworkProbeGroupService()
export const networkProbeService = new NetworkProbeService()
export const networkAlertRuleService = new NetworkAlertRuleService()
export const networkAlertRecordService = new NetworkAlertRecordService()
export const networkDashboardService = new NetworkDashboardService()
