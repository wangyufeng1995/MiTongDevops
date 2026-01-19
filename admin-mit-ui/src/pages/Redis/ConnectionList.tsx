/**
 * Redis 连接列表组件 - 美化版
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Database, Search, Edit, Trash2, RefreshCw, CheckCircle, XCircle, Server, Network, Link } from 'lucide-react'
import { MonitorPageLayout, MonitorContentCard, MonitorStatCard } from '../../components/Monitor/MonitorPageLayout'
import { Modal } from '../../components/Modal'
import { useAuthStore } from '../../store/auth'
import { useTheme } from '../../hooks/useTheme'
import { redisService, RedisConnection } from '../../services/redis'
import { formatDateTime } from '../../utils'
import { showRedisError } from '../../utils/redisErrorHandler'
import ConnectionForm from './ConnectionForm'

interface ConnectionListState {
  connections: RedisConnection[]
  loading: boolean
  error: string | null
  pagination: { page: number; per_page: number; total: number; pages: number; has_prev: boolean; has_next: boolean }
  search: string
  testingConnections: Set<number>
  showFormModal: boolean
  editingConnection: RedisConnection | null
  showDeleteConfirm: boolean
  deletingConnection: RedisConnection | null
  toast: { show: boolean; type: 'success' | 'error' | 'warning' | 'info'; message: string }
}

export const ConnectionList: React.FC = () => {
  const { hasPermission } = useAuthStore()
  const { isDark } = useTheme()

  const [state, setState] = useState<ConnectionListState>({
    connections: [], loading: true, error: null,
    pagination: { page: 1, per_page: 10, total: 0, pages: 0, has_prev: false, has_next: false },
    search: '', testingConnections: new Set(), showFormModal: false, editingConnection: null,
    showDeleteConfirm: false, deletingConnection: null, toast: { show: false, type: 'info', message: '' }
  })

  const showToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setState(prev => ({ ...prev, toast: { show: true, type, message } }))
    setTimeout(() => setState(prev => ({ ...prev, toast: { ...prev.toast, show: false } })), 3000)
  }, [])

  const loadConnections = useCallback(async (page = 1, search = '') => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      const response = await redisService.getConnections({ page, per_page: state.pagination.per_page, search: search.trim() || undefined })
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

  const handleTestConnection = async (connection: RedisConnection) => {
    if (state.testingConnections.has(connection.id)) return
    setState(prev => ({ ...prev, testingConnections: new Set([...prev.testingConnections, connection.id]) }))
    try {
      const result = await redisService.testConnection(connection.id)
      const isSuccess = result.success || result.connected
      if (isSuccess) showToast('success', `连接 "${connection.name}" 测试成功${result.latency_ms ? ` (${result.latency_ms}ms)` : ''}`)
      else showToast('error', `连接 "${connection.name}" 测试失败: ${result.message || '未知错误'}`)
    } catch (error: any) { showToast('error', `测试连接失败: ${error.message}`) }
    finally { setState(prev => ({ ...prev, testingConnections: new Set([...prev.testingConnections].filter(id => id !== connection.id)) })) }
  }

  const handleCreate = () => setState(prev => ({ ...prev, showFormModal: true, editingConnection: null }))
  const handleEdit = (connection: RedisConnection) => setState(prev => ({ ...prev, showFormModal: true, editingConnection: connection }))
  const handleCloseFormModal = () => setState(prev => ({ ...prev, showFormModal: false, editingConnection: null }))
  const handleFormSuccess = () => { handleCloseFormModal(); loadConnections(state.pagination.page, state.search); showToast('success', state.editingConnection ? '连接配置已更新' : '连接配置已创建') }
  const handleDeleteClick = (connection: RedisConnection) => setState(prev => ({ ...prev, showDeleteConfirm: true, deletingConnection: connection }))
  const handleCancelDelete = () => setState(prev => ({ ...prev, showDeleteConfirm: false, deletingConnection: null }))

  const handleConfirmDelete = async () => {
    if (!state.deletingConnection) return
    try {
      await redisService.deleteConnection(state.deletingConnection.id)
      showToast('success', `连接 "${state.deletingConnection.name}" 已删除`)
      setState(prev => ({ ...prev, showDeleteConfirm: false, deletingConnection: null }))
      loadConnections(state.pagination.page, state.search)
    } catch (error: any) { showRedisError(error, '删除连接') }
  }

  const getAddressDisplay = (connection: RedisConnection) => {
    if (connection.connection_type === 'cluster' && connection.cluster_nodes) {
      const nodes = connection.cluster_nodes
      return nodes.length > 2 ? `${nodes[0]}, ${nodes[1]} 等 ${nodes.length} 个节点` : nodes.join(', ')
    }
    return `${connection.host || 'localhost'}:${connection.port || 6379}`
  }

  // 统计数据
  const enabledCount = state.connections.filter(c => c.status === 1).length
  const clusterCount = state.connections.filter(c => c.connection_type === 'cluster').length

  const headerActions = (
    <div className="flex items-center space-x-3">
      <div className="relative">
        <input type="text" placeholder="搜索实例..." value={state.search} onChange={(e) => handleSearch(e.target.value)}
          className={`pl-10 pr-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-red-500 w-64 ${isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
        <Search className={`absolute left-3 top-3 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
      </div>
      <button onClick={handleCreate}
        className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-white font-medium overflow-hidden transition-all">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-red-600 to-rose-500"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-red-700 to-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <Plus className="relative w-4 h-4" /><span className="relative">添加实例</span>
      </button>
    </div>
  )

  return (
    <MonitorPageLayout title="Redis 管理" subtitle="管理 Redis 实例连接" icon={Database}
      iconGradient="from-red-500 via-rose-500 to-pink-500" headerActions={headerActions}
      loading={state.loading} onRefresh={() => loadConnections(state.pagination.page, state.search)} showFullscreen={false}>
      
      {/* Toast */}
      {state.toast.show && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`px-4 py-3 rounded-xl shadow-xl border flex items-center space-x-3 ${state.toast.type === 'success' ? (isDark ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800') : (isDark ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-800')}`}>
            {state.toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            <span className="text-sm font-medium">{state.toast.message}</span>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {state.showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleCancelDelete}>
          <div className={`absolute inset-0 ${isDark ? 'bg-black/60' : 'bg-black/40'} backdrop-blur-sm`} />
          <div className={`relative rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <div className="h-20 bg-gradient-to-br from-red-500 via-red-600 to-rose-600 flex items-center justify-center">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-lg`}>
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
            </div>
            <div className="px-6 pb-6 pt-4">
              <h3 className={`text-lg font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>删除实例</h3>
              <div className={`rounded-xl px-4 py-3 mb-4 ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                <p className={`text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>即将删除</p>
                <p className={`text-center font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{state.deletingConnection?.name}</p>
              </div>
              <p className={`text-center text-xs mb-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>此操作无法撤销</p>
              <div className="flex gap-3">
                <button onClick={handleCancelDelete} className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>取消</button>
                <button onClick={handleConfirmDelete} className="flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 transition-all">确认删除</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <MonitorStatCard title="总实例数" value={state.pagination.total} icon={Database} />
        <MonitorStatCard title="已启用" value={enabledCount} icon={CheckCircle} variant="success" />
        <MonitorStatCard title="集群模式" value={clusterCount} icon={Network} variant="warning" />
      </div>

      {/* 错误提示 */}
      {state.error && (
        <div className={`mb-6 p-4 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-600'}`}>
          {state.error}
        </div>
      )}

      {/* 连接列表 */}
      <MonitorContentCard title="实例列表" icon={Database}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={isDark ? 'border-b border-slate-700' : 'border-b border-gray-200'}>
                {['连接名称', '类型', '地址', '数据库', '状态', '更新时间', '操作'].map(h => (
                  <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-gray-100'}`}>
              {state.connections.map(conn => (
                <tr key={conn.id} className={`transition-colors ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg">
                        <Database className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{conn.name}</div>
                        {conn.description && <div className={`text-xs truncate max-w-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{conn.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {conn.connection_type === 'cluster' ? (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                        <Network className="w-3 h-3 mr-1" />集群
                      </span>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                        <Server className="w-3 h-3 mr-1" />单机
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{getAddressDisplay(conn)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {conn.connection_type === 'standalone' ? `DB ${conn.database || 0}` : '-'}
                    </span>
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
              ))}
              {state.connections.length === 0 && !state.loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Database className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                    <p className={`text-sm mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>暂无 Redis 实例</p>
                    <button onClick={handleCreate}
                      className="inline-flex items-center px-4 py-2 rounded-xl text-white font-medium bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 transition-all">
                      <Plus className="w-4 h-4 mr-2" />添加第一个实例
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
                    ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white'
                    : isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {page}
                </button>
              ))}
            </div>
          </div>
        )}
      </MonitorContentCard>

      {/* 新建/编辑弹窗 */}
      <Modal isOpen={state.showFormModal} onClose={handleCloseFormModal} title={state.editingConnection ? '编辑实例' : '添加实例'} size="lg">
        <ConnectionForm connection={state.editingConnection} onSuccess={handleFormSuccess} onCancel={handleCloseFormModal} />
      </Modal>
    </MonitorPageLayout>
  )
}

export default ConnectionList
