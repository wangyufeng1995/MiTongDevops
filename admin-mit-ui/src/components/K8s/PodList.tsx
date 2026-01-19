import React from 'react'
import { Box, Clock, AlertCircle, FileText } from 'lucide-react'
import type { Pod } from '../../types/k8s'
import { StatusBadge } from './StatusBadge'

/**
 * PodList组件属�?
 */
interface PodListProps {
  pods: Pod[]
  onViewLogs?: (pod: Pod, container?: string) => void
  loading?: boolean
  emptyText?: string
  className?: string
  showNamespace?: boolean
}

/**
 * 获取Pod状态的显示文本
 */
const getPodStatusText = (pod: Pod): string => {
  if (pod.phase) {
    return pod.phase
  }
  return pod.status || 'Unknown'
}

/**
 * 获取容器状态描�?
 */
const getContainerStateDescription = (container: Pod['containers'][0]): string => {
  if (container.state.running) {
    return 'Running'
  }
  if (container.state.waiting) {
    return container.state.waiting.reason || 'Waiting'
  }
  if (container.state.terminated) {
    return container.state.terminated.reason || 'Terminated'
  }
  return 'Unknown'
}

/**
 * 格式化时�?
 */
const formatTime = (timeString?: string): string => {
  if (!timeString) return '-'
  
  const date = new Date(timeString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffDays > 0) return `${diffDays}天前`
  if (diffHours > 0) return `${diffHours}小时前`
  if (diffMins > 0) return `${diffMins}分钟前`
  return '刚刚'
}

/**
 * PodList组件
 * 
 * Pod列表展示组件，显示Pod状态、容器数量等信息
 * 
 * @example
 * <PodList
 *   pods={pods}
 *   onViewLogs={handleViewLogs}
 *   showNamespace
 * />
 */
export const PodList: React.FC<PodListProps> = ({
  pods,
  onViewLogs,
  loading = false,
  emptyText = '暂无Pod',
  className = '',
  showNamespace = false
}) => {
  if (loading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg p-4 h-24" />
        ))}
      </div>
    )
  }

  if (pods.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <Box className="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {pods.map((pod) => {
        const readyContainers = pod.containers.filter(c => c.ready).length
        const totalContainers = pod.containers.length
        const allReady = readyContainers === totalContainers
        const hasRestarts = pod.restart_count > 0

        return (
          <div
            key={pod.name}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow duration-200"
          >
            {/* Pod头部信息 */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Box className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {pod.name}
                    </h4>
                    <StatusBadge status={getPodStatusText(pod)} size="sm" />
                  </div>
                  {showNamespace && pod.namespace && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      命名空间: {pod.namespace}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                    {pod.node_name && (
                      <span className="flex items-center gap-1">
                        <span className="text-gray-500">节点:</span>
                        {pod.node_name}
                      </span>
                    )}
                    {pod.pod_ip && (
                      <span className="flex items-center gap-1">
                        <span className="text-gray-500">IP:</span>
                        {pod.pod_ip}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {pod.start_time && (
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTime(pod.start_time)}
                </div>
              )}
            </div>

            {/* 容器信息 */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">容器状�?</span>
                <span className={`text-xs font-medium ${allReady ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                  {readyContainers}/{totalContainers} Ready
                </span>
              </div>
              {hasRestarts && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    重启次数: <span className="font-medium text-yellow-600 dark:text-yellow-400">{pod.restart_count}</span>
                  </span>
                </div>
              )}
            </div>

            {/* 容器列表 */}
            <div className="space-y-2">
              {pod.containers.map((container, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-900 dark:text-white truncate">
                        {container.name}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        container.ready
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {container.ready ? 'Ready' : 'Not Ready'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                      <span className="truncate">{container.image}</span>
                      <span className="text-gray-500">
                        {getContainerStateDescription(container)}
                      </span>
                      {container.restart_count > 0 && (
                        <span className="text-yellow-600 dark:text-yellow-400">
                          重启 {container.restart_count}�?
                        </span>
                      )}
                    </div>
                  </div>
                  {onViewLogs && (
                    <button
                      onClick={() => onViewLogs(pod, container.name)}
                      className="flex-shrink-0 p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title="查看日志"
                      aria-label={`查看 ${container.name} 日志`}
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Pod条件信息（如果有�?*/}
            {pod.conditions && pod.conditions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap gap-2">
                  {pod.conditions.map((condition, index) => (
                    <span
                      key={index}
                      className={`text-xs px-2 py-1 rounded ${
                        condition.status === 'True'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                      title={condition.message}
                    >
                      {condition.type}: {condition.status}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default PodList
