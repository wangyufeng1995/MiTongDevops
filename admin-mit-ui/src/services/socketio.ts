/**
 * Socket.IO 客户端服务
 * 用于与 Flask-SocketIO 后端通信
 */
import { io, Socket } from 'socket.io-client'

export interface SocketIOConfig {
  url?: string
  path?: string
  autoConnect?: boolean
  reconnection?: boolean
  reconnectionAttempts?: number
  reconnectionDelay?: number
  reconnectionDelayMax?: number
  timeout?: number
}

export type SocketIOState = 'connecting' | 'connected' | 'disconnected' | 'error'

type EventCallback = (...args: any[]) => void

export class SocketIOManager {
  private socket: Socket | null = null
  private config: Required<SocketIOConfig>
  private state: SocketIOState = 'disconnected'
  private eventListeners: Map<string, Set<EventCallback>> = new Map()
  private token: string | null = null

  constructor(config: SocketIOConfig = {}) {
    this.config = {
      url: config.url || '',
      path: config.path || '/socket.io',
      autoConnect: config.autoConnect ?? false,
      reconnection: config.reconnection ?? true,
      reconnectionAttempts: config.reconnectionAttempts ?? 10,
      reconnectionDelay: config.reconnectionDelay ?? 1000,
      reconnectionDelayMax: config.reconnectionDelayMax ?? 5000,
      timeout: config.timeout ?? 20000
    }
  }

  /**
   * 设置认证 token
   */
  setToken(token: string): void {
    this.token = token
  }

  /**
   * 连接到 Socket.IO 服务器
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve()
        return
      }

      this.setState('connecting')

      const baseUrl = this.config.url || window.location.origin
      
      this.socket = io(baseUrl, {
        path: this.config.path,
        autoConnect: false,
        reconnection: this.config.reconnection,
        reconnectionAttempts: this.config.reconnectionAttempts,
        reconnectionDelay: this.config.reconnectionDelay,
        reconnectionDelayMax: this.config.reconnectionDelayMax,
        timeout: this.config.timeout,
        transports: ['websocket', 'polling'],
        auth: this.token ? { token: this.token } : undefined
      })

      // 连接成功
      this.socket.on('connect', () => {
        this.setState('connected')
        this.emit('connected')
        resolve()
      })

      // 连接错误
      this.socket.on('connect_error', (error) => {
        console.error('Socket.IO connect error:', error)
        this.setState('error')
        this.emit('error', error)
        reject(error)
      })

      // 断开连接
      this.socket.on('disconnect', (reason) => {
        console.log('Socket.IO disconnected:', reason)
        this.setState('disconnected')
        this.emit('disconnected', reason)
      })

      // 重连中
      this.socket.io.on('reconnect_attempt', (attempt) => {
        this.setState('connecting')
        this.emit('reconnecting', { attempt })
      })

      // 重连成功
      this.socket.io.on('reconnect', (attempt) => {
        console.log('Socket.IO reconnected after', attempt, 'attempts')
        this.setState('connected')
        this.emit('reconnected', { attempt })
      })

      // 重连失败
      this.socket.io.on('reconnect_failed', () => {
        console.error('Socket.IO reconnect failed')
        this.setState('error')
        this.emit('reconnectFailed')
      })

      // 连接确认
      this.socket.on('connection_established', (data) => {
        console.log('Connection established:', data)
        this.emit('connectionEstablished', data)
      })

      // 心跳响应
      this.socket.on('pong', (data) => {
        this.emit('pong', data)
      })

      this.socket.connect()
    })
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.setState('disconnected')
  }

  /**
   * 发送事件
   */
  send(event: string, data?: any): boolean {
    if (!this.socket?.connected) {
      console.warn('Socket.IO is not connected')
      return false
    }

    this.socket.emit(event, data)
    return true
  }

  /**
   * 发送事件并等待响应
   */
  sendWithAck<T = any>(event: string, data?: any, timeout = 5000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket.IO is not connected'))
        return
      }

      const timer = setTimeout(() => {
        reject(new Error('Request timeout'))
      }, timeout)

      this.socket.emit(event, data, (response: T) => {
        clearTimeout(timer)
        resolve(response)
      })
    })
  }

  /**
   * 监听服务器事件
   */
  on(event: string, callback: EventCallback): () => void {
    // 添加到本地事件监听器
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)

    // 如果是 Socket.IO 事件，也添加到 socket
    if (this.socket && !['connected', 'disconnected', 'error', 'reconnecting', 'reconnected', 'reconnectFailed', 'connectionEstablished', 'pong'].includes(event)) {
      this.socket.on(event, callback)
    }

    // 返回取消监听函数
    return () => this.off(event, callback)
  }

  /**
   * 取消监听
   */
  off(event: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }

    if (this.socket) {
      this.socket.off(event, callback)
    }
  }

  /**
   * 触发本地事件
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
   * 获取连接状态
   */
  getState(): SocketIOState {
    return this.state
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  /**
   * 获取 socket ID
   */
  getSocketId(): string | undefined {
    return this.socket?.id
  }

  /**
   * 设置状态
   */
  private setState(state: SocketIOState): void {
    if (this.state !== state) {
      const previousState = this.state
      this.state = state
      this.emit('stateChange', { from: previousState, to: state })
    }
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    this.disconnect()
    this.eventListeners.clear()
  }
}

// 创建全局实例
export const socketIOManager = new SocketIOManager()
