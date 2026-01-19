/**
 * 监控大屏页面 - 美化版
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Activity, AlertTriangle, CheckCircle, Server, TrendingUp, Users, Zap, Shield, Database, Cpu, HardDrive, Wifi, XCircle, BarChart3
} from 'lucide-react'
import { formatDateTime } from '../../../utils'
import { healthService, ServicesHealthStatus } from '../../../services/health'
import { useTheme } from '../../../hooks/useTheme'
import { MonitorPageLayout, MonitorStatCard, MonitorContentCard, ServiceStatusCard, UsageBar, MonitorLoadingState } from '../../../components/Monitor/MonitorPageLayout'

interface SystemStats {
  total_users: number; active_users: number; total_hosts: number; online_hosts: number
  total_probes: number; active_probes: number; success_rate: number; avg_response_time: number
  active_alerts: number; system_health: 'healthy' | 'warning' | 'critical'
  cpu_usage: number; memory_usage: number; disk_usage: number; network_status: 'connected' | 'disconnected' | 'unstable'
}

export const DashboardPage: React.FC = () => {
  const { isDark } = useTheme()
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [servicesHealth, setServicesHealth] = useState<ServicesHealthStatus | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const mountedRef = useRef(true)

  const loadServicesHealth = useCallback(async () => {
    if (!mountedRef.current) return
    try {
      setHealthLoading(true)
      const response = await healthService.getServicesHealth()
      if (mountedRef.current && response.success && response.data) setServicesHealth(response.data)
    } catch (error) { console.error('加载服务健康状态失败:', error) }
    finally { if (mountedRef.current) setHealthLoading(false) }
  }, [])

  const loadSystemStats = useCallback(async () => {
    if (!mountedRef.current) return
    try {
      setLoading(true)
      await new Promise(resolve => setTimeout(resolve, 1000))
      const mockStats: SystemStats = {
        total_users: 156, active_users: 42, total_hosts: 89, online_hosts: 76,
        total_probes: 234, active_probes: 198, success_rate: 96.8, avg_response_time: 245,
        active_alerts: 3, system_health: 'healthy', cpu_usage: 45.2, memory_usage: 67.8,
        disk_usage: 34.5, network_status: 'connected'
      }
      if (mountedRef.current) { setStats(mockStats); setLastRefresh(new Date()) }
    } catch (error) { console.error('加载系统统计数据失败:', error) }
    finally { if (mountedRef.current) setLoading(false) }
  }, [])

  useEffect(() => { mountedRef.current = true; loadSystemStats(); loadServicesHealth(); return () => { mountedRef.current = false } }, [loadSystemStats, loadServicesHealth])
  useEffect(() => { if (!autoRefresh) return; const interval = setInterval(() => { loadSystemStats(); loadServicesHealth() }, refreshInterval * 1000); return () => clearInterval(interval) }, [autoRefresh, refreshInterval, loadSystemStats, loadServicesHealth])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setIsFullscreen(true) }
    else { document.exitFullscreen(); setIsFullscreen(false) }
  }

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  if (loading && !stats) return <MonitorLoadingState message="正在加载监控大屏..." icon={Activity} />

  const headerActions = (
    <>
      {/* 实时状态指示 */}
      <div className="flex items-center space-x-2">
        <span className="relative flex h-2.5 w-2.5">
          {autoRefresh && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${autoRefresh ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
        </span>
        <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          更新于 {formatDateTime(lastRefresh.toISOString(), 'HH:mm:ss')}
        </span>
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
            <option value={10}>10秒</option><option value={30}>30秒</option><option value={60}>60秒</option>
          </select>
        )}
      </div>
    </>
  )

  return (
    <MonitorPageLayout title="系统监控大屏" subtitle="实时系统状态监控" icon={Activity}
      iconGradient="from-cyan-500 via-blue-600 to-indigo-500" headerActions={headerActions}
      loading={loading} onRefresh={() => { loadSystemStats(); loadServicesHealth() }}
      isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen}>
      {stats && (
        <div className="space-y-6">
          {/* 主要统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <MonitorStatCard title="系统健康状态"
              value={stats.system_health === 'healthy' ? '健康' : stats.system_health === 'warning' ? '警告' : '严重'}
              subtitle="整体系统状态" icon={Shield}
              variant={stats.system_health === 'healthy' ? 'success' : stats.system_health === 'warning' ? 'warning' : 'danger'}
              valueColorClass={stats.system_health === 'healthy' ? 'text-emerald-500' : stats.system_health === 'warning' ? 'text-amber-500' : 'text-red-500'}
              iconColorClass={stats.system_health === 'healthy' ? 'text-emerald-400' : stats.system_health === 'warning' ? 'text-amber-400' : 'text-red-400'}
              glowColor={stats.system_health === 'healthy' ? 'bg-emerald-500' : stats.system_health === 'warning' ? 'bg-amber-500' : 'bg-red-500'} />
            <MonitorStatCard title="用户统计" value={stats.total_users} subtitle={`${stats.active_users} 个在线`}
              icon={Users} iconColorClass="text-blue-400" glowColor="bg-blue-500" />
            <MonitorStatCard title="主机统计" value={stats.total_hosts} subtitle={`${stats.online_hosts} 个在线`}
              icon={Server} iconColorClass="text-purple-400" glowColor="bg-purple-500" />
            <MonitorStatCard title="活跃告警" value={stats.active_alerts} subtitle="需要关注"
              icon={AlertTriangle} variant={stats.active_alerts > 0 ? 'danger' : 'default'}
              valueColorClass={stats.active_alerts > 0 ? 'text-red-500' : undefined}
              iconColorClass={stats.active_alerts > 0 ? 'text-red-400' : 'text-gray-400'}
              glowColor={stats.active_alerts > 0 ? 'bg-red-500' : 'bg-gray-500'}
              pulse={stats.active_alerts > 0} />
          </div>

          {/* 网络探测统计 & 系统资源 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MonitorContentCard title="网络探测统计" icon={BarChart3}>
              <div className="grid grid-cols-2 gap-6">
                {[
                  { label: '探测总数', value: stats.total_probes, color: 'text-blue-400' },
                  { label: '活跃探测', value: stats.active_probes, color: 'text-emerald-400' },
                  { label: '成功率', value: `${stats.success_rate.toFixed(1)}%`, color: 'text-amber-400' },
                  { label: '平均响应', value: `${stats.avg_response_time}ms`, color: 'text-purple-400' },
                ].map((item, i) => (
                  <div key={i} className="text-center">
                    <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</p>
                  </div>
                ))}
              </div>
            </MonitorContentCard>

            <MonitorContentCard title="系统资源使用率" icon={Cpu}>
              <div className="space-y-4">
                <UsageBar label="CPU" value={stats.cpu_usage} icon={Cpu} iconColorClass="text-blue-400" />
                <UsageBar label="内存" value={stats.memory_usage} icon={Database} iconColorClass="text-emerald-400" />
                <UsageBar label="磁盘" value={stats.disk_usage} icon={HardDrive} iconColorClass="text-purple-400" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Wifi className="w-5 h-5 text-amber-400" />
                    <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>网络</span>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                    stats.network_status === 'connected' ? isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700' :
                    stats.network_status === 'unstable' ? isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700' :
                    isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                  }`}>
                    {stats.network_status === 'connected' ? '已连接' : stats.network_status === 'unstable' ? '不稳定' : '已断开'}
                  </span>
                </div>
              </div>
            </MonitorContentCard>
          </div>

          {/* 系统状态概览 */}
          <MonitorContentCard title="系统状态概览" icon={TrendingUp}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: '服务正常', value: '98.5%', icon: CheckCircle, color: 'text-emerald-400' },
                { label: '系统负载', value: '正常', icon: Activity, color: 'text-blue-400' },
                { label: '性能趋势', value: '稳定', icon: TrendingUp, color: 'text-purple-400' },
                { label: '响应速度', value: '优秀', icon: Zap, color: 'text-amber-400' },
              ].map((item, i) => (
                <div key={i} className={`text-center p-4 rounded-xl transition-all hover:scale-105 ${isDark ? 'bg-slate-700/30 hover:bg-slate-700/50' : 'bg-gray-50 hover:bg-gray-100'}`}>
                  <item.icon className={`w-8 h-8 mx-auto mb-2 ${item.color}`} />
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</p>
                  <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </MonitorContentCard>

          {/* 核心服务健康状态 */}
          <MonitorContentCard title="核心服务健康状态" icon={Shield}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ServiceStatusCard name="Celery"
                status={healthLoading ? 'loading' : servicesHealth?.services?.celery?.status === 'healthy' ? 'healthy' : 'unhealthy'}
                detail={!healthLoading && servicesHealth?.services?.celery ? `Workers: ${servicesHealth.services.celery.workers?.length || 0}` : undefined} />
              <ServiceStatusCard name="SSE 推送"
                status={healthLoading ? 'loading' : servicesHealth?.services?.sse?.status === 'healthy' ? 'healthy' : 'unhealthy'}
                detail={!healthLoading && servicesHealth?.services?.sse ? `连接: ${servicesHealth.services.sse.active_connections || 0}` : undefined} />
              <ServiceStatusCard name="数据库"
                status={healthLoading ? 'loading' : servicesHealth?.services?.database?.status === 'healthy' ? 'healthy' : 'unhealthy'}
                detail={!healthLoading && servicesHealth?.services?.database?.response_time_ms ? `响应: ${servicesHealth.services.database.response_time_ms}ms` : undefined} />
              <ServiceStatusCard name="Redis"
                status={healthLoading ? 'loading' : servicesHealth?.services?.redis?.status === 'healthy' ? 'healthy' : 'unhealthy'}
                detail={!healthLoading && servicesHealth?.services?.redis?.response_time_ms ? `响应: ${servicesHealth.services.redis.response_time_ms}ms` : undefined} />
            </div>
          </MonitorContentCard>
        </div>
      )}
    </MonitorPageLayout>
  )
}
