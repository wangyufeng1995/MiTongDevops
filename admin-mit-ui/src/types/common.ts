/**
 * 通用类型定义
 */

// 基础响应类型
export interface BaseResponse<T = any> {
  success: boolean
  message: string
  data: T
  code?: number
}

// 分页参数
export interface PaginationParams {
  page: number
  limit: number
  search?: string
  sort?: string
  order?: 'asc' | 'desc'
}

// 分页响应
export interface PaginationResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// 选项类型
export interface Option<T = any> {
  label: string
  value: T
  disabled?: boolean
  children?: Option<T>[]
}

// 表格列定义
export interface TableColumn<T = any> {
  key: string
  title: string
  dataIndex?: keyof T
  width?: number | string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  filterable?: boolean
  render?: (value: any, record: T, index: number) => React.ReactNode
}

// 表单字段类型
export interface FormField {
  name: string
  label: string
  type: 'text' | 'password' | 'email' | 'number' | 'select' | 'textarea' | 'checkbox' | 'radio' | 'date' | 'file'
  required?: boolean
  placeholder?: string
  options?: Option[]
  validation?: {
    min?: number
    max?: number
    pattern?: RegExp
    message?: string
  }
}

// 菜单项类型
export interface MenuItem {
  id: string
  title: string
  path?: string
  icon?: string
  children?: MenuItem[]
  permissions?: string[]
  hidden?: boolean
}

// 面包屑项类型
export interface BreadcrumbItem {
  title: string
  path?: string
}

// 通知类型
export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  timestamp: Date
}

// 文件上传类型
export interface UploadFile {
  id: string
  name: string
  size: number
  type: string
  url?: string
  status: 'uploading' | 'success' | 'error'
  progress?: number
  error?: string
}

// 主题配置
export interface ThemeConfig {
  primaryColor: string
  darkMode: boolean
  sidebarCollapsed: boolean
  language: 'zh-CN' | 'en-US'
}

// 权限类型
export interface Permission {
  resource: string
  action: string
  conditions?: Record<string, any>
}

// 角色类型
export interface Role {
  id: number
  name: string
  description?: string
  permissions: Permission[]
  createdAt: string
  updatedAt: string
}

// 租户类型
export interface Tenant {
  id: number
  name: string
  code: string
  status: number
  createdAt: string
  updatedAt: string
}

// 操作日志类型
export interface OperationLog {
  id: number
  userId: number
  username: string
  action: string
  resource: string
  resourceId?: number
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

// 统计数据类型
export interface Statistics {
  total: number
  active: number
  inactive: number
  growth: number
  growthRate: number
}

// 图表数据类型
export interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string | string[]
    borderWidth?: number
  }[]
}

// 状态类型
export type Status = 'idle' | 'loading' | 'success' | 'error'

// 排序类型
export interface SortConfig {
  field: string
  direction: 'asc' | 'desc'
}

// 过滤器类型
export interface FilterConfig {
  field: string
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'between'
  value: any
}

// 搜索配置
export interface SearchConfig {
  fields: string[]
  keyword: string
}

// 导出配置
export interface ExportConfig {
  format: 'csv' | 'excel' | 'pdf'
  fields?: string[]
  filename?: string
}

// 批量操作类型
export interface BatchOperation {
  action: string
  ids: (string | number)[]
  params?: Record<string, any>
}

// 模态框配置
export interface ModalConfig {
  title: string
  content?: React.ReactNode
  width?: number | string
  closable?: boolean
  maskClosable?: boolean
  onOk?: () => void | Promise<void>
  onCancel?: () => void
  okText?: string
  cancelText?: string
}

// 确认对话框配置
export interface ConfirmConfig {
  title: string
  content?: string
  type?: 'info' | 'success' | 'warning' | 'error'
  onOk?: () => void | Promise<void>
  onCancel?: () => void
  okText?: string
  cancelText?: string
}

// 加载状态
export interface LoadingState {
  [key: string]: boolean
}

// 错误状态
export interface ErrorState {
  [key: string]: string | null
}