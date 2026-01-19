import React from 'react'
import { CheckCircle, AlertCircle, XCircle, Clock, HelpCircle } from 'lucide-react'
import type { ClusterStatus, NamespaceStatus, WorkloadStatus, StorageStatus } from '../../types/k8s'

/**
 * 状态类型
 */
type StatusType = ClusterStatus | NamespaceStatus | WorkloadStatus | StorageStatus | string

/**
 * 状态配置
 */
interface StatusConfig {
  color: string
  bgColor: string
  icon: React.ReactNode
  text: string
}

/**
 * StatusBadge组件属性
 */
interface StatusBadgeProps {
  status?: StatusType
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  className?: string
}

/**
 * 获取状态配置
 */
const getStatusConfig = (status?: StatusType): StatusConfig => {
  // 处理 undefined 或 null 的情况
  if (!status) {
    return {
      color: 'text-gray-700 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-900/30',
      icon: <HelpCircle className="w-4 h-4" />,
      text: '-'
    }
  }
  
  const statusLower = String(status).toLowerCase()
  
  // 正常状态 - 绿色
  if (['online', 'active', 'running', 'bound', 'available', 'ready'].includes(statusLower)) {
    return {
      color: 'text-green-700 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      icon: <CheckCircle className="w-4 h-4" />,
      text: status
    }
  }
  
  // 警告状态 - 黄色
  if (['pending', 'terminating', 'released', 'waiting'].includes(statusLower)) {
    return {
      color: 'text-yellow-700 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      icon: <Clock className="w-4 h-4" />,
      text: status
    }
  }
  
  // 错误状态 - 红色
  if (['offline', 'error', 'failed', 'unknown', 'notready'].includes(statusLower)) {
    return {
      color: 'text-red-700 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      icon: <XCircle className="w-4 h-4" />,
      text: status
    }
  }
  
  // 默认状态 - 灰色
  return {
    color: 'text-gray-700 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-900/30',
    icon: <HelpCircle className="w-4 h-4" />,
    text: status
  }
}

/**
 * StatusBadge组件
 * 
 * 根据状态显示不同颜色的标签
 * - 绿色：正常状态（online, active, running, bound, available）
 * - 黄色：警告状态（pending, terminating, released）
 * - 红色：异常状态（offline, error, failed, unknown）
 * - 灰色：其他状态
 * 
 * @example
 * <StatusBadge status="online" />
 * <StatusBadge status="pending" size="lg" showIcon />
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
  className = ''
}) => {
  const config = getStatusConfig(status)
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  }
  
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium
        ${config.color} ${config.bgColor} ${sizeClasses[size]} ${className}
      `}
      role="status"
      aria-label={`状态: ${config.text}`}
    >
      {showIcon && config.icon}
      <span>{config.text}</span>
    </span>
  )
}

export default StatusBadge
