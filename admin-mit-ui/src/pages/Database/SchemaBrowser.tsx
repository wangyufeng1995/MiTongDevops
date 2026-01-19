/**
 * Schema 浏览器组件
 * 
 * 树形结构显示数据库、Schema、表
 * 表搜索功能
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.6
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Database,
  Table,
  Search,
  RefreshCw,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Eye,
  Layers,
  FileText,
  Server
} from 'lucide-react'
import { Loading } from '../../components/Loading'
import { 
  databaseService, 
  DatabaseConnection, 
  TableInfo,
  DatabaseType
} from '../../services/database'
import { databaseToast } from './components'

interface SchemaBrowserProps {
  connection: DatabaseConnection
  schema?: string | null
  onSelectTable: (table: TableInfo) => void
}

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

export const SchemaBrowser: React.FC<SchemaBrowserProps> = ({
  connection,
  schema,
  onSelectTable
}) => {
  const [schemas, setSchemas] = useState<string[]>([])
  const [tables, setTables] = useState<TableInfo[]>([])
  const [filteredTables, setFilteredTables] = useState<TableInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingTables, setLoadingTables] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSchema, setSelectedSchema] = useState<string | null>(schema || null)
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set())
  const [schemaTablesMap, setSchemaTablesMap] = useState<Record<string, TableInfo[]>>({})
  const [loadingSchemas, setLoadingSchemas] = useState<Set<string>>(new Set())
  
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  // 加载 Schema 列表
  const loadSchemas = useCallback(async () => {
    try {
      setLoading(true)
      const schemaList = await databaseService.getSchemas(connection.id)
      
      // MySQL 可能返回空列表或单个数据库
      if (schemaList.length === 0) {
        // 直接使用空字符串作为 schema
        setSchemas([''])
        setSelectedSchema('')
        setExpandedSchemas(new Set(['']))
        await loadTablesForSchema('')
      } else if (schemaList.length === 1 && connection.db_type === 'mysql') {
        // MySQL 只有一个数据库时自动选中
        setSchemas(schemaList)
        setSelectedSchema(schemaList[0])
        setExpandedSchemas(new Set([schemaList[0]]))
        await loadTablesForSchema(schemaList[0])
      } else {
        setSchemas(schemaList)
        // 如果有传入的 schema，自动展开并加载表
        if (schema && schemaList.includes(schema)) {
          setSelectedSchema(schema)
          setExpandedSchemas(new Set([schema]))
          await loadTablesForSchema(schema)
        }
      }
    } catch (error: any) {
      // 如果获取 Schema 失败，尝试直接加载表（适用于 MySQL）
      console.error('加载 Schema 列表失败:', error)
      try {
        setSchemas([''])
        setSelectedSchema('')
        setExpandedSchemas(new Set(['']))
        await loadTablesForSchema('')
      } catch (tableError) {
        databaseToast.error('加载失败', error.message)
      }
    } finally {
      setLoading(false)
    }
  }, [connection.id, connection.db_type, schema])

  // 加载指定 Schema 的表列表
  const loadTablesForSchema = async (schemaName: string) => {
    if (schemaTablesMap[schemaName]) {
      return // 已加载过
    }
    
    setLoadingSchemas(prev => new Set([...prev, schemaName]))
    
    try {
      const tableList = await databaseService.getTables(connection.id, { schema: schemaName })
      setSchemaTablesMap(prev => ({
        ...prev,
        [schemaName]: tableList
      }))
    } catch (error: any) {
      databaseToast.error('加载表列表失败', error.message)
    } finally {
      setLoadingSchemas(prev => {
        const next = new Set(prev)
        next.delete(schemaName)
        return next
      })
    }
  }

  // 初始加载
  useEffect(() => {
    loadSchemas()
  }, [loadSchemas])

  // 搜索过滤
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTables([])
      return
    }

    // 搜索所有已加载的表
    const query = searchQuery.toLowerCase()
    const results: TableInfo[] = []
    
    Object.entries(schemaTablesMap).forEach(([schemaName, tables]) => {
      tables.forEach(table => {
        if (table.name.toLowerCase().includes(query)) {
          results.push({ ...table, schema: schemaName })
        }
      })
    })
    
    setFilteredTables(results)
  }, [searchQuery, schemaTablesMap])

  // 处理搜索输入
  const handleSearch = (value: string) => {
    setSearchQuery(value)
  }

  // 展开/折叠 Schema
  const toggleSchema = async (schemaName: string) => {
    const isExpanded = expandedSchemas.has(schemaName)
    
    if (isExpanded) {
      setExpandedSchemas(prev => {
        const next = new Set(prev)
        next.delete(schemaName)
        return next
      })
    } else {
      setExpandedSchemas(prev => new Set([...prev, schemaName]))
      await loadTablesForSchema(schemaName)
    }
  }

  // 刷新
  const handleRefresh = async () => {
    setSchemaTablesMap({})
    setExpandedSchemas(new Set())
    await loadSchemas()
  }

  // 获取数据库类型颜色
  const colors = DatabaseTypeColors[connection.db_type as DatabaseType] || DatabaseTypeColors.postgresql

  // 渲染表类型图标
  const renderTableTypeIcon = (type: 'table' | 'view') => {
    if (type === 'view') {
      return <Eye className="w-4 h-4 text-purple-500" />
    }
    return <Table className="w-4 h-4 text-blue-500" />
  }

  // 渲染搜索结果
  const renderSearchResults = () => {
    if (!searchQuery.trim()) return null

    return (
      <div className="border-t">
        <div className="p-3 bg-gray-50 border-b">
          <span className="text-xs font-medium text-gray-500">
            搜索结果 ({filteredTables.length})
          </span>
        </div>
        <div className="max-h-64 overflow-auto">
          {filteredTables.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              未找到匹配的表
            </div>
          ) : (
            filteredTables.map((table, index) => (
              <div
                key={`${table.schema}-${table.name}-${index}`}
                className="flex items-center px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                onClick={() => onSelectTable(table)}
              >
                <div className="p-1 rounded bg-blue-100 mr-3">
                  {renderTableTypeIcon(table.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {table.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {table.schema}
                  </div>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded ${
                  table.type === 'view' 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {table.type === 'view' ? '视图' : '表'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // 渲染 Schema 树
  const renderSchemaTree = () => {
    if (searchQuery.trim()) return null

    return (
      <div className="flex-1 overflow-auto">
        {schemas.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            暂无 Schema
          </div>
        ) : (
          schemas.map(schemaName => {
            const isExpanded = expandedSchemas.has(schemaName)
            const isLoading = loadingSchemas.has(schemaName)
            const schemaTables = schemaTablesMap[schemaName] || []

            return (
              <div key={schemaName}>
                {/* Schema 节点 */}
                <div
                  className={`flex items-center px-4 py-2 cursor-pointer hover:bg-gray-50 ${
                    selectedSchema === schemaName ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => {
                    setSelectedSchema(schemaName)
                    toggleSchema(schemaName)
                  }}
                >
                  <span className="w-5 h-5 mr-1 flex items-center justify-center">
                    {isLoading ? (
                      <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />
                    ) : isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </span>
                  <div className="p-1 rounded bg-amber-100 mr-2">
                    {isExpanded ? (
                      <FolderOpen className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Folder className="w-4 h-4 text-amber-600" />
                    )}
                  </div>
                  <span className="text-sm text-gray-700 flex-1">{schemaName}</span>
                  {schemaTables.length > 0 && (
                    <span className="text-xs text-gray-400">
                      {schemaTables.length} 个表
                    </span>
                  )}
                </div>

                {/* 表列表 */}
                {isExpanded && (
                  <div className="ml-6">
                    {schemaTables.length === 0 && !isLoading ? (
                      <div className="px-4 py-2 text-xs text-gray-400">
                        暂无表
                      </div>
                    ) : (
                      schemaTables.map(table => (
                        <div
                          key={`${schemaName}-${table.name}`}
                          className="flex items-center px-4 py-1.5 cursor-pointer hover:bg-blue-50 group"
                          onClick={() => onSelectTable({ ...table, schema: schemaName })}
                        >
                          <span className="w-5 h-5 mr-1" />
                          <div className="p-1 rounded bg-blue-100 mr-2">
                            {renderTableTypeIcon(table.type)}
                          </div>
                          <span className="text-sm text-gray-600 flex-1 truncate">
                            {table.name}
                          </span>
                          <span className={`px-1.5 py-0.5 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                            table.type === 'view' 
                              ? 'bg-purple-100 text-purple-600' 
                              : 'bg-blue-100 text-blue-600'
                          }`}>
                            {table.type === 'view' ? '视图' : '表'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })
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
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors.gradient} flex items-center justify-center shadow-sm`}>
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">{connection.name}</h3>
              <p className="text-xs text-gray-500">
                {connection.host}:{connection.port}
                {connection.database && ` / ${connection.database}`}
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 搜索框 */}
        <div className="relative">
          <input
            type="text"
            placeholder="搜索表名..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* 内容区域 */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loading size="md" />
        </div>
      ) : (
        <>
          {renderSearchResults()}
          {renderSchemaTree()}
        </>
      )}

      {/* 底部统计 */}
      <div className="p-3 border-t bg-gray-50 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>{schemas.length} 个 Schema</span>
          <span>
            {Object.values(schemaTablesMap).reduce((sum, tables) => sum + tables.length, 0)} 个表
          </span>
        </div>
      </div>
    </div>
  )
}

export default SchemaBrowser
