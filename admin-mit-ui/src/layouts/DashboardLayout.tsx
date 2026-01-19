import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/Layout/Sidebar'
import { Header } from '../components/Layout/Header'
import { useAppStore } from '../store/app'
import { useEffect, useState } from 'react'

export const DashboardLayout: React.FC = () => {
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore()
  const [isMobile, setIsMobile] = useState(false)

  // 检测屏幕尺寸
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      
      // 在移动端自动收起侧边栏
      if (mobile && !sidebarCollapsed) {
        setSidebarCollapsed(true)
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarCollapsed])

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* 移动端遮罩层 */}
      {isMobile && !sidebarCollapsed && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}
      
      <Sidebar />
      
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
        sidebarCollapsed ? 'ml-0 md:ml-16' : 'ml-0 md:ml-64'
      }`}>
        <Header />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900 p-2 md:p-3">
          <div className="h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}