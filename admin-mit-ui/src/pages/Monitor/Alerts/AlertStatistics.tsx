/**
 * 告警统计页面
 * 
 * 功能特性：
 * - 告警统计图表
 * - 趋势分析
 * - 分类统计
 * - 时间范围筛选
 * - 认证状态检查
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  BarChart3,
  PieChart,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Activity
} from 'lucide-react'
import { useAuthStore } from '../../../store/auth'
import { formatDateTime } from '../../../utils'

interface AlertStatistics {
  total_alerts: number
  active_alerts: number
  acknowledged_alerts: number
  resolved_alerts: number
  critical_alerts: number
  warning_alerts: number
  info_alerts: number
  avg_resolution_time: number
  resolution_rate: number
  trend_data: TrendData[]
  level_distribution: LevelDistribution[]
  source_distribution: SourceDistribution[]
  daily_stats: DailyStats[]
}

interface TrendData {
  date: string
  active: number
  resolved: number
  total: number
}

interface LevelDistribution {
  level: 'critical' | 'warning' | 'info'
  count: number
  percentage: number
}

interface SourceDistribution {
  source: string
  count: number
  percentage: number
}

interface DailyStats {
  date: string
  created: number
  resolved: number
  avg_resolution_time: number
}

export const AlertStatistics: React.FC = () => {
  const navigate = useNavigate()
  const { token, isAuthenticated } = useAuthStore()
  
  const [statistics, setStatistics] = useState<AlertStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [autoRefresh, setAutoRefresh] = useState(true)

  // 检查认证状态
  useEffect(() => {
    if (!isAuthenticated || !token) {
      console.warn('用户未认证，跳转到登录页面')
      navigate('/login')
      return
    }
  }, [isAuthenticated, token, navigate])

  // 加载统计数据
  const loadStatistics = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setError('用户未认证，请重新登录')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // 模拟统计数据
      const mockStatistics: AlertStatistics = {
        total_alerts: 156,
        active_alerts: 23,
        acknowledged_alerts: 12,
        resolved_alerts: 121,
        critical_alerts: 8,
        warning_alerts: 45,
        info_alerts: 103,
        avg_resolution_time: 4.2, // hours
        resolution_rate: 87.5, // percentage
        trend_data: [
          { date: '2024-01-01', active: 15, resolved: 8, total: 23 },
          { date: '2024-01-02', active: 18, resolved: 12, total: 30 },
          { date: '2024-01-03', active: 12, resolved: 15, total: 27 },
          { date: '2024-01-04', active: 20, resolved: 10, total: 30 },
          { date: '2024-01-05', active: 16, resolved: 18, total: 34 },
          { date: '2024-01-06', active: 14, resolved: 16, total: 30 },
          { date: '2024-01-07', active: 23, resolved: 12, total: 35 },
        ],
        level_distribution: [
          { level: 'critical', count: 8, percentage: 5.1 },
          { level: 'warning', count: 45, percentage: 28.8 },
          { level: 'info', count: 103, percentage: 66.1 }
        ],
        source_distribution: [
          { source: 'system-monitor', count: 45, percentage: 28.8 },
          { source: 'network-monitor', count: 38, percentage: 24.4 },
          { source: 'database-monitor', count: 32, percentage: 20.5 },
          { source: 'application-monitor', count: 25, percentage: 16.0 },
          { source: 'security-monitor', count: 16, percentage: 10.3 }
        ],
        daily_stats: [
          { date: '2024-01-01', created: 23, resolved: 18, avg_resolution_time: 3.5 },
          { date: '2024-01-02', created: 30, resolved: 25, avg_resolution_time: 4.2 },
          { date: '2024-01-03', created: 27, resolved: 22, avg_resolution_time: 3.8 },
          { date: '2024-01-04', created: 30, resolved: 28, avg_resolution_time: 5.1 },
          { date: '2024-01-05', created: 34, resolved: 30, avg_resolution_time: 4.6 },
          { date: '2024-01-06', created: 30, resolved: 26, avg_resolution_time: 3.9 },
          { date: '2024-01-07', created: 35, resolved: 32, avg_resolution_time: 4.3 }
        ]
      }
      
      setStatistics(mockStatistics)
    } catch (err) {
      console.error('加载统计数据失败:', err)
      setError('加载统计数据失败，请检查网络连接或重新登录')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, token, timeRange])

  // 初始加载
  useEffect(() => {
    if (isAuthenticated && token) {
      loadStatistics()
    }
  }, [loadStatistics, isAuthenticated, token])

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh || !isAuthenticated) return

    const interval = setInterval(() => {
      loadStatistics()
    }, 60000) // 1分钟刷新一次

    return () => clearInterval(interval)
  }, [autoRefresh, loadStatistics, isAuthenticated])

  // 获取级别颜色
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-500'
      case 'warning':
        return 'bg-yellow-500'
      case 'info':
        return 'bg-blue-500'
      default:
        return 'bg-gray-500'
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

  // 获取时间范围文本
  const getTimeRangeText = (range: string) => {
    switch (range) {
      case '7d':
        return '最近7天'
      case '30d':
        return '最近30天'
      case '90d':
        return '最近90天'
      default:
        return '最近30天'
    }
  }

  if (!isAuthenticated || !token) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">认证失败</h3>
          <p className="text-gray-600 mb-4">请重新登录以访问统计页面</p>
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

  if (loading && !statistics) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">正在加载统计数据...</p>
        </div>
      </div>
    )
  }

  if (error || !statistics) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">加载失败</h3>
            <p className="text-gray-600 mb-4">{error || '统计数据加载失败'}</p>
            <button
              onClick={loadStatistics}
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
            <h1 className="text-2xl font-bold text-gray-900">告警统计</h1>
            <p className="text-gray-600 mt-1">告警数据分析和趋势统计</p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* 时间范围选择 */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="7d">最近7天</option>
              <option value="30d">最近30天</option>
              <option value="90d">最近90天</option>
            </select>

            {/* 自动刷新开关 */}
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-600">自动刷新</span>
            </label>

            {/* 刷新按钮 */}
            <button
              onClick={loadStatistics}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>刷新</span>
            </button>
          </div>
        </div>
      </div>

      {/* 概览统计卡片 */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">总告警数</p>
              <p className="text-2xl font-bold text-gray-900">{statistics.total_alerts}</p>
              <p className="text-sm text-gray-500 mt-1">{getTimeRangeText(timeRange)}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <BarChart3 className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">活跃告警</p>
              <p className="text-2xl font-bold text-red-600">{statistics.active_alerts}</p>
              <p className="text-sm text-gray-500 mt-1">需要处理</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <Zap className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">解决率</p>
              <p className="text-2xl font-bold text-green-600">{statistics.resolution_rate.toFixed(1)}%</p>
              <p className="text-sm text-gray-500 mt-1">
                {statistics.resolved_alerts}/{statistics.total_alerts} 已解决
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">平均解决时间</p>
              <p className="text-2xl font-bold text-purple-600">{statistics.avg_resolution_time.toFixed(1)}h</p>
              <p className="text-sm text-gray-500 mt-1">小时</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Clock className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 告警趋势图 */}
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">告警趋势</h2>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="space-y-4">
            {statistics.trend_data.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">
                    {formatDateTime(item.date, 'YYYY/MM/DD')}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-red-600">活跃: {item.active}</span>
                  <span className="text-green-600">解决: {item.resolved}</span>
                  <span className="text-gray-600">总计: {item.total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 级别分布 */}
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">级别分布</h2>
            <PieChart className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="space-y-4">
            {statistics.level_distribution.map((item) => (
              <div key={item.level} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded ${getLevelColor(item.level)}`}></div>
                  <span className="text-sm font-medium text-gray-900">
                    {getLevelText(item.level)}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">{item.count}</span>
                  <span className="text-sm text-gray-500">({item.percentage.toFixed(1)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 来源分布 */}
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">来源分布</h2>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="space-y-4">
            {statistics.source_distribution.map((item, index) => (
              <div key={item.source} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    {item.source}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{item.count}</span>
                    <span className="text-sm text-gray-500">({item.percentage.toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 每日统计 */}
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">每日统计</h2>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="space-y-4">
            {statistics.daily_stats.slice(-5).map((item, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    {formatDateTime(item.date, 'YYYY/MM/DD')}
                  </span>
                  <span className="text-xs text-gray-500">
                    平均解决时间: {item.avg_resolution_time.toFixed(1)}h
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-600">创建: {item.created}</span>
                  <span className="text-green-600">解决: {item.resolved}</span>
                  <span className="text-gray-600">
                    解决率: {((item.resolved / item.created) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}