import React, { useState, useEffect } from 'react'
import { NetworkProbe, CreateNetworkProbeRequest, UpdateNetworkProbeRequest, NetworkProbeGroup } from '../../../types/network'
import { networkProbeGroupService } from '../../../services/network'
import { Input } from '../../../components/Form/Input'
import { Select, SelectOption } from '../../../components/Form/Select'
import { useTheme } from '../../../hooks/useTheme'

interface ProbeFormProps {
  probe?: NetworkProbe | null
  onSubmit: (data: CreateNetworkProbeRequest | UpdateNetworkProbeRequest) => Promise<void>
  onCancel: () => void
}

interface HeaderEntry {
  key: string
  value: string
}

const PROTOCOL_OPTIONS: SelectOption[] = [
  { value: 'http', label: 'HTTP', description: 'HTTP 协议' },
  { value: 'https', label: 'HTTPS', description: 'HTTPS 协议' },
  { value: 'websocket', label: 'WebSocket', description: 'WebSocket 协议' },
  { value: 'tcp', label: 'TCP', description: 'TCP 协议' },
  { value: 'udp', label: 'UDP', description: 'UDP 协议' },
]

const METHOD_OPTIONS: SelectOption[] = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
]

export const ProbeForm: React.FC<ProbeFormProps> = ({ probe, onSubmit, onCancel }) => {
  const { isDark } = useTheme()
  const [formData, setFormData] = useState<CreateNetworkProbeRequest>({
    name: '',
    description: '',
    protocol: 'http',
    target_url: '',
    method: 'GET',
    headers: {},
    body: '',
    timeout: 30,
    interval_seconds: 60,
    auto_probe_enabled: false,
    enabled: true,
  })
  
  const [groups, setGroups] = useState<NetworkProbeGroup[]>([])
  const [groupOptions, setGroupOptions] = useState<SelectOption[]>([])
  const [headers, setHeaders] = useState<HeaderEntry[]>([{ key: '', value: '' }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingGroups, setLoadingGroups] = useState(true)

  // Load groups on mount
  useEffect(() => {
    loadGroups()
  }, [])

  // Initialize form data when probe changes
  useEffect(() => {
    if (probe) {
      setFormData({
        group_id: probe.group_id,
        name: probe.name,
        description: probe.description || '',
        protocol: probe.protocol,
        target_url: probe.target_url,
        method: probe.method || 'GET',
        headers: probe.headers || {},
        body: probe.body || '',
        timeout: probe.timeout,
        interval_seconds: probe.interval_seconds,
        auto_probe_enabled: probe.auto_probe_enabled,
        enabled: probe.enabled,
      })
      
      // Convert headers object to array
      if (probe.headers && Object.keys(probe.headers).length > 0) {
        const headerEntries = Object.entries(probe.headers).map(([key, value]) => ({
          key,
          value,
        }))
        setHeaders(headerEntries)
      }
    }
  }, [probe])

  const loadGroups = async () => {
    setLoadingGroups(true)
    try {
      const response = await networkProbeGroupService.getSelectableGroups()
      if (response.success && response.data) {
        setGroups(response.data)
        
        // Convert to select options
        const options: SelectOption[] = response.data.map(group => ({
          value: group.id,
          label: group.name,
          description: group.description,
        }))
        setGroupOptions(options)
      }
    } catch (err) {
      console.error('加载分组错误:', err)
    } finally {
      setLoadingGroups(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Convert headers array to object
      const headersObj: Record<string, string> = {}
      headers.forEach(({ key, value }) => {
        if (key.trim() && value.trim()) {
          headersObj[key.trim()] = value.trim()
        }
      })

      const submitData: CreateNetworkProbeRequest | UpdateNetworkProbeRequest = {
        ...formData,
        headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
      }

      await onSubmit(submitData)
    } catch (err: any) {
      setError(err.message || '保存探测失败')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({ ...prev, [name]: checked }))
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleProtocolChange = (value: string | number | null) => {
    setFormData(prev => ({ ...prev, protocol: value as any }))
  }

  const handleMethodChange = (value: string | number | null) => {
    setFormData(prev => ({ ...prev, method: value as any }))
  }

  const handleGroupChange = (value: string | number | null) => {
    setFormData(prev => ({ ...prev, group_id: value as number | undefined }))
  }

  const handleHeaderChange = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...headers]
    newHeaders[index][field] = value
    setHeaders(newHeaders)
  }

  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '' }])
  }

  const removeHeader = (index: number) => {
    if (headers.length > 1) {
      setHeaders(headers.filter((_, i) => i !== index))
    }
  }

  const isHttpProtocol = formData.protocol === 'http' || formData.protocol === 'https'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className={`px-4 py-3 rounded ${isDark ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {error}
        </div>
      )}

      {/* Basic Information */}
      <div className={`p-4 rounded-lg space-y-4 ${isDark ? 'bg-gray-800/40' : 'bg-gray-50'}`}>
        <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>基本信息</h3>
        
        <Input
          label="探测名称"
          name="name"
          id="name"
          value={formData.name}
          onChange={handleChange}
          required
          placeholder="请输入探测名称"
        />

        <div>
          <label htmlFor="description" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            描述
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={2}
            className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700/50 border-gray-600 text-gray-200 placeholder-gray-400' : 'border-gray-300 text-gray-900'}`}
            placeholder="请输入探测描述"
          />
        </div>

        <Select
          label="分组"
          options={groupOptions}
          value={formData.group_id}
          onSelectionChange={handleGroupChange}
          placeholder="选择分组（可选）"
          loading={loadingGroups}
          clearable
          helperText="如果不选择，探测将被分配到"未分组""
        />
      </div>

      {/* Protocol Configuration */}
      <div className={`p-4 rounded-lg space-y-4 ${isDark ? 'bg-gray-800/40' : 'bg-gray-50'}`}>
        <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>协议配置</h3>
        
        <Select
          label="协议"
          options={PROTOCOL_OPTIONS}
          value={formData.protocol}
          onSelectionChange={handleProtocolChange}
          required
        />

        <Input
          label="目标地址"
          name="target_url"
          id="target_url"
          value={formData.target_url}
          onChange={handleChange}
          required
          placeholder={
            isHttpProtocol
              ? 'https://example.com/api/health'
              : formData.protocol === 'websocket'
              ? 'ws://example.com/socket'
              : formData.protocol === 'tcp'
              ? 'example.com:8080'
              : 'example.com:53'
          }
          helperText={
            isHttpProtocol
              ? '完整的 URL 地址（包含协议）'
              : formData.protocol === 'websocket'
              ? 'WebSocket 地址 (ws:// 或 wss://)'
              : '主机:端口 格式'
          }
        />

        {isHttpProtocol && (
          <>
            <Select
              label="HTTP 方法"
              options={METHOD_OPTIONS}
              value={formData.method || 'GET'}
              onSelectionChange={handleMethodChange}
            />

            {/* HTTP Headers */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  请求头
                </label>
                <button
                  type="button"
                  onClick={addHeader}
                  className={`text-sm ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                >
                  + 添加请求头
                </button>
              </div>
              
              <div className="space-y-2">
                {headers.map((header, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={header.key}
                      onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                      placeholder="请求头名称"
                      className={`flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700/50 border-gray-600 text-gray-200 placeholder-gray-400' : 'border-gray-300 text-gray-900'}`}
                    />
                    <input
                      type="text"
                      value={header.value}
                      onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                      placeholder="请求头值"
                      className={`flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700/50 border-gray-600 text-gray-200 placeholder-gray-400' : 'border-gray-300 text-gray-900'}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeHeader(index)}
                      disabled={headers.length === 1}
                      className={`px-3 py-2 text-sm disabled:cursor-not-allowed ${isDark ? 'text-red-400 hover:text-red-300 disabled:text-gray-600' : 'text-red-600 hover:text-red-700 disabled:text-gray-400'}`}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
              <p className={`mt-1 text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                添加自定义 HTTP 请求头
              </p>
            </div>

            {/* HTTP Body (for POST) */}
            {formData.method === 'POST' && (
              <div>
                <label htmlFor="body" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  请求体
                </label>
                <textarea
                  id="body"
                  name="body"
                  value={formData.body}
                  onChange={handleChange}
                  rows={4}
                  className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono ${isDark ? 'bg-gray-700/50 border-gray-600 text-gray-200 placeholder-gray-400' : 'border-gray-300 text-gray-900'}`}
                  placeholder='{"key": "value"}'
                />
                <p className={`mt-1 text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  请求体内容（JSON、XML 等）
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Probe Settings */}
      <div className={`p-4 rounded-lg space-y-4 ${isDark ? 'bg-gray-800/40' : 'bg-gray-50'}`}>
        <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>探测设置</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="超时时间（秒）"
            name="timeout"
            id="timeout"
            type="number"
            value={formData.timeout}
            onChange={handleChange}
            min={1}
            max={300}
            required
            helperText="等待响应的最大时间"
          />

          <Input
            label="探测间隔（秒）"
            name="interval_seconds"
            id="interval_seconds"
            type="number"
            value={formData.interval_seconds}
            onChange={handleChange}
            min={10}
            max={86400}
            required
            helperText="启用自动探测时的执行间隔"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="auto_probe_enabled"
              name="auto_probe_enabled"
              checked={formData.auto_probe_enabled}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="auto_probe_enabled" className={`ml-2 block text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
              启用自动探测
            </label>
          </div>
          <p className={`text-sm ml-6 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            按指定间隔自动执行探测
          </p>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="enabled"
              name="enabled"
              checked={formData.enabled}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="enabled" className={`ml-2 block text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
              启用探测
            </label>
          </div>
          <p className={`text-sm ml-6 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            启用或禁用此探测任务
          </p>
        </div>
      </div>

      {/* Form Actions */}
      <div className={`flex justify-end space-x-3 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className={`px-4 py-2 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 ${isDark ? 'border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600' : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'}`}
        >
          取消
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? '保存中...' : probe ? '更新探测' : '创建探测'}
        </button>
      </div>
    </form>
  )
}
