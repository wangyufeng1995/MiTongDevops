/**
 * WebShell 页面 - 美化版 + 主题切换
 * SSH 终端连接页面，提供完整的远程主机终端交互功能
 * 支持浅色/深色/跟随系统三种主题模式
 */
import { useRef, useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  RefreshCw, 
  Power, 
  Terminal, 
  Server, 
  Clock,
  Activity,
  Shield,
  Maximize2,
  Minimize2,
  Settings,
  HelpCircle,
  Copy,
  Download,
  Trash2,
  Palette,
  Check,
  Sun,
  Moon,
  Monitor
} from 'lucide-react'
import { ConnectionStatus, WebShellTerminal, WebShellTerminalRef } from '../../components/WebShell'
import { WebSocketState } from '../../services/webshell'
import { api } from '../../services/api'
import { terminalThemes } from '../../components/Terminal/themes'
import { useTheme } from '../../hooks/useTheme'
import { ThemeMode } from '../../store/app'

interface HostInfo {
  id: number
  name: string
  hostname: string
  port: number
  username: string
  status: number
  os_type?: string
  description?: string
}

const WebShell: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const webshellRef = useRef<WebShellTerminalRef>(null)
  const { theme: pageTheme, isDark, setTheme: setPageTheme } = useTheme()

  const [connectionState, setConnectionState] = useState<WebSocketState>(WebSocketState.DISCONNECTED)
  const [error, setError] = useState<string | null>(null)
  const [host, setHost] = useState<HostInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [connectedTime, setConnectedTime] = useState<Date | null>(null)
  const [sessionDuration, setSessionDuration] = useState<string>('00:00:00')
  const [showHelp, setShowHelp] = useState(false)
  const [showThemeSelector, setShowThemeSelector] = useState(false)
  const [showPageThemeSelector, setShowPageThemeSelector] = useState(false)
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('webshell-theme') || 'default'
  })

  const hostId = id

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
        const hostData = response.data.data?.host || response.data.host || response.data.data || response.data
        console.log('Fetched host data:', hostData)
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

  // 计算会话时长
  useEffect(() => {
    if (!connectedTime) {
      setSessionDuration('00:00:00')
      return
    }

    const timer = setInterval(() => {
      const now = new Date()
      const diff = Math.floor((now.getTime() - connectedTime.getTime()) / 1000)
      const hours = Math.floor(diff / 3600).toString().padStart(2, '0')
      const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0')
      const seconds = (diff % 60).toString().padStart(2, '0')
      setSessionDuration(`${hours}:${minutes}:${seconds}`)
    }, 1000)

    return () => clearInterval(timer)
  }, [connectedTime])

  // 处理连接状态变化
  const handleConnectionStateChange = useCallback((state: WebSocketState) => {
    setConnectionState(state)
    
    if (state === WebSocketState.CONNECTED) {
      setConnectedTime(new Date())
      setError(null)
    } else if (state === WebSocketState.DISCONNECTED || state === WebSocketState.ERROR) {
      setConnectedTime(null)
    }
  }, [])

  // 处理错误
  const handleError = useCallback((error: any) => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    setError(errorMessage)
  }, [])

  // 手动连接
  const handleConnect = async () => {
    setError(null)
    if (webshellRef.current) {
      await webshellRef.current.connectToHost()
    }
  }

  // 手动断开连接并关闭页面
  const handleDisconnect = () => {
    if (webshellRef.current) {
      webshellRef.current.disconnectFromHost()
    }
    navigate('/hostoperate/hosts')
  }

  // 清空终端
  const handleClear = () => {
    if (webshellRef.current) {
      webshellRef.current.clearTerminal()
    }
  }

  // 切换全屏
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  // 切换终端主题
  const handleThemeChange = useCallback((themeName: string) => {
    setCurrentTheme(themeName)
    localStorage.setItem('webshell-theme', themeName)
    setShowThemeSelector(false)
  }, [])

  // 切换页面主题
  const handlePageThemeChange = useCallback((mode: ThemeMode) => {
    setPageTheme(mode)
    setShowPageThemeSelector(false)
  }, [setPageTheme])

  // 复制会话信息
  const copySessionInfo = async () => {
    if (!host) return
    const info = `主机: ${host.name}\n地址: ${host.hostname}:${host.port}\n用户: ${host.username}`
    try {
      await navigator.clipboard.writeText(info)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // 点击外部关闭选择器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showThemeSelector && !target.closest('[data-theme-selector]')) {
        setShowThemeSelector(false)
      }
      if (showPageThemeSelector && !target.closest('[data-page-theme-selector]')) {
        setShowPageThemeSelector(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showThemeSelector, showPageThemeSelector])

  const isConnected = connectionState === WebSocketState.CONNECTED
  const isConnecting = connectionState === WebSocketState.CONNECTING
  const isReconnecting = connectionState === WebSocketState.RECONNECTING

  // 页面主题选项
  const pageThemeOptions: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'light', label: '浅色', icon: <Sun size={16} /> },
    { mode: 'dark', label: '深色', icon: <Moon size={16} /> },
    { mode: 'system', label: '跟随系统', icon: <Monitor size={16} /> },
  ]

  // 加载中状态
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        isDark 
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
          : 'bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100'
      }`}>
        <div className="text-center">
          <div className="relative">
            <div className={`w-16 h-16 border-4 rounded-full animate-pulse ${
              isDark ? 'border-blue-500/30' : 'border-blue-400/40'
            }`} />
            <div className={`absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-spin ${
              isDark ? 'border-t-blue-500' : 'border-t-blue-500'
            }`} />
          </div>
          <p className={`mt-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>加载主机信息...</p>
        </div>
      </div>
    )
  }

  // 错误状态（无主机信息）
  if (!host) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        isDark 
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
          : 'bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100'
      }`}>
        <div className="text-center max-w-md mx-auto px-4">
          <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${
            isDark ? 'bg-red-500/10' : 'bg-red-100'
          }`}>
            <Server size={40} className={isDark ? 'text-red-400' : 'text-red-500'} />
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>主机不存在</h2>
          <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{error || '无法找到指定的主机信息'}</p>
          <button
            onClick={() => navigate('/hostoperate/hosts')}
            className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <ArrowLeft size={18} className="mr-2" />
            返回主机列表
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100'
    } ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* 顶部导航栏 */}
      <header className={`backdrop-blur-md border-b relative transition-colors duration-300 ${
        isDark 
          ? 'bg-gray-800/70 border-gray-700/50' 
          : 'bg-white/80 border-gray-200/80 shadow-sm'
      }`} style={{ zIndex: 100 }}>
        <div className="max-w-full mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* 左侧：返回和标题 */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/hostoperate/hosts')}
                className={`flex items-center transition-colors group ${
                  isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <ArrowLeft size={18} className="mr-1 group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm">返回</span>
              </button>
              
              <div className="hidden sm:flex items-center space-x-3">
                <div className={`w-px h-6 ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />
                <div className="flex items-center space-x-2">
                  <div className={`p-1.5 rounded-lg ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-100'}`}>
                    <Terminal size={18} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
                  </div>
                  <div>
                    <h1 className={`font-semibold text-sm leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {host?.name || '未知主机'}
                    </h1>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {host?.username || 'user'}@{host?.hostname || 'unknown'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 中间：连接状态 */}
            <div className="hidden md:flex items-center space-x-6">
              <ConnectionStatus 
                state={connectionState}
                reconnectAttempt={0}
                reconnectDelay={0}
              />
              
              {isConnected && (
                <div className="flex items-center space-x-4 text-sm">
                  <div className={`flex items-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    <Clock size={14} className="mr-1.5" />
                    <span className="font-mono">{sessionDuration}</span>
                  </div>
                  <div className="flex items-center text-emerald-500">
                    <Activity size={14} className="mr-1.5" />
                    <span>活跃</span>
                  </div>
                </div>
              )}
            </div>

            {/* 右侧：操作按钮 */}
            <div className="flex items-center space-x-2">
              {/* 页面主题切换按钮 */}
              <div className="relative" data-page-theme-selector>
                <button
                  onClick={() => setShowPageThemeSelector(!showPageThemeSelector)}
                  className={`p-2 rounded-lg transition-colors ${
                    isDark 
                      ? 'text-gray-400 hover:text-white hover:bg-gray-700/50' 
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                  title="页面主题"
                >
                  {pageTheme === 'light' ? <Sun size={18} /> : pageTheme === 'dark' ? <Moon size={18} /> : <Monitor size={18} />}
                </button>
                
                {showPageThemeSelector && (
                  <div className={`absolute right-0 top-full mt-2 w-44 rounded-xl shadow-2xl z-50 border ${
                    isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  }`}>
                    <div className={`px-3 py-2 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                      <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>页面主题</span>
                    </div>
                    <div className="py-1">
                      {pageThemeOptions.map((option) => (
                        <button
                          key={option.mode}
                          onClick={() => handlePageThemeChange(option.mode)}
                          className={`w-full px-3 py-2.5 flex items-center justify-between text-sm transition-colors ${
                            pageTheme === option.mode
                              ? 'bg-blue-600/20 text-blue-500'
                              : isDark 
                                ? 'text-gray-300 hover:bg-gray-700/50' 
                                : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            {option.icon}
                            <span>{option.label}</span>
                          </div>
                          {pageTheme === option.mode && <Check size={14} className="text-blue-500" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 终端主题选择按钮 */}
              <div className="relative" data-theme-selector>
                <button
                  onClick={() => setShowThemeSelector(!showThemeSelector)}
                  className={`p-2 rounded-lg transition-colors ${
                    isDark 
                      ? 'text-gray-400 hover:text-white hover:bg-gray-700/50' 
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                  title="终端主题"
                >
                  <Palette size={18} />
                </button>
                
                {showThemeSelector && (
                  <div className={`absolute right-0 top-full mt-2 w-52 rounded-xl shadow-2xl z-50 border ${
                    isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  }`}>
                    <div className={`px-3 py-2 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                      <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>终端主题</span>
                    </div>
                    <div className="py-1">
                      {terminalThemes.map((theme) => (
                        <button
                          key={theme.name}
                          onClick={() => handleThemeChange(theme.name)}
                          className={`w-full px-3 py-2.5 flex items-center justify-between text-sm transition-colors ${
                            currentTheme === theme.name
                              ? 'bg-blue-600/20 text-blue-500'
                              : isDark 
                                ? 'text-gray-300 hover:bg-gray-700/50' 
                                : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div 
                              className={`w-5 h-5 rounded border ${isDark ? 'border-gray-600' : 'border-gray-300'}`}
                              style={{ backgroundColor: theme.options.theme?.background || '#000' }}
                            />
                            <span>{theme.displayName}</span>
                          </div>
                          {currentTheme === theme.name && <Check size={14} className="text-blue-500" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 帮助按钮 */}
              <button
                onClick={() => setShowHelp(!showHelp)}
                className={`p-2 rounded-lg transition-colors ${
                  isDark 
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700/50' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title="帮助"
              >
                <HelpCircle size={18} />
              </button>

              {/* 全屏按钮 */}
              <button
                onClick={toggleFullscreen}
                className={`p-2 rounded-lg transition-colors ${
                  isDark 
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700/50' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title={isFullscreen ? '退出全屏' : '全屏'}
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>

              {/* 连接/断开按钮 */}
              {!isConnected && !isConnecting && !isReconnecting ? (
                <button
                  onClick={handleConnect}
                  className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
                >
                  <Power size={16} className="mr-2" />
                  连接
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  disabled={isConnecting}
                  className="inline-flex items-center px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  <Power size={16} className="mr-2" />
                  断开
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className={`${isFullscreen ? 'h-[calc(100vh-56px)]' : 'max-w-full mx-auto px-4 sm:px-6 py-4'}`}>
        <div className={`${isFullscreen ? 'h-full' : ''} flex flex-col lg:flex-row gap-4`}>
          
          {/* 左侧信息面板 - 非全屏时显示 */}
          {!isFullscreen && (
            <div className="lg:w-72 flex-shrink-0 space-y-4">
              {/* 主机信息卡片 */}
              <div className={`backdrop-blur-md rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-lg ${
                isDark 
                  ? 'bg-gray-800/60 border-gray-700/50 hover:border-gray-600/50' 
                  : 'bg-white/80 border-gray-200/80 shadow-sm hover:shadow-md'
              }`}>
                <div className={`px-4 py-3 border-b flex items-center justify-between ${
                  isDark ? 'border-gray-700/50' : 'border-gray-100'
                }`}>
                  <h3 className={`font-medium text-sm flex items-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    <Server size={16} className={`mr-2 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                    主机信息
                  </h3>
                  <button
                    onClick={copySessionInfo}
                    className={`p-1.5 rounded-md transition-colors ${
                      isDark ? 'text-gray-500 hover:text-white hover:bg-gray-700/50' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                    title="复制信息"
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <InfoRow label="主机名称" value={host.name || '-'} isDark={isDark} />
                  <InfoRow label="主机地址" value={host.hostname || '-'} isDark={isDark} />
                  <InfoRow label="端口" value={String(host.port || 22)} isDark={isDark} />
                  <InfoRow label="用户名" value={host.username || '-'} isDark={isDark} />
                  <InfoRow 
                    label="状态" 
                    value={
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        host.status === 1 
                          ? isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                          : isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-100 text-red-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          host.status === 1 ? 'bg-emerald-500' : 'bg-red-500'
                        }`} />
                        {host.status === 1 ? '在线' : '离线'}
                      </span>
                    } 
                    isDark={isDark}
                  />
                  {host.os_type && <InfoRow label="系统类型" value={host.os_type} isDark={isDark} />}
                </div>
              </div>

              {/* 会话信息卡片 */}
              <div className={`backdrop-blur-md rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-lg ${
                isDark 
                  ? 'bg-gray-800/60 border-gray-700/50 hover:border-gray-600/50' 
                  : 'bg-white/80 border-gray-200/80 shadow-sm hover:shadow-md'
              }`}>
                <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-100'}`}>
                  <h3 className={`font-medium text-sm flex items-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    <Activity size={16} className={`mr-2 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
                    会话信息
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  <InfoRow 
                    label="连接状态" 
                    value={
                      <span className={`text-sm font-medium ${
                        isConnected ? 'text-emerald-500' : 
                        isConnecting || isReconnecting ? 'text-yellow-500' : 
                        connectionState === WebSocketState.ERROR ? 'text-red-500' :
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {isConnected ? '已连接' : 
                         isConnecting ? '连接中...' : 
                         isReconnecting ? '重连中...' :
                         connectionState === WebSocketState.ERROR ? '连接错误' :
                         '未连接'}
                      </span>
                    } 
                    isDark={isDark}
                  />
                  <InfoRow 
                    label="会话时长" 
                    value={<span className="font-mono text-blue-500">{sessionDuration}</span>} 
                    isDark={isDark}
                  />
                  {connectedTime && (
                    <InfoRow 
                      label="连接时间" 
                      value={connectedTime.toLocaleTimeString()} 
                      isDark={isDark}
                    />
                  )}
                </div>
              </div>

              {/* 快捷操作 */}
              <div className={`backdrop-blur-md rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-lg ${
                isDark 
                  ? 'bg-gray-800/60 border-gray-700/50 hover:border-gray-600/50' 
                  : 'bg-white/80 border-gray-200/80 shadow-sm hover:shadow-md'
              }`}>
                <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-100'}`}>
                  <h3 className={`font-medium text-sm flex items-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    <Settings size={16} className={`mr-2 ${isDark ? 'text-orange-400' : 'text-orange-500'}`} />
                    快捷操作
                  </h3>
                </div>
                <div className="p-3 grid grid-cols-2 gap-2">
                  <QuickAction 
                    icon={<Trash2 size={16} />} 
                    label="清空" 
                    onClick={handleClear}
                    disabled={!isConnected}
                    isDark={isDark}
                  />
                  <QuickAction 
                    icon={<RefreshCw size={16} />} 
                    label="重连" 
                    onClick={handleConnect}
                    disabled={isConnected || isConnecting}
                    isDark={isDark}
                  />
                  <QuickAction 
                    icon={<Maximize2 size={16} />} 
                    label="全屏" 
                    onClick={toggleFullscreen}
                    isDark={isDark}
                  />
                  <QuickAction 
                    icon={<Download size={16} />} 
                    label="导出" 
                    onClick={() => {}}
                    disabled
                    isDark={isDark}
                  />
                </div>
              </div>

              {/* 安全提示 */}
              <div className={`rounded-2xl p-4 border transition-all duration-300 ${
                isDark 
                  ? 'bg-amber-500/5 border-amber-500/20' 
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-start space-x-3">
                  <Shield size={18} className={`flex-shrink-0 mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                  <div>
                    <h4 className={`font-medium text-sm mb-1 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>安全提示</h4>
                    <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-amber-600/80'}`}>
                      所有终端操作将被记录审计。请勿执行危险命令或泄露敏感信息。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 终端区域 */}
          <div className={`flex-1 ${isFullscreen ? 'h-full' : 'min-h-[600px]'}`}>
            <div className={`bg-gray-900 rounded-xl border overflow-hidden shadow-2xl h-full flex flex-col ${
              isDark ? 'border-gray-700/50' : 'border-gray-300'
            }`}>
              {/* 终端标题栏 */}
              <div className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700/50 flex-shrink-0">
                <div className="flex items-center space-x-3">
                  {/* macOS 风格按钮 */}
                  <div className="flex items-center space-x-1.5">
                    <button 
                      onClick={handleDisconnect}
                      className="w-3 h-3 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                      title="断开连接"
                    />
                    <button 
                      className="w-3 h-3 bg-yellow-500 rounded-full hover:bg-yellow-600 transition-colors"
                      title="最小化"
                    />
                    <button 
                      onClick={toggleFullscreen}
                      className="w-3 h-3 bg-green-500 rounded-full hover:bg-green-600 transition-colors"
                      title="全屏"
                    />
                  </div>
                  
                  <div className="flex items-center text-gray-400 text-sm">
                    <Terminal size={14} className="mr-2" />
                    <span>{host?.username || 'user'}@{host?.hostname || 'unknown'}</span>
                    {isConnected && (
                      <span className="ml-2 text-emerald-400">●</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span>SSH</span>
                  <span>•</span>
                  <span>Port {host?.port || 22}</span>
                </div>
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center text-red-400 text-sm">
                    <span className="mr-2">⚠</span>
                    {error}
                  </div>
                  <button 
                    onClick={() => setError(null)}
                    className="text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* 终端内容 - 使用 flex-1 填充剩余空间 */}
              <div className="flex-1 min-h-0">
                <WebShellTerminal
                  ref={webshellRef}
                  hostId={parseInt(hostId || '0')}
                  className="w-full h-full"
                  autoConnect={false}
                  theme={currentTheme}
                  onConnectionStateChange={handleConnectionStateChange}
                  onError={handleError}
                  onThemeChange={handleThemeChange}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 帮助面板 */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
          <div className={`rounded-2xl border max-w-lg w-full shadow-2xl ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`} onClick={e => e.stopPropagation()}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              isDark ? 'border-gray-700' : 'border-gray-100'
            }`}>
              <h3 className={`font-semibold flex items-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <HelpCircle size={20} className="mr-2 text-blue-500" />
                快捷键帮助
              </h3>
              <button 
                onClick={() => setShowHelp(false)} 
                className={`text-2xl leading-none ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <ShortcutItem keys={['Ctrl', 'C']} description="复制选中文本 / 中断命令" isDark={isDark} />
              <ShortcutItem keys={['Ctrl', 'V']} description="粘贴文本" isDark={isDark} />
              <ShortcutItem keys={['Ctrl', 'A']} description="全选终端内容" isDark={isDark} />
              <ShortcutItem keys={['Ctrl', 'L']} description="清屏" isDark={isDark} />
              <ShortcutItem keys={['↑', '↓']} description="浏览命令历史" isDark={isDark} />
              <ShortcutItem keys={['Tab']} description="命令自动补全" isDark={isDark} />
              <ShortcutItem keys={['Ctrl', 'D']} description="退出当前会话" isDark={isDark} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 信息行组件
const InfoRow: React.FC<{ label: string; value: React.ReactNode; isDark: boolean }> = ({ label, value, isDark }) => (
  <div className="flex items-center justify-between">
    <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{label}</span>
    <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{value}</span>
  </div>
)

// 快捷操作按钮组件
const QuickAction: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  onClick: () => void;
  disabled?: boolean;
  isDark: boolean;
}> = ({ icon, label, onClick, disabled, isDark }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center justify-center space-x-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
      disabled 
        ? isDark 
          ? 'bg-gray-700/30 text-gray-600 cursor-not-allowed' 
          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        : isDark 
          ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:text-white hover:scale-105' 
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 hover:scale-105'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
)

// 快捷键项组件
const ShortcutItem: React.FC<{ keys: string[]; description: string; isDark: boolean }> = ({ keys, description, isDark }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-1">
      {keys.map((key, index) => (
        <span key={index}>
          <kbd className={`px-2 py-1 rounded text-xs font-mono ${
            isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700 border border-gray-200'
          }`}>
            {key}
          </kbd>
          {index < keys.length - 1 && <span className={`mx-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>+</span>}
        </span>
      ))}
    </div>
    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{description}</span>
  </div>
)

export default WebShell
