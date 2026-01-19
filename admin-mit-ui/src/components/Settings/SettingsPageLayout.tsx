/**
 * 设置页面通用布局组件
 * 提供统一的页面结构、主题适配和样式
 */
import React from 'react'
import { LucideIcon, RefreshCw, Save } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'

interface SettingsPageLayoutProps {
  title: string
  subtitle?: string
  icon: LucideIcon
  iconGradient?: string
  children: React.ReactNode
  headerActions?: React.ReactNode
  loading?: boolean
  saving?: boolean
  onRefresh?: () => void
  onSave?: () => void
  showRefresh?: boolean
  showSave?: boolean
  saveText?: string
}

export const SettingsPageLayout: React.FC<SettingsPageLayoutProps> = ({
  title, subtitle, icon: Icon, iconGradient = 'from-blue-500 via-blue-600 to-cyan-500',
  children, headerActions, loading = false, saving = false, onRefresh, onSave,
  showRefresh = true, showSave = true, saveText = '保存设置',
}) => {
  const { isDark } = useTheme()

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
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                  isDark ? 'bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700 text-gray-300' : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 shadow-sm'
                }`}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>刷新</span>
              </button>
            )}
            {showSave && onSave && (
              <button onClick={onSave} disabled={saving || loading}
                className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium overflow-hidden transition-all disabled:opacity-50">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <Save className={`relative w-4 h-4 ${saving ? 'animate-pulse' : ''}`} />
                <span className="relative">{saving ? '保存中...' : saveText}</span>
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

// 设置卡片组件
interface SettingsCardProps {
  title?: string
  icon?: LucideIcon
  children: React.ReactNode
  headerActions?: React.ReactNode
  className?: string
  noPadding?: boolean
  iconColorClass?: string
}

export const SettingsCard: React.FC<SettingsCardProps> = ({ 
  title, icon: Icon, children, headerActions, className = '', noPadding = false, iconColorClass 
}) => {
  const { isDark } = useTheme()
  return (
    <div className={`rounded-2xl ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-lg shadow-gray-200/50'} ${className}`}>
      {title && (
        <div className={`px-5 py-4 border-b ${isDark ? 'border-slate-700/30' : 'border-gray-100'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {Icon && (
                <div className={`p-2 rounded-xl ${isDark ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20' : 'bg-gradient-to-br from-blue-50 to-cyan-50'}`}>
                  <Icon className={`w-5 h-5 ${iconColorClass || (isDark ? 'text-blue-400' : 'text-blue-500')}`} />
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

// 统计卡片组件
interface SettingsStatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  iconColorClass?: string
  valueColorClass?: string
  glowColor?: string
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

export const SettingsStatCard: React.FC<SettingsStatCardProps> = ({
  title, value, subtitle, icon: Icon, iconColorClass, valueColorClass, glowColor = 'bg-blue-500', variant = 'default',
}) => {
  const { isDark } = useTheme()
  const variantStyles = {
    default: { bg: isDark ? 'from-slate-800/90 to-slate-800/50' : 'from-white to-white', border: isDark ? 'border-slate-700/50' : 'border-gray-100', iconBg: isDark ? 'bg-blue-500/10' : 'bg-blue-50' },
    success: { bg: isDark ? 'from-emerald-900/40 to-slate-800/50' : 'from-emerald-50 to-white', border: isDark ? 'border-emerald-500/30' : 'border-emerald-100', iconBg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-100' },
    warning: { bg: isDark ? 'from-amber-900/40 to-slate-800/50' : 'from-amber-50 to-white', border: isDark ? 'border-amber-500/30' : 'border-amber-100', iconBg: isDark ? 'bg-amber-500/10' : 'bg-amber-100' },
    danger: { bg: isDark ? 'from-red-900/40 to-slate-800/50' : 'from-red-50 to-white', border: isDark ? 'border-red-500/30' : 'border-red-100', iconBg: isDark ? 'bg-red-500/10' : 'bg-red-100' },
    info: { bg: isDark ? 'from-blue-900/40 to-slate-800/50' : 'from-blue-50 to-white', border: isDark ? 'border-blue-500/30' : 'border-blue-100', iconBg: isDark ? 'bg-blue-500/10' : 'bg-blue-100' },
  }
  const style = variantStyles[variant]

  return (
    <div className={`group relative rounded-2xl p-5 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-gradient-to-br ${style.bg} border ${style.border} ${!isDark && variant === 'default' ? 'shadow-lg shadow-gray-200/50' : ''}`}>
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity ${glowColor}`}></div>
      <div className="relative flex items-start justify-between">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>{title}</p>
          <p className={`text-3xl font-bold mt-2 tracking-tight ${valueColorClass || (isDark ? 'text-white' : 'text-gray-900')}`}>{value}</p>
          {subtitle && <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${style.iconBg}`}>
          <Icon className={`w-6 h-6 ${iconColorClass || (isDark ? 'text-blue-400' : 'text-blue-500')}`} />
        </div>
      </div>
    </div>
  )
}

// 表单输入组件
interface FormInputProps {
  label: string
  value: string | number
  onChange: (value: string) => void
  type?: 'text' | 'number' | 'password' | 'email' | 'time'
  placeholder?: string
  disabled?: boolean
  readOnly?: boolean
  min?: number
  max?: number
  hint?: string
}

export const FormInput: React.FC<FormInputProps> = ({
  label, value, onChange, type = 'text', placeholder, disabled, readOnly, min, max, hint
}) => {
  const { isDark } = useTheme()
  return (
    <div>
      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        min={min}
        max={max}
        className={`w-full px-3 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
          isDark 
            ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' 
            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
        } ${readOnly || disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      />
      {hint && <p className={`text-xs mt-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{hint}</p>}
    </div>
  )
}

// 表单选择组件
interface FormSelectProps {
  label: string
  value: string | number
  onChange: (value: string) => void
  options: { value: string | number; label: string }[]
  disabled?: boolean
}

export const FormSelect: React.FC<FormSelectProps> = ({ label, value, onChange, options, disabled }) => {
  const { isDark } = useTheme()
  return (
    <div>
      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full px-3 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
          isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  )
}

// 表单开关组件
interface FormSwitchProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export const FormSwitch: React.FC<FormSwitchProps> = ({ label, description, checked, onChange, disabled }) => {
  const { isDark } = useTheme()
  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{label}</h3>
        {description && <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{description}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} className="sr-only peer" />
        <div className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm peer-checked:bg-gradient-to-r peer-checked:from-blue-500 peer-checked:to-cyan-500 ${isDark ? 'bg-slate-600' : 'bg-gray-300'}`}></div>
      </label>
    </div>
  )
}

// 表单复选框组件
interface FormCheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export const FormCheckbox: React.FC<FormCheckboxProps> = ({ label, checked, onChange, disabled }) => {
  const { isDark } = useTheme()
  return (
    <label className="flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className={`w-4 h-4 rounded border-2 mr-3 transition-colors ${
          isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'
        } checked:bg-blue-500 checked:border-blue-500 focus:ring-2 focus:ring-blue-500`}
      />
      <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{label}</span>
    </label>
  )
}

// 加载状态组件
interface LoadingStateProps {
  message?: string
  icon?: LucideIcon
}

export const SettingsLoadingState: React.FC<LoadingStateProps> = ({ message = '正在加载...', icon: Icon }) => {
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

// 消息提示组件
interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  onClose?: () => void
}

export const SettingsAlert: React.FC<AlertProps> = ({ type, message, onClose }) => {
  const { isDark } = useTheme()
  const styles = {
    success: { bg: isDark ? 'bg-emerald-900/30 border-emerald-500/50' : 'bg-emerald-50 border-emerald-200', text: isDark ? 'text-emerald-300' : 'text-emerald-700', icon: '✓' },
    error: { bg: isDark ? 'bg-red-900/30 border-red-500/50' : 'bg-red-50 border-red-200', text: isDark ? 'text-red-300' : 'text-red-700', icon: '✕' },
    warning: { bg: isDark ? 'bg-amber-900/30 border-amber-500/50' : 'bg-amber-50 border-amber-200', text: isDark ? 'text-amber-300' : 'text-amber-700', icon: '⚠' },
    info: { bg: isDark ? 'bg-blue-900/30 border-blue-500/50' : 'bg-blue-50 border-blue-200', text: isDark ? 'text-blue-300' : 'text-blue-700', icon: 'ℹ' },
  }
  const style = styles[type]
  
  return (
    <div className={`mb-4 p-4 rounded-xl border ${style.bg} flex items-center justify-between`}>
      <div className="flex items-center">
        <span className={`mr-3 text-lg ${style.text}`}>{style.icon}</span>
        <span className={style.text}>{message}</span>
      </div>
      {onClose && (
        <button onClick={onClose} className={`${style.text} hover:opacity-70`}>✕</button>
      )}
    </div>
  )
}

// 快速操作按钮组件
interface QuickActionProps {
  label: string
  icon?: LucideIcon
  onClick: () => void
  variant?: 'default' | 'primary' | 'danger'
  disabled?: boolean
}

export const QuickAction: React.FC<QuickActionProps> = ({ label, icon: Icon, onClick, variant = 'default', disabled }) => {
  const { isDark } = useTheme()
  const variants = {
    default: isDark ? 'bg-slate-700/50 border-slate-600 text-gray-300 hover:bg-slate-600' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50',
    primary: 'bg-gradient-to-r from-blue-500 to-cyan-500 border-transparent text-white hover:from-blue-600 hover:to-cyan-600',
    danger: isDark ? 'bg-red-900/30 border-red-500/50 text-red-300 hover:bg-red-900/50' : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100',
  }
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center px-4 py-3 rounded-xl border text-sm font-medium transition-all ${variants[variant]} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {Icon && <Icon className="w-4 h-4 mr-3" />}
      {label}
    </button>
  )
}

export default SettingsPageLayout
