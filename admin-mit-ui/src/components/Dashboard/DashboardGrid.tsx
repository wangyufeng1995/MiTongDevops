/**
 * 仪表盘网格布局组件
 */
import React from 'react'
import clsx from 'clsx'

export interface DashboardGridProps {
  children: React.ReactNode
  columns?: 1 | 2 | 3 | 4
  gap?: 'sm' | 'md' | 'lg'
  className?: string
}

const columnClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
}

const gapClasses = {
  sm: 'gap-4',
  md: 'gap-6',
  lg: 'gap-8'
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  children,
  columns = 4,
  gap = 'md',
  className
}) => {
  return (
    <div className={clsx(
      'grid',
      columnClasses[columns],
      gapClasses[gap],
      className
    )}>
      {children}
    </div>
  )
}

export interface DashboardSectionProps {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  description,
  action,
  children,
  className
}) => {
  return (
    <div className={clsx('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          )}
        </div>
        {action && (
          <div className="flex-shrink-0">
            {action}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

export default DashboardGrid