/**
 * 菜单新增/编辑表单页面
 */
import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save, Menu as MenuIcon, Folder, Link, Code, Hash, Eye, EyeOff } from 'lucide-react'
import { Input, Select, SelectOption } from '../../components/Form'
import { menuService, Menu, MenuTreeNode } from '../../services/menus'
import { useAuthStore } from '../../store/auth'
import clsx from 'clsx'

interface MenuFormState {
  loading: boolean
  saving: boolean
  menu?: Menu
  parentMenus: MenuTreeNode[]
  formData: {
    parent_id?: number
    name: string
    path: string
    component: string
    icon: string
    sort_order: number
    status: number
  }
  errors: Record<string, string>
}

export const MenuForm: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { hasPermission } = useAuthStore()
  const isEdit = !!id
  const parentId = searchParams.get('parent_id')

  const [state, setState] = useState<MenuFormState>({
    loading: false,
    saving: false,
    parentMenus: [],
    formData: {
      parent_id: parentId ? parseInt(parentId) : undefined,
      name: '',
      path: '',
      component: '',
      icon: '',
      sort_order: 1,
      status: 1
    },
    errors: {}
  })

  // 常用图标选项
  const iconOptions: SelectOption[] = [
    { label: '无图标', value: '' },
    { label: '🏠 首页', value: 'home' },
    { label: '👥 用户', value: 'users' },
    { label: '🛡️ 角色', value: 'shield' },
    { label: '📋 菜单', value: 'menu' },
    { label: '📊 仪表盘', value: 'dashboard' },
    { label: '⚙️ 设置', value: 'settings' },
    { label: '📝 日志', value: 'file-text' },
    { label: '🖥️ 主机', value: 'server' },
    { label: '🔧 工具', value: 'tool' },
    { label: '📈 监控', value: 'activity' },
    { label: '🌐 网络', value: 'globe' },
    { label: '📁 文件夹', value: 'folder' },
    { label: '📄 文档', value: 'file' },
    { label: '🔗 链接', value: 'link' },
    { label: '💾 数据库', value: 'database' },
    { label: '🔒 安全', value: 'lock' },
    { label: '📧 邮件', value: 'mail' },
    { label: '🔔 通知', value: 'bell' },
    { label: '📱 移动', value: 'smartphone' }
  ]

  // 状态选项
  const statusOptions: SelectOption[] = [
    { label: '启用', value: 1 },
    { label: '禁用', value: 0 }
  ]

  // 加载父级菜单选项
  const loadParentMenus = async () => {
    try {
      const response = await menuService.getMenuTree()
      if (response.success) {
        setState(prev => ({
          ...prev,
          parentMenus: response.data || []
        }))
      }
    } catch (error) {
      console.error('加载父级菜单失败:', error)
    }
  }

  // 加载菜单信息（编辑模式）
  const loadMenu = async () => {
    if (!id) return

    setState(prev => ({ ...prev, loading: true }))
    
    try {
      const response = await menuService.getById(parseInt(id))
      if (response.success && response.data) {
        const menu = response.data
        setState(prev => ({
          ...prev,
          menu,
          formData: {
            parent_id: menu.parent_id,
            name: menu.name,
            path: menu.path || '',
            component: menu.component || '',
            icon: menu.icon || '',
            sort_order: menu.sort_order,
            status: menu.status
          },
          loading: false
        }))
      }
    } catch (error) {
      console.error('加载菜单信息失败:', error)
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  // 表单验证
  const validateForm = async (): Promise<boolean> => {
    const errors: Record<string, string> = {}
    const { formData } = state

    // 菜单名称验证
    if (!formData.name.trim()) {
      errors.name = '菜单名称不能为空'
    } else if (formData.name.length < 2) {
      errors.name = '菜单名称至少2个字符'
    }

    // 路径验证
    if (formData.path) {
      if (!formData.path.startsWith('/')) {
        errors.path = '路径必须以 / 开头'
      } else {
        // 检查路径是否已存在
        try {
          const response = await menuService.checkMenuPath(
            formData.path, 
            isEdit ? parseInt(id!) : undefined
          )
          if (response.success && !response.data.available) {
            errors.path = '该路径已被使用'
          }
        } catch (error) {
          console.error('检查路径失败:', error)
        }
      }
    }

    // 组件验证
    if (formData.component && formData.component.includes(' ')) {
      errors.component = '组件名称不能包含空格'
    }

    // 排序验证
    if (formData.sort_order < 1) {
      errors.sort_order = '排序值必须大于0'
    }

    setState(prev => ({ ...prev, errors }))
    return Object.keys(errors).length === 0
  }

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!(await validateForm())) return

    setState(prev => ({ ...prev, saving: true }))

    try {
      const { formData } = state
      const submitData = {
        parent_id: formData.parent_id || undefined,
        name: formData.name,
        path: formData.path || undefined,
        component: formData.component || undefined,
        icon: formData.icon || undefined,
        sort_order: formData.sort_order,
        status: formData.status
      }

      if (isEdit) {
        await menuService.update(parseInt(id!), submitData)
      } else {
        await menuService.create(submitData)
      }

      navigate('/menus')
    } catch (error) {
      console.error('保存菜单失败:', error)
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

  // 生成路径建议
  const generatePathSuggestion = () => {
    const name = state.formData.name.trim()
    if (!name) return

    // 将中文名称转换为拼音路径（简化处理）
    const pathSuggestion = '/' + name.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]/g, '')
    
    handleFieldChange('path', pathSuggestion)
  }

  // 生成组件名称建议
  const generateComponentSuggestion = () => {
    const name = state.formData.name.trim()
    if (!name) return

    const componentSuggestion = name
      .replace(/\s+/g, '')
      .replace(/[^\w]/g, '') + 'Page'
    
    handleFieldChange('component', componentSuggestion)
  }

  // 将菜单树转换为选项
  const getParentMenuOptions = (menus: MenuTreeNode[], level = 0): SelectOption[] => {
    const options: SelectOption[] = []
    
    menus.forEach(menu => {
      // 编辑模式下，不能选择自己作为父级
      if (isEdit && menu.id === parseInt(id!)) return
      
      const prefix = '　'.repeat(level)
      options.push({
        label: `${prefix}${menu.name}`,
        value: menu.id
      })
      
      if (menu.children && menu.children.length > 0) {
        options.push(...getParentMenuOptions(menu.children, level + 1))
      }
    })
    
    return options
  }

  // 初始化
  useEffect(() => {
    loadParentMenus()
    if (isEdit) {
      loadMenu()
    }
  }, [id])

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">加载中...</span>
      </div>
    )
  }

  const parentMenuOptions: SelectOption[] = [
    { label: '无父级菜单（顶级菜单）', value: '' },
    ...getParentMenuOptions(state.parentMenus)
  ]

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/menus')}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {isEdit ? '编辑菜单' : '新增菜单'}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {isEdit ? '修改菜单信息和配置' : '创建新的系统菜单项'}
          </p>
        </div>
      </div>

      {/* 表单 */}
      <div className="bg-white rounded-lg shadow">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 基本信息 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                菜单名称 <span className="text-red-500">*</span>
              </label>
              <Input
                value={state.formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="请输入菜单名称"
                error={state.errors.name}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                父级菜单
              </label>
              <Select
                value={state.formData.parent_id || ''}
                onChange={(value) => handleFieldChange('parent_id', value ? parseInt(value as string) : undefined)}
                options={parentMenuOptions}
                placeholder="选择父级菜单"
              />
            </div>
          </div>

          {/* 路径和组件 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                菜单路径
              </label>
              <div className="flex">
                <Input
                  value={state.formData.path}
                  onChange={(e) => handleFieldChange('path', e.target.value)}
                  placeholder="/example/path"
                  error={state.errors.path}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={generatePathSuggestion}
                  className="ml-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded-md hover:bg-blue-50"
                  title="根据菜单名称生成路径"
                >
                  <Link className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                前端路由路径，留空表示不是路由菜单
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                组件名称
              </label>
              <div className="flex">
                <Input
                  value={state.formData.component}
                  onChange={(e) => handleFieldChange('component', e.target.value)}
                  placeholder="ComponentName"
                  error={state.errors.component}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={generateComponentSuggestion}
                  className="ml-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded-md hover:bg-blue-50"
                  title="根据菜单名称生成组件名"
                >
                  <Code className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                对应的 React 组件名称
              </p>
            </div>
          </div>

          {/* 图标和排序 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                菜单图标
              </label>
              <Select
                value={state.formData.icon}
                onChange={(value) => handleFieldChange('icon', value)}
                options={iconOptions}
                placeholder="选择图标"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                排序值 <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={state.formData.sort_order}
                onChange={(e) => handleFieldChange('sort_order', parseInt(e.target.value) || 1)}
                placeholder="1"
                error={state.errors.sort_order}
                min={1}
              />
              <p className="mt-1 text-xs text-gray-500">
                数值越小排序越靠前
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                状态 <span className="text-red-500">*</span>
              </label>
              <Select
                value={state.formData.status}
                onChange={(value) => handleFieldChange('status', parseInt(value as string))}
                options={statusOptions}
              />
            </div>
          </div>

          {/* 预览区域 */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">菜单预览</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  {state.formData.icon ? (
                    <MenuIcon className="w-4 h-4 text-blue-500" />
                  ) : (
                    <Folder className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={clsx(
                    'font-medium',
                    state.formData.status === 1 ? 'text-gray-900' : 'text-gray-500'
                  )}>
                    {state.formData.name || '菜单名称'}
                  </span>
                </div>
                
                {state.formData.path && (
                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                    {state.formData.path}
                  </span>
                )}
                
                {state.formData.status === 0 && (
                  <span className="inline-flex items-center text-xs text-red-600">
                    <EyeOff className="w-3 h-3 mr-1" />
                    已禁用
                  </span>
                )}
                
                {state.formData.status === 1 && (
                  <span className="inline-flex items-center text-xs text-green-600">
                    <Eye className="w-3 h-3 mr-1" />
                    已启用
                  </span>
                )}
              </div>
              
              {state.formData.component && (
                <div className="mt-2 text-xs text-gray-500">
                  组件: {state.formData.component}
                </div>
              )}
              
              <div className="mt-2 text-xs text-gray-500">
                排序: {state.formData.sort_order}
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/menus')}
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

export default MenuForm