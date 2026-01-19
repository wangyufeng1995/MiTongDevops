/**
 * 主机列表组件 - 美化版
 */
import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Server, Search, Edit, Trash2, Activity, CheckCircle, XCircle, Clock, RefreshCw, Terminal, Upload, FolderOpen, Wifi, WifiOff, AlertTriangle } from 'lucide-react'
import { DataTable, Column, PaginationConfig } from '../../components/Table'
import { hostsService } from '../../services/hosts'
import { hostGroupsService } from '../../services/hostGroups'
import { formatDateTime } from '../../utils'
import { useAuthStore } from '../../store/auth'
import { useTheme } from '../../hooks/useTheme'
import { HostImportModal } from './HostImportModal'
import { MonitorPageLayout, MonitorStatCard, MonitorContentCard, ConfirmDialog, useConfirmDialog } from '../../components/Monitor'
import type { Host, HostListResponse, HostGroup } from '../../types/host'

interface HostListState {
  hosts: Host[]
  loading: boolean
  error: string | null
  pagination: { page: number; per_page: number; total: number; pages: number }
  search: string
  groups: HostGroup[]
  groupsLoading: boolean
  selectedGroupId: number | null
  probingHosts: Set<number>
  selectedHosts: Set<number>
  batchProbing: boolean
  toast: { show: boolean; type: 'success' | 'error' | 'warning' | 'info'; message: string }
  showImportModal: boolean
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export const HostList: React.FC = () => {
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const { isDark } = useTheme()
  const confirmDialog = useConfirmDialog()
  
  const [state, setState] = useState<HostListState>({
    hosts: [], loading: true, error: null,
    pagination: { page: 1, per_page: 10, total: 0, pages: 0 },
    search: '', groups: [], groupsLoading: false, selectedGroupId: null,
    probingHosts: new Set(), selectedHosts: new Set(), batchProbing: false,
    toast: { show: false, type: 'info', message: '' }, showImportModal: false,
    sortBy: 'name', sortOrder: 'asc'
  })

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setState(prev => ({ ...prev, toast: { show: true, type, message } }))
    setTimeout(() => setState(prev => ({ ...prev, toast: { ...prev.toast, show: false } })), 3000)
  }

  const loadGroups = async () => {
    try {
      setState(prev => ({ ...prev, groupsLoading: true }))
      const response = await hostGroupsService.getGroups({ per_page: 100 })
      setState(prev => ({ ...prev, groups: response?.groups || [], groupsLoading: false }))
    } catch (error: any) {
      console.error('加载分组列表失败:', error.message)
      setState(prev => ({ ...prev, groupsLoading: false }))
    }
  }

  const loadHosts = async (page = 1, search = '', groupId: number | null = state.selectedGroupId, sortBy = state.sortBy, sortOrder = state.sortOrder) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      const response: HostListResponse = await hostsService.getHosts({
        page, per_page: state.pagination.per_page, search: search.trim() || undefined, group_id: groupId,
        sort_by: sortBy, sort_order: sortOrder
      })
      setState(prev => ({
        ...prev, hosts: response?.hosts || [], pagination: response?.pagination || prev.pagination,
        loading: false, selectedHosts: new Set()
      }))
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message || '加载主机列表失败', loading: false }))
    }
  }

  useEffect(() => { loadGroups(); loadHosts() }, [])

  const handleGroupFilter = (groupId: number | null) => {
    setState(prev => ({ ...prev, selectedGroupId: groupId }))
    loadHosts(1, state.search, groupId, state.sortBy, state.sortOrder)
  }

  const handleSort = (sortBy: string) => {
    const newOrder = state.sortBy === sortBy && state.sortOrder === 'asc' ? 'desc' : 'asc'
    setState(prev => ({ ...prev, sortBy, sortOrder: newOrder }))
    loadHosts(1, state.search, state.selectedGroupId, sortBy, newOrder)
  }

  const searchTimeoutRef = React.useRef<NodeJS.Timeout>()
  const handleSearch = React.useCallback((searchValue: string) => {
    setState(prev => ({ ...prev, search: searchValue }))
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => loadHosts(1, searchValue), 300)
  }, [])

  const handlePageChange = (page: number, pageSize: number) => {
    setState(prev => ({ ...prev, pagination: { ...prev.pagination, page, per_page: pageSize } }))
    loadHosts(page, state.search, state.selectedGroupId)
  }

  const handleHostSelect = (hostId: number, selected: boolean) => {
    setState(prev => {
      const newSelected = new Set(prev.selectedHosts)
      selected ? newSelected.add(hostId) : newSelected.delete(hostId)
      return { ...prev, selectedHosts: newSelected }
    })
  }

  const handleProbeHost = async (host: Host) => {
    if (state.probingHosts.has(host.id)) return
    setState(prev => ({ ...prev, probingHosts: new Set([...prev.probingHosts, host.id]) }))
    try {
      const result = await hostsService.probeHost(host.id)
      pollProbeStatus(result.task_id, host.id, host.name)
    } catch (error: any) {
      showToast('error', `主机 ${host.name} 探测任务提交失败`)
      setState(prev => ({ ...prev, probingHosts: new Set([...prev.probingHosts].filter(id => id !== host.id)) }))
    }
  }

  const handleBatchProbe = async () => {
    if (state.selectedHosts.size === 0 || state.batchProbing) return
    setState(prev => ({ ...prev, batchProbing: true }))
    try {
      const hostIds = Array.from(state.selectedHosts)
      const result = await hostsService.probeBatch(hostIds)
      setState(prev => ({ ...prev, probingHosts: new Set([...prev.probingHosts, ...hostIds]) }))
      result.task_ids.forEach((taskId, index) => {
        const host = state.hosts.find(h => h.id === hostIds[index])
        pollProbeStatus(taskId, hostIds[index], host?.name || `主机${hostIds[index]}`)
      })
      showToast('info', `已提交 ${hostIds.length} 个主机的探测任务`)
    } catch (error: any) {
      showToast('error', '批量探测任务提交失败')
    } finally {
      setState(prev => ({ ...prev, batchProbing: false }))
    }
  }

  const pollProbeStatus = async (taskId: string, hostId: number, hostName: string) => {
    const maxAttempts = 3, pollInterval = 2000
    let attempts = 0
    const poll = async () => {
      try {
        const status = await hostsService.getProbeTaskStatus(taskId)
        if (status.status === 'success') {
          // 更新主机状态，同时更新 host_info（如果有）
          setState(prev => ({
            ...prev,
            hosts: prev.hosts.map(h => h.id === hostId ? { 
              ...h, 
              last_probe_status: 'success', 
              last_probe_at: new Date().toISOString(),
              host_info: status.result?.host_info || h.host_info
            } : h),
            probingHosts: new Set([...prev.probingHosts].filter(id => id !== hostId))
          }))
          showToast('success', `主机 ${hostName} 探测成功`)
          return
        }
        if (status.status === 'failed' || status.status === 'timeout') {
          setState(prev => ({
            ...prev,
            hosts: prev.hosts.map(h => h.id === hostId ? { ...h, last_probe_status: 'failed', last_probe_at: new Date().toISOString() } : h),
            probingHosts: new Set([...prev.probingHosts].filter(id => id !== hostId))
          }))
          showToast('error', `${hostName}: ${status.error || '探测失败'}`)
          return
        }
        attempts++
        if (attempts >= maxAttempts) {
          setState(prev => ({
            ...prev, hosts: prev.hosts.map(h => h.id === hostId ? { ...h, last_probe_status: 'failed' } : h),
            probingHosts: new Set([...prev.probingHosts].filter(id => id !== hostId))
          }))
          showToast('warning', `${hostName}: 探测任务超时`)
          return
        }
        setTimeout(poll, pollInterval)
      } catch (error: any) {
        setState(prev => ({
          ...prev, hosts: prev.hosts.map(h => h.id === hostId ? { ...h, last_probe_status: 'failed' } : h),
          probingHosts: new Set([...prev.probingHosts].filter(id => id !== hostId))
        }))
        showToast('error', `${hostName}: ${error.message || '获取探测状态失败'}`)
      }
    }
    poll()
  }

  const handleOpenWebShell = (host: Host) => window.open(`/hostoperate/hosts/${host.id}/webshell`, '_blank')

  const handleDelete = async (host: Host) => {
    confirmDialog.show({
      title: '删除主机',
      variant: 'danger',
      confirmText: '确认删除',
      message: (
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
              <Server className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
            </div>
            <div>
              <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{host.name}</p>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{host.hostname}:{host.port}</p>
            </div>
          </div>
          <p className={`text-sm ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
            <AlertTriangle className="w-4 h-4 inline mr-1" />
            此操作不可恢复，主机相关的所有数据将被永久删除。
          </p>
        </div>
      ),
      onConfirm: async () => {
        try {
          await hostsService.deleteHost(host.id)
          showToast('success', `主机 "${host.name}" 已删除`)
          loadHosts(state.pagination.page, state.search)
        } catch (error: any) {
          showToast('error', `删除失败: ${error.message}`)
        }
      }
    })
  }

  const formatMemory = (bytes?: number) => bytes ? `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB` : '-'

  const statistics = useMemo(() => {
    const total = state.pagination.total
    const online = state.hosts.filter(h => h.last_probe_status === 'success').length
    const offline = state.hosts.filter(h => h.last_probe_status === 'failed').length
    const unknown = state.hosts.filter(h => !h.last_probe_status).length
    return { total, online, offline, unknown }
  }, [state.hosts, state.pagination.total])

  const columns: Column<Host>[] = [
    {
      key: 'select', title: '', width: 50,
      render: (_, host) => (
        <input type="checkbox" checked={state.selectedHosts.has(host.id)}
          onChange={(e) => handleHostSelect(host.id, e.target.checked)}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
      )
    },
    {
      key: 'name', title: '主机信息', width: 280,
      render: (_, host) => (
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-xl ${isDark ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20' : 'bg-gradient-to-br from-blue-50 to-cyan-50'}`}>
            <Server className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
          </div>
          <div className="min-w-0">
            <button onClick={() => navigate(`/hostoperate/hosts/${host.id}`)}
              className={`font-semibold hover:underline text-left ${isDark ? 'text-white hover:text-blue-400' : 'text-gray-900 hover:text-blue-600'}`}>
              {host.name}
            </button>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{host.hostname}:{host.port}</div>
          </div>
        </div>
      )
    },
    {
      key: 'os_type', title: '操作系统', width: 120,
      render: (_, host) => <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{host.os_type || host.host_info?.os_name || '-'}</span>
    },
    {
      key: 'cpu', title: 'CPU', width: 80, align: 'center',
      render: (_, host) => <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{host.host_info?.cpu_cores ? `${host.host_info.cpu_cores} 核` : '-'}</span>
    },
    {
      key: 'memory', title: '内存', width: 80, align: 'center',
      render: (_, host) => <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{formatMemory(host.host_info?.total_memory)}</span>
    },
    {
      key: 'group', title: '分组', width: 120,
      render: (_, host) => host.group ? (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
          <FolderOpen className="w-3 h-3 mr-1" />{host.group.name}
        </span>
      ) : <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>未分组</span>
    },
    {
      key: 'probe_status', title: '探测状态', width: 100, align: 'center',
      render: (_, host) => {
        const isProbing = state.probingHosts.has(host.id)
        if (isProbing) return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}><RefreshCw className="w-3 h-3 mr-1 animate-spin" />探测中</span>
        const status = host.last_probe_status
        if (!status) return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-600'}`}><Clock className="w-3 h-3 mr-1" />未探测</span>
        if (status === 'success') return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}><CheckCircle className="w-3 h-3 mr-1" />可达</span>
        return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'}`}><XCircle className="w-3 h-3 mr-1" />不可达</span>
      }
    },
    {
      key: 'last_probe_at', title: '探测时间', width: 120,
      render: (_, host) => <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{host.last_probe_at ? formatDateTime(host.last_probe_at, 'MM/DD HH:mm') : '-'}</span>
    },
    {
      key: 'actions', title: '操作', width: 140, align: 'center',
      render: (_, host) => (
        <div className="flex items-center justify-center space-x-1">
          <button onClick={() => handleProbeHost(host)} disabled={state.probingHosts.has(host.id)} title="探测主机"
            className={`p-2 rounded-lg transition-colors ${isDark ? 'text-emerald-400 hover:bg-emerald-500/20' : 'text-emerald-600 hover:bg-emerald-50'}`}>
            {state.probingHosts.has(host.id) ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
          </button>
          <button onClick={() => handleOpenWebShell(host)} title="打开终端"
            className={`p-2 rounded-lg transition-colors ${isDark ? 'text-purple-400 hover:bg-purple-500/20' : 'text-purple-600 hover:bg-purple-50'}`}>
            <Terminal className="w-4 h-4" />
          </button>
          {hasPermission('host:update') && (
            <button onClick={() => navigate(`/hostoperate/hosts/${host.id}/edit`)} title="编辑主机"
              className={`p-2 rounded-lg transition-colors ${isDark ? 'text-blue-400 hover:bg-blue-500/20' : 'text-blue-600 hover:bg-blue-50'}`}>
              <Edit className="w-4 h-4" />
            </button>
          )}
          {hasPermission('host:delete') && (
            <button onClick={() => handleDelete(host)} title="删除主机"
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

  const headerActions = (
    <div className="flex items-center space-x-3">
      {state.selectedHosts.size > 0 && (
        <button onClick={handleBatchProbe} disabled={state.batchProbing}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            isDark ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
          } ${state.batchProbing ? 'opacity-50' : ''}`}>
          {state.batchProbing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
          <span>批量探测 ({state.selectedHosts.size})</span>
        </button>
      )}
      {hasPermission('host:create') && (
        <>
          <button onClick={() => setState(prev => ({ ...prev, showImportModal: true }))}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
              isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
            <Upload className="w-4 h-4" /><span>批量导入</span>
          </button>
          <button onClick={() => navigate('/hostoperate/hosts/new')}
            className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium overflow-hidden transition-all">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Plus className="relative w-4 h-4" /><span className="relative">添加主机</span>
          </button>
        </>
      )}
    </div>
  )

  return (
    <MonitorPageLayout title="主机管理" subtitle="管理 SSH 主机连接和监控" icon={Server}
      iconGradient="from-blue-500 via-cyan-500 to-teal-500" headerActions={headerActions}
      loading={state.loading} onRefresh={() => loadHosts(state.pagination.page, state.search, state.selectedGroupId)} showFullscreen={false}>
      
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
            {state.toast.type === 'warning' && <Clock className="w-5 h-5" />}
            {state.toast.type === 'info' && <Activity className="w-5 h-5" />}
            <span className="text-sm font-medium">{state.toast.message}</span>
          </div>
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <MonitorStatCard title="总主机数" value={statistics.total} subtitle="系统中所有主机" icon={Server} iconColorClass="text-blue-400" glowColor="bg-blue-500" />
        <MonitorStatCard title="在线主机" value={statistics.online} subtitle="探测成功的主机" icon={Wifi} variant="success" iconColorClass="text-emerald-400" glowColor="bg-emerald-500" />
        <MonitorStatCard title="离线主机" value={statistics.offline} subtitle="探测失败的主机" icon={WifiOff}
          variant={statistics.offline > 0 ? 'danger' : 'default'} valueColorClass={statistics.offline > 0 ? 'text-red-500' : undefined}
          iconColorClass={statistics.offline > 0 ? 'text-red-400' : 'text-gray-400'} glowColor="bg-red-500" />
        <MonitorStatCard title="未探测" value={statistics.unknown} subtitle="尚未探测的主机" icon={Clock} iconColorClass="text-gray-400" glowColor="bg-gray-500" />
      </div>

      {/* 搜索区域 */}
      <MonitorContentCard className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>关键词</label>
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              <input type="text" value={state.search} onChange={(e) => handleSearch(e.target.value)} placeholder="搜索主机名称、地址或描述"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                }`} />
            </div>
          </div>
          <div className="w-48">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>分组筛选</label>
            <div className="relative">
              <FolderOpen className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              <select value={state.selectedGroupId ?? ''} onChange={(e) => handleGroupFilter(e.target.value ? Number(e.target.value) : null)}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 appearance-none ${
                  isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`}>
                <option value="">全部分组</option>
                <option value="0">未分组</option>
                {state.groups.map(group => <option key={group.id} value={group.id}>{group.name} ({group.host_count})</option>)}
              </select>
            </div>
          </div>
          <div className="w-48">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>排序方式</label>
            <select value={`${state.sortBy}-${state.sortOrder}`} onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split('-') as [string, 'asc' | 'desc']
              setState(prev => ({ ...prev, sortBy, sortOrder }))
              loadHosts(1, state.search, state.selectedGroupId, sortBy, sortOrder)
            }}
              className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 appearance-none ${
                isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
              }`}>
              <option value="name-asc">名称 A-Z</option>
              <option value="name-desc">名称 Z-A</option>
              <option value="hostname-asc">IP 升序</option>
              <option value="hostname-desc">IP 降序</option>
              <option value="probe_status-asc">状态 (可达优先)</option>
              <option value="probe_status-desc">状态 (不可达优先)</option>
              <option value="last_probe_at-desc">最近探测</option>
              <option value="created_at-desc">最新创建</option>
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

      {/* 主机列表 */}
      <MonitorContentCard title="主机列表" icon={Server}
        headerActions={<span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>共 {state.pagination.total} 台主机</span>} noPadding>
        <DataTable columns={columns} dataSource={state.hosts} loading={state.loading} pagination={paginationConfig} rowKey="id" size="middle" />
      </MonitorContentCard>

      {/* 导入弹窗 */}
      <HostImportModal isOpen={state.showImportModal} onClose={() => setState(prev => ({ ...prev, showImportModal: false }))}
        onSuccess={() => { setState(prev => ({ ...prev, showImportModal: false })); loadHosts() }} />
      
      {/* 删除确认弹窗 */}
      <ConfirmDialog {...confirmDialog.dialogProps} />
    </MonitorPageLayout>
  )
}

export default HostList