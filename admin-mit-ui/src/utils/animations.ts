/**
 * Animation utilities for notification components
 * Provides animation variants, timing functions, and reduced-motion detection
 */

export type AnimationVariant = 'slideIn' | 'slideOut' | 'fadeIn' | 'fadeOut' | 'scaleIn' | 'scaleOut'
export type AnimationDirection = 'left' | 'right' | 'up' | 'down'
export type AnimationEasing = 'easeIn' | 'easeOut' | 'easeInOut' | 'linear'

/**
 * Animation timing constants (in milliseconds)
 */
export const ANIMATION_DURATION = {
  fast: 150,
  normal: 300,
  slow: 500
} as const

/**
 * CSS easing functions
 */
export const EASING_FUNCTIONS: Record<AnimationEasing, string> = {
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  linear: 'linear'
}

/**
 * Check if user prefers reduced motion
 * @returns true if user has enabled reduced motion preference
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false
  
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  return mediaQuery.matches
}

/**
 * Get animation duration based on reduced motion preference
 * @param duration - Desired animation duration
 * @returns 0 if reduced motion is preferred, otherwise the original duration
 */
export const getAnimationDuration = (duration: number): number => {
  return prefersReducedMotion() ? 0 : duration
}

/**
 * Toast animation variants
 */
export interface ToastAnimationConfig {
  enter: {
    opacity: number
    transform: string
  }
  exit: {
    opacity: number
    transform: string
  }
  duration: number
  easing: string
}

/**
 * Get toast animation configuration based on position
 * @param position - Toast position on screen
 * @param variant - Animation variant (enter or exit)
 * @returns Animation CSS properties
 */
export const getToastAnimation = (
  position: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left',
  variant: 'enter' | 'exit'
): { opacity: number; transform: string } => {
  const isExit = variant === 'exit'
  
  // Determine slide direction based on position
  const slideDirections: Record<string, string> = {
    'top-right': isExit ? 'translateX(100%)' : 'translateX(0)',
    'top-center': isExit ? 'translateY(-100%)' : 'translateY(0)',
    'top-left': isExit ? 'translateX(-100%)' : 'translateX(0)',
    'bottom-right': isExit ? 'translateX(100%)' : 'translateX(0)',
    'bottom-center': isExit ? 'translateY(100%)' : 'translateY(0)',
    'bottom-left': isExit ? 'translateX(-100%)' : 'translateX(0)'
  }

  return {
    opacity: isExit ? 0 : 1,
    transform: slideDirections[position] || 'translateX(0)'
  }
}

/**
 * Modal animation variants
 */
export interface ModalAnimationConfig {
  overlay: {
    enter: { opacity: number }
    exit: { opacity: number }
  }
  content: {
    enter: { opacity: number; transform: string }
    exit: { opacity: number; transform: string }
  }
  duration: {
    overlay: number
    content: number
  }
  easing: string
}

/**
 * Get modal animation configuration
 * @returns Complete modal animation config
 */
export const getModalAnimation = (): ModalAnimationConfig => {
  const duration = getAnimationDuration(ANIMATION_DURATION.normal)
  const overlayDuration = getAnimationDuration(200)
  
  return {
    overlay: {
      enter: { opacity: 1 },
      exit: { opacity: 0 }
    },
    content: {
      enter: { opacity: 1, transform: 'scale(1)' },
      exit: { opacity: 0, transform: 'scale(0.95)' }
    },
    duration: {
      overlay: overlayDuration,
      content: duration
    },
    easing: EASING_FUNCTIONS.easeOut
  }
}

/**
 * Generate CSS transition string
 * @param properties - CSS properties to transition
 * @param duration - Duration in milliseconds
 * @param easing - Easing function
 * @returns CSS transition string
 */
export const generateTransition = (
  properties: string[],
  duration: number,
  easing: AnimationEasing = 'easeOut'
): string => {
  const actualDuration = getAnimationDuration(duration)
  const easingFunction = EASING_FUNCTIONS[easing]
  
  return properties
    .map(prop => `${prop} ${actualDuration}ms ${easingFunction}`)
    .join(', ')
}

/**
 * Create animation style object for React components
 * @param variant - Animation variant
 * @param direction - Animation direction (for slide animations)
 * @param duration - Animation duration
 * @returns React style object
 */
export const createAnimationStyle = (
  variant: AnimationVariant,
  direction: AnimationDirection = 'right',
  duration: number = ANIMATION_DURATION.normal
): React.CSSProperties => {
  const actualDuration = getAnimationDuration(duration)
  
  const baseStyle: React.CSSProperties = {
    transition: generateTransition(['opacity', 'transform'], actualDuration, 'easeOut')
  }

  if (actualDuration === 0) {
    // No animation for reduced motion, but maintain structure
    return {
      ...baseStyle,
      opacity: 1,
      transform: 'none'
    }
  }

  switch (variant) {
    case 'slideIn':
      return {
        ...baseStyle,
        opacity: 1,
        transform: 'translateX(0)'
      }
    case 'slideOut':
      const slideDistance = direction === 'left' ? '-100%' : '100%'
      return {
        ...baseStyle,
        opacity: 0,
        transform: `translateX(${slideDistance})`
      }
    case 'fadeIn':
      return {
        ...baseStyle,
        opacity: 1
      }
    case 'fadeOut':
      return {
        ...baseStyle,
        opacity: 0
      }
    case 'scaleIn':
      return {
        ...baseStyle,
        opacity: 1,
        transform: 'scale(1)'
      }
    case 'scaleOut':
      return {
        ...baseStyle,
        opacity: 0,
        transform: 'scale(0.95)'
      }
    default:
      return baseStyle
  }
}

/**
 * Hook to listen for reduced motion preference changes
 * @param callback - Function to call when preference changes
 */
export const useReducedMotionListener = (callback: (prefersReduced: boolean) => void): void => {
  if (typeof window === 'undefined') return

  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  
  const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
    callback(e.matches)
  }

  // Initial check
  handleChange(mediaQuery)

  // Listen for changes
  mediaQuery.addEventListener('change', handleChange)

  // Cleanup
  return () => {
    mediaQuery.removeEventListener('change', handleChange)
  }
}
