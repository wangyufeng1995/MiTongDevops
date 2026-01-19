/**
 * 告警历史列表组件
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  AlertTriangle, Search, RefreshCw, CheckCircle, XCircle, Clock, 
  Eye, Filter, Calendar, Server, Bell, Activity, Info, Zap, Download
} from 'lucide-react'
import { api } from '../../../services/api'
import { formatDateTime } from '../../../utils'
import { useAuthStore } from '../../../store/auth'
import { useTheme } from '../../../hooks/useTheme'
import { MonitorPageLayout, MonitorStatCard, MonitorContentCard, ConfirmDialog, useConfirmDialog } from '../../../components/Monitor'
import { DataTable, Column, PaginationConfig } from '../../../components/Table'

interface AlertRecord {
  id: number
  rule_id: number
  host_id: number
  metric_type: string
  metric_value: number
  threshold_value: number
  condition_operator: string
  severity: 'info' | 'warning' | 'critical'
  status: 'active' | 'acknowledged' | 'ignored' | 'resolved'
  message: string
  first_triggered_at: string
  last_triggered_at: string
  trigger_count: number
  acknowledged_by?: string
  acknowledged_at?: string
  resolved_at?: string
  created_at: string
  updated_at: string
  rule_info?: {
    id: number
    name: string
    enabled: boolean
  }
  host_info?: {
    id: number
    name: string
    hostname: string
    status: number
  }
  notification_stats?: Record<string, number>
}

interface AlertHistoryState {
  alerts: AlertRecord[]
  loading: boolean
  error: string | null
  pagination: { page: number; per_page: number; total: number; pages: number }
  search: string
  statusFilter: string
  severityFilter: string
  metricFilter: string
  dateRange: { start: string; end: string }
  toast: { show: boolean; type: 'success' | 'error' | 'warning' | 'info'; message: string }
  statistics: {
    status_stats: Record<string, number>
    severity_stats: Record<string, number>
    total_count: number
  }
}

export const AlertHistory: React.FC = () => {
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const { isDark } = useTheme()
  const confirmDialog = useConfirmDialog()
  
  const [state, setState] = useState<AlertHistoryState>({
    alerts: [], loading: true, error: null,
    pagination: { page: 1, per_page: 10, total: 0, pages: 0 },
    search: '', statusFilter: '', severityFilter: '', metricFilter: '',
    dateRange: { start: '', end: '' },
    toast: { show: false, type: 'info', message: '' },
    statistics: { status_stats: {}, severity_stats: {}, total_count: 0 }
  })

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setState(prev => ({ ...prev, toast: { show: true, type, message } }))
    setTimeout(() => setState(prev => ({ ...prev, toast: { ...prev.toast, show: false } })), 3000)
  }

  const loadAlerts = useCallback(async (page = 1) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      const response = await api.get('/api/monitor/alerts', {
        params: {
          page,
          per_page: state.pagination.per_page,
          search: state.search || undefined,
          status: state.statusFilter || undefined,
          severity: state.severityFilter || undefined,
          metric_type: state.metricFilter || undefined,
          start_date: state.dateRange.start || undefined,
          end_date: state.dateRange.end || undefined
        }
      })
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          alerts: response.data.alerts || [],
          pagination: response.data.pagination || prev.pagination,
          statistics: response.data.statistics || prev.statistics,
          loading: false
        }))
      }
    } catch (error: any) {
      setState(prev => ({ 
        ...prev, 
        error: error.message || '加载告警历史失败', 
        loading: false 
      }))
      showToast('error', error.message || '加载告警历史失败')
    }
  }, [state.pagination.per_page, state.search, state.statusFilter, state.severityFilter, state.metricFilter, state.dateRange])

  useEffect(() => { loadAlerts() }, [])

  const searchTimeoutRef = React.useRef<NodeJS.Timeout>()
  const handleSearch = (searchValue: string) => {
    setState(prev => ({ ...prev, search: searchValue }))
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => loadAlerts(1), 300)
  }

  const handleFilterChange = (filterType: 'status' | 'severity' | 'metric', value: string) => {
    setState(prev => ({
      ...prev,
      statusFilter: filterType === 'status' ? value : prev.statusFilter,
      severityFilter: filterType === 'severity' ? value : prev.severityFilter,
      metricFilter: filterType === 'metric' ? value : prev.metricFilter
    }))
    setTimeout(() => loadAlerts(1), 100)
  }

  const handleDateRangeChange = (type: 'start' | 'end', value: string) => {
    setState(prev => ({
      ...prev,
      dateRange: { ...prev.dateRange, [type]: value }
    }))
    setTimeout(() => loadAlerts(1), 100)
  }

  const handlePageChange = (page: number, pageSize: number) => {
    setState(prev => ({ ...prev, pagination: { ...prev.pagination, page, per_page: pageSize } }))
    loadAlerts(page)
  }

  const handleAcknowledge = async (alert: AlertRecord) => {
    try {
      const response = await api.post(`/api/monitor/alerts/${alert.id}/ack`)
      if (response.success) {
        showToast('success', '告警已确认')
        loadAlerts(state.pagination.page)
      }
    } catch (error: any) {
      showToast('error', error.message || '确认告警失败')
    }
  }

  const handleIgnore = async (alert: AlertRecord) => {
    confirmDialog.show({
      title: '忽略告警',
      variant: 'warning',
      confirmText: '确认忽略',
      message: (
        <div className="space-y-3">
          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            确定要忽略此告警吗？忽略后将不再显示在活跃告警列表中。
          </p>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
            <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {alert.message}
            </p>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
              {alert.host_info?.name} - {formatDateTime(alert.first_triggered_at)}
            </p>
          </div>
        </div>
      ),
      onConfirm: async () => {
        try {
          const response = await api.post(`/api/monitor/alerts/${alert.id}/ignore`)
          if (response.success) {
            showToast('success', '告警已忽略')
            loadAlerts(state.pagination.page)
          }
        } catch (error: any) {
          showToast('error', error.message || '忽略告警失败')
        }
      }
    })
  }

  const handleExport = async () => {
    try {
      showToast('info', '导出功能开发中...')
    } catch (error: any) {
      showToast('error', '导出失败')
    }
  }

  const getMetricText = (metric: string) => {
    const map: Record<string, string> = {
      cpu: 'CPU使用率',
      memory: '内存使用率',
      disk: '磁盘使用率',
      load: '系统负载'
    }
    return map[metric] || metric
  }

  const getSeverityColor = (severity: string) => {
    if (isDark) {
      return severity === 'critical' ? 'bg-red-500/20 text-red-300' :
             severity === 'warning' ? 'bg-yellow-500/20 text-yellow-300' :
             'bg-blue-500/20 text-blue-300'
    }
    return severity === 'critical' ? 'bg-red-100 text-red-700' :
           severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
           'bg-blue-100 text-blue-700'
  }

  const getSeverityText = (severity: string) => {
    return severity === 'critical' ? '严重' :
           severity === 'warning' ? '警告' : '信息'
  }

  const getStatusColor = (status: string) => {
    if (isDark) {
      return status === 'active' ? 'bg-red-500/20 text-red-300' :
             status === 'acknowledged' ? 'bg-yellow-500/20 text-yellow-300' :
             status === 'resolved' ? 'bg-emerald-500/20 text-emerald-300' :
             'bg-gray-500/20 text-gray-400'
    }
    return status === 'active' ? 'bg-red-100 text-red-700' :
           status === 'acknowledged' ? 'bg-yellow-100 text-yellow-700' :
           status === 'resolved' ? 'bg-emerald-100 text-emerald-700' :
           'bg-gray-100 text-gray-600'
  }

  const getStatusText = (status: string) => {
    return status === 'active' ? '活跃' :
           status === 'acknowledged' ? '已确认' :
           status === 'resolved' ? '已解决' : '已忽略'
  }

  const getStatusIcon = (status: string) => {
    return status === 'active' ? <Zap className="w-3 h-3" /> :
           status === 'acknowledged' ? <Clock className="w-3 h-3" /> :
           status === 'resolved' ? <CheckCircle className="w-3 h-3" /> :
           <XCircle className="w-3 h-3" />
  }

  const statistics = useMemo(() => {
    const total = state.statistics.total_count || 0
    const active = state.statistics.status_stats?.active || 0
    const acknowledged = state.statistics.status_stats?.acknowledged || 0
    const resolved = state.statistics.status_stats?.resolved || 0
    const critical = state.statistics.severity_stats?.critical || 0
    return { total, active, acknowledged, resolved, critical }
  }, [state.statistics])

  const columns: Column<AlertRecord>[] = [
    {
      key: 'severity', title: '级别', width: 100, align: 'center',
      render: (_, alert) => (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
          {getSeverityText(alert.severity)}
        </span>
      )
    },
    {
      key: 'message', title: '告警信息', width: 300,
      render: (_, alert) => (
        <div>
          <div className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
            {alert.message}
          </div>
          <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
            {alert.rule_info?.name}
          </div>
        </div>
      )
    },
    {
      key: 'host', title: '主机', width: 150,
      render: (_, alert) => (
        <div>
          <div className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {alert.host_info?.name || '-'}
          </div>
          <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {alert.host_info?.hostname || '-'}
          </div>
        </div>
      )
    },
    {
      key: 'metric', title: '指标', width: 150,
      render: (_, alert) => (
        <div>
          <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {getMetricText(alert.metric_type)}
          </div>
          <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            当前: {alert.metric_value}% / 阈值: {alert.threshold_value}%
          </div>
        </div>
      )
    },
    {
      key: 'trigger_count', title: '触发次数', width: 100, align: 'center',
      render: (_, alert) => (
        <span className={`text-sm font-medium ${
          alert.trigger_count > 10 
            ? (isDark ? 'text-red-400' : 'text-red-600')
            : (isDark ? 'text-gray-300' : 'text-gray-700')
        }`}>
          {alert.trigger_count}
        </span>
      )
    },
    {
      key: 'status', title: '状态', width: 100, align: 'center',
      render: (_, alert) => (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(alert.status)}`}>
          {getStatusIcon(alert.status)}
          <span className="ml-1">{getStatusText(alert.status)}</span>
        </span>
      )
    },
    {
      key: 'time', title: '首次触发时间', width: 150,
      render: (_, alert) => (
        <div>
          <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {formatDateTime(alert.first_triggered_at, 'MM/DD HH:mm')}
          </div>
          {alert.last_triggered_at !== alert.first_triggered_at && (
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              最近: {formatDateTime(alert.last_triggered_at, 'MM/DD HH:mm')}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'actions', title: '操作', width: 120, align: 'center',
      render: (_, alert) => (
        <div className="flex items-center justify-center space-x-1">
          {alert.status === 'active' && (
            <>
              <button onClick={() => handleAcknowledge(alert)} title="确认告警"
                className={`p-2 rounded-lg transition-colors ${
                  isDark ? 'text-yellow-400 hover:bg-yellow-500/20' : 'text-yellow-600 hover:bg-yellow-50'
                }`}>
                <Clock className="w-4 h-4" />
              </button>
              <button onClick={() => handleIgnore(alert)} title="忽略告警"
                className={`p-2 rounded-lg transition-colors ${
                  isDark ? 'text-gray-400 hover:bg-gray-500/20' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                <XCircle className="w-4 h-4" />
              </button>
            </>
          )}
          <button onClick={() => navigate(`/monitor/history/detail/${alert.id}`)} title="查看详情"
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'text-blue-400 hover:bg-blue-500/20' : 'text-blue-600 hover:bg-blue-50'
            }`}>
            <Eye className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ]

  const paginationConfig: PaginationConfig = {
    current: state.pagination.page, pageSize: state.pagination.per_page, total: state.pagination.total,
    showSizeChanger: true, showQuickJumper: true, showTotal: true, pageSizeOptions: [10, 20, 50, 100], onChange: handlePageChange
  }

  const headerActions = (
    <div className="flex items-center space-x-3">
      <button onClick={handleExport}
        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
          isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}>
        <Download className="w-4 h-4" /><span>导出</span>
      </button>
    </div>
  )

  return (
    <MonitorPageLayout title="告警历史" subtitle="查看和管理历史告警记录" icon={Activity}
      iconGradient="from-orange-500 via-red-500 to-pink-500" headerActions={headerActions}
      loading={state.loading} onRefresh={() => loadAlerts(state.pagination.page)} showFullscreen={false}>
      
      {/* Toast */}
      {state.toast.show && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-top-2">
          <div className={`px-4 py-3 rounded-xl shadow-xl border flex items-center space-x-3 ${
            state.toast.type === 'success' ? (isDark ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800') :
            state.toast.type === 'error' ? (isDark ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-800') :
            state.toast.type === 'warning' ? (isDark ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800') :
            (isDark ? 'bg-blue-500/20 border-blue-500/30 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-800')
          }`}>
            {state.toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {state.toast.type === 'error' && <XCircle className="w-5 h-5" />}
            {state.toast.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
            {state.toast.type === 'info' && <Info className="w-5 h-5" />}
            <span className="text-sm font-medium">{state.toast.message}</span>
          </div>
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 mb-6">
        <MonitorStatCard title="总告警数" value={statistics.total} subtitle="所有告警记录" icon={Activity} iconColorClass="text-blue-400" glowColor="bg-blue-500" />
        <MonitorStatCard title="活跃告警" value={statistics.active} subtitle="需要处理的告警" icon={Zap} variant="danger" iconColorClass="text-red-400" glowColor="bg-red-500" />
        <MonitorStatCard title="已确认" value={statistics.acknowledged} subtitle="已确认的告警" icon={Clock} iconColorClass="text-yellow-400" glowColor="bg-yellow-500" />
        <MonitorStatCard title="已解决" value={statistics.resolved} subtitle="已解决的告警" icon={CheckCircle} variant="success" iconColorClass="text-emerald-400" glowColor="bg-emerald-500" />
        <MonitorStatCard title="严重告警" value={statistics.critical} subtitle="严重级别告警" icon={AlertTriangle}
          variant={statistics.critical > 0 ? 'danger' : 'default'} valueColorClass={statistics.critical > 0 ? 'text-red-500' : undefined}
          iconColorClass={statistics.critical > 0 ? 'text-red-400' : 'text-gray-400'} glowColor="bg-red-500" />
      </div>

      {/* 搜索和筛选 */}
      <MonitorContentCard className="mb-6">
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>关键词</label>
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <input type="text" value={state.search} onChange={(e) => handleSearch(e.target.value)} placeholder="搜索告警信息或规则名称"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                    isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                  }`} />
              </div>
            </div>
            <div className="w-32">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>状态</label>
              <select value={state.statusFilter} onChange={(e) => handleFilterChange('status', e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`}>
                <option value="">全部状态</option>
                <option value="active">活跃</option>
                <option value="acknowledged">已确认</option>
                <option value="resolved">已解决</option>
                <option value="ignored">已忽略</option>
              </select>
            </div>
            <div className="w-32">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>级别</label>
              <select value={state.severityFilter} onChange={(e) => handleFilterChange('severity', e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`}>
                <option value="">全部级别</option>
                <option value="critical">严重</option>
                <option value="warning">警告</option>
                <option value="info">信息</option>
              </select>
            </div>
            <div className="w-40">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>指标</label>
              <select value={state.metricFilter} onChange={(e) => handleFilterChange('metric', e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`}>
                <option value="">全部指标</option>
                <option value="cpu">CPU使用率</option>
                <option value="memory">内存使用率</option>
                <option value="disk">磁盘使用率</option>
                <option value="load">系统负载</option>
              </select>
            </div>
          </div>
          
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-48">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>开始时间</label>
              <input type="datetime-local" value={state.dateRange.start} onChange={(e) => handleDateRangeChange('start', e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`} />
            </div>
            <div className="w-48">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>结束时间</label>
              <input type="datetime-local" value={state.dateRange.end} onChange={(e) => handleDateRangeChange('end', e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`} />
            </div>
          </div>
        </div>
      </MonitorContentCard>

      {/* 错误提示 */}
      {state.error && (
        <div className={`mb-6 p-4 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {state.error}
        </div>
      )}

      {/* 告警列表 */}
      <MonitorContentCard title="告警记录" icon={Activity}
        headerActions={<span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>共 {state.pagination.total} 条记录</span>} noPadding>
        <DataTable columns={columns} dataSource={state.alerts} loading={state.loading} pagination={paginationConfig} rowKey="id" size="middle" />
      </MonitorContentCard>

      {/* 确认对话框 */}
      <ConfirmDialog {...confirmDialog.dialogProps} />
    </MonitorPageLayout>
  )
}