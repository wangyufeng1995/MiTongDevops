/**
 * 美化的 Toast 消息提示组件
 * 
 * 特点:
 * - 渐变色背景、图标、标题、进度条动画
 * - 从顶部滑入动画
 * - 支持多种消息类型
 * 
 * Requirements: 9.2, 9.6, 9.8
 */
import React, { useState, useEffect, useCallback } from 'react'
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X, 
  Database,
  Link,
  Unlink
} from 'lucide-react'

export type DatabaseToastType = 
  | 'success' 
  | 'error' 
  | 'warning' 
  | 'info' 
  | 'connection-success' 
  | 'connection-error'
  | 'query-success'

export interface DatabaseToastProps {
  type: DatabaseToastType
  title: string
  message?: string
  duration?: number
  onClose?: () => void
}

interface ToastConfig {
  icon: React.ElementType
  gradient: string
  iconBg: string
  progressColor: string
  borderColor: string
}

const TOAST_CONFIGS: Record<DatabaseToastType, ToastConfig> = {
  success: {
    icon: CheckCircle,
    gradient: 'from-green-500 to-emerald-600',
    iconBg: 'bg-green-100',
    progressColor: 'bg-green-400',
    borderColor: 'border-green-500'
  },
  error: {
    icon: XCircle,
    gradient: 'from-red-500 to-rose-600',
    iconBg: 'bg-red-100',
    progressColor: 'bg-red-400',
    borderColor: 'border-red-500'
  },
  warning: {
    icon: AlertTriangle,
    gradient: 'from-yellow-500 to-amber-600',
    iconBg: 'bg-yellow-100',
    progressColor: 'bg-yellow-400',
    borderColor: 'border-yellow-500'
  },
  info: {
    icon: Info,
    gradient: 'from-blue-500 to-indigo-600',
    iconBg: 'bg-blue-100',
    progressColor: 'bg-blue-400',
    borderColor: 'border-blue-500'
  },
  'connection-success': {
    icon: Link,
    gradient: 'from-green-500 to-teal-600',
    iconBg: 'bg-green-100',
    progressColor: 'bg-green-400',
    borderColor: 'border-green-500'
  },
  'connection-error': {
    icon: Unlink,
    gradient: 'from-red-500 to-pink-600',
    iconBg: 'bg-red-100',
    progressColor: 'bg-red-400',
    borderColor: 'border-red-500'
  },
  'query-success': {
    icon: Database,
    gradient: 'from-blue-500 to-cyan-600',
    iconBg: 'bg-blue-100',
    progressColor: 'bg-blue-400',
    borderColor: 'border-blue-500'
  }
}

export const DatabaseToast: React.FC<DatabaseToastProps> = ({ 
  type, 
  title, 
  message, 
  duration = 3000, 
  onClose 
}) => {
  const [visible, setVisible] = useState(true)
  const [exiting, setExiting] = useState(false)
  const [progress, setProgress] = useState(100)

  const config = TOAST_CONFIGS[type]
  const Icon = config.icon

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

  return (
    <div
      className={`w-96 shadow-2xl rounded-xl overflow-hidden pointer-events-auto transform transition-all duration-300 ease-out ${
        exiting 
          ? 'opacity-0 -translate-y-4 scale-95' 
          : 'opacity-100 translate-y-0 scale-100'
      }`}
    >
      {/* 渐变色顶部条 */}
      <div className={`h-1.5 bg-gradient-to-r ${config.gradient}`} />
      
      {/* 主体内容 */}
      <div className="bg-white p-4">
        <div className="flex items-start">
          {/* 图标区域 - 渐变背景 */}
          <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          
          {/* 内容区域 */}
          <div className="ml-4 flex-1 pt-0.5">
            <p className="text-base font-semibold text-gray-900">{title}</p>
            {message && (
              <p className="mt-1 text-sm text-gray-600 leading-relaxed">{message}</p>
            )}
          </div>
          
          {/* 关闭按钮 */}
          <button
            onClick={handleClose}
            className="flex-shrink-0 ml-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors group"
          >
            <X className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          </button>
        </div>
      </div>
      
      {/* 进度条 */}
      <div className="h-1 bg-gray-100">
        <div 
          className={`h-full ${config.progressColor} transition-all duration-50 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

// Toast 容器和管理
interface ToastItem extends DatabaseToastProps {
  id: string
}

let toastId = 0
let addToastFn: ((toast: Omit<ToastItem, 'id'>) => void) | null = null

export const DatabaseToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    addToastFn = (toast) => {
      const id = `db-toast-${++toastId}`
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
    <div className="fixed top-4 right-4 z-50 space-y-3 pointer-events-none">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{ 
            transform: `translateY(${index * 4}px)`,
            animationDelay: `${index * 50}ms`
          }}
          className="pointer-events-auto animate-slide-in-top"
        >
          <DatabaseToast {...toast} onClose={() => removeToast(toast.id)} />
        </div>
      ))}
    </div>
  )
}

// 导出便捷方法
export const databaseToast = {
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
  connectionSuccess: (title: string, message?: string) => {
    addToastFn?.({ type: 'connection-success', title, message, duration: 4000 })
  },
  connectionError: (title: string, message?: string) => {
    addToastFn?.({ type: 'connection-error', title, message, duration: 6000 })
  },
  querySuccess: (title: string, message?: string) => {
    addToastFn?.({ type: 'query-success', title, message, duration: 3000 })
  }
}

export default DatabaseToast
