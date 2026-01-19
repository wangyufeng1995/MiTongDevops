/**
 * 数据统计卡片组件
 */
import React from 'react'
import { LucideIcon } from 'lucide-react'
import clsx from 'clsx'

export interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  iconColor?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo' | 'pink' | 'gray'
  trend?: {
    value: number
    label: string
    isPositive?: boolean
  }
  loading?: boolean
  onClick?: () => void
  className?: string
}

const iconColorClasses = {
  blue: 'bg-blue-500 text-white',
  green: 'bg-green-500 text-white',
  yellow: 'bg-yellow-500 text-white',
  red: 'bg-red-500 text-white',
  purple: 'bg-purple-500 text-white',
  indigo: 'bg-indigo-500 text-white',
  pink: 'bg-pink-500 text-white',
  gray: 'bg-gray-500 text-white'
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor = 'blue',
  trend,
  loading = false,
  onClick,
  className
}) => {
  return (
    <div
      className={clsx(
        'bg-white rounded-lg shadow p-6 transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:scale-105',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className={clsx(
            'w-12 h-12 rounded-lg flex items-center justify-center',
            iconColorClasses[iconColor]
          )}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          {loading ? (
            <div className="mt-1">
              <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
            </div>
          ) : (
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          )}
          
          {trend && !loading && (
            <div className="mt-2 flex items-center text-sm">
              <span className={clsx(
                'font-medium',
                trend.isPositive ? 'text-green-600' : 'text-red-600'
              )}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-gray-500 ml-1">{trend.label}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StatCard