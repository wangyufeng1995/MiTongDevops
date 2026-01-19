/**
 * 表详情组件
 * 
 * 显示列信息、索引信息、数据预览
 * 
 * Requirements: 3.4, 3.5, 4.2
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Table,
  Key,
  Hash,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Database,
  Columns,
  ListOrdered,
  CheckCircle,
  XCircle,
  Eye,
  FileText,
  Copy,
  Check,
  Play,
  Download
} from 'lucide-react'
import { Loading } from '../../components/Loading'
import { 
  databaseService, 
  DatabaseConnection, 
  TableInfo,
  ColumnInfo,
  IndexInfo,
  DatabaseType,
  QueryResult
} from '../../services/database'
import { databaseToast } from './components'

interface TableDetailProps {
  connection: DatabaseConnection
  schema: string
  table: TableInfo
  onBack?: () => void
}

type TabType = 'columns' | 'indexes' | 'data'

// 数据库类型颜色配置
const DatabaseTypeColors: Record<DatabaseType, { bg: string; text: string; gradient: string }> = {
  postgresql: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    gradient: 'from-blue-500 to-indigo-600'
  },
  mysql: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    gradient: 'from-orange-500 to-amber-600'
  },
  dm: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    gradient: 'from-red-500 to-rose-600'
  },
  oracle: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    gradient: 'from-red-700 to-orange-600'
  }
}

export const TableDetail: React.FC<TableDetailProps> = ({
  connection,
  schema,
  table,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('columns')
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [indexes, setIndexes] = useState<IndexInfo[]>([])
  const [loadingColumns, setLoadingColumns] = useState(false)
  const [loadingIndexes, setLoadingIndexes] = useState(false)
  const [copiedColumn, setCopiedColumn] = useState<string | null>(null)
  
  // 数据预览状态
  const [dataResult, setDataResult] = useState<QueryResult | null>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [dataPage, setDataPage] = useState(1)
  const [dataPerPage] = useState(50)

  // 加载列信息
  const loadColumns = useCallback(async () => {
    try {
      setLoadingColumns(true)
      const columnList = await databaseService.getTableColumns(
        connection.id, 
        table.name, 
        schema
      )
      setColumns(columnList)
    } catch (error: any) {
      databaseToast.error('加载列信息失败', error.message)
    } finally {
      setLoadingColumns(false)
    }
  }, [connection.id, table.name, schema])

  // 加载索引信息
  const loadIndexes = useCallback(async () => {
    try {
      setLoadingIndexes(true)
      const indexList = await databaseService.getTableIndexes(
        connection.id, 
        table.name, 
        schema
      )
      setIndexes(indexList)
    } catch (error: any) {
      databaseToast.error('加载索引信息失败', error.message)
    } finally {
      setLoadingIndexes(false)
    }
  }, [connection.id, table.name, schema])

  // 加载数据预览
  const loadData = useCallback(async (page: number = 1) => {
    try {
      setLoadingData(true)
      // 构建查询 SQL
      const tableName = schema ? `${schema}.${table.name}` : table.name
      const sql = `SELECT * FROM ${tableName}`
      
      const result = await databaseService.executeQuery(connection.id, {
        sql,
        page,
        per_page: dataPerPage,
        max_rows: 1000
      })
      setDataResult(result)
      setDataPage(page)
    } catch (error: any) {
      databaseToast.error('加载数据失败', error.message)
    } finally {
      setLoadingData(false)
    }
  }, [connection.id, table.name, schema, dataPerPage])

  // 初始加载
  useEffect(() => {
    loadColumns()
    loadIndexes()
  }, [loadColumns, loadIndexes])

  // 刷新
  const handleRefresh = () => {
    if (activeTab === 'columns') {
      loadColumns()
    } else if (activeTab === 'indexes') {
      loadIndexes()
    } else {
      loadData(dataPage)
    }
  }

  // 当切换到数据 Tab 时加载数据
  useEffect(() => {
    if (activeTab === 'data' && !dataResult && !loadingData) {
      loadData(1)
    }
  }, [activeTab, dataResult, loadingData, loadData])

  // 导出 CSV
  const handleExportCsv = async () => {
    try {
      const tableName = schema ? `${schema}.${table.name}` : table.name
      const sql = `SELECT * FROM ${tableName}`
      await databaseService.downloadCsv(connection.id, { sql, max_rows: 10000 }, `${table.name}.csv`)
      databaseToast.success('导出成功', 'CSV 文件已下载')
    } catch (error: any) {
      databaseToast.error('导出失败', error.message)
    }
  }

  // 复制列名
  const handleCopyColumn = (columnName: string) => {
    navigator.clipboard.writeText(columnName)
    setCopiedColumn(columnName)
    setTimeout(() => setCopiedColumn(null), 2000)
  }

  // 获取数据库类型颜色
  const colors = DatabaseTypeColors[connection.db_type as DatabaseType] || DatabaseTypeColors.postgresql

  // 渲染列信息表格
  const renderColumnsTable = () => {
    if (loadingColumns) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loading size="md" />
        </div>
      )
    }

    if (columns.length === 0) {
      return (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <div className="text-center">
            <Columns className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>暂无列信息</p>
          </div>
        </div>
      )
    }

    return (
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-8">#</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">列名</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">数据类型</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 w-20">可空</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 w-20">主键</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">默认值</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">备注</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 w-16">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {columns.map((column, index) => (
              <tr key={column.name} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {column.is_primary_key && (
                      <span title="主键"><Key className="w-4 h-4 text-amber-500" /></span>
                    )}
                    <span className="font-mono text-gray-900">{column.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 font-mono">
                    {column.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {column.nullable ? (
                    <span title="可空"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></span>
                  ) : (
                    <span title="非空"><XCircle className="w-4 h-4 text-red-400 mx-auto" /></span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {column.is_primary_key ? (
                    <span title="主键"><Key className="w-4 h-4 text-amber-500 mx-auto" /></span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {column.default_value ? (
                    <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {column.default_value}
                    </span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate" title={column.comment}>
                  {column.comment || '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleCopyColumn(column.name)}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                    title="复制列名"
                  >
                    {copiedColumn === column.name ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // 渲染索引信息表格
  const renderIndexesTable = () => {
    if (loadingIndexes) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loading size="md" />
        </div>
      )
    }

    if (indexes.length === 0) {
      return (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <div className="text-center">
            <ListOrdered className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>暂无索引信息</p>
          </div>
        </div>
      )
    }

    return (
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-8">#</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">索引名称</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">列</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 w-24">唯一</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 w-24">主键</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {indexes.map((index, idx) => (
              <tr key={index.name} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {index.is_primary && (
                      <span title="主键索引"><Key className="w-4 h-4 text-amber-500" /></span>
                    )}
                    {index.is_unique && !index.is_primary && (
                      <span title="唯一索引"><Hash className="w-4 h-4 text-purple-500" /></span>
                    )}
                    <span className="font-mono text-gray-900">{index.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {index.columns.map((col, colIdx) => (
                      <span 
                        key={colIdx}
                        className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700 font-mono"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  {index.is_unique ? (
                    <span title="唯一"><CheckCircle className="w-4 h-4 text-purple-500 mx-auto" /></span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {index.is_primary ? (
                    <span title="主键"><Key className="w-4 h-4 text-amber-500 mx-auto" /></span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // 渲染数据预览表格
  const renderDataTable = () => {
    if (loadingData) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loading size="md" />
        </div>
      )
    }

    if (!dataResult || dataResult.rows.length === 0) {
      return (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <div className="text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>暂无数据</p>
            <button
              onClick={() => loadData(1)}
              className="mt-3 px-4 py-2 text-sm text-white bg-blue-500 rounded-lg hover:bg-blue-600"
            >
              <Play className="w-4 h-4 inline mr-1" />
              加载数据
            </button>
          </div>
        </div>
      )
    }

    const { columns: cols, rows, row_count, execution_time, pagination } = dataResult
    const totalPages = pagination?.pages || 1

    return (
      <div className="flex flex-col h-full">
        {/* 工具栏 */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>共 {row_count} 条记录</span>
            <span>耗时 {execution_time}ms</span>
          </div>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            导出 CSV
          </button>
        </div>

        {/* 数据表格 */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 w-12 border-r">#</th>
                {cols.map((col, idx) => (
                  <th key={idx} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap border-r last:border-r-0">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-blue-50">
                  <td className="px-3 py-2 text-gray-400 text-xs border-r bg-gray-50">
                    {(dataPage - 1) * dataPerPage + rowIdx + 1}
                  </td>
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="px-3 py-2 text-gray-700 border-r last:border-r-0 max-w-xs truncate" title={String(cell ?? '')}>
                      {cell === null ? (
                        <span className="text-gray-300 italic">NULL</span>
                      ) : typeof cell === 'object' ? (
                        <span className="font-mono text-xs">{JSON.stringify(cell)}</span>
                      ) : (
                        String(cell)
                      )}
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
              第 {dataPage} / {totalPages} 页
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadData(dataPage - 1)}
                disabled={dataPage <= 1 || loadingData}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => loadData(dataPage + 1)}
                disabled={dataPage >= totalPages || loadingData}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* 头部信息 */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="返回"
              >
                <ChevronLeft className="w-5 h-5 text-gray-500" />
              </button>
            )}
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors.gradient} flex items-center justify-center shadow-sm`}>
              {table.type === 'view' ? (
                <Eye className="w-5 h-5 text-white" />
              ) : (
                <Table className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-gray-900">{table.name}</h3>
                <span className={`px-2 py-0.5 text-xs rounded ${
                  table.type === 'view' 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {table.type === 'view' ? '视图' : '表'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {schema} · {connection.name}
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loadingColumns || loadingIndexes}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${
              (loadingColumns || loadingIndexes) ? 'animate-spin' : ''
            }`} />
          </button>
        </div>

        {/* 统计信息 */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-gray-500">
            <Columns className="w-4 h-4" />
            <span>{columns.length} 列</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-500">
            <ListOrdered className="w-4 h-4" />
            <span>{indexes.length} 索引</span>
          </div>
          {table.row_count !== undefined && (
            <div className="flex items-center gap-1.5 text-gray-500">
              <FileText className="w-4 h-4" />
              <span>约 {table.row_count.toLocaleString()} 行</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex border-b bg-gray-50">
        <button
          onClick={() => setActiveTab('columns')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'columns'
              ? 'border-blue-500 text-blue-600 bg-white'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Columns className="w-4 h-4" />
          列信息
          <span className={`px-1.5 py-0.5 text-xs rounded ${
            activeTab === 'columns' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'
          }`}>
            {columns.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('indexes')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'indexes'
              ? 'border-blue-500 text-blue-600 bg-white'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          索引信息
          <span className={`px-1.5 py-0.5 text-xs rounded ${
            activeTab === 'indexes' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'
          }`}>
            {indexes.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'data'
              ? 'border-blue-500 text-blue-600 bg-white'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          数据预览
          {dataResult && (
            <span className={`px-1.5 py-0.5 text-xs rounded ${
              activeTab === 'data' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'
            }`}>
              {dataResult.row_count}
            </span>
          )}
        </button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'columns' && renderColumnsTable()}
        {activeTab === 'indexes' && renderIndexesTable()}
        {activeTab === 'data' && renderDataTable()}
      </div>
    </div>
  )
}

export default TableDetail
