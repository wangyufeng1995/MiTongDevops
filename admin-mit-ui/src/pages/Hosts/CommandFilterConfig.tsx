/**
 * 命令过滤配置组件
 * Requirements: 7.1, 7.5
 * 
 * 提供白名单/黑名单命令过滤规则的配置界面
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Shield,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  RotateCcw,
  List,
  Ban
} from 'lucide-react'
import { Loading } from '../../components/Loading'
import { Modal } from '../../components/Modal'
import { hostAuditService } from '../../services/hostAudit'
import { hostsService } from '../../services/hosts'
import { useAuthStore } from '../../store/auth'
import type { FilterMode, CommandFilterRule } from '../../types/audit'
import type { Host } from '../../types/host'

interface CommandFilterConfigState {
  host: Host | null
  hostLoading: boolean
  // 规则数据
  mode: FilterMode
  whitelist: string[]
  blacklist: string[]
  isGlobal: boolean
  hasHostRules: boolean
  // 加载状态
  loading: boolean
  saving: boolean
  error: string | null
  // 编辑状态
  isDirty: boolean
  // 新命令输入
  newWhitelistCommand: string
  newBlacklistCommand: string
  // 默认黑名单
  defaultBlacklist: string[]
  // 确认对话框
  showResetModal: boolean
  showDeleteModal: boolean
  // Toast 消息
  toast: {
    show: boolean
    type: 'success' | 'error' | 'warning' | 'info'
    message: string
  }
}

export const CommandFilterConfig: React.FC = () => {
  const { hostId } = useParams<{ hostId: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  
  const numericHostId = hostId ? parseInt(hostId, 10) : 0

  const [state, setState] = useState<CommandFilterConfigState>({
    host: null,
    hostLoading: true,
    mode: 'blacklist',
    whitelist: [],
    blacklist: [],
    isGlobal: true,
    hasHostRules: false,
    loading: true,
    saving: false,
    error: null,
    isDirty: false,
    newWhitelistCommand: '',
    newBlacklistCommand: '',
    defaultBlacklist: [],
    showResetModal: false,
    showDeleteModal: false,
    toast: { show: false, type: 'info', message: '' }
  })

  // 显示消息提示
  const showToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setState(prev => ({ ...prev, toast: { show: true, type, message } }))
    setTimeout(() => {
      setState(prev => ({ ...prev, toast: { ...prev.toast, show: false } }))
    }, 3000)
  }, [])


  // 加载主机信息
  const loadHost = useCallback(async () => {
    if (!numericHostId) return
    try {
      setState(prev => ({ ...prev, hostLoading: true }))
      const host = await hostsService.getHost(numericHostId)
      setState(prev => ({ ...prev, host, hostLoading: false }))
    } catch (error: any) {
      console.error('加载主机信息失败:', error.message)
      setState(prev => ({ ...prev, hostLoading: false }))
    }
  }, [numericHostId])

  // 加载过滤规则
  const loadFilterRules = useCallback(async () => {
    if (!numericHostId) return
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      const response = await hostAuditService.getHostFilterRules(numericHostId)
      setState(prev => ({
        ...prev,
        mode: response.rules?.mode || 'blacklist',
        whitelist: response.rules?.whitelist || [],
        blacklist: response.rules?.blacklist || [],
        isGlobal: response.is_global,
        hasHostRules: response.has_host_rules,
        loading: false,
        isDirty: false
      }))
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || '加载过滤规则失败',
        loading: false
      }))
    }
  }, [numericHostId])

  // 加载默认黑名单
  const loadDefaultBlacklist = useCallback(async () => {
    try {
      const blacklist = await hostAuditService.getDefaultBlacklist()
      setState(prev => ({ ...prev, defaultBlacklist: blacklist }))
    } catch (error: any) {
      console.error('加载默认黑名单失败:', error.message)
    }
  }, [])


  // 初始加载
  useEffect(() => {
    loadHost()
    loadFilterRules()
    loadDefaultBlacklist()
  }, [numericHostId])

  // 切换模式
  const handleModeChange = (newMode: FilterMode) => {
    setState(prev => ({ ...prev, mode: newMode, isDirty: true }))
  }

  // 添加白名单命令
  const handleAddWhitelistCommand = () => {
    const cmd = state.newWhitelistCommand.trim()
    if (!cmd) return
    if (state.whitelist.includes(cmd)) {
      showToast('warning', '该命令已在白名单中')
      return
    }
    setState(prev => ({
      ...prev,
      whitelist: [...prev.whitelist, cmd],
      newWhitelistCommand: '',
      isDirty: true
    }))
  }

  // 添加黑名单命令
  const handleAddBlacklistCommand = () => {
    const cmd = state.newBlacklistCommand.trim()
    if (!cmd) return
    if (state.blacklist.includes(cmd)) {
      showToast('warning', '该命令已在黑名单中')
      return
    }
    setState(prev => ({
      ...prev,
      blacklist: [...prev.blacklist, cmd],
      newBlacklistCommand: '',
      isDirty: true
    }))
  }

  // 移除白名单命令
  const handleRemoveWhitelistCommand = (cmd: string) => {
    setState(prev => ({
      ...prev,
      whitelist: prev.whitelist.filter(c => c !== cmd),
      isDirty: true
    }))
  }

  // 移除黑名单命令
  const handleRemoveBlacklistCommand = (cmd: string) => {
    setState(prev => ({
      ...prev,
      blacklist: prev.blacklist.filter(c => c !== cmd),
      isDirty: true
    }))
  }


  // 保存规则
  const handleSave = async () => {
    if (!numericHostId) return
    try {
      setState(prev => ({ ...prev, saving: true }))
      await hostAuditService.setHostFilterRules(numericHostId, {
        mode: state.mode,
        whitelist: state.whitelist,
        blacklist: state.blacklist
      })
      setState(prev => ({ ...prev, saving: false, isDirty: false, hasHostRules: true, isGlobal: false }))
      showToast('success', '命令过滤规则保存成功')
    } catch (error: any) {
      setState(prev => ({ ...prev, saving: false }))
      showToast('error', error.message || '保存失败')
    }
  }

  // 重置为默认黑名单
  const handleResetToDefault = () => {
    setState(prev => ({
      ...prev,
      blacklist: [...prev.defaultBlacklist],
      showResetModal: false,
      isDirty: true
    }))
    showToast('info', '已重置为默认黑名单')
  }

  // 删除主机规则（回退到全局）
  const handleDeleteHostRules = async () => {
    if (!numericHostId) return
    try {
      setState(prev => ({ ...prev, saving: true }))
      await hostAuditService.deleteHostFilterRules(numericHostId)
      setState(prev => ({ ...prev, showDeleteModal: false, saving: false }))
      showToast('success', '已删除主机规则，将使用全局规则')
      loadFilterRules()
    } catch (error: any) {
      setState(prev => ({ ...prev, saving: false }))
      showToast('error', error.message || '删除失败')
    }
  }

  // 处理键盘事件
  const handleKeyPress = (e: React.KeyboardEvent, type: 'whitelist' | 'blacklist') => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (type === 'whitelist') {
        handleAddWhitelistCommand()
      } else {
        handleAddBlacklistCommand()
      }
    }
  }


  if (state.hostLoading || state.loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loading size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Toast 消息提示 */}
      {state.toast.show && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-top-2 fade-in duration-300">
          <div className={`px-4 py-3 rounded-lg shadow-xl border flex items-start space-x-3 ${
            state.toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
            state.toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
            state.toast.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{state.toast.message}</p>
            </div>
            <button 
              onClick={() => setState(prev => ({ ...prev, toast: { ...prev.toast, show: false } }))}
              className="flex-shrink-0 p-1 rounded hover:bg-opacity-20 transition-colors"
            >
              <X className="w-4 h-4 opacity-60 hover:opacity-100" />
            </button>
          </div>
        </div>
      )}

      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
              <Shield className="w-6 h-6 mr-2 text-blue-500" />
              命令过滤配置
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {state.host?.name} ({state.host?.hostname})
            </p>
          </div>
        </div>

        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => loadFilterRules()}
            disabled={state.loading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${state.loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          
          {hasPermission('host:audit:config') && (
            <button
              onClick={handleSave}
              disabled={state.saving || !state.isDirty}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4 mr-2" />
              {state.saving ? '保存中...' : '保存配置'}
            </button>
          )}
        </div>
      </div>

      {/* 规则来源提示 */}
      <div className={`p-4 rounded-lg border ${
        state.isGlobal ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
      }`}>
        <div className="flex items-start">
          <Info className={`w-5 h-5 mr-3 mt-0.5 ${state.isGlobal ? 'text-blue-500' : 'text-green-500'}`} />
          <div>
            <p className={`text-sm font-medium ${state.isGlobal ? 'text-blue-800' : 'text-green-800'}`}>
              {state.isGlobal ? '当前使用全局规则' : '当前使用主机专属规则'}
            </p>
            <p className={`text-sm mt-1 ${state.isGlobal ? 'text-blue-600' : 'text-green-600'}`}>
              {state.isGlobal 
                ? '此主机没有专属规则，正在使用系统全局规则。保存后将创建主机专属规则。'
                : '此主机有专属规则，优先于全局规则生效。'}
            </p>
            {state.hasHostRules && (
              <button
                onClick={() => setState(prev => ({ ...prev, showDeleteModal: true }))}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                删除主机规则，回退到全局规则
              </button>
            )}
          </div>
        </div>
      </div>


      {/* 错误提示 */}
      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-sm text-red-600">{state.error}</div>
        </div>
      )}

      {/* 模式选择 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">过滤模式</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 黑名单模式 */}
          <div
            onClick={() => handleModeChange('blacklist')}
            className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
              state.mode === 'blacklist'
                ? 'border-red-500 bg-red-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center mb-2">
              <Ban className={`w-5 h-5 mr-2 ${state.mode === 'blacklist' ? 'text-red-500' : 'text-gray-400'}`} />
              <span className={`font-medium ${state.mode === 'blacklist' ? 'text-red-700' : 'text-gray-700'}`}>
                黑名单模式
              </span>
              {state.mode === 'blacklist' && (
                <CheckCircle className="w-4 h-4 ml-auto text-red-500" />
              )}
            </div>
            <p className="text-sm text-gray-500">
              允许执行所有命令，除了黑名单中的命令
            </p>
          </div>
          
          {/* 白名单模式 */}
          <div
            onClick={() => handleModeChange('whitelist')}
            className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
              state.mode === 'whitelist'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center mb-2">
              <List className={`w-5 h-5 mr-2 ${state.mode === 'whitelist' ? 'text-green-500' : 'text-gray-400'}`} />
              <span className={`font-medium ${state.mode === 'whitelist' ? 'text-green-700' : 'text-gray-700'}`}>
                白名单模式
              </span>
              {state.mode === 'whitelist' && (
                <CheckCircle className="w-4 h-4 ml-auto text-green-500" />
              )}
            </div>
            <p className="text-sm text-gray-500">
              只允许执行白名单中的命令，其他命令全部禁止
            </p>
          </div>
        </div>
        
        {state.mode === 'whitelist' && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2 mt-0.5" />
              <p className="text-sm text-yellow-700">
                白名单模式更加严格，只有明确允许的命令才能执行。请确保添加了必要的基础命令。
              </p>
            </div>
          </div>
        )}
      </div>


      {/* 命令列表配置 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 白名单配置 */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <List className="w-5 h-5 mr-2 text-green-500" />
              白名单命令
              <span className="ml-2 text-sm text-gray-500">({state.whitelist.length})</span>
            </h2>
          </div>
          <div className="p-6">
            {/* 添加命令输入 */}
            <div className="flex space-x-2 mb-4">
              <input
                type="text"
                value={state.newWhitelistCommand}
                onChange={(e) => setState(prev => ({ ...prev, newWhitelistCommand: e.target.value }))}
                onKeyPress={(e) => handleKeyPress(e, 'whitelist')}
                placeholder="输入命令，如 ls, cat, pwd"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <button
                onClick={handleAddWhitelistCommand}
                disabled={!state.newWhitelistCommand.trim()}
                className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            
            {/* 命令列表 */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {state.whitelist.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  暂无白名单命令
                </p>
              ) : (
                state.whitelist.map((cmd, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-3 py-2 bg-green-50 rounded-md group"
                  >
                    <code className="text-sm font-mono text-green-800">{cmd}</code>
                    <button
                      onClick={() => handleRemoveWhitelistCommand(cmd)}
                      className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>


        {/* 黑名单配置 */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <Ban className="w-5 h-5 mr-2 text-red-500" />
              黑名单命令
              <span className="ml-2 text-sm text-gray-500">({state.blacklist.length})</span>
            </h2>
            <button
              onClick={() => setState(prev => ({ ...prev, showResetModal: true }))}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              重置为默认
            </button>
          </div>
          <div className="p-6">
            {/* 添加命令输入 */}
            <div className="flex space-x-2 mb-4">
              <input
                type="text"
                value={state.newBlacklistCommand}
                onChange={(e) => setState(prev => ({ ...prev, newBlacklistCommand: e.target.value }))}
                onKeyPress={(e) => handleKeyPress(e, 'blacklist')}
                placeholder="输入命令，如 rm, reboot, shutdown"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <button
                onClick={handleAddBlacklistCommand}
                disabled={!state.newBlacklistCommand.trim()}
                className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            
            {/* 命令列表 */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {state.blacklist.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  暂无黑名单命令
                </p>
              ) : (
                state.blacklist.map((cmd, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-3 py-2 bg-red-50 rounded-md group"
                  >
                    <code className="text-sm font-mono text-red-800">{cmd}</code>
                    <button
                      onClick={() => handleRemoveBlacklistCommand(cmd)}
                      className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>


      {/* 通配符说明 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Info className="w-5 h-5 mr-2 text-blue-500" />
          通配符说明
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-gray-50 rounded-md">
            <code className="font-mono text-blue-600">rm*</code>
            <p className="text-gray-600 mt-1">匹配以 rm 开头的所有命令，如 rm, rmdir</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-md">
            <code className="font-mono text-blue-600">*delete*</code>
            <p className="text-gray-600 mt-1">匹配包含 delete 的所有命令</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-md">
            <code className="font-mono text-blue-600">chmod 777</code>
            <p className="text-gray-600 mt-1">精确匹配 chmod 777 命令</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-md">
            <code className="font-mono text-blue-600">mkfs.*</code>
            <p className="text-gray-600 mt-1">匹配 mkfs.ext4, mkfs.xfs 等命令</p>
          </div>
        </div>
      </div>

      {/* 重置确认对话框 */}
      <Modal
        isOpen={state.showResetModal}
        onClose={() => setState(prev => ({ ...prev, showResetModal: false }))}
        title="重置为默认黑名单"
        size="sm"
        footer={
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setState(prev => ({ ...prev, showResetModal: false }))}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleResetToDefault}
              className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              确认重置
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-500">
          此操作将用系统默认黑名单替换当前黑名单配置。默认黑名单包含 {state.defaultBlacklist.length} 个危险命令。
        </p>
      </Modal>


      {/* 删除主机规则确认对话框 */}
      <Modal
        isOpen={state.showDeleteModal}
        onClose={() => setState(prev => ({ ...prev, showDeleteModal: false }))}
        title="删除主机规则"
        size="sm"
        footer={
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setState(prev => ({ ...prev, showDeleteModal: false }))}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleDeleteHostRules}
              disabled={state.saving}
              className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {state.saving ? '删除中...' : '确认删除'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            删除此主机的专属规则后，将自动使用系统全局规则。
          </p>
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2 mt-0.5" />
              <p className="text-sm text-yellow-700">
                此操作不可撤销，请确认是否继续？
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default CommandFilterConfig