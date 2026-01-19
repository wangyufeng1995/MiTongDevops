/**
 * useNotification Hook
 * 提供类型安全的通知系统API
 * 包括Toast、Modal和Progress的便捷方法
 */
import { useNotificationContext } from '../contexts/NotificationContext'
import type { ToastType, ToastOptions, ModalConfig, ProgressConfig } from '../contexts/NotificationContext'

export const useNotification = () => {
  const context = useNotificationContext()

  return {
    // Toast便捷方法
    showToast: context.showToast,
    dismissToast: context.dismissToast,
    dismissAllToasts: context.dismissAllToasts,
    
    // Toast类型特定方法
    success: (message: string, options?: ToastOptions) => 
      context.showToast('success', message, options),
    
    error: (message: string, options?: ToastOptions) => 
      context.showToast('error', message, options),
    
    info: (message: string, options?: ToastOptions) => 
      context.showToast('info', message, options),
    
    warning: (message: string, options?: ToastOptions) => 
      context.showToast('warning', message, options),
    
    // Modal方法
    showModal: context.showModal,
    dismissModal: context.dismissModal,
    
    // Modal便捷方法
    confirm: async (title: string, content: string, danger = false): Promise<boolean> => {
      return context.showModal({
        title,
        content,
        danger,
        closeOnOverlayClick: false,
        closeOnEsc: true
      })
    },
    
    alert: async (title: string, content: string): Promise<boolean> => {
      return context.showModal({
        title,
        content,
        closeOnOverlayClick: true,
        closeOnEsc: true
      })
    },
    
    // Progress方法
    showProgress: context.showProgress,
    
    // 访问原始状态（用于高级用例）
    toasts: context.toasts,
    modals: context.modals
  }
}

export default useNotification
