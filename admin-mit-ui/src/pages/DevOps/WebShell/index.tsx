/**
 * WebShell 页面
 * SSH 终端连接页面
 */
import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Server, Terminal as TerminalIcon } from 'lucide-react'
import { SSHTerminalContainer } from '../../../components/Terminal'
import { api } from '../../../services/api'

interface HostInfo {
  id: number
  name: string
  hostname: string
  port: number
  username: string
  status: number
}

const WebShellPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const hostId = searchParams.get('hostId')
  
  const [host, setHost] = useState<HostInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 加载主机信息
  useEffect(() => {
    if (!hostId) {
      setError('未指定主机')
      setLoading(false)
      return
    }

    const fetchHost = async () => {
      try {
        const response = await api.get(`/api/hosts/${hostId}`)
        const hostData = response.data.data || response.data
        setHost(hostData)
      } catch (err) {
        console.error('Failed to fetch host:', err)
        setError('获取主机信息失败')
      } finally {
        setLoading(false)
      }
    }

    fetchHost()
  }, [hostId])

  // 返回上一页
  const handleBack = () => {
    navigate(-1)
  }

  // 处理命令被阻止
  const handleBlocked = (command: string, reason: string) => {
    console.warn('Command blocked:', command, reason)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    )
  }

  if (error || !host) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            {error || '主机不存在'}
          </h2>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            返回
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* 页面头部 */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="返回"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TerminalIcon size={24} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-800">
                SSH 终端
              </h1>
              <div className="flex items-center text-sm text-gray-500">
                <Server size={14} className="mr-1" />
                <span>{host.name}</span>
                <span className="mx-2">•</span>
                <span>{host.username}@{host.hostname}:{host.port}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 主机状态 */}
        <div className="flex items-center space-x-2">
          <span className={`inline-block w-2 h-2 rounded-full ${
            host.status === 1 ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <span className="text-sm text-gray-500">
            {host.status === 1 ? '在线' : '离线'}
          </span>
        </div>
      </div>

      {/* 终端区域 */}
      <div className="flex-1 p-4">
        <SSHTerminalContainer
          hostId={host.id}
          title={`${host.name} - ${host.username}@${host.hostname}`}
          height="calc(100vh - 180px)"
          showToolbar={true}
          showThemeSelector={true}
          showCopyPaste={true}
          showReconnect={true}
          onBlocked={handleBlocked}
          onSessionChange={(session) => {
            console.log('Session changed:', session)
          }}
        />
      </div>
    </div>
  )
}

export default WebShellPage
