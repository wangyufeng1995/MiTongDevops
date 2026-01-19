/**
 * ThemeContext - 主题管理上下文
 * 提供主题检测、切换和持久化功能
 * 支持 light/dark 两种主题模式
 */
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// 获取系统主题偏好
const getSystemTheme = (): Theme => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

// 从 localStorage 读取保存的主题设置
const getSavedTheme = (): Theme | null => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('notification-theme')
    if (saved === 'light' || saved === 'dark') {
      return saved
    }
  }
  return null
}

// 应用主题到 DOM
const applyTheme = (theme: Theme) => {
  if (typeof window !== 'undefined') {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    
    // 同时更新 dark class 以兼容 Tailwind
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }
}

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // 初始化主题：优先使用保存的主题，否则使用系统主题
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = getSavedTheme()
    return saved || getSystemTheme()
  })

  // 应用初始主题
  useEffect(() => {
    applyTheme(theme)
  }, [])

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      // 只有在没有用户手动设置时才跟随系统主题
      const saved = getSavedTheme()
      if (!saved) {
        const newTheme = e.matches ? 'dark' : 'light'
        setThemeState(newTheme)
        applyTheme(newTheme)
      }
    }

    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    applyTheme(newTheme)
    // 持久化到 localStorage
    localStorage.setItem('notification-theme', newTheme)
  }

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// Hook to use theme context
export const useThemeContext = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider')
  }
  return context
}

export default ThemeContext
