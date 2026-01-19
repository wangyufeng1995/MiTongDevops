/**
 * 权限分配组件
 * 用于角色管理中的权限分配界面
 */
import React, { useState, useEffect } from 'react'
import { Shield, ShieldCheck, ShieldX, ChevronDown, ChevronRight, Check, X } from 'lucide-react'
import clsx from 'clsx'

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

export const PermissionAssignment: React.FC<PermissionAssignmentProps> = ({
  permissions,
  selectedPermissions,
  onPermissionChange,
  error,
  disabled = false,
  className
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['user', 'role']) // 默认展开用户和角色权限
  )

  // 权限分类映射
  const categoryNames: Record<string, string> = {
    user: '用户管理',
    role: '角色管理',
    menu: '菜单管理',
    log: '日志管理',
    host: '主机管理',
    ansible: 'Ansible 管理',
    monitor: '监控告警',
    network: '网络探测',
    system: '系统管理'
  }

  // 将权限按分类分组
  const permissionCategories: PermissionCategory[] = React.useMemo(() => {
    const categoryMap = new Map<string, Permission[]>()
    
    permissions.forEach(permission => {
      if (!categoryMap.has(permission.category)) {
        categoryMap.set(permission.category, [])
      }
      categoryMap.get(permission.category)!.push(permission)
    })
    
    const categories: PermissionCategory[] = []
    categoryMap.forEach((permissions, categoryKey) => {
      categories.push({
        name: categoryNames[categoryKey] || categoryKey,
        permissions: permissions.sort((a, b) => a.name.localeCompare(b.name))
      })
    })
    
    return categories.sort((a, b) => a.name.localeCompare(b.name))
  }, [permissions])

  // 处理单个权限选择
  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    if (disabled) return
    
    const newPermissions = checked
      ? [...selectedPermissions, permissionId]
      : selectedPermissions.filter(id => id !== permissionId)
    
    onPermissionChange(newPermissions)
  }

  // 处理分类全选/取消全选
  const handleCategoryToggle = (category: PermissionCategory, checked: boolean) => {
    if (disabled) return
    
    const categoryPermissionIds = category.permissions.map(p => p.id)
    let newPermissions = [...selectedPermissions]
    
    if (checked) {
      // 添加该分类下所有权限
      categoryPermissionIds.forEach(id => {
        if (!newPermissions.includes(id)) {
          newPermissions.push(id)
        }
      })
    } else {
      // 移除该分类下所有权限
      newPermissions = newPermissions.filter(id => !categoryPermissionIds.includes(id))
    }
    
    onPermissionChange(newPermissions)
  }

  // 切换分类展开/收起
  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(categoryName)) {
        newExpanded.delete(categoryName)
      } else {
        newExpanded.add(categoryName)
      }
      return newExpanded
    })
  }

  // 检查分类是否全选
  const isCategoryFullySelected = (category: PermissionCategory): boolean => {
    return category.permissions.every(p => selectedPermissions.includes(p.id))
  }

  // 检查分类是否部分选择
  const isCategoryPartiallySelected = (category: PermissionCategory): boolean => {
    const selectedCount = category.permissions.filter(p => selectedPermissions.includes(p.id)).length
    return selectedCount > 0 && selectedCount < category.permissions.length
  }

  // 获取权限类别图标
  const getPermissionIcon = (category: PermissionCategory) => {
    const selectedCount = category.permissions.filter(p => selectedPermissions.includes(p.id)).length
    const totalCount = category.permissions.length
    
    if (selectedCount === 0) return <ShieldX className="w-4 h-4 text-gray-400" />
    if (selectedCount === totalCount) return <ShieldCheck className="w-4 h-4 text-green-500" />
    return <Shield className="w-4 h-4 text-blue-500" />
  }

  return (
    <div className={clsx('space-y-4', className)}>
      {/* 标题和统计 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">权限分配</h3>
          <p className="text-sm text-gray-600">选择该角色拥有的系统权限</p>
        </div>
        <div className="text-sm text-gray-500">
          已选择 {selectedPermissions.length} 个权限
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 权限分类列表 */}
      <div className="space-y-3">
        {permissionCategories.map((category) => {
          const isExpanded = expandedCategories.has(category.name)
          const isFullySelected = isCategoryFullySelected(category)
          const isPartiallySelected = isCategoryPartiallySelected(category)
          const selectedCount = category.permissions.filter(p => selectedPermissions.includes(p.id)).length

          return (
            <div key={category.name} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* 分类标题 */}
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => toggleCategory(category.name)}
                      disabled={disabled}
                      className={clsx(
                        'text-gray-400 hover:text-gray-600 transition-colors',
                        disabled && 'cursor-not-allowed opacity-50'
                      )}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    
                    {getPermissionIcon(category)}
                    
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isFullySelected}
                        ref={(input) => {
                          if (input) input.indeterminate = isPartiallySelected
                        }}
                        onChange={(e) => handleCategoryToggle(category, e.target.checked)}
                        disabled={disabled}
                        className={clsx(
                          'rounded border-gray-300 text-blue-600 focus:ring-blue-500',
                          disabled && 'cursor-not-allowed opacity-50'
                        )}
                      />
                      <span className="ml-2 font-medium text-gray-900">
                        {category.name}
                      </span>
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-500">
                      {selectedCount} / {category.permissions.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleCategory(category.name)}
                      disabled={disabled}
                      className={clsx(
                        'text-sm text-blue-600 hover:text-blue-800 transition-colors',
                        disabled && 'cursor-not-allowed opacity-50'
                      )}
                    >
                      {isExpanded ? '收起' : '展开'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 权限列表 */}
              {isExpanded && (
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {category.permissions.map((permission) => (
                      <label
                        key={permission.id}
                        className={clsx(
                          'flex items-start space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors',
                          selectedPermissions.includes(permission.id) && 'bg-blue-50 border-blue-200',
                          disabled && 'cursor-not-allowed opacity-50'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(permission.id)}
                          onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                          disabled={disabled}
                          className={clsx(
                            'mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500',
                            disabled && 'cursor-not-allowed opacity-50'
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">
                              {permission.name}
                            </span>
                            {selectedPermissions.includes(permission.id) && (
                              <Check className="w-3 h-3 text-green-500" />
                            )}
                          </div>
                          {permission.description && (
                            <p className="text-xs text-gray-500 mt-1">
                              {permission.description}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 权限统计摘要 */}
      {selectedPermissions.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">
              权限摘要
            </span>
          </div>
          <div className="mt-2 text-sm text-blue-800">
            <p>已为该角色分配 {selectedPermissions.length} 个权限，涵盖以下功能模块：</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {permissionCategories
                .filter(category => category.permissions.some(p => selectedPermissions.includes(p.id)))
                .map(category => {
                  const selectedCount = category.permissions.filter(p => selectedPermissions.includes(p.id)).length
                  return (
                    <span
                      key={category.name}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {category.name} ({selectedCount})
                    </span>
                  )
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PermissionAssignment