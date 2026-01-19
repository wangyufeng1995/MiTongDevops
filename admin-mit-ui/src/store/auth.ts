import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, Tenant } from '../types/auth'

interface AuthState {
  isAuthenticated: boolean
  token: string | null
  refreshToken: string | null
  user: User | null
  tenant: Tenant | null
  permissions: string[]
  
  // Actions
  login: (token: string, refreshToken: string, user: User, tenant: Tenant) => void
  logout: () => void
  setToken: (token: string) => void
  setUser: (user: User) => void
  setPermissions: (permissions: string[]) => void
  initializeAuth: () => void
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  isAdmin: () => boolean
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      token: null,
      refreshToken: null,
      user: null,
      tenant: null,
      permissions: [],

      login: (token, refreshToken, user, tenant) => {
        // 从用户角色中提取权限，添加安全检查
        const permissions = user?.roles?.reduce((acc: string[], role) => {
          return [...acc, ...(role.permissions || [])]
        }, []) || []
        
        set({
          isAuthenticated: true,
          token,
          refreshToken,
          user,
          tenant,
          permissions: [...new Set(permissions)], // 去重
        })
      },

      logout: () => {
        set({
          isAuthenticated: false,
          token: null,
          refreshToken: null,
          user: null,
          tenant: null,
          permissions: [],
        })
        
        // 清除本地存储
        localStorage.removeItem('auth-storage')
        
        // 可选：调用后端登出接口
        // authService.logout().catch(console.error)
      },

      setToken: (token) => {
        set({ token })
      },

      setUser: (user) => {
        // 更新用户信息时也要更新权限
        const permissions = user.roles?.reduce((acc: string[], role) => {
          return [...acc, ...role.permissions]
        }, []) || []
        
        set({ 
          user,
          permissions: [...new Set(permissions)]
        })
      },

      setPermissions: (permissions) => {
        set({ permissions })
      },

      initializeAuth: () => {
        const state = get()
        if (state.token && state.user) {
          set({ isAuthenticated: true })
        }
      },

      hasPermission: (permission: string) => {
        const { permissions, user } = get()
        
        // 超级管理员拥有所有权限
        if (user?.roles?.some(role => role.name === 'super_admin')) {
          return true
        }
        
        return permissions.includes(permission)
      },

      hasAnyPermission: (requiredPermissions: string[]) => {
        const { permissions, user } = get()
        
        // 超级管理员拥有所有权限
        if (user?.roles?.some(role => role.name === 'super_admin')) {
          return true
        }
        
        return requiredPermissions.some(permission => permissions.includes(permission))
      },

      hasAllPermissions: (requiredPermissions: string[]) => {
        const { permissions, user } = get()
        
        // 超级管理员拥有所有权限
        if (user?.roles?.some(role => role.name === 'super_admin')) {
          return true
        }
        
        return requiredPermissions.every(permission => permissions.includes(permission))
      },

      isAdmin: () => {
        const { user } = get()
        // 检查用户是否有管理员相关角色
        // 支持多种管理员角色名称
        const adminRoles = ['super_admin', 'admin', '超级管理员', '管理员', 'administrator', 'system_admin']
        return user?.roles?.some(role => 
          adminRoles.includes(role.name?.toLowerCase() || '') ||
          adminRoles.includes(role.name || '') ||
          role.name?.includes('admin') ||
          role.name?.includes('管理')
        ) || false
      },

      clearAuth: () => {
        set({
          isAuthenticated: false,
          token: null,
          refreshToken: null,
          user: null,
          tenant: null,
          permissions: [],
        })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        tenant: state.tenant,
        permissions: state.permissions,
      }),
      onRehydrateStorage: () => (state) => {
        // 重新水化后初始化认证状态
        if (state?.token && state?.user) {
          state.isAuthenticated = true
        }
      },
    }
  )
)