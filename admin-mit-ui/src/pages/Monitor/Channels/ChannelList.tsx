/**
 * 告警渠道列表 - 美化版
 */
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, Edit, Trash2, TestTube, Mail, MessageSquare, AlertCircle, X, Save, Send, RotateCcw, Bell, Zap, Inbox } from 'lucide-react'
import { DataTable, Column, PaginationConfig } from '../../../components/Table'
import { SearchForm, SearchField, Input } from '../../../components/Form'
import { toast } from '../../../components/Toast'
import { alertChannelService } from '../../../services/monitor'
import { AlertChannel, AlertChannelType, AlertChannelQueryParams, DingTalkConfig, EmailConfig } from '../../../types/monitor'
import { formatDateTime } from '../../../utils'
import { useTheme } from '../../../hooks/useTheme'
import { MonitorPageLayout, MonitorContentCard } from '../../../components/Monitor/MonitorPageLayout'
import clsx from 'clsx'

// 统计卡片组件 - 紧凑版
const StatCard: React.FC<{
  title: string; value: number; icon: React.ElementType; gradient: string; isDark: boolean
}> = ({ title, value, icon: Icon, gradient, isDark }) => (
  <div className={clsx('group relative rounded-xl p-4 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5',
    isDark ? 'bg-slate-800/80 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-md')}>
    <div className="flex items-center justify-between">
      <div>
        <p className={clsx('text-xs font-medium', isDark ? 'text-slate-400' : 'text-gray-500')}>{title}</p>
        <p className={clsx('text-2xl font-bold mt-1', isDark ? 'text-white' : 'text-gray-900')}>{value}</p>
      </div>
      <div className={clsx('p-2.5 rounded-xl bg-gradient-to-br', gradient)}>
        <Icon className="w-4 h-4 text-white" />
      </div>
    </div>
  </div>
)

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

const initialFormData = {
  name: '', type: 'dingtalk' as AlertChannelType, description: '', status: true, webhook_url: '',
  robot_name: '', security_type: 'signature' as 'none' | 'keyword' | 'signature' | 'ip', secret: '', keywords: '', at_mobiles: '',
  at_all: false, message_template: DEFAULT_DINGTALK_TEMPLATE, smtp_server: '', smtp_port: '587',
  username: '', password: '', from_email: '', to_emails: '', use_tls: true, use_ssl: false,
}

export const ChannelList: React.FC = () => {
  const { isDark } = useTheme()
  const abortControllerRef = useRef<AbortController | null>(null)
  
  const [state, setState] = useState({
    channels: [] as AlertChannel[], loading: false, total: 0, current: 1, pageSize: 10,
    searchParams: {} as AlertChannelQueryParams, testingChannels: new Set<number>()
  })

  const [modal, setModal] = useState({
    visible: false, mode: 'create' as 'create' | 'edit', loading: false, submitting: false, testing: false,
    showSecret: false, activeTab: 'basic' as 'basic' | 'at' | 'template', channelId: null as number | null,
    formData: { ...initialFormData }, errors: {} as Record<string, string>
  })

  const searchFields: SearchField[] = [
    { name: 'search', label: '关键词', type: 'text', placeholder: '搜索渠道名称或描述' },
    { name: 'type', label: '渠道类型', type: 'select', options: [{ label: '全部类型', value: '' }, { label: '邮箱', value: 'email' }, { label: '钉钉机器人', value: 'dingtalk' }] },
    { name: 'status', label: '状态', type: 'select', options: [{ label: '全部状态', value: '' }, { label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
  ]

  const loadChannels = async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    abortControllerRef.current = new AbortController()
    setState(prev => ({ ...prev, loading: true }))
    try {
      const response = await alertChannelService.getChannels({ page: state.current, per_page: state.pageSize, ...state.searchParams })
      if (response.success) setState(prev => ({ ...prev, channels: response.data.items || [], total: response.data.total || 0, loading: false }))
    } catch (error: any) { if (error?.name !== 'AbortError') setState(prev => ({ ...prev, loading: false })) }
  }

  const searchParamsKey = useMemo(() => JSON.stringify(state.searchParams), [state.searchParams])
  const handleSearch = (params: Record<string, any>) => {
    const filteredParams = Object.entries(params).reduce((acc, [key, value]) => { if (value !== '' && value !== null && value !== undefined) acc[key] = value; return acc }, {} as Record<string, any>)
    setState(prev => ({ ...prev, searchParams: filteredParams, current: 1 }))
  }
  const handlePaginationChange = (page: number, pageSize: number) => setState(prev => ({ ...prev, current: page, pageSize }))

  const openCreateModal = () => setModal({ visible: true, mode: 'create', loading: false, submitting: false, testing: false, showSecret: false, activeTab: 'basic', channelId: null, formData: { ...initialFormData }, errors: {} })

  const openEditModal = async (channel: AlertChannel) => {
    setModal(prev => ({ ...prev, visible: true, mode: 'edit', loading: true, channelId: channel.id }))
    try {
      const response = await alertChannelService.getById(channel.id)
      if (response.success && response.data) {
        const ch = response.data; const config = ch.config as DingTalkConfig | EmailConfig
        setModal(prev => ({
          ...prev, loading: false,
          formData: {
            ...initialFormData, name: ch.name, type: ch.type, description: ch.description || '', status: ch.status === 1,
            ...(ch.type === 'dingtalk' ? {
              webhook_url: (config as DingTalkConfig).webhook_url || '', robot_name: (config as DingTalkConfig).name || '',
              security_type: (config as DingTalkConfig).security_type || 'signature', secret: (config as DingTalkConfig).secret || '',
              keywords: (config as DingTalkConfig).keywords?.join(',') || '', at_mobiles: (config as DingTalkConfig).at_mobiles?.join(',') || '',
              at_all: (config as DingTalkConfig).at_all || false, message_template: (config as DingTalkConfig).message_template || DEFAULT_DINGTALK_TEMPLATE,
            } : {
              smtp_server: (config as EmailConfig).smtp_server || '', smtp_port: String((config as EmailConfig).smtp_port || 587),
              username: (config as EmailConfig).username || '', password: (config as EmailConfig).password || '',
              from_email: (config as EmailConfig).from_email || '', to_emails: (config as EmailConfig).to_emails?.join(',') || '',
              use_tls: (config as EmailConfig).use_tls || false, use_ssl: (config as EmailConfig).use_ssl || false,
            })
          }
        }))
      }
    } catch { toast.error('加载失败', '无法加载渠道信息'); setModal(prev => ({ ...prev, visible: false })) }
  }

  const closeModal = () => setModal(prev => ({ ...prev, visible: false }))
  const handleFieldChange = (field: string, value: any) => setModal(prev => ({ ...prev, formData: { ...prev.formData, [field]: value }, errors: { ...prev.errors, [field]: '' } }))

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}; const { formData } = modal
    if (!formData.name.trim()) errors.name = '渠道名称不能为空'
    if (formData.type === 'dingtalk') {
      if (!formData.webhook_url.trim()) errors.webhook_url = 'Webhook URL不能为空'
      else if (!formData.webhook_url.startsWith('https://oapi.dingtalk.com/robot/send')) errors.webhook_url = 'URL格式不正确'
      if (formData.security_type === 'signature' && !formData.secret.trim()) errors.secret = '签名密钥不能为空'
    } else {
      if (!formData.smtp_server.trim()) errors.smtp_server = 'SMTP服务器不能为空'
      if (!formData.username.trim()) errors.username = '用户名不能为空'
      if (!formData.password.trim()) errors.password = '密码不能为空'
      if (!formData.from_email.trim()) errors.from_email = '发件人邮箱不能为空'
      if (!formData.to_emails.trim()) errors.to_emails = '收件人邮箱不能为空'
    }
    setModal(prev => ({ ...prev, errors })); return Object.keys(errors).length === 0
  }

  const buildConfig = (): DingTalkConfig | EmailConfig => {
    const { formData } = modal
    if (formData.type === 'dingtalk') {
      const config: DingTalkConfig = { webhook_url: formData.webhook_url, name: formData.robot_name || undefined, security_type: formData.security_type, message_template: formData.message_template || DEFAULT_DINGTALK_TEMPLATE, at_all: formData.at_all }
      if (formData.security_type === 'signature' && formData.secret) config.secret = formData.secret
      if (formData.security_type === 'keyword' && formData.keywords) config.keywords = formData.keywords.split(',').map(k => k.trim()).filter(Boolean)
      if (formData.at_mobiles) config.at_mobiles = formData.at_mobiles.split(',').map(m => m.trim()).filter(Boolean)
      return config
    }
    return { smtp_server: formData.smtp_server, smtp_port: parseInt(formData.smtp_port), username: formData.username, password: formData.password, from_email: formData.from_email, to_emails: formData.to_emails.split(',').map(e => e.trim()).filter(Boolean), use_tls: formData.use_tls, use_ssl: formData.use_ssl }
  }

  const handleSubmit = async () => {
    if (!validateForm()) return
    setModal(prev => ({ ...prev, submitting: true }))
    try {
      const data = { name: modal.formData.name, type: modal.formData.type, config: buildConfig(), description: modal.formData.description, status: modal.formData.status ? 1 : 0 }
      if (modal.mode === 'edit' && modal.channelId) { await alertChannelService.update(modal.channelId, data); toast.success('保存成功', '告警渠道配置已更新') }
      else { await alertChannelService.create(data); toast.success('创建成功', '告警渠道已创建') }
      closeModal(); loadChannels()
    } catch (error: any) { toast.error('操作失败', error.message || '请检查配置后重试') }
    finally { setModal(prev => ({ ...prev, submitting: false })) }
  }

  const handleTestInModal = async () => {
    if (modal.mode !== 'edit' || !modal.channelId) { toast.warning('提示', '请先保存渠道配置后再测试'); return }
    setModal(prev => ({ ...prev, testing: true }))
    try {
      const response = await alertChannelService.testChannel(modal.channelId)
      if (response.success) toast.testSuccess('测试消息发送成功！', modal.formData.type === 'dingtalk' ? '请检查钉钉群是否收到测试消息' : '请检查邮箱是否收到测试邮件')
      else toast.error('测试失败', response.message || '未知错误')
    } catch (error: any) { toast.error('测试失败', error.message || '请检查渠道配置') }
    finally { setModal(prev => ({ ...prev, testing: false })) }
  }

  const handleToggleStatus = async (channel: AlertChannel) => {
    try {
      const newStatus = channel.status === 1 ? 0 : 1
      await alertChannelService.update(channel.id, { status: newStatus })
      toast.success(newStatus === 1 ? '渠道已启用' : '渠道已禁用', `${channel.name} 状态更新成功`); loadChannels()
    } catch { toast.error('操作失败', '更新渠道状态失败') }
  }

  const handleTestChannel = async (channel: AlertChannel) => {
    setState(prev => ({ ...prev, testingChannels: new Set([...prev.testingChannels, channel.id]) }))
    try {
      const response = await alertChannelService.testChannel(channel.id)
      if (response.success) toast.testSuccess('测试消息发送成功！', channel.type === 'dingtalk' ? '请检查钉钉群是否收到测试消息' : '请检查邮箱是否收到测试邮件')
      else toast.error('测试失败', response.message || '未知错误')
    } catch (error: any) { toast.error('测试失败', error.message || '请检查渠道配置') }
    finally { setState(prev => ({ ...prev, testingChannels: new Set([...prev.testingChannels].filter(id => id !== channel.id)) })) }
  }

  const handleDelete = async (channel: AlertChannel) => {
    if (!confirm(`确定要删除告警渠道 "${channel.name}" 吗？`)) return
    try { await alertChannelService.delete(channel.id); toast.success('删除成功', `告警渠道 "${channel.name}" 已删除`); loadChannels() }
    catch (error: any) { toast.error('删除失败', error.message || '未知错误') }
  }

  const columns: Column<AlertChannel>[] = [
    {
      key: 'name', title: '渠道信息', dataIndex: 'name', sortable: true, width: '16.66%',
      render: (value, record) => {
        const config = record.config as DingTalkConfig | EmailConfig; const isDingTalk = record.type === 'dingtalk'
        const subInfo = isDingTalk ? (config as DingTalkConfig).name || '默认机器人' : (config as EmailConfig).from_email || ''
        return (
          <div className="flex items-center py-1.5">
            <div className={clsx('flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center shadow-md', isDingTalk ? 'bg-gradient-to-br from-emerald-400 to-green-500' : 'bg-gradient-to-br from-blue-400 to-indigo-500')}>
              {isDingTalk ? <MessageSquare className="w-4 h-4 text-white" /> : <Mail className="w-4 h-4 text-white" />}
            </div>
            <div className="ml-3 min-w-0">
              <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
              <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{subInfo}</p>
            </div>
          </div>
        )
      }
    },
    {
      key: 'type', title: '类型', dataIndex: 'type', align: 'center', width: '16.66%',
      render: (value) => {
        const config = { email: { label: '邮箱', icon: Mail, cls: isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700' }, dingtalk: { label: '钉钉', icon: MessageSquare, cls: isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700' } }
        const { label, icon: Icon, cls } = config[value as keyof typeof config] || { label: '未知', icon: AlertCircle, cls: 'bg-gray-100 text-gray-800' }
        return <span className={clsx('inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold', cls)}><Icon className="w-3 h-3" />{label}</span>
      }
    },
    {
      key: 'status', title: '状态', dataIndex: 'status', align: 'center', width: '16.66%',
      render: (value, record) => (
        <button onClick={() => handleToggleStatus(record)}
          className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200',
            value === 1 ? isDark ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : isDark ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
          <span className={clsx('w-1.5 h-1.5 rounded-full', value === 1 ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400')} />
          {value === 1 ? '运行中' : '已停用'}
        </button>
      )
    },
    {
      key: 'created_at', title: '创建时间', dataIndex: 'created_at', width: '16.66%',
      render: (value) => !value ? <span className={isDark ? 'text-slate-500' : 'text-gray-400'}>-</span> : (
        <div className="text-xs">
          <p className={isDark ? 'text-white' : 'text-gray-900'}>{formatDateTime(value, 'YYYY/MM/DD')}</p>
          <p className={isDark ? 'text-slate-400' : 'text-gray-500'}>{formatDateTime(value, 'HH:mm')}</p>
        </div>
      )
    },
    {
      key: 'actions', title: '操作', align: 'center', width: '16.66%',
      render: (_, record) => (
        <div className="flex items-center justify-center gap-1.5">
          <button onClick={() => handleTestChannel(record)} disabled={state.testingChannels.has(record.id) || record.status !== 1}
            className={clsx('inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all',
              record.status === 1 ? isDark ? 'text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30' : 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200' : isDark ? 'text-slate-500 bg-slate-700 cursor-not-allowed' : 'text-gray-400 bg-gray-100 cursor-not-allowed')} title="测试">
            {state.testingChannels.has(record.id) ? <div className="animate-spin h-3 w-3 border-2 border-emerald-500 border-t-transparent rounded-full" /> : <TestTube className="w-3 h-3" />}测试
          </button>
          <button onClick={() => openEditModal(record)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-blue-400 hover:bg-slate-700' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`} title="编辑"><Edit className="w-3.5 h-3.5" /></button>
          <button onClick={() => handleDelete(record)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-red-400 hover:bg-slate-700' : 'text-gray-500 hover:text-red-600 hover:bg-red-50'}`} title="删除"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      )
    },
    {
      key: 'description', title: '描述', dataIndex: 'description', ellipsis: true, width: '16.66%',
      render: (value) => value ? <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>{value}</span> : <span className={`text-sm italic ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>-</span>
    }
  ]

  const paginationConfig: PaginationConfig = { current: state.current, pageSize: state.pageSize, total: state.total, showSizeChanger: true, showQuickJumper: true, showTotal: true, pageSizeOptions: [10, 20, 50, 100], onChange: handlePaginationChange }

  useEffect(() => { loadChannels(); return () => { if (abortControllerRef.current) abortControllerRef.current.abort() } }, [state.current, state.pageSize, searchParamsKey])

  // 计算统计数据
  const stats = useMemo(() => {
    const total = state.channels.length
    const active = state.channels.filter(c => c.status === 1).length
    const dingtalk = state.channels.filter(c => c.type === 'dingtalk').length
    const email = state.channels.filter(c => c.type === 'email').length
    return { total, active, dingtalk, email }
  }, [state.channels])

  const renderModalForm = () => {
    const { formData, errors, activeTab } = modal
    if (formData.type === 'dingtalk') {
      return (
        <>
          <div className={`border-b mb-4 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
            <nav className="-mb-px flex space-x-6">
              {(['basic', 'at', 'template'] as const).map((tab) => (
                <button key={tab} onClick={() => setModal(prev => ({ ...prev, activeTab: tab }))}
                  className={clsx('py-2 px-1 border-b-2 font-medium text-sm transition-colors', activeTab === tab ? 'border-blue-500 text-blue-500' : isDark ? 'border-transparent text-slate-400 hover:text-slate-200' : 'border-transparent text-gray-500 hover:text-gray-700')}>
                  {tab === 'basic' ? '基础配置' : tab === 'at' ? '@设置' : '告警模板'}
                </button>
              ))}
            </nav>
          </div>
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div><label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Webhook URL <span className="text-red-500">*</span></label>
                <Input value={formData.webhook_url} onChange={(e) => handleFieldChange('webhook_url', e.target.value)} placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxx" error={errors.webhook_url} /></div>
              <div><label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>机器人名称</label>
                <Input value={formData.robot_name} onChange={(e) => handleFieldChange('robot_name', e.target.value)} placeholder="运维告警机器人" /></div>
              <div><label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>安全设置</label>
                <select value={formData.security_type} onChange={(e) => handleFieldChange('security_type', e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-xl text-sm ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'}`}>
                  <option value="signature">加签（推荐）</option><option value="keyword">自定义关键词</option><option value="none">无</option>
                </select></div>
              {formData.security_type === 'signature' && (<div><label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>签名密钥 <span className="text-red-500">*</span></label>
                <Input value={formData.secret} onChange={(e) => handleFieldChange('secret', e.target.value)} placeholder="SECxxxxxxxx" error={errors.secret} /></div>)}
              {formData.security_type === 'keyword' && (<div><label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>关键词</label>
                <Input value={formData.keywords} onChange={(e) => handleFieldChange('keywords', e.target.value)} placeholder="告警,警告,异常" /><p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>多个关键词用逗号分隔</p></div>)}
            </div>
          )}
          {activeTab === 'at' && (
            <div className="space-y-4">
              <div><label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>@指定成员</label>
                <Input value={formData.at_mobiles} onChange={(e) => handleFieldChange('at_mobiles', e.target.value)} placeholder="13800138000,13900139000" /><p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>输入手机号，多个用逗号分隔</p></div>
              <div className="flex items-center"><input type="checkbox" id="at_all" checked={formData.at_all} onChange={(e) => handleFieldChange('at_all', e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded" /><label htmlFor="at_all" className={`ml-2 text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>@所有人</label></div>
            </div>
          )}
          {activeTab === 'template' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between"><label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>消息模板</label>
                <button type="button" onClick={() => handleFieldChange('message_template', DEFAULT_DINGTALK_TEMPLATE)} className="inline-flex items-center text-xs text-blue-500 hover:text-blue-400"><RotateCcw className="w-3 h-3 mr-1" />重置默认</button></div>
              <textarea value={formData.message_template} onChange={(e) => handleFieldChange('message_template', e.target.value)} rows={10}
                className={`w-full px-3 py-2.5 rounded-xl text-sm font-mono resize-none ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'}`} />
            </div>
          )}
        </>
      )
    }
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>SMTP服务器 <span className="text-red-500">*</span></label><Input value={formData.smtp_server} onChange={(e) => handleFieldChange('smtp_server', e.target.value)} placeholder="smtp.example.com" error={errors.smtp_server} /></div>
          <div><label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>端口</label><Input type="number" value={formData.smtp_port} onChange={(e) => handleFieldChange('smtp_port', e.target.value)} placeholder="587" /></div>
        </div>
        <div><label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>用户名 <span className="text-red-500">*</span></label><Input value={formData.username} onChange={(e) => handleFieldChange('username', e.target.value)} placeholder="your-email@example.com" error={errors.username} /></div>
        <div><label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>密码 <span className="text-red-500">*</span></label><Input type="password" value={formData.password} onChange={(e) => handleFieldChange('password', e.target.value)} placeholder="邮箱密码或授权码" error={errors.password} /></div>
        <div><label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>发件人 <span className="text-red-500">*</span></label><Input value={formData.from_email} onChange={(e) => handleFieldChange('from_email', e.target.value)} placeholder="alerts@example.com" error={errors.from_email} /></div>
        <div><label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>收件人 <span className="text-red-500">*</span></label><Input value={formData.to_emails} onChange={(e) => handleFieldChange('to_emails', e.target.value)} placeholder="admin@example.com" error={errors.to_emails} /><p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>多个邮箱用逗号分隔</p></div>
        <div className="flex space-x-6">
          <label className="flex items-center"><input type="checkbox" checked={formData.use_tls} onChange={(e) => handleFieldChange('use_tls', e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded" /><span className={`ml-2 text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>TLS</span></label>
          <label className="flex items-center"><input type="checkbox" checked={formData.use_ssl} onChange={(e) => handleFieldChange('use_ssl', e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded" /><span className={`ml-2 text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>SSL</span></label>
        </div>
      </div>
    )
  }

  const headerActions = (
    <button onClick={openCreateModal}
      className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-white text-sm font-medium overflow-hidden transition-all">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <Plus className="relative w-4 h-4" /><span className="relative">新增渠道</span>
    </button>
  )

  return (
    <MonitorPageLayout title="告警渠道管理" subtitle="管理邮箱、钉钉机器人等告警通知渠道" icon={Bell}
      iconGradient="from-amber-500 via-orange-500 to-red-500" headerActions={headerActions}
      loading={state.loading} onRefresh={loadChannels} showFullscreen={false}>
      <div className="space-y-5">
        {/* 统计卡片 + 搜索 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* 统计卡片 */}
          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3">
            <StatCard title="渠道总数" value={stats.total} icon={Bell} gradient="from-blue-500 to-cyan-500" isDark={isDark} />
            <StatCard title="运行中" value={stats.active} icon={Zap} gradient="from-emerald-500 to-green-500" isDark={isDark} />
            <StatCard title="钉钉渠道" value={stats.dingtalk} icon={MessageSquare} gradient="from-green-500 to-teal-500" isDark={isDark} />
            <StatCard title="邮箱渠道" value={stats.email} icon={Mail} gradient="from-indigo-500 to-purple-500" isDark={isDark} />
          </div>
          {/* 搜索 */}
          <div className="lg:col-span-7">
            <MonitorContentCard className="h-full">
              <SearchForm fields={searchFields} onSearch={handleSearch} loading={state.loading} />
            </MonitorContentCard>
          </div>
        </div>

        {/* 列表 */}
        <MonitorContentCard noPadding>
          {state.channels.length === 0 && !state.loading ? (
            <div className="text-center py-16">
              <div className={clsx('w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center', isDark ? 'bg-slate-700/50' : 'bg-gray-100')}>
                <Inbox className={clsx('w-10 h-10', isDark ? 'text-slate-500' : 'text-gray-400')} />
              </div>
              <p className={clsx('text-base font-medium', isDark ? 'text-slate-300' : 'text-gray-600')}>暂无告警渠道</p>
              <p className={clsx('text-sm mt-1', isDark ? 'text-slate-500' : 'text-gray-400')}>点击右上角"新增渠道"按钮创建第一个告警渠道</p>
              <button onClick={openCreateModal}
                className="mt-4 inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-white text-sm font-medium bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 transition-all">
                <Plus className="w-4 h-4" /><span>新增渠道</span>
              </button>
            </div>
          ) : (
            <DataTable columns={columns} dataSource={state.channels} loading={state.loading} pagination={paginationConfig} rowKey="id" size="large" />
          )}
        </MonitorContentCard>
      </div>

      {/* 编辑/创建弹窗 */}
      {modal.visible && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={closeModal} />
            <div className={`relative inline-block w-full max-w-2xl my-8 text-left align-middle rounded-2xl shadow-2xl transform transition-all ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
              {/* 头部 */}
              <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{modal.mode === 'create' ? '新增告警渠道' : '编辑告警渠道'}</h3>
                <button onClick={closeModal} className={`p-2 rounded-xl transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}><X className="w-5 h-5" /></button>
              </div>

              {/* 内容 */}
              <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                {modal.loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                    <span className={`ml-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>加载中...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>渠道名称 <span className="text-red-500">*</span></label>
                        <Input value={modal.formData.name} onChange={(e) => handleFieldChange('name', e.target.value)} placeholder="例如：运维告警钉钉群" error={modal.errors.name} /></div>
                      <div><label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>渠道类型</label>
                        <select value={modal.formData.type} onChange={(e) => handleFieldChange('type', e.target.value)} disabled={modal.mode === 'edit'}
                          className={`w-full px-3 py-2.5 rounded-xl text-sm ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white disabled:bg-slate-800' : 'bg-gray-50 border border-gray-200 text-gray-900 disabled:bg-gray-100'}`}>
                          <option value="dingtalk">钉钉机器人</option><option value="email">邮箱</option>
                        </select></div>
                    </div>
                    <div><label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>描述</label>
                      <textarea value={modal.formData.description} onChange={(e) => handleFieldChange('description', e.target.value)} placeholder="渠道用途描述（可选）" rows={2}
                        className={`w-full px-3 py-2.5 rounded-xl text-sm resize-none ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'}`} /></div>
                    <div className="flex items-center"><input type="checkbox" id="modal_status" checked={modal.formData.status} onChange={(e) => handleFieldChange('status', e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                      <label htmlFor="modal_status" className={`ml-2 text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>启用渠道</label></div>
                    <div className={`border-t pt-4 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                      <h4 className={`text-sm font-medium mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>渠道配置</h4>
                      {renderModalForm()}
                    </div>
                  </div>
                )}
              </div>

              {/* 底部按钮 */}
              <div className={`flex items-center justify-between px-6 py-4 border-t ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-gray-50'} rounded-b-2xl`}>
                <div>
                  {modal.mode === 'edit' && (
                    <button onClick={handleTestInModal} disabled={modal.testing}
                      className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-xl transition-all disabled:opacity-50 ${isDark ? 'text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30' : 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200'}`}>
                      {modal.testing ? <div className="animate-spin h-4 w-4 border-2 border-emerald-500 border-t-transparent rounded-full mr-2" /> : <Send className="w-4 h-4 mr-2" />}测试连接
                    </button>
                  )}
                </div>
                <div className="flex space-x-3">
                  <button onClick={closeModal} className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${isDark ? 'text-slate-300 bg-slate-700 hover:bg-slate-600' : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'}`}>取消</button>
                  <button onClick={handleSubmit} disabled={modal.submitting}
                    className="group relative inline-flex items-center px-4 py-2 text-sm font-medium text-white rounded-xl overflow-hidden transition-all disabled:opacity-50">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    {modal.submitting ? <div className="relative animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" /> : <Save className="relative w-4 h-4 mr-2" />}
                    <span className="relative">{modal.mode === 'create' ? '创建' : '保存'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </MonitorPageLayout>
  )
}
