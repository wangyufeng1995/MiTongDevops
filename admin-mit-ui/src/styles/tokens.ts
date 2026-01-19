/**
 * Design Tokens for Notification System
 * Supports both light and dark themes
 */

export type Theme = 'light' | 'dark'

export interface ColorScheme {
  light: string
  main: string
  dark: string
  gradient: string
  text: string
  border: string
}

export interface ThemeColors {
  success: ColorScheme
  error: ColorScheme
  info: ColorScheme
  warning: ColorScheme
  background: {
    primary: string
    secondary: string
    tertiary: string
  }
  text: {
    primary: string
    secondary: string
    tertiary: string
  }
  border: {
    light: string
    main: string
    dark: string
  }
}

export interface Shadows {
  sm: string
  md: string
  lg: string
  xl: string
}

export interface DesignTokens {
  colors: {
    light: ThemeColors
    dark: ThemeColors
  }
  spacing: {
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
    '2xl': string
  }
  typography: {
    title: {
      fontSize: string
      fontWeight: number
      lineHeight: number
    }
    body: {
      fontSize: string
      fontWeight: number
      lineHeight: number
    }
    caption: {
      fontSize: string
      fontWeight: number
      lineHeight: number
    }
  }
  shadows: {
    light: Shadows
    dark: Shadows
  }
  borderRadius: {
    sm: string
    md: string
    lg: string
    xl: string
    full: string
  }
  timing: {
    fast: string
    normal: string
    slow: string
    easing: {
      easeIn: string
      easeOut: string
      easeInOut: string
    }
  }
}

// Light Theme Colors
const lightColors: ThemeColors = {
  success: {
    light: '#ECFDF5',
    main: '#10B981',
    dark: '#065F46',
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    text: '#065F46',
    border: '#A7F3D0'
  },
  error: {
    light: '#FEF2F2',
    main: '#EF4444',
    dark: '#991B1B',
    gradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    text: '#991B1B',
    border: '#FECACA'
  },
  info: {
    light: '#EFF6FF',
    main: '#3B82F6',
    dark: '#1E40AF',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
    text: '#1E40AF',
    border: '#BFDBFE'
  },
  warning: {
    light: '#FFFBEB',
    main: '#F59E0B',
    dark: '#92400E',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    text: '#92400E',
    border: '#FDE68A'
  },
  background: {
    primary: '#FFFFFF',
    secondary: '#F9FAFB',
    tertiary: '#F3F4F6'
  },
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    tertiary: '#9CA3AF'
  },
  border: {
    light: '#E5E7EB',
    main: '#D1D5DB',
    dark: '#9CA3AF'
  }
}

// Dark Theme Colors
const darkColors: ThemeColors = {
  success: {
    light: '#064E3B',
    main: '#10B981',
    dark: '#D1FAE5',
    gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
    text: '#D1FAE5',
    border: '#065F46'
  },
  error: {
    light: '#7F1D1D',
    main: '#EF4444',
    dark: '#FEE2E2',
    gradient: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
    text: '#FEE2E2',
    border: '#991B1B'
  },
  info: {
    light: '#1E3A8A',
    main: '#3B82F6',
    dark: '#DBEAFE',
    gradient: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
    text: '#DBEAFE',
    border: '#1E40AF'
  },
  warning: {
    light: '#78350F',
    main: '#F59E0B',
    dark: '#FEF3C7',
    gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
    text: '#FEF3C7',
    border: '#92400E'
  },
  background: {
    primary: '#1F2937',
    secondary: '#111827',
    tertiary: '#374151'
  },
  text: {
    primary: '#F9FAFB',
    secondary: '#D1D5DB',
    tertiary: '#9CA3AF'
  },
  border: {
    light: '#374151',
    main: '#4B5563',
    dark: '#6B7280'
  }
}

// Light Theme Shadows
const lightShadows: Shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
}

// Dark Theme Shadows
const darkShadows: Shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.6)'
}

// Export complete design tokens
export const tokens: DesignTokens = {
  colors: {
    light: lightColors,
    dark: darkColors
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px'
  },
  typography: {
    title: {
      fontSize: '18px',
      fontWeight: 600,
      lineHeight: 1.4
    },
    body: {
      fontSize: '14px',
      fontWeight: 400,
      lineHeight: 1.5
    },
    caption: {
      fontSize: '12px',
      fontWeight: 400,
      lineHeight: 1.4
    }
  },
  shadows: {
    light: lightShadows,
    dark: darkShadows
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px'
  },
  timing: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
    easing: {
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)'
    }
  }
}

// Helper function to get colors for current theme
export const getThemeColors = (theme: Theme): ThemeColors => {
  return tokens.colors[theme]
}

// Helper function to get shadows for current theme
export const getThemeShadows = (theme: Theme): Shadows => {
  return tokens.shadows[theme]
}
