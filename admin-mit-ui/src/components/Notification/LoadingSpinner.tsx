import React from 'react'
import { Loader2 } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import { tokens } from '../../styles/tokens'

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  color?: 'primary' | 'secondary' | 'white'
  text?: string
  fullScreen?: boolean
}

const sizeMap = {
  sm: 16,
  md: 32,
  lg: 48
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  text,
  fullScreen = false
}) => {
  const { resolvedTheme } = useTheme()
  const colors = tokens.colors[resolvedTheme]

  const getColor = () => {
    switch (color) {
      case 'primary':
        return colors.info.main
      case 'secondary':
        return colors.text.secondary
      case 'white':
        return '#FFFFFF'
      default:
        return colors.info.main
    }
  }

  const spinnerContent = (
    <div 
      className="flex flex-col items-center justify-center gap-2 sm:gap-3"
      role="status"
      aria-live="polite"
      aria-label={text || "Loading"}
    >
      <Loader2
        size={sizeMap[size]}
        className="animate-spin w-8 h-8 sm:w-auto sm:h-auto"
        style={{
          color: getColor()
        }}
        aria-hidden="true"
      />
      {text && (
        <p
          className="transition-colors duration-300 text-xs sm:text-sm text-center px-4"
          style={{
            fontSize: tokens.typography.body.fontSize,
            color: color === 'white' ? '#FFFFFF' : colors.text.secondary
          }}
          aria-live="polite"
        >
          {text}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center z-50 transition-colors duration-300"
        style={{
          backgroundColor: resolvedTheme === 'dark' 
            ? 'rgba(0, 0, 0, 0.7)' 
            : 'rgba(255, 255, 255, 0.9)'
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Loading"
      >
        {spinnerContent}
      </div>
    )
  }

  return spinnerContent
}

export default LoadingSpinner
