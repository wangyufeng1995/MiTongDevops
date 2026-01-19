/**
 * Ansible 相关类型定义
 */

export interface AnsiblePlaybook {
  id: number
  tenant_id: number
  name: string
  description?: string
  content: string
  variables?: Record<string, any>
  version: string
  created_by: number
  created_at: string
  updated_at: string
  creator?: {
    id: number
    username: string
    full_name?: string
  }
  execution_count?: number
  last_executed_at?: string
  last_execution_status?: 'pending' | 'running' | 'success' | 'failed' | 'cancelled'
}

export interface PlaybookExecution {
  id: number
  tenant_id: number
  playbook_id: number
  host_ids: number[]
  variables?: Record<string, any>
  status: 'pending' | 'running' | 'success' | 'failed'
  output?: string
  error_message?: string
  started_at?: string
  finished_at?: string
  created_by: number
  created_at: string
  playbook?: AnsiblePlaybook
  hosts?: Array<{
    id: number
    name: string
    hostname: string
  }>
  creator?: {
    id: number
    username: string
    full_name?: string
  }
}

export interface CreatePlaybookRequest {
  name: string
  description?: string
  content: string
  variables?: Record<string, any>
  version?: string
}

export interface UpdatePlaybookRequest {
  name?: string
  description?: string
  content?: string
  variables?: Record<string, any>
  version?: string
}

export interface ExecutePlaybookRequest {
  host_ids: number[]
  variables?: Record<string, any>
}

export interface PlaybookListResponse {
  playbooks: AnsiblePlaybook[]
  pagination: {
    page: number
    per_page: number
    total: number
    pages: number
    has_prev: boolean
    has_next: boolean
  }
}

export interface ExecutionListResponse {
  executions: PlaybookExecution[]
  pagination: {
    page: number
    per_page: number
    total: number
    pages: number
    has_prev: boolean
    has_next: boolean
  }
}

export interface PlaybookStatistics {
  total_playbooks: number
  total_executions: number
  success_rate: number
  most_used_playbooks: Array<{
    id: number
    name: string
    execution_count: number
  }>
  recent_executions: PlaybookExecution[]
}

export interface PlaybookSearchParams {
  page?: number
  per_page?: number
  search?: string
  created_by?: number
  version?: string
  sort_by?: 'name' | 'created_at' | 'updated_at' | 'execution_count'
  sort_order?: 'asc' | 'desc'
}

export interface ExecutionSearchParams {
  page?: number
  per_page?: number
  playbook_id?: number
  status?: PlaybookExecution['status']
  created_by?: number
  host_id?: number
  sort_by?: 'created_at' | 'started_at' | 'finished_at'
  sort_order?: 'asc' | 'desc'
}