/**
 * 主机分组表单页面
 * 用于创建和编辑主机分组的独立页面
 * 路由: /hostoperate/hosts/groups/new 和 /hostoperate/hosts/groups/:id/edit
 */
import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { hostGroupsService } from '../../services/hostGroups'
import type { HostGroup, CreateHostGroupRequest, UpdateHostGroupRequest } from '../../types/host'

interface FormData {
  name: string
  description: string
}

interface FormErrors {
  name?: string
  description?: string
}

interface PageState {
  loading: boolean
  submitting: boolean
  error: string | null
  group: HostGroup | null
  existingNames: string[]
}

export const HostGroupFormPage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const [state, setState] = useState<PageState>({
    loading: isEdit,
    submitting: false,
    error: null,
    group: null,
    existingNames: []
  })

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: ''
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isDirty, setIsDirty] = useState(false)

  // 加载分组数据（编辑模式）和已存在的分组名称
  useEffect(() => {
    const loadData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }))

        // 加载所有分组以获取已存在的名称
        const groupsResponse = await hostGroupsService.getGroups({ per_page: 1000 })
        const existingNames = groupsResponse.groups?.map(g => g.name) || []

        if (isEdit && id) {
          // 编辑模式：加载分组详情
          const group = await hostGroupsService.getGroup(parseInt(id, 10))
          setFormData({
            name: group.name || '',
            description: group.description || ''
          })
          setState(prev => ({
            ...prev,
            loading: false,
            group,
            existingNames: existingNames.filter(n => n !== group.name)
          }))
        } else {
          setState(prev => ({
            ...prev,
            loading: false,
            existingNames
          }))
        }
      } catch (error: any) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error.message || '加载数据失败'
        }))
      }
    }

    loadData()
  }, [id, isEdit])


  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // 名称验证
    const trimmedName = formData.name.trim()
    if (!trimmedName) {
      newErrors.name = '分组名称不能为空'
    } else if (trimmedName.length > 100) {
      newErrors.name = '分组名称不能超过100个字符'
    } else if (state.existingNames.includes(trimmedName)) {
      newErrors.name = '分组名称已存在'
    }

    // 描述验证
    if (formData.description && formData.description.length > 500) {
      newErrors.description = '描述不能超过500个字符'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 处理输入变化
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setIsDirty(true)

    // 清除对应字段的错误
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  // 处理提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setState(prev => ({ ...prev, submitting: true, error: null }))

    try {
      const submitData: CreateHostGroupRequest | UpdateHostGroupRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined
      }

      if (isEdit && id) {
        await hostGroupsService.updateGroup(parseInt(id, 10), submitData)
      } else {
        await hostGroupsService.createGroup(submitData as CreateHostGroupRequest)
      }

      // 成功后返回分组列表
      navigate('/hostoperate/hosts/groups')
    } catch (error: any) {
      let errorMessage = error.message || '保存失败'
      if (errorMessage.includes('已存在') || error.response?.data?.message?.includes('已存在')) {
        errorMessage = '分组名称已存在'
        setErrors(prev => ({ ...prev, name: errorMessage }))
      }
      setState(prev => ({ ...prev, submitting: false, error: errorMessage }))
    }
  }

  // 处理返回
  const handleBack = () => {
    if (isDirty) {
      if (confirm('您有未保存的更改，确定要离开吗？')) {
        navigate('/hostoperate/hosts/groups')
      }
    } else {
      navigate('/hostoperate/hosts/groups')
    }
  }

  // 加载中状态
  if (state.loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  // 错误状态（加载失败）
  if (state.error && !state.group && isEdit) {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <button
            onClick={handleBack}
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            返回分组列表
          </button>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-sm text-red-600">{state.error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={handleBack}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mr-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            返回
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {isEdit ? '编辑分组' : '创建分组'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {isEdit ? '修改主机分组信息' : '创建新的主机分组'}
            </p>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-sm text-red-600">{state.error}</div>
        </div>
      )}

      {/* 表单 */}
      <div className="bg-white shadow rounded-lg">
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            {/* 分组名称 */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                分组名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="请输入分组名称"
                className={`w-full max-w-md px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-blue-500'
                }`}
                data-testid="name-input"
                disabled={state.submitting}
                maxLength={100}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600" data-testid="name-error">
                  {errors.name}
                </p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                分组名称在同一租户下必须唯一
              </p>
            </div>

            {/* 分组描述 */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                描述
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="请输入分组描述（可选）"
                rows={4}
                className={`w-full max-w-md px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.description
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-blue-500'
                }`}
                data-testid="description-input"
                disabled={state.submitting}
                maxLength={500}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600" data-testid="description-error">
                  {errors.description}
                </p>
              )}
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={state.submitting}
              data-testid="cancel-button"
            >
              取消
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={state.submitting}
              data-testid="submit-button"
            >
              {state.submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {isEdit ? '保存' : '创建'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default HostGroupFormPage
