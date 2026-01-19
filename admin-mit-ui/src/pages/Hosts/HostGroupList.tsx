/**
 * 主机分组列表组件 - 美化版
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderOpen, Edit, Trash2, Server, Search, Layers, FolderPlus } from 'lucide-react'
import { DataTable, Column, PaginationConfig } from '../../components/Table'
import { hostGroupsService } from '../../services/hostGroups'
import { HostGroupForm } from './HostGroupForm'
import { useAuthStore } from '../../store/auth'
import { useTheme } from '../../hooks/useTheme'
import { formatDateTime } from '../../utils'
import { MonitorPageLayout, MonitorStatCard, MonitorContentCard } from '../../components/Monitor/MonitorPageLayout'
import type { HostGroup, CreateHostGroupRequest, UpdateHostGroupRequest } from '../../types/host'

interface HostGroupListState {
  groups: HostGroup[]
  loading: boolean
  error: string | null
  pagination: { page: number; per_page: number; total: number; pages: number }
  search: string
}

interface FormState {
  isOpen: boolean
  editingGroup: HostGroup | null
  loading: boolean
}

export const HostGroupList: React.FC = () => {
  const { hasPermission } = useAuthStore()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  
  const [state, setState] = useState<HostGroupListState>({
    groups: [], loading: true, error: null,
    pagination: { page: 1, per_page: 10, total: 0, pages: 0 }, search: ''
  })

  const [formState, setFormState] = useState<FormState>({ isOpen: false, editingGroup: null, loading: false })
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  const loadGroups = useCallback(async (page = 1, search = '') => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      const response = await hostGroupsService.getGroups({ page, per_page: state.pagination.per_page })
      let filteredGroups = response.groups || []
      if (search.trim()) {
        const searchLower = search.toLowerCase().trim()
        filteredGroups = filteredGroups.filter(group => 
          group.name.toLowerCase().includes(searchLower) || (group.description && group.description.toLowerCase().includes(searchLower))
        )
      }
      setState(prev => ({
        ...prev, groups: filteredGroups, loading: false,
        pagination: { ...prev.pagination, page, total: response.pagination?.total || filteredGroups.length, pages: response.pagination?.pages || Math.ceil(filteredGroups.length / prev.pagination.per_page) }
      }))
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message || '加载分组列表失败', loading: false }))
    }
  }, [state.pagination.per_page])

  useEffect(() => { loadGroups() }, [])

  const handleSearch = useCallback((searchValue: string) => {
    setState(prev => ({ ...prev, search: searchValue }))
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => loadGroups(1, searchValue), 300)
  }, [loadGroups])

  const handlePageChange = (page: number, pageSize: number) => {
    setState(prev => ({ ...prev, pagination: { ...prev.pagination, page, per_page: pageSize } }))
    loadGroups(page, state.search)
  }

  const handleCreate = () => setFormState({ isOpen: true, editingGroup: null, loading: false })
  const handleEdit = (group: HostGroup) => setFormState({ isOpen: true, editingGroup: group, loading: false })
  const handleCloseForm = () => setFormState({ isOpen: false, editingGroup: null, loading: false })

  const handleSubmit = async (data: CreateHostGroupRequest | UpdateHostGroupRequest) => {
    setFormState(prev => ({ ...prev, loading: true }))
    try {
      if (formState.editingGroup) await hostGroupsService.updateGroup(formState.editingGroup.id, data)
      else await hostGroupsService.createGroup(data as CreateHostGroupRequest)
      handleCloseForm()
      loadGroups(state.pagination.page, state.search)
    } catch (error: any) {
      if (error.message?.includes('已存在')) throw new Error('分组名称已存在')
      throw error
    } finally {
      setFormState(prev => ({ ...prev, loading: false }))
    }
  }

  const handleDelete = async (group: HostGroup) => {
    const msg = group.host_count > 0 ? `分组 "${group.name}" 下有 ${group.host_count} 台主机，删除后这些主机将变为未分组状态。确定要删除吗？` : `确定要删除分组 "${group.name}" 吗？`
    if (!confirm(msg)) return
    try { await hostGroupsService.deleteGroup(group.id); loadGroups(state.pagination.page, state.search) }
    catch (error: any) { alert(error.message || '删除分组失败') }
  }

  const existingNames = state.groups.filter(g => g.id !== formState.editingGroup?.id).map(g => g.name)

  const statistics = useMemo(() => {
    const totalGroups = state.pagination.total
    const totalHosts = state.groups.reduce((sum, g) => sum + (g.host_count || 0), 0)
    const emptyGroups = state.groups.filter(g => g.host_count === 0).length
    const avgHosts = state.groups.length > 0 ? Math.round(totalHosts / state.groups.length) : 0
    return { totalGroups, totalHosts, emptyGroups, avgHosts }
  }, [state.groups, state.pagination.total])

  const columns: Column<HostGroup>[] = [
    {
      key: 'name', title: '分组名称', width: '16.66%',
      render: (_, group) => (
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-xl flex-shrink-0 ${isDark ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20' : 'bg-gradient-to-br from-purple-50 to-pink-50'}`}>
            <FolderOpen className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
          </div>
          <div className="min-w-0">
            <div className={`font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{group.name}</div>
          </div>
        </div>
      )
    },
    {
      key: 'host_count', title: '主机数量', width: '16.66%', align: 'center',
      render: (_, group) => (
        <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${
          group.host_count > 0 ? (isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700') : (isDark ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-500')
        }`}>
          <Server className="w-3.5 h-3.5 mr-1.5" />{group.host_count} 台
        </div>
      )
    },
    {
      key: 'created_at', title: '创建时间', width: '16.66%',
      render: (_, group) => (
        <div className="flex flex-col">
          <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatDateTime(group.created_at, 'YYYY/MM/DD')}</span>
          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{formatDateTime(group.created_at, 'HH:mm:ss')}</span>
        </div>
      )
    },
    {
      key: 'updated_at', title: '更新时间', width: '16.66%',
      render: (_, group) => (
        <div className="flex flex-col">
          <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatDateTime(group.updated_at, 'YYYY/MM/DD')}</span>
          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{formatDateTime(group.updated_at, 'HH:mm:ss')}</span>
        </div>
      )
    },
    {
      key: 'actions', title: '操作', width: '16.66%', align: 'center',
      render: (_, group) => (
        <div className="flex items-center justify-center space-x-1">
          {hasPermission('host:update') && (
            <button onClick={() => handleEdit(group)} title="编辑"
              className={`p-2 rounded-lg transition-colors ${isDark ? 'text-blue-400 hover:bg-blue-500/20' : 'text-blue-600 hover:bg-blue-50'}`}>
              <Edit className="w-4 h-4" />
            </button>
          )}
          {hasPermission('host:delete') && (
            <button onClick={() => handleDelete(group)} title="删除"
              className={`p-2 rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-600 hover:bg-red-50'}`}>
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    },
    {
      key: 'description', title: '描述', width: '16.66%',
      render: (_, group) => (
        <div className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {group.description || '-'}
        </div>
      )
    }
  ]

  const paginationConfig: PaginationConfig = {
    current: state.pagination.page, pageSize: state.pagination.per_page, total: state.pagination.total,
    showSizeChanger: true, showTotal: true, pageSizeOptions: [10, 20, 50], onChange: handlePageChange
  }

  const headerActions = hasPermission('host:create') ? (
    <button onClick={handleCreate}
      className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium overflow-hidden transition-all">
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-purple-700 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <Plus className="relative w-4 h-4" /><span className="relative">创建分组</span>
    </button>
  ) : null

  return (
    <MonitorPageLayout title="主机分组" subtitle="管理主机分组，对主机进行分类管理" icon={FolderOpen}
      iconGradient="from-purple-500 via-pink-500 to-rose-500" headerActions={headerActions}
      loading={state.loading} onRefresh={() => loadGroups(state.pagination.page, state.search)} showFullscreen={false}>
      
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <MonitorStatCard title="总分组数" value={statistics.totalGroups} subtitle="系统中所有分组" icon={Layers} iconColorClass="text-purple-400" glowColor="bg-purple-500" />
        <MonitorStatCard title="关联主机" value={statistics.totalHosts} subtitle="已分组的主机总数" icon={Server} iconColorClass="text-blue-400" glowColor="bg-blue-500" />
        <MonitorStatCard title="空分组" value={statistics.emptyGroups} subtitle="没有主机的分组" icon={FolderPlus}
          variant={statistics.emptyGroups > 0 ? 'warning' : 'default'} iconColorClass={statistics.emptyGroups > 0 ? 'text-amber-400' : 'text-gray-400'} glowColor="bg-amber-500" />
        <MonitorStatCard title="平均主机数" value={statistics.avgHosts} subtitle="每分组平均主机" icon={FolderOpen} iconColorClass="text-cyan-400" glowColor="bg-cyan-500" />
      </div>

      {/* 搜索区域 */}
      <MonitorContentCard className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>关键词</label>
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              <input type="text" value={state.search} onChange={(e) => handleSearch(e.target.value)} placeholder="搜索分组名称或描述"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
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

      {/* 分组列表 */}
      <MonitorContentCard title="分组列表" icon={FolderOpen}
        headerActions={<span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>共 {state.pagination.total} 个分组</span>} noPadding>
        <DataTable columns={columns} dataSource={state.groups} loading={state.loading} pagination={paginationConfig} rowKey="id" size="middle" emptyText="暂无分组数据" />
      </MonitorContentCard>

      {/* 分组表单弹窗 */}
      <HostGroupForm isOpen={formState.isOpen} group={formState.editingGroup} onClose={handleCloseForm}
        onSubmit={handleSubmit} loading={formState.loading} existingNames={existingNames} />
    </MonitorPageLayout>
  )
}

export default HostGroupList