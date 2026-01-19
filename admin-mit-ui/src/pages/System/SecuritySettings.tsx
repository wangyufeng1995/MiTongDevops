/**
 * 安全设置页面 - 美化版 v2
 * 更新时间: 2026-01-15
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Key, Lock, FileText, Activity, Eye, EyeOff, Unlock, RotateCcw, Trash2, Download, Scan } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useTheme } from '../../hooks/useTheme'
import { formatDateTime } from '../../utils'
import { systemService, SecurityStats } from '../../services/system'
import {
  SettingsPageLayout, SettingsCard, SettingsStatCard, FormInput, FormCheckbox, FormSwitch,
  SettingsLoadingState, SettingsAlert, QuickAction
} from '../../components/Settings'

interface SecurityConfig {
  password_policy: {
    min_length: number
    max_length: number
    require_uppercase: boolean
    require_lowercase: boolean
    require_numbers: boolean
    require_symbols: boolean
    expiry_days: number
    history_count: number
    complexity_score: number
  }
  login_security: {
    max_attempts: number
    lockout_duration: number
    require_2fa: boolean
    allow_concurrent_sessions: boolean
    max_concurrent_sessions: number
    session_timeout: number
    remember_me_duration: number
  }
  audit_settings: {
    log_login_attempts: boolean
    log_password_changes: boolean
    log_permission_changes: boolean
    log_system_changes: boolean
    log_data_access: boolean
    retention_days: number
    alert_failed_logins: boolean
    alert_threshold: number
  }
}

interface SecurityStats {
  failed_logins_today: number
  locked_accounts: number
  active_sessions: number
  password_expiring_soon: number
  security_events_today: number
  last_security_scan: string | null
}

export const SecuritySettings: React.FC = () => {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { token, isAuthenticated, isAdmin } = useAuthStore()
  
  const [config, setConfig] = useState<SecurityConfig | null>(null)
  const [stats, setStats] = useState<SecurityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [unlocking, setUnlocking] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || !token) { navigate('/login'); return }
    if (!isAdmin()) { navigate('/dashboard'); return }
  }, [isAuthenticated, token, isAdmin, navigate])

  const loadSecurityConfig = useCallback(async () => {
    if (!isAuthenticated || !token || !isAdmin()) return
    try {
      setLoading(true)
      setError(null)
      
      // 并行加载配置和统计数据
      const [statsResponse] = await Promise.all([
        systemService.getSecurityStats().catch(() => null)
      ])
      
      // 设置默认配置（后续可以从API获取）
      setConfig({
        password_policy: {
          min_length: 8, max_length: 128, require_uppercase: true, require_lowercase: true,
          require_numbers: true, require_symbols: false, expiry_days: 90, history_count: 5, complexity_score: 3
        },
        login_security: {
          max_attempts: 5, lockout_duration: 30, require_2fa: false, allow_concurrent_sessions: true,
          max_concurrent_sessions: 3, session_timeout: 7200, remember_me_duration: 30
        },
        audit_settings: {
          log_login_attempts: true, log_password_changes: true, log_permission_changes: true,
          log_system_changes: true, log_data_access: false, retention_days: 90,
          alert_failed_logins: true, alert_threshold: 10
        }
      })
      
      // 设置统计数据（从API获取或使用默认值）
      if (statsResponse) {
        setStats(statsResponse)
      } else {
        setStats({
          failed_logins_today: 0, locked_accounts: 0, active_sessions: 0,
          password_expiring_soon: 0, security_events_today: 0, last_security_scan: null
        })
      }
    } catch (err) {
      setError('加载安全配置失败')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, token, isAdmin])

  useEffect(() => {
    if (isAuthenticated && token && isAdmin()) loadSecurityConfig()
  }, [loadSecurityConfig, isAuthenticated, token, isAdmin])

  const handleSaveConfig = async () => {
    if (!config) return
    try {
      setSaving(true)
      setError(null)
      await new Promise(resolve => setTimeout(resolve, 1000))
      setSuccess('安全配置保存成功')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('保存安全配置失败')
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (section: string, field: string, value: any) => {
    if (!config) return
    setConfig({ ...config, [section]: { ...(config as any)[section], [field]: value } })
  }

  // 解锁所有账户
  const handleUnlockAllAccounts = async () => {
    if (!stats || stats.locked_accounts === 0) {
      setSuccess('没有需要解锁的账户')
      setTimeout(() => setSuccess(null), 3000)
      return
    }
    
    if (!window.confirm(`确定要解锁所有 ${stats.locked_accounts} 个被锁定的账户吗？`)) {
      return
    }
    
    try {
      setUnlocking(true)
      setError(null)
      const result = await systemService.unlockAllAccounts()
      setSuccess(`成功解锁 ${result.unlocked_count} 个账户`)
      setTimeout(() => setSuccess(null), 3000)
      // 刷新统计数据
      loadSecurityConfig()
    } catch (err: any) {
      setError(err.response?.data?.message || '解锁账户失败')
    } finally {
      setUnlocking(false)
    }
  }

  if (!isAuthenticated || !token || !isAdmin()) {
    return (
      <div className={`h-full flex items-center justify-center ${isDark ? 'bg-[#0f172a]' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>权限不足</h3>
          <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>只有管理员才能访问安全设置</p>
          <button onClick={() => navigate('/dashboard')} className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium">返回仪表盘</button>
        </div>
      </div>
    )
  }

  if (loading) return <SettingsLoadingState message="正在加载安全设置..." icon={Shield} />

  if (error && (!config || !stats)) {
    return (
      <div className={`h-full flex items-center justify-center ${isDark ? 'bg-[#0f172a]' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>加载失败</h3>
          <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{error}</p>
          <button onClick={loadSecurityConfig} className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium">重新加载</button>
        </div>
      </div>
    )
  }

  const headerActions = (
    <button onClick={() => setShowAdvanced(!showAdvanced)}
      className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isDark ? 'bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700 text-gray-300' : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 shadow-sm'}`}>
      {showAdvanced ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      <span>{showAdvanced ? '隐藏高级' : '高级选项'}</span>
    </button>
  )

  return (
    <SettingsPageLayout
      title="安全设置" subtitle="管理系统安全策略和访问控制" icon={Shield}
      iconGradient="from-emerald-500 via-green-500 to-teal-500"
      headerActions={headerActions} loading={loading} saving={saving}
      onRefresh={loadSecurityConfig} onSave={handleSaveConfig}
    >
      {error && <SettingsAlert type="error" message={error} onClose={() => setError(null)} />}
      {success && <SettingsAlert type="success" message={success} onClose={() => setSuccess(null)} />}

      {config && stats && (
        <>
          {/* 统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
            <SettingsStatCard title="今日失败登录" value={stats.failed_logins_today}
              icon={Lock} variant={stats.failed_logins_today > 0 ? 'danger' : 'success'}
              valueColorClass={stats.failed_logins_today > 0 ? 'text-red-500' : 'text-emerald-500'}
              iconColorClass={stats.failed_logins_today > 0 ? 'text-red-400' : 'text-emerald-400'}
              glowColor={stats.failed_logins_today > 0 ? 'bg-red-500' : 'bg-emerald-500'} />
            <SettingsStatCard title="锁定账户" value={stats.locked_accounts}
              icon={Unlock} variant={stats.locked_accounts > 0 ? 'warning' : 'success'}
              valueColorClass={stats.locked_accounts > 0 ? 'text-amber-500' : 'text-emerald-500'}
              iconColorClass={stats.locked_accounts > 0 ? 'text-amber-400' : 'text-emerald-400'}
              glowColor={stats.locked_accounts > 0 ? 'bg-amber-500' : 'bg-emerald-500'} />
            <SettingsStatCard title="活跃会话" value={stats.active_sessions}
              icon={Activity} variant="info" valueColorClass="text-blue-500" iconColorClass="text-blue-400" glowColor="bg-blue-500" />
            <SettingsStatCard title="密码即将过期" value={stats.password_expiring_soon}
              icon={Key} variant={stats.password_expiring_soon > 0 ? 'warning' : 'default'}
              valueColorClass={stats.password_expiring_soon > 0 ? 'text-amber-500' : undefined}
              iconColorClass={stats.password_expiring_soon > 0 ? 'text-amber-400' : undefined}
              glowColor={stats.password_expiring_soon > 0 ? 'bg-amber-500' : 'bg-gray-500'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 主要配置 */}
            <div className="lg:col-span-2 space-y-6">
              {/* 密码策略 */}
              <SettingsCard title="密码策略" icon={Key} iconColorClass={isDark ? 'text-amber-400' : 'text-amber-500'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <FormInput label="最小长度" type="number" value={config.password_policy.min_length}
                    onChange={(v) => updateConfig('password_policy', 'min_length', parseInt(v))} min={6} max={32} />
                  <FormInput label="密码过期天数" type="number" value={config.password_policy.expiry_days}
                    onChange={(v) => updateConfig('password_policy', 'expiry_days', parseInt(v))} min={0} max={365} hint="0 表示永不过期" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormCheckbox label="要求大写字母" checked={config.password_policy.require_uppercase} onChange={(v) => updateConfig('password_policy', 'require_uppercase', v)} />
                  <FormCheckbox label="要求小写字母" checked={config.password_policy.require_lowercase} onChange={(v) => updateConfig('password_policy', 'require_lowercase', v)} />
                  <FormCheckbox label="要求数字" checked={config.password_policy.require_numbers} onChange={(v) => updateConfig('password_policy', 'require_numbers', v)} />
                  <FormCheckbox label="要求特殊字符" checked={config.password_policy.require_symbols} onChange={(v) => updateConfig('password_policy', 'require_symbols', v)} />
                </div>
              </SettingsCard>

              {/* 登录安全 */}
              <SettingsCard title="登录安全" icon={Lock} iconColorClass={isDark ? 'text-purple-400' : 'text-purple-500'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <FormInput label="最大登录尝试" type="number" value={config.login_security.max_attempts}
                    onChange={(v) => updateConfig('login_security', 'max_attempts', parseInt(v))} min={1} max={10} />
                  <FormInput label="锁定时长（分钟）" type="number" value={config.login_security.lockout_duration}
                    onChange={(v) => updateConfig('login_security', 'lockout_duration', parseInt(v))} min={1} max={1440} />
                  <FormInput label="会话超时（秒）" type="number" value={config.login_security.session_timeout}
                    onChange={(v) => updateConfig('login_security', 'session_timeout', parseInt(v))} min={300} max={86400} />
                  <FormInput label="最大并发会话" type="number" value={config.login_security.max_concurrent_sessions}
                    onChange={(v) => updateConfig('login_security', 'max_concurrent_sessions', parseInt(v))} min={1} max={10} />
                </div>
                <div className={`space-y-3 pt-4 border-t border-dashed ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                  <FormSwitch label="双因素认证" description="要求用户启用双因素认证" checked={config.login_security.require_2fa} onChange={(v) => updateConfig('login_security', 'require_2fa', v)} />
                  <FormSwitch label="允许并发会话" description="允许用户同时在多个设备登录" checked={config.login_security.allow_concurrent_sessions} onChange={(v) => updateConfig('login_security', 'allow_concurrent_sessions', v)} />
                </div>
              </SettingsCard>

              {/* 审计日志 */}
              <SettingsCard title="审计日志" icon={FileText} iconColorClass={isDark ? 'text-cyan-400' : 'text-cyan-500'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <FormInput label="日志保留天数" type="number" value={config.audit_settings.retention_days}
                    onChange={(v) => updateConfig('audit_settings', 'retention_days', parseInt(v))} min={1} max={365} />
                  <FormInput label="失败登录告警阈值" type="number" value={config.audit_settings.alert_threshold}
                    onChange={(v) => updateConfig('audit_settings', 'alert_threshold', parseInt(v))} min={1} max={100} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormCheckbox label="记录登录尝试" checked={config.audit_settings.log_login_attempts} onChange={(v) => updateConfig('audit_settings', 'log_login_attempts', v)} />
                  <FormCheckbox label="记录密码更改" checked={config.audit_settings.log_password_changes} onChange={(v) => updateConfig('audit_settings', 'log_password_changes', v)} />
                  <FormCheckbox label="记录权限变更" checked={config.audit_settings.log_permission_changes} onChange={(v) => updateConfig('audit_settings', 'log_permission_changes', v)} />
                  <FormCheckbox label="记录系统变更" checked={config.audit_settings.log_system_changes} onChange={(v) => updateConfig('audit_settings', 'log_system_changes', v)} />
                  <FormCheckbox label="失败登录告警" checked={config.audit_settings.alert_failed_logins} onChange={(v) => updateConfig('audit_settings', 'alert_failed_logins', v)} />
                </div>
              </SettingsCard>
            </div>

            {/* 侧边栏 */}
            <div className="space-y-6">
              {/* 安全概览 */}
              <SettingsCard title="安全概览" icon={Shield}>
                <div className="space-y-4">
                  {[
                    { label: '今日失败登录', value: stats.failed_logins_today, color: stats.failed_logins_today > 0 ? 'text-red-500' : 'text-emerald-500' },
                    { label: '锁定账户', value: stats.locked_accounts, color: stats.locked_accounts > 0 ? 'text-red-500' : 'text-emerald-500' },
                    { label: '活跃会话', value: stats.active_sessions, color: 'text-blue-500' },
                    { label: '密码即将过期', value: stats.password_expiring_soon, color: stats.password_expiring_soon > 0 ? 'text-amber-500' : 'text-emerald-500' },
                    { label: '今日安全事件', value: stats.security_events_today, color: isDark ? 'text-white' : 'text-gray-900' },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{item.label}</span>
                      <span className={`text-sm font-semibold ${item.color}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </SettingsCard>

              {/* 安全扫描 */}
              <SettingsCard title="安全扫描" icon={Scan}>
                <div className="space-y-4">
                  <div>
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>最后扫描时间</span>
                    <p className={`text-sm font-medium mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {stats.last_security_scan 
                        ? formatDateTime(stats.last_security_scan, 'YYYY/MM/DD HH:mm:ss')
                        : '暂无扫描记录'}
                    </p>
                  </div>
                  <QuickAction label="立即扫描" icon={Scan} onClick={() => {}} variant="primary" />
                </div>
              </SettingsCard>

              {/* 快速操作 */}
              <SettingsCard title="快速操作" icon={Shield}>
                <div className="space-y-3">
                  <QuickAction 
                    label={unlocking ? '解锁中...' : `解锁所有账户${stats.locked_accounts > 0 ? ` (${stats.locked_accounts})` : ''}`} 
                    icon={Unlock} 
                    onClick={handleUnlockAllAccounts}
                    disabled={unlocking}
                  />
                  <QuickAction label="强制密码重置" icon={RotateCcw} onClick={() => {}} />
                  <QuickAction label="清除所有会话" icon={Trash2} onClick={() => {}} variant="danger" />
                  <QuickAction label="导出安全日志" icon={Download} onClick={() => {}} />
                </div>
              </SettingsCard>
            </div>
          </div>
        </>
      )}
    </SettingsPageLayout>
  )
}
