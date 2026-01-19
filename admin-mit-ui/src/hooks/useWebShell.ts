/**
 * WebShell 连接管理 Hook
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { webshellService, WebShellSession, WebSocketState } from '../services/webshell'

export interface UseWebShellOptions {
  hostId: number
  autoConnect?: boolean
  onTerminalData?: (data: string) => void
  onConnectionStateChange?: (state: WebSocketState) => void
  onError?: (error: any) => void
}

export interface UseWebShellReturn {
  // 连接状态
  connectionState: WebSocketState
  isConnected: boolean
  isConnecting: boolean
  isReconnecting: boolean
  
  // 会话信息
  session: WebShellSession | null
  
  // 重连信息
  reconnectAttempt: number
  reconnectDelay: number
  
  // 操作方法
  connect: () => Promise<void>
  disconnect: () => void
  sendData: (data: string) => boolean
  sendResize: (cols: number, rows: number) => boolean
  
  // 错误信息
  error: string | null
}

export const useWebShell = (options: UseWebShellOptions): UseWebShellReturn => {
  const { hostId, autoConnect = false, onTerminalData, onConnectionStateChange, onError } = options
  
  const [connectionState, setConnectionState] = useState<WebSocketState>(WebSocketState.DISCONNECTED)
  const [session, setSession] = useState<WebShellSession | null>(null)
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const [reconnectDelay, setReconnectDelay] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  const cleanupFunctionsRef = useRef<(() => void)[]>([])
  
  // 使用 ref 存储回调函数，避免依赖变化导致重新创建 connect 函数
  const callbacksRef = useRef({
    onTerminalData,
    onConnectionStateChange,
    onError
  })
  
  // 更新 ref 中的回调
  useEffect(() => {
    callbacksRef.current = {
      onTerminalData,
      onConnectionStateChange,
      onError
    }
  }, [onTerminalData, onConnectionStateChange, onError])

  // 清理事件监听器
  const cleanup = useCallback(() => {
    cleanupFunctionsRef.current.forEach(fn => fn())
    cleanupFunctionsRef.current = []
  }, [])

  // 连接到 WebShell
  const connect = useCallback(async () => {
    try {
      setError(null)
      setConnectionState(WebSocketState.CONNECTING)
      
      await webshellService.connect(hostId)
      
      const currentSession = webshellService.getCurrentSession()
      setSession(currentSession)
      
      // 设置事件监听器
      cleanup()
      
      // 监听终端数据
      const unsubscribeData = webshellService.onTerminalData((data) => {
        callbacksRef.current.onTerminalData?.(data)
      })
      cleanupFunctionsRef.current.push(unsubscribeData)
      
      // 监听连接状态变化
      const unsubscribeState = webshellService.onConnectionStateChange((state) => {
        setConnectionState(state)
        callbacksRef.current.onConnectionStateChange?.(state)
      })
      cleanupFunctionsRef.current.push(unsubscribeState)
      
      // 监听错误
      const unsubscribeError = webshellService.onError((err) => {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        callbacksRef.current.onError?.(err)
      })
      cleanupFunctionsRef.current.push(unsubscribeError)
      
      // 监听重连
      const unsubscribeReconnect = webshellService.onReconnecting(({ attempt, delay }) => {
        setReconnectAttempt(attempt)
        setReconnectDelay(delay)
      })
      cleanupFunctionsRef.current.push(unsubscribeReconnect)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      setConnectionState(WebSocketState.ERROR)
      callbacksRef.current.onError?.(err)
    }
  }, [hostId, cleanup])

  // 断开连接
  const disconnect = useCallback(() => {
    cleanup()
    webshellService.disconnect()
    setConnectionState(WebSocketState.DISCONNECTED)
    setSession(null)
    setReconnectAttempt(0)
    setReconnectDelay(0)
    setError(null)
  }, [cleanup])

  // 发送终端数据
  const sendData = useCallback((data: string): boolean => {
    return webshellService.sendTerminalData(data)
  }, [])

  // 发送终端大小调整
  const sendResize = useCallback((cols: number, rows: number): boolean => {
    return webshellService.sendTerminalResize(cols, rows)
  }, [])

  // 自动连接 - 只在 hostId 变化时触发
  const hasConnectedRef = useRef(false)
  useEffect(() => {
    if (autoConnect && hostId && !hasConnectedRef.current) {
      hasConnectedRef.current = true
      connect()
    }
    
    return () => {
      if (hasConnectedRef.current) {
        hasConnectedRef.current = false
        disconnect()
      }
    }
  }, [hostId, autoConnect]) // 移除 connect 和 disconnect 依赖

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  // 计算派生状态
  const isConnected = connectionState === WebSocketState.CONNECTED
  const isConnecting = connectionState === WebSocketState.CONNECTING
  const isReconnecting = connectionState === WebSocketState.RECONNECTING

  return {
    // 连接状态
    connectionState,
    isConnected,
    isConnecting,
    isReconnecting,
    
    // 会话信息
    session,
    
    // 重连信息
    reconnectAttempt,
    reconnectDelay,
    
    // 操作方法
    connect,
    disconnect,
    sendData,
    sendResize,
    
    // 错误信息
    error
  }
}