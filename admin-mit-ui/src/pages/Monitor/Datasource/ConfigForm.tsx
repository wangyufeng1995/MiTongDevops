/**
 * 数据源配置表单组件
 * 
 * 实现表单（名称、类型、URL、认证方式、用户名、密码、Token）
 * 根据认证方式动态显示字段
 * 支持保存前测试连接
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.6
 */
import React, { useState, useEffect } from 'react'
import { Eye, EyeOff, Save, X, Zap, CheckCircle, XCircle, Loader } from 'lucide-react'
import { 
  DatasourceConfig, 
  DatasourceType, 
  AuthType,
  CreateDatasourceConfigRequest,
  DATASOURCE_TYPES,
  AUTH_TYPES
} from '../../../services/datasource'
import axios from 'axios'

interface ConfigFormProps {
  config: DatasourceConfig | null
  onSave: (data: CreateDatasourceConfigRequest) => void
  onCancel: () => void
}

export const ConfigForm: React.FC<ConfigFormProps> = ({
  config,
  onSave,
  onCancel
}) => {
  // 表单状态
  const [name, setName] = useState('')
  const [type, setType] = useState<DatasourceType>('prometheus')
  const [url, setUrl] = useState('')
  const [authType, setAuthType] = useState<AuthType>('none')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [status, setStatus] = useState(1)
  
  // UI 状态
  const [showPassword, setShowPassword] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  
  // 测试连接状态
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    responseTime?: number
    version?: string
  } | null>(null)

  // 初始化表单数据
  useEffect(() => {
    if (config) {
      setName(config.name)
      setType(config.type)
      setUrl(config.url)
      setAuthType(config.auth_type)
      setUsername(config.username || '')
      setPassword(config.password || '')
      setToken(config.token || '')
      setIsDefault(config.is_default)
      setStatus(config.status)
    } else {
      // 重置表单
      setName('')
      setType('prometheus')
      setUrl('')
      setAuthType('none')
      setUsername('')
      setPassword('')
      setToken('')
      setIsDefault(false)
      setStatus(1)
    }
    setErrors({})
    setTestResult(null)
  }, [config])

  // 验证表单
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = '请输入数据源名称'
    }

    if (!url.trim()) {
      newErrors.url = '请输入服务器 URL'
    } else if (!/^https?:\/\/.+/.test(url)) {
      newErrors.url = 'URL 格式不正确，需要以 http:// 或 https:// 开头'
    }

    if (authType === 'basic') {
      if (!username.trim()) {
        newErrors.username = '请输入用户名'
      }
      if (!password.trim() && !config) {
        newErrors.password = '请输入密码'
      }
    }

    if (authType === 'bearer') {
      if (!token.trim() && !config) {
        newErrors.token = '请输入 Token'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 测试连接
  const handleTestConnection = async () => {
    // 先验证必填字段
    if (!url.trim()) {
      setErrors({ url: '请先输入服务器 URL' })
      return
    }

    if (!/^https?:\/\/.+/.test(url)) {
      setErrors({ url: 'URL 格式不正确' })
      return
    }

    if (authType === 'basic' && (!username.trim() || !password.trim())) {
      setErrors({ 
        username: !username.trim() ? '请输入用户名' : '',
        password: !password.trim() ? '请输入密码' : ''
      })
      return
    }

    if (authType === 'bearer' && !token.trim()) {
      setErrors({ token: '请输入 Token' })
      return
    }

    setTesting(true)
    setTestResult(null)
    setErrors({})

    try {
      // 构建测试 URL
      const testUrl = url.trim().replace(/\/$/, '') + '/api/v1/status/buildinfo'
      
      // 构建认证头
      const headers: Record<string, string> = {}
      if (authType === 'basic' && username && password) {
        const credentials = btoa(`${username}:${password}`)
        headers['Authorization'] = `Basic ${credentials}`
      } else if (authType === 'bearer' && token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const startTime = Date.now()
      
      try {
        const response = await axios.get(testUrl, {
          headers,
          timeout: 10000,
          validateStatus: () => true // 接受所有状态码
        })

        const responseTime = Date.now() - startTime

        if (response.status === 200) {
          const version = response.data?.data?.version || 'unknown'
          setTestResult({
            success: true,
            message: '连接成功！',
            responseTime,
            version
          })
        } else if (response.status === 401 || response.status === 403) {
          setTestResult({
            success: false,
            message: '认证失败，请检查用户名、密码或 Token',
            responseTime
          })
        } else {
          setTestResult({
            success: false,
            message: `连接失败: HTTP ${response.status}`,
            responseTime
          })
        }
      } catch (error: any) {
        if (error.code === 'ECONNABORTED') {
          setTestResult({
            success: false,
            message: '连接超时，请检查 URL 是否正确'
          })
        } else if (error.message.includes('Network Error')) {
          setTestResult({
            success: false,
            message: '网络错误，无法连接到服务器'
          })
        } else {
          setTestResult({
            success: false,
            message: `连接失败: ${error.message}`
          })
        }
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: `测试失败: ${error.message}`
      })
    } finally {
      setTesting(false)
    }
  }

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setSubmitting(true)

    try {
      const data: CreateDatasourceConfigRequest = {
        name: name.trim(),
        type,
        url: url.trim(),
        auth_type: authType,
        is_default: isDefault,
        status
      }

      // 根据认证类型添加凭证
      if (authType === 'basic') {
        data.username = username.trim()
        if (password.trim()) {
          data.password = password.trim()
        }
      } else if (authType === 'bearer') {
        if (token.trim()) {
          data.token = token.trim()
        }
      }

      onSave(data)
    } catch (error) {
      console.error('Submit error:', error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 名称 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          数据源名称 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：生产环境 Prometheus"
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-500">{errors.name}</p>
        )}
      </div>

      {/* 数据源类型 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          数据源类型
        </label>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(DATASOURCE_TYPES) as DatasourceType[]).map((t) => {
            const typeConfig = DATASOURCE_TYPES[t]
            if (!typeConfig) return null
            
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`p-3 border rounded-lg text-left transition-all ${
                  type === t
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium bg-gradient-to-r ${typeConfig.gradient} text-white`}>
                  {typeConfig.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 服务器 URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          服务器 URL <span className="text-red-500">*</span>
        </label>
        <div className="flex space-x-2">
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setTestResult(null) // 清除测试结果
            }}
            placeholder="例如：http://prometheus.example.com:9090"
            className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.url ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || !url.trim()}
            className="group flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            title="测试连接"
          >
            {testing ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span className="font-medium">测试中...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="font-medium">测试连接</span>
              </>
            )}
          </button>
        </div>
        {errors.url && (
          <p className="mt-1 text-sm text-red-500">{errors.url}</p>
        )}
        
        {/* 测试结果 */}
        {testResult && (
          <div className={`mt-2 p-3 rounded-lg border-2 ${
            testResult.success 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start space-x-2">
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-semibold ${
                  testResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {testResult.message}
                </p>
                {testResult.success && testResult.responseTime && (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs text-green-700">
                      响应时间: <span className="font-semibold">{testResult.responseTime}ms</span>
                    </p>
                    {testResult.version && (
                      <p className="text-xs text-green-700">
                        版本: <span className="font-semibold">{testResult.version}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 认证方式 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          认证方式
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(AUTH_TYPES) as AuthType[]).map((a) => {
            const authConfig = AUTH_TYPES[a]
            if (!authConfig) return null
            
            return (
              <button
                key={a}
                type="button"
                onClick={() => setAuthType(a)}
                className={`p-2 border rounded-lg text-sm transition-all ${
                  authType === a
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                {authConfig.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Basic Auth 字段 */}
      {authType === 'basic' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              用户名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setTestResult(null) // 清除测试结果
              }}
              placeholder="输入用户名"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.username ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.username && (
              <p className="mt-1 text-sm text-red-500">{errors.username}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              密码 {!config && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setTestResult(null) // 清除测试结果
                }}
                placeholder={config ? '留空保持不变' : '输入密码'}
                className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-500">{errors.password}</p>
            )}
          </div>
        </>
      )}

      {/* Bearer Token 字段 */}
      {authType === 'bearer' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Token {!config && <span className="text-red-500">*</span>}
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => {
                setToken(e.target.value)
                setTestResult(null) // 清除测试结果
              }}
              placeholder={config ? '留空保持不变' : '输入 Bearer Token'}
              className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.token ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.token && (
            <p className="mt-1 text-sm text-red-500">{errors.token}</p>
          )}
        </div>
      )}

      {/* 状态和默认设置 */}
      <div className="flex items-center space-x-6">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={status === 1}
            onChange={(e) => setStatus(e.target.checked ? 1 : 0)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">启用</span>
        </label>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">设为默认</span>
        </label>
      </div>

      {/* 按钮 */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="flex items-center space-x-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <X className="w-4 h-4" />
          <span>取消</span>
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center space-x-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{submitting ? '保存中...' : '保存'}</span>
        </button>
      </div>
    </form>
  )
}

export default ConfigForm
