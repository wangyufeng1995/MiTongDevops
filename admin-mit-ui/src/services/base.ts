import { api } from './api'
import { ApiResponse, PaginationParams, PaginatedResponse } from '../types/api'

/**
 * 基础 API 服务类
 * 提供通用的 CRUD 操作方法
 */
export abstract class BaseApiService<T = any, CreateT = Partial<T>, UpdateT = Partial<T>> {
  protected baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  /**
   * 获取列表（支持分页和搜索）
   */
  async getList(params?: PaginationParams & Record<string, any>): Promise<ApiResponse<PaginatedResponse<T>>> {
    const queryParams = new URLSearchParams()
    
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.per_page) queryParams.append('per_page', params.per_page.toString())
    if (params?.search) queryParams.append('search', params.search)
    if (params?.keyword) queryParams.append('search', params.keyword) // 支持 keyword 参数
    
    // 添加其他搜索参数
    Object.keys(params || {}).forEach(key => {
      if (!['page', 'per_page', 'search', 'keyword'].includes(key) && params![key] !== undefined && params![key] !== '') {
        queryParams.append(key, params![key].toString())
      }
    })

    const url = queryParams.toString() ? `${this.baseUrl}?${queryParams}` : this.baseUrl
    return api.get<PaginatedResponse<T>>(url)
  }

  /**
   * 根据 ID 获取单个项目
   */
  async getById(id: number | string): Promise<ApiResponse<T>> {
    return api.get<T>(`${this.baseUrl}/${id}`)
  }

  /**
   * 创建新项目
   */
  async create(data: CreateT): Promise<ApiResponse<T>> {
    return api.post<T>(this.baseUrl, data)
  }

  /**
   * 更新项目
   */
  async update(id: number | string, data: UpdateT): Promise<ApiResponse<T>> {
    return api.put<T>(`${this.baseUrl}/${id}`, data)
  }

  /**
   * 删除项目
   */
  async delete(id: number | string): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.baseUrl}/${id}/delete`)
  }

  /**
   * 批量删除
   */
  async batchDelete(ids: (number | string)[]): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.baseUrl}/batch-delete`, { ids })
  }

  /**
   * 获取所有项目（不分页）
   */
  async getAll(): Promise<ApiResponse<T[]>> {
    return api.get<T[]>(`${this.baseUrl}/all`)
  }
}

/**
 * 带状态管理的基础服务类
 */
export abstract class BaseServiceWithStatus<T = any, CreateT = Partial<T>, UpdateT = Partial<T>> 
  extends BaseApiService<T, CreateT, UpdateT> {
  
  /**
   * 启用项目
   */
  async enable(id: number | string): Promise<ApiResponse<T>> {
    return api.post<T>(`${this.baseUrl}/${id}/enable`)
  }

  /**
   * 禁用项目
   */
  async disable(id: number | string): Promise<ApiResponse<T>> {
    return api.post<T>(`${this.baseUrl}/${id}/disable`)
  }

  /**
   * 批量启用
   */
  async batchEnable(ids: (number | string)[]): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.baseUrl}/batch-enable`, { ids })
  }

  /**
   * 批量禁用
   */
  async batchDisable(ids: (number | string)[]): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.baseUrl}/batch-disable`, { ids })
  }
}