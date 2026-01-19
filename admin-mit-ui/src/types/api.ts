export interface ApiResponse<T = any> {
  success: boolean
  data: T
  message?: string
  errors?: Record<string, string[]>
}

export interface PaginationParams {
  page?: number
  per_page?: number
  search?: string
}

export interface PaginatedResponse<T> {
  users?: T[] // 用户列表的特殊字段名
  items?: T[] // 通用列表字段名
  roles?: T[] // 角色列表的特殊字段名
  total?: number // 总数
  pagination: {
    page: number
    per_page: number
    total: number
    pages: number
    has_prev: boolean
    has_next: boolean
  }
}