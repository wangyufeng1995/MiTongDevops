/**
 * 主机表单组件（新增/编辑）- 美化版
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Key, Lock, Server, User, Globe, FileText, FolderOpen, Save, CheckCircle, XCircle } from 'lucide-react'
import { hostsService } from '../../services/hosts'
import { hostGroupsService } from '../../services/hostGroups'
import { passwordEncryptService } from '../../services/password'
import { useTheme } from '../../hooks/useTheme'
import { HostGroupForm } from './HostGroupForm'
import { MonitorPageLayout, MonitorContentCard } from '../../components/Monitor/MonitorPageLayout'
import { ConfirmModal } from '../../components/ConfirmModal'
import type { HostGroup, CreateHostRequest, UpdateHostRequest, CreateHostGroupRequest } from '../../types/host'

export interface HostFormData {
  name: string
  hostname: string
  port: number
  username: string
  auth_type: 'password' | 'key'
  password: string
  private_key: string
  group_id: number | null
  os_type: string
  description: string
}

interface FormErrors {
  name?: string
  hostname?: string
  port?: string
  username?: string
  password?: string
  private_key?: string
}

const isValidIP = (ip: string): boolean => {
  const parts = ip.split('.')
  if (parts.length === 4) return parts.every(part => { const num = parseInt(part, 10); return !isNaN(num) && num >= 0 && num <= 255 && part === num.toString() })
  return /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(ip)
}

const isValidDomain = (domain: string): boolean => /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(domain)
export const isValidHostAddress = (address: string): boolean => address?.trim() ? (isValidIP(address.trim()) || isValidDomain(address.trim())) : false
export const isValidPort = (port: number): boolean => Number.isInteger(port) && port >= 1 && port <= 65535

const initialFormData: HostFormData = { name: '', hostname: '', port: 22, username: 'root', auth_type: 'password', password: '', private_key: '', group_id: null, os_type: '', description: '' }

export const HostForm: React.FC = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const isEdit = Boolean(id)

  const [formData, setFormData] = useState<HostFormData>(initialFormData)
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [groups, setGroups] = useState<HostGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [groupFormLoading, setGroupFormLoading] = useState(false)
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error'; message: string }>({ show: false, type: 'success', message: '' })
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message })
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000)
  }

  useEffect(() => { if (isEdit && id) loadHost(parseInt(id)) }, [id, isEdit])
  useEffect(() => { loadGroups() }, [])

  const loadHost = async (hostId: number) => {
    setLoading(true)
    try {
      const host = await hostsService.getHost(hostId)
      setFormData({ name: host.name || '', hostname: host.hostname || '', port: host.port || 22, username: host.username || 'root', auth_type: host.auth_type || 'password', password: '', private_key: '', group_id: host.group_id || null, os_type: host.os_type || '', description: host.description || '' })
    } catch (error) { showToast('error', '加载主机数据失败') }
    finally { setLoading(false) }
  }

  const loadGroups = async () => {
    setGroupsLoading(true)
    try { const response = await hostGroupsService.getGroups({ per_page: 100 }); setGroups(response.groups || []) }
    catch (error) { console.error('加载分组列表失败:', error) }
    finally { setGroupsLoading(false) }
  }

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {}
    if (!formData.name.trim()) newErrors.name = '主机名称不能为空'
    if (!formData.hostname.trim()) newErrors.hostname = '主机地址不能为空'
    else if (!isValidHostAddress(formData.hostname)) newErrors.hostname = '请输入有效的 IP 地址或域名'
    if (!isValidPort(formData.port)) newErrors.port = '端口必须在 1-65535 之间'
    if (!formData.username.trim()) newErrors.username = '用户名不能为空'
    if (formData.auth_type === 'password' && !isEdit && !formData.password) newErrors.password = '密码不能为空'
    if (formData.auth_type === 'key' && !isEdit && !formData.private_key.trim()) newErrors.private_key = '私钥不能为空'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData, isEdit])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    let processedValue: string | number | null = value
    if (name === 'port') processedValue = parseInt(value) || 22
    else if (name === 'group_id') processedValue = value === '' ? null : parseInt(value)
    setFormData(prev => ({ ...prev, [name]: processedValue }))
    setIsDirty(true)
    if (errors[name as keyof FormErrors]) setErrors(prev => ({ ...prev, [name]: undefined }))
  }

  const handleAuthTypeChange = (authType: 'password' | 'key') => {
    setFormData(prev => ({ ...prev, auth_type: authType, password: authType === 'password' ? prev.password : '', private_key: authType === 'key' ? prev.private_key : '' }))
    setIsDirty(true)
    setErrors(prev => ({ ...prev, password: undefined, private_key: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setSubmitting(true)
    try {
      const submitData: CreateHostRequest | UpdateHostRequest = {
        name: formData.name.trim(), hostname: formData.hostname.trim(), port: formData.port, username: formData.username.trim(),
        auth_type: formData.auth_type, description: formData.description.trim() || undefined, os_type: formData.os_type.trim() || undefined, group_id: formData.group_id || undefined
      }
      if (formData.auth_type === 'password' && formData.password) submitData.password = await passwordEncryptService.encryptPasswordAsync(formData.password)
      else if (formData.auth_type === 'key' && formData.private_key.trim()) submitData.private_key = formData.private_key.trim()
      if (isEdit && id) { await hostsService.updateHost(parseInt(id), submitData); showToast('success', '主机更新成功') }
      else { await hostsService.createHost(submitData as CreateHostRequest); showToast('success', '主机创建成功') }
      setTimeout(() => navigate('/hostoperate/hosts'), 1500)
    } catch (error: any) { showToast('error', error.response?.data?.message || '保存失败，请重试') }
    finally { setSubmitting(false) }
  }

  const handleCreateGroup = async (data: CreateHostGroupRequest) => {
    setGroupFormLoading(true)
    try {
      const newGroup = await hostGroupsService.createGroup(data)
      setGroups(prev => [...prev, newGroup])
      setFormData(prev => ({ ...prev, group_id: newGroup.id }))
      setShowGroupForm(false)
      setIsDirty(true)
      showToast('success', '分组创建成功')
    } catch (error: any) { showToast('error', error.response?.data?.message || '创建分组失败') }
    finally { setGroupFormLoading(false) }
  }

  const handleBack = () => {
    if (isDirty) {
      setShowLeaveConfirm(true)
    } else {
      navigate('/hostoperate/hosts')
    }
  }

  const handleConfirmLeave = () => {
    setShowLeaveConfirm(false)
    navigate('/hostoperate/hosts')
  }

  const inputClass = `w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`
  const labelClass = `block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`
  const errorClass = 'border-red-500 focus:ring-red-500'

  const headerActions = (
    <button onClick={handleBack} className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all ${isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
      <ArrowLeft className="w-4 h-4" /><span>返回列表</span>
    </button>
  )

  return (
    <MonitorPageLayout title={isEdit ? '编辑主机' : '添加主机'} subtitle={isEdit ? '修改主机配置信息' : '添加新的 SSH 主机'} icon={Server}
      iconGradient="from-blue-500 via-cyan-500 to-teal-500" headerActions={headerActions} loading={loading} showFullscreen={false} showRefresh={false}>
      
      {/* Toast */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`px-4 py-3 rounded-xl shadow-xl border flex items-center space-x-3 ${toast.type === 'success' ? (isDark ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800') : (isDark ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-800')}`}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基本信息 */}
        <MonitorContentCard title="基本信息" icon={Server}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>主机名称 <span className="text-red-500">*</span></label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="请输入主机名称" disabled={submitting}
                className={`${inputClass} ${errors.name ? errorClass : ''}`} />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
            </div>
            <div>
              <label className={labelClass}><Globe className="w-4 h-4 inline mr-1" />主机地址 <span className="text-red-500">*</span></label>
              <input type="text" name="hostname" value={formData.hostname} onChange={handleChange} placeholder="IP 地址或域名" disabled={submitting}
                className={`${inputClass} ${errors.hostname ? errorClass : ''}`} />
              {errors.hostname && <p className="mt-1 text-sm text-red-500">{errors.hostname}</p>}
            </div>
            <div>
              <label className={labelClass}>端口 <span className="text-red-500">*</span></label>
              <input type="number" name="port" value={formData.port} onChange={handleChange} min={1} max={65535} disabled={submitting}
                className={`${inputClass} ${errors.port ? errorClass : ''}`} />
              {errors.port && <p className="mt-1 text-sm text-red-500">{errors.port}</p>}
            </div>
            <div>
              <label className={labelClass}><User className="w-4 h-4 inline mr-1" />用户名 <span className="text-red-500">*</span></label>
              <input type="text" name="username" value={formData.username} onChange={handleChange} placeholder="SSH 用户名" disabled={submitting}
                className={`${inputClass} ${errors.username ? errorClass : ''}`} />
              {errors.username && <p className="mt-1 text-sm text-red-500">{errors.username}</p>}
            </div>
          </div>
        </MonitorContentCard>

        {/* 认证方式 */}
        <MonitorContentCard title="认证方式" icon={Lock}>
          <div className="flex space-x-4 mb-4">
            <label className={`flex items-center cursor-pointer px-4 py-2.5 rounded-xl border-2 transition-all ${formData.auth_type === 'password' ? (isDark ? 'border-blue-500 bg-blue-500/10' : 'border-blue-500 bg-blue-50') : (isDark ? 'border-slate-600 hover:border-slate-500' : 'border-gray-200 hover:border-gray-300')}`}>
              <input type="radio" checked={formData.auth_type === 'password'} onChange={() => handleAuthTypeChange('password')} className="sr-only" disabled={submitting} />
              <Lock className={`w-4 h-4 mr-2 ${formData.auth_type === 'password' ? 'text-blue-500' : (isDark ? 'text-gray-400' : 'text-gray-500')}`} />
              <span className={`text-sm font-medium ${formData.auth_type === 'password' ? (isDark ? 'text-blue-300' : 'text-blue-700') : (isDark ? 'text-gray-300' : 'text-gray-700')}`}>密码认证</span>
            </label>
            <label className={`flex items-center cursor-pointer px-4 py-2.5 rounded-xl border-2 transition-all ${formData.auth_type === 'key' ? (isDark ? 'border-blue-500 bg-blue-500/10' : 'border-blue-500 bg-blue-50') : (isDark ? 'border-slate-600 hover:border-slate-500' : 'border-gray-200 hover:border-gray-300')}`}>
              <input type="radio" checked={formData.auth_type === 'key'} onChange={() => handleAuthTypeChange('key')} className="sr-only" disabled={submitting} />
              <Key className={`w-4 h-4 mr-2 ${formData.auth_type === 'key' ? 'text-blue-500' : (isDark ? 'text-gray-400' : 'text-gray-500')}`} />
              <span className={`text-sm font-medium ${formData.auth_type === 'key' ? (isDark ? 'text-blue-300' : 'text-blue-700') : (isDark ? 'text-gray-300' : 'text-gray-700')}`}>密钥认证</span>
            </label>
          </div>
          {formData.auth_type === 'password' ? (
            <div className="max-w-md">
              <label className={labelClass}>密码 {!isEdit && <span className="text-red-500">*</span>}</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder={isEdit ? '留空则不修改密码' : '请输入 SSH 密码'} disabled={submitting}
                className={`${inputClass} ${errors.password ? errorClass : ''}`} />
              {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
              {isEdit && <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>留空表示不修改密码。如果探测失败提示认证错误，请重新输入密码。</p>}
            </div>
          ) : (
            <div>
              <label className={labelClass}>私钥 {!isEdit && <span className="text-red-500">*</span>}</label>
              <textarea name="private_key" value={formData.private_key} onChange={handleChange} placeholder={isEdit ? '留空则不修改私钥' : '请粘贴 SSH 私钥内容（以 -----BEGIN 开头）'} rows={5} disabled={submitting}
                className={`${inputClass} font-mono text-sm ${errors.private_key ? errorClass : ''}`} />
              {errors.private_key && <p className="mt-1 text-sm text-red-500">{errors.private_key}</p>}
              {isEdit && <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>留空表示不修改私钥</p>}
            </div>
          )}
        </MonitorContentCard>

        {/* 分组和其他信息 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MonitorContentCard title="分组设置" icon={FolderOpen}>
            <div className="flex items-end space-x-3">
              <div className="flex-1">
                <label className={labelClass}>所属分组</label>
                <select name="group_id" value={formData.group_id || ''} onChange={handleChange} disabled={submitting || groupsLoading} className={inputClass}>
                  <option value="">未分组</option>
                  {groups.map(group => <option key={group.id} value={group.id}>{group.name} ({group.host_count} 台主机)</option>)}
                </select>
              </div>
              <button type="button" onClick={() => setShowGroupForm(true)} disabled={submitting}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all ${isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                <Plus className="w-4 h-4" /><span>新建</span>
              </button>
            </div>
          </MonitorContentCard>

          <MonitorContentCard title="其他信息" icon={FileText}>
            <div>
              <label className={labelClass}>操作系统</label>
              <input type="text" name="os_type" value={formData.os_type} onChange={handleChange} placeholder="如：CentOS 7.9、Ubuntu 22.04" disabled={submitting} className={inputClass} />
            </div>
          </MonitorContentCard>
        </div>

        {/* 描述 */}
        <MonitorContentCard title="描述信息" icon={FileText}>
          <textarea name="description" value={formData.description} onChange={handleChange} placeholder="请输入主机描述（可选）" rows={3} disabled={submitting} className={inputClass} />
        </MonitorContentCard>

        {/* 操作按钮 */}
        <div className="flex justify-end space-x-4">
          <button type="button" onClick={handleBack} disabled={submitting}
            className={`px-6 py-2.5 rounded-xl font-medium transition-all ${isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>取消</button>
          <button type="submit" disabled={submitting}
            className={`group relative flex items-center space-x-2 px-6 py-2.5 rounded-xl text-white font-medium overflow-hidden transition-all ${submitting ? 'opacity-60 cursor-not-allowed' : ''}`}>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            {submitting ? <><div className="relative w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div><span className="relative">保存中...</span></> : <><Save className="relative w-4 h-4" /><span className="relative">{isEdit ? '保存修改' : '创建主机'}</span></>}
          </button>
        </div>
      </form>

      {/* 快速创建分组弹窗 */}
      <HostGroupForm isOpen={showGroupForm} onClose={() => setShowGroupForm(false)} onSubmit={handleCreateGroup} loading={groupFormLoading} existingNames={groups.map(g => g.name)} />

      {/* 离开确认弹窗 */}
      <ConfirmModal
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={handleConfirmLeave}
        type="leave"
        title="确认离开"
        message="您有未保存的更改，确定要离开吗？离开后更改将丢失。"
        confirmText="确认离开"
        cancelText="继续编辑"
      />
    </MonitorPageLayout>
  )
}

export default HostForm