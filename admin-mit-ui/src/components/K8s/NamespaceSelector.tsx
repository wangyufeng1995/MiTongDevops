import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, Layers } from 'lucide-react'
import type { K8sNamespace } from '../../types/k8s'
import { StatusBadge } from './StatusBadge'

/**
 * NamespaceSelector组件属�?
 */
interface NamespaceSelectorProps {
  namespaces: K8sNamespace[]
  selectedNamespace?: string
  onSelect: (namespace: K8sNamespace) => void
  loading?: boolean
  placeholder?: string
  className?: string
  disabled?: boolean
  showStatus?: boolean
}

/**
 * NamespaceSelector组件
 * 
 * 命名空间下拉选择器组件，支持搜索
 * 
 * @example
 * <NamespaceSelector
 *   namespaces={namespaces}
 *   selectedNamespace={selectedName}
 *   onSelect={handleSelect}
 *   placeholder="选择命名空间"
 * />
 */
export const NamespaceSelector: React.FC<NamespaceSelectorProps> = ({
  namespaces,
  selectedNamespace,
  onSelect,
  loading = false,
  placeholder = '选择命名空间',
  className = '',
  disabled = false,
  showStatus = true
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selected = namespaces.find(ns => ns.name === selectedNamespace)

  // 过滤命名空间列表
  const filteredNamespaces = namespaces.filter(namespace =>
    namespace.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 点击外部关闭下拉�?
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      // 自动聚焦搜索�?
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (namespace: K8sNamespace) => {
    onSelect(namespace)
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleToggle = () => {
    if (!disabled && !loading) {
      setIsOpen(!isOpen)
    }
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* 选择器按�?*/}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || loading}
        className={`
          w-full flex items-center justify-between gap-2 px-4 py-2.5
          bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
          rounded-lg shadow-sm
          hover:border-blue-500 dark:hover:border-blue-400
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          transition-colors duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isOpen ? 'ring-2 ring-blue-500 border-transparent' : ''}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Layers className="w-5 h-5 text-gray-400 flex-shrink-0" />
          {selected ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {selected.name}
              </span>
              {showStatus && (
                <StatusBadge status={selected.status} size="sm" showIcon={false} />
              )}
            </div>
          ) : (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {loading ? '加载�?..' : placeholder}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>

      {/* 下拉列表 */}
      {isOpen && (
        <div
          className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden"
          role="listbox"
        >
          {/* 搜索�?*/}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索命名空间..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 命名空间列表 */}
          <div className="max-h-64 overflow-y-auto">
            {filteredNamespaces.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {searchTerm ? '未找到匹配的命名空间' : '暂无命名空间'}
              </div>
            ) : (
              filteredNamespaces.map((namespace) => (
                <button
                  key={namespace.name}
                  type="button"
                  onClick={() => handleSelect(namespace)}
                  className={`
                    w-full px-4 py-3 flex items-center justify-between gap-2
                    hover:bg-gray-50 dark:hover:bg-gray-700
                    transition-colors duration-150
                    ${namespace.name === selectedNamespace ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                  `}
                  role="option"
                  aria-selected={namespace.name === selectedNamespace}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {namespace.name}
                    </span>
                    {showStatus && (
                      <StatusBadge status={namespace.status} size="sm" showIcon={false} />
                    )}
                  </div>
                  {namespace.resource_quota && (
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      {namespace.resource_quota.pods_used !== undefined && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {namespace.resource_quota.pods_used}
                          {namespace.resource_quota.pods_limit && ` / ${namespace.resource_quota.pods_limit}`} Pods
                        </span>
                      )}
                      {namespace.resource_quota.cpu_used && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          CPU: {namespace.resource_quota.cpu_used}
                          {namespace.resource_quota.cpu_limit && ` / ${namespace.resource_quota.cpu_limit}`}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NamespaceSelector
