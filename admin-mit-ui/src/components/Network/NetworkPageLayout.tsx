/**
 * 网络页面通用布局组件
 * 提供统一的页面结构、主题适配和样式
 */
import React from 'react'
import { LucideIcon, RefreshCw, Maximize2, Minimize2 } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'

interface NetworkPageLayoutProps {
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
}

export const NetworkPageLayout: React.FC<NetworkPageLayoutProps> = ({
  title,
  subtitle,
  icon: Icon,
  iconGradient = 'from-blue-500 via-blue-600 to-cyan-500',
  children,
  headerActions,
  loading = false,
  onRefresh,
  isFullscreen = false,
  onToggleFullscreen,
  showRefresh = true,
  showFullscreen = true,
}) => {
  const { isDark } = useTheme()

  return (
    <div className={`h-full flex flex-col overflow-hidden ${
      isDark ? 'bg-[#0f172a]' : 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50'
    }`}>
      {/* 头部 */}
      <div className={`flex-shrink-0 px-6 py-4 backdrop-blur-xl border-b ${
        isDark ? 'bg-slate-900/80 border-slate-700/50' : 'bg-white/70 border-gray-200/80'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className={`absolute inset-0 rounded-2xl blur-xl opacity-50 bg-gradient-to-br ${iconGradient}`}></div>
              <div className={`relative p-3 rounded-2xl bg-gradient-to-br ${iconGradient} shadow-xl`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {title}
              </h1>
              {subtitle && (
                <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {headerActions}
            
            {showRefresh && onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-white text-sm font-medium overflow-hidden transition-all disabled:opacity-50"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <RefreshCw className={`relative w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                <span className="relative">刷新</span>
              </button>
            )}
            
            {showFullscreen && onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                title={isFullscreen ? '退出全屏' : '进入全屏'}
                className={`p-2.5 rounded-xl transition-all ${
                  isDark 
                    ? 'bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700 text-gray-300' 
                    : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 shadow-sm'
                }`}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-6">
        {children}
      </div>
    </div>
  )
}

// 统计卡片组件
interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  iconBgClass?: string
  valueColorClass?: string
  trend?: 'up' | 'down' | 'stable'
  glowColor?: string
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBgClass = 'bg-blue-500/10',
  valueColorClass,
  glowColor = 'bg-blue-500',
}) => {
  const { isDark } = useTheme()

  return (
    <div className={`group relative rounded-2xl p-5 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
      isDark 
        ? 'bg-gradient-to-br from-slate-800/90 to-slate-800/50 border border-slate-700/50' 
        : 'bg-white border border-gray-100 shadow-lg shadow-gray-200/50'
    }`}>
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity ${glowColor}`}></div>
      <div className="relative flex items-start justify-between">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>
            {title}
          </p>
          <p className={`text-4xl font-bold mt-2 tracking-tight ${valueColorClass || (isDark ? 'text-white' : 'text-gray-900')}`}>
            {value}
          </p>
          {subtitle && (
            <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconBgClass}`}>
          <Icon className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
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
}

export const ContentCard: React.FC<ContentCardProps> = ({
  title,
  icon: Icon,
  children,
  headerActions,
  className = '',
}) => {
  const { isDark } = useTheme()

  return (
    <div className={`rounded-2xl ${
      isDark 
        ? 'bg-slate-800/50 border border-slate-700/50' 
        : 'bg-white border border-gray-100 shadow-lg shadow-gray-200/50'
    } ${className}`}>
      {title && (
        <div className="p-5 border-b border-slate-700/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {Icon && (
                <div className={`p-2 rounded-xl ${
                  isDark ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20' : 'bg-gradient-to-br from-blue-50 to-cyan-50'
                }`}>
                  <Icon className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                </div>
              )}
              <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
            </div>
            {headerActions}
          </div>
        </div>
      )}
      <div className="p-5">
        {children}
      </div>
    </div>
  )
}

// 加载状态组件
interface LoadingStateProps {
  message?: string
  submessage?: string
  icon?: LucideIcon
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = '正在加载...',
  submessage,
  icon: Icon,
}) => {
  const { isDark } = useTheme()

  return (
    <div className={`h-full flex items-center justify-center ${
      isDark ? 'bg-[#0f172a]' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'
    }`}>
      <div className="text-center">
        <div className="relative w-20 h-20 mx-auto">
          <div className={`absolute inset-0 rounded-full border-4 border-t-transparent animate-spin ${
            isDark ? 'border-blue-500' : 'border-blue-400'
          }`}></div>
          <div className={`absolute inset-2 rounded-full border-4 border-b-transparent animate-spin ${
            isDark ? 'border-cyan-500' : 'border-cyan-400'
          }`} style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          {Icon && (
            <Icon className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 ${
              isDark ? 'text-blue-400' : 'text-blue-500'
            }`} />
          )}
        </div>
        <p className={`mt-6 text-lg font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{message}</p>
        {submessage && (
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{submessage}</p>
        )}
      </div>
    </div>
  )
}

// 空状态组件
interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
}) => {
  const { isDark } = useTheme()

  return (
    <div className="text-center py-16">
      <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
        isDark ? 'bg-slate-700/50' : 'bg-gray-100'
      }`}>
        <Icon className={`w-10 h-10 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
      </div>
      <p className={`text-base font-medium ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>{title}</p>
      {description && (
        <p className={`text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export default NetworkPageLayout
