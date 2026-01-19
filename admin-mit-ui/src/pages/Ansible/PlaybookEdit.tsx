/**
 * 编辑 Ansible Playbook 页面 - 美化版
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { 
  ArrowLeft, FileText, Save, AlertCircle, CheckCircle, Settings, 
  FileCode, Sparkles, Play, Clock
} from 'lucide-react'
import PlaybookEditor from '../../components/Ansible/PlaybookEditor'
import { ansibleService } from '../../services/ansible'
import { useTheme } from '../../hooks/useTheme'
import { MonitorPageLayout, ConfirmDialog, useConfirmDialog } from '../../components/Monitor'
import { FormCard, FormInput, TextInput, TextArea, ActionButton } from '../../components/Monitor/FormCard'
import { Loading } from '../../components/Loading'
import { formatDateTime } from '../../utils'
import type { AnsiblePlaybook } from '../../types/ansible'

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

const PlaybookEdit: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { isDark } = useTheme()
  const confirmDialog = useConfirmDialog()
  
  const [playbook, setPlaybook] = useState<AnsiblePlaybook | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<FormData>({
    name: '', description: '', content: '', variables: '{}', version: '1.0'
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isContentValid, setIsContentValid] = useState(true)
  const [contentErrors, setContentErrors] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // 加载 Playbook 详情
  useEffect(() => {
    const loadPlaybook = async () => {
      if (!id) { setError('无效的 Playbook ID'); setLoading(false); return }
      try {
        setLoading(true)
        const data = await ansibleService.getPlaybook(Number(id))
        setPlaybook(data)
        setFormData({
          name: data.name || '',
          description: data.description || '',
          content: data.content || '',
          variables: data.variables ? JSON.stringify(data.variables, null, 2) : '{}',
          version: data.version || '1.0'
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载 Playbook 失败')
      } finally {
        setLoading(false)
      }
    }
    loadPlaybook()
  }, [id])

  const handleFieldChange = useCallback((field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }, [errors])

  // 验证内容
  useEffect(() => {
    const validateContent = async () => {
      if (!formData.content.trim()) { setIsContentValid(true); setContentErrors([]); return }
      try {
        const result = await ansibleService.validatePlaybook(formData.content)
        setIsContentValid(result.valid)
        setContentErrors(result.errors || [])
      } catch { setIsContentValid(false); setContentErrors(['验证服务不可用']) }
    }
    const timer = setTimeout(validateContent, 500)
    return () => clearTimeout(timer)
  }, [formData.content])

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}
    if (!formData.name.trim()) newErrors.name = '请输入 Playbook 名称'
    if (!formData.content.trim()) newErrors.content = '请输入 Playbook 内容'
    if (formData.variables.trim()) {
      try { JSON.parse(formData.variables) } catch { newErrors.variables = '变量格式错误，请输入有效的 JSON' }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm() || !isContentValid || !playbook) return
    try {
      setIsSubmitting(true)
      let variables = {}
      if (formData.variables.trim()) { try { variables = JSON.parse(formData.variables) } catch {} }
      await ansibleService.updatePlaybook(playbook.id, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        content: formData.content,
        variables
      })
      navigate('/hostoperate/ansible/playbooks')
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : '保存失败' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getDefaultTemplate = useCallback(() => {
    return `- name: Example Playbook
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
                </ul>
              </div>
            </div>
          </div>
          <p className={`text-sm ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>⚠️ 当前编辑器中的内容将被覆盖</p>
        </div>
      ),
      confirmText: '加载模板',
      variant: 'info',
      onConfirm: () => { setFormData(prev => ({ ...prev, content: getDefaultTemplate() })); setHasChanges(true) }
    })
  }, [getDefaultTemplate, confirmDialog, isDark])

  if (loading) return (<div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}><Loading /></div>)

  if (error || !playbook) return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className={`p-6 rounded-2xl ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <h3 className={`font-medium ${isDark ? 'text-red-300' : 'text-red-800'}`}>加载失败</h3>
              <p className={`text-sm mt-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error || 'Playbook 不存在'}</p>
            </div>
          </div>
          <button onClick={() => navigate('/hostoperate/ansible/playbooks')} className="mt-4 text-sm text-red-600 hover:text-red-800">返回 Playbook 列表</button>
        </div>
      </div>
    </div>
  )

  const headerActions = (
    <div className="flex items-center space-x-3">
      <button onClick={() => navigate(`/hostoperate/ansible/playbooks/${playbook.id}/execute`)} className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all ${isDark ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
        <Play className="w-4 h-4" /><span>执行</span>
      </button>
      <button onClick={() => navigate('/hostoperate/ansible/playbooks')} className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all ${isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
        <ArrowLeft className="w-4 h-4" /><span>返回列表</span>
      </button>
    </div>
  )

  return (
    <MonitorPageLayout
      title={`编辑 Playbook`}
      subtitle={playbook.name}
      icon={FileText}
      iconGradient="from-amber-500 via-orange-500 to-red-500"
      headerActions={headerActions}
      showRefresh={false}
      showFullscreen={false}
    >
      {errors.general && (
        <div className={`mb-6 p-4 rounded-xl border flex items-start space-x-3 ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
          <AlertCircle className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
          <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{errors.general}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：基本信息 */}
        <div className="space-y-6">
          {/* Playbook 信息卡片 */}
          <div className={`p-4 rounded-xl ${isDark ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20' : 'bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200'}`}>
            <div className="flex items-center space-x-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25`}>
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{playbook.name}</p>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>v{playbook.version}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className={`p-2 rounded-lg ${isDark ? 'bg-slate-800/50' : 'bg-white/50'}`}>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>执行次数</p>
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{playbook.execution_count || 0}</p>
              </div>
              <div className={`p-2 rounded-lg ${isDark ? 'bg-slate-800/50' : 'bg-white/50'}`}>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>更新时间</p>
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatDateTime(playbook.updated_at, 'MM-DD HH:mm')}</p>
              </div>
            </div>
          </div>

          <FormCard title="基本信息" icon={Settings}>
            <div className="space-y-4">
              <FormInput label="Playbook 名称" required error={errors.name}>
                <TextInput value={formData.name} onChange={(e) => handleFieldChange('name', e.target.value)} placeholder="输入 Playbook 名称" error={!!errors.name} />
              </FormInput>
              <FormInput label="描述">
                <TextArea value={formData.description} onChange={(e) => handleFieldChange('description', e.target.value)} placeholder="输入 Playbook 描述" rows={3} />
              </FormInput>
              <FormInput label="版本">
                <TextInput value={formData.version} onChange={(e) => handleFieldChange('version', e.target.value)} placeholder="1.0" disabled />
              </FormInput>
              <ActionButton variant="secondary" onClick={handleLoadTemplate} className="w-full">
                <FileCode className="w-4 h-4" />加载默认模板
              </ActionButton>
            </div>
          </FormCard>
        </div>

        {/* 右侧：编辑器 */}
        <div className="lg:col-span-2">
          <FormCard
            title="Playbook 内容"
            icon={FileText}
            headerActions={
              <div className="flex items-center space-x-2">
                {hasChanges && (
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
                    未保存
                  </span>
                )}
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {showPreview ? '编辑模式' : '预览模式'}
                </button>
              </div>
            }
            noPadding
          >
            <PlaybookEditor
              value={formData.content}
              onChange={(value) => handleFieldChange('content', value || '')}
              readOnly={showPreview}
              height="500px"
              showToolbar={true}
            />
          </FormCard>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className={`mt-6 flex items-center justify-between p-4 rounded-xl ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-gray-50 border border-gray-100'}`}>
        <div className="flex items-center space-x-6">
          {/* 验证状态 */}
          <div className="flex items-center space-x-2">
            {isContentValid ? (
              <><CheckCircle className="w-4 h-4 text-emerald-500" /><span className={`text-sm font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>语法验证通过</span></>
            ) : (
              <><AlertCircle className="w-4 h-4 text-red-500" /><span className={`text-sm font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>语法验证失败</span></>
            )}
          </div>
          <div className={`h-4 w-px ${isDark ? 'bg-slate-600' : 'bg-gray-300'}`} />
          <div className={`flex items-center space-x-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <Clock className="w-4 h-4" />
            <span>上次更新: {formatDateTime(playbook.updated_at, 'YYYY-MM-DD HH:mm:ss')}</span>
          </div>
          {hasChanges && (
            <span className={`text-sm ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>• 有未保存的更改</span>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <ActionButton variant="secondary" onClick={() => navigate('/hostoperate/ansible/playbooks')}>
            取消
          </ActionButton>
          <ActionButton variant="primary" onClick={handleSave} loading={isSubmitting} disabled={!isContentValid}>
            <Save className="w-4 h-4" />{isSubmitting ? '保存中...' : '保存更改'}
          </ActionButton>
        </div>
      </div>

      <ConfirmDialog {...confirmDialog.dialogProps} />
    </MonitorPageLayout>
  )
}

export default PlaybookEdit
