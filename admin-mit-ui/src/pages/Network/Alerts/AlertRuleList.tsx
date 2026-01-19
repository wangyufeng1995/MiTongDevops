import React, { useState, useEffect } from 'react'
import { Bell, Edit2, Trash2, History, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { NetworkAlertRule, NetworkProbe } from '../../../types/network'
import { networkAlertRuleService, networkProbeService } from '../../../services/network'
import { useTheme } from '../../../hooks/useTheme'

interface AlertRuleListProps {
  onEdit: (rule: NetworkAlertRule) => void
  onViewHistory: (ruleId: number) => void
  refreshTrigger?: number
}

export const AlertRuleList: React.FC<AlertRuleListProps> = ({ onEdit, onViewHistory, refreshTrigger }) => {
  const { isDark } = useTheme()
  const [rules, setRules] = useState<NetworkAlertRule[]>([])
  const [probes, setProbes] = useState<Map<number, NetworkProbe>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const perPage = 10

  useEffect(() => { loadRules(); loadProbes() }, [page, refreshTrigger])

  const loadRules = async () => {
    setLoading(true); setError(null)
    try {
      const response = await networkAlertRuleService.getList({ page, per_page: perPage })
      if (response.success && response.data) {
        const { items, total } = response.data
        setRules(items || [])
        setTotal(total || 0)
      }
    } catch (err: any) { setError(err.message || '加载告警规则失败') }
    finally { setLoading(false) }
  }

  const loadProbes = async () => {
    try {
      const response = await networkProbeService.getAll()
      if (response.success && response.data) {
        const probeMap = new Map<number, NetworkProbe>()
        response.data.forEach((probe: NetworkProbe) => probeMap.set(probe.id, probe))
        setProbes(probeMap)
      }
    } catch (err) { console.error('Failed to load probes:', err) }
  }

  const handleToggleEnabled = async (rule: NetworkAlertRule) => {
    try {
      if (rule.enabled) { await networkAlertRuleService.disable(rule.id) }
      else { await networkAlertRuleService.enable(rule.id) }
      loadRules()
    } catch (err: any) { alert(err.message || '切换规则状态失败') }
  }

  const handleDelete = async (rule: NetworkAlertRule) => {
    if (!confirm(`确定要删除告警规则 "${rule.name}" 吗？`)) return
    try { await networkAlertRuleService.delete(rule.id); loadRules() }
    catch (err: any) { alert(err.message || '删除告警规则失败') }
  }

  const totalPages = Math.ceil(total / perPage)

  if (loading && rules.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className={`animate-spin rounded-full h-8 w-8 border-2 ${isDark ? 'border-blue-400 border-t-transparent' : 'border-blue-600 border-t-transparent'}`}></div>
      </div>
    )
  }

  if (error) {
    return <div className={`px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'}`}>{error}</div>
  }

  if (rules.length === 0) {
    return (
      <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        <Bell className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
        <p>暂无告警规则，请创建第一个告警规则开始使用。</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className={isDark ? 'bg-gray-800/60' : 'bg-gray-50'}>
            <tr>
              {['规则名称', '条件', '连续失败', '通知渠道', '状态', '操作'].map((h, i) => (
                <th key={h} className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${i === 5 ? 'text-right' : 'text-left'} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-gray-700/50' : 'divide-gray-100'}`}>
            {rules.map((rule) => (
              <tr key={rule.id} className={`transition-colors ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'}`}>
                <td className="px-4 py-3">
                  <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{rule.name}</div>
                  <div className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    探测: {probes.get(rule.probe_id)?.name || `ID: ${rule.probe_id}`}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <span className="font-medium">{rule.condition_type}</span>
                    {' '}<span className={isDark ? 'text-gray-500' : 'text-gray-400'}>{rule.condition_operator}</span>{' '}
                    <span className="font-medium">{rule.threshold_value || 'N/A'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{rule.consecutive_failures}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                    {rule.channel_ids.length} 个渠道
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    rule.enabled 
                      ? isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                      : isDark ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {rule.enabled ? '已启用' : '已禁用'}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <div className="flex justify-end space-x-1">
                    <button onClick={() => handleToggleEnabled(rule)} title={rule.enabled ? '禁用' : '启用'}
                      className={`p-1.5 rounded-lg transition-colors ${rule.enabled 
                        ? isDark ? 'text-amber-400 hover:bg-amber-500/10' : 'text-amber-600 hover:bg-amber-50'
                        : isDark ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                      {rule.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => onEdit(rule)} title="编辑"
                      className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-blue-400 hover:bg-blue-500/10' : 'text-blue-600 hover:bg-blue-50'}`}>
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => onViewHistory(rule.id)} title="历史"
                      className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-purple-400 hover:bg-purple-500/10' : 'text-purple-600 hover:bg-purple-50'}`}>
                      <History className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(rule)} title="删除"
                      className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className={`flex items-center justify-between pt-4 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-100'}`}>
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            第 <span className="font-medium">{page}</span> 页 / 共 <span className="font-medium">{totalPages}</span> 页
          </p>
          <div className="flex items-center space-x-1">
            <button onClick={() => setPage(page - 1)} disabled={page === 1}
              className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(page + 1)} disabled={page === totalPages}
              className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
