import { ApiResponse } from '../types/api'

/**
 * 处理 API 响应的工具函数
 */
export class RequestUtils {
  /**
   * 检查 API 响应是否成功
   */
  static isSuccess<T>(response: ApiResponse<T>): boolean {
    return response.success === true
  }

  /**
   * 获取 API 响应数据
   */
  static getData<T>(response: ApiResponse<T>): T {
    if (!this.isSuccess(response)) {
      throw new Error(response.message || 'API request failed')
    }
    return response.data
  }

  /**
   * 获取 API 错误信息
   */
  static getErrorMessage<T>(response: ApiResponse<T>): string {
    return response.message || 'Unknown error occurred'
  }

  /**
   * 获取表单验证错误
   */
  static getValidationErrors<T>(response: ApiResponse<T>): Record<string, string[]> {
    return response.errors || {}
  }

  /**
   * 格式化表单验证错误为字符串
   */
  static formatValidationErrors<T>(response: ApiResponse<T>): string {
    const errors = this.getValidationErrors(response)
    const errorMessages: string[] = []
    
    Object.entries(errors).forEach(([field, messages]) => {
      errorMessages.push(`${field}: ${messages.join(', ')}`)
    })
    
    return errorMessages.join('; ')
  }

  /**
   * 处理 API 错误
   */
  static handleError(error: any): string {
    if (error.response?.data) {
      const apiResponse = error.response.data as ApiResponse<any>
      return this.getErrorMessage(apiResponse)
    }
    
    if (error.message) {
      return error.message
    }
    
    return 'Network error or unknown error occurred'
  }

  /**
   * 创建查询参数字符串
   */
  static createQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams()
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(item => searchParams.append(key, item.toString()))
        } else {
          searchParams.append(key, value.toString())
        }
      }
    })
    
    return searchParams.toString()
  }

  /**
   * 延迟执行
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 重试机制
   */
  static async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: any
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        
        if (i < maxRetries) {
          await this.delay(delayMs * Math.pow(2, i)) // 指数退避
        }
      }
    }
    
    throw lastError
  }
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    
    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, wait)
    }
  }
}