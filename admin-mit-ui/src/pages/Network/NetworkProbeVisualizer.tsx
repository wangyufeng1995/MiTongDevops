/**
 * Network Probe Visualizer - 美化版
 * 网络探测可视化页面
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Activity, AlertTriangle, BarChart3, Clock, Globe, PieChart, TrendingUp, Zap,
  RefreshCw, Calendar, Filter, Download, Maximize2, Minimize2, CheckCircle
} from 'lucide-react'
import { networkProbeService } from '../../services/network'
import { NetworkProbe, NetworkProbeResult } from '../../types/network'
import { useTheme } from '../../hooks/useTheme'
import { NetworkPageLayout, StatCard, ContentCard, LoadingState, EmptyState } from '../../components/Network/NetworkPageLayout'

interface ProbeMetrics {
  probe: NetworkProbe
  metrics: {
    total_requests: number
    success_count: number
    failed_count: number
    timeout_count: number
    success_rate: number
    avg_response_time: number
  }
  recent_results: NetworkProbeResult[]
}

const timeRangeConfig = {
  '1h': { hours: 1, interval: 5, label: '1小时' },
  '6h': { hours: 6, interval: 15, label: '6小时' },
  '24h': { hours: 24, interval: 60, label: '24小时' },
  '7d': { hours: 168, interval: 360, label: '7天' }
}

export const NetworkProbeVisualizer: React.FC = () => {
  const { isDark } = useTheme()
  const [probes, setProbes] = useState<NetworkProbe[]>([])
  const [probeMetrics, setProbeMetrics] = useState<ProbeMetrics[]>([])
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h')
  const [selectedProtocols, setSelectedProtocols] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(60)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const mountedRef = useRef(true)

  const loadData = useCallback(async () => {
    if (!mountedRef.current) return
    try {
      setLoading(true)
      const probesResponse = await networkProbeService.getAll()
      if (!probesResponse.success || !probesResponse.data) throw new Error('加载探测列表失败')

      const allProbes = probesResponse.data
      setProbes(allProbes)

      const filteredProbes = selectedProtocols.length > 0 
        ? allProbes.filter(probe => selectedProtocols.includes(probe.protocol))
        : allProbes

      const metricsPromises = filteredProbes.map(async (probe) => {
        try {
          const config = timeRangeConfig[timeRange]
          const [statsResponse, resultsResponse] = await Promise.all([
            networkProbeService.getStatistics(probe.id, Math.ceil(config.hours / 24)),
            networkProbeService.getResults(probe.id, { limit: 10 })
          ])

          const metrics = statsResponse.success && statsResponse.data 
            ? {
                total_requests: statsResponse.data.total_probes,
                success_count: statsResponse.data.status_distribution.success || 0,
                failed_count: statsResponse.data.status_distribution.failed || 0,
                timeout_count: statsResponse.data.status_distribution.timeout || 0,
                success_rate: statsResponse.data.success_rate,
                avg_response_time: statsResponse.data.average_response_time,
              }
            : { total_requests: 0, success_count: 0, failed_count: 0, timeout_count: 0, success_rate: 0, avg_response_time: 0 }

          return { probe, metrics, recent_results: resultsResponse.success && resultsResponse.data?.results ? resultsResponse.data.results : [] }
        } catch {
          return { probe, metrics: { total_requests: 0, success_count: 0, failed_count: 0, timeout_count: 0, success_rate: 0, avg_response_time: 0 }, recent_results: [] }
        }
      })

      const metrics = await Promise.all(metricsPromises)
      if (mountedRef.current) setProbeMetrics(metrics)
    } catch (error) {
      console.error('加载可视化数据失败:', error)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [timeRange, selectedProtocols])

  useEffect(() => { mountedRef.current = true; loadData(); return () => { mountedRef.current = false } }, [loadData])
  useEffect(() => { if (!autoRefresh) return; const interval = setInterval(() => loadData(), refreshInterval * 1000); return () => clearInterval(interval) }, [autoRefresh, refreshInterval, loadData])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setIsFullscreen(true) }
    else { document.exitFullscreen(); setIsFullscreen(false) }
  }

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const availableProtocols = Array.from(new Set(probes.map(p => p.protocol)))
  const totalStats = probeMetrics.reduce((acc, item) => ({
    total_requests: acc.total_requests + item.metrics.total_requests,
    success_count: acc.success_count + item.metrics.success_count,
    failed_count: acc.failed_count + item.metrics.failed_count,
    timeout_count: acc.timeout_count + item.metrics.timeout_count,
    total_probes: acc.total_probes + 1,
    active_probes: acc.active_probes + (item.probe.auto_probe_enabled ? 1 : 0)
  }), { total_requests: 0, success_count: 0, failed_count: 0, timeout_count: 0, total_probes: 0, active_probes: 0 })

  const overallSuccessRate = totalStats.total_requests > 0 ? (totalStats.success_count / totalStats.total_requests) * 100 : 0
  const protocolDistribution = probeMetrics.reduce((acc, item) => { const p = item.probe.protocol.toUpperCase(); acc[p] = (acc[p] || 0) + 1; return acc }, {} as Record<string, number>)
  const statusDistribution = { success: totalStats.success_count, failed: totalStats.failed_count, timeout: totalStats.timeout_count }
  const responseTimeRanges = probeMetrics.reduce((acc, item) => {
    const avgTime = item.metrics.avg_response_time
    if (avgTime === 0) return acc
    if (avgTime < 100) acc['< 100ms']++
    else if (avgTime < 500) acc['100-500ms']++
    else if (avgTime < 1000) acc['500ms-1s']++
    else if (avgTime < 3000) acc['1-3s']++
    else acc['> 3s']++
    return acc
  }, { '< 100ms': 0, '100-500ms': 0, '500ms-1s': 0, '1-3s': 0, '> 3s': 0 } as Record<string, number>)

  const handleExportData = () => {
    const exportData = { exported_at: new Date().toISOString(), time_range: timeRange, total_stats: totalStats, overall_success_rate: overallSuccessRate, protocol_distribution: protocolDistribution, status_distribution: statusDistribution, response_time_distribution: responseTimeRanges, probe_metrics: probeMetrics.map(item => ({ probe_id: item.probe.id, probe_name: item.probe.name, protocol: item.probe.protocol, target_url: item.probe.target_url, metrics: item.metrics })) }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `network-probe-metrics-${timeRange}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  if (loading && probeMetrics.length === 0) {
    return <LoadingState message="正在加载可视化数据..." submessage="获取探测指标中" icon={BarChart3} />
  }

  const headerActions = (
    <>
      {/* 时间范围 */}
      <div className={`flex items-center space-x-2 rounded-2xl px-3 py-2 ${isDark ? 'bg-slate-800/80 border border-slate-700/50' : 'bg-white border border-gray-200 shadow-sm'}`}>
        <Calendar className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
        <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as any)}
          className={`text-sm font-medium border-0 bg-transparent focus:ring-0 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
          {Object.entries(timeRangeConfig).map(([key, config]) => (<option key={key} value={key}>{config.label}</option>))}
        </select>
      </div>
      {/* 协议筛选 */}
      <div className={`flex items-center space-x-2 rounded-2xl px-3 py-2 ${isDark ? 'bg-slate-800/80 border border-slate-700/50' : 'bg-white border border-gray-200 shadow-sm'}`}>
        <Filter className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
        <select value={selectedProtocols[0] || ''} onChange={(e) => setSelectedProtocols(e.target.value ? [e.target.value] : [])}
          className={`text-sm font-medium border-0 bg-transparent focus:ring-0 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
          <option value="">全部协议</option>
          {availableProtocols.map(protocol => (<option key={protocol} value={protocol}>{protocol.toUpperCase()}</option>))}
        </select>
      </div>
      {/* 自动刷新 */}
      <div className={`flex items-center space-x-3 rounded-2xl px-4 py-2.5 ${isDark ? 'bg-slate-800/80 border border-slate-700/50' : 'bg-white border border-gray-200 shadow-sm'}`}>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="sr-only peer" />
          <div className={`w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-sm peer-checked:bg-gradient-to-r peer-checked:from-blue-500 peer-checked:to-cyan-500 ${isDark ? 'bg-slate-600' : 'bg-gray-300'}`}></div>
        </label>
        <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>自动刷新</span>
        {autoRefresh && (
          <select value={refreshInterval} onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className={`text-sm font-medium border-0 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>
            <option value={30}>30秒</option><option value={60}>60秒</option><option value={120}>2分钟</option>
          </select>
        )}
      </div>
      {/* 导出 */}
      <button onClick={handleExportData} className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl transition-all ${isDark ? 'bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700 text-gray-300' : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 shadow-sm'}`}>
        <Download className="w-4 h-4" /><span className="text-sm font-medium">导出</span>
      </button>
    </>
  )

  return (
    <NetworkPageLayout title="网络探测可视化" subtitle="实时监控和分析网络探测性能指标" icon={BarChart3}
      iconGradient="from-violet-500 via-purple-600 to-indigo-500" headerActions={headerActions}
      loading={loading} onRefresh={loadData} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen}>
      <div className="space-y-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
          <StatCard title="探测任务" value={totalStats.total_probes} subtitle={`${totalStats.active_probes} 活跃`} icon={Activity} glowColor="bg-blue-500" />
          <StatCard title="总请求数" value={(totalStats.total_requests || 0).toLocaleString()} subtitle={timeRangeConfig[timeRange].label} icon={BarChart3} iconBgClass={isDark ? 'bg-purple-500/10' : 'bg-purple-50'} glowColor="bg-purple-500" />
          <StatCard title="成功率" value={`${(overallSuccessRate || 0).toFixed(1)}%`} subtitle={`${totalStats.success_count} 成功`} icon={TrendingUp}
            valueColorClass={overallSuccessRate >= 95 ? 'text-emerald-500' : overallSuccessRate >= 80 ? 'text-amber-500' : 'text-red-500'}
            iconBgClass={overallSuccessRate >= 95 ? isDark ? 'bg-emerald-500/10' : 'bg-emerald-50' : overallSuccessRate >= 80 ? isDark ? 'bg-amber-500/10' : 'bg-amber-50' : isDark ? 'bg-red-500/10' : 'bg-red-50'}
            glowColor={overallSuccessRate >= 95 ? 'bg-emerald-500' : overallSuccessRate >= 80 ? 'bg-amber-500' : 'bg-red-500'} />
          <StatCard title="失败请求" value={totalStats.failed_count || 0} subtitle={`${totalStats.timeout_count || 0} 超时`} icon={AlertTriangle}
            valueColorClass="text-red-500" iconBgClass={isDark ? 'bg-red-500/10' : 'bg-red-50'} glowColor="bg-red-500" />
          <StatCard title="平均响应" value={`${probeMetrics.length > 0 ? Math.round(probeMetrics.reduce((sum, item) => sum + item.metrics.avg_response_time, 0) / probeMetrics.length) : 0}ms`}
            subtitle="所有探测" icon={Zap} iconBgClass={isDark ? 'bg-cyan-500/10' : 'bg-cyan-50'} glowColor="bg-cyan-500" />
        </div>

        {/* 图表区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 协议分布 */}
          <ContentCard title="协议分布" icon={PieChart}>
            <div className="space-y-3">
              {Object.entries(protocolDistribution).map(([protocol, count]) => {
                const percentage = (totalStats.total_probes || 0) > 0 ? (count / (totalStats.total_probes || 1)) * 100 : 0
                const colors: Record<string, string> = { 'HTTP': 'bg-blue-500', 'HTTPS': 'bg-emerald-500', 'WEBSOCKET': 'bg-purple-500', 'TCP': 'bg-amber-500', 'UDP': 'bg-red-500' }
                return (
                  <div key={protocol} className={`flex items-center justify-between p-3 rounded-xl transition-all hover:scale-[1.02] ${isDark ? 'bg-slate-700/30 hover:bg-slate-700/50' : 'bg-gray-50 hover:bg-gray-100'}`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded ${colors[protocol] || 'bg-gray-500'}`}></div>
                      <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{protocol}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{count}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-600 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>{(percentage || 0).toFixed(1)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </ContentCard>

          {/* 状态分布 */}
          <ContentCard title="状态分布" icon={BarChart3}>
            <div className="space-y-4">
              {Object.entries(statusDistribution).map(([status, count]) => {
                const percentage = (totalStats.total_requests || 0) > 0 ? (count / (totalStats.total_requests || 1)) * 100 : 0
                const colors: Record<string, string> = { 'success': 'from-emerald-400 to-emerald-500', 'failed': 'from-red-400 to-red-500', 'timeout': 'from-amber-400 to-amber-500' }
                const labels: Record<string, string> = { 'success': '成功', 'failed': '失败', 'timeout': '超时' }
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{labels[status]}</span>
                      <span className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{count} ({(percentage || 0).toFixed(1)}%)</span>
                    </div>
                    <div className={`w-full h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`}>
                      <div className={`h-full rounded-full bg-gradient-to-r ${colors[status]} transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ContentCard>
        </div>

        {/* 响应时间分布 */}
        <ContentCard title="响应时间分布" icon={Clock}>
          <div className="grid grid-cols-5 gap-4">
            {Object.entries(responseTimeRanges).map(([range, count]) => {
              const maxCount = Math.max(...Object.values(responseTimeRanges))
              const height = maxCount > 0 ? (count / maxCount) * 100 : 0
              return (
                <div key={range} className="text-center">
                  <div className="h-32 flex items-end justify-center mb-3">
                    <div className={`w-full max-w-16 rounded-t-lg bg-gradient-to-t from-blue-500 to-cyan-400 transition-all duration-500 hover:from-blue-600 hover:to-cyan-500`}
                      style={{ height: `${Math.max(height, 4)}%` }}></div>
                  </div>
                  <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{count}</div>
                  <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{range}</div>
                </div>
              )
            })}
          </div>
        </ContentCard>

        {/* 探测任务详情表格 */}
        <ContentCard title="探测任务详情" icon={Globe}>
          {probeMetrics.length === 0 ? (
            <EmptyState icon={BarChart3} title="暂无数据" description="请创建探测任务并等待数据收集" />
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full">
                <thead>
                  <tr className={isDark ? 'border-b border-slate-700' : 'border-b border-gray-200'}>
                    <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>探测任务</th>
                    <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>协议</th>
                    <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>总请求</th>
                    <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>成功率</th>
                    <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>平均响应</th>
                    <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>状态</th>
                  </tr>
                </thead>
                <tbody className={isDark ? 'divide-y divide-slate-700/50' : 'divide-y divide-gray-100'}>
                  {probeMetrics.map((item) => (
                    <tr key={item.probe.id} className={`transition-colors ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'}`}>
                      <td className="px-5 py-4">
                        <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.probe.name}</div>
                        <div className={`text-xs truncate max-w-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{item.probe.target_url}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                          {item.probe.protocol.toUpperCase()}
                        </span>
                      </td>
                      <td className={`px-5 py-4 text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{item.metrics.total_requests.toLocaleString()}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-semibold ${item.metrics.success_rate >= 95 ? 'text-emerald-500' : item.metrics.success_rate >= 80 ? 'text-amber-500' : 'text-red-500'}`}>
                            {(item.metrics.success_rate || 0).toFixed(1)}%
                          </span>
                          <div className={`w-16 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`}>
                            <div className={`h-full rounded-full ${item.metrics.success_rate >= 95 ? 'bg-emerald-500' : item.metrics.success_rate >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${item.metrics.success_rate}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className={`px-5 py-4 text-sm font-mono font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{(item.metrics.avg_response_time || 0).toFixed(0)}ms</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-2">
                          {item.probe.enabled ? (
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>启用</span>
                          ) : (
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${isDark ? 'bg-slate-600 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>禁用</span>
                          )}
                          {item.probe.auto_probe_enabled && (
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>自动</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ContentCard>
      </div>
    </NetworkPageLayout>
  )
}

export default NetworkProbeVisualizer
