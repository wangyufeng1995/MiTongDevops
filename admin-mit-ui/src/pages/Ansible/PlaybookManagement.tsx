/**
 * Ansible Playbook 管理页面 - 美化版
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  FileText, Plus, Upload, History, Play, Edit, Download, Trash2,
  Clock, User, CheckCircle, X, ToggleLeft, ToggleRight
} from 'lucide-react'
import { DataTable } from '../../components/Table'
import { ansibleService } from '../../services/ansible'
import { formatDateTime } from '../../utils'
import { useTheme } from '../../hooks/useTheme'
import { MonitorPageLayout, MonitorStatCard, MonitorContentCard, FilterBar, QuickFilter, ConfirmDialog, useConfirmDialog } from '../../components/Monitor'
import type { FilterItem } from '../../components/Monitor/FilterBar'
import type { AnsiblePlaybook, PlaybookSearchParams, PlaybookStatistics } from '../../types/ansible'

// 筛选配置
const filterConfig: FilterItem[] = [
  { key: 'search', label: '搜索', type: 'text', width: 'lg', placeholder: '搜索名称、描述...' },
  { key: 'version', label: '版本', type: 'select', width: 'xs', options: [
    { value: '', label: '全部' },
    { value: '1.0', label: '1.0' },
    { value: '2.0', label: '2.0' },
    { value: '3.0', label: '3.0' }
  ]},
  { key: 'sort', label: '排序', type: 'select', width: 'sm', options: [
    { value: 'updated_at-desc', label: '最近更新' },
    { value: 'created_at-desc', label: '最近创建' },
    { value: 'name-asc', label: '名称 A-Z' },
    { value: 'execution_count-desc', label: '执行次数' }
  ]},
]

const PlaybookManagement: React.FC = () => {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const confirmDialog = useConfirmDialog()
  
  const [playbooks, setPlaybooks] = useState<AnsiblePlaybook[]>([])
  const [statistics, setStatistics] = useState<PlaybookStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyData, setHistoryData] = useState<{
    current: { id: number; name: string; version: string; updated_at: string | null };
    history: { id: number; version: string; created_at: string | null; content: string }[];
  } | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [filterValues, setFilterValues] = useState<Record<string, any>>({ sort: 'updated_at-desc' })
  const [searchParams, setSearchParams] = useState<PlaybookSearchParams>({
    page: 1, per_page: 20, sort_by: 'updated_at', sort_order: 'desc'
  })
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 0 })
  const [statusFilter, setStatusFilter] = useState('')

  // 加载数据
  const loadPlaybooks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await ansibleService.getPlaybooks(searchParams)
      setPlaybooks(response.playbooks || [])
      if (response.pagination) setPagination(response.pagination)
    } catch (err: any) {
      setError(err.message || '加载 Playbook 列表失败')
    } finally {
      setLoading(false)
    }
  }, [searchParams])

  const loadStatistics = useCallback(async () => {
    try {
      const stats = await ansibleService.getStatistics()
      setStatistics(stats)
    } catch (err) {
      console.error('Failed to load statistics:', err)
    }
  }, [])

  useEffect(() => { loadPlaybooks(); loadStatistics() }, [loadPlaybooks, loadStatistics])

  // 筛选处理
  const handleFilterChange = (key: string, value: any) => {
    setFilterValues(prev => ({ ...prev, [key]: value }))
  }

  const handleSearch = () => {
    const [sort_by, sort_order] = (filterValues.sort || 'updated_at-desc').split('-')
    setSearchParams(prev => ({
      ...prev,
      search: filterValues.search || undefined,
      version: filterValues.version || undefined,
      sort_by,
      sort_order: sort_order as 'asc' | 'desc',
      page: 1
    }))
  }

  const handleReset = () => {
    setFilterValues({ sort: 'updated_at-desc' })
    setStatusFilter('')
    setSearchParams({ page: 1, per_page: 20, sort_by: 'updated_at', sort_order: 'desc' })
  }

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status)
    // 这里可以根据需要添加状态筛选逻辑
  }

  // 操作处理
  const handleEdit = (playbook: AnsiblePlaybook) => navigate(`/hostoperate/ansible/playbooks/${playbook.id}/edit`)
  const handleExecute = (playbook: AnsiblePlaybook) => navigate(`/hostoperate/ansible/playbooks/${playbook.id}/execute`)

  const handleExport = async (playbook: AnsiblePlaybook) => {
    try {
      const blob = await ansibleService.exportPlaybook(playbook.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${playbook.name}.yml`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch {
      alert('导出 Playbook 失败')
    }
  }

  const handleToggleActive = async (playbook: AnsiblePlaybook) => {
    try {
      await ansibleService.togglePlaybookActive(playbook.id, !playbook.is_active)
      loadPlaybooks()
    } catch {
      alert('切换状态失败')
    }
  }

  const handleViewHistory = async (playbook: AnsiblePlaybook) => {
    try {
      setHistoryLoading(true)
      setShowHistoryModal(true)
      const data = await ansibleService.getPlaybookHistory(playbook.id)
      setHistoryData(data)
    } catch {
      alert('获取历史版本失败')
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleDelete = (playbook: AnsiblePlaybook) => {
    confirmDialog.show({
      title: '删除 Playbook',
      message: (
        <div className="space-y-3">
          <p>确定要删除此 Playbook 吗？</p>
          <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-700/50 border border-slate-600/50' : 'bg-gray-50 border border-gray-200'}`}>
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
                <FileText className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
              </div>
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {playbook.name}
                </p>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  版本 {playbook.version || '1.0'} · 执行 {playbook.execution_count || 0} 次
                </p>
              </div>
            </div>
          </div>
          <p className={`text-xs ${isDark ? 'text-red-400/80' : 'text-red-500/80'}`}>
            ⚠️ 此操作不可撤销，Playbook 将被永久删除
          </p>
        </div>
      ),
      confirmText: '确认删除',
      variant: 'danger',
      onConfirm: async () => {
        await ansibleService.deletePlaybook(playbook.id)
        loadPlaybooks()
      }
    })
  }

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setImporting(true)
      await ansibleService.importPlaybook(file)
      setShowImportModal(false)
      loadPlaybooks()
      loadStatistics()
    } catch {
      alert('导入 Playbook 失败')
    } finally {
      setImporting(false)
    }
  }

  // 获取执行状态标签
  const getExecutionStatusBadge = (status?: string) => {
    if (!status) {
      return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>未执行</span>
    }
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      success: { bg: isDark ? 'bg-emerald-500/20' : 'bg-emerald-100', text: isDark ? 'text-emerald-300' : 'text-emerald-700', label: '成功' },
      failed: { bg: isDark ? 'bg-red-500/20' : 'bg-red-100', text: isDark ? 'text-red-300' : 'text-red-700', label: '失败' },
      running: { bg: isDark ? 'bg-blue-500/20' : 'bg-blue-100', text: isDark ? 'text-blue-300' : 'text-blue-700', label: '运行中' },
      pending: { bg: isDark ? 'bg-yellow-500/20' : 'bg-yellow-100', text: isDark ? 'text-yellow-300' : 'text-yellow-700', label: '等待中' },
      cancelled: { bg: isDark ? 'bg-gray-500/20' : 'bg-gray-100', text: isDark ? 'text-gray-300' : 'text-gray-600', label: '已取消' }
    }
    const config = statusConfig[status] || statusConfig.pending
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>{config.label}</span>
  }

  // 表格列
  const columns = [
    {
      key: 'name', title: 'Playbook 名称', width: '18%',
      render: (_: any, playbook: AnsiblePlaybook) => (
        <div className="flex items-center space-x-2.5">
          <FileText className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
          <button
            onClick={() => handleViewHistory(playbook)}
            className={`font-medium truncate hover:underline ${isDark ? 'text-white hover:text-blue-400' : 'text-gray-900 hover:text-blue-600'}`}
            title="点击查看历史版本"
          >
            {playbook.name}
          </button>
        </div>
      )
    },
    {
      key: 'description', title: '描述', width: '22%',
      render: (_: any, playbook: AnsiblePlaybook) => (
        <span className={`text-sm truncate block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{playbook.description || '-'}</span>
      )
    },
    {
      key: 'version', title: '版本', width: '8%', align: 'center' as const,
      render: (_: any, playbook: AnsiblePlaybook) => (
        <span className={`text-sm font-mono px-2 py-0.5 rounded ${isDark ? 'bg-slate-700/50 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>{playbook.version}</span>
      )
    },
    {
      key: 'creator', title: '创建者', width: '12%',
      render: (_: any, playbook: AnsiblePlaybook) => (
        <div className="flex items-center space-x-1.5">
          <User className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <span className={`text-sm truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{playbook.creator?.full_name || playbook.creator?.username || '未知'}</span>
        </div>
      )
    },
    {
      key: 'last_execution_status', title: '上次执行', width: '10%', align: 'center' as const,
      render: (_: any, playbook: AnsiblePlaybook) => getExecutionStatusBadge(playbook.last_execution_status)
    },
    {
      key: 'is_active', title: '状态', width: '8%', align: 'center' as const,
      render: (_: any, playbook: AnsiblePlaybook) => (
        <button
          onClick={() => handleToggleActive(playbook)}
          className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
            playbook.is_active
              ? isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
              : isDark ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-500'
          }`}
          title={playbook.is_active ? '点击停用' : '点击激活'}
        >
          {playbook.is_active ? (
            <><ToggleRight className="w-4 h-4" /><span>已激活</span></>
          ) : (
            <><ToggleLeft className="w-4 h-4" /><span>未激活</span></>
          )}
        </button>
      )
    },
    {
      key: 'updated_at', title: '更新时间', width: '12%',
      render: (_: any, playbook: AnsiblePlaybook) => (
        <div className="flex items-center space-x-1.5">
          <Clock className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{formatDateTime(playbook.updated_at, 'MM-DD HH:mm')}</span>
        </div>
      )
    },
    {
      key: 'actions', title: '操作', width: '18%', align: 'center' as const,
      render: (_: any, playbook: AnsiblePlaybook) => (
        <div className="flex items-center justify-center space-x-1">
          <button onClick={() => handleEdit(playbook)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-amber-400 hover:bg-amber-500/20' : 'text-amber-600 hover:bg-amber-50'}`} title="编辑"><Edit className="w-4 h-4" /></button>
          <button 
            onClick={() => playbook.is_active && handleExecute(playbook)} 
            disabled={!playbook.is_active}
            className={`p-1.5 rounded-lg transition-colors ${
              playbook.is_active 
                ? isDark ? 'text-emerald-400 hover:bg-emerald-500/20' : 'text-emerald-600 hover:bg-emerald-50'
                : 'text-gray-400 cursor-not-allowed opacity-50'
            }`} 
            title={playbook.is_active ? '运行' : '请先激活 Playbook'}
          >
            <Play className="w-4 h-4" />
          </button>
          <button onClick={() => handleExport(playbook)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-cyan-400 hover:bg-cyan-500/20' : 'text-cyan-600 hover:bg-cyan-50'}`} title="下载"><Download className="w-4 h-4" /></button>
          <button onClick={() => handleDelete(playbook)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-600 hover:bg-red-50'}`} title="删除"><Trash2 className="w-4 h-4" /></button>
        </div>
      )
    }
  ]

  // 快捷筛选选项
  const quickFilterOptions = [
    { value: '', label: '全部' },
    { value: 'success', label: '成功' },
    { value: 'failed', label: '失败' },
    { value: 'running', label: '运行中' },
  ]

  // 头部操作按钮
  const headerActions = (
    <div className="flex items-center space-x-2">
      <button onClick={() => setShowImportModal(true)} className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
        <Upload className="w-4 h-4" /><span>导入</span>
      </button>
      <button onClick={() => navigate('/hostoperate/ansible/playbooks/new')} className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/25">
        <Plus className="w-4 h-4" /><span>新建</span>
      </button>
    </div>
  )

  return (
    <MonitorPageLayout 
      title="Ansible Playbook 管理" 
      subtitle="管理和执行自动化运维脚本" 
      icon={FileText}
      iconGradient="from-blue-500 via-indigo-500 to-purple-500" 
      headerActions={headerActions}
      loading={loading} 
      onRefresh={() => { loadPlaybooks(); loadStatistics() }} 
      showFullscreen={false}
    >
      {/* 统计卡片 */}
      {statistics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MonitorStatCard title="总 Playbook" value={statistics.total_playbooks} subtitle="已创建脚本" icon={FileText} iconColorClass="text-blue-400" glowColor="bg-blue-500" />
          <MonitorStatCard title="总执行次数" value={statistics.total_executions} subtitle="累计执行" icon={Play} iconColorClass="text-emerald-400" glowColor="bg-emerald-500" />
          <MonitorStatCard 
            title="成功率" 
            value={`${statistics.success_rate.toFixed(1)}%`} 
            subtitle="执行成功比例" 
            icon={CheckCircle} 
            variant={statistics.success_rate >= 90 ? 'success' : statistics.success_rate >= 70 ? 'warning' : 'danger'} 
            iconColorClass={statistics.success_rate >= 90 ? 'text-emerald-400' : statistics.success_rate >= 70 ? 'text-amber-400' : 'text-red-400'} 
            glowColor={statistics.success_rate >= 90 ? 'bg-emerald-500' : statistics.success_rate >= 70 ? 'bg-amber-500' : 'bg-red-500'} 
          />
          <MonitorStatCard title="活跃 Playbook" value={statistics.most_used_playbooks.length} subtitle="近期使用" icon={Clock} iconColorClass="text-purple-400" glowColor="bg-purple-500" />
        </div>
      )}

      {/* 筛选区域 */}
      <MonitorContentCard className="mb-6">
        <div className="space-y-4">
          {/* 快捷筛选 */}
          <QuickFilter 
            options={quickFilterOptions} 
            value={statusFilter} 
            onChange={handleStatusFilter} 
          />
          {/* 详细筛选 */}
          <FilterBar
            filters={filterConfig}
            values={filterValues}
            onChange={handleFilterChange}
            onSearch={handleSearch}
            onReset={handleReset}
          />
        </div>
      </MonitorContentCard>

      {/* 错误提示 */}
      {error && (
        <div className={`mb-6 p-4 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {error}
        </div>
      )}

      {/* Playbook 列表 */}
      <MonitorContentCard 
        title="Playbook 列表" 
        icon={FileText} 
        headerActions={<span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>共 {pagination?.total || 0} 个</span>} 
        noPadding
      >
        <DataTable 
          columns={columns} 
          dataSource={playbooks} 
          loading={loading}
          pagination={{ 
            current: pagination?.page || 1, 
            pageSize: pagination?.per_page || 20, 
            total: pagination?.total || 0, 
            showTotal: true,
            onChange: (p) => setSearchParams(prev => ({ ...prev, page: p })) 
          }}
          emptyText="暂无 Playbook 数据" 
        />
      </MonitorContentCard>

      {/* 导入模态框 */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`rounded-2xl shadow-2xl max-w-md w-full mx-4 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>导入 Playbook</h3>
              <button onClick={() => setShowImportModal(false)} className={`p-1 rounded-lg ${isDark ? 'text-gray-400 hover:bg-slate-700' : 'text-gray-500 hover:bg-gray-100'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <div className={`border-2 border-dashed rounded-xl p-8 text-center ${isDark ? 'border-slate-600 bg-slate-700/30' : 'border-gray-200 bg-gray-50'}`}>
                <Upload className={`w-10 h-10 mx-auto mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <p className={`text-sm mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>选择 YAML 文件上传</p>
                <p className={`text-xs mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>支持 .yml, .yaml 格式，最大 10MB</p>
                <label className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all ${
                  isDark ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                } ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input type="file" accept=".yml,.yaml" onChange={handleFileImport} disabled={importing} className="hidden" />
                  {importing ? '上传中...' : '选择文件'}
                </label>
              </div>
            </div>
            <div className={`px-6 py-4 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
              <button 
                onClick={() => setShowImportModal(false)} 
                disabled={importing}
                className={`w-full px-4 py-2 rounded-xl font-medium ${isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 确认对话框 */}
      <ConfirmDialog {...confirmDialog.dialogProps} />

      {/* 历史版本弹窗 */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
              <div>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {historyData?.current.name || 'Playbook'} - 版本历史
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  当前版本: v{historyData?.current.version}
                </p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className={`p-1 rounded-lg ${isDark ? 'text-gray-400 hover:bg-slate-700' : 'text-gray-500 hover:bg-gray-100'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : historyData?.history.length === 0 ? (
                <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  暂无历史版本
                </div>
              ) : (
                <div className="space-y-3">
                  {historyData?.history.map((version, index) => (
                    <div
                      key={version.id}
                      className={`p-4 rounded-xl border ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-gray-50 border-gray-200'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-600'}`}>
                            v{version.version}
                          </span>
                          {index === 0 && (
                            <span className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-600'}`}>
                              最近
                            </span>
                          )}
                        </div>
                        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {version.created_at ? new Date(version.created_at).toLocaleString() : '-'}
                        </span>
                      </div>
                      <details className="group">
                        <summary className={`cursor-pointer text-sm ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-600'}`}>
                          查看内容
                        </summary>
                        <pre className={`mt-2 p-3 rounded-lg text-xs overflow-x-auto ${isDark ? 'bg-slate-900 text-gray-300' : 'bg-gray-900 text-gray-100'}`}>
                          {version.content}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={`px-6 py-4 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
              <button
                onClick={() => setShowHistoryModal(false)}
                className={`w-full px-4 py-2 rounded-xl font-medium ${isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </MonitorPageLayout>
  )
}

export default PlaybookManagement
