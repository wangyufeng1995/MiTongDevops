import React, { useState, useRef, useEffect } from 'react'
import { MoreHorizontal, Edit, Trash2, Eye, Copy } from 'lucide-react'
import { clsx } from 'clsx'

export interface ActionItem {
  key: string
  label: string
  icon?: React.ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  divider?: boolean
}

export interface ActionColumnProps {
  actions: ActionItem[]
  trigger?: 'hover' | 'click'
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'
  maxVisible?: number
  className?: string
}

export const ActionColumn: React.FC<ActionColumnProps> = ({
  actions,
  trigger = 'click',
  placement = 'bottom-end',
  maxVisible = 3,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 可见的操作和隐藏的操作
  const visibleActions = actions.slice(0, maxVisible)
  const hiddenActions = actions.slice(maxVisible)

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 处理操作点击
  const handleActionClick = (action: ActionItem, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!action.disabled) {
      action.onClick()
      setIsOpen(false)
    }
  }

  // 处理更多操作按钮点击
  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (trigger === 'click') {
      setIsOpen(!isOpen)
    }
  }

  // 处理鼠标悬停
  const handleMouseEnter = () => {
    setIsHovered(true)
    if (trigger === 'hover') {
      setIsOpen(true)
    }
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    if (trigger === 'hover') {
      setTimeout(() => {
        if (!isHovered) {
          setIsOpen(false)
        }
      }, 100)
    }
  }

  // 获取下拉菜单位置样式
  const getDropdownPosition = () => {
    const positions = {
      'bottom-start': 'top-full left-0 mt-1',
      'bottom-end': 'top-full right-0 mt-1',
      'top-start': 'bottom-full left-0 mb-1',
      'top-end': 'bottom-full right-0 mb-1'
    }
    return positions[placement]
  }

  // 渲染操作按钮
  const renderActionButton = (action: ActionItem, isInDropdown = false) => {
    const buttonClass = isInDropdown
      ? clsx(
          'flex items-center w-full px-3 py-2 text-sm text-left transition-colors',
          action.danger 
            ? 'text-red-600 hover:bg-red-50 hover:text-red-700' 
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
          action.disabled && 'opacity-50 cursor-not-allowed'
        )
      : clsx(
          'inline-flex items-center px-2 py-1 text-sm font-medium rounded transition-colors',
          action.danger
            ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
          action.disabled && 'opacity-50 cursor-not-allowed'
        )

    return (
      <button
        key={action.key}
        onClick={(e) => handleActionClick(action, e)}
        disabled={action.disabled}
        className={buttonClass}
        title={action.label}
      >
        {action.icon && (
          <span className={clsx('flex-shrink-0', isInDropdown ? 'mr-2' : 'mr-1')}>
            {action.icon}
          </span>
        )}
        {isInDropdown && <span>{action.label}</span>}
        {!isInDropdown && !action.icon && <span>{action.label}</span>}
      </button>
    )
  }

  return (
    <div className={clsx('flex items-center space-x-1', className)}>
      {/* 可见的操作按钮 */}
      {visibleActions.map(action => renderActionButton(action))}

      {/* 更多操作下拉菜单 */}
      {hiddenActions.length > 0 && (
        <div 
          className="relative"
          ref={dropdownRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <button
            onClick={handleMoreClick}
            className="inline-flex items-center px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded transition-colors"
            title="更多操作"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {/* 下拉菜单 */}
          {isOpen && (
            <div className={clsx(
              'absolute z-50 min-w-[120px] bg-white border border-gray-200 rounded-md shadow-lg',
              getDropdownPosition()
            )}>
              <div className="py-1">
                {hiddenActions.map((action, index) => (
                  <React.Fragment key={action.key}>
                    {action.divider && index > 0 && (
                      <div className="border-t border-gray-200 my-1" />
                    )}
                    {renderActionButton(action, true)}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// 预定义的常用操作
export const CommonActions = {
  view: (onClick: () => void): ActionItem => ({
    key: 'view',
    label: '查看',
    icon: <Eye className="w-4 h-4" />,
    onClick
  }),

  edit: (onClick: () => void): ActionItem => ({
    key: 'edit',
    label: '编辑',
    icon: <Edit className="w-4 h-4" />,
    onClick
  }),

  copy: (onClick: () => void): ActionItem => ({
    key: 'copy',
    label: '复制',
    icon: <Copy className="w-4 h-4" />,
    onClick
  }),

  delete: (onClick: () => void): ActionItem => ({
    key: 'delete',
    label: '删除',
    icon: <Trash2 className="w-4 h-4" />,
    onClick,
    danger: true,
    divider: true
  })
}

export default ActionColumn