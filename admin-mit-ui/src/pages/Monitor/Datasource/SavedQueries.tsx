/**
 * 已保存查询列表组件
 * 
 * 支持保存、加载、删除查询
 * 
 * Requirements: 2.8
 */
import React, { useState, useEffect, useCallback } from 'react'
import { 
  Search, 
  Trash2, 
  Play, 
  Clock, 
  Database,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { datasourceService, SavedPromQLQuery } from '../../../services/datasource'

interface SavedQueriesProps {
  configId?: number
  onLoad: (query: string) => void
  onClose: () => void
}

export const SavedQueries: React.FC<SavedQueriesProps> = ({
  configId,
  onLoad,
  onClose
}) => {
  const [queries, setQueries] = useState<SavedPromQLQuery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [deleting, setDeleting] = useState<number | null>(null)

  // 加载保存的查询
  const loadQueries = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await datasourceService.getSavedQueries({
        config_id: configId,
        per_page: 100
      })
      setQueries(response.queries || [])
    } catch (err: any) {
      setError(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [configId])

  useEffect(() => {
    loadQueries()
  }, [loadQueries])

  // 删除查询
  const handleDelete = async (id: number) => {
    if (!window.confirm('确定要删除这个查询吗？')) return

    try {
      setDeleting(id)
      await datasourceService.deleteSavedQuery(id)
      setQueries(queries.filter(q => q.id !== id))
    } catch (err: any) {
      setError(err.message || '删除失败')
    } finally {
      setDeleting(null)
    }
  }

  // 过滤查询
  const filteredQueries = queries.filter(q =>
    q.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.query.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (q.description && q.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // 格式化时间
  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-4">
      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="搜索查询名称或内容..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 text-red-600 rounded-lg">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
          <button
            onClick={loadQueries}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 加载状态 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      ) : filteredQueries.length === 0 ? (
        <div className="text-center py-12">
          <Database className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">
            {searchTerm ? '没有匹配的查询' : '暂无保存的查询'}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredQueries.map((query) => (
            <div
              key={query.id}
              className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">
                    {query.name}
                  </h4>
                  {query.description && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">
                      {query.description}
                    </p>
                  )}
                  <div className="mt-2 p-2 bg-gray-100 rounded font-mono text-xs text-gray-700 truncate">
                    {query.query}
                  </div>
                  <div className="flex items-center space-x-2 mt-2 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(query.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-1 ml-3">
                  <button
                    onClick={() => onLoad(query.query)}
                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                    title="加载查询"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(query.id)}
                    disabled={deleting === query.id}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                    title="删除查询"
                  >
                    {deleting === query.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 底部按钮 */}
      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          关闭
        </button>
      </div>
    </div>
  )
}

export default SavedQueries
