import React, { useState, useCallback } from 'react'
import { Search, X, Filter, RotateCcw } from 'lucide-react'
import { clsx } from 'clsx'
import { debounce } from '../../../utils'

export interface SearchField {
  name: string
  label: string
  type: 'text' | 'select' | 'date' | 'dateRange'
  placeholder?: string
  options?: { value: string | number; label: string }[]
  defaultValue?: any
}

export interface SearchFormProps {
  fields?: SearchField[]
  onSearch: (values: Record<string, any>) => void
  onReset?: () => void
  loading?: boolean
  showAdvanced?: boolean
  debounceMs?: number
  className?: string
}

export const SearchForm: React.FC<SearchFormProps> = ({
  fields = [],
  onSearch,
  onReset,
  loading = false,
  showAdvanced = false,
  debounceMs = 300,
  className
}) => {
  const [values, setValues] = useState<Record<string, any>>({})
  const [showAdvancedFields, setShowAdvancedFields] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // 确保 fields 是数组
  const safeFields = Array.isArray(fields) ? fields : []

  // 防抖搜索
  const debouncedSearch = useCallback(
    debounce((searchValues: Record<string, any>) => {
      onSearch(searchValues)
    }, debounceMs),
    [onSearch, debounceMs]
  )

  // 处理值变化
  const handleValueChange = (name: string, value: any) => {
    const newValues = { ...values, [name]: value }
    setValues(newValues)
    
    // 自动搜索（除了日期范围需要两个值都填写）
    const field = safeFields.find(f => f.name === name)
    if (field?.type === 'dateRange') {
      // 日期范围需要开始和结束日期都有值才搜索
      const [startName, endName] = name.split(',')
      if (newValues[startName] && newValues[endName]) {
        debouncedSearch(newValues)
      }
    } else {
      debouncedSearch(newValues)
    }
  }

  // 处理重置
  const handleReset = () => {
    setValues({})
    setShowAdvancedFields(false)
    onReset?.()
    onSearch({})
  }

  // 处理搜索
  const handleSearch = () => {
    onSearch(values)
  }

  // 获取基础字段（前3个）和高级字段
  const basicFields = safeFields.slice(0, 3)
  const advancedFields = safeFields.slice(3)
  const hasAdvancedFields = advancedFields.length > 0

  // 渲染字段
  const renderField = (field: SearchField) => {
    const value = values[field.name] || field.defaultValue || ''

    switch (field.type) {
      case 'text':
        return (
          <div key={field.name} className="flex-1 min-w-[200px]">
            <div className="relative">
              <input
                type="text"
                placeholder={field.placeholder || `请输入${field.label}`}
                value={value}
                onChange={(e) => handleValueChange(field.name, e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              {value && (
                <button
                  type="button"
                  onClick={() => handleValueChange(field.name, '')}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )

      case 'select':
        return (
          <div key={field.name} className="flex-1 min-w-[150px]">
            <select
              value={value}
              onChange={(e) => handleValueChange(field.name, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{field.placeholder || `请选择${field.label}`}</option>
              {field.options?.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )

      case 'date':
        return (
          <div key={field.name} className="flex-1 min-w-[150px]">
            <input
              type="date"
              value={value}
              onChange={(e) => handleValueChange(field.name, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )

      case 'dateRange':
        const [startName, endName] = field.name.split(',')
        const startValue = values[startName] || ''
        const endValue = values[endName] || ''
        
        return (
          <div key={field.name} className="flex items-center space-x-2 min-w-[300px]">
            <input
              type="date"
              value={startValue}
              onChange={(e) => handleValueChange(startName, e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-gray-500">至</span>
            <input
              type="date"
              value={endValue}
              onChange={(e) => handleValueChange(endName, e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )

      default:
        return null
    }
  }

  // 检查是否有搜索条件
  const hasSearchValues = Object.values(values).some(value => 
    value !== '' && value !== null && value !== undefined
  )

  return (
    <div className={clsx('bg-white p-4 rounded-lg border border-gray-200', className)}>
      {/* 基础搜索字段 */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        {basicFields.map(renderField)}
        
        {/* 操作按钮 */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Search className="w-4 h-4" />
            <span>{loading ? '搜索中...' : '搜索'}</span>
          </button>
          
          {hasSearchValues && (
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 flex items-center space-x-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>重置</span>
            </button>
          )}
          
          {hasAdvancedFields && showAdvanced && (
            <button
              type="button"
              onClick={() => setShowAdvancedFields(!showAdvancedFields)}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 flex items-center space-x-2"
            >
              <Filter className="w-4 h-4" />
              <span>{showAdvancedFields ? '收起' : '高级'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 高级搜索字段 */}
      {hasAdvancedFields && showAdvanced && showAdvancedFields && (
        <div className="border-t border-gray-200 pt-4">
          <div className="flex flex-wrap items-center gap-4">
            {advancedFields.map(renderField)}
          </div>
        </div>
      )}

      {/* 搜索条件摘要 */}
      {hasSearchValues && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>当前搜索条件：</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(values).map(([key, value]) => {
                if (!value) return null
                const field = safeFields.find(f => f.name === key || f.name.includes(key))
                if (!field) return null
                
                return (
                  <span
                    key={key}
                    className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs"
                  >
                    {field.label}: {value}
                    <button
                      type="button"
                      onClick={() => handleValueChange(key, '')}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchForm