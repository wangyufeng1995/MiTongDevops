/**
 * 权限分配组件类型定义
 */

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

export interface PermissionAssignmentProps {
  permissions: Permission[]
  selectedPermissions: string[]
  onPermissionChange: (permissions: string[]) => void
  error?: string
  disabled?: boolean
  className?: string
}

export interface PermissionStats {
  totalPermissions: number
  selectedPermissions: number
  categoriesWithPermissions: number
  totalCategories: number
}

export interface CategoryStats {
  name: string
  selected: number
  total: number
  isFullySelected: boolean
  isPartiallySelected: boolean
}