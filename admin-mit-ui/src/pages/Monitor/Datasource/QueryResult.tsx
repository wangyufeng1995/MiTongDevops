/**
 * 查询结果展示组件
 * 
 * 实现表格视图展示
 * 实现图表视图展示（使用 ECharts）
 * 显示查询执行时间
 * 
 * Requirements: 2.4, 2.5, 2.6, 3.1, 3.2
 */
import React, { useState, useEffect, useRef } from 'react'
import { 
  Table, 
  BarChart2, 
  Download, 
  RefreshCw, 
  Clock,
  AlertCircle,
  Database
} from 'lucide-react'
import { PromQLQueryResult } from '../../../services/datasource'

// 自定义滚动条样式
const customScrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: linear-gradient(to bottom, #f1f5f9, #e2e8f0);
    border-radius: 5px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, #cbd5e1, #94a3b8);
    border-radius: 5px;
    border: 2px solid #f1f5f9;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(to bottom, #94a3b8, #64748b);
  }
`

interface QueryResultProps {
  result: PromQLQueryResult | null
  loading?: boolean
}

// 格式化时间戳
const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 格式化指标标签
const formatLabels = (metric: Record<string, string>): string => {
  const entries = Object.entries(metric)
    .filter(([key]) => key !== '__name__')
    .map(([key, value]) => `${key}="${value}"`)
  return entries.length > 0 ? `{${entries.join(', ')}}` : ''
}

// 获取指标名称
const getMetricName = (metric: Record<string, string>): string => {
  return metric.__name__ || 'value'
}

export const QueryResult: React.FC<QueryResultProps> = ({
  result,
  loading = false
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<any>(null)

  // 添加调试日志
  useEffect(() => {
    if (result) {
      console.log('QueryResult received:', result)
      console.log('result.status:', result.status)
      console.log('result.data:', result.data)
      console.log('result.data?.result:', result.data?.result)
      console.log('result.data?.resultType:', result.data?.resultType)
    }
  }, [result])

  // 初始化和更新图表
  useEffect(() => {
    if (viewMode !== 'chart' || !result?.data || !chartRef.current) return

    const initChart = async () => {
      // 动态导入 ECharts
      const echarts = await import('echarts')
      
      // 销毁旧实例
      if (chartInstance.current) {
        chartInstance.current.dispose()
      }

      // 创建新实例
      chartInstance.current = echarts.init(chartRef.current)

      // 准备数据
      const { resultType, result: data } = result.data!

      if (resultType === 'matrix' && data.length > 0) {
        // 范围查询 - 时间序列图
        const series = data.map((item, index) => {
          const name = getMetricName(item.metric) + formatLabels(item.metric)
          const seriesData = (item.values || []).map(([timestamp, value]) => [
            timestamp * 1000,
            parseFloat(value)
          ])
          return {
            name: name.length > 50 ? name.substring(0, 50) + '...' : name,
            type: 'line',
            data: seriesData,
            smooth: true,
            showSymbol: false
          }
        })

        chartInstance.current.setOption({
          tooltip: {
            trigger: 'axis',
            formatter: (params: any) => {
              if (!params || params.length === 0) return ''
              const time = new Date(params[0].data[0]).toLocaleString('zh-CN')
              const items = params.map((p: any) => 
                `<div style="display:flex;align-items:center;gap:4px;">
                  <span style="display:inline-block;width:10px;height:10px;background:${p.color};border-radius:50%;"></span>
                  <span>${p.seriesName}: ${p.data[1]}</span>
                </div>`
              ).join('')
              return `<div><div style="margin-bottom:4px;font-weight:500;">${time}</div>${items}</div>`
            }
          },
          legend: {
            type: 'scroll',
            bottom: 0,
            data: series.map(s => s.name)
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '15%',
            top: '10%',
            containLabel: true
          },
          xAxis: {
            type: 'time',
            axisLabel: {
              formatter: (value: number) => {
                const date = new Date(value)
                return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
              }
            }
          },
          yAxis: {
            type: 'value',
            axisLabel: {
              formatter: (value: number) => {
                if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M'
                if (value >= 1000) return (value / 1000).toFixed(1) + 'K'
                return value.toFixed(2)
              }
            }
          },
          dataZoom: [
            {
              type: 'inside',
              start: 0,
              end: 100
            },
            {
              start: 0,
              end: 100
            }
          ],
          series
        })
      } else if (resultType === 'vector' && data.length > 0) {
        // 即时查询 - 柱状图
        const categories = data.map(item => {
          const name = getMetricName(item.metric) + formatLabels(item.metric)
          return name.length > 30 ? name.substring(0, 30) + '...' : name
        })
        const values = data.map(item => parseFloat(item.value?.[1] || '0'))

        chartInstance.current.setOption({
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' }
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '15%',
            top: '10%',
            containLabel: true
          },
          xAxis: {
            type: 'category',
            data: categories,
            axisLabel: {
              rotate: 45,
              interval: 0
            }
          },
          yAxis: {
            type: 'value'
          },
          series: [{
            type: 'bar',
            data: values,
            itemStyle: {
              color: '#3b82f6'
            }
          }]
        })
      }
    }

    initChart()

    // 响应窗口大小变化
    const handleResize = () => {
      chartInstance.current?.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chartInstance.current?.dispose()
    }
  }, [viewMode, result])

  // 导出 CSV
  const handleExportCSV = () => {
    if (!result?.data) return

    const { resultType, result: data } = result.data

    let csvContent = ''

    if (resultType === 'matrix') {
      // 范围查询导出
      csvContent = 'Metric,Timestamp,Value\n'
      data.forEach(item => {
        const metricName = getMetricName(item.metric) + formatLabels(item.metric)
        ;(item.values || []).forEach(([timestamp, value]) => {
          csvContent += `"${metricName}",${formatTimestamp(timestamp)},${value}\n`
        })
      })
    } else if (resultType === 'vector') {
      // 即时查询导出
      csvContent = 'Metric,Timestamp,Value\n'
      data.forEach(item => {
        const metricName = getMetricName(item.metric) + formatLabels(item.metric)
        const [timestamp, value] = item.value || [0, '0']
        csvContent += `"${metricName}",${formatTimestamp(timestamp)},${value}\n`
      })
    }

    // 下载文件
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `promql_result_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.csv`
    link.click()
  }

  // 加载状态
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50/30 to-indigo-50/20">
        <div className="text-center">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full blur-xl opacity-30 animate-pulse"></div>
            <RefreshCw className="relative w-12 h-12 text-blue-600 animate-spin" />
          </div>
          <p className="text-gray-700 font-medium">正在执行查询...</p>
          <p className="text-sm text-gray-500 mt-1">请稍候</p>
        </div>
      </div>
    )
  }

  // 无结果状态
  if (!result) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/20">
        <div className="text-center">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-400 to-blue-400 rounded-full blur-xl opacity-10"></div>
            <div className="relative bg-gradient-to-br from-gray-100 to-blue-100 p-5 rounded-2xl">
              <Database className="w-12 h-12 text-gray-400" />
            </div>
          </div>
          <p className="text-gray-600 font-medium">执行查询以查看结果</p>
          <p className="text-sm text-gray-500 mt-1">在上方输入 PromQL 查询语句</p>
        </div>
      </div>
    )
  }

  // 错误状态
  if (result.status === 'error') {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-red-50/30 to-orange-50/20">
        <div className="text-center max-w-md mx-4">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-orange-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
            <div className="relative bg-gradient-to-br from-red-100 to-orange-100 p-5 rounded-2xl">
              <AlertCircle className="w-12 h-12 text-red-600" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">查询失败</h3>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-3">
            <p className="text-red-700 font-medium">{result.error || '未知错误'}</p>
          </div>
          {result.errorType && (
            <p className="text-sm text-gray-600">
              错误类型: <span className="font-mono text-red-600">{result.errorType}</span>
            </p>
          )}
        </div>
      </div>
    )
  }

  // 空结果状态
  if (!result.data || !result.data.result || result.data.result.length === 0) {
    console.log('Empty result detected:', {
      hasData: !!result.data,
      hasResult: !!result.data?.result,
      resultLength: result.data?.result?.length
    })
    
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-green-50/30 to-blue-50/20">
        <div className="text-center">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-blue-400 rounded-full blur-xl opacity-20"></div>
            <div className="relative bg-gradient-to-br from-green-100 to-blue-100 p-5 rounded-2xl">
              <Database className="w-12 h-12 text-green-600" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">✓ 查询成功</h3>
          <p className="text-gray-600">没有匹配的数据</p>
          <div className="inline-flex items-center space-x-2 mt-3 px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              执行时间: <span className="font-semibold text-green-600">{result.execution_time_ms}ms</span>
            </span>
          </div>
        </div>
      </div>
    )
  }

  const { resultType, result: data } = result.data

  return (
    <div className="h-full flex flex-col">
      {/* 注入自定义滚动条样式 */}
      <style>{customScrollbarStyles}</style>
      
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200/50 bg-gradient-to-r from-gray-50 to-blue-50/30">
        <div className="flex items-center space-x-4">
          {/* 视图切换 */}
          <div className="flex bg-white rounded-xl border-2 border-gray-200 shadow-sm">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-l-xl transition-all duration-200 ${
                viewMode === 'table'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md scale-105'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>表格</span>
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-r-xl transition-all duration-200 ${
                viewMode === 'chart'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md scale-105'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>图表</span>
            </button>
          </div>

          {/* 结果统计 */}
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-3 py-1.5 bg-white rounded-lg text-sm font-semibold text-blue-600 border border-blue-200 shadow-sm">
              {data.length} 条结果
            </span>
            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold text-white shadow-sm ${
              resultType === 'matrix' 
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600' 
                : 'bg-gradient-to-r from-blue-500 to-cyan-600'
            }`}>
              {resultType === 'matrix' ? '📊 范围查询' : '⚡ 即时查询'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* 执行时间 */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200 shadow-sm">
            <Clock className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-gray-700">{result.execution_time_ms}ms</span>
          </div>

          {/* 导出按钮 */}
          <button
            onClick={handleExportCSV}
            className="group flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-green-600 bg-white hover:bg-green-50 border border-gray-200 hover:border-green-200 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>导出 CSV</span>
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'table' ? (
          <div className="h-full overflow-auto custom-scrollbar bg-gradient-to-br from-white to-blue-50/10">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-blue-50/50 sticky top-0 backdrop-blur-sm border-b-2 border-gray-200">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    指标
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    标签
                  </th>
                  {resultType === 'matrix' ? (
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      数据点
                    </th>
                  ) : (
                    <>
                      <th className="px-5 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        时间
                      </th>
                      <th className="px-5 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                        值
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {data.map((item, index) => (
                  <tr key={index} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 rounded-lg group-hover:from-blue-200 group-hover:to-indigo-200 transition-all">
                        {getMetricName(item.metric)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600 font-mono">
                      <div className="max-w-md truncate bg-gray-50 px-3 py-1.5 rounded-lg group-hover:bg-gray-100 transition-colors" title={formatLabels(item.metric)}>
                        {formatLabels(item.metric) || <span className="text-gray-400 italic">无标签</span>}
                      </div>
                    </td>
                    {resultType === 'matrix' ? (
                      <td className="px-5 py-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg font-semibold">
                            {item.values?.length || 0} 个数据点
                          </span>
                          {item.values && item.values.length > 0 && (
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              {formatTimestamp(item.values[0][0])} - {formatTimestamp(item.values[item.values.length - 1][0])}
                            </span>
                          )}
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="px-5 py-4 text-sm text-gray-600">
                          <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 rounded-lg">
                            {item.value ? formatTimestamp(item.value[0]) : '-'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-right font-mono">
                          <span className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 rounded-lg font-bold">
                            {item.value ? item.value[1] : '-'}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div ref={chartRef} className="w-full h-full bg-gradient-to-br from-white to-blue-50/10" />
        )}
      </div>
    </div>
  )
}

export default QueryResult
