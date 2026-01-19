/**
 * K8S命名空间管理页面 - 美化版
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Modal, message, Popconfirm, Spin, Empty } from 'antd'
import { FolderOpen, Plus, Search, Trash2, AlertTriangle, Tag, Cpu, HardDrive, Box, X } from 'lucide-react'
import { useTheme } from '../../../hooks/useTheme'
import { K8sPageLayout, K8sStatCard, K8sContentCard, K8sFilterArea, K8sStatusBadge } from '../../../components/K8s/K8sPageLayout'
import { namespacesService } from '../../../services/k8s/namespaces'
import { clustersService } from '../../../services/k8s/clusters'
import { NamespaceForm } from './NamespaceForm'
import { ClusterSelector } from '../../../components/K8s/ClusterSelector'
import type { K8sNamespace, K8sCluster, NamespaceStatus } from '../../../types/k8s'
import { formatDateTime } from '../../../utils'

interface NamespaceListState {
  namespaces: K8sNamespace[]
  clusters: K8sCluster[]
  selectedClusterId?: number
  loading: boolean
  searchText: string
  pagination: { current: number; pageSize: number; total: number }
  formVisible: boolean
}

export const NamespaceList: React.FC = () => {
  const { isDark } = useTheme()
  const [state, setState] = useState<NamespaceListState>({
    namespaces: [], clusters: [], selectedClusterId: undefined,
    loading: false, searchText: '',
    pagination: { current: 1, pageSize: 10, total: 0 },
    formVisible: false,
  })

  const loadClusters = useCallback(async () => {
    try {
      const response = await clustersService.getClusters({ page: 1, per_page: 100 })
      const onlineClusters = (response.clusters || []).filter(c => c.status === 'online')
      setState(prev => ({
        ...prev, clusters: onlineClusters,
        // 不自动选择集群，让用户手动选择
      }))
    } catch (error: any) {
      message.error(error.response?.data?.message || '加载集群列表失败')
    }
  }, [])

  const loadNamespaces = useCallback(async (clusterId?: number, page?: number, search?: string) => {
    const targetClusterId = clusterId || state.selectedClusterId
    if (!targetClusterId) {
      setState(prev => ({ ...prev, namespaces: [], loading: false }))
      return
    }
    try {
      setState(prev => ({ ...prev, loading: true }))
      const response = await namespacesService.getNamespaces({
        cluster_id: targetClusterId,
        page: page || state.pagination.current,
        per_page: state.pagination.pageSize,
        search: search !== undefined ? search : state.searchText,
      })
      setState(prev => ({
        ...prev, namespaces: response.namespaces || [],
        pagination: {
          ...prev.pagination,
          current: response.pagination?.page || 1,
          total: response.pagination?.total || 0
        },
        loading: false,
      }))
    } catch (error: any) {
      message.error(error.response?.data?.message || '加载命名空间列表失败')
      setState(prev => ({ ...prev, loading: false }))
    }
  }, [state.selectedClusterId, state.pagination.current, state.pagination.pageSize, state.searchText])

  useEffect(() => { loadClusters() }, [])
  useEffect(() => {
    if (state.selectedClusterId) loadNamespaces(state.selectedClusterId, 1)
  }, [state.selectedClusterId])

  const handleClusterSelect = (cluster: K8sCluster) => {
    setState(prev => ({
      ...prev, selectedClusterId: cluster.id, searchText: '',
      pagination: { ...prev.pagination, current: 1 }
    }))
  }

  const handleSearch = (value: string) => {
    setState(prev => ({
      ...prev, searchText: value,
      pagination: { ...prev.pagination, current: 1 }
    }))
    loadNamespaces(state.selectedClusterId, 1, value)
  }

  const handleDelete = async (namespace: K8sNamespace) => {
    if (!state.selectedClusterId) return
    try {
      await namespacesService.deleteNamespace({
        cluster_id: state.selectedClusterId,
        namespace: namespace.name
      })
      message.success('删除成功')
      loadNamespaces()
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败')
    }
  }

  const isSystemNs = (name: string) =>
    ['default', 'kube-system', 'kube-public', 'kube-node-lease'].includes(name)

  const getStatusBadge = (status: NamespaceStatus) => {
    const map: Record<string, 'online' | 'pending'> = { Active: 'online', Terminating: 'pending' }
    return <K8sStatusBadge status={map[status] || 'pending'} text={status === 'Active' ? '活跃' : '终止中'} />
  }

  const renderQuota = (ns: K8sNamespace) => {
    const q = ns.resource_quota
    if (!q) return <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>-</span>
    return (
      <div className="space-y-1 text-xs">
        {q.cpu_limit && <div className="flex items-center space-x-1"><Cpu className="w-3 h-3" /><span>CPU: {q.cpu_used || '0'}/{q.cpu_limit}</span></div>}
        {q.memory_limit && <div className="flex items-center space-x-1"><HardDrive className="w-3 h-3" /><span>内存: {q.memory_used || '0'}/{q.memory_limit}</span></div>}
        {q.pods_limit && <div className="flex items-center space-x-1"><Box className="w-3 h-3" /><span>Pods: {q.pods_used || '0'}/{q.pods_limit}</span></div>}
      </div>
    )
  }

  const renderLabels = (labels?: Record<string, string>) => {
    if (!labels || Object.keys(labels).length === 0) return <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>-</span>
    const entries = Object.entries(labels).slice(0, 2)
    const remaining = Object.keys(labels).length - 2
    return (
      <div className="flex flex-wrap gap-1">
        {entries.map(([k, v]) => (
          <span key={k} className={`inline-flex px-2 py-0.5 rounded text-xs ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>{k}: {v}</span>
        ))}
        {remaining > 0 && <span className={`inline-flex px-2 py-0.5 rounded text-xs ${isDark ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>+{remaining}</span>}
      </div>
    )
  }

  const stats = {
    total: state.namespaces.length,
    active: state.namespaces.filter(n => n.status === 'Active').length,
    terminating: state.namespaces.filter(n => n.status === 'Terminating').length,
    system: state.namespaces.filter(n => isSystemNs(n.name)).length,
  }

  const selectedCluster = state.clusters.find(c => c.id === state.selectedClusterId)

  return (
    <K8sPageLayout title="K8S命名空间管理" subtitle="管理Kubernetes命名空间" icon={FolderOpen}
      iconGradient="from-cyan-500 via-blue-500 to-indigo-500" loading={state.loading}
      onRefresh={() => loadNamespaces()}
      headerActions={
        <button onClick={() => {
          if (!state.selectedClusterId) { message.warning('请先选择集群'); return }
          setState(prev => ({ ...prev, formVisible: true }))
        }} disabled={!state.selectedClusterId}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all disabled:opacity-50 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700' : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm'}`}>
          <Plus className="w-4 h-4" /><span>创建命名空间</span>
        </button>
      }>
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <K8sStatCard title="命名空间总数" value={stats.total} icon={FolderOpen} variant="default" />
        <K8sStatCard title="活跃命名空间" value={stats.active} icon={Box} variant="success" />
        <K8sStatCard title="终止中" value={stats.terminating} icon={AlertTriangle} variant="warning" />
        <K8sStatCard title="系统命名空间" value={stats.system} icon={Tag} variant="purple" />
      </div>

      {/* 筛选区域 */}
      <K8sFilterArea>
        <div className="w-72">
          <ClusterSelector clusters={state.clusters} selectedClusterId={state.selectedClusterId}
            onSelect={handleClusterSelect} placeholder="选择集群" />
        </div>
        <div className="relative w-80">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input type="text" placeholder="搜索命名空间名称" value={state.searchText}
            onChange={e => handleSearch(e.target.value)} disabled={!state.selectedClusterId}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-gray-500 focus:border-cyan-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-cyan-500'} border focus:outline-none focus:ring-2 focus:ring-cyan-500/20`} />
        </div>
      </K8sFilterArea>

      {/* 提示 */}
      {state.clusters.length === 0 && (
        <div className={`rounded-2xl p-6 mb-6 ${isDark ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="flex items-center space-x-3">
            <AlertTriangle className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
            <div>
              <p className={`font-medium ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>暂无在线集群</p>
              <p className={`text-sm ${isDark ? 'text-amber-400/70' : 'text-amber-600'}`}>请先添加并连接K8S集群</p>
            </div>
          </div>
        </div>
      )}

      {/* 列表 */}
      <K8sContentCard title="命名空间列表" icon={FolderOpen} noPadding>
        {!state.selectedClusterId ? (
          <div className="py-12"><Empty description="请选择集群" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={isDark ? 'bg-slate-800/50' : 'bg-gray-50'}>
                  {['命名空间名称', '状态', '资源配额', '标签', '创建时间', '操作'].map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-gray-100'}`}>
                {state.loading ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center"><Spin size="large" /></td></tr>
                ) : state.namespaces.length === 0 ? (
                  <tr><td colSpan={6} className={`px-4 py-12 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{state.searchText ? '未找到匹配的命名空间' : '暂无命名空间'}</td></tr>
                ) : state.namespaces.map(ns => (
                  <tr key={ns.name} className={`transition-colors ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-gray-50/50'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <FolderOpen className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-cyan-500'}`} />
                        <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{ns.name}</span>
                        {isSystemNs(ns.name) && (
                          <span className={`px-1.5 py-0.5 rounded text-xs ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>系统</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(ns.status)}</td>
                    <td className={`px-4 py-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{renderQuota(ns)}</td>
                    <td className="px-4 py-3">{renderLabels(ns.labels)}</td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatDateTime(ns.created_at)}</td>
                    <td className="px-4 py-3">
                      <Popconfirm title="确定要删除这个命名空间吗？"
                        description={<div><p>删除后将无法恢复</p><p className="text-red-500 mt-1">该命名空间下的所有资源也将被删除</p></div>}
                        onConfirm={() => handleDelete(ns)} okText="确定" cancelText="取消"
                        okButtonProps={{ danger: true }} disabled={isSystemNs(ns.name)}>
                        <button disabled={isSystemNs(ns.name)}
                          className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${isDark ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-50 text-gray-500 hover:text-red-500'}`} title="删除">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Popconfirm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {state.pagination.total > state.pagination.pageSize && (
          <div className={`px-4 py-3 border-t ${isDark ? 'border-slate-700/50' : 'border-gray-100'} flex items-center justify-between`}>
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>共 {state.pagination.total} 条</span>
            <div className="flex items-center space-x-2">
              {Array.from({ length: Math.ceil(state.pagination.total / state.pagination.pageSize) }, (_, i) => i + 1).slice(0, 5).map(page => (
                <button key={page} onClick={() => {
                  setState(prev => ({ ...prev, pagination: { ...prev.pagination, current: page } }))
                  loadNamespaces(state.selectedClusterId, page)
                }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${state.pagination.current === page ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white' : isDark ? 'bg-slate-800 text-gray-400 hover:bg-slate-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{page}</button>
              ))}
            </div>
          </div>
        )}
      </K8sContentCard>

      {/* 创建命名空间弹窗 - 美化版 */}
      <Modal open={state.formVisible} onCancel={() => setState(prev => ({ ...prev, formVisible: false }))} footer={null} width={600} closable={false} destroyOnClose
        styles={{ body: { background: isDark ? '#1e293b' : '#ffffff', borderRadius: '16px', padding: 0, overflow: 'hidden' }, mask: { backgroundColor: 'rgba(0, 0, 0, 0.6)' } }}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${isDark ? 'border-slate-700 bg-gradient-to-r from-cyan-900/30 to-blue-900/30' : 'border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isDark ? 'bg-cyan-500/20' : 'bg-cyan-100'}`}>
              <FolderOpen className={`w-5 h-5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>创建命名空间</h3>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>在集群中创建新的命名空间</p>
            </div>
            <button onClick={() => setState(prev => ({ ...prev, formVisible: false }))} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        {/* Content */}
        <div className="p-6">
          {state.selectedClusterId && (
            <NamespaceForm clusterId={state.selectedClusterId} clusterName={selectedCluster?.name}
              onSuccess={() => { setState(prev => ({ ...prev, formVisible: false })); loadNamespaces() }}
              onCancel={() => setState(prev => ({ ...prev, formVisible: false }))} />
          )}
        </div>
      </Modal>
    </K8sPageLayout>
  )
}

export default NamespaceList
