/**
 * 角色新增/编辑表单页面
 */
import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Shield, ShieldCheck, ShieldX, Users } from 'lucide-react'
import { Input } from '../../components/Form'
import { PermissionAssignment } from '../../components/PermissionAssignment'
import { roleService, Permission } from '../../services/roles'
import { ExtendedRole } from '../../types/role'
import { useAuthStore } from '../../store/auth'
import clsx from 'clsx'

interface RoleFormState {
  loading: boolean
  saving: boolean
  role?: ExtendedRole
  permissions: Permission[]
  formData: {
    name: string
    description: string
    permissions: string[]
    status: number
  }
  errors: Record<string, string>
}

export const RoleForm: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { hasPermission } = useAuthStore()
  const isEdit = !!id

  const [state, setState] = useState<RoleFormState>({
    loading: false,
    saving: false,
    permissions: [],
    formData: {
      name: '',
      description: '',
      permissions: [],
      status: 1
    },
    errors: {}
  })

  // 模拟权限数据（实际应该从 API 获取）
  const mockPermissions: Permission[] = [
    // 用户管理权限
    { id: 'user:read', name: '查看用户', description: '查看用户列表和详情', category: 'user' },
    { id: 'user:create', name: '创建用户', description: '创建新用户账户', category: 'user' },
    { id: 'user:update', name: '编辑用户', description: '修改用户信息', category: 'user' },
    { id: 'user:delete', name: '删除用户', description: '删除用户账户', category: 'user' },
    { id: 'user:export', name: '导出用户', description: '导出用户数据', category: 'user' },
    
    // 角色管理权限
    { id: 'role:read', name: '查看角色', description: '查看角色列表和详情', category: 'role' },
    { id: 'role:create', name: '创建角色', description: '创建新角色', category: 'role' },
    { id: 'role:update', name: '编辑角色', description: '修改角色信息和权限', category: 'role' },
    { id: 'role:delete', name: '删除角色', description: '删除角色', category: 'role' },
    { id: 'role:export', name: '导出角色', description: '导出角色数据', category: 'role' },
    
    // 菜单管理权限
    { id: 'menu:read', name: '查看菜单', description: '查看菜单配置', category: 'menu' },
    { id: 'menu:create', name: '创建菜单', description: '创建新菜单项', category: 'menu' },
    { id: 'menu:update', name: '编辑菜单', description: '修改菜单配置', category: 'menu' },
    { id: 'menu:delete', name: '删除菜单', description: '删除菜单项', category: 'menu' },
    
    // 日志管理权限
    { id: 'log:read', name: '查看日志', description: '查看系统操作日志', category: 'log' },
    { id: 'log:export', name: '导出日志', description: '导出日志数据', category: 'log' },
    
    // 主机管理权限
    { id: 'host:read', name: '查看主机', description: '查看主机列表和信息', category: 'host' },
    { id: 'host:create', name: '添加主机', description: '添加新主机', category: 'host' },
    { id: 'host:update', name: '编辑主机', description: '修改主机配置', category: 'host' },
    { id: 'host:delete', name: '删除主机', description: '删除主机', category: 'host' },
    { id: 'host:connect', name: '连接主机', description: '测试主机连接', category: 'host' },
    
    // Ansible 权限
    { id: 'ansible:read', name: '查看 Playbook', description: '查看 Ansible Playbook', category: 'ansible' },
    { id: 'ansible:create', name: '创建 Playbook', description: '创建 Ansible Playbook', category: 'ansible' },
    { id: 'ansible:update', name: '编辑 Playbook', description: '修改 Ansible Playbook', category: 'ansible' },
    { id: 'ansible:delete', name: '删除 Playbook', description: '删除 Ansible Playbook', category: 'ansible' },
    { id: 'ansible:execute', name: '执行 Playbook', description: '执行 Ansible Playbook', category: 'ansible' },
    
    // 监控告警权限
    { id: 'monitor:read', name: '查看监控', description: '查看监控数据和告警', category: 'monitor' },
    { id: 'monitor:create', name: '创建告警', description: '创建告警规则和渠道', category: 'monitor' },
    { id: 'monitor:update', name: '编辑告警', description: '修改告警配置', category: 'monitor' },
    { id: 'monitor:delete', name: '删除告警', description: '删除告警规则', category: 'monitor' },
    
    // 网络探测权限
    { id: 'network:read', name: '查看网络探测', description: '查看网络探测任务和结果', category: 'network' },
    { id: 'network:create', name: '创建探测任务', description: '创建网络探测任务', category: 'network' },
    { id: 'network:update', name: '编辑探测任务', description: '修改网络探测配置', category: 'network' },
    { id: 'network:delete', name: '删除探测任务', description: '删除网络探测任务', category: 'network' },
    { id: 'network:execute', name: '执行探测', description: '手动执行网络探测', category: 'network' },
    
    // 系统管理权限
    { id: 'system:read', name: '查看系统信息', description: '查看系统状态和配置', category: 'system' },
    { id: 'system:update', name: '系统配置', description: '修改系统配置', category: 'system' },
    { id: 'system:backup', name: '系统备份', description: '执行系统备份', category: 'system' },
    { id: 'system:restore', name: '系统恢复', description: '执行系统恢复', category: 'system' }
  ]

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

  // 加载权限数据
  const loadPermissions = async () => {
    try {
      const response = await roleService.getPermissions()
      if (response.success && response.data) {
        // 转换后端权限数据格式为前端需要的格式
        const permissionList: Permission[] = []
        response.data.forEach((module: any) => {
          module.permissions.forEach((perm: any) => {
            permissionList.push({
              id: perm.key,
              name: perm.name,
              description: perm.name,
              category: module.module
            })
          })
        })
        
        setState(prev => ({
          ...prev,
          permissions: permissionList
        }))
      }
    } catch (error) {
      console.error('加载权限数据失败:', error)
      // 如果API失败，使用模拟数据
      setState(prev => ({
        ...prev,
        permissions: mockPermissions
      }))
    }
  }

  // 加载角色信息（编辑模式）
  const loadRole = async () => {
    if (!id) return

    setState(prev => ({ ...prev, loading: true }))
    
    try {
      const response = await roleService.getById(parseInt(id))
      if (response.success && response.data) {
        const role = response.data as ExtendedRole
        setState(prev => ({
          ...prev,
          role,
          formData: {
            name: role.name,
            description: role.description || '',
            permissions: role.permissions || [],
            status: role.status || 1
          },
          loading: false
        }))
      }
    } catch (error) {
      console.error('加载角色信息失败:', error)
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  // 表单验证
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    const { formData } = state

    if (!formData.name.trim()) {
      errors.name = '角色名称不能为空'
    } else if (formData.name.length < 2) {
      errors.name = '角色名称至少2个字符'
    }

    if (formData.permissions.length === 0) {
      errors.permissions = '请至少选择一个权限'
    }

    setState(prev => ({ ...prev, errors }))
    return Object.keys(errors).length === 0
  }

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setState(prev => ({ ...prev, saving: true }))

    try {
      const { formData } = state
      const submitData = {
        name: formData.name,
        description: formData.description,
        permissions: formData.permissions,
        status: formData.status
      }

      if (isEdit) {
        await roleService.update(parseInt(id!), submitData)
      } else {
        await roleService.create(submitData)
      }

      navigate('/roles')
    } catch (error) {
      console.error('保存角色失败:', error)
    } finally {
      setState(prev => ({ ...prev, saving: false }))
    }
  }

  // 处理表单字段变化
  const handleFieldChange = (field: string, value: any) => {
    setState(prev => ({
      ...prev,
      formData: {
        ...prev.formData,
        [field]: value
      },
      errors: {
        ...prev.errors,
        [field]: ''
      }
    }))
  }

  // 处理权限选择变化
  const handlePermissionChange = (permissions: string[]) => {
    handleFieldChange('permissions', permissions)
  }

  // 初始化
  useEffect(() => {
    loadPermissions()
    if (isEdit) {
      loadRole()
    }
  }, [id])

  // 计算权限统计
  const permissionStats = useMemo(() => {
    const selectedCount = state.formData.permissions.length
    const totalCount = state.permissions.length
    const selectedByCategory = state.formData.permissions.reduce((acc: Record<string, number>, perm: string) => {
      const category = perm.split(':')[0]
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {})
    const categoryCount = Object.keys(selectedByCategory).length
    
    return {
      selectedCount,
      totalCount,
      categoryCount,
      selectedByCategory,
      percentage: totalCount > 0 ? Math.round((selectedCount / totalCount) * 100) : 0
    }
  }, [state.formData.permissions, state.permissions])

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">加载中...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/roles')}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-900">
            {isEdit ? '编辑角色' : '新增角色'}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {isEdit ? '修改角色信息和权限配置' : '创建新的系统角色并分配权限'}
          </p>
        </div>
        {isEdit && state.role && (
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span>{state.role.user_count || 0} 个用户</span>
            </div>
            <div className="flex items-center space-x-1">
              <Shield className="w-4 h-4" />
              <span>{state.role.permissions?.length || 0} 个权限</span>
            </div>
          </div>
        )}
      </div>

      {/* 权限统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-xs font-medium">已选权限</p>
              <p className="text-2xl font-bold mt-1">{permissionStats.selectedCount}</p>
            </div>
            <Shield className="w-8 h-8 opacity-80" />
          </div>
          <div className="mt-2 text-blue-100 text-xs">
            共 {permissionStats.totalCount} 个可用
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-xs font-medium">覆盖模块</p>
              <p className="text-2xl font-bold mt-1">{permissionStats.categoryCount}</p>
            </div>
            <ShieldCheck className="w-8 h-8 opacity-80" />
          </div>
          <div className="mt-2 text-green-100 text-xs">
            共 9 个功能模块
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-xs font-medium">完成度</p>
              <p className="text-2xl font-bold mt-1">{permissionStats.percentage}%</p>
            </div>
            <Shield className="w-8 h-8 opacity-80" />
          </div>
          <div className="mt-2 text-purple-100 text-xs">
            权限配置进度
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-xs font-medium">状态</p>
              <p className="text-2xl font-bold mt-1">{state.formData.status === 1 ? '启用' : '禁用'}</p>
            </div>
            {state.formData.status === 1 ? (
              <ShieldCheck className="w-8 h-8 opacity-80" />
            ) : (
              <ShieldX className="w-8 h-8 opacity-80" />
            )}
          </div>
          <div className="mt-2 text-orange-100 text-xs">
            角色当前状态
          </div>
        </div>
      </div>

      {/* 表单 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">基本信息</h2>
          <p className="text-sm text-gray-500 mt-1">填写角色的基本信息</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 基本信息 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                角色名称 <span className="text-red-500">*</span>
              </label>
              <Input
                value={state.formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="请输入角色名称"
                error={state.errors.name}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                状态 <span className="text-red-500">*</span>
              </label>
              <select
                value={state.formData.status}
                onChange={(e) => handleFieldChange('status', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={1}>启用</option>
                <option value={0}>禁用</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              角色描述
            </label>
            <textarea
              value={state.formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="请输入角色描述，例如：该角色负责系统运维和监控管理"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              建议详细描述角色的职责和适用场景，帮助管理员更好地理解和使用
            </p>
          </div>

          {/* 权限分配 */}
          <div className="border-t border-gray-200 pt-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">权限配置</h3>
              <p className="text-sm text-gray-500 mt-1">
                为角色分配相应的功能权限，已选择 {permissionStats.selectedCount} 个权限，覆盖 {permissionStats.categoryCount} 个模块
              </p>
            </div>
            
            {/* 权限模块统计 */}
            {permissionStats.selectedCount > 0 && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-2">已选权限分布</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(permissionStats.selectedByCategory).map(([category, count]) => (
                    <span key={category} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {categoryNames[category] || category}: {count as number}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <PermissionAssignment
              permissions={state.permissions}
              selectedPermissions={state.formData.permissions}
              onPermissionChange={handlePermissionChange}
              error={state.errors.permissions}
              disabled={state.saving}
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/roles')}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={state.saving}
              className={clsx(
                'inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white',
                state.saving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              )}
            >
              {state.saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  保存
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RoleForm