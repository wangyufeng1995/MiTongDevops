/**
 * 角色权限介绍组件
 */
import React, { useState } from 'react'
import { Info, ChevronDown, ChevronRight, Shield, Users, Settings, Server, Zap, Monitor, Network, FileText } from 'lucide-react'
import clsx from 'clsx'

interface PermissionModule {
  key: string
  name: string
  icon: React.ReactNode
  description: string
  permissions: Array<{
    key: string
    name: string
    description: string
  }>
}

interface RoleInfo {
  name: string
  displayName: string
  description: string
  level: 'highest' | 'high' | 'medium' | 'low'
  permissions: string[]
  scenarios: string[]
}

const PERMISSION_MODULES: PermissionModule[] = [
  {
    key: 'user',
    name: '用户管理',
    icon: <Users className="w-4 h-4" />,
    description: '管理系统用户账户、角色分配和基本信息',
    permissions: [
      { key: 'user:read', name: '查看用户', description: '查看用户列表和用户详细信息' },
      { key: 'user:create', name: '创建用户', description: '创建新的用户账户' },
      { key: 'user:update', name: '编辑用户', description: '修改用户信息、状态、角色分配' },
      { key: 'user:delete', name: '删除用户', description: '删除用户账户（不可恢复）' },
      { key: 'user:export', name: '导出用户', description: '导出用户列表数据' }
    ]
  },
  {
    key: 'role',
    name: '角色管理',
    icon: <Shield className="w-4 h-4" />,
    description: '管理系统角色和权限配置',
    permissions: [
      { key: 'role:read', name: '查看角色', description: '查看角色列表和角色详细信息' },
      { key: 'role:create', name: '创建角色', description: '创建新的角色' },
      { key: 'role:update', name: '编辑角色', description: '修改角色信息和权限配置' },
      { key: 'role:delete', name: '删除角色', description: '删除角色（不可恢复）' }
    ]
  },
  {
    key: 'host',
    name: '主机管理',
    icon: <Server className="w-4 h-4" />,
    description: '管理服务器主机资源和连接',
    permissions: [
      { key: 'host:read', name: '查看主机', description: '查看主机列表和主机信息' },
      { key: 'host:create', name: '添加主机', description: '添加新的主机到系统' },
      { key: 'host:update', name: '编辑主机', description: '修改主机配置信息' },
      { key: 'host:delete', name: '删除主机', description: '从系统中删除主机' },
      { key: 'host:connect', name: '连接主机', description: '建立到主机的连接' },
      { key: 'host:webshell', name: '使用WebShell', description: '通过Web界面访问主机终端' }
    ]
  },
  {
    key: 'ansible',
    name: 'Ansible管理',
    icon: <Zap className="w-4 h-4" />,
    description: '管理和执行自动化运维脚本',
    permissions: [
      { key: 'ansible:read', name: '查看Playbook', description: '查看自动化脚本列表' },
      { key: 'ansible:create', name: '创建Playbook', description: '创建新的自动化脚本' },
      { key: 'ansible:update', name: '编辑Playbook', description: '修改自动化脚本内容' },
      { key: 'ansible:delete', name: '删除Playbook', description: '删除自动化脚本' },
      { key: 'ansible:execute', name: '执行Playbook', description: '执行自动化脚本任务' }
    ]
  },
  {
    key: 'monitor',
    name: '监控告警',
    icon: <Monitor className="w-4 h-4" />,
    description: '系统监控和告警管理',
    permissions: [
      { key: 'monitor:read', name: '查看监控', description: '查看监控数据和告警信息' },
      { key: 'monitor:channel', name: '管理告警渠道', description: '配置告警通知渠道' },
      { key: 'monitor:rule', name: '管理告警规则', description: '创建和修改告警规则' },
      { key: 'monitor:alert', name: '处理告警', description: '确认和处理告警事件' }
    ]
  },
  {
    key: 'network',
    name: '网络探测',
    icon: <Network className="w-4 h-4" />,
    description: '网络连通性探测和监控',
    permissions: [
      { key: 'network:read', name: '查看探测', description: '查看网络探测结果' },
      { key: 'network:create', name: '创建探测', description: '创建新的网络探测任务' },
      { key: 'network:update', name: '编辑探测', description: '修改网络探测配置' },
      { key: 'network:delete', name: '删除探测', description: '删除网络探测任务' },
      { key: 'network:execute', name: '执行探测', description: '手动执行网络探测' },
      { key: 'network:group', name: '管理分组', description: '管理网络探测分组' }
    ]
  },
  {
    key: 'log',
    name: '日志管理',
    icon: <FileText className="w-4 h-4" />,
    description: '系统操作日志查看和管理',
    permissions: [
      { key: 'log:read', name: '查看日志', description: '查看系统操作日志' },
      { key: 'log:export', name: '导出日志', description: '导出日志数据' }
    ]
  },
  {
    key: 'menu',
    name: '菜单管理',
    icon: <Settings className="w-4 h-4" />,
    description: '系统菜单结构配置',
    permissions: [
      { key: 'menu:read', name: '查看菜单', description: '查看菜单配置' },
      { key: 'menu:create', name: '创建菜单', description: '创建新的菜单项' },
      { key: 'menu:update', name: '编辑菜单', description: '修改菜单结构和配置' },
      { key: 'menu:delete', name: '删除菜单', description: '删除菜单项' }
    ]
  }
]

const ROLE_INFO: Record<string, RoleInfo> = {
  super_admin: {
    name: 'super_admin',
    displayName: '超级管理员',
    description: '系统最高权限角色，拥有所有功能的完全访问权限',
    level: 'highest',
    permissions: [
      'user:read', 'user:create', 'user:update', 'user:delete',
      'role:read', 'role:create', 'role:update', 'role:delete',
      'menu:read', 'menu:create', 'menu:update', 'menu:delete',
      'host:read', 'host:create', 'host:update', 'host:delete', 'host:connect', 'host:webshell',
      'ansible:read', 'ansible:create', 'ansible:update', 'ansible:delete', 'ansible:execute',
      'monitor:read', 'monitor:channel', 'monitor:rule', 'monitor:alert',
      'network:read', 'network:create', 'network:update', 'network:delete', 'network:execute', 'network:group',
      'log:read', 'log:export'
    ],
    scenarios: ['系统初始化和配置', '紧急故障处理', '系统架构调整', '安全策略管理']
  },
  admin: {
    name: 'admin',
    displayName: '运维管理员',
    description: '系统管理员角色，拥有大部分管理权限，专注于日常运维管理',
    level: 'high',
    permissions: [
      'user:read', 'user:create', 'user:update', 'user:delete',
      'role:read', 'role:create', 'role:update',
      'host:read', 'host:create', 'host:update', 'host:delete', 'host:connect', 'host:webshell',
      'ansible:read', 'ansible:create', 'ansible:update', 'ansible:delete', 'ansible:execute',
      'monitor:read', 'monitor:channel', 'monitor:rule', 'monitor:alert',
      'network:read', 'network:create', 'network:update', 'network:delete', 'network:execute', 'network:group',
      'log:read'
    ],
    scenarios: ['日常系统管理', '用户账户管理', '运维任务执行', '监控配置管理']
  },
  system_admin: {
    name: 'system_admin',
    displayName: '系统管理员',
    description: '专注于系统运维的管理员角色，无用户和角色管理权限',
    level: 'medium',
    permissions: [
      'host:read', 'host:create', 'host:update', 'host:delete', 'host:connect', 'host:webshell',
      'ansible:read', 'ansible:execute',
      'monitor:read', 'monitor:alert',
      'network:read', 'network:execute',
      'log:read'
    ],
    scenarios: ['专业运维工程师', '系统监控专员', '自动化运维执行']
  },
  user: {
    name: 'user',
    displayName: '普通用户',
    description: '基础用户角色，只有查看权限',
    level: 'low',
    permissions: [
      'user:read', 'role:read', 'host:read', 'ansible:read',
      'monitor:read', 'network:read', 'log:read'
    ],
    scenarios: ['业务人员查看系统状态', '临时访问用户', '审计和监督人员', '实习生或新员工']
  }
}

interface RolePermissionsProps {
  className?: string
}

export const RolePermissions: React.FC<RolePermissionsProps> = ({ className }) => {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [selectedRole, setSelectedRole] = useState<string>('super_admin')

  const toggleModule = (moduleKey: string) => {
    const newExpanded = new Set(expandedModules)
    if (newExpanded.has(moduleKey)) {
      newExpanded.delete(moduleKey)
    } else {
      newExpanded.add(moduleKey)
    }
    setExpandedModules(newExpanded)
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'highest': return 'text-red-600 bg-red-50 border-red-200'
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'medium': return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'low': return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const hasPermission = (rolePermissions: string[], permission: string) => {
    return rolePermissions.includes(permission)
  }

  const currentRole = ROLE_INFO[selectedRole]

  return (
    <div className={clsx('space-y-6', className)}>
      {/* 角色选择 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Info className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">角色权限说明</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Object.values(ROLE_INFO).map((role) => (
            <button
              key={role.name}
              onClick={() => setSelectedRole(role.name)}
              className={clsx(
                'p-4 rounded-lg border-2 text-left transition-all',
                selectedRole === role.name
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{role.displayName}</h4>
                <span className={clsx(
                  'px-2 py-1 rounded-full text-xs font-medium border',
                  getLevelColor(role.level)
                )}>
                  {role.level === 'highest' && '最高'}
                  {role.level === 'high' && '高级'}
                  {role.level === 'medium' && '中级'}
                  {role.level === 'low' && '基础'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{role.description}</p>
              <p className="text-xs text-gray-500">{role.permissions.length} 个权限</p>
            </button>
          ))}
        </div>

        {/* 当前选中角色的详细信息 */}
        {currentRole && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">
              {currentRole.displayName} - 适用场景
            </h4>
            <div className="flex flex-wrap gap-2">
              {currentRole.scenarios.map((scenario, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-white rounded-full text-sm text-gray-700 border"
                >
                  {scenario}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 权限模块详情 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {currentRole?.displayName} 权限详情
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            以下是该角色拥有的具体权限，绿色表示拥有权限，灰色表示无权限
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {PERMISSION_MODULES.map((module) => {
            const isExpanded = expandedModules.has(module.key)
            const modulePermissions = module.permissions.filter(p => 
              hasPermission(currentRole?.permissions || [], p.key)
            )
            const hasAnyPermission = modulePermissions.length > 0

            return (
              <div key={module.key} className="p-6">
                <button
                  onClick={() => toggleModule(module.key)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <div className="flex items-center space-x-3">
                    <div className={clsx(
                      'p-2 rounded-lg',
                      hasAnyPermission ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                    )}>
                      {module.icon}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{module.name}</h4>
                      <p className="text-sm text-gray-600">{module.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={clsx(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      hasAnyPermission 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-600'
                    )}>
                      {modulePermissions.length}/{module.permissions.length} 权限
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-4 ml-11 space-y-2">
                    {module.permissions.map((permission) => {
                      const hasThisPermission = hasPermission(currentRole?.permissions || [], permission.key)
                      
                      return (
                        <div
                          key={permission.key}
                          className={clsx(
                            'flex items-center justify-between p-3 rounded-lg border',
                            hasThisPermission 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-gray-50 border-gray-200'
                          )}
                        >
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className={clsx(
                                'w-2 h-2 rounded-full',
                                hasThisPermission ? 'bg-green-500' : 'bg-gray-300'
                              )} />
                              <span className={clsx(
                                'font-medium',
                                hasThisPermission ? 'text-green-900' : 'text-gray-500'
                              )}>
                                {permission.name}
                              </span>
                              <code className={clsx(
                                'px-2 py-1 rounded text-xs font-mono',
                                hasThisPermission 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-gray-100 text-gray-500'
                              )}>
                                {permission.key}
                              </code>
                            </div>
                            <p className={clsx(
                              'text-sm mt-1',
                              hasThisPermission ? 'text-green-700' : 'text-gray-500'
                            )}>
                              {permission.description}
                            </p>
                          </div>
                          <div className={clsx(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            hasThisPermission 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-600'
                          )}>
                            {hasThisPermission ? '✓ 拥有' : '✗ 无权限'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default RolePermissions