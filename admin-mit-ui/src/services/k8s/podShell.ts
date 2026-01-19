/**
 * K8S Pod Shell 服务
 * 使用 Socket.IO 与 Flask-SocketIO 后端通信
 * 复用现有 WebShell 的 Socket.IO 连接模式
 */
import { io, Socket } from 'socket.io-client'
import type {
  K8sPodShellSession,
  PodShellStatus,
  PodShellCreateRequest,
} from '../../types/k8s'

type EventCallback = (...args: any[]) => void

export class PodShellService {
  private socket: Socket | null = null
  private currentSession: K8sPodShellSession | null = null
  private status: PodShellStatus = 'disconnected'
  private eventListeners: Map<string, Set<EventCallback>> = new Map()
  private isTerminalCreated = false

  /**
   * 连接到 Pod Shell
   */
  async connect(params: PodShellCreateRequest): Promise<K8sPodShellSession> {
    // 如果已经连接到同一Pod，直接返回
    if (
      this.socket?.connected &&
      this.currentSession &&
      this.currentSession.cluster_id === params.cluster_id &&
      this.currentSession.namespace === params.namespace &&
      this.currentSession.pod_name === params.pod_name &&
      this.currentSession.container === params.container &&
      this.isTerminalCreated
    ) {
      return this.currentSession
    }

    // 断开现有连接
    if (this.socket) {
      this.disconnect()
    }

    this.setStatus('connecting')

    // 获取认证 token
    const token = localStorage.getItem('token')

    // 构建连接 URL
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
      transports: ['polling'], // 只使用 polling，避免 WebSocket 代理问题
      auth: token ? { token } : {},
      query: token ? { token } : {},
    })

    // 创建会话对象
    this.currentSession = {
      session_id: '', // 将在服务端返回后更新
      cluster_id: params.cluster_id,
      namespace: params.namespace,
      pod_name: params.pod_name,
      container: params.container,
      status: 'connecting',
      created_at: new Date().toISOString(),
    }

    // 设置事件监听器
    this.setupSocketListeners(params)

    // 连接并创建终端
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.setStatus('error')
        reject(new Error('Connection timeout'))
      }, 30000)

      this.socket!.on('connect', () => {
        console.log('Pod Shell Socket.IO connected')
        // 创建 Pod Shell 终端会话
        this.createPodShell(params)
      })

      this.socket!.on('k8s_pod_shell_created', (data: any) => {
        console.log('Received k8s_pod_shell_created:', data)
        clearTimeout(timeout)
        this.isTerminalCreated = true
        this.setStatus('connected')
        if (this.currentSession) {
          this.currentSession.session_id = data.session_id
          this.currentSession.status = 'connected'
        }
        resolve(this.currentSession!)
      })

      this.socket!.on('connect_error', (error) => {
        clearTimeout(timeout)
        console.error('Pod Shell Socket.IO connect error:', error)
        this.setStatus('error')
        if (this.currentSession) {
          this.currentSession.status = 'error'
          this.currentSession.error_message = error.message
        }
        reject(error)
      })

      this.socket!.on('k8s_pod_shell_error', (data: any) => {
        clearTimeout(timeout)
        console.error('Pod Shell error:', data.message)
        this.setStatus('error')
        if (this.currentSession) {
          this.currentSession.status = 'error'
          this.currentSession.error_message = data.message
        }
        this.emit('error', new Error(data.message))
        reject(new Error(data.message))
      })

      this.socket!.connect()
    })
  }

  /**
   * 设置 Socket 事件监听器
   */
  private setupSocketListeners(params: PodShellCreateRequest): void {
    if (!this.socket) return

    // 连接确认
    this.socket.on('connection_established', (data) => {
      console.log('Pod Shell connection established:', data)
    })

    // 断开连接
    this.socket.on('disconnect', (reason) => {
      console.log('Pod Shell Socket.IO disconnected:', reason)
      this.setStatus('disconnected')
      if (this.currentSession) {
        this.currentSession.status = 'disconnected'
      }
      this.isTerminalCreated = false
      this.emit('stateChange', { to: 'disconnected' })
    })

    // 重连中
    this.socket.io.on('reconnect_attempt', (attempt) => {
      console.log('Pod Shell reconnecting attempt:', attempt)
      this.emit('reconnecting', { attempt, delay: 1000 * attempt })
    })

    // 重连成功
    this.socket.io.on('reconnect', (attempt) => {
      console.log('Pod Shell reconnected after', attempt, 'attempts')
      // 重新创建终端
      this.createPodShell(params)
    })

    // 重连失败
    this.socket.io.on('reconnect_failed', () => {
      console.error('Pod Shell reconnect failed')
      this.setStatus('error')
      this.emit('reconnectFailed')
    })

    // 终端输出
    this.socket.on('k8s_pod_shell_output', (data: any) => {
      if (this.currentSession && data.session_id === this.currentSession.session_id) {
        this.emit('terminalData', data.data)
      }
    })

    // 终端大小调整确认
    this.socket.on('k8s_pod_shell_resized', (data: any) => {
      if (this.currentSession && data.session_id === this.currentSession.session_id) {
        console.log('Pod Shell terminal resized:', data.cols, 'x', data.rows)
      }
    })

    // 终端终止
    this.socket.on('k8s_pod_shell_terminated', (data: any) => {
      if (this.currentSession && data.session_id === this.currentSession.session_id) {
        console.log('Pod Shell terminal terminated:', data.message)
        this.isTerminalCreated = false
        this.setStatus('disconnected')
        if (this.currentSession) {
          this.currentSession.status = 'disconnected'
        }
        this.emit('terminated', data)
      }
    })
  }

  /**
   * 创建 Pod Shell 终端会话
   */
  private createPodShell(params: PodShellCreateRequest): void {
    if (!this.socket?.connected) return

    this.socket.emit('k8s_pod_shell_create', {
      cluster_id: params.cluster_id,
      namespace: params.namespace,
      pod_name: params.pod_name,
      container: params.container,
      cols: params.cols || 80,
      rows: params.rows || 24,
    })
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket && this.currentSession?.session_id) {
      // 发送终止终端请求
      this.socket.emit('k8s_pod_shell_terminate', {
        session_id: this.currentSession.session_id,
      })
    }

    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }

    this.currentSession = null
    this.isTerminalCreated = false
    this.setStatus('disconnected')
    this.eventListeners.clear()
  }

  /**
   * 发送终端输入
   */
  sendInput(data: string): boolean {
    if (!this.socket?.connected || !this.currentSession?.session_id || !this.isTerminalCreated) {
      console.warn('Pod Shell: Cannot send data - not connected or terminal not created')
      return false
    }

    this.socket.emit('k8s_pod_shell_input', {
      session_id: this.currentSession.session_id,
      data: data,
    })
    return true
  }

  /**
   * 调整终端大小
   */
  resize(cols: number, rows: number): boolean {
    if (!this.socket?.connected || !this.currentSession?.session_id) {
      return false
    }

    this.socket.emit('k8s_pod_shell_resize', {
      session_id: this.currentSession.session_id,
      cols,
      rows,
    })
    return true
  }

  /**
   * 获取连接状态
   */
  getStatus(): PodShellStatus {
    return this.status
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.socket?.connected === true && this.isTerminalCreated
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(): K8sPodShellSession | null {
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
  onStatusChange(callback: (status: PodShellStatus) => void): () => void {
    // 立即调用一次当前状态
    callback(this.status)

    return this.on('stateChange', (data: { to: PodShellStatus }) => {
      callback(data.to)
    })
  }

  /**
   * 监听连接错误
   */
  onError(callback: (error: Error) => void): () => void {
    return this.on('error', callback)
  }

  /**
   * 监听重连事件
   */
  onReconnecting(callback: (info: { attempt: number; delay: number }) => void): () => void {
    return this.on('reconnecting', callback)
  }

  /**
   * 监听终端终止事件
   */
  onTerminated(callback: (data: { message?: string }) => void): () => void {
    return this.on('terminated', callback)
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
      listeners.forEach((callback) => {
        try {
          callback(...args)
        } catch (error) {
          console.error('Error in Pod Shell event listener:', error)
        }
      })
    }
  }

  /**
   * 设置状态
   */
  private setStatus(status: PodShellStatus): void {
    if (this.status !== status) {
      const previousStatus = this.status
      this.status = status
      this.emit('stateChange', { from: previousStatus, to: status })
    }
  }
}

// 创建全局实例
export const podShellService = new PodShellService()
