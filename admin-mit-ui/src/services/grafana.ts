/**
 * Grafana 管理 API 服务
 * 
 * 提供 Grafana 服务器配置管理和仪表盘管理功能。
 * 
 * Requirements: 4.1-4.7
 */
import { api } from './api'

// ==================== 类型定义 ====================

/**
 * Grafana 配置
 */
export interface GrafanaConfig {
  id: number
  tenant_id: number
  name: string
  url: string
  status: number
  iframe_height: number
  // 认证配置
  auth_type: 'none' | 'basic' | 'token' | 'api_key'
  auth_username?: string
  has_auth_password?: boolean
  has_auth_token?: boolean
  has_api_key?: boolean
  use_proxy: boolean
  allow_anonymous: boolean
  created_by?: number
  created_at: string
  updated_at: string
  dashboards?: GrafanaDashboard[]
}

/**
 * Grafana 仪表盘
 */
export interface GrafanaDashboard {
  id: number
  config_id: number
  name: string
  url: string
  description?: string
  is_default: boolean
  sort_order: number
  created_at: string
}

/**
 * 创建 Grafana 配置请求
 */
export interface CreateGrafanaConfigRequest {
  name: string
  url: string
  status?: number
  iframe_height?: number
  // 认证配置
  auth_type?: 'none' | 'basic' | 'token' | 'api_key'
  auth_username?: string
  auth_password?: string
  auth_token?: string
  api_key?: string
  use_proxy?: boolean
  allow_anonymous?: boolean
}

/**
 * 更新 Grafana 配置请求
 */
export interface UpdateGrafanaConfigRequest {
  name?: string
  url?: string
  status?: number
  iframe_height?: number
  // 认证配置
  auth_type?: 'none' | 'basic' | 'token' | 'api_key'
  auth_username?: string
  auth_password?: string
  auth_token?: string
  api_key?: string
  use_proxy?: boolean
  allow_anonymous?: boolean
}

/**
 * 创建仪表盘请求
 */
export interface CreateDashboardRequest {
  name: string
  url: string
  description?: string
  is_default?: boolean
  sort_order?: number
}

/**
 * 更新仪表盘请求
 */
export interface UpdateDashboardRequest {
  name?: string
  url?: string
  description?: string
  is_default?: boolean
  sort_order?: number
}

/**
 * Grafana 配置列表响应
 */
export interface GrafanaConfigListResponse {
  configs: GrafanaConfig[]
  pagination: {
    page: number
    per_page: number
    total: number
    pages: number
    has_prev: boolean
    has_next: boolean
  }
}

/**
 * 仪表盘列表响应
 */
export interface DashboardListResponse {
  dashboards: GrafanaDashboard[]
  pagination: {
    page: number
    per_page: number
    total: number
    pages: number
    has_prev: boolean
    has_next: boolean
  }
}

// ==================== 服务类 ====================

class GrafanaService {
  private baseUrl = '/api/grafana'

  // ==================== Grafana 配置管理 ====================

  /**
   * 获取 Grafana 配置列表
   * Requirements: 4.1
   */
  async getConfigs(params?: {
    page?: number
    per_page?: number
    search?: string
    status?: number
  }): Promise<GrafanaConfigListResponse> {
    const response = await api.get(`${this.baseUrl}/configs`, { params })
    return response.data
  }

  /**
   * 获取单个 Grafana 配置
   * Requirements: 4.1
   */
  async getConfig(id: number): Promise<GrafanaConfig> {
    const response = await api.get(`${this.baseUrl}/configs/${id}`)
    return response.data.config
  }

  /**
   * 创建 Grafana 配置
   * Requirements: 4.1
   */
  async createConfig(data: CreateGrafanaConfigRequest): Promise<GrafanaConfig> {
    const response = await api.post(`${this.baseUrl}/configs`, data)
    return response.data.config
  }

  /**
   * 更新 Grafana 配置
   * Requirements: 4.4
   */
  async updateConfig(id: number, data: UpdateGrafanaConfigRequest): Promise<GrafanaConfig> {
    const response = await api.post(`${this.baseUrl}/configs/${id}`, data)
    return response.data.config
  }

  /**
   * 删除 Grafana 配置
   * Requirements: 4.5
   */
  async deleteConfig(id: number): Promise<void> {
    await api.post(`${this.baseUrl}/configs/${id}/delete`)
  }

  // ==================== 仪表盘管理 ====================

  /**
   * 获取配置下的仪表盘列表
   * Requirements: 4.2
   */
  async getDashboards(configId: number, params?: {
    page?: number
    per_page?: number
  }): Promise<DashboardListResponse> {
    const response = await api.get(`${this.baseUrl}/configs/${configId}/dashboards`, { params })
    return response.data
  }

  /**
   * 添加仪表盘到配置
   * Requirements: 4.2
   */
  async addDashboard(configId: number, data: CreateDashboardRequest): Promise<GrafanaDashboard> {
    const response = await api.post(`${this.baseUrl}/configs/${configId}/dashboards`, data)
    return response.data.dashboard
  }

  /**
   * 更新仪表盘
   * Requirements: 4.3
   */
  async updateDashboard(dashboardId: number, data: UpdateDashboardRequest): Promise<GrafanaDashboard> {
    const response = await api.post(`${this.baseUrl}/dashboards/${dashboardId}`, data)
    return response.data.dashboard
  }

  /**
   * 删除仪表盘
   * Requirements: 4.3
   */
  async deleteDashboard(dashboardId: number): Promise<void> {
    await api.post(`${this.baseUrl}/dashboards/${dashboardId}/delete`)
  }

  /**
   * 设置默认仪表盘
   * Requirements: 4.7
   */
  async setDefaultDashboard(dashboardId: number): Promise<GrafanaDashboard> {
    const response = await api.post(`${this.baseUrl}/dashboards/${dashboardId}/default`)
    return response.data.dashboard
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取默认仪表盘
   * 从配置的仪表盘列表中找到默认的仪表盘
   */
  getDefaultDashboard(config: GrafanaConfig): GrafanaDashboard | undefined {
    return config.dashboards?.find(d => d.is_default)
  }

  /**
   * 构建 iframe URL
   * 根据仪表盘 URL 和配置构建可嵌入的 iframe URL
   */
  buildIframeUrl(dashboardUrl: string, config?: GrafanaConfig): string {
    // 添加 kiosk 模式参数以隐藏 Grafana 导航栏
    let url = dashboardUrl
    if (!url.includes('kiosk')) {
      const separator = url.includes('?') ? '&' : '?'
      url = `${url}${separator}kiosk`
    }
    
    return url
  }
}

export const grafanaService = new GrafanaService()
