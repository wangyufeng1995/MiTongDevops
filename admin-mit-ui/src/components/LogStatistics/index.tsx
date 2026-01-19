/**
 * 日志统计组件
 */
import React, { useState, useEffect } from 'react'
import { 
  Activity, 
  Users, 
  AlertTriangle, 
  CheckCircle,
  TrendingUp,
  BarChart3
} from 'lucide-react'
import { logService } from '../../services/logs'
import { LogStatistics as LogStatsType } from '../../types/log'

interface LogStatisticsProps {
  className?: string
}

export const LogStatistics: React.FC<LogStatisticsProps> = ({ className = '' }) => {
  const [stats, setStats] = useState<LogStatsType | null>(null)
  const [loading, setLoading] = useState(false)

  const loadStatistics = async () => {
    setLoading(true)
    try {
      const response = await logService.getLogStatistics()
      if (response.success && response.data) {
        setStats(response.data)
      }
    } catch (error) {
      console.error('加载日志统计失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatistics()
  }, [])

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const statCards = [
    {
      title: '总日志数',
      value: (stats.total_logs ?? 0).toLocaleString(),
      icon: Activity,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: '今日日志',
      value: (stats.today_logs ?? 0).toLocaleString(),
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: '错误日志',
      value: (stats.error_logs ?? 0).toLocaleString(),
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    },
    {
      title: '成功率',
      value: `${(stats.success_rate ?? 0).toFixed(1)}%`,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100'
    }
  ]

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">日志统计</h3>
          <button
            onClick={loadStatistics}
            disabled={loading}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            刷新
          </button>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {statCards.map((card, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-lg font-semibold text-gray-900">{card.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 活跃用户和操作统计 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 活跃用户 */}
          <div>
            <div className="flex items-center mb-3">
              <Users className="w-4 h-4 text-gray-500 mr-2" />
              <h4 className="text-sm font-medium text-gray-900">活跃用户 TOP 5</h4>
            </div>
            <div className="space-y-2">
              {(stats.top_users || []).slice(0, 5).map((user, index) => (
                <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-900">{user.username}</span>
                  <span className="text-sm font-medium text-gray-600">{user.count}</span>
                </div>
              ))}
              {(!stats.top_users || stats.top_users.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-4">暂无数据</p>
              )}
            </div>
          </div>

          {/* 热门操作 */}
          <div>
            <div className="flex items-center mb-3">
              <BarChart3 className="w-4 h-4 text-gray-500 mr-2" />
              <h4 className="text-sm font-medium text-gray-900">热门操作 TOP 5</h4>
            </div>
            <div className="space-y-2">
              {(stats.top_actions || []).slice(0, 5).map((action, index) => (
                <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-900">{action.action}</span>
                  <span className="text-sm font-medium text-gray-600">{action.count}</span>
                </div>
              ))}
              {(!stats.top_actions || stats.top_actions.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-4">暂无数据</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LogStatistics