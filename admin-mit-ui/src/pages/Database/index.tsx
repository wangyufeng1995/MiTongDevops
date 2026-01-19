/**
 * 数据库管理主页面 - 类似 Redis Desktop Manager 的布局
 * 
 * 左侧：连接树（连接列表 -> 数据库 -> Schema -> 表）
 * 右侧：内容面板（表详情/查询编辑器）
 * 
 * Requirements: 3.1-3.6, 9.5
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Database,
  Server,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  Search,
  Folder,
  FolderOpen,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plug,
  PlugZap,
  Table,
  Eye,
  Layers,
  Terminal
} from 'lucide-react'
import { Modal } from '../../components/Modal'
import { Loading } from '../../components/Loading'
import ConnectionForm from './ConnectionForm'
import SchemaBrowser from './SchemaBrowser'
import TableDetail from './TableDetail'
import SqlEditor from './SqlEditor'
import { 
  databaseService, 
  DatabaseConnection, 
  DatabaseType,
  TableInfo,
  DATABASE_TYPES 
} from '../../services/database'
import { 
  DeleteConfirmModal, 
  DatabaseToastContainer, 
  databaseToast 
} from './components'

// 树节点类型
type TreeNodeType = 'connection' | 'database' | 'schema' | 'table'

interface TreeNode {
  id: string
  name: string
  type: TreeNodeType
  icon?: React.ReactNode
  children?: TreeNode[]
  data?: any
  expanded?: boolean
  loading?: boolean
  connected?: boolean
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

export const DatabasePage: React.FC = () => {
  // 连接列表
  const [connections, setConnections] = useState<DatabaseConnection[]>([])
  const [loadingConnections, setLoadingConnections] = useState(false)
  
  // 树状态
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)
  const [connectedIds, setConnectedIds] = useState<Set<number>>(new Set())
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set())
  
  // 右侧面板状态
  const [selectedConnection, setSelectedConnection] = useState<DatabaseConnection | null>(null)
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null)
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null)
  const [rightPanelMode, setRightPanelMode] = useState<'empty' | 'schema' | 'table' | 'sql'>('empty')

  // 弹窗状态
  const [showConnectionForm, setShowConnectionForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<DatabaseConnection | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingConnection, setDeletingConnection] = useState<DatabaseConnection | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false)
  const [pendingConnection, setPendingConnection] = useState<DatabaseConnection | null>(null)

  // 加载连接列表
  const loadConnections = useCallback(async () => {
    try {
      setLoadingConnections(true)
      const response = await databaseService.getConnections({ per_page: 100 })
      const conns = response?.connections || []
      setConnections(conns)
      
      // 构建树数据
      const tree: TreeNode[] = conns.map(conn => ({
        id: `conn-${conn.id}`,
        name: conn.name,
        type: 'connection' as TreeNodeType,
        data: conn,
        connected: connectedIds.has(conn.id),
        children: []
      }))
      setTreeData(tree)
    } catch (error: any) {
      databaseToast.error('加载连接列表失败', error.message)
    } finally {
      setLoadingConnections(false)
    }
  }, [connectedIds])

  useEffect(() => { loadConnections() }, [])

  // 连接到数据库
  const handleConnect = async (conn: DatabaseConnection) => {
    const currentConnectedId = Array.from(connectedIds)[0]
    if (currentConnectedId && currentConnectedId !== conn.id) {
      setPendingConnection(conn)
      setShowSwitchConfirm(true)
      return
    }
    await doConnect(conn)
  }
  
  const doConnect = async (conn: DatabaseConnection) => {
    try {
      await databaseService.connect(conn.id)
      setConnectedIds(new Set([conn.id]))
      databaseToast.connectionSuccess('连接成功', `已连接到 ${conn.name}`)
      
      // 更新树节点状态
      setTreeData(prev => prev.map(node => ({
        ...node,
        connected: node.id === `conn-${conn.id}`
      })))
      setExpandedNodes(new Set([`conn-${conn.id}`]))
      setSelectedConnection(conn)
      
      // 加载数据库/Schema 列表
      await loadDatabasesOrSchemas(conn)
    } catch (error: any) {
      databaseToast.connectionError('连接失败', error.message)
    }
  }
  
  const confirmSwitchConnection = async () => {
    if (!pendingConnection) return
    const currentConnectedId = Array.from(connectedIds)[0]
    if (currentConnectedId) {
      try { 
        await databaseService.disconnect(currentConnectedId) 
      } catch (e) { 
        console.warn('断开旧连接失败:', e) 
      }
    }
    await doConnect(pendingConnection)
    setShowSwitchConfirm(false)
    setPendingConnection(null)
  }

  const handleDisconnect = async (conn: DatabaseConnection) => {
    try {
      await databaseService.disconnect(conn.id)
      setConnectedIds(prev => { 
        const next = new Set(prev)
        next.delete(conn.id)
        return next 
      })
      databaseToast.info('已断开连接', `已断开 ${conn.name}`)
      
      // 更新树节点状态
      setTreeData(prev => prev.map(node => 
        node.id === `conn-${conn.id}` 
          ? { ...node, connected: false, children: [] } 
          : node
      ))
      
      // 清除展开状态
      setExpandedNodes(prev => {
        const next = new Set(prev)
        for (const id of next) {
          if (id.startsWith(`conn-${conn.id}`)) {
            next.delete(id)
          }
        }
        return next
      })
      
      // 清除右侧面板
      setSelectedConnection(null)
      setSelectedSchema(null)
      setSelectedTable(null)
      setRightPanelMode('empty')
    } catch (error: any) {
      databaseToast.error('断开失败', error.message)
    }
  }

  // 加载数据库或 Schema 列表
  const loadDatabasesOrSchemas = async (conn: DatabaseConnection) => {
    const nodeId = `conn-${conn.id}`
    setLoadingNodes(prev => new Set([...prev, nodeId]))
    
    try {
      // 尝试获取 Schema 列表
      const schemas = await databaseService.getSchemas(conn.id)
      
      // 如果没有 Schema（MySQL 可能返回空或单个数据库），直接加载表
      if (schemas.length === 0) {
        // 直接加载表列表
        const tables = await databaseService.getTables(conn.id, {})
        setTreeData(prev => prev.map(node => {
          if (node.id === nodeId) {
            return {
              ...node,
              children: tables.map(table => ({
                id: `${nodeId}-table-${table.name}`,
                name: table.name,
                type: 'table' as TreeNodeType,
                data: { connId: conn.id, schema: '', table }
              }))
            }
          }
          return node
        }))
      } else if (schemas.length === 1 && conn.db_type === 'mysql') {
        // MySQL 只有一个数据库时，直接展开显示表
        const schema = schemas[0]
        const tables = await databaseService.getTables(conn.id, { schema })
        setTreeData(prev => prev.map(node => {
          if (node.id === nodeId) {
            return {
              ...node,
              children: tables.map(table => ({
                id: `${nodeId}-table-${table.name}`,
                name: table.name,
                type: 'table' as TreeNodeType,
                data: { connId: conn.id, schema, table }
              }))
            }
          }
          return node
        }))
      } else {
        // 更新树节点显示 Schema 列表
        setTreeData(prev => prev.map(node => {
          if (node.id === nodeId) {
            return {
              ...node,
              children: schemas.map(schema => ({
                id: `${nodeId}-schema-${schema}`,
                name: schema,
                type: 'schema' as TreeNodeType,
                data: { connId: conn.id, schema },
                children: []
              }))
            }
          }
          return node
        }))
      }
    } catch (error: any) {
      console.error('加载 Schema 列表失败:', error)
      // 如果获取 Schema 失败，尝试直接获取表列表（适用于 MySQL）
      try {
        const tables = await databaseService.getTables(conn.id, {})
        setTreeData(prev => prev.map(node => {
          if (node.id === nodeId) {
            return {
              ...node,
              children: tables.map(table => ({
                id: `${nodeId}-table-${table.name}`,
                name: table.name,
                type: 'table' as TreeNodeType,
                data: { connId: conn.id, schema: '', table }
              }))
            }
          }
          return node
        }))
      } catch (tableError) {
        console.error('加载表列表也失败:', tableError)
      }
    } finally {
      setLoadingNodes(prev => {
        const next = new Set(prev)
        next.delete(nodeId)
        return next
      })
    }
  }

  // 加载表列表
  const loadTables = async (connId: number, schema: string, nodeId: string) => {
    setLoadingNodes(prev => new Set([...prev, nodeId]))
    
    try {
      const tables = await databaseService.getTables(connId, { schema })
      
      // 更新树节点
      setTreeData(prev => {
        const updateChildren = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map(node => {
            if (node.id === nodeId) {
              return {
                ...node,
                children: tables.map(table => ({
                  id: `${nodeId}-table-${table.name}`,
                  name: table.name,
                  type: 'table' as TreeNodeType,
                  data: { connId, schema, table }
                }))
              }
            }
            if (node.children) {
              return { ...node, children: updateChildren(node.children) }
            }
            return node
          })
        }
        return updateChildren(prev)
      })
    } catch (error: any) {
      databaseToast.error('加载表列表失败', error.message)
    } finally {
      setLoadingNodes(prev => {
        const next = new Set(prev)
        next.delete(nodeId)
        return next
      })
    }
  }

  // 展开/折叠节点
  const toggleNode = async (node: TreeNode) => {
    const nodeId = node.id
    const isExpanded = expandedNodes.has(nodeId)
    
    if (node.type === 'connection' && !isExpanded) {
      const conn = node.data as DatabaseConnection
      if (!connectedIds.has(conn.id)) {
        databaseToast.warning('请先连接', '请先连接到数据库')
        return
      }
    }
    
    if (isExpanded) {
      setExpandedNodes(prev => { 
        const next = new Set(prev)
        next.delete(nodeId)
        return next 
      })
    } else {
      setExpandedNodes(prev => new Set([...prev, nodeId]))
      
      // 如果是 Schema 节点且没有子节点，加载表列表
      if (node.type === 'schema' && (!node.children || node.children.length === 0)) {
        const { connId, schema } = node.data
        await loadTables(connId, schema, nodeId)
      }
    }
  }

  // 选择节点
  const handleSelectNode = async (node: TreeNode) => {
    setSelectedNode(node)
    
    if (node.type === 'connection') {
      const conn = node.data as DatabaseConnection
      if (connectedIds.has(conn.id)) {
        setSelectedConnection(conn)
        setSelectedSchema(null)
        setSelectedTable(null)
        setRightPanelMode('schema')
      }
    } else if (node.type === 'schema') {
      const { connId, schema } = node.data
      const conn = connections.find(c => c.id === connId)
      if (conn) {
        setSelectedConnection(conn)
        setSelectedSchema(schema)
        setSelectedTable(null)
        setRightPanelMode('schema')
      }
    } else if (node.type === 'table') {
      const { connId, schema, table } = node.data
      const conn = connections.find(c => c.id === connId)
      if (conn) {
        setSelectedConnection(conn)
        setSelectedSchema(schema)
        setSelectedTable(table)
        setRightPanelMode('table')
      }
    }
  }

  // 连接管理
  const handleAddConnection = () => { 
    setEditingConnection(null)
    setShowConnectionForm(true) 
  }
  
  const handleEditConnection = (conn: DatabaseConnection) => { 
    setEditingConnection(conn)
    setShowConnectionForm(true) 
  }
  
  const handleDeleteConnection = (conn: DatabaseConnection) => { 
    setDeletingConnection(conn)
    setShowDeleteConfirm(true) 
  }
  
  const confirmDeleteConnection = async () => {
    if (!deletingConnection) return
    setDeleteLoading(true)
    try {
      await databaseService.deleteConnection(deletingConnection.id)
      databaseToast.success('删除成功', '连接已删除')
      setShowDeleteConfirm(false)
      setDeletingConnection(null)
      loadConnections()
    } catch (error: any) {
      databaseToast.error('删除失败', error.message)
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleSaveConnection = async () => {
    setShowConnectionForm(false)
    setEditingConnection(null)
    loadConnections()
    databaseToast.success(
      editingConnection ? '更新成功' : '创建成功',
      editingConnection ? '连接配置已更新' : '连接配置已创建'
    )
  }

  // 获取数据库类型颜色
  const getDbTypeColors = (dbType: DatabaseType) => {
    return DatabaseTypeColors[dbType] || DatabaseTypeColors.postgresql
  }

  // 渲染树节点
  const renderTreeNode = (node: TreeNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.id)
    const isSelected = selectedNode?.id === node.id
    const isLoading = loadingNodes.has(node.id)
    const paddingLeft = level * 16 + 12
    const hasChildren = node.type !== 'table'

    return (
      <div key={node.id}>
        <div
          className={`flex items-center py-2 px-2 cursor-pointer group transition-all ${
            isSelected 
              ? 'bg-blue-50 border-l-2 border-blue-500' 
              : 'hover:bg-gray-50 border-l-2 border-transparent'
          }`}
          style={{ paddingLeft }}
          onClick={() => {
            handleSelectNode(node)
            if (hasChildren) toggleNode(node)
          }}
        >
          {/* 展开/折叠图标 */}
          {hasChildren && (
            <span className="w-5 h-5 mr-1 flex items-center justify-center">
              {isLoading ? (
                <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />
              ) : isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </span>
          )}
          {!hasChildren && <span className="w-5 h-5 mr-1" />}
          
          {/* 节点图标 */}
          <span className="mr-2 flex-shrink-0">
            {node.type === 'connection' && (
              <div className={`p-1 rounded ${node.connected ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                <Server className={`w-4 h-4 ${node.connected ? 'text-emerald-600' : 'text-gray-400'}`} />
              </div>
            )}
            {node.type === 'schema' && (
              <div className="p-1 rounded bg-amber-100">
                {isExpanded ? (
                  <FolderOpen className="w-4 h-4 text-amber-600" />
                ) : (
                  <Folder className="w-4 h-4 text-amber-600" />
                )}
              </div>
            )}
            {node.type === 'table' && (
              <div className="p-1 rounded bg-blue-100">
                <Table className="w-4 h-4 text-blue-600" />
              </div>
            )}
          </span>
          
          {/* 节点名称 */}
          <span className={`text-sm truncate flex-1 ${
            node.type === 'connection' && !node.connected 
              ? 'text-gray-400' 
              : 'text-gray-700'
          }`}>
            {node.name}
          </span>

          {/* 连接节点操作按钮 */}
          {node.type === 'connection' && node.data && (
            <div className="hidden group-hover:flex items-center gap-0.5 ml-2">
              {!node.connected ? (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleConnect(node.data) }} 
                  className="p-1.5 hover:bg-emerald-100 rounded" 
                  title="连接"
                >
                  <Plug className="w-3.5 h-3.5 text-emerald-600" />
                </button>
              ) : (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDisconnect(node.data) }} 
                  className="p-1.5 hover:bg-red-100 rounded" 
                  title="断开"
                >
                  <PlugZap className="w-3.5 h-3.5 text-red-500" />
                </button>
              )}
              <button 
                onClick={(e) => { e.stopPropagation(); handleEditConnection(node.data) }} 
                className="p-1.5 hover:bg-blue-100 rounded" 
                title="编辑"
              >
                <Edit className="w-3.5 h-3.5 text-blue-600" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteConnection(node.data) }} 
                className="p-1.5 hover:bg-red-100 rounded" 
                title="删除"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          )}
        </div>
        
        {/* 子节点 */}
        {isExpanded && node.children && (
          <div>{node.children.map(child => renderTreeNode(child, level + 1))}</div>
        )}
      </div>
    )
  }

  // 渲染右侧面板
  const renderRightPanel = () => {
    if (rightPanelMode === 'empty' || !selectedConnection) {
      return (
        <div className="flex items-center justify-center h-full bg-gray-50">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
              <Database className="w-10 h-10 text-blue-500" />
            </div>
            <p className="text-gray-500 font-medium">选择一个数据库连接</p>
            <p className="text-gray-400 text-sm mt-1">从左侧树中选择连接并浏览数据库结构</p>
          </div>
        </div>
      )
    }

    if (rightPanelMode === 'sql') {
      return (
        <SqlEditor
          connection={selectedConnection}
          schema={selectedSchema || undefined}
        />
      )
    }

    if (rightPanelMode === 'table' && selectedTable) {
      return (
        <TableDetail
          connection={selectedConnection}
          schema={selectedSchema || ''}
          table={selectedTable}
        />
      )
    }

    return (
      <SchemaBrowser
        connection={selectedConnection}
        schema={selectedSchema}
        onSelectTable={(table) => {
          setSelectedTable(table)
          setRightPanelMode('table')
        }}
      />
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-100" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Toast 容器 */}
      <DatabaseToastContainer />

      {/* 顶部工具栏 */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500 rounded-lg">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">数据库管理</h1>
            <p className="text-xs text-gray-400">关系型数据库可视化管理</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedConnection && connectedIds.has(selectedConnection.id) && (
            <button
              onClick={() => setRightPanelMode('sql')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                rightPanelMode === 'sql'
                  ? 'bg-emerald-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Terminal className="w-4 h-4" />
              SQL 执行器
            </button>
          )}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* 左侧树形面板 */}
        <div className="w-72 bg-white rounded-lg border shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase">连接列表</span>
            <div className="flex items-center gap-1">
              <button 
                onClick={handleAddConnection} 
                className="p-1.5 hover:bg-emerald-100 rounded" 
                title="添加连接"
              >
                <Plus className="w-4 h-4 text-emerald-600" />
              </button>
              <button 
                onClick={() => loadConnections()} 
                className="p-1.5 hover:bg-blue-100 rounded" 
                title="刷新"
              >
                <RefreshCw className={`w-4 h-4 text-blue-600 ${loadingConnections ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto">
            {loadingConnections && treeData.length === 0 ? (
              <div className="flex justify-center py-8"><Loading size="sm" /></div>
            ) : treeData.length === 0 ? (
              <div className="text-center py-8 px-4">
                <Server className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500">暂无连接</p>
                <button 
                  onClick={handleAddConnection} 
                  className="mt-3 px-3 py-1.5 text-sm text-white bg-blue-500 rounded-lg"
                >
                  <Plus className="w-4 h-4 inline mr-1" />添加连接
                </button>
              </div>
            ) : (
              <div className="py-2">{treeData.map(node => renderTreeNode(node))}</div>
            )}
          </div>
        </div>

        {/* 右侧内容面板 */}
        <div className="flex-1 bg-white rounded-lg border shadow-sm overflow-hidden">
          {renderRightPanel()}
        </div>
      </div>

      {/* 连接表单弹窗 */}
      <Modal 
        isOpen={showConnectionForm} 
        onClose={() => { setShowConnectionForm(false); setEditingConnection(null) }} 
        title={editingConnection ? '编辑连接' : '添加连接'} 
        size="lg"
      >
        <ConnectionForm 
          connection={editingConnection} 
          onSuccess={handleSaveConnection} 
          onCancel={() => { setShowConnectionForm(false); setEditingConnection(null) }} 
        />
      </Modal>

      {/* 删除确认弹窗 */}
      {deletingConnection && (
        <DeleteConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => { setShowDeleteConfirm(false); setDeletingConnection(null) }}
          onConfirm={confirmDeleteConnection}
          itemName={deletingConnection.name}
          dbType={deletingConnection.db_type as any}
          loading={deleteLoading}
        />
      )}

      {/* 切换连接确认 */}
      {showSwitchConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSwitchConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-96 p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">切换连接</h3>
            <p className="text-gray-600 mb-4">
              当前已连接其他实例，是否断开并切换到 "{pendingConnection?.name}"？
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => { setShowSwitchConfirm(false); setPendingConnection(null) }} 
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button 
                onClick={confirmSwitchConnection} 
                className="px-4 py-2 text-sm text-white bg-amber-500 hover:bg-amber-600 rounded-lg"
              >
                确认切换
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DatabasePage
