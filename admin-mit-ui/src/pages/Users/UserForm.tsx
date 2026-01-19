/**
 * 用户新增/编辑表单页面 - 美化版
 */
import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Eye, EyeOff, RefreshCw, Info, Edit2, User, Shield, Lock, Mail, UserCheck } from 'lucide-react'
import { Input } from '../../components/Form'
import { Avatar, AvatarEditor } from '../../components/Avatar'
import type { AvatarConfig } from '../../components/Avatar/types'
import { userService, CreateUserRequest, UpdateUserRequest } from '../../services/users'
import { roleService } from '../../services/roles'
import { User as UserType } from '../../types/auth'
import { useAuthStore } from '../../store/auth'
import { useTheme } from '../../hooks/useTheme'
import { MonitorPageLayout, MonitorContentCard } from '../../components/Monitor/MonitorPageLayout'

interface UserFormState {
  loading: boolean
  saving: boolean
  user?: UserType
  roles: Array<{ id: number; name: string; display_name?: string; description?: string }>
  formData: {
    username: string
    email: string
    password: string
    confirmPassword: string
    full_name: string
    role_id: number | null
    avatar_style: string
    avatar_seed: string
    avatar_config: Record<string, any>
    status: number
  }
  errors: Record<string, string>
  showPassword: boolean
  avatarConfig: AvatarConfig
  showAvatarEditor: boolean
}

export const UserForm: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { hasPermission } = useAuthStore()
  const { isDark } = useTheme()
  const isEdit = !!id

  const [state, setState] = useState<UserFormState>({
    loading: false, saving: false, roles: [],
    formData: {
      username: '', email: '', password: '', confirmPassword: '', full_name: '',
      role_id: null, avatar_style: 'avataaars', avatar_seed: '', avatar_config: {}, status: 1
    },
    errors: {}, showPassword: false,
    avatarConfig: { style: 'avataaars', seed: '' },
    showAvatarEditor: false
  })

  const loadRoles = async () => {
    try {
      const response = await roleService.getList({ per_page: 100 })
      if (response.success) {
        setState(prev => ({ ...prev, roles: response.data.roles || response.data.items || [] }))
      }
    } catch (error) {
      console.error('加载角色列表失败:', error)
      setState(prev => ({
        ...prev, roles: [
          { id: 1, name: 'super_admin', display_name: '超级管理员', description: '系统最高权限角色' },
          { id: 2, name: 'admin', display_name: '运维管理员', description: '日常运维管理角色' },
          { id: 3, name: 'system_admin', display_name: '系统管理员', description: '专注系统运维的角色' },
          { id: 4, name: 'user', display_name: '普通用户', description: '基础查看权限角色' }
        ]
      }))
    }
  }

  const loadUser = async () => {
    if (!id) return
    setState(prev => ({ ...prev, loading: true }))
    try {
      const response = await userService.getById(parseInt(id))
      if (response.success && response.data) {
        const user = (response.data as any).user || response.data
        setState(prev => ({
          ...prev, user,
          formData: {
            username: user.username || '', email: user.email || '', password: '', confirmPassword: '',
            full_name: user.full_name || '', role_id: user.roles?.[0]?.id || null,
            avatar_style: user.avatar_style || 'avataaars', avatar_seed: user.avatar_seed || user.username || '',
            avatar_config: user.avatar_config || {}, status: user.status ?? 1
          },
          avatarConfig: { style: (user.avatar_style || 'avataaars') as any, seed: user.avatar_seed || user.username || '' },
          loading: false
        }))
      }
    } catch (error) {
      console.error('加载用户信息失败:', error)
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    const { formData } = state
    if (!formData.username?.trim()) errors.username = '用户名不能为空'
    else if (formData.username.length < 3) errors.username = '用户名至少3个字符'
    if (!formData.email?.trim()) errors.email = '邮箱不能为空'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = '邮箱格式不正确'
    if (!isEdit) {
      if (!formData.password) errors.password = '密码不能为空'
      else if (formData.password.length < 6) errors.password = '密码至少6个字符'
      if (formData.password !== formData.confirmPassword) errors.confirmPassword = '两次输入的密码不一致'
    } else if (formData.password) {
      if (formData.password.length < 6) errors.password = '密码至少6个字符'
      if (formData.password !== formData.confirmPassword) errors.confirmPassword = '两次输入的密码不一致'
    }
    if (!formData.full_name?.trim()) errors.full_name = '姓名不能为空'
    if (!formData.role_id) errors.role_id = '请选择一个角色'
    setState(prev => ({ ...prev, errors }))
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setState(prev => ({ ...prev, saving: true }))
    try {
      const { formData, avatarConfig } = state
      const submitData = {
        username: formData.username, email: formData.email, full_name: formData.full_name,
        role_ids: formData.role_id ? [formData.role_id] : [],
        avatar_style: avatarConfig.style, avatar_seed: avatarConfig.seed, avatar_config: {},
        status: formData.status, ...(formData.password && { password: formData.password })
      }
      if (isEdit) await userService.update(parseInt(id!), submitData as UpdateUserRequest)
      else await userService.create(submitData as CreateUserRequest)
      navigate('/users')
    } catch (error) {
      console.error('保存用户失败:', error)
    } finally {
      setState(prev => ({ ...prev, saving: false }))
    }
  }

  const handleFieldChange = (field: string, value: any) => {
    setState(prev => ({
      ...prev, formData: { ...prev.formData, [field]: value ?? '' }, errors: { ...prev.errors, [field]: '' }
    }))
    if (field === 'username' && !isEdit && value) {
      setState(prev => ({ ...prev, avatarConfig: { ...prev.avatarConfig, seed: value } }))
    }
  }

  const handleRandomAvatar = () => {
    setState(prev => ({ ...prev, avatarConfig: { ...prev.avatarConfig, seed: Math.random().toString(36).substring(7) } }))
  }

  useEffect(() => {
    loadRoles()
    if (isEdit) loadUser()
    else setState(prev => ({ ...prev, avatarConfig: { ...prev.avatarConfig, seed: Math.random().toString(36).substring(7) } }))
  }, [id])

  const getRoleBadge = (roleName: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      super_admin: { label: '最高权限', color: isDark ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-red-100 text-red-700 border-red-200' },
      admin: { label: '高级权限', color: isDark ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' : 'bg-orange-100 text-orange-700 border-orange-200' },
      system_admin: { label: '中级权限', color: isDark ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-100 text-blue-700 border-blue-200' },
      user: { label: '基础权限', color: isDark ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-green-100 text-green-700 border-green-200' }
    }
    return badges[roleName] || { label: '自定义', color: isDark ? 'bg-gray-500/20 text-gray-300 border-gray-500/30' : 'bg-gray-100 text-gray-700 border-gray-200' }
  }

  const getRoleDescription = (roleName: string) => {
    const descriptions: Record<string, string> = {
      super_admin: '系统最高权限，拥有所有功能的完全访问权限',
      admin: '日常运维管理，用户管理，监控配置等大部分管理权限',
      system_admin: '专注系统运维，主机管理，脚本执行，告警处理',
      user: '基础查看权限，适合业务人员和临时访问用户'
    }
    return descriptions[roleName] || '自定义角色'
  }

  const headerActions = (
    <button onClick={() => navigate('/users')}
      className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
        isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}>
      <ArrowLeft className="w-4 h-4" /><span>返回列表</span>
    </button>
  )

  const inputClass = `w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
    isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
  }`

  const labelClass = `block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`

  return (
    <MonitorPageLayout title={isEdit ? '编辑用户' : '新增用户'} subtitle={isEdit ? '修改用户基本信息和权限设置' : '创建新的系统用户账户'}
      icon={User} iconGradient="from-blue-500 via-indigo-500 to-purple-500" headerActions={headerActions}
      loading={state.loading} showFullscreen={false} showRefresh={false}>
      
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
        {/* 左右两栏布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：头像设置 */}
          <div className="lg:col-span-1">
            <MonitorContentCard title="头像设置" icon={UserCheck}>
              <div className="flex flex-col items-center space-y-4">
                <div className={`p-3 rounded-2xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                  <Avatar config={state.avatarConfig} size="large" />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <button type="button" onClick={() => setState(prev => ({ ...prev, showAvatarEditor: true }))}
                    className={`w-full inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isDark ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}>
                    <Edit2 className="w-4 h-4 mr-2" />自定义
                  </button>
                  <button type="button" onClick={handleRandomAvatar}
                    className={`w-full inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}>
                    <RefreshCw className="w-4 h-4 mr-2" />随机
                  </button>
                </div>
                <div className={`text-xs text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <p>风格: {state.avatarConfig.style}</p>
                </div>
              </div>
            </MonitorContentCard>
          </div>

          {/* 右侧：基本信息 + 密码 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 基本信息 */}
            <MonitorContentCard title="基本信息" icon={User}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>用户名 <span className="text-red-500">*</span></label>
                  <input type="text" value={state.formData.username} onChange={(e) => handleFieldChange('username', e.target.value)}
                    placeholder="请输入用户名" disabled={isEdit} className={`${inputClass} ${isEdit ? 'opacity-60 cursor-not-allowed' : ''}`} />
                  {state.errors.username && <p className="mt-1 text-xs text-red-500">{state.errors.username}</p>}
                </div>
                <div>
                  <label className={labelClass}>姓名 <span className="text-red-500">*</span></label>
                  <input type="text" value={state.formData.full_name} onChange={(e) => handleFieldChange('full_name', e.target.value)}
                    placeholder="请输入真实姓名" className={inputClass} />
                  {state.errors.full_name && <p className="mt-1 text-xs text-red-500">{state.errors.full_name}</p>}
                </div>
                <div>
                  <label className={labelClass}>邮箱 <span className="text-red-500">*</span></label>
                  <input type="email" value={state.formData.email} onChange={(e) => handleFieldChange('email', e.target.value)}
                    placeholder="请输入邮箱地址" className={inputClass} />
                  {state.errors.email && <p className="mt-1 text-xs text-red-500">{state.errors.email}</p>}
                </div>
                <div>
                  <label className={labelClass}>状态 <span className="text-red-500">*</span></label>
                  <select value={state.formData.status} onChange={(e) => handleFieldChange('status', parseInt(e.target.value))} className={inputClass}>
                    <option value={1}>正常</option>
                    <option value={0}>禁用</option>
                  </select>
                </div>
              </div>
            </MonitorContentCard>

            {/* 密码设置 */}
            <MonitorContentCard title={isEdit ? '修改密码（留空则不修改）' : '密码设置'} icon={Lock}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>{isEdit ? '新密码' : '密码'} {!isEdit && <span className="text-red-500">*</span>}</label>
                  <div className="relative">
                    <input type={state.showPassword ? 'text' : 'password'} value={state.formData.password}
                      onChange={(e) => handleFieldChange('password', e.target.value)}
                      placeholder={isEdit ? '留空则不修改' : '请输入密码'} className={inputClass} />
                    <button type="button" onClick={() => setState(prev => ({ ...prev, showPassword: !prev.showPassword }))}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}>
                      {state.showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {state.errors.password && <p className="mt-1 text-xs text-red-500">{state.errors.password}</p>}
                </div>
                <div>
                  <label className={labelClass}>确认密码 {!isEdit && state.formData.password && <span className="text-red-500">*</span>}</label>
                  <input type={state.showPassword ? 'text' : 'password'} value={state.formData.confirmPassword}
                    onChange={(e) => handleFieldChange('confirmPassword', e.target.value)}
                    placeholder="请再次输入密码" className={inputClass} />
                  {state.errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{state.errors.confirmPassword}</p>}
                </div>
              </div>
            </MonitorContentCard>
          </div>
        </div>

        {/* 角色分配 - 独立一行，使用网格布局 */}
        <MonitorContentCard title="角色分配" icon={Shield}>
          <div className={`mb-4 p-3 rounded-lg text-sm ${isDark ? 'bg-blue-500/10 border border-blue-500/20 text-blue-300' : 'bg-blue-50 border border-blue-100 text-blue-800'}`}>
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>每个用户只能选择一个角色，不同角色拥有不同的系统权限</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {state.roles.map(role => {
              const isSelected = state.formData.role_id === role.id
              const badge = getRoleBadge(role.name)
              return (
                <label key={role.id} className={`flex items-center space-x-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected ? (isDark ? 'border-blue-500 bg-blue-500/10' : 'border-blue-500 bg-blue-50')
                  : (isDark ? 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50')
                }`}>
                  <input type="radio" name="role" checked={isSelected} onChange={() => handleFieldChange('role_id', role.id)}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{role.display_name || role.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${badge.color}`}>{badge.label}</span>
                    </div>
                    <p className={`text-xs mt-0.5 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{getRoleDescription(role.name)}</p>
                  </div>
                </label>
              )
            })}
          </div>
          {state.errors.role_id && <p className="mt-2 text-sm text-red-500">{state.errors.role_id}</p>}
        </MonitorContentCard>

        {/* 操作按钮 */}
        <div className="flex justify-end space-x-4">
          <button type="button" onClick={() => navigate('/users')}
            className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
              isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>取消</button>
          <button type="submit" disabled={state.saving}
            className={`group relative flex items-center space-x-2 px-6 py-2.5 rounded-xl text-white font-medium overflow-hidden transition-all ${
              state.saving ? 'opacity-60 cursor-not-allowed' : ''
            }`}>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            {state.saving ? (
              <><div className="relative w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div><span className="relative">保存中...</span></>
            ) : (
              <><Save className="relative w-4 h-4" /><span className="relative">保存</span></>
            )}
          </button>
        </div>
      </form>

      {/* 头像编辑器弹窗 */}
      {state.showAvatarEditor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <AvatarEditor config={state.avatarConfig} onChange={(c) => setState(prev => ({ ...prev, avatarConfig: c }))}
              onSave={(c) => setState(prev => ({ ...prev, avatarConfig: c, showAvatarEditor: false }))}
              onCancel={() => setState(prev => ({ ...prev, showAvatarEditor: false }))} />
          </div>
        </div>
      )}
    </MonitorPageLayout>
  )
}

export default UserForm