/**
 * Ansible Playbook 表单组件
 * 集成 PlaybookEditor 用于创建和编辑 Playbook
 */
import React, { useState, useCallback, useEffect } from 'react'
import { Save, X, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import PlaybookEditor from './PlaybookEditor'
import { Loading } from '../Loading'
import { ansibleService } from '../../services/ansible'
import {
  AnsiblePlaybook,
  CreatePlaybookRequest,
  UpdatePlaybookRequest
} from '../../types/ansible'

export interface PlaybookFormProps {
  playbook?: AnsiblePlaybook
  onSave?: (playbook: AnsiblePlaybook) => void
  onCancel?: () => void
  loading?: boolean
  className?: string
}

interface FormData {
  name: string
  description: string
  content: string
  variables: string
  version: string
}

interface FormErrors {
  name?: string
  content?: string
  variables?: string
  general?: string
}

const PlaybookForm: React.FC<PlaybookFormProps> = ({
  playbook,
  onSave,
  onCancel,
  loading = false,
  className = ''
}) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    content: '',
    variables: '{}',
    version: '1.0'
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isContentValid, setIsContentValid] = useState(true)
  const [contentErrors, setContentErrors] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState(false)

  // 初始化表单数据
  useEffect(() => {
    if (playbook) {
      setFormData({
        name: playbook.name,
        description: playbook.description || '',
        content: playbook.content,
        variables: JSON.stringify(playbook.variables || {}, null, 2),
        version: playbook.version
      })
    }
  }, [playbook])

  // 处理表单字段变化
  const handleFieldChange = useCallback((field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // 清除对应字段的错误
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }, [errors])

  // 处理编辑器内容变化
  const handleContentChange = useCallback((content: string) => {
    handleFieldChange('content', content)
  }, [handleFieldChange])

  // 处理编辑器验证
  const handleContentValidate = useCallback((isValid: boolean, validationErrors?: string[]) => {
    setIsContentValid(isValid)
    setContentErrors(validationErrors || [])
  }, [])

  // 验证表单
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    // 验证名称
    if (!formData.name.trim()) {
      newErrors.name = 'Playbook 名称不能为空'
    } else if (formData.name.length > 100) {
      newErrors.name = 'Playbook 名称不能超过 100 个字符'
    }

    // 验证内容
    if (!formData.content.trim()) {
      newErrors.content = 'Playbook 内容不能为空'
    } else if (!isContentValid) {
      newErrors.content = 'Playbook 内容语法错误'
    }

    // 验证变量
    if (formData.variables.trim()) {
      try {
        JSON.parse(formData.variables)
      } catch (error) {
        newErrors.variables = '变量格式必须是有效的 JSON'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData, isContentValid])

  // 处理保存
  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      return
    }

    try {
      setIsSubmitting(true)
      setErrors({})

      // 解析变量
      let variables: Record<string, any> = {}
      if (formData.variables.trim()) {
        try {
          variables = JSON.parse(formData.variables)
        } catch (error) {
          setErrors({ variables: '变量格式必须是有效的 JSON' })
          return
        }
      }

      let result: AnsiblePlaybook

      if (playbook) {
        // 更新现有 Playbook
        const updateData: UpdatePlaybookRequest = {
          name: formData.name,
          description: formData.description || undefined,
          content: formData.content,
          variables: Object.keys(variables).length > 0 ? variables : undefined,
          version: formData.version
        }
        result = await ansibleService.updatePlaybook(playbook.id, updateData)
      } else {
        // 创建新 Playbook
        const createData: CreatePlaybookRequest = {
          name: formData.name,
          description: formData.description || undefined,
          content: formData.content,
          variables: Object.keys(variables).length > 0 ? variables : undefined,
          version: formData.version
        }
        result = await ansibleService.createPlaybook(createData)
      }

      onSave?.(result)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '保存失败'
      setErrors({ general: errorMessage })
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, playbook, isContentValid, validateForm, onSave])

  // 处理取消
  const handleCancel = useCallback(() => {
    onCancel?.()
  }, [onCancel])

  // 获取默认 Playbook 模板
  const getDefaultTemplate = useCallback(() => {
    return `---
- name: Example Playbook
  hosts: all
  become: yes
  vars:
    example_var: "Hello World"
  
  tasks:
    - name: Print message
      debug:
        msg: "{{ example_var }}"
    
    - name: Update package cache
      package:
        update_cache: yes
      when: ansible_os_family == "Debian"
    
    - name: Install packages
      package:
        name:
          - curl
          - wget
          - vim
        state: present
    
    - name: Create directory
      file:
        path: /opt/example
        state: directory
        mode: '0755'
    
    - name: Copy configuration file
      template:
        src: config.j2
        dest: /opt/example/config.conf
        backup: yes
      notify: restart service
  
  handlers:
    - name: restart service
      service:
        name: example-service
        state: restarted`
  }, [])

  // 加载模板
  const handleLoadTemplate = useCallback(() => {
    const loadTemplate = () => {
      const template = getDefaultTemplate()
      setFormData(prev => ({ ...prev, content: template }))
    }
    
    if (formData.content && formData.content.trim()) {
      if (window.confirm('确定要加载默认模板吗？当前内容将被覆盖。')) {
        loadTemplate()
      }
    } else {
      loadTemplate()
    }
  }, [getDefaultTemplate, formData.content])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm ${className}`}>
      {/* 头部 */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText size={24} className="text-blue-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {playbook ? '编辑 Playbook' : '创建 Playbook'}
              </h2>
              <p className="text-sm text-gray-600">
                {playbook ? '修改现有的 Ansible Playbook' : '创建新的 Ansible Playbook'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {showPreview ? '编辑模式' : '预览模式'}
            </button>
          </div>
        </div>
      </div>

      {/* 表单内容 */}
      <div className="p-6">
        {/* 错误提示 */}
        {errors.general && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <AlertCircle size={16} className="text-red-400 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-red-700">{errors.general}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 基本信息 */}
          <div className="lg:col-span-1 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Playbook 名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="输入 Playbook 名称"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="输入 Playbook 描述"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                版本
              </label>
              <input
                type="text"
                value={formData.version}
                onChange={(e) => handleFieldChange('version', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="1.0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                默认变量 (JSON 格式)
              </label>
              <textarea
                value={formData.variables}
                onChange={(e) => handleFieldChange('variables', e.target.value)}
                rows={6}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm ${
                  errors.variables ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder='{"key": "value"}'
              />
              {errors.variables && (
                <p className="mt-1 text-sm text-red-600">{errors.variables}</p>
              )}
            </div>

            <div>
              <button
                type="button"
                onClick={handleLoadTemplate}
                className="w-full px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
              >
                加载默认模板
              </button>
            </div>

            {/* 验证状态 */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                {isContentValid ? (
                  <>
                    <CheckCircle size={16} className="text-green-500" />
                    <span className="text-sm text-green-700">语法验证通过</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} className="text-red-500" />
                    <span className="text-sm text-red-700">语法验证失败</span>
                  </>
                )}
              </div>
              {!isContentValid && contentErrors.length > 0 && (
                <div className="mt-2">
                  <ul className="text-sm text-red-600">
                    {contentErrors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Playbook 编辑器 */}
          <div className="lg:col-span-2">
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Playbook 内容 <span className="text-red-500">*</span>
              </label>
              {errors.content && (
                <p className="mt-1 text-sm text-red-600">{errors.content}</p>
              )}
            </div>
            
            {showPreview ? (
              <div className="border border-gray-300 rounded-lg">
                <div className="p-4 bg-gray-50 border-b border-gray-300">
                  <h3 className="text-sm font-medium text-gray-700">预览模式</h3>
                </div>
                <div className="p-4 bg-gray-900 text-gray-100 font-mono text-sm overflow-auto" style={{ height: '500px' }}>
                  <pre className="whitespace-pre-wrap">{formData.content}</pre>
                </div>
              </div>
            ) : (
              <PlaybookEditor
                value={formData.content}
                onChange={handleContentChange}
                onValidate={handleContentValidate}
                height="500px"
                showToolbar={true}
                showMinimap={true}
                className="border border-gray-300 rounded-lg overflow-hidden"
              />
            )}
          </div>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isSubmitting}
          >
            <X size={16} className="mr-2" />
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting || !isContentValid}
          >
            {isSubmitting ? (
              <Loading size="sm" className="mr-2" />
            ) : (
              <Save size={16} className="mr-2" />
            )}
            {isSubmitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PlaybookForm