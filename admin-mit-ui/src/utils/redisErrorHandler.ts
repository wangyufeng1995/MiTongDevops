/**
 * Redis 错误处理工具
 * 
 * 提供统一的错误处理、连接状态监控和用户提示
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import { toast } from '../components/Toast'

/**
 * Redis 错误类型
 */
export enum RedisErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  CONNECTION_LOST = 'CONNECTION_LOST',
  AUTH_FAILED = 'AUTH_FAILED',
  KEY_NOT_FOUND = 'KEY_NOT_FOUND',
  OPERATION_FAILED = 'OPERATION_FAILED',
  INVALID_DATA = 'INVALID_DATA',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Redis 错误信息
 */
export interface RedisError {
  type: RedisErrorType
  message: string
  originalError?: any
  canRetry: boolean
  canReconnect: boolean
}

/**
 * 解析错误类型和消息
 */
export function parseRedisError(error: any): RedisError {
  // 默认错误信息
  let type = RedisErrorType.UNKNOWN_ERROR
  let message = '未知错误'
  let canRetry = false
  let canReconnect = false

  // 从错误对象中提取信息
  const errorMessage = error?.message || error?.error || String(error)
  const errorCode = error?.error_code || error?.code

  // 根据错误码或消息判断错误类型
  if (errorCode === 'REDIS_CONNECTION_FAILED' || errorMessage.includes('连接失败') || errorMessage.includes('connection failed')) {
    type = RedisErrorType.CONNECTION_FAILED
    message = 'Redis 连接失败，请检查连接配置'
    canRetry = true
    canReconnect = true
  } else if (errorCode === 'REDIS_CONNECTION_TIMEOUT' || errorMessage.includes('超时') || errorMessage.includes('timeout')) {
    type = RedisErrorType.CONNECTION_TIMEOUT
    message = 'Redis 连接超时，请检查网络连接'
    canRetry = true
    canReconnect = true
  } else if (errorCode === 'REDIS_AUTH_FAILED' || errorMessage.includes('认证失败') || errorMessage.includes('auth failed') || errorMessage.includes('NOAUTH')) {
    type = RedisErrorType.AUTH_FAILED
    message = 'Redis 认证失败，请检查密码配置'
    canRetry = false
    canReconnect = false
  } else if (errorCode === 'REDIS_KEY_NOT_FOUND' || errorMessage.includes('键不存在') || errorMessage.includes('key not found')) {
    type = RedisErrorType.KEY_NOT_FOUND
    message = '键不存在或已过期'
    canRetry = false
    canReconnect = false
  } else if (errorCode === 'REDIS_OPERATION_FAILED' || errorMessage.includes('操作失败')) {
    type = RedisErrorType.OPERATION_FAILED
    message = `操作失败: ${errorMessage}`
    canRetry = true
    canReconnect = false
  } else if (errorMessage.includes('Invalid') || errorMessage.includes('格式') || errorMessage.includes('format')) {
    type = RedisErrorType.INVALID_DATA
    message = '数据格式不正确，请检查输入'
    canRetry = false
    canReconnect = false
  } else if (errorCode === 403 || errorMessage.includes('权限') || errorMessage.includes('permission')) {
    type = RedisErrorType.PERMISSION_DENIED
    message = '权限不足，无法执行此操作'
    canRetry = false
    canReconnect = false
  } else if (errorMessage.includes('Network') || errorMessage.includes('网络') || error?.name === 'NetworkError') {
    type = RedisErrorType.NETWORK_ERROR
    message = '网络错误，请检查网络连接'
    canRetry = true
    canReconnect = true
  } else if (errorMessage.includes('断开') || errorMessage.includes('disconnected') || errorMessage.includes('closed')) {
    type = RedisErrorType.CONNECTION_LOST
    message = 'Redis 连接已断开'
    canRetry = false
    canReconnect = true
  } else {
    // 使用原始错误消息
    message = errorMessage || '操作失败'
    canRetry = true
    canReconnect = false
  }

  return {
    type,
    message,
    originalError: error,
    canRetry,
    canReconnect
  }
}

/**
 * 显示错误提示
 */
export function showRedisError(error: any, context?: string): RedisError {
  const parsedError = parseRedisError(error)
  
  // 构建完整的错误消息
  let fullMessage = parsedError.message
  if (context) {
    fullMessage = `${context}: ${parsedError.message}`
  }

  // 根据错误类型显示不同的提示
  if (parsedError.type === RedisErrorType.CONNECTION_LOST) {
    toast.warning('连接断开', fullMessage)
  } else if (parsedError.type === RedisErrorType.PERMISSION_DENIED) {
    toast.warning('权限不足', fullMessage)
  } else if (parsedError.type === RedisErrorType.INVALID_DATA) {
    toast.warning('数据格式错误', fullMessage)
  } else {
    toast.error('操作失败', fullMessage)
  }

  return parsedError
}

/**
 * 确认对话框选项
 */
export interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
}

/**
 * 显示确认对话框（返回 Promise）
 */
export function confirmAction(options: Omit<ConfirmOptions, 'onConfirm' | 'onCancel'>): Promise<boolean> {
  return new Promise((resolve) => {
    // 这个函数返回一个 Promise，调用者需要自己处理 UI
    // 实际的确认对话框由组件实现
    resolve(true)
  })
}

/**
 * 危险操作确认（删除、清空等）
 */
export interface DangerousActionOptions {
  actionName: string
  targetName: string
  targetCount?: number
  additionalWarning?: string
}

export function getDangerousActionMessage(options: DangerousActionOptions): {
  title: string
  message: string
  warning: string
} {
  const { actionName, targetName, targetCount, additionalWarning } = options

  let title = `确认${actionName}`
  let message = `确定要${actionName} "${targetName}" 吗？`
  
  if (targetCount && targetCount > 1) {
    message = `确定要${actionName}选中的 ${targetCount} 个${targetName}吗？`
  }

  let warning = '此操作不可恢复，请谨慎操作。'
  if (additionalWarning) {
    warning = `${warning} ${additionalWarning}`
  }

  return { title, message, warning }
}

/**
 * 连接状态监控
 */
export class RedisConnectionMonitor {
  private connectionId: number
  private checkInterval: number
  private onDisconnected: (connectionId: number) => void
  private onReconnected: (connectionId: number) => void
  private intervalId: NodeJS.Timeout | null = null
  private isMonitoring = false

  constructor(
    connectionId: number,
    checkInterval: number = 30000, // 默认 30 秒检查一次
    onDisconnected: (connectionId: number) => void,
    onReconnected: (connectionId: number) => void
  ) {
    this.connectionId = connectionId
    this.checkInterval = checkInterval
    this.onDisconnected = onDisconnected
    this.onReconnected = onReconnected
  }

  /**
   * 开始监控
   */
  start() {
    if (this.isMonitoring) return

    this.isMonitoring = true
    this.intervalId = setInterval(() => {
      this.checkConnection()
    }, this.checkInterval)
  }

  /**
   * 停止监控
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isMonitoring = false
  }

  /**
   * 检查连接状态
   */
  private async checkConnection() {
    // 这里应该调用 API 检查连接状态
    // 由于需要依赖 redisService，这个方法应该由调用者实现
    // 这里只是一个框架
  }
}

/**
 * 重试配置
 */
export interface RetryOptions {
  maxAttempts: number
  delayMs: number
  backoff?: boolean
  onRetry?: (attempt: number, error: any) => void
}

/**
 * 带重试的操作执行
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxAttempts, delayMs, backoff = true, onRetry } = options
  let lastError: any

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const parsedError = parseRedisError(error)

      // 如果错误不可重试，直接抛出
      if (!parsedError.canRetry) {
        throw error
      }

      // 如果还有重试机会
      if (attempt < maxAttempts) {
        onRetry?.(attempt, error)
        
        // 计算延迟时间（支持指数退避）
        const delay = backoff ? delayMs * Math.pow(2, attempt - 1) : delayMs
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  // 所有重试都失败了
  throw lastError
}

/**
 * 格式化错误消息用于显示
 */
export function formatErrorForDisplay(error: any): string {
  const parsedError = parseRedisError(error)
  return parsedError.message
}

/**
 * 检查是否是网络错误
 */
export function isNetworkError(error: any): boolean {
  const parsedError = parseRedisError(error)
  return parsedError.type === RedisErrorType.NETWORK_ERROR ||
         parsedError.type === RedisErrorType.CONNECTION_TIMEOUT ||
         parsedError.type === RedisErrorType.CONNECTION_FAILED
}

/**
 * 检查是否是连接错误
 */
export function isConnectionError(error: any): boolean {
  const parsedError = parseRedisError(error)
  return parsedError.type === RedisErrorType.CONNECTION_FAILED ||
         parsedError.type === RedisErrorType.CONNECTION_TIMEOUT ||
         parsedError.type === RedisErrorType.CONNECTION_LOST ||
         parsedError.type === RedisErrorType.AUTH_FAILED
}
