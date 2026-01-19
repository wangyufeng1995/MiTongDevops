/**
 * 系统设置页面 - 美化版
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, Shield, Server, Activity, Download, Upload, Cpu, HardDrive, Users, Clock, Globe, Trash2, RotateCcw, FileText, Eye } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useTheme } from '../../hooks/useTheme'
import systemService from '../../services/system'
import {
  SettingsPageLayout, SettingsCard, SettingsStatCard, FormInput, FormSelect, FormSwitch,
  SettingsLoadingState, SettingsAlert, QuickAction
} from '../../components/Settings'

interface SystemConfig {
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

interface SystemInfo {
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

export const SystemSettings: React.FC = () => {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { token, isAuthenticated, isAdmin } = useAuthStore()
  
  const [config, setConfig] = useState<SystemConfig | null>(null)
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !token) { navigate('/login'); return }
    if (!isAdmin()) { navigate('/dashboard'); return }
  }, [isAuthenticated, token, isAdmin, navigate])

  const loadSystemConfig = useCallback(async () => {
    if (!isAuthenticated || !token || !isAdmin()) return
    try {
      setLoading(true)
      setError(null)
      const [configData, infoData] = await Promise.all([
        systemService.getSystemConfig(),
        systemService.getSystemInfo()
      ])
      setConfig(configData)
      setSystemInfo(infoData)
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || '加载系统配置失败')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, token, isAdmin])

  useEffect(() => {
    if (isAuthenticated && token && isAdmin()) loadSystemConfig()
  }, [loadSystemConfig, isAuthenticated, token, isAdmin])

  const handleSaveConfig = async () => {
    if (!config) return
    try {
      setSaving(true)
      setError(null)
      await systemService.updateSystemConfig(config)
      setSuccess('系统配置保存成功')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (section: string, field: string, value: any) => {
    if (!config) return
    setConfig({ ...config, [section]: { ...config[section as keyof SystemConfig], [field]: value } })
  }

  const toggleMaintenanceMode = async () => {
    if (!config) return
    const newMode = !config.system.maintenance_mode
    try {
      updateConfig('system', 'maintenance_mode', newMode)
      await systemService.setMaintenanceMode(newMode, config.system.maintenance_message)
      setSuccess(`维护模式${newMode ? '启用' : '禁用'}成功`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      updateConfig('system', 'maintenance_mode', !newMode)
      setError(err.response?.data?.message || '设置维护模式失败')
    }
  }

  const handleExportConfig = async () => {
    try {
      const exportData = await systemService.exportSettings()
      systemService.downloadExportFile(exportData)
      setSuccess('系统配置导出成功')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || '导出失败')
    }
  }

  const handleImportConfig = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const importData = await systemService.readImportFile(file)
      if (!systemService.validateImportData(importData)) {
        setError('导入文件格式错误')
        return
      }
      await systemService.importSettings(importData)
      setSuccess('系统配置导入成功')
      setTimeout(() => { setSuccess(null); loadSystemConfig() }, 1000)
    } catch (err: any) {
      setError(err.response?.data?.message || '导入失败')
    }
    event.target.value = ''
  }

  if (!isAuthenticated || !token || !isAdmin()) {
    return (
      <div className={`h-full flex items-center justify-center ${isDark ? 'bg-[#0f172a]' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>权限不足</h3>
          <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>只有管理员才能访问系统设置</p>
          <button onClick={() => navigate('/dashboard')} className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium">返回仪表盘</button>
        </div>
      </div>
    )
  }

  if (loading) return <SettingsLoadingState message="正在加载系统设置..." icon={Settings} />

  if (error && (!config || !systemInfo)) {
    return (
      <div className={`h-full flex items-center justify-center ${isDark ? 'bg-[#0f172a]' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
        <div className="text-center">
          <Settings className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>加载失败</h3>
          <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{error}</p>
          <button onClick={loadSystemConfig} className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium">重新加载</button>
        </div>
      </div>
    )
  }

  const headerActions = (
    <>
      <button onClick={handleExportConfig} className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isDark ? 'bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700 text-gray-300' : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 shadow-sm'}`}>
        <Download className="w-4 h-4" /><span>导出</span>
      </button>
      <label className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all ${isDark ? 'bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700 text-gray-300' : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 shadow-sm'}`}>
        <Upload className="w-4 h-4" /><span>导入</span>
        <input type="file" accept=".json" onChange={handleImportConfig} className="hidden" />
      </label>
    </>
  )

  return (
    <SettingsPageLayout
      title="系统设置" subtitle="管理系统基本配置和参数" icon={Settings}
      iconGradient="from-blue-500 via-indigo-500 to-purple-500"
      headerActions={headerActions} loading={loading} saving={saving}
      onRefresh={loadSystemConfig} onSave={handleSaveConfig}
    >
      {error && <SettingsAlert type="error" message={error} onClose={() => setError(null)} />}
      {success && <SettingsAlert type="success" message={success} onClose={() => setSuccess(null)} />}

      {config && systemInfo && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 主要配置 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 基本信息 */}
            <SettingsCard title="基本信息" icon={Settings}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput label="系统名称" value={config.system.system_name} onChange={(v) => updateConfig('system', 'system_name', v)} />
                <FormInput label="系统版本" value={config.system.system_version} onChange={(v) => updateConfig('system', 'system_version', v)} />
                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>系统描述</label>
                  <textarea value={config.system.system_description} onChange={(e) => updateConfig('system', 'system_description', e.target.value)} rows={3}
                    className={`w-full px-3 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
                </div>
                <FormInput label="公司名称" value={config.system.company_name} onChange={(v) => updateConfig('system', 'company_name', v)} />
                <FormSelect label="时区" value={config.system.timezone} onChange={(v) => updateConfig('system', 'timezone', v)}
                  options={[
                    { value: 'Asia/Shanghai', label: 'Asia/Shanghai (UTC+8)' },
                    { value: 'UTC', label: 'UTC (UTC+0)' },
                    { value: 'America/New_York', label: 'America/New_York (UTC-5)' },
                    { value: 'Europe/London', label: 'Europe/London (UTC+0)' },
                  ]} />
              </div>
            </SettingsCard>

            {/* 安全设置 */}
            <SettingsCard title="安全设置" icon={Shield} iconColorClass={isDark ? 'text-emerald-400' : 'text-emerald-500'}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput label="最大登录尝试次数" type="number" value={config.security.max_login_attempts} onChange={(v) => updateConfig('security', 'max_login_attempts', parseInt(v))} min={1} max={10} />
                <FormInput label="会话超时时间（秒）" type="number" value={config.security.session_timeout} onChange={(v) => updateConfig('security', 'session_timeout', parseInt(v))} min={300} max={86400} />
              </div>
            </SettingsCard>

            {/* 维护模式 */}
            <SettingsCard title="维护模式" icon={Activity} iconColorClass={isDark ? 'text-amber-400' : 'text-amber-500'}>
              <div className="space-y-4">
                <FormSwitch label="启用维护模式" description="启用后，普通用户将无法访问系统" checked={config.system.maintenance_mode} onChange={toggleMaintenanceMode} />
                {config.system.maintenance_mode && (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>维护提示信息</label>
                    <textarea value={config.system.maintenance_message} onChange={(e) => updateConfig('system', 'maintenance_message', e.target.value)} rows={3} placeholder="请输入维护期间显示给用户的提示信息"
                      className={`w-full px-3 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                  </div>
                )}
              </div>
            </SettingsCard>
          </div>

          {/* 侧边栏 */}
          <div className="space-y-6">
            {/* 服务器信息 */}
            <SettingsCard title="服务器信息" icon={Server}>
              <div className="space-y-3">
                {[
                  { label: '主机名', value: systemInfo.hostname },
                  { label: '操作系统', value: systemInfo.os_version },
                  { label: 'Python版本', value: systemInfo.python_version },
                  { label: 'CPU核心数', value: systemInfo.cpu_cores },
                  { label: '内存总量', value: systemInfo.memory_total },
                  { label: '磁盘总量', value: systemInfo.disk_total },
                  { label: '运行时间', value: systemInfo.uptime },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{item.label}</span>
                    <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </SettingsCard>

            {/* 系统状态 */}
            <SettingsCard title="系统状态" icon={Activity}>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>负载平均值</span>
                    <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{systemInfo.load_average.join(' / ')}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>在线用户</span>
                    <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{systemInfo.active_users} / {systemInfo.total_users}</span>
                  </div>
                  <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`}>
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all" style={{ width: `${(systemInfo.active_users / systemInfo.total_users) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </SettingsCard>
          </div>
        </div>
      )}
    </SettingsPageLayout>
  )
}
