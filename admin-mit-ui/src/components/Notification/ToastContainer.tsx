/**
 * ToastContainer - Toast通知容器组件
 * 管理Toast队列和显示，支持主题切换
 */
import React, { useMemo, memo } from 'react'
import { createPortal } from 'react-dom'
import Toast from './Toast'
import { useNotificationContext } from '../../contexts/NotificationContext'
import { useNotificationTheme } from '../../hooks/useNotificationTheme'

export interface ToastContainerProps {
  position?: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left'
}

const positionClasses: Record<string, string> = {
  'top-right': 'top-4 right-4 sm:top-4 sm:right-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2 sm:top-4',
  'top-left': 'top-4 left-4 sm:top-4 sm:left-4',
  'bottom-right': 'bottom-4 right-4 sm:bottom-4 sm:right-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 sm:bottom-4',
  'bottom-left': 'bottom-4 left-4 sm:bottom-4 sm:left-4'
}

// Mobile-specific positioning - toasts slide from top on mobile
const getMobilePositionClass = (pos: string) => {
  // On mobile, all toasts come from top-center for better UX
  if (pos.startsWith('bottom')) {
    return 'top-4 left-4 right-4 sm:bottom-4'
  }
  return 'top-4 left-4 right-4 sm:top-4'
}

const ToastContainerComponent: React.FC<ToastContainerProps> = ({ 
  position = 'top-right' 
}) => {
  const { toasts, dismissToast } = useNotificationContext()
  const { theme } = useNotificationTheme()

  // Filter out dismissed toasts
  const activeToasts = useMemo(() => {
    return toasts.filter(toast => !toast.dismissed)
  }, [toasts])

  // Memoize toasts grouped by position to prevent recalculation
  const toastsByPosition = useMemo(() => {
    return activeToasts.reduce((acc, toast) => {
      const pos = toast.position || position
      if (!acc[pos]) {
        acc[pos] = []
      }
      acc[pos].push(toast)
      return acc
    }, {} as Record<string, typeof activeToasts>)
  }, [activeToasts, position])

  // Memoize containers to prevent recreation
  const containers = useMemo(() => {
    return Object.entries(toastsByPosition).map(([pos, positionToasts]) => {
      const baseClasses = positionClasses[pos]
      const mobileClasses = getMobilePositionClass(pos)
      
      return (
        <div
          key={pos}
          className={`fixed z-50 flex flex-col gap-2 sm:gap-3 ${mobileClasses} sm:${baseClasses}`}
          data-theme={theme}
        >
          {positionToasts.map((toast) => (
            <Toast
              key={toast.id}
              id={toast.id}
              type={toast.type}
              message={toast.message}
              duration={toast.duration}
              position={toast.position}
              closable={toast.closable}
              onClose={() => dismissToast(toast.id)}
            />
          ))}
        </div>
      )
    })
  }, [toastsByPosition, theme, dismissToast])

  return createPortal(
    <>{containers}</>,
    document.body
  )
}

// Memoize ToastContainer to prevent unnecessary re-renders
const ToastContainer = memo(ToastContainerComponent)

ToastContainer.displayName = 'ToastContainer'

export default ToastContainer
