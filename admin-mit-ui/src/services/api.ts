import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { ApiResponse } from '../types/api'
import { requestDeduplicator } from '../utils/request-deduplicator'
import { useAuthStore } from '../store/auth'

class ApiClient {
  private instance: AxiosInstance
  private csrfToken: string = ''
  private isRefreshing: boolean = false
  private failedQueue: Array<{
    resolve: (value?: any) => void
    reject: (error?: any) => void
  }> = []
  
  // 直接从 store 获取 token，避免异步初始化问题
  private get token(): string | null {
    return useAuthStore.getState().token
  }

  constructor() {
    // 开发环境使用相对路径，通过 Vite 代理转发请求，避免跨域 Cookie 问题
    // 生产环境使用环境变量配置的 API 地址
    const baseURL = import.meta.env.PROD 
      ? (import.meta.env.VITE_API_BASE_URL || '') 
      : ''
    
    this.instance = axios.create({
      baseURL,
      timeout: 180000, // 3分钟超时，支持长时间运行的 Ansible 任务
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // 支持 cookies 和 CSRF
    })

    this.setupInterceptors()
    this.initializeCSRF()
  }

  private async initializeCSRF() {
    // 初始化 CSRF token
    try {
      const response = await this.instance.get('/api/auth/csrf-token')
      // 处理标准API响应格式
      const responseData = response.data && typeof response.data === 'object' && 'success' in response.data 
        ? response.data.data 
        : response.data
      this.csrfToken = responseData.csrf_token
    } catch (error) {
      console.warn('Failed to initialize CSRF token:', error)
    }
  }

  private async refreshCSRFToken() {
    // 刷新 CSRF token
    try {
      const response = await this.instance.get('/api/auth/csrf-token')
      // 处理标准API响应格式
      const responseData = response.data && typeof response.data === 'object' && 'success' in response.data 
        ? response.data.data 
        : response.data
      this.csrfToken = responseData.csrf_token
      return this.csrfToken
    } catch (error) {
      console.error('Failed to refresh CSRF token:', error)
      throw error
    }
  }

  private setupInterceptors() {
    // 请求拦截器 - 添加 JWT token 和 CSRF token
    this.instance.interceptors.request.use(
      (config) => {
        // 使用订阅的 token，避免循环依赖
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`
        }
        
        // 为非 GET 请求添加 CSRF token
        if (config.method !== 'get' && this.csrfToken) {
          config.headers['X-CSRFToken'] = this.csrfToken
        }
        
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // 响应拦截器 - 处理错误和 token 刷新
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        return response
      },
      async (error) => {
        const originalRequest = error.config

        // 处理 CSRF token 错误
        if (error.response?.status === 400 && 
            error.response?.data?.message?.includes('CSRF')) {
          try {
            await this.refreshCSRFToken()
            // 重试原请求
            if (originalRequest.method !== 'get') {
              originalRequest.headers['X-CSRFToken'] = this.csrfToken
            }
            return this.instance(originalRequest)
          } catch (csrfError) {
            console.error('CSRF token refresh failed:', csrfError)
          }
        }

        // 处理 JWT token 过期
        // 排除登录接口，登录失败不应触发 token 刷新逻辑
        const isLoginRequest = originalRequest.url?.includes('/api/auth/login')
        
        if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest) {
          if (this.isRefreshing) {
            // 如果正在刷新 token，将请求加入队列
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject })
            }).then(token => {
              originalRequest.headers.Authorization = `Bearer ${token}`
              return this.instance(originalRequest)
            }).catch(err => {
              return Promise.reject(err)
            })
          }

          originalRequest._retry = true
          this.isRefreshing = true

          try {
            // 使用动态导入避免循环依赖
            const { useAuthStore } = await import('../store/auth')
            const { refreshToken, setToken, logout } = useAuthStore.getState()
            
            if (refreshToken) {
              const response = await this.instance.post('/api/auth/refresh', {
                refresh_token: refreshToken,
              })
              
              // 处理标准API响应格式
              const responseData = response.data && typeof response.data === 'object' && 'success' in response.data 
                ? response.data.data 
                : response.data
              const { access_token } = responseData
              setToken(access_token)
              
              // 更新本地 token
              this.token = access_token
              
              // 处理队列中的请求
              this.processQueue(null, access_token)
              
              // 重试原请求
              originalRequest.headers.Authorization = `Bearer ${access_token}`
              return this.instance(originalRequest)
            } else {
              this.processQueue(new Error('No refresh token'), null)
              logout()
              // 只有非登录页面才跳转
              if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login'
              }
            }
          } catch (refreshError) {
            this.processQueue(refreshError, null)
            const { useAuthStore } = await import('../store/auth')
            useAuthStore.getState().logout()
            // 只有非登录页面才跳转
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login'
            }
          } finally {
            this.isRefreshing = false
          }
        }

        return Promise.reject(error)
      }
    )
  }

  private processQueue(error: any, token: string | null = null) {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error)
      } else {
        resolve(token)
      }
    })
    
    this.failedQueue = []
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return requestDeduplicator.deduplicate(
      url,
      'GET',
      async () => {
        const response = await this.instance.get(url, config)
        // 如果响应有success字段，说明是标准API响应格式，直接返回整个响应
        if (response.data && typeof response.data === 'object' && 'success' in response.data) {
          return response.data
        }
        // 否则包装成标准格式
        return {
          success: true,
          data: response.data
        }
      }
    )
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return requestDeduplicator.deduplicate(
      url,
      'POST',
      async () => {
        const response = await this.instance.post(url, data, config)
        // 如果响应有success字段，说明是标准API响应格式，直接返回整个响应
        if (response.data && typeof response.data === 'object' && 'success' in response.data) {
          return response.data
        }
        // 否则包装成标准格式
        return {
          success: true,
          data: response.data
        }
      },
      data
    )
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return requestDeduplicator.deduplicate(
      url,
      'PUT',
      async () => {
        const response = await this.instance.put(url, data, config)
        // 如果响应有success字段，说明是标准API响应格式，直接返回整个响应
        if (response.data && typeof response.data === 'object' && 'success' in response.data) {
          return response.data
        }
        // 否则包装成标准格式
        return {
          success: true,
          data: response.data
        }
      },
      data
    )
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return requestDeduplicator.deduplicate(
      url,
      'DELETE',
      async () => {
        const response = await this.instance.delete(url, config)
        // 如果响应有success字段，说明是标准API响应格式，直接返回整个响应
        if (response.data && typeof response.data === 'object' && 'success' in response.data) {
          return response.data
        }
        // 否则包装成标准格式
        return {
          success: true,
          data: response.data
        }
      }
    )
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return requestDeduplicator.deduplicate(
      url,
      'PATCH',
      async () => {
        const response = await this.instance.patch(url, data, config)
        // 如果响应有success字段，说明是标准API响应格式，直接返回整个响应
        if (response.data && typeof response.data === 'object' && 'success' in response.data) {
          return response.data
        }
        // 否则包装成标准格式
        return {
          success: true,
          data: response.data
        }
      },
      data
    )
  }

  // 文件上传
  async upload<T = any>(url: string, formData: FormData, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.post(url, formData, {
      ...config,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...config?.headers,
      },
    })
    // 如果响应有success字段，说明是标准API响应格式，返回data部分
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      return response.data.data
    }
    return response.data
  }

  // 下载文件
  async download(url: string, config?: AxiosRequestConfig): Promise<Blob> {
    const response = await this.instance.get(url, {
      ...config,
      responseType: 'blob',
    })
    return response.data
  }

  getCSRFToken(): string {
    return this.csrfToken
  }

  // 获取原始 axios 实例（用于特殊需求）
  getInstance(): AxiosInstance {
    return this.instance
  }

  // 清理资源（保留接口兼容性）
  destroy() {
    // 不再需要清理订阅，因为使用 getter 直接从 store 获取 token
  }
}

export const api = new ApiClient()