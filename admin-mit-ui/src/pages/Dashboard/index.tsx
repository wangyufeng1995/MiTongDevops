/**
 * 仪表盘页面 - 数据可视化版
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Users, Shield, Server, Activity, Globe, AlertTriangle, CheckCircle, Clock, TrendingUp, 
  RefreshCw, LayoutDashboard, Zap, BarChart3, PieChart as PieChartIcon, LineChart, UserCheck, UserX,
  PlayCircle, PauseCircle, XCircle, Wifi, WifiOff, HardDrive, Cpu, MemoryStick, Container
} from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useTheme } from '../../hooks/useTheme'
import { ServiceHealthCard } from '../../components/Health'
import { dashboardService, DashboardStats, DashboardTrends } from '../../services/dashboard'
import { clustersService } from '../../services/k8s/clusters'
import { hostsService } from '../../services/hosts'
import { MonitorPageLayout, MonitorStatCard, MonitorContentCard } from '../../components/Monitor/MonitorPageLayout'

// 快速操作卡片组件
interface QuickActionCardProps {
  title: string
  description: string
  icon: React.ElementType
  gradient: string
  onClick: () => void
  disabled?: boolean
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({ title, description, icon: Icon, gradient, onClick, disabled }) => {
  const { isDark } = useTheme()
  return (
    <button onClick={onClick} disabled={disabled}
      className={`group relative w-full p-6 rounded-2xl text-left overflow-hidden transition-all duration-300 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-2xl hover:-translate-y-1'
      } ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-lg'}`}>
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity bg-gradient-to-br ${gradient}`}></div>
      <div className="relative flex items-start space-x-4">
        <div className={`p-4 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-base font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{description}</p>
        </div>
      </div>
    </button>
  )
}

// 环形进度图组件
interface RingProgressProps {
  data: { label: string; value: number; color: string }[]
  title: string
  loading?: boolean
  size?: 'large' | 'medium'
  centerLabel?: string
}

const RingProgress: React.FC<RingProgressProps> = ({ data, title, loading, size = 'large', centerLabel }) => {
  const { isDark } = useTheme()
  const total = data.reduce((sum, item) => sum + item.value, 0)
  
  // 根据尺寸调整参数
  const isLarge = size === 'large'
  const ringSize = isLarge ? 'w-56 h-56' : 'w-40 h-40'
  const radius = isLarge ? 50 : 42
  const strokeWidth = isLarge ? 12 : 10
  const centerTextSize = isLarge ? 'text-5xl' : 'text-3xl'
  const centerLabelSize = isLarge ? 'text-sm' : 'text-xs'
  const cardPadding = isLarge ? 'py-6' : 'py-4'
  const ringMargin = isLarge ? 'mb-8' : 'mb-6'
  const itemPadding = isLarge ? 'p-4' : 'p-3'
  const itemSpacing = isLarge ? 'space-y-3' : 'space-y-2'
  const valueSize = isLarge ? 'text-2xl' : 'text-xl'
  const labelSize = isLarge ? 'text-sm' : 'text-xs'
  
  return (
    <MonitorContentCard title={title} icon={Activity}>
      {loading ? (
        <div className={`${isLarge ? 'h-80' : 'h-64'} flex items-center justify-center`}>
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : total === 0 ? (
        <div className={`${isLarge ? 'h-80' : 'h-64'} flex flex-col items-center justify-center`}>
          <Activity className={`w-12 h-12 mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>暂无数据</p>
        </div>
      ) : (
        <div className={cardPadding}>
          {/* 环形进度条 */}
          <div className={`flex items-center justify-center ${ringMargin}`}>
            <div className={`relative ${ringSize}`}>
              <svg viewBox="0 0 120 120" className="transform -rotate-90">
                {/* 背景圆环 */}
                <circle cx="60" cy="60" r={radius} fill="none"
                  stroke={isDark ? '#334155' : '#e5e7eb'} strokeWidth={strokeWidth} />
                
                {/* 数据圆环 */}
                {data.map((item, i) => {
                  const prevSum = data.slice(0, i).reduce((sum, d) => sum + d.value, 0)
                  const percentage = (item.value / total) * 100
                  const offset = (prevSum / total) * 100
                  const circumference = 2 * Math.PI * radius
                  const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`
                  const strokeDashoffset = -((offset / 100) * circumference)
                  
                  return (
                    <circle key={i} cx="60" cy="60" r={radius} fill="none"
                      stroke={item.color} strokeWidth={strokeWidth}
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className="transition-all duration-700 ease-out"
                      style={{ 
                        filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.15))',
                        animation: `dash-${i} 1s ease-out`
                      }} />
                  )
                })}
              </svg>
              
              {/* 中心内容 */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={`${centerTextSize} font-bold bg-gradient-to-br from-blue-500 to-cyan-500 bg-clip-text text-transparent`}>
                  {total}
                </div>
                <div className={`${centerLabelSize} mt-1 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {centerLabel || '总数'}
                </div>
              </div>
            </div>
          </div>
          
          {/* 数据列表 */}
          <div className={itemSpacing}>
            {data.map((item, i) => {
              const percentage = total > 0 ? (item.value / total) * 100 : 0
              return (
                <div key={i} className={`${itemPadding} rounded-xl transition-all hover:scale-[1.02] ${
                  isDark ? 'bg-slate-700/30 hover:bg-slate-700/50' : 'bg-gray-50 hover:bg-gray-100'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className={`${isLarge ? 'w-4 h-4' : 'w-3 h-3'} rounded-full shadow-lg`} 
                        style={{ 
                          backgroundColor: item.color,
                          boxShadow: `0 0 12px ${item.color}40`
                        }}></div>
                      <span className={`${labelSize} font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`${valueSize} font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {item.value}
                      </span>
                      <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                        isDark ? 'bg-slate-600 text-gray-300' : 'bg-white text-gray-600'
                      }`}>
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  
                  {/* 进度条 */}
                  <div className={`${isLarge ? 'h-2' : 'h-1.5'} rounded-full overflow-hidden ${
                    isDark ? 'bg-slate-600' : 'bg-gray-200'
                  }`}>
                    <div className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: item.color,
                        boxShadow: `0 0 8px ${item.color}60`
                      }}></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </MonitorContentCard>
  )
}

// 饼图组件
interface PieChartProps {
  data: { label: string; value: number; color: string }[]
  title: string
  loading?: boolean
}

const PieChart: React.FC<PieChartProps> = ({ data, title, loading }) => {
  const { isDark } = useTheme()
  const total = data.reduce((sum, item) => sum + item.value, 0)
  
  return (
    <MonitorContentCard title={title} icon={PieChartIcon}>
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : total === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center">
          <PieChartIcon className={`w-12 h-12 mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>暂无数据</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-3">
          {/* 饼图 */}
          <div className="relative w-20 h-20 mb-3">
            <svg viewBox="0 0 100 100" className="transform -rotate-90">
              {data.map((item, i) => {
                const prevSum = data.slice(0, i).reduce((sum, d) => sum + d.value, 0)
                const percentage = (item.value / total) * 100
                const offset = (prevSum / total) * 100
                const radius = 35
                const circumference = 2 * Math.PI * radius
                const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`
                const strokeDashoffset = -((offset / 100) * circumference)
                
                return (
                  <circle key={i} cx="50" cy="50" r={radius} fill="none"
                    stroke={item.color} strokeWidth="10"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-500 hover:opacity-80"
                    style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }} />
                )
              })}
            </svg>
            {/* 中心文字 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{total}</div>
              </div>
            </div>
          </div>
          
          {/* 图例 */}
          <div className="w-full space-y-1.5">
            {data.map((item, i) => (
              <div key={i} className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all ${
                isDark ? 'bg-slate-700/30 hover:bg-slate-700/50' : 'bg-gray-50 hover:bg-gray-100'
              }`}>
                <div className="flex items-center space-x-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{item.label}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.value}</span>
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {total > 0 ? Math.round((item.value / total) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </MonitorContentCard>
  )
}

// 简单图表组件
interface SimpleBarChartProps {
  data: { label: string; value: number }[]
  title: string
  loading?: boolean
}

const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ data, title, loading }) => {
  const { isDark } = useTheme()
  const maxValue = Math.max(...data.map(d => d.value), 1)
  
  return (
    <MonitorContentCard title={title} icon={BarChart3}>
      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="h-48 flex items-end justify-between space-x-2">
          {data.map((item, i) => (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div className="w-full flex-1 flex items-end">
                <div className={`w-full rounded-t-lg bg-gradient-to-t from-blue-500 to-cyan-400 transition-all duration-500 hover:from-blue-600 hover:to-cyan-500`}
                  style={{ height: `${(item.value / maxValue) * 100}%`, minHeight: '4px' }}>
                </div>
              </div>
              <span className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </MonitorContentCard>
  )
}

// 趋势线图组件
interface TrendLineProps {
  data: { label: string; value: number }[]
  title: string
  loading?: boolean
}

const TrendLine: React.FC<TrendLineProps> = ({ data, title, loading }) => {
  const { isDark } = useTheme()
  const maxValue = Math.max(...data.map(d => d.value), 1)
  const minValue = Math.min(...data.map(d => d.value), 0)
  const range = maxValue - minValue || 1
  
  const points = data.map((item, i) => {
    const x = (i / (data.length - 1)) * 100
    const y = 100 - ((item.value - minValue) / range) * 100
    return `${x},${y}`
  }).join(' ')
  
  return (
    <MonitorContentCard title={title} icon={LineChart}>
      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="h-48 relative">
          <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polyline points={`0,100 ${points} 100,100`} fill="url(#lineGradient)" />
            <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="0.5" />
            {data.map((item, i) => {
              const x = (i / (data.length - 1)) * 100
              const y = 100 - ((item.value - minValue) / range) * 100
              return (
                <circle key={i} cx={x} cy={y} r="1" fill="#3b82f6" className="hover:r-2 transition-all" />
              )
            })}
          </svg>
          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
            {data.map((item, i) => (
              <span key={i} className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</span>
            ))}
          </div>
        </div>
      )}
    </MonitorContentCard>
  )
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { user, hasPermission } = useAuthStore()
  const [stats, setStats] = useState<DashboardStats>({ users: 0, roles: 0, menus: 0, hosts: 0, probes: 0, alerts: 0, uptime: '0%' })
  const [trends, setTrends] = useState<DashboardTrends>({ system_usage: [], alert_trend: [] })
  const [k8sStats, setK8sStats] = useState({ healthy: 0, warning: 0, error: 0, total: 0 })
  const [hostStats, setHostStats] = useState({ online: 0, offline: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [statsResponse, trendsResponse, k8sStatsResponse, hostStatsResponse] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getTrends(),
        clustersService.getClusterStats().catch(() => ({ healthy: 0, warning: 0, error: 0, total: 0 })),
        hostsService.getHostStats().catch(() => ({ online: 0, offline: 0, total: 0 }))
      ])
      if (statsResponse.success && statsResponse.data) setStats(statsResponse.data)
      if (trendsResponse.success && trendsResponse.data) setTrends(trendsResponse.data)
      setK8sStats(k8sStatsResponse)
      setHostStats(hostStatsResponse)
      setLastRefresh(new Date())
    } catch (err: any) {
      setError(err.message || '加载数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDashboardData() }, [loadDashboardData])
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(loadDashboardData, 60000)
    return () => clearInterval(interval)
  }, [autoRefresh, loadDashboardData])

  // 模拟数据
  const systemUsageData = trends.system_usage.length > 0 ? trends.system_usage : 
    [{ label: '周一', value: 95 }, { label: '周二', value: 92 }, { label: '周三', value: 98 }, { label: '周四', value: 94 }, { label: '周五', value: 96 }, { label: '周六', value: 99 }, { label: '周日', value: 97 }]

  // 用户状态分布（模拟数据）
  const userStatusData = [
    { label: '正常用户', value: Math.floor(stats.users * 0.9), color: '#10b981' },
    { label: '禁用用户', value: Math.floor(stats.users * 0.1), color: '#ef4444' },
  ]

  // 主机状态分布（真实数据）
  const hostStatusData = [
    { label: '在线', value: hostStats.online, color: '#10b981' },
    { label: '离线', value: hostStats.offline, color: '#6b7280' },
  ]

  // 网络探测状态（模拟数据）
  const probeStatusData = [
    { label: '成功', value: Math.floor(stats.probes * 0.8), color: '#10b981' },
    { label: '失败', value: Math.floor(stats.probes * 0.1), color: '#ef4444' },
    { label: '超时', value: Math.floor(stats.probes * 0.1), color: '#f59e0b' },
  ]

  // K8S集群状态（真实数据）
  const k8sStatusData = [
    { label: '在线', value: k8sStats.healthy, color: '#10b981' },
    { label: '离线', value: k8sStats.warning, color: '#f59e0b' },
    { label: '异常', value: k8sStats.error, color: '#ef4444' },
  ]

  // 告警发送状态（模拟数据）
  const alertSendStatusData = [
    { label: '发送成功', value: 156, color: '#10b981' },
    { label: '发送失败', value: 8, color: '#ef4444' },
    { label: '待发送', value: 12, color: '#6366f1' },
  ]

  // 告警趋势（模拟数据）
  const alertTrendData = trends.alert_trend.length > 0 ? trends.alert_trend :
    [{ label: '周一', value: 5 }, { label: '周二', value: 3 }, { label: '周三', value: 8 }, { label: '周四', value: 2 }, { label: '周五', value: 6 }, { label: '周六', value: 1 }, { label: '周日', value: 4 }]

  const uptimeValue = parseFloat(stats.uptime) || 0
  const performanceLevel = uptimeValue >= 95 ? '优秀' : uptimeValue >= 80 ? '良好' : '需关注'
  const performanceColor = uptimeValue >= 95 ? 'text-emerald-500' : uptimeValue >= 80 ? 'text-amber-500' : 'text-red-500'

  // 快速操作入口
  const quickActions = [
    { title: 'SSH主机', description: 'SSH主机管理与运维', icon: Server, gradient: 'from-indigo-500 to-blue-500', path: '/hostoperate/hosts', permission: 'host:read' },
    { title: 'K8S集群', description: 'Kubernetes集群管理', icon: Container, gradient: 'from-blue-500 to-cyan-500', path: '/middleware/k8s-manager/clusters', permission: null },
    { title: '网络探测', description: '网络连通性监控', icon: Globe, gradient: 'from-red-500 to-rose-500', path: '/network', permission: 'network:read' },
    { title: '监控告警', description: '系统监控与告警配置', icon: Activity, gradient: 'from-amber-500 to-orange-500', path: '/monitor', permission: 'monitor:read' },
  ]

  const headerActions = (
    <>
      <div className="flex items-center space-x-2">
        <span className="relative flex h-2.5 w-2.5">
          {autoRefresh && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${autoRefresh ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
        </span>
        <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          更新于 {lastRefresh.toLocaleTimeString()}
        </span>
      </div>
      <div className={`flex items-center space-x-3 rounded-2xl px-4 py-2.5 ${isDark ? 'bg-slate-800/80 border border-slate-700/50' : 'bg-white border border-gray-200 shadow-sm'}`}>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="sr-only peer" />
          <div className={`w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-sm peer-checked:bg-gradient-to-r peer-checked:from-blue-500 peer-checked:to-cyan-500 ${isDark ? 'bg-slate-600' : 'bg-gray-300'}`}></div>
        </label>
        <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>自动刷新</span>
      </div>
    </>
  )

  return (
    <MonitorPageLayout title={`欢迎回来，${user?.full_name || user?.username || '用户'}！`} subtitle="系统运行状态概览"
      icon={LayoutDashboard} iconGradient="from-blue-500 via-indigo-500 to-purple-500"
      headerActions={headerActions} loading={loading} onRefresh={loadDashboardData} showFullscreen={false}>
      
      {error && (
        <div className={`mb-6 p-4 rounded-xl border ${isDark ? 'bg-red-900/30 border-red-500/50 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <div className="flex items-center"><AlertTriangle className="w-5 h-5 mr-2" />{error}</div>
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <MonitorStatCard title="用户总数" value={stats.users} subtitle="系统注册用户" icon={Users}
          iconColorClass="text-blue-400" glowColor="bg-blue-500" />
        <MonitorStatCard title="主机数量" value={stats.hosts} subtitle="托管主机资源" icon={Server}
          iconColorClass="text-purple-400" glowColor="bg-purple-500" />
        <MonitorStatCard title="网络探测" value={stats.probes} subtitle="探测任务数量" icon={Globe}
          iconColorClass="text-cyan-400" glowColor="bg-cyan-500" />
        <MonitorStatCard title="活跃告警" value={stats.alerts} subtitle="需要关注"
          icon={AlertTriangle} variant={stats.alerts > 0 ? 'danger' : 'default'}
          valueColorClass={stats.alerts > 0 ? 'text-red-500' : undefined}
          iconColorClass={stats.alerts > 0 ? 'text-red-400' : 'text-gray-400'}
          glowColor={stats.alerts > 0 ? 'bg-red-500' : 'bg-gray-500'} pulse={stats.alerts > 0} />
      </div>

      {/* 系统状态和告警趋势 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <MonitorContentCard title="系统状态" icon={Activity}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>系统可用率</span>
              </div>
              <span className="text-lg font-bold text-emerald-500">{stats.uptime}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className={`w-4 h-4 ${stats.alerts > 0 ? 'text-red-400' : 'text-gray-400'}`} />
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>活跃告警</span>
              </div>
              <span className={`text-lg font-bold ${stats.alerts > 0 ? 'text-red-500' : (isDark ? 'text-white' : 'text-gray-900')}`}>
                {stats.alerts} 个
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>角色数量</span>
              </div>
              <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.roles} 个</span>
            </div>
            <div className={`pt-3 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>性能指标</span>
                </div>
                <span className={`text-lg font-bold ${performanceColor}`}>{performanceLevel}</span>
              </div>
            </div>
          </div>
        </MonitorContentCard>

        <div className="lg:col-span-2">
          <TrendLine title="告警趋势 (最近7天)" data={alertTrendData} loading={loading} />
        </div>
      </div>

      {/* 数据可视化 - 五个图表一行排列 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <PieChart title="用户状态" data={userStatusData} loading={loading} />
        <PieChart title="主机状态" data={hostStatusData} loading={loading} />
        <PieChart title="探测状态" data={probeStatusData} loading={loading} />
        <PieChart title="K8S集群" data={k8sStatusData} loading={loading} />
        <PieChart title="告警发送" data={alertSendStatusData} loading={loading} />
      </div>

      {/* 快速操作 */}
      <MonitorContentCard title="快速操作" icon={Zap} className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, i) => (
            <QuickActionCard key={i} title={action.title} description={action.description}
              icon={action.icon} gradient={action.gradient}
              onClick={() => navigate(action.path)} 
              disabled={action.permission && !hasPermission(action.permission)} />
          ))}
        </div>
      </MonitorContentCard>

      {/* 服务健康状态 */}
      <MonitorContentCard title="服务健康检查" icon={Shield}>
        <ServiceHealthCard refreshInterval={0} showDetails={true} compact={false} />
      </MonitorContentCard>
    </MonitorPageLayout>
  )
}
