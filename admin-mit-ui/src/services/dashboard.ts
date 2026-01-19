/**
 * 仪表盘服务
 * 获取系统概览统计数据
 */
import { api } from './api'
import { ApiResponse } from '../types/api'

/**
 * 仪表盘统计数据
 */
export interface DashboardStats {
  users: number
  roles: number
  menus: number
  hosts: number
  probes: number
  alerts: number
  uptime: string
}

/**
 * 图表数据点
 */
export interface ChartDataPoint {
  label: string
  value: number
  color?: string
}

/**
 * 仪表盘趋势数据
 */
export interface DashboardTrends {
  system_usage: ChartDataPoint[]
  alert_trend: ChartDataPoint[]
}

/**
 * 活动记录
 */
export interface Activity {
  id: number
  type: string
  title: string
  status: string
  response_time?: number
  timestamp: string
}

/**
 * 仪表盘服务类
 */
class DashboardService {
  private baseUrl = '/api/dashboard'

  /**
   * 获取仪表盘统计数据
   */
  async getStats(): Promise<ApiResponse<DashboardStats>> {
    return api.get<DashboardStats>(`${this.baseUrl}/stats`)
  }

  /**
   * 获取仪表盘趋势数据
   */
  async getTrends(): Promise<ApiResponse<DashboardTrends>> {
    return api.get<DashboardTrends>(`${this.baseUrl}/trends`)
  }

  /**
   * 获取最近活动
   */
  async getRecentActivities(): Promise<ApiResponse<{ activities: Activity[] }>> {
    return api.get<{ activities: Activity[] }>(`${this.baseUrl}/recent-activities`)
  }
}

// 导出服务实例
export const dashboardService = new DashboardService()
