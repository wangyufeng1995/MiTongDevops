/**
 * Grafana 配置表单组件
 * 
 * 实现 Grafana 服务器配置表单（名称、URL、状态、iframe 高度、认证配置）
 * 
 * Requirements: 4.1, 4.4, 4.5
 */
import React, { useState, useEffect } from 'react'
import { Save, X } from 'lucide-react'
import { 
  GrafanaConfig, 
  CreateGrafanaConfigRequest 
} from '../../../services/grafana'

interface ConfigFormProps {
  config: GrafanaConfig | null
  onSave: (data: CreateGrafanaConfigRequest) => void
  onCancel: () => void
}

export const ConfigForm: React.FC<ConfigFormProps> = ({
  config,
  onSave,
  onCancel
}) => {
  // 表单状态
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState(1)
  const [iframeHeight, setIframeHeight] = useState(800)
  
  // 认证配置
  const [authType, setAuthType] = useState<'none' | 'basic' | 'token' | 'api_key'>('none')
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [useProxy, setUseProxy] = useState(true)
  const [allowAnonymous, setAllowAnonymous] = useState(false)
  
  // UI 状态
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // 初始化表单数据
  useEffect(() => {
    if (config) {
      setName(config.name)
      setUrl(config.url)
      setStatus(config.status)
      setIframeHeight(config.iframe_height || 800)
      setAuthType(config.auth_type || 'none')
      setAuthUsername(config.auth_username || '')
      setAuthPassword('')  // 不回显密码
      setAuthToken('')  // 不回显 token
      setApiKey('')  // 不回显 API key
      setUseProxy(config.use_proxy ?? true)
      setAllowAnonymous(config.allow_anonymous ?? false)
    } else {
      // 重置表单
      setName('')
      setUrl('')
      setStatus(1)
      setIframeHeight(800)
      setAuthType('none')
      setAuthUsername('')
      setAuthPassword('')
      setAuthToken('')
      setApiKey('')
      setUseProxy(true)
      setAllowAnonymous(false)
    }
    setErrors({})
  }, [config])

  // 验证表单
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = '请输入配置名称'
    }

    if (!url.trim()) {
      newErrors.url = '请输入 Grafana 服务器 URL'
    } else if (!/^https?:\/\/.+/.test(url)) {
      newErrors.url = 'URL 格式不正确，需要以 http:// 或 https:// 开头'
    }

    if (iframeHeight < 200 || iframeHeight > 2000) {
      newErrors.iframeHeight = 'iframe 高度需要在 200-2000 之间'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setSubmitting(true)

    try {
      const data: CreateGrafanaConfigRequest = {
        name: name.trim(),
        url: url.trim(),
        status,
        iframe_height: iframeHeight,
        auth_type: authType,
        use_proxy: useProxy,
        allow_anonymous: allowAnonymous
      }

      // 根据认证类型添加认证信息
      if (authType === 'basic') {
        data.auth_username = authUsername.trim()
        if (authPassword) {  // 只在有新密码时才发送
          data.auth_password = authPassword
        }
      } else if (authType === 'token') {
        if (authToken) {
          data.auth_token = authToken.trim()
        }
      } else if (authType === 'api_key') {
        if (apiKey) {
          data.api_key = apiKey.trim()
        }
      }

      await onSave(data)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 p-6">
      {/* 名称 */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          配置名称 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：生产环境 Grafana"
          className={`w-full px-4 py-2.5 border-2 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all ${
            errors.name ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-orange-300'
          }`}
        />
        {errors.name && (
          <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
            <span>⚠️</span>
            <span>{errors.name}</span>
          </p>
        )}
      </div>

      {/* 服务器 URL */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          Grafana 服务器 URL <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="例如：http://grafana.example.com:3000"
          className={`w-full px-4 py-2.5 border-2 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all font-mono text-sm ${
            errors.url ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-orange-300'
          }`}
        />
        {errors.url && (
          <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
            <span>⚠️</span>
            <span>{errors.url}</span>
          </p>
        )}
        <p className="mt-2 text-xs text-gray-600 bg-orange-50 rounded-lg p-2 border border-orange-100">
          💡 Grafana 服务器的基础 URL，用于构建仪表盘链接
        </p>
      </div>

      {/* iframe 高度 */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          iframe 高度 (px)
        </label>
        <input
          type="number"
          value={iframeHeight}
          onChange={(e) => setIframeHeight(parseInt(e.target.value) || 800)}
          min={200}
          max={2000}
          className={`w-full px-4 py-2.5 border-2 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all ${
            errors.iframeHeight ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-orange-300'
          }`}
        />
        {errors.iframeHeight && (
          <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
            <span>⚠️</span>
            <span>{errors.iframeHeight}</span>
          </p>
        )}
        <p className="mt-2 text-xs text-gray-600 bg-orange-50 rounded-lg p-2 border border-orange-100">
          📏 嵌入仪表盘的 iframe 高度，默认 800px（范围：200-2000）
        </p>
      </div>

      {/* 认证配置 */}
      <div className="space-y-4 p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border-2 border-orange-100">
        <h3 className="text-sm font-bold text-gray-800 flex items-center space-x-2">
          <span>🔐</span>
          <span>认证配置</span>
        </h3>
        
        {/* 认证类型 */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            认证类型
          </label>
          <select
            value={authType}
            onChange={(e) => setAuthType(e.target.value as any)}
            className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white transition-all"
          >
            <option value="none">无需认证</option>
            <option value="basic">Basic Auth（用户名密码）</option>
            <option value="token">Bearer Token</option>
            <option value="api_key">API Key</option>
          </select>
        </div>

        {/* Basic Auth */}
        {authType === 'basic' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                用户名
              </label>
              <input
                type="text"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                placeholder="Grafana 用户名"
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                密码 {config && <span className="text-xs text-gray-500">(留空保持不变)</span>}
              </label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder={config ? "输入新密码以更新" : "Grafana 密码"}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
              />
            </div>
          </div>
        )}

        {/* Bearer Token */}
        {authType === 'token' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bearer Token {config && <span className="text-xs text-gray-500">(留空保持不变)</span>}
            </label>
            <textarea
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder={config ? "输入新 Token 以更新" : "输入 Bearer Token"}
              rows={3}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white font-mono text-sm resize-none"
            />
          </div>
        )}

        {/* API Key */}
        {authType === 'api_key' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key {config && <span className="text-xs text-gray-500">(留空保持不变)</span>}
            </label>
            <textarea
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config ? "输入新 API Key 以更新" : "输入 Grafana API Key"}
              rows={3}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white font-mono text-sm resize-none"
            />
          </div>
        )}

        {/* 代理选项 */}
        {authType !== 'none' && (
          <div className="space-y-2 pt-2 border-t border-orange-200">
            <label className="flex items-center space-x-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={useProxy}
                onChange={(e) => setUseProxy(e.target.checked)}
                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700 group-hover:text-orange-700 transition-colors">
                使用后端代理（推荐，解决跨域和认证问题）
              </span>
            </label>
            <p className="text-xs text-gray-600 ml-6">
              启用后，iframe 将通过后端代理访问 Grafana，自动添加认证信息
            </p>
          </div>
        )}

        {authType === 'none' && (
          <div className="pt-2 border-t border-orange-200">
            <label className="flex items-center space-x-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={allowAnonymous}
                onChange={(e) => setAllowAnonymous(e.target.checked)}
                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700 group-hover:text-orange-700 transition-colors">
                允许匿名访问
              </span>
            </label>
            <p className="text-xs text-gray-600 ml-6 mt-1">
              Grafana 服务器需要配置允许匿名访问
            </p>
          </div>
        )}
      </div>

      {/* 状态 */}
      <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4 border-2 border-orange-100">
        <label className="flex items-center space-x-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={status === 1}
            onChange={(e) => setStatus(e.target.checked ? 1 : 0)}
            className="w-5 h-5 text-orange-600 border-gray-300 rounded-lg focus:ring-orange-500 focus:ring-2"
          />
          <span className="text-sm font-medium text-gray-800 group-hover:text-orange-700 transition-colors">启用此配置</span>
        </label>
      </div>

      {/* 按钮 */}
      <div className="flex justify-end space-x-3 pt-6 border-t-2 border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="flex items-center space-x-2 px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 transition-all"
        >
          <X className="w-4 h-4" />
          <span>取消</span>
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 disabled:opacity-50 transition-all shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 hover:scale-105"
        >
          <Save className="w-4 h-4" />
          <span>{submitting ? '保存中...' : '保存'}</span>
        </button>
      </div>
    </form>
  )
}

export default ConfigForm
