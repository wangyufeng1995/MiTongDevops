/**
 * 网络探测仪表板页面 - 美化版
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Activity, AlertCircle, AlertTriangle, CheckCircle, Clock, 
  Maximize2, Minimize2, RefreshCw, TrendingUp, Zap, Globe, Wifi, ExternalLink,
  Signal, Server, BarChart3
} from 'lucide-react'
import { networkProbeService } from '../../../services/network'
import { NetworkProbe } from '../../../types/network'
import { formatDateTime } from '../../../utils'
import { useTheme } from '../../../hooks/useTheme'

interface ProbeWithResult extends NetworkProbe {
  lastResult?: {
    status: 'success' | 'failed' | 'timeout' | 'unknown'
    response_time?: number
    probed_at: string
    is_expired?: boolean
  }
}

interface DashboardStats {
  total_probes: number
  active_probes: number
  success_rate: number
  avg_response_time: number
  active_alerts: number
  probe_status_distribution: {
    success: number
    failed: number
    timeout: number
    unknown: number
  }
}

export const NetworkDashboard: React.FC = () => {
  const { isDark } = useTheme()
  const [probes, setProbes] = useState<ProbeWithResult[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const mountedRef = useRef(true)

  const calculateStats = useCallback((probesData: ProbeWithResult[]): DashboardStats => {
    const total = probesData.length
    const active = probesData.filter(p => p.enabled && p.auto_probe_enabled).length
    const probesWithResult = probesData.filter(p => p.lastResult)
    const successCount = probesWithResult.filter(p => p.lastResult?.status === 'success').length
    const failedCount = probesWithResult.filter(p => p.lastResult?.status === 'failed').length
    const timeoutCount = probesWithResult.filter(p => p.lastResult?.status === 'timeout').length
    const unknownCount = probesWithResult.filter(p => p.lastResult?.status === 'unknown').length
    const successRate = probesWithResult.length > 0 ? (successCount / probesWithResult.length) * 100 : 0
    const probesWithTime = probesData.filter(p => p.lastResult?.response_time)
    const avgResponseTime = probesWithTime.length > 0
      ? probesWithTime.reduce((sum, p) => sum + (p.lastResult?.response_time || 0), 0) / probesWithTime.length : 0
    return {
      total_probes: total, active_probes: active, success_rate: successRate,
      avg_response_time: avgResponseTime, active_alerts: failedCount + timeoutCount + unknownCount,
      probe_status_distribution: { success: successCount, failed: failedCount, timeout: timeoutCount, unknown: unknownCount }
    }
  }, [])

  const loadDashboardData = useCallback(async () => {
    if (!mountedRef.current) return
    try {
      setLoading(true)
      const probesResponse = await networkProbeService.getAll()
      if (probesResponse.success && probesResponse.data && mountedRef.current) {
        const probesWithResults = await Promise.all(
          probesResponse.data.map(async (probe) => {
            try {
              const resultsResponse = await networkProbeService.getResults(probe.id, { limit: 1 })
              const lastResult = resultsResponse.success && resultsResponse.data?.results?.[0]
                ? resultsResponse.data.results[0] : undefined
              return { ...probe, lastResult }
            } catch { return probe }
          })
        )
        setProbes(probesWithResults)
        setStats(calculateStats(probesWithResults))
      }
      if (mountedRef.current) setLastRefresh(new Date())
    } catch (error) {
      console.error('加载仪表板数据失败:', error)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [calculateStats])

  useEffect(() => { mountedRef.current = true; loadDashboardData(); return () => { mountedRef.current = false } }, [loadDashboardData])
  useEffect(() => { if (!autoRefresh) return; const interval = setInterval(() => loadDashboardData(), refreshInterval * 1000); return () => clearInterval(interval) }, [autoRefresh, refreshInterval, loadDashboardData])
  
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setIsFullscreen(true) }
    else { document.exitFullscreen(); setIsFullscreen(false) }
  }

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // 加载状态
  if (loading && !stats) {
    return (
      <div className={`h-full flex items-center justify-center ${isDark ? 'bg-[#0f172a]' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto">
            <div className={`absolute inset-0 rounded-full border-4 border-t-transparent animate-spin ${isDark ? 'border-blue-500' : 'border-blue-400'}`}></div>
            <div className={`absolute inset-2 rounded-full border-4 border-b-transparent animate-spin ${isDark ? 'border-cyan-500' : 'border-cyan-400'}`} style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            <Globe className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
          </div>
          <p className={`mt-6 text-lg font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>正在加载仪表板...</p>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>获取探测数据中</p>
        </div>
      </div>
    )
  }

  const activeProbes = probes.filter(p => p.enabled)
  const totalDistribution = (stats?.probe_status_distribution?.success || 0) + (stats?.probe_status_distribution?.failed || 0) + 
    (stats?.probe_status_distribution?.timeout || 0) + (stats?.probe_status_distribution?.unknown || 0)

  return (
    <div className={`h-full flex flex-col overflow-hidden ${isDark ? 'bg-[#0f172a]' : 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50'}`}>
      {/* 头部 */}
      <div className={`flex-shrink-0 px-6 py-4 backdrop-blur-xl border-b ${isDark ? 'bg-slate-900/80 border-slate-700/50' : 'bg-white/70 border-gray-200/80'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className={`absolute inset-0 rounded-2xl blur-xl opacity-50 ${isDark ? 'bg-blue-500' : 'bg-blue-400'}`}></div>
              <div className="relative p-3 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-500 shadow-xl">
                <Globe className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>网络探测仪表板</h1>
              <div className="flex items-center space-x-3 mt-1">
                <div className="flex items-center space-x-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    {autoRefresh && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${autoRefresh ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                  </span>
                  <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{autoRefresh ? '实时监控' : '已暂停'}</span>
                </div>
                <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>|</span>
                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>更新于 {formatDateTime(lastRefresh.toISOString(), 'HH:mm:ss')}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className={`flex items-center space-x-3 rounded-2xl px-4 py-2.5 ${isDark ? 'bg-slate-800/80 border border-slate-700/50' : 'bg-white border border-gray-200 shadow-sm'}`}>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="sr-only peer" />
                <div className={`w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-sm peer-checked:bg-gradient-to-r peer-checked:from-blue-500 peer-checked:to-cyan-500 ${isDark ? 'bg-slate-600' : 'bg-gray-300'}`}></div>
              </label>
              <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>自动刷新</span>
              {autoRefresh && (
                <select value={refreshInterval} onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className={`text-sm font-medium border-0 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>
                  <option value={10}>10秒</option>
                  <option value={30}>30秒</option>
                  <option value={60}>60秒</option>
                </select>
              )}
            </div>
            <button onClick={loadDashboardData} disabled={loading}
              className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-white text-sm font-medium overflow-hidden transition-all disabled:opacity-50">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <RefreshCw className={`relative w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
              <span className="relative">刷新</span>
            </button>
            <button onClick={toggleFullscreen} title={isFullscreen ? '退出全屏' : '进入全屏'}
              className={`p-2.5 rounded-xl transition-all ${isDark ? 'bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700 text-gray-300' : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 shadow-sm'}`}>
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 探测总数 */}
            <div className={`group relative rounded-2xl p-5 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
              isDark ? 'bg-gradient-to-br from-slate-800/90 to-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-lg shadow-gray-200/50'
            }`}>
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity ${isDark ? 'bg-blue-500' : 'bg-blue-400'}`}></div>
              <div className="relative flex items-start justify-between">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>探测总数</p>
                  <p className={`text-4xl font-bold mt-2 tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.total_probes || 0}</p>
                  <div className="flex items-center mt-3 space-x-1.5">
                    <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10">
                      <Signal className="w-3 h-3 text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-500">{stats.active_probes || 0} 活跃</span>
                    </div>
                  </div>
                </div>
                <div className={`p-3 rounded-xl ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                  <Server className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                </div>
              </div>
            </div>

            {/* 成功率 */}
            <div className={`group relative rounded-2xl p-5 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
              (stats.success_rate || 0) >= 95 
                ? isDark ? 'bg-gradient-to-br from-emerald-900/40 to-slate-800/50 border border-emerald-500/30' : 'bg-gradient-to-br from-emerald-50 to-white border border-emerald-100'
                : (stats.success_rate || 0) >= 80 
                  ? isDark ? 'bg-gradient-to-br from-amber-900/40 to-slate-800/50 border border-amber-500/30' : 'bg-gradient-to-br from-amber-50 to-white border border-amber-100'
                  : isDark ? 'bg-gradient-to-br from-red-900/40 to-slate-800/50 border border-red-500/30' : 'bg-gradient-to-br from-red-50 to-white border border-red-100'
            }`}>
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 ${
                (stats.success_rate || 0) >= 95 ? 'bg-emerald-500' : (stats.success_rate || 0) >= 80 ? 'bg-amber-500' : 'bg-red-500'
              }`}></div>
              <div className="relative flex items-start justify-between">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>成功率</p>
                  <p className={`text-4xl font-bold mt-2 tracking-tight ${
                    (stats.success_rate || 0) >= 95 ? 'text-emerald-500' : (stats.success_rate || 0) >= 80 ? 'text-amber-500' : 'text-red-500'
                  }`}>{(stats.success_rate || 0).toFixed(1)}%</p>
                  <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>最近 24 小时</p>
                </div>
                <div className={`p-3 rounded-xl ${
                  (stats.success_rate || 0) >= 95 ? isDark ? 'bg-emerald-500/10' : 'bg-emerald-100' :
                  (stats.success_rate || 0) >= 80 ? isDark ? 'bg-amber-500/10' : 'bg-amber-100' : isDark ? 'bg-red-500/10' : 'bg-red-100'
                }`}>
                  <TrendingUp className={`w-6 h-6 ${
                    (stats.success_rate || 0) >= 95 ? 'text-emerald-500' : (stats.success_rate || 0) >= 80 ? 'text-amber-500' : 'text-red-500'
                  }`} />
                </div>
              </div>
            </div>

            {/* 平均响应时间 */}
            <div className={`group relative rounded-2xl p-5 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
              isDark ? 'bg-gradient-to-br from-slate-800/90 to-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-lg shadow-gray-200/50'
            }`}>
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity ${isDark ? 'bg-violet-500' : 'bg-violet-400'}`}></div>
              <div className="relative flex items-start justify-between">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>平均响应</p>
                  <div className="flex items-baseline mt-2">
                    <p className={`text-4xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{(stats.avg_response_time || 0).toFixed(0)}</p>
                    <span className={`text-lg font-medium ml-1 ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>ms</span>
                  </div>
                  <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>所有探测任务</p>
                </div>
                <div className={`p-3 rounded-xl ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
                  <Zap className={`w-6 h-6 ${isDark ? 'text-violet-400' : 'text-violet-500'}`} />
                </div>
              </div>
            </div>

            {/* 活跃告警 */}
            <div className={`group relative rounded-2xl p-5 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
              (stats.active_alerts || 0) > 0 
                ? isDark ? 'bg-gradient-to-br from-red-900/40 to-slate-800/50 border border-red-500/30' : 'bg-gradient-to-br from-red-50 to-white border border-red-100'
                : isDark ? 'bg-gradient-to-br from-slate-800/90 to-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-lg shadow-gray-200/50'
            }`}>
              {(stats.active_alerts || 0) > 0 && <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-30 bg-red-500 animate-pulse"></div>}
              <div className="relative flex items-start justify-between">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>活跃告警</p>
                  <p className={`text-4xl font-bold mt-2 tracking-tight ${(stats.active_alerts || 0) > 0 ? 'text-red-500' : isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    {stats.active_alerts || 0}
                  </p>
                  <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>需要关注</p>
                </div>
                <div className={`p-3 rounded-xl ${(stats.active_alerts || 0) > 0 ? isDark ? 'bg-red-500/10' : 'bg-red-100' : isDark ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                  <AlertCircle className={`w-6 h-6 ${(stats.active_alerts || 0) > 0 ? 'text-red-500 animate-pulse' : isDark ? 'text-slate-500' : 'text-gray-400'}`} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 状态分布 - 带进度条 */}
        {stats && (
          <div className={`rounded-2xl p-6 ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-lg shadow-gray-200/50'}`}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-xl ${isDark ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20' : 'bg-gradient-to-br from-blue-50 to-cyan-50'}`}>
                  <BarChart3 className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                </div>
                <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>探测状态分布</h2>
              </div>
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>
                共 {totalDistribution} 次探测
              </span>
            </div>
            
            {/* 进度条 */}
            <div className="h-3 rounded-full overflow-hidden flex mb-6 bg-slate-200 dark:bg-slate-700">
              {totalDistribution > 0 && (
                <>
                  <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500" style={{ width: `${((stats.probe_status_distribution?.success || 0) / totalDistribution) * 100}%` }}></div>
                  <div className="bg-gradient-to-r from-red-400 to-red-500 transition-all duration-500" style={{ width: `${((stats.probe_status_distribution?.failed || 0) / totalDistribution) * 100}%` }}></div>
                  <div className="bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500" style={{ width: `${((stats.probe_status_distribution?.timeout || 0) / totalDistribution) * 100}%` }}></div>
                  <div className="bg-gradient-to-r from-slate-400 to-slate-500 transition-all duration-500" style={{ width: `${((stats.probe_status_distribution?.unknown || 0) / totalDistribution) * 100}%` }}></div>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { key: 'success', label: '成功', icon: CheckCircle, color: 'emerald', value: stats.probe_status_distribution?.success || 0 },
                { key: 'failed', label: '失败', icon: AlertCircle, color: 'red', value: stats.probe_status_distribution?.failed || 0 },
                { key: 'timeout', label: '超时', icon: Clock, color: 'amber', value: stats.probe_status_distribution?.timeout || 0 },
                { key: 'unknown', label: '未知', icon: AlertTriangle, color: 'slate', value: stats.probe_status_distribution?.unknown || 0 },
              ].map(item => (
                <div key={item.key} className={`flex items-center space-x-3 p-4 rounded-xl transition-all hover:scale-105 ${
                  isDark ? `bg-${item.color}-500/10 border border-${item.color}-500/20` : `bg-${item.color}-50 border border-${item.color}-100`
                }`} style={{ backgroundColor: isDark ? `rgb(var(--${item.color}-500) / 0.1)` : undefined }}>
                  <div className={`p-2.5 rounded-lg bg-${item.color}-500/20`}>
                    <item.icon className={`w-5 h-5 text-${item.color}-500`} />
                  </div>
                  <div>
                    <p className={`text-2xl font-bold text-${item.color}-500`}>{item.value}</p>
                    <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 实时探测状态 */}
        <div className={`rounded-2xl p-6 ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-lg shadow-gray-200/50'}`}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-xl ${isDark ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20' : 'bg-gradient-to-br from-cyan-50 to-blue-50'}`}>
                <Activity className={`w-5 h-5 ${isDark ? 'text-cyan-400' : 'text-cyan-500'}`} />
              </div>
              <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>实时探测状态</h2>
            </div>
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>
              {activeProbes.length} 个活跃任务
            </span>
          </div>

          {activeProbes.length === 0 ? (
            <div className="text-center py-16">
              <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center ${isDark ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                <Wifi className={`w-10 h-10 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
              </div>
              <p className={`text-base font-medium ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>未找到活跃的探测任务</p>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>创建并启用探测任务以查看实时状态</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeProbes.map((probe) => (
                <div key={probe.id} className={`group relative rounded-xl p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
                  probe.lastResult?.status === 'success' 
                    ? isDark ? 'bg-slate-700/30 border border-slate-600/50 hover:border-emerald-500/50' : 'bg-white border border-gray-200 hover:border-emerald-300 shadow-sm'
                    : probe.lastResult?.status === 'failed'
                      ? isDark ? 'bg-red-900/20 border border-red-500/30 hover:border-red-400/50' : 'bg-red-50/50 border border-red-200 hover:border-red-300'
                      : probe.lastResult?.status === 'timeout'
                        ? isDark ? 'bg-amber-900/20 border border-amber-500/30 hover:border-amber-400/50' : 'bg-amber-50/50 border border-amber-200 hover:border-amber-300'
                        : isDark ? 'bg-slate-700/30 border border-slate-600/50 hover:border-slate-500/50' : 'bg-white border border-gray-200 hover:border-gray-300 shadow-sm'
                }`}>
                  {/* 状态指示灯 */}
                  <div className="absolute top-4 right-4">
                    <span className="relative flex h-3 w-3">
                      {probe.lastResult?.status === 'success' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                      {probe.lastResult?.status === 'failed' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${
                        probe.lastResult?.status === 'success' ? 'bg-emerald-500' :
                        probe.lastResult?.status === 'failed' ? 'bg-red-500' :
                        probe.lastResult?.status === 'timeout' ? 'bg-amber-500' : 'bg-slate-400'
                      }`}></span>
                    </span>
                  </div>

                  <div className="pr-6">
                    <h3 className={`font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{probe.name}</h3>
                    <p className={`text-xs truncate mt-1 flex items-center ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      <ExternalLink className="w-3 h-3 mr-1.5 flex-shrink-0" />
                      {probe.target_url}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 mt-3">
                    <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-600'}`}>
                      {probe.protocol.toUpperCase()}
                    </span>
                    {probe.auto_probe_enabled && (
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-600'}`}>
                        自动探测
                      </span>
                    )}
                  </div>

                  {probe.lastResult ? (
                    <div className={`flex items-center justify-between mt-4 p-3 rounded-lg ${
                      probe.lastResult.status === 'success' ? isDark ? 'bg-emerald-500/10' : 'bg-emerald-50' :
                      probe.lastResult.status === 'failed' ? isDark ? 'bg-red-500/10' : 'bg-red-50' : 
                      probe.lastResult.status === 'timeout' ? isDark ? 'bg-amber-500/10' : 'bg-amber-50' : isDark ? 'bg-slate-600/30' : 'bg-gray-50'
                    }`}>
                      <div className="flex items-center space-x-2">
                        {probe.lastResult.status === 'success' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                        {probe.lastResult.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-500" />}
                        {probe.lastResult.status === 'timeout' && <Clock className="w-4 h-4 text-amber-500" />}
                        {probe.lastResult.status === 'unknown' && <AlertTriangle className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-gray-500'}`} />}
                        <span className={`text-sm font-medium ${
                          probe.lastResult.status === 'success' ? 'text-emerald-600' :
                          probe.lastResult.status === 'failed' ? 'text-red-600' : 
                          probe.lastResult.status === 'timeout' ? 'text-amber-600' : isDark ? 'text-slate-400' : 'text-gray-500'
                        }`}>
                          {probe.lastResult.status === 'success' ? '探测成功' : probe.lastResult.status === 'failed' ? '探测失败' : 
                           probe.lastResult.status === 'timeout' ? '响应超时' : '状态未知'}
                        </span>
                      </div>
                      {probe.lastResult.response_time !== undefined && (
                        <span className={`text-sm font-mono font-semibold px-2 py-0.5 rounded ${isDark ? 'bg-slate-600/50 text-slate-200' : 'bg-gray-100 text-gray-700'}`}>
                          {probe.lastResult.response_time}ms
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className={`flex items-center justify-center mt-4 p-3 rounded-lg ${isDark ? 'bg-slate-600/30' : 'bg-gray-50'}`}>
                      <span className={`text-sm ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>暂无探测结果</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default NetworkDashboard
