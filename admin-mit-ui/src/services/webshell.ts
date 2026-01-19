/**
 * WebShell 服务
 * 使用 Socket.IO 与 Flask-SocketIO 后端通信
 */
import { io, Socket } from 'socket.io-client'
import { api } from './api'

// 兼容旧的 WebSocketState 枚举
export enum WebSocketState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

export interface WebShellSession {
  id: string
  hostId: number
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  createdAt: string
}

type EventCallback = (...args: any[]) => void

export class WebShellService {
  private socket: Socket | null = null
  private currentSession: WebShellSession | null = null
  private hostId: number | null = null
  private state: WebSocketState = WebSocketState.DISCONNECTED
  private eventListeners: Map<string, Set<EventCallback>> = new Map()
  private isTerminalCreated = false

  /**
   * 创建 WebShell 会话
   */
  async createSession(hostId: number): Promise<WebShellSession> {
    try {
      const response = await api.post(`/api/hosts/${hostId}/webshell`, {})
      const data = response.data.data || response.data
      this.currentSession = {
        id: data.session_id,
        hostId: data.host_id,
        status: 'connecting',
        createdAt: data.created_at
      }
      this.hostId = hostId
      return this.currentSession
    } catch (error) {
      console.error('Failed to create WebShell session:', error)
      throw error
    }
  }

  /**
   * 连接到 WebShell
   */
  async connect(hostId: number): Promise<void> {
    // 如果已经连接到同一主机，直接返回
    if (this.socket?.connected && this.hostId === hostId && this.isTerminalCreated) {
      return
    }

    // 断开现有连接
    if (this.socket) {
      this.disconnect()
    }

    // 创建会话
    const session = await this.createSession(hostId)
    
    this.setState(WebSocketState.CONNECTING)

    // 获取认证 token
    const token = localStorage.getItem('token')
    
    // 构建连接 URL，如果有 token 则添加到查询参数
    const baseUrl = window.location.origin
    
    // 创建 Socket.IO 连接
    this.socket = io(baseUrl, {
      path: '/socket.io',
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ['polling'],  // 只使用 polling，避免 WebSocket 代理问题
      auth: token ? { token } : {},
      query: token ? { token } : {}
    })

    // 设置事件监听器
    this.setupSocketListeners(session.id)

    // 连接
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, 30000)

      this.socket!.on('connect', () => {
        console.log('Socket.IO connected')
        // 创建终端会话
        this.createTerminal(session.id)
      })

      this.socket!.on('webshell_terminal_created', (data: any) => {
        console.log('Received webshell_terminal_created:', data)
        if (data.session_id === session.id) {
          clearTimeout(timeout)
          this.isTerminalCreated = true
          this.setState(WebSocketState.CONNECTED)
          if (this.currentSession) {
            this.currentSession.status = 'connected'
          }
          resolve()
        }
      })

      this.socket!.on('connect_error', (error) => {
        clearTimeout(timeout)
        console.error('Socket.IO connect error:', error)
        this.setState(WebSocketState.ERROR)
        reject(error)
      })

      this.socket!.on('webshell_error', (data: any) => {
        if (!data.session_id || data.session_id === session.id) {
          clearTimeout(timeout)
          console.error('WebShell error:', data.message)
          this.setState(WebSocketState.ERROR)
          this.emit('error', new Error(data.message))
          reject(new Error(data.message))
        }
      })

      this.socket!.connect()
    })
  }

  /**
   * 设置 Socket 事件监听器
   */
  private setupSocketListeners(sessionId: string): void {
    if (!this.socket) return

    // 连接成功
    this.socket.on('connection_established', (data) => {
      console.log('Connection established:', data)
    })

    // 断开连接
    this.socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason)
      this.setState(WebSocketState.DISCONNECTED)
      if (this.currentSession) {
        this.currentSession.status = 'disconnected'
      }
      this.isTerminalCreated = false
      this.emit('stateChange', { to: WebSocketState.DISCONNECTED })
    })

    // 重连中
    this.socket.io.on('reconnect_attempt', (attempt) => {
      console.log('Reconnecting attempt:', attempt)
      this.setState(WebSocketState.RECONNECTING)
      this.emit('reconnecting', { attempt, delay: 1000 * attempt })
    })

    // 重连成功
    this.socket.io.on('reconnect', (attempt) => {
      console.log('Reconnected after', attempt, 'attempts')
      // 重新创建终端
      this.createTerminal(sessionId)
    })

    // 重连失败
    this.socket.io.on('reconnect_failed', () => {
      console.error('Reconnect failed')
      this.setState(WebSocketState.ERROR)
      this.emit('reconnectFailed')
    })

    // 终端输出
    this.socket.on('webshell_output', (data: any) => {
      console.log('Received webshell_output:', data.session_id, 'expected:', sessionId, 'data length:', data.data?.length)
      if (data.session_id === sessionId) {
        this.emit('terminalData', data.data)
      }
    })

    // 终端大小调整确认
    this.socket.on('webshell_resized', (data: any) => {
      if (data.session_id === sessionId) {
        console.log('Terminal resized:', data.cols, 'x', data.rows)
      }
    })

    // 终端终止
    this.socket.on('webshell_terminal_terminated', (data: any) => {
      if (data.session_id === sessionId) {
        console.log('Terminal terminated:', data.message)
        this.isTerminalCreated = false
        this.setState(WebSocketState.DISCONNECTED)
        if (this.currentSession) {
          this.currentSession.status = 'disconnected'
        }
      }
    })

    // 会话终止
    this.socket.on('webshell_session_terminated', (data: any) => {
      if (data.session_id === sessionId) {
        console.log('Session terminated:', data.reason)
        this.isTerminalCreated = false
        this.setState(WebSocketState.DISCONNECTED)
        if (this.currentSession) {
          this.currentSession.status = 'disconnected'
        }
      }
    })

    // 心跳响应
    this.socket.on('pong', () => {
      // 心跳正常
    })
  }

  /**
   * 创建终端会话
   */
  private createTerminal(sessionId: string, cols = 80, rows = 24): void {
    if (!this.socket?.connected) return

    this.socket.emit('webshell_create_terminal', {
      session_id: sessionId,
      cols,
      rows,
      use_bridge: true  // 使用优化的桥接模式
    })
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket && this.currentSession) {
      // 发送终止终端请求
      this.socket.emit('webshell_terminate_terminal', {
        session_id: this.currentSession.id
      })
    }

    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }

    this.currentSession = null
    this.hostId = null
    this.isTerminalCreated = false
    this.setState(WebSocketState.DISCONNECTED)
    this.eventListeners.clear()
  }

  /**
   * 发送终端数据
   */
  sendTerminalData(data: string): boolean {
    if (!this.socket?.connected || !this.currentSession || !this.isTerminalCreated) {
      console.warn('Cannot send data: not connected or terminal not created')
      return false
    }

    this.socket.emit('webshell_input', {
      session_id: this.currentSession.id,
      data: data
    })
    return true
  }

  /**
   * 发送终端大小调整
   */
  sendTerminalResize(cols: number, rows: number): boolean {
    if (!this.socket?.connected || !this.currentSession) {
      return false
    }

    this.socket.emit('webshell_resize', {
      session_id: this.currentSession.id,
      cols,
      rows
    })
    return true
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): WebSocketState {
    return this.state
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.socket?.connected && this.isTerminalCreated
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(): WebShellSession | null {
    return this.currentSession
  }

  /**
   * 监听终端数据
   */
  onTerminalData(callback: (data: string) => void): () => void {
    return this.on('terminalData', callback)
  }

  /**
   * 监听连接状态变化
   */
  onConnectionStateChange(callback: (state: WebSocketState) => void): () => void {
    // 立即调用一次当前状态
    callback(this.state)
    
    return this.on('stateChange', (data: { from?: WebSocketState; to: WebSocketState }) => {
      callback(data.to)
    })
  }

  /**
   * 监听连接错误
   */
  onError(callback: (error: any) => void): () => void {
    return this.on('error', callback)
  }

  /**
   * 监听重连事件
   */
  onReconnecting(callback: (info: { attempt: number; delay: number }) => void): () => void {
    return this.on('reconnecting', callback)
  }

  /**
   * 添加事件监听器
   */
  private on(event: string, callback: EventCallback): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)

    return () => {
      const listeners = this.eventListeners.get(event)
      if (listeners) {
        listeners.delete(callback)
      }
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args)
        } catch (error) {
          console.error('Error in event listener:', error)
        }
      })
    }
  }

  /**
   * 设置状态
   */
  private setState(state: WebSocketState): void {
    if (this.state !== state) {
      const previousState = this.state
      this.state = state
      this.emit('stateChange', { from: previousState, to: state })
    }
  }
}

// 创建全局实例
export const webshellService = new WebShellService()
