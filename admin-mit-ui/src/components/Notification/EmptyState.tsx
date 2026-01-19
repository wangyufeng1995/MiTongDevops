import React from 'react'
import { FileQuestion, Search, Settings, Database } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import { tokens } from '../../styles/tokens'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
  illustration?: 'default' | 'search' | 'config' | 'data'
}

const illustrationIcons = {
  default: FileQuestion,
  search: Search,
  config: Settings,
  data: Database
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  illustration = 'default'
}) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const colors = tokens.colors[resolvedTheme]

  const IllustrationIcon = illustrationIcons[illustration]

  return (
    <div
      role="status"
      aria-label={title}
      className="flex flex-col items-center justify-center p-4 sm:p-8 rounded-lg transition-colors duration-300"
      style={{
        backgroundColor: colors.background.primary,
        border: `1px solid ${colors.border.light}`
      }}
    >
      {/* Icon or Illustration */}
      <div
        className="mb-3 sm:mb-4 transition-colors duration-300"
        style={{
          color: isDark ? colors.text.tertiary : '#D1D5DB'
        }}
      >
        {icon || <IllustrationIcon size={48} className="sm:w-16 sm:h-16" strokeWidth={1.5} />}
      </div>

      {/* Title */}
      <h3
        className="mb-2 font-semibold transition-colors duration-300 text-base sm:text-lg text-center"
        style={{
          fontSize: tokens.typography.title.fontSize,
          fontWeight: tokens.typography.title.fontWeight,
          lineHeight: tokens.typography.title.lineHeight,
          color: colors.text.primary
        }}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          className="mb-4 sm:mb-6 text-center max-w-md transition-colors duration-300 text-xs sm:text-sm px-2"
          style={{
            fontSize: tokens.typography.body.fontSize,
            lineHeight: tokens.typography.body.lineHeight,
            color: colors.text.secondary
          }}
        >
          {description}
        </p>
      )}

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          aria-label={action.label}
          className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition-all duration-300 hover:scale-105 active:scale-95 text-sm sm:text-base min-h-[44px]"
          style={{
            background: colors.info.gradient,
            color: '#FFFFFF',
            fontSize: tokens.typography.body.fontSize,
            boxShadow: isDark ? tokens.shadows.dark.md : tokens.shadows.light.md
          }}
        >
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  )
}

export default EmptyState
