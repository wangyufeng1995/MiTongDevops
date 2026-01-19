/**
 * 通用表单卡片组件
 * 提供统一的表单区域布局和样式
 */
import React from 'react'
import { LucideIcon } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'

// 表单卡片
interface FormCardProps {
  title?: string
  subtitle?: string
  icon?: LucideIcon
  children: React.ReactNode
  headerActions?: React.ReactNode
  footer?: React.ReactNode
  className?: string
  noPadding?: boolean
}

export const FormCard: React.FC<FormCardProps> = ({
  title, subtitle, icon: Icon, children, headerActions, footer, className = '', noPadding = false
}) => {
  const { isDark } = useTheme()
  
  return (
    <div className={`rounded-2xl overflow-hidden ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-lg shadow-gray-200/50'} ${className}`}>
      {title && (
        <div className={`px-6 py-4 border-b ${isDark ? 'border-slate-700/50' : 'border-gray-100'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {Icon && (
                <div className={`p-2 rounded-xl ${isDark ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20' : 'bg-gradient-to-br from-blue-50 to-cyan-50'}`}>
                  <Icon className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                </div>
              )}
              <div>
                <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
                {subtitle && <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{subtitle}</p>}
              </div>
            </div>
            {headerActions}
          </div>
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>{children}</div>
      {footer && (
        <div className={`px-6 py-4 border-t ${isDark ? 'border-slate-700/50 bg-slate-800/30' : 'border-gray-100 bg-gray-50'}`}>
          {footer}
        </div>
      )}
    </div>
  )
}

// 表单输入组件
interface FormInputProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}

export const FormInput: React.FC<FormInputProps> = ({
  label, required, error, hint, children, className = ''
}) => {
  const { isDark } = useTheme()
  
  return (
    <div className={className}>
      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
      {hint && !error && <p className={`mt-1.5 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{hint}</p>}
    </div>
  )
}

// 表单文本输入
interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  icon?: React.ReactNode
}

export const TextInput: React.FC<TextInputProps> = ({ error, icon, className = '', ...props }) => {
  const { isDark } = useTheme()
  const baseClass = `w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 ${
    error 
      ? 'border-red-500' 
      : isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
  } ${icon ? 'pl-10' : ''} ${className}`
  
  if (icon) {
    return (
      <div className="relative">
        <div className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {icon}
        </div>
        <input className={baseClass} {...props} />
      </div>
    )
  }
  
  return <input className={baseClass} {...props} />
}

// 表单文本域
interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const TextArea: React.FC<TextAreaProps> = ({ error, className = '', ...props }) => {
  const { isDark } = useTheme()
  
  return (
    <textarea
      className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 ${
        error 
          ? 'border-red-500' 
          : isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
      } ${className}`}
      {...props}
    />
  )
}

// 表单选择框
interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
  options: { value: string | number; label: string }[]
}

export const SelectInput: React.FC<SelectInputProps> = ({ error, options, className = '', ...props }) => {
  const { isDark } = useTheme()
  
  return (
    <select
      className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 ${
        error 
          ? 'border-red-500' 
          : isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
      } ${className}`}
      {...props}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

// 表单复选框
interface CheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  description?: string
  disabled?: boolean
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, checked, onChange, description, disabled }) => {
  const { isDark } = useTheme()
  
  return (
    <label className={`flex items-start space-x-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className="flex items-center h-5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className={`w-4 h-4 rounded border focus:ring-2 focus:ring-blue-500/50 ${
            isDark ? 'bg-slate-700 border-slate-600 text-blue-500' : 'bg-white border-gray-300 text-blue-600'
          }`}
        />
      </div>
      <div>
        <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{label}</span>
        {description && <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{description}</p>}
      </div>
    </label>
  )
}

// 状态标签
interface StatusBadgeProps {
  status: 'success' | 'error' | 'warning' | 'info' | 'default'
  children: React.ReactNode
  icon?: React.ReactNode
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, children, icon }) => {
  const { isDark } = useTheme()
  
  const styles = {
    success: isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    error: isDark ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-red-50 text-red-700 border-red-200',
    warning: isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200',
    info: isDark ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200',
    default: isDark ? 'bg-slate-700/50 text-gray-300 border-slate-600' : 'bg-gray-100 text-gray-600 border-gray-200',
  }
  
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${styles[status]}`}>
      {icon && <span className="mr-1.5">{icon}</span>}
      {children}
    </span>
  )
}

// 操作按钮组
interface ActionButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  children: React.ReactNode
  loading?: boolean
  disabled?: boolean
  onClick?: () => void
  className?: string
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  variant = 'primary', size = 'md', icon, children, loading, disabled, onClick, className = ''
}) => {
  const { isDark } = useTheme()
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  }
  
  const variantStyles = {
    primary: 'text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-lg shadow-blue-500/25',
    secondary: isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50 border border-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200',
    danger: isDark ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30' : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200',
    success: isDark ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200',
    ghost: isDark ? 'text-gray-400 hover:text-gray-300 hover:bg-slate-700/50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
  }
  
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {loading ? (
        <svg className="animate-spin w-4 h-4 mr-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : icon ? (
        <span className="mr-2">{icon}</span>
      ) : null}
      {children}
    </button>
  )
}

export default FormCard
