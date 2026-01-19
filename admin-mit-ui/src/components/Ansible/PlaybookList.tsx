/**
 * Ansible Playbook 列表组件
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Filter,
  Plus,
  Play,
  Edit,
  Copy,
  Download,
  Trash2,
  Eye,
  Clock,
  User,
  FileText,
  ChevronDown,
  RefreshCw,
  Upload
} from 'lucide-react'
import { DataTable } from '../Table'
import { SearchForm } from '../Form'
import { Loading } from '../Loading'
import { ansibleService } from '../../services/ansible'
import { formatDateTime } from '../../utils'
import {
  AnsiblePlaybook,
  PlaybookSearchParams,
  PlaybookStatistics
} from '../../types/ansible'

export interface PlaybookListProps {
  onEdit?: (playbook: AnsiblePlaybook) => void
  onExecute?: (playbook: AnsiblePlaybook) => void
  onView?: (playbook: AnsiblePlaybook) => void
  onCopy?: (playbook: AnsiblePlaybook) => void
  onDelete?: (playbook: AnsiblePlaybook) => void
  onExport?: (playbook: AnsiblePlaybook) => void
  onCreate?: () => void
  onImport?: () => void
  className?: string
}

const PlaybookList: React.FC<PlaybookListProps> = ({
  onEdit,
  onExecute,
  onView,
  onCopy,
  onDelete,
  onExport,
  onCreate,
  onImport,
  className = ''
}) => {
  const [playbooks, setPlaybooks] = useState<AnsiblePlaybook[]>([])
  const [statistics, setStatistics] = useState<PlaybookStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useState<PlaybookSearchParams>({
    page: 1,
    per_page: 20,
    sort_by: 'updated_at',
    sort_order: 'desc'
  })
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 20,
    total: 0,
    pages: 0,
    has_prev: false,
    has_next: false
  })
  const [selectedPlaybooks, setSelectedPlaybooks] = useState<number[]>([])
  const [showFilters, setShowFilters] = useState(false)

  // 加载 Playbook 列表
  const loadPlaybooks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await ansibleService.getPlaybooks(searchParams)
      setPlaybooks(response.playbooks)
      setPagination(response.pagination)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载 Playbook 列表失败'
      setError(errorMessage)
      console.error('Failed to load playbooks:', err)
    } finally {
      setLoading(false)
    }
  }, [searchParams])

  // 加载统计信息
  const loadStatistics = useCallback(async () => {
    try {
      const stats = await ansibleService.getStatistics()
      setStatistics(stats)
    } catch (err) {
      console.error('Failed to load statistics:', err)
    }
  }, [])

  // 初始化加载
  useEffect(() => {
    loadPlaybooks()
    loadStatistics()
  }, [loadPlaybooks, loadStatistics])

  // 处理搜索
  const handleSearch = useCallback((search: string) => {
    setSearchParams(prev => ({
      ...prev,
      search: search || undefined,
      page: 1
    }))
  }, [])

  // 处理排序
  const handleSort = useCallback((field: string, order: 'asc' | 'desc') => {
    setSearchParams(prev => ({
      ...prev,
      sort_by: field as any,
      sort_order: order,
      page: 1
    }))
  }, [])

  // 处理分页
  const handlePageChange = useCallback((page: number) => {
    setSearchParams(prev => ({ ...prev, page }))
  }, [])

  // 处理页面大小变化
  const handlePageSizeChange = useCallback((pageSize: number) => {
    setSearchParams(prev => ({
      ...prev,
      per_page: pageSize,
      page: 1
    }))
  }, [])

  // 处理过滤
  const handleFilter = useCallback((filters: Partial<PlaybookSearchParams>) => {
    setSearchParams(prev => ({
      ...prev,
      ...filters,
      page: 1
    }))
  }, [])

  // 处理选择
  const handleSelect = useCallback((ids: number[]) => {
    setSelectedPlaybooks(ids)
  }, [])

  // 处理批量删除
  const handleBatchDelete = useCallback(async () => {
    if (selectedPlaybooks.length === 0) return
    
    if (!window.confirm(`确定要删除选中的 ${selectedPlaybooks.length} 个 Playbook 吗？`)) {
      return
    }

    try {
      setLoading(true)
      await Promise.all(selectedPlaybooks.map(id => ansibleService.deletePlaybook(id)))
      setSelectedPlaybooks([])
      await loadPlaybooks()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '批量删除失败'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [selectedPlaybooks, loadPlaybooks])

  // 处理刷新
  const handleRefresh = useCallback(() => {
    loadPlaybooks()
    loadStatistics()
  }, [loadPlaybooks, loadStatistics])

  // 格式化时间
  const formatTime = (timeString: string) => {
    return formatDateTime(timeString, 'YYYY/MM/DD HH:mm:ss')
  }

  // 获取状态标签
  const getStatusBadge = (executionCount?: number, lastExecutedAt?: string) => {
    if (!executionCount || executionCount === 0) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          未执行
        </span>
      )
    }

    const isRecent = lastExecutedAt && 
      new Date(lastExecutedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        isRecent ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
      }`}>
        {executionCount} 次执行
      </span>
    )
  }

  // 表格列定义
  const columns = [
    {
      key: 'name',
      title: 'Playbook 名称',
      sortable: true,
      render: (playbook: AnsiblePlaybook) => (
        <div className="flex items-center space-x-3">
          <FileText size={16} className="text-blue-500" />
          <div>
            <div className="font-medium text-gray-900">{playbook.name}</div>
            {playbook.description && (
              <div className="text-sm text-gray-500 truncate max-w-xs">
                {playbook.description}
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'version',
      title: '版本',
      sortable: true,
      render: (playbook: AnsiblePlaybook) => (
        <span className="text-sm font-mono text-gray-600">{playbook.version}</span>
      )
    },
    {
      key: 'creator',
      title: '创建者',
      render: (playbook: AnsiblePlaybook) => (
        <div className="flex items-center space-x-2">
          <User size={14} className="text-gray-400" />
          <span className="text-sm text-gray-900">
            {playbook.creator?.full_name || playbook.creator?.username || '未知'}
          </span>
        </div>
      )
    },
    {
      key: 'execution_count',
      title: '执行状态',
      render: (playbook: AnsiblePlaybook) => 
        getStatusBadge(playbook.execution_count, playbook.last_executed_at)
    },
    {
      key: 'updated_at',
      title: '更新时间',
      sortable: true,
      render: (playbook: AnsiblePlaybook) => (
        <div className="flex items-center space-x-2">
          <Clock size={14} className="text-gray-400" />
          <span className="text-sm text-gray-600">
            {formatTime(playbook.updated_at)}
          </span>
        </div>
      )
    },
    {
      key: 'actions',
      title: '操作',
      render: (playbook: AnsiblePlaybook) => (
        <div className="flex items-center space-x-2">
          {onView && (
            <button
              onClick={() => onView(playbook)}
              className="text-blue-600 hover:text-blue-800"
              title="查看详情"
            >
              <Eye size={16} />
            </button>
          )}
          {onExecute && (
            <button
              onClick={() => onExecute(playbook)}
              className="text-green-600 hover:text-green-800"
              title="执行 Playbook"
            >
              <Play size={16} />
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(playbook)}
              className="text-yellow-600 hover:text-yellow-800"
              title="编辑"
            >
              <Edit size={16} />
            </button>
          )}
          {onCopy && (
            <button
              onClick={() => onCopy(playbook)}
              className="text-purple-600 hover:text-purple-800"
              title="复制"
            >
              <Copy size={16} />
            </button>
          )}
          {onExport && (
            <button
              onClick={() => onExport(playbook)}
              className="text-indigo-600 hover:text-indigo-800"
              title="导出"
            >
              <Download size={16} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(playbook)}
              className="text-red-600 hover:text-red-800"
              title="删除"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )
    }
  ]

  if (loading && playbooks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm ${className}`}>
      {/* 统计信息 */}
      {statistics && (
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{statistics.total_playbooks}</div>
              <div className="text-sm text-gray-500">总 Playbook 数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{statistics.total_executions}</div>
              <div className="text-sm text-gray-500">总执行次数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {(statistics.success_rate * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-500">成功率</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {statistics.most_used_playbooks.length}
              </div>
              <div className="text-sm text-gray-500">活跃 Playbook</div>
            </div>
          </div>
        </div>
      )}

      {/* 工具栏 */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* 搜索框 */}
          <div className="flex-1">
            <SearchForm
              placeholder="搜索 Playbook 名称、描述..."
              onSearch={handleSearch}
              className="w-full"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium transition-colors ${
                showFilters ? 'bg-gray-100 text-gray-900' : 'text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              <Filter size={16} className="mr-2" />
              筛选
              <ChevronDown size={16} className={`ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            <button
              onClick={handleRefresh}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              disabled={loading}
            >
              <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>

            {onImport && (
              <button
                onClick={onImport}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Upload size={16} className="mr-2" />
                导入
              </button>
            )}

            {onCreate && (
              <button
                onClick={onCreate}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus size={16} className="mr-2" />
                新建 Playbook
              </button>
            )}
          </div>
        </div>

        {/* 筛选器 */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  版本
                </label>
                <select
                  value={searchParams.version || ''}
                  onChange={(e) => handleFilter({ version: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">所有版本</option>
                  <option value="1.0">1.0</option>
                  <option value="2.0">2.0</option>
                  <option value="3.0">3.0</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  排序方式
                </label>
                <select
                  value={`${searchParams.sort_by}-${searchParams.sort_order}`}
                  onChange={(e) => {
                    const [sort_by, sort_order] = e.target.value.split('-')
                    handleSort(sort_by, sort_order as 'asc' | 'desc')
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="updated_at-desc">最近更新</option>
                  <option value="created_at-desc">最近创建</option>
                  <option value="name-asc">名称 A-Z</option>
                  <option value="name-desc">名称 Z-A</option>
                  <option value="execution_count-desc">执行次数</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  每页显示
                </label>
                <select
                  value={searchParams.per_page}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={10}>10 条</option>
                  <option value={20}>20 条</option>
                  <option value={50}>50 条</option>
                  <option value={100}>100 条</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 批量操作 */}
        {selectedPlaybooks.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
            <span className="text-sm text-blue-700">
              已选择 {selectedPlaybooks.length} 个 Playbook
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleBatchDelete}
                className="inline-flex items-center px-3 py-1 border border-red-300 rounded text-sm font-medium text-red-700 bg-white hover:bg-red-50"
              >
                <Trash2 size={14} className="mr-1" />
                批量删除
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 数据表格 */}
      <DataTable
        columns={columns}
        dataSource={playbooks}
        loading={loading}
        pagination={pagination ? {
          current: pagination.page,
          pageSize: pagination.per_page,
          total: pagination.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: true,
          onChange: handlePageChange
        } : false}
        rowSelection={{
          selectedRowKeys: selectedPlaybooks,
          onChange: handleSelect
        }}
        emptyText="暂无 Playbook 数据"
        className="border-0"
      />
    </div>
  )
}

export default PlaybookList