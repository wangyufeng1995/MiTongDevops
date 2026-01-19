/**
 * WebShell 会话管理页面
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { SessionManager } from '../../components/WebShell'
import { hostsService } from '../../services/hosts'
import { Host } from '../../types/host'
import { Loading } from '../../components/Loading'

const WebShellManager: React.FC = () => {
  const navigate = useNavigate()
  const [hosts, setHosts] = useState<Host[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 加载主机列表
  useEffect(() => {
    const loadHosts = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await hostsService.getHosts({ page: 1, per_page: 100 })
        setHosts(response.hosts)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '加载主机列表失败'
        setError(errorMessage)
        console.error('Failed to load hosts:', err)
      } finally {
        setLoading(false)
      }
    }

    loadHosts()
  }, [])

  // 处理主机选择（跳转到主机管理页面）
  const handleHostSelect = () => {
    navigate('/hostoperate/hosts')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-center">
              <div className="text-red-600 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">加载失败</h3>
              <p className="text-gray-500 mb-4">{error}</p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  重试
                </button>
                <button
                  onClick={() => navigate('/hostoperate/hosts')}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  返回主机列表
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/hostoperate/hosts')}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft size={20} className="mr-2" />
                返回主机列表
              </button>
              <div className="h-6 border-l border-gray-300"></div>
              <h1 className="text-xl font-semibold text-gray-900">
                WebShell 会话管理
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={handleHostSelect}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus size={16} className="mr-2" />
                添加主机
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm" style={{ height: 'calc(100vh - 200px)' }}>
          <SessionManager
            hosts={hosts}
            onHostSelect={handleHostSelect}
            className="h-full"
          />
        </div>
      </div>
    </div>
  )
}

export default WebShellManager