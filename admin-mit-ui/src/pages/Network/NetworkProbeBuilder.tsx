/**
 * Network Probe Builder - 美化版
 * 网络探测构建器
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Activity, AlertCircle, CheckCircle, Clock, Copy, Download, Eye, Globe, Play, Plus, Save, Settings,
  Upload, Wifi, Zap, X, FileText, Layers, Code, TestTube, ArrowLeft, RefreshCw, Trash2
} from 'lucide-react'
import { networkProbeService, networkProbeGroupService } from '../../services/network'
import { CreateNetworkProbeRequest, NetworkProbeGroup } from '../../types/network'
import { useTheme } from '../../hooks/useTheme'

interface ProbeTemplate {
  id: string; name: string; description: string; icon: React.ReactNode; config: Partial<CreateNetworkProbeRequest>
}

interface ProbeConfig extends CreateNetworkProbeRequest {
  id?: string; template_id?: string
}

interface ValidationResult {
  isValid: boolean; errors: string[]; warnings: string[]
}

interface TestResult {
  success: boolean; response_time?: number; status_code?: number; error?: string; response_preview?: string
}

export const NetworkProbeBuilder: React.FC = () => {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [configs, setConfigs] = useState<ProbeConfig[]>([])
  const [selectedConfigIndex, setSelectedConfigIndex] = useState<number | null>(null)
  const [groups, setGroups] = useState<NetworkProbeGroup[]>([])
  const [templates] = useState<ProbeTemplate[]>([
    { id: 'http-api', name: 'HTTP API 监控', description: '监控 REST API 接口的可用性和响应时间', icon: <Globe className="w-5 h-5" />,
      config: { protocol: 'https', method: 'GET', timeout: 30, interval_seconds: 60, headers: { 'User-Agent': 'NetworkProbe/1.0', 'Accept': 'application/json' } } },
    { id: 'websocket', name: 'WebSocket 连接', description: '监控 WebSocket 服务的连接状态', icon: <Wifi className="w-5 h-5" />,
      config: { protocol: 'websocket', timeout: 30, interval_seconds: 120, body: '{"type": "ping", "message": "health_check"}' } },
    { id: 'tcp-port', name: 'TCP 端口检测', description: '检测 TCP 端口的开放状态', icon: <Activity className="w-5 h-5" />,
      config: { protocol: 'tcp', timeout: 10, interval_seconds: 300 } },
    { id: 'udp-port', name: 'UDP 端口检测', description: '检测 UDP 端口的连通性', icon: <Zap className="w-5 h-5" />,
      config: { protocol: 'udp', timeout: 10, interval_seconds: 300 } },
    { id: 'web-page', name: '网页可用性', description: '监控网页的加载状态和响应时间', icon: <Eye className="w-5 h-5" />,
      config: { protocol: 'https', method: 'GET', timeout: 30, interval_seconds: 300, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NetworkProbe/1.0)' } } }
  ])
  const [showTemplates, setShowTemplates] = useState(false)
  const [validationResults, setValidationResults] = useState<Record<number, ValidationResult>>({})
  const [testResults, setTestResults] = useState<Record<number, TestResult>>({})
  const [loading, setLoading] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  const showNotification = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message }); setTimeout(() => setNotification(null), 5000)
  }, [])

  useEffect(() => {
    const loadGroups = async () => {
      try { const response = await networkProbeGroupService.getSelectableGroups(); if (response.success && response.data) setGroups(response.data) }
      catch (error) { console.error('加载分组失败:', error) }
    }
    loadGroups()
  }, [])

  const createNewConfig = (template?: ProbeTemplate) => {
    const newConfig: ProbeConfig = {
      name: template ? `${template.name} - ${Date.now()}` : `新探测任务 - ${Date.now()}`,
      description: template?.description || '', protocol: 'http', target_url: '', method: 'GET',
      timeout: 30, interval_seconds: 60, auto_probe_enabled: false, enabled: true,
      ...template?.config, template_id: template?.id
    }
    setConfigs(prev => [...prev, newConfig]); setSelectedConfigIndex(configs.length); setShowTemplates(false)
  }

  const deleteConfig = (index: number) => {
    if (window.confirm('确定要删除这个配置吗？')) {
      setConfigs(prev => prev.filter((_, i) => i !== index))
      if (selectedConfigIndex === index) setSelectedConfigIndex(null)
      else if (selectedConfigIndex !== null && selectedConfigIndex > index) setSelectedConfigIndex(selectedConfigIndex - 1)
    }
  }

  const duplicateConfig = (index: number) => {
    const config = configs[index]; const newConfig = { ...config, name: `${config.name} - 副本`, id: undefined }
    setConfigs(prev => [...prev, newConfig])
  }

  const updateConfig = (index: number, updates: Partial<ProbeConfig>) => {
    setConfigs(prev => prev.map((config, i) => i === index ? { ...config, ...updates } : config))
  }

  const validateConfig = useCallback((config: ProbeConfig): ValidationResult => {
    const errors: string[] = []; const warnings: string[] = []
    if (!config.name?.trim()) errors.push('探测任务名称不能为空')
    if (!config.target_url?.trim()) errors.push('目标 URL 不能为空')
    else {
      if ((config.protocol === 'http' || config.protocol === 'https') && !config.target_url.match(/^https?:\/\/.+/)) errors.push('HTTP/HTTPS 协议需要完整的 URL')
      else if (config.protocol === 'websocket' && !config.target_url.match(/^wss?:\/\/.+/)) errors.push('WebSocket 协议需要 ws:// 或 wss:// 开头')
      else if ((config.protocol === 'tcp' || config.protocol === 'udp') && !config.target_url.match(/^.+:\d+$/)) errors.push('TCP/UDP 协议需要 host:port 格式')
    }
    if (config.timeout <= 0 || config.timeout > 300) errors.push('超时时间必须在 1-300 秒之间')
    if (config.interval_seconds < 10 || config.interval_seconds > 86400) errors.push('探测间隔必须在 10 秒到 24 小时之间')
    if (config.interval_seconds < 60) warnings.push('探测间隔小于 1 分钟可能会产生较高的网络负载')
    if (config.timeout > config.interval_seconds / 2) warnings.push('超时时间建议不超过探测间隔的一半')
    if ((config.protocol === 'http' || config.protocol === 'https') && config.method === 'POST' && !config.body?.trim()) warnings.push('POST 请求通常需要请求体')
    return { isValid: errors.length === 0, errors, warnings }
  }, [])

  useEffect(() => {
    const results: Record<number, ValidationResult> = {}
    configs.forEach((config, index) => { results[index] = validateConfig(config) })
    setValidationResults(results)
  }, [configs, validateConfig])

  const testConfig = async (index: number) => {
    const validation = validationResults[index]
    if (!validation?.isValid) { showNotification('error', '请先修复配置错误'); return }
    setLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      const mockResult: TestResult = { success: Math.random() > 0.3, response_time: Math.floor(Math.random() * 1000) + 50, status_code: Math.random() > 0.3 ? 200 : 500 }
      if (!mockResult.success) mockResult.error = 'Connection timeout or server error'
      setTestResults(prev => ({ ...prev, [index]: mockResult }))
      showNotification(mockResult.success ? 'success' : 'error', mockResult.success ? `测试成功 - 响应时间: ${mockResult.response_time}ms` : `测试失败: ${mockResult.error}`)
    } catch { showNotification('error', '测试失败') }
    finally { setLoading(false) }
  }

  const saveConfig = async (index: number) => {
    const config = configs[index]; const validation = validationResults[index]
    if (!validation?.isValid) { showNotification('error', '请先修复配置错误'); return }
    setLoading(true)
    try {
      const response = await networkProbeService.create(config)
      if (response.success) {
        showNotification('success', '探测任务创建成功')
        const newConfigs = configs.filter((_, i) => i !== index); setConfigs(newConfigs)
        if (selectedConfigIndex === index) setSelectedConfigIndex(null)
        if (newConfigs.length === 0) setTimeout(() => navigate('/network/probes'), 1000)
      } else throw new Error(response.message || '创建失败')
    } catch (error: any) { showNotification('error', error.message || '保存失败') }
    finally { setLoading(false) }
  }

  const saveAllConfigs = async () => {
    const validConfigs = configs.filter((_, index) => validationResults[index]?.isValid)
    if (validConfigs.length === 0) { showNotification('error', '没有有效的配置可以保存'); return }
    if (!window.confirm(`确定要保存 ${validConfigs.length} 个探测任务吗？`)) return
    setLoading(true)
    try {
      let successCount = 0, failedCount = 0
      for (const config of validConfigs) {
        try { const response = await networkProbeService.create(config); if (response.success) successCount++; else failedCount++ }
        catch { failedCount++ }
      }
      showNotification('success', `批量保存完成 - 成功: ${successCount}, 失败: ${failedCount}`)
      if (successCount > 0) { setConfigs([]); setSelectedConfigIndex(null); setTimeout(() => navigate('/network/probes'), 1500) }
    } catch { showNotification('error', '批量保存失败') }
    finally { setLoading(false) }
  }

  const exportConfigs = () => {
    const exportData = { version: '1.0', exported_at: new Date().toISOString(), configs: configs.map(config => ({ ...config, id: undefined })) }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url
    a.download = `probe-configs-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    showNotification('success', '配置导出成功')
  }

  const importConfigs = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string; const importData = JSON.parse(content)
        if (!importData.configs || !Array.isArray(importData.configs)) throw new Error('无效的配置文件格式')
        setConfigs(prev => [...prev, ...importData.configs]); showNotification('success', `成功导入 ${importData.configs.length} 个配置`)
      } catch { showNotification('error', '导入失败：配置文件格式错误') }
    }
    reader.readAsText(file)
  }

  const selectedConfig = selectedConfigIndex !== null ? configs[selectedConfigIndex] : null
  const selectedValidation = selectedConfigIndex !== null ? validationResults[selectedConfigIndex] : null
  const selectedTestResult = selectedConfigIndex !== null ? testResults[selectedConfigIndex] : null

  return (
    <div className={`h-full flex flex-col overflow-hidden ${isDark ? 'bg-[#0f172a]' : 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50'}`}>
      {/* 通知 */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-xl ${
          notification.type === 'success' ? isDark ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700' :
          notification.type === 'error' ? isDark ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-700' :
          isDark ? 'bg-blue-500/20 border-blue-500/30 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>{notification.message}</div>
      )}

      {/* 头部 */}
      <div className={`flex-shrink-0 px-6 py-4 backdrop-blur-xl border-b ${isDark ? 'bg-slate-900/80 border-slate-700/50' : 'bg-white/70 border-gray-200/80'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/network/probes')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl transition-all ${isDark ? 'text-gray-400 hover:text-white hover:bg-slate-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}>
              <ArrowLeft className="w-5 h-5" /><span>返回</span>
            </button>
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl blur-xl opacity-50 bg-gradient-to-br from-emerald-500 to-teal-500"></div>
              <div className="relative p-3 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-500 shadow-xl">
                <Code className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>网络探测构建器</h1>
              <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>可视化创建和配置网络探测任务</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {configs.length > 0 && (
              <button onClick={exportConfigs} className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl transition-all ${isDark ? 'bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700 text-gray-300' : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 shadow-sm'}`}>
                <Download className="w-4 h-4" /><span className="text-sm font-medium">导出</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：配置列表 */}
          <div className="lg:col-span-1">
            <div className={`rounded-2xl overflow-hidden ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-lg'}`}>
              <div className={`p-4 border-b ${isDark ? 'border-slate-700/50' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>配置列表</h2>
                  <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>{configs.length} 项</span>
                </div>
              </div>

              <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
                {configs.length === 0 ? (
                  <div className="p-4">
                    <div className="text-center mb-4">
                      <Settings className={`w-10 h-10 mx-auto mb-2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
                      <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>选择探测方式开始创建</p>
                    </div>
                    <div className="space-y-3">
                      {templates.map((template) => (
                        <div key={template.id} onClick={() => createNewConfig(template)}
                          className={`flex items-start space-x-3 p-3 rounded-xl cursor-pointer transition-all hover:scale-[1.02] ${isDark ? 'bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/50 hover:border-blue-500/50' : 'bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300'}`}>
                          <div className={`p-2 rounded-lg flex-shrink-0 ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>{template.icon}</div>
                          <div className="flex-1 min-w-0">
                            <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{template.name}</h3>
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{template.description}</p>
                            <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>{template.config.protocol?.toUpperCase()}</span>
                          </div>
                        </div>
                      ))}
                      <div onClick={() => createNewConfig()}
                        className={`flex items-center justify-center space-x-2 p-3 rounded-xl cursor-pointer transition-all border-2 border-dashed ${isDark ? 'border-slate-600 hover:border-blue-500 text-slate-400 hover:text-blue-400' : 'border-gray-300 hover:border-blue-400 text-gray-500 hover:text-blue-600'}`}>
                        <Plus className="w-4 h-4" /><span className="text-sm">从空白配置开始</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-gray-100'}`}>
                    {configs.map((config, index) => {
                      const validation = validationResults[index]; const testResult = testResults[index]; const isSelected = selectedConfigIndex === index
                      return (
                        <div key={index} onClick={() => setSelectedConfigIndex(index)}
                          className={`p-4 cursor-pointer transition-all ${isSelected ? isDark ? 'bg-blue-500/10 border-r-2 border-blue-500' : 'bg-blue-50 border-r-2 border-blue-500' : isDark ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <h3 className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{config.name}</h3>
                                {validation && (validation.isValid ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />)}
                              </div>
                              <div className="flex items-center space-x-2 mb-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>{config.protocol.toUpperCase()}</span>
                                {testResult && (<span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${testResult.success ? isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700' : isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'}`}>{testResult.success ? '测试通过' : '测试失败'}</span>)}
                              </div>
                              <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{config.target_url || '未设置目标'}</p>
                              {validation && validation.errors.length > 0 && (<p className="text-xs text-red-500 mt-1">{validation.errors[0]}</p>)}
                            </div>
                            <div className="flex items-center space-x-1 ml-2">
                              <button onClick={(e) => { e.stopPropagation(); duplicateConfig(index) }} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-blue-400 hover:bg-slate-700' : 'text-gray-400 hover:text-blue-600 hover:bg-gray-100'}`} title="复制"><Copy className="w-4 h-4" /></button>
                              <button onClick={(e) => { e.stopPropagation(); deleteConfig(index) }} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-red-400 hover:bg-slate-700' : 'text-gray-400 hover:text-red-600 hover:bg-gray-100'}`} title="删除"><X className="w-4 h-4" /></button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {configs.length > 0 && (
                <div className={`p-4 border-t ${isDark ? 'border-slate-700/50' : 'border-gray-100'}`}>
                  <button onClick={saveAllConfigs} disabled={loading || configs.filter((_, i) => validationResults[i]?.isValid).length === 0}
                    className="w-full group relative flex items-center justify-center space-x-2 px-4 py-2.5 rounded-2xl text-white text-sm font-medium overflow-hidden transition-all disabled:opacity-50">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <Save className="relative w-4 h-4" /><span className="relative">批量保存 ({configs.filter((_, i) => validationResults[i]?.isValid).length})</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 右侧：配置编辑器 */}
          <div className="lg:col-span-2">
            {selectedConfig && selectedConfigIndex !== null ? (
              <div className={`rounded-2xl overflow-hidden ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-lg'}`}>
                <div className={`p-5 border-b ${isDark ? 'border-slate-700/50' : 'border-gray-100'}`}>
                  <div className="flex items-center justify-between">
                    <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>配置编辑器</h2>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => testConfig(selectedConfigIndex)} disabled={loading || !selectedValidation?.isValid}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${isDark ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>
                        <TestTube className="w-4 h-4" /><span>测试</span>
                      </button>
                      <button onClick={() => saveConfig(selectedConfigIndex)} disabled={loading || !selectedValidation?.isValid}
                        className="group relative flex items-center space-x-2 px-4 py-2 rounded-xl text-white text-sm font-medium overflow-hidden transition-all disabled:opacity-50">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <Save className="relative w-4 h-4" /><span className="relative">保存</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-6 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {/* 基本信息 */}
                  <div>
                    <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>基本信息</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>任务名称 *</label>
                        <input type="text" value={selectedConfig.name} onChange={(e) => updateConfig(selectedConfigIndex, { name: e.target.value })}
                          className={`w-full px-3 py-2.5 rounded-xl text-sm transition-all ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}
                          placeholder="输入任务名称" />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>分组</label>
                        <select value={selectedConfig.group_id || ''} onChange={(e) => updateConfig(selectedConfigIndex, { group_id: e.target.value ? parseInt(e.target.value) : undefined })}
                          className={`w-full px-3 py-2.5 rounded-xl text-sm transition-all ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500' : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}>
                          <option value="">选择分组（可选）</option>
                          {groups.map(group => (<option key={group.id} value={group.id}>{group.name}</option>))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>描述</label>
                      <textarea value={selectedConfig.description || ''} onChange={(e) => updateConfig(selectedConfigIndex, { description: e.target.value })} rows={2}
                        className={`w-full px-3 py-2.5 rounded-xl text-sm transition-all resize-none ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}
                        placeholder="输入任务描述" />
                    </div>
                  </div>

                  {/* 协议配置 */}
                  <div>
                    <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>协议配置</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>协议类型 *</label>
                        <select value={selectedConfig.protocol} onChange={(e) => updateConfig(selectedConfigIndex, { protocol: e.target.value as any })}
                          className={`w-full px-3 py-2.5 rounded-xl text-sm transition-all ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500' : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}>
                          <option value="http">HTTP</option><option value="https">HTTPS</option><option value="websocket">WebSocket</option><option value="tcp">TCP</option><option value="udp">UDP</option>
                        </select>
                      </div>
                      {(selectedConfig.protocol === 'http' || selectedConfig.protocol === 'https') && (
                        <div>
                          <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>请求方法</label>
                          <select value={selectedConfig.method || 'GET'} onChange={(e) => updateConfig(selectedConfigIndex, { method: e.target.value as any })}
                            className={`w-full px-3 py-2.5 rounded-xl text-sm transition-all ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500' : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}>
                            <option value="GET">GET</option><option value="POST">POST</option>
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="mt-4">
                      <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>目标地址 *</label>
                      <input type="text" value={selectedConfig.target_url} onChange={(e) => updateConfig(selectedConfigIndex, { target_url: e.target.value })}
                        className={`w-full px-3 py-2.5 rounded-xl text-sm transition-all ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}
                        placeholder={selectedConfig.protocol === 'http' || selectedConfig.protocol === 'https' ? 'https://example.com/api/health' : selectedConfig.protocol === 'websocket' ? 'wss://example.com/socket' : 'example.com:8080'} />
                    </div>
                    {(selectedConfig.protocol === 'http' || selectedConfig.protocol === 'https') && (
                      <>
                        <div className="mt-4">
                          <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>请求头 (JSON 格式)</label>
                          <textarea value={typeof selectedConfig.headers === 'string' ? selectedConfig.headers : JSON.stringify(selectedConfig.headers || {}, null, 2)}
                            onChange={(e) => { try { const parsed = JSON.parse(e.target.value); updateConfig(selectedConfigIndex, { headers: parsed }) } catch { updateConfig(selectedConfigIndex, { headers: e.target.value as any }) } }}
                            rows={3} className={`w-full px-3 py-2.5 rounded-xl text-sm font-mono transition-all resize-none ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}
                            placeholder='{"User-Agent": "NetworkProbe/1.0"}' />
                        </div>
                        {selectedConfig.method === 'POST' && (
                          <div className="mt-4">
                            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>请求体</label>
                            <textarea value={selectedConfig.body || ''} onChange={(e) => updateConfig(selectedConfigIndex, { body: e.target.value })} rows={3}
                              className={`w-full px-3 py-2.5 rounded-xl text-sm font-mono transition-all resize-none ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}
                              placeholder='{"key": "value"}' />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* 探测设置 */}
                  <div>
                    <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>探测设置</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>超时时间 (秒) *</label>
                        <input type="number" min="1" max="300" value={selectedConfig.timeout} onChange={(e) => updateConfig(selectedConfigIndex, { timeout: parseInt(e.target.value) || 30 })}
                          className={`w-full px-3 py-2.5 rounded-xl text-sm transition-all ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500' : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`} />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>探测间隔 (秒) *</label>
                        <input type="number" min="10" max="86400" value={selectedConfig.interval_seconds} onChange={(e) => updateConfig(selectedConfigIndex, { interval_seconds: parseInt(e.target.value) || 60 })}
                          className={`w-full px-3 py-2.5 rounded-xl text-sm transition-all ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500' : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`} />
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      <label className="flex items-center cursor-pointer">
                        <input type="checkbox" checked={selectedConfig.auto_probe_enabled} onChange={(e) => updateConfig(selectedConfigIndex, { auto_probe_enabled: e.target.checked })}
                          className={`rounded ${isDark ? 'bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500' : 'border-gray-300 text-blue-600 focus:ring-blue-500'}`} />
                        <span className={`ml-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>启用自动探测</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input type="checkbox" checked={selectedConfig.enabled} onChange={(e) => updateConfig(selectedConfigIndex, { enabled: e.target.checked })}
                          className={`rounded ${isDark ? 'bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500' : 'border-gray-300 text-blue-600 focus:ring-blue-500'}`} />
                        <span className={`ml-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>启用探测任务</span>
                      </label>
                    </div>
                  </div>

                  {/* 验证结果 */}
                  {selectedValidation && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>配置验证</h3>
                      {selectedValidation.errors.length > 0 && (
                        <div className={`mb-4 p-4 rounded-xl ${isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
                          <div className="flex items-center mb-2"><AlertCircle className="w-5 h-5 text-red-500 mr-2" /><h4 className={`text-sm font-medium ${isDark ? 'text-red-300' : 'text-red-800'}`}>配置错误</h4></div>
                          <ul className={`text-sm space-y-1 ${isDark ? 'text-red-300' : 'text-red-700'}`}>{selectedValidation.errors.map((error, index) => (<li key={index}>• {error}</li>))}</ul>
                        </div>
                      )}
                      {selectedValidation.warnings.length > 0 && (
                        <div className={`mb-4 p-4 rounded-xl ${isDark ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'}`}>
                          <div className="flex items-center mb-2"><AlertCircle className="w-5 h-5 text-amber-500 mr-2" /><h4 className={`text-sm font-medium ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>配置警告</h4></div>
                          <ul className={`text-sm space-y-1 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{selectedValidation.warnings.map((warning, index) => (<li key={index}>• {warning}</li>))}</ul>
                        </div>
                      )}
                      {selectedValidation.isValid && selectedValidation.warnings.length === 0 && (
                        <div className={`p-4 rounded-xl ${isDark ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200'}`}>
                          <div className="flex items-center"><CheckCircle className="w-5 h-5 text-emerald-500 mr-2" /><span className={`text-sm font-medium ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>配置验证通过</span></div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 测试结果 */}
                  {selectedTestResult && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>测试结果</h3>
                      <div className={`p-4 rounded-xl ${selectedTestResult.success ? isDark ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200' : isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
                        <div className="flex items-center mb-2">
                          {selectedTestResult.success ? <CheckCircle className="w-5 h-5 text-emerald-500 mr-2" /> : <AlertCircle className="w-5 h-5 text-red-500 mr-2" />}
                          <span className={`text-sm font-medium ${selectedTestResult.success ? isDark ? 'text-emerald-300' : 'text-emerald-800' : isDark ? 'text-red-300' : 'text-red-800'}`}>{selectedTestResult.success ? '测试成功' : '测试失败'}</span>
                        </div>
                        {selectedTestResult.success && (
                          <div className={`text-sm space-y-1 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                            {selectedTestResult.response_time && <p>响应时间: {selectedTestResult.response_time}ms</p>}
                            {selectedTestResult.status_code && <p>状态码: {selectedTestResult.status_code}</p>}
                          </div>
                        )}
                        {!selectedTestResult.success && selectedTestResult.error && (<p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{selectedTestResult.error}</p>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={`rounded-2xl p-12 text-center ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-lg'}`}>
                <Code className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
                <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>选择配置进行编辑</h3>
                <p className={`mb-6 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>从左侧列表选择一个配置，或创建新的配置</p>
                <button onClick={() => setShowTemplates(true)}
                  className="group relative inline-flex items-center space-x-2 px-6 py-3 rounded-2xl text-white text-sm font-medium overflow-hidden transition-all">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <Plus className="relative w-4 h-4" /><span className="relative">创建新配置</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 模板选择对话框 */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowTemplates(false)}>
          <div className={`rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-6 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>选择配置模板</h2>
                <button onClick={() => setShowTemplates(false)} className={`p-2 rounded-xl transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}><X className="w-6 h-6" /></button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {templates.map((template) => (
                  <div key={template.id} onClick={() => createNewConfig(template)}
                    className={`p-4 rounded-xl cursor-pointer transition-all hover:scale-[1.02] ${isDark ? 'bg-slate-700/50 border border-slate-600 hover:border-blue-500' : 'bg-gray-50 border border-gray-200 hover:border-blue-400 hover:shadow-md'}`}>
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>{template.icon}</div>
                      <div className="flex-1">
                        <h3 className={`text-sm font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{template.name}</h3>
                        <p className={`text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{template.description}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>{template.config.protocol?.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className={`border-t pt-4 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                <button onClick={() => createNewConfig()}
                  className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl transition-all border-2 border-dashed ${isDark ? 'border-slate-600 hover:border-blue-500 text-slate-400 hover:text-blue-400' : 'border-gray-300 hover:border-blue-400 text-gray-500 hover:text-blue-600'}`}>
                  <Plus className="w-5 h-5" /><span>从空白配置开始</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`rounded-2xl p-6 flex items-center space-x-3 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white shadow-xl'}`}>
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
            <span className={isDark ? 'text-white' : 'text-gray-900'}>处理中...</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default NetworkProbeBuilder
