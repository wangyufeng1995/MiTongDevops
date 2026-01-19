import React from 'react'
import { useTheme } from '../../hooks/useTheme'
import { tokens } from '../../styles/tokens'

export interface ProgressBarProps {
  value: number // 0-100
  max?: number // 默认100
  label?: string
  showPercentage?: boolean // 默认true
  variant?: 'default' | 'success' | 'warning' | 'error'
  animated?: boolean // 默认true
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  showPercentage = true,
  variant = 'default',
  animated = true
}) => {
  const { resolvedTheme } = useTheme()
  const colors = tokens.colors[resolvedTheme]

  // Generate unique ID for aria-describedby (sanitize to avoid CSS selector issues)
  const progressId = React.useId().replace(/:/g, '_')

  // Clamp value between 0 and max
  const clampedValue = Math.max(0, Math.min(value, max))
  const percentage = (clampedValue / max) * 100

  const getGradient = () => {
    switch (variant) {
      case 'success':
        return colors.success.gradient
      case 'warning':
        return colors.warning.gradient
      case 'error':
        return colors.error.gradient
      case 'default':
      default:
        return colors.info.gradient
    }
  }

  const isComplete = clampedValue >= max

  return (
    <div className="w-full" role="progressbar" aria-valuenow={clampedValue} aria-valuemin={0} aria-valuemax={max} aria-label={label || "Progress"} aria-describedby={label ? progressId : undefined}>
      {/* Label and Percentage */}
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1.5 sm:mb-2 gap-2">
          {label && (
            <span
              id={progressId}
              className="transition-colors duration-300 text-xs sm:text-sm truncate"
              style={{
                fontSize: tokens.typography.body.fontSize,
                fontWeight: 500,
                color: colors.text.primary
              }}
            >
              {label}
            </span>
          )}
          {showPercentage && (
            <span
              className="transition-colors duration-300 text-xs sm:text-sm flex-shrink-0"
              style={{
                fontSize: tokens.typography.body.fontSize,
                fontWeight: 500,
                color: colors.text.secondary
              }}
            >
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div
        className="w-full h-1.5 sm:h-2 rounded-full overflow-hidden transition-colors duration-300"
        style={{
          backgroundColor: colors.border.light
        }}
      >
        <div
          className={animated ? 'transition-all duration-300 ease-out' : ''}
          style={{
            width: `${percentage}%`,
            height: '100%',
            background: getGradient(),
            borderRadius: tokens.borderRadius.full
          }}
        />
      </div>

      {/* Completion Status */}
      {isComplete && (
        <div
          className="mt-1.5 sm:mt-2 text-xs sm:text-sm transition-colors duration-300"
          style={{
            color: variant === 'success' ? colors.success.text : colors.text.secondary
          }}
        >
          ✓ Complete
        </div>
      )}
    </div>
  )
}

export default ProgressBar
