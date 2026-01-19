import React, { memo, useMemo } from 'react'
import { X, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import { tokens } from '../../styles/tokens'

export type AlertType = 'success' | 'error' | 'info' | 'warning'

export interface AlertAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger'
}

export interface AlertBoxProps {
  type: AlertType
  title?: string
  message: string
  closable?: boolean
  actions?: AlertAction[]
  icon?: React.ReactNode
  onClose?: () => void
}

const AlertBoxComponent: React.FC<AlertBoxProps> = ({
  type,
  title,
  message,
  closable = true,
  actions,
  icon,
  onClose
}) => {
  const { isDark } = useTheme()

  // Memoize icon to prevent recreation on every render
  const defaultIcon = useMemo(() => {
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
  }, [type])

  // Memoize colors to prevent recalculation
  const colors = useMemo(() => {
    const themeColors = isDark ? tokens.colors.dark : tokens.colors.light
    return themeColors[type]
  }, [isDark, type])

  // Memoize button styles function
  const getButtonStyles = useMemo(() => {
    return (variant: AlertAction['variant'] = 'primary') => {
      if (variant === 'danger') {
        const errorColors = isDark ? tokens.colors.dark.error : tokens.colors.light.error
        return {
          backgroundColor: errorColors.main,
          color: '#FFFFFF',
          border: 'none'
        }
      }
      
      if (variant === 'secondary') {
        return {
          backgroundColor: 'transparent',
          color: colors.text,
          border: `1px solid ${colors.border}`
        }
      }

      return {
        backgroundColor: colors.main,
        color: '#FFFFFF',
        border: 'none'
      }
    }
  }, [isDark, colors])

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className="rounded-lg p-3 sm:p-4 transition-all duration-300"
      style={{
        backgroundColor: colors.light,
        border: `2px solid ${colors.border}`,
        color: colors.text
      }}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        <div style={{ color: colors.main }} className="mt-0.5">
          {icon || defaultIcon}
        </div>

        <div className="flex-1 min-w-0">
          {title && (
            <h3 
              className="font-semibold mb-1 text-sm sm:text-base"
              style={{
                fontSize: tokens.typography.title.fontSize,
                fontWeight: tokens.typography.title.fontWeight,
                lineHeight: tokens.typography.title.lineHeight
              }}
            >
              {title}
            </h3>
          )}
          
          <div 
            className="text-xs sm:text-sm"
            style={{
              fontSize: tokens.typography.body.fontSize,
              lineHeight: tokens.typography.body.lineHeight
            }}
          >
            {typeof message === 'string' ? (
              <p>{message}</p>
            ) : (
              message
            )}
          </div>

          {actions && actions.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className="px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-[44px] sm:min-h-0"
                  style={{
                    ...getButtonStyles(action.variant),
                    fontSize: tokens.typography.body.fontSize
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {closable && (
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 sm:p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
            aria-label="Close alert"
            style={{ color: colors.text }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// Memoize AlertBox component to prevent unnecessary re-renders
const AlertBox = memo(AlertBoxComponent, (prevProps, nextProps) => {
  return (
    prevProps.type === nextProps.type &&
    prevProps.title === nextProps.title &&
    prevProps.message === nextProps.message &&
    prevProps.closable === nextProps.closable &&
    prevProps.icon === nextProps.icon &&
    JSON.stringify(prevProps.actions) === JSON.stringify(nextProps.actions)
  )
})

AlertBox.displayName = 'AlertBox'

export default AlertBox
