/**
 * K8s页面通用布局组件
 * 提供统一的页面结构、主题适配和样式
 */
import React from 'react'
import { LucideIcon, RefreshCw, Plus, Search } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'

interface K8sPageLayoutProps {
  title: string
  subtitle?: string
  icon: LucideIcon
  iconGradient?: string
  children: React.ReactNode
  headerActions?: React.ReactNode
  loading?: boolean
  onRefresh?: () => void
  showRefresh?: boolean
}

export const K8sPageLayout: React.FC<K8sPageLayoutProps> = ({
  title, subtitle, icon: Icon, iconGradient = 'from-indigo-500 via-purple-500 to-pink-500',
  children, headerActions, loading = false, onRefresh, showRefresh = true,
}) => {
  const { isDark } = useTheme()

  return (
    <div className={`h-full flex flex-col overflow-hidden ${isDark ? 'bg-[#0f172a]' : 'bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/50'}`}>
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
                <div className={`absolute inset-0 bg-gradient-to-r ${iconGradient}`}></div>
                <div className={`absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                <RefreshCw className={`relative w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                <span className="relative">刷新</span>
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

// K8s统计卡片
interface K8sStatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'purple'
}

export const K8sStatCard: React.FC<K8sStatCardProps> = ({ title, value, subtitle, icon: Icon, variant = 'default' }) => {
  const { isDark } = useTheme()
  const variants = {
    default: { bg: isDark ? 'from-slate-800/90 to-slate-800/50' : 'from-white to-white', border: isDark ? 'border-slate-700/50' : 'border-gray-100', iconBg: isDark ? 'bg-indigo-500/10' : 'bg-indigo-50', iconColor: isDark ? 'text-indigo-400' : 'text-indigo-500', glow: 'bg-indigo-500' },
    success: { bg: isDark ? 'from-emerald-900/40 to-slate-800/50' : 'from-emerald-50 to-white', border: isDark ? 'border-emerald-500/30' : 'border-emerald-100', iconBg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-100', iconColor: isDark ? 'text-emerald-400' : 'text-emerald-500', glow: 'bg-emerald-500' },
    warning: { bg: isDark ? 'from-amber-900/40 to-slate-800/50' : 'from-amber-50 to-white', border: isDark ? 'border-amber-500/30' : 'border-amber-100', iconBg: isDark ? 'bg-amber-500/10' : 'bg-amber-100', iconColor: isDark ? 'text-amber-400' : 'text-amber-500', glow: 'bg-amber-500' },
    danger: { bg: isDark ? 'from-red-900/40 to-slate-800/50' : 'from-red-50 to-white', border: isDark ? 'border-red-500/30' : 'border-red-100', iconBg: isDark ? 'bg-red-500/10' : 'bg-red-100', iconColor: isDark ? 'text-red-400' : 'text-red-500', glow: 'bg-red-500' },
    purple: { bg: isDark ? 'from-purple-900/40 to-slate-800/50' : 'from-purple-50 to-white', border: isDark ? 'border-purple-500/30' : 'border-purple-100', iconBg: isDark ? 'bg-purple-500/10' : 'bg-purple-100', iconColor: isDark ? 'text-purple-400' : 'text-purple-500', glow: 'bg-purple-500' },
  }
  const style = variants[variant]

  return (
    <div className={`group relative rounded-2xl p-5 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-gradient-to-br ${style.bg} border ${style.border} ${!isDark && variant === 'default' ? 'shadow-lg shadow-gray-200/50' : ''}`}>
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity ${style.glow}`}></div>
      <div className="relative flex items-start justify-between">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>{title}</p>
          <p className={`text-3xl font-bold mt-2 tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
          {subtitle && <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${style.iconBg}`}>
          <Icon className={`w-5 h-5 ${style.iconColor}`} />
        </div>
      </div>
    </div>
  )
}

// K8s内容卡片
interface K8sContentCardProps {
  title?: string
  icon?: LucideIcon
  children: React.ReactNode
  headerActions?: React.ReactNode
  className?: string
  noPadding?: boolean
}

export const K8sContentCard: React.FC<K8sContentCardProps> = ({ title, icon: Icon, children, headerActions, className = '', noPadding = false }) => {
  const { isDark } = useTheme()
  return (
    <div className={`rounded-2xl ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-lg shadow-gray-200/50'} ${className}`}>
      {title && (
        <div className={`px-5 py-4 border-b ${isDark ? 'border-slate-700/30' : 'border-gray-100'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {Icon && (
                <div className={`p-2 rounded-xl ${isDark ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20' : 'bg-gradient-to-br from-indigo-50 to-purple-50'}`}>
                  <Icon className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`} />
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

// K8s搜索筛选区域
interface K8sFilterAreaProps {
  children: React.ReactNode
  className?: string
}

export const K8sFilterArea: React.FC<K8sFilterAreaProps> = ({ children, className = '' }) => {
  const { isDark } = useTheme()
  return (
    <div className={`rounded-2xl p-4 mb-6 ${isDark ? 'bg-slate-800/30 border border-slate-700/30' : 'bg-white/50 border border-gray-100'} ${className}`}>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  )
}

// K8s Tab按钮
interface K8sTabButtonProps {
  active: boolean
  onClick: () => void
  icon?: LucideIcon
  children: React.ReactNode
}

export const K8sTabButton: React.FC<K8sTabButtonProps> = ({ active, onClick, icon: Icon, children }) => {
  const { isDark } = useTheme()
  return (
    <button onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
        active
          ? isDark ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
          : isDark ? 'bg-slate-800/50 text-gray-400 hover:bg-slate-700/50 hover:text-gray-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}>
      {Icon && <Icon className="w-4 h-4" />}
      <span>{children}</span>
    </button>
  )
}

// K8s状态徽章
interface K8sStatusBadgeProps {
  status: 'online' | 'offline' | 'error' | 'pending' | 'running' | 'success' | 'warning'
  text?: string
  size?: 'sm' | 'md'
}

export const K8sStatusBadge: React.FC<K8sStatusBadgeProps> = ({ status, text, size = 'md' }) => {
  const { isDark } = useTheme()
  const configs = {
    online: { bg: isDark ? 'bg-emerald-500/20' : 'bg-emerald-100', text: isDark ? 'text-emerald-400' : 'text-emerald-600', dot: 'bg-emerald-500', label: '在线' },
    offline: { bg: isDark ? 'bg-gray-500/20' : 'bg-gray-100', text: isDark ? 'text-gray-400' : 'text-gray-600', dot: 'bg-gray-500', label: '离线' },
    error: { bg: isDark ? 'bg-red-500/20' : 'bg-red-100', text: isDark ? 'text-red-400' : 'text-red-600', dot: 'bg-red-500', label: '错误' },
    pending: { bg: isDark ? 'bg-amber-500/20' : 'bg-amber-100', text: isDark ? 'text-amber-400' : 'text-amber-600', dot: 'bg-amber-500 animate-pulse', label: '等待中' },
    running: { bg: isDark ? 'bg-blue-500/20' : 'bg-blue-100', text: isDark ? 'text-blue-400' : 'text-blue-600', dot: 'bg-blue-500 animate-pulse', label: '运行中' },
    success: { bg: isDark ? 'bg-emerald-500/20' : 'bg-emerald-100', text: isDark ? 'text-emerald-400' : 'text-emerald-600', dot: 'bg-emerald-500', label: '成功' },
    warning: { bg: isDark ? 'bg-amber-500/20' : 'bg-amber-100', text: isDark ? 'text-amber-400' : 'text-amber-600', dot: 'bg-amber-500', label: '警告' },
  }
  const config = configs[status]
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'

  return (
    <span className={`inline-flex items-center space-x-1.5 rounded-full font-medium ${config.bg} ${config.text} ${sizeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
      <span>{text || config.label}</span>
    </span>
  )
}

export default K8sPageLayout
