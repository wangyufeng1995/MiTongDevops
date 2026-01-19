/**
 * 全局命令过滤配置页面 - 美化版
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Shield, Save, Plus, Trash2, AlertTriangle, CheckCircle, Info, X, RotateCcw, List, Ban, Globe, Server } from 'lucide-react'
import { Modal } from '../../components/Modal'
import { hostAuditService } from '../../services/hostAudit'
import { useAuthStore } from '../../store/auth'
import { useTheme } from '../../hooks/useTheme'
import { MonitorPageLayout, MonitorStatCard, MonitorContentCard } from '../../components/Monitor/MonitorPageLayout'
import type { FilterMode } from '../../types/audit'

interface GlobalCommandFilterState {
  mode: FilterMode
  whitelist: string[]
  blacklist: string[]
  isActive: boolean
  loading: boolean
  saving: boolean
  error: string | null
  isDirty: boolean
  newWhitelistCommand: string
  newBlacklistCommand: string
  defaultBlacklist: string[]
  showResetModal: boolean
  toast: { show: boolean; type: 'success' | 'error' | 'warning' | 'info'; message: string }
}

export const GlobalCommandFilter: React.FC = () => {
  const { hasPermission } = useAuthStore()
  const { isDark } = useTheme()

  const [state, setState] = useState<GlobalCommandFilterState>({
    mode: 'blacklist', whitelist: [], blacklist: [], isActive: false,
    loading: true, saving: false, error: null, isDirty: false,
    newWhitelistCommand: '', newBlacklistCommand: '', defaultBlacklist: [],
    showResetModal: false, toast: { show: false, type: 'info', message: '' }
  })

  const showToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setState(prev => ({ ...prev, toast: { show: true, type, message } }))
    setTimeout(() => setState(prev => ({ ...prev, toast: { ...prev.toast, show: false } })), 3000)
  }, [])

  const loadGlobalRules = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      const response = await hostAuditService.getGlobalFilterRules()
      setState(prev => ({
        ...prev, mode: response.rules?.mode || 'blacklist',
        whitelist: response.rules?.whitelist || [], blacklist: response.rules?.blacklist || [],
        isActive: response.rules?.is_active ?? false, loading: false, isDirty: false
      }))
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message || '加载全局过滤规则失败', loading: false }))
    }
  }, [])

  const loadDefaultBlacklist = useCallback(async () => {
    try {
      const blacklist = await hostAuditService.getDefaultBlacklist()
      setState(prev => ({ ...prev, defaultBlacklist: blacklist }))
    } catch (error: any) {}
  }, [])

  useEffect(() => { loadGlobalRules(); loadDefaultBlacklist() }, [])

  const handleModeChange = (newMode: FilterMode) => setState(prev => ({ ...prev, mode: newMode, isDirty: true }))

  const handleAddCommand = (type: 'whitelist' | 'blacklist') => {
    const cmd = type === 'whitelist' ? state.newWhitelistCommand.trim() : state.newBlacklistCommand.trim()
    if (!cmd) return
    const list = type === 'whitelist' ? state.whitelist : state.blacklist
    if (list.includes(cmd)) { showToast('warning', '该命令已存在'); return }
    setState(prev => ({
      ...prev,
      [type]: [...prev[type], cmd],
      [type === 'whitelist' ? 'newWhitelistCommand' : 'newBlacklistCommand']: '',
      isDirty: true
    }))
  }

  const handleRemoveCommand = (type: 'whitelist' | 'blacklist', cmd: string) => {
    setState(prev => ({ ...prev, [type]: prev[type].filter(c => c !== cmd), isDirty: true }))
  }

  const handleSave = async () => {
    try {
      setState(prev => ({ ...prev, saving: true }))
      await hostAuditService.setGlobalFilterRules({ mode: state.mode, whitelist: state.whitelist, blacklist: state.blacklist })
      setState(prev => ({ ...prev, saving: false, isDirty: false, isActive: true }))
      showToast('success', '全局命令过滤规则保存成功')
    } catch (error: any) {
      setState(prev => ({ ...prev, saving: false }))
      showToast('error', error.message || '保存失败')
    }
  }

  const handleResetToDefault = () => {
    setState(prev => ({ ...prev, blacklist: [...prev.defaultBlacklist], showResetModal: false, isDirty: true }))
    showToast('info', '已重置为默认黑名单')
  }

  const handleKeyPress = (e: React.KeyboardEvent, type: 'whitelist' | 'blacklist') => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddCommand(type) }
  }

  const headerActions = hasPermission('host:audit:config') ? (
    <button onClick={handleSave} disabled={state.saving || !state.isDirty}
      className={`group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium overflow-hidden transition-all ${state.saving || !state.isDirty ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <Save className="relative w-4 h-4" /><span className="relative">{state.saving ? '保存中...' : '保存配置'}</span>
    </button>
  ) : null

  const inputClass = `flex-1 px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`

  return (
    <MonitorPageLayout title="全局命令过滤配置" subtitle="配置全局命令过滤规则，所有主机统一执行" icon={Globe}
      iconGradient="from-blue-500 via-indigo-500 to-purple-500" headerActions={headerActions}
      loading={state.loading} onRefresh={loadGlobalRules} showFullscreen={false}>
      
      {/* Toast */}
      {state.toast.show && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`px-4 py-3 rounded-xl shadow-xl border flex items-center space-x-3 ${
            state.toast.type === 'success' ? (isDark ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800') :
            state.toast.type === 'error' ? (isDark ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-800') :
            state.toast.type === 'warning' ? (isDark ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800') :
            (isDark ? 'bg-blue-500/20 border-blue-500/30 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-800')
          }`}>
            {state.toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {state.toast.type === 'error' && <X className="w-5 h-5" />}
            {state.toast.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
            {state.toast.type === 'info' && <Info className="w-5 h-5" />}
            <span className="text-sm font-medium">{state.toast.message}</span>
          </div>
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <MonitorStatCard title="当前模式" value={state.mode === 'blacklist' ? '黑名单' : '白名单'} subtitle={state.mode === 'blacklist' ? '禁止特定命令' : '只允许特定命令'}
          icon={state.mode === 'blacklist' ? Ban : List} iconColorClass={state.mode === 'blacklist' ? 'text-red-400' : 'text-emerald-400'} glowColor={state.mode === 'blacklist' ? 'bg-red-500' : 'bg-emerald-500'} />
        <MonitorStatCard title="白名单命令" value={state.whitelist.length} subtitle="允许执行的命令" icon={List} iconColorClass="text-emerald-400" glowColor="bg-emerald-500" />
        <MonitorStatCard title="黑名单命令" value={state.blacklist.length} subtitle="禁止执行的命令" icon={Ban} iconColorClass="text-red-400" glowColor="bg-red-500" />
        <MonitorStatCard title="规则状态" value={state.isActive ? '已启用' : '未启用'} subtitle="全局过滤规则状态"
          icon={Shield} variant={state.isActive ? 'success' : 'default'} iconColorClass={state.isActive ? 'text-emerald-400' : 'text-gray-400'} glowColor={state.isActive ? 'bg-emerald-500' : 'bg-gray-500'} />
      </div>

      {/* 全局规则说明 */}
      <div className={`mb-6 p-4 rounded-xl border ${isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
        <div className="flex items-start space-x-3">
          <Globe className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          <div>
            <p className={`text-sm font-semibold ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>全局命令过滤规则</p>
            <p className={`mt-1 text-sm ${isDark ? 'text-blue-300/80' : 'text-blue-700'}`}>
              此规则将应用于所有主机的 WebShell 终端。规则配置会持久化保存到数据库，重启服务后依然生效。
            </p>
            <div className="mt-3 flex items-center space-x-4 text-sm">
              <div className={`flex items-center ${isDark ? 'text-blue-300' : 'text-blue-700'}`}><Server className="w-4 h-4 mr-1" /><span>适用于所有主机</span></div>
              <div className={`flex items-center ${isDark ? 'text-blue-300' : 'text-blue-700'}`}><Shield className="w-4 h-4 mr-1" /><span>实时生效</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {state.error && <div className={`mb-6 p-4 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>{state.error}</div>}

      {/* 模式选择 */}
      <MonitorContentCard title="过滤模式" icon={Shield} className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div onClick={() => handleModeChange('blacklist')}
            className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${state.mode === 'blacklist' ? (isDark ? 'border-red-500 bg-red-500/10' : 'border-red-500 bg-red-50') : (isDark ? 'border-slate-600 hover:border-slate-500' : 'border-gray-200 hover:border-gray-300')}`}>
            <div className="flex items-center mb-2">
              <Ban className={`w-5 h-5 mr-2 ${state.mode === 'blacklist' ? 'text-red-500' : (isDark ? 'text-gray-400' : 'text-gray-500')}`} />
              <span className={`font-semibold ${state.mode === 'blacklist' ? (isDark ? 'text-red-300' : 'text-red-700') : (isDark ? 'text-gray-300' : 'text-gray-700')}`}>黑名单模式</span>
              {state.mode === 'blacklist' && <CheckCircle className="w-4 h-4 ml-auto text-red-500" />}
            </div>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>允许执行所有命令，除了黑名单中的命令</p>
          </div>
          <div onClick={() => handleModeChange('whitelist')}
            className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${state.mode === 'whitelist' ? (isDark ? 'border-emerald-500 bg-emerald-500/10' : 'border-emerald-500 bg-emerald-50') : (isDark ? 'border-slate-600 hover:border-slate-500' : 'border-gray-200 hover:border-gray-300')}`}>
            <div className="flex items-center mb-2">
              <List className={`w-5 h-5 mr-2 ${state.mode === 'whitelist' ? 'text-emerald-500' : (isDark ? 'text-gray-400' : 'text-gray-500')}`} />
              <span className={`font-semibold ${state.mode === 'whitelist' ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : (isDark ? 'text-gray-300' : 'text-gray-700')}`}>白名单模式</span>
              {state.mode === 'whitelist' && <CheckCircle className="w-4 h-4 ml-auto text-emerald-500" />}
            </div>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>只允许执行白名单中的命令，其他命令全部禁止</p>
          </div>
        </div>
        {state.mode === 'whitelist' && (
          <div className={`mt-4 p-3 rounded-xl ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
            <div className="flex items-start">
              <AlertTriangle className={`w-5 h-5 mr-2 mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
              <p className={`text-sm ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>白名单模式更加严格，只有明确允许的命令才能执行。请确保添加了必要的基础命令（如 ls, cd, cat 等）。</p>
            </div>
          </div>
        )}
      </MonitorContentCard>

      {/* 命令列表配置 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 白名单 */}
        <MonitorContentCard title={`白名单命令 (${state.whitelist.length})`} icon={List}>
          <div className="flex space-x-2 mb-4">
            <input type="text" value={state.newWhitelistCommand} onChange={(e) => setState(prev => ({ ...prev, newWhitelistCommand: e.target.value }))}
              onKeyPress={(e) => handleKeyPress(e, 'whitelist')} placeholder="输入命令，如 ls, cat, pwd" className={inputClass} />
            <button onClick={() => handleAddCommand('whitelist')} disabled={!state.newWhitelistCommand.trim()}
              className={`px-4 py-2.5 rounded-xl font-medium transition-all ${isDark ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'} disabled:opacity-50`}>
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {state.whitelist.length === 0 ? (
              <p className={`text-sm text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>暂无白名单命令</p>
            ) : state.whitelist.map((cmd, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-xl group ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                <code className={`text-sm font-mono ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>{cmd}</code>
                <button onClick={() => handleRemoveCommand('whitelist', cmd)} className={`opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-gray-400 hover:text-red-400' : 'text-gray-500 hover:text-red-500'}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </MonitorContentCard>

        {/* 黑名单 */}
        <MonitorContentCard title={`黑名单命令 (${state.blacklist.length})`} icon={Ban}
          headerActions={<button onClick={() => setState(prev => ({ ...prev, showResetModal: true }))} className={`text-sm flex items-center ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}><RotateCcw className="w-4 h-4 mr-1" />重置为默认</button>}>
          <div className="flex space-x-2 mb-4">
            <input type="text" value={state.newBlacklistCommand} onChange={(e) => setState(prev => ({ ...prev, newBlacklistCommand: e.target.value }))}
              onKeyPress={(e) => handleKeyPress(e, 'blacklist')} placeholder="输入命令，如 rm, reboot, shutdown" className={inputClass} />
            <button onClick={() => handleAddCommand('blacklist')} disabled={!state.newBlacklistCommand.trim()}
              className={`px-4 py-2.5 rounded-xl font-medium transition-all ${isDark ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-100 text-red-700 hover:bg-red-200'} disabled:opacity-50`}>
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {state.blacklist.length === 0 ? (
              <p className={`text-sm text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>暂无黑名单命令</p>
            ) : state.blacklist.map((cmd, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-xl group ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                <code className={`text-sm font-mono ${isDark ? 'text-red-300' : 'text-red-800'}`}>{cmd}</code>
                <button onClick={() => handleRemoveCommand('blacklist', cmd)} className={`opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-gray-400 hover:text-red-400' : 'text-gray-500 hover:text-red-500'}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </MonitorContentCard>
      </div>

      {/* 通配符说明 */}
      <MonitorContentCard title="通配符说明" icon={Info}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
            <code className={`font-mono ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>rm*</code>
            <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>匹配以 rm 开头的所有命令，如 rm, rmdir</p>
          </div>
          <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
            <code className={`font-mono ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>*delete*</code>
            <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>匹配包含 delete 的所有命令</p>
          </div>
          <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
            <code className={`font-mono ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>chmod 777</code>
            <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>精确匹配 chmod 777 命令</p>
          </div>
          <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
            <code className={`font-mono ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>mkfs.*</code>
            <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>匹配 mkfs.ext4, mkfs.xfs 等命令</p>
          </div>
        </div>
      </MonitorContentCard>

      {/* 重置确认对话框 */}
      <Modal isOpen={state.showResetModal} onClose={() => setState(prev => ({ ...prev, showResetModal: false }))} title="重置为默认黑名单" size="sm"
        footer={<div className="flex justify-end space-x-3">
          <button onClick={() => setState(prev => ({ ...prev, showResetModal: false }))} className={`px-4 py-2 rounded-xl font-medium ${isDark ? 'bg-slate-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>取消</button>
          <button onClick={handleResetToDefault} className="px-4 py-2 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700">确认重置</button>
        </div>}>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>此操作将用系统默认黑名单替换当前黑名单配置。默认黑名单包含 {state.defaultBlacklist.length} 个危险命令。</p>
      </Modal>
    </MonitorPageLayout>
  )
}

export default GlobalCommandFilter