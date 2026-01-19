/**
 * SQL 编辑器组件
 * 
 * 提供 SQL 编写和执行功能
 */
import React, { useState, useRef, useEffect } from 'react'
import {
  Play,
  Download,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  Maximize2,
  Minimize2,
  RefreshCw
} from 'lucide-react'
import { Loading } from '../../components/Loading'
import { 
  databaseService, 
  DatabaseConnection,
  QueryResult 
} from '../../services/database'
import { databaseToast } from './components'

interface SqlEditorProps {
  connection: DatabaseConnection
  schema?: string
  initialSql?: string
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  connection,
  schema,
  initialSql = ''
}) => {
  const [sql, setSql] = useState(initialSql)
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage] = useState(50)
  const [copiedCell, setCopiedCell] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 执行 SQL
  const executeQuery = async (page: number = 1) => {
    if (!sql.trim()) {
      databaseToast.warning('请输入 SQL', '请输入要执行的 SQL 语句')
      return
    }

    setExecuting(true)
    setError(null)

    try {
      const queryResult = await databaseService.executeQuery(connection.id, {
        sql: sql.trim(),
        page,
        per_page: perPage,
        max_rows: 10000
      })
      
      setResult(queryResult)
      setCurrentPage(page)
      
      // 添加到历史记录
      if (!history.includes(sql.trim())) {
        setHistory(prev => [sql.trim(), ...prev.slice(0, 19)])
      }
      
      if (queryResult.affected_rows !== undefined && queryResult.affected_rows > 0) {
        databaseToast.success('执行成功', `影响 ${queryResult.affected_rows} 行`)
      }
    } catch (err: any) {
      setError(err.message || '执行失败')
      setResult(null)
      databaseToast.error('执行失败', err.message)
    } finally {
      setExecuting(false)
    }
  }

  // 导出 CSV
  const handleExportCsv = async () => {
    if (!sql.trim()) return
    
    try {
      await databaseService.downloadCsv(
        connection.id, 
        { sql: sql.trim(), max_rows: 10000 },
        `query_result_${Date.now()}.csv`
      )
      databaseToast.success('导出成功', 'CSV 文件已下载')
    } catch (err: any) {
      databaseToast.error('导出失败', err.message)
    }
  }

  // 复制单元格
  const handleCopyCell = (value: any) => {
    const text = value === null ? 'NULL' : String(value)
    navigator.clipboard.writeText(text)
    setCopiedCell(text)
    setTimeout(() => setCopiedCell(null), 2000)
  }

  // 清空
  const handleClear = () => {
    setSql('')
    setResult(null)
    setError(null)
    textareaRef.current?.focus()
  }

  // 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter 执行
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        executeQuery()
      }
      // Escape 退出全屏
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sql, isFullscreen])

  const totalPages = result?.pagination?.pages || 1

  return (
    <div className={`flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Database className="w-4 h-4" />
            <span>{connection.name}</span>
            {schema && (
              <>
                <span className="text-gray-300">/</span>
                <span>{schema}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => executeQuery()}
            disabled={executing || !sql.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {executing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            执行
          </button>
          <button
            onClick={handleExportCsv}
            disabled={!result || result.rows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            导出
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            清空
          </button>
          <div className="w-px h-5 bg-gray-300" />
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
            title={isFullscreen ? '退出全屏' : '全屏'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* SQL 编辑区 */}
      <div className="flex-shrink-0 border-b">
        <textarea
          ref={textareaRef}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          placeholder="输入 SQL 语句... (Ctrl+Enter 执行)"
          className="w-full h-32 p-4 font-mono text-sm resize-none focus:outline-none bg-gray-900 text-green-400 placeholder-gray-500"
          spellCheck={false}
        />
      </div>

      {/* 结果区域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 状态栏 */}
        {(result || error) && (
          <div className={`flex items-center justify-between px-4 py-2 text-sm ${
            error ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            <div className="flex items-center gap-2">
              {error ? (
                <>
                  <AlertCircle className="w-4 h-4" />
                  <span>执行失败</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    {result?.affected_rows !== undefined 
                      ? `影响 ${result.affected_rows} 行`
                      : `返回 ${result?.row_count || 0} 条记录`
                    }
                  </span>
                </>
              )}
            </div>
            {result && (
              <div className="flex items-center gap-3 text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {result.execution_time}ms
                </span>
              </div>
            )}
          </div>
        )}

        {/* 错误信息 */}
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-100">
            <pre className="text-sm text-red-600 whitespace-pre-wrap font-mono">{error}</pre>
          </div>
        )}

        {/* 结果表格 */}
        {result && result.rows.length > 0 && (
          <>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-r bg-gray-100 w-12">#</th>
                    {result.columns.map((col, idx) => (
                      <th 
                        key={idx} 
                        className="px-3 py-2 text-left font-medium text-gray-600 border-r last:border-r-0 whitespace-nowrap bg-gray-100"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-blue-50 border-b border-gray-100">
                      <td className="px-3 py-2 text-gray-400 text-xs border-r bg-gray-50">
                        {(currentPage - 1) * perPage + rowIdx + 1}
                      </td>
                      {row.map((cell, cellIdx) => (
                        <td 
                          key={cellIdx} 
                          className="px-3 py-2 border-r last:border-r-0 max-w-xs truncate cursor-pointer hover:bg-blue-100 group relative"
                          title={cell === null ? 'NULL' : String(cell)}
                          onClick={() => handleCopyCell(cell)}
                        >
                          {cell === null ? (
                            <span className="text-gray-300 italic">NULL</span>
                          ) : typeof cell === 'object' ? (
                            <span className="font-mono text-xs text-purple-600">{JSON.stringify(cell)}</span>
                          ) : (
                            <span className="text-gray-700">{String(cell)}</span>
                          )}
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {copiedCell === (cell === null ? 'NULL' : String(cell)) ? (
                              <Check className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
                <div className="text-sm text-gray-500">
                  第 {currentPage} / {totalPages} 页，共 {result.row_count} 条
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => executeQuery(currentPage - 1)}
                    disabled={currentPage <= 1 || executing}
                    className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => executeQuery(currentPage + 1)}
                    disabled={currentPage >= totalPages || executing}
                    className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* 空结果 */}
        {result && result.rows.length === 0 && !error && (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>查询执行成功，无返回数据</p>
              {result.affected_rows !== undefined && result.affected_rows > 0 && (
                <p className="text-sm text-emerald-600 mt-1">影响了 {result.affected_rows} 行</p>
              )}
            </div>
          </div>
        )}

        {/* 初始状态 */}
        {!result && !error && !executing && (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Play className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>输入 SQL 语句并点击执行</p>
              <p className="text-sm text-gray-400 mt-1">或按 Ctrl+Enter 快速执行</p>
            </div>
          </div>
        )}

        {/* 执行中 */}
        {executing && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loading size="lg" />
              <p className="text-gray-500 mt-3">正在执行...</p>
            </div>
          </div>
        )}
      </div>

      {/* 历史记录 */}
      {history.length > 0 && (
        <div className="border-t bg-gray-50">
          <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            历史记录
          </div>
          <div className="max-h-24 overflow-auto px-2 pb-2">
            {history.slice(0, 5).map((item, idx) => (
              <button
                key={idx}
                onClick={() => setSql(item)}
                className="w-full text-left px-3 py-1.5 text-xs font-mono text-gray-600 hover:bg-white rounded truncate"
                title={item}
              >
                {item.length > 80 ? item.substring(0, 80) + '...' : item}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default SqlEditor
