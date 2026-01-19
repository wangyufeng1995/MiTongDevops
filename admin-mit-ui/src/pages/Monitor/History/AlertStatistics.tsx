/**
 * 告警统计图表组件
 */
import React, { useState, useEffect } from 'react'
import { 
  TrendingUp, Activity, AlertTriangle, CheckCircle, Clock, 
  BarChart3, PieChart, Calendar, RefreshCw
} from 'lucide-react'
import { api } from '../../../services/api'
import { useTheme } from '../../../hooks/useTheme'
import { MonitorPageLayout, MonitorStatCard, MonitorContentCard } from '../../../components/Monitor'
import ReactECharts from 'echarts-for-react'

interface StatisticsData {
  total_alerts: number
  active_alerts: number
  acknowledged_alerts: number
  resolved_alerts: number
  critical_alerts: number
  warning_alerts: number
  info_alerts: number
  avg_resolution_time: number
  resolution_rate: number
  trend_data: Array<{
    date: string
    active: number
    resolved: number
    total: number
  }>
  level_distribution: Array<{
    level: string
    count: number
    percentage: number
  }>
  source_distribution: Array<{
    source: string
    count: number
    percentage: number
  }>
  daily_stats: Array<{
    date: string
    created: number
    resolved: number
    avg_resolution_time: number
  }>
}

export const AlertStatistics: React.FC = () => {
  const { isDark } = useTheme()
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d')
  const [statistics, setStatistics] = useState<StatisticsData | null>(null)

  const loadStatistics = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/monitor/alerts/statistics', {
        params: { time_range: timeRange }
      })
      
      if (response.success && response.data) {
        setStatistics(response.data)
      }
    } catch (error) {
      console.error('加载统计数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadStatistics() }, [timeRange])

  // 趋势图配置
  const getTrendChartOption = () => {
    if (!statistics) return {}
    
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#e5e7eb',
        textStyle: { color: isDark ? '#e5e7eb' : '#374151' }
      },
      legend: {
        data: ['总告警', '活跃', '已解决'],
        textStyle: { color: isDark ? '#e5e7eb' : '#374151' }
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: statistics.trend_data.map(d => d.date),
        axisLine: { lineStyle: { color: isDark ? '#475569' : '#d1d5db' } },
        axisLabel: { color: isDark ? '#94a3b8' : '#6b7280' }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: isDark ? '#475569' : '#d1d5db' } },
        axisLabel: { color: isDark ? '#94a3b8' : '#6b7280' },
        splitLine: { lineStyle: { color: isDark ? '#334155' : '#f3f4f6' } }
      },
      series: [
        {
          name: '总告警',
          type: 'line',
          data: statistics.trend_data.map(d => d.total),
          smooth: true,
          lineStyle: { color: '#3b82f6' },
          areaStyle: { color: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.2)' }
        },
        {
          name: '活跃',
          type: 'line',
          data: statistics.trend_data.map(d => d.active),
          smooth: true,
          lineStyle: { color: '#ef4444' }
        },
        {
          name: '已解决',
          type: 'line',
          data: statistics.trend_data.map(d => d.resolved),
          smooth: true,
          lineStyle: { color: '#10b981' }
        }
      ]
    }
  }

  // 级别分布饼图配置
  const getLevelPieChartOption = () => {
    if (!statistics) return {}
    
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#e5e7eb',
        textStyle: { color: isDark ? '#e5e7eb' : '#374151' }
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        textStyle: { color: isDark ? '#e5e7eb' : '#374151' }
      },
      series: [
        {
          name: '告警级别',
          type: 'pie',
          radius: '50%',
          data: statistics.level_distribution.map(d => ({
            value: d.count,
            name: d.level === 'critical' ? '严重' : d.level === 'warning' ? '警告' : '信息'
          })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          label: {
            color: isDark ? '#e5e7eb' : '#374151'
          }
        }
      ],
      color: ['#ef4444', '#f59e0b', '#3b82f6']
    }
  }

  // 每日统计柱状图配置
  const getDailyStatsChartOption = () => {
    if (!statistics) return {}
    
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#e5e7eb',
        textStyle: { color: isDark ? '#e5e7eb' : '#374151' }
      },
      legend: {
        data: ['新增告警', '已解决'],
        textStyle: { color: isDark ? '#e5e7eb' : '#374151' }
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: statistics.daily_stats.map(d => d.date),
        axisLine: { lineStyle: { color: isDark ? '#475569' : '#d1d5db' } },
        axisLabel: { color: isDark ? '#94a3b8' : '#6b7280' }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: isDark ? '#475569' : '#d1d5db' } },
        axisLabel: { color: isDark ? '#94a3b8' : '#6b7280' },
        splitLine: { lineStyle: { color: isDark ? '#334155' : '#f3f4f6' } }
      },
      series: [
        {
          name: '新增告警',
          type: 'bar',
          data: statistics.daily_stats.map(d => d.created),
          itemStyle: { color: '#3b82f6' }
        },
        {
          name: '已解决',
          type: 'bar',
          data: statistics.daily_stats.map(d => d.resolved),
          itemStyle: { color: '#10b981' }
        }
      ]
    }
  }

  const headerActions = (
    <div className="flex items-center space-x-3">
      <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}
        className={`px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${
          isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'
        }`}>
        <option value="7d">最近7天</option>
        <option value="30d">最近30天</option>
        <option value="90d">最近90天</option>
      </select>
    </div>
  )

  return (
    <MonitorPageLayout title="告警统计" subtitle="查看告警趋势和分析数据" icon={BarChart3}
      iconGradient="from-purple-500 via-pink-500 to-red-500" headerActions={headerActions}
      loading={loading} onRefresh={loadStatistics} showFullscreen={false}>
      
      {statistics && (
        <>
          {/* 统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
            <MonitorStatCard title="总告警数" value={statistics.total_alerts} subtitle="统计周期内总数" icon={Activity} iconColorClass="text-blue-400" glowColor="bg-blue-500" />
            <MonitorStatCard title="活跃告警" value={statistics.active_alerts} subtitle="需要处理的告警" icon={AlertTriangle} variant="danger" iconColorClass="text-red-400" glowColor="bg-red-500" />
            <MonitorStatCard title="解决率" value={`${statistics.resolution_rate.toFixed(1)}%`} subtitle="告警解决比例" icon={CheckCircle} variant="success" iconColorClass="text-emerald-400" glowColor="bg-emerald-500" />
            <MonitorStatCard title="平均处理时间" value={`${statistics.avg_resolution_time.toFixed(1)}h`} subtitle="告警平均处理时长" icon={Clock} iconColorClass="text-yellow-400" glowColor="bg-yellow-500" />
          </div>

          {/* 趋势图 */}
          <MonitorContentCard title="告警趋势" icon={TrendingUp} className="mb-6">
            <div className="h-80">
              <ReactECharts option={getTrendChartOption()} style={{ height: '100%', width: '100%' }} />
            </div>
          </MonitorContentCard>

          {/* 分布图表 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <MonitorContentCard title="告警级别分布" icon={PieChart}>
              <div className="h-80">
                <ReactECharts option={getLevelPieChartOption()} style={{ height: '100%', width: '100%' }} />
              </div>
            </MonitorContentCard>

            <MonitorContentCard title="每日统计" icon={Calendar}>
              <div className="h-80">
                <ReactECharts option={getDailyStatsChartOption()} style={{ height: '100%', width: '100%' }} />
              </div>
            </MonitorContentCard>
          </div>

          {/* 详细统计 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MonitorContentCard title="级别统计" icon={AlertTriangle}>
              <div className="space-y-3">
                {statistics.level_distribution.map((item) => (
                  <div key={item.level} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        item.level === 'critical' ? 'bg-red-500' :
                        item.level === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`} />
                      <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {item.level === 'critical' ? '严重' : item.level === 'warning' ? '警告' : '信息'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {item.count} 条
                      </span>
                      <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </MonitorContentCard>

            <MonitorContentCard title="来源统计" icon={Activity}>
              <div className="space-y-3">
                {statistics.source_distribution.map((item) => (
                  <div key={item.source} className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {item.source}
                    </span>
                    <div className="flex items-center space-x-4">
                      <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {item.count} 条
                      </span>
                      <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </MonitorContentCard>
          </div>
        </>
      )}
    </MonitorPageLayout>
  )
}