import React, { useState, useEffect } from 'react'
import { Search, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { networkProbeService, networkProbeGroupService } from '../../../services/network'
import { NetworkProbe, NetworkProbeGroup } from '../../../types/network'
import { ProbeControls } from '../../../components/Network/ProbeControls'
import { ProbeStatus } from '../../../components/Network/ProbeStatus'
import { useTheme } from '../../../hooks/useTheme'

interface ProbeListProps {
  onEdit: (probe: NetworkProbe) => void
  onDelete: (probe: NetworkProbe) => void
  onStart: (probe: NetworkProbe) => void
  onStop: (probe: NetworkProbe) => void
  onProbe: (probe: NetworkProbe) => void
  onViewResults: (probe: NetworkProbe) => void
  refreshTrigger?: number
  onStatsUpdate?: (stats: { total: number; enabled: number; healthy: number; avgResponseTime: number }) => void
}

export const ProbeList: React.FC<ProbeListProps> = ({
  onEdit, onDelete, onStart, onStop, onProbe, onViewResults, refreshTrigger, onStatsUpdate,
}) => {
  const { isDark } = useTheme()
  const [probes, setProbes] = useState<NetworkProbe[]>([])
  const [groups, setGroups] = useState<NetworkProbeGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const perPage = 10
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [selectedProtocol, setSelectedProtocol] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')

  const loadGroups = async () => {
    try {
      const response = await networkProbeGroupService.getAll()
      if (response.success && response.data) setGroups(response.data)
    } catch (err) { console.error('加载分组错误:', err) }
  }

  const loadProbes = async () => {
    setLoading(true); setError(null)
    try {
      const params: any = { page: currentPage, per_page: perPage }
      if (searchTerm) params.search = searchTerm
      if (selectedGroupId) params.group_id = selectedGroupId
      if (selectedProtocol) params.protocol = selectedProtocol
      if (selectedStatus) params.enabled = selectedStatus
      const response = await networkProbeService.getList(params)
      if (response.success && response.data) {
        const { items, pagination } = response.data
        setProbes(items || []); setTotalCount(pagination?.total || 0); setCurrentPage(pagination?.page || 1)
        setTotalPages(pagination?.pages || 1)
        
        // 计算统计数据
        if (onStatsUpdate && items) {
          const enabled = items.filter((p: NetworkProbe) => p.enabled).length
          const healthy = items.filter((p: NetworkProbe) => p.last_status === 'success' || p.last_status === 'healthy').length
          const responseTimes = items.filter((p: NetworkProbe) => p.last_response_time).map((p: NetworkProbe) => p.last_response_time || 0)
          const avgResponseTime = responseTimes.length > 0 ? Math.round(responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length) : 0
          onStatsUpdate({ total: pagination?.total || 0, enabled, healthy, avgResponseTime })
        }
      } else { setError(response.message || '加载探测列表失败') }
    } catch (err) { setError('加载探测列表失败'); console.error('加载探测列表错误:', err) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadGroups() }, [])
  useEffect(() => { loadProbes() }, [currentPage, refreshTrigger])

  const handleSearch = () => { setCurrentPage(1); loadProbes() }
  const handleResetFilters = () => {
    setSearchTerm(''); setSelectedGroupId(null); setSelectedProtocol(''); setSelectedStatus('')
    setCurrentPage(1); setTimeout(() => loadProbes(), 0)
  }
  const handlePageChange = (page: number) => { setCurrentPage(page) }
  const getGroupName = (groupId: number) => groups.find(g => g.id === groupId)?.name || '未知'

  const getProtocolBadgeColor = (protocol: string) => {
    const colors: Record<string, string> = {
      http: isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700',
      https: isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700',
      websocket: isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700',
      tcp: isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700',
      udp: isDark ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-700',
    }
    return colors[protocol] || (isDark ? 'bg-gray-500/20 text-gray-300' : 'bg-gray-100 text-gray-700')
  }

  const inputClass = `w-full px-3 py-2 text-sm rounded-lg border transition-colors ${
    isDark ? 'bg-gray-700/50 border-gray-600 text-gray-200 placeholder-gray-400 focus:border-blue-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
  } focus:outline-none focus:ring-1 focus:ring-blue-500`

  if (loading && probes.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className={`animate-spin rounded-full h-8 w-8 border-2 ${isDark ? 'border-blue-400 border-t-transparent' : 'border-blue-600 border-t-transparent'}`}></div>
      </div>
    )
  }

  if (error) {
    return <div className={`px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'}`}>{error}</div>
  }

  return (
    <div className="space-y-4">
      {/* 搜索和筛选 */}
      <div className={`rounded-xl p-4 border ${isDark ? 'bg-gray-800/40 border-gray-700/50' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>搜索</label>
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()} placeholder="名称、地址、描述..." className={inputClass} />
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>分组</label>
            <select value={selectedGroupId || ''} onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)} className={inputClass}>
              <option value="">全部分组</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>协议</label>
            <select value={selectedProtocol} onChange={(e) => setSelectedProtocol(e.target.value)} className={inputClass}>
              <option value="">全部协议</option>
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="websocket">WebSocket</option>
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>状态</label>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className={inputClass}>
              <option value="">全部状态</option>
              <option value="true">已启用</option>
              <option value="false">已禁用</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button onClick={handleSearch} className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all">
              <Search className="w-4 h-4" /><span>搜索</span>
            </button>
            <button onClick={handleResetFilters} className={`px-3 py-2 text-sm rounded-lg transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 结果统计 */}
      <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        显示 {probes.length > 0 ? (currentPage - 1) * perPage + 1 : 0} - {Math.min(currentPage * perPage, totalCount)} 条，共 {totalCount} 条
      </div>

      {/* 探测列表 */}
      {probes.length === 0 ? (
        <div className={`rounded-xl p-8 text-center border ${isDark ? 'bg-gray-800/40 border-gray-700/50 text-gray-400' : 'bg-white border-gray-200 text-gray-500 shadow-sm'}`}>
          暂无探测任务，请创建第一个探测任务开始使用。
        </div>
      ) : (
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-gray-800/40 border-gray-700/50' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className={isDark ? 'bg-gray-800/60' : 'bg-gray-50'}>
                <tr>
                  {['名称', '协议', '目标地址', '分组', '探测状态', '状态', '操作'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${i === 6 ? 'text-right' : 'text-left'} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-700/50' : 'divide-gray-100'}`}>
                {probes.map((probe) => (
                  <tr key={probe.id} className={`transition-colors ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3">
                      <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{probe.name}</div>
                      {probe.description && <div className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{probe.description}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${getProtocolBadgeColor(probe.protocol)}`}>{probe.protocol.toUpperCase()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`text-sm truncate max-w-[200px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`} title={probe.target_url}>{probe.target_url}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{getGroupName(probe.group_id)}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><ProbeStatus probe={probe} showDetails={true} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {probe.enabled ? (
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>已启用</span>
                      ) : (
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'}`}>已禁用</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex justify-end items-center gap-1">
                        <ProbeControls probe={probe} onStart={async (p) => { onStart(p) }} onStop={async (p) => { onStop(p) }} onProbe={async (p) => { onProbe(p) }} />
                        <div className={`flex gap-1 ml-1 pl-1 border-l ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
                          <button onClick={() => onViewResults(probe)} className={`px-2 py-1 text-xs rounded transition-colors ${isDark ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-emerald-600 hover:bg-emerald-50'}`}>结果</button>
                          <button onClick={() => onEdit(probe)} className={`px-2 py-1 text-xs rounded transition-colors ${isDark ? 'text-blue-400 hover:bg-blue-500/10' : 'text-blue-600 hover:bg-blue-50'}`}>编辑</button>
                          <button onClick={() => onDelete(probe)} className={`px-2 py-1 text-xs rounded transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}>删除</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className={`flex items-center justify-between rounded-xl px-4 py-3 border ${isDark ? 'bg-gray-800/40 border-gray-700/50' : 'bg-white border-gray-200 shadow-sm'}`}>
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            第 <span className="font-medium">{currentPage}</span> 页 / 共 <span className="font-medium">{totalPages}</span> 页
          </p>
          <div className="flex items-center space-x-1">
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}
              className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = totalPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i
              return (
                <button key={pageNum} onClick={() => handlePageChange(pageNum)}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${currentPage === pageNum
                    ? 'bg-blue-500 text-white' : isDark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {pageNum}
                </button>
              )
            })}
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}
              className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
