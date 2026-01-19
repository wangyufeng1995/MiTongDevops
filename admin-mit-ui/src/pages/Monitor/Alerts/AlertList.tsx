/**
 * 告警列表页面
 * 
 * 功能特性：
 * - 告警列表展示
 * - 告警状态筛选
 * - 告警级别筛选
 * - 告警处理操作
 * - 实时数据更新
 * - 认证状态检查
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Filter, 
  RefreshCw, 
  Search,
  Eye,
  AlertCircle,
  XCircle,
  Info,
  Zap
} from 'lucide-react'
import { useAuthStore } from '../../../store/auth'
import { formatDateTime } from '../../../utils'

interface Alert {
  id: string
  title: string
  description: string
  level: 'critical' | 'warning' | 'info'
  status: 'active' | 'acknowledged' | 'resolved'
  source: string
  created_at: string
  updated_at: string
  acknowledged_by?: string
  resolved_by?: string
  tags: string[]
}

export const AlertList: React.FC = () => {
  const navigate = useNavigate()
  const { token, isAuthenticated } = useAuthStore()
  
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)

  // 检查认证状态
  useEffect(() => {
    if (!isAuthenticated || !token) {
      console.warn('用户未认证，跳转到登录页面')
      navigate('/login')
      return
    }
  }, [isAuthenticated, token, navigate])

  // 加载告警数据
  const loadAlerts = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setError('用户未认证，请重新登录')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      // 模拟API调用 - 实际项目中应该调用真实的API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 模拟告警数据
      const mockAlerts: Alert[] = [
        {
          id: '1',
          title: 'CPU使用率过高',
          description: '服务器 web-01 的CPU使用率持续超过90%',
          level: 'critical',
          status: 'active',
          source: 'system-monitor',
          created_at: '2024-01-08T10:30:00Z',
          updated_at: '2024-01-08T10:30:00Z',
          tags: ['cpu', 'performance', 'web-01']
        },
        {
          id: '2',
          title: '内存使用率告警',
          description: '数据库服务器内存使用率达到85%',
          level: 'warning',
          status: 'acknowledged',
          source: 'database-monitor',
          created_at: '2024-01-08T09:15:00Z',
          updated_at: '2024-01-08T09:45:00Z',
          acknowledged_by: 'admin',
          tags: ['memory', 'database', 'db-01']
        },
        {
          id: '3',
          title: '磁盘空间不足',
          description: '/var/log 目录磁盘使用率超过95%',
          level: 'critical',
          status: 'active',
          source: 'disk-monitor',
          created_at: '2024-01-08T08:20:00Z',
          updated_at: '2024-01-08T08:20:00Z',
          tags: ['disk', 'storage', 'log-server']
        },
        {
          id: '4',
          title: '网络连接异常',
          description: '与外部API服务的连接出现间歇性中断',
          level: 'warning',
          status: 'resolved',
          source: 'network-monitor',
          created_at: '2024-01-08T07:10:00Z',
          updated_at: '2024-01-08T07:30:00Z',
          resolved_by: 'admin',
          tags: ['network', 'api', 'connectivity']
        },
        {
          id: '5',
          title: '备份任务失败',
          description: '昨夜的数据库备份任务执行失败',
          level: 'warning',
          status: 'active',
          source: 'backup-monitor',
          created_at: '2024-01-08T02:00:00Z',
          updated_at: '2024-01-08T02:00:00Z',
          tags: ['backup', 'database', 'maintenance']
        },
        {
          id: '6',
          title: '系统更新通知',
          description: '有新的安全更新可用，建议尽快安装',
          level: 'info',
          status: 'active',
          source: 'update-monitor',
          created_at: '2024-01-08T06:00:00Z',
          updated_at: '2024-01-08T06:00:00Z',
          tags: ['update', 'security', 'maintenance']
        }
      ]
      
      setAlerts(mockAlerts)
    } catch (err) {
      console.error('加载告警数据失败:', err)
      setError('加载告警数据失败，请检查网络连接或重新登录')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, token])

  // 初始加载
  useEffect(() => {
    if (isAuthenticated && token) {
      loadAlerts()
    }
  }, [loadAlerts, isAuthenticated, token])

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh || !isAuthenticated) return

    const interval = setInterval(() => {
      loadAlerts()
    }, 30000) // 30秒刷新一次

    return () => clearInterval(interval)
  }, [autoRefresh, loadAlerts, isAuthenticated])

  // 过滤告警
  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alert.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alert.source.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesLevel = levelFilter === 'all' || alert.level === levelFilter
    const matchesStatus = statusFilter === 'all' || alert.status === statusFilter
    
    return matchesSearch && matchesLevel && matchesStatus
  })

  // 获取告警级别图标和颜色
  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-500" />
    }
  }

  // 获取状态图标和颜色
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Zap className="w-4 h-4 text-red-500" />
      case 'acknowledged':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      default:
        return <XCircle className="w-4 h-4 text-gray-500" />
    }
  }

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '活跃'
      case 'acknowledged':
        return '已确认'
      case 'resolved':
        return '已解决'
      default:
        return '未知'
    }
  }

  // 获取级别文本
  const getLevelText = (level: string) => {
    switch (level) {
      case 'critical':
        return '严重'
      case 'warning':
        return '警告'
      case 'info':
        return '信息'
      default:
        return '未知'
    }
  }

  // 处理告警操作
  const handleAlertAction = async (alertId: string, action: 'acknowledge' | 'resolve') => {
    if (!isAuthenticated || !token) {
      setError('用户未认证，请重新登录')
      return
    }

    try {
      // 这里应该调用实际的API
      console.log(`执行告警操作: ${action} for alert ${alertId}`)
      
      // 更新本地状态
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { 
              ...alert, 
              status: action === 'acknowledge' ? 'acknowledged' : 'resolved',
              updated_at: new Date().toISOString(),
              [action === 'acknowledge' ? 'acknowledged_by' : 'resolved_by']: 'admin'
            }
          : alert
      ))
    } catch (err) {
      console.error(`告警操作失败:`, err)
      setError('操作失败，请重试')
    }
  }

  // 查看告警详情
  const handleViewDetail = (alertId: string) => {
    navigate(`/monitor/alerts/detail/${alertId}`)
  }

  if (!isAuthenticated || !token) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">认证失败</h3>
          <p className="text-gray-600 mb-4">请重新登录以访问告警管理页面</p>
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

  if (loading && alerts.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">正在加载告警数据...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* 页面头部 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">告警管理</h1>
        <p className="text-gray-600 mt-1">监控系统告警信息，及时处理异常情况</p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 工具栏 */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        {/* 搜索框 */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="搜索告警标题、描述或来源..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 筛选器 */}
        <div className="flex gap-2">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">所有级别</option>
            <option value="critical">严重</option>
            <option value="warning">警告</option>
            <option value="info">信息</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">所有状态</option>
            <option value="active">活跃</option>
            <option value="acknowledged">已确认</option>
            <option value="resolved">已解决</option>
          </select>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-600">自动刷新</span>
          </label>

          <button
            onClick={loadAlerts}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>刷新</span>
          </button>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">总告警数</p>
              <p className="text-2xl font-bold text-gray-900">{alerts.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">活跃告警</p>
              <p className="text-2xl font-bold text-red-600">
                {alerts.filter(a => a.status === 'active').length}
              </p>
            </div>
            <Zap className="w-8 h-8 text-red-400" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">已确认</p>
              <p className="text-2xl font-bold text-yellow-600">
                {alerts.filter(a => a.status === 'acknowledged').length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">已解决</p>
              <p className="text-2xl font-bold text-green-600">
                {alerts.filter(a => a.status === 'resolved').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>
      </div>

      {/* 告警列表 */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            告警列表 ({filteredAlerts.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  级别
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  告警信息
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  来源
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAlerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getLevelIcon(alert.level)}
                      <span className="text-sm font-medium text-gray-900">
                        {getLevelText(alert.level)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {alert.title}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {alert.description}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {alert.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {alert.source}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(alert.status)}
                      <span className="text-sm text-gray-900">
                        {getStatusText(alert.status)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateTime(alert.created_at, 'YYYY/MM/DD HH:mm:ss')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleViewDetail(alert.id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      
                      {alert.status === 'active' && (
                        <button
                          onClick={() => handleAlertAction(alert.id, 'acknowledge')}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="确认告警"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                      )}
                      
                      {(alert.status === 'active' || alert.status === 'acknowledged') && (
                        <button
                          onClick={() => handleAlertAction(alert.id, 'resolve')}
                          className="text-green-600 hover:text-green-900"
                          title="解决告警"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredAlerts.length === 0 && (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无告警数据</h3>
              <p className="text-gray-500">
                {searchTerm || levelFilter !== 'all' || statusFilter !== 'all'
                  ? '没有符合筛选条件的告警'
                  : '系统运行正常，暂无告警信息'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}