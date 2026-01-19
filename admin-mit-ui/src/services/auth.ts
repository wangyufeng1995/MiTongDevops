import { api } from './api'
import { LoginRequest, LoginResponse, RefreshTokenResponse } from '../types/auth'

export class AuthService {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/api/auth/login', credentials)
    // 如果响应包含success字段，返回data部分；否则直接返回响应
    if (response.success && response.data) {
      return response.data
    }
    return response as LoginResponse
  }

  async logout(): Promise<void> {
    await api.post<void>('/api/auth/logout')
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const response = await api.post<RefreshTokenResponse>('/api/auth/refresh', { refresh_token: refreshToken })
    return response
  }

  async getPublicKey(): Promise<{ publicKey: string }> {
    const response = await api.get<{ publicKey: string }>('/api/auth/public-key')
    // response 格式是 { success: true, data: { publicKey: '...' } }
    return response.data
  }

  async getCSRFToken(): Promise<{ csrf_token: string }> {
    const response = await api.get<{ csrf_token: string }>('/api/auth/csrf-token')
    return response
  }
}

export const authService = new AuthService()