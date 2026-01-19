/**
 * 查询结果表格组件
 * 
 * 特点:
 * - 表格显示查询结果
 * - 分页、执行时间显示
 * - 列宽可调整
 * - 单元格内容复制
 * 
 * Requirements: 4.2, 4.3, 4.4, 4.5
 */
import React, { useState, useRef, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Rows,
  Copy,
  Check,
  Table,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { QueryResult } from '../../services/database'

interface QueryResultTableProps {
  result: QueryResult
  loading?: boolean
  onPageChange?: (page: number) => void
}

export const QueryResultTable: React.FC<QueryResultTableProps> = ({
  result,
  loading = false,
  onPageChange
}) => {
  const [copiedCell, setCopiedCell] = useState<string | null>(null)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  const { columns, rows, row_count, execution_time, affected_rows, pagination } = result

  // 复制单元格内容
  const handleCopyCell = useCallback((value: any, cellId: string) => {
    const textValue = value === null ? 'NULL' : String(value)
    navigator.clipboard.writeText(textValue)
    setCopiedCell(cellId)
    setTimeout(() => setCopiedCell(null), 2000)
  }, [])

  // 格式化单元格值
  const formatCellValue = (value: any): string => {
    if (value === null) return 'NULL'
    if (value === undefined) return ''
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value)
      } catch {
        return String(value)
      }
    }
    return String(value)
  }

  // 获取单元格样式
  const getCellStyle = (value: any): string => {
    if (value === null) return 'text-gray-400 italic'
    if (typeof value === 'number') return 'text-blue-600 font-mono'
    if (typeof value === 'boolean') return 'text-purple-600 font-mono'
    return 'text-gray-700'
  }

  // 分页处理
  const currentPage = pagination?.page || 1
  const totalPages = pagination?.pages || 1
  const perPage = pagination?.per_page || 50
  const total = pagination?.total || row_count

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || loading) return
    onPageChange?.(page)
  }

  // 渲染分页控件
  const renderPagination = () => {
    if (!pagination || totalPages <= 1) return null

    const pageNumbers: (number | string)[] = []
    const maxVisiblePages = 5
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i)
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pageNumbers.push(i)
        pageNumbers.push('...')
        pageNumbers.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        pageNumbers.push(1)
        pageNumbers.push('...')
        for (let i = totalPages - 3; i <= totalPages; i++) pageNumbers.push(i)
      } else {
        pageNumbers.push(1)
        pageNumbers.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pageNumbers.push(i)
        pageNumbers.push('...')
        pageNumbers.push(totalPages)
      }
    }

    return (
      <div className="flex items-center gap-1">
        {/* 首页 */}
        <button
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1 || loading}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="首页"
        >
          <ChevronsLeft className="w-4 h-4 text-gray-600" />
        </button>
        
        {/* 上一页 */}
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1 || loading}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="上一页"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        
        {/* 页码 */}
        <div className="flex items-center gap-1 mx-2">
          {pageNumbers.map((page, index) => (
            typeof page === 'number' ? (
              <button
                key={index}
                onClick={() => handlePageChange(page)}
                disabled={loading}
                className={`min-w-[32px] h-8 px-2 text-sm rounded transition-colors ${
                  page === currentPage
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            ) : (
              <span key={index} className="px-1 text-gray-400">...</span>
            )
          ))}
        </div>
        
        {/* 下一页 */}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages || loading}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="下一页"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
        
        {/* 末页 */}
        <button
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages || loading}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="末页"
        >
          <ChevronsRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    )
  }

  // 如果没有数据
  if (columns.length === 0 || rows.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {/* 统计信息栏 */}
        <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>{execution_time}ms</span>
            </div>
            {affected_rows !== undefined && (
              <div className="flex items-center gap-1.5">
                <Rows className="w-4 h-4 text-gray-400" />
                <span>影响 {affected_rows} 行</span>
              </div>
            )}
          </div>
        </div>
        
        {/* 空状态 */}
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <Table className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">查询结果为空</p>
            {affected_rows !== undefined && affected_rows > 0 && (
              <p className="text-gray-400 text-sm mt-1">
                操作成功，影响了 {affected_rows} 行数据
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* 统计信息栏 */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-gray-400" />
            <span>{execution_time}ms</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Rows className="w-4 h-4 text-gray-400" />
            <span>
              {pagination ? (
                <>
                  第 {(currentPage - 1) * perPage + 1}-{Math.min(currentPage * perPage, total)} 条，
                  共 {total.toLocaleString()} 条
                </>
              ) : (
                <>{row_count.toLocaleString()} 条记录</>
              )}
            </span>
          </div>
          {affected_rows !== undefined && (
            <div className="flex items-center gap-1.5 text-green-600">
              <Check className="w-4 h-4" />
              <span>影响 {affected_rows} 行</span>
            </div>
          )}
        </div>
        
        {/* 分页控件 */}
        {renderPagination()}
      </div>

      {/* 加载遮罩 */}
      {loading && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>加载中...</span>
          </div>
        </div>
      )}

      {/* 表格区域 */}
      <div ref={tableRef} className="flex-1 overflow-auto relative">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {/* 行号列 */}
              <th className="px-3 py-2.5 text-left font-medium text-gray-500 border-b border-r bg-gray-100 w-12 sticky left-0">
                #
              </th>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className="px-3 py-2.5 text-left font-medium text-gray-700 border-b border-r bg-gray-50 whitespace-nowrap"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, rowIndex) => {
              const actualRowNumber = pagination 
                ? (currentPage - 1) * perPage + rowIndex + 1 
                : rowIndex + 1
              
              return (
                <tr
                  key={rowIndex}
                  className={`hover:bg-blue-50 transition-colors ${
                    selectedRow === rowIndex ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedRow(rowIndex)}
                >
                  {/* 行号 */}
                  <td className="px-3 py-2 text-gray-400 text-xs border-r bg-gray-50 sticky left-0">
                    {actualRowNumber}
                  </td>
                  {row.map((cell, cellIndex) => {
                    const cellId = `${rowIndex}-${cellIndex}`
                    const cellValue = formatCellValue(cell)
                    const cellStyle = getCellStyle(cell)
                    
                    return (
                      <td
                        key={cellIndex}
                        className="px-3 py-2 border-r group relative"
                      >
                        <div className="flex items-center gap-2">
                          <span 
                            className={`truncate max-w-xs ${cellStyle}`}
                            title={cellValue}
                          >
                            {cellValue}
                          </span>
                          
                          {/* 复制按钮 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopyCell(cell, cellId)
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-opacity"
                            title="复制"
                          >
                            {copiedCell === cellId ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 底部分页（移动端） */}
      {pagination && totalPages > 1 && (
        <div className="bg-white border-t px-4 py-2 flex items-center justify-center sm:hidden">
          {renderPagination()}
        </div>
      )}
    </div>
  )
}

export default QueryResultTable
