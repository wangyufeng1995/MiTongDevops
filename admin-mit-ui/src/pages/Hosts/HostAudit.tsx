/**
 * 主机审计日志页面组件 - 美化版
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Trash2, CheckCircle, XCircle, AlertTriangle, 
  User, Terminal, Clock, Shield, ChevronDown, ChevronUp, FileText 
} from 'lucide-react'
import { DataTable } from '../../components/Table'
import { Modal } from '../../components/Modal'
import { hostAuditService } from '../../services/hostAudit'
import { hostsService } from '../../services/hosts'
import { formatDateTime } from '../../utils'
import { useAuthStore } from '../../store/auth'
import { useTheme } from '../../hooks/useTheme'
import { MonitorPageLayout, MonitorStatCard, MonitorContentCard, FilterBar, QuickFilter } from '../../components/Monitor'
import type { FilterItem } from '../../components/Monitor/FilterBar'
import type { AuditLog, AuditLogStatus, AuditLogQuery, AuditLogStats } from '../../types/audit'
import type { Host } from '../../types/host'

interface HostAuditState {
  host: Host | null
  hostLoading: boolean
  logs: AuditLog[]
  loading: boolean
  error: string | null
  pagination: { page: number; page_size: number; total: number; pages: number }
  filters: AuditLogQuery
  stats: AuditLogStats | null
  showClearModal: boolean
  clearDays: number
  clearing: boolean
  expandedLogId: number | null
  toast: { show: boolean; type: 'success' | 'error' | 'warning' | 'info'; message: string }
}

// 筛选配置
const filterConfig: FilterItem[] = [
  { key: 'status', label: '状态', type: 'select', width: 'sm', options: [
    { value: '', label: '全部状态' },
    { value: 'success', label: '成功' },
    { value: 'blocked', label: '已阻止' },
    { value: 'failed', label: '失败' }
  ]},
  { key: 'start_date', label: '开始日期', type: 'date', width: 'md' },
  { key: 'end_date', label: '结束日期', type: 'date', width: 'md' },
]

export const HostAudit: React.FC = () => {
  const { hostId } = useParams<{ hostId: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const { isDark } = useTheme()
  const numericHostId = hostId ? parseInt(hostId, 10) : 0
  
  const [state, setState] = useState<HostAuditState>({
    host: null, hostLoading: true, logs: [], loading: true, error: null,
    pagination: { page: 1, page_size: 50, total: 0, pages: 0 },
    filters: { page: 1, page_size: 50 }, stats: null,
    showClearModal: false, clearDays: 30, clearing: false, expandedLogId: null,
    toast: { show: false, type: 'info', message: '' }
  })

  const showToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setState(prev => ({ ...prev, toast: { show: true, type, message } }))
    setTimeout(() => setState(prev => ({ ...prev, toast: { ...prev.toast, show: false } })), 3000)
  }, [])

  const loadHost = useCallback(async () => {
    if (!numericHostId) return
    try {
      setState(prev => ({ ...prev, hostLoading: true }))
      const host = await hostsService.getHost(numericHostId)
      setState(prev => ({ ...prev, host, hostLoading: false }))
    } catch {
      setState(prev => ({ ...prev, hostLoading: false }))
    }
  }, [numericHostId])

  const loadLogs = useCallback(async (filters?: AuditLogQuery) => {
    if (!numericHostId) return
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      const response = await hostAuditService.getAuditLogs(numericHostId, filters || state.filters)
      setState(prev => ({ ...prev, logs: response.logs || [], pagination: response.pagination || prev.pagination, loading: false }))
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message || '加载审计日志失败', loading: false }))
    }
  }, [numericHostId, state.filters])

  const loadStats = useCallback(async () => {
    if (!numericHostId) return
    try {
      const stats = await hostAuditService.getAuditStats(numericHostId, 30)
      setState(prev => ({ ...prev, stats }))
    } catch {}
  }, [numericHostId])

  useEffect(() => { loadHost(); loadLogs(); loadStats() }, [numericHostId])

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...state.filters, [key]: value || undefined, page: 1 }
    setState(prev => ({ ...prev, filters: newFilters }))
  }

  const handleSearch = () => loadLogs(state.filters)

  const handleReset = () => {
    const newFilters = { page: 1, page_size: 50 }
    setState(prev => ({ ...prev, filters: newFilters }))
    loadLogs(newFilters)
  }

  const handleQuickFilter = (status: string) => {
    const newFilters = { ...state.filters, status: (status || undefined) as AuditLogStatus | undefined, page: 1 }
    setState(prev => ({ ...prev, filters: newFilters }))
    loadLogs(newFilters)
  }

  const handleClearLogs = async () => {
    if (!numericHostId) return
    try {
      setState(prev => ({ ...prev, clearing: true }))
      const result = await hostAuditService.clearAuditLogs(numericHostId, state.clearDays)
      showToast('success', `已清理 ${result.deleted_count} 条审计日志`)
      setState(prev => ({ ...prev, showClearModal: false, clearing: false }))
      loadLogs(); loadStats()
    } catch (error: any) {
      showToast('error', error.message || '清理失败')
      setState(prev => ({ ...prev, clearing: false }))
    }
  }

  const getStatusDisplay = (status: AuditLogStatus) => {
    const cfg: Record<string, { icon: any; label: string; style: string }> = {
      success: { icon: CheckCircle, label: '成功', style: isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700' },
      blocked: { icon: Shield, label: '已阻止', style: isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700' },
      failed: { icon: AlertTriangle, label: '失败', style: isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700' }
    }
    const c = cfg[status] || { icon: Clock, label: '未知', style: isDark ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-600' }
    return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${c.style}`}><c.icon className="w-3 h-3 mr-1" />{c.label}</span>
  }

  const columns = [
    { key: 'executed_at', title: '执行时间', width: 140, render: (_: any, log: AuditLog) => (
      <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{formatDateTime(log.executed_at, 'MM-DD HH:mm:ss')}</span>
    )},
    { key: 'username', title: '用户', width: 100, render: (_: any, log: AuditLog) => (
      <div className="flex items-center space-x-2">
        <User className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{log.username || '-'}</span>
      </div>
    )},
    { key: 'command', title: '命令', render: (_: any, log: AuditLog) => (
      <div className="flex items-center space-x-2">
        <Terminal className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
        <code className={`text-sm font-mono px-2 py-1 rounded max-w-md truncate ${isDark ? 'bg-slate-700/50 text-cyan-300' : 'bg-gray-100 text-gray-800'}`}>{log.command}</code>
      </div>
    )},
    { key: 'status', title: '状态', width: 100, align: 'center' as const, render: (_: any, log: AuditLog) => getStatusDisplay(log.status) },
    { key: 'ip_address', title: 'IP地址', width: 120, render: (_: any, log: AuditLog) => (
      <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{log.ip_address || '-'}</span>
    )},
    { key: 'actions', title: '', width: 50, align: 'center' as const, render: (_: any, log: AuditLog) => (
      <button 
        onClick={() => setState(prev => ({ ...prev, expandedLogId: prev.expandedLogId === log.id ? null : log.id }))} 
        className={`p-1 rounded ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
      >
        {state.expandedLogId === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
    )}
  ]

  // 快捷筛选选项
  const quickFilterOptions = [
    { value: '', label: '全部', count: state.stats?.total_commands },
    { value: 'success', label: '成功', count: state.stats?.success_count },
    { value: 'blocked', label: '已阻止', count: state.stats?.blocked_count },
    { value: 'failed', label: '失败', count: state.stats?.failed_count },
  ]

  const headerActions = (
    <div className="flex items-center space-x-3">
      <button onClick={() => navigate(-1)} className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all ${isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
        <ArrowLeft className="w-4 h-4" /><span>返回</span>
      </button>
      {hasPermission('host:audit:config') && (
        <button onClick={() => setState(prev => ({ ...prev, showClearModal: true }))} className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all ${isDark ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}>
          <Trash2 className="w-4 h-4" /><span>清理日志</span>
        </button>
      )}
    </div>
  )

  return (
    <MonitorPageLayout 
      title="主机审计日志" 
      subtitle={state.host ? `${state.host.name} (${state.host.hostname})` : '加载中...'} 
      icon={FileText}
      iconGradient="from-amber-500 via-orange-500 to-red-500" 
      headerActions={headerActions}
      loading={state.loading || state.hostLoading} 
      onRefresh={() => { loadLogs(); loadStats() }} 
      showFullscreen={false}
    >
      {/* Toast */}
      {state.toast.show && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`px-4 py-3 rounded-xl shadow-xl border flex items-center space-x-3 ${
            state.toast.type === 'success' 
              ? (isDark ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800') 
              : (isDark ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-800')
          }`}>
            <span className="text-sm font-medium">{state.toast.message}</span>
          </div>
        </div>
      )}

      {/* 统计卡片 */}
      {state.stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MonitorStatCard title="总命令数" value={state.stats.total_commands} subtitle="近30天" icon={Terminal} iconColorClass="text-blue-400" glowColor="bg-blue-500" />
          <MonitorStatCard title="成功执行" value={state.stats.success_count} subtitle="执行成功" icon={CheckCircle} variant="success" iconColorClass="text-emerald-400" glowColor="bg-emerald-500" />
          <MonitorStatCard title="已阻止" value={state.stats.blocked_count} subtitle="被过滤阻止" icon={Shield} variant={state.stats.blocked_count > 0 ? 'danger' : 'default'} valueColorClass={state.stats.blocked_count > 0 ? 'text-red-500' : undefined} iconColorClass={state.stats.blocked_count > 0 ? 'text-red-400' : 'text-gray-400'} glowColor="bg-red-500" />
          <MonitorStatCard title="执行失败" value={state.stats.failed_count} subtitle="执行失败" icon={AlertTriangle} variant={state.stats.failed_count > 0 ? 'warning' : 'default'} iconColorClass={state.stats.failed_count > 0 ? 'text-amber-400' : 'text-gray-400'} glowColor="bg-amber-500" />
        </div>
      )}

      {/* 筛选区域 */}
      <MonitorContentCard className="mb-6">
        <div className="space-y-4">
          {/* 快捷筛选 */}
          <QuickFilter 
            options={quickFilterOptions} 
            value={state.filters.status || ''} 
            onChange={handleQuickFilter} 
          />
          {/* 详细筛选 */}
          <FilterBar
            filters={filterConfig}
            values={state.filters}
            onChange={handleFilterChange}
            onSearch={handleSearch}
            onReset={handleReset}
          />
        </div>
      </MonitorContentCard>

      {/* 错误提示 */}
      {state.error && (
        <div className={`mb-6 p-4 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {state.error}
        </div>
      )}

      {/* 审计日志表格 */}
      <MonitorContentCard 
        title="审计日志" 
        icon={FileText} 
        headerActions={<span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>共 {state.pagination.total} 条记录</span>} 
        noPadding
      >
        <DataTable 
          columns={columns} 
          dataSource={state.logs} 
          loading={state.loading}
          pagination={{ 
            current: state.pagination.page, 
            pageSize: state.pagination.page_size, 
            total: state.pagination.total, 
            showTotal: true, 
            onChange: (p) => { 
              setState(prev => ({ ...prev, filters: { ...prev.filters, page: p } }))
              loadLogs({ ...state.filters, page: p }) 
            } 
          }}
          emptyText="暂无审计日志"
          expandable={{ 
            expandedRowKeys: state.expandedLogId ? [state.expandedLogId] : [],
            expandedRowRender: (log: AuditLog) => (
              <div className={`p-4 space-y-3 ${isDark ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
                <div>
                  <h4 className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>完整命令</h4>
                  <pre className={`text-sm font-mono p-3 rounded-xl overflow-x-auto ${isDark ? 'bg-slate-900 text-cyan-300' : 'bg-gray-800 text-green-400'}`}>{log.command}</pre>
                </div>
                {log.block_reason && (
                  <div>
                    <h4 className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>阻止原因</h4>
                    <p className={`text-sm p-2 rounded-xl ${isDark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-600'}`}>{log.block_reason}</p>
                  </div>
                )}
                {log.output_summary && (
                  <div>
                    <h4 className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>输出摘要</h4>
                    <pre className={`text-sm font-mono p-3 rounded-xl overflow-x-auto max-h-48 overflow-y-auto ${isDark ? 'bg-slate-700/50 text-gray-300' : 'bg-gray-100 text-gray-800'}`}>{log.output_summary}</pre>
                  </div>
                )}
              </div>
            )
          }} 
        />
      </MonitorContentCard>

      {/* 清理日志模态框 */}
      <Modal 
        isOpen={state.showClearModal} 
        onClose={() => setState(prev => ({ ...prev, showClearModal: false }))} 
        title="清理审计日志" 
        size="sm"
        footer={
          <div className="flex justify-end space-x-3">
            <button onClick={() => setState(prev => ({ ...prev, showClearModal: false }))} className={`px-4 py-2 rounded-xl font-medium ${isDark ? 'bg-slate-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>取消</button>
            <button onClick={handleClearLogs} disabled={state.clearing} className="px-4 py-2 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">{state.clearing ? '清理中...' : '确认清理'}</button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>此操作将删除指定天数之前的审计日志，删除后无法恢复。</p>
          <select 
            value={state.clearDays} 
            onChange={(e) => setState(prev => ({ ...prev, clearDays: parseInt(e.target.value) }))} 
            className={`w-full px-4 py-2.5 rounded-xl border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
          >
            <option value={0}>清理所有日志</option>
            <option value={7}>保留最近 7 天</option>
            <option value={30}>保留最近 30 天</option>
            <option value={60}>保留最近 60 天</option>
            <option value={90}>保留最近 90 天</option>
          </select>
        </div>
      </Modal>
    </MonitorPageLayout>
  )
}

export default HostAudit
