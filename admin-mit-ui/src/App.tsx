import { BrowserRouter } from 'react-router-dom'
import { AppRouter } from './router'
import { useAuthStore } from './store/auth'
import { useAppStore } from './store/app'
import { useEffect, useRef } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import Loading from './components/Loading'
import { ToastContainer as OldToastContainer } from './components/Toast'
import { performanceMonitor } from './utils/performance-monitor'
import { ThemeProvider } from './contexts/ThemeContext'
import { NotificationProvider } from './contexts/NotificationContext'
import ToastContainer from './components/Notification/ToastContainer'
import ModalContainer from './components/Notification/ModalContainer'

function AppContent() {
  const { initializeAuth } = useAuthStore()
  const { loading } = useAppStore()
  const initialized = useRef(false)

  useEffect(() => {
    // 性能监控
    performanceMonitor.trackRender('App')
    
    // 防止重复初始化
    if (initialized.current) return
    initialized.current = true

    // 初始化认证状态
    initializeAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRouter />
        {loading && <Loading fullScreen text="处理中..." />}
        {/* 保留旧的ToastContainer以保持向后兼容 */}
        <OldToastContainer />
        {/* 新的通知系统ToastContainer */}
        <ToastContainer />
        {/* Modal容器 */}
        <ModalContainer />
      </BrowserRouter>
    </ErrorBoundary>
  )
}

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider maxToasts={5}>
        <AppContent />
      </NotificationProvider>
    </ThemeProvider>
  )
}

export default App