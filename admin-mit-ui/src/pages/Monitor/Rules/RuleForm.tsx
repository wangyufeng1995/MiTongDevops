/**
 * 告警规则配置表单组件
 */
import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Bell, Server, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { api } from '../../../services/api'
import { useTheme } from '../../../hooks/useTheme'
import { MonitorPageLayout, MonitorContentCard } from '../../../components/Monitor'

interface Channel {
  id: number
  name: string
  type: string
  status: number
}

interface Host {
  id: number
  name: string
  hostname: string
}

interface FormData {
  name: string
  description: string
  metric_type: 'cpu' | 'memory' | 'disk' | 'load'
  condition_operator: string
  threshold_value: number
  duration: number
  severity: 'info' | 'warning' | 'critical'
  host_ids: number[]
  channel_ids: number[]
  silence_period: number
  enabled: boolean
}

export const RuleForm: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { isDark } = useTheme()
  const isEdit = !!id

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [hosts, setHosts] = useState<Host[]>([])
  const [applyToAllHosts, setApplyToAllHosts] = useState(true)
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error'; message: string }>({ 
    show: false, type: 'success', message: '' 
  })

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    metric_type: 'cpu',
    condition_operator: '>',
    threshold_value: 80,
    duration: 300,
    severity: 'warning',
    host_ids: [],
    channel_ids: [],
    silence_period: 3600,
    enabled: true
  })

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message })
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000)
  }

  useEffect(() => {
    loadChannels()
    loadHosts()
    if (isEdit) loadRule()
  }, [id])

  const loadChannels = async () => {
    try {
      const response = await api.get('/api/monitor/channels', { params: { per_page: 100, status: 1 } })
      if (response.success && response.data) {
        setChannels(response.data.channels || [])
      }
    } catch (error: any) {
      showToast('error', '加载告警渠道失败')
    }
  }

  const loadHosts = async () => {
    try {
      const response = await api.get('/api/hosts', { params: { per_page: 1000 } })
      if (response.success && response.data) {
        setHosts(response.data.hosts || [])
      }
    } catch (error: any) {
      showToast('error', '加载主机列表失败')
    }
  }

  const loadRule = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/monitor/rules/${id}`)
      if (response.success && response.data) {
        const rule = response.data
        setFormData({
          name: rule.name,
          description: rule.description || '',
          metric_type: rule.metric_type,
          condition_operator: rule.condition_operator,
          threshold_value: rule.threshold_value,
          duration: rule.duration,
          severity: rule.severity,
          host_ids: rule.host_ids || [],
          channel_ids: rule.channel_ids || [],
          silence_period: rule.silence_period,
          enabled: rule.enabled
        })
        setApplyToAllHosts(!rule.host_ids || rule.host_ids.length === 0)
      }
    } catch (error: any) {
      showToast('error', '加载规则失败')
    } finally {
      setLoading(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}

    if (!formData.name.trim()) newErrors.name = '规则名称不能为空'
    if (formData.threshold_value < 0 || formData.threshold_value > 100) {
      newErrors.threshold_value = '阈值必须在0-100之间'
    }
    if (formData.duration < 0) newErrors.duration = '持续时间不能为负数'
    if (formData.silence_period < 0) newErrors.silence_period = '静默期不能为负数'
    if (formData.channel_ids.length === 0) newErrors.channel_ids = '至少选择一个告警渠道'
    if (!applyToAllHosts && formData.host_ids.length === 0) {
      newErrors.host_ids = '请选择至少一台主机或选择应用到所有主机'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      showToast('error', '请检查表单填写')
      return
    }

    try {
      setSubmitting(true)
      const submitData = {
        ...formData,
        host_ids: applyToAllHosts ? null : formData.host_ids
      }

      const response = isEdit
        ? await api.put(`/api/monitor/rules/${id}`, submitData)
        : await api.post('/api/monitor/rules', submitData)

      if (response.success) {
        showToast('success', `规则${isEdit ? '更新' : '创建'}成功`)
        setTimeout(() => navigate('/monitor/rules/list'), 1500)
      }
    } catch (error: any) {
      showToast('error', error.message || `${isEdit ? '更新' : '创建'}规则失败`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const headerActions = (
    <button onClick={() => navigate('/monitor/rules/list')}
      className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
        isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}>
      <ArrowLeft className="w-4 h-4" /><span>返回列表</span>
    </button>
  )

  return (
    <MonitorPageLayout title={isEdit ? '编辑告警规则' : '创建告警规则'} subtitle="配置监控指标和告警条件" 
      icon={Bell} iconGradient="from-blue-500 via-purple-500 to-pink-500" headerActions={headerActions}
      loading={loading} showFullscreen={false}>
      
      {/* Toast */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-top-2">
          <div className={`px-4 py-3 rounded-xl shadow-xl border flex items-center space-x-3 ${
            toast.type === 'success' 
              ? (isDark ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800')
              : (isDark ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-800')
          }`}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基本信息 */}
        <MonitorContentCard title="基本信息" icon={Bell}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                规则名称 <span className="text-red-500">*</span>
              </label>
              <input type="text" value={formData.name} onChange={(e) => handleChange('name', e.target.value)}
                placeholder="例如：生产服务器CPU告警" className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                } ${errors.name ? 'border-red-500' : ''}`} />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
            </div>

            <div className="md:col-span-2">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>描述</label>
              <textarea value={formData.description} onChange={(e) => handleChange('description', e.target.value)}
                placeholder="规则的详细说明..." rows={3} className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                }`} />
            </div>
          </div>
        </MonitorContentCard>

        {/* 监控条件 */}
        <MonitorContentCard title="监控条件" icon={AlertTriangle}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                监控指标 <span className="text-red-500">*</span>
              </label>
              <select value={formData.metric_type} onChange={(e) => handleChange('metric_type', e.target.value as any)}
                className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`}>
                <option value="cpu">CPU使用率</option>
                <option value="memory">内存使用率</option>
                <option value="disk">磁盘使用率</option>
                <option value="load">系统负载</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                严重级别 <span className="text-red-500">*</span>
              </label>
              <select value={formData.severity} onChange={(e) => handleChange('severity', e.target.value as any)}
                className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`}>
                <option value="info">信息</option>
                <option value="warning">警告</option>
                <option value="critical">严重</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                条件操作符 <span className="text-red-500">*</span>
              </label>
              <select value={formData.condition_operator} onChange={(e) => handleChange('condition_operator', e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`}>
                <option value=">">大于 (&gt;)</option>
                <option value=">=">大于等于 (&gt;=)</option>
                <option value="<">小于 (&lt;)</option>
                <option value="<=">小于等于 (&lt;=)</option>
                <option value="==">等于 (==)</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                阈值 (%) <span className="text-red-500">*</span>
              </label>
              <input type="number" min="0" max="100" value={formData.threshold_value} 
                onChange={(e) => handleChange('threshold_value', parseFloat(e.target.value))}
                className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                } ${errors.threshold_value ? 'border-red-500' : ''}`} />
              {errors.threshold_value && <p className="mt-1 text-sm text-red-500">{errors.threshold_value}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                持续时间 (秒)
              </label>
              <input type="number" min="0" value={formData.duration} 
                onChange={(e) => handleChange('duration', parseInt(e.target.value))}
                className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`} />
              <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                条件持续多久后触发告警
              </p>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                静默期 (秒)
              </label>
              <input type="number" min="0" value={formData.silence_period} 
                onChange={(e) => handleChange('silence_period', parseInt(e.target.value))}
                className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`} />
              <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                同一告警的最小间隔时间
              </p>
            </div>
          </div>
        </MonitorContentCard>

        {/* 应用范围 */}
        <MonitorContentCard title="应用范围" icon={Server}>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <input type="checkbox" id="applyToAll" checked={applyToAllHosts} 
                onChange={(e) => setApplyToAllHosts(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
              <label htmlFor="applyToAll" className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                应用到所有主机
              </label>
            </div>

            {!applyToAllHosts && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  选择主机 <span className="text-red-500">*</span>
                </label>
                <div className={`border rounded-xl p-4 max-h-60 overflow-y-auto ${
                  isDark ? 'border-slate-600 bg-slate-700/30' : 'border-gray-200 bg-gray-50'
                } ${errors.host_ids ? 'border-red-500' : ''}`}>
                  {hosts.length === 0 ? (
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>暂无可用主机</p>
                  ) : (
                    <div className="space-y-2">
                      {hosts.map(host => (
                        <label key={host.id} className="flex items-center space-x-3 cursor-pointer hover:bg-opacity-50 p-2 rounded-lg">
                          <input type="checkbox" checked={formData.host_ids.includes(host.id)}
                            onChange={(e) => {
                              const newHostIds = e.target.checked
                                ? [...formData.host_ids, host.id]
                                : formData.host_ids.filter(id => id !== host.id)
                              handleChange('host_ids', newHostIds)
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {host.name} ({host.hostname})
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {errors.host_ids && <p className="mt-1 text-sm text-red-500">{errors.host_ids}</p>}
              </div>
            )}
          </div>
        </MonitorContentCard>

        {/* 告警渠道 */}
        <MonitorContentCard title="告警渠道" icon={Bell}>
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              选择渠道 <span className="text-red-500">*</span>
            </label>
            <div className={`border rounded-xl p-4 ${
              isDark ? 'border-slate-600 bg-slate-700/30' : 'border-gray-200 bg-gray-50'
            } ${errors.channel_ids ? 'border-red-500' : ''}`}>
              {channels.length === 0 ? (
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  暂无可用告警渠道，请先创建告警渠道
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {channels.map(channel => (
                    <label key={channel.id} className="flex items-center space-x-3 cursor-pointer hover:bg-opacity-50 p-3 rounded-lg border border-transparent hover:border-blue-500">
                      <input type="checkbox" checked={formData.channel_ids.includes(channel.id)}
                        onChange={(e) => {
                          const newChannelIds = e.target.checked
                            ? [...formData.channel_ids, channel.id]
                            : formData.channel_ids.filter(id => id !== channel.id)
                          handleChange('channel_ids', newChannelIds)
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {channel.name}
                        </div>
                        <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {channel.type === 'email' ? '邮件' : channel.type === 'dingtalk' ? '钉钉' : channel.type}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {errors.channel_ids && <p className="mt-1 text-sm text-red-500">{errors.channel_ids}</p>}
          </div>
        </MonitorContentCard>

        {/* 规则状态 */}
        <MonitorContentCard title="规则状态">
          <div className="flex items-center space-x-3">
            <input type="checkbox" id="enabled" checked={formData.enabled} 
              onChange={(e) => handleChange('enabled', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
            <label htmlFor="enabled" className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              启用此规则
            </label>
          </div>
          <p className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            禁用的规则不会触发告警
          </p>
        </MonitorContentCard>

        {/* 提交按钮 */}
        <div className="flex items-center justify-end space-x-4">
          <button type="button" onClick={() => navigate('/monitor/rules/list')}
            className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
              isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
            取消
          </button>
          <button type="submit" disabled={submitting}
            className="group relative flex items-center space-x-2 px-6 py-2.5 rounded-xl text-white font-medium overflow-hidden transition-all disabled:opacity-50">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Save className="relative w-4 h-4" />
            <span className="relative">{submitting ? '保存中...' : (isEdit ? '更新规则' : '创建规则')}</span>
          </button>
        </div>
      </form>
    </MonitorPageLayout>
  )
}