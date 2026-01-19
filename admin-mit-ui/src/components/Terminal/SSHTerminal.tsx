/**
 * SSH 终端组件
 * 集成 xterm.js + Socket.IO 的完整 SSH 终端实现
 */
import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SSHTerminalService, SSHTerminalSession } from '../../services/sshTerminal'
import { getThemeByName } from './themes'
import '@xterm/xterm/css/xterm.css'
import './Terminal.css'

export interface SSHTerminalProps {
  hostId: number
  className?: string
  theme?: string
  onConnected?: (session: SSHTerminalSession) => void
  onDisconnected?: (reason?: string) => void
  onError?: (error: Error) => void
  onBlocked?: (command: string, reason: string) => void
}

export interface SSHTerminalRef {
  terminal: XTerm | null
  session: SSHTerminalSession | null
  connect: () => Promise<void>
  disconnect: () => void
  reconnect: () => Promise<void>
  write: (data: string) => void
  writeln: (data: string) => void
  clear: () => void
  focus: () => void
  fit: () => void
  getSelection: () => string
  isConnected: () => boolean
}

const SSHTerminal = forwardRef<SSHTerminalRef, SSHTerminalProps>(({
  hostId,
  className = '',
  theme = 'default',
  onConnected,
  onDisconnected,
  onError,
  onBlocked
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const sshServiceRef = useRef<SSHTerminalService | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const [session, setSession] = useState<SSHTerminalSession | null>(null)

  // 初始化终端
  const initTerminal = useCallback(() => {
    if (!containerRef.current || xtermRef.current) return

    const themeConfig = getThemeByName(theme)

    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      rows: 24,
      cols: 80,
      scrollback: 10000,
      allowProposedApi: true,
      ...themeConfig.options
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)

    terminal.open(containerRef.current)
    fitAddon.fit()

    xtermRef.current = terminal
    fitAddonRef.current = fitAddon

    // 监听窗口大小变化
    const handleResize = () => {
      setTimeout(() => fitAddon.fit(), 100)
    }
    window.addEventListener('resize', handleResize)

    // 使用 ResizeObserver 监听容器大小变化
    let resizeObserver: ResizeObserver | null = null
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => {
        setTimeout(() => fitAddon.fit(), 100)
      })
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver?.disconnect()
      terminal.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [theme])

  // 连接 SSH
  const connect = useCallback(async () => {
    if (!xtermRef.current) return

    const terminal = xtermRef.current
    const fitAddon = fitAddonRef.current

    setConnectionStatus('connecting')
    terminal.writeln('\x1b[33m正在连接到主机...\x1b[0m')

    // 创建 SSH 服务实例
    const sshService = new SSHTerminalService()
    sshServiceRef.current = sshService

    try {
      const { cols, rows } = fitAddon?.proposeDimensions() || { cols: 80, rows: 24 }

      const newSession = await sshService.connect(hostId, {
        cols,
        rows,
        onData: (data) => {
          terminal.write(data)
        },
        onConnected: () => {
          setConnectionStatus('connected')
          terminal.writeln('\x1b[32m连接成功！\x1b[0m\r\n')
        },
        onDisconnected: (reason) => {
          setConnectionStatus('disconnected')
          terminal.writeln(`\r\n\x1b[31m连接已断开${reason ? `: ${reason}` : ''}\x1b[0m`)
          onDisconnected?.(reason)
        },
        onError: (error) => {
          setConnectionStatus('error')
          terminal.writeln(`\r\n\x1b[31m错误: ${error.message}\x1b[0m`)
          onError?.(error)
        },
        onBlocked: (command, reason) => {
          onBlocked?.(command, reason)
        }
      })

      setSession(newSession)
      onConnected?.(newSession)

      // 监听终端输入
      terminal.onData((data) => {
        sshService.sendInput(data)
      })

      // 监听终端大小变化
      terminal.onResize(({ cols, rows }) => {
        sshService.resize(cols, rows)
      })

    } catch (error) {
      setConnectionStatus('error')
      const errorMessage = error instanceof Error ? error.message : '连接失败'
      terminal.writeln(`\x1b[31m连接失败: ${errorMessage}\x1b[0m`)
      onError?.(error instanceof Error ? error : new Error(errorMessage))
    }
  }, [hostId, onConnected, onDisconnected, onError, onBlocked])

  // 断开连接
  const disconnect = useCallback(() => {
    sshServiceRef.current?.disconnect()
    sshServiceRef.current = null
    setSession(null)
    setConnectionStatus('disconnected')
  }, [])

  // 重新连接
  const reconnect = useCallback(async () => {
    disconnect()
    await new Promise(resolve => setTimeout(resolve, 500))
    await connect()
  }, [disconnect, connect])

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    terminal: xtermRef.current,
    session,
    connect,
    disconnect,
    reconnect,
    write: (data: string) => xtermRef.current?.write(data),
    writeln: (data: string) => xtermRef.current?.writeln(data),
    clear: () => xtermRef.current?.clear(),
    focus: () => xtermRef.current?.focus(),
    fit: () => fitAddonRef.current?.fit(),
    getSelection: () => xtermRef.current?.getSelection() || '',
    isConnected: () => sshServiceRef.current?.isConnected() ?? false
  }), [session, connect, disconnect, reconnect])

  // 初始化
  useEffect(() => {
    const cleanup = initTerminal()
    return () => {
      cleanup?.()
      disconnect()
    }
  }, [initTerminal, disconnect])

  // 自动连接
  useEffect(() => {
    if (xtermRef.current && connectionStatus === 'disconnected') {
      connect()
    }
  }, [connect, connectionStatus])

  return (
    <div className={`ssh-terminal-wrapper ${className}`}>
      {/* 状态指示器 */}
      <div className="ssh-terminal-status absolute top-2 right-2 z-10 flex items-center space-x-2">
        <span className={`inline-block w-2 h-2 rounded-full ${
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

      {/* 终端容器 */}
      <div 
        ref={containerRef}
        className="ssh-terminal-container w-full h-full"
        style={{ minHeight: '300px' }}
      />
    </div>
  )
})

SSHTerminal.displayName = 'SSHTerminal'

export default SSHTerminal
