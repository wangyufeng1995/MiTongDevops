/**
 * 主机选择组件
 * 提供主机列表展示、搜索、筛选和选择功能
 */
import React, { useState, useCallback, useMemo } from 'react'
import {
  Server,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  RefreshCw
} from 'lucide-react'
import { Host } from '../../types/host'
import { formatDateTime } from '../../utils'

export interface HostSelectorProps {
  hosts: Host[]
  selectedHostIds: number[]
  onSelectionChange: (hostIds: number[]) => void
  loading?: boolean
  error?: string
  onRefresh?: () => void
  multiSelect?: boolean
  showStatus?: boolean
  showMetrics?: boolean
  className?: string
}

interface HostFilter {
  status: 'all' | 'online' | 'offline'
  authType: 'all' | 'password' | 'key'
  search: string
}

const HostSelector: React.FC<HostSelectorProps> = ({
  hosts,
  selectedHostIds,
  onSelectionChange,
  loading = false,
  error,
  onRefresh,
  multiSelect = true,
  showStatus = true,
  showMetrics = false,
  className = ''
}) => {
  const [filter, setFilter] = useState<HostFilter>({
    status: 'all',
    authType: 'all',
    search: ''
  })
  const [showFilters, setShowFilters] = useState(false)

  // 过滤主机列表
  const filteredHosts = useMemo(() => {
    return hosts.filter(host => {
      // 状态筛选
      if (filter.status === 'online' && host.status !== 1) return false
      if (filter.status === 'offline' && host.status === 1) return false

      // 认证类型筛选
      if (filter.authType !== 'all' && host.auth_type !== filter.authType) return false

      // 搜索筛选
      if (filter.search) {
        const searchLower = filter.search.toLowerCase()
        return (
          host.name.toLowerCase().includes(searchLower) ||
          host.hostname.toLowerCase().includes(searchLower) ||
          (host.description && host.description.toLowerCase().includes(searchLower))
        )
      }

      return true
    })
  }, [hosts, filter])

  // 处理主机选择
  const handleHostSelection = useCallback((hostId: number, selected: boolean) => {
    if (multiSelect) {
      if (selected) {
        onSelectionChange([...selectedHostIds, hostId])
      } else {
        onSelectionChange(selectedHostIds.filter(id => id !== hostId))
      }
    } else {
      onSelectionChange(selected ? [hostId] : [])
    }
  }, [selectedHostIds, onSelectionChange, multiSelect])

  // 处理全选/取消全选
  const handleSelectAll = useCallback((selectAll: boolean) => {
    if (selectAll) {
      const allHostIds = [...new Set([...selectedHostIds, ...filteredHosts.map(h => h.id)])]
      onSelectionChange(allHostIds)
    } else {
      const filteredHostIds = filteredHosts.map(h => h.id)
      onSelectionChange(selectedHostIds.filter(id => !filteredHostIds.includes(id)))
    }
  }, [selectedHostIds, filteredHosts, onSelectionChange])

  // 处理筛选变更
  const handleFilterChange = useCallback((field: keyof HostFilter, value: string) => {
    setFilter(prev => ({ ...prev, [field]: value }))
  }, [])

  // 获取主机状态标签
  const getHostStatusBadge = (host: Host) => {
    const isOnline = host.status === 1
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        {isOnline ? (
          <CheckCircle size={12} className="mr-1" />
        ) : (
          <XCircle size={12} className="mr-1" />
        )}
        {isOnline ? '在线' : '离线'}
      </span>
    )
  }

  // 获取认证类型标签
  const getAuthTypeBadge = (authType: string) => {
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        authType === 'key' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
      }`}>
        {authType === 'key' ? '密钥' : '密码'}
      </span>
    )
  }

  // 格式化时间
  const formatTime = (timeString: string) => {
    return formatDateTime(timeString, 'YYYY/MM/DD HH:mm:ss')
  }

  // 统计信息
  const stats = useMemo(() => {
    const total = hosts.length
    const online = hosts.filter(h => h.status === 1).length
    const selected = selectedHostIds.length
    const filtered = filteredHosts.length

    return { total, online, selected, filtered }
  }, [hosts, selectedHostIds, filteredHosts])

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* 头部 */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Server size={20} className="text-blue-500" />
            <h3 className="text-lg font-medium text-gray-900">主机选择</h3>
            <span className="text-sm text-gray-500">
              ({stats.selected}/{stats.filtered} 已选择)
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                disabled={loading}
                title="刷新主机列表"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-md ${
                showFilters ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              title="筛选选项"
            >
              <Filter size={16} />
            </button>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
          <span>总计: {stats.total}</span>
          <span>在线: {stats.online}</span>
          <span>已筛选: {stats.filtered}</span>
        </div>
      </div>

      {/* 筛选器 */}
      {showFilters && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                主机状态
              </label>
              <select
                value={filter.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">全部状态</option>
                <option value="online">仅在线</option>
                <option value="offline">仅离线</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                认证类型
              </label>
              <select
                value={filter.authType}
                onChange={(e) => handleFilterChange('authType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">全部类型</option>
                <option value="password">密码认证</option>
                <option value="key">密钥认证</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                搜索主机
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索主机名或地址..."
                  value={filter.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 批量操作 */}
      {multiSelect && filteredHosts.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => handleSelectAll(true)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                全选当前页
              </button>
              <button
                onClick={() => handleSelectAll(false)}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                取消全选
              </button>
            </div>
            {selectedHostIds.length > 0 && (
              <span className="text-sm text-gray-600">
                已选择 {selectedHostIds.length} 个主机
              </span>
            )}
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-200">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* 主机列表 */}
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw size={24} className="mx-auto text-gray-400 animate-spin mb-2" />
            <p className="text-sm text-gray-500">加载主机列表...</p>
          </div>
        ) : filteredHosts.length === 0 ? (
          <div className="p-8 text-center">
            <Server size={24} className="mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">
              {filter.search || filter.status !== 'all' || filter.authType !== 'all'
                ? '没有找到匹配的主机'
                : '暂无可用主机'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredHosts.map(host => (
              <div key={host.id} className="p-4 hover:bg-gray-50">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type={multiSelect ? 'checkbox' : 'radio'}
                    name={multiSelect ? undefined : 'host-selection'}
                    checked={selectedHostIds.includes(host.id)}
                    onChange={(e) => handleHostSelection(host.id, e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {host.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {host.hostname}:{host.port} ({host.username})
                        </p>
                        {host.description && (
                          <p className="text-xs text-gray-400 mt-1 truncate">
                            {host.description}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end space-y-1 ml-4">
                        {showStatus && (
                          <div className="flex items-center space-x-2">
                            {getHostStatusBadge(host)}
                            {getAuthTypeBadge(host.auth_type)}
                          </div>
                        )}
                        
                        {host.last_connected_at && (
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <Clock size={12} />
                            <span>{formatTime(host.last_connected_at)}</span>
                          </div>
                        )}
                        
                        {showMetrics && host.latest_metrics && (
                          <div className="text-xs text-gray-500 space-y-1">
                            <div>CPU: {host.latest_metrics.cpu_usage?.toFixed(1)}%</div>
                            <div>内存: {host.latest_metrics.memory_usage?.toFixed(1)}%</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default HostSelector