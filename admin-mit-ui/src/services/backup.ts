/**
 * 备份管理服务
 */
import { api } from './api'

export interface DbBackupConfig {
  enabled: boolean
  auto_backup: boolean
  backup_interval: number
  backup_time: string
  retention_days: number
  backup_location: string
  compression: boolean
  pg_host: string
  pg_port: number
  pg_database: string
  pg_username: string
}

export interface NetworkBackupConfig {
  enabled: boolean
  auto_backup: boolean
  backup_interval: number
  backup_time: string
  retention_days: number
  backup_location: string
  compression: boolean
}

export interface BackupRecord {
  id: number
  filename: string
  filepath: string
  category: 'database' | 'network'
  type: string
  size: string
  file_size: number
  compression: boolean
  status: string
  message: string
  db_host?: string
  db_name?: string
  created_at: string
}

export interface BackupHistoryResponse {
  backups: BackupRecord[]
  pagination: {
    page: number
    per_page: number
    total: number
    pages: number
    has_prev: boolean
    has_next: boolean
  }
}

export interface BackupTaskResult {
  task_id: string
}

export interface BackupTaskStatus {
  task_id: string
  status: string
  result?: {
    success: boolean
    message: string
    filename?: string
    size?: string
  }
}

export const backupService = {
  // 获取数据库备份配置
  async getDatabaseConfig(): Promise<DbBackupConfig> {
    const response = await api.get<{ data: DbBackupConfig }>('/api/backup/config/database')
    return response.data as unknown as DbBackupConfig
  },

  // 保存数据库备份配置
  async saveDatabaseConfig(config: DbBackupConfig): Promise<void> {
    await api.post('/api/backup/config/database', config)
  },

  // 获取网络探测备份配置
  async getNetworkConfig(): Promise<NetworkBackupConfig> {
    const response = await api.get<{ data: NetworkBackupConfig }>('/api/backup/config/network')
    return response.data as unknown as NetworkBackupConfig
  },

  // 保存网络探测备份配置
  async saveNetworkConfig(config: NetworkBackupConfig): Promise<void> {
    await api.post('/api/backup/config/network', config)
  },

  // 执行数据库备份
  async executeDbBackup(): Promise<BackupTaskResult> {
    const response = await api.post<{ data: BackupTaskResult }>('/api/backup/execute/database')
    return response.data as unknown as BackupTaskResult
  },

  // 执行网络探测备份
  async executeNetworkBackup(): Promise<BackupTaskResult> {
    const response = await api.post<{ data: BackupTaskResult }>('/api/backup/execute/network')
    return response.data as unknown as BackupTaskResult
  },

  // 获取备份任务状态
  async getTaskStatus(taskId: string): Promise<BackupTaskStatus> {
    const response = await api.get<{ data: BackupTaskStatus }>(`/api/backup/task/${taskId}`)
    return response.data as unknown as BackupTaskStatus
  },

  // 获取备份历史（分页）
  async getHistory(page: number = 1, perPage: number = 5, category?: 'database' | 'network'): Promise<BackupHistoryResponse> {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('per_page', perPage.toString())
    if (category) params.append('category', category)
    const response = await api.get<{ data: BackupHistoryResponse }>(`/api/backup/history?${params}`)
    return response.data as unknown as BackupHistoryResponse
  },

  // 下载备份文件
  async downloadBackup(backupId: number): Promise<Blob> {
    return api.download(`/api/backup/download/${backupId}`)
  },

  // 删除备份文件
  async deleteBackup(backupId: number): Promise<void> {
    await api.delete(`/api/backup/delete/${backupId}`)
  }
}
