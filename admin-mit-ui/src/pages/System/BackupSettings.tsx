/**
 * 备份设置页面 - 美化版
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database, Save, RefreshCw, Download, Trash2, Clock, FileText, Network, CheckCircle, AlertTriangle, XCircle, Info, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useTheme } from '../../hooks/useTheme'
import { formatDateTime } from '../../utils'
import { backupService, DbBackupConfig, NetworkBackupConfig, BackupRecord } from '../../services/backup'
import { SettingsPageLayout, SettingsCard, SettingsStatCard, FormInput, FormSelect, FormSwitch, FormCheckbox, SettingsLoadingState } from '../../components/Settings'

interface ToastState { show: boolean; type: 'success' | 'error' | 'warning' | 'info'; message: string; title?: string; progress?: number }
interface ConfirmDialogState { show: boolean; title: string; message: string; confirmText?: string; cancelText?: string; type?: 'danger' | 'warning' | 'info'; onConfirm?: () => void; loading?: boolean }
interface PaginationState { page: number; per_page: number; total: number; pages: number; has_prev: boolean; has_next: boolean }

export const BackupSettings: React.FC = () => {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { token, isAuthenticated, isAdmin } = useAuthStore()
  const [dbConfig, setDbConfig] = useState<DbBackupConfig | null>(null)
  const [networkConfig, setNetworkConfig] = useState<NetworkBackupConfig | null>(null)
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, per_page: 5, total: 0, pages: 0, has_prev: false, has_next: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [backingUp, setBackingUp] = useState<{ database: boolean; network: boolean }>({ database: false, network: false })
  const [toast, setToast] = useState<ToastState>({ show: false, type: 'info', message: '', progress: 100 })
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ show: false, title: '', message: '' })
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null)
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)

  const showToast = (type: ToastState['type'], message: string, title?: string, duration: number = 4000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    setToast({ show: true, type, message, title, progress: 100 })
    const startTime = Date.now()
    progressTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, 100 - ((Date.now() - startTime) / duration) * 100)
      setToast(prev => ({ ...prev, progress: remaining }))
      if (remaining <= 0 && progressTimerRef.current) clearInterval(progressTimerRef.current)
    }, 50)
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }))
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    }, duration)
  }

  const closeToast = () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    setToast(prev => ({ ...prev, show: false }))
  }

  useEffect(() => {
    if (!isAuthenticated || !token) { navigate('/login'); return }
    if (!isAdmin()) { navigate('/dashboard'); return }
  }, [isAuthenticated, token, isAdmin, navigate])

  const loadHistory = useCallback(async (page: number = 1) => {
    try {
      const result = await backupService.getHistory(page, 5)
      setBackups(result.backups)
      setPagination(result.pagination)
    } catch (error: any) {
      console.error('加载备份历史失败:', error)
    }
  }, [])

  const loadData = useCallback(async () => {
    if (!isAuthenticated || !token || !isAdmin()) return
    setLoading(true)
    try {
      const [dbCfg, networkCfg] = await Promise.all([
        backupService.getDatabaseConfig().catch(() => null),
        backupService.getNetworkConfig().catch(() => null)
      ])
      setDbConfig(dbCfg || { enabled: true, auto_backup: true, backup_interval: 24, backup_time: '02:00', retention_days: 30, backup_location: './backup/database', compression: true, pg_host: 'localhost', pg_port: 5432, pg_database: 'mitong', pg_username: 'postgres' })
      setNetworkConfig(networkCfg || { enabled: true, auto_backup: true, backup_interval: 168, backup_time: '03:00', retention_days: 60, backup_location: './backup/network', compression: true })
      await loadHistory(1)
    } catch (error: any) {
      showToast('error', error.message || '加载配置失败', '加载失败')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, token, isAdmin, loadHistory])

  useEffect(() => {
    if (isAuthenticated && token && isAdmin()) loadData()
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    }
  }, [loadData, isAuthenticated, token, isAdmin])

  const handleSave = async () => {
    if (!dbConfig || !networkConfig) return
    setSaving(true)
    try {
      await Promise.all([backupService.saveDatabaseConfig(dbConfig), backupService.saveNetworkConfig(networkConfig)])
      showToast('success', '备份配置已成功保存', '保存成功')
    } catch (error: any) {
      showToast('error', error.message || '保存配置失败', '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const pollTaskStatus = async (taskId: string, type: 'database' | 'network') => {
    let attempts = 0
    const poll = async () => {
      try {
        const status = await backupService.getTaskStatus(taskId)
        if (status.status === 'SUCCESS') {
          setBackingUp(prev => ({ ...prev, [type]: false }))
          showToast('success', `${type === 'database' ? '数据库' : '网络探测'}备份任务已完成`, '备份成功')
          await loadHistory(1)
          return
        }
        if (status.status === 'FAILURE') {
          setBackingUp(prev => ({ ...prev, [type]: false }))
          showToast('error', status.result?.message || '备份失败', '备份失败')
          return
        }
        if (++attempts >= 60) {
          setBackingUp(prev => ({ ...prev, [type]: false }))
          showToast('warning', '备份任务超时，请稍后查看备份历史', '任务超时')
          return
        }
        setTimeout(poll, 2000)
      } catch {
        setBackingUp(prev => ({ ...prev, [type]: false }))
        showToast('error', '获取任务状态失败', '错误')
      }
    }
    poll()
  }

  const handleBackup = async (type: 'database' | 'network') => {
    if (backingUp[type]) return
    setBackingUp(prev => ({ ...prev, [type]: true }))
    showToast('info', `${type === 'database' ? '数据库' : '网络探测'}备份任务已提交`, '任务提交')
    try {
      const result = type === 'database' ? await backupService.executeDbBackup() : await backupService.executeNetworkBackup()
      pollTaskStatus(result.task_id, type)
    } catch (error: any) {
      setBackingUp(prev => ({ ...prev, [type]: false }))
      showToast('error', error.message || '提交备份任务失败', '提交失败')
    }
  }

  const handleDownload = async (backup: BackupRecord) => {
    try {
      const blob = await backupService.downloadBackup(backup.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = backup.filename
      document.body.appendChild(a); a.click()
      window.URL.revokeObjectURL(url); document.body.removeChild(a)
    } catch (error: any) {
      showToast('error', error.message || '下载失败', '下载失败')
    }
  }

  const handleDelete = async (backup: BackupRecord) => {
    setConfirmDialog({
      show: true, title: '删除备份文件', message: `确定要删除备份文件 "${backup.filename}" 吗？此操作不可恢复。`,
      confirmText: '确认删除', cancelText: '取消', type: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }))
        try {
          await backupService.deleteBackup(backup.id)
          setConfirmDialog({ show: false, title: '', message: '' })
          showToast('success', '备份文件已删除', '删除成功')
          await loadHistory(pagination.page)
        } catch (error: any) {
          setConfirmDialog({ show: false, title: '', message: '' })
          showToast('error', error.message || '删除失败', '删除失败')
        }
      }
    })
  }

  if (loading) return <SettingsLoadingState message="正在加载备份设置..." icon={Database} />

  return (
    <SettingsPageLayout title="备份设置" subtitle="分别配置数据库和网络探测数据备份" icon={Database}
      iconGradient="from-violet-500 via-purple-500 to-fuchsia-500" loading={loading} saving={saving}
      onRefresh={loadData} onSave={handleSave}>
      
      {/* 删除确认弹窗 */}
      {confirmDialog.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/60 via-gray-900/50 to-gray-900/60 backdrop-blur-md" onClick={() => !confirmDialog.loading && setConfirmDialog({ show: false, title: '', message: '' })} />
          <div className="relative w-full max-w-sm animate-[dialogPop_0.35s_cubic-bezier(0.34,1.56,0.64,1)]">
            <div className={`rounded-3xl shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              <div className="relative pt-8 pb-4 px-6">
                <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-b from-red-900/30 to-transparent' : 'bg-gradient-to-b from-red-50 to-white'}`} />
                <div className="relative flex justify-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl shadow-lg shadow-red-500/30 flex items-center justify-center transform rotate-3 hover:rotate-0 transition-transform">
                    <Trash2 className="w-10 h-10 text-white" />
                  </div>
                </div>
              </div>
              <div className="px-6 pb-6 text-center">
                <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{confirmDialog.title}</h3>
                <p className={`text-sm leading-relaxed mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{confirmDialog.message}</p>
                <div className="flex space-x-3">
                  <button onClick={() => setConfirmDialog({ show: false, title: '', message: '' })} disabled={confirmDialog.loading}
                    className={`flex-1 px-4 py-3 text-sm font-semibold rounded-xl active:scale-95 transition-all disabled:opacity-50 ${isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {confirmDialog.cancelText || '取消'}
                  </button>
                  <button onClick={confirmDialog.onConfirm} disabled={confirmDialog.loading}
                    className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-600 rounded-xl hover:from-red-600 hover:to-rose-700 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-red-500/30 flex items-center justify-center">
                    {confirmDialog.loading ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />删除中...</> : <><Trash2 className="w-4 h-4 mr-2" />{confirmDialog.confirmText || '确认删除'}</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast 提示框 */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-50 min-w-[320px] max-w-md animate-[toastSlideIn_0.4s_cubic-bezier(0.21,1.02,0.73,1)_forwards]">
          <div className={`relative overflow-hidden rounded-2xl shadow-2xl backdrop-blur-sm ${
            toast.type === 'success' ? 'bg-gradient-to-br from-emerald-500 to-green-600' 
            : toast.type === 'error' ? 'bg-gradient-to-br from-red-500 to-rose-600' 
            : toast.type === 'warning' ? 'bg-gradient-to-br from-amber-500 to-orange-600' 
            : 'bg-gradient-to-br from-blue-500 to-indigo-600'
          }`}>
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-white rounded-full blur-2xl" />
            </div>
            <div className="relative px-5 py-4 flex items-start space-x-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-white/20">
                {toast.type === 'success' && <CheckCircle className="w-6 h-6 text-white" />}
                {toast.type === 'error' && <XCircle className="w-6 h-6 text-white" />}
                {toast.type === 'warning' && <AlertTriangle className="w-6 h-6 text-white" />}
                {toast.type === 'info' && <Info className="w-6 h-6 text-white" />}
              </div>
              <div className="flex-1 pt-0.5">
                {toast.title && <p className="text-white font-semibold text-base mb-0.5">{toast.title}</p>}
                <p className="text-white/90 text-sm leading-relaxed">{toast.message}</p>
              </div>
              <button onClick={closeToast} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                <XCircle className="w-5 h-5 text-white/80 hover:text-white" />
              </button>
            </div>
            <div className="h-1 bg-black/10"><div className="h-full bg-white/40 transition-all duration-100 ease-linear" style={{ width: `${toast.progress}%` }} /></div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes toastSlideIn { 0% { transform: translateX(120%) scale(0.9); opacity: 0; } 100% { transform: translateX(0) scale(1); opacity: 1; } }
        @keyframes dialogPop { 0% { transform: scale(0.8) translateY(20px); opacity: 0; } 50% { transform: scale(1.02) translateY(-5px); } 100% { transform: scale(1) translateY(0); opacity: 1; } }
      `}</style>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <SettingsStatCard title="数据库备份" value={backups.filter(b => b.category === 'database').length} subtitle="备份文件数" icon={Database} variant="info" valueColorClass="text-blue-500" iconColorClass="text-blue-400" glowColor="bg-blue-500" />
        <SettingsStatCard title="网络探测备份" value={backups.filter(b => b.category === 'network').length} subtitle="备份文件数" icon={Network} variant="success" valueColorClass="text-emerald-500" iconColorClass="text-emerald-400" glowColor="bg-emerald-500" />
        <SettingsStatCard title="总备份数" value={pagination.total} subtitle="所有备份记录" icon={FileText} glowColor="bg-purple-500" />
        <SettingsStatCard title="成功率" value={backups.length > 0 ? `${Math.round((backups.filter(b => b.status === 'success').length / backups.length) * 100)}%` : '100%'} subtitle="备份成功率" icon={CheckCircle} variant="success" valueColorClass="text-emerald-500" iconColorClass="text-emerald-400" glowColor="bg-emerald-500" />
      </div>

      {/* 配置卡片 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 数据库备份配置 */}
        {dbConfig && (
          <SettingsCard title="PostgreSQL 数据库备份" icon={Database} iconColorClass={isDark ? 'text-blue-400' : 'text-blue-500'}
            headerActions={
              <div className="flex items-center space-x-3">
                <button onClick={() => handleBackup('database')} disabled={backingUp.database}
                  className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm rounded-lg hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 flex items-center shadow-lg shadow-blue-500/30">
                  {backingUp.database && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}{backingUp.database ? '备份中...' : '立即备份'}
                </button>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={dbConfig.enabled} onChange={e => setDbConfig({...dbConfig, enabled: e.target.checked})} className="sr-only peer" />
                  <div className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm peer-checked:bg-gradient-to-r peer-checked:from-blue-500 peer-checked:to-cyan-500 ${isDark ? 'bg-slate-600' : 'bg-gray-300'}`}></div>
                </label>
              </div>
            }>
            {dbConfig.enabled && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormInput label="主机地址" value={dbConfig.pg_host} onChange={() => {}} readOnly hint="从配置文件读取" />
                  <FormInput label="端口" value={dbConfig.pg_port} onChange={() => {}} readOnly hint="从配置文件读取" />
                  <FormInput label="数据库名" value={dbConfig.pg_database} onChange={() => {}} readOnly />
                  <FormInput label="用户名" value={dbConfig.pg_username} onChange={() => {}} readOnly />
                </div>
                <div className={`p-3 rounded-xl text-sm ${isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>💡 数据库连接配置从 config/database.yaml 读取</div>
                <div className={`pt-4 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                  <FormSwitch label="自动备份" description="按计划自动执行备份" checked={dbConfig.auto_backup} onChange={v => setDbConfig({...dbConfig, auto_backup: v})} />
                  {dbConfig.auto_backup && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <FormSelect label="备份间隔" value={dbConfig.backup_interval} onChange={v => setDbConfig({...dbConfig, backup_interval: +v})} options={[{value: 6, label: '每 6 小时'}, {value: 12, label: '每 12 小时'}, {value: 24, label: '每天'}, {value: 168, label: '每周'}]} />
                      <FormInput label="备份时间" type="time" value={dbConfig.backup_time} onChange={v => setDbConfig({...dbConfig, backup_time: v})} />
                      <FormInput label="保留天数" type="number" value={dbConfig.retention_days} onChange={v => setDbConfig({...dbConfig, retention_days: +v})} />
                      <FormInput label="备份目录" value={dbConfig.backup_location} onChange={v => setDbConfig({...dbConfig, backup_location: v})} />
                    </div>
                  )}
                </div>
                <FormCheckbox label="启用 gzip 压缩" checked={dbConfig.compression} onChange={v => setDbConfig({...dbConfig, compression: v})} />
              </div>
            )}
          </SettingsCard>
        )}

        {/* 网络探测备份配置 */}
        {networkConfig && (
          <SettingsCard title="网络探测数据备份" icon={Network} iconColorClass={isDark ? 'text-emerald-400' : 'text-emerald-500'}
            headerActions={
              <div className="flex items-center space-x-3">
                <button onClick={() => handleBackup('network')} disabled={backingUp.network}
                  className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-sm rounded-lg hover:from-emerald-600 hover:to-green-600 disabled:opacity-50 flex items-center shadow-lg shadow-emerald-500/30">
                  {backingUp.network && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}{backingUp.network ? '备份中...' : '立即备份'}
                </button>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={networkConfig.enabled} onChange={e => setNetworkConfig({...networkConfig, enabled: e.target.checked})} className="sr-only peer" />
                  <div className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm peer-checked:bg-gradient-to-r peer-checked:from-emerald-500 peer-checked:to-green-500 ${isDark ? 'bg-slate-600' : 'bg-gray-300'}`}></div>
                </label>
              </div>
            }>
            {networkConfig.enabled && (
              <div className="space-y-4">
                <FormSwitch label="自动备份" description="按计划自动执行备份" checked={networkConfig.auto_backup} onChange={v => setNetworkConfig({...networkConfig, auto_backup: v})} />
                {networkConfig.auto_backup && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormSelect label="备份间隔" value={networkConfig.backup_interval} onChange={v => setNetworkConfig({...networkConfig, backup_interval: +v})} options={[{value: 24, label: '每天'}, {value: 168, label: '每周'}, {value: 720, label: '每月'}]} />
                    <FormInput label="备份时间" type="time" value={networkConfig.backup_time} onChange={v => setNetworkConfig({...networkConfig, backup_time: v})} />
                    <FormInput label="保留天数" type="number" value={networkConfig.retention_days} onChange={v => setNetworkConfig({...networkConfig, retention_days: +v})} />
                    <FormInput label="备份目录" value={networkConfig.backup_location} onChange={v => setNetworkConfig({...networkConfig, backup_location: v})} />
                  </div>
                )}
                <FormCheckbox label="启用压缩" checked={networkConfig.compression} onChange={v => setNetworkConfig({...networkConfig, compression: v})} />
              </div>
            )}
          </SettingsCard>
        )}
      </div>

      {/* 备份历史 */}
      <SettingsCard title="备份历史" icon={FileText} iconColorClass={isDark ? 'text-violet-400' : 'text-violet-500'}
        headerActions={
          <div className="flex space-x-2">
            <span className={`px-3 py-1 text-sm rounded-full ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>数据库 {backups.filter(b => b.category === 'database').length}</span>
            <span className={`px-3 py-1 text-sm rounded-full ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>网络探测 {backups.filter(b => b.category === 'network').length}</span>
          </div>
        } noPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={isDark ? 'bg-slate-700/50' : 'bg-gray-50'}>
              <tr>
                {['文件名', '类型', '大小', '状态', '时间', '操作'].map(h => (
                  <th key={h} className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-gray-100'}`}>
              {backups.map(b => (
                <tr key={b.id} className={`transition-colors ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'}`}>
                  <td className="px-6 py-4">
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{b.filename}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${b.type === 'auto' ? (isDark ? 'bg-slate-600 text-gray-300' : 'bg-gray-100 text-gray-600') : (isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700')}`}>{b.type === 'auto' ? '自动' : '手动'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-sm ${b.category === 'database' ? (isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700') : (isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700')}`}>
                      {b.category === 'database' ? '数据库' : '网络探测'}
                    </span>
                  </td>
                  <td className={`px-6 py-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{b.size}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs ${b.status === 'success' ? (isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700') : (isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700')}`}>
                      {b.status === 'success' ? '成功' : '失败'}
                    </span>
                  </td>
                  <td className={`px-6 py-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatDateTime(b.created_at, 'YYYY/MM/DD HH:mm')}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-1">
                      <button onClick={() => handleDownload(b)} disabled={b.status !== 'success'} title="下载"
                        className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${isDark ? 'text-blue-400 hover:bg-blue-500/20' : 'text-blue-600 hover:bg-blue-50'}`}>
                        <Download className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(b)} title="删除"
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-600 hover:bg-red-50'}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {backups.length === 0 && (
          <div className="text-center py-12">
            <Database className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
            <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>暂无备份记录</p>
          </div>
        )}

        {/* 分页 */}
        {pagination.pages > 1 && (
          <div className={`px-6 py-4 border-t flex items-center justify-between ${isDark ? 'border-slate-700/50' : 'border-gray-100'}`}>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>第 {pagination.page} 页，共 {pagination.pages} 页</div>
            <div className="flex items-center space-x-2">
              <button onClick={() => loadHistory(pagination.page - 1)} disabled={!pagination.has_prev}
                className={`px-3 py-1.5 rounded-lg flex items-center disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'border border-gray-200 hover:bg-gray-50'}`}>
                <ChevronLeft className="w-4 h-4 mr-1" />上一页
              </button>
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(page => (
                <button key={page} onClick={() => loadHistory(page)}
                  className={`w-8 h-8 rounded-lg ${page === pagination.page ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' : (isDark ? 'hover:bg-slate-700 text-gray-300' : 'hover:bg-gray-100')}`}>
                  {page}
                </button>
              ))}
              <button onClick={() => loadHistory(pagination.page + 1)} disabled={!pagination.has_next}
                className={`px-3 py-1.5 rounded-lg flex items-center disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'border border-gray-200 hover:bg-gray-50'}`}>
                下一页<ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}
      </SettingsCard>
    </SettingsPageLayout>
  )
}
