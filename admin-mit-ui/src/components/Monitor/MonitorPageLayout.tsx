/**
 * 监控页面通用布局组件
 * 提供统一的页面结构、主题适配和样式
 */
import React from 'react'
import { LucideIcon, RefreshCw, Maximize2, Minimize2 } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'

interface MonitorPageLayoutProps {
  title: string
  subtitle?: string
  icon: LucideIcon
  iconGradient?: string
  children: React.ReactNode
  headerActions?: React.ReactNode
  loading?: boolean
  onRefresh?: () => void
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  showRefresh?: boolean
  showFullscreen?: boolean
  darkMode?: boolean // 强制深色模式（用于监控大屏）
}

export const MonitorPageLayout: React.FC<MonitorPageLayoutProps> = ({
  title, subtitle, icon: Icon, iconGradient = 'from-blue-500 via-blue-600 to-cyan-500',
  children, headerActions, loading = false, onRefresh, isFullscreen = false,
  onToggleFullscreen, showRefresh = true, showFullscreen = true, darkMode = false,
}) => {
  const { isDark: themeDark } = useTheme()
  const isDark = darkMode || themeDark

  return (
    <div className={`h-full flex flex-col overflow-hidden ${isDark ? 'bg-[#0f172a]' : 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50'}`}>
      {/* 头部 */}
      <div className={`flex-shrink-0 px-6 py-4 backdrop-blur-xl border-b ${isDark ? 'bg-slate-900/80 border-slate-700/50' : 'bg-white/70 border-gray-200/80'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className={`absolute inset-0 rounded-2xl blur-xl opacity-50 bg-gradient-to-br ${iconGradient}`}></div>
              <div className={`relative p-3 rounded-2xl bg-gradient-to-br ${iconGradient} shadow-xl`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h1>
              {subtitle && <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {headerActions}
            {showRefresh && onRefresh && (
              <button onClick={onRefresh} disabled={loading}
                className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-white text-sm font-medium overflow-hidden transition-all disabled:opacity-50">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <RefreshCw className={`relative w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                <span className="relative">刷新</span>
              </button>
            )}
            {showFullscreen && onToggleFullscreen && (
              <button onClick={onToggleFullscreen} title={isFullscreen ? '退出全屏' : '进入全屏'}
                className={`p-2.5 rounded-xl transition-all ${isDark ? 'bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700 text-gray-300' : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 shadow-sm'}`}>
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>
      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  )
}

// 统计卡片组件
interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  iconColorClass?: string
  valueColorClass?: string
  glowColor?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
  pulse?: boolean
}

export const MonitorStatCard: React.FC<StatCardProps> = ({
  title, value, subtitle, icon: Icon, iconColorClass, valueColorClass, glowColor = 'bg-blue-500',
  variant = 'default', pulse = false,
}) => {
  const { isDark } = useTheme()
  const variantStyles = {
    default: { bg: isDark ? 'from-slate-800/90 to-slate-800/50' : 'from-white to-white', border: isDark ? 'border-slate-700/50' : 'border-gray-100', iconBg: isDark ? 'bg-blue-500/10' : 'bg-blue-50' },
    success: { bg: isDark ? 'from-emerald-900/40 to-slate-800/50' : 'from-emerald-50 to-white', border: isDark ? 'border-emerald-500/30' : 'border-emerald-100', iconBg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-100' },
    warning: { bg: isDark ? 'from-amber-900/40 to-slate-800/50' : 'from-amber-50 to-white', border: isDark ? 'border-amber-500/30' : 'border-amber-100', iconBg: isDark ? 'bg-amber-500/10' : 'bg-amber-100' },
    danger: { bg: isDark ? 'from-red-900/40 to-slate-800/50' : 'from-red-50 to-white', border: isDark ? 'border-red-500/30' : 'border-red-100', iconBg: isDark ? 'bg-red-500/10' : 'bg-red-100' },
  }
  const style = variantStyles[variant]

  return (
    <div className={`group relative rounded-2xl p-5 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-gradient-to-br ${style.bg} border ${style.border} ${!isDark && variant === 'default' ? 'shadow-lg shadow-gray-200/50' : ''}`}>
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity ${glowColor} ${pulse ? 'animate-pulse' : ''}`}></div>
      <div className="relative flex items-start justify-between">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>{title}</p>
          <p className={`text-4xl font-bold mt-2 tracking-tight ${valueColorClass || (isDark ? 'text-white' : 'text-gray-900')}`}>{value}</p>
          {subtitle && <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${style.iconBg}`}>
          <Icon className={`w-6 h-6 ${iconColorClass || (isDark ? 'text-blue-400' : 'text-blue-500')}`} />
        </div>
      </div>
    </div>
  )
}

// 内容卡片组件
interface ContentCardProps {
  title?: string
  icon?: LucideIcon
  children: React.ReactNode
  headerActions?: React.ReactNode
  className?: string
  noPadding?: boolean
}

export const MonitorContentCard: React.FC<ContentCardProps> = ({ title, icon: Icon, children, headerActions, className = '', noPadding = false }) => {
  const { isDark } = useTheme()
  return (
    <div className={`rounded-2xl ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-lg shadow-gray-200/50'} ${className}`}>
      {title && (
        <div className={`px-5 py-4 border-b ${isDark ? 'border-slate-700/30' : 'border-gray-100'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {Icon && (
                <div className={`p-2 rounded-xl ${isDark ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20' : 'bg-gradient-to-br from-blue-50 to-cyan-50'}`}>
                  <Icon className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                </div>
              )}
              <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
            </div>
            {headerActions}
          </div>
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </div>
  )
}

// 服务状态卡片
interface ServiceStatusCardProps {
  name: string
  status: 'healthy' | 'unhealthy' | 'loading'
  detail?: string
  icon?: LucideIcon
}

export const ServiceStatusCard: React.FC<ServiceStatusCardProps> = ({ name, status, detail, icon: Icon }) => {
  const { isDark } = useTheme()
  const statusConfig = {
    healthy: { bg: isDark ? 'bg-emerald-900/30 border-emerald-500/50' : 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-400', text: '正常' },
    unhealthy: { bg: isDark ? 'bg-red-900/30 border-red-500/50' : 'bg-red-50 border-red-200', icon: 'text-red-400', text: '异常' },
    loading: { bg: isDark ? 'bg-slate-700' : 'bg-gray-100', icon: 'text-gray-400', text: '检查中' },
  }
  const config = statusConfig[status]

  return (
    <div className={`text-center p-4 rounded-xl border ${config.bg} transition-all hover:scale-105`}>
      {status === 'loading' ? (
        <RefreshCw className={`w-8 h-8 mx-auto mb-2 animate-spin ${config.icon}`} />
      ) : Icon ? (
        <Icon className={`w-8 h-8 mx-auto mb-2 ${config.icon}`} />
      ) : status === 'healthy' ? (
        <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
        </div>
      ) : (
        <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
        </div>
      )}
      <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{name}</p>
      <p className={`text-lg font-bold ${status === 'healthy' ? 'text-emerald-500' : status === 'unhealthy' ? 'text-red-500' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>{config.text}</p>
      {detail && <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{detail}</p>}
    </div>
  )
}

// 使用率进度条
interface UsageBarProps {
  label: string
  value: number
  icon: LucideIcon
  iconColorClass?: string
}

export const UsageBar: React.FC<UsageBarProps> = ({ label, value, icon: Icon, iconColorClass = 'text-blue-400' }) => {
  const { isDark } = useTheme()
  const getColor = (v: number) => v >= 90 ? 'bg-red-500' : v >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
  const getTextColor = (v: number) => v >= 90 ? 'text-red-500' : v >= 70 ? 'text-amber-500' : 'text-emerald-500'

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Icon className={`w-5 h-5 ${iconColorClass}`} />
        <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>{label}</span>
      </div>
      <div className="flex items-center space-x-3">
        <div className={`w-32 h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`}>
          <div className={`h-full rounded-full transition-all duration-500 ${getColor(value)}`} style={{ width: `${value}%` }}></div>
        </div>
        <span className={`text-sm font-semibold w-12 text-right ${getTextColor(value)}`}>{value.toFixed(1)}%</span>
      </div>
    </div>
  )
}

// 加载状态
interface LoadingStateProps {
  message?: string
  icon?: LucideIcon
}

export const MonitorLoadingState: React.FC<LoadingStateProps> = ({ message = '正在加载...', icon: Icon }) => {
  const { isDark } = useTheme()
  return (
    <div className={`h-full flex items-center justify-center ${isDark ? 'bg-[#0f172a]' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
      <div className="text-center">
        <div className="relative w-20 h-20 mx-auto">
          <div className={`absolute inset-0 rounded-full border-4 border-t-transparent animate-spin ${isDark ? 'border-blue-500' : 'border-blue-400'}`}></div>
          <div className={`absolute inset-2 rounded-full border-4 border-b-transparent animate-spin ${isDark ? 'border-cyan-500' : 'border-cyan-400'}`} style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          {Icon && <Icon className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />}
        </div>
        <p className={`mt-6 text-lg font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{message}</p>
      </div>
    </div>
  )
}

export default MonitorPageLayout
