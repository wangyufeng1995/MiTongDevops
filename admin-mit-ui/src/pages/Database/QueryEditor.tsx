/**
 * SQL 查询编辑器组件
 * 
 * 特点:
 * - SQL 编辑区域（使用 textarea，支持基本语法高亮）
 * - 执行按钮、导出按钮
 * - 查询历史记录
 * - 快捷键支持 (Ctrl+Enter 执行)
 * - 危险操作二次确认（DROP、DELETE、TRUNCATE）
 * 
 * Requirements: 4.1, 4.7, 6.5, 7.4
 */
import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Play,
  Download,
  Trash2,
  Clock,
  History,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  FileText,
  Database
} from 'lucide-react'
import { 
  databaseService, 
  DatabaseConnection, 
  QueryResult,
  DatabaseType
} from '../../services/database'
import { databaseToast, DangerousOperationModal, DangerousOperationType } from './components'
import QueryResultTable from './QueryResultTable'

interface QueryEditorProps {
  connection: DatabaseConnection
  schema?: string
  initialSql?: string
  onQueryExecuted?: (result: QueryResult) => void
}

// 数据库类型颜色配置
const DatabaseTypeColors: Record<DatabaseType, { gradient: string; buttonBg: string }> = {
  postgresql: {
    gradient: 'from-blue-500 to-indigo-600',
    buttonBg: 'bg-blue-500 hover:bg-blue-600'
  },
  mysql: {
    gradient: 'from-orange-500 to-amber-600',
    buttonBg: 'bg-orange-500 hover:bg-orange-600'
  },
  dm: {
    gradient: 'from-red-500 to-rose-600',
    buttonBg: 'bg-red-500 hover:bg-red-600'
  },
  oracle: {
    gradient: 'from-red-700 to-orange-600',
    buttonBg: 'bg-red-700 hover:bg-red-800'
  }
}

export const QueryEditor: React.FC<QueryEditorProps> = ({
  connection,
  schema,
  initialSql = '',
  onQueryExecuted
}) => {
  const [sql, setSql] = useState(initialSql)
  const [executing, setExecuting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [queryHistory, setQueryHistory] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)
  const [editorHeight, setEditorHeight] = useState(200)
  
  // 危险操作确认状态
  const [showDangerousConfirm, setShowDangerousConfirm] = useState(false)
  const [dangerousOperationType, setDangerousOperationType] = useState<DangerousOperationType>('DELETE')
  const [pendingSql, setPendingSql] = useState('')
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)

  const colors = DatabaseTypeColors[connection.db_type as DatabaseType] || DatabaseTypeColors.postgresql

  // 检测危险操作
  const detectDangerousOperation = (sql: string): DangerousOperationType | null => {
    const upperSql = sql.toUpperCase().trim()
    
    // 检测 DROP 操作
    if (/^\s*DROP\s+/i.test(upperSql)) {
      return 'DROP'
    }
    
    // 检测 TRUNCATE 操作
    if (/^\s*TRUNCATE\s+/i.test(upperSql)) {
      return 'TRUNCATE'
    }
    
    // 检测 DELETE 操作（没有 WHERE 子句的更危险）
    if (/^\s*DELETE\s+/i.test(upperSql)) {
      return 'DELETE'
    }
    
    // 检测 ALTER 操作
    if (/^\s*ALTER\s+/i.test(upperSql)) {
      return 'ALTER'
    }
    
    // 检测 UPDATE 操作（没有 WHERE 子句的更危险）
    if (/^\s*UPDATE\s+/i.test(upperSql) && !/\bWHERE\b/i.test(upperSql)) {
      return 'UPDATE'
    }
    
    return null
  }

  // 实际执行查询
  const doExecuteQuery = useCallback(async (sqlToExecute: string) => {
    setExecuting(true)
    setError(null)
    setResult(null)

    try {
      const queryResult = await databaseService.executeQuery(connection.id, {
        sql: sqlToExecute,
        page: 1,
        per_page: 50,
        max_rows: 1000
      })
      
      setResult(queryResult)
      onQueryExecuted?.(queryResult)
      
      // 添加到历史记录
      setQueryHistory(prev => {
        const newHistory = [sqlToExecute, ...prev.filter(h => h !== sqlToExecute)].slice(0, 20)
        return newHistory
      })
      
      databaseToast.querySuccess(
        '查询成功',
        `返回 ${queryResult.row_count} 条记录，耗时 ${queryResult.execution_time}ms`
      )
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || '查询执行失败'
      setError(errorMessage)
      databaseToast.error('查询失败', errorMessage)
    } finally {
      setExecuting(false)
    }
  }, [connection.id, onQueryExecuted])

  // 执行查询（带危险操作检测）
  const executeQuery = useCallback(async () => {
    const trimmedSql = sql.trim()
    if (!trimmedSql) {
      databaseToast.warning('请输入 SQL 语句')
      return
    }

    // 检测危险操作
    const dangerousOp = detectDangerousOperation(trimmedSql)
    if (dangerousOp) {
      setDangerousOperationType(dangerousOp)
      setPendingSql(trimmedSql)
      setShowDangerousConfirm(true)
      return
    }

    await doExecuteQuery(trimmedSql)
  }, [sql, doExecuteQuery])

  // 确认执行危险操作
  const confirmDangerousOperation = useCallback(async () => {
    setShowDangerousConfirm(false)
    await doExecuteQuery(pendingSql)
    setPendingSql('')
  }, [pendingSql, doExecuteQuery])

  // 导出 CSV
  const exportCsv = useCallback(async () => {
    const trimmedSql = sql.trim()
    if (!trimmedSql) {
      databaseToast.warning('请输入 SQL 语句')
      return
    }

    setExporting(true)
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filename = `query_result_${timestamp}.csv`
      await databaseService.downloadCsv(connection.id, { sql: trimmedSql }, filename)
      databaseToast.success('导出成功', `文件已下载: ${filename}`)
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || '导出失败'
      databaseToast.error('导出失败', errorMessage)
    } finally {
      setExporting(false)
    }
  }, [sql, connection.id])

  // 清空编辑器
  const clearEditor = () => {
    setSql('')
    setResult(null)
    setError(null)
    textareaRef.current?.focus()
  }

  // 复制 SQL
  const copySql = () => {
    navigator.clipboard.writeText(sql)
    setCopiedSql(true)
    setTimeout(() => setCopiedSql(false), 2000)
  }

  // 从历史记录加载
  const loadFromHistory = (historySql: string) => {
    setSql(historySql)
    setShowHistory(false)
    textareaRef.current?.focus()
  }

  // 键盘快捷键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter 或 Cmd+Enter 执行查询
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      executeQuery()
    }
  }

  // 拖拽调整编辑器高度
  useEffect(() => {
    const resizeHandle = resizeRef.current
    if (!resizeHandle) return

    let startY = 0
    let startHeight = 0

    const onMouseDown = (e: MouseEvent) => {
      startY = e.clientY
      startHeight = editorHeight
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }

    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - startY
      const newHeight = Math.max(100, Math.min(500, startHeight + delta))
      setEditorHeight(newHeight)
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    resizeHandle.addEventListener('mousedown', onMouseDown)
    return () => {
      resizeHandle.removeEventListener('mousedown', onMouseDown)
    }
  }, [editorHeight])

  // 分页处理
  const handlePageChange = async (page: number) => {
    if (!sql.trim()) return
    
    setExecuting(true)
    try {
      const queryResult = await databaseService.executeQuery(connection.id, {
        sql: sql.trim(),
        page,
        per_page: result?.pagination?.per_page || 50,
        max_rows: 1000
      })
      setResult(queryResult)
    } catch (err: any) {
      databaseToast.error('加载失败', err.message)
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 头部工具栏 */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${colors.gradient} flex items-center justify-center shadow-sm`}>
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">SQL 查询</h3>
              <p className="text-xs text-gray-500">
                {connection.name} {schema ? `· ${schema}` : ''}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* 历史记录按钮 */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                showHistory 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="查询历史"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">历史</span>
              {queryHistory.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs rounded bg-gray-200 text-gray-600">
                  {queryHistory.length}
                </span>
              )}
            </button>
            
            {/* 复制按钮 */}
            <button
              onClick={copySql}
              disabled={!sql.trim()}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="复制 SQL"
            >
              {copiedSql ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            
            {/* 清空按钮 */}
            <button
              onClick={clearEditor}
              disabled={!sql.trim() && !result}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="清空"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            
            {/* 导出按钮 */}
            <button
              onClick={exportCsv}
              disabled={exporting || !sql.trim()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              title="导出 CSV"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">导出</span>
            </button>
            
            {/* 执行按钮 */}
            <button
              onClick={executeQuery}
              disabled={executing || !sql.trim()}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm text-white rounded-lg transition-colors disabled:opacity-50 ${colors.buttonBg}`}
              title="执行 (Ctrl+Enter)"
            >
              {executing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              <span>执行</span>
            </button>
          </div>
        </div>
      </div>

      {/* 历史记录面板 */}
      {showHistory && queryHistory.length > 0 && (
        <div className="bg-white border-b max-h-48 overflow-auto">
          <div className="p-2 space-y-1">
            {queryHistory.map((historySql, index) => (
              <button
                key={index}
                onClick={() => loadFromHistory(historySql)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors group"
              >
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span className="font-mono text-xs truncate flex-1">{historySql}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SQL 编辑区域 */}
      <div className="bg-white border-b relative" style={{ height: editorHeight }}>
        <textarea
          ref={textareaRef}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入 SQL 查询语句... (Ctrl+Enter 执行)"
          className="w-full h-full p-4 font-mono text-sm text-gray-800 bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
          spellCheck={false}
        />
        
        {/* 拖拽调整高度的手柄 */}
        <div
          ref={resizeRef}
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-gradient-to-b from-transparent to-gray-200 hover:to-gray-300 transition-colors"
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">查询错误</p>
              <p className="text-sm text-red-600 mt-1 font-mono whitespace-pre-wrap">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 查询结果区域 */}
      <div className="flex-1 overflow-hidden">
        {result ? (
          <QueryResultTable 
            result={result} 
            loading={executing}
            onPageChange={handlePageChange}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">输入 SQL 语句并执行查询</p>
              <p className="text-gray-400 text-sm mt-1">使用 Ctrl+Enter 快速执行</p>
            </div>
          </div>
        )}
      </div>

      {/* 危险操作确认弹窗 */}
      <DangerousOperationModal
        isOpen={showDangerousConfirm}
        onClose={() => {
          setShowDangerousConfirm(false)
          setPendingSql('')
        }}
        onConfirm={confirmDangerousOperation}
        operationType={dangerousOperationType}
        sql={pendingSql}
        loading={executing}
      />
    </div>
  )
}

export default QueryEditor
