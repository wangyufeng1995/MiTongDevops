/**
 * Ansible 执行历史页面 - 美化版
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Eye, RefreshCw, Calendar, User, Server, 
  CheckCircle, Clock, XCircle, Play, StopCircle, FileText, Trash2
} from 'lucide-react'
import { ansibleService } from '../../services/ansible'
import { DataTable } from '../../components/Table'
import { formatDateTime } from '../../utils'
import { useTheme } from '../../hooks/useTheme'
import { MonitorPageLayout, MonitorStatCard, MonitorContentCard, FilterBar, QuickFilter, ConfirmDialog, useConfirmDialog } from '../../components/Monitor'
import { ActionButton, StatusBadge } from '../../components/Monitor/FormCard'
import type { FilterItem } from '../../components/Monitor/FilterBar'
import type { PlaybookExecution, ExecutionSearchParams } from '../../types/ansible'

const filterConfig: FilterItem[] = [
  { key: 'status', label: '状态', type: 'select', width: 'sm', options: [
    { value: '', label: '全部状态' },
    { value: 'pending', label: '等待中' },
    { value: 'running', label: '运行中' },
    { value: 'success', label: '成功' },
    { value: 'failed', label: '失败' },
  ]},
]

const ExecutionHistory: React.FC = () => {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const abortControllerRef = useRef<AbortController | null>(null)
  const confirmDialog = useConfirmDialog()
  
  const [executions, setExecutions] = useState<PlaybookExecution[]>([])
  const [loading, setLoading] = useState(true)
  const [stopping, setStopping] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [filterValues, setFilterValues] = useState<Record<string, any>>({})
  const [pagination, setPagination] = useState({ page: 1, per_page: 10, total: 0, pages: 0 })
  const [searchFilters, setSearchFilters] = useState<ExecutionSearchParams>({
    page: 1, per_page: 10, sort_by: 'created_at', sort_order: 'desc'
  })

  const loadExecutions = useCallback(async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    abortControllerRef.current = new AbortController()
    try {
      setLoading(true)
      const response = await ansibleService.getExecutions(searchFilters)
      setExecutions(response.executions || [])
      if (response.pagination) setPagination(response.pagination)
    } catch (error: any) {
      if (error?.name === 'AbortError') return
      console.error('Failed to load executions:', error)
    } finally {
      setLoading(false)
    }
  }, [searchFilters])

  useEffect(() => {
    loadExecutions()
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort() }
  }, [loadExecutions])

  const handleForceStopAll = useCallback(async () => {
    const runningCount = executions.filter(e => e.status === 'running' || e.status === 'pending').length
    if (runningCount === 0) return
    
    confirmDialog.show({
      title: '停止所有任务',
      message: (
        <div className="space-y-3">
          <p>确定要强制停止所有运行中的任务吗？</p>
          <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-700/50 border border-slate-600/50' : 'bg-gray-50 border border-gray-200'}`}>
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
                <StopCircle className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {runningCount}
                </p>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  个运行中的任务
                </p>
              </div>
            </div>
          </div>
          <p className={`text-xs ${isDark ? 'text-red-400/80' : 'text-red-500/80'}`}>
            ⚠️ 此操作不可撤销，任务将被标记为已取消
          </p>
        </div>
      ),
      confirmText: '停止全部',
      variant: 'danger',
      onConfirm: async () => {
        setStopping(true)
        try {
          await ansibleService.forceStopAllExecutions()
          loadExecutions()
        } finally {
          setStopping(false)
        }
      }
    })
  }, [executions, loadExecutions, confirmDialog, isDark])

  const handleQuickFilter = (status: string) => {
    setStatusFilter(status)
    setSearchFilters(prev => ({ ...prev, status: status as any || undefined, page: 1 }))
  }

  const handleFilterChange = (key: string, value: any) => {
    setFilterValues(prev => ({ ...prev, [key]: value }))
  }

  const handleSearch = () => {
    setSearchFilters(prev => ({ ...prev, status: filterValues.status || undefined, page: 1 }))
  }

  const handleReset = () => {
    setFilterValues({})
    setStatusFilter('')
    setSearchFilters({ page: 1, per_page: 10, sort_by: 'created_at', sort_order: 'desc' })
  }

  const handleViewDetail = useCallback((execution: PlaybookExecution) => {
    navigate(`/hostoperate/ansible/playbooks/${execution.playbook_id}/execute?execution_id=${execution.id}`)
  }, [navigate])

  const handleReExecute = useCallback(async (execution: PlaybookExecution) => {
    if (!execution.playbook) return
    
    confirmDialog.show({
      title: '重新执行',
      message: (
        <div className="space-y-3">
          <p>确定要重新执行此 Playbook 吗？</p>
          <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-700/50 border border-slate-600/50' : 'bg-gray-50 border border-gray-200'}`}>
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                <Play className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
              </div>
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {execution.playbook.name}
                </p>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {execution.host_ids?.length || 0} 台主机
                </p>
              </div>
            </div>
          </div>
          <p className={`text-xs ${isDark ? 'text-blue-400/80' : 'text-blue-500/80'}`}>
            将使用相同的主机和变量配置重新执行
          </p>
        </div>
      ),
      confirmText: '重新执行',
      variant: 'info',
      onConfirm: async () => {
        await ansibleService.executePlaybook(execution.playbook_id, { host_ids: execution.host_ids, variables: execution.variables })
        loadExecutions()
      }
    })
  }, [loadExecutions, confirmDialog, isDark])

  const handleStopExecution = useCallback(async (execution: PlaybookExecution) => {
    confirmDialog.show({
      title: '停止执行',
      message: (
        <div className="space-y-3">
          <p>确定要停止此任务吗？</p>
          <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-700/50 border border-slate-600/50' : 'bg-gray-50 border border-gray-200'}`}>
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                <Clock className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-500'} animate-pulse`} />
              </div>
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {execution.playbook?.name || '未知 Playbook'}
                </p>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  正在执行中...
                </p>
              </div>
            </div>
          </div>
          <p className={`text-xs ${isDark ? 'text-amber-400/80' : 'text-amber-500/80'}`}>
            ⚠️ 任务将被中断，已执行的操作不会回滚
          </p>
        </div>
      ),
      confirmText: '停止任务',
      variant: 'warning',
      onConfirm: async () => {
        await ansibleService.stopExecution(execution.id)
        loadExecutions()
      }
    })
  }, [loadExecutions, confirmDialog, isDark])

  // 删除单条执行记录
  const handleDeleteExecution = useCallback(async (execution: PlaybookExecution) => {
    confirmDialog.show({
      title: '删除执行记录',
      message: (
        <div className="space-y-3">
          <p>确定要删除此执行记录吗？</p>
          <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-700/50 border border-slate-600/50' : 'bg-gray-50 border border-gray-200'}`}>
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
                <Trash2 className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
              </div>
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  #{execution.id} - {execution.playbook?.name || '未知 Playbook'}
                </p>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  状态: {execution.status}
                </p>
              </div>
            </div>
          </div>
          <p className={`text-xs ${isDark ? 'text-red-400/80' : 'text-red-500/80'}`}>
            ⚠️ 此操作不可撤销
          </p>
        </div>
      ),
      confirmText: '删除',
      variant: 'danger',
      onConfirm: async () => {
        await ansibleService.deleteExecution(execution.id)
        loadExecutions()
      }
    })
  }, [loadExecutions, confirmDialog, isDark])

  // 批量删除执行记录
  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.length === 0) return
    
    confirmDialog.show({
      title: '批量删除执行记录',
      message: (
        <div className="space-y-3">
          <p>确定要删除选中的执行记录吗？</p>
          <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-700/50 border border-slate-600/50' : 'bg-gray-50 border border-gray-200'}`}>
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
                <Trash2 className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {selectedIds.length}
                </p>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  条执行记录将被删除
                </p>
              </div>
            </div>
          </div>
          <p className={`text-xs ${isDark ? 'text-red-400/80' : 'text-red-500/80'}`}>
            ⚠️ 此操作不可撤销，包括运行中的任务也会被强制删除
          </p>
        </div>
      ),
      confirmText: '确认删除',
      variant: 'danger',
      onConfirm: async () => {
        setDeleting(true)
        try {
          await ansibleService.batchDeleteExecutions(selectedIds)
          setSelectedIds([])
          loadExecutions()
        } finally {
          setDeleting(false)
        }
      }
    })
  }, [selectedIds, loadExecutions, confirmDialog, isDark])

  const getStatusConfig = (status: PlaybookExecution['status']) => {
    const configs = {
      success: { icon: CheckCircle, label: '成功', variant: 'success' as const },
      failed: { icon: XCircle, label: '失败', variant: 'error' as const },
      running: { icon: RefreshCw, label: '运行中', variant: 'info' as const },
      pending: { icon: Clock, label: '等待中', variant: 'warning' as const },
    }
    return configs[status] || { icon: Clock, label: '未知', variant: 'default' as const }
  }

  // 统计数据
  const stats = {
    total: executions.length,
    running: executions.filter(e => e.status === 'running').length,
    success: executions.filter(e => e.status === 'success').length,
    failed: executions.filter(e => e.status === 'failed').length,
  }

  const quickFilterOptions = [
    { value: '', label: '全部', count: pagination.total },
    { value: 'running', label: '运行中', count: stats.running },
    { value: 'success', label: '成功', count: stats.success },
    { value: 'failed', label: '失败', count: stats.failed },
  ]

  const columns = [
    {
      key: 'selection', title: (
        <input
          type="checkbox"
          checked={selectedIds.length > 0 && selectedIds.length === executions.length}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedIds(executions.map(ex => ex.id))
            } else {
              setSelectedIds([])
            }
          }}
          className="w-4 h-4 rounded border-gray-300"
        />
      ), width: '50px',
      render: (_: any, e: PlaybookExecution) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(e.id)}
          onChange={(ev) => {
            if (ev.target.checked) {
              setSelectedIds(prev => [...prev, e.id])
            } else {
              setSelectedIds(prev => prev.filter(id => id !== e.id))
            }
          }}
          className="w-4 h-4 rounded border-gray-300"
        />
      )
    },
    {
      key: 'id', title: 'ID', width: '80px',
      render: (_: any, e: PlaybookExecution) => (
        <span className={`text-sm font-mono ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>#{e.id}</span>
      )
    },
    {
      key: 'playbook', title: 'Playbook', width: '20%',
      render: (_: any, e: PlaybookExecution) => (
        <div className="flex items-center space-x-2">
          <FileText className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
          <div>
            <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{e.playbook?.name || '未知'}</div>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>v{e.playbook?.version || 'N/A'}</div>
          </div>
        </div>
      )
    },
    {
      key: 'status', title: '状态', width: '120px', align: 'center' as const,
      render: (_: any, e: PlaybookExecution) => {
        const cfg = getStatusConfig(e.status)
        return (
          <StatusBadge status={cfg.variant} icon={<cfg.icon className={`w-3 h-3 ${e.status === 'running' ? 'animate-spin' : ''}`} />}>
            {cfg.label}
          </StatusBadge>
        )
      }
    },
    {
      key: 'hosts', title: '目标主机', width: '100px',
      render: (_: any, e: PlaybookExecution) => (
        <div className="flex items-center space-x-1.5">
          <Server className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{e.hosts?.length || e.host_ids?.length || 0} 台</span>
        </div>
      )
    },
    {
      key: 'creator', title: '执行者', width: '120px',
      render: (_: any, e: PlaybookExecution) => (
        <div className="flex items-center space-x-1.5">
          <User className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{e.creator?.full_name || e.creator?.username || '未知'}</span>
        </div>
      )
    },
    {
      key: 'created_at', title: '开始时间', width: '140px',
      render: (_: any, e: PlaybookExecution) => (
        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          <div>{formatDateTime(e.started_at || e.created_at, 'MM-DD HH:mm')}</div>
        </div>
      )
    },
    {
      key: 'duration', title: '时长', width: '80px',
      render: (_: any, e: PlaybookExecution) => {
        if (!e.started_at) return <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>-</span>
        const start = new Date(e.started_at).getTime()
        const end = e.finished_at ? new Date(e.finished_at).getTime() : Date.now()
        const duration = Math.floor((end - start) / 1000)
        const m = Math.floor(duration / 60), s = duration % 60
        return <span className={`text-sm font-mono ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{m > 0 ? `${m}m ` : ''}{s}s</span>
      }
    },
    {
      key: 'actions', title: '操作', width: '120px', align: 'center' as const,
      render: (_: any, e: PlaybookExecution) => (
        <div className="flex items-center justify-center space-x-1">
          <button onClick={() => handleViewDetail(e)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-blue-400 hover:bg-blue-500/20' : 'text-blue-600 hover:bg-blue-50'}`} title="查看">
            <Eye className="w-4 h-4" />
          </button>
          {e.status === 'running' && (
            <button onClick={() => handleStopExecution(e)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-amber-400 hover:bg-amber-500/20' : 'text-amber-600 hover:bg-amber-50'}`} title="停止">
              <StopCircle className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => handleDeleteExecution(e)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-600 hover:bg-red-50'}`} title="删除">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ]

  const headerActions = null

  // 执行记录卡片的右侧操作区
  const tableHeaderActions = (
    <div className="flex items-center space-x-3">
      {selectedIds.length > 0 && (
        <ActionButton
          variant="danger"
          size="sm"
          onClick={handleBatchDelete}
          loading={deleting}
        >
          <Trash2 className="w-4 h-4" />
          删除选中 ({selectedIds.length})
        </ActionButton>
      )}
      <ActionButton
        variant="danger"
        size="sm"
        onClick={handleForceStopAll}
        loading={stopping}
        disabled={stats.running === 0}
      >
        <StopCircle className="w-4 h-4" />
        全部停止{stats.running > 0 ? ` (${stats.running})` : ''}
      </ActionButton>
      <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>共 {pagination.total} 条</span>
    </div>
  )

  return (
    <MonitorPageLayout
      title="执行历史"
      subtitle="查看 Ansible Playbook 执行记录"
      icon={Calendar}
      iconGradient="from-purple-500 via-violet-500 to-indigo-500"
      headerActions={headerActions}
      loading={loading}
      onRefresh={loadExecutions}
      showFullscreen={false}
    >
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MonitorStatCard title="总执行数" value={pagination.total} subtitle="所有记录" icon={Calendar} iconColorClass="text-blue-400" glowColor="bg-blue-500" />
        <MonitorStatCard title="运行中" value={stats.running} subtitle="正在执行" icon={RefreshCw} variant={stats.running > 0 ? 'warning' : 'default'} iconColorClass={stats.running > 0 ? 'text-blue-400' : 'text-gray-400'} glowColor="bg-blue-500" pulse={stats.running > 0} />
        <MonitorStatCard title="成功" value={stats.success} subtitle="执行成功" icon={CheckCircle} variant="success" iconColorClass="text-emerald-400" glowColor="bg-emerald-500" />
        <MonitorStatCard title="失败" value={stats.failed} subtitle="执行失败" icon={XCircle} variant={stats.failed > 0 ? 'danger' : 'default'} iconColorClass={stats.failed > 0 ? 'text-red-400' : 'text-gray-400'} glowColor="bg-red-500" />
      </div>

      {/* 筛选区域 */}
      <MonitorContentCard className="mb-6">
        <div className="space-y-4">
          <QuickFilter options={quickFilterOptions} value={statusFilter} onChange={handleQuickFilter} />
          <FilterBar filters={filterConfig} values={filterValues} onChange={handleFilterChange} onSearch={handleSearch} onReset={handleReset} />
        </div>
      </MonitorContentCard>

      {/* 执行历史表格 */}
      <MonitorContentCard
        title="执行记录"
        icon={Calendar}
        headerActions={tableHeaderActions}
        noPadding
      >
        <DataTable
          dataSource={executions}
          columns={columns}
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.per_page,
            total: pagination.total,
            showTotal: true,
            onChange: (page) => setSearchFilters(prev => ({ ...prev, page }))
          }}
          emptyText="暂无执行记录"
        />
      </MonitorContentCard>

      {/* 确认对话框 */}
      <ConfirmDialog {...confirmDialog.dialogProps} />
    </MonitorPageLayout>
  )
}

export default ExecutionHistory
