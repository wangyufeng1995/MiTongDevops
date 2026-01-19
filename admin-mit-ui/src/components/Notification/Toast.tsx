import React, { useEffect, useState, memo } from 'react'
import { X, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import { tokens } from '../../styles/tokens'
import { getToastAnimation, ANIMATION_DURATION, getAnimationDuration } from '../../utils/animations'

export type ToastType = 'success' | 'error' | 'info' | 'warning'
export type ToastPosition = 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left'

export interface ToastProps {
  id: string
  type: ToastType
  message: string
  duration?: number
  position?: ToastPosition
  closable?: boolean
  onClose?: () => void
}

const ToastComponent: React.FC<ToastProps> = ({
  id,
  type,
  message,
  duration = 3000,
  position = 'top-right',
  closable = true,
  onClose
}) => {
  const { isDark } = useTheme()
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => {
      setIsVisible(true)
    })

    // Auto dismiss
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [duration])

  const handleClose = () => {
    setIsExiting(true)
    const exitDuration = getAnimationDuration(200)
    setTimeout(() => {
      onClose?.()
    }, exitDuration) // Match exit animation duration
  }

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 flex-shrink-0" />
      case 'error':
        return <XCircle className="w-5 h-5 flex-shrink-0" />
      case 'info':
        return <Info className="w-5 h-5 flex-shrink-0" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 flex-shrink-0" />
    }
  }

  const getColors = () => {
    const themeColors = isDark ? tokens.colors.dark : tokens.colors.light
    return themeColors[type]
  }

  const colors = getColors()
  const shadows = isDark ? tokens.shadows.dark : tokens.shadows.light

  // Get animation styles based on position and state
  const getAnimationStyles = () => {
    const enterAnimation = getToastAnimation(position, 'enter')
    const exitAnimation = getToastAnimation(position, 'exit')
    
    if (isExiting) {
      return exitAnimation
    } else if (isVisible) {
      return enterAnimation
    } else {
      // Initial state (before enter animation)
      return exitAnimation
    }
  }

  const animationStyles = getAnimationStyles()
  const transitionDuration = getAnimationDuration(ANIMATION_DURATION.normal)

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className="flex items-start gap-3 w-full sm:min-w-[320px] sm:max-w-[480px] p-3 sm:p-4 rounded-lg sm:rounded-xl"
      style={{
        background: colors.light,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        boxShadow: shadows.lg,
        opacity: animationStyles.opacity,
        transform: animationStyles.transform,
        transition: `opacity ${transitionDuration}ms ease-out, transform ${transitionDuration}ms ease-out`
      }}
    >
      <div style={{ color: colors.main }}>
        {getIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        <p 
          className="text-xs sm:text-sm leading-relaxed break-words"
          style={{ 
            fontSize: tokens.typography.body.fontSize,
            lineHeight: tokens.typography.body.lineHeight
          }}
        >
          {message}
        </p>
      </div>

      {closable && (
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
          aria-label="Close notification"
          style={{ color: colors.text }}
        >
          <X className="w-4 h-4 sm:w-4 sm:h-4" />
        </button>
      )}
    </div>
  )
}

// Memoize Toast component to prevent unnecessary re-renders
// Only re-render when props actually change
const Toast = memo(ToastComponent, (prevProps, nextProps) => {
  return (
    prevProps.id === nextProps.id &&
    prevProps.type === nextProps.type &&
    prevProps.message === nextProps.message &&
    prevProps.duration === nextProps.duration &&
    prevProps.position === nextProps.position &&
    prevProps.closable === nextProps.closable
  )
})

Toast.displayName = 'Toast'

export default Toast
