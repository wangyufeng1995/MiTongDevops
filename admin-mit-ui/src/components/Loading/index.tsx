import React from 'react'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullScreen?: boolean
  className?: string
}

export const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  text,
  fullScreen = false,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }

  const spinner = (
    <div 
      className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]}`}
      role="status"
      aria-label="加载中"
    />
  )

  const content = (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {spinner}
      {text && (
        <p className={`mt-2 text-gray-600 dark:text-gray-400 ${textSizeClasses[size]}`}>
          {text}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center z-50">
        {content}
      </div>
    )
  }

  return content
}

/**
 * 页面加载组件
 */
export const PageLoading: React.FC<{ text?: string }> = ({ text = '加载中...' }) => {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loading size="lg" text={text} />
    </div>
  )
}

/**
 * 按钮加载组件
 */
export const ButtonLoading: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`animate-spin rounded-full border-2 border-white border-t-transparent w-4 h-4 ${className}`} />
  )
}

/**
 * 表格加载组件
 */
export const TableLoading: React.FC<{ rows?: number; columns?: number }> = ({ 
  rows = 5, 
  columns = 4 
}) => {
  return (
    <div className="animate-pulse">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex space-x-4 py-3 border-b border-gray-200 dark:border-gray-700">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded"
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * 卡片加载组件
 */
export const CardLoading: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`animate-pulse ${className}`}>
      <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4">
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2" />
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mb-2" />
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-5/6" />
      </div>
    </div>
  )
}

export default Loading