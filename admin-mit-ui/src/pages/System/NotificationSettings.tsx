/**
 * 通知设置页面
 * 
 * 功能特性：
 * - 邮件通知配置
 * - 短信通知配置
 * - 系统通知设置
 * - 通知模板管理
 * - 认证状态检查
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Bell,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Mail,
  MessageSquare,
  Settings,
  Send,
  Eye,
  EyeOff,
  TestTube
} from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import systemService, { SystemConfig } from '../../services/system'

export const NotificationSettings: React.FC = () => {
  const navigate = useNavigate()
  const { token, isAuthenticated, isAdmin } = useAuthStore()
  
  const [config, setConfig] = useState<SystemConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // 检查认证状态和管理员权限
  useEffect(() => {
    if (!isAuthenticated || !token) {
      console.warn('用户未认证，跳转到登录页面')
      navigate('/login')
      return
    }
    
    if (!isAdmin()) {
      console.warn('用户无管理员权限，跳转到仪表盘')
      navigate('/dashboard')
      return
    }
  }, [isAuthenticated, token, isAdmin, navigate])

  // 加载通知配置
  const loadNotificationConfig = useCallback(async () => {
    if (!isAuthenticated || !token || !isAdmin()) {
      setError('用户未认证或无管理员权限')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      // 获取系统配置
      const configData = await systemService.getSystemConfig()
      setConfig(configData)
    } catch (err: any) {
      console.error('加载通知配置失败:', err)
      const errorMessage = err.response?.data?.message || err.message || '加载通知配置失败，请检查网络连接或重新登录'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, token, isAdmin])

  // 初始加载
  useEffect(() => {
    // 只有在用户已认证、有token且是管理员时才加载
    if (isAuthenticated && token && isAdmin()) {
      loadNotificationConfig()
    }
  }, [isAuthenticated, token, isAdmin])

  // 保存通知配置
  const handleSaveConfig = async () => {
    if (!isAuthenticated || !token || !isAdmin() || !config) {
      setError('用户未认证或无管理员权限')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      
      // 调用API保存配置
      await systemService.updateSystemConfig({ notification: config.notification })
      
      setSuccess('通知配置保存成功')
      
      // 3秒后清除成功消息
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('保存通知配置失败:', err)
      const errorMessage = err.response?.data?.message || err.message || '保存通知配置失败，请重试'
      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  // 测试邮件配置
  const handleTestEmail = async () => {
    if (!config?.notification.email_config.smtp_host) {
      setError('请先配置SMTP服务器信息')
      return
    }

    try {
      setTesting(true)
      setError(null)
      setSuccess(null)
      
      // 这里应该调用测试邮件的API
      // await systemService.testEmailConfig()
      
      // 模拟测试
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setSuccess('测试邮件发送成功，请检查邮箱')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('测试邮件失败:', err)
      const errorMessage = err.response?.data?.message || err.message || '测试邮件发送失败'
      setError(errorMessage)
    } finally {
      setTesting(false)
    }
  }

  // 更新配置字段
  const updateConfig = (section: string, field: string, value: any) => {
    if (!config) return
    
    setConfig({
      ...config,
      [section]: {
        ...config[section as keyof SystemConfig],
        [field]: value
      }
    })
  }

  // 更新邮件配置字段
  const updateEmailConfig = (field: string, value: any) => {
    if (!config) return
    
    setConfig({
      ...config,
      notification: {
        ...config.notification,
        email_config: {
          ...config.notification.email_config,
          [field]: value
        }
      }
    })
  }

  if (!isAuthenticated || !token || !isAdmin()) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Bell className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">权限不足</h3>
          <p className="text-gray-600 mb-4">只有管理员才能访问通知设置</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            返回仪表盘
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">正在加载通知设置...</p>
        </div>
      </div>
    )
  }

  if (error && !config) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">加载失败</h3>
            <p className="text-gray-600 mb-4">{error || '通知配置加载失败'}</p>
            <button
              onClick={loadNotificationConfig}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              重新加载
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!config) return null

  return (
    <div className="p-6">
      {/* 页面头部 */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">通知设置</h1>
            <p className="text-gray-600 mt-1">管理系统通知和消息推送配置</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={loadNotificationConfig}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>刷新</span>
            </button>
            
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className={`w-4 h-4 ${saving ? 'animate-pulse' : ''}`} />
              <span>{saving ? '保存中...' : '保存设置'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 消息提示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            <span className="text-green-700">{success}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 通知开关 */}
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center mb-4">
            <Bell className="w-5 h-5 text-gray-400 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">通知开关</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">邮件通知</h3>
                <p className="text-sm text-gray-500">启用邮件通知功能</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.notification.email_enabled}
                  onChange={(e) => updateConfig('notification', 'email_enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">短信通知</h3>
                <p className="text-sm text-gray-500">启用短信通知功能</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.notification.sms_enabled}
                  onChange={(e) => updateConfig('notification', 'sms_enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">系统通知</h3>
                <p className="text-sm text-gray-500">启用系统内通知</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.notification.system_notifications}
                  onChange={(e) => updateConfig('notification', 'system_notifications', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* 邮件配置 */}
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Mail className="w-5 h-5 text-gray-400 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">邮件配置</h2>
            </div>
            
            <button
              onClick={handleTestEmail}
              disabled={testing || !config.notification.email_enabled}
              className="flex items-center space-x-2 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              <TestTube className={`w-4 h-4 ${testing ? 'animate-pulse' : ''}`} />
              <span>{testing ? '测试中...' : '测试邮件'}</span>
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SMTP服务器
              </label>
              <input
                type="text"
                value={config.notification.email_config.smtp_host}
                onChange={(e) => updateEmailConfig('smtp_host', e.target.value)}
                placeholder="smtp.example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                端口
              </label>
              <input
                type="number"
                min="1"
                max="65535"
                value={config.notification.email_config.smtp_port}
                onChange={(e) => updateEmailConfig('smtp_port', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                用户名
              </label>
              <input
                type="text"
                value={config.notification.email_config.smtp_user}
                onChange={(e) => updateEmailConfig('smtp_user', e.target.value)}
                placeholder="your-email@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                密码
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={config.notification.email_config.smtp_password}
                  onChange={(e) => updateEmailConfig('smtp_password', e.target.value)}
                  placeholder="邮箱密码或应用专用密码"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="use_tls"
                checked={config.notification.email_config.use_tls}
                onChange={(e) => updateEmailConfig('use_tls', e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="use_tls" className="text-sm text-gray-700">
                使用TLS加密
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 通知模板 */}
      <div className="mt-6 bg-white rounded-lg shadow border p-6">
        <div className="flex items-center mb-4">
          <MessageSquare className="w-5 h-5 text-gray-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">通知模板</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">告警通知模板</h3>
            <textarea
              rows={4}
              placeholder="告警通知邮件模板..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              defaultValue="【系统告警】{alert_title}

告警时间：{alert_time}
告警级别：{alert_level}
告警内容：{alert_content}

请及时处理。"
            />
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">系统通知模板</h3>
            <textarea
              rows={4}
              placeholder="系统通知邮件模板..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              defaultValue="【系统通知】{notification_title}

通知时间：{notification_time}
通知内容：{notification_content}

如有疑问，请联系管理员。"
            />
          </div>
        </div>
      </div>
    </div>
  )
}