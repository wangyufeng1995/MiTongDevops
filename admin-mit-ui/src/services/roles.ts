import { BaseApiService } from './base'
import { api } from './api'
import { ApiResponse } from '../types/api'
import { Role } from '../types/auth'

export interface CreateRoleRequest {
  name: string
  description?: string
  permissions: string[]
}

export interface UpdateRoleRequest {
  name?: string
  description?: string
  permissions?: string[]
  status?: number
}

export interface Permission {
  id: string
  name: string
  description?: string
  category: string
}

export class RoleService extends BaseApiService<Role, CreateRoleRequest, UpdateRoleRequest> {
  constructor() {
    super('/api/roles')
  }

  /**
   * 获取所有可用权限
   */
  async getPermissions(): Promise<ApiResponse<any[]>> {
    return api.get<any[]>('/api/roles/permissions')
  }

  /**
   * 获取权限分类
   */
  async getPermissionCategories(): Promise<ApiResponse<string[]>> {
    return api.get<string[]>('/api/permissions/categories')
  }

  /**
   * 检查角色名称是否可用
   */
  async checkRoleName(name: string, excludeId?: number): Promise<ApiResponse<{ available: boolean }>> {
    const params = new URLSearchParams({ name })
    if (excludeId) params.append('exclude_id', excludeId.toString())
    
    return api.get<{ available: boolean }>(`${this.baseUrl}/check-name?${params}`)
  }

  /**
   * 获取角色的用户数量
   */
  async getRoleUserCount(id: number): Promise<ApiResponse<{ count: number }>> {
    return api.get<{ count: number }>(`${this.baseUrl}/${id}/users/count`)
  }

  /**
   * 获取角色的用户列表
   */
  async getRoleUsers(id: number): Promise<ApiResponse<{ users: any[], total: number }>> {
    return api.get<{ users: any[], total: number }>(`${this.baseUrl}/${id}/users`)
  }

  /**
   * 获取角色权限
   */
  async getRolePermissions(id: number): Promise<ApiResponse<{ permissions: string[] }>> {
    return api.get<{ permissions: string[] }>(`${this.baseUrl}/${id}/permissions`)
  }

  /**
   * 更新角色权限
   */
  async updateRolePermissions(id: number, permissions: string[]): Promise<ApiResponse<Role>> {
    return api.put<Role>(`${this.baseUrl}/${id}/permissions`, { permissions })
  }
}

export const roleService = new RoleService()