/**
 * 数据源管理 API 服务
 * 
 * 提供 Prometheus/VictoriaMetrics 等时序数据库的配置管理、PromQL 查询执行等功能。
 * 
 * Requirements: 1.1-1.8, 2.2-2.9
 */
import { api } from './api'

// ==================== 类型定义 ====================

/**
 * 数据源类型
 */
export type DatasourceType = 'prometheus' | 'victoriametrics'

/**
 * 认证类型
 */
export type AuthType = 'none' | 'basic' | 'bearer'

/**
 * 数据源配置
 */
export interface DatasourceConfig {
  id: number
  tenant_id: number
  name: string
  type: DatasourceType
  url: string
  auth_type: AuthType
  username?: string
  password?: string
  token?: string
  is_default: boolean
  status: number
  created_by?: number
  created_at: string
  updated_at: string
}

/**
 * 创建数据源配置请求
 */
export interface CreateDatasourceConfigRequest {
  name: string
  type?: DatasourceType
  url: string
  auth_type?: AuthType
  username?: string
  password?: string
  token?: string
  is_default?: boolean
  status?: number
}

/**
 * 更新数据源配置请求
 */
export interface UpdateDatasourceConfigRequest {
  name?: string
  type?: DatasourceType
  url?: string
  auth_type?: AuthType
  username?: string
  password?: string
  token?: string
  is_default?: boolean
  status?: number
}

/**
 * 数据源配置列表响应
 */
export interface DatasourceConfigListResponse {
  configs: DatasourceConfig[]
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
 * 测试连接响应
 */
export interface TestConnectionResponse {
  connected: boolean
  response_time_ms?: number
  version?: string
  status_code?: number
  error?: string
}

/**
 * PromQL 即时查询请求
 */
export interface PromQLInstantQueryRequest {
  config_id: number
  query: string
  time?: string
}

/**
 * PromQL 范围查询请求
 */
export interface PromQLRangeQueryRequest {
  config_id: number
  query: string
  start: string
  end: string
  step: string
}

/**
 * PromQL 查询结果
 */
export interface PromQLQueryResult {
  status: 'success' | 'error'
  data?: {
    resultType: 'vector' | 'matrix' | 'scalar' | 'string'
    result: Array<{
      metric: Record<string, string>
      value?: [number, string]
      values?: Array<[number, string]>
    }>
  }
  error?: string
  errorType?: string
  execution_time_ms: number
}

/**
 * 保存的 PromQL 查询
 */
export interface SavedPromQLQuery {
  id: number
  tenant_id: number
  config_id: number
  name: string
  query: string
  description?: string
  created_by?: number
  created_at: string
}

/**
 * 保存查询请求
 */
export interface SaveQueryRequest {
  config_id: number
  name: string
  query: string
  description?: string
}

/**
 * 查询模板
 */
export interface QueryTemplate {
  name: string
  query: string
  description: string
}

/**
 * 数据源类型选项
 */
export interface DatasourceTypeOption {
  value: DatasourceType
  label: string
}

/**
 * 认证类型选项
 */
export interface AuthTypeOption {
  value: AuthType
  label: string
}

// ==================== 常量 ====================

/**
 * 数据源类型配置
 */
export const DATASOURCE_TYPES: Record<DatasourceType, { name: string; color: string; gradient: string }> = {
  prometheus: {
    name: 'Prometheus',
    color: 'orange',
    gradient: 'from-orange-500 to-red-600'
  },
  victoriametrics: {
    name: 'VictoriaMetrics',
    color: 'blue',
    gradient: 'from-blue-500 to-indigo-600'
  }
}

/**
 * 认证类型配置
 */
export const AUTH_TYPES: Record<AuthType, { name: string }> = {
  none: { name: '无认证' },
  basic: { name: 'Basic Auth' },
  bearer: { name: 'Bearer Token' }
}

// ==================== 服务类 ====================

class DatasourceService {
  private baseUrl = '/api/datasource'

  // ==================== 数据源配置管理 ====================

  /**
   * 获取数据源配置列表
   */
  async getConfigs(params?: {
    page?: number
    per_page?: number
    search?: string
    type?: DatasourceType
    status?: number
  }): Promise<DatasourceConfigListResponse> {
    const response = await api.get(`${this.baseUrl}/configs`, { params })
    // 兼容不同的响应格式
    const data = response.data.data || response.data
    return data
  }

  /**
   * 获取单个数据源配置
   */
  async getConfig(id: number): Promise<DatasourceConfig> {
    const response = await api.get(`${this.baseUrl}/configs/${id}`)
    return response.data.data.config
  }

  /**
   * 创建数据源配置
   */
  async createConfig(data: CreateDatasourceConfigRequest): Promise<DatasourceConfig> {
    const response = await api.post(`${this.baseUrl}/configs`, data)
    return response.data.data.config
  }

  /**
   * 更新数据源配置
   */
  async updateConfig(id: number, data: UpdateDatasourceConfigRequest): Promise<DatasourceConfig> {
    const response = await api.post(`${this.baseUrl}/configs/${id}`, data)
    return response.data.data.config
  }

  /**
   * 删除数据源配置
   */
  async deleteConfig(id: number): Promise<void> {
    await api.post(`${this.baseUrl}/configs/${id}/delete`)
  }

  /**
   * 测试数据源连接
   */
  async testConnection(id: number): Promise<TestConnectionResponse> {
    const response = await api.post(`${this.baseUrl}/configs/${id}/test`)
    return response.data.data
  }

  /**
   * 设置默认数据源
   */
  async setDefault(id: number): Promise<DatasourceConfig> {
    const response = await api.post(`${this.baseUrl}/configs/${id}/default`)
    return response.data.data.config
  }

  // ==================== PromQL 查询 ====================

  /**
   * 执行即时查询
   */
  async executeInstantQuery(request: PromQLInstantQueryRequest): Promise<PromQLQueryResult> {
    const response = await api.post(`${this.baseUrl}/query`, request)
    console.log('Raw API response:', response.data)
    
    // 处理响应数据
    const apiData = response.data.data || response.data
    console.log('Processed API data:', apiData)
    
    // 如果 apiData 直接包含 result 和 resultType，说明它就是查询结果
    if (apiData.result && apiData.resultType) {
      return {
        status: 'success',
        data: {
          resultType: apiData.resultType,
          result: apiData.result
        },
        execution_time_ms: apiData.execution_time_ms || 0
      }
    }
    
    // 否则按原格式返回
    return apiData
  }

  /**
   * 执行范围查询
   */
  async executeRangeQuery(request: PromQLRangeQueryRequest): Promise<PromQLQueryResult> {
    const response = await api.post(`${this.baseUrl}/query_range`, request)
    console.log('Raw API response:', response.data)
    
    // 处理响应数据
    const apiData = response.data.data || response.data
    console.log('Processed API data:', apiData)
    
    // 如果 apiData 直接包含 result 和 resultType，说明它就是查询结果
    if (apiData.result && apiData.resultType) {
      return {
        status: 'success',
        data: {
          resultType: apiData.resultType,
          result: apiData.result
        },
        execution_time_ms: apiData.execution_time_ms || 0
      }
    }
    
    // 否则按原格式返回
    return apiData
  }

  // ==================== 保存的查询 ====================

  /**
   * 获取保存的查询列表
   */
  async getSavedQueries(params?: {
    config_id?: number
    page?: number
    per_page?: number
  }): Promise<{ queries: SavedPromQLQuery[]; pagination: any }> {
    const response = await api.get(`${this.baseUrl}/saved-queries`, { params })
    return response.data.data
  }

  /**
   * 保存查询
   */
  async saveQuery(data: SaveQueryRequest): Promise<SavedPromQLQuery> {
    const response = await api.post(`${this.baseUrl}/saved-queries`, data)
    return response.data.data.query
  }

  /**
   * 删除保存的查询
   */
  async deleteSavedQuery(id: number): Promise<void> {
    await api.post(`${this.baseUrl}/saved-queries/${id}/delete`)
  }

  // ==================== 模板和类型 ====================

  /**
   * 获取查询模板
   */
  async getTemplates(): Promise<QueryTemplate[]> {
    const response = await api.get(`${this.baseUrl}/templates`)
    return response.data.data.templates
  }

  /**
   * 获取数据源类型列表
   */
  async getDatasourceTypes(): Promise<DatasourceTypeOption[]> {
    const response = await api.get(`${this.baseUrl}/types`)
    return response.data.data.types
  }

  /**
   * 获取认证类型列表
   */
  async getAuthTypes(): Promise<AuthTypeOption[]> {
    const response = await api.get(`${this.baseUrl}/auth-types`)
    return response.data.data.types
  }
}

export const datasourceService = new DatasourceService()
