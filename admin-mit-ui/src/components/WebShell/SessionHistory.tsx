/**
 * WebShell 会话历史记录组件
 */
import React, { useState, useMemo } from 'react'
import { Clock, Server, Terminal, CheckCircle, XCircle, AlertCircle, Search, Filter, Trash2 } from 'lucide-react'
import { SessionHistoryRecord, SessionStatistics } from '../../types/webshell'
import { formatDateTime } from '../../utils'

export interface SessionHistoryProps {
  history: SessionHistoryRecord[]
  statistics: SessionStatistics
  onDeleteSession?: (sessionId: string) => void
  onClearHistory?: () => void
  className?: string
}

const SessionHistory: React.FC<SessionHistoryProps> = ({
  history,
  statistics,
  onDeleteSession,
  onClearHistory,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'interrupted' | 'error'>('all')
  const [sortBy, setSortBy] = useState<'startTime' | 'duration' | 'commandCount'>('startTime')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // 过滤和排序历史记录
  const filteredAndSortedHistory = useMemo(() => {
    let filtered = history

    // 搜索过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(record => 
        record.hostName.toLowerCase().includes(term) ||
        record.hostname.toLowerCase().includes(term) ||
        record.lastCommand?.toLowerCase().includes(term)
      )
    }

    // 状态过滤
    if (statusFilter !== 'all') {
      filtered = filtered.filter(record => record.status === statusFilter)
    }

    // 排序
    filtered.sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'startTime':
          aValue = new Date(a.startTime).getTime()
          bValue = new Date(b.startTime).getTime()
          break
        case 'duration':
          aValue = a.duration || 0
          bValue = b.duration || 0
          break
        case 'commandCount':
          aValue = a.commandCount
          bValue = b.commandCount
          break
        default:
          return 0
      }

      if (sortOrder === 'asc') {
        return aValue - bValue
      } else {
        return bValue - aValue
      }
    })

    return filtered
  }, [history, searchTerm, statusFilter, sortBy, sortOrder])

  // 格式化时长
  const formatDuration = (duration?: number) => {
    if (!duration) return '-'
    
    const seconds = Math.floor(duration / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  // 格式化时间
  const formatTime = (timeString: string) => {
    return formatDateTime(timeString, 'YYYY/MM/DD HH:mm:ss')
  }

  // 获取状态图标和颜色
  const getStatusConfig = (status: SessionHistoryRecord['status']) => {
    switch (status) {
      case 'completed':
        return {
          icon: <CheckCircle size={16} />,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          label: '正常结束'
        }
      case 'interrupted':
        return {
          icon: <XCircle size={16} />,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          label: '中断'
        }
      case 'error':
        return {
          icon: <AlertCircle size={16} />,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          label: '错误'
        }
      default:
        return {
          icon: <Clock size={16} />,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          label: '未知'
        }
    }
  }

  // 处理排序
  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm ${className}`}>
      {/* 统计信息 */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">会话统计</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{statistics.totalSessions}</div>
            <div className="text-sm text-gray-500">总会话数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{statistics.activeSessions}</div>
            <div className="text-sm text-gray-500">活动会话</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{statistics.totalCommands}</div>
            <div className="text-sm text-gray-500">总命令数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {formatDuration(statistics.averageSessionDuration)}
            </div>
            <div className="text-sm text-gray-500">平均时长</div>
          </div>
        </div>
      </div>

      {/* 搜索和过滤 */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* 搜索框 */}
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索主机名、IP 或命令..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* 状态过滤 */}
          <div className="flex items-center space-x-2">
            <Filter size={20} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">所有状态</option>
              <option value="completed">正常结束</option>
              <option value="interrupted">中断</option>
              <option value="error">错误</option>
            </select>
          </div>

          {/* 清空历史按钮 */}
          {onClearHistory && (
            <button
              onClick={onClearHistory}
              className="flex items-center space-x-2 px-4 py-2 text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
            >
              <Trash2 size={16} />
              <span>清空历史</span>
            </button>
          )}
        </div>
      </div>

      {/* 历史记录列表 */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('startTime')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>开始时间</span>
                  {sortBy === 'startTime' && (
                    <span className="text-blue-500">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                主机信息
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('duration')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>持续时间</span>
                  {sortBy === 'duration' && (
                    <span className="text-blue-500">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('commandCount')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>命令数</span>
                  {sortBy === 'commandCount' && (
                    <span className="text-blue-500">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                最后命令
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedHistory.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  {searchTerm || statusFilter !== 'all' ? '没有找到匹配的会话记录' : '暂无会话历史记录'}
                </td>
              </tr>
            ) : (
              filteredAndSortedHistory.map((record) => {
                const statusConfig = getStatusConfig(record.status)
                
                return (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center space-x-2 px-2 py-1 rounded-full text-sm ${statusConfig.bgColor} ${statusConfig.color}`}>
                        {statusConfig.icon}
                        <span>{statusConfig.label}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center space-x-2">
                        <Clock size={16} className="text-gray-400" />
                        <span>{formatTime(record.startTime)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Server size={16} className="text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{record.hostName}</div>
                          <div className="text-sm text-gray-500">{record.hostname}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDuration(record.duration)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Terminal size={16} className="text-gray-400" />
                        <span className="text-sm text-gray-900">{record.commandCount}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="text-sm text-gray-900 truncate" title={record.lastCommand}>
                        {record.lastCommand || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {onDeleteSession && (
                        <button
                          onClick={() => onDeleteSession(record.sessionId)}
                          className="text-red-600 hover:text-red-900"
                        >
                          删除
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SessionHistory