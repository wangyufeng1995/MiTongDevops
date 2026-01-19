import React, { useEffect, useCallback, useState, memo, useMemo } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useTheme } from '../../hooks/useTheme'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { tokens } from '../../styles/tokens'
import { getModalAnimation, getAnimationDuration } from '../../utils/animations'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: ModalSize
  closeOnOverlayClick?: boolean
  closeOnEsc?: boolean
  danger?: boolean
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'w-full sm:max-w-[400px]',
  md: 'w-full sm:max-w-[600px]',
  lg: 'w-full sm:max-w-[800px]',
  xl: 'w-full sm:max-w-[1000px]'
}

const NotificationModalComponent: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEsc = true,
  danger = false
}) => {
  const { isDark } = useTheme()
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  
  // Use focus trap hook for accessibility
  const modalContentRef = useFocusTrap<HTMLDivElement>(isOpen)

  // Memoize theme colors and shadows
  const themeColors = useMemo(() => 
    isDark ? tokens.colors.dark : tokens.colors.light,
    [isDark]
  )
  
  const shadows = useMemo(() => 
    isDark ? tokens.shadows.dark : tokens.shadows.light,
    [isDark]
  )

  // Get modal animation configuration (memoized)
  const modalAnimation = useMemo(() => getModalAnimation(), [])
  const overlayDuration = modalAnimation.duration.overlay
  const contentDuration = modalAnimation.duration.content

  useEffect(() => {
    if (isOpen) {
      // Trigger enter animation
      requestAnimationFrame(() => {
        setIsVisible(true)
      })
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleClose = useCallback(() => {
    setIsExiting(true)
    const exitDuration = getAnimationDuration(200)
    setTimeout(() => {
      setIsVisible(false)
      setIsExiting(false)
      onClose()
    }, exitDuration) // Match exit animation duration
  }, [onClose])

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      handleClose()
    }
  }, [closeOnOverlayClick, handleClose])

  useEffect(() => {
    if (!isOpen || !closeOnEsc) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeOnEsc, handleClose])

  // Memoize animation styles - MUST be before early return
  const overlayAnimation = useMemo(() => 
    isVisible && !isExiting 
      ? modalAnimation.overlay.enter 
      : modalAnimation.overlay.exit,
    [isVisible, isExiting, modalAnimation]
  )

  const contentAnimation = useMemo(() =>
    isVisible && !isExiting
      ? modalAnimation.content.enter
      : modalAnimation.content.exit,
    [isVisible, isExiting, modalAnimation]
  )

  // Early return AFTER all hooks
  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Overlay */}
      <div
        className="fixed inset-0"
        style={{
          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
          opacity: overlayAnimation.opacity,
          transition: `opacity ${overlayDuration}ms ${modalAnimation.easing}`
        }}
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        ref={modalContentRef}
        tabIndex={-1}
        className={`relative ${sizeClasses[size]} rounded-lg sm:rounded-2xl mx-2 sm:mx-0`}
        style={{
          backgroundColor: themeColors.background.primary,
          boxShadow: shadows.xl,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          opacity: contentAnimation.opacity,
          transform: contentAnimation.transform,
          transition: `opacity ${contentDuration}ms ${modalAnimation.easing}, transform ${contentDuration}ms ${modalAnimation.easing}`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b"
          style={{ borderColor: themeColors.border.light }}
        >
          <h2
            id="modal-title"
            className="text-base sm:text-lg font-semibold pr-2"
            style={{
              color: themeColors.text.primary,
              fontSize: tokens.typography.title.fontSize,
              fontWeight: tokens.typography.title.fontWeight
            }}
          >
            {title}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 sm:p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
            aria-label="Close modal"
            style={{ color: themeColors.text.secondary }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div 
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base"
          style={{ color: themeColors.text.primary }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div 
            className="px-4 sm:px-6 py-3 sm:py-4 border-t"
            style={{ 
              borderColor: themeColors.border.light,
              backgroundColor: isDark ? themeColors.background.secondary : themeColors.background.tertiary
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

// Memoize Modal component to prevent unnecessary re-renders
const NotificationModal = memo(NotificationModalComponent, (prevProps, nextProps) => {
  return (
    prevProps.isOpen === nextProps.isOpen &&
    prevProps.title === nextProps.title &&
    prevProps.size === nextProps.size &&
    prevProps.closeOnOverlayClick === nextProps.closeOnOverlayClick &&
    prevProps.closeOnEsc === nextProps.closeOnEsc &&
    prevProps.danger === nextProps.danger &&
    prevProps.children === nextProps.children &&
    prevProps.footer === nextProps.footer
  )
})

NotificationModal.displayName = 'NotificationModal'

export default NotificationModal
