/**
 * 主机审计日志页面 - 美化版
 * 用于运维审计模块，UI风格与其他页面保持一致
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { 
  Terminal, CheckCircle, AlertTriangle, Shield, ChevronDown, ChevronUp, 
  X, Server, Filter, Trash2, Calendar, User, Globe, Activity, Clock
} from 'lucide-react'
import { MonitorPageLayout, MonitorContentCard, MonitorStatCard } from '../../components/Monitor/MonitorPageLayout'
import { SearchForm, SearchField } from '../../components/Form'
import { SettingsAlert } from '../../components/Settings'
import { hostAuditService } from '../../services/hostAudit'
import { hostsService } from '../../services/hosts'
import { formatDateTime } from '../../utils'
import { useAuthStore } from '../../store/auth'
import { useTheme } from '../../hooks/useTheme'
import type { AuditLog, AuditLogStatus, AuditLogQuery, AuditLogStats } from '../../types/audit'
import type { Host } from '../../types/host'

interface HostAuditState {
  hosts: Host[]
  hostsLoading: boolean
  selectedHostId: number | null
  logs: AuditLog[]
  loading: boolean
  error: string | null
  pagination: { page: number; page_size: number; total: number; pages: number }
  filters: AuditLogQuery
  stats: AuditLogStats | null
  statsLoading: boolean
  showClearModal: boolean
  clearDays: number
  clearing: boolean
  expandedLogId: number | null
  showSearch: boolean
  alertMessage: string
  alertType: 'success' | 'error' | 'warning' | 'info'
}

export const HostAudit: React.FC = () => {
  const { hasPermission } = useAuthStore()
  const { isDark } = useTheme()
  const abortControllerRef = useRef<AbortController | null>(null)
  
  const [state, setState] = useState<HostAuditState>({
    hosts: [],
    hostsLoading: true,
    selectedHostId: null,
    logs: [],
    loading: false,
    error: null,
    pagination: { page: 1, page_size: 20, total: 0, pages: 0 },
    filters: { page: 1, page_size: 20 },
    stats: null,
    statsLoading: false,
    showClearModal: false,
    clearDays: 30,
    clearing: false,
    expandedLogId: null,
    showSearch: false,
    alertMessage: '',
    alertType: 'info'
  })

  // 显示消息提示
  const showAlert = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setState(prev => ({ ...prev, alertMessage: message, alertType: type }))
    setTimeout(() => setState(prev => ({ ...prev, alertMessage: '' })), 3000)
  }

  // 加载主机列表
  const loadHosts = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, hostsLoading: true }))
      const response = await hostsService.getHosts({ page: 1, per_page: 1000 })
      const hostList = response.hosts || []
      setState(prev => ({ 
        ...prev, 
        hosts: hostList, 
        hostsLoading: false, 
        selectedHostId: hostList.length > 0 ? hostList[0].id : null 
      }))
      if (hostList.length > 0) {
        loadLogs(hostList[0].id)
        loadStats(hostList[0].id)
      }
    } catch (error: any) {
      setState(prev => ({ ...prev, hostsLoading: false }))
      showAlert('加载主机列表失败', 'error')
    }
  }, [])

  // 加载审计日志
  const loadLogs = useCallback(async (hostId?: number, filters?: AuditLogQuery) => {
    const targetHostId = hostId || state.selectedHostId
    if (!targetHostId) return

    if (abortControllerRef.current) abortControllerRef.current.abort()
    abortControllerRef.current = new AbortController()

    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      const response = await hostAuditService.getAuditLogs(targetHostId, filters || state.filters)
      setState(prev => ({ 
        ...prev, 
        logs: response.logs || [], 
        pagination: response.pagination || prev.pagination, 
        loading: false 
      }))
    } catch (error: any) {
      if (error?.name === 'AbortError') return
      setState(prev => ({ 
        ...prev, 
        error: error.message || '加载审计日志失败', 
        loading: false 
      }))
    }
  }, [state.selectedHostId, state.filters])

  // 加载统计数据
  const loadStats = useCallback(async (hostId?: number) => {
    const targetHostId = hostId || state.selectedHostId
    if (!targetHostId) return

    try {
      setState(prev => ({ ...prev, statsLoading: true }))
      const stats = await hostAuditService.getAuditStats(targetHostId, 30)
      setState(prev => ({ ...prev, stats, statsLoading: false }))
    } catch (error: any) {
      setState(prev => ({ ...prev, statsLoading: false }))
    }
  }, [state.selectedHostId])

  useEffect(() => {
    loadHosts()
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [])

  // 切换主机
  const handleHostChange = (hostId: number) => {
    setState(prev => ({ 
      ...prev, 
      selectedHostId: hostId,
      filters: { page: 1, page_size: 20 }
    }))
    loadLogs(hostId, { page: 1, page_size: 20 })
    loadStats(hostId)
  }

  // 处理搜索
  const handleSearch = (params: Record<string, any>) => {
    const newFilters = { 
      ...params, 
      page: 1, 
      page_size: 20 
    } as AuditLogQuery
    setState(prev => ({ ...prev, filters: newFilters }))
    loadLogs(state.selectedHostId || undefined, newFilters)
  }

  // 处理分页
  const handlePageChange = (page: number) => {
    const newFilters = { ...state.filters, page }
    setState(prev => ({ ...prev, filters: newFilters }))
    loadLogs(state.selectedHostId || undefined, newFilters)
  }

  // 刷新数据
  const handleRefresh = () => {
    loadLogs()
    loadStats()
  }

  // 执行清理
  const handleClearLogs = async () => {
    if (!state.selectedHostId) return
    
    try {
      setState(prev => ({ ...prev, clearing: true }))
      const result = await hostAuditService.clearAuditLogs(state.selectedHostId, state.clearDays)
      
      showAlert(`成功清理 ${result.deleted_count} 条审计日志`, 'success')
      setState(prev => ({ ...prev, showClearModal: false, clearing: false }))
      
      loadLogs()
      loadStats()
    } catch (error: any) {
      showAlert(error.message || '清理审计日志失败', 'error')
      setState(prev => ({ ...prev, clearing: false }))
    }
  }

  // 切换日志详情展开
  const toggleLogExpand = (logId: number) => {
    setState(prev => ({
      ...prev,
      expandedLogId: prev.expandedLogId === logId ? null : logId
    }))
  }

  // 获取状态显示
  const getStatusBadge = (status: AuditLogStatus) => {
    const badges = {
      success: { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30', label: '成功', icon: CheckCircle },
      blocked: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30', label: '已阻止', icon: Shield },
      failed: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30', label: '失败', icon: AlertTriangle }
    }
    const badge = badges[status] || badges.failed
    const Icon = badge.icon
    
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${
        isDark ? `${badge.bg} ${badge.text} ${badge.border}` : 
        status === 'success' ? 'bg-green-100 text-green-700 border-green-200' :
        status === 'blocked' ? 'bg-red-100 text-red-700 border-red-200' :
        'bg-yellow-100 text-yellow-700 border-yellow-200'
      }`}>
        <Icon className="w-3 h-3 mr-1" />
        {badge.label}
      </span>
    )
  }

  const selectedHost = state.hosts.find(h => h.id === state.selectedHostId)
  const logs = state.logs || []

  // 搜索字段配置
  const searchFields: SearchField[] = [
    { 
      name: 'status', 
      label: '状态', 
      type: 'select', 
      options: [
        { label: '全部状态', value: '' },
        { label: '成功', value: 'success' },
        { label: '已阻止', value: 'blocked' },
        { label: '失败', value: 'failed' }
      ]
    },
    { name: 'start_date', label: '开始日期', type: 'date' },
    { name: 'end_date', label: '结束日期', type: 'date' }
  ]

  // 头部操作按钮
  const headerActions = (
    <div className="flex items-center space-x-3">
      <button 
        onClick={() => setState(prev => ({ ...prev, showSearch: !prev.showSearch }))}
        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
          state.showSearch 
            ? (isDark ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-blue-50 text-blue-700 border border-blue-200')
            : (isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
        }`}
      >
        <Filter className="w-4 h-4" />
        <span>筛选</span>
        {state.showSearch ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {hasPermission('host:audit:config') && state.selectedHostId && (
        <button
          onClick={() => setState(prev => ({ ...prev, showClearModal: true, clearDays: 30 }))}
          className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-white font-medium overflow-hidden transition-all"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-red-600 to-rose-500"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-red-700 to-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <Trash2 className="relative w-4 h-4" />
          <span className="relative">清理日志</span>
        </button>
      )}
    </div>
  )

  return (
    <MonitorPageLayout
      title="主机审计"
      subtitle="查看和管理 WebShell 命令执行审计记录"
      icon={Terminal}
      iconGradient="from-purple-500 via-violet-500 to-indigo-500"
      headerActions={headerActions}
      loading={state.loading}
      onRefresh={handleRefresh}
      showFullscreen={false}
    >
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

      {/* 主机选择和统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {/* 主机选择 */}
        <MonitorContentCard title="选择主机" icon={Server} className="md:col-span-1">
          <select
            value={state.selectedHostId || ''}
            onChange={(e) => handleHostChange(parseInt(e.target.value))}
            disabled={state.hostsLoading}
            className={`w-full px-3 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
              isDark 
                ? 'bg-slate-700 border-slate-600 text-white' 
                : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            {state.hosts.map(host => (
              <option key={host.id} value={host.id}>
                {host.name} ({host.hostname})
              </option>
            ))}
          </select>
        </MonitorContentCard>

        {/* 统计卡片 */}
        {state.stats && (
          <>
            <MonitorStatCard 
              title="总命令数" 
              value={state.stats.total_commands} 
              icon={Terminal} 
            />
            <MonitorStatCard 
              title="成功执行" 
              value={state.stats.success_count} 
              icon={CheckCircle} 
              variant="success" 
            />
            <MonitorStatCard 
              title="已阻止" 
              value={state.stats.blocked_count} 
              icon={Shield} 
              variant="danger" 
            />
            <MonitorStatCard 
              title="执行失败" 
              value={state.stats.failed_count} 
              icon={AlertTriangle} 
              variant="warning" 
            />
          </>
        )}
      </div>

      {/* 搜索表单 */}
      {state.showSearch && (
        <MonitorContentCard title="筛选条件" icon={Filter} className="mb-6">
          <SearchForm fields={searchFields} onSearch={handleSearch} loading={state.loading} />
        </MonitorContentCard>
      )}

      {/* 错误提示 */}
      {state.error && (
        <div className={`mb-6 p-4 rounded-xl border ${
          isDark ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">{state.error}</span>
          </div>
        </div>
      )}

      {/* 审计日志列表 */}
      {state.selectedHostId ? (
        <MonitorContentCard 
          title="审计日志" 
          icon={Activity}
          headerActions={
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              共 {state.pagination.total} 条记录
            </span>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={isDark ? 'border-b border-slate-700' : 'border-b border-gray-200'}>
                  {['执行时间', '用户', '命令', '状态', 'IP地址', '操作'].map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-gray-100'}`}>
                {logs.map(log => (
                  <React.Fragment key={log.id}>
                    <tr className={`transition-colors ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'}`}>
                      {/* 执行时间 */}
                      <td className="px-4 py-3">
                        <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {formatDateTime(log.executed_at, 'YYYY/MM/DD')}
                        </div>
                        <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {formatDateTime(log.executed_at, 'HH:mm:ss')}
                        </div>
                      </td>

                      {/* 用户 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <div className={`p-1.5 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
                            <User className={`w-3.5 h-3.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                          </div>
                          <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {log.username || '-'}
                          </span>
                        </div>
                      </td>

                      {/* 命令 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <Terminal className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                          <code className={`text-sm font-mono px-2 py-1 rounded max-w-md truncate ${
                            isDark ? 'bg-slate-700 text-green-400' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {log.command}
                          </code>
                        </div>
                      </td>

                      {/* 状态 */}
                      <td className="px-4 py-3">
                        {getStatusBadge(log.status)}
                      </td>

                      {/* IP地址 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1.5">
                          <Globe className={`w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            {log.ip_address || '-'}
                          </span>
                        </div>
                      </td>

                      {/* 操作 */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleLogExpand(log.id)}
                          className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            isDark 
                              ? 'bg-slate-700 text-blue-400 hover:bg-slate-600' 
                              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                          }`}
                        >
                          {state.expandedLogId === log.id ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5 mr-1" />
                              收起
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5 mr-1" />
                              详情
                            </>
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* 展开的详情行 */}
                    {state.expandedLogId === log.id && (
                      <tr>
                        <td colSpan={6} className={isDark ? 'bg-slate-800/50' : 'bg-gray-50'}>
                          <div className="p-6 space-y-4">
                            {/* 完整命令 */}
                            <div>
                              <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                完整命令
                              </h4>
                              <pre className={`text-sm font-mono p-4 rounded-xl overflow-x-auto ${
                                isDark ? 'bg-slate-900 text-green-400' : 'bg-gray-800 text-green-400'
                              }`}>
                                {log.command}
                              </pre>
                            </div>

                            {/* 阻止原因 */}
                            {log.block_reason && (
                              <div>
                                <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                  阻止原因
                                </h4>
                                <div className={`p-3 rounded-xl ${
                                  isDark ? 'bg-red-500/10 border border-red-500/20 text-red-300' : 'bg-red-50 border border-red-200 text-red-600'
                                }`}>
                                  <p className="text-sm">{log.block_reason}</p>
                                </div>
                              </div>
                            )}

                            {/* 输出摘要 */}
                            {log.output_summary && (
                              <div>
                                <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                  输出摘要
                                </h4>
                                <pre className={`text-sm font-mono p-4 rounded-xl overflow-x-auto max-h-48 overflow-y-auto ${
                                  isDark ? 'bg-slate-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {log.output_summary}
                                </pre>
                              </div>
                            )}

                            {/* 错误信息 */}
                            {log.error_message && (
                              <div>
                                <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                  错误信息
                                </h4>
                                <div className={`p-3 rounded-xl ${
                                  isDark ? 'bg-red-500/10 border border-red-500/20 text-red-300' : 'bg-red-50 border border-red-200 text-red-600'
                                }`}>
                                  <p className="text-sm">{log.error_message}</p>
                                </div>
                              </div>
                            )}

                            {/* 详细信息 */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-white border border-gray-200'}`}>
                                <div className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>会话ID</div>
                                <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {log.session_id || '-'}
                                </div>
                              </div>
                              <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-white border border-gray-200'}`}>
                                <div className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>执行时间</div>
                                <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {formatDateTime(log.executed_at)}
                                </div>
                              </div>
                              <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-white border border-gray-200'}`}>
                                <div className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>IP地址</div>
                                <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {log.ip_address || '-'}
                                </div>
                              </div>
                              <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-white border border-gray-200'}`}>
                                <div className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>执行耗时</div>
                                <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {log.execution_time ? `${log.execution_time.toFixed(3)}秒` : '-'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}

                {logs.length === 0 && !state.loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <Terminal className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                      <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>暂无审计日志</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {state.pagination.total > 0 && (
            <div className={`flex items-center justify-between px-4 py-4 border-t ${
              isDark ? 'border-slate-700' : 'border-gray-200'
            }`}>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                共 <span className="font-medium">{state.pagination.total}</span> 条记录
              </div>
              <div className="flex items-center space-x-2">
                {Array.from({ length: Math.min(5, Math.ceil(state.pagination.total / state.pagination.page_size)) }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      state.pagination.page === page
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                        : isDark 
                          ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
            </div>
          )}
        </MonitorContentCard>
      ) : (
        <MonitorContentCard title="提示" icon={Server}>
          <div className="text-center py-12">
            <Server className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              请先选择一个主机查看审计日志
            </p>
          </div>
        </MonitorContentCard>
      )}

      {/* 清理日志弹窗 */}
      {state.showClearModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`rounded-2xl shadow-2xl max-w-md w-full mx-4 ${
            isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'
          }`}>
            {/* 头部 */}
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              isDark ? 'border-slate-700' : 'border-gray-200'
            }`}>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-orange-500/20' : 'bg-orange-100'
                }`}>
                  <AlertTriangle className={`w-5 h-5 ${isDark ? 'text-orange-400' : 'text-orange-500'}`} />
                </div>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  清理审计日志
                </h3>
              </div>
              <button 
                onClick={() => setState(prev => ({ ...prev, showClearModal: false }))} 
                className={`p-1.5 rounded-lg transition-colors ${
                  isDark ? 'text-gray-400 hover:bg-slate-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* 内容 */}
            <div className="px-6 py-5 space-y-5">
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                此操作将删除 <strong>{selectedHost?.name}</strong> 指定天数之前的审计日志，删除后无法恢复。
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
            <div className={`px-6 py-4 border-t flex items-center justify-end space-x-3 ${
              isDark ? 'border-slate-700' : 'border-gray-200'
            }`}>
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
                {state.clearing ? '清理中...' : '确认清理'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MonitorPageLayout>
  )
}

export default HostAudit
