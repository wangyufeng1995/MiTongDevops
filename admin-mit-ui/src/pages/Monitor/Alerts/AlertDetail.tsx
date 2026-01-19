/**
 * 告警详情页面
 * 
 * 功能特性：
 * - 告警详细信息展示
 * - 告警处理历史
 * - 相关指标图表
 * - 告警操作记录
 * - 认证状态检查
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft,
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  User,
  Calendar,
  Tag,
  Activity,
  TrendingUp,
  AlertCircle,
  Info,
  Zap
} from 'lucide-react'
import { useAuthStore } from '../../../store/auth'
import { formatDateTime } from '../../../utils'

interface AlertDetail {
  id: string
  title: string
  description: string
  level: 'critical' | 'warning' | 'info'
  status: 'active' | 'acknowledged' | 'resolved'
  source: string
  created_at: string
  updated_at: string
  acknowledged_by?: string
  acknowledged_at?: string
  resolved_by?: string
  resolved_at?: string
  tags: string[]
  metadata: Record<string, any>
  history: AlertHistoryItem[]
  metrics?: AlertMetric[]
}

interface AlertHistoryItem {
  id: string
  action: 'created' | 'acknowledged' | 'resolved' | 'updated'
  user: string
  timestamp: string
  comment?: string
}

interface AlertMetric {
  name: string
  value: number
  unit: string
  timestamp: string
}

export const AlertDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { token, isAuthenticated } = useAuthStore()
  
  const [alert, setAlert] = useState<AlertDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // 检查认证状态
  useEffect(() => {
    if (!isAuthenticated || !token) {
      console.warn('用户未认证，跳转到登录页面')
      navigate('/login')
      return
    }
  }, [isAuthenticated, token, navigate])

  // 加载告警详情
  const loadAlertDetail = useCallback(async () => {
    if (!isAuthenticated || !token || !id) {
      setError('用户未认证或告警ID无效')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 模拟告警详情数据
      const mockAlert: AlertDetail = {
        id: id,
        title: 'CPU使用率过高',
        description: '服务器 web-01 的CPU使用率持续超过90%，可能影响系统性能和用户体验。建议检查运行的进程并优化资源使用。',
        level: 'critical',
        status: 'active',
        source: 'system-monitor',
        created_at: '2024-01-08T10:30:00Z',
        updated_at: '2024-01-08T10:30:00Z',
        tags: ['cpu', 'performance', 'web-01'],
        metadata: {
          hostname: 'web-01.example.com',
          ip_address: '192.168.1.100',
          current_cpu_usage: 94.5,
          threshold: 90,
          duration: '15分钟',
          affected_services: ['nginx', 'php-fpm', 'mysql']
        },
        history: [
          {
            id: '1',
            action: 'created',
            user: 'system',
            timestamp: '2024-01-08T10:30:00Z'
          },
          {
            id: '2',
            action: 'updated',
            user: 'system',
            timestamp: '2024-01-08T10:35:00Z',
            comment: 'CPU使用率继续上升至94.5%'
          }
        ],
        metrics: [
          { name: 'CPU使用率', value: 94.5, unit: '%', timestamp: '2024-01-08T10:35:00Z' },
          { name: '内存使用率', value: 67.8, unit: '%', timestamp: '2024-01-08T10:35:00Z' },
          { name: '负载平均值', value: 3.2, unit: '', timestamp: '2024-01-08T10:35:00Z' },
          { name: '活跃进程数', value: 156, unit: '个', timestamp: '2024-01-08T10:35:00Z' }
        ]
      }
      
      setAlert(mockAlert)
    } catch (err) {
      console.error('加载告警详情失败:', err)
      setError('加载告警详情失败，请检查网络连接或重新登录')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, token, id])

  // 初始加载
  useEffect(() => {
    if (isAuthenticated && token && id) {
      loadAlertDetail()
    }
  }, [loadAlertDetail, isAuthenticated, token, id])

  // 处理告警操作
  const handleAlertAction = async (action: 'acknowledge' | 'resolve', comment?: string) => {
    if (!isAuthenticated || !token || !alert) {
      setError('用户未认证或告警数据无效')
      return
    }

    try {
      setActionLoading(true)
      
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const now = new Date().toISOString()
      const user = 'admin' // 实际应该从认证状态获取
      
      // 更新告警状态
      const updatedAlert: AlertDetail = {
        ...alert,
        status: action === 'acknowledge' ? 'acknowledged' : 'resolved',
        updated_at: now,
        [action === 'acknowledge' ? 'acknowledged_by' : 'resolved_by']: user,
        [action === 'acknowledge' ? 'acknowledged_at' : 'resolved_at']: now,
        history: [
          ...alert.history,
          {
            id: Date.now().toString(),
            action,
            user,
            timestamp: now,
            comment
          }
        ]
      }
      
      setAlert(updatedAlert)
    } catch (err) {
      console.error('告警操作失败:', err)
      setError('操作失败，请重试')
    } finally {
      setActionLoading(false)
    }
  }

  // 获取告警级别样式
  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'critical':
        return {
          icon: <AlertCircle className="w-6 h-6 text-red-500" />,
          text: '严重',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-700'
        }
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-yellow-500" />,
          text: '警告',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-700'
        }
      case 'info':
        return {
          icon: <Info className="w-6 h-6 text-blue-500" />,
          text: '信息',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-700'
        }
      default:
        return {
          icon: <AlertTriangle className="w-6 h-6 text-gray-500" />,
          text: '未知',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-700'
        }
    }
  }

  // 获取状态样式
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active':
        return {
          icon: <Zap className="w-5 h-5 text-red-500" />,
          text: '活跃',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800'
        }
      case 'acknowledged':
        return {
          icon: <Clock className="w-5 h-5 text-yellow-500" />,
          text: '已确认',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800'
        }
      case 'resolved':
        return {
          icon: <CheckCircle className="w-5 h-5 text-green-500" />,
          text: '已解决',
          bgColor: 'bg-green-100',
          textColor: 'text-green-800'
        }
      default:
        return {
          icon: <AlertTriangle className="w-5 h-5 text-gray-500" />,
          text: '未知',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800'
        }
    }
  }

  // 获取操作文本
  const getActionText = (action: string) => {
    switch (action) {
      case 'created':
        return '创建告警'
      case 'acknowledged':
        return '确认告警'
      case 'resolved':
        return '解决告警'
      case 'updated':
        return '更新告警'
      default:
        return '未知操作'
    }
  }

  if (!isAuthenticated || !token) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">认证失败</h3>
          <p className="text-gray-600 mb-4">请重新登录以访问告警详情</p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            前往登录
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-600">正在加载告警详情...</p>
        </div>
      </div>
    )
  }

  if (error || !alert) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">加载失败</h3>
            <p className="text-gray-600 mb-4">{error || '告警详情不存在'}</p>
            <div className="space-x-2">
              <button
                onClick={() => navigate('/monitor/alerts')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                返回列表
              </button>
              <button
                onClick={loadAlertDetail}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                重新加载
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const levelStyle = getLevelStyle(alert.level)
  const statusStyle = getStatusStyle(alert.status)

  return (
    <div className="p-6">
      {/* 页面头部 */}
      <div className="mb-6">
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={() => navigate('/monitor/alerts')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回告警列表</span>
          </button>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{alert.title}</h1>
            <p className="text-gray-600 mt-1">告警ID: {alert.id}</p>
          </div>
          
          {/* 操作按钮 */}
          <div className="flex items-center space-x-2">
            {alert.status === 'active' && (
              <button
                onClick={() => handleAlertAction('acknowledge')}
                disabled={actionLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
              >
                <Clock className="w-4 h-4" />
                <span>确认告警</span>
              </button>
            )}
            
            {(alert.status === 'active' || alert.status === 'acknowledged') && (
              <button
                onClick={() => handleAlertAction('resolve')}
                disabled={actionLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span>解决告警</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 主要信息 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 告警概览 */}
          <div className="bg-white rounded-lg shadow border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">告警概览</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 级别和状态 */}
              <div className="space-y-4">
                <div className={`p-4 rounded-lg border ${levelStyle.bgColor} ${levelStyle.borderColor}`}>
                  <div className="flex items-center space-x-3">
                    {levelStyle.icon}
                    <div>
                      <p className="text-sm text-gray-600">告警级别</p>
                      <p className={`font-semibold ${levelStyle.textColor}`}>
                        {levelStyle.text}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className={`p-4 rounded-lg ${statusStyle.bgColor}`}>
                  <div className="flex items-center space-x-3">
                    {statusStyle.icon}
                    <div>
                      <p className="text-sm text-gray-600">当前状态</p>
                      <p className={`font-semibold ${statusStyle.textColor}`}>
                        {statusStyle.text}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 时间信息 */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">创建时间</p>
                    <p className="font-medium text-gray-900">
                      {formatDateTime(alert.created_at, 'YYYY/MM/DD HH:mm:ss')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Activity className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">最后更新</p>
                    <p className="font-medium text-gray-900">
                      {formatDateTime(alert.updated_at, 'YYYY/MM/DD HH:mm:ss')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 描述 */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-2">详细描述</h3>
              <p className="text-gray-700 leading-relaxed">{alert.description}</p>
            </div>
            
            {/* 标签 */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-2">标签</h3>
              <div className="flex flex-wrap gap-2">
                {alert.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
                  >
                    <Tag className="w-3 h-3 mr-1" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 元数据信息 */}
          <div className="bg-white rounded-lg shadow border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">技术详情</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(alert.metadata).map(([key, value]) => (
                <div key={key} className="border-l-4 border-blue-500 pl-4">
                  <p className="text-sm text-gray-600 capitalize">
                    {key.replace(/_/g, ' ')}
                  </p>
                  <p className="font-medium text-gray-900">
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 相关指标 */}
          {alert.metrics && alert.metrics.length > 0 && (
            <div className="bg-white rounded-lg shadow border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">相关指标</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {alert.metrics.map((metric, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">{metric.name}</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {metric.value}{metric.unit}
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-blue-400" />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {formatDateTime(metric.timestamp, 'YYYY/MM/DD HH:mm:ss')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 侧边栏 */}
        <div className="space-y-6">
          {/* 来源信息 */}
          <div className="bg-white rounded-lg shadow border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">来源信息</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">监控源</p>
                <p className="font-medium text-gray-900">{alert.source}</p>
              </div>
              
              {alert.acknowledged_by && (
                <div>
                  <p className="text-sm text-gray-600">确认人</p>
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <p className="font-medium text-gray-900">{alert.acknowledged_by}</p>
                  </div>
                  {alert.acknowledged_at && (
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDateTime(alert.acknowledged_at, 'YYYY/MM/DD HH:mm:ss')}
                    </p>
                  )}
                </div>
              )}
              
              {alert.resolved_by && (
                <div>
                  <p className="text-sm text-gray-600">解决人</p>
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <p className="font-medium text-gray-900">{alert.resolved_by}</p>
                  </div>
                  {alert.resolved_at && (
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDateTime(alert.resolved_at, 'YYYY/MM/DD HH:mm:ss')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 处理历史 */}
          <div className="bg-white rounded-lg shadow border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">处理历史</h3>
            
            <div className="space-y-4">
              {alert.history.map((item) => (
                <div key={item.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {getActionText(item.action)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(item.timestamp, 'YYYY/MM/DD HH:mm:ss')}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600">
                      操作人: {item.user}
                    </p>
                    {item.comment && (
                      <p className="text-sm text-gray-500 mt-1">
                        {item.comment}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}