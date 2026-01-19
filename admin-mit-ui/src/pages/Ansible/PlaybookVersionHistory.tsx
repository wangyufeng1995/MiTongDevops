/**
 * Playbook 历史版本管理页面
 */
import React, { useState, useEffect, useCallback } from 'react'
import { GitBranch, FileText, Clock, User, Eye, RotateCcw, Search, ChevronDown, ChevronRight } from 'lucide-react'
import { DataTable } from '../../components/Table'
import { ansibleService } from '../../services/ansible'
import { formatDateTime } from '../../utils'
import { useTheme } from '../../hooks/useTheme'
import { MonitorPageLayout, MonitorContentCard, ConfirmDialog, useConfirmDialog } from '../../components/Monitor'

interface VersionHistory {
  id: number
  version: string
  content: string
  created_at: string | null
}

interface PlaybookWithHistory {
  id: number
  name: string
  version: string
  updated_at: string | null
  creator?: { username: string; full_name?: string }
  history: VersionHistory[]
}

const PlaybookVersionHistory: React.FC = () => {
  const { isDark } = useTheme()
  const confirmDialog = useConfirmDialog()
  
  const [playbooks, setPlaybooks] = useState<PlaybookWithHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [viewContent, setViewContent] = useState<{ version: string; content: string } | null>(null)

  // 加载所有 Playbook 及其历史版本
  const loadAllVersions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await ansibleService.getAllPlaybookVersions()
      setPlaybooks(response || [])
    } catch (err: any) {
      setError(err.message || '加载历史版本失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAllVersions() }, [loadAllVersions])

  // 切换展开/收起
  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // 展开全部
  const expandAll = () => {
    setExpandedIds(new Set(playbooks.map(p => p.id)))
  }

  // 收起全部
  const collapseAll = () => {
    setExpandedIds(new Set())
  }

  // 查看版本内容
  const handleViewContent = (version: string, content: string) => {
    setViewContent({ version, content })
  }

  // 恢复版本
  const handleRestore = (playbook: PlaybookWithHistory, historyVersion: VersionHistory) => {
    confirmDialog.show({
      title: '恢复版本',
      message: (
        <div className="space-y-3">
          <p>确定要将 <span className="font-medium">{playbook.name}</span> 恢复到版本 <span className="font-medium">v{historyVersion.version}</span> 吗？</p>
          <p className={`text-sm ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
            ⚠️ 当前版本将被保存为历史版本
          </p>
        </div>
      ),
      confirmText: '确认恢复',
      variant: 'warning',
      onConfirm: async () => {
        try {
          await ansibleService.restorePlaybookVersion(playbook.id, historyVersion.id)
          loadAllVersions()
        } catch {
          alert('恢复版本失败')
        }
      }
    })
  }

  // 过滤 Playbook
  const filteredPlaybooks = playbooks.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 统计
  const totalVersions = playbooks.reduce((sum, p) => sum + (p.history?.length || 0), 0)

  return (
    <MonitorPageLayout
      title="Playbook 历史版本"
      subtitle="查看和管理所有 Playbook 的版本历史"
      icon={GitBranch}
      iconGradient="from-purple-500 via-indigo-500 to-blue-500"
      loading={loading}
      onRefresh={loadAllVersions}
      showFullscreen={false}
    >
      {/* 统计信息 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
              <FileText className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{playbooks.length}</p>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Playbook 总数</p>
            </div>
          </div>
        </div>
        <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
              <GitBranch className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{totalVersions}</p>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>历史版本总数</p>
            </div>
          </div>
        </div>
        <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
              <Clock className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>5</p>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>每个保留版本数</p>
            </div>
          </div>
        </div>
      </div>

      {/* 搜索和操作栏 */}
      <MonitorContentCard className="mb-6">
        <div className="flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder="搜索 Playbook 名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-xl border ${
                isDark 
                  ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' 
                  : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
            />
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={expandAll}
              className={`px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              展开全部
            </button>
            <button
              onClick={collapseAll}
              className={`px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              收起全部
            </button>
          </div>
        </div>
      </MonitorContentCard>

      {/* 错误提示 */}
      {error && (
        <div className={`mb-6 p-4 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {error}
        </div>
      )}

      {/* 版本列表 */}
      <MonitorContentCard title="版本历史" icon={GitBranch} noPadding>
        <div className="divide-y divide-slate-700/50">
          {filteredPlaybooks.length === 0 ? (
            <div className={`p-8 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {searchTerm ? '没有找到匹配的 Playbook' : '暂无 Playbook 数据'}
            </div>
          ) : (
            filteredPlaybooks.map(playbook => (
              <div key={playbook.id}>
                {/* Playbook 主行 */}
                <div
                  className={`flex items-center px-6 py-4 cursor-pointer transition-colors ${
                    isDark ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => toggleExpand(playbook.id)}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    {expandedIds.has(playbook.id) ? (
                      <ChevronDown className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                    ) : (
                      <ChevronRight className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                    )}
                    <FileText className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{playbook.name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-mono ${isDark ? 'bg-slate-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                      v{playbook.version}
                    </span>
                    <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>当前版本</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {playbook.history?.length || 0} 个历史版本
                    </span>
                    <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {formatDateTime(playbook.updated_at, 'YYYY-MM-DD HH:mm')}
                    </span>
                  </div>
                </div>

                {/* 历史版本列表 */}
                {expandedIds.has(playbook.id) && playbook.history && playbook.history.length > 0 && (
                  <div className={`${isDark ? 'bg-slate-800/30' : 'bg-gray-50'}`}>
                    {playbook.history.map((version, index) => (
                      <div
                        key={version.id}
                        className={`flex items-center px-6 py-3 pl-16 border-l-2 ml-6 ${
                          isDark ? 'border-slate-600' : 'border-gray-300'
                        }`}
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          <GitBranch className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
                          <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                            isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-600'
                          }`}>
                            v{version.version}
                          </span>
                          {index === 0 && (
                            <span className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-600'}`}>
                              最近
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {formatDateTime(version.created_at, 'YYYY-MM-DD HH:mm')}
                          </span>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleViewContent(version.version, version.content) }}
                              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-blue-400 hover:bg-blue-500/20' : 'text-blue-600 hover:bg-blue-50'}`}
                              title="查看内容"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRestore(playbook, version) }}
                              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-amber-400 hover:bg-amber-500/20' : 'text-amber-600 hover:bg-amber-50'}`}
                              title="恢复此版本"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 无历史版本提示 */}
                {expandedIds.has(playbook.id) && (!playbook.history || playbook.history.length === 0) && (
                  <div className={`px-6 py-4 pl-16 ${isDark ? 'bg-slate-800/30 text-gray-500' : 'bg-gray-50 text-gray-400'}`}>
                    暂无历史版本
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </MonitorContentCard>

      {/* 查看内容弹窗 */}
      {viewContent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                版本 v{viewContent.version} 内容
              </h3>
              <button
                onClick={() => setViewContent(null)}
                className={`p-1 rounded-lg ${isDark ? 'text-gray-400 hover:bg-slate-700' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <pre className={`p-4 rounded-xl text-sm overflow-x-auto ${isDark ? 'bg-slate-900 text-gray-300' : 'bg-gray-900 text-gray-100'}`}>
                {viewContent.content}
              </pre>
            </div>
            <div className={`px-6 py-4 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
              <button
                onClick={() => setViewContent(null)}
                className={`w-full px-4 py-2 rounded-xl font-medium ${isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 确认对话框 */}
      <ConfirmDialog {...confirmDialog.dialogProps} />
    </MonitorPageLayout>
  )
}

export default PlaybookVersionHistory
