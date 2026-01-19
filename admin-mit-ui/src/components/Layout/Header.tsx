import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { notificationService } from '../../services/notification'
import { Breadcrumb } from '../Breadcrumb'
import { Avatar } from '../Avatar'
import { useThemeContext } from '../../contexts/ThemeContext'
import type { SystemNotification } from '../../types/notification'
import { 
  Bell, 
  ChevronDown, 
  LogOut, 
  User, 
  Sun, 
  Moon,
  Settings,
  HelpCircle
} from 'lucide-react'

export const Header: React.FC = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notifications, setNotifications] = useState<SystemNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const { user, logout } = useAuthStore()
  const { theme, setTheme, toggleTheme } = useThemeContext()
  const navigate = useNavigate()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const notificationRef = useRef<HTMLDivElement>(null)

  // 加载通知
  const loadNotifications = async () => {
    try {
      setLoadingNotifications(true)
      const response = await notificationService.getNotifications({
        page: 1,
        per_page: 10
      })
      setNotifications(response.items)
      setUnreadCount(response.unread_count)
    } catch (error: any) {
      // 静默处理错误，避免影响用户体验
      // 401 错误通常是因为 token 还未加载，不需要显示错误
      if (error?.response?.status !== 401) {
        console.error('加载通知失败:', error)
      }
    } finally {
      setLoadingNotifications(false)
    }
  }

  // 标记通知为已读
  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await notificationService.markAsRead(notificationId)
      // 更新本地状态
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('标记已读失败:', error)
    }
  }

  // 标记所有通知为已读
  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('标记所有已读失败:', error)
    }
  }

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    try {
      // 尝试调用后端登出接口，但不阻塞本地登出
      const { authService } = await import('../../services/auth')
      await authService.logout()
    } catch (error) {
      // 即使后端登出失败（如401），也继续本地登出
      console.warn('Backend logout failed, continuing with local logout:', error)
    } finally {
      // 清除本地认证状态
      logout()
      // 跳转到登录页
      navigate('/login', { replace: true })
    }
  }

  // 获取当前主题图标
  const getCurrentThemeIcon = () => {
    return theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />
  }

  const handleProfile = () => {
    setDropdownOpen(false)
    navigate('/profile')
  }

  const handleSettings = () => {
    setDropdownOpen(false)
    navigate('/settings')
  }

  // 点击通知铃铛时加载通知
  const handleNotificationClick = () => {
    setNotificationOpen(!notificationOpen)
    // 如果是打开通知面板，则加载最新通知
    if (!notificationOpen && user) {
      loadNotifications()
    }
  }

  const handleViewAllNotifications = () => {
    setNotificationOpen(false)
    navigate('/settings/notification')
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center justify-between h-16 px-6">
        {/* 左侧：面包屑导航 */}
        <div className="flex items-center flex-1">
          <Breadcrumb className="hidden sm:flex" />
          <div className="sm:hidden">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              欢迎回来
            </h2>
          </div>
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex items-center space-x-2">
          {/* 主题切换 - 简单的切换按钮 */}
          <button
            onClick={toggleTheme}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 rounded-md transition-colors"
            title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
            aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          >
            {getCurrentThemeIcon()}
          </button>

          {/* 帮助 */}
          <button
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 rounded-md transition-colors"
            title="帮助文档"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* 通知铃铛 */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={handleNotificationClick}
              className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 rounded-md transition-colors"
              title="通知"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* 通知下拉菜单 */}
            {notificationOpen && (
              <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    通知 {unreadCount > 0 && `(${unreadCount})`}
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                    >
                      全部标记为已读
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {loadingNotifications ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                      加载中...
                    </div>
                  ) : notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => !notification.is_read && handleMarkAsRead(notification.id)}
                        className={`p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                          !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {notification.title}
                              </p>
                              {!notification.is_read && (
                                <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                              {notification.message}
                            </p>
                            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 inline-block">
                              {notification.time_ago}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                      暂无通知
                    </div>
                  )}
                </div>
                <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleViewAllNotifications}
                    className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 py-2"
                  >
                    查看全部通知
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 用户下拉菜单 */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center space-x-2 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <Avatar
                config={{
                  style: user?.avatar_style || 'avataaars',
                  seed: user?.avatar_seed || user?.username || 'default',
                  options: user?.avatar_config || {}
                }}
                size={28}
                className="flex-shrink-0"
              />
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {user?.full_name || user?.username}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user?.roles?.[0]?.name || '用户'}
                </p>
              </div>
              <ChevronDown className="w-4 h-4" />
            </button>

            {/* 用户菜单下拉 */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <div className="py-1">
                  <button
                    onClick={handleProfile}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <User className="w-4 h-4 mr-2" />
                    个人资料
                  </button>
                  <button
                    onClick={handleSettings}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    账户设置
                  </button>
                  <hr className="my-1 border-gray-200 dark:border-gray-700" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    退出登录
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}