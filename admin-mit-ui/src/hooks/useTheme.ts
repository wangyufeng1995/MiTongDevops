/**
 * 主题管理 Hook
 * 支持 light/dark/system 三种模式，system 模式会自动跟随系统主题
 */
import { useEffect } from 'react'
import { useAppStore, ThemeMode } from '../store/app'

export const useTheme = () => {
  const { theme, resolvedTheme, setTheme, setResolvedTheme } = useAppStore()

  // 监听系统主题变化
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? 'dark' : 'light')
    }

    // 添加监听器
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme, setResolvedTheme])

  // 切换主题的便捷方法
  const toggleTheme = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system']
    const currentIndex = modes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % modes.length
    setTheme(modes[nextIndex])
  }

  // 判断当前是否为深色模式
  const isDark = resolvedTheme === 'dark'

  return {
    theme,           // 用户设置的主题模式
    resolvedTheme,   // 实际应用的主题
    isDark,          // 是否为深色模式
    setTheme,        // 设置主题
    toggleTheme,     // 循环切换主题
  }
}

export default useTheme
