/**
 * 角色权限预览组件
 * 用于显示角色的权限摘要和详情
 */
import React from 'react'
import { Shield, ShieldCheck, ShieldX, Users, Eye } from 'lucide-react'
import { ExtendedRole } from '../../types/role'
import clsx from 'clsx'

export interface RolePermissionPreviewProps {
  role: ExtendedRole
  showDetails?: boolean
  className?: string
  onViewDetails?: () => void
}

export const RolePermissionPreview: React.FC<RolePermissionPreviewProps> = ({
  role,
  showDetails = false,
  className,
  onViewDetails
}) => {
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

  // 模拟权限数据（实际应该从 API 获取）
  const allPermissions = [
    // 用户管理权限
    { id: 'user:read', name: '查看用户', category: 'user' },
    { id: 'user:create', name: '创建用户', category: 'user' },
    { id: 'user:update', name: '编辑用户', category: 'user' },
    { id: 'user:delete', name: '删除用户', category: 'user' },
    { id: 'user:export', name: '导出用户', category: 'user' },
    
    // 角色管理权限
    { id: 'role:read', name: '查看角色', category: 'role' },
    { id: 'role:create', name: '创建角色', category: 'role' },
    { id: 'role:update', name: '编辑角色', category: 'role' },
    { id: 'role:delete', name: '删除角色', category: 'role' },
    { id: 'role:export', name: '导出角色', category: 'role' },
    
    // 菜单管理权限
    { id: 'menu:read', name: '查看菜单', category: 'menu' },
    { id: 'menu:create', name: '创建菜单', category: 'menu' },
    { id: 'menu:update', name: '编辑菜单', category: 'menu' },
    { id: 'menu:delete', name: '删除菜单', category: 'menu' },
    
    // 日志管理权限
    { id: 'log:read', name: '查看日志', category: 'log' },
    { id: 'log:export', name: '导出日志', category: 'log' },
    
    // 主机管理权限
    { id: 'host:read', name: '查看主机', category: 'host' },
    { id: 'host:create', name: '添加主机', category: 'host' },
    { id: 'host:update', name: '编辑主机', category: 'host' },
    { id: 'host:delete', name: '删除主机', category: 'host' },
    { id: 'host:connect', name: '连接主机', category: 'host' },
    
    // Ansible 权限
    { id: 'ansible:read', name: '查看 Playbook', category: 'ansible' },
    { id: 'ansible:create', name: '创建 Playbook', category: 'ansible' },
    { id: 'ansible:update', name: '编辑 Playbook', category: 'ansible' },
    { id: 'ansible:delete', name: '删除 Playbook', category: 'ansible' },
    { id: 'ansible:execute', name: '执行 Playbook', category: 'ansible' },
    
    // 监控告警权限
    { id: 'monitor:read', name: '查看监控', category: 'monitor' },
    { id: 'monitor:create', name: '创建告警', category: 'monitor' },
    { id: 'monitor:update', name: '编辑告警', category: 'monitor' },
    { id: 'monitor:delete', name: '删除告警', category: 'monitor' },
    
    // 网络探测权限
    { id: 'network:read', name: '查看网络探测', category: 'network' },
    { id: 'network:create', name: '创建探测任务', category: 'network' },
    { id: 'network:update', name: '编辑探测任务', category: 'network' },
    { id: 'network:delete', name: '删除探测任务', category: 'network' },
    { id: 'network:execute', name: '执行探测', category: 'network' },
    
    // 系统管理权限
    { id: 'system:read', name: '查看系统信息', category: 'system' },
    { id: 'system:update', name: '系统配置', category: 'system' },
    { id: 'system:backup', name: '系统备份', category: 'system' },
    { id: 'system:restore', name: '系统恢复', category: 'system' }
  ]

  // 获取角色的权限详情
  const rolePermissions = allPermissions.filter(p => role.permissions.includes(p.id))
  
  // 按分类分组权限
  const permissionsByCategory = rolePermissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = []
    }
    acc[permission.category].push(permission)
    return acc
  }, {} as Record<string, typeof rolePermissions>)

  // 获取权限级别图标
  const getPermissionLevelIcon = () => {
    const permissionCount = role.permissions.length
    if (permissionCount === 0) return <ShieldX className="w-5 h-5 text-gray-400" />
    if (permissionCount < 10) return <Shield className="w-5 h-5 text-blue-500" />
    return <ShieldCheck className="w-5 h-5 text-green-500" />
  }

  // 获取权限级别描述
  const getPermissionLevelDescription = () => {
    const permissionCount = role.permissions.length
    if (permissionCount === 0) return '无权限'
    if (permissionCount < 5) return '基础权限'
    if (permissionCount < 15) return '标准权限'
    return '高级权限'
  }

  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200', className)}>
      {/* 角色基本信息 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getPermissionLevelIcon()}
            <div>
              <h3 className="text-lg font-medium text-gray-900">{role.name}</h3>
              <p className="text-sm text-gray-600">
                {role.description || '暂无描述'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">
                {getPermissionLevelDescription()}
              </div>
              <div className="text-xs text-gray-500">
                {role.permissions.length} 个权限
              </div>
            </div>
            
            {role.user_count !== undefined && (
              <div className="flex items-center space-x-1 text-sm text-gray-600">
                <Users className="w-4 h-4" />
                <span>{role.user_count} 用户</span>
              </div>
            )}
            
            {onViewDetails && (
              <button
                onClick={onViewDetails}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                title="查看详情"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 权限摘要 */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-900">权限分布</h4>
          <span className="text-xs text-gray-500">
            {Object.keys(permissionsByCategory).length} 个模块
          </span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(permissionsByCategory).map(([category, permissions]) => (
            <div
              key={category}
              className="p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center space-x-2 mb-1">
                <Shield className="w-3 h-3 text-blue-500" />
                <span className="text-xs font-medium text-gray-900">
                  {categoryNames[category] || category}
                </span>
              </div>
              <div className="text-xs text-gray-600">
                {permissions.length} 个权限
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 详细权限列表 */}
      {showDetails && (
        <div className="border-t border-gray-200">
          <div className="p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">详细权限</h4>
            <div className="space-y-3">
              {Object.entries(permissionsByCategory).map(([category, permissions]) => (
                <div key={category} className="border border-gray-200 rounded-lg">
                  <div className="p-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium text-gray-900">
                        {categoryNames[category] || category}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({permissions.length} 个权限)
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {permissions.map((permission) => (
                        <div
                          key={permission.id}
                          className="flex items-center space-x-2 text-sm text-gray-700"
                        >
                          <ShieldCheck className="w-3 h-3 text-green-500" />
                          <span>{permission.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RolePermissionPreview