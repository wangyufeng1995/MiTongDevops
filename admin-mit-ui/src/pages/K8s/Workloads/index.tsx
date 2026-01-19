/**
 * K8S工作负载管理页面 - 美化版
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Modal, message, Popconfirm, Spin, Empty, Form, InputNumber } from 'antd'
import { Layers, Plus, Search, Eye, Edit, Trash2, RefreshCw, Play, Maximize2, ChevronDown, ChevronRight, Box, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { useTheme } from '../../../hooks/useTheme'
import { K8sPageLayout, K8sStatCard, K8sContentCard, K8sFilterArea, K8sTabButton, K8sStatusBadge } from '../../../components/K8s/K8sPageLayout'
import { workloadsService } from '../../../services/k8s/workloads'
import { clustersService } from '../../../services/k8s/clusters'
import { namespacesService } from '../../../services/k8s/namespaces'
import { ClusterSelector } from '../../../components/K8s/ClusterSelector'
import { NamespaceSelector } from '../../../components/K8s/NamespaceSelector'
import { WorkloadDetail } from './WorkloadDetail'
import { PodExpandedRow } from './PodExpandedRow'
import { PodInfoModal } from './PodInfoModal'
import { PodLogModal } from './PodLogModal'
import { PodShellModal } from './PodShellModal'
import { CreateResourceModal } from './CreateResourceModal'
import { EditWorkloadModal } from './EditWorkloadModal'
import type { K8sWorkload, K8sCluster, K8sNamespace, WorkloadType, WorkloadStatus, K8sPod } from '../../../types/k8s'
import { formatDateTime } from '../../../utils'

interface WorkloadListState {
  workloads: K8sWorkload[]
  clusters: K8sCluster[]
  namespaces: K8sNamespace[]
  selectedClusterId?: number
  selectedNamespace?: string
  workloadType: WorkloadType
  loading: boolean
  searchText: string
  pagination: { current: number; pageSize: number; total: number }
  scaleModalVisible: boolean
  scaleWorkload?: K8sWorkload
  detailModalVisible: boolean
  detailWorkload?: K8sWorkload
  expandedRowKeys: string[]
  podDetailModalVisible: boolean
  podDetailPod?: K8sPod
  podLogModalVisible: boolean
  podLogPod?: K8sPod
  podShellModalVisible: boolean
  podShellPod?: K8sPod
  createResourceModalVisible: boolean
  editWorkloadModalVisible: boolean
  editWorkload?: K8sWorkload
}

export const WorkloadList: React.FC = () => {
  const { isDark } = useTheme()
  const [scaleForm] = Form.useForm()
  const [state, setState] = useState<WorkloadListState>({
    workloads: [], clusters: [], namespaces: [],
    selectedClusterId: undefined, selectedNamespace: undefined,
    workloadType: 'deployment', loading: false, searchText: '',
    pagination: { current: 1, pageSize: 10, total: 0 },
    scaleModalVisible: false, detailModalVisible: false,
    expandedRowKeys: [], podDetailModalVisible: false,
    podLogModalVisible: false, podShellModalVisible: false,
    createResourceModalVisible: false, editWorkloadModalVisible: false,
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
      if (namespaces.length > 0) loadWorkloads(clusterId, namespaces[0].name)
    } catch (error: any) { message.error(error.response?.data?.message || '加载命名空间列表失败') }
  }, [])

  const loadWorkloads = useCallback(async (clusterId?: number, namespace?: string, type?: WorkloadType, page?: number, search?: string) => {
    const cid = clusterId || state.selectedClusterId
    const ns = namespace || state.selectedNamespace
    const t = type || state.workloadType
    if (!cid || !ns) { setState(prev => ({ ...prev, workloads: [], loading: false })); return }
    try {
      setState(prev => ({ ...prev, loading: true }))
      const response = await workloadsService.getWorkloads({
        cluster_id: cid, namespace: ns, type: t,
        page: page || state.pagination.current, per_page: state.pagination.pageSize,
        search: search !== undefined ? search : state.searchText,
      })
      setState(prev => ({
        ...prev, workloads: response.workloads || [],
        pagination: { ...prev.pagination, current: response.pagination?.page || 1, total: response.pagination?.total || 0 },
        loading: false,
      }))
    } catch (error: any) {
      message.error(error.response?.data?.message || '加载工作负载列表失败')
      setState(prev => ({ ...prev, loading: false }))
    }
  }, [state.selectedClusterId, state.selectedNamespace, state.workloadType, state.pagination.current, state.pagination.pageSize, state.searchText])

  useEffect(() => { loadClusters() }, [])
  useEffect(() => { if (state.selectedClusterId) loadNamespaces(state.selectedClusterId) }, [state.selectedClusterId])
  useEffect(() => { if (state.selectedClusterId && state.selectedNamespace) loadWorkloads(state.selectedClusterId, state.selectedNamespace, state.workloadType, 1) }, [state.selectedNamespace, state.workloadType])

  const handleClusterSelect = (cluster: K8sCluster) => setState(prev => ({ ...prev, selectedClusterId: cluster.id, selectedNamespace: undefined, searchText: '', pagination: { ...prev.pagination, current: 1 } }))
  const handleNamespaceSelect = (namespace: K8sNamespace) => setState(prev => ({ ...prev, selectedNamespace: namespace.name, searchText: '', pagination: { ...prev.pagination, current: 1 } }))
  const handleTypeChange = (type: WorkloadType) => setState(prev => ({ ...prev, workloadType: type, searchText: '', pagination: { ...prev.pagination, current: 1 } }))
  const handleSearch = (value: string) => { setState(prev => ({ ...prev, searchText: value, pagination: { ...prev.pagination, current: 1 } })); loadWorkloads(state.selectedClusterId, state.selectedNamespace, state.workloadType, 1, value) }

  const handleOpenScale = (workload: K8sWorkload) => { setState(prev => ({ ...prev, scaleModalVisible: true, scaleWorkload: workload })); scaleForm.setFieldsValue({ replicas: workload.replicas || 1 }) }
  const handleScale = async () => {
    if (!state.selectedClusterId || !state.scaleWorkload) return
    try {
      const values = await scaleForm.validateFields()
      await workloadsService.scaleWorkload({ cluster_id: state.selectedClusterId, namespace: state.scaleWorkload.namespace, type: state.scaleWorkload.type, name: state.scaleWorkload.name, replicas: values.replicas })
      message.success('扩缩容操作已提交')
      setState(prev => ({ ...prev, scaleModalVisible: false }))
      loadWorkloads()
    } catch (error: any) { if (!error.errorFields) message.error(error.response?.data?.message || '扩缩容失败') }
  }

  const handleRestart = async (workload: K8sWorkload) => {
    if (!state.selectedClusterId) return
    try {
      await workloadsService.restartWorkload({ cluster_id: state.selectedClusterId, namespace: workload.namespace, type: workload.type, name: workload.name })
      message.success('重启操作已提交')
      loadWorkloads()
    } catch (error: any) { message.error(error.response?.data?.message || '重启失败') }
  }

  const handleDeleteWorkload = async (workload: K8sWorkload) => {
    if (!state.selectedClusterId) return
    try {
      await workloadsService.deleteWorkload({ cluster_id: state.selectedClusterId, namespace: workload.namespace, type: workload.type, name: workload.name })
      message.success(`${workload.type} "${workload.name}" 删除成功`)
      loadWorkloads()
    } catch (error: any) { message.error(error.response?.data?.message || '删除失败') }
  }

  const handleExpand = (name: string) => setState(prev => ({ ...prev, expandedRowKeys: prev.expandedRowKeys.includes(name) ? prev.expandedRowKeys.filter(k => k !== name) : [...prev.expandedRowKeys, name] }))
  const handleViewPodDetail = (pod: K8sPod) => setState(prev => ({ ...prev, podDetailModalVisible: true, podDetailPod: pod }))
  const handleViewPodLogs = (pod: K8sPod) => setState(prev => ({ ...prev, podLogModalVisible: true, podLogPod: pod }))
  const handleOpenPodShell = (pod: K8sPod) => setState(prev => ({ ...prev, podShellModalVisible: true, podShellPod: pod }))

  const getStatusBadge = (status: WorkloadStatus) => {
    const map: Record<WorkloadStatus, 'success' | 'warning' | 'error' | 'running'> = { running: 'running', pending: 'warning', failed: 'error', succeeded: 'success', unknown: 'warning' }
    const textMap: Record<WorkloadStatus, string> = { running: '运行中', pending: '等待中', failed: '失败', succeeded: '成功', unknown: '未知' }
    return <K8sStatusBadge status={map[status] || 'warning'} text={textMap[status] || status} />
  }

  const renderReplicas = (w: K8sWorkload) => {
    const { replicas = 0, available_replicas = 0, ready_replicas = 0 } = w
    const allReady = available_replicas === replicas && ready_replicas === replicas
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${allReady ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600') : (isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600')}`}>
        {available_replicas}/{replicas}
      </span>
    )
  }

  const renderImages = (images: string[]) => {
    if (!images?.length) return <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>-</span>
    return (
      <div className="space-y-1">
        {images.slice(0, 2).map((img, i) => (
          <div key={i} className={`text-xs truncate max-w-[250px] ${isDark ? 'text-gray-300' : 'text-gray-600'}`} title={img}>{img.length > 40 ? `${img.substring(0, 40)}...` : img}</div>
        ))}
        {images.length > 2 && <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>+{images.length - 2} more</span>}
      </div>
    )
  }

  const stats = {
    total: state.workloads.length,
    running: state.workloads.filter(w => w.status === 'running').length,
    pending: state.workloads.filter(w => w.status === 'pending').length,
    failed: state.workloads.filter(w => w.status === 'failed').length,
  }

  return (
    <K8sPageLayout title="K8S工作负载管理" subtitle="管理Deployment、StatefulSet、DaemonSet" icon={Layers}
      iconGradient="from-violet-500 via-purple-500 to-fuchsia-500" loading={state.loading} onRefresh={() => loadWorkloads()}
      headerActions={
        <button onClick={() => setState(prev => ({ ...prev, createResourceModalVisible: true }))}
          disabled={!state.selectedClusterId || !state.selectedNamespace}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all disabled:opacity-50 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700' : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm'}`}>
          <Plus className="w-4 h-4" /><span>创建资源</span>
        </button>
      }>
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <K8sStatCard title="工作负载总数" value={stats.total} icon={Layers} variant="default" />
        <K8sStatCard title="运行中" value={stats.running} icon={CheckCircle} variant="success" />
        <K8sStatCard title="等待中" value={stats.pending} icon={Clock} variant="warning" />
        <K8sStatCard title="失败" value={stats.failed} icon={AlertTriangle} variant="danger" />
      </div>

      {/* 筛选区域 */}
      <K8sFilterArea>
        <div className="w-72">
          <ClusterSelector clusters={state.clusters} selectedClusterId={state.selectedClusterId} onSelect={handleClusterSelect} placeholder="选择集群" />
        </div>
        <div className="w-72">
          <NamespaceSelector namespaces={state.namespaces} selectedNamespace={state.selectedNamespace} onSelect={handleNamespaceSelect} placeholder="选择命名空间" disabled={!state.selectedClusterId} />
        </div>
        <div className="relative w-80">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input type="text" placeholder="搜索工作负载名称" value={state.searchText} onChange={e => handleSearch(e.target.value)}
            disabled={!state.selectedClusterId || !state.selectedNamespace}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-gray-500 focus:border-violet-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-violet-500'} border focus:outline-none focus:ring-2 focus:ring-violet-500/20`} />
        </div>
      </K8sFilterArea>

      {/* Tab切换 */}
      <div className="flex items-center space-x-2 mb-6">
        <K8sTabButton active={state.workloadType === 'deployment'} onClick={() => handleTypeChange('deployment')} icon={Box}>Deployment</K8sTabButton>
        <K8sTabButton active={state.workloadType === 'statefulset'} onClick={() => handleTypeChange('statefulset')} icon={Layers}>StatefulSet</K8sTabButton>
        <K8sTabButton active={state.workloadType === 'daemonset'} onClick={() => handleTypeChange('daemonset')} icon={Play}>DaemonSet</K8sTabButton>
      </div>

      {/* 列表 */}
      <K8sContentCard title={`${state.workloadType.charAt(0).toUpperCase() + state.workloadType.slice(1)} 列表`} icon={Layers} noPadding>
        {!state.selectedClusterId || !state.selectedNamespace ? (
          <div className="py-12"><Empty description="请选择集群和命名空间" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={isDark ? 'bg-slate-800/50' : 'bg-gray-50'}>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`} style={{ width: 40 }}></th>
                  {['工作负载名称', '状态', '副本数', '镜像', '创建时间', '操作'].map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-gray-100'}`}>
                {state.loading ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center"><Spin size="large" /></td></tr>
                ) : state.workloads.length === 0 ? (
                  <tr><td colSpan={7} className={`px-4 py-12 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{state.searchText ? '未找到匹配的工作负载' : `暂无${state.workloadType}`}</td></tr>
                ) : state.workloads.map(w => (
                  <React.Fragment key={w.name}>
                    <tr className={`transition-colors ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-gray-50/50'}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => handleExpand(w.name)} className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}>
                          {state.expandedRowKeys.includes(w.name) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <Layers className={`w-4 h-4 ${isDark ? 'text-violet-400' : 'text-violet-500'}`} />
                          <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{w.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(w.status)}</td>
                      <td className="px-4 py-3">{renderReplicas(w)}</td>
                      <td className="px-4 py-3">{renderImages(w.images)}</td>
                      <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatDateTime(w.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1">
                          <button onClick={() => setState(prev => ({ ...prev, detailModalVisible: true, detailWorkload: w }))}
                            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-gray-400 hover:text-gray-300' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`} title="查看详情"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => setState(prev => ({ ...prev, editWorkloadModalVisible: true, editWorkload: w }))}
                            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-gray-400 hover:text-gray-300' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`} title="编辑"><Edit className="w-4 h-4" /></button>
                          {w.type !== 'daemonset' && (
                            <button onClick={() => handleOpenScale(w)}
                              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-gray-400 hover:text-gray-300' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`} title="扩缩容"><Maximize2 className="w-4 h-4" /></button>
                          )}
                          <Popconfirm title="确定要重启这个工作负载吗？" description="重启将触发滚动更新" onConfirm={() => handleRestart(w)} okText="确定" cancelText="取消">
                            <button className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-gray-400 hover:text-gray-300' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`} title="重启"><RefreshCw className="w-4 h-4" /></button>
                          </Popconfirm>
                          <Popconfirm title={`确定要删除 ${w.type} "${w.name}" 吗？`} description="删除后将无法恢复" onConfirm={() => handleDeleteWorkload(w)} okText="确定" cancelText="取消" okButtonProps={{ danger: true }}>
                            <button className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-50 text-gray-500 hover:text-red-500'}`} title="删除"><Trash2 className="w-4 h-4" /></button>
                          </Popconfirm>
                        </div>
                      </td>
                    </tr>
                    {state.expandedRowKeys.includes(w.name) && state.selectedClusterId && state.selectedNamespace && (
                      <tr><td colSpan={7} className={`px-4 py-4 ${isDark ? 'bg-slate-800/20' : 'bg-gray-50/50'}`}>
                        <PodExpandedRow clusterId={state.selectedClusterId} namespace={state.selectedNamespace} workloadName={w.name} workloadType={w.type} labelSelector={w.selector || {}}
                          onViewDetail={handleViewPodDetail} onViewLogs={handleViewPodLogs} onOpenShell={handleOpenPodShell} />
                      </td></tr>
                    )}
                  </React.Fragment>
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
                <button key={page} onClick={() => { setState(prev => ({ ...prev, pagination: { ...prev.pagination, current: page } })); loadWorkloads(state.selectedClusterId, state.selectedNamespace, state.workloadType, page) }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${state.pagination.current === page ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white' : isDark ? 'bg-slate-800 text-gray-400 hover:bg-slate-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{page}</button>
              ))}
            </div>
          </div>
        )}
      </K8sContentCard>

      {/* 弹窗 */}
      <Modal title={`扩缩容 - ${state.scaleWorkload?.name}`} open={state.scaleModalVisible} onOk={handleScale}
        onCancel={() => setState(prev => ({ ...prev, scaleModalVisible: false }))} okText="确定" cancelText="取消" width={500}>
        <Form form={scaleForm} layout="vertical">
          <Form.Item label="副本数" name="replicas" rules={[{ required: true, message: '请输入副本数' }, { type: 'number', min: 0, max: 100, message: '副本数需在0-100之间' }]}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="请输入副本数" />
          </Form.Item>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}>
            <p className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>当前副本数: {state.scaleWorkload?.replicas || 0} | 可用副本数: {state.scaleWorkload?.available_replicas || 0}</p>
          </div>
        </Form>
      </Modal>

      <Modal title={`工作负载详情 - ${state.detailWorkload?.name}`} open={state.detailModalVisible}
        onCancel={() => setState(prev => ({ ...prev, detailModalVisible: false }))} footer={null} width={1200} destroyOnHidden>
        {state.detailWorkload && state.selectedClusterId && (
          <WorkloadDetail clusterId={state.selectedClusterId} namespace={state.detailWorkload.namespace} type={state.detailWorkload.type} name={state.detailWorkload.name} />
        )}
      </Modal>

      {state.selectedClusterId && state.podDetailPod && (
        <PodInfoModal visible={state.podDetailModalVisible} clusterId={state.selectedClusterId} namespace={state.podDetailPod.namespace} podName={state.podDetailPod.name}
          onClose={() => setState(prev => ({ ...prev, podDetailModalVisible: false, podDetailPod: undefined }))} />
      )}
      {state.selectedClusterId && state.podLogPod && (
        <PodLogModal visible={state.podLogModalVisible} clusterId={state.selectedClusterId} namespace={state.podLogPod.namespace} podName={state.podLogPod.name} containers={state.podLogPod.containers || []}
          onClose={() => setState(prev => ({ ...prev, podLogModalVisible: false, podLogPod: undefined }))} />
      )}
      {state.selectedClusterId && state.podShellPod && (
        <PodShellModal visible={state.podShellModalVisible} clusterId={state.selectedClusterId} namespace={state.podShellPod.namespace} podName={state.podShellPod.name} containers={state.podShellPod.containers || []}
          onClose={() => setState(prev => ({ ...prev, podShellModalVisible: false, podShellPod: undefined }))} />
      )}
      {state.selectedClusterId && state.selectedNamespace && (
        <CreateResourceModal visible={state.createResourceModalVisible} clusterId={state.selectedClusterId} namespace={state.selectedNamespace}
          onClose={() => setState(prev => ({ ...prev, createResourceModalVisible: false }))}
          onSuccess={() => { setState(prev => ({ ...prev, createResourceModalVisible: false })); loadWorkloads() }} />
      )}
      {state.selectedClusterId && state.editWorkload && (
        <EditWorkloadModal visible={state.editWorkloadModalVisible} clusterId={state.selectedClusterId} namespace={state.editWorkload.namespace} workloadType={state.editWorkload.type} workloadName={state.editWorkload.name}
          onClose={() => setState(prev => ({ ...prev, editWorkloadModalVisible: false, editWorkload: undefined }))}
          onSuccess={() => { setState(prev => ({ ...prev, editWorkloadModalVisible: false, editWorkload: undefined })); loadWorkloads() }} />
      )}
    </K8sPageLayout>
  )
}

export default WorkloadList
