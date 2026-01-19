import { Role } from './auth'

export interface ExtendedRole extends Role {
  description?: string
  user_count?: number
  created_at?: string
  updated_at?: string
  created_by?: number
  status?: number
}

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

export interface PermissionCategory {
  name: string
  permissions: Permission[]
}

export interface RoleListResponse {
  roles: ExtendedRole[]
  total: number
  page: number
  per_page: number
}