/**
 * 告警规则列表组件
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, Edit, Trash2, Power, PowerOff, RefreshCw, 
  AlertTriangle, Activity, CheckCircle, XCircle, Server, Bell, Filter
} from 'lucide-react'
import { api } from '../../../services/api'
import { formatDateTime } from '../../../utils'
import { useAuthStore } from '../../../store/auth'
import { useTheme } from '../../../hooks/useTheme'
import { MonitorPageLayout, MonitorStatCard, MonitorContentCard, ConfirmDialog, useConfirmDialog } from '../../../components/Monitor'
import { DataTable, Column, PaginationConfig } from '../../../components/Table'

interface AlertRule {
  id: number
  name: string
  description?: string
  metric_type: 'cpu' | 'memory' | 'disk' | 'load'
  condition_operator: string
  threshold_value: number
  duration: number
  severity: 'info' | 'warning' | 'critical'
  enabled: boolean
  host_ids?: number[]
  channel_ids: number[]
  silence_period: number
  created_at: string
  updated_at: string
  channels?: Array<{ id: number; name: string; type: string }>
  hosts?: Array<{ id: number; name: string; hostname: string }>
  applies_to_all_hosts?: boolean
  recent_alerts_count?: number
}

interface RuleListState {
  rules: AlertRule[]
  loading: boolean
  error: string | null
  pagination: { page: number; per_page: number; total: number; pages: number }
  search: string
  metricFilter: string
  severityFilter: string
  enabledFilter: string
  toast: { show: boolean; type: 'success' | 'error' | 'warning' | 'info'; message: string }
}

export const RuleList: React.FC = () => {
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const { isDark } = useTheme()
  const confirmDialog = useConfirmDialog()
  
  const [state, setState] = useState<RuleListState>({
    rules: [], loading: true, error: null,
    pagination: { page: 1, per_page: 10, total: 0, pages: 0 },
    search: '', metricFilter: '', severityFilter: '', enabledFilter: '',
    toast: { show: false, type: 'info', message: '' }
  })

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setState(prev => ({ ...prev, toast: { show: true, type, message } }))
    setTimeout(() => setState(prev => ({ ...prev, toast: { ...prev.toast, show: false } })), 3000)
  }

  const loadRules = useCallback(async (page = 1) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      const response = await api.get('/api/monitor/rules', {
        params: {
          page,
          per_page: state.pagination.per_page,
          search: state.search || undefined,
          metric_type: state.metricFilter || undefined,
          severity: state.severityFilter || undefined,
          enabled: state.enabledFilter ? parseInt(state.enabledFilter) : undefined
        }
      })
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          rules: response.data.rules || [],
          pagination: response.data.pagination || prev.pagination,
          loading: false
        }))
      }
    } catch (error: any) {
      setState(prev => ({ 
        ...prev, 
        error: error.message || '加载告警规则失败', 
        loading: false 
      }))
      showToast('error', error.message || '加载告警规则失败')
    }
  }, [state.pagination.per_page, state.search, state.metricFilter, state.severityFilter, state.enabledFilter])

  useEffect(() => { loadRules() }, [])

  const searchTimeoutRef = React.useRef<NodeJS.Timeout>()
  const handleSearch = (searchValue: string) => {
    setState(prev => ({ ...prev, search: searchValue }))
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => loadRules(1), 300)
  }

  const handleFilterChange = (filterType: 'metric' | 'severity' | 'enabled', value: string) => {
    setState(prev => ({
      ...prev,
      metricFilter: filterType === 'metric' ? value : prev.metricFilter,
      severityFilter: filterType === 'severity' ? value : prev.severityFilter,
      enabledFilter: filterType === 'enabled' ? value : prev.enabledFilter
    }))
    setTimeout(() => loadRules(1), 100)
  }

  const handlePageChange = (page: number, pageSize: number) => {
    setState(prev => ({ ...prev, pagination: { ...prev.pagination, page, per_page: pageSize } }))
    loadRules(page)
  }

  const handleToggleEnabled = async (rule: AlertRule) => {
    try {
      const endpoint = rule.enabled ? 'disable' : 'enable'
      const response = await api.post(`/api/monitor/rules/${rule.id}/${endpoint}`)
      
      if (response.success) {
        showToast('success', `规则已${rule.enabled ? '禁用' : '启用'}`)
        loadRules(state.pagination.page)
      }
    } catch (error: any) {
      showToast('error', error.message || `${rule.enabled ? '禁用' : '启用'}规则失败`)
    }
  }

  const handleDelete = async (rule: AlertRule) => {
    confirmDialog.show({
      title: '删除告警规则',
      variant: 'danger',
      confirmText: '确认删除',
      message: (
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
              <Bell className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
            </div>
            <div>
              <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{rule.name}</p>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {getMetricText(rule.metric_type)} {rule.condition_operator} {rule.threshold_value}%
              </p>
            </div>
          </div>
          <p className={`text-sm ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
            <AlertTriangle className="w-4 h-4 inline mr-1" />
            此操作不可恢复，规则相关的所有数据将被永久删除。
          </p>
        </div>
      ),
      onConfirm: async () => {
        try {
          const response = await api.post(`/api/monitor/rules/${rule.id}/delete`)
          if (response.success) {
            showToast('success', `规则 "${rule.name}" 已删除`)
            loadRules(state.pagination.page)
          }
        } catch (error: any) {
          showToast('error', `删除失败: ${error.message}`)
        }
      }
    })
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

  const statistics = useMemo(() => {
    const total = state.pagination.total
    const enabled = state.rules.filter(r => r.enabled).length
    const disabled = state.rules.filter(r => !r.enabled).length
    const critical = state.rules.filter(r => r.severity === 'critical').length
    return { total, enabled, disabled, critical }
  }, [state.rules, state.pagination.total])

  const columns: Column<AlertRule>[] = [
    {
      key: 'name', title: '规则名称', width: 250,
      render: (_, rule) => (
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-xl ${isDark ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20' : 'bg-gradient-to-br from-blue-50 to-cyan-50'}`}>
            <Bell className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
          </div>
          <div className="min-w-0">
            <button onClick={() => navigate(`/monitor/rules/edit/${rule.id}`)}
              className={`font-semibold hover:underline text-left ${isDark ? 'text-white hover:text-blue-400' : 'text-gray-900 hover:text-blue-600'}`}>
              {rule.name}
            </button>
            {rule.description && (
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} truncate`}>{rule.description}</div>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'metric', title: '监控指标', width: 180,
      render: (_, rule) => (
        <div>
          <div className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {getMetricText(rule.metric_type)}
          </div>
          <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {rule.condition_operator} {rule.threshold_value}%
          </div>
        </div>
      )
    },
    {
      key: 'severity', title: '严重级别', width: 100, align: 'center',
      render: (_, rule) => (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getSeverityColor(rule.severity)}`}>
          {getSeverityText(rule.severity)}
        </span>
      )
    },
    {
      key: 'scope', title: '应用范围', width: 120,
      render: (_, rule) => (
        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          {rule.applies_to_all_hosts ? '所有主机' : `${rule.hosts?.length || 0} 台主机`}
        </span>
      )
    },
    {
      key: 'channels', title: '告警渠道', width: 150,
      render: (_, rule) => (
        <div className="flex flex-wrap gap-1">
          {rule.channels?.slice(0, 2).map(channel => (
            <span key={channel.id} className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
              isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
            }`}>
              {channel.name}
            </span>
          ))}
          {(rule.channels?.length || 0) > 2 && (
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              +{(rule.channels?.length || 0) - 2}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'alerts', title: '近期告警', width: 100, align: 'center',
      render: (_, rule) => (
        <span className={`text-sm font-medium ${
          (rule.recent_alerts_count || 0) > 0 
            ? (isDark ? 'text-red-400' : 'text-red-600')
            : (isDark ? 'text-gray-500' : 'text-gray-400')
        }`}>
          {rule.recent_alerts_count || 0}
        </span>
      )
    },
    {
      key: 'enabled', title: '状态', width: 100, align: 'center',
      render: (_, rule) => (
        rule.enabled ? (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
            isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
          }`}>
            <CheckCircle className="w-3 h-3 mr-1" />已启用
          </span>
        ) : (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
            isDark ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-600'
          }`}>
            <XCircle className="w-3 h-3 mr-1" />已禁用
          </span>
        )
      )
    },
    {
      key: 'actions', title: '操作', width: 140, align: 'center',
      render: (_, rule) => (
        <div className="flex items-center justify-center space-x-1">
          <button onClick={() => handleToggleEnabled(rule)} title={rule.enabled ? '禁用规则' : '启用规则'}
            className={`p-2 rounded-lg transition-colors ${
              rule.enabled 
                ? (isDark ? 'text-yellow-400 hover:bg-yellow-500/20' : 'text-yellow-600 hover:bg-yellow-50')
                : (isDark ? 'text-emerald-400 hover:bg-emerald-500/20' : 'text-emerald-600 hover:bg-emerald-50')
            }`}>
            {rule.enabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
          </button>
          {hasPermission('monitor:update') && (
            <button onClick={() => navigate(`/monitor/rules/edit/${rule.id}`)} title="编辑规则"
              className={`p-2 rounded-lg transition-colors ${isDark ? 'text-blue-400 hover:bg-blue-500/20' : 'text-blue-600 hover:bg-blue-50'}`}>
              <Edit className="w-4 h-4" />
            </button>
          )}
          {hasPermission('monitor:delete') && (
            <button onClick={() => handleDelete(rule)} title="删除规则"
              className={`p-2 rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-600 hover:bg-red-50'}`}>
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ]

  const paginationConfig: PaginationConfig = {
    current: state.pagination.page, pageSize: state.pagination.per_page, total: state.pagination.total,
    showSizeChanger: true, showQuickJumper: true, showTotal: true, pageSizeOptions: [10, 20, 50, 100], onChange: handlePageChange
  }

  const headerActions = hasPermission('monitor:create') && (
    <button onClick={() => navigate('/monitor/rules/create')}
      className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium overflow-hidden transition-all">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <Plus className="relative w-4 h-4" /><span className="relative">创建规则</span>
    </button>
  )

  return (
    <MonitorPageLayout title="告警规则" subtitle="配置和管理系统告警规则" icon={Bell}
      iconGradient="from-blue-500 via-purple-500 to-pink-500" headerActions={headerActions}
      loading={state.loading} onRefresh={() => loadRules(state.pagination.page)} showFullscreen={false}>
      
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
            {state.toast.type === 'info' && <Activity className="w-5 h-5" />}
            <span className="text-sm font-medium">{state.toast.message}</span>
          </div>
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <MonitorStatCard title="总规则数" value={statistics.total} subtitle="系统中所有规则" icon={Bell} iconColorClass="text-blue-400" glowColor="bg-blue-500" />
        <MonitorStatCard title="已启用" value={statistics.enabled} subtitle="正在运行的规则" icon={CheckCircle} variant="success" iconColorClass="text-emerald-400" glowColor="bg-emerald-500" />
        <MonitorStatCard title="已禁用" value={statistics.disabled} subtitle="暂停的规则" icon={XCircle} iconColorClass="text-gray-400" glowColor="bg-gray-500" />
        <MonitorStatCard title="严重级别" value={statistics.critical} subtitle="严重告警规则" icon={AlertTriangle}
          variant={statistics.critical > 0 ? 'danger' : 'default'} valueColorClass={statistics.critical > 0 ? 'text-red-500' : undefined}
          iconColorClass={statistics.critical > 0 ? 'text-red-400' : 'text-gray-400'} glowColor="bg-red-500" />
      </div>

      {/* 搜索和筛选 */}
      <MonitorContentCard className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>关键词</label>
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              <input type="text" value={state.search} onChange={(e) => handleSearch(e.target.value)} placeholder="搜索规则名称或描述"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                }`} />
            </div>
          </div>
          <div className="w-40">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>监控指标</label>
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
          <div className="w-32">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>严重级别</label>
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
          <div className="w-32">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>状态</label>
            <select value={state.enabledFilter} onChange={(e) => handleFilterChange('enabled', e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
              }`}>
              <option value="">全部状态</option>
              <option value="1">已启用</option>
              <option value="0">已禁用</option>
            </select>
          </div>
        </div>
      </MonitorContentCard>

      {/* 错误提示 */}
      {state.error && (
        <div className={`mb-6 p-4 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {state.error}
        </div>
      )}

      {/* 规则列表 */}
      <MonitorContentCard title="规则列表" icon={Bell}
        headerActions={<span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>共 {state.pagination.total} 条规则</span>} noPadding>
        <DataTable columns={columns} dataSource={state.rules} loading={state.loading} pagination={paginationConfig} rowKey="id" size="middle" />
      </MonitorContentCard>

      {/* 删除确认弹窗 */}
      <ConfirmDialog {...confirmDialog.dialogProps} />
    </MonitorPageLayout>
  )
}