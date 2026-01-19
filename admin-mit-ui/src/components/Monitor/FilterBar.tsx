/**
 * 通用筛选栏组件
 * 提供统一的筛选区域布局和样式
 */
import React from 'react'
import { Search, Calendar, Filter, X } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'

// 筛选项类型
export interface FilterItem {
  key: string
  label: string
  type: 'text' | 'select' | 'date' | 'dateRange'
  placeholder?: string
  options?: { value: string; label: string }[]
  width?: 'xs' | 'sm' | 'md' | 'lg' // xs=100px, sm=140px, md=180px, lg=240px
  icon?: React.ReactNode
}

interface FilterBarProps {
  filters: FilterItem[]
  values: Record<string, any>
  onChange: (key: string, value: any) => void
  onSearch?: () => void
  onReset?: () => void
  showSearch?: boolean
  showReset?: boolean
  className?: string
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters, values, onChange, onSearch, onReset, showSearch = true, showReset = true, className = ''
}) => {
  const { isDark } = useTheme()

  const widthMap = { xs: 'w-24', sm: 'w-36', md: 'w-44', lg: 'w-64' }
  const inputBase = `px-3 py-2 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 ${
    isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
  }`

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSearch) onSearch()
  }

  const hasActiveFilters = Object.values(values).some(v => v !== undefined && v !== '')

  return (
    <div className={`flex flex-wrap items-end gap-3 ${className}`}>
      {filters.map((filter) => (
        <div key={filter.key} className={widthMap[filter.width || 'sm']}>
          <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {filter.label}
          </label>
          {filter.type === 'text' && (
            <div className="relative">
              {filter.icon || <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />}
              <input
                type="text"
                value={values[filter.key] || ''}
                onChange={(e) => onChange(filter.key, e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={filter.placeholder}
                className={`${inputBase} w-full ${filter.icon ? 'pl-9' : 'pl-9'}`}
              />
            </div>
          )}
          {filter.type === 'select' && (
            <select
              value={values[filter.key] || ''}
              onChange={(e) => onChange(filter.key, e.target.value)}
              className={`${inputBase} w-full`}
            >
              {filter.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
          {filter.type === 'date' && (
            <div className="relative">
              <Calendar className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              <input
                type="date"
                value={values[filter.key]?.split('T')[0] || ''}
                onChange={(e) => onChange(filter.key, e.target.value ? `${e.target.value}T00:00:00Z` : undefined)}
                className={`${inputBase} w-full pl-9`}
              />
            </div>
          )}
        </div>
      ))}
      
      <div className="flex items-center gap-2 pb-0.5">
        {showSearch && onSearch && (
          <button
            onClick={onSearch}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              isDark ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>筛选</span>
          </button>
        )}
        {showReset && onReset && hasActiveFilters && (
          <button
            onClick={onReset}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              isDark ? 'bg-slate-700/50 text-gray-400 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <X className="w-4 h-4" />
            <span>重置</span>
          </button>
        )}
      </div>
    </div>
  )
}

// 快捷筛选标签组件
interface QuickFilterProps {
  options: { value: string; label: string; count?: number }[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export const QuickFilter: React.FC<QuickFilterProps> = ({ options, value, onChange, className = '' }) => {
  const { isDark } = useTheme()
  
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            value === opt.value
              ? isDark ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-blue-50 text-blue-600 border border-blue-200'
              : isDark ? 'bg-slate-700/30 text-gray-400 border border-slate-600/30 hover:bg-slate-700/50' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          {opt.label}
          {opt.count !== undefined && (
            <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs ${
              value === opt.value
                ? isDark ? 'bg-blue-500/30' : 'bg-blue-100'
                : isDark ? 'bg-slate-600/50' : 'bg-gray-200'
            }`}>
              {opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export default FilterBar
