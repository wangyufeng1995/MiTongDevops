/**
 * 操作日志服务
 */
import { api } from './api'
import { ApiResponse, PaginatedResponse } from '../types/api'
import { OperationLog, LogSearchParams, LogStatistics } from '../types/log'

export class LogService {
  private baseUrl = '/api/logs'

  /**
   * 获取操作日志列表
   */
  async getLogs(params?: LogSearchParams): Promise<ApiResponse<PaginatedResponse<OperationLog>>> {
    const searchParams = new URLSearchParams()
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString())
        }
      })
    }
    
    const url = searchParams.toString() 
      ? `${this.baseUrl}?${searchParams}`
      : this.baseUrl
      
    return api.get<PaginatedResponse<OperationLog>>(url)
  }

  /**
   * 获取日志详情
   */
  async getLogById(id: number): Promise<ApiResponse<OperationLog>> {
    return api.get<OperationLog>(`${this.baseUrl}/${id}`)
  }

  /**
   * 获取日志统计信息
   */
  async getLogStatistics(): Promise<ApiResponse<LogStatistics>> {
    return api.get<LogStatistics>(`${this.baseUrl}/statistics`)
  }

  /**
   * 导出日志
   */
  async exportLogs(params?: LogSearchParams): Promise<Blob> {
    const searchParams = new URLSearchParams()
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString())
        }
      })
    }
    
    const url = searchParams.toString() 
      ? `${this.baseUrl}/export?${searchParams}`
      : `${this.baseUrl}/export`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    })
    
    if (!response.ok) {
      throw new Error('导出失败')
    }
    
    return response.blob()
  }

  /**
   * 删除单条日志
   */
  async deleteLog(id: number): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.baseUrl}/${id}/delete`)
  }

  /**
   * 批量删除日志
   */
  async batchDeleteLogs(ids: number[]): Promise<ApiResponse<{ deleted_count: number }>> {
    return api.post<{ deleted_count: number }>(`${this.baseUrl}/batch-delete`, { ids })
  }

  /**
   * 清空日志
   */
  async clearLogs(days: number = 0): Promise<ApiResponse<{ deleted_count: number }>> {
    return api.post<{ deleted_count: number }>(`${this.baseUrl}/clear`, { days })
  }

  /**
   * 清理过期日志
   */
  async cleanupLogs(days: number): Promise<ApiResponse<{ deleted_count: number }>> {
    return api.post<{ deleted_count: number }>(`${this.baseUrl}/cleanup`, { days })
  }
}

export const logService = new LogService()