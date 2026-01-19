/**
 * 快速操作组件
 */
import React from 'react'
import { LucideIcon } from 'lucide-react'
import clsx from 'clsx'

export interface QuickAction {
  title: string
  description: string
  icon: LucideIcon
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo'
  onClick: () => void
  disabled?: boolean
}

export interface QuickActionsProps {
  actions: QuickAction[]
  columns?: 1 | 2 | 3
  className?: string
}

const colorClasses = {
  blue: 'text-blue-600 bg-blue-50 hover:bg-blue-100',
  green: 'text-green-600 bg-green-50 hover:bg-green-100',
  yellow: 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100',
  red: 'text-red-600 bg-red-50 hover:bg-red-100',
  purple: 'text-purple-600 bg-purple-50 hover:bg-purple-100',
  indigo: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
}

const columnClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  actions,
  columns = 2,
  className
}) => {
  return (
    <div className={clsx(
      'grid gap-4',
      columnClasses[columns],
      className
    )}>
      {actions.map((action, index) => {
        const Icon = action.icon
        const colorClass = colorClasses[action.color || 'blue']
        
        return (
          <button
            key={index}
            onClick={action.onClick}
            disabled={action.disabled}
            className={clsx(
              'p-4 rounded-lg border border-gray-200 text-left transition-all duration-200',
              'hover:shadow-md hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              action.disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer',
              colorClass
            )}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900">{action.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{action.description}</p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default QuickActions