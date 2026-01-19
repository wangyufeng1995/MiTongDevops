/**
 * SSH 终端容器组件
 * 提供完整的 SSH 终端 UI，包括工具栏、主题选择、复制粘贴等功能
 */
import { useState, useRef, useCallback } from 'react'
import { 
  Settings, Palette, Copy, Clipboard, RotateCcw, Maximize2, 
  RefreshCw, Power, Terminal as TerminalIcon, AlertCircle 
} from 'lucide-react'
import SSHTerminal, { SSHTerminalRef, SSHTerminalProps } from './SSHTerminal'
import { terminalThemes } from './themes'

export interface SSHTerminalContainerProps extends Omit<SSHTerminalProps, 'onConnected' | 'onDisconnected' | 'onError'> {
  title?: string
  showToolbar?: boolean
  showThemeSelector?: boolean
  showCopyPaste?: boolean
  showReconnect?: boolean
  height?: string | number
  onSessionChange?: (session: any) => void
}

const SSHTerminalContainer: React.FC<SSHTerminalContainerProps> = ({
  hostId,
  title = 'SSH Terminal',
  className = '',
  theme: initialTheme = 'default',
  showToolbar = true,
  showThemeSelector = true,
  showCopyPaste = true,
  showReconnect = true,
  height = '500px',
  onSessionChange,
  onBlocked
}) => {
  const [currentTheme, setCurrentTheme] = useState(initialTheme)
  const [showSettings, setShowSettings] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [blockedInfo, setBlockedInfo] = useState<{ command: string; reason: string } | null>(null)
  const terminalRef = useRef<SSHTerminalRef>(null)

  // 处理连接成功
  const handleConnected = useCallback((session: any) => {
    setConnectionStatus('connected')
    setErrorMessage(null)
    onSessionChange?.(session)
  }, [onSessionChange])

  // 处理断开连接
  const handleDisconnected = useCallback((reason?: string) => {
    setConnectionStatus('disconnected')
    if (reason) {
      setErrorMessage(reason)
    }
    onSessionChange?.(null)
  }, [onSessionChange])

  // 处理错误
  const handleError = useCallback((error: Error) => {
    setConnectionStatus('error')
    setErrorMessage(error.message)
  }, [])

  // 处理命令被阻止
  const handleBlocked = useCallback((command: string, reason: string) => {
    setBlockedInfo({ command, reason })
    onBlocked?.(command, reason)
    
    // 3秒后清除提示
    setTimeout(() => setBlockedInfo(null), 3000)
  }, [onBlocked])

  // 复制选中文本
  const handleCopy = useCallback(async () => {
    const selection = terminalRef.current?.getSelection()
    if (selection) {
      try {
        await navigator.clipboard.writeText(selection)
        console.log('Text copied to clipboard')
      } catch (err) {
        console.warn('Failed to copy to clipboard:', err)
      }
    }
  }, [])

  // 粘贴文本
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        terminalRef.current?.write(text)
      }
    } catch (err) {
      console.warn('Failed to read from clipboard:', err)
    }
  }, [])

  // 清空终端
  const handleClear = useCallback(() => {
    terminalRef.current?.clear()
  }, [])

  // 自适应大小
  const handleFit = useCallback(() => {
    terminalRef.current?.fit()
  }, [])

  // 重新连接
  const handleReconnect = useCallback(async () => {
    setConnectionStatus('connecting')
    setErrorMessage(null)
    await terminalRef.current?.reconnect()
  }, [])

  // 断开连接
  const handleDisconnect = useCallback(() => {
    terminalRef.current?.disconnect()
  }, [])

  // 切换主题
  const handleThemeChange = useCallback((newTheme: string) => {
    setCurrentTheme(newTheme)
    setShowSettings(false)
  }, [])

  return (
    <div className={`ssh-terminal-wrapper bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {/* 工具栏 */}
      {showToolbar && (
        <div className="ssh-terminal-toolbar bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center space-x-2">
            {/* 窗口控制按钮 */}
            <div className="flex space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full cursor-pointer hover:bg-red-600" 
                   onClick={handleDisconnect}
                   title="断开连接" />
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
              <div className="w-3 h-3 bg-green-500 rounded-full" />
            </div>
            
            {/* 标题 */}
            <div className="flex items-center ml-4">
              <TerminalIcon size={14} className="text-gray-400 mr-2" />
              <span className="text-gray-300 text-sm font-medium">{title}</span>
            </div>

            {/* 连接状态 */}
            <div className="flex items-center ml-4">
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                connectionStatus === 'error' ? 'bg-red-500' :
                'bg-gray-500'
              }`} />
              <span className="text-xs text-gray-400">
                {connectionStatus === 'connected' ? '已连接' :
                 connectionStatus === 'connecting' ? '连接中...' :
                 connectionStatus === 'error' ? '连接错误' :
                 '未连接'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* 复制粘贴按钮 */}
            {showCopyPaste && (
              <>
                <button
                  onClick={handleCopy}
                  className="text-gray-400 hover:text-white px-2 py-1 rounded text-sm flex items-center space-x-1 transition-colors"
                  title="复制选中文本"
                >
                  <Copy size={14} />
                  <span className="hidden sm:inline">复制</span>
                </button>
                <button
                  onClick={handlePaste}
                  className="text-gray-400 hover:text-white px-2 py-1 rounded text-sm flex items-center space-x-1 transition-colors"
                  title="粘贴"
                >
                  <Clipboard size={14} />
                  <span className="hidden sm:inline">粘贴</span>
                </button>
                <div className="h-4 border-l border-gray-600" />
              </>
            )}

            {/* 清空按钮 */}
            <button
              onClick={handleClear}
              className="text-gray-400 hover:text-white px-2 py-1 rounded text-sm flex items-center space-x-1 transition-colors"
              title="清空终端"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">清空</span>
            </button>

            {/* 自适应按钮 */}
            <button
              onClick={handleFit}
              className="text-gray-400 hover:text-white px-2 py-1 rounded text-sm flex items-center space-x-1 transition-colors"
              title="自适应大小"
            >
              <Maximize2 size={14} />
              <span className="hidden sm:inline">适应</span>
            </button>

            {/* 重连按钮 */}
            {showReconnect && (
              <button
                onClick={handleReconnect}
                disabled={connectionStatus === 'connecting'}
                className={`px-2 py-1 rounded text-sm flex items-center space-x-1 transition-colors ${
                  connectionStatus === 'connecting' 
                    ? 'text-gray-600 cursor-not-allowed' 
                    : 'text-gray-400 hover:text-white'
                }`}
                title="重新连接"
              >
                <RefreshCw size={14} className={connectionStatus === 'connecting' ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">重连</span>
              </button>
            )}

            {/* 断开连接按钮 */}
            <button
              onClick={handleDisconnect}
              disabled={connectionStatus !== 'connected'}
              className={`px-2 py-1 rounded text-sm flex items-center space-x-1 transition-colors ${
                connectionStatus !== 'connected'
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-400 hover:text-red-400'
              }`}
              title="断开连接"
            >
              <Power size={14} />
              <span className="hidden sm:inline">断开</span>
            </button>

            {/* 主题选择器 */}
            {showThemeSelector && (
              <div className="relative">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-gray-400 hover:text-white p-1 rounded transition-colors"
                  title="设置"
                >
                  <Settings size={16} />
                </button>
                
                {showSettings && (
                  <div className="absolute right-0 top-8 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-20 min-w-48">
                    <div className="p-3">
                      <div className="flex items-center space-x-2 mb-3">
                        <Palette size={16} className="text-gray-400" />
                        <span className="text-gray-300 text-sm font-medium">主题选择</span>
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {terminalThemes.map((themeOption) => (
                          <button
                            key={themeOption.name}
                            onClick={() => handleThemeChange(themeOption.name)}
                            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                              currentTheme === themeOption.name
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            {themeOption.displayName}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {errorMessage && (
        <div className="bg-red-900/50 border-b border-red-700 px-4 py-2 flex items-center">
          <AlertCircle size={14} className="text-red-400 mr-2" />
          <span className="text-red-300 text-sm">{errorMessage}</span>
          <button 
            onClick={() => setErrorMessage(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            ×
          </button>
        </div>
      )}

      {/* 命令被阻止提示 */}
      {blockedInfo && (
        <div className="bg-yellow-900/50 border-b border-yellow-700 px-4 py-2 flex items-center">
          <AlertCircle size={14} className="text-yellow-400 mr-2" />
          <span className="text-yellow-300 text-sm">
            命令被阻止: {blockedInfo.reason}
          </span>
        </div>
      )}

      {/* 终端内容区域 */}
      <div 
        className="ssh-terminal-content relative"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        <SSHTerminal
          ref={terminalRef}
          hostId={hostId}
          theme={currentTheme}
          className="h-full"
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onError={handleError}
          onBlocked={handleBlocked}
        />
      </div>
    </div>
  )
}

export default SSHTerminalContainer
