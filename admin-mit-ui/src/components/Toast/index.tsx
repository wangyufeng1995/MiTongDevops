/**
 * Toast 提示组件
 * 用于显示操作结果的美观提示框
 */
import React, { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X, Send, Bell } from 'lucide-react'
import clsx from 'clsx'

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'test-success'

export interface ToastProps {
  type: ToastType
  title: string
  message?: string
  duration?: number
  onClose?: () => void
}

const Toast: React.FC<ToastProps> = ({ type, title, message, duration = 3000, onClose }) => {
  const [visible, setVisible] = useState(true)
  const [exiting, setExiting] = useState(false)
  const [progress, setProgress] = useState(100)

  const handleClose = useCallback(() => {
    setExiting(true)
    setTimeout(() => {
      setVisible(false)
      onClose?.()
    }, 300)
  }, [onClose])

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(handleClose, duration)
      // 进度条动画
      const interval = setInterval(() => {
        setProgress(prev => Math.max(0, prev - (100 / (duration / 50))))
      }, 50)
      return () => {
        clearTimeout(timer)
        clearInterval(interval)
      }
    }
  }, [duration, handleClose])

  if (!visible) return null

  // 测试成功特殊样式
  if (type === 'test-success') {
    return (
      <div
        className={clsx(
          'fixed top-4 right-4 z-50 w-80 shadow-2xl rounded-xl overflow-hidden pointer-events-auto',
          'transform transition-all duration-300 ease-out',
          'bg-gradient-to-br from-green-500 to-emerald-600',
          exiting ? 'opacity-0 translate-x-full scale-95' : 'opacity-100 translate-x-0 scale-100'
        )}
      >
        {/* 顶部装饰 */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/20" />
        
        <div className="p-5">
          <div className="flex items-start">
            {/* 图标 */}
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Send className="w-6 h-6 text-white" />
              </div>
            </div>
            
            {/* 内容 */}
            <div className="ml-4 flex-1">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-200 mr-2" />
                <p className="text-lg font-semibold text-white">{title}</p>
              </div>
              {message && (
                <p className="mt-2 text-sm text-green-100 leading-relaxed">{message}</p>
              )}
            </div>
            
            {/* 关闭按钮 */}
            <button
              onClick={handleClose}
              className="flex-shrink-0 ml-2 p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5 text-white/80" />
            </button>
          </div>
          
          {/* 提示图标动画 */}
          <div className="mt-4 flex items-center justify-center space-x-2">
            <Bell className="w-4 h-4 text-green-200 animate-bounce" />
            <span className="text-xs text-green-200">请查看接收端确认消息</span>
          </div>
        </div>
        
        {/* 进度条 */}
        <div className="h-1 bg-white/10">
          <div 
            className="h-full bg-white/40 transition-all duration-50 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    )
  }

  // 普通样式配置
  const config = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-white',
      borderColor: 'border-l-4 border-green-500',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      titleColor: 'text-gray-900',
      messageColor: 'text-gray-600',
      progressColor: 'bg-green-500',
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-white',
      borderColor: 'border-l-4 border-red-500',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      titleColor: 'text-gray-900',
      messageColor: 'text-gray-600',
      progressColor: 'bg-red-500',
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-white',
      borderColor: 'border-l-4 border-yellow-500',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      titleColor: 'text-gray-900',
      messageColor: 'text-gray-600',
      progressColor: 'bg-yellow-500',
    },
    info: {
      icon: Info,
      bgColor: 'bg-white',
      borderColor: 'border-l-4 border-blue-500',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      titleColor: 'text-gray-900',
      messageColor: 'text-gray-600',
      progressColor: 'bg-blue-500',
    },
    'test-success': {
      icon: Send,
      bgColor: 'bg-white',
      borderColor: 'border-l-4 border-green-500',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      titleColor: 'text-gray-900',
      messageColor: 'text-gray-600',
      progressColor: 'bg-green-500',
    },
  }

  const { icon: Icon, bgColor, borderColor, iconBg, iconColor, titleColor, messageColor, progressColor } = config[type]

  return (
    <div
      className={clsx(
        'fixed top-4 right-4 z-50 w-80 shadow-xl rounded-lg overflow-hidden pointer-events-auto',
        'transform transition-all duration-300 ease-out',
        bgColor,
        borderColor,
        exiting ? 'opacity-0 translate-x-full scale-95' : 'opacity-100 translate-x-0 scale-100'
      )}
    >
      <div className="p-4">
        <div className="flex items-start">
          {/* 图标 */}
          <div className={clsx('flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center', iconBg)}>
            <Icon className={clsx('w-5 h-5', iconColor)} />
          </div>
          
          {/* 内容 */}
          <div className="ml-3 flex-1 pt-0.5">
            <p className={clsx('text-sm font-semibold', titleColor)}>{title}</p>
            {message && (
              <p className={clsx('mt-1 text-sm', messageColor)}>{message}</p>
            )}
          </div>
          
          {/* 关闭按钮 */}
          <button
            onClick={handleClose}
            className="flex-shrink-0 ml-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
      
      {/* 进度条 */}
      <div className="h-1 bg-gray-100">
        <div 
          className={clsx('h-full transition-all duration-50 ease-linear', progressColor)}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

// Toast 容器和管理
interface ToastItem extends ToastProps {
  id: string
}

let toastId = 0
let addToastFn: ((toast: Omit<ToastItem, 'id'>) => void) | null = null

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    addToastFn = (toast) => {
      const id = `toast-${++toastId}`
      setToasts((prev) => [...prev, { ...toast, id }])
    }
    return () => {
      addToastFn = null
    }
  }, [])

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="fixed top-0 right-0 z-50 p-4 space-y-3 pointer-events-none">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{ transform: `translateY(${index * 4}px)` }}
          className="pointer-events-auto"
        >
          <Toast {...toast} onClose={() => removeToast(toast.id)} />
        </div>
      ))}
    </div>
  )
}

// 导出便捷方法
export const toast = {
  success: (title: string, message?: string, duration?: number) => {
    addToastFn?.({ type: 'success', title, message, duration })
  },
  error: (title: string, message?: string, duration?: number) => {
    addToastFn?.({ type: 'error', title, message, duration: duration || 5000 })
  },
  warning: (title: string, message?: string, duration?: number) => {
    addToastFn?.({ type: 'warning', title, message, duration })
  },
  info: (title: string, message?: string, duration?: number) => {
    addToastFn?.({ type: 'info', title, message, duration: duration || 2000 })
  },
  testSuccess: (title: string, message?: string) => {
    addToastFn?.({ type: 'test-success', title, message, duration: 6000 })
  },
}

export default Toast
