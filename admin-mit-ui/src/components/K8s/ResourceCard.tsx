import React from 'react'
import { MoreVertical } from 'lucide-react'
import { StatusBadge } from './StatusBadge'

/**
 * 操作按钮配置
 */
export interface ActionButton {
  label: string
  onClick: () => void
  icon?: React.ReactNode
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
}

/**
 * ResourceCard组件属�?
 */
interface ResourceCardProps {
  title: string
  description?: string
  status?: string
  statusType?: 'cluster' | 'namespace' | 'workload' | 'storage'
  icon?: React.ReactNode
  actions?: ActionButton[]
  metadata?: Array<{ label: string; value: string | number | React.ReactNode }>
  children?: React.ReactNode
  onClick?: () => void
  className?: string
  showMenu?: boolean
  onMenuClick?: () => void
}

/**
 * ResourceCard组件
 * 
 * 统一的资源卡片布局组件，用于展示K8S资源信息
 * 支持标题、描述、状态、操作按钮和元数据展�?
 * 
 * @example
 * <ResourceCard
 *   title="my-cluster"
 *   description="生产环境集群"
 *   status="online"
 *   metadata={[
 *     { label: '节点�?, value: 5 },
 *     { label: 'Pod�?, value: 120 }
 *   ]}
 *   actions={[
 *     { label: '编辑', onClick: handleEdit },
 *     { label: '删除', onClick: handleDelete, variant: 'danger' }
 *   ]}
 * />
 */
export const ResourceCard: React.FC<ResourceCardProps> = ({
  title,
  description,
  status,
  statusType,
  icon,
  actions = [],
  metadata = [],
  children,
  onClick,
  className = '',
  showMenu = false,
  onMenuClick
}) => {
  const handleCardClick = (e: React.MouseEvent) => {
    // 如果点击的是按钮或其子元素，不触发卡片点�?
    const target = e.target as HTMLElement
    if (target.closest('button')) {
      return
    }
    onClick?.()
  }

  const getButtonVariantClasses = (variant: ActionButton['variant'] = 'secondary') => {
    const variants = {
      primary: 'bg-blue-600 hover:bg-blue-700 text-white',
      secondary: 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200',
      danger: 'bg-red-600 hover:bg-red-700 text-white'
    }
    return variants[variant]
  }

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700
        hover:shadow-md transition-shadow duration-200
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={handleCardClick}
    >
      {/* 卡片头部 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {icon && (
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                {icon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {title}
                </h3>
                {status && (
                  <StatusBadge status={status} size="sm" />
                )}
              </div>
              {description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {description}
                </p>
              )}
            </div>
          </div>
          {showMenu && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMenuClick?.()
              }}
              className="flex-shrink-0 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              aria-label="更多操作"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 元数据区�?*/}
      {metadata.length > 0 && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-4">
            {metadata.map((item, index) => (
              <div key={index} className="flex flex-col">
                <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {item.label}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 自定义内容区�?*/}
      {children && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          {children}
        </div>
      )}

      {/* 操作按钮区域 */}
      {actions.length > 0 && (
        <div className="p-4 flex items-center gap-2 flex-wrap">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation()
                action.onClick()
              }}
              disabled={action.disabled}
              className={`
                px-3 py-1.5 rounded-md text-sm font-medium
                transition-colors duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center gap-1.5
                ${getButtonVariantClasses(action.variant)}
              `}
              aria-label={action.label}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ResourceCard
