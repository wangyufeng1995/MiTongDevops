/**
 * 创建 Ansible Playbook 页面 - 美化版
 */
import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, FileText, Save, X, AlertCircle, CheckCircle, Code, Settings, FileCode, Sparkles
} from 'lucide-react'
import PlaybookEditor from '../../components/Ansible/PlaybookEditor'
import { ansibleService } from '../../services/ansible'
import { useTheme } from '../../hooks/useTheme'
import { MonitorPageLayout, MonitorContentCard, ConfirmDialog, useConfirmDialog } from '../../components/Monitor'
import { FormCard, FormInput, TextInput, TextArea, ActionButton, StatusBadge } from '../../components/Monitor/FormCard'
import type { AnsiblePlaybook, CreatePlaybookRequest } from '../../types/ansible'

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

const PlaybookCreate: React.FC = () => {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const confirmDialog = useConfirmDialog()
  
  const [formData, setFormData] = useState<FormData>({
    name: '', description: '', content: '', variables: '{}', version: '1.0'
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isContentValid, setIsContentValid] = useState(true)
  const [contentErrors, setContentErrors] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState(false)

  const handleFieldChange = useCallback((field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }, [errors])

  const handleContentValidate = useCallback((isValid: boolean, validationErrors?: string[]) => {
    setIsContentValid(isValid)
    setContentErrors(validationErrors || [])
  }, [])

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {}
    if (!formData.name.trim()) newErrors.name = 'Playbook 名称不能为空'
    else if (formData.name.length > 100) newErrors.name = '名称不能超过 100 个字符'
    if (!formData.content.trim()) newErrors.content = 'Playbook 内容不能为空'
    else if (!isContentValid) newErrors.content = 'Playbook 内容语法错误'
    if (formData.variables.trim()) {
      try { JSON.parse(formData.variables) }
      catch { newErrors.variables = '变量格式必须是有效的 JSON' }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData, isContentValid])

  const handleSave = useCallback(async () => {
    if (!validateForm()) return
    try {
      setIsSubmitting(true)
      setErrors({})
      let variables: Record<string, any> = {}
      if (formData.variables.trim()) {
        try { variables = JSON.parse(formData.variables) }
        catch { setErrors({ variables: '变量格式必须是有效的 JSON' }); return }
      }
      const createData: CreatePlaybookRequest = {
        name: formData.name,
        description: formData.description || undefined,
        content: formData.content,
        variables: Object.keys(variables).length > 0 ? variables : undefined,
        version: formData.version
      }
      const result = await ansibleService.createPlaybook(createData)
      navigate(`/hostoperate/ansible/playbooks/${result.id}/edit`)
    } catch (error) {
      setErrors({ general: error instanceof Error ? error.message : '保存失败' })
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, validateForm, navigate])

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
    
    - name: Install packages
      package:
        name:
          - curl
          - wget
        state: present
  
  handlers:
    - name: restart service
      service:
        name: example-service
        state: restarted`
  }, [])

  const handleLoadTemplate = useCallback(() => {
    confirmDialog.show({
      title: '加载默认模板',
      message: (
        <div className="space-y-4">
          <p>确定要加载默认 Playbook 模板吗？</p>
          <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-700/50 border border-slate-600/50' : 'bg-blue-50 border border-blue-200'}`}>
            <div className="flex items-start space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                <Sparkles className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
              </div>
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>模板包含内容</p>
                <ul className={`mt-1 text-sm space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  <li>• 基础 Play 结构</li>
                  <li>• 变量定义示例</li>
                  <li>• 常用任务示例</li>
                  <li>• Handler 示例</li>
                </ul>
              </div>
            </div>
          </div>
          {formData.content && (
            <p className={`text-sm ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
              ⚠️ 当前编辑器中的内容将被覆盖
            </p>
          )}
        </div>
      ),
      confirmText: '加载模板',
      variant: 'info',
      onConfirm: () => {
        setFormData(prev => ({ ...prev, content: getDefaultTemplate() }))
      }
    })
  }, [getDefaultTemplate, confirmDialog, isDark, formData.content])

  const headerActions = (
    <div className="flex items-center space-x-3">
      <button
        onClick={() => navigate('/hostoperate/ansible/playbooks')}
        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
          isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <ArrowLeft className="w-4 h-4" />
        <span>返回列表</span>
      </button>
    </div>
  )

  return (
    <MonitorPageLayout
      title="创建 Ansible Playbook"
      subtitle="创建新的自动化运维脚本"
      icon={FileText}
      iconGradient="from-blue-500 via-indigo-500 to-purple-500"
      headerActions={headerActions}
      showRefresh={false}
      showFullscreen={false}
    >
      {/* 错误提示 */}
      {errors.general && (
        <div className={`mb-6 p-4 rounded-xl border flex items-start space-x-3 ${
          isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
        }`}>
          <AlertCircle className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
          <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{errors.general}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：基本信息 */}
        <div className="space-y-6">
          <FormCard title="基本信息" icon={Settings}>
            <div className="space-y-4">
              <FormInput label="Playbook 名称" required error={errors.name}>
                <TextInput
                  value={formData.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="输入 Playbook 名称"
                  error={!!errors.name}
                />
              </FormInput>

              <FormInput label="描述">
                <TextArea
                  value={formData.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="输入 Playbook 描述"
                  rows={3}
                />
              </FormInput>

              <FormInput label="版本">
                <TextInput
                  value={formData.version}
                  onChange={(e) => handleFieldChange('version', e.target.value)}
                  placeholder="1.0"
                />
              </FormInput>
            </div>
          </FormCard>

          <FormCard title="默认变量" subtitle="JSON 格式" icon={Code}>
            <div className="space-y-4">
              <FormInput label="变量配置" error={errors.variables} hint="自定义变量将在执行时使用">
                <TextArea
                  value={formData.variables}
                  onChange={(e) => handleFieldChange('variables', e.target.value)}
                  placeholder='{"key": "value"}'
                  rows={6}
                  error={!!errors.variables}
                  className="font-mono text-sm"
                />
              </FormInput>

              <ActionButton variant="secondary" onClick={handleLoadTemplate} className="w-full">
                <FileCode className="w-4 h-4" />
                加载默认模板
              </ActionButton>
            </div>
          </FormCard>

          {/* 验证状态 */}
          <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-gray-50 border border-gray-100'}`}>
            <div className="flex items-center space-x-2 mb-2">
              {isContentValid ? (
                <>
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  <span className={`text-sm font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>语法验证通过</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span className={`text-sm font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>语法验证失败</span>
                </>
              )}
            </div>
            {!isContentValid && contentErrors.length > 0 && (
              <ul className={`text-sm space-y-1 ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                {contentErrors.map((error, i) => <li key={i}>• {error}</li>)}
              </ul>
            )}
          </div>
        </div>

        {/* 右侧：编辑器 */}
        <div className="lg:col-span-2">
          <FormCard
            title="Playbook 内容"
            icon={FileText}
            headerActions={
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {showPreview ? '编辑模式' : '预览模式'}
              </button>
            }
            noPadding
          >
            {errors.content && (
              <div className={`px-4 py-2 border-b ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-600'}`}>
                <p className="text-sm">{errors.content}</p>
              </div>
            )}
            
            {showPreview ? (
              <div className={`p-4 font-mono text-sm overflow-auto ${isDark ? 'bg-slate-900 text-gray-300' : 'bg-gray-900 text-gray-100'}`} style={{ height: '500px' }}>
                <pre className="whitespace-pre-wrap">{formData.content || '// 暂无内容'}</pre>
              </div>
            ) : (
              <PlaybookEditor
                value={formData.content}
                onChange={(content) => handleFieldChange('content', content)}
                onValidate={handleContentValidate}
                height="500px"
                showToolbar={true}
                showMinimap={true}
              />
            )}
          </FormCard>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className={`mt-6 p-4 rounded-xl flex items-center justify-end space-x-3 ${
        isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-gray-50 border border-gray-100'
      }`}>
        <ActionButton variant="secondary" onClick={() => navigate('/hostoperate/ansible/playbooks')}>
          <X className="w-4 h-4" />
          取消
        </ActionButton>
        <ActionButton
          variant="primary"
          onClick={handleSave}
          loading={isSubmitting}
          disabled={!isContentValid}
        >
          <Save className="w-4 h-4" />
          {isSubmitting ? '保存中...' : '保存'}
        </ActionButton>
      </div>

      {/* 确认对话框 */}
      <ConfirmDialog {...confirmDialog.dialogProps} />
    </MonitorPageLayout>
  )
}

export default PlaybookCreate
