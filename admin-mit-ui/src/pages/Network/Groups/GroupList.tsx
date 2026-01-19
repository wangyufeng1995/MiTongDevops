import React, { useState, useEffect } from 'react'
import { Folder, Edit2, Trash2 } from 'lucide-react'
import { networkProbeGroupService } from '../../../services/network'
import { NetworkProbeGroup } from '../../../types/network'
import { useTheme } from '../../../hooks/useTheme'

interface GroupListProps {
  onEdit: (group: NetworkProbeGroup) => void
  onDelete: (group: NetworkProbeGroup) => void
  refreshTrigger?: number
}

export const GroupList: React.FC<GroupListProps> = ({ onEdit, onDelete, refreshTrigger }) => {
  const { isDark } = useTheme()
  const [groups, setGroups] = useState<NetworkProbeGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadGroups = async () => {
    setLoading(true); setError(null)
    try {
      const response = await networkProbeGroupService.getAll()
      if (response.success) {
        const sortedGroups = response.data.sort((a, b) => {
          if (a.is_default !== b.is_default) return a.is_default ? 1 : -1
          return a.sort_order - b.sort_order
        })
        setGroups(sortedGroups)
      } else { setError(response.message || '加载分组失败') }
    } catch (err) { setError('加载分组失败'); console.error('Error loading groups:', err) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadGroups() }, [refreshTrigger])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className={`animate-spin rounded-full h-8 w-8 border-2 ${isDark ? 'border-blue-400 border-t-transparent' : 'border-blue-600 border-t-transparent'}`}></div>
      </div>
    )
  }

  if (error) {
    return <div className={`px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'}`}>{error}</div>
  }

  if (groups.length === 0) {
    return (
      <div className={`text-center py-12 rounded-xl border ${isDark ? 'bg-gray-800/40 border-gray-700/50 text-gray-400' : 'bg-white border-gray-200 text-gray-500 shadow-sm'}`}>
        <Folder className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
        <p>暂无分组数据，请创建第一个分组开始使用。</p>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-gray-800/40 border-gray-700/50' : 'bg-white border-gray-200 shadow-sm'}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className={isDark ? 'bg-gray-800/60' : 'bg-gray-50'}>
            <tr>
              {['名称', '描述', '颜色', '探测数', '类型', '操作'].map((h, i) => (
                <th key={h} className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${i === 5 ? 'text-right' : 'text-left'} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-gray-700/50' : 'divide-gray-100'}`}>
            {groups.map((group) => (
              <tr key={group.id} className={`transition-colors ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'}`}>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{group.name}</div>
                </td>
                <td className="px-4 py-3">
                  <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{group.description || '-'}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 rounded border border-gray-400/30" style={{ backgroundColor: group.color }}></div>
                    <span className={`text-xs font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{group.color}</span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{group.probe_count || 0}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {group.is_default ? (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${isDark ? 'bg-gray-500/20 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>默认</span>
                  ) : group.is_system ? (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>系统</span>
                  ) : (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>自定义</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  {!group.is_system ? (
                    <div className="flex justify-end space-x-1">
                      <button onClick={() => onEdit(group)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-blue-400 hover:bg-blue-500/10' : 'text-blue-600 hover:bg-blue-50'}`}>
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => onDelete(group)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>系统分组</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
