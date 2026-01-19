import React, { forwardRef, useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'

export interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  helperText?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'outlined' | 'filled'
  format?: 'YYYY-MM-DD' | 'YYYY/MM/DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY'
  showTime?: boolean
  clearable?: boolean
  required?: boolean
  minDate?: Date
  maxDate?: Date
  onDateChange?: (date: Date | null) => void
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(({
  label,
  error,
  helperText,
  size = 'md',
  variant = 'outlined',
  format = 'YYYY-MM-DD',
  showTime = false,
  clearable = false,
  required = false,
  minDate,
  maxDate,
  disabled,
  value,
  onDateChange,
  className,
  ...props
}, ref) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    value ? new Date(value as string) : null
  )
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [timeValue, setTimeValue] = useState('00:00')
  const containerRef = useRef<HTMLDivElement>(null)

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  }

  const variantClasses = {
    outlined: 'border border-gray-300 bg-white',
    filled: 'border-0 bg-gray-100'
  }

  const inputClasses = clsx(
    'w-full rounded-md transition-colors duration-200 cursor-pointer',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
    'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
    'pr-10', // 为日历图标留空间
    sizeClasses[size],
    variantClasses[variant],
    {
      'border-red-300 focus:border-red-500 focus:ring-red-500': error,
    },
    className
  )

  const labelClasses = clsx(
    'block text-sm font-medium mb-1',
    {
      'text-gray-700': !error,
      'text-red-700': error,
    }
  )

  // 格式化日期显示
  const formatDate = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    switch (format) {
      case 'YYYY/MM/DD':
        return `${year}/${month}/${day}`
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`
      default:
        return `${year}-${month}-${day}`
    }
  }

  // 获取显示值
  const displayValue = selectedDate 
    ? formatDate(selectedDate) + (showTime ? ` ${timeValue}` : '')
    : ''

  // 生成日历天数
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())
    
    const days = []
    const current = new Date(startDate)
    
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    
    return days
  }

  // 检查日期是否可选
  const isDateSelectable = (date: Date): boolean => {
    if (minDate && date < minDate) return false
    if (maxDate && date > maxDate) return false
    return true
  }

  // 处理日期选择
  const handleDateSelect = (date: Date) => {
    if (!isDateSelectable(date)) return
    
    if (showTime && timeValue) {
      const [hours, minutes] = timeValue.split(':')
      date.setHours(parseInt(hours), parseInt(minutes))
    }
    
    setSelectedDate(date)
    onDateChange?.(date)
    
    if (!showTime) {
      setIsOpen(false)
    }
  }

  // 处理时间变化
  const handleTimeChange = (time: string) => {
    setTimeValue(time)
    if (selectedDate) {
      const [hours, minutes] = time.split(':')
      const newDate = new Date(selectedDate)
      newDate.setHours(parseInt(hours), parseInt(minutes))
      setSelectedDate(newDate)
      onDateChange?.(newDate)
    }
  }

  // 处理清除
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDate(null)
    onDateChange?.(null)
  }

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const calendarDays = generateCalendarDays()
  const monthNames = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ]
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className={labelClasses}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {/* 隐藏的原生输入 */}
        <input
          ref={ref}
          type="hidden"
          value={selectedDate ? selectedDate.toISOString() : ''}
          {...props}
        />

        {/* 显示输入框 */}
        <div
          className={inputClasses}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <div className="flex items-center justify-between">
            <span className={clsx(
              'truncate',
              selectedDate ? 'text-gray-900' : 'text-gray-400'
            )}>
              {displayValue || '请选择日期'}
            </span>
            
            <div className="flex items-center space-x-1">
              {clearable && selectedDate && !disabled && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  ×
                </button>
              )}
              <Calendar className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* 日历弹窗 */}
        {isOpen && !disabled && (
          <div className="absolute z-50 mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4 min-w-[280px]">
            {/* 月份导航 */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <h3 className="text-sm font-medium">
                {currentMonth.getFullYear()}年 {monthNames[currentMonth.getMonth()]}
              </h3>
              
              <button
                type="button"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* 星期标题 */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 p-2">
                  {day}
                </div>
              ))}
            </div>

            {/* 日期网格 */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, index) => {
                const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
                const isSelected = selectedDate && 
                  date.getDate() === selectedDate.getDate() &&
                  date.getMonth() === selectedDate.getMonth() &&
                  date.getFullYear() === selectedDate.getFullYear()
                const isToday = date.toDateString() === new Date().toDateString()
                const isSelectable = isDateSelectable(date)

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleDateSelect(date)}
                    disabled={!isSelectable}
                    className={clsx(
                      'p-2 text-sm rounded hover:bg-gray-100 transition-colors',
                      {
                        'text-gray-400': !isCurrentMonth,
                        'text-gray-900': isCurrentMonth && !isSelected,
                        'bg-blue-600 text-white hover:bg-blue-700': isSelected,
                        'bg-blue-100 text-blue-600': isToday && !isSelected,
                        'cursor-not-allowed opacity-50': !isSelectable,
                      }
                    )}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>

            {/* 时间选择 */}
            {showTime && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  时间
                </label>
                <input
                  type="time"
                  value={timeValue}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex justify-end space-x-2 mt-4 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                确定
              </button>
            </div>
          </div>
        )}
      </div>
      
      {(error || helperText) && (
        <div className="mt-1 flex items-center">
          {error && (
            <>
              <AlertCircle className="w-4 h-4 text-red-500 mr-1" />
              <p className="text-sm text-red-600">{error}</p>
            </>
          )}
          {!error && helperText && (
            <p className="text-sm text-gray-500">{helperText}</p>
          )}
        </div>
      )}
    </div>
  )
})

DatePicker.displayName = 'DatePicker'

export default DatePicker