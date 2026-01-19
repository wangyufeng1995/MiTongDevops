/**
 * WebShell 审计日志和命令过滤相关类型定义
 * Requirements: 4.1
 */

// ==================== 审计日志类型 ====================

/**
 * 审计日志状态
 */
export type AuditLogStatus = 'success' | 'blocked' | 'failed'

/**
 * 审计日志记录
 */
export interface AuditLog {
  id: number
  tenant_id: number
  user_id: number
  username: string | null
  host_id: number
  hostname: string | null
  host_name: string | null
  session_id: string | null
  command: string
  status: AuditLogStatus
  output_summary: string | null
  error_message: string | null
  block_reason: string | null
  ip_address: string | null
  execution_time: number | null
  executed_at: string
  created_at: string
  updated_at: string
}

/**
 * 审计日志查询参数
 */
export interface AuditLogQuery {
  user_id?: number
  status?: AuditLogStatus
  start_date?: string
  end_date?: string
  page?: number
  page_size?: number
}

/**
 * 审计日志分页信息
 */
export interface AuditLogPagination {
  page: number
  page_size: number
  total: number
  pages: number
}

/**
 * 审计日志列表响应
 */
export interface AuditLogListResponse {
  logs: AuditLog[]
  pagination: AuditLogPagination
}

/**
 * 审计日志统计信息
 */
export interface AuditLogStats {
  total_commands: number
  success_count: number
  blocked_count: number
  failed_count: number
  unique_users: number
  top_commands: Array<{
    command: string
    count: number
  }>
  daily_stats: Array<{
    date: string
    total: number
    success: number
    blocked: number
    failed: number
  }>
}

/**
 * 清理日志请求参数
 */
export interface ClearLogsRequest {
  days_to_keep: number
}

/**
 * 清理日志响应
 */
export interface ClearLogsResponse {
  deleted_count: number
}

// ==================== 命令过滤规则类型 ====================

/**
 * 命令过滤模式
 */
export type FilterMode = 'whitelist' | 'blacklist'

/**
 * 命令过滤规则
 */
export interface CommandFilterRule {
  id?: number
  tenant_id?: number
  host_id: number | null
  host_name?: string | null
  mode: FilterMode
  whitelist: string[]
  blacklist: string[]
  is_active: boolean
  created_at?: string
  updated_at?: string
}

/**
 * 获取命令过滤规则响应
 */
export interface CommandFilterRuleResponse {
  rules: CommandFilterRule
  is_global: boolean
  has_host_rules: boolean
}

/**
 * 设置命令过滤规则请求
 */
export interface SetCommandFilterRequest {
  mode: FilterMode
  whitelist: string[]
  blacklist: string[]
}

/**
 * 设置命令过滤规则响应
 */
export interface SetCommandFilterResponse {
  rules: CommandFilterRule | null
}

/**
 * 默认黑名单响应
 */
export interface DefaultBlacklistResponse {
  blacklist: string[]
}
