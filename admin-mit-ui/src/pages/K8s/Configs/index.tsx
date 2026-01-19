/**
 * K8S配置管理页面 - 美化版
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Modal, message, Popconfirm, Spin, Empty, Form, Input } from 'antd'
import { FileText, Lock, Plus, Search, Eye, Trash2, Key, Tag, X } from 'lucide-react'
import { useTheme } from '../../../hooks/useTheme'
import { K8sPageLayout, K8sStatCard, K8sContentCard, K8sFilterArea, K8sTabButton } from '../../../components/K8s/K8sPageLayout'
import { configsService } from '../../../services/k8s/configs'
import { clustersService } from '../../../services/k8s/clusters'
import { namespacesService } from '../../../services/k8s/namespaces'
import { ClusterSelector } from '../../../components/K8s/ClusterSelector'
import { NamespaceSelector } from '../../../components/K8s/NamespaceSelector'
import { ConfigMapDetail } from './ConfigMapDetail'
import { SecretDetail } from './SecretDetail'
import type { K8sConfigMap, K8sSecret, K8sCluster, K8sNamespace, ConfigType } from '../../../types/k8s'
import { formatDateTime } from '../../../utils'

const { TextArea } = Input

interface ConfigListState {
  configMaps: K8sConfigMap[]
  secrets: K8sSecret[]
  clusters: K8sCluster[]
  namespaces: K8sNamespace[]
  selectedClusterId?: number
  selectedNamespace?: string
  activeTab: ConfigType
  loading: boolean
  searchText: string
  pagination: { current: number; pageSize: number; total: number }
  detailModalVisible: boolean
  detailConfigMap?: K8sConfigMap
  detailSecret?: K8sSecret
  createModalVisible: boolean
}

export const ConfigList: React.FC = () => {
  const { isDark } = useTheme()
  const [form] = Form.useForm()
  const [state, setState] = useState<ConfigListState>({
    configMaps: [], secrets: [], clusters: [], namespaces: [],
    selectedClusterId: undefined, selectedNamespace: undefined,
    activeTab: 'configmap', loading: false, searchText: '',
    pagination: { current: 1, pageSize: 10, total: 0 },
    detailModalVisible: false, createModalVisible: false,
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
      if (namespaces.length > 0) loadConfigs(clusterId, namespaces[0].name)
    } catch (error: any) { message.error(error.response?.data?.message || '加载命名空间列表失败') }
  }, [])

  const loadConfigMaps = useCallback(async (clusterId?: number, namespace?: string, page?: number, search?: string) => {
    const cid = clusterId || state.selectedClusterId
    const ns = namespace || state.selectedNamespace
    if (!cid || !ns) { setState(prev => ({ ...prev, configMaps: [], loading: false })); return }
    try {
      setState(prev => ({ ...prev, loading: true }))
      const response = await configsService.getConfigMaps({ cluster_id: cid, namespace: ns, page: page || state.pagination.current, per_page: state.pagination.pageSize, search: search !== undefined ? search : state.searchText })
      setState(prev => ({ ...prev, configMaps: response.configmaps || [], pagination: { ...prev.pagination, current: response.pagination?.page || 1, total: response.pagination?.total || 0 }, loading: false }))
    } catch (error: any) { message.error(error.response?.data?.message || '加载ConfigMap列表失败'); setState(prev => ({ ...prev, loading: false })) }
  }, [state.selectedClusterId, state.selectedNamespace, state.pagination.current, state.pagination.pageSize, state.searchText])

  const loadSecrets = useCallback(async (clusterId?: number, namespace?: string, page?: number, search?: string) => {
    const cid = clusterId || state.selectedClusterId
    const ns = namespace || state.selectedNamespace
    if (!cid || !ns) { setState(prev => ({ ...prev, secrets: [], loading: false })); return }
    try {
      setState(prev => ({ ...prev, loading: true }))
      const response = await configsService.getSecrets({ cluster_id: cid, namespace: ns, page: page || state.pagination.current, per_page: state.pagination.pageSize, search: search !== undefined ? search : state.searchText })
      setState(prev => ({ ...prev, secrets: response.secrets || [], pagination: { ...prev.pagination, current: response.pagination?.page || 1, total: response.pagination?.total || 0 }, loading: false }))
    } catch (error: any) { message.error(error.response?.data?.message || '加载Secret列表失败'); setState(prev => ({ ...prev, loading: false })) }
  }, [state.selectedClusterId, state.selectedNamespace, state.pagination.current, state.pagination.pageSize, state.searchText])

  const loadConfigs = useCallback((clusterId?: number, namespace?: string, page?: number, search?: string) => {
    if (state.activeTab === 'configmap') loadConfigMaps(clusterId, namespace, page, search)
    else loadSecrets(clusterId, namespace, page, search)
  }, [state.activeTab, loadConfigMaps, loadSecrets])

  useEffect(() => { loadClusters() }, [])
  useEffect(() => { if (state.selectedClusterId) loadNamespaces(state.selectedClusterId) }, [state.selectedClusterId])
  useEffect(() => { if (state.selectedClusterId && state.selectedNamespace) loadConfigs(state.selectedClusterId, state.selectedNamespace, 1) }, [state.selectedNamespace])
  useEffect(() => { if (state.selectedClusterId && state.selectedNamespace) { setState(prev => ({ ...prev, searchText: '', pagination: { ...prev.pagination, current: 1 } })); loadConfigs(state.selectedClusterId, state.selectedNamespace, 1, '') } }, [state.activeTab])

  const handleClusterSelect = (cluster: K8sCluster) => setState(prev => ({ ...prev, selectedClusterId: cluster.id, selectedNamespace: undefined, searchText: '', pagination: { ...prev.pagination, current: 1 } }))
  const handleNamespaceSelect = (namespace: K8sNamespace) => setState(prev => ({ ...prev, selectedNamespace: namespace.name, searchText: '', pagination: { ...prev.pagination, current: 1 } }))
  const handleTabChange = (tab: ConfigType) => setState(prev => ({ ...prev, activeTab: tab }))
  const handleSearch = (value: string) => { setState(prev => ({ ...prev, searchText: value, pagination: { ...prev.pagination, current: 1 } })); loadConfigs(state.selectedClusterId, state.selectedNamespace, 1, value) }

  const handleCreateConfig = async () => {
    try {
      const values = await form.validateFields()
      if (!state.selectedClusterId || !state.selectedNamespace) { message.error('请先选择集群和命名空间'); return }
      const data: Record<string, string> = {}
      values.data?.forEach((item: { key: string; value: string }) => { if (item.key && item.value) data[item.key] = item.value })
      if (Object.keys(data).length === 0) { message.error('请至少添加一个键值对'); return }
      setState(prev => ({ ...prev, loading: true }))
      if (state.activeTab === 'configmap') { await configsService.createConfigMap({ cluster_id: state.selectedClusterId, namespace: state.selectedNamespace, name: values.name, data }); message.success('ConfigMap创建成功') }
      else { await configsService.createSecret({ cluster_id: state.selectedClusterId, namespace: state.selectedNamespace, name: values.name, data }); message.success('Secret创建成功') }
      setState(prev => ({ ...prev, createModalVisible: false, loading: false })); loadConfigs()
    } catch (error: any) { message.error(error.response?.data?.message || '创建失败'); setState(prev => ({ ...prev, loading: false })) }
  }

  const handleDeleteConfigMap = async (name: string) => {
    if (!state.selectedClusterId || !state.selectedNamespace) return
    try {
      const workloads = await configsService.checkConfigUsage(state.selectedClusterId, state.selectedNamespace, 'configmap', name)
      if (workloads.length > 0) { Modal.warning({ title: '无法删除', content: `该ConfigMap正在被以下工作负载使用：${workloads.map((w: any) => w.name).join(', ')}` }); return }
      await configsService.deleteConfigMap({ cluster_id: state.selectedClusterId, namespace: state.selectedNamespace, name }); message.success('ConfigMap删除成功'); loadConfigs()
    } catch (error: any) { message.error(error.response?.data?.message || '删除失败') }
  }

  const handleDeleteSecret = async (name: string) => {
    if (!state.selectedClusterId || !state.selectedNamespace) return
    try {
      const workloads = await configsService.checkConfigUsage(state.selectedClusterId, state.selectedNamespace, 'secret', name)
      if (workloads.length > 0) { Modal.warning({ title: '无法删除', content: `该Secret正在被以下工作负载使用：${workloads.map((w: any) => w.name).join(', ')}` }); return }
      await configsService.deleteSecret({ cluster_id: state.selectedClusterId, namespace: state.selectedNamespace, name }); message.success('Secret删除成功'); loadConfigs()
    } catch (error: any) { message.error(error.response?.data?.message || '删除失败') }
  }

  const renderDataKeys = (data: Record<string, string>) => {
    const keys = Object.keys(data || {})
    if (keys.length === 0) return <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>-</span>
    return (
      <div className="flex flex-wrap gap-1">
        {keys.slice(0, 3).map(k => <span key={k} className={`inline-flex px-2 py-0.5 rounded text-xs ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>{k}</span>)}
        {keys.length > 3 && <span className={`inline-flex px-2 py-0.5 rounded text-xs ${isDark ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>+{keys.length - 3}</span>}
      </div>
    )
  }

  const configMapStats = { total: state.configMaps.length }
  const secretStats = { total: state.secrets.length, opaque: state.secrets.filter(s => s.type === 'Opaque').length, tls: state.secrets.filter(s => s.type === 'kubernetes.io/tls').length }

  return (
    <K8sPageLayout title="K8S配置管理" subtitle="管理ConfigMap和Secret" icon={FileText}
      iconGradient="from-amber-500 via-orange-500 to-red-500" loading={state.loading} onRefresh={() => loadConfigs()}
      headerActions={
        <button onClick={() => { form.resetFields(); setState(prev => ({ ...prev, createModalVisible: true })) }}
          disabled={!state.selectedClusterId || !state.selectedNamespace}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all disabled:opacity-50 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700' : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm'}`}>
          <Plus className="w-4 h-4" /><span>创建{state.activeTab === 'configmap' ? 'ConfigMap' : 'Secret'}</span>
        </button>
      }>
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {state.activeTab === 'configmap' ? (
          <>
            <K8sStatCard title="ConfigMap总数" value={configMapStats.total} icon={FileText} variant="default" />
            <K8sStatCard title="数据键总数" value={state.configMaps.reduce((acc, cm) => acc + Object.keys(cm.data || {}).length, 0)} icon={Key} variant="success" />
          </>
        ) : (
          <>
            <K8sStatCard title="Secret总数" value={secretStats.total} icon={Lock} variant="default" />
            <K8sStatCard title="Opaque类型" value={secretStats.opaque} icon={Key} variant="success" />
            <K8sStatCard title="TLS类型" value={secretStats.tls} icon={Lock} variant="purple" />
          </>
        )}
      </div>

      {/* 筛选区域 */}
      <K8sFilterArea>
        <div className="w-72"><ClusterSelector clusters={state.clusters} selectedClusterId={state.selectedClusterId} onSelect={handleClusterSelect} placeholder="选择集群" /></div>
        <div className="w-72"><NamespaceSelector namespaces={state.namespaces} selectedNamespace={state.selectedNamespace} onSelect={handleNamespaceSelect} placeholder="选择命名空间" disabled={!state.selectedClusterId} /></div>
        <div className="relative w-80">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input type="text" placeholder={state.activeTab === 'configmap' ? '搜索ConfigMap名称' : '搜索Secret名称'} value={state.searchText}
            onChange={e => handleSearch(e.target.value)} disabled={!state.selectedClusterId || !state.selectedNamespace}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-gray-500 focus:border-amber-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-amber-500'} border focus:outline-none focus:ring-2 focus:ring-amber-500/20`} />
        </div>
      </K8sFilterArea>

      {/* Tab切换 */}
      <div className="flex items-center space-x-2 mb-6">
        <K8sTabButton active={state.activeTab === 'configmap'} onClick={() => handleTabChange('configmap')} icon={FileText}>ConfigMap</K8sTabButton>
        <K8sTabButton active={state.activeTab === 'secret'} onClick={() => handleTabChange('secret')} icon={Lock}>Secret</K8sTabButton>
      </div>

      {/* 列表 */}
      <K8sContentCard title={state.activeTab === 'configmap' ? 'ConfigMap列表' : 'Secret列表'} icon={state.activeTab === 'configmap' ? FileText : Lock} noPadding>
        {!state.selectedClusterId || !state.selectedNamespace ? (
          <div className="py-12"><Empty description="请选择集群和命名空间" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={isDark ? 'bg-slate-800/50' : 'bg-gray-50'}>
                  {state.activeTab === 'configmap'
                    ? ['ConfigMap名称', '数据键', '键数量', '创建时间', '操作'].map(h => <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>)
                    : ['Secret名称', '类型', '数据键', '键数量', '创建时间', '操作'].map(h => <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>)
                  }
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-gray-100'}`}>
                {state.loading ? (
                  <tr><td colSpan={state.activeTab === 'configmap' ? 5 : 6} className="px-4 py-12 text-center"><Spin size="large" /></td></tr>
                ) : (state.activeTab === 'configmap' ? state.configMaps : state.secrets).length === 0 ? (
                  <tr><td colSpan={state.activeTab === 'configmap' ? 5 : 6} className={`px-4 py-12 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{state.searchText ? `未找到匹配的${state.activeTab === 'configmap' ? 'ConfigMap' : 'Secret'}` : `暂无${state.activeTab === 'configmap' ? 'ConfigMap' : 'Secret'}`}</td></tr>
                ) : state.activeTab === 'configmap' ? state.configMaps.map(cm => (
                  <tr key={cm.name} className={`transition-colors ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-gray-50/50'}`}>
                    <td className="px-4 py-3"><div className="flex items-center space-x-2"><FileText className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} /><span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{cm.name}</span></div></td>
                    <td className="px-4 py-3">{renderDataKeys(cm.data)}</td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{Object.keys(cm.data || {}).length}</td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatDateTime(cm.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1">
                        <button onClick={() => setState(prev => ({ ...prev, detailModalVisible: true, detailConfigMap: cm, detailSecret: undefined }))} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-gray-400 hover:text-gray-300' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`} title="查看详情"><Eye className="w-4 h-4" /></button>
                        <Popconfirm title="确认删除" description="删除后无法恢复，确定要删除这个ConfigMap吗？" onConfirm={() => handleDeleteConfigMap(cm.name)} okText="确定" cancelText="取消">
                          <button className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-50 text-gray-500 hover:text-red-500'}`} title="删除"><Trash2 className="w-4 h-4" /></button>
                        </Popconfirm>
                      </div>
                    </td>
                  </tr>
                )) : state.secrets.map(s => (
                  <tr key={s.name} className={`transition-colors ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-gray-50/50'}`}>
                    <td className="px-4 py-3"><div className="flex items-center space-x-2"><Lock className={`w-4 h-4 ${isDark ? 'text-orange-400' : 'text-orange-500'}`} /><span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{s.name}</span></div></td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>{s.type}</span></td>
                    <td className="px-4 py-3">{renderDataKeys(s.data)}</td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{Object.keys(s.data || {}).length}</td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatDateTime(s.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1">
                        <button onClick={() => setState(prev => ({ ...prev, detailModalVisible: true, detailSecret: s, detailConfigMap: undefined }))} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-gray-400 hover:text-gray-300' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`} title="查看详情"><Eye className="w-4 h-4" /></button>
                        <Popconfirm title="确认删除" description="删除后无法恢复，确定要删除这个Secret吗？" onConfirm={() => handleDeleteSecret(s.name)} okText="确定" cancelText="取消">
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
                <button key={page} onClick={() => { setState(prev => ({ ...prev, pagination: { ...prev.pagination, current: page } })); loadConfigs(state.selectedClusterId, state.selectedNamespace, page) }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${state.pagination.current === page ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' : isDark ? 'bg-slate-800 text-gray-400 hover:bg-slate-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{page}</button>
              ))}
            </div>
          </div>
        )}
      </K8sContentCard>

      {/* 详情弹窗 - 美化版 */}
      <Modal open={state.detailModalVisible} onCancel={() => setState(prev => ({ ...prev, detailModalVisible: false }))} footer={null} width={800} closable={false} destroyOnClose
        styles={{ body: { background: isDark ? '#1e293b' : '#ffffff', borderRadius: '16px', padding: 0, overflow: 'hidden' }, mask: { backgroundColor: 'rgba(0, 0, 0, 0.6)' } }}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${isDark ? 'border-slate-700 bg-gradient-to-r from-amber-900/30 to-orange-900/30' : 'border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
              {state.detailConfigMap ? <FileText className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} /> : <Lock className={`w-5 h-5 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />}
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{state.detailConfigMap ? 'ConfigMap' : 'Secret'} 详情</h3>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{state.detailConfigMap?.name || state.detailSecret?.name}</p>
            </div>
            <button onClick={() => setState(prev => ({ ...prev, detailModalVisible: false }))} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {state.detailConfigMap && state.selectedClusterId && <ConfigMapDetail clusterId={state.selectedClusterId} namespace={state.detailConfigMap.namespace} name={state.detailConfigMap.name} />}
          {state.detailSecret && state.selectedClusterId && <SecretDetail clusterId={state.selectedClusterId} namespace={state.detailSecret.namespace} name={state.detailSecret.name} />}
        </div>
      </Modal>

      {/* 创建弹窗 - 美化版 */}
      <Modal open={state.createModalVisible} onCancel={() => setState(prev => ({ ...prev, createModalVisible: false }))}
        width={700} footer={null} closable={false} destroyOnClose
        styles={{ body: { background: isDark ? '#1e293b' : '#ffffff', borderRadius: '16px', padding: 0, overflow: 'hidden' }, mask: { backgroundColor: 'rgba(0, 0, 0, 0.6)' } }}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${isDark ? 'border-slate-700 bg-gradient-to-r from-amber-900/30 to-orange-900/30' : 'border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
              {state.activeTab === 'configmap' ? <FileText className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} /> : <Lock className={`w-5 h-5 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />}
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>创建 {state.activeTab === 'configmap' ? 'ConfigMap' : 'Secret'}</h3>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>在命名空间 {state.selectedNamespace} 中创建配置</p>
            </div>
            <button onClick={() => setState(prev => ({ ...prev, createModalVisible: false }))} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        {/* Content */}
        <div className="p-6">
          <Form form={form} layout="vertical" initialValues={{ name: '', data: [{ key: '', value: '' }] }}>
            <Form.Item label={<span className={isDark ? 'text-gray-300' : 'text-gray-700'}>名称 <span className="text-red-500">*</span></span>} name="name" rules={[{ required: true, message: '请输入名称' }, { pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, message: '名称只能包含小写字母、数字和连字符' }]}>
              <Input placeholder="请输入名称" className={isDark ? 'bg-slate-800 border-slate-600 text-white' : ''} />
            </Form.Item>
            <Form.List name="data">
              {(fields, { add, remove }) => (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`font-medium flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}><Key className="w-4 h-4" />数据键值对</span>
                    <button type="button" onClick={() => add()} className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><Plus className="w-3.5 h-3.5" />添加</button>
                  </div>
                  <div className={`rounded-xl border p-3 space-y-2 ${isDark ? 'border-slate-700 bg-slate-800/30' : 'border-gray-200 bg-gray-50'}`}>
                    {fields.map((field) => (
                      <div key={field.key} className="flex items-start gap-2">
                        <Form.Item {...field} name={[field.name, 'key']} rules={[{ required: true, message: '请输入键' }]} style={{ marginBottom: 0, width: 160 }}>
                          <Input placeholder="键" className={isDark ? 'bg-slate-800 border-slate-600 text-white' : ''} />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'value']} rules={[{ required: true, message: '请输入值' }]} style={{ marginBottom: 0, flex: 1 }}>
                          <TextArea placeholder="值" autoSize={{ minRows: 1, maxRows: 4 }} className={isDark ? 'bg-slate-800 border-slate-600 text-white' : ''} />
                        </Form.Item>
                        {fields.length > 1 && <button type="button" onClick={() => remove(field.name)} className={`p-2 rounded-lg mt-0.5 ${isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-50'}`}><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Form.List>
            {state.activeTab === 'secret' && (
              <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
                <Lock className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                <span className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>Secret的值将自动进行Base64编码后存储</span>
              </div>
            )}
          </Form>
        </div>
        {/* Footer */}
        <div className={`px-6 py-4 border-t flex items-center justify-end gap-3 ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-gray-50'}`}>
          <button onClick={() => setState(prev => ({ ...prev, createModalVisible: false }))} className={`px-4 py-2 rounded-lg font-medium transition-colors ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>取消</button>
          <button onClick={handleCreateConfig} disabled={state.loading}
            className={`px-5 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${!state.loading ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/25' : 'opacity-50 cursor-not-allowed bg-gray-400 text-gray-200'}`}>
            {state.loading ? <><Spin size="small" />创建中...</> : <><Plus className="w-4 h-4" />创建</>}
          </button>
        </div>
      </Modal>
    </K8sPageLayout>
  )
}

export default ConfigList
