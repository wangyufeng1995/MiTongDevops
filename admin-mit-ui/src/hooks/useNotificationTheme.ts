/**
 * useNotificationTheme Hook
 * 为通知系统提供主题管理功能
 * 这是一个独立的主题hook，专门用于通知系统
 */
import { useThemeContext } from '../contexts/ThemeContext'

export const useNotificationTheme = () => {
  return useThemeContext()
}

export default useNotificationTheme
