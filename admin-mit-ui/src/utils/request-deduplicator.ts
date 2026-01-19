/**
 * 请求去重工具
 * 防止相同的 API 请求在短时间内重复发送
 */

interface PendingRequest {
  promise: Promise<any>
  timestamp: number
}

class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest>()
  private readonly CACHE_DURATION = 1000 // 1秒内的重复请求会被去重

  /**
   * 生成请求的唯一键
   */
  private generateKey(url: string, method: string, data?: any): string {
    const dataStr = data ? JSON.stringify(data) : ''
    return `${method.toUpperCase()}:${url}:${dataStr}`
  }

  /**
   * 去重请求
   * @param url 请求URL
   * @param method HTTP方法
   * @param requestFn 实际的请求函数
   * @param data 请求数据
   */
  async deduplicate<T>(
    url: string,
    method: string,
    requestFn: () => Promise<T>,
    data?: any
  ): Promise<T> {
    const key = this.generateKey(url, method, data)
    const now = Date.now()

    // 检查是否有正在进行的相同请求
    const pending = this.pendingRequests.get(key)
    if (pending && (now - pending.timestamp) < this.CACHE_DURATION) {
      return pending.promise
    }

    // 创建新的请求
    const promise = requestFn().finally(() => {
      // 请求完成后清理
      this.pendingRequests.delete(key)
    })

    // 存储请求
    this.pendingRequests.set(key, {
      promise,
      timestamp: now
    })

    return promise
  }

  /**
   * 清理过期的请求缓存
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.CACHE_DURATION * 2) {
        this.pendingRequests.delete(key)
      }
    }
  }

  /**
   * 获取当前待处理的请求数量
   */
  getPendingCount(): number {
    return this.pendingRequests.size
  }

  /**
   * 获取所有待处理的请求键
   */
  getPendingKeys(): string[] {
    return Array.from(this.pendingRequests.keys())
  }

  /**
   * 强制清除所有待处理的请求
   */
  clear(): void {
    this.pendingRequests.clear()
  }
}

export const requestDeduplicator = new RequestDeduplicator()

// 定期清理过期的请求缓存
if (typeof window !== 'undefined') {
  setInterval(() => {
    requestDeduplicator.cleanup()
  }, 5000) // 每5秒清理一次
}

// 在开发环境中暴露到全局以便调试
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  ;(window as any).requestDeduplicator = requestDeduplicator
}