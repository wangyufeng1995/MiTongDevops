import React, { useState, useEffect } from 'react'
import { ArrowLeft, TrendingUp, Clock, AlertCircle, Timer, ChevronLeft, ChevronRight } from 'lucide-react'
import { networkProbeService } from '../../../services/network'
import { NetworkProbe, NetworkProbeResult } from '../../../types/network'
import { formatDateTime } from '../../../utils'
import { useTheme } from '../../../hooks/useTheme'

interface ProbeResultsProps {
  probe: NetworkProbe
  onBack: () => void
}

interface PaginatedResults {
  results: NetworkProbeResult[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

interface ProbeStatistics {
  total_probes: number
  success_count: number
  failed_count: number
  timeout_count: number
  success_rate: number
  avg_response_time: number
  min_response_time: number
  max_response_time: number
}

export const ProbeResults: React.FC<ProbeResultsProps> = ({ probe, onBack }) => {
  const { isDark } = useTheme()
  const [results, setResults] = useState<NetworkProbeResult[]>([])
  const [statistics, setStatistics] = useState<ProbeStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const perPage = 10

  useEffect(() => { loadResults() }, [probe.id, currentPage])

  const loadResults = async () => {
    setLoading(true); setError(null)
    try {
      const response = await networkProbeService.getResults(probe.id, { page: currentPage, limit: perPage })
      if (response.success && response.data) {
        const data = response.data as PaginatedResults
        setResults(data.results || []); setTotal(data.total || 0); setTotalPages(data.total_pages || 1)
        calculateStatistics(data.results || [])
      } else { throw new Error(response.message || '加载结果失败') }
    } catch (err: any) { setError(err.message || '加载探测结果失败'); setResults([]) }
    finally { setLoading(false) }
  }

  const calculateStatistics = (resultsList: NetworkProbeResult[]) => {
    if (resultsList.length === 0) { setStatistics(null); return }
    const successCount = resultsList.filter(r => r.status === 'success').length
    const failedCount = resultsList.filter(r => r.status === 'failed').length
    const timeoutCount = resultsList.filter(r => r.status === 'timeout').length
    const responseTimes = resultsList.filter(r => r.response_time != null).map(r => r.response_time!)
    const avgResponseTime = responseTimes.length > 0 ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0
    setStatistics({
      total_probes: resultsList.length, success_count: successCount, failed_count: failedCount, timeout_count: timeoutCount,
      success_rate: resultsList.length > 0 ? (successCount / resultsList.length) * 100 : 0,
      avg_response_time: avgResponseTime,
      min_response_time: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
      max_response_time: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
    })
  }

  const handlePageChange = (page: number) => { if (page >= 1 && page <= totalPages) setCurrentPage(page) }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return isDark ? 'text-emerald-400 bg-emerald-500/10' : 'text-emerald-600 bg-emerald-50'
      case 'failed': return isDark ? 'text-red-400 bg-red-500/10' : 'text-red-600 bg-red-50'
      case 'timeout': return isDark ? 'text-amber-400 bg-amber-500/10' : 'text-amber-600 bg-amber-50'
      default: return isDark ? 'text-gray-400 bg-gray-500/10' : 'text-gray-600 bg-gray-50'
    }
  }

  const getProbeTypeColor = (type: string) => {
    return type === 'manual' 
      ? isDark ? 'text-blue-400 bg-blue-500/10' : 'text-blue-600 bg-blue-50'
      : isDark ? 'text-purple-400 bg-purple-500/10' : 'text-purple-600 bg-purple-50'
  }

  return (
    <div className="space-y-5">
      {/* 返回按钮和标题 */}
      <div>
        <button onClick={onBack} className={`mb-3 flex items-center text-sm transition-colors ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}>
          <ArrowLeft className="w-4 h-4 mr-1" />返回探测列表
        </button>
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>探测结果: {probe.name}</h2>
        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{probe.protocol.toUpperCase()} - {probe.target_url}</p>
      </div>

      {/* 统计卡片 */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`rounded-xl p-4 border ${isDark ? 'bg-gray-800/40 border-gray-700/50' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>成功率</div>
                <div className="mt-1 text-2xl font-bold text-emerald-500">{(statistics.success_rate || 0).toFixed(1)}%</div>
                <div className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{statistics.success_count} / {statistics.total_probes} 成功</div>
              </div>
              <div className={`p-2 rounded-lg ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}><TrendingUp className="w-5 h-5 text-emerald-500" /></div>
            </div>
          </div>
          <div className={`rounded-xl p-4 border ${isDark ? 'bg-gray-800/40 border-gray-700/50' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>平均响应时间</div>
                <div className={`mt-1 text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{(statistics.avg_response_time || 0).toFixed(0)}ms</div>
                <div className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>最小: {statistics.min_response_time}ms, 最大: {statistics.max_response_time}ms</div>
              </div>
              <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}><Clock className="w-5 h-5 text-blue-500" /></div>
            </div>
          </div>
          <div className={`rounded-xl p-4 border ${isDark ? 'bg-gray-800/40 border-gray-700/50' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>失败次数</div>
                <div className="mt-1 text-2xl font-bold text-red-500">{statistics.failed_count}</div>
                <div className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{(((statistics.failed_count || 0) / (statistics.total_probes || 1)) * 100).toFixed(1)}% 失败率</div>
              </div>
              <div className={`p-2 rounded-lg ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}><AlertCircle className="w-5 h-5 text-red-500" /></div>
            </div>
          </div>
          <div className={`rounded-xl p-4 border ${isDark ? 'bg-gray-800/40 border-gray-700/50' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>超时次数</div>
                <div className="mt-1 text-2xl font-bold text-amber-500">{statistics.timeout_count}</div>
                <div className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{(((statistics.timeout_count || 0) / (statistics.total_probes || 1)) * 100).toFixed(1)}% 超时率</div>
              </div>
              <div className={`p-2 rounded-lg ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}><Timer className="w-5 h-5 text-amber-500" /></div>
            </div>
          </div>
        </div>
      )}

      {/* 响应时间趋势图 */}
      {results.length > 0 && (
        <div className={`rounded-xl p-5 border ${isDark ? 'bg-gray-800/40 border-gray-700/50' : 'bg-white border-gray-200 shadow-sm'}`}>
          <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>响应时间趋势</h3>
          <div className="relative h-48">
            <svg className="w-full h-full" viewBox="0 0 800 180" preserveAspectRatio="none">
              {[0, 45, 90, 135, 180].map(y => (
                <line key={y} x1="0" y1={y} x2="800" y2={y} stroke={isDark ? '#374151' : '#e5e7eb'} strokeWidth="1" />
              ))}
              {(() => {
                const validResults = results.filter(r => r.response_time != null)
                if (validResults.length === 0) return null
                const maxTime = Math.max(...validResults.map(r => r.response_time!))
                const points = validResults.map((result, index) => {
                  const x = (index / (validResults.length - 1 || 1)) * 800
                  const y = 170 - ((result.response_time! / maxTime) * 160)
                  return `${x},${y}`
                }).join(' ')
                return (
                  <>
                    <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="2" />
                    {validResults.map((result, index) => {
                      const x = (index / (validResults.length - 1 || 1)) * 800
                      const y = 170 - ((result.response_time! / maxTime) * 160)
                      const color = result.status === 'success' ? '#10b981' : result.status === 'failed' ? '#ef4444' : '#f59e0b'
                      return <circle key={index} cx={x} cy={y} r="4" fill={color} />
                    })}
                  </>
                )
              })()}
            </svg>
          </div>
          <div className={`mt-2 flex justify-between text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            <span>最早</span><span>最新</span>
          </div>
        </div>
      )}

      {/* 结果表格 */}
      <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-gray-800/40 border-gray-700/50' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className={`px-5 py-4 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-100'}`}>
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>最近结果</h3>
          <p className={`mt-0.5 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>显示 {results.length} / {total} 条结果</p>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center">
            <div className={`inline-block animate-spin rounded-full h-8 w-8 border-2 ${isDark ? 'border-blue-400 border-t-transparent' : 'border-blue-600 border-t-transparent'}`}></div>
            <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>正在加载结果...</p>
          </div>
        ) : error ? (
          <div className="px-5 py-12 text-center">
            <p className="text-red-500 text-sm">{error}</p>
            <button onClick={loadResults} className="mt-3 px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600">重试</button>
          </div>
        ) : results.length === 0 ? (
          <div className={`px-5 py-12 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>暂无结果数据，请执行探测任务查看结果。</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={isDark ? 'bg-gray-800/60' : 'bg-gray-50'}>
                  <tr>
                    {['时间', '类型', '状态', '响应时间', '状态码', '详情'].map(h => (
                      <th key={h} className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-gray-700/50' : 'divide-gray-100'}`}>
                  {results.map((result) => (
                    <tr key={result.id} className={`transition-colors ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'}`}>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{formatDateTime(result.probed_at, 'YYYY/MM/DD HH:mm:ss')}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><span className={`px-2 py-0.5 text-xs font-medium rounded ${getProbeTypeColor(result.probe_type)}`}>{result.probe_type}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap"><span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(result.status)}`}>{result.status}</span></td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{result.response_time != null ? `${result.response_time}ms` : '-'}</td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{result.status_code || '-'}</td>
                      <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {result.error_message ? <span className="text-red-500">{result.error_message}</span> : result.response_body ? <span className="truncate max-w-[150px] inline-block" title={result.response_body}>{result.response_body.substring(0, 50)}...</span> : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* 分页 */}
            {totalPages > 1 && (
              <div className={`px-5 py-3 border-t flex items-center justify-between ${isDark ? 'border-gray-700/50' : 'border-gray-100'}`}>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>第 {currentPage} 页 / 共 {totalPages} 页</p>
                <div className="flex items-center space-x-1">
                  <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
