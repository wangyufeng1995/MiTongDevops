/**
 * NotificationContext - 通知系统管理上下文
 * 提供Toast和Modal的统一管理接口
 */
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { ToastType, ToastPosition } from '../components/Notification/Toast'
import { ModalSize } from '../components/Notification/Modal'

// Toast相关类型
export interface ToastOptions {
  duration?: number
  position?: ToastPosition
  closable?: boolean
}

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  duration: number
  position: ToastPosition
  closable: boolean
  timestamp: number
  dismissed: boolean
}

// Modal相关类型
export interface ModalConfig {
  title: string
  content: ReactNode
  footer?: ReactNode
  size?: ModalSize
  closeOnOverlayClick?: boolean
  closeOnEsc?: boolean
  danger?: boolean
}

export interface ModalItem {
  id: string
  config: ModalConfig
  resolve: (value: boolean) => void
  reject: (reason?: any) => void
}

// Progress相关类型
export interface ProgressConfig {
  label?: string
  showPercentage?: boolean
  variant?: 'default' | 'success' | 'warning' | 'error'
  animated?: boolean
}

export interface ProgressController {
  update: (value: number) => void
  complete: () => void
  error: () => void
  dismiss: () => void
}

// Context类型定义
interface NotificationContextType {
  // Toast管理
  toasts: ToastItem[]
  showToast: (type: ToastType, message: string, options?: ToastOptions) => string
  dismissToast: (id: string) => void
  dismissAllToasts: () => void
  
  // Modal管理
  modals: ModalItem[]
  showModal: (config: ModalConfig) => Promise<boolean>
  dismissModal: (id: string, result: boolean) => void
  
  // Progress管理
  showProgress: (config: ProgressConfig) => ProgressController
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

interface NotificationProviderProps {
  children: ReactNode
  maxToasts?: number
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ 
  children,
  maxToasts = 5 
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [modals, setModals] = useState<ModalItem[]>([])

  // Toast管理方法
  const showToast = useCallback((
    type: ToastType, 
    message: string, 
    options: ToastOptions = {}
  ): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const newToast: ToastItem = {
      id,
      type,
      message,
      duration: options.duration ?? 3000,
      position: options.position ?? 'top-right',
      closable: options.closable ?? true,
      timestamp: Date.now(),
      dismissed: false
    }

    setToasts(prev => {
      // 如果超过最大数量，移除最旧的非固定toast
      let updatedToasts = [...prev, newToast]
      if (updatedToasts.length > maxToasts) {
        updatedToasts = updatedToasts.slice(-maxToasts)
      }
      return updatedToasts
    })

    return id
  }, [maxToasts])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.map(toast => 
      toast.id === id ? { ...toast, dismissed: true } : toast
    ))
    
    // 延迟移除以允许退出动画
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id))
    }, 300)
  }, [])

  const dismissAllToasts = useCallback(() => {
    setToasts(prev => prev.map(toast => ({ ...toast, dismissed: true })))
    
    setTimeout(() => {
      setToasts([])
    }, 300)
  }, [])

  // Modal管理方法
  const showModal = useCallback((config: ModalConfig): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      const id = `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      const newModal: ModalItem = {
        id,
        config,
        resolve,
        reject
      }

      setModals(prev => [...prev, newModal])
    })
  }, [])

  const dismissModal = useCallback((id: string, result: boolean) => {
    setModals(prev => {
      const modal = prev.find(m => m.id === id)
      if (modal) {
        modal.resolve(result)
      }
      return prev.filter(m => m.id !== id)
    })
  }, [])

  // Progress管理方法
  const showProgress = useCallback((config: ProgressConfig): ProgressController => {
    const id = `progress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    let currentValue = 0

    const controller: ProgressController = {
      update: (value: number) => {
        currentValue = Math.max(0, Math.min(100, value))
        // 这里可以触发进度更新事件
        // 实际实现中可能需要额外的状态管理
      },
      complete: () => {
        currentValue = 100
        // 显示完成状态
        setTimeout(() => {
          controller.dismiss()
        }, 1000)
      },
      error: () => {
        // 显示错误状态
      },
      dismiss: () => {
        // 移除进度条
      }
    }

    return controller
  }, [])

  const value: NotificationContextType = {
    toasts,
    showToast,
    dismissToast,
    dismissAllToasts,
    modals,
    showModal,
    dismissModal,
    showProgress
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

// Hook to use notification context
export const useNotificationContext = () => {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider')
  }
  return context
}

export default NotificationContext
