/**
 * 操作日志列表页面 - 美化版
 * 用于运维审计模块
 */
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Download, Eye, User, Activity, Globe, BarChart3, FileText, Filter, ChevronDown, ChevronUp, Trash2, X, AlertTriangle } from 'lucide-react'
import { MonitorPageLayout, MonitorContentCard, MonitorStatCard } from '../../components/Monitor/MonitorPageLayout'
import { SearchForm, SearchField } from '../../components/Form'
import { LogDetailModal } from '../../components/LogDetailModal'
import { formatDateTime } from '../../utils'
import { LogStatistics } from '../../components/LogStatistics'
import { SettingsAlert } from '../../components/Settings'
import { useAuthStore } from '../../store/auth'
import { useTheme } from '../../hooks/useTheme'
import { logService } from '../../services/logs'
import { OperationLog, LogSearchParams } from '../../types/log'

interface LogListState {
  logs: OperationLog[]
  loading: boolean
  total: number
  currentPage: number
  pageSize: number
  searchParams: LogSearchParams
  showSearch: boolean
  showStatistics: boolean
  selectedLog?: OperationLog
  showDetail: boolean
  selectedIds: number[]
  deleting: boolean
  showClearModal: boolean
  clearDays: number
  clearing: boolean
  // 删除确认弹窗
  showDeleteModal: boolean
  deleteTarget?: OperationLog
  deleteType: 'single' | 'batch'
  // 消息提示
  alertMessage: string
  alertType: 'success' | 'error' | 'warning' | 'info'
}

export const OperationLogs: React.FC = () => {
  const { hasPermission, isAdmin } = useAuthStore()
  const { isDark } = useTheme()
  const abortControllerRef = useRef<AbortController | null>(null)
  
  const [state, setState] = useState<LogListState>({
    logs: [], loading: false, total: 0, currentPage: 1, pageSize: 20,
    searchParams: {}, showSearch: false, showStatistics: false, showDetail: false,
    selectedIds: [], deleting: false, showClearModal: false, clearDays: 30, clearing: false,
    showDeleteModal: false, deleteType: 'single', alertMessage: '', alertType: 'info'
  })

  // 显示消息提示
  const showAlert = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setState(prev => ({ ...prev, alertMessage: message, alertType: type }))
    setTimeout(() => setState(prev => ({ ...prev, alertMessage: '' })), 3000)
  }

  const searchFields: SearchField[] = [
    { name: 'keyword', label: '关键词', type: 'text', placeholder: '搜索操作、资源' },
    { name: 'username', label: '用户名', type: 'text', placeholder: '搜索用户名' },
    { name: 'action', label: '操作类型', type: 'select', options: [
      { label: '全部', value: '' }, { label: '创建', value: 'create' }, { label: '更新', value: 'update' },
      { label: '删除', value: 'delete' }, { label: '查看', value: 'read' }, { label: '登录', value: 'login' }, { label: '登出', value: 'logout' }
    ]},
    { name: 'start_date', label: '开始日期', type: 'date' },
    { name: 'end_date', label: '结束日期', type: 'date' }
  ]

  const loadLogs = async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    abortControllerRef.current = new AbortController()
    setState(prev => ({ ...prev, loading: true }))
    try {
      const response = await logService.getLogs({ ...state.searchParams, page: state.currentPage, page_size: state.pageSize })
      if (response.success && response.data) {
        const data = response.data as any
        const items = data.items || data.logs || []
        setState(prev => ({ ...prev, logs: items, total: data.total || 0, loading: false, selectedIds: [] }))
      } else {
        setState(prev => ({ ...prev, logs: [], total: 0, loading: false }))
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return
      console.error('加载日志失败:', error)
      setState(prev => ({ ...prev, logs: [], loading: false }))
    }
  }

  const searchParamsKey = useMemo(() => JSON.stringify(state.searchParams), [state.searchParams])
  const handleSearch = (params: Record<string, any>) => setState(prev => ({ ...prev, searchParams: params as LogSearchParams, currentPage: 1 }))
  const handlePageChange = (page: number) => setState(prev => ({ ...prev, currentPage: page }))
  const handleViewDetail = (log: OperationLog) => setState(prev => ({ ...prev, selectedLog: log, showDetail: true }))

  // 删除单条日志 - 显示确认弹窗
  const handleDeleteLog = (log: OperationLog) => {
    setState(prev => ({ ...prev, showDeleteModal: true, deleteTarget: log, deleteType: 'single' }))
  }

  // 确认删除单条日志
  const confirmDeleteLog = async () => {
    if (!state.deleteTarget) return
    setState(prev => ({ ...prev, deleting: true }))
    try {
      await logService.deleteLog(state.deleteTarget.id)
      setState(prev => ({ ...prev, showDeleteModal: false, deleteTarget: undefined, deleting: false }))
      showAlert('删除成功', 'success')
      loadLogs()
    } catch (error) {
      console.error('删除日志失败:', error)
      setState(prev => ({ ...prev, deleting: false }))
      showAlert('删除失败', 'error')
    }
  }

  // 批量删除日志 - 显示确认弹窗
  const handleBatchDelete = () => {
    if (state.selectedIds.length === 0) return
    setState(prev => ({ ...prev, showDeleteModal: true, deleteType: 'batch' }))
  }

  // 确认批量删除
  const confirmBatchDelete = async () => {
    setState(prev => ({ ...prev, deleting: true }))
    try {
      await logService.batchDeleteLogs(state.selectedIds)
      setState(prev => ({ ...prev, showDeleteModal: false, deleting: false }))
      showAlert(`成功删除 ${state.selectedIds.length} 条日志`, 'success')
      loadLogs()
    } catch (error) {
      console.error('批量删除日志失败:', error)
      setState(prev => ({ ...prev, deleting: false }))
      showAlert('批量删除失败', 'error')
    }
  }

  // 清空日志
  const handleClearLogs = async () => {
    setState(prev => ({ ...prev, clearing: true }))
    try {
      const result = await logService.clearLogs(state.clearDays)
      setState(prev => ({ ...prev, showClearModal: false, clearing: false }))
      showAlert(`成功清空 ${result.data?.deleted_count || 0} 条日志`, 'success')
      loadLogs()
    } catch (error) {
      console.error('清空日志失败:', error)
      setState(prev => ({ ...prev, clearing: false }))
      showAlert('清空失败', 'error')
    }
  }

  // 选择/取消选择
  const toggleSelect = (id: number) => {
    setState(prev => ({
      ...prev,
      selectedIds: prev.selectedIds.includes(id)
        ? prev.selectedIds.filter(i => i !== id)
        : [...prev.selectedIds, id]
    }))
  }

  // 全选/取消全选
  const toggleSelectAll = () => {
    setState(prev => ({
      ...prev,
      selectedIds: prev.selectedIds.length === prev.logs.length
        ? []
        : prev.logs.map(l => l.id)
    }))
  }

  const handleExport = async () => {
    if (!hasPermission('log:export')) return
    try {
      const blob = await logService.exportLogs(state.searchParams)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `logs_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a)
    } catch (error) { console.error('导出日志失败:', error) }
  }

  useEffect(() => {
    loadLogs()
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort() }
  }, [searchParamsKey, state.currentPage])

  // 统计数据
  const logs = state.logs || []

  const headerActions = (
    <div className="flex items-center space-x-3">
      <button onClick={() => setState(prev => ({ ...prev, showStatistics: !prev.showStatistics }))}
        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all ${state.showStatistics ? (isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-purple-50 text-purple-700 border border-purple-200') : (isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}`}>
        <BarChart3 className="w-4 h-4" /><span>统计</span>
      </button>
      <button onClick={() => setState(prev => ({ ...prev, showSearch: !prev.showSearch }))}
        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all ${state.showSearch ? (isDark ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-blue-50 text-blue-700 border border-blue-200') : (isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}`}>
        <Filter className="w-4 h-4" /><span>筛选</span>{state.showSearch ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {hasPermission('log:export') && (
        <button onClick={handleExport}
          className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-white font-medium overflow-hidden transition-all">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <Download className="relative w-4 h-4" /><span className="relative">导出</span>
        </button>
      )}
    </div>
  )

  // 日志列表标题右侧操作
  const tableHeaderActions = (
    <div className="flex items-center space-x-3">
      {state.selectedIds.length > 0 && isAdmin() && (
        <button
          onClick={handleBatchDelete}
          disabled={state.deleting}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            isDark ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-100 text-red-600 hover:bg-red-200'
          } ${state.deleting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Trash2 className="w-4 h-4" />
          <span>删除选中 ({state.selectedIds.length})</span>
        </button>
      )}
      {isAdmin() && (
        <button
          onClick={() => setState(prev => ({ ...prev, showClearModal: true }))}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            isDark ? 'bg-orange-500/20 text-orange-300 hover:bg-orange-500/30' : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>清空日志</span>
        </button>
      )}
      <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>共 {state.total} 条</span>
    </div>
  )

  return (
    <MonitorPageLayout title="操作日志" subtitle="查看系统操作记录和审计信息" icon={FileText}
      iconGradient="from-violet-500 via-purple-500 to-fuchsia-500" headerActions={headerActions}
      loading={state.loading} onRefresh={loadLogs} showFullscreen={false}>
      
      {/* 消息提示 */}
      {state.alertMessage && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          <SettingsAlert 
            type={state.alertType} 
            message={state.alertMessage} 
            onClose={() => setState(prev => ({ ...prev, alertMessage: '' }))} 
          />
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <MonitorStatCard title="总记录数" value={state.total} icon={FileText} />
        <MonitorStatCard title="今日记录" value={logs.length} icon={Activity} variant="success" />
      </div>

      {/* 统计面板 */}
      {state.showStatistics && (
        <div className="mb-6"><LogStatistics /></div>
      )}

      {/* 搜索表单 */}
      {state.showSearch && (
        <MonitorContentCard title="筛选条件" icon={Filter} className="mb-6">
          <SearchForm fields={searchFields} onSearch={handleSearch} loading={state.loading} />
        </MonitorContentCard>
      )}

      {/* 日志表格 */}
      <MonitorContentCard title="日志列表" icon={Activity} headerActions={tableHeaderActions}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={isDark ? 'border-b border-slate-700' : 'border-b border-gray-200'}>
                {isAdmin() && (
                  <th className={`px-4 py-3 text-left ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <input
                      type="checkbox"
                      checked={state.selectedIds.length > 0 && state.selectedIds.length === logs.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                  </th>
                )}
                {['时间', '用户', '操作', '资源', 'IP地址', '动作'].map(h => (
                  <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-gray-100'}`}>
              {logs.map(log => (
                <tr key={log.id} className={`transition-colors ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'}`}>
                  {isAdmin() && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={state.selectedIds.includes(log.id)}
                        onChange={() => toggleSelect(log.id)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatDateTime(log.created_at, 'YYYY/MM/DD')}</div>
                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{formatDateTime(log.created_at, 'HH:mm:ss')}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className={`p-1.5 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
                        <User className={`w-3.5 h-3.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                      </div>
                      <div>
                        <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{log.username}</div>
                        {log.user_full_name && <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{log.user_full_name}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                      <Activity className="w-3 h-3 mr-1" />{log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{log.resource}</div>
                    {log.resource_id && <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>ID: {log.resource_id}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-1.5">
                      <Globe className={`w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                      <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{log.ip_address || '-'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-1">
                      <button onClick={() => handleViewDetail(log)}
                        className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${isDark ? 'bg-slate-700 text-blue-400 hover:bg-slate-600' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                        <Eye className="w-3.5 h-3.5 mr-1" />详情
                      </button>
                      {isAdmin() && (
                        <button onClick={() => handleDeleteLog(log)}
                          className={`inline-flex items-center p-1.5 rounded-lg text-xs font-medium transition-all ${isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-600 hover:bg-red-50'}`}
                          title="删除">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && !state.loading && (
                <tr>
                  <td colSpan={isAdmin() ? 7 : 6} className="px-4 py-12 text-center">
                    <FileText className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>暂无日志记录</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {state.total > 0 && (
          <div className={`flex items-center justify-between px-4 py-4 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              共 <span className="font-medium">{state.total}</span> 条记录
            </div>
            <div className="flex items-center space-x-2">
              {Array.from({ length: Math.min(5, Math.ceil(state.total / state.pageSize)) }, (_, i) => i + 1).map(page => (
                <button key={page} onClick={() => handlePageChange(page)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${state.currentPage === page
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                    : isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {page}
                </button>
              ))}
            </div>
          </div>
        )}
      </MonitorContentCard>

      {/* 日志详情弹窗 */}
      {state.showDetail && state.selectedLog && (
        <LogDetailModal log={state.selectedLog} onClose={() => setState(prev => ({ ...prev, showDetail: false }))} />
      )}

      {/* 清空日志弹窗 */}
      {state.showClearModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`rounded-2xl shadow-2xl max-w-md w-full mx-4 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            {/* 头部 */}
            <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-orange-500/20' : 'bg-orange-100'}`}>
                  <AlertTriangle className={`w-5 h-5 ${isDark ? 'text-orange-400' : 'text-orange-500'}`} />
                </div>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>清空日志</h3>
              </div>
              <button 
                onClick={() => setState(prev => ({ ...prev, showClearModal: false }))} 
                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:bg-slate-700' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* 内容 */}
            <div className="px-6 py-5 space-y-5">
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                选择要保留的日志时间范围，超出范围的日志将被永久删除。
              </p>
              
              {/* 快捷选项 */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '全部清空', value: 0 },
                  { label: '保留7天', value: 7 },
                  { label: '保留30天', value: 30 },
                  { label: '保留90天', value: 90 },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setState(prev => ({ ...prev, clearDays: opt.value }))}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      state.clearDays === opt.value
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30'
                        : isDark 
                          ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              
              {/* 自定义天数 */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  自定义保留天数
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min="0"
                    value={state.clearDays}
                    onChange={(e) => setState(prev => ({ ...prev, clearDays: Math.max(0, parseInt(e.target.value) || 0) }))}
                    className={`flex-1 px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-orange-500 ${
                      isDark 
                        ? 'bg-slate-700 border-slate-600 text-white' 
                        : 'bg-white border-gray-200 text-gray-900'
                    }`}
                  />
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>天</span>
                </div>
              </div>
              
              {/* 警告提示 */}
              <div className={`p-4 rounded-xl ${
                state.clearDays === 0 
                  ? isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'
                  : isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-100'
              }`}>
                <div className="flex items-start space-x-3">
                  <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                    state.clearDays === 0 
                      ? isDark ? 'text-red-400' : 'text-red-500'
                      : isDark ? 'text-amber-400' : 'text-amber-500'
                  }`} />
                  <div>
                    <p className={`text-sm font-medium ${
                      state.clearDays === 0 
                        ? isDark ? 'text-red-300' : 'text-red-700'
                        : isDark ? 'text-amber-300' : 'text-amber-700'
                    }`}>
                      {state.clearDays === 0 
                        ? '将清空所有日志！' 
                        : `将删除 ${state.clearDays} 天前的所有日志`}
                    </p>
                    <p className={`text-xs mt-1 ${
                      state.clearDays === 0 
                        ? isDark ? 'text-red-400/80' : 'text-red-600'
                        : isDark ? 'text-amber-400/80' : 'text-amber-600'
                    }`}>
                      此操作不可恢复，请谨慎操作
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 底部按钮 */}
            <div className={`px-6 py-4 border-t flex items-center justify-end space-x-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
              <button
                onClick={() => setState(prev => ({ ...prev, showClearModal: false }))}
                disabled={state.clearing}
                className={`px-4 py-2.5 rounded-xl font-medium transition-all ${
                  isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                取消
              </button>
              <button
                onClick={handleClearLogs}
                disabled={state.clearing}
                className={`px-4 py-2.5 rounded-xl font-medium text-white transition-all ${
                  state.clearDays === 0
                    ? 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-lg shadow-red-500/30'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/30'
                } ${state.clearing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {state.clearing ? '清空中...' : '确认清空'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {state.showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`rounded-2xl shadow-2xl max-w-sm w-full mx-4 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            {/* 头部 */}
            <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
                  <Trash2 className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
                </div>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>确认删除</h3>
              </div>
              <button 
                onClick={() => setState(prev => ({ ...prev, showDeleteModal: false, deleteTarget: undefined }))} 
                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:bg-slate-700' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* 内容 */}
            <div className="px-6 py-5">
              {state.deleteType === 'single' && state.deleteTarget ? (
                <div className="space-y-3">
                  <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    确定要删除这条日志吗？
                  </p>
                  <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                    <div className="flex items-center space-x-2 mb-2">
                      <Activity className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                      <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {state.deleteTarget.action}
                      </span>
                    </div>
                    <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      资源: {state.deleteTarget.resource}
                      {state.deleteTarget.resource_id && ` (ID: ${state.deleteTarget.resource_id})`}
                    </div>
                  </div>
                </div>
              ) : (
                <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  确定要删除选中的 <span className="font-semibold text-red-500">{state.selectedIds.length}</span> 条日志吗？
                </p>
              )}
              <p className={`text-xs mt-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                此操作不可恢复
              </p>
            </div>
            
            {/* 底部按钮 */}
            <div className={`px-6 py-4 border-t flex items-center justify-end space-x-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
              <button
                onClick={() => setState(prev => ({ ...prev, showDeleteModal: false, deleteTarget: undefined }))}
                disabled={state.deleting}
                className={`px-4 py-2.5 rounded-xl font-medium transition-all ${
                  isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                取消
              </button>
              <button
                onClick={state.deleteType === 'single' ? confirmDeleteLog : confirmBatchDelete}
                disabled={state.deleting}
                className={`px-4 py-2.5 rounded-xl font-medium text-white transition-all bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-lg shadow-red-500/30 ${
                  state.deleting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {state.deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MonitorPageLayout>
  )
}

export default OperationLogs
