export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  user: User
  tenant: Tenant
}

export interface User {
  id: number
  username: string
  email: string
  full_name: string
  avatar_style?: string
  avatar_seed?: string
  avatar_config?: Record<string, any>
  avatar_url?: string
  tenant_id: number
  status: number // 1: 活跃, 0: 禁用
  created_at: string
  updated_at: string
  roles: Role[]
}

export interface Tenant {
  id: number
  name: string
  code: string
}

export interface Role {
  id: number
  name: string
  display_name?: string
  permissions: string[]
}

export interface RefreshTokenResponse {
  access_token: string
}