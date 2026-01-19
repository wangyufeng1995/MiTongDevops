import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, Server } from 'lucide-react'
import type { K8sCluster } from '../../types/k8s'
import { StatusBadge } from './StatusBadge'

/**
 * ClusterSelector组件属�?
 */
interface ClusterSelectorProps {
  clusters: K8sCluster[]
  selectedClusterId?: number
  onSelect: (cluster: K8sCluster) => void
  loading?: boolean
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * ClusterSelector组件
 * 
 * 集群下拉选择器组件，支持搜索和状态显�?
 * 
 * @example
 * <ClusterSelector
 *   clusters={clusters}
 *   selectedClusterId={selectedId}
 *   onSelect={handleSelect}
 *   placeholder="选择集群"
 * />
 */
export const ClusterSelector: React.FC<ClusterSelectorProps> = ({
  clusters,
  selectedClusterId,
  onSelect,
  loading = false,
  placeholder = '选择集群',
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedCluster = clusters.find(c => c.id === selectedClusterId)

  // 过滤集群列表
  const filteredClusters = clusters.filter(cluster =>
    cluster.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cluster.api_server.toLowerCase().includes(searchTerm.toLowerCase())
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

  const handleSelect = (cluster: K8sCluster) => {
    onSelect(cluster)
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
          <Server className="w-5 h-5 text-gray-400 flex-shrink-0" />
          {selectedCluster ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {selectedCluster.name}
              </span>
              <StatusBadge status={selectedCluster.status} size="sm" showIcon={false} />
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
                placeholder="搜索集群..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 集群列表 */}
          <div className="max-h-64 overflow-y-auto">
            {filteredClusters.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {searchTerm ? '未找到匹配的集群' : '暂无集群'}
              </div>
            ) : (
              filteredClusters.map((cluster) => (
                <button
                  key={cluster.id}
                  type="button"
                  onClick={() => handleSelect(cluster)}
                  className={`
                    w-full px-4 py-3 flex items-center justify-between gap-2
                    hover:bg-gray-50 dark:hover:bg-gray-700
                    transition-colors duration-150
                    ${cluster.id === selectedClusterId ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                  `}
                  role="option"
                  aria-selected={cluster.id === selectedClusterId}
                >
                  <div className="flex flex-col items-start gap-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {cluster.name}
                      </span>
                      <StatusBadge status={cluster.status} size="sm" showIcon={false} />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate w-full">
                      {cluster.api_server}
                    </span>
                    {cluster.version && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        v{cluster.version}
                      </span>
                    )}
                  </div>
                  {cluster.node_count !== undefined && (
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {cluster.node_count} 节点
                      </span>
                      {cluster.pod_count !== undefined && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {cluster.pod_count} Pods
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

export default ClusterSelector
