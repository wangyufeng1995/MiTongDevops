/**
 * Redis 管理主页面 - 类似 Redis Desktop Manager 的布局
 * 
 * 左侧：连接树（连接列表 -> 数据库）
 * 右侧：键列表面板（支持增删改查）
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Database,
  Server,
  Key,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  Search,
  Hash,
  List,
  Layers,
  SortAsc,
  Folder,
  FolderOpen,
  Clock,
  Copy,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plug,
  PlugZap,
  Zap,
  Activity,
  Eye,
  Save
} from 'lucide-react'
import { Modal } from '../../components/Modal'
import { Loading } from '../../components/Loading'
import ConnectionForm from './ConnectionForm'
import { redisService, RedisConnection, KeyInfo, KeyDetail } from '../../services/redis'
import { showRedisError } from '../../utils/redisErrorHandler'

// 树节点类型
type TreeNodeType = 'connection' | 'database' | 'folder' | 'key'

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

// 键类型图标映射
const KEY_TYPE_ICONS: Record<string, React.ReactNode> = {
  string: <Key className="w-4 h-4 text-emerald-500" />,
  list: <List className="w-4 h-4 text-blue-500" />,
  set: <Layers className="w-4 h-4 text-violet-500" />,
  zset: <SortAsc className="w-4 h-4 text-amber-500" />,
  hash: <Hash className="w-4 h-4 text-rose-500" />,
  stream: <Activity className="w-4 h-4 text-cyan-500" />
}

// 键类型颜色映射
const KEY_TYPE_COLORS: Record<string, string> = {
  string: 'bg-emerald-100 text-emerald-700',
  list: 'bg-blue-100 text-blue-700',
  set: 'bg-violet-100 text-violet-700',
  zset: 'bg-amber-100 text-amber-700',
  hash: 'bg-rose-100 text-rose-700',
  stream: 'bg-cyan-100 text-cyan-700'
}

const DATABASE_COUNT = 16

export const RedisPage: React.FC = () => {
  // 连接列表
  const [connections, setConnections] = useState<RedisConnection[]>([])
  const [loadingConnections, setLoadingConnections] = useState(false)
  
  // 树状态
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)
  const [connectedIds, setConnectedIds] = useState<Set<number>>(new Set())
  
  // 右侧面板 - 键列表
  const [currentKeys, setCurrentKeys] = useState<KeyInfo[]>([])
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [selectedDatabase, setSelectedDatabase] = useState<{ connId: number; database: number } | null>(null)
  
  // 键详情
  const [selectedKey, setSelectedKey] = useState<KeyInfo | null>(null)
  const [keyDetail, setKeyDetail] = useState<KeyDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showKeyDetail, setShowKeyDetail] = useState(false)
  
  // 搜索
  const [searchPattern, setSearchPattern] = useState('*')
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  // 弹窗状态
  const [showConnectionForm, setShowConnectionForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<RedisConnection | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingConnection, setDeletingConnection] = useState<RedisConnection | null>(null)
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false)
  const [pendingConnection, setPendingConnection] = useState<RedisConnection | null>(null)
  
  // 新建/编辑键
  const [showKeyForm, setShowKeyForm] = useState(false)
  const [editingKey, setEditingKey] = useState<KeyInfo | null>(null)
  const [keyFormData, setKeyFormData] = useState({ key: '', value: '', type: 'string', ttl: -1 })
  
  // 删除键确认
  const [showDeleteKeyConfirm, setShowDeleteKeyConfirm] = useState(false)
  const [deletingKey, setDeletingKey] = useState<KeyInfo | null>(null)
  
  // Toast
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error' | 'warning' | 'info'; message: string }>({ show: false, type: 'info', message: '' })

  const showToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setToast({ show: true, type, message })
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000)
  }, [])

  // 加载连接列表
  const loadConnections = useCallback(async () => {
    try {
      setLoadingConnections(true)
      const response = await redisService.getConnections({ per_page: 100 })
      const conns = response?.connections || []
      setConnections(conns)
      
      const tree: TreeNode[] = conns.map(conn => ({
        id: `conn-${conn.id}`,
        name: conn.name,
        type: 'connection' as TreeNodeType,
        data: conn,
        connected: connectedIds.has(conn.id),
        children: conn.connection_type === 'standalone' 
          ? Array.from({ length: DATABASE_COUNT }, (_, i) => ({
              id: `conn-${conn.id}-db-${i}`,
              name: `DB${i}`,
              type: 'database' as TreeNodeType,
              data: { connId: conn.id, database: i },
              children: []
            }))
          : [{ id: `conn-${conn.id}-db-0`, name: '所有数据', type: 'database' as TreeNodeType, data: { connId: conn.id, database: 0 }, children: [] }]
      }))
      setTreeData(tree)
    } catch (error) {
      showRedisError(error, '加载连接列表')
    } finally {
      setLoadingConnections(false)
    }
  }, [connectedIds])

  useEffect(() => { loadConnections() }, [])

  // 连接到 Redis
  const handleConnect = async (conn: RedisConnection) => {
    const currentConnectedId = Array.from(connectedIds)[0]
    if (currentConnectedId && currentConnectedId !== conn.id) {
      setPendingConnection(conn)
      setShowSwitchConfirm(true)
      return
    }
    await doConnect(conn)
  }
  
  const doConnect = async (conn: RedisConnection) => {
    try {
      await redisService.connect(conn.id)
      setConnectedIds(new Set([conn.id]))
      showToast('success', `已连接到 ${conn.name}`)
      setTreeData(prev => prev.map(node => ({ ...node, connected: node.id === `conn-${conn.id}` })))
      setExpandedNodes(new Set([`conn-${conn.id}`]))
      setCurrentKeys([])
      setSelectedDatabase(null)
    } catch (error: any) {
      showToast('error', `连接失败: ${error.message}`)
    }
  }
  
  const confirmSwitchConnection = async () => {
    if (!pendingConnection) return
    const currentConnectedId = Array.from(connectedIds)[0]
    if (currentConnectedId) {
      try { await redisService.disconnect(currentConnectedId) } catch (e) { console.warn('断开旧连接失败:', e) }
    }
    await doConnect(pendingConnection)
    setShowSwitchConfirm(false)
    setPendingConnection(null)
  }

  const handleDisconnect = async (conn: RedisConnection) => {
    try {
      await redisService.disconnect(conn.id)
      setConnectedIds(prev => { const next = new Set(prev); next.delete(conn.id); return next })
      showToast('info', `已断开 ${conn.name}`)
      setTreeData(prev => prev.map(node => node.id === `conn-${conn.id}` ? { ...node, connected: false } : node))
      setExpandedNodes(prev => { const next = new Set(prev); for (const id of next) if (id.startsWith(`conn-${conn.id}`)) next.delete(id); return next })
      setCurrentKeys([])
      setSelectedDatabase(null)
    } catch (error: any) {
      showToast('error', `断开失败: ${error.message}`)
    }
  }

  // 加载键列表
  const loadKeys = async (connId: number, database: number, pattern: string = '*') => {
    try {
      setLoadingKeys(true)
      const result = await redisService.scanKeys(connId, { pattern, cursor: 0, count: 500, database })
      const keys = result?.keys || []
      setCurrentKeys(keys)
      setSelectedDatabase({ connId, database })
    } catch (error) {
      showRedisError(error, '加载键列表')
      setCurrentKeys([])
    } finally {
      setLoadingKeys(false)
    }
  }

  // 加载键详情
  const loadKeyDetail = async (connId: number, key: string) => {
    try {
      setLoadingDetail(true)
      const detail = await redisService.getKeyDetail(connId, key)
      setKeyDetail(detail)
      setShowKeyDetail(true)
    } catch (error) {
      showRedisError(error, '加载键详情')
    } finally {
      setLoadingDetail(false)
    }
  }

  // 点击数据库节点
  const handleSelectDatabase = async (node: TreeNode) => {
    if (node.type === 'database' && node.data) {
      const { connId, database } = node.data
      if (connectedIds.has(connId)) {
        await loadKeys(connId, database, searchPattern)
      } else {
        showToast('warning', '请先连接到 Redis')
      }
    }
  }

  // 展开/折叠节点
  const toggleNode = async (node: TreeNode) => {
    const nodeId = node.id
    const isExpanded = expandedNodes.has(nodeId)
    
    if (node.type === 'connection' && !isExpanded) {
      const conn = node.data as RedisConnection
      if (!connectedIds.has(conn.id)) {
        showToast('warning', '请先连接到 Redis')
        return
      }
    }
    
    if (isExpanded) {
      setExpandedNodes(prev => { const next = new Set(prev); next.delete(nodeId); return next })
    } else {
      setExpandedNodes(prev => new Set([...prev, nodeId]))
    }
  }

  // 搜索键
  const handleSearch = (value: string) => {
    setSearchPattern(value || '*')
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      if (selectedDatabase) {
        loadKeys(selectedDatabase.connId, selectedDatabase.database, value || '*')
      }
    }, 500)
  }

  // 刷新键列表
  const handleRefresh = () => {
    if (selectedDatabase) {
      loadKeys(selectedDatabase.connId, selectedDatabase.database, searchPattern)
    }
  }

  // 查看键详情
  const handleViewKey = (key: KeyInfo) => {
    setSelectedKey(key)
    if (selectedDatabase) {
      loadKeyDetail(selectedDatabase.connId, key.key)
    }
  }

  // 新建键
  const handleAddKey = () => {
    if (!selectedDatabase) {
      showToast('warning', '请先选择一个数据库')
      return
    }
    setEditingKey(null)
    setKeyFormData({ key: '', value: '', type: 'string', ttl: -1 })
    setShowKeyForm(true)
  }

  // 编辑键
  const handleEditKey = async (key: KeyInfo) => {
    if (!selectedDatabase) return
    setEditingKey(key)
    try {
      const detail = await redisService.getKeyDetail(selectedDatabase.connId, key.key)
      setKeyFormData({
        key: key.key,
        value: typeof detail.value === 'object' ? JSON.stringify(detail.value, null, 2) : String(detail.value),
        type: key.type,
        ttl: key.ttl
      })
      setShowKeyForm(true)
    } catch (error) {
      showRedisError(error, '获取键值')
    }
  }

  // 删除键
  const handleDeleteKey = (key: KeyInfo) => {
    setDeletingKey(key)
    setShowDeleteKeyConfirm(true)
  }

  // 确认删除键
  const confirmDeleteKey = async () => {
    if (!deletingKey || !selectedDatabase) return
    try {
      await redisService.deleteKeys(selectedDatabase.connId, [deletingKey.key])
      showToast('success', '键已删除')
      setShowDeleteKeyConfirm(false)
      setDeletingKey(null)
      handleRefresh()
    } catch (error) {
      showRedisError(error, '删除键')
    }
  }

  // 保存键
  const handleSaveKey = async () => {
    if (!selectedDatabase) return
    try {
      if (editingKey) {
        await redisService.updateKey(selectedDatabase.connId, editingKey.key, {
          value: keyFormData.value,
          ttl: keyFormData.ttl > 0 ? keyFormData.ttl : undefined
        })
        showToast('success', '键已更新')
      } else {
        await redisService.createKey(selectedDatabase.connId, {
          key: keyFormData.key,
          value: keyFormData.value,
          type: keyFormData.type as any,
          ttl: keyFormData.ttl > 0 ? keyFormData.ttl : undefined
        })
        showToast('success', '键已创建')
      }
      setShowKeyForm(false)
      handleRefresh()
    } catch (error) {
      showRedisError(error, editingKey ? '更新键' : '创建键')
    }
  }

  // 连接管理
  const handleAddConnection = () => { setEditingConnection(null); setShowConnectionForm(true) }
  const handleEditConnection = (conn: RedisConnection) => { setEditingConnection(conn); setShowConnectionForm(true) }
  const handleDeleteConnection = (conn: RedisConnection) => { setDeletingConnection(conn); setShowDeleteConfirm(true) }
  
  const confirmDeleteConnection = async () => {
    if (!deletingConnection) return
    try {
      await redisService.deleteConnection(deletingConnection.id)
      showToast('success', '连接已删除')
      setShowDeleteConfirm(false)
      setDeletingConnection(null)
      loadConnections()
    } catch (error) {
      showRedisError(error, '删除连接')
    }
  }

  const handleSaveConnection = async () => {
    setShowConnectionForm(false)
    setEditingConnection(null)
    loadConnections()
    showToast('success', editingConnection ? '连接已更新' : '连接已创建')
  }

  const formatTTL = (ttl: number): string => {
    if (ttl === -1) return '永不过期'
    if (ttl === -2) return '键不存在'
    if (ttl < 60) return `${ttl}秒`
    if (ttl < 3600) return `${Math.floor(ttl / 60)}分钟`
    if (ttl < 86400) return `${Math.floor(ttl / 3600)}小时`
    return `${Math.floor(ttl / 86400)}天`
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast('success', '已复制')
  }

  // 渲染树节点
  const renderTreeNode = (node: TreeNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.id)
    const isSelected = selectedNode?.id === node.id || (node.type === 'database' && selectedDatabase && node.data?.connId === selectedDatabase.connId && node.data?.database === selectedDatabase.database)
    const paddingLeft = level * 16 + 12

    return (
      <div key={node.id}>
        <div
          className={`flex items-center py-2 px-2 cursor-pointer group transition-all ${isSelected ? 'bg-red-50 border-l-2 border-red-500' : 'hover:bg-gray-50 border-l-2 border-transparent'}`}
          style={{ paddingLeft }}
          onClick={() => {
            setSelectedNode(node)
            if (node.type === 'connection' || node.type === 'database') toggleNode(node)
            if (node.type === 'database') handleSelectDatabase(node)
          }}
        >
          {(node.type === 'connection' || node.type === 'database') && (
            <span className="w-5 h-5 mr-1 flex items-center justify-center">
              {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </span>
          )}
          
          <span className="mr-2 flex-shrink-0">
            {node.type === 'connection' && (
              <div className={`p-1 rounded ${node.connected ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                <Server className={`w-4 h-4 ${node.connected ? 'text-emerald-600' : 'text-gray-400'}`} />
              </div>
            )}
            {node.type === 'database' && (
              <div className="p-1 rounded bg-amber-100">
                {isExpanded ? <FolderOpen className="w-4 h-4 text-amber-600" /> : <Folder className="w-4 h-4 text-amber-600" />}
              </div>
            )}
          </span>
          
          <span className={`text-sm truncate flex-1 ${node.type === 'connection' && !node.connected ? 'text-gray-400' : 'text-gray-700'}`}>
            {node.name}
          </span>

          {node.type === 'connection' && node.data && (
            <div className="hidden group-hover:flex items-center gap-0.5 ml-2">
              {!node.connected ? (
                <button onClick={(e) => { e.stopPropagation(); handleConnect(node.data) }} className="p-1.5 hover:bg-emerald-100 rounded" title="连接">
                  <Plug className="w-3.5 h-3.5 text-emerald-600" />
                </button>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); handleDisconnect(node.data) }} className="p-1.5 hover:bg-red-100 rounded" title="断开">
                  <PlugZap className="w-3.5 h-3.5 text-red-500" />
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); handleEditConnection(node.data) }} className="p-1.5 hover:bg-blue-100 rounded" title="编辑">
                <Edit className="w-3.5 h-3.5 text-blue-600" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteConnection(node.data) }} className="p-1.5 hover:bg-red-100 rounded" title="删除">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          )}
        </div>
        
        {isExpanded && node.children && (
          <div>{node.children.map(child => renderTreeNode(child, level + 1))}</div>
        )}
      </div>
    )
  }

  // 渲染右侧键列表面板
  const renderKeyListPanel = () => {
    if (!selectedDatabase) {
      return (
        <div className="flex items-center justify-center h-full bg-gray-50">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
              <Database className="w-10 h-10 text-amber-500" />
            </div>
            <p className="text-gray-500 font-medium">选择一个数据库</p>
            <p className="text-gray-400 text-sm mt-1">从左侧树中点击 DB 节点</p>
          </div>
        </div>
      )
    }

    return (
      <div className="h-full flex flex-col">
        {/* 工具栏 */}
        <div className="p-4 border-b bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Database className="w-4 h-4 text-amber-500" />
              <span className="font-medium">DB{selectedDatabase.database}</span>
              <span className="text-gray-400">|</span>
              <span>{currentKeys.length} 个键</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索键名..."
                defaultValue={searchPattern === '*' ? '' : searchPattern}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-48 pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
              <Search className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" />
            </div>
            <button onClick={handleRefresh} className="p-2 hover:bg-gray-100 rounded-lg" title="刷新">
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loadingKeys ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleAddKey} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg">
              <Plus className="w-4 h-4" /> 新建键
            </button>
          </div>
        </div>

        {/* 键列表 */}
        <div className="flex-1 overflow-auto">
          {loadingKeys ? (
            <div className="flex justify-center py-12"><Loading size="md" /></div>
          ) : currentKeys.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Key className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">暂无数据</p>
                <p className="text-gray-400 text-sm mt-1">点击"新建键"添加数据</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">键名</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">类型</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">TTL</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 w-32">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentKeys.map((key) => (
                  <tr key={key.key} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {KEY_TYPE_ICONS[key.type] || <Key className="w-4 h-4 text-gray-400" />}
                        <span className="font-mono text-gray-700 truncate max-w-md" title={key.key}>{key.key}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded ${KEY_TYPE_COLORS[key.type] || 'bg-gray-100 text-gray-600'}`}>
                        {key.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatTTL(key.ttl)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleViewKey(key)} className="p-1.5 hover:bg-blue-100 rounded" title="查看">
                          <Eye className="w-4 h-4 text-blue-600" />
                        </button>
                        <button onClick={() => handleEditKey(key)} className="p-1.5 hover:bg-amber-100 rounded" title="编辑">
                          <Edit className="w-4 h-4 text-amber-600" />
                        </button>
                        <button onClick={() => handleDeleteKey(key)} className="p-1.5 hover:bg-red-100 rounded" title="删除">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-100" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Toast */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-emerald-500 text-white' :
            toast.type === 'error' ? 'bg-red-500 text-white' :
            toast.type === 'warning' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
          }`}>
            {toast.type === 'success' && <CheckCircle className="w-4 h-4" />}
            {toast.type === 'error' && <XCircle className="w-4 h-4" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
            <span className="text-sm">{toast.message}</span>
          </div>
        </div>
      )}

      {/* 顶部工具栏 */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500 rounded-lg">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Redis 管理</h1>
            <p className="text-xs text-gray-400">数据库可视化管理</p>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* 左侧树形面板 */}
        <div className="w-72 bg-white rounded-lg border shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase">连接列表</span>
            <div className="flex items-center gap-1">
              <button onClick={handleAddConnection} className="p-1.5 hover:bg-emerald-100 rounded" title="添加连接">
                <Plus className="w-4 h-4 text-emerald-600" />
              </button>
              <button onClick={() => loadConnections()} className="p-1.5 hover:bg-blue-100 rounded" title="刷新">
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
                <button onClick={handleAddConnection} className="mt-3 px-3 py-1.5 text-sm text-white bg-red-500 rounded-lg">
                  <Plus className="w-4 h-4 inline mr-1" />添加连接
                </button>
              </div>
            ) : (
              <div className="py-2">{treeData.map(node => renderTreeNode(node))}</div>
            )}
          </div>
        </div>

        {/* 右侧键列表面板 */}
        <div className="flex-1 bg-white rounded-lg border shadow-sm overflow-hidden">
          {renderKeyListPanel()}
        </div>
      </div>

      {/* 连接表单弹窗 */}
      <Modal isOpen={showConnectionForm} onClose={() => { setShowConnectionForm(false); setEditingConnection(null) }} title={editingConnection ? '编辑连接' : '添加连接'} size="lg">
        <ConnectionForm connection={editingConnection} onSuccess={handleSaveConnection} onCancel={() => { setShowConnectionForm(false); setEditingConnection(null) }} />
      </Modal>

      {/* 删除连接确认 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-96 p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">确认删除</h3>
            <p className="text-gray-600 mb-4">确定要删除连接 "{deletingConnection?.name}" 吗？</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={confirmDeleteConnection} className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg">删除</button>
            </div>
          </div>
        </div>
      )}

      {/* 切换连接确认 */}
      {showSwitchConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSwitchConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-96 p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">切换连接</h3>
            <p className="text-gray-600 mb-4">当前已连接其他实例，是否断开并切换到 "{pendingConnection?.name}"？</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowSwitchConfirm(false); setPendingConnection(null) }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={confirmSwitchConnection} className="px-4 py-2 text-sm text-white bg-amber-500 hover:bg-amber-600 rounded-lg">确认切换</button>
            </div>
          </div>
        </div>
      )}

      {/* 删除键确认 */}
      {showDeleteKeyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteKeyConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-96 p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">确认删除</h3>
            <p className="text-gray-600 mb-4">确定要删除键 "{deletingKey?.key}" 吗？</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteKeyConfirm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={confirmDeleteKey} className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg">删除</button>
            </div>
          </div>
        </div>
      )}

      {/* 新建/编辑键弹窗 */}
      {showKeyForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowKeyForm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-[500px] max-h-[80vh] overflow-hidden">
            <div className="px-5 py-4 border-b bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-800">{editingKey ? '编辑键' : '新建键'}</h3>
            </div>
            <div className="p-5 space-y-4 overflow-auto max-h-[60vh]">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">键名 *</label>
                <input
                  type="text"
                  value={keyFormData.key}
                  onChange={(e) => setKeyFormData(prev => ({ ...prev, key: e.target.value }))}
                  disabled={!!editingKey}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:bg-gray-100"
                  placeholder="输入键名"
                />
              </div>
              {!editingKey && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
                  <select
                    value={keyFormData.type}
                    onChange={(e) => setKeyFormData(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  >
                    <option value="string">String</option>
                    <option value="hash">Hash</option>
                    <option value="list">List</option>
                    <option value="set">Set</option>
                    <option value="zset">ZSet</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">值 *</label>
                <textarea
                  value={keyFormData.value}
                  onChange={(e) => setKeyFormData(prev => ({ ...prev, value: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 font-mono text-sm"
                  rows={6}
                  placeholder="输入值"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TTL (秒)</label>
                <input
                  type="number"
                  value={keyFormData.ttl}
                  onChange={(e) => setKeyFormData(prev => ({ ...prev, ttl: parseInt(e.target.value) || -1 }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  placeholder="-1 表示永不过期"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowKeyForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg">取消</button>
              <button onClick={handleSaveKey} className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg flex items-center gap-1.5">
                <Save className="w-4 h-4" /> 保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 键详情弹窗 */}
      {showKeyDetail && keyDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowKeyDetail(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-[600px] max-h-[80vh] overflow-hidden">
            <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {KEY_TYPE_ICONS[keyDetail.type]}
                <span className="font-mono text-sm font-semibold">{keyDetail.key}</span>
                <span className={`px-2 py-0.5 text-xs rounded ${KEY_TYPE_COLORS[keyDetail.type]}`}>{keyDetail.type}</span>
              </div>
              <button onClick={() => copyToClipboard(keyDetail.key)} className="p-1.5 hover:bg-gray-200 rounded" title="复制键名">
                <Copy className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-5 overflow-auto max-h-[60vh]">
              <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> TTL: {formatTTL(keyDetail.ttl)}</span>
              </div>
              {loadingDetail ? (
                <div className="flex justify-center py-8"><Loading size="md" /></div>
              ) : (
                <pre className="p-4 bg-gray-900 text-emerald-400 rounded-lg text-sm overflow-auto max-h-80 font-mono">
                  {typeof keyDetail.value === 'object' ? JSON.stringify(keyDetail.value, null, 2) : String(keyDetail.value)}
                </pre>
              )}
            </div>
            <div className="px-5 py-4 border-t bg-gray-50 flex justify-end">
              <button onClick={() => setShowKeyDetail(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg">关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RedisPage
