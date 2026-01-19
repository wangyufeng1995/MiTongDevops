/**
 * 数据库连接列表组件 - 美化版
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Database, Search, Edit, Trash2, RefreshCw, CheckCircle, XCircle, Link, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { MonitorPageLayout, MonitorContentCard, MonitorStatCard } from '../../components/Monitor/MonitorPageLayout'
import { Modal } from '../../components/Modal'
import { useAuthStore } from '../../store/auth'
import { useTheme } from '../../hooks/useTheme'
import { databaseService, DatabaseConnection, DatabaseType, DATABASE_TYPES } from '../../services/database'
import { formatDateTime } from '../../utils'
import { DeleteConfirmModal, DatabaseToastContainer, databaseToast } from './components'
import ConnectionForm from './ConnectionForm'

// 数据库类型颜色配置
const DatabaseTypeColors: Record<DatabaseType, { gradient: string; badge: string; badgeDark: string }> = {
  postgresql: { gradient: 'from-blue-500 to-indigo-600', badge: 'bg-blue-100 text-blue-700 border-blue-200', badgeDark: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  mysql: { gradient: 'from-orange-500 to-amber-600', badge: 'bg-orange-100 text-orange-700 border-orange-200', badgeDark: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  dm: { gradient: 'from-red-500 to-rose-600', badge: 'bg-red-100 text-red-700 border-red-200', badgeDark: 'bg-red-500/20 text-red-300 border-red-500/30' },
  oracle: { gradient: 'from-red-700 to-orange-600', badge: 'bg-red-100 text-red-800 border-red-200', badgeDark: 'bg-red-500/20 text-red-300 border-red-500/30' }
}

interface ConnectionListState {
  connections: DatabaseConnection[]
  loading: boolean
  error: string | null
  pagination: { page: number; per_page: number; total: number; pages: number; has_prev: boolean; has_next: boolean }
  search: string
  testingConnections: Set<number>
  showFormModal: boolean
  editingConnection: DatabaseConnection | null
  showDeleteConfirm: boolean
  deletingConnection: DatabaseConnection | null
  deleteLoading: boolean
}

export const ConnectionList: React.FC = () => {
  const { hasPermission } = useAuthStore()
  const { isDark } = useTheme()

  const [state, setState] = useState<ConnectionListState>({
    connections: [], loading: true, error: null,
    pagination: { page: 1, per_page: 10, total: 0, pages: 0, has_prev: false, has_next: false },
    search: '', testingConnections: new Set(), showFormModal: false, editingConnection: null,
    showDeleteConfirm: false, deletingConnection: null, deleteLoading: false
  })

  const loadConnections = useCallback(async (page = 1, search = '') => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      const response = await databaseService.getConnections({ page, per_page: state.pagination.per_page, search: search.trim() || undefined })
      setState(prev => ({ ...prev, connections: response?.connections || [], pagination: response?.pagination || prev.pagination, loading: false }))
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message || '加载连接列表失败', loading: false }))
    }
  }, [state.pagination.per_page])

  useEffect(() => { loadConnections() }, [])

  const searchTimeoutRef = React.useRef<NodeJS.Timeout>()
  const handleSearch = useCallback((searchValue: string) => {
    setState(prev => ({ ...prev, search: searchValue }))
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => loadConnections(1, searchValue), 300)
  }, [loadConnections])

  const handlePageChange = useCallback((page: number) => loadConnections(page, state.search), [loadConnections, state.search])

  const handleTestConnection = async (connection: DatabaseConnection) => {
    if (state.testingConnections.has(connection.id)) return
    setState(prev => ({ ...prev, testingConnections: new Set([...prev.testingConnections, connection.id]) }))
    try {
      const result = await databaseService.testConnection(connection.id)
      if (result.connected) databaseToast.connectionSuccess('连接测试成功', `${connection.name} 连接正常`)
      else databaseToast.connectionError('连接测试失败', result.message || '无法连接到数据库')
    } catch (error: any) { databaseToast.error('测试连接失败', error.message) }
    finally { setState(prev => ({ ...prev, testingConnections: new Set([...prev.testingConnections].filter(id => id !== connection.id)) })) }
  }

  const handleCreate = () => setState(prev => ({ ...prev, showFormModal: true, editingConnection: null }))
  const handleEdit = (connection: DatabaseConnection) => setState(prev => ({ ...prev, showFormModal: true, editingConnection: connection }))
  const handleCloseFormModal = () => setState(prev => ({ ...prev, showFormModal: false, editingConnection: null }))
  const handleFormSuccess = () => { handleCloseFormModal(); loadConnections(state.pagination.page, state.search); databaseToast.success(state.editingConnection ? '更新成功' : '创建成功', state.editingConnection ? '连接配置已更新' : '连接配置已创建') }
  const handleDeleteClick = (connection: DatabaseConnection) => setState(prev => ({ ...prev, showDeleteConfirm: true, deletingConnection: connection }))
  const handleCancelDelete = () => setState(prev => ({ ...prev, showDeleteConfirm: false, deletingConnection: null }))

  const handleConfirmDelete = async () => {
    if (!state.deletingConnection) return
    setState(prev => ({ ...prev, deleteLoading: true }))
    try {
      await databaseService.deleteConnection(state.deletingConnection.id)
      databaseToast.success('删除成功', `连接 "${state.deletingConnection.name}" 已删除`)
      setState(prev => ({ ...prev, showDeleteConfirm: false, deletingConnection: null, deleteLoading: false }))
      loadConnections(state.pagination.page, state.search)
    } catch (error: any) { databaseToast.error('删除失败', error.message); setState(prev => ({ ...prev, deleteLoading: false })) }
  }

  // 统计数据
  const enabledCount = state.connections.filter(c => c.status === 1).length
  const disabledCount = state.connections.filter(c => c.status !== 1).length

  const headerActions = (
    <div className="flex items-center space-x-3">
      <div className="relative">
        <input type="text" placeholder="搜索连接..." value={state.search} onChange={(e) => handleSearch(e.target.value)}
          className={`pl-10 pr-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 w-64 ${isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
        <Search className={`absolute left-3 top-3 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
      </div>
      <button onClick={handleCreate}
        className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-white font-medium overflow-hidden transition-all">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <Plus className="relative w-4 h-4" /><span className="relative">添加连接</span>
      </button>
    </div>
  )

  return (
    <MonitorPageLayout title="数据库连接" subtitle="管理数据库连接配置" icon={Database}
      iconGradient="from-blue-500 via-indigo-500 to-purple-500" headerActions={headerActions}
      loading={state.loading} onRefresh={() => loadConnections(state.pagination.page, state.search)} showFullscreen={false}>
      
      <DatabaseToastContainer />
      {state.deletingConnection && (
        <DeleteConfirmModal isOpen={state.showDeleteConfirm} onClose={handleCancelDelete} onConfirm={handleConfirmDelete}
          itemName={state.deletingConnection.name} dbType={state.deletingConnection.db_type as any} loading={state.deleteLoading} />
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <MonitorStatCard title="总连接数" value={state.pagination.total} icon={Database} />
        <MonitorStatCard title="已启用" value={enabledCount} icon={CheckCircle} variant="success" />
        <MonitorStatCard title="已禁用" value={disabledCount} icon={XCircle} variant="warning" />
      </div>

      {/* 错误提示 */}
      {state.error && (
        <div className={`mb-6 p-4 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-600'}`}>
          {state.error}
        </div>
      )}

      {/* 连接列表 */}
      <MonitorContentCard title="连接列表" icon={Database}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={isDark ? 'border-b border-slate-700' : 'border-b border-gray-200'}>
                {['连接名称', '类型', '地址', '数据库', '用户名', '状态', '更新时间', '操作'].map(h => (
                  <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-gray-100'}`}>
              {state.connections.map(conn => {
                const dbType = conn.db_type as DatabaseType
                const colors = DatabaseTypeColors[dbType] || DatabaseTypeColors.postgresql
                const typeConfig = DATABASE_TYPES[dbType]
                return (
                  <tr key={conn.id} className={`transition-colors ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center shadow-lg`}>
                          <Database className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{conn.name}</div>
                          {conn.description && <div className={`text-xs truncate max-w-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{conn.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${isDark ? colors.badgeDark : colors.badge}`}>
                        {typeConfig?.name || dbType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{conn.host || 'localhost'}:{conn.port || 5432}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{conn.database || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{conn.username}</span>
                    </td>
                    <td className="px-4 py-3">
                      {conn.status === 1 ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                          <CheckCircle className="w-3 h-3 mr-1" />启用
                        </span>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${isDark ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                          <XCircle className="w-3 h-3 mr-1" />禁用
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {conn.updated_at ? formatDateTime(conn.updated_at, 'YYYY-MM-DD HH:mm') : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1">
                        <button onClick={() => handleTestConnection(conn)} disabled={state.testingConnections.has(conn.id)} title="测试连接"
                          className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-slate-600 text-blue-400' : 'hover:bg-blue-50 text-blue-600'} disabled:opacity-50`}>
                          {state.testingConnections.has(conn.id) ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                        </button>
                        <button onClick={() => handleEdit(conn)} title="编辑"
                          className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-slate-600 text-amber-400' : 'hover:bg-amber-50 text-amber-600'}`}>
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteClick(conn)} title="删除"
                          className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-slate-600 text-red-400' : 'hover:bg-red-50 text-red-600'}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {state.connections.length === 0 && !state.loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Database className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                    <p className={`text-sm mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>暂无数据库连接</p>
                    <button onClick={handleCreate}
                      className="inline-flex items-center px-4 py-2 rounded-xl text-white font-medium bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 transition-all">
                      <Plus className="w-4 h-4 mr-2" />添加第一个连接
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {state.pagination.total > 0 && (
          <div className={`flex items-center justify-between px-4 py-4 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              共 <span className="font-medium">{state.pagination.total}</span> 条记录
            </div>
            <div className="flex items-center space-x-2">
              {Array.from({ length: Math.min(5, state.pagination.pages) }, (_, i) => i + 1).map(page => (
                <button key={page} onClick={() => handlePageChange(page)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${state.pagination.page === page
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                    : isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {page}
                </button>
              ))}
            </div>
          </div>
        )}
      </MonitorContentCard>

      {/* 新建/编辑弹窗 */}
      <Modal isOpen={state.showFormModal} onClose={handleCloseFormModal} title={state.editingConnection ? '编辑连接' : '添加连接'} size="lg">
        <ConnectionForm connection={state.editingConnection} onSuccess={handleFormSuccess} onCancel={handleCloseFormModal} />
      </Modal>
    </MonitorPageLayout>
  )
}

export default ConnectionList
