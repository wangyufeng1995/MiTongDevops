import React, { useState } from 'react'
import { Plus, Wifi, Globe, Zap, Clock, Activity } from 'lucide-react'
import { ProbeList } from './ProbeList'
import { ProbeForm } from './ProbeForm'
import { ProbeResults } from './ProbeResults'
import { networkProbeService } from '../../../services/network'
import { NetworkProbe, CreateNetworkProbeRequest, UpdateNetworkProbeRequest } from '../../../types/network'
import { useTheme } from '../../../hooks/useTheme'
import { useNotification } from '../../../hooks/useNotification'
import { ProbeAnalysisHeader } from '../../../components/Network'

type ViewMode = 'list' | 'create' | 'edit' | 'results'

// 统计卡片组件
const StatCard: React.FC<{
  title: string
  value: string | number
  icon: React.ElementType
  gradient: string
  isDark: boolean
}> = ({ title, value, icon: Icon, gradient, isDark }) => (
  <div className={`relative overflow-hidden rounded-2xl p-5 ${isDark ? 'bg-slate-800/60 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-lg shadow-gray-200/50'}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{title}</p>
        <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      </div>
      <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
    <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-10 bg-gradient-to-br ${gradient}`}></div>
  </div>
)

export const NetworkProbesPage: React.FC = () => {
  const { isDark } = useTheme()
  const notification = useNotification()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedProbe, setSelectedProbe] = useState<NetworkProbe | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [stats, setStats] = useState({ total: 0, enabled: 0, healthy: 0, avgResponseTime: 0 })
  
  // 新增：分析头部状态
  const [timeRange, setTimeRange] = useState('7d')
  const [analysisViewMode, setAnalysisViewMode] = useState('overview')
  const [autoRefresh, setAutoRefresh] = useState(false)

  const handleCreate = () => { setSelectedProbe(null); setViewMode('create') }
  const handleEdit = (probe: NetworkProbe) => { setSelectedProbe(probe); setViewMode('edit') }
  const handleViewResults = (probe: NetworkProbe) => { setSelectedProbe(probe); setViewMode('results') }
  const handleCancel = () => { setSelectedProbe(null); setViewMode('list') }

  const handleSubmit = async (data: CreateNetworkProbeRequest | UpdateNetworkProbeRequest) => {
    try {
      const response = viewMode === 'edit' && selectedProbe
        ? await networkProbeService.update(selectedProbe.id, data as UpdateNetworkProbeRequest)
        : await networkProbeService.create(data as CreateNetworkProbeRequest)
      if (response.success) {
        notification.success(viewMode === 'edit' ? '探测更新成功' : '探测创建成功')
        setViewMode('list'); setSelectedProbe(null); setRefreshTrigger(prev => prev + 1)
      } else { throw new Error(response.message || '保存探测失败') }
    } catch (err: any) { throw err }
  }

  const handleDelete = async (probe: NetworkProbe) => {
    const confirmed = await notification.confirm(
      '确认删除',
      `确定要删除探测 "${probe.name}" 吗？此操作无法撤销。`,
      true
    )
    if (!confirmed) return
    
    setActionLoading(probe.id)
    try {
      const response = await networkProbeService.delete(probe.id)
      if (response.success) { 
        notification.success('探测删除成功')
        setRefreshTrigger(prev => prev + 1) 
      } else { 
        throw new Error(response.message || '删除探测失败') 
      }
    } catch (err: any) { 
      notification.error(err.message || '删除探测失败') 
    } finally { 
      setActionLoading(null) 
    }
  }

  const handleStart = async (probe: NetworkProbe) => {
    setActionLoading(probe.id)
    try {
      const response = await networkProbeService.start(probe.id)
      if (response.success) { 
        notification.success('自动探测已启动')
        setRefreshTrigger(prev => prev + 1) 
      } else { 
        throw new Error(response.message || '启动自动探测失败') 
      }
    } catch (err: any) { 
      notification.error(err.message || '启动自动探测失败') 
    } finally { 
      setActionLoading(null) 
    }
  }

  const handleStop = async (probe: NetworkProbe) => {
    setActionLoading(probe.id)
    try {
      const response = await networkProbeService.stop(probe.id)
      if (response.success) { 
        notification.success('自动探测已停止')
        setRefreshTrigger(prev => prev + 1) 
      } else { 
        throw new Error(response.message || '停止自动探测失败') 
      }
    } catch (err: any) { 
      notification.error(err.message || '停止自动探测失败') 
    } finally { 
      setActionLoading(null) 
    }
  }

  const handleProbe = async (probe: NetworkProbe) => {
    setActionLoading(probe.id)
    try {
      const response = await networkProbeService.probe(probe.id)
      if (response.success) {
        const msg = response.data ? `状态: ${response.data.status}, 响应时间: ${response.data.response_time}ms` : '手动探测执行成功'
        notification.success(msg)
        setRefreshTrigger(prev => prev + 1)
      } else { 
        throw new Error(response.message || '执行手动探测失败') 
      }
    } catch (err: any) { 
      notification.error(err.message || '执行手动探测失败') 
    } finally { 
      setActionLoading(null) 
    }
  }

  const handleStatsUpdate = (newStats: typeof stats) => {
    setStats(newStats)
  }

  const getTitle = () => {
    switch (viewMode) {
      case 'list': return '探测管理'
      case 'create': return '创建探测'
      case 'edit': return '编辑探测'
      case 'results': return '探测结果'
    }
  }

  const getSubtitle = () => {
    switch (viewMode) {
      case 'list': return '监控 HTTP、HTTPS、WebSocket、TCP 和 UDP 网络服务'
      case 'create': return '配置新的网络探测任务'
      case 'edit': return '修改探测配置和参数'
      case 'results': return `查看 "${selectedProbe?.name}" 的探测历史记录`
    }
  }

  return (
    <div className={`h-full flex flex-col overflow-hidden ${isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50'}`}>
      {/* 分析头部 */}
      {viewMode === 'list' ? (
        <ProbeAnalysisHeader
          title="网络探测分析"
          subtitle="深度分析网络探测性能和可靠性指标"
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          viewMode={analysisViewMode}
          onViewModeChange={setAnalysisViewMode}
          autoRefresh={autoRefresh}
          onAutoRefreshChange={setAutoRefresh}
          onFilter={() => notification.info('筛选功能开发中')}
          onExport={() => notification.info('导出功能开发中')}
          onRefresh={() => setRefreshTrigger(prev => prev + 1)}
          loading={actionLoading !== null}
        />
      ) : (
        /* 编辑/创建/结果页头部 */
        <div className={`flex-shrink-0 px-6 py-5 backdrop-blur-xl border-b ${isDark ? 'bg-slate-900/80 border-slate-700/50' : 'bg-white/80 border-gray-200/50'} shadow-sm`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl blur-lg opacity-30"></div>
                <div className="relative p-3 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-500 shadow-lg">
                  <Wifi className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'bg-gradient-to-r from-gray-900 via-blue-800 to-cyan-900 bg-clip-text text-transparent'}`}>
                  {getTitle()}
                </h1>
                <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  {getSubtitle()}
                </p>
              </div>
            </div>
            <button 
              onClick={handleCancel}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              返回列表
            </button>
          </div>
        </div>
      )}

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        {viewMode === 'list' ? (
          <div className="space-y-6">
            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard 
                title="探测总数" 
                value={stats.total} 
                icon={Globe} 
                gradient="from-blue-500 to-cyan-500" 
                isDark={isDark} 
              />
              <StatCard 
                title="已启用" 
                value={stats.enabled} 
                icon={Zap} 
                gradient="from-emerald-500 to-teal-500" 
                isDark={isDark} 
              />
              <StatCard 
                title="健康探测" 
                value={stats.healthy} 
                icon={Activity} 
                gradient="from-green-500 to-emerald-500" 
                isDark={isDark} 
              />
              <StatCard 
                title="平均响应" 
                value={`${stats.avgResponseTime}ms`} 
                icon={Clock} 
                gradient="from-amber-500 to-orange-500" 
                isDark={isDark} 
              />
            </div>

            {/* 操作栏：创建探测按钮 */}
            <div className="flex justify-end">
              <button 
                onClick={handleCreate}
                className="group relative flex items-center space-x-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium overflow-hidden transition-all shadow-lg hover:shadow-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <Plus className="relative w-4 h-4" />
                <span className="relative">创建探测</span>
              </button>
            </div>

            {/* 探测列表 */}
            <ProbeList 
              onEdit={handleEdit} 
              onDelete={handleDelete} 
              onStart={handleStart} 
              onStop={handleStop} 
              onProbe={handleProbe} 
              onViewResults={handleViewResults} 
              refreshTrigger={refreshTrigger}
              onStatsUpdate={handleStatsUpdate}
            />
          </div>
        ) : viewMode === 'results' && selectedProbe ? (
          <ProbeResults probe={selectedProbe} onBack={handleCancel} />
        ) : (
          <div className={`rounded-2xl p-6 ${isDark ? 'bg-slate-800/60 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-lg shadow-gray-200/50'}`}>
            <ProbeForm probe={selectedProbe} onSubmit={handleSubmit} onCancel={handleCancel} />
          </div>
        )}
      </div>

      {/* 加载遮罩 */}
      {actionLoading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`px-6 py-4 rounded-2xl flex items-center space-x-3 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white shadow-xl'}`}>
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>正在处理...</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default NetworkProbesPage
