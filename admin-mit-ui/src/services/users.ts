import { BaseApiService } from './base'
import { api } from './api'
import { ApiResponse } from '../types/api'
import { User } from '../types/auth'

export interface CreateUserRequest {
  username: string
  email: string
  password: string
  full_name: string
  role_ids: number[]
  avatar_style?: string
  avatar_seed?: string
  avatar_config?: Record<string, any>
}

export interface UpdateUserRequest {
  username?: string
  email?: string
  full_name?: string
  role_ids?: number[]
  avatar_style?: string
  avatar_seed?: string
  avatar_config?: Record<string, any>
  status?: number
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
  confirm_password: string
}

export interface AvatarConfig {
  style: string
  seed: string
  config: Record<string, any>
}

export class UserService extends BaseApiService<User, CreateUserRequest, UpdateUserRequest> {
  constructor() {
    super('/api/users')
  }

  /**
   * 获取用户头像信息
   */
  async getAvatar(id: number): Promise<ApiResponse<AvatarConfig>> {
    return api.get<AvatarConfig>(`${this.baseUrl}/${id}/avatar`)
  }

  /**
   * 更新用户头像配置
   */
  async updateAvatar(id: number, avatarConfig: AvatarConfig): Promise<ApiResponse<User>> {
    return api.put<User>(`${this.baseUrl}/${id}/avatar`, avatarConfig)
  }

  /**
   * 生成随机头像
   */
  async generateRandomAvatar(id: number): Promise<ApiResponse<AvatarConfig>> {
    return api.post<AvatarConfig>(`${this.baseUrl}/${id}/avatar/generate`)
  }

  /**
   * 修改密码
   */
  async changePassword(id: number, data: ChangePasswordRequest): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.baseUrl}/${id}/change-password`, data)
  }

  /**
   * 重置密码
   */
  async resetPassword(id: number, newPassword: string): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.baseUrl}/${id}/reset-password`, { new_password: newPassword })
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return api.get<User>('/api/auth/me')
  }

  /**
   * 更新当前用户信息
   */
  async updateCurrentUser(data: Partial<UpdateUserRequest>): Promise<ApiResponse<User>> {
    return api.put<User>('/api/auth/me', data)
  }

  /**
   * 检查用户名是否可用
   */
  async checkUsername(username: string, excludeId?: number): Promise<ApiResponse<{ available: boolean }>> {
    const params = new URLSearchParams({ username })
    if (excludeId) params.append('exclude_id', excludeId.toString())
    
    return api.get<{ available: boolean }>(`${this.baseUrl}/check-username?${params}`)
  }

  /**
   * 检查邮箱是否可用
   */
  async checkEmail(email: string, excludeId?: number): Promise<ApiResponse<{ available: boolean }>> {
    const params = new URLSearchParams({ email })
    if (excludeId) params.append('exclude_id', excludeId.toString())
    
    return api.get<{ available: boolean }>(`${this.baseUrl}/check-email?${params}`)
  }
}

export const userService = new UserService()