/**
 * 主机管理 API 服务
 */
import { api } from './api'
import type { 
  Host, 
  CreateHostRequest, 
  UpdateHostRequest, 
  HostListResponse,
  HostConnectionTest,
  HostStatus,
  HostListParams,
  ProbeTaskResponse,
  BatchProbeResponse,
  ProbeTaskStatus,
  ProbeHistoryResponse
} from '../types/host'

export class HostsService {
  /**
   * 获取主机列表
   */
  async getHosts(params?: HostListParams): Promise<HostListResponse> {
    const response = await api.get('/api/hosts', { params })
    // api.get 返回 { success, data: { hosts, pagination } }
    return response.data
  }

  /**
   * 获取单个主机详情
   */
  async getHost(id: number): Promise<Host> {
    const response = await api.get(`/api/hosts/${id}`)
    return response.data.host
  }

  /**
   * 创建主机
   */
  async createHost(data: CreateHostRequest): Promise<Host> {
    const response = await api.post('/api/hosts', data)
    return response.data.host
  }

  /**
   * 更新主机
   */
  async updateHost(id: number, data: UpdateHostRequest): Promise<Host> {
    const response = await api.put(`/api/hosts/${id}`, data)
    return response.data.host
  }

  /**
   * 删除主机
   */
  async deleteHost(id: number): Promise<void> {
    await api.post(`/api/hosts/${id}/delete`)
  }

  /**
   * 测试主机连接
   */
  async testConnection(id: number): Promise<HostConnectionTest> {
    const response = await api.post(`/api/hosts/${id}/connect`)
    return response.data
  }

  /**
   * 获取主机状态
   */
  async getHostStatus(id: number): Promise<HostStatus> {
    const response = await api.get(`/api/hosts/${id}/status`)
    return response.data
  }

  /**
   * 获取主机系统信息
   */
  async getHostInfo(id: number): Promise<any> {
    const response = await api.get(`/api/hosts/${id}/info`)
    return response.data
  }

  /**
   * 获取主机性能监控数据
   */
  async getHostMetrics(id: number, params?: {
    hours?: number
    limit?: number
  }): Promise<any> {
    const response = await api.get(`/api/hosts/${id}/metrics`, { params })
    return response.data
  }

  // ==================== 探测相关方法 ====================

  /**
   * 探测单个主机
   */
  async probeHost(id: number): Promise<ProbeTaskResponse> {
    const response = await api.post(`/api/hosts/${id}/probe`, {})
    return response.data
  }

  /**
   * 批量探测主机
   */
  async probeBatch(hostIds: number[]): Promise<BatchProbeResponse> {
    const response = await api.post('/api/hosts/probe/batch', { host_ids: hostIds })
    return response.data
  }

  /**
   * 探测分组内所有主机
   */
  async probeGroup(groupId: number): Promise<BatchProbeResponse> {
    const response = await api.post(`/api/hosts/probe/group/${groupId}`, {})
    return response.data
  }

  /**
   * 获取探测任务状态
   */
  async getProbeTaskStatus(taskId: string): Promise<ProbeTaskStatus> {
    const response = await api.get(`/api/hosts/probe/task/${taskId}`)
    return response.data
  }

  /**
   * 获取主机探测历史
   */
  async getProbeHistory(hostId: number, params?: { limit?: number }): Promise<ProbeHistoryResponse> {
    const response = await api.get(`/api/hosts/${hostId}/probe-history`, { params })
    return response.data
  }

  // ==================== 批量导入相关方法 ====================

  /**
   * 批量导入主机（Excel 文件）
   */
  async importHosts(file: File): Promise<HostImportResponse> {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await api.post('/api/hosts/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  }

  /**
   * 下载导入模板
   */
  async downloadImportTemplate(): Promise<Blob> {
    return await api.download('/api/hosts/import/template')
  }

  // ==================== 统计相关方法 ====================

  /**
   * 获取主机统计信息（用于仪表盘）
   */
  async getHostStats(): Promise<{
    online: number
    offline: number
    total: number
  }> {
    const response = await api.get('/api/hosts/stats')
    return response.data
  }
}

export const hostsService = new HostsService()