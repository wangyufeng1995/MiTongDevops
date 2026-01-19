/**
 * 日志设置页面
 * 
 * 功能特性：
 * - 日志级别配置
 * - 日志轮转设置
 * - 日志存储配置
 * - 日志查看和导出
 * - 认证状态检查
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  FileText,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Download,
  Trash2,
  Search,
  Filter,
  Eye,
  Settings
} from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { formatDateTime } from '../../utils'

interface LogConfig {
  log_level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
  log_format: 'simple' | 'detailed' | 'json'
  log_rotation: {
    enabled: boolean
    max_size: number // MB
    max_files: number
    rotation_time: 'daily' | 'weekly' | 'monthly'
  }
  log_categories: {
    system: boolean
    auth: boolean
    api: boolean
    database: boolean
    security: boolean
    performance: boolean
  }
  log_storage: {
    local_enabled: boolean
    local_path: string
    remote_enabled: boolean
    remote_type: 'syslog' | 'elasticsearch' | 'splunk'
    remote_host: string
    remote_port: number
  }
  log_retention: {
    local_days: number
    remote_days: number
    auto_cleanup: boolean
  }
}

interface LogEntry {
  id: string
  timestamp: string
  level: string
  category: string
  message: string
  source: string
  user?: string
}

export const LogSettings: React.FC = () => {
  const navigate = useNavigate()
  const { token, isAuthenticated, isAdmin } = useAuthStore()
  
  const [config, setConfig] = useState<LogConfig | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

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

  // 加载日志配置
  const loadLogConfig = useCallback(async () => {
    if (!isAuthenticated || !token || !isAdmin()) {
      setError('用户未认证或无管理员权限')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 模拟日志配置数据
      const mockConfig: LogConfig = {
        log_level: 'INFO',
        log_format: 'detailed',
        log_rotation: {
          enabled: true,
          max_size: 100,
          max_files: 10,
          rotation_time: 'daily'
        },
        log_categories: {
          system: true,
          auth: true,
          api: true,
          database: true,
          security: true,
          performance: false
        },
        log_storage: {
          local_enabled: true,
          local_path: '/var/log/mitong',
          remote_enabled: false,
          remote_type: 'syslog',
          remote_host: '',
          remote_port: 514
        },
        log_retention: {
          local_days: 30,
          remote_days: 90,
          auto_cleanup: true
        }
      }
      
      // 模拟日志条目
      const mockLogs: LogEntry[] = [
        {
          id: '1',
          timestamp: '2024-01-08T10:30:15Z',
          level: 'INFO',
          category: 'auth',
          message: '用户 admin 登录成功',
          source: 'auth_service',
          user: 'admin'
        },
        {
          id: '2',
          timestamp: '2024-01-08T10:25:32Z',
          level: 'WARNING',
          category: 'system',
          message: 'CPU使用率超过80%',
          source: 'system_monitor'
        },
        {
          id: '3',
          timestamp: '2024-01-08T10:20:45Z',
          level: 'ERROR',
          category: 'api',
          message: 'API请求失败: /api/users/123 - 404 Not Found',
          source: 'api_server'
        },
        {
          id: '4',
          timestamp: '2024-01-08T10:15:28Z',
          level: 'INFO',
          category: 'database',
          message: '数据库连接池初始化完成',
          source: 'db_manager'
        },
        {
          id: '5',
          timestamp: '2024-01-08T10:10:12Z',
          level: 'CRITICAL',
          category: 'security',
          message: '检测到可疑登录尝试: IP 192.168.1.100',
          source: 'security_monitor'
        }
      ]
      
      setConfig(mockConfig)
      setLogs(mockLogs)
    } catch (err) {
      console.error('加载日志配置失败:', err)
      setError('加载日志配置失败，请检查网络连接或重新登录')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, token, isAdmin])

  // 初始加载
  useEffect(() => {
    if (isAuthenticated && token && isAdmin()) {
      loadLogConfig()
    }
  }, [loadLogConfig, isAuthenticated, token, isAdmin])

  // 保存日志配置
  const handleSaveConfig = async () => {
    if (!isAuthenticated || !token || !isAdmin() || !config) {
      setError('用户未认证或无管理员权限')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      console.log('保存日志配置:', config)
      
      setSuccess('日志配置保存成功')
      
      // 3秒后清除成功消息
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('保存日志配置失败:', err)
      setError('保存日志配置失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  // 更新配置字段
  const updateConfig = (field: string, value: any) => {
    if (!config) return
    
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      setConfig({
        ...config,
        [parent]: {
          ...(config as any)[parent],
          [child]: value
        }
      })
    } else {
      setConfig({
        ...config,
        [field]: value
      })
    }
  }

  // 过滤日志
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (log.user && log.user.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter
    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter
    
    return matchesSearch && matchesLevel && matchesCategory
  })

  // 获取日志级别颜色
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'text-red-700 bg-red-100'
      case 'ERROR':
        return 'text-red-600 bg-red-50'
      case 'WARNING':
        return 'text-yellow-600 bg-yellow-50'
      case 'INFO':
        return 'text-blue-600 bg-blue-50'
      case 'DEBUG':
        return 'text-gray-600 bg-gray-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  if (!isAuthenticated || !token || !isAdmin()) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <FileText className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">权限不足</h3>
          <p className="text-gray-600 mb-4">只有管理员才能访问日志设置</p>
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
          <p className="text-gray-600">正在加载日志设置...</p>
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
            <p className="text-gray-600 mb-4">{error || '日志配置加载失败'}</p>
            <button
              onClick={loadLogConfig}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              重新加载
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* 页面头部 */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">日志设置</h1>
            <p className="text-gray-600 mt-1">管理系统日志配置和查看日志</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={loadLogConfig}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 主要配置 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 基本设置 */}
          {config && (
            <div className="bg-white rounded-lg shadow border p-6">
              <div className="flex items-center mb-4">
                <Settings className="w-5 h-5 text-gray-400 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">基本设置</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    日志级别
                  </label>
                  <select
                    value={config.log_level}
                    onChange={(e) => updateConfig('log_level', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="DEBUG">DEBUG</option>
                    <option value="INFO">INFO</option>
                    <option value="WARNING">WARNING</option>
                    <option value="ERROR">ERROR</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    日志格式
                  </label>
                  <select
                    value={config.log_format}
                    onChange={(e) => updateConfig('log_format', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="simple">简单格式</option>
                    <option value="detailed">详细格式</option>
                    <option value="json">JSON格式</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    本地存储路径
                  </label>
                  <input
                    type="text"
                    value={config.log_storage.local_path}
                    onChange={(e) => updateConfig('log_storage.local_path', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    本地保留天数
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={config.log_retention.local_days}
                    onChange={(e) => updateConfig('log_retention.local_days', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  日志分类
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.log_categories.system}
                      onChange={(e) => updateConfig('log_categories.system', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">系统日志</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.log_categories.auth}
                      onChange={(e) => updateConfig('log_categories.auth', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">认证日志</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.log_categories.api}
                      onChange={(e) => updateConfig('log_categories.api', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">API日志</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.log_categories.database}
                      onChange={(e) => updateConfig('log_categories.database', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">数据库日志</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.log_categories.security}
                      onChange={(e) => updateConfig('log_categories.security', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">安全日志</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.log_categories.performance}
                      onChange={(e) => updateConfig('log_categories.performance', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">性能日志</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 日志轮转设置 */}
          {config && (
            <div className="bg-white rounded-lg shadow border p-6">
              <div className="flex items-center mb-4">
                <RefreshCw className="w-5 h-5 text-gray-400 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">日志轮转</h2>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">启用日志轮转</h3>
                    <p className="text-sm text-gray-500">自动轮转和压缩日志文件</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.log_rotation.enabled}
                      onChange={(e) => updateConfig('log_rotation.enabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                {config.log_rotation.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        最大文件大小 (MB)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={config.log_rotation.max_size}
                        onChange={(e) => updateConfig('log_rotation.max_size', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        保留文件数
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={config.log_rotation.max_files}
                        onChange={(e) => updateConfig('log_rotation.max_files', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        轮转周期
                      </label>
                      <select
                        value={config.log_rotation.rotation_time}
                        onChange={(e) => updateConfig('log_rotation.rotation_time', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="daily">每日</option>
                        <option value="weekly">每周</option>
                        <option value="monthly">每月</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 日志查看 */}
          <div className="bg-white rounded-lg shadow border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Eye className="w-5 h-5 text-gray-400 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">最近日志</h2>
              </div>
              
              <button className="flex items-center space-x-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Download className="w-4 h-4" />
                <span>导出日志</span>
              </button>
            </div>
            
            {/* 搜索和筛选 */}
            <div className="mb-4 flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="搜索日志内容..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex gap-2">
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">所有级别</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="ERROR">ERROR</option>
                  <option value="WARNING">WARNING</option>
                  <option value="INFO">INFO</option>
                  <option value="DEBUG">DEBUG</option>
                </select>
                
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">所有分类</option>
                  <option value="system">系统</option>
                  <option value="auth">认证</option>
                  <option value="api">API</option>
                  <option value="database">数据库</option>
                  <option value="security">安全</option>
                  <option value="performance">性能</option>
                </select>
              </div>
            </div>
            
            {/* 日志列表 */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(log.level)}`}>
                          {log.level}
                        </span>
                        <span className="text-xs text-gray-500">{log.category}</span>
                        <span className="text-xs text-gray-500">{log.source}</span>
                        {log.user && (
                          <span className="text-xs text-blue-600">@{log.user}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-900">{log.message}</p>
                    </div>
                    <span className="text-xs text-gray-500 ml-4">
                      {formatDateTime(log.timestamp, 'YYYY/MM/DD HH:mm:ss')}
                    </span>
                  </div>
                </div>
              ))}
              
              {filteredLogs.length === 0 && (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">暂无日志数据</h3>
                  <p className="text-gray-500">
                    {searchTerm || levelFilter !== 'all' || categoryFilter !== 'all'
                      ? '没有符合筛选条件的日志'
                      : '系统暂无日志记录'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 侧边栏 */}
        <div className="space-y-6">
          {/* 日志统计 */}
          <div className="bg-white rounded-lg shadow border p-6">
            <div className="flex items-center mb-4">
              <FileText className="w-5 h-5 text-gray-400 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">日志统计</h2>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">今日日志</span>
                <span className="text-sm font-medium text-gray-900">1,234</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">错误日志</span>
                <span className="text-sm font-medium text-red-600">23</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">警告日志</span>
                <span className="text-sm font-medium text-yellow-600">156</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">日志文件大小</span>
                <span className="text-sm font-medium text-gray-900">45.6 MB</span>
              </div>
            </div>
          </div>

          {/* 快速操作 */}
          <div className="bg-white rounded-lg shadow border p-6">
            <div className="flex items-center mb-4">
              <Settings className="w-5 h-5 text-gray-400 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">快速操作</h2>
            </div>
            
            <div className="space-y-3">
              <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200">
                清理过期日志
              </button>
              
              <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200">
                压缩日志文件
              </button>
              
              <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200">
                重新加载配置
              </button>
              
              <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200">
                查看日志文件
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}