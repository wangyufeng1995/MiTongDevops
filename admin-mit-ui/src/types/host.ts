/**
 * 主机管理相关类型定义
 */

// ==================== 分页信息 ====================

export interface PaginationInfo {
  page: number
  per_page: number
  total: number
  pages: number
  has_prev: boolean
  has_next: boolean
}

// ==================== 主机分组相关类型 ====================

export interface HostGroup {
  id: number
  tenant_id: number
  name: string
  description?: string
  host_count: number
  created_at: string
  updated_at: string
}

export interface CreateHostGroupRequest {
  name: string
  description?: string
}

export interface UpdateHostGroupRequest {
  name?: string
  description?: string
}

export interface HostGroupListResponse {
  groups: HostGroup[]
  pagination: PaginationInfo
}

// ==================== 探测相关类型 ====================

export type ProbeStatus = 'pending' | 'running' | 'success' | 'failed' | 'timeout'

export interface ProbeTaskResponse {
  task_id: string
  host_id: number
  status: ProbeStatus
  message?: string
}

export interface BatchProbeResponse {
  task_ids: string[]
  host_ids: number[]
  status: ProbeStatus
  message?: string
}

export interface ProbeTaskStatus {
  task_id: string
  status: ProbeStatus
  error?: string  // 错误信息
  result?: {
    host_id: number
    status: string
    message: string
    response_time?: number
    ansible_output?: string
    host_info?: HostInfo
  }
}

export interface ProbeHistoryItem {
  id: number
  host_id: number
  task_id?: string
  status: string
  message?: string
  ansible_output?: string
  response_time?: number
  probed_at: string
}

export interface ProbeHistoryResponse {
  history: ProbeHistoryItem[]
  pagination?: PaginationInfo
}

// ==================== 主机信息相关类型 ====================

export interface HostInfo {
  id: number
  host_id: number
  os_name?: string
  os_version?: string
  kernel_version?: string
  cpu_cores?: number
  total_memory?: number
  disk_total?: number
  network_interfaces?: any
  updated_at?: string
}

export interface HostMetrics {
  id: number
  host_id: number
  cpu_usage?: number
  memory_usage?: number
  disk_usage?: number
  network_in?: number
  network_out?: number
  load_average?: number
  collected_at?: string
}

// ==================== 主机核心类型 ====================

export interface Host {
  id: number
  tenant_id: number
  name: string
  hostname: string
  port: number
  username: string
  auth_type: 'password' | 'key'
  description?: string
  os_type?: string
  status: number
  last_connected_at?: string
  created_at: string
  updated_at: string
  host_info?: HostInfo
  latest_metrics?: HostMetrics
  metrics_history?: HostMetrics[]
  // 分组相关字段
  group_id?: number
  group?: HostGroup
  // 探测相关字段
  last_probe_status?: ProbeStatus | null
  last_probe_at?: string
  last_probe_message?: string
}

// ==================== 请求类型 ====================

export interface CreateHostRequest {
  name: string
  hostname: string
  port?: number
  username: string
  auth_type: 'password' | 'key'
  password?: string
  private_key?: string
  description?: string
  os_type?: string
  group_id?: number
}

export interface UpdateHostRequest {
  name?: string
  hostname?: string
  port?: number
  username?: string
  auth_type?: 'password' | 'key'
  password?: string
  private_key?: string
  description?: string
  os_type?: string
  status?: number
  group_id?: number
}

// ==================== 响应类型 ====================

export interface HostListResponse {
  hosts: Host[]
  pagination: PaginationInfo
}

export interface HostConnectionTest {
  host_id: number
  name: string
  hostname: string
  connected: boolean
  message: string
  tested_at: string
}

export interface HostStatus {
  host_id: number
  name: string
  hostname: string
  status: number
  last_connected_at?: string
  latest_metrics?: HostMetrics
  is_collecting: boolean
}

// ==================== 主机列表查询参数 ====================

export interface HostListParams {
  page?: number
  per_page?: number
  search?: string
  group_id?: number | null
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}


// ==================== 批量导入相关类型 ====================

export interface HostImportSuccessItem {
  row: number
  id: number
  name: string
  hostname: string
}

export interface HostImportFailedItem {
  row: number
  name: string
  hostname: string
  error: string
}

export interface HostImportSkippedItem {
  row: number
  name: string
  hostname: string
  reason: string
}

export interface HostImportResponse {
  total: number
  success_count: number
  failed_count: number
  skipped_count: number
  success: HostImportSuccessItem[]
  failed: HostImportFailedItem[]
  skipped: HostImportSkippedItem[]
}
