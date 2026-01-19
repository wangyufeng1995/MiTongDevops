import React, { forwardRef, useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { useTheme } from '../../../hooks/useTheme'

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
  description?: string
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string
  error?: string
  helperText?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'outlined' | 'filled'
  options: SelectOption[]
  placeholder?: string
  searchable?: boolean
  clearable?: boolean
  loading?: boolean
  required?: boolean
  onSelectionChange?: (value: string | number | null) => void
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  helperText,
  size = 'md',
  variant = 'outlined',
  options,
  placeholder = '请选择...',
  searchable = false,
  clearable = false,
  loading = false,
  required = false,
  disabled,
  value,
  onSelectionChange,
  className,
  ...props
}, ref) => {
  const { isDark } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedValue, setSelectedValue] = useState<string | number | null>(value || null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 过滤选项
  const filteredOptions = searchable
    ? options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options

  // 获取选中项的标签
  const selectedOption = options.find(option => option.value === selectedValue)
  const displayValue = selectedOption ? selectedOption.label : placeholder

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  }

  const variantClasses = {
    outlined: isDark ? 'border border-gray-600 bg-gray-700/50' : 'border border-gray-300 bg-white',
    filled: isDark ? 'border-0 bg-gray-700' : 'border-0 bg-gray-100'
  }

  const selectClasses = clsx(
    'w-full rounded-md transition-colors duration-200 cursor-pointer',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
    isDark ? 'disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed' : 'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
    sizeClasses[size],
    variantClasses[variant],
    {
      'border-red-300 focus:border-red-500 focus:ring-red-500': error,
      'pr-10': true, // 为下拉箭头留空间
    },
    className
  )

  const labelClasses = clsx(
    'block text-sm font-medium mb-1',
    {
      [isDark ? 'text-gray-300' : 'text-gray-700']: !error,
      'text-red-500': error,
    }
  )

  // 处理选项选择
  const handleOptionSelect = (option: SelectOption) => {
    if (option.disabled) return
    
    setSelectedValue(option.value)
    setIsOpen(false)
    setSearchTerm('')
    onSelectionChange?.(option.value)
  }

  // 处理清除
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedValue(null)
    onSelectionChange?.(null)
  }

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 打开时聚焦搜索框
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen, searchable])

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className={labelClasses}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {/* 隐藏的原生 select 用于表单提交 */}
        <select
          ref={ref}
          value={selectedValue || ''}
          className="sr-only"
          disabled={disabled}
          {...props}
        >
          <option value="">{placeholder}</option>
          {options.map(option => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>

        {/* 自定义选择器 */}
        <div
          className={selectClasses}
          onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        >
          <div className="flex items-center justify-between">
            <span className={clsx(
              'truncate',
              selectedValue ? (isDark ? 'text-gray-200' : 'text-gray-900') : (isDark ? 'text-gray-500' : 'text-gray-400')
            )}>
              {loading ? '加载中...' : displayValue}
            </span>
            
            <div className="flex items-center space-x-1">
              {clearable && selectedValue && !disabled && (
                <button
                  type="button"
                  onClick={handleClear}
                  className={`p-1 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  ×
                </button>
              )}
              <ChevronDown className={clsx(
                'w-4 h-4 transition-transform',
                isDark ? 'text-gray-500' : 'text-gray-400',
                isOpen && 'transform rotate-180'
              )} />
            </div>
          </div>
        </div>

        {/* 下拉选项 */}
        {isOpen && !disabled && !loading && (
          <div className={`absolute z-50 w-full mt-1 border rounded-md shadow-lg max-h-60 overflow-auto ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}`}>
            {searchable && (
              <div className={`p-2 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <input
                  ref={searchInputRef}
                  type="text"
                  className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500' : 'border-gray-300 text-gray-900'}`}
                  placeholder="搜索选项..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            )}
            
            <div className="py-1">
              {filteredOptions.length === 0 ? (
                <div className={`px-3 py-2 text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  {searchTerm ? '未找到匹配项' : '暂无选项'}
                </div>
              ) : (
                filteredOptions.map(option => (
                  <div
                    key={option.value}
                    className={clsx(
                      'px-3 py-2 cursor-pointer flex items-center justify-between',
                      {
                        [isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100']: !option.disabled,
                        [isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700']: selectedValue === option.value,
                        [isDark ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 cursor-not-allowed']: option.disabled,
                      }
                    )}
                    onClick={() => handleOptionSelect(option)}
                  >
                    <div>
                      <div className={`text-sm ${isDark && !option.disabled && selectedValue !== option.value ? 'text-gray-200' : ''}`}>{option.label}</div>
                      {option.description && (
                        <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{option.description}</div>
                      )}
                    </div>
                    {selectedValue === option.value && (
                      <Check className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      
      {(error || helperText) && (
        <div className="mt-1 flex items-center">
          {error && (
            <>
              <AlertCircle className="w-4 h-4 text-red-500 mr-1" />
              <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
            </>
          )}
          {!error && helperText && (
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{helperText}</p>
          )}
        </div>
      )}
    </div>
  )
})

Select.displayName = 'Select'

export default Select