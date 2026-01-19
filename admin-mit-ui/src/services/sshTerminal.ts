/**
 * SSH 终端服务
 * 基于 Socket.IO 的 WebShell 终端管理
 */
import { SocketIOManager, SocketIOState } from './socketio'
import { api } from './api'

export interface SSHTerminalSession {
  sessionId: string
  hostId: number
  hostname: string
  username: string
  status: 'pending' | 'active' | 'inactive' | 'terminated'
  terminalSize: { cols: number; rows: number }
  createdAt: string
}

export interface TerminalCommandRecord {
  sessionId: string
  command: string
  output: string
  error: string
  exitCode: number
  executedAt: string
  executionTime: number
}

export interface SSHTerminalConfig {
  cols?: number
  rows?: number
  onData?: (data: string) => void
  onResize?: (cols: number, rows: number) => void
  onConnected?: () => void
  onDisconnected?: (reason?: string) => void
  onError?: (error: any) => void
  onBlocked?: (command: string, reason: string) => void
}

export class SSHTerminalService {
  private socketManager: SocketIOManager
  private session: SSHTerminalSession | null = null
  private config: SSHTerminalConfig = {}
  private cleanupFunctions: (() => void)[] = []
  private isTerminalCreated = false
  private pendingInput: string[] = []

  constructor() {
    this.socketManager = new SocketIOManager({
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    })
  }

  /**
   * 连接到 SSH 主机
   */
  async connect(hostId: number, config: SSHTerminalConfig = {}): Promise<SSHTerminalSession> {
    this.config = config

    try {
      // 1. 创建 WebShell 会话
      const response = await api.post(`/api/hosts/${hostId}/webshell`, {})
      const sessionData = response.data.data || response.data

      this.session = {
        sessionId: sessionData.session_id,
        hostId: sessionData.host_id,
        hostname: sessionData.hostname,
        username: sessionData.username,
        status: 'pending',
        terminalSize: { cols: config.cols || 80, rows: config.rows || 24 },
        createdAt: sessionData.created_at
      }

      // 2. 获取认证 token
      const token = localStorage.getItem('token')
      if (token) {
        this.socketManager.setToken(token)
      }

      // 3. 设置事件监听
      this.setupEventListeners()

      // 4. 连接 Socket.IO
      await this.socketManager.connect()

      // 5. 创建终端会话
      await this.createTerminal()

      return this.session
    } catch (error) {
      console.error('Failed to connect SSH terminal:', error)
      this.cleanup()
      throw error
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 连接成功
    const onConnected = () => {
      console.log('SSH Terminal: Socket.IO connected')
      if (this.session && !this.isTerminalCreated) {
        this.createTerminal()
      }
    }
    this.cleanupFunctions.push(this.socketManager.on('connected', onConnected))

    // 断开连接
    const onDisconnected = (reason: string) => {
      console.log('SSH Terminal: Socket.IO disconnected', reason)
      if (this.session) {
        this.session.status = 'inactive'
      }
      this.config.onDisconnected?.(reason)
    }
    this.cleanupFunctions.push(this.socketManager.on('disconnected', onDisconnected))

    // 错误处理
    const onError = (error: any) => {
      console.error('SSH Terminal: Socket.IO error', error)
      this.config.onError?.(error)
    }
    this.cleanupFunctions.push(this.socketManager.on('error', onError))

    // 重连成功
    const onReconnected = () => {
      console.log('SSH Terminal: Socket.IO reconnected')
      if (this.session && !this.isTerminalCreated) {
        this.createTerminal()
      }
    }
    this.cleanupFunctions.push(this.socketManager.on('reconnected', onReconnected))

    // 终端创建成功
    const onTerminalCreated = (data: any) => {
      console.log('SSH Terminal: Terminal created', data)
      this.isTerminalCreated = true
      if (this.session) {
        this.session.status = 'active'
      }
      this.config.onConnected?.()
      
      // 发送待处理的输入
      this.flushPendingInput()
    }
    this.cleanupFunctions.push(this.socketManager.on('webshell_terminal_created', onTerminalCreated))

    // 终端输出
    const onOutput = (data: any) => {
      if (data.session_id === this.session?.sessionId) {
        this.config.onData?.(data.data)
      }
    }
    this.cleanupFunctions.push(this.socketManager.on('webshell_output', onOutput))

    // 终端大小调整确认
    const onResized = (data: any) => {
      if (data.session_id === this.session?.sessionId) {
        this.session.terminalSize = { cols: data.cols, rows: data.rows }
        this.config.onResize?.(data.cols, data.rows)
      }
    }
    this.cleanupFunctions.push(this.socketManager.on('webshell_resized', onResized))

    // 命令被阻止
    const onBlocked = (data: any) => {
      if (data.session_id === this.session?.sessionId && data.type === 'blocked') {
        // 从输出中提取命令和原因
        const match = data.data?.match(/\[命令被阻止\] (.+)/)
        if (match) {
          this.config.onBlocked?.('', match[1])
        }
      }
    }
    this.cleanupFunctions.push(this.socketManager.on('webshell_output', onBlocked))

    // 终端终止
    const onTerminated = (data: any) => {
      if (data.session_id === this.session?.sessionId) {
        console.log('SSH Terminal: Terminal terminated', data.message)
        this.isTerminalCreated = false
        if (this.session) {
          this.session.status = 'terminated'
        }
        this.config.onDisconnected?.(data.message)
      }
    }
    this.cleanupFunctions.push(this.socketManager.on('webshell_terminal_terminated', onTerminated))

    // 会话终止
    const onSessionTerminated = (data: any) => {
      if (data.session_id === this.session?.sessionId) {
        console.log('SSH Terminal: Session terminated', data.reason)
        this.isTerminalCreated = false
        if (this.session) {
          this.session.status = 'terminated'
        }
        this.config.onDisconnected?.(data.reason)
      }
    }
    this.cleanupFunctions.push(this.socketManager.on('webshell_session_terminated', onSessionTerminated))

    // 错误消息
    const onWebshellError = (data: any) => {
      if (!data.session_id || data.session_id === this.session?.sessionId) {
        console.error('SSH Terminal: WebShell error', data.message)
        this.config.onError?.(new Error(data.message))
      }
    }
    this.cleanupFunctions.push(this.socketManager.on('webshell_error', onWebshellError))
  }

  /**
   * 创建终端会话
   */
  private async createTerminal(): Promise<void> {
    if (!this.session || this.isTerminalCreated) return

    this.socketManager.send('webshell_create_terminal', {
      session_id: this.session.sessionId,
      cols: this.session.terminalSize.cols,
      rows: this.session.terminalSize.rows
    })
  }

  /**
   * 发送输入数据
   */
  sendInput(data: string): boolean {
    if (!this.session) {
      console.warn('SSH Terminal: No active session')
      return false
    }

    // 如果终端还未创建，缓存输入
    if (!this.isTerminalCreated) {
      this.pendingInput.push(data)
      return true
    }

    return this.socketManager.send('webshell_input', {
      session_id: this.session.sessionId,
      data: data
    })
  }

  /**
   * 发送待处理的输入
   */
  private flushPendingInput(): void {
    while (this.pendingInput.length > 0) {
      const data = this.pendingInput.shift()!
      this.socketManager.send('webshell_input', {
        session_id: this.session?.sessionId,
        data: data
      })
    }
  }

  /**
   * 调整终端大小
   */
  resize(cols: number, rows: number): boolean {
    if (!this.session) {
      console.warn('SSH Terminal: No active session')
      return false
    }

    // 更新本地状态
    this.session.terminalSize = { cols, rows }

    return this.socketManager.send('webshell_resize', {
      session_id: this.session.sessionId,
      cols: cols,
      rows: rows
    })
  }

  /**
   * 执行命令（非交互式）
   */
  async executeCommand(command: string, timeout = 30): Promise<TerminalCommandRecord> {
    if (!this.session) {
      throw new Error('No active session')
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup()
        reject(new Error('Command execution timeout'))
      }, timeout * 1000)

      const onResult = (data: any) => {
        if (data.session_id === this.session?.sessionId) {
          cleanup()
          resolve(data.command_record)
        }
      }

      const onError = (data: any) => {
        if (data.session_id === this.session?.sessionId) {
          cleanup()
          if (data.command_record) {
            resolve(data.command_record)
          } else {
            reject(new Error(data.message))
          }
        }
      }

      const cleanup = () => {
        clearTimeout(timeoutId)
        this.socketManager.off('webshell_command_result', onResult)
        this.socketManager.off('webshell_error', onError)
      }

      this.socketManager.on('webshell_command_result', onResult)
      this.socketManager.on('webshell_error', onError)

      this.socketManager.send('webshell_execute_command', {
        session_id: this.session.sessionId,
        command: command,
        timeout: timeout
      })
    })
  }

  /**
   * 获取命令历史
   */
  async getCommandHistory(limit = 100): Promise<TerminalCommandRecord[]> {
    if (!this.session) {
      throw new Error('No active session')
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup()
        reject(new Error('Get history timeout'))
      }, 5000)

      const onHistory = (data: any) => {
        if (data.session_id === this.session?.sessionId) {
          cleanup()
          resolve(data.history)
        }
      }

      const cleanup = () => {
        clearTimeout(timeoutId)
        this.socketManager.off('webshell_history', onHistory)
      }

      this.socketManager.on('webshell_history', onHistory)

      this.socketManager.send('webshell_get_history', {
        session_id: this.session.sessionId,
        limit: limit
      })
    })
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.session && this.isTerminalCreated) {
      this.socketManager.send('webshell_terminate_terminal', {
        session_id: this.session.sessionId
      })
    }

    this.cleanup()
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    // 清理事件监听
    this.cleanupFunctions.forEach(fn => fn())
    this.cleanupFunctions = []

    // 断开 Socket.IO
    this.socketManager.disconnect()

    // 重置状态
    this.session = null
    this.isTerminalCreated = false
    this.pendingInput = []
  }

  /**
   * 获取当前会话
   */
  getSession(): SSHTerminalSession | null {
    return this.session
  }

  /**
   * 获取连接状态
   */
  getState(): SocketIOState {
    return this.socketManager.getState()
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.socketManager.isConnected() && this.isTerminalCreated
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    this.disconnect()
    this.socketManager.destroy()
  }
}

// 创建全局实例
export const sshTerminalService = new SSHTerminalService()
