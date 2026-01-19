/**
 * Ansible API 服务
 */
import { BaseApiService } from './base'
import { api } from './api'
import {
  AnsiblePlaybook,
  PlaybookExecution,
  CreatePlaybookRequest,
  UpdatePlaybookRequest,
  ExecutePlaybookRequest,
  PlaybookListResponse,
  ExecutionListResponse,
  PlaybookStatistics,
  PlaybookSearchParams,
  ExecutionSearchParams
} from '../types/ansible'

export class AnsibleService extends BaseApiService {
  constructor() {
    super('/api/ansible/playbooks')
  }

  /**
   * 获取 Playbook 列表
   */
  async getPlaybooks(params: PlaybookSearchParams = {}): Promise<PlaybookListResponse> {
    const response = await api.get('/api/ansible/playbooks', { params })
    // 后端返回格式: { code, message, data: { playbooks, pagination } }
    return response.data.data || response.data
  }

  /**
   * 获取 Playbook 详情
   */
  async getPlaybook(id: number): Promise<AnsiblePlaybook> {
    const response = await api.get(`/api/ansible/playbooks/${id}`)
    return response.data.data || response.data
  }

  /**
   * 创建 Playbook
   */
  async createPlaybook(data: CreatePlaybookRequest): Promise<AnsiblePlaybook> {
    const response = await api.post('/api/ansible/playbooks', data)
    return response.data.data || response.data
  }

  /**
   * 更新 Playbook
   */
  async updatePlaybook(id: number, data: UpdatePlaybookRequest): Promise<AnsiblePlaybook> {
    const response = await api.put(`/api/ansible/playbooks/${id}`, data)
    return response.data.data || response.data
  }

  /**
   * 删除 Playbook
   */
  async deletePlaybook(id: number): Promise<void> {
    await api.post(`/api/ansible/playbooks/${id}/delete`)
  }

  /**
   * 切换 Playbook 激活状态
   */
  async togglePlaybookActive(id: number, isActive: boolean): Promise<void> {
    await api.post(`/api/ansible/playbooks/${id}/toggle-active`, { is_active: isActive })
  }

  /**
   * 获取 Playbook 历史版本
   */
  async getPlaybookHistory(id: number): Promise<{
    current: { id: number; name: string; version: string; updated_at: string | null };
    history: { id: number; version: string; created_at: string | null; content: string }[];
  }> {
    const response = await api.get(`/api/ansible/playbooks/${id}/history`)
    return response.data.data || response.data
  }

  /**
   * 获取所有 Playbook 的版本历史
   */
  async getAllPlaybookVersions(): Promise<{
    id: number;
    name: string;
    version: string;
    updated_at: string | null;
    creator?: { username: string; full_name?: string };
    history: { id: number; version: string; created_at: string | null; content: string }[];
  }[]> {
    const response = await api.get('/api/ansible/playbooks/versions')
    return response.data.data || response.data
  }

  /**
   * 恢复 Playbook 到指定版本
   */
  async restorePlaybookVersion(playbookId: number, versionId: number): Promise<void> {
    await api.post(`/api/ansible/playbooks/${playbookId}/restore/${versionId}`)
  }

  /**
   * 执行 Playbook
   */
  async executePlaybook(id: number, data: ExecutePlaybookRequest): Promise<PlaybookExecution> {
    const response = await api.post(`/api/ansible/playbooks/${id}/execute`, data)
    return response.data.data || response.data
  }

  /**
   * 获取执行历史
   */
  async getExecutions(params: ExecutionSearchParams = {}): Promise<ExecutionListResponse> {
    const response = await api.get('/api/ansible/executions', { params })
    return response.data.data || response.data
  }

  /**
   * 获取执行详情
   */
  async getExecution(id: number): Promise<PlaybookExecution> {
    const response = await api.get(`/api/ansible/executions/${id}`)
    return response.data.data || response.data
  }

  /**
   * 停止执行
   */
  async stopExecution(id: number): Promise<void> {
    await api.post(`/api/ansible/executions/${id}/cancel`)
  }

  /**
   * 删除执行记录
   */
  async deleteExecution(id: number): Promise<void> {
    await api.post(`/api/ansible/executions/${id}/delete`)
  }

  /**
   * 批量删除执行记录
   */
  async batchDeleteExecutions(ids: number[]): Promise<{ deleted_count: number }> {
    const response = await api.post('/api/ansible/executions/batch-delete', { ids })
    return response.data.data || response.data
  }

  /**
   * 强制停止所有运行中的执行
   */
  async forceStopAllExecutions(): Promise<{ stopped_count: number }> {
    const response = await api.post('/api/ansible/executions/force-stop-all')
    return response.data.data || response.data
  }

  /**
   * 获取统计信息
   */
  async getStatistics(): Promise<PlaybookStatistics> {
    const response = await api.get('/api/ansible/playbooks/statistics')
    return response.data.data || response.data
  }

  /**
   * 验证 Playbook 语法
   */
  async validatePlaybook(content: string): Promise<{ valid: boolean; errors?: string[] }> {
    const response = await api.post('/api/ansible/playbooks/validate', { content })
    return response.data.data || response.data
  }

  /**
   * 获取 Playbook 模板
   */
  async getTemplates(): Promise<Array<{ name: string; description: string; content: string }>> {
    const response = await api.get('/api/ansible/playbooks/templates')
    return response.data.data || response.data
  }

  /**
   * 导出 Playbook
   */
  async exportPlaybook(id: number): Promise<Blob> {
    const response = await api.get(`/api/ansible/playbooks/${id}/export`, {
      responseType: 'blob'
    })
    return response.data
  }

  /**
   * 导入 Playbook
   */
  async importPlaybook(file: File): Promise<AnsiblePlaybook> {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await api.post('/api/ansible/playbooks/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data.data || response.data
  }

  /**
   * 复制 Playbook
   */
  async copyPlaybook(id: number, name: string): Promise<AnsiblePlaybook> {
    const response = await api.post(`/api/ansible/playbooks/${id}/copy`, { name })
    return response.data.data || response.data
  }

  /**
   * 获取执行状态（用于轮询）
   */
  async getExecutionStatus(executionUuid: string): Promise<{
    execution_id: string
    status: string
    progress: number
    is_running: boolean
    started_at: string | null
    finished_at: string | null
    execution_summary: any
  }> {
    const response = await api.get(`/api/ansible/executions/${executionUuid}/status`)
    return response.data.data || response.data
  }

  /**
   * 创建 SSE 实时日志流连接
   * @param executionId 执行记录 ID
   * @param onLog 日志回调
   * @param onStatus 状态回调
   * @param onComplete 完成回调
   * @param onError 错误回调
   * @returns 关闭连接的函数
   */
  createLogStream(
    executionId: number,
    callbacks: {
      onLog?: (content: string) => void
      onStatus?: (status: string, progress: number) => void
      onComplete?: (status: string, output: string, error?: string) => void
      onError?: (message: string) => void
    }
  ): () => void {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
    const url = `${baseUrl}/api/ansible/executions/${executionId}/stream`
    
    const eventSource = new EventSource(url)
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        switch (data.type) {
          case 'log':
            callbacks.onLog?.(data.content)
            break
          case 'status':
            callbacks.onStatus?.(data.status, data.progress || 0)
            break
          case 'complete':
            callbacks.onComplete?.(data.status, data.output || '', data.error)
            eventSource.close()
            break
          case 'error':
            callbacks.onError?.(data.message)
            eventSource.close()
            break
          case 'end':
            eventSource.close()
            break
        }
      } catch (e) {
        console.error('Failed to parse SSE message:', e)
      }
    }
    
    eventSource.onerror = () => {
      callbacks.onError?.('SSE 连接断开')
      eventSource.close()
    }
    
    // 返回关闭函数
    return () => {
      eventSource.close()
    }
  }
}

// 创建全局实例
export const ansibleService = new AnsibleService()