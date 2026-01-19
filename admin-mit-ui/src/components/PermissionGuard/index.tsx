import React from 'react'
import { useAuthStore } from '../../store/auth'

interface PermissionGuardProps {
  permission?: string
  permissions?: string[]
  requireAll?: boolean
  adminOnly?: boolean
  fallback?: React.ReactNode
  children: React.ReactNode
}

/**
 * 权限守卫组件
 * 根据用户权限控制组件的显示
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  permissions = [],
  requireAll = false,
  adminOnly = false,
  fallback = null,
  children
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isAdmin } = useAuthStore()

  // 检查管理员权限
  if (adminOnly && !isAdmin()) {
    return <>{fallback}</>
  }

  // 检查单个权限
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>
  }

  // 检查多个权限
  if (permissions.length > 0) {
    const hasRequiredPermissions = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions)
    
    if (!hasRequiredPermissions) {
      return <>{fallback}</>
    }
  }

  return <>{children}</>
}

/**
 * 权限守卫 Hook
 * 用于在组件内部检查权限
 */
export const usePermissionGuard = () => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isAdmin } = useAuthStore()

  const checkPermission = (permission: string) => hasPermission(permission)
  
  const checkPermissions = (permissions: string[], requireAll = false) => {
    return requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions)
  }

  const checkAdmin = () => isAdmin()

  return {
    checkPermission,
    checkPermissions,
    checkAdmin,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin
  }
}

export default PermissionGuard