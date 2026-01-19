/**
 * 健康检查服务
 * 用于检查 Celery、SSE 等后端服务的健康状态
 */

// 获取 API 基础 URL
const getBaseUrl = () => {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
}

/**
 * 健康检查响应类型
 */
export interface HealthResponse<T> {
  success: boolean
  data?: T
  message?: string
}

/**
 * Celery Worker 信息
 */
export interface CeleryWorker {
  name: string
  active_tasks: number
  status: 'online' | 'offline'
}

/**
 * Celery 健康状态
 */
export interface CeleryHealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown'
  workers: CeleryWorker[]
  queues: Record<string, number>
  scheduled_tasks: number
  active_tasks: number
  reserved_tasks: number
  error?: string
  timestamp?: string
  response_time_ms?: number
}

/**
 * SSE 健康状态
 */
export interface SSEHealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown'
  total_connections: number
  active_connections: number
  inactive_connections: number
  error?: string
  timestamp?: string
  response_time_ms?: number
}

/**
 * 数据库健康状态
 */
export interface DatabaseHealthStatus {
  status: 'healthy' | 'unhealthy'
  response_time_ms?: number
  error?: string
}

/**
 * Redis 健康状态
 */
export interface RedisHealthStatus {
  status: 'healthy' | 'unhealthy'
  response_time_ms?: number
  error?: string
}

/**
 * 服务健康状态汇总
 */
export interface ServicesHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  response_time_ms: number
  services: {
    celery: CeleryHealthStatus
    sse: SSEHealthStatus
    database: DatabaseHealthStatus
    redis: RedisHealthStatus
  }
}

/**
 * 健康检查服务类
 * 注意：健康检查 API 直接返回数据，不使用标准的 {success, data} 格式
 * 且 503 状态码也会返回有效的健康状态数据
 */
class HealthService {
  private baseUrl = '/api'

  /**
   * 获取所有服务的健康状态
   * 注意：即使返回 503，也会包含有效的健康状态数据
   */
  async getServicesHealth(): Promise<HealthResponse<ServicesHealthStatus>> {
    try {
      const response = await fetch(`${getBaseUrl()}${this.baseUrl}/services`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })
      
      const data = await response.json()
      
      // 健康检查 API 直接返回数据，即使是 503 也包含有效数据
      return {
        success: true,
        data: data as ServicesHealthStatus
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || '获取健康状态失败'
      }
    }
  }

  /**
   * 获取 Celery 健康状态
   */
  async getCeleryHealth(): Promise<HealthResponse<CeleryHealthStatus>> {
    try {
      const response = await fetch(`${getBaseUrl()}${this.baseUrl}/celery`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })
      
      const data = await response.json()
      
      return {
        success: true,
        data: data as CeleryHealthStatus
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || '获取 Celery 健康状态失败'
      }
    }
  }

  /**
   * 获取 SSE 健康状态
   */
  async getSSEHealth(): Promise<HealthResponse<SSEHealthStatus>> {
    try {
      const response = await fetch(`${getBaseUrl()}${this.baseUrl}/sse`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })
      
      const data = await response.json()
      
      return {
        success: true,
        data: data as SSEHealthStatus
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || '获取 SSE 健康状态失败'
      }
    }
  }

  /**
   * 获取基础健康检查
   */
  async getHealth(): Promise<HealthResponse<any>> {
    try {
      const response = await fetch(`${getBaseUrl()}${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })
      
      const data = await response.json()
      
      return {
        success: true,
        data
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || '获取健康状态失败'
      }
    }
  }

  /**
   * 获取就绪状态
   */
  async getReady(): Promise<HealthResponse<any>> {
    try {
      const response = await fetch(`${getBaseUrl()}${this.baseUrl}/ready`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })
      
      const data = await response.json()
      
      return {
        success: true,
        data
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || '获取就绪状态失败'
      }
    }
  }

  /**
   * 获取存活状态
   */
  async getLive(): Promise<HealthResponse<any>> {
    try {
      const response = await fetch(`${getBaseUrl()}${this.baseUrl}/live`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })
      
      const data = await response.json()
      
      return {
        success: true,
        data
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || '获取存活状态失败'
      }
    }
  }
}

// 导出服务实例
export const healthService = new HealthService()
