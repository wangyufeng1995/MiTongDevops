/**
 * 用户列表页面 - 美化版
 */
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit, Trash2, UserCheck, UserX, Users, Shield, Search, Mail, Calendar, AlertTriangle, X } from 'lucide-react'
import { DataTable, Column, PaginationConfig } from '../../components/Table'
import { Avatar } from '../../components/Avatar'
import { userService } from '../../services/users'
import { User } from '../../types/auth'
import { useAuthStore } from '../../store/auth'
import { useTheme } from '../../hooks/useTheme'
import { formatDateTime } from '../../utils'
import { MonitorPageLayout, MonitorStatCard, MonitorContentCard } from '../../components/Monitor/MonitorPageLayout'

interface UserListState {
  users: User[]
  loading: boolean
  total: number
  current: number
  pageSize: number
  searchParams: { keyword?: string; status?: number; role_id?: number }
}

// 删除确认弹窗状态
interface DeleteModalState {
  open: boolean
  user: User | null
  loading: boolean
}

export const UserList: React.FC = () => {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { hasPermission } = useAuthStore()
  const abortControllerRef = useRef<AbortController | null>(null)
  
  const [state, setState] = useState<UserListState>({
    users: [], loading: false, total: 0, current: 1, pageSize: 10, searchParams: {}
  })
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    open: false, user: null, loading: false
  })

  const loadUsers = async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    abortControllerRef.current = new AbortController()
    setState(prev => ({ ...prev, loading: true }))
    
    try {
      const response = await userService.getList({
        page: state.current, per_page: state.pageSize, ...state.searchParams
      })
      if (response.success) {
        const data = response.data
        setState(prev => ({
          ...prev, users: data.users || data.items || [],
          total: data.pagination?.total || 0, loading: false
        }))
      } else {
        setState(prev => ({ ...prev, loading: false }))
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return
      console.error('加载用户列表失败:', error)
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

  const handleToggleStatus = async (user: User) => {
    if (!hasPermission('user:update')) return
    try {
      await userService.update(user.id, { status: user.status === 1 ? 0 : 1 })
      loadUsers()
    } catch (error) { console.error('更新用户状态失败:', error) }
  }

  const handleDelete = async (user: User) => {
    if (!hasPermission('user:delete')) return
    if (user.username === 'admin') { alert('不能删除admin用户'); return }
    setDeleteModal({ open: true, user, loading: false })
  }

  const confirmDelete = async () => {
    if (!deleteModal.user) return
    setDeleteModal(prev => ({ ...prev, loading: true }))
    try {
      await userService.delete(deleteModal.user.id)
      setDeleteModal({ open: false, user: null, loading: false })
      loadUsers()
    } catch (error: any) {
      alert(error?.message || '删除用户失败')
      setDeleteModal(prev => ({ ...prev, loading: false }))
    }
  }

  const closeDeleteModal = () => {
    if (!deleteModal.loading) {
      setDeleteModal({ open: false, user: null, loading: false })
    }
  }

  useEffect(() => {
    loadUsers()
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort() }
  }, [state.current, state.pageSize, searchParamsKey])

  const statistics = useMemo(() => {
    const totalUsers = state.total
    const activeUsers = state.users.filter(u => u.status === 1).length
    const inactiveUsers = state.users.filter(u => u.status === 0).length
    const usersWithRoles = state.users.filter(u => u.roles && u.roles.length > 0).length
    return { totalUsers, activeUsers, inactiveUsers, usersWithRoles }
  }, [state.users, state.total])

  const columns: Column<User>[] = [
    {
      key: 'user', title: '用户信息', width: '20%',
      render: (_, record) => (
        <div className="flex items-center space-x-3">
          <div className={`p-1 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
            <Avatar config={{ style: record.avatar_style || 'avataaars', seed: record.avatar_seed || record.username, options: record.avatar_config || {} }} size={40} />
          </div>
          <div className="min-w-0">
            <div className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{record.full_name || record.username}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>@{record.username}</div>
          </div>
        </div>
      )
    },
    {
      key: 'email', title: '邮箱', dataIndex: 'email', width: '20%', sortable: true,
      render: (value) => (
        <a href={`mailto:${value}`} className={`flex items-center space-x-2 text-sm ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}>
          <Mail className="w-4 h-4" /><span className="truncate">{value}</span>
        </a>
      )
    },
    {
      key: 'roles', title: '角色', width: '20%',
      render: (_, record) => (
        <div className="flex flex-wrap gap-1">
          {record.roles?.length ? record.roles.map(role => (
            <span key={role.id} title={`${role.display_name || role.name} - ${role.permissions?.length || 0}个权限`}
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
              <Shield className="w-3 h-3 mr-1" />{role.display_name || role.name}
            </span>
          )) : <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>未分配角色</span>}
        </div>
      )
    },
    {
      key: 'status', title: '状态', dataIndex: 'status', width: '12%', align: 'center',
      render: (value, record) => (
        <button onClick={() => handleToggleStatus(record)} disabled={!hasPermission('user:update')}
          className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            value === 1 ? (isDark ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200')
            : (isDark ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-100 text-red-700 hover:bg-red-200')
          } ${!hasPermission('user:update') ? 'cursor-not-allowed opacity-50' : ''}`}>
          {value === 1 ? <><UserCheck className="w-3.5 h-3.5 mr-1" />正常</> : <><UserX className="w-3.5 h-3.5 mr-1" />禁用</>}
        </button>
      )
    },
    {
      key: 'created_at', title: '创建时间', dataIndex: 'created_at', width: '16%', sortable: true,
      render: (value) => value ? (
        <div className="flex items-center space-x-2">
          <Calendar className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <div className="flex flex-col">
            <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatDateTime(value, 'YYYY/MM/DD')}</span>
            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{formatDateTime(value, 'HH:mm:ss')}</span>
          </div>
        </div>
      ) : '-'
    },
    {
      key: 'actions', title: '操作', width: '12%', align: 'center',
      render: (_, record) => (
        <div className="flex items-center justify-center space-x-1">
          {hasPermission('user:update') && (
            <button onClick={() => navigate(`/users/edit/${record.id}`)} title="编辑"
              className={`p-2 rounded-lg transition-colors ${isDark ? 'text-blue-400 hover:bg-blue-500/20' : 'text-blue-600 hover:bg-blue-50'}`}>
              <Edit className="w-4 h-4" />
            </button>
          )}
          {hasPermission('user:delete') && (
            <button onClick={() => handleDelete(record)} disabled={record.username === 'admin'} title={record.username === 'admin' ? '不能删除admin用户' : '删除'}
              className={`p-2 rounded-lg transition-colors ${record.username === 'admin' ? (isDark ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 cursor-not-allowed') : (isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-600 hover:bg-red-50')}`}>
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ]

  const paginationConfig: PaginationConfig = {
    current: state.current, pageSize: state.pageSize, total: state.total,
    showSizeChanger: true, showQuickJumper: true, showTotal: true,
    pageSizeOptions: [10, 20, 50, 100], onChange: handlePaginationChange
  }

  const headerActions = hasPermission('user:create') ? (
    <button onClick={() => navigate('/users/new')}
      className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium overflow-hidden transition-all">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <Plus className="relative w-4 h-4" /><span className="relative">新增用户</span>
    </button>
  ) : null

  return (
    <MonitorPageLayout title="用户管理" subtitle="管理系统用户和权限分配" icon={Users}
      iconGradient="from-blue-500 via-indigo-500 to-purple-500" headerActions={headerActions}
      loading={state.loading} onRefresh={loadUsers} showFullscreen={false}>
      
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <MonitorStatCard title="总用户数" value={statistics.totalUsers} subtitle="系统中所有用户" icon={Users}
          iconColorClass="text-blue-400" glowColor="bg-blue-500" />
        <MonitorStatCard title="正常用户" value={statistics.activeUsers} subtitle="当前可用用户" icon={UserCheck}
          variant="success" iconColorClass="text-emerald-400" glowColor="bg-emerald-500" />
        <MonitorStatCard title="禁用用户" value={statistics.inactiveUsers} subtitle="已停用用户" icon={UserX}
          variant={statistics.inactiveUsers > 0 ? 'danger' : 'default'} 
          valueColorClass={statistics.inactiveUsers > 0 ? 'text-red-500' : undefined}
          iconColorClass={statistics.inactiveUsers > 0 ? 'text-red-400' : 'text-gray-400'} glowColor="bg-red-500" />
        <MonitorStatCard title="已分配角色" value={statistics.usersWithRoles} subtitle="拥有角色的用户" icon={Shield}
          iconColorClass="text-purple-400" glowColor="bg-purple-500" />
      </div>

      {/* 搜索区域 */}
      <MonitorContentCard className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>关键词</label>
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索用户名、姓名或邮箱"
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
              <option value="1">正常</option>
              <option value="0">禁用</option>
            </select>
          </div>
          <button onClick={handleSearch}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/30">
            搜索
          </button>
        </div>
      </MonitorContentCard>

      {/* 用户列表 */}
      <MonitorContentCard title="用户列表" icon={Users}
        headerActions={<span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>共 {state.total} 个用户</span>} noPadding>
        <DataTable columns={columns} dataSource={state.users} loading={state.loading}
          pagination={paginationConfig} rowKey="id" size="middle" />
      </MonitorContentCard>

      {/* 删除确认弹窗 */}
      {deleteModal.open && deleteModal.user && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all ${
            isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'
          }`}>
            {/* 弹窗头部 */}
            <div className={`px-6 py-5 ${isDark ? 'bg-gradient-to-r from-red-500/20 to-orange-500/20' : 'bg-gradient-to-r from-red-50 to-orange-50'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-red-500/30' : 'bg-red-100'}`}>
                    <AlertTriangle className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>删除用户确认</h3>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>此操作不可撤销</p>
                  </div>
                </div>
                <button onClick={closeDeleteModal} disabled={deleteModal.loading}
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 弹窗内容 */}
            <div className="px-6 py-5">
              <div className={`rounded-xl p-4 mb-4 ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
                <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-800'}`}>
                  您确定要删除用户 <span className="font-bold">"{deleteModal.user.full_name || deleteModal.user.username}"</span> 吗？
                </p>
                <p className={`text-sm mt-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                  ⚠️ 删除后，该用户的所有数据将被永久删除，无法恢复。
                </p>
              </div>
              
              {/* 用户信息展示 */}
              <div className={`rounded-xl p-4 ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                <div className="flex items-center space-x-3 mb-3">
                  <div className={`p-1 rounded-xl ${isDark ? 'bg-slate-600' : 'bg-white'}`}>
                    <Avatar config={{ 
                      style: deleteModal.user.avatar_style || 'avataaars', 
                      seed: deleteModal.user.avatar_seed || deleteModal.user.username, 
                      options: deleteModal.user.avatar_config || {} 
                    }} size={40} />
                  </div>
                  <div>
                    <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {deleteModal.user.full_name || deleteModal.user.username}
                    </div>
                    <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      @{deleteModal.user.username}
                    </div>
                  </div>
                </div>
                <div className={`text-sm space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  <div className="flex justify-between">
                    <span>邮箱:</span>
                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{deleteModal.user.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>角色:</span>
                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                      {deleteModal.user.roles?.map(r => r.display_name || r.name).join(', ') || '未分配'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 弹窗底部 */}
            <div className={`flex items-center justify-end space-x-3 px-6 py-4 border-t ${
              isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-100 bg-gray-50'
            }`}>
              <button onClick={closeDeleteModal} disabled={deleteModal.loading}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isDark 
                    ? 'text-gray-300 bg-slate-700 hover:bg-slate-600 border border-slate-600' 
                    : 'text-gray-700 bg-white hover:bg-gray-50 border border-gray-300'
                } ${deleteModal.loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                取消
              </button>
              <button onClick={confirmDelete} disabled={deleteModal.loading}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all flex items-center space-x-2 
                  bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/25
                  ${deleteModal.loading ? 'opacity-70 cursor-not-allowed' : ''}`}>
                {deleteModal.loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>删除中...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>确认删除</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </MonitorPageLayout>
  )
}

export default UserList
