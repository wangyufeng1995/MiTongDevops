/**
 * Ansible 执行日志实时显示组件
 * 提供日志实时显示、滚动、搜索、级别筛选和导出功能
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Download,
  Search,
  Filter,
  ScrollText,
  Play,
  Pause,
  RotateCcw,
  Copy,
  CheckCircle,
  AlertCircle,
  XCircle,
  Info,
  Zap,
  Clock,
  Terminal,
  Eye,
  EyeOff
} from 'lucide-react'
import { PlaybookExecution } from '../../types/ansible'
import { formatDateTime } from '../../utils'

export interface LogEntry {
  id: string
  timestamp: string
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' | 'TASK' | 'PLAY' | 'RECAP'
  message: string
  host?: string
  task?: string
  module?: string
  raw?: string
}

export interface ExecutionLogDisplayProps {
  execution: PlaybookExecution
  logs: LogEntry[]
  isRealtime?: boolean
  onToggleRealtime?: (enabled: boolean) => void
  onRefresh?: () => void
  loading?: boolean
  className?: string
}

interface LogFilter {
  search: string
  levels: string[]
  hosts: string[]
  showTimestamp: boolean
  showHost: boolean
  showLevel: boolean
}

const LOG_LEVELS = [
  { value: 'DEBUG', label: '调试', color: 'text-gray-500', bgColor: 'bg-gray-100' },
  { value: 'INFO', label: '信息', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  { value: 'WARNING', label: '警告', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  { value: 'ERROR', label: '错误', color: 'text-red-600', bgColor: 'bg-red-100' },
  { value: 'CRITICAL', label: '严重', color: 'text-red-800', bgColor: 'bg-red-200' },
  { value: 'TASK', label: '任务', color: 'text-green-600', bgColor: 'bg-green-100' },
  { value: 'PLAY', label: '剧本', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  { value: 'RECAP', label: '总结', color: 'text-indigo-600', bgColor: 'bg-indigo-100' }
]

const ExecutionLogDisplay: React.FC<ExecutionLogDisplayProps> = ({
  execution,
  logs,
  isRealtime = true,
  onToggleRealtime,
  onRefresh,
  loading = false,
  className = ''
}) => {
  const [filter, setFilter] = useState<LogFilter>({
    search: '',
    levels: [],
    hosts: [],
    showTimestamp: true,
    showHost: true,
    showLevel: true
  })
  
  const [autoScroll, setAutoScroll] = useState(true)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null)
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set())
  
  const logContainerRef = useRef<HTMLDivElement>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  // 获取唯一的主机列表
  const availableHosts = useMemo(() => {
    const hosts = new Set<string>()
    logs.forEach(log => {
      if (log.host) {
        hosts.add(log.host)
      }
    })
    return Array.from(hosts).sort()
  }, [logs])

  // 过滤日志
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 搜索过滤
      if (filter.search) {
        const searchLower = filter.search.toLowerCase()
        const matchesSearch = 
          log.message.toLowerCase().includes(searchLower) ||
          (log.host && log.host.toLowerCase().includes(searchLower)) ||
          (log.task && log.task.toLowerCase().includes(searchLower)) ||
          (log.module && log.module.toLowerCase().includes(searchLower))
        
        if (!matchesSearch) return false
      }

      // 级别过滤
      if (filter.levels.length > 0 && !filter.levels.includes(log.level)) {
        return false
      }

      // 主机过滤
      if (filter.hosts.length > 0 && log.host && !filter.hosts.includes(log.host)) {
        return false
      }

      return true
    })
  }, [logs, filter])

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [filteredLogs, autoScroll])

  // 处理滚动事件，检测用户是否手动滚动
  const handleScroll = useCallback(() => {
    if (!logContainerRef.current) return
    
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10
    
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false)
    }
  }, [autoScroll])

  // 处理过滤器变更
  const handleFilterChange = useCallback((key: keyof LogFilter, value: any) => {
    setFilter(prev => ({ ...prev, [key]: value }))
  }, [])

  // 处理级别选择
  const handleLevelToggle = useCallback((level: string) => {
    setFilter(prev => ({
      ...prev,
      levels: prev.levels.includes(level)
        ? prev.levels.filter(l => l !== level)
        : [...prev.levels, level]
    }))
  }, [])

  // 处理主机选择
  const handleHostToggle = useCallback((host: string) => {
    setFilter(prev => ({
      ...prev,
      hosts: prev.hosts.includes(host)
        ? prev.hosts.filter(h => h !== host)
        : [...prev.hosts, host]
    }))
  }, [])

  // 复制日志内容
  const handleCopyLog = useCallback(async (log: LogEntry) => {
    try {
      const logText = formatLogForCopy(log)
      await navigator.clipboard.writeText(logText)
      setCopiedLogId(log.id)
      setTimeout(() => setCopiedLogId(null), 2000)
    } catch (error) {
      console.error('Failed to copy log:', error)
    }
  }, [])

  // 复制选中的日志
  const handleCopySelected = useCallback(async () => {
    try {
      const selectedLogEntries = filteredLogs.filter(log => selectedLogs.has(log.id))
      const logText = selectedLogEntries.map(formatLogForCopy).join('\n')
      await navigator.clipboard.writeText(logText)
      alert(`已复制 ${selectedLogEntries.length} 条日志`)
    } catch (error) {
      console.error('Failed to copy selected logs:', error)
    }
  }, [filteredLogs, selectedLogs])

  // 导出日志
  const handleExportLogs = useCallback(() => {
    const logsToExport = selectedLogs.size > 0 
      ? filteredLogs.filter(log => selectedLogs.has(log.id))
      : filteredLogs

    const logText = logsToExport.map(formatLogForCopy).join('\n')
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `ansible-execution-${execution.id}-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [filteredLogs, selectedLogs, execution.id])

  // 格式化日志用于复制
  const formatLogForCopy = (log: LogEntry): string => {
    const parts = []
    
    if (filter.showTimestamp) {
      parts.push(`[${formatDateTime(log.timestamp, 'YYYY/MM/DD HH:mm:ss')}]`)
    }
    
    if (filter.showLevel) {
      parts.push(`[${log.level}]`)
    }
    
    if (filter.showHost && log.host) {
      parts.push(`[${log.host}]`)
    }
    
    if (log.task) {
      parts.push(`[${log.task}]`)
    }
    
    parts.push(log.message)
    
    return parts.join(' ')
  }

  // 获取日志级别样式
  const getLevelStyle = (level: string) => {
    const levelConfig = LOG_LEVELS.find(l => l.value === level)
    return levelConfig || { color: 'text-gray-600', bgColor: 'bg-gray-100' }
  }

  // 获取日志级别图标
  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'DEBUG': return <Terminal size={14} />
      case 'INFO': return <Info size={14} />
      case 'WARNING': return <AlertCircle size={14} />
      case 'ERROR': return <XCircle size={14} />
      case 'CRITICAL': return <XCircle size={14} />
      case 'TASK': return <Zap size={14} />
      case 'PLAY': return <Play size={14} />
      case 'RECAP': return <CheckCircle size={14} />
      default: return <ScrollText size={14} />
    }
  }

  // 处理日志选择
  const handleLogSelect = useCallback((logId: string, selected: boolean) => {
    setSelectedLogs(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(logId)
      } else {
        newSet.delete(logId)
      }
      return newSet
    })
  }, [])

  // 全选/取消全选
  const handleSelectAll = useCallback((selectAll: boolean) => {
    if (selectAll) {
      setSelectedLogs(new Set(filteredLogs.map(log => log.id)))
    } else {
      setSelectedLogs(new Set())
    }
  }, [filteredLogs])

  // 清除过滤器
  const handleClearFilters = useCallback(() => {
    setFilter({
      search: '',
      levels: [],
      hosts: [],
      showTimestamp: true,
      showHost: true,
      showLevel: true
    })
  }, [])

  return (
    <div className={`bg-white rounded-lg shadow-sm ${className}`}>
      {/* 头部工具栏 */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ScrollText size={20} className="text-blue-500" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">执行日志</h3>
              <p className="text-sm text-gray-500">
                执行 ID: {execution.id} | 状态: 
                <span className={`ml-1 font-medium ${
                  execution.status === 'success' ? 'text-green-600' :
                  execution.status === 'failed' ? 'text-red-600' :
                  execution.status === 'running' ? 'text-blue-600' :
                  'text-yellow-600'
                }`}>
                  {execution.status === 'success' ? '成功' :
                   execution.status === 'failed' ? '失败' :
                   execution.status === 'running' ? '运行中' : '等待中'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* 实时更新控制 */}
            {onToggleRealtime && (
              <button
                onClick={() => onToggleRealtime(!isRealtime)}
                className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium ${
                  isRealtime
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isRealtime ? <Pause size={14} className="mr-1" /> : <Play size={14} className="mr-1" />}
                {isRealtime ? '暂停实时' : '开启实时'}
              </button>
            )}

            {/* 刷新按钮 */}
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
              >
                <RotateCcw size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </button>
            )}

            {/* 过滤器按钮 */}
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium ${
                showFilterPanel
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter size={14} className="mr-1" />
              过滤器
            </button>

            {/* 导出按钮 */}
            <button
              onClick={handleExportLogs}
              className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
            >
              <Download size={14} className="mr-1" />
              导出
            </button>
          </div>
        </div>

        {/* 过滤器面板 */}
        {showFilterPanel && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
            {/* 搜索框 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">搜索日志</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={filter.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="搜索日志内容、主机、任务..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 日志级别过滤 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">日志级别</label>
                <div className="space-y-1">
                  {LOG_LEVELS.map(level => (
                    <label key={level.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filter.levels.includes(level.value)}
                        onChange={() => handleLevelToggle(level.value)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className={`ml-2 text-sm ${level.color}`}>
                        {level.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 主机过滤 */}
              {availableHosts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">主机</label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {availableHosts.map(host => (
                      <label key={host} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filter.hosts.includes(host)}
                          onChange={() => handleHostToggle(host)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">{host}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 显示选项 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">显示选项</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filter.showTimestamp}
                    onChange={(e) => handleFilterChange('showTimestamp', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">显示时间戳</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filter.showLevel}
                    onChange={(e) => handleFilterChange('showLevel', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">显示级别</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filter.showHost}
                    onChange={(e) => handleFilterChange('showHost', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">显示主机</span>
                </label>
              </div>
            </div>

            {/* 过滤器操作 */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                显示 {filteredLogs.length} / {logs.length} 条日志
              </div>
              <button
                onClick={handleClearFilters}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                清除过滤器
              </button>
            </div>
          </div>
        )}

        {/* 选择操作栏 */}
        {selectedLogs.size > 0 && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
            <div className="text-sm text-blue-700">
              已选择 {selectedLogs.size} 条日志
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopySelected}
                className="inline-flex items-center px-2 py-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <Copy size={14} className="mr-1" />
                复制选中
              </button>
              <button
                onClick={() => handleSelectAll(false)}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                取消选择
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 日志内容区域 */}
      <div className="relative">
        {/* 日志列表头部 */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={selectedLogs.size === filteredLogs.length && filteredLogs.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">全选</span>
            </label>
            <div className="text-sm text-gray-500">
              共 {filteredLogs.length} 条日志
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">自动滚动</span>
            </label>
          </div>
        </div>

        {/* 日志内容 */}
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="h-96 overflow-y-auto bg-gray-900 text-gray-100 font-mono text-sm"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              {logs.length === 0 ? '暂无日志' : '没有匹配的日志'}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredLogs.map((log, index) => {
                const levelStyle = getLevelStyle(log.level)
                const isSelected = selectedLogs.has(log.id)
                
                return (
                  <div
                    key={log.id}
                    className={`group flex items-start space-x-2 p-2 rounded hover:bg-gray-800 ${
                      isSelected ? 'bg-blue-900' : ''
                    }`}
                  >
                    {/* 选择框 */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleLogSelect(log.id, e.target.checked)}
                      className="mt-1 h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-800"
                    />

                    {/* 日志内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start space-x-2">
                        {/* 时间戳 */}
                        {filter.showTimestamp && (
                          <span className="text-gray-400 text-xs whitespace-nowrap flex items-center">
                            <Clock size={12} className="mr-1" />
                            {formatDateTime(log.timestamp, 'HH:mm:ss')}
                          </span>
                        )}

                        {/* 级别 */}
                        {filter.showLevel && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${levelStyle.bgColor} ${levelStyle.color}`}>
                            {getLevelIcon(log.level)}
                            <span className="ml-1">{log.level}</span>
                          </span>
                        )}

                        {/* 主机 */}
                        {filter.showHost && log.host && (
                          <span className="text-cyan-400 text-xs font-medium">
                            [{log.host}]
                          </span>
                        )}

                        {/* 任务 */}
                        {log.task && (
                          <span className="text-green-400 text-xs">
                            {log.task}
                          </span>
                        )}
                      </div>

                      {/* 消息内容 */}
                      <div className="mt-1">
                        <pre className="whitespace-pre-wrap text-gray-100 break-words">
                          {log.message}
                        </pre>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleCopyLog(log)}
                        className="p-1 text-gray-400 hover:text-gray-200"
                        title="复制日志"
                      >
                        {copiedLogId === log.id ? (
                          <CheckCircle size={14} className="text-green-400" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
              <div ref={logEndRef} />
            </div>
          )}
        </div>

        {/* 滚动到底部按钮 */}
        {!autoScroll && (
          <button
            onClick={() => {
              setAutoScroll(true)
              logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="absolute bottom-4 right-4 inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
          >
            <ScrollText size={16} className="mr-1" />
            滚动到底部
          </button>
        )}
      </div>
    </div>
  )
}

export default ExecutionLogDisplay