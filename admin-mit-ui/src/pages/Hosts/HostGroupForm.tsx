/**
 * 主机分组表单组件 - 美化版
 * 用于创建和编辑主机分组
 */
import React, { useState, useEffect } from 'react'
import { X, FolderOpen, FileText, Save, Loader2 } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import { ConfirmModal } from '../../components/ConfirmModal'
import type { HostGroup, CreateHostGroupRequest, UpdateHostGroupRequest } from '../../types/host'

export interface HostGroupFormData {
  name: string
  description: string
}

export interface HostGroupFormProps {
  group?: HostGroup | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateHostGroupRequest | UpdateHostGroupRequest) => Promise<void>
  loading?: boolean
  existingNames?: string[]
}

interface FormErrors {
  name?: string
  description?: string
}

export const HostGroupForm: React.FC<HostGroupFormProps> = ({
  group, isOpen, onClose, onSubmit, loading = false, existingNames = []
}) => {
  const { isDark } = useTheme()
  const isEdit = Boolean(group)
  
  const [formData, setFormData] = useState<HostGroupFormData>({ name: '', description: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isDirty, setIsDirty] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  useEffect(() => {
    if (group) setFormData({ name: group.name || '', description: group.description || '' })
    else setFormData({ name: '', description: '' })
    setErrors({})
    setIsDirty(false)
  }, [group, isOpen])

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}
    const trimmedName = formData.name.trim()
    if (!trimmedName) newErrors.name = '分组名称不能为空'
    else if (trimmedName.length > 100) newErrors.name = '分组名称不能超过100个字符'
    else {
      const namesToCheck = isEdit ? existingNames.filter(n => n !== group?.name) : existingNames
      if (namesToCheck.includes(trimmedName)) newErrors.name = '分组名称已存在'
    }
    if (formData.description && formData.description.length > 500) newErrors.description = '描述不能超过500个字符'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setIsDirty(true)
    if (errors[name as keyof FormErrors]) setErrors(prev => ({ ...prev, [name]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    await onSubmit({ name: formData.name.trim(), description: formData.description.trim() || undefined })
  }

  const handleClose = () => {
    if (isDirty) {
      setShowLeaveConfirm(true)
    } else {
      onClose()
    }
  }

  const handleConfirmLeave = () => {
    setShowLeaveConfirm(false)
    onClose()
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose()
  }

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isDirty])

  if (!isOpen) return null

  const inputClass = `w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none ${isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`
  const labelClass = `block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`
  const errorInputClass = 'border-red-500 focus:ring-red-500'

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto" data-testid="host-group-form-modal">
        <div className={`fixed inset-0 transition-opacity ${isDark ? 'bg-black/60' : 'bg-gray-500/75'}`} onClick={handleOverlayClick} data-testid="modal-overlay">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className={`relative w-full max-w-md transform overflow-hidden rounded-2xl shadow-2xl transition-all ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}
              onClick={e => e.stopPropagation()} data-testid="modal-content">
              
              {/* 头部 - 渐变背景 */}
              <div className={`relative px-6 py-4 ${isDark ? 'bg-gradient-to-r from-slate-700/50 to-slate-800/50' : 'bg-gradient-to-r from-blue-50 to-cyan-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                      <FolderOpen className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                    <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {isEdit ? '编辑分组' : '创建分组'}
                    </h3>
                  </div>
                  <button type="button" onClick={handleClose} data-testid="close-button"
                    className={`p-2 rounded-xl transition-all ${isDark ? 'text-gray-400 hover:text-white hover:bg-slate-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 表单内容 */}
              <form onSubmit={handleSubmit}>
                <div className="px-6 py-5 space-y-5">
                  {/* 分组名称 */}
                  <div>
                    <label htmlFor="name" className={labelClass}>
                      <FolderOpen className="w-4 h-4 inline mr-1.5 opacity-70" />
                      分组名称 <span className="text-red-500">*</span>
                    </label>
                    <input type="text" id="name" name="name" value={formData.name} onChange={handleChange}
                      placeholder="请输入分组名称" disabled={loading} maxLength={100} data-testid="name-input"
                      className={`${inputClass} ${errors.name ? errorInputClass : ''}`} />
                    {errors.name && <p className="mt-1.5 text-sm text-red-500" data-testid="name-error">{errors.name}</p>}
                  </div>

                  {/* 分组描述 */}
                  <div>
                    <label htmlFor="description" className={labelClass}>
                      <FileText className="w-4 h-4 inline mr-1.5 opacity-70" />
                      描述
                    </label>
                    <textarea id="description" name="description" value={formData.description} onChange={handleChange}
                      placeholder="请输入分组描述（可选）" rows={3} disabled={loading} maxLength={500} data-testid="description-input"
                      className={`${inputClass} resize-none ${errors.description ? errorInputClass : ''}`} />
                    {errors.description && <p className="mt-1.5 text-sm text-red-500" data-testid="description-error">{errors.description}</p>}
                    <p className={`mt-1.5 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {formData.description.length}/500 字符
                    </p>
                  </div>
                </div>

                {/* 底部按钮 */}
                <div className={`px-6 py-4 flex justify-end space-x-3 ${isDark ? 'bg-slate-900/50 border-t border-slate-700' : 'bg-gray-50 border-t border-gray-100'}`}>
                  <button type="button" onClick={handleClose} disabled={loading} data-testid="cancel-button"
                    className={`px-5 py-2.5 rounded-xl font-medium transition-all ${isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    取消
                  </button>
                  <button type="submit" disabled={loading} data-testid="submit-button"
                    className="group relative flex items-center space-x-2 px-5 py-2.5 rounded-xl text-white font-medium overflow-hidden transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    {loading ? (
                      <><Loader2 className="relative w-4 h-4 animate-spin" /><span className="relative">保存中...</span></>
                    ) : (
                      <><Save className="relative w-4 h-4" /><span className="relative">{isEdit ? '保存' : '创建'}</span></>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* 离开确认弹窗 */}
      <ConfirmModal
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={handleConfirmLeave}
        type="leave"
        title="确认关闭"
        message="您有未保存的更改，确定要关闭吗？关闭后更改将丢失。"
        confirmText="确认关闭"
        cancelText="继续编辑"
      />
    </>
  )
}

export default HostGroupForm
