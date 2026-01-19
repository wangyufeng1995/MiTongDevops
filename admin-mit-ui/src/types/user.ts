import { User } from './auth'

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
}

export interface UserListResponse {
  users: User[]
  total: number
  page: number
  per_page: number
}

export interface AvatarConfig {
  style: string
  seed: string
  backgroundColor?: string[]
  clothingColor?: string[]
  hairColor?: string[]
  skinColor?: string[]
}