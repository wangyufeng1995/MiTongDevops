/**
 * K8S服务发现管理页面 - 美化版
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Modal, message, Popconfirm, Spin, Empty } from 'antd'
import { Globe, Search, Eye, Edit, Trash2, Server, Network, Shield, CheckCircle, XCircle, X } from 'lucide-react'
import { useTheme } from '../../../hooks/useTheme'
import { K8sPageLayout, K8sStatCard, K8sContentCard, K8sFilterArea, K8sTabButton } from '../../../components/K8s/K8sPageLayout'
import { k8sServicesService } from '../../../services/k8s/services'
import { clustersService } from '../../../services/k8s/clusters'
import { namespacesService } from '../../../services/k8s/namespaces'
import { ClusterSelector } from '../../../components/K8s/ClusterSelector'
import { NamespaceSelector } from '../../../components/K8s/NamespaceSelector'
import { ServiceDetail } from './ServiceDetail'
import { EditResourceModal } from './EditResourceModal'
import type { K8sService, K8sIngress, K8sCluster, K8sNamespace, ServiceType } from '../../../types/k8s'
import { formatDateTime } from '../../../utils'

interface ServiceListState {
  services: K8sService[]
  ingresses: K8sIngress[]
  clusters: K8sCluster[]
  namespaces: K8sNamespace[]
  selectedClusterId?: number
  selectedNamespace?: string
  activeTab: 'service' | 'ingress'
  serviceTypeFilter?: ServiceType
  loading: boolean
  searchText: string
  pagination: { current: number; pageSize: number; total: number }
  detailModalVisible: boolean
  detailService?: K8sService
  editModalVisible: boolean
  editResourceName?: string
  editResourceType?: 'service' | 'ingress'
}

export const ServiceList: React.FC = () => {
  const { isDark } = useTheme()
  const [state, setState] = useState<ServiceListState>({
    services: [], ingresses: [], clusters: [], namespaces: [],
    selectedClusterId: undefined, selectedNamespace: undefined,
    activeTab: 'service', serviceTypeFilter: undefined,
    loading: false, searchText: '',
    pagination: { current: 1, pageSize: 10, total: 0 },
    detailModalVisible: false, editModalVisible: false,
  })

  const loadClusters = useCallback(async () => {
    try {
      const response = await clustersService.getClusters({ page: 1, per_page: 100 })
      const onlineClusters = (response.clusters || []).filter(c => c.status === 'online')
      setState(prev => ({ ...prev, clusters: onlineClusters }))
    } catch (error: any) { message.error(error.response?.data?.message || '加载集群列表失败') }
  }, [])

  const loadNamespaces = useCallback(async (clusterId: number) => {
    try {
      const response = await namespacesService.getNamespaces({ cluster_id: clusterId, page: 1, per_page: 100 })
      const namespaces = response.namespaces || []
      setState(prev => ({ ...prev, namespaces, selectedNamespace: prev.selectedNamespace || namespaces[0]?.name }))
      if (namespaces.length > 0) loadResources(clusterId, namespaces[0].name)
    } catch (error: any) { message.error(error.response?.data?.message || '加载命名空间列表失败') }
  }, [])

  const loadServices = useCallback(async (clusterId?: number, namespace?: string, page?: number, search?: string, typeFilter?: ServiceType) => {
    const cid = clusterId || state.selectedClusterId
    const ns = namespace || state.selectedNamespace
    if (!cid || !ns) { setState(prev => ({ ...prev, services: [], loading: false })); return }
    try {
      setState(prev => ({ ...prev, loading: true }))
      const response = await k8sServicesService.getServices({
        cluster_id: cid, namespace: ns, page: page || state.pagination.current,
        per_page: state.pagination.pageSize, search: search !== undefined ? search : state.searchText,
        type: typeFilter !== undefined ? typeFilter : state.serviceTypeFilter,
      })
      setState(prev => ({ ...prev, services: response.services || [], pagination: { ...prev.pagination, current: response.pagination?.page || 1, total: response.pagination?.total || 0 }, loading: false }))
    } catch (error: any) { message.error(error.response?.data?.message || '加载服务列表失败'); setState(prev => ({ ...prev, loading: false })) }
  }, [state.selectedClusterId, state.selectedNamespace, state.pagination.current, state.pagination.pageSize, state.searchText, state.serviceTypeFilter])

  const loadIngresses = useCallback(async (clusterId?: number, namespace?: string, page?: number, search?: string) => {
    const cid = clusterId || state.selectedClusterId
    const ns = namespace || state.selectedNamespace
    if (!cid || !ns) { setState(prev => ({ ...prev, ingresses: [], loading: false })); return }
    try {
      setState(prev => ({ ...prev, loading: true }))
      const response = await k8sServicesService.getIngresses({
        cluster_id: cid, namespace: ns, page: page || state.pagination.current,
        per_page: state.pagination.pageSize, search: search !== undefined ? search : state.searchText,
      })
      setState(prev => ({ ...prev, ingresses: response.ingresses || [], pagination: { ...prev.pagination, current: response.pagination?.page || 1, total: response.pagination?.total || 0 }, loading: false }))
    } catch (error: any) { message.error(error.response?.data?.message || '加载Ingress列表失败'); setState(prev => ({ ...prev, loading: false })) }
  }, [state.selectedClusterId, state.selectedNamespace, state.pagination.current, state.pagination.pageSize, state.searchText])

  const loadResources = useCallback((clusterId?: number, namespace?: string, page?: number, search?: string) => {
    if (state.activeTab === 'service') loadServices(clusterId, namespace, page, search)
    else loadIngresses(clusterId, namespace, page, search)
  }, [state.activeTab, loadServices, loadIngresses])

  useEffect(() => { loadClusters() }, [])
  useEffect(() => { if (state.selectedClusterId) loadNamespaces(state.selectedClusterId) }, [state.selectedClusterId])
  useEffect(() => { if (state.selectedClusterId && state.selectedNamespace) loadResources(state.selectedClusterId, state.selectedNamespace, 1) }, [state.selectedNamespace])
  useEffect(() => { if (state.selectedClusterId && state.selectedNamespace) { setState(prev => ({ ...prev, searchText: '', serviceTypeFilter: undefined, pagination: { ...prev.pagination, current: 1 } })); loadResources(state.selectedClusterId, state.selectedNamespace, 1, '') } }, [state.activeTab])

  const handleClusterSelect = (cluster: K8sCluster) => setState(prev => ({ ...prev, selectedClusterId: cluster.id, selectedNamespace: undefined, searchText: '', serviceTypeFilter: undefined, pagination: { ...prev.pagination, current: 1 } }))
  const handleNamespaceSelect = (namespace: K8sNamespace) => setState(prev => ({ ...prev, selectedNamespace: namespace.name, searchText: '', serviceTypeFilter: undefined, pagination: { ...prev.pagination, current: 1 } }))
  const handleTabChange = (tab: 'service' | 'ingress') => setState(prev => ({ ...prev, activeTab: tab }))
  const handleSearch = (value: string) => { setState(prev => ({ ...prev, searchText: value, pagination: { ...prev.pagination, current: 1 } })); loadResources(state.selectedClusterId, state.selectedNamespace, 1, value) }
  const handleServiceTypeFilter = (type?: ServiceType) => { setState(prev => ({ ...prev, serviceTypeFilter: type, pagination: { ...prev.pagination, current: 1 } })); loadServices(state.selectedClusterId, state.selectedNamespace, 1, state.searchText, type) }

  const handleDeleteService = async (service: K8sService) => {
    if (!state.selectedClusterId || !state.selectedNamespace) return
    try { await k8sServicesService.deleteService({ cluster_id: state.selectedClusterId, namespace: state.selectedNamespace, name: service.name }); message.success(`Service "${service.name}" 删除成功`); loadResources() }
    catch (error: any) { message.error(error.response?.data?.message || '删除Service失败') }
  }

  const handleDeleteIngress = async (ingress: K8sIngress) => {
    if (!state.selectedClusterId || !state.selectedNamespace) return
    try { await k8sServicesService.deleteIngress({ cluster_id: state.selectedClusterId, namespace: state.selectedNamespace, name: ingress.name }); message.success(`Ingress "${ingress.name}" 删除成功`); loadResources() }
    catch (error: any) { message.error(error.response?.data?.message || '删除Ingress失败') }
  }

  const renderServiceType = (type: ServiceType) => {
    const colors: Record<ServiceType, string> = {
      ClusterIP: isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600',
      NodePort: isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600',
      LoadBalancer: isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600',
      ExternalName: isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600',
    }
    return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[type]}`}>{type}</span>
  }

  const renderPorts = (ports: any[]) => {
    if (!ports?.length) return <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>-</span>
    return (
      <div className="space-y-1">
        {ports.slice(0, 2).map((p, i) => (
          <div key={i} className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            {p.port}{p.target_port && ` → ${p.target_port}`}{p.node_port && ` (${p.node_port})`}/{p.protocol || 'TCP'}
          </div>
        ))}
        {ports.length > 2 && <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>+{ports.length - 2} more</span>}
      </div>
    )
  }

  const renderHosts = (hosts: string[]) => {
    if (!hosts?.length) return <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>-</span>
    return (
      <div className="space-y-1">
        {hosts.slice(0, 2).map((h, i) => <div key={i} className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{h}</div>)}
        {hosts.length > 2 && <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>+{hosts.length - 2} more</span>}
      </div>
    )
  }

  const renderPaths = (paths: any[]) => {
    if (!paths?.length) return <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>-</span>
    return (
      <div className="space-y-1">
        {paths.slice(0, 2).map((p, i) => (
          <div key={i} className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{p.path} → {p.backend?.service_name}:{p.backend?.service_port}</div>
        ))}
        {paths.length > 2 && <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>+{paths.length - 2} more</span>}
      </div>
    )
  }

  const serviceStats = { total: state.services.length, clusterIP: state.services.filter(s => s.type === 'ClusterIP').length, nodePort: state.services.filter(s => s.type === 'NodePort').length, loadBalancer: state.services.filter(s => s.type === 'LoadBalancer').length }
  const ingressStats = { total: state.ingresses.length, withTLS: state.ingresses.filter(i => i.tls?.length > 0).length, withoutTLS: state.ingresses.filter(i => !i.tls?.length).length }

  const typeFilters: { label: string; value?: ServiceType }[] = [
    { label: '全部' }, { label: 'ClusterIP', value: 'ClusterIP' }, { label: 'NodePort', value: 'NodePort' },
    { label: 'LoadBalancer', value: 'LoadBalancer' }, { label: 'ExternalName', value: 'ExternalName' },
  ]

  return (
    <K8sPageLayout title="K8S服务发现管理" subtitle="管理Service和Ingress" icon={Globe}
      iconGradient="from-emerald-500 via-teal-500 to-cyan-500" loading={state.loading} onRefresh={() => loadResources()}>
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {state.activeTab === 'service' ? (
          <>
            <K8sStatCard title="Service总数" value={serviceStats.total} icon={Server} variant="default" />
            <K8sStatCard title="ClusterIP" value={serviceStats.clusterIP} icon={Network} variant="success" />
            <K8sStatCard title="NodePort" value={serviceStats.nodePort} icon={Globe} variant="warning" />
            <K8sStatCard title="LoadBalancer" value={serviceStats.loadBalancer} icon={Shield} variant="purple" />
          </>
        ) : (
          <>
            <K8sStatCard title="Ingress总数" value={ingressStats.total} icon={Globe} variant="default" />
            <K8sStatCard title="已启用TLS" value={ingressStats.withTLS} icon={CheckCircle} variant="success" />
            <K8sStatCard title="未启用TLS" value={ingressStats.withoutTLS} icon={XCircle} variant="warning" />
          </>
        )}
      </div>

      {/* 筛选区域 */}
      <K8sFilterArea>
        <div className="w-72"><ClusterSelector clusters={state.clusters} selectedClusterId={state.selectedClusterId} onSelect={handleClusterSelect} placeholder="选择集群" /></div>
        <div className="w-72"><NamespaceSelector namespaces={state.namespaces} selectedNamespace={state.selectedNamespace} onSelect={handleNamespaceSelect} placeholder="选择命名空间" disabled={!state.selectedClusterId} /></div>
        <div className="relative w-80">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input type="text" placeholder={state.activeTab === 'service' ? '搜索服务名称' : '搜索Ingress名称'} value={state.searchText}
            onChange={e => handleSearch(e.target.value)} disabled={!state.selectedClusterId || !state.selectedNamespace}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-gray-500 focus:border-emerald-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-emerald-500'} border focus:outline-none focus:ring-2 focus:ring-emerald-500/20`} />
        </div>
      </K8sFilterArea>

      {/* Tab切换 */}
      <div className="flex items-center space-x-2 mb-4">
        <K8sTabButton active={state.activeTab === 'service'} onClick={() => handleTabChange('service')} icon={Server}>Service</K8sTabButton>
        <K8sTabButton active={state.activeTab === 'ingress'} onClick={() => handleTabChange('ingress')} icon={Globe}>Ingress</K8sTabButton>
      </div>

      {/* 服务类型筛选 */}
      {state.activeTab === 'service' && state.selectedClusterId && state.selectedNamespace && (
        <div className="flex items-center space-x-2 mb-4">
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>服务类型:</span>
          {typeFilters.map(f => (
            <button key={f.label} onClick={() => handleServiceTypeFilter(f.value)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${state.serviceTypeFilter === f.value ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' : isDark ? 'bg-slate-800 text-gray-400 hover:bg-slate-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{f.label}</button>
          ))}
        </div>
      )}

      {/* 列表 */}
      <K8sContentCard title={state.activeTab === 'service' ? 'Service列表' : 'Ingress列表'} icon={state.activeTab === 'service' ? Server : Globe} noPadding>
        {!state.selectedClusterId || !state.selectedNamespace ? (
          <div className="py-12"><Empty description="请选择集群和命名空间" /></div>
        ) : state.activeTab === 'service' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={isDark ? 'bg-slate-800/50' : 'bg-gray-50'}>
                  {['服务名称', '类型', 'Cluster IP', '端口映射', '外部IP', '创建时间', '操作'].map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-gray-100'}`}>
                {state.loading ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center"><Spin size="large" /></td></tr>
                ) : state.services.length === 0 ? (
                  <tr><td colSpan={7} className={`px-4 py-12 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{state.searchText ? '未找到匹配的服务' : '暂无Service'}</td></tr>
                ) : state.services.map(s => (
                  <tr key={s.name} className={`transition-colors ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-gray-50/50'}`}>
                    <td className="px-4 py-3"><div className="flex items-center space-x-2"><Server className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} /><span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{s.name}</span></div></td>
                    <td className="px-4 py-3">{renderServiceType(s.type)}</td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{s.cluster_ip || '-'}</td>
                    <td className="px-4 py-3">{renderPorts(s.ports)}</td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{s.external_ips?.length ? s.external_ips.join(', ') : '-'}</td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatDateTime(s.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1">
                        <button onClick={() => setState(prev => ({ ...prev, detailModalVisible: true, detailService: s }))} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-gray-400 hover:text-gray-300' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`} title="查看详情"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => setState(prev => ({ ...prev, editModalVisible: true, editResourceName: s.name, editResourceType: 'service' }))} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-gray-400 hover:text-gray-300' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`} title="编辑"><Edit className="w-4 h-4" /></button>
                        <Popconfirm title="确认删除" description={`确定要删除 Service "${s.name}" 吗？`} onConfirm={() => handleDeleteService(s)} okText="确定" cancelText="取消">
                          <button className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-50 text-gray-500 hover:text-red-500'}`} title="删除"><Trash2 className="w-4 h-4" /></button>
                        </Popconfirm>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={isDark ? 'bg-slate-800/50' : 'bg-gray-50'}>
                  {['Ingress名称', '主机', '路径规则', 'TLS', '创建时间', '操作'].map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-gray-100'}`}>
                {state.loading ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center"><Spin size="large" /></td></tr>
                ) : state.ingresses.length === 0 ? (
                  <tr><td colSpan={6} className={`px-4 py-12 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{state.searchText ? '未找到匹配的Ingress' : '暂无Ingress'}</td></tr>
                ) : state.ingresses.map(i => (
                  <tr key={i.name} className={`transition-colors ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-gray-50/50'}`}>
                    <td className="px-4 py-3"><div className="flex items-center space-x-2"><Globe className={`w-4 h-4 ${isDark ? 'text-teal-400' : 'text-teal-500'}`} /><span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{i.name}</span></div></td>
                    <td className="px-4 py-3">{renderHosts(i.hosts)}</td>
                    <td className="px-4 py-3">{renderPaths(i.paths)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${i.tls?.length > 0 ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600') : (isDark ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-600')}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${i.tls?.length > 0 ? 'bg-emerald-500' : 'bg-gray-500'}`}></span>
                        <span>{i.tls?.length > 0 ? '已启用' : '未启用'}</span>
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatDateTime(i.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1">
                        <button onClick={() => setState(prev => ({ ...prev, editModalVisible: true, editResourceName: i.name, editResourceType: 'ingress' }))} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-gray-400 hover:text-gray-300' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`} title="编辑"><Edit className="w-4 h-4" /></button>
                        <Popconfirm title="确认删除" description={`确定要删除 Ingress "${i.name}" 吗？`} onConfirm={() => handleDeleteIngress(i)} okText="确定" cancelText="取消">
                          <button className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-50 text-gray-500 hover:text-red-500'}`} title="删除"><Trash2 className="w-4 h-4" /></button>
                        </Popconfirm>
                      </div>
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
                <button key={page} onClick={() => { setState(prev => ({ ...prev, pagination: { ...prev.pagination, current: page } })); loadResources(state.selectedClusterId, state.selectedNamespace, page) }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${state.pagination.current === page ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' : isDark ? 'bg-slate-800 text-gray-400 hover:bg-slate-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{page}</button>
              ))}
            </div>
          </div>
        )}
      </K8sContentCard>

      {/* 服务详情弹窗 - 美化版 */}
      <Modal open={state.detailModalVisible} onCancel={() => setState(prev => ({ ...prev, detailModalVisible: false }))} footer={null} width={1000} closable={false} destroyOnClose
        styles={{ body: { background: isDark ? '#1e293b' : '#ffffff', borderRadius: '16px', padding: 0, overflow: 'hidden' }, mask: { backgroundColor: 'rgba(0, 0, 0, 0.6)' } }}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${isDark ? 'border-slate-700 bg-gradient-to-r from-emerald-900/30 to-teal-900/30' : 'border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
              <Server className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>服务详情</h3>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{state.detailService?.name}</p>
            </div>
            <button onClick={() => setState(prev => ({ ...prev, detailModalVisible: false }))} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {state.detailService && state.selectedClusterId && <ServiceDetail clusterId={state.selectedClusterId} namespace={state.detailService.namespace} name={state.detailService.name} />}
        </div>
      </Modal>
      {state.selectedClusterId && state.selectedNamespace && state.editResourceName && state.editResourceType && (
        <EditResourceModal visible={state.editModalVisible} clusterId={state.selectedClusterId} namespace={state.selectedNamespace} resourceName={state.editResourceName} resourceType={state.editResourceType}
          onClose={() => setState(prev => ({ ...prev, editModalVisible: false, editResourceName: undefined, editResourceType: undefined }))}
          onSuccess={() => { setState(prev => ({ ...prev, editModalVisible: false, editResourceName: undefined, editResourceType: undefined })); loadResources() }} />
      )}
    </K8sPageLayout>
  )
}

export default ServiceList
