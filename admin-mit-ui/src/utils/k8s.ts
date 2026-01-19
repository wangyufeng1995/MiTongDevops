/**
 * K8S运维管理系统工具函数
 * 提供统一的错误处理、通知显示和操作反馈
 */

import type { K8sErrorResponse, K8sErrorCode } from '../types/k8s'

/**
 * 错误类型配置
 * 定义每种错误类型的默认标题和图标
 */
const ERROR_CONFIG: Record<
  K8sErrorCode,
  {
    title: string
    icon?: string
    duration?: number
  }
> = {
  CONNECTION_ERROR: {
    title: '连接错误',
    duration: 5,
  },
  AUTHENTICATION_ERROR: {
    title: '认证失败',
    duration: 5,
  },
  PERMISSION_DENIED: {
    title: '权限不足',
    duration: 5,
  },
  RESOURCE_NOT_FOUND: {
    title: '资源不存在',
    duration: 4,
  },
  VALIDATION_ERROR: {
    title: '参数验证失败',
    duration: 4,
  },
  CONFLICT_ERROR: {
    title: '操作冲突',
    duration: 4,
  },
  TIMEOUT_ERROR: {
    title: '操作超时',
    duration: 5,
  },
  INTERNAL_ERROR: {
    title: '服务器错误',
    duration: 5,
  },
  NETWORK_ERROR: {
    title: '网络错误',
    duration: 5,
  },
}

/**
 * 通知函数类型
 * 这些函数需要在应用初始化时设置
 */
let notificationError: ((title: string, description: string, duration?: number) => void) | null = null
let messageSuccess: ((content: string, duration?: number) => void) | null = null
let messageError: ((content: string, duration?: number) => void) | null = null
let messageWarning: ((content: string, duration?: number) => void) | null = null
let messageInfo: ((content: string, duration?: number) => void) | null = null
let messageLoading: ((content: string, duration?: number) => (() => void)) | null = null

/**
 * 设置通知函数
 * 在应用初始化时调用，传入UI库的通知函数
 * 
 * @example
 * ```typescript
 * // 使用 Ant Design
 * import { message, notification } from 'antd'
 * setNotificationFunctions({
 *   notificationError: (title, desc, duration) => notification.error({ message: title, description: desc, duration }),
 *   messageSuccess: (content, duration) => message.success(content, duration),
 *   messageError: (content, duration) => message.error(content, duration),
 *   messageWarning: (content, duration) => message.warning(content, duration),
 *   messageInfo: (content, duration) => message.info(content, duration),
 *   messageLoading: (content, duration) => message.loading(content, duration),
 * })
 * ```
 */
export const setNotificationFunctions = (functions: {
  notificationError?: (title: string, description: string, duration?: number) => void
  messageSuccess?: (content: string, duration?: number) => void
  messageError?: (content: string, duration?: number) => void
  messageWarning?: (content: string, duration?: number) => void
  messageInfo?: (content: string, duration?: number) => void
  messageLoading?: (content: string, duration?: number) => (() => void)
}) => {
  if (functions.notificationError) notificationError = functions.notificationError
  if (functions.messageSuccess) messageSuccess = functions.messageSuccess
  if (functions.messageError) messageError = functions.messageError
  if (functions.messageWarning) messageWarning = functions.messageWarning
  if (functions.messageInfo) messageInfo = functions.messageInfo
  if (functions.messageLoading) messageLoading = functions.messageLoading
}

/**
 * 错误处理选项
 */
export interface HandleK8sErrorOptions {
  /** 是否显示通知 */
  showNotification?: boolean
  /** 自定义错误标题 */
  customTitle?: string
  /** 自定义错误消息 */
  customMessage?: string
  /** 通知持续时间（秒） */
  duration?: number
  /** 错误回调函数 */
  onError?: (error: K8sErrorResponse) => void
}

/**
 * 统一的K8S错误处理函数
 * 
 * 功能：
 * 1. 解析错误响应
 * 2. 显示错误通知
 * 3. 根据错误类型执行特定操作
 * 4. 记录错误日志
 * 
 * @param error - 错误对象
 * @param options - 错误处理选项
 * @returns K8S错误响应对象
 */
export const handleK8sError = (
  error: any,
  options: HandleK8sErrorOptions = {}
): K8sErrorResponse => {
  const {
    showNotification = true,
    customTitle,
    customMessage,
    duration,
    onError,
  } = options

  let errorResponse: K8sErrorResponse

  // 解析错误响应
  if (error.response?.data) {
    const errorData = error.response.data
    errorResponse = {
      success: false,
      error_code: errorData.error_code || 'INTERNAL_ERROR',
      message: errorData.message || '未知错误',
      details: errorData.details,
      field: errorData.field,
      suggestions: errorData.suggestions,
    }
  } else if (error.message) {
    // 网络错误或其他错误
    errorResponse = {
      success: false,
      error_code: 'NETWORK_ERROR',
      message: error.message || '网络错误',
      details: '请检查网络连接',
    }
  } else {
    // 未知错误
    errorResponse = {
      success: false,
      error_code: 'INTERNAL_ERROR',
      message: '未知错误',
      details: '请稍后重试或联系管理员',
    }
  }

  // 记录错误日志
  console.error('K8S Error:', {
    error_code: errorResponse.error_code,
    message: errorResponse.message,
    details: errorResponse.details,
    field: errorResponse.field,
    suggestions: errorResponse.suggestions,
    originalError: error,
  })

  // 显示错误通知
  if (showNotification && notificationError) {
    const config = ERROR_CONFIG[errorResponse.error_code] || ERROR_CONFIG.INTERNAL_ERROR
    const title = customTitle || config.title
    const msg = customMessage || errorResponse.message
    const notificationDuration = duration || config.duration || 5

    // 构建描述内容
    let description = msg
    if (errorResponse.details) {
      description += `\n${errorResponse.details}`
    }
    if (errorResponse.suggestions && errorResponse.suggestions.length > 0) {
      description += '\n\n建议：'
      errorResponse.suggestions.forEach((suggestion, index) => {
        description += `\n${index + 1}. ${suggestion}`
      })
    }

    notificationError(title, description, notificationDuration)
  }

  // 根据错误类型执行特定操作
  handleSpecificErrorActions(errorResponse)

  // 执行自定义错误回调
  if (onError) {
    onError(errorResponse)
  }

  return errorResponse
}

/**
 * 根据错误类型执行特定操作
 */
const handleSpecificErrorActions = (error: K8sErrorResponse): void => {
  switch (error.error_code) {
    case 'AUTHENTICATION_ERROR':
      // 认证失败 - 可能需要重新配置集群
      console.warn('认证失败，请检查集群配置')
      break

    case 'PERMISSION_DENIED':
      // 权限不足 - 提示用户联系管理员
      console.warn('权限不足，请联系管理员获取相应权限')
      break

    case 'CONNECTION_ERROR':
      // 连接错误 - 标记集群为离线状态
      console.warn('集群连接失败，集群可能处于离线状态')
      break

    case 'TIMEOUT_ERROR':
      // 超时错误 - 建议稍后重试
      console.warn('操作超时，建议稍后重试')
      break

    case 'RESOURCE_NOT_FOUND':
      // 资源不存在 - 可能需要刷新列表
      console.warn('资源不存在，可能已被删除')
      break

    case 'CONFLICT_ERROR':
      // 冲突错误 - 建议刷新后重试
      console.warn('操作冲突，建议刷新后重试')
      break

    default:
      break
  }
}

/**
 * 显示成功消息
 * 
 * @param content - 消息内容
 * @param duration - 持续时间（秒）
 */
export const showSuccessMessage = (content: string, duration: number = 3): void => {
  if (messageSuccess) {
    messageSuccess(content, duration)
  } else {
    console.log('Success:', content)
  }
}

/**
 * 显示错误消息
 * 
 * @param content - 消息内容
 * @param duration - 持续时间（秒）
 */
export const showErrorMessage = (content: string, duration: number = 3): void => {
  if (messageError) {
    messageError(content, duration)
  } else {
    console.error('Error:', content)
  }
}

/**
 * 显示警告消息
 * 
 * @param content - 消息内容
 * @param duration - 持续时间（秒）
 */
export const showWarningMessage = (content: string, duration: number = 3): void => {
  if (messageWarning) {
    messageWarning(content, duration)
  } else {
    console.warn('Warning:', content)
  }
}

/**
 * 显示信息消息
 * 
 * @param content - 消息内容
 * @param duration - 持续时间（秒）
 */
export const showInfoMessage = (content: string, duration: number = 3): void => {
  if (messageInfo) {
    messageInfo(content, duration)
  } else {
    console.info('Info:', content)
  }
}

/**
 * 显示加载消息
 * 
 * @param content - 消息内容
 * @param duration - 持续时间（秒，0表示不自动关闭）
 * @returns 关闭函数
 */
export const showLoadingMessage = (
  content: string,
  duration: number = 0
): (() => void) => {
  if (messageLoading) {
    return messageLoading(content, duration)
  } else {
    console.log('Loading:', content)
    return () => {}
  }
}


/**
 * 操作确认对话框
 * 需要在应用中实现具体的确认对话框逻辑
 * 
 * @param title - 确认标题
 * @param content - 确认内容
 * @param onOk - 确认回调
 * @param onCancel - 取消回调
 */
export const confirmOperation = (
  title: string,
  content: string,
  onOk: () => void | Promise<void>,
  onCancel?: () => void
): void => {
  // 这里需要根据实际使用的UI库实现确认对话框
  // 例如使用 window.confirm 作为fallback
  if (window.confirm(`${title}\n\n${content}`)) {
    onOk()
  } else if (onCancel) {
    onCancel()
  }
}

/**
 * 危险操作确认对话框
 * 需要在应用中实现具体的确认对话框逻辑
 * 
 * @param title - 确认标题
 * @param content - 确认内容
 * @param onOk - 确认回调
 * @param onCancel - 取消回调
 */
export const confirmDangerousOperation = (
  title: string,
  content: string,
  onOk: () => void | Promise<void>,
  onCancel?: () => void
): void => {
  // 这里需要根据实际使用的UI库实现危险操作确认对话框
  // 例如使用 window.confirm 作为fallback
  if (window.confirm(`⚠️ ${title}\n\n${content}\n\n此操作不可撤销！`)) {
    onOk()
  } else if (onCancel) {
    onCancel()
  }
}

/**
 * 格式化K8S资源名称
 * 
 * @param name - 资源名称
 * @returns 格式化后的名称
 */
export const formatResourceName = (name: string): string => {
  return name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
}

/**
 * 验证K8S资源名称
 * 
 * @param name - 资源名称
 * @returns 是否有效
 */
export const validateResourceName = (name: string): boolean => {
  // K8S资源名称规则：
  // - 只能包含小写字母、数字和连字符
  // - 必须以字母或数字开头和结尾
  // - 长度不超过253个字符
  const regex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/
  return regex.test(name) && name.length <= 253
}

/**
 * 格式化存储容量
 * 
 * @param capacity - 容量字符串（如 "10Gi", "500Mi"）
 * @returns 格式化后的容量
 */
export const formatStorageCapacity = (capacity: string): string => {
  if (!capacity) return '-'
  
  // 已经是格式化的字符串，直接返回
  if (/^\d+(\.\d+)?(Ki|Mi|Gi|Ti|Pi|Ei)$/.test(capacity)) {
    return capacity
  }
  
  // 如果是纯数字（字节），转换为合适的单位
  const bytes = parseInt(capacity, 10)
  if (isNaN(bytes)) return capacity
  
  const units = ['B', 'Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei']
  let unitIndex = 0
  let value = bytes
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  
  return `${value.toFixed(2)}${units[unitIndex]}`
}

/**
 * 格式化CPU资源
 * 
 * @param cpu - CPU字符串（如 "500m", "2"）
 * @returns 格式化后的CPU
 */
export const formatCPU = (cpu: string): string => {
  if (!cpu) return '-'
  
  // 如果是毫核（millicores）
  if (cpu.endsWith('m')) {
    const millicores = parseInt(cpu.slice(0, -1), 10)
    if (millicores >= 1000) {
      return `${(millicores / 1000).toFixed(2)} cores`
    }
    return `${millicores}m`
  }
  
  // 如果是核心数
  const cores = parseFloat(cpu)
  if (!isNaN(cores)) {
    return `${cores} cores`
  }
  
  return cpu
}

/**
 * 格式化内存资源
 * 
 * @param memory - 内存字符串（如 "512Mi", "2Gi"）
 * @returns 格式化后的内存
 */
export const formatMemory = (memory: string): string => {
  return formatStorageCapacity(memory)
}

/**
 * 获取资源状态颜色
 * 
 * @param status - 资源状态
 * @returns Ant Design状态颜色
 */
export const getStatusColor = (
  status: string
): 'success' | 'processing' | 'error' | 'warning' | 'default' => {
  const statusLower = status.toLowerCase()
  
  // 正常状态
  if (
    statusLower === 'running' ||
    statusLower === 'active' ||
    statusLower === 'online' ||
    statusLower === 'bound' ||
    statusLower === 'available'
  ) {
    return 'success'
  }
  
  // 处理中状态
  if (
    statusLower === 'pending' ||
    statusLower === 'creating' ||
    statusLower === 'updating' ||
    statusLower === 'terminating'
  ) {
    return 'processing'
  }
  
  // 错误状态
  if (
    statusLower === 'failed' ||
    statusLower === 'error' ||
    statusLower === 'offline' ||
    statusLower === 'crashloopbackoff'
  ) {
    return 'error'
  }
  
  // 警告状态
  if (
    statusLower === 'warning' ||
    statusLower === 'unknown' ||
    statusLower === 'released'
  ) {
    return 'warning'
  }
  
  return 'default'
}

/**
 * 格式化时间戳
 * 
 * @param timestamp - 时间戳字符串
 * @returns 格式化后的时间
 */
export const formatTimestamp = (timestamp: string): string => {
  if (!timestamp) return '-'
  
  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    // 小于1分钟
    if (diff < 60 * 1000) {
      return '刚刚'
    }
    
    // 小于1小时
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000))
      return `${minutes}分钟前`
    }
    
    // 小于1天
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000))
      return `${hours}小时前`
    }
    
    // 小于7天
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000))
      return `${days}天前`
    }
    
    // 格式化为日期时间
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (error) {
    return timestamp
  }
}

/**
 * 计算资源使用百分比
 * 
 * @param used - 已使用量
 * @param total - 总量
 * @returns 百分比（0-100）
 */
export const calculateUsagePercentage = (used: string, total: string): number => {
  try {
    // 解析数值和单位
    const parseValue = (value: string): number => {
      const match = value.match(/^(\d+(?:\.\d+)?)(.*)?$/)
      if (!match) return 0
      
      const num = parseFloat(match[1])
      const unit = match[2] || ''
      
      // 转换为基础单位
      const multipliers: Record<string, number> = {
        'Ki': 1024,
        'Mi': 1024 * 1024,
        'Gi': 1024 * 1024 * 1024,
        'Ti': 1024 * 1024 * 1024 * 1024,
        'm': 0.001, // millicores
      }
      
      return num * (multipliers[unit] || 1)
    }
    
    const usedValue = parseValue(used)
    const totalValue = parseValue(total)
    
    if (totalValue === 0) return 0
    
    return Math.round((usedValue / totalValue) * 100)
  } catch (error) {
    return 0
  }
}
