/**
 * 角色列表页面 - 美化版
 */
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit, Trash2, Users, Shield, ShieldCheck, ShieldX, Eye, X, RefreshCw, Search } from 'lucide-react'
import { DataTable, Column, PaginationConfig } from '../../components/Table'
import { RolePermissionPreview } from '../../components/RolePermissionPreview'
import { roleService } from '../../services/roles'
import { ExtendedRole } from '../../types/role'
import { useAuthStore } from '../../store/auth'
import { useTheme } from '../../hooks/useTheme'
import { formatDateTime } from '../../utils'
import { MonitorPageLayout, MonitorStatCard, MonitorContentCard } from '../../components/Monitor/MonitorPageLayout'

interface RoleListState {
  roles: ExtendedRole[]
  loading: boolean
  total: number
  current: number
  pageSize: number
  searchParams: { keyword?: string; status?: number }
  selectedRole?: ExtendedRole
  showPermissionPreview: boolean
}

export const RoleList: React.FC = () => {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { hasPermission } = useAuthStore()
  const abortControllerRef = useRef<AbortController | null>(null)
  
  const [state, setState] = useState<RoleListState>({
    roles: [], loading: false, total: 0, current: 1, pageSize: 10,
    searchParams: {}, selectedRole: undefined, showPermissionPreview: false
  })
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const loadRoles = async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    abortControllerRef.current = new AbortController()
    setState(prev => ({ ...prev, loading: true }))
    
    try {
      const response = await roleService.getList({
        page: state.current, per_page: state.pageSize, ...state.searchParams
      })
      if (response.success) {
        setState(prev => ({
          ...prev, roles: response.data.items || [],
          total: response.data.pagination?.total || response.data.total || 0, loading: false
        }))
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return
      console.error('加载角色列表失败:', error)
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  const searchParamsKey = useMemo(() => JSON.stringify(state.searchParams), [state.searchParams])

  const handleSearch = () => {
    const params: any = {}
    if (keyword) params.keyword = keyword
    if (statusFilter !== '') params.status = parseInt(statusFilter)
    setState(prev => ({ ...prev, searchParams: params, current: 1 }))
  }

  const handlePaginationChange = (page: number, pageSize: number) => {
    setState(prev => ({ ...prev, current: page, pageSize }))
  }

  const isSuperAdmin = (role: ExtendedRole) => role.name === 'super_admin' || role.name === '超级管理员'

  const handleToggleStatus = async (role: ExtendedRole) => {
    if (!hasPermission('role:update') || isSuperAdmin(role)) return
    try {
      await roleService.update(role.id, { status: role.status === 1 ? 0 : 1 })
      loadRoles()
    } catch (error) { console.error('更新角色状态失败:', error) }
  }

  const handleDelete = async (role: ExtendedRole) => {
    if (!hasPermission('role:delete') || isSuperAdmin(role)) return
    if (!confirm(`确定要删除角色 "${role.name}" 吗？`)) return
    try { await roleService.delete(role.id); loadRoles() } catch (error) { console.error('删除角色失败:', error) }
  }

  const handleViewPermissions = (role: ExtendedRole) => {
    setState(prev => ({ ...prev, selectedRole: role, showPermissionPreview: true }))
  }

  useEffect(() => {
    loadRoles()
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort() }
  }, [state.current, state.pageSize, searchParamsKey])

  const statistics = useMemo(() => {
    const totalRoles = state.total
    const activeRoles = state.roles.filter(r => r.status === 1).length
    const inactiveRoles = state.roles.filter(r => r.status === 0).length
    const totalUsers = state.roles.reduce((sum, r) => sum + (r.user_count || 0), 0)
    const avgPermissions = state.roles.length > 0 
      ? Math.round(state.roles.reduce((sum, r) => sum + (r.permissions?.length || 0), 0) / state.roles.length) : 0
    return { totalRoles, activeRoles, inactiveRoles, totalUsers, avgPermissions }
  }, [state.roles, state.total])

  const columns: Column<ExtendedRole>[] = [
    {
      key: 'name', title: '角色名称', dataIndex: 'name', sortable: true,
      render: (value, record) => (
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-xl ${isDark ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20' : 'bg-gradient-to-br from-blue-50 to-cyan-50'}`}>
            {record.permissions?.length >= 5 ? <ShieldCheck className="w-5 h-5 text-emerald-500" /> : 
             record.permissions?.length > 0 ? <Shield className="w-5 h-5 text-blue-500" /> : <ShieldX className="w-5 h-5 text-gray-400" />}
          </div>
          <div>
            <div className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</div>
            {isSuperAdmin(record) && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>系统角色</span>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'description', title: '描述', dataIndex: 'description',
      render: (value) => <p className={`text-sm line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{value || '暂无描述'}</p>
    },
    {
      key: 'permissions', title: '权限信息', align: 'center', width: 140,
      render: (_, record) => {
        const count = record.permissions?.length || 0
        const categoryCount = Object.keys(record.permissions?.reduce((acc: Record<string, number>, perm: string) => {
          acc[perm.split(':')[0]] = 1; return acc
        }, {}) || {}).length
        return (
          <div className="flex flex-col items-center space-y-1">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>{count} 个权限</span>
            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{categoryCount} 个模块</span>
          </div>
        )
      }
    },
    {
      key: 'user_count', title: '使用情况', align: 'center', width: 130,
      render: (_, record) => {
        const userCount = record.user_count || 0
        const level = userCount === 0 ? 'none' : userCount < 5 ? 'low' : userCount < 20 ? 'medium' : 'high'
        const colors = {
          none: isDark ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-600',
          low: isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700',
          medium: isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700',
          high: isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
        }
        return (
          <div className="flex flex-col items-center space-y-1">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${colors[level]}`}>
              <Users className="w-3 h-3 mr-1" />{userCount} 用户
            </div>
          </div>
        )
      }
    },
    {
      key: 'status', title: '状态', dataIndex: 'status', width: 100, align: 'center',
      render: (value, record) => {
        if (isSuperAdmin(record)) return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>启用</span>
        return (
          <button onClick={() => handleToggleStatus(record)} disabled={!hasPermission('role:update')}
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              value === 1 ? (isDark ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200')
              : (isDark ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-100 text-red-700 hover:bg-red-200')
            } ${!hasPermission('role:update') ? 'cursor-not-allowed opacity-50' : ''}`}>
            {value === 1 ? '启用' : '禁用'}
          </button>
        )
      }
    },
    {
      key: 'created_at', title: '创建时间', dataIndex: 'created_at', width: 160, sortable: true,
      render: (value) => value ? (
        <div className="flex flex-col">
          <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatDateTime(value, 'YYYY/MM/DD')}</span>
          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{formatDateTime(value, 'HH:mm:ss')}</span>
        </div>
      ) : '-'
    },
    {
      key: 'actions', title: '操作', width: 140, align: 'center',
      render: (_, record) => {
        const isSuper = isSuperAdmin(record)
        return (
          <div className="flex items-center justify-center space-x-1">
            <button onClick={() => handleViewPermissions(record)} title="查看权限"
              className={`p-2 rounded-lg transition-colors ${isDark ? 'text-emerald-400 hover:bg-emerald-500/20' : 'text-emerald-600 hover:bg-emerald-50'}`}>
              <Eye className="w-4 h-4" />
            </button>
            {!isSuper && hasPermission('role:update') && (
              <button onClick={() => navigate(`/roles/edit/${record.id}`)} title="编辑"
                className={`p-2 rounded-lg transition-colors ${isDark ? 'text-blue-400 hover:bg-blue-500/20' : 'text-blue-600 hover:bg-blue-50'}`}>
                <Edit className="w-4 h-4" />
              </button>
            )}
            {!isSuper && hasPermission('role:delete') && (
              <button onClick={() => handleDelete(record)} title="删除"
                className={`p-2 rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-600 hover:bg-red-50'}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            {isSuper && <span className={`p-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} title="系统角色"><Shield className="w-4 h-4" /></span>}
          </div>
        )
      }
    }
  ]

  const paginationConfig: PaginationConfig = {
    current: state.current, pageSize: state.pageSize, total: state.total,
    showSizeChanger: true, showQuickJumper: true, showTotal: true,
    pageSizeOptions: [10, 20, 50, 100], onChange: handlePaginationChange
  }

  const headerActions = hasPermission('role:create') ? (
    <button onClick={() => navigate('/roles/new')}
      className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium overflow-hidden transition-all">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <Plus className="relative w-4 h-4" /><span className="relative">新增角色</span>
    </button>
  ) : null

  return (
    <MonitorPageLayout title="角色管理" subtitle="管理系统角色和权限分配" icon={Shield}
      iconGradient="from-emerald-500 via-green-500 to-teal-500" headerActions={headerActions}
      loading={state.loading} onRefresh={loadRoles} showFullscreen={false}>
      
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 mb-6">
        <MonitorStatCard title="总角色数" value={statistics.totalRoles} subtitle="系统中所有角色" icon={Shield}
          iconColorClass="text-blue-400" glowColor="bg-blue-500" />
        <MonitorStatCard title="启用角色" value={statistics.activeRoles} subtitle="当前可用角色" icon={ShieldCheck}
          variant="success" iconColorClass="text-emerald-400" glowColor="bg-emerald-500" />
        <MonitorStatCard title="禁用角色" value={statistics.inactiveRoles} subtitle="已停用角色" icon={ShieldX}
          variant={statistics.inactiveRoles > 0 ? 'danger' : 'default'} 
          valueColorClass={statistics.inactiveRoles > 0 ? 'text-red-500' : undefined}
          iconColorClass={statistics.inactiveRoles > 0 ? 'text-red-400' : 'text-gray-400'} glowColor="bg-red-500" />
        <MonitorStatCard title="关联用户" value={statistics.totalUsers} subtitle="使用角色的用户" icon={Users}
          iconColorClass="text-purple-400" glowColor="bg-purple-500" />
        <MonitorStatCard title="平均权限" value={statistics.avgPermissions} subtitle="每角色平均权限数" icon={Shield}
          iconColorClass="text-amber-400" glowColor="bg-amber-500" />
      </div>

      {/* 搜索区域 */}
      <MonitorContentCard className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>关键词</label>
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索角色名称或描述"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                }`} />
            </div>
          </div>
          <div className="w-40">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>状态</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
              }`}>
              <option value="">全部</option>
              <option value="1">启用</option>
              <option value="0">禁用</option>
            </select>
          </div>
          <button onClick={handleSearch}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/30">
            搜索
          </button>
        </div>
      </MonitorContentCard>

      {/* 角色列表 */}
      <MonitorContentCard title="角色列表" icon={Shield}
        headerActions={<span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>共 {state.total} 个角色</span>} noPadding>
        <DataTable columns={columns} dataSource={state.roles} loading={state.loading}
          pagination={paginationConfig} rowKey="id" size="middle" />
      </MonitorContentCard>

      {/* 权限预览模态框 */}
      {state.showPermissionPreview && state.selectedRole && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-xl ${isDark ? 'bg-gradient-to-br from-emerald-500/20 to-green-500/20' : 'bg-gradient-to-br from-emerald-50 to-green-50'}`}>
                  <Shield className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                </div>
                <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  角色权限详情 - {state.selectedRole.name}
                </h2>
              </div>
              <button onClick={() => setState(prev => ({ ...prev, selectedRole: undefined, showPermissionPreview: false }))}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <RolePermissionPreview role={state.selectedRole} showDetails={true} className="border-0 rounded-none" />
            </div>
          </div>
        </div>
      )}
    </MonitorPageLayout>
  )
}

export default RoleList
