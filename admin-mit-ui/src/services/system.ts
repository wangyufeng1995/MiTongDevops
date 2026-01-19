/**
 * 系统设置 API 服务
 */
import { api } from './api'

// 系统配置接口
export interface SystemConfig {
  system: {
    system_name: string
    system_version: string
    system_description: string
    company_name: string
    company_logo?: string
    timezone: string
    language: string
    maintenance_mode: boolean
    maintenance_message: string
  }
  security: {
    max_login_attempts: number
    session_timeout: number
    password_policy: {
      min_length: number
      require_uppercase: boolean
      require_lowercase: boolean
      require_numbers: boolean
      require_symbols: boolean
      expiry_days: number
    }
  }
  backup: {
    auto_backup: boolean
    backup_interval: number
    backup_retention: number
    backup_location: string
  }
  notification: {
    email_enabled: boolean
    sms_enabled: boolean
    system_notifications: boolean
    email_config: {
      smtp_host: string
      smtp_port: number
      smtp_user: string
      smtp_password: string
      use_tls: boolean
    }
  }
}

// 系统信息接口
export interface SystemInfo {
  hostname: string
  os_version: string
  python_version: string
  cpu_cores: number
  memory_total: string
  disk_total: string
  uptime: string
  load_average: number[]
  total_users: number
  active_users: number
}

// 维护模式状态接口
export interface MaintenanceStatus {
  maintenance_mode: boolean
  maintenance_message: string
}

// 系统设置项接口
export interface SystemSetting {
  id: number
  key: string
  value: any
  category: string
  description?: string
  is_system: boolean
  is_enabled: boolean
  created_by: number
  updated_by?: number
  created_at: string
  updated_at: string
  creator_name?: string
  updater_name?: string
}

// 设置列表响应接口
export interface SettingsListResponse {
  settings: SystemSetting[]
  pagination: {
    page: number
    per_page: number
    total: number
    pages: number
    has_prev: boolean
    has_next: boolean
  }
}

// 导出数据接口
export interface ExportData {
  export_time: string
  tenant_id: number
  settings: Record<string, {
    value: any
    category: string
    description?: string
    is_system: boolean
  }>
}

// 安全统计接口
export interface SecurityStats {
  failed_logins_today: number
  locked_accounts: number
  active_sessions: number
  password_expiring_soon: number
  security_events_today: number
  last_security_scan: string | null
}

class SystemService {
  /**
   * 获取系统配置
   */
  async getSystemConfig(): Promise<SystemConfig> {
    const response = await api.get('/api/system/config')
    return response.data
  }

  /**
   * 更新系统配置
   */
  async updateSystemConfig(config: Partial<SystemConfig>): Promise<void> {
    await api.post('/api/system/config', config)
  }

  /**
   * 获取系统信息
   */
  async getSystemInfo(): Promise<SystemInfo> {
    const response = await api.get('/api/system/info')
    return response.data
  }

  /**
   * 获取维护模式状态
   */
  async getMaintenanceStatus(): Promise<MaintenanceStatus> {
    const response = await api.get('/api/system/maintenance')
    return response.data
  }

  /**
   * 设置维护模式
   */
  async setMaintenanceMode(enabled: boolean, message?: string): Promise<void> {
    await api.put('/api/system/maintenance', {
      enabled,
      message
    })
  }

  /**
   * 获取系统设置列表
   */
  async getSettings(params?: {
    category?: string
    page?: number
    per_page?: number
  }): Promise<SettingsListResponse> {
    const response = await api.get('/api/system/settings', { params })
    return response.data
  }

  /**
   * 获取单个设置
   */
  async getSetting(key: string): Promise<SystemSetting> {
    const response = await api.get(`/api/system/settings/${key}`)
    return response.data
  }

  /**
   * 更新单个设置
   */
  async updateSetting(key: string, data: {
    value: any
    description?: string
  }): Promise<SystemSetting> {
    const response = await api.put(`/api/system/settings/${key}`, data)
    return response.data
  }

  /**
   * 导出系统设置
   */
  async exportSettings(): Promise<ExportData> {
    const response = await api.get('/api/system/settings/export')
    return response.data
  }

  /**
   * 导入系统设置
   */
  async importSettings(data: ExportData): Promise<void> {
    await api.post('/api/system/settings/import', data)
  }

  /**
   * 初始化默认设置
   */
  async initializeDefaultSettings(): Promise<void> {
    await api.post('/api/system/initialize')
  }

  /**
   * 获取安全统计数据
   */
  async getSecurityStats(): Promise<SecurityStats> {
    const response = await api.get('/api/system/security/stats')
    return response.data
  }

  /**
   * 解锁所有被锁定的账户
   */
  async unlockAllAccounts(): Promise<{ unlocked_count: number; unlocked_users: string[] }> {
    const response = await api.post('/api/system/security/unlock-all')
    return response.data
  }

  /**
   * 下载导出文件
   */
  downloadExportFile(data: ExportData, filename?: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    })
    
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || `system-settings-${new Date().toISOString().split('T')[0]}.json`
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    window.URL.revokeObjectURL(url)
  }

  /**
   * 读取导入文件
   */
  readImportFile(file: File): Promise<ExportData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string)
          resolve(data)
        } catch (error) {
          reject(new Error('文件格式错误，请选择有效的JSON文件'))
        }
      }
      
      reader.onerror = () => {
        reject(new Error('文件读取失败'))
      }
      
      reader.readAsText(file)
    })
  }

  /**
   * 验证导入数据格式
   */
  validateImportData(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false
    }

    // 检查必需字段
    if (!data.settings || typeof data.settings !== 'object') {
      return false
    }

    // 检查设置格式
    for (const [key, setting] of Object.entries(data.settings)) {
      if (!setting || typeof setting !== 'object') {
        return false
      }

      const settingObj = setting as any
      if (!settingObj.hasOwnProperty('value') || 
          !settingObj.hasOwnProperty('category')) {
        return false
      }
    }

    return true
  }

  /**
   * 格式化字节数
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  /**
   * 格式化运行时间
   */
  formatUptime(uptime: string): string {
    // 如果已经是格式化的字符串，直接返回
    if (uptime.includes('天') || uptime.includes('小时') || uptime.includes('分钟')) {
      return uptime
    }

    // 如果是秒数，进行格式化
    const seconds = parseInt(uptime)
    if (isNaN(seconds)) {
      return uptime
    }

    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    return `${days}天 ${hours}小时 ${minutes}分钟`
  }

  /**
   * 获取系统状态颜色
   */
  getSystemStatusColor(value: number, thresholds: { warning: number; danger: number }): string {
    if (value >= thresholds.danger) {
      return 'text-red-600'
    } else if (value >= thresholds.warning) {
      return 'text-yellow-600'
    } else {
      return 'text-green-600'
    }
  }

  /**
   * 获取负载平均值状态
   */
  getLoadAverageStatus(loadAverage: number[], cpuCores: number): {
    status: 'good' | 'warning' | 'danger'
    color: string
    description: string
  } {
    const load1min = loadAverage[0] || 0
    const loadPercentage = (load1min / cpuCores) * 100

    if (loadPercentage < 70) {
      return {
        status: 'good',
        color: 'text-green-600',
        description: '系统负载正常'
      }
    } else if (loadPercentage < 90) {
      return {
        status: 'warning',
        color: 'text-yellow-600',
        description: '系统负载较高'
      }
    } else {
      return {
        status: 'danger',
        color: 'text-red-600',
        description: '系统负载过高'
      }
    }
  }
}

export const systemService = new SystemService()
export default systemService