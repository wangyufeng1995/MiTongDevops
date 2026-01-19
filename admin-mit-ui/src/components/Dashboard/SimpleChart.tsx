/**
 * 简单图表组件
 * 使用CSS实现基础的柱状图和折线图
 */
import React from 'react'
import clsx from 'clsx'

export interface ChartDataPoint {
  label: string
  value: number
  color?: string
}

export interface SimpleChartProps {
  title: string
  data: ChartDataPoint[]
  type?: 'bar' | 'line'
  height?: number
  loading?: boolean
  className?: string
}

export const SimpleChart: React.FC<SimpleChartProps> = ({
  title,
  data,
  type = 'bar',
  height = 200,
  loading = false,
  className
}) => {
  if (loading) {
    return (
      <div className={clsx('bg-white rounded-lg shadow p-6', className)}>
        <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
        <div className="animate-pulse">
          <div className="bg-gray-200 h-48 rounded"></div>
        </div>
      </div>
    )
  }

  const maxValue = Math.max(...data.map(d => d.value))
  const minValue = Math.min(...data.map(d => d.value))
  const range = maxValue - minValue || 1

  return (
    <div className={clsx('bg-white rounded-lg shadow p-6', className)}>
      <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
      
      <div className="relative" style={{ height }}>
        {type === 'bar' ? (
          <div className="flex items-end justify-between h-full space-x-2">
            {data.map((point, index) => {
              const heightPercent = ((point.value - minValue) / range) * 100
              return (
                <div key={index} className="flex flex-col items-center flex-1">
                  <div
                    className={clsx(
                      'w-full rounded-t transition-all duration-300 hover:opacity-80',
                      point.color || 'bg-blue-500'
                    )}
                    style={{ height: `${heightPercent}%` }}
                    title={`${point.label}: ${point.value}`}
                  />
                  <span className="text-xs text-gray-600 mt-2 text-center">
                    {point.label}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="relative h-full">
            <svg className="w-full h-full" viewBox="0 0 400 200">
              {/* 网格线 */}
              <defs>
                <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              
              {/* 折线 */}
              <polyline
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                points={data.map((point, index) => {
                  const x = (index / (data.length - 1)) * 380 + 10
                  const y = 190 - ((point.value - minValue) / range) * 180
                  return `${x},${y}`
                }).join(' ')}
              />
              
              {/* 数据点 */}
              {data.map((point, index) => {
                const x = (index / (data.length - 1)) * 380 + 10
                const y = 190 - ((point.value - minValue) / range) * 180
                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="4"
                    fill="#3b82f6"
                    className="hover:r-6 transition-all duration-200"
                  >
                    <title>{`${point.label}: ${point.value}`}</title>
                  </circle>
                )
              })}
            </svg>
            
            {/* X轴标签 */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
              {data.map((point, index) => (
                <span key={index} className="text-xs text-gray-600">
                  {point.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* 图例 */}
      <div className="mt-4 flex flex-wrap gap-4">
        {data.map((point, index) => (
          <div key={index} className="flex items-center">
            <div
              className={clsx(
                'w-3 h-3 rounded mr-2',
                point.color || 'bg-blue-500'
              )}
            />
            <span className="text-sm text-gray-600">
              {point.label}: {point.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SimpleChart