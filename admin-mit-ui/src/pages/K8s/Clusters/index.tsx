/**
 * K8S集群管理页面 - 美化版
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Modal, message, Popconfirm, Spin } from 'antd'
import { Server, Plus, Search, Eye, Edit, Trash2, RefreshCw, CheckCircle, XCircle, Clock, Layers, Box, Network } from 'lucide-react'
import { useTheme } from '../../../hooks/useTheme'
import { K8sPageLayout, K8sStatCard, K8sContentCard, K8sFilterArea, K8sStatusBadge } from '../../../components/K8s/K8sPageLayout'
import { clustersService } from '../../../services/k8s/clusters'
import { ClusterForm } from './ClusterForm'
import { ClusterDetail } from './ClusterDetail'
import type { K8sCluster, ClusterStatus, ClusterStatusResponse } from '../../../types/k8s'
import { formatDateTime } from '../../../utils'

interface ClusterListState {
  clusters: K8sCluster[]
  loading: boolean
  searchText: string
  pagination: { current: number; pageSize: number; total: number }
  formVisible: boolean
  detailVisible: boolean
  editingCluster: K8sCluster | null
  viewingCluster: K8sCluster | null
  clusterStatuses: Record<number, ClusterStatusResponse>
  statusLoading: Set<number>
  refreshing: boolean
}

export const ClusterList: React.FC = () => {
  const { isDark } = useTheme()
  const [state, setState] = useState<ClusterListState>({
    clusters: [], loading: false, searchText: '',
    pagination: { current: 1, pageSize: 10, total: 0 },
    formVisible: false, detailVisible: false, editingCluster: null, viewingCluster: null,
    clusterStatuses: {}, statusLoading: new Set(), refreshing: false,
  })

  const loadClusters = useCallback(async (page?: number, search?: string) => {
    try {
      setState(prev => ({ ...prev, loading: true }))
      const response = await clustersService.getClusters({
        page: page || state.pagination.current,
        per_page: state.pagination.pageSize,
        search: search !== undefined ? search : state.searchText,
      })
      setState(prev => ({
        ...prev, clusters: response.clusters || [],
        pagination: { ...prev.pagination, current: response.pagination?.page || 1, total: response.pagination?.total || 0 },
        loading: false,
      }))
      if (response.clusters?.length > 0) loadClusterStatuses(response.clusters.map(c => c.id))
    } catch (error: any) {
      message.error(error.response?.data?.message || '加载集群列表失败')
      setState(prev => ({ ...prev, loading: false }))
    }
  }, [state.pagination.current, state.pagination.pageSize, state.searchText])

  const loadClusterStatuses = async (clusterIds: number[]) => {
    try {
      setState(prev => ({ ...prev, statusLoading: new Set(clusterIds) }))
      const statusMap = await clustersService.getBatchClusterStatus(clusterIds)
      setState(prev => ({ ...prev, clusterStatuses: { ...prev.clusterStatuses, ...statusMap }, statusLoading: new Set() }))
    } catch (error) {
      setState(prev => ({ ...prev, statusLoading: new Set() }))
    }
  }

  const refreshClusterStatus = async (clusterId: number) => {
    try {
      setState(prev => ({ ...prev, statusLoading: new Set([...prev.statusLoading, clusterId]) }))
      const status = await clustersService.getClusterStatus(clusterId)
      setState(prev => ({
        ...prev, clusterStatuses: { ...prev.clusterStatuses, [clusterId]: status },
        statusLoading: new Set([...prev.statusLoading].filter(id => id !== clusterId)),
      }))
      message.success('状态刷新成功')
    } catch (error: any) {
      message.error(error.response?.data?.message || '刷新状态失败')
      setState(prev => ({ ...prev, statusLoading: new Set([...prev.statusLoading].filter(id => id !== clusterId)) }))
    }
  }

  const refreshAllStatuses = async () => {
    if (state.clusters.length === 0) return
    setState(prev => ({ ...prev, refreshing: true }))
    await loadClusterStatuses(state.clusters.map(c => c.id))
    setState(prev => ({ ...prev, refreshing: false }))
    message.success('所有集群状态已刷新')
  }

  useEffect(() => { loadClusters() }, [])

  const handleSearch = (value: string) => {
    setState(prev => ({ ...prev, searchText: value, pagination: { ...prev.pagination, current: 1 } }))
    loadClusters(1, value)
  }

  const handleDelete = async (cluster: K8sCluster) => {
    try {
      await clustersService.deleteCluster(cluster.id)
      message.success('删除成功')
      loadClusters()
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败')
    }
  }

  const stats = {
    total: state.clusters.length,
    online: state.clusters.filter(c => c.status === 'online').length,
    offline: state.clusters.filter(c => c.status === 'offline').length,
    error: state.clusters.filter(c => c.status === 'error').length,
  }

  const getStatusBadge = (status: ClusterStatus) => {
    const map: Record<ClusterStatus, 'online' | 'offline' | 'error' | 'pending'> = {
      online: 'online', offline: 'offline', error: 'error', pending: 'pending'
    }
    return <K8sStatusBadge status={map[status] || 'pending'} />
  }

  const renderStatistics = (cluster: K8sCluster) => {
    const status = state.clusterStatuses[cluster.id]
    const isLoading = state.statusLoading.has(cluster.id)
    if (isLoading) return <Spin size="small" />
    if (!status || cluster.status !== 'online') return <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>-</span>
    return (
      <div className="flex items-center space-x-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
          节点 {status.node_count || 0}
        </span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
          NS {status.namespace_count || 0}
        </span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
          Pod {status.pod_count || 0}
        </span>
      </div>
    )
  }

  return (
    <K8sPageLayout title="K8S集群管理" subtitle="管理和监控Kubernetes集群" icon={Server}
      iconGradient="from-indigo-500 via-purple-500 to-pink-500" loading={state.loading || state.refreshing}
      onRefresh={() => { loadClusters(); refreshAllStatuses() }}
      headerActions={
        <button onClick={() => setState(prev => ({ ...prev, formVisible: true, editingCluster: null }))}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700' : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm'}`}>
          <Plus className="w-4 h-4" /><span>添加集群</span>
        </button>
      }>
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <K8sStatCard title="集群总数" value={stats.total} icon={Server} variant="default" />
        <K8sStatCard title="在线集群" value={stats.online} icon={CheckCircle} variant="success" />
        <K8sStatCard title="离线集群" value={stats.offline} icon={XCircle} variant="warning" />
        <K8sStatCard title="异常集群" value={stats.error} icon={Clock} variant="danger" />
      </div>

      {/* 搜索区域 */}
      <K8sFilterArea>
        <div className="relative w-96">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input type="text" placeholder="搜索集群名称或API地址" value={state.searchText}
            onChange={e => handleSearch(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-gray-500 focus:border-indigo-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-500'} border focus:outline-none focus:ring-2 focus:ring-indigo-500/20`} />
        </div>
      </K8sFilterArea>

      {/* 集群列表 */}
      <K8sContentCard title="集群列表" icon={Layers} noPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={isDark ? 'bg-slate-800/50' : 'bg-gray-50'}>
                {['集群名称', 'API地址', '认证方式', '状态', '版本', '资源统计', '最后连接', '操作'].map(h => (
                  <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-gray-100'}`}>
              {state.loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center"><Spin size="large" /></td></tr>
              ) : state.clusters.length === 0 ? (
                <tr><td colSpan={8} className={`px-4 py-12 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>暂无集群数据</td></tr>
              ) : state.clusters.map(cluster => (
                <tr key={cluster.id} className={`transition-colors ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-gray-50/50'}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <Network className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`} />
                      <button onClick={() => setState(prev => ({ ...prev, detailVisible: true, viewingCluster: cluster }))}
                        className={`font-medium hover:underline ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{cluster.name}</button>
                    </div>
                  </td>
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    <span className="truncate max-w-[200px] block">{cluster.api_server}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cluster.auth_type === 'token' ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600') : (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600')}`}>
                      {cluster.auth_type === 'token' ? 'Token' : 'Kubeconfig'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(cluster.status)}</td>
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {state.clusterStatuses[cluster.id]?.version || cluster.version || '-'}
                  </td>
                  <td className="px-4 py-3">{renderStatistics(cluster)}</td>
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {cluster.last_connected_at ? formatDateTime(cluster.last_connected_at) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-1">
                      <button onClick={() => setState(prev => ({ ...prev, detailVisible: true, viewingCluster: cluster }))}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-gray-400 hover:text-gray-300' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`} title="查看详情">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => refreshClusterStatus(cluster.id)} disabled={state.statusLoading.has(cluster.id)}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-gray-400 hover:text-gray-300' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`} title="刷新状态">
                        <RefreshCw className={`w-4 h-4 ${state.statusLoading.has(cluster.id) ? 'animate-spin' : ''}`} />
                      </button>
                      <button onClick={() => setState(prev => ({ ...prev, formVisible: true, editingCluster: cluster }))}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-gray-400 hover:text-gray-300' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`} title="编辑">
                        <Edit className="w-4 h-4" />
                      </button>
                      <Popconfirm title="确定要删除这个集群吗？" description="删除后将无法恢复" onConfirm={() => handleDelete(cluster)} okText="确定" cancelText="取消">
                        <button className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-50 text-gray-500 hover:text-red-500'}`} title="删除">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Popconfirm>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* 分页 */}
        {state.pagination.total > state.pagination.pageSize && (
          <div className={`px-4 py-3 border-t ${isDark ? 'border-slate-700/50' : 'border-gray-100'} flex items-center justify-between`}>
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>共 {state.pagination.total} 条</span>
            <div className="flex items-center space-x-2">
              {Array.from({ length: Math.ceil(state.pagination.total / state.pagination.pageSize) }, (_, i) => i + 1).slice(0, 5).map(page => (
                <button key={page} onClick={() => { setState(prev => ({ ...prev, pagination: { ...prev.pagination, current: page } })); loadClusters(page) }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${state.pagination.current === page ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white' : isDark ? 'bg-slate-800 text-gray-400 hover:bg-slate-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{page}</button>
              ))}
            </div>
          </div>
        )}
      </K8sContentCard>

      {/* 弹窗 */}
      <Modal title={state.editingCluster ? '编辑集群' : '添加集群'} open={state.formVisible}
        onCancel={() => setState(prev => ({ ...prev, formVisible: false, editingCluster: null }))} footer={null} width={700} destroyOnHidden>
        <ClusterForm cluster={state.editingCluster} onSuccess={() => { setState(prev => ({ ...prev, formVisible: false, editingCluster: null })); loadClusters() }}
          onCancel={() => setState(prev => ({ ...prev, formVisible: false, editingCluster: null }))} />
      </Modal>
      <Modal title="集群详情" open={state.detailVisible}
        onCancel={() => setState(prev => ({ ...prev, detailVisible: false, viewingCluster: null }))} footer={null} width={1000} destroyOnHidden>
        {state.viewingCluster && <ClusterDetail cluster={state.viewingCluster} status={state.clusterStatuses[state.viewingCluster.id]} />}
      </Modal>
    </K8sPageLayout>
  )
}

export default ClusterList
