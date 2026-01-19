/**
 * 告警渠道配置表单组件
 * 支持钉钉机器人和邮箱两种告警渠道
 */
import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Send, Copy, RotateCcw, Info, Eye, EyeOff } from 'lucide-react'
import { Input } from '../../../components/Form'
import { toast } from '../../../components/Toast'
import { alertChannelService } from '../../../services/monitor'
import type { AlertChannel, DingTalkConfig, EmailConfig, AlertChannelType } from '../../../types/monitor'
import clsx from 'clsx'

// 默认钉钉告警模板
const DEFAULT_DINGTALK_TEMPLATE = `### {{severity_emoji}} {{title}}

**告警规则:** {{rule_name}}

**主机名称:** {{host_name}}

**监控指标:** {{metric_type}}

**当前值:** {{current_value}}{{unit}}

**阈值:** {{condition}} {{threshold_value}}{{unit}}

**严重级别:** {{severity}}

**触发时间:** {{triggered_at}}

---

**告警描述:** {{message}}

---
*发送时间: {{send_time}}*
*此消息由 MiTong运维平台 自动发送*`

// 模板变量说明
const TEMPLATE_VARIABLES = [
  { name: '{{title}}', desc: '告警标题' },
  { name: '{{rule_name}}', desc: '告警规则名称' },
  { name: '{{host_name}}', desc: '主机名称' },
  { name: '{{metric_type}}', desc: '监控指标类型' },
  { name: '{{current_value}}', desc: '当前监控值' },
  { name: '{{threshold_value}}', desc: '阈值' },
]

const TEMPLATE_VARIABLES_MORE = [
  { name: '{{unit}}', desc: '单位（%或空）' },
  { name: '{{condition}}', desc: '条件操作符' },
  { name: '{{severity}}', desc: '严重级别' },
  { name: '{{severity_emoji}}', desc: '严重级别表情' },
  { name: '{{triggered_at}}', desc: '触发时间' },
  { name: '{{send_time}}', desc: '发送时间' },
  { name: '{{message}}', desc: '告警描述信息' },
]

interface FormState {
  loading: boolean
  submitting: boolean
  testing: boolean
  showSecret: boolean
  activeTab: 'basic' | 'at' | 'template'
  formData: {
    name: string
    type: AlertChannelType
    description: string
    status: boolean
    // 钉钉配置
    webhook_url: string
    robot_name: string
    security_type: 'none' | 'keyword' | 'signature' | 'ip'
    secret: string
    keywords: string
    at_mobiles: string
    at_all: boolean
    message_template: string
    // 邮箱配置
    smtp_server: string
    smtp_port: string
    username: string
    password: string
    from_email: string
    to_emails: string
    use_tls: boolean
    use_ssl: boolean
  }
  errors: Record<string, string>
}

export const ChannelForm: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id

  const [state, setState] = useState<FormState>({
    loading: false,
    submitting: false,
    testing: false,
    showSecret: false,
    activeTab: 'basic',
    formData: {
      name: '',
      type: 'dingtalk',
      description: '',
      status: true,
      webhook_url: '',
      robot_name: '',
      security_type: 'signature',
      secret: '',
      keywords: '',
      at_mobiles: '',
      at_all: false,
      message_template: DEFAULT_DINGTALK_TEMPLATE,
      smtp_server: '',
      smtp_port: '587',
      username: '',
      password: '',
      from_email: '',
      to_emails: '',
      use_tls: true,
      use_ssl: false,
    },
    errors: {}
  })

  // 加载渠道数据（编辑模式）
  useEffect(() => {
    if (isEdit) {
      loadChannel()
    }
  }, [id])

  const loadChannel = async () => {
    if (!id) return
    setState(prev => ({ ...prev, loading: true }))
    try {
      const response = await alertChannelService.getById(parseInt(id))
      if (response.success && response.data) {
        const channel = response.data
        const config = channel.config as DingTalkConfig | EmailConfig
        
        setState(prev => ({
          ...prev,
          formData: {
            ...prev.formData,
            name: channel.name,
            type: channel.type,
            description: channel.description || '',
            status: channel.status === 1,
            ...(channel.type === 'dingtalk' ? {
              webhook_url: (config as DingTalkConfig).webhook_url || '',
              robot_name: (config as DingTalkConfig).name || '',
              security_type: (config as DingTalkConfig).security_type || 'signature',
              secret: (config as DingTalkConfig).secret || '',
              keywords: (config as DingTalkConfig).keywords?.join(',') || '',
              at_mobiles: (config as DingTalkConfig).at_mobiles?.join(',') || '',
              at_all: (config as DingTalkConfig).at_all || false,
              message_template: (config as DingTalkConfig).message_template || DEFAULT_DINGTALK_TEMPLATE,
            } : {
              smtp_server: (config as EmailConfig).smtp_server || '',
              smtp_port: String((config as EmailConfig).smtp_port || 587),
              username: (config as EmailConfig).username || '',
              password: (config as EmailConfig).password || '',
              from_email: (config as EmailConfig).from_email || '',
              to_emails: (config as EmailConfig).to_emails?.join(',') || '',
              use_tls: (config as EmailConfig).use_tls || false,
              use_ssl: (config as EmailConfig).use_ssl || false,
            })
          },
          loading: false
        }))
      }
    } catch (error) {
      console.error('加载渠道信息失败:', error)
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  // 处理字段变化
  const handleFieldChange = (field: string, value: any) => {
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, [field]: value },
      errors: { ...prev.errors, [field]: '' }
    }))
  }

  // 处理渠道类型变更
  const handleTypeChange = (value: AlertChannelType) => {
    setState(prev => ({
      ...prev,
      formData: {
        ...prev.formData,
        type: value,
        message_template: value === 'dingtalk' ? DEFAULT_DINGTALK_TEMPLATE : '',
      }
    }))
  }

  // 验证表单
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    const { formData } = state

    if (!formData.name.trim()) {
      errors.name = '渠道名称不能为空'
    }

    if (formData.type === 'dingtalk') {
      if (!formData.webhook_url.trim()) {
        errors.webhook_url = 'Webhook URL不能为空'
      } else if (!formData.webhook_url.startsWith('https://oapi.dingtalk.com/robot/send')) {
        errors.webhook_url = 'URL必须以 https://oapi.dingtalk.com/robot/send 开头'
      }
      if (formData.security_type === 'signature' && !formData.secret.trim()) {
        errors.secret = '使用加签安全设置时需要输入签名密钥'
      }
      if (formData.security_type === 'keyword' && !formData.keywords.trim()) {
        errors.keywords = '使用关键词安全设置时需要输入关键词'
      }
    } else {
      if (!formData.smtp_server.trim()) errors.smtp_server = 'SMTP服务器不能为空'
      if (!formData.username.trim()) errors.username = '用户名不能为空'
      if (!formData.password.trim()) errors.password = '密码不能为空'
      if (!formData.from_email.trim()) errors.from_email = '发件人邮箱不能为空'
      if (!formData.to_emails.trim()) errors.to_emails = '收件人邮箱不能为空'
    }

    setState(prev => ({ ...prev, errors }))
    return Object.keys(errors).length === 0
  }

  // 构建配置对象
  const buildConfig = (): DingTalkConfig | EmailConfig => {
    const { formData } = state
    if (formData.type === 'dingtalk') {
      const config: DingTalkConfig = {
        webhook_url: formData.webhook_url,
        name: formData.robot_name || undefined,
        security_type: formData.security_type,
        message_template: formData.message_template || DEFAULT_DINGTALK_TEMPLATE,
        at_all: formData.at_all,
      }
      if (formData.security_type === 'signature' && formData.secret) {
        config.secret = formData.secret
      }
      if (formData.security_type === 'keyword' && formData.keywords) {
        config.keywords = formData.keywords.split(',').map(k => k.trim()).filter(Boolean)
      }
      if (formData.at_mobiles) {
        config.at_mobiles = formData.at_mobiles.split(',').map(m => m.trim()).filter(Boolean)
      }
      return config
    } else {
      return {
        smtp_server: formData.smtp_server,
        smtp_port: parseInt(formData.smtp_port),
        username: formData.username,
        password: formData.password,
        from_email: formData.from_email,
        to_emails: formData.to_emails.split(',').map(e => e.trim()).filter(Boolean),
        use_tls: formData.use_tls,
        use_ssl: formData.use_ssl,
      }
    }
  }

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setState(prev => ({ ...prev, submitting: true }))
    try {
      const data = {
        name: state.formData.name,
        type: state.formData.type,
        config: buildConfig(),
        description: state.formData.description,
        status: state.formData.status ? 1 : 0,
      }

      if (isEdit) {
        await alertChannelService.update(parseInt(id!), data)
        toast.success('保存成功', '告警渠道配置已更新')
      } else {
        await alertChannelService.create(data)
        toast.success('创建成功', '告警渠道已创建')
      }
      navigate('/monitor/channels/list')
    } catch (error: any) {
      console.error('操作失败:', error)
      toast.error('操作失败', error.message || '请检查配置后重试')
    } finally {
      setState(prev => ({ ...prev, submitting: false }))
    }
  }

  // 测试渠道连接
  const handleTest = async () => {
    if (!isEdit) {
      toast.warning('提示', '请先保存渠道配置后再测试')
      return
    }
    setState(prev => ({ ...prev, testing: true }))
    try {
      const response = await alertChannelService.testChannel(parseInt(id!))
      if (response.success) {
        toast.testSuccess(
          '测试消息发送成功！',
          state.formData.type === 'dingtalk' 
            ? '请检查钉钉群是否收到机器人发送的测试消息' 
            : '请检查收件人邮箱是否收到测试邮件'
        )
      } else {
        toast.error('测试失败', response.message || '未知错误')
      }
    } catch (error: any) {
      toast.error('测试失败', error.message || '请检查渠道配置是否正确')
    } finally {
      setState(prev => ({ ...prev, testing: false }))
    }
  }

  // 复制模板变量
  const copyVariable = (variable: string) => {
    navigator.clipboard.writeText(variable)
    toast.info('已复制', variable)
  }

  // 重置为默认模板
  const resetTemplate = () => {
    handleFieldChange('message_template', DEFAULT_DINGTALK_TEMPLATE)
  }

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
          onClick={() => navigate('/monitor/channels/list')}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-900">
            {isEdit ? '编辑告警渠道' : '创建告警渠道'}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            配置钉钉机器人或邮箱告警通知渠道
          </p>
        </div>
        <div className="flex space-x-3">
          {isEdit && (
            <button
              onClick={handleTest}
              disabled={state.testing}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {state.testing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              测试连接
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={state.submitting}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {state.submitting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isEdit ? '保存修改' : '创建渠道'}
          </button>
        </div>
      </div>

      {/* 表单内容 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：基本信息 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                渠道名称 <span className="text-red-500">*</span>
              </label>
              <Input
                value={state.formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="例如：运维告警钉钉群"
                error={state.errors.name}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                渠道类型 <span className="text-red-500">*</span>
              </label>
              <select
                value={state.formData.type}
                onChange={(e) => handleTypeChange(e.target.value as AlertChannelType)}
                disabled={isEdit}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="dingtalk">钉钉机器人</option>
                <option value="email">邮箱</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
              <textarea
                value={state.formData.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                placeholder="渠道用途描述（可选）"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="status"
                checked={state.formData.status}
                onChange={(e) => handleFieldChange('status', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="status" className="ml-2 text-sm text-gray-700">启用渠道</label>
            </div>
          </div>
        </div>

        {/* 右侧：渠道配置 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">渠道配置</h2>
          
          {state.formData.type === 'dingtalk' ? (
            <>
              {/* 钉钉配置标签页 */}
              <div className="border-b border-gray-200 mb-4">
                <nav className="-mb-px flex space-x-8">
                  {(['basic', 'at', 'template'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setState(prev => ({ ...prev, activeTab: tab }))}
                      className={clsx(
                        'py-2 px-1 border-b-2 font-medium text-sm',
                        state.activeTab === tab
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      )}
                    >
                      {tab === 'basic' ? '基础配置' : tab === 'at' ? '@设置' : '告警模板'}
                    </button>
                  ))}
                </nav>
              </div>

              {/* 基础配置 */}
              {state.activeTab === 'basic' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Webhook URL <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={state.formData.webhook_url}
                      onChange={(e) => handleFieldChange('webhook_url', e.target.value)}
                      placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxx"
                      error={state.errors.webhook_url}
                    />
                    <p className="text-xs text-gray-500 mt-1">从钉钉机器人设置中获取的Webhook地址</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">机器人名称</label>
                    <Input
                      value={state.formData.robot_name}
                      onChange={(e) => handleFieldChange('robot_name', e.target.value)}
                      placeholder="运维告警机器人"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      安全设置 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={state.formData.security_type}
                      onChange={(e) => handleFieldChange('security_type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="signature">加签（推荐）</option>
                      <option value="keyword">自定义关键词</option>
                      <option value="ip">IP地址（段）</option>
                      <option value="none">无</option>
                    </select>
                  </div>

                  {state.formData.security_type === 'signature' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        签名密钥 <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={state.showSecret ? 'text' : 'password'}
                          value={state.formData.secret}
                          onChange={(e) => handleFieldChange('secret', e.target.value)}
                          placeholder="SECxxxxxxxxxxxxxxxxxxxxxxxx"
                          className={clsx(
                            'w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
                            state.errors.secret ? 'border-red-500' : 'border-gray-300'
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setState(prev => ({ ...prev, showSecret: !prev.showSecret }))}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          {state.showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {state.errors.secret && <p className="text-xs text-red-500 mt-1">{state.errors.secret}</p>}
                      <p className="text-xs text-gray-500 mt-1">以SEC开头的密钥，从钉钉机器人安全设置中获取</p>
                    </div>
                  )}

                  {state.formData.security_type === 'keyword' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        关键词 <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={state.formData.keywords}
                        onChange={(e) => handleFieldChange('keywords', e.target.value)}
                        placeholder="告警,警告,异常"
                        error={state.errors.keywords}
                      />
                      <p className="text-xs text-gray-500 mt-1">多个关键词用逗号分隔</p>
                    </div>
                  )}
                </div>
              )}

              {/* @设置 */}
              {state.activeTab === 'at' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">@指定成员</label>
                    <Input
                      value={state.formData.at_mobiles}
                      onChange={(e) => handleFieldChange('at_mobiles', e.target.value)}
                      placeholder="13800138000,13900139000"
                    />
                    <p className="text-xs text-gray-500 mt-1">输入手机号，多个用逗号分隔</p>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="at_all"
                      checked={state.formData.at_all}
                      onChange={(e) => handleFieldChange('at_all', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="at_all" className="ml-2 text-sm text-gray-700">@所有人</label>
                  </div>
                </div>
              )}

              {/* 告警模板 */}
              {state.activeTab === 'template' && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-md">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-medium text-blue-800">模板变量说明</h4>
                        <p className="text-xs text-blue-600 mt-1">点击变量可复制到剪贴板</p>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {[...TEMPLATE_VARIABLES, ...TEMPLATE_VARIABLES_MORE].map(v => (
                            <button
                              key={v.name}
                              onClick={() => copyVariable(v.name)}
                              className="flex items-center text-left text-xs"
                            >
                              <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-800 hover:bg-blue-200 cursor-pointer">
                                {v.name}
                              </code>
                              <span className="ml-1 text-gray-500 truncate">{v.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">消息模板</label>
                      <button
                        type="button"
                        onClick={resetTemplate}
                        className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        重置为默认
                      </button>
                    </div>
                    <textarea
                      value={state.formData.message_template}
                      onChange={(e) => handleFieldChange('message_template', e.target.value)}
                      placeholder="输入告警消息模板，支持Markdown格式"
                      rows={12}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            /* 邮箱配置 */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP服务器 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={state.formData.smtp_server}
                    onChange={(e) => handleFieldChange('smtp_server', e.target.value)}
                    placeholder="smtp.example.com"
                    error={state.errors.smtp_server}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SMTP端口</label>
                  <Input
                    type="number"
                    value={state.formData.smtp_port}
                    onChange={(e) => handleFieldChange('smtp_port', e.target.value)}
                    placeholder="587"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  用户名 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={state.formData.username}
                  onChange={(e) => handleFieldChange('username', e.target.value)}
                  placeholder="your-email@example.com"
                  error={state.errors.username}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  密码/授权码 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="password"
                  value={state.formData.password}
                  onChange={(e) => handleFieldChange('password', e.target.value)}
                  placeholder="邮箱密码或授权码"
                  error={state.errors.password}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  发件人邮箱 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={state.formData.from_email}
                  onChange={(e) => handleFieldChange('from_email', e.target.value)}
                  placeholder="alerts@example.com"
                  error={state.errors.from_email}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  收件人邮箱 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={state.formData.to_emails}
                  onChange={(e) => handleFieldChange('to_emails', e.target.value)}
                  placeholder="admin@example.com,ops@example.com"
                  error={state.errors.to_emails}
                />
                <p className="text-xs text-gray-500 mt-1">多个邮箱用逗号分隔</p>
              </div>

              <div className="flex space-x-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="use_tls"
                    checked={state.formData.use_tls}
                    onChange={(e) => handleFieldChange('use_tls', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="use_tls" className="ml-2 text-sm text-gray-700">使用TLS</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="use_ssl"
                    checked={state.formData.use_ssl}
                    onChange={(e) => handleFieldChange('use_ssl', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="use_ssl" className="ml-2 text-sm text-gray-700">使用SSL</label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
