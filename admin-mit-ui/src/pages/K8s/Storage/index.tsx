/**
 * K8S存储管理页面 - 美化版
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Spin, Empty, Select } from 'antd'
import { HardDrive, Database, Server, Search, Tag, CheckCircle, Clock, AlertTriangle, Info } from 'lucide-react'
import { useTheme } from '../../../hooks/useTheme'
import { K8sPageLayout, K8sStatCard, K8sContentCard, K8sFilterArea, K8sTabButton } from '../../../components/K8s/K8sPageLayout'
import { storageService } from '../../../services/k8s/storage'
import { clustersService } from '../../../services/k8s/clusters'
import { namespacesService } from '../../../services/k8s/namespaces'
import { ClusterSelector } from '../../../components/K8s/ClusterSelector'
import { NamespaceSelector } from '../../../components/K8s/NamespaceSelector'
import type { K8sPersistentVolume, PersistentVolumeClaim, K8sStorageClass, K8sCluster, K8sNamespace, StorageStatus, AccessMode } from '../../../types/k8s'
import { formatDateTime } from '../../../utils'

const { Option } = Select
type StorageType = 'pv' | 'pvc' | 'storageclass'

interface StorageListState {
  persistentVolumes: K8sPersistentVolume[]
  persistentVolumeClaims: PersistentVolumeClaim[]
  storageClasses: K8sStorageClass[]
  clusters: K8sCluster[]
  namespaces: K8sNamespace[]
  selectedClusterId?: number
  selectedNamespace?: string
  activeTab: StorageType
  loading: boolean
  searchText: string
  statusFilter?: StorageStatus
  pagination: { current: number; pageSize: number; total: number }
}

export const StorageList: React.FC = () => {
  const { isDark } = useTheme()
  const [state, setState] = useState<StorageListState>({
    persistentVolumes: [], persistentVolumeClaims: [], storageClasses: [],
    clusters: [], namespaces: [], selectedClusterId: undefined, selectedNamespace: undefined,
    activeTab: 'pv', loading: false, searchText: '', statusFilter: undefined,
    pagination: { current: 1, pageSize: 10, total: 0 },
  })

  const loadClusters = useCallback(async () => {
    try {
      const response = await clustersService.getClusters({ page: 1, per_page: 100 })
      const onlineClusters = (response.clusters || []).filter(c => c.status === 'online')
      setState(prev => ({ ...prev, clusters: onlineClusters }))
    } catch (error: any) { console.error('加载集群列表失败:', error) }
  }, [])

  const loadNamespaces = useCallback(async (clusterId: number) => {
    try {
      const response = await namespacesService.getNamespaces({ cluster_id: clusterId, page: 1, per_page: 100 })
      const namespaces = response.namespaces || []
      setState(prev => ({ ...prev, namespaces, selectedNamespace: prev.selectedNamespace || namespaces[0]?.name }))
      if (namespaces.length > 0) loadStorage(clusterId, namespaces[0].name)
    } catch (error: any) { console.error('加载命名空间列表失败:', error) }
  }, [])

  const loadPersistentVolumes = useCallback(async (clusterId?: number, page?: number, search?: string, status?: StorageStatus) => {
    const cid = clusterId || state.selectedClusterId
    if (!cid) { setState(prev => ({ ...prev, persistentVolumes: [], loading: false })); return }
    try {
      setState(prev => ({ ...prev, loading: true }))
      const response = await storageService.getPersistentVolumes({ cluster_id: cid, page: page || state.pagination.current, per_page: state.pagination.pageSize, search: search !== undefined ? search : state.searchText, status: status !== undefined ? status : state.statusFilter })
      setState(prev => ({ ...prev, persistentVolumes: response.persistent_volumes || [], pagination: { ...prev.pagination, current: response.pagination?.page || 1, total: response.pagination?.total || 0 }, loading: false }))
    } catch (error: any) { console.error('加载PV列表失败:', error); setState(prev => ({ ...prev, loading: false })) }
  }, [state.selectedClusterId, state.pagination.current, state.pagination.pageSize, state.searchText, state.statusFilter])

  const loadPersistentVolumeClaims = useCallback(async (clusterId?: number, namespace?: string, page?: number, search?: string, status?: StorageStatus) => {
    const cid = clusterId || state.selectedClusterId
    const ns = namespace || state.selectedNamespace
    if (!cid || !ns) { setState(prev => ({ ...prev, persistentVolumeClaims: [], loading: false })); return }
    try {
      setState(prev => ({ ...prev, loading: true }))
      const response = await storageService.getPersistentVolumeClaims({ cluster_id: cid, namespace: ns, page: page || state.pagination.current, per_page: state.pagination.pageSize, search: search !== undefined ? search : state.searchText, status: status !== undefined ? status : state.statusFilter })
      setState(prev => ({ ...prev, persistentVolumeClaims: response.persistent_volume_claims || [], pagination: { ...prev.pagination, current: response.pagination?.page || 1, total: response.pagination?.total || 0 }, loading: false }))
    } catch (error: any) { console.error('加载PVC列表失败:', error); setState(prev => ({ ...prev, loading: false })) }
  }, [state.selectedClusterId, state.selectedNamespace, state.pagination.current, state.pagination.pageSize, state.searchText, state.statusFilter])

  const loadStorageClasses = useCallback(async (clusterId?: number) => {
    const cid = clusterId || state.selectedClusterId
    if (!cid) { setState(prev => ({ ...prev, storageClasses: [], loading: false })); return }
    try {
      setState(prev => ({ ...prev, loading: true }))
      const response = await storageService.getStorageClasses(cid)
      setState(prev => ({ ...prev, storageClasses: response.storage_classes || [], pagination: { ...prev.pagination, current: response.pagination?.page || 1, total: response.pagination?.total || 0 }, loading: false }))
    } catch (error: any) { console.error('加载StorageClass列表失败:', error); setState(prev => ({ ...prev, loading: false })) }
  }, [state.selectedClusterId])

  const loadStorage = useCallback((clusterId?: number, namespace?: string, page?: number, search?: string, status?: StorageStatus) => {
    if (state.activeTab === 'pv') loadPersistentVolumes(clusterId, page, search, status)
    else if (state.activeTab === 'pvc') loadPersistentVolumeClaims(clusterId, namespace, page, search, status)
    else loadStorageClasses(clusterId)
  }, [state.activeTab, loadPersistentVolumes, loadPersistentVolumeClaims, loadStorageClasses])

  useEffect(() => { loadClusters() }, [])
  useEffect(() => { if (state.selectedClusterId) loadNamespaces(state.selectedClusterId) }, [state.selectedClusterId])
  useEffect(() => { if (state.selectedClusterId) { if (state.activeTab === 'pvc' && state.selectedNamespace) loadStorage(state.selectedClusterId, state.selectedNamespace, 1); else if (state.activeTab !== 'pvc') loadStorage(state.selectedClusterId, undefined, 1) } }, [state.selectedNamespace])
  useEffect(() => { if (state.selectedClusterId) { setState(prev => ({ ...prev, searchText: '', statusFilter: undefined, pagination: { ...prev.pagination, current: 1 } })); loadStorage(state.selectedClusterId, state.selectedNamespace, 1, '', undefined) } }, [state.activeTab])

  const handleClusterSelect = (cluster: K8sCluster) => setState(prev => ({ ...prev, selectedClusterId: cluster.id, selectedNamespace: undefined, searchText: '', statusFilter: undefined, pagination: { ...prev.pagination, current: 1 } }))
  const handleNamespaceSelect = (namespace: K8sNamespace) => setState(prev => ({ ...prev, selectedNamespace: namespace.name, searchText: '', statusFilter: undefined, pagination: { ...prev.pagination, current: 1 } }))
  const handleTabChange = (tab: StorageType) => setState(prev => ({ ...prev, activeTab: tab }))
  const handleSearch = (value: string) => { setState(prev => ({ ...prev, searchText: value, pagination: { ...prev.pagination, current: 1 } })); loadStorage(state.selectedClusterId, state.selectedNamespace, 1, value, state.statusFilter) }
  const handleStatusFilter = (value: StorageStatus | undefined) => { setState(prev => ({ ...prev, statusFilter: value, pagination: { ...prev.pagination, current: 1 } })); loadStorage(state.selectedClusterId, state.selectedNamespace, 1, state.searchText, value) }

  const renderStatusTag = (status: StorageStatus) => {
    const configs: Record<StorageStatus, { bg: string; text: string; label: string }> = {
      Available: { bg: isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600', text: '', label: '可用' },
      Bound: { bg: isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600', text: '', label: '已绑定' },
      Released: { bg: isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600', text: '', label: '已释放' },
      Failed: { bg: isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600', text: '', label: '失败' },
      Pending: { bg: isDark ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-600', text: '', label: '等待中' },
    }
    const config = configs[status] || configs.Pending
    return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${config.bg}`}>{config.label}</span>
  }

  const renderAccessModes = (modes: AccessMode[]) => {
    const modeMap: Record<AccessMode, string> = { ReadWriteOnce: 'RWO', ReadOnlyMany: 'ROX', ReadWriteMany: 'RWX', ReadWriteOncePod: 'RWOP' }
    return (
      <div className="flex flex-wrap gap-1">
        {modes.map(m => <span key={m} className={`inline-flex px-2 py-0.5 rounded text-xs ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`} title={m}>{modeMap[m] || m}</span>)}
      </div>
    )
  }

  const pvStats = { total: state.persistentVolumes.length, available: state.persistentVolumes.filter(p => p.status === 'Available').length, bound: state.persistentVolumes.filter(p => p.status === 'Bound').length }
  const pvcStats = { total: state.persistentVolumeClaims.length, bound: state.persistentVolumeClaims.filter(p => p.status === 'Bound').length, pending: state.persistentVolumeClaims.filter(p => p.status === 'Pending').length }
  const scStats = { total: state.storageClasses.length, expandable: state.storageClasses.filter(s => s.allow_volume_expansion).length }

  return (
    <K8sPageLayout title="K8S存储管理" subtitle="管理PV、PVC和StorageClass" icon={HardDrive}
      iconGradient="from-rose-500 via-pink-500 to-fuchsia-500" loading={state.loading} onRefresh={() => loadStorage(state.selectedClusterId, state.selectedNamespace, state.pagination.current, state.searchText, state.statusFilter)}>
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {state.activeTab === 'pv' ? (
          <>
            <K8sStatCard title="PV总数" value={pvStats.total} icon={Database} variant="default" />
            <K8sStatCard title="可用" value={pvStats.available} icon={CheckCircle} variant="success" />
            <K8sStatCard title="已绑定" value={pvStats.bound} icon={Tag} variant="purple" />
          </>
        ) : state.activeTab === 'pvc' ? (
          <>
            <K8sStatCard title="PVC总数" value={pvcStats.total} icon={HardDrive} variant="default" />
            <K8sStatCard title="已绑定" value={pvcStats.bound} icon={CheckCircle} variant="success" />
            <K8sStatCard title="等待中" value={pvcStats.pending} icon={Clock} variant="warning" />
          </>
        ) : (
          <>
            <K8sStatCard title="StorageClass总数" value={scStats.total} icon={Server} variant="default" />
            <K8sStatCard title="支持扩容" value={scStats.expandable} icon={CheckCircle} variant="success" />
          </>
        )}
      </div>

      {/* 筛选区域 */}
      <K8sFilterArea>
        <div className="w-72"><ClusterSelector clusters={state.clusters} selectedClusterId={state.selectedClusterId} onSelect={handleClusterSelect} placeholder="选择集群" /></div>
        {state.activeTab === 'pvc' && (
          <div className="w-72"><NamespaceSelector namespaces={state.namespaces} selectedNamespace={state.selectedNamespace} onSelect={handleNamespaceSelect} placeholder="选择命名空间" disabled={!state.selectedClusterId} /></div>
        )}
        {(state.activeTab === 'pv' || state.activeTab === 'pvc') && (
          <Select placeholder="筛选状态" allowClear style={{ width: 160 }} value={state.statusFilter} onChange={handleStatusFilter} disabled={!state.selectedClusterId}>
            <Option value="Available">可用</Option>
            <Option value="Bound">已绑定</Option>
            <Option value="Released">已释放</Option>
            <Option value="Failed">失败</Option>
            <Option value="Pending">等待中</Option>
          </Select>
        )}
        <div className="relative w-80">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input type="text" placeholder={state.activeTab === 'pv' ? '搜索PV名称' : state.activeTab === 'pvc' ? '搜索PVC名称' : '搜索StorageClass名称'} value={state.searchText}
            onChange={e => handleSearch(e.target.value)} disabled={!state.selectedClusterId}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-gray-500 focus:border-rose-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-rose-500'} border focus:outline-none focus:ring-2 focus:ring-rose-500/20`} />
        </div>
      </K8sFilterArea>

      {/* Tab切换 */}
      <div className="flex items-center space-x-2 mb-6">
        <K8sTabButton active={state.activeTab === 'pv'} onClick={() => handleTabChange('pv')} icon={Database}>PersistentVolume</K8sTabButton>
        <K8sTabButton active={state.activeTab === 'pvc'} onClick={() => handleTabChange('pvc')} icon={HardDrive}>PersistentVolumeClaim</K8sTabButton>
        <K8sTabButton active={state.activeTab === 'storageclass'} onClick={() => handleTabChange('storageclass')} icon={Server}>StorageClass</K8sTabButton>
      </div>

      {/* 列表 */}
      <K8sContentCard title={state.activeTab === 'pv' ? 'PV列表' : state.activeTab === 'pvc' ? 'PVC列表' : 'StorageClass列表'} icon={state.activeTab === 'pv' ? Database : state.activeTab === 'pvc' ? HardDrive : Server} noPadding>
        {!state.selectedClusterId ? (
          <div className="py-12"><Empty description="请选择集群" /></div>
        ) : state.activeTab === 'pvc' && !state.selectedNamespace ? (
          <div className="py-12"><Empty description="请选择命名空间" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={isDark ? 'bg-slate-800/50' : 'bg-gray-50'}>
                  {state.activeTab === 'pv'
                    ? ['PV名称', '容量', '访问模式', '回收策略', '状态', '绑定的PVC', 'StorageClass', '创建时间'].map(h => <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>)
                    : state.activeTab === 'pvc'
                    ? ['PVC名称', '命名空间', '状态', '容量', '访问模式', '绑定的PV', 'StorageClass', '创建时间'].map(h => <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>)
                    : ['StorageClass名称', '供应商', '回收策略', '绑定模式', '允许扩容', '参数', '创建时间'].map(h => <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>)
                  }
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-gray-100'}`}>
                {state.loading ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center"><Spin size="large" /></td></tr>
                ) : (state.activeTab === 'pv' ? state.persistentVolumes : state.activeTab === 'pvc' ? state.persistentVolumeClaims : state.storageClasses).length === 0 ? (
                  <tr><td colSpan={8} className={`px-4 py-12 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{state.searchText ? '未找到匹配的资源' : `暂无${state.activeTab === 'pv' ? 'PV' : state.activeTab === 'pvc' ? 'PVC' : 'StorageClass'}`}</td></tr>
                ) : state.activeTab === 'pv' ? state.persistentVolumes.map(pv => (
                  <tr key={pv.name} className={`transition-colors ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-gray-50/50'}`}>
                    <td className="px-4 py-3"><div className="flex items-center space-x-2"><Database className={`w-4 h-4 ${isDark ? 'text-rose-400' : 'text-rose-500'}`} /><span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{pv.name}</span></div></td>
                    <td className={`px-4 py-3 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{pv.capacity}</td>
                    <td className="px-4 py-3">{renderAccessModes(pv.access_modes)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>{pv.reclaim_policy}</span></td>
                    <td className="px-4 py-3">{renderStatusTag(pv.status)}</td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{pv.claim || '-'}</td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{pv.storage_class || '-'}</td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatDateTime(pv.created_at)}</td>
                  </tr>
                )) : state.activeTab === 'pvc' ? state.persistentVolumeClaims.map(pvc => (
                  <tr key={pvc.name} className={`transition-colors ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-gray-50/50'}`}>
                    <td className="px-4 py-3"><div className="flex items-center space-x-2"><HardDrive className={`w-4 h-4 ${isDark ? 'text-pink-400' : 'text-pink-500'}`} /><span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{pvc.name}</span></div></td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-600'}`}>{pvc.namespace}</span></td>
                    <td className="px-4 py-3">{renderStatusTag(pvc.status)}</td>
                    <td className={`px-4 py-3 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{pvc.capacity || '-'}</td>
                    <td className="px-4 py-3">{renderAccessModes(pvc.access_modes)}</td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{pvc.volume_name || '-'}</td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{pvc.storage_class || '-'}</td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatDateTime(pvc.created_at)}</td>
                  </tr>
                )) : state.storageClasses.map(sc => (
                  <tr key={sc.name} className={`transition-colors ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-gray-50/50'}`}>
                    <td className="px-4 py-3"><div className="flex items-center space-x-2"><Server className={`w-4 h-4 ${isDark ? 'text-fuchsia-400' : 'text-fuchsia-500'}`} /><span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{sc.name}</span></div></td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>{sc.provisioner}</span></td>
                    <td className="px-4 py-3">{sc.reclaim_policy ? <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>{sc.reclaim_policy}</span> : '-'}</td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{sc.volume_binding_mode || '-'}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.allow_volume_expansion ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600') : (isDark ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-600')}`}><span className={`w-1.5 h-1.5 rounded-full ${sc.allow_volume_expansion ? 'bg-emerald-500' : 'bg-gray-500'}`}></span><span>{sc.allow_volume_expansion ? '是' : '否'}</span></span></td>
                    <td className="px-4 py-3">{sc.parameters && Object.keys(sc.parameters).length > 0 ? <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600'}`} title={Object.entries(sc.parameters).map(([k, v]) => `${k}: ${v}`).join('\n')}><Info className="w-3 h-3" /><span>{Object.keys(sc.parameters).length} 个参数</span></span> : '-'}</td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatDateTime(sc.created_at)}</td>
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
                <button key={page} onClick={() => { setState(prev => ({ ...prev, pagination: { ...prev.pagination, current: page } })); loadStorage(state.selectedClusterId, state.selectedNamespace, page, state.searchText, state.statusFilter) }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${state.pagination.current === page ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white' : isDark ? 'bg-slate-800 text-gray-400 hover:bg-slate-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{page}</button>
              ))}
            </div>
          </div>
        )}
      </K8sContentCard>
    </K8sPageLayout>
  )
}

export default StorageList
