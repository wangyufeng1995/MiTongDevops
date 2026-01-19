/**
 * WebSocket 连接管理服务
 */

// Browser-compatible EventEmitter implementation
class BrowserEventEmitter {
  private events: { [key: string]: Function[] } = {}

  on(event: string, listener: Function): this {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(listener)
    return this
  }

  off(event: string, listener: Function): this {
    if (!this.events[event]) return this
    this.events[event] = this.events[event].filter(l => l !== listener)
    return this
  }

  emit(event: string, ...args: any[]): boolean {
    if (!this.events[event]) return false
    this.events[event].forEach(listener => {
      try {
        listener(...args)
      } catch (error) {
        console.error('Error in event listener:', error)
      }
    })
    return true
  }

  removeAllListeners(event?: string): this {
    if (event) {
      delete this.events[event]
    } else {
      this.events = {}
    }
    return this
  }
}

export interface WebSocketConfig {
  url: string
  protocols?: string[]
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
  heartbeatTimeout?: number
}

export interface WebSocketMessage {
  type: string
  data?: any
  timestamp?: number
}

export enum WebSocketState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

export class WebSocketManager extends BrowserEventEmitter {
  private ws: WebSocket | null = null
  private config: Required<WebSocketConfig>
  private state: WebSocketState = WebSocketState.DISCONNECTED
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private heartbeatTimeoutTimer: NodeJS.Timeout | null = null
  private isManualClose = false

  constructor(config: WebSocketConfig) {
    super()
    this.config = {
      url: config.url,
      protocols: config.protocols || [],
      reconnectInterval: config.reconnectInterval || 3000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000,
      heartbeatTimeout: config.heartbeatTimeout || 10000
    }
  }

  /**
   * 连接 WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      this.isManualClose = false
      this.setState(WebSocketState.CONNECTING)

      try {
        this.ws = new WebSocket(this.config.url, this.config.protocols)
        
        this.ws.onopen = () => {
          this.setState(WebSocketState.CONNECTED)
          this.reconnectAttempts = 0
          this.startHeartbeat()
          this.emit('connected')
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event)
        }

        this.ws.onclose = (event) => {
          this.handleClose(event)
        }

        this.ws.onerror = (error) => {
          this.handleError(error)
          reject(error)
        }
      } catch (error) {
        this.setState(WebSocketState.ERROR)
        this.emit('error', error)
        reject(error)
      }
    })
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.isManualClose = true
    this.clearTimers()
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect')
      this.ws = null
    }
    
    this.setState(WebSocketState.DISCONNECTED)
    this.emit('disconnected')
  }

  /**
   * 发送消息
   */
  send(message: WebSocketMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not connected')
      return false
    }

    try {
      const messageWithTimestamp = {
        ...message,
        timestamp: Date.now()
      }
      this.ws.send(JSON.stringify(messageWithTimestamp))
      return true
    } catch (error) {
      console.error('Failed to send WebSocket message:', error)
      this.emit('error', error)
      return false
    }
  }

  /**
   * 获取连接状态
   */
  getState(): WebSocketState {
    return this.state
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.state === WebSocketState.CONNECTED && 
           this.ws?.readyState === WebSocket.OPEN
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(event: MessageEvent): void {
    try {
      let message: WebSocketMessage
      
      if (typeof event.data === 'string') {
        message = JSON.parse(event.data)
      } else {
        message = { type: 'binary', data: event.data }
      }

      // 处理心跳响应
      if (message.type === 'pong') {
        this.handleHeartbeatResponse()
        return
      }

      this.emit('message', message)
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
      this.emit('error', error)
    }
  }

  /**
   * 处理连接关闭
   */
  private handleClose(event: CloseEvent): void {
    this.clearTimers()
    this.setState(WebSocketState.DISCONNECTED)
    this.emit('disconnected', event)

    // 如果不是手动关闭，尝试重连
    if (!this.isManualClose && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect()
    }
  }

  /**
   * 处理连接错误
   */
  private handleError(error: Event): void {
    this.setState(WebSocketState.ERROR)
    this.emit('error', error)
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    this.setState(WebSocketState.RECONNECTING)
    this.reconnectAttempts++

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // 最大延迟 30 秒
    )

    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay })

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnect failed:', error)
        if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
          this.scheduleReconnect()
        } else {
          this.emit('reconnectFailed')
        }
      })
    }, delay)
  }

  /**
   * 开始心跳
   */
  private startHeartbeat(): void {
    this.clearHeartbeatTimers()
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping' })
        
        // 设置心跳超时
        this.heartbeatTimeoutTimer = setTimeout(() => {
          console.warn('Heartbeat timeout, closing connection')
          this.ws?.close(1000, 'Heartbeat timeout')
        }, this.config.heartbeatTimeout)
      }
    }, this.config.heartbeatInterval)
  }

  /**
   * 处理心跳响应
   */
  private handleHeartbeatResponse(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer)
      this.heartbeatTimeoutTimer = null
    }
  }

  /**
   * 清除所有定时器
   */
  private clearTimers(): void {
    this.clearHeartbeatTimers()
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  /**
   * 清除心跳定时器
   */
  private clearHeartbeatTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer)
      this.heartbeatTimeoutTimer = null
    }
  }

  /**
   * 设置连接状态
   */
  private setState(state: WebSocketState): void {
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
    this.removeAllListeners()
  }
}