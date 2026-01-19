/**
 * 操作日志相关类型定义
 */

export interface OperationLog {
  id: number
  user_id: number
  username: string
  user_full_name?: string
  tenant_id: number
  tenant_name: string
  action: string
  resource: string
  resource_id?: number
  method: string
  path: string
  ip_address: string
  user_agent: string
  request_data?: Record<string, any>
  response_data?: Record<string, any>
  status_code: number
  duration: number
  created_at: string
}

export interface LogSearchParams {
  keyword?: string
  username?: string
  action?: string
  resource?: string
  method?: string
  status_code?: number
  start_date?: string
  end_date?: string
  page?: number
  page_size?: number
}

export interface LogStatistics {
  total_logs: number
  today_logs: number
  error_logs: number
  success_rate: number
  top_users: Array<{
    username: string
    count: number
  }>
  top_actions: Array<{
    action: string
    count: number
  }>
}

export type LogLevel = 'info' | 'warning' | 'error' | 'success'

export interface LogFilter {
  label: string
  value: string | number
  count?: number
}