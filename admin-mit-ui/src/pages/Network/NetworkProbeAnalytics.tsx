/**
 * Network Probe Analytics - 美化版
 * 网络探测分析页面
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Activity, AlertTriangle, BarChart3, Calendar, Clock, Download, Filter, Globe, LineChart, PieChart,
  RefreshCw, Target, TrendingDown, TrendingUp, Zap, Settings, Award, AlertCircle, CheckCircle
} from 'lucide-react'
import { networkProbeService } from '../../services/network'
import { NetworkProbe, NetworkProbeResult } from '../../types/network'
import { useTheme } from '../../hooks/useTheme'
import { NetworkPageLayout, StatCard, ContentCard, LoadingState, EmptyState } from '../../components/Network/NetworkPageLayout'

interface AnalyticsData {
  probe: NetworkProbe
  metrics: { total_requests: number; success_rate: number; avg_response_time: number; p95_response_time: number; p99_response_time: number; uptime_percentage: number; mttr: number; mtbf: number }
  trends: { success_rate_trend: 'up' | 'down' | 'stable'; response_time_trend: 'up' | 'down' | 'stable'; availability_trend: 'up' | 'down' | 'stable' }
  anomalies: Array<{ type: 'spike' | 'drop' | 'outage'; timestamp: string; description: string; severity: 'low' | 'medium' | 'high' }>
  sla_status: { availability_target: number; availability_actual: number; response_time_target: number; response_time_actual: number; is_meeting_sla: boolean }
}

interface ComparisonData {
  probe_a: NetworkProbe; probe_b: NetworkProbe
  comparison: { success_rate_diff: number; response_time_diff: number; uptime_diff: number; reliability_score_diff: number }
}

const timeRangeConfig = { '1d': { days: 1, label: '1天', interval: 60 }, '7d': { days: 7, label: '7天', interval: 360 }, '30d': { days: 30, label: '30天', interval: 1440 }, '90d': { days: 90, label: '90天', interval: 4320 } }

export const NetworkProbeAnalytics: React.FC = () => {
  const { isDark } = useTheme()
  const [probes, setProbes] = useState<NetworkProbe[]>([])
  const [selectedProbes, setSelectedProbes] = useState<number[]>([])
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([])
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([])
  const [timeRange, setTimeRange] = useState<'1d' | '7d' | '30d' | '90d'>('7d')
  const [analysisType, setAnalysisType] = useState<'overview' | 'trends' | 'anomalies' | 'sla' | 'comparison'>('overview')
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(300)
  const [filters, setFilters] = useState({ protocol: '', min_success_rate: 0, max_response_time: 0, sla_status: '' })
  const [showFilters, setShowFilters] = useState(false)
  const mountedRef = useRef(true)

  const loadData = useCallback(async () => {
    if (!mountedRef.current) return
    try {
      setLoading(true)
      const probesResponse = await networkProbeService.getAll()
      if (!probesResponse.success || !probesResponse.data) throw new Error('加载探测列表失败')
      const allProbes = probesResponse.data; setProbes(allProbes)
      let targetProbes = selectedProbes.length > 0 ? allProbes.filter(p => selectedProbes.includes(p.id)) : allProbes.slice(0, 5)
      if (filters.protocol) targetProbes = targetProbes.filter(p => p.protocol === filters.protocol)

      const analyticsPromises = targetProbes.map(async (probe) => {
        try {
          const config = timeRangeConfig[timeRange]
          const [statsResponse, historyResponse, resultsResponse] = await Promise.all([
            networkProbeService.getStatistics(probe.id, config.days),
            networkProbeService.getHistory(probe.id, config.days * 24, config.interval),
            networkProbeService.getResults(probe.id, { limit: 100 })
          ])
          const stats = statsResponse.success && statsResponse.data ? statsResponse.data : { total_probes: 0, success_rate: 0, average_response_time: 0, status_distribution: { success: 0, failed: 0, timeout: 0 } }
          const history = historyResponse.success && historyResponse.data?.history ? historyResponse.data.history : []
          const results = resultsResponse.success && resultsResponse.data?.results ? resultsResponse.data.results : []
          const successfulResults = results.filter(r => r.status === 'success' && r.response_time)
          const responseTimes = successfulResults.map(r => r.response_time!).sort((a, b) => a - b)
          const p95_response_time = responseTimes.length > 0 ? responseTimes[Math.floor(responseTimes.length * 0.95)] : 0
          const p99_response_time = responseTimes.length > 0 ? responseTimes[Math.floor(responseTimes.length * 0.99)] : 0
          const totalRequests = stats.total_probes; const successRequests = stats.status_distribution.success
          const uptime_percentage = totalRequests > 0 ? (successRequests / totalRequests) * 100 : 0
          const failures = results.filter(r => r.status !== 'success')
          const mttr = failures.length > 0 ? 30 : 0; const mtbf = failures.length > 0 ? (config.days * 24 * 60) / failures.length : config.days * 24 * 60
          const recentHistory = history.slice(-24); const earlierHistory = history.slice(-48, -24)
          const recentAvgSuccess = recentHistory.length > 0 ? recentHistory.reduce((sum, h) => sum + (h.success_count / (h.success_count + h.failed_count + h.timeout_count) * 100 || 0), 0) / recentHistory.length : 0
          const earlierAvgSuccess = earlierHistory.length > 0 ? earlierHistory.reduce((sum, h) => sum + (h.success_count / (h.success_count + h.failed_count + h.timeout_count) * 100 || 0), 0) / earlierHistory.length : 0
          const recentAvgResponseTime = recentHistory.length > 0 ? recentHistory.reduce((sum, h) => sum + (h.average_response_time || 0), 0) / recentHistory.length : 0
          const earlierAvgResponseTime = earlierHistory.length > 0 ? earlierHistory.reduce((sum, h) => sum + (h.average_response_time || 0), 0) / earlierHistory.length : 0
          const success_rate_trend: 'up' | 'down' | 'stable' = Math.abs(recentAvgSuccess - earlierAvgSuccess) < 1 ? 'stable' : recentAvgSuccess > earlierAvgSuccess ? 'up' : 'down'
          const response_time_trend: 'up' | 'down' | 'stable' = Math.abs(recentAvgResponseTime - earlierAvgResponseTime) < 10 ? 'stable' : recentAvgResponseTime < earlierAvgResponseTime ? 'up' : 'down'
          const anomalies: AnalyticsData['anomalies'] = []
          if (stats.average_response_time > 1000) anomalies.push({ type: 'spike', timestamp: new Date().toISOString(), description: `响应时间异常高: ${stats.average_response_time.toFixed(0)}ms`, severity: 'high' })
          if (stats.success_rate < 95) anomalies.push({ type: 'drop', timestamp: new Date().toISOString(), description: `成功率低于预期: ${stats.success_rate.toFixed(1)}%`, severity: stats.success_rate < 90 ? 'high' : 'medium' })
          return { probe, metrics: { total_requests: stats.total_probes, success_rate: stats.success_rate, avg_response_time: stats.average_response_time, p95_response_time, p99_response_time, uptime_percentage, mttr, mtbf }, trends: { success_rate_trend, response_time_trend, availability_trend: success_rate_trend }, anomalies, sla_status: { availability_target: 99.9, availability_actual: uptime_percentage, response_time_target: 500, response_time_actual: stats.average_response_time, is_meeting_sla: uptime_percentage >= 99.9 && stats.average_response_time <= 500 } }
        } catch { return { probe, metrics: { total_requests: 0, success_rate: 0, avg_response_time: 0, p95_response_time: 0, p99_response_time: 0, uptime_percentage: 0, mttr: 0, mtbf: 0 }, trends: { success_rate_trend: 'stable' as const, response_time_trend: 'stable' as const, availability_trend: 'stable' as const }, anomalies: [], sla_status: { availability_target: 99.9, availability_actual: 0, response_time_target: 500, response_time_actual: 0, is_meeting_sla: false } } }
      })
      let analytics = await Promise.all(analyticsPromises)
      if (filters.min_success_rate > 0) analytics = analytics.filter(a => a.metrics.success_rate >= filters.min_success_rate)
      if (filters.max_response_time > 0) analytics = analytics.filter(a => a.metrics.avg_response_time <= filters.max_response_time)
      if (filters.sla_status) analytics = analytics.filter(a => a.sla_status.is_meeting_sla === (filters.sla_status === 'meeting'))
      if (mountedRef.current) setAnalyticsData(analytics)
    } catch (error) { console.error('加载分析数据失败:', error) }
    finally { if (mountedRef.current) setLoading(false) }
  }, [timeRange, selectedProbes, filters])

  useEffect(() => { mountedRef.current = true; loadData(); return () => { mountedRef.current = false } }, [loadData])
  useEffect(() => { if (!autoRefresh) return; const interval = setInterval(() => loadData(), refreshInterval * 1000); return () => clearInterval(interval) }, [autoRefresh, refreshInterval, loadData])

  const generateComparisons = useCallback(() => {
    if (analyticsData.length < 2) return []
    const comparisons: ComparisonData[] = []
    for (let i = 0; i < analyticsData.length - 1; i++) {
      for (let j = i + 1; j < analyticsData.length; j++) {
        const a = analyticsData[i]; const b = analyticsData[j]
        comparisons.push({ probe_a: a.probe, probe_b: b.probe, comparison: { success_rate_diff: a.metrics.success_rate - b.metrics.success_rate, response_time_diff: a.metrics.avg_response_time - b.metrics.avg_response_time, uptime_diff: a.metrics.uptime_percentage - b.metrics.uptime_percentage, reliability_score_diff: (a.metrics.success_rate * 0.6 + (1000 / Math.max(a.metrics.avg_response_time, 1)) * 0.4) - (b.metrics.success_rate * 0.6 + (1000 / Math.max(b.metrics.avg_response_time, 1)) * 0.4) } })
      }
    }
    return comparisons.slice(0, 5)
  }, [analyticsData])

  useEffect(() => { setComparisonData(generateComparisons()) }, [generateComparisons])

  const exportReport = () => {
    const reportData = { generated_at: new Date().toISOString(), time_range: timeRange, analysis_type: analysisType, summary: { total_probes: analyticsData.length, avg_success_rate: analyticsData.reduce((sum, a) => sum + a.metrics.success_rate, 0) / analyticsData.length, avg_response_time: analyticsData.reduce((sum, a) => sum + a.metrics.avg_response_time, 0) / analyticsData.length, sla_compliance_rate: analyticsData.filter(a => a.sla_status.is_meeting_sla).length / analyticsData.length * 100 }, analytics_data: analyticsData, comparison_data: comparisonData }
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url
    a.download = `network-probe-analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const getTrendIcon = (trend: 'up' | 'down' | 'stable', isGoodWhenUp: boolean = true) => {
    const isGood = (trend === 'up' && isGoodWhenUp) || (trend === 'down' && !isGoodWhenUp) || trend === 'stable'
    if (trend === 'up') return <TrendingUp className={`w-4 h-4 ${isGood ? 'text-emerald-500' : 'text-red-500'}`} />
    if (trend === 'down') return <TrendingDown className={`w-4 h-4 ${isGood ? 'text-emerald-500' : 'text-red-500'}`} />
    return <Activity className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-gray-500'}`} />
  }

  if (loading && analyticsData.length === 0) {
    return <LoadingState message="正在加载分析数据..." submessage="计算性能指标中" icon={LineChart} />
  }

  const headerActions = (
    <>
      {/* 分析类型 */}
      <div className={`flex items-center space-x-2 rounded-2xl px-3 py-2 ${isDark ? 'bg-slate-800/80 border border-slate-700/50' : 'bg-white border border-gray-200 shadow-sm'}`}>
        <select value={analysisType} onChange={(e) => setAnalysisType(e.target.value as any)}
          className={`text-sm font-medium border-0 bg-transparent focus:ring-0 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
          <option value="overview">概览</option><option value="trends">趋势分析</option><option value="anomalies">异常检测</option><option value="sla">SLA 监控</option><option value="comparison">对比分析</option>
        </select>
      </div>
      {/* 时间范围 */}
      <div className={`flex items-center space-x-2 rounded-2xl px-3 py-2 ${isDark ? 'bg-slate-800/80 border border-slate-700/50' : 'bg-white border border-gray-200 shadow-sm'}`}>
        <Calendar className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
        <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as any)}
          className={`text-sm font-medium border-0 bg-transparent focus:ring-0 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
          {Object.entries(timeRangeConfig).map(([key, config]) => (<option key={key} value={key}>{config.label}</option>))}
        </select>
      </div>
      {/* 筛选器 */}
      <button onClick={() => setShowFilters(!showFilters)}
        className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl transition-all ${showFilters ? isDark ? 'bg-blue-500/20 border border-blue-500/50 text-blue-300' : 'bg-blue-50 border border-blue-300 text-blue-700' : isDark ? 'bg-slate-800/80 border border-slate-700/50 text-gray-300' : 'bg-white border border-gray-200 text-gray-600 shadow-sm'}`}>
        <Filter className="w-4 h-4" /><span className="text-sm font-medium">筛选</span>
      </button>
      {/* 自动刷新 */}
      <div className={`flex items-center space-x-3 rounded-2xl px-4 py-2.5 ${isDark ? 'bg-slate-800/80 border border-slate-700/50' : 'bg-white border border-gray-200 shadow-sm'}`}>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="sr-only peer" />
          <div className={`w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-sm peer-checked:bg-gradient-to-r peer-checked:from-blue-500 peer-checked:to-cyan-500 ${isDark ? 'bg-slate-600' : 'bg-gray-300'}`}></div>
        </label>
        <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>自动刷新</span>
      </div>
      {/* 导出 */}
      <button onClick={exportReport} className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl transition-all ${isDark ? 'bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700 text-gray-300' : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 shadow-sm'}`}>
        <Download className="w-4 h-4" /><span className="text-sm font-medium">导出报告</span>
      </button>
    </>
  )

  return (
    <NetworkPageLayout title="网络探测分析" subtitle="深度分析网络探测性能和可靠性指标" icon={LineChart}
      iconGradient="from-indigo-500 via-purple-600 to-pink-500" headerActions={headerActions}
      loading={loading} onRefresh={loadData} showFullscreen={false}>
      <div className="space-y-6">
        {/* 筛选面板 */}
        {showFilters && (
          <div className={`rounded-2xl p-5 ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-lg'}`}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>协议</label>
                <select value={filters.protocol} onChange={(e) => setFilters(prev => ({ ...prev, protocol: e.target.value }))}
                  className={`w-full px-3 py-2.5 rounded-xl text-sm ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'}`}>
                  <option value="">全部协议</option><option value="http">HTTP</option><option value="https">HTTPS</option><option value="websocket">WebSocket</option><option value="tcp">TCP</option><option value="udp">UDP</option>
                </select>
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>最低成功率 (%)</label>
                <input type="number" min="0" max="100" value={filters.min_success_rate} onChange={(e) => setFilters(prev => ({ ...prev, min_success_rate: Number(e.target.value) }))}
                  className={`w-full px-3 py-2.5 rounded-xl text-sm ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'}`} placeholder="0" />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>最大响应时间 (ms)</label>
                <input type="number" min="0" value={filters.max_response_time} onChange={(e) => setFilters(prev => ({ ...prev, max_response_time: Number(e.target.value) }))}
                  className={`w-full px-3 py-2.5 rounded-xl text-sm ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'}`} placeholder="0" />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>SLA 状态</label>
                <select value={filters.sla_status} onChange={(e) => setFilters(prev => ({ ...prev, sla_status: e.target.value }))}
                  className={`w-full px-3 py-2.5 rounded-xl text-sm ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'}`}>
                  <option value="">全部</option><option value="meeting">达标</option><option value="not_meeting">未达标</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setFilters({ protocol: '', min_success_rate: 0, max_response_time: 0, sla_status: '' })}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>清除筛选</button>
            </div>
          </div>
        )}

        {/* 统计卡片 */}
        {analyticsData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <StatCard title="分析探测数" value={analyticsData.length} icon={Target} glowColor="bg-blue-500" />
            <StatCard title="平均成功率" value={`${(analyticsData.reduce((sum, a) => sum + a.metrics.success_rate, 0) / analyticsData.length).toFixed(1)}%`}
              icon={CheckCircle} valueColorClass="text-emerald-500" iconBgClass={isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'} glowColor="bg-emerald-500" />
            <StatCard title="平均响应时间" value={`${Math.round(analyticsData.reduce((sum, a) => sum + a.metrics.avg_response_time, 0) / analyticsData.length)}ms`}
              icon={Zap} iconBgClass={isDark ? 'bg-cyan-500/10' : 'bg-cyan-50'} glowColor="bg-cyan-500" />
            <StatCard title="SLA 合规率" value={`${(analyticsData.filter(a => a.sla_status.is_meeting_sla).length / analyticsData.length * 100).toFixed(1)}%`}
              icon={Award} valueColorClass="text-purple-500" iconBgClass={isDark ? 'bg-purple-500/10' : 'bg-purple-50'} glowColor="bg-purple-500" />
          </div>
        )}

        {/* 概览视图 */}
        {analysisType === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 性能概览 */}
            <ContentCard title="性能概览" icon={BarChart3}>
              <div className="space-y-3">
                {analyticsData.slice(0, 5).map((data) => (
                  <div key={data.probe.id} className={`flex items-center justify-between p-4 rounded-xl transition-all hover:scale-[1.01] ${isDark ? 'bg-slate-700/30 hover:bg-slate-700/50' : 'bg-gray-50 hover:bg-gray-100'}`}>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{data.probe.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-lg ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>{data.probe.protocol.toUpperCase()}</span>
                      </div>
                      <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>成功率: {data.metrics.success_rate.toFixed(1)}% | 响应时间: {data.metrics.avg_response_time.toFixed(0)}ms</div>
                    </div>
                    <div className="flex items-center space-x-2">{getTrendIcon(data.trends.success_rate_trend, true)}{getTrendIcon(data.trends.response_time_trend, false)}</div>
                  </div>
                ))}
              </div>
            </ContentCard>

            {/* 异常汇总 */}
            <ContentCard title="异常汇总" icon={AlertTriangle}>
              <div className="space-y-3">
                {analyticsData.flatMap(data => data.anomalies.map(anomaly => ({ ...anomaly, probe_name: data.probe.name }))).slice(0, 5).map((anomaly, index) => (
                  <div key={index} className={`p-4 rounded-xl border-l-4 ${anomaly.severity === 'high' ? isDark ? 'bg-red-500/10 border-red-500' : 'bg-red-50 border-red-400' : anomaly.severity === 'medium' ? isDark ? 'bg-amber-500/10 border-amber-500' : 'bg-amber-50 border-amber-400' : isDark ? 'bg-blue-500/10 border-blue-500' : 'bg-blue-50 border-blue-400'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{anomaly.probe_name}</div>
                        <div className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>{anomaly.description}</div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-lg font-medium ${anomaly.severity === 'high' ? isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700' : anomaly.severity === 'medium' ? isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700' : isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>{anomaly.severity}</span>
                    </div>
                  </div>
                ))}
                {analyticsData.every(data => data.anomalies.length === 0) && (
                  <div className="text-center py-8">
                    <CheckCircle className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                    <p className={isDark ? 'text-slate-400' : 'text-gray-500'}>未检测到异常</p>
                  </div>
                )}
              </div>
            </ContentCard>
          </div>
        )}

        {/* SLA 监控视图 */}
        {analysisType === 'sla' && (
          <ContentCard title="SLA 监控" icon={Award}>
            {analyticsData.length === 0 ? (
              <EmptyState icon={Award} title="暂无 SLA 数据" description="请创建探测任务并等待数据收集" />
            ) : (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full">
                  <thead>
                    <tr className={isDark ? 'border-b border-slate-700' : 'border-b border-gray-200'}>
                      <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>探测任务</th>
                      <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>可用性目标</th>
                      <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>实际可用性</th>
                      <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>响应时间目标</th>
                      <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>实际响应时间</th>
                      <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>SLA 状态</th>
                    </tr>
                  </thead>
                  <tbody className={isDark ? 'divide-y divide-slate-700/50' : 'divide-y divide-gray-100'}>
                    {analyticsData.map((data) => (
                      <tr key={data.probe.id} className={`transition-colors ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'}`}>
                        <td className="px-5 py-4">
                          <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{data.probe.name}</div>
                          <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{data.probe.protocol.toUpperCase()}</div>
                        </td>
                        <td className={`px-5 py-4 text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{data.sla_status.availability_target}%</td>
                        <td className="px-5 py-4">
                          <span className={`text-sm font-semibold ${data.sla_status.availability_actual >= data.sla_status.availability_target ? 'text-emerald-500' : 'text-red-500'}`}>{data.sla_status.availability_actual.toFixed(2)}%</span>
                        </td>
                        <td className={`px-5 py-4 text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{data.sla_status.response_time_target}ms</td>
                        <td className="px-5 py-4">
                          <span className={`text-sm font-semibold ${data.sla_status.response_time_actual <= data.sla_status.response_time_target ? 'text-emerald-500' : 'text-red-500'}`}>{data.sla_status.response_time_actual.toFixed(0)}ms</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${data.sla_status.is_meeting_sla ? isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700' : isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'}`}>{data.sla_status.is_meeting_sla ? '达标' : '未达标'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ContentCard>
        )}

        {/* 对比分析视图 */}
        {analysisType === 'comparison' && comparisonData.length > 0 && (
          <ContentCard title="对比分析" icon={LineChart}>
            <div className="space-y-6">
              {comparisonData.map((comparison, index) => (
                <div key={index} className={`p-5 rounded-xl ${isDark ? 'bg-slate-700/30 border border-slate-600/50' : 'bg-gray-50 border border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center space-x-4">
                      <div className="text-sm">
                        <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{comparison.probe_a.name}</div>
                        <div className={isDark ? 'text-slate-400' : 'text-gray-500'}>{comparison.probe_a.protocol.toUpperCase()}</div>
                      </div>
                      <span className={isDark ? 'text-slate-500' : 'text-gray-400'}>vs</span>
                      <div className="text-sm">
                        <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{comparison.probe_b.name}</div>
                        <div className={isDark ? 'text-slate-400' : 'text-gray-500'}>{comparison.probe_b.protocol.toUpperCase()}</div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[
                      { label: '成功率差异', value: comparison.comparison.success_rate_diff, suffix: '%', goodWhenPositive: true },
                      { label: '响应时间差异', value: comparison.comparison.response_time_diff, suffix: 'ms', goodWhenPositive: false },
                      { label: '可用性差异', value: comparison.comparison.uptime_diff, suffix: '%', goodWhenPositive: true },
                      { label: '可靠性评分差异', value: comparison.comparison.reliability_score_diff, suffix: '', goodWhenPositive: true }
                    ].map((item, i) => (
                      <div key={i} className="text-center">
                        <div className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{item.label}</div>
                        <div className={`text-xl font-bold ${item.value > 0 ? (item.goodWhenPositive ? 'text-emerald-500' : 'text-red-500') : item.value < 0 ? (item.goodWhenPositive ? 'text-red-500' : 'text-emerald-500') : isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                          {item.value > 0 ? '+' : ''}{item.value.toFixed(item.suffix === 'ms' ? 0 : 1)}{item.suffix}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ContentCard>
        )}

        {/* 空状态 */}
        {analyticsData.length === 0 && !loading && (
          <ContentCard>
            <EmptyState icon={BarChart3} title="暂无分析数据" description="请创建探测任务并等待数据收集，或调整筛选条件" />
          </ContentCard>
        )}
      </div>
    </NetworkPageLayout>
  )
}

export default NetworkProbeAnalytics
