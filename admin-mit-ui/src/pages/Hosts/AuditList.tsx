/**
 * 审计日志列表页面 - 美化版
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Trash2, CheckCircle, AlertTriangle, Calendar, User, Terminal, Shield, ChevronDown, ChevronUp, X, Server, FileSearch, Clock, RefreshCw } from 'lucide-react'
import { DataTable } from '../../components/Table'
import { Loading } from '../../components/Loading'
import { Modal } from '../../components/Modal'
import { hostAuditService } from '../../services/hostAudit'
import { hostsService } from '../../services/hosts'
import { formatDateTime } from '../../utils'
import { useAuthStore } from '../../store/auth'
import { useTheme } from '../../hooks/useTheme'
import { MonitorPageLayout, MonitorStatCard, MonitorContentCard } from '../../components/Monitor/MonitorPageLayout'
import type { AuditLog, AuditLogStatus, AuditLogQuery, AuditLogStats } from '../../types/audit'
import type { Host } from '../../types/host'

interface AuditListState {
  hosts: Host[]; hostsLoading: boolean; selectedHostId: number | null; logs: AuditLog[]; loading: boolean; error: string | null
  pagination: { page: number; page_size: number; total: number; pages: number }
  filters: AuditLogQuery; stats: AuditLogStats | null; statsLoading: boolean
  showClearModal: boolean; clearDays: number; clearing: boolean; expandedLogId: number | null
  toast: { show: boolean; type: 'success' | 'error' | 'warning' | 'info'; message: string }
}

export const AuditList: React.FC = () => {
  const { hasPermission } = useAuthStore()
  const { isDark } = useTheme()
  
  const [state, setState] = useState<AuditListState>({
    hosts: [], hostsLoading: true, selectedHostId: null, logs: [], loading: false, error: null,
    pagination: { page: 1, page_size: 50, total: 0, pages: 0 },
    filters: { page: 1, page_size: 50 }, stats: null, statsLoading: false,
    showClearModal: false, clearDays: 30, clearing: false, expandedLogId: null,
    toast: { show: false, type: 'info', message: '' }
  })

  const showToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setState(prev => ({ ...prev, toast: { show: true, type, message } }))
    setTimeout(() => setState(prev => ({ ...prev, toast: { ...prev.toast, show: false } })), 3000)
  }, [])

  const loadHosts = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, hostsLoading: true }))
      const response = await hostsService.getHosts({ page: 1, per_page: 1000 })
      const hostList = response.hosts || []
      setState(prev => ({ ...prev, hosts: hostList, hostsLoading: false, selectedHostId: hostList.length > 0 ? hostList[0].id : null }))
      if (hostList.length > 0) { loadLogs(hostList[0].id); loadStats(hostList[0].id) }
    } catch (error: any) { setState(prev => ({ ...prev, hostsLoading: false })) }
  }, [])

  const loadLogs = useCallback(async (hostId?: number, filters?: AuditLogQuery) => {
    const targetHostId = hostId || state.selectedHostId
    if (!targetHostId) return
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      const response = await hostAuditService.getAuditLogs(targetHostId, filters || state.filters)
      setState(prev => ({ ...prev, logs: response.logs || [], pagination: response.pagination || prev.pagination, loading: false }))
    } catch (error: any) { setState(prev => ({ ...prev, error: error.message || '加载审计日志失败', loading: false })) }
  }, [state.selectedHostId, state.filters])

  const loadStats = useCallback(async (hostId?: number) => {
    const targetHostId = hostId || state.selectedHostId
    if (!targetHostId) return
    try {
      setState(prev => ({ ...prev, statsLoading: true }))
      const stats = await hostAuditService.getAuditStats(targetHostId, 30)
      setState(prev => ({ ...prev, stats, statsLoading: false }))
    } catch (error: any) { setState(prev => ({ ...prev, statsLoading: false })) }
  }, [state.selectedHostId])

  useEffect(() => {
    loadHosts()
  }, [])

  // 切换主机
  const handleHostChange = (hostId: number) => {
    setState(prev => ({ 
      ...prev, 
      selectedHostId: hostId,
      filters: { page: 1, page_size: 50 }
    }))
    loadLogs(hostId, { page: 1, page_size: 50 })
    loadStats(hostId)
  }

  // 处理筛选变化
  const handleFilterChange = (key: keyof AuditLogQuery, value: any) => {
    const newFilters = { ...state.filters, [key]: value || undefined, page: 1 }
    setState(prev => ({ ...prev, filters: newFilters }))
    loadLogs(state.selectedHostId || undefined, newFilters)
  }

  // 处理分页变化
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

  // 清除筛选
  const handleClearFilters = () => {
    const newFilters: AuditLogQuery = { page: 1, page_size: 50 }
    setState(prev => ({ ...prev, filters: newFilters }))
    loadLogs(state.selectedHostId || undefined, newFilters)
  }

  // 执行清理
  const handleClearLogs = async () => {
    if (!state.selectedHostId) return
    
    try {
      setState(prev => ({ ...prev, clearing: true }))
      const result = await hostAuditService.clearAuditLogs(state.selectedHostId, state.clearDays)
      
      showToast('success', `已清理 ${result.deleted_count} 条审计日志`)
      setState(prev => ({ ...prev, showClearModal: false, clearing: false }))
      
      loadLogs()
      loadStats()
    } catch (error: any) {
      showToast('error', error.message || '清理审计日志失败')
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
  const getStatusDisplay = (status: AuditLogStatus) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            成功
          </span>
        )
      case 'blocked':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <Shield className="w-3 h-3 mr-1" />
            已阻止
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            失败
          </span>
        )
      default:
        return <span className="text-gray-500">未知</span>
    }
  }

  const selectedHost = state.hosts.find(h => h.id === state.selectedHostId)
  const hasFilters = state.filters.user_id || state.filters.status || 
                     state.filters.start_date || state.filters.end_date

  // 表格列定义
  const columns = [
    {
      key: 'executed_at',
      title: '执行时间',
      width: 160,
      render: (_: any, log: AuditLog) => (
        <div className="text-sm text-gray-900">
          {formatDateTime(log.executed_at, 'MM-DD HH:mm:ss')}
        </div>
      )
    },
    {
      key: 'username',
      title: '用户',
      width: 120,
      render: (_: any, log: AuditLog) => (
        <div className="flex items-center">
          <User className="w-4 h-4 text-gray-400 mr-2" />
          <span className="text-sm text-gray-900">{log.username || '-'}</span>
        </div>
      )
    },
    {
      key: 'command',
      title: '命令',
      render: (_: any, log: AuditLog) => (
        <div className="flex items-center">
          <Terminal className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
          <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded max-w-md truncate">
            {log.command}
          </code>
        </div>
      )
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      align: 'center' as const,
      render: (_: any, log: AuditLog) => getStatusDisplay(log.status)
    },
    {
      key: 'ip_address',
      title: 'IP地址',
      width: 130,
      render: (_: any, log: AuditLog) => (
        <span className="text-sm text-gray-500">{log.ip_address || '-'}</span>
      )
    },
    {
      key: 'actions',
      title: '',
      width: 50,
      align: 'center' as const,
      render: (_: any, log: AuditLog) => (
        <button
          onClick={() => toggleLogExpand(log.id)}
          className="text-gray-400 hover:text-gray-600"
          title="查看详情"
        >
          {state.expandedLogId === log.id ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      )
    }
  ]

  if (state.hostsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loading size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {state.toast.show && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          <div className={`px-4 py-3 rounded-lg shadow-xl border flex items-start space-x-3 ${
            state.toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
            state.toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <p className="text-sm font-medium flex-1">{state.toast.message}</p>
            <button onClick={() => setState(prev => ({ ...prev, toast: { ...prev.toast, show: false } }))}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <FileSearch className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">主机审计日志</h1>
            <p className="mt-1 text-sm text-gray-500">查看和管理 WebShell 命令执行审计记录</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={state.loading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${state.loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          
          {hasPermission('host:audit:config') && state.selectedHostId && (
            <button
              onClick={() => setState(prev => ({ ...prev, showClearModal: true, clearDays: 30 }))}
              className="inline-flex items-center px-3 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              清理日志
            </button>
          )}
        </div>
      </div>

      {/* 主机选择和统计 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* 主机选择 */}
        <div className="bg-white rounded-lg shadow p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Server className="w-4 h-4 inline mr-1" />
            选择主机
          </label>
          <select
            value={state.selectedHostId || ''}
            onChange={(e) => handleHostChange(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {state.hosts.map(host => (
              <option key={host.id} value={host.id}>
                {host.name} ({host.hostname})
              </option>
            ))}
          </select>
        </div>

        {/* 统计卡片 */}
        {state.stats && (
          <>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-2 bg-blue-100 rounded-lg">
                  <Terminal className="w-5 h-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-xs text-gray-500">总命令数</p>
                  <p className="text-xl font-semibold text-gray-900">{state.stats.total_commands}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-xs text-gray-500">成功执行</p>
                  <p className="text-xl font-semibold text-gray-900">{state.stats.success_count}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-2 bg-red-100 rounded-lg">
                  <Shield className="w-5 h-5 text-red-600" />
                </div>
                <div className="ml-3">
                  <p className="text-xs text-gray-500">已阻止</p>
                  <p className="text-xl font-semibold text-gray-900">{state.stats.blocked_count}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-2 bg-yellow-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="ml-3">
                  <p className="text-xs text-gray-500">执行失败</p>
                  <p className="text-xl font-semibold text-gray-900">{state.stats.failed_count}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 筛选表单 */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
            <select
              value={state.filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value as AuditLogStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部状态</option>
              <option value="success">成功</option>
              <option value="blocked">已阻止</option>
              <option value="failed">失败</option>
            </select>
          </div>
          
          <div className="min-w-[180px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
            <div className="relative">
              <input
                type="date"
                value={state.filters.start_date?.split('T')[0] || ''}
                onChange={(e) => handleFilterChange('start_date', e.target.value ? `${e.target.value}T00:00:00Z` : undefined)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            </div>
          </div>
          
          <div className="min-w-[180px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
            <div className="relative">
              <input
                type="date"
                value={state.filters.end_date?.split('T')[0] || ''}
                onChange={(e) => handleFilterChange('end_date', e.target.value ? `${e.target.value}T23:59:59Z` : undefined)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            </div>
          </div>
          
          {hasFilters && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <X className="w-4 h-4 mr-1" />
              清除筛选
            </button>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-sm text-red-600">{state.error}</div>
        </div>
      )}

      {/* 审计日志列表 */}
      {state.selectedHostId ? (
        <div className="bg-white shadow rounded-lg">
          <DataTable
            columns={columns}
            dataSource={state.logs}
            loading={state.loading}
            pagination={{
              current: state.pagination.page,
              pageSize: state.pagination.page_size,
              total: state.pagination.total,
              showTotal: true,
              onChange: handlePageChange
            }}
            emptyText="暂无审计日志"
            expandable={{
              expandedRowKeys: state.expandedLogId ? [state.expandedLogId] : [],
              expandedRowRender: (log: AuditLog) => (
                <div className="p-4 bg-gray-50 space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">完整命令</h4>
                    <pre className="text-sm font-mono bg-gray-800 text-green-400 p-3 rounded overflow-x-auto">
                      {log.command}
                    </pre>
                  </div>
                  
                  {log.block_reason && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">阻止原因</h4>
                      <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{log.block_reason}</p>
                    </div>
                  )}
                  
                  {log.output_summary && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">输出摘要</h4>
                      <pre className="text-sm font-mono bg-gray-100 p-3 rounded overflow-x-auto max-h-48 overflow-y-auto">
                        {log.output_summary}
                      </pre>
                    </div>
                  )}
                  
                  {log.error_message && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">错误信息</h4>
                      <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{log.error_message}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">会话ID:</span>
                      <span className="ml-2 text-gray-900">{log.session_id || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">执行时间:</span>
                      <span className="ml-2 text-gray-900">{formatDateTime(log.executed_at)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">IP地址:</span>
                      <span className="ml-2 text-gray-900">{log.ip_address || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">耗时:</span>
                      <span className="ml-2 text-gray-900">
                        {log.execution_time ? `${log.execution_time.toFixed(3)}秒` : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            }}
          />
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <Server className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">请先选择一个主机查看审计日志</p>
        </div>
      )}

      {/* 清理日志对话框 */}
      <Modal
        isOpen={state.showClearModal}
        onClose={() => setState(prev => ({ ...prev, showClearModal: false }))}
        title="清理审计日志"
        size="sm"
        footer={
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setState(prev => ({ ...prev, showClearModal: false }))}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleClearLogs}
              disabled={state.clearing}
              className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {state.clearing ? '清理中...' : '确认清理'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            此操作将删除 <strong>{selectedHost?.name}</strong> 指定天数之前的审计日志，删除后无法恢复。
          </p>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">保留最近多少天的日志</label>
            <select
              value={state.clearDays}
              onChange={(e) => setState(prev => ({ ...prev, clearDays: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>清理所有日志</option>
              <option value={7}>保留最近 7 天</option>
              <option value={30}>保留最近 30 天</option>
              <option value={60}>保留最近 60 天</option>
              <option value={90}>保留最近 90 天</option>
            </select>
          </div>
          
          {state.clearDays === 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                警告：您选择了清理所有日志，此操作不可撤销！
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default AuditList
