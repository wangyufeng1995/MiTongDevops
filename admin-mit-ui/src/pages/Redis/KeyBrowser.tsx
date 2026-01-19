/**
 * Redis 键浏览器组件
 * 
 * 提供 Redis 键列表展示、搜索、分页、数据库切换等功能
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search,
  RefreshCw,
  Database,
  Key,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Hash,
  List,
  Layers,
  SortAsc,
  Eye,
  AlertTriangle,
  Play,
  Square,
  Plug
} from 'lucide-react'
import { Loading } from '../../components/Loading'
import { Modal } from '../../components/Modal'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { RedisConnectionError } from '../../components/RedisConnectionError'
import { useAuthStore } from '../../store/auth'
import { redisService, RedisConnection, KeyInfo } from '../../services/redis'
import { showRedisError, getDangerousActionMessage, isConnectionError } from '../../utils/redisErrorHandler'
import KeyDetail from './KeyDetail'

interface KeyBrowserProps {
  connection: RedisConnection | null
}

interface KeyBrowserState {
  keys: KeyInfo[]
  loading: boolean
  error: string | null
  // 连接状态
  isConnected: boolean
  connecting: boolean
  // 扫描状态
  cursor: number
  hasMore: boolean
  totalScanned: number
  // 搜索和过滤
  pattern: string
  database: number
  // 选择状态
  selectedKeys: Set<string>
  // 弹窗状态
  showKeyDetail: boolean
  selectedKey: KeyInfo | null
  showDeleteConfirm: boolean
  showCreateModal: boolean
  // 连接错误状态
  showConnectionError: boolean
  connectionError: string | null
  // 消息提示
  toast: {
    show: boolean
    type: 'success' | 'error' | 'warning' | 'info'
    message: string
  }
}

// 数据库选项 (Redis 默认 16 个数据库)
const DATABASE_OPTIONS = Array.from({ length: 16 }, (_, i) => ({
  value: i,
  label: `DB ${i}`
}))

// 键类型图标映射
const KEY_TYPE_ICONS: Record<string, React.ReactNode> = {
  string: <Key className="w-4 h-4 text-green-500" />,
  list: <List className="w-4 h-4 text-blue-500" />,
  set: <Layers className="w-4 h-4 text-purple-500" />,
  zset: <SortAsc className="w-4 h-4 text-orange-500" />,
  hash: <Hash className="w-4 h-4 text-red-500" />,
  stream: <Database className="w-4 h-4 text-cyan-500" />
}

// 键类型颜色映射
const KEY_TYPE_COLORS: Record<string, string> = {
  string: 'bg-green-100 text-green-800',
  list: 'bg-blue-100 text-blue-800',
  set: 'bg-purple-100 text-purple-800',
  zset: 'bg-orange-100 text-orange-800',
  hash: 'bg-red-100 text-red-800',
  stream: 'bg-cyan-100 text-cyan-800'
}

export const KeyBrowser: React.FC<KeyBrowserProps> = ({ connection }) => {
  const { hasPermission } = useAuthStore()
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  const [state, setState] = useState<KeyBrowserState>({
    keys: [],
    loading: false,
    error: null,
    isConnected: false,
    connecting: false,
    cursor: 0,
    hasMore: false,
    totalScanned: 0,
    pattern: '*',
    database: 0,
    selectedKeys: new Set(),
    showKeyDetail: false,
    selectedKey: null,
    showDeleteConfirm: false,
    showCreateModal: false,
    showConnectionError: false,
    connectionError: null,
    toast: {
      show: false,
      type: 'info',
      message: ''
    }
  })

  // 显示消息提示
  const showToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setState(prev => ({
      ...prev,
      toast: { show: true, type, message }
    }))
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        toast: { ...prev.toast, show: false }
      }))
    }, 3000)
  }, [])

  // 扫描键列表 - 直接接收参数而不是从 state 读取
  const doScanKeys = useCallback(async (options: {
    reset: boolean
    connId: number
    pattern: string
    database: number
    cursor: number
    connectionType: string
  }) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null, showConnectionError: false }))

      const result = await redisService.scanKeys(options.connId, {
        pattern: options.pattern || '*',
        cursor: options.reset ? 0 : options.cursor,
        count: 50,
        database: options.connectionType === 'standalone' ? options.database : undefined
      })

      // 安全检查：确保 result 存在且有 keys 属性
      const keys = result?.keys || []
      const newCursor = result?.cursor ?? 0
      const totalScanned = result?.total_scanned ?? 0

      console.log('doScanKeys result:', { keys: keys.length, newCursor, totalScanned })

      setState(prev => ({
        ...prev,
        keys: options.reset ? keys : [...prev.keys, ...keys],
        cursor: newCursor,
        hasMore: newCursor !== 0,
        totalScanned: options.reset ? totalScanned : prev.totalScanned + totalScanned,
        loading: false,
        selectedKeys: options.reset ? new Set() : prev.selectedKeys
      }))
    } catch (error: any) {
      const errorMessage = error.message || '扫描键列表失败'
      
      // 检查是否是连接错误
      if (isConnectionError(error)) {
        setState(prev => ({
          ...prev,
          showConnectionError: true,
          connectionError: errorMessage,
          loading: false,
          isConnected: false
        }))
      } else {
        setState(prev => ({
          ...prev,
          error: errorMessage,
          loading: false
        }))
        showRedisError(error, '扫描键列表')
      }
    }
  }, [])

  // 扫描键列表 - 包装函数，从 state 读取参数
  const scanKeys = useCallback(async (reset = false) => {
    if (!connection || !state.isConnected) return

    await doScanKeys({
      reset,
      connId: connection.id,
      pattern: state.pattern,
      database: state.database,
      cursor: state.cursor,
      connectionType: connection.connection_type
    })
  }, [connection, state.isConnected, state.pattern, state.database, state.cursor, doScanKeys])

  // 连接到 Redis
  const handleConnect = useCallback(async () => {
    if (!connection) return

    setState(prev => ({ ...prev, connecting: true, error: null }))

    try {
      await redisService.connect(connection.id)
      
      // 先更新连接状态
      setState(prev => ({ 
        ...prev, 
        isConnected: true, 
        connecting: false,
        keys: [],
        cursor: 0,
        totalScanned: 0
      }))
      
      showToast('success', `已连接到 ${connection.name}`)
      
      // 直接调用 doScanKeys，传入当前参数
      await doScanKeys({
        reset: true,
        connId: connection.id,
        pattern: state.pattern,
        database: state.database,
        cursor: 0,
        connectionType: connection.connection_type
      })
    } catch (error: any) {
      setState(prev => ({ 
        ...prev, 
        connecting: false,
        error: error.message || '连接失败'
      }))
      showToast('error', `连接失败: ${error.message}`)
    }
  }, [connection, state.pattern, state.database, showToast, doScanKeys])

  // 断开连接
  const handleDisconnect = useCallback(async () => {
    if (!connection) return

    try {
      await redisService.disconnect(connection.id)
      setState(prev => ({ 
        ...prev, 
        isConnected: false,
        keys: [],
        cursor: 0,
        totalScanned: 0,
        selectedKeys: new Set()
      }))
      showToast('info', `已断开 ${connection.name}`)
    } catch (error: any) {
      showToast('error', `断开连接失败: ${error.message}`)
    }
  }, [connection, showToast])

  // 连接变化时重置状态
  useEffect(() => {
    setState(prev => ({
      ...prev,
      isConnected: false,
      keys: [],
      cursor: 0,
      totalScanned: 0,
      selectedKeys: new Set(),
      error: null
    }))
  }, [connection?.id])

  // 搜索处理
  const handleSearch = useCallback((searchValue: string) => {
    setState(prev => ({ ...prev, pattern: searchValue || '*' }))

    if (!state.isConnected || !connection) return

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      doScanKeys({
        reset: true,
        connId: connection.id,
        pattern: searchValue || '*',
        database: state.database,
        cursor: 0,
        connectionType: connection.connection_type
      })
    }, 500)
  }, [state.isConnected, state.database, connection, doScanKeys])

  // 数据库切换
  const handleDatabaseChange = useCallback((db: number) => {
    setState(prev => ({ ...prev, database: db, keys: [], cursor: 0, totalScanned: 0 }))
    // 如果已连接，切换数据库后重新扫描
    if (state.isConnected && connection) {
      doScanKeys({
        reset: true,
        connId: connection.id,
        pattern: state.pattern,
        database: db,
        cursor: 0,
        connectionType: connection.connection_type
      })
    }
  }, [state.isConnected, state.pattern, connection, doScanKeys])

  // 刷新
  const handleRefresh = useCallback(() => {
    scanKeys(true)
  }, [scanKeys])

  // 加载更多
  const handleLoadMore = useCallback(() => {
    if (state.hasMore && !state.loading) {
      scanKeys(false)
    }
  }, [state.hasMore, state.loading, scanKeys])

  // 选择键
  const handleSelectKey = useCallback((key: string, selected: boolean) => {
    setState(prev => {
      const newSelected = new Set(prev.selectedKeys)
      if (selected) {
        newSelected.add(key)
      } else {
        newSelected.delete(key)
      }
      return { ...prev, selectedKeys: newSelected }
    })
  }, [])

  // 全选/取消全选
  const handleSelectAll = useCallback((selected: boolean) => {
    setState(prev => ({
      ...prev,
      selectedKeys: selected ? new Set(prev.keys.map(k => k.key)) : new Set()
    }))
  }, [])

  // 查看键详情
  const handleViewKey = useCallback((keyInfo: KeyInfo) => {
    setState(prev => ({
      ...prev,
      showKeyDetail: true,
      selectedKey: keyInfo
    }))
  }, [])

  // 关闭键详情
  const handleCloseKeyDetail = useCallback(() => {
    setState(prev => ({
      ...prev,
      showKeyDetail: false,
      selectedKey: null
    }))
  }, [])

  // 键详情更新后刷新
  const handleKeyUpdated = useCallback(() => {
    scanKeys(true)
    showToast('success', '键值已更新')
  }, [scanKeys, showToast])

  // 打开删除确认
  const handleDeleteClick = useCallback(() => {
    if (state.selectedKeys.size === 0) {
      showToast('warning', '请先选择要删除的键')
      return
    }
    setState(prev => ({ ...prev, showDeleteConfirm: true }))
  }, [state.selectedKeys.size, showToast])

  // 确认删除
  const handleConfirmDelete = async () => {
    if (!connection || state.selectedKeys.size === 0) return

    try {
      const keys = Array.from(state.selectedKeys)
      const result = await redisService.deleteKeys(connection.id, keys)
      showToast('success', `成功删除 ${result.deleted_count} 个键`)
      setState(prev => ({
        ...prev,
        showDeleteConfirm: false,
        selectedKeys: new Set()
      }))
      scanKeys(true)
    } catch (error: any) {
      showRedisError(error, '删除键')
    }
  }

  // 取消删除
  const handleCancelDelete = useCallback(() => {
    setState(prev => ({ ...prev, showDeleteConfirm: false }))
  }, [])

  // 重新连接
  const handleReconnect = async () => {
    if (!connection) return
    
    try {
      await redisService.connect(connection.id)
      setState(prev => ({
        ...prev,
        showConnectionError: false,
        connectionError: null
      }))
      showToast('success', '重新连接成功')
      scanKeys(true)
    } catch (error: any) {
      showRedisError(error, '重新连接')
    }
  }

  // 关闭连接错误提示
  const handleDismissConnectionError = () => {
    setState(prev => ({
      ...prev,
      showConnectionError: false
    }))
  }

  // 格式化 TTL 显示
  const formatTTL = (ttl: number): string => {
    if (ttl === -1) return '永不过期'
    if (ttl === -2) return '键不存在'
    if (ttl < 60) return `${ttl} 秒`
    if (ttl < 3600) return `${Math.floor(ttl / 60)} 分钟`
    if (ttl < 86400) return `${Math.floor(ttl / 3600)} 小时`
    return `${Math.floor(ttl / 86400)} 天`
  }

  // 如果没有选择连接
  if (!connection) {
    return (
      <div className="text-center text-gray-500 py-12">
        <Database className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p>请先选择一个 Redis 连接</p>
        <p className="text-sm mt-2">在"连接管理"标签页中选择或创建连接</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 连接错误提示 */}
      <RedisConnectionError
        isVisible={state.showConnectionError}
        connectionName={connection?.name || ''}
        errorMessage={state.connectionError || ''}
        onReconnect={handleReconnect}
        onDismiss={handleDismissConnectionError}
      />

      {/* Toast 消息提示 */}
      {state.toast.show && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-top-2 fade-in duration-300">
          <div className={`px-4 py-3 rounded-lg shadow-xl border flex items-start space-x-3 ${
            state.toast.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : state.toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : state.toast.type === 'warning'
              ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
              state.toast.type === 'success' ? 'bg-green-100' :
              state.toast.type === 'error' ? 'bg-red-100' :
              state.toast.type === 'warning' ? 'bg-yellow-100' : 'bg-blue-100'
            }`}>
              {state.toast.type === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
              {state.toast.type === 'error' && <XCircle className="w-4 h-4 text-red-600" />}
              {state.toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-600" />}
              {state.toast.type === 'info' && <Database className="w-4 h-4 text-blue-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{state.toast.message}</p>
            </div>
            <button
              onClick={() => setState(prev => ({ ...prev, toast: { ...prev.toast, show: false } }))}
              className="flex-shrink-0 p-1 rounded hover:bg-opacity-20 transition-colors"
            >
              <XCircle className="w-4 h-4 opacity-60 hover:opacity-100" />
            </button>
          </div>
        </div>
      )}

      {/* 工具栏 */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          {/* 左侧：搜索和数据库选择 */}
          <div className="flex items-center gap-4 flex-1">
            {/* 搜索框 */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <input
                type="text"
                placeholder="搜索键名 (支持通配符 *)"
                defaultValue={state.pattern === '*' ? '' : state.pattern}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            </div>

            {/* 数据库选择 (仅单机模式) */}
            {connection.connection_type === 'standalone' && (
              <select
                value={state.database}
                onChange={(e) => handleDatabaseChange(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                {DATABASE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-2">
            {/* 连接/断开按钮 */}
            {!state.isConnected ? (
              <button
                onClick={handleConnect}
                disabled={state.connecting}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 shadow-sm"
                title="连接"
              >
                {state.connecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    连接中...
                  </>
                ) : (
                  <>
                    <Plug className="w-4 h-4 mr-2" />
                    连接
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                title="断开连接"
              >
                <Square className="w-4 h-4 mr-1 text-red-500" />
                断开
              </button>
            )}

            {/* 刷新按钮 */}
            <button
              onClick={handleRefresh}
              disabled={state.loading || !state.isConnected}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              title="刷新"
            >
              <RefreshCw className={`w-4 h-4 ${state.loading ? 'animate-spin' : ''}`} />
            </button>

            {/* 删除按钮 */}
            {hasPermission('redis:delete') && (
              <button
                onClick={handleDeleteClick}
                disabled={state.selectedKeys.size === 0 || !state.isConnected}
                className="inline-flex items-center px-3 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="删除选中的键"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                删除 {state.selectedKeys.size > 0 && `(${state.selectedKeys.size})`}
              </button>
            )}
          </div>
        </div>

        {/* 连接状态和统计信息 */}
        <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
          <span className={`inline-flex items-center ${state.isConnected ? 'text-green-600' : 'text-gray-400'}`}>
            <span className={`w-2 h-2 rounded-full mr-1.5 ${state.isConnected ? 'bg-green-500' : 'bg-gray-300'}`}></span>
            {state.isConnected ? '已连接' : '未连接'}
          </span>
          {state.isConnected && (
            <>
              <span>已扫描: {state.totalScanned} 个键</span>
              <span>当前显示: {state.keys.length} 个</span>
              {state.hasMore && <span className="text-blue-600">还有更多...</span>}
            </>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <XCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-sm text-red-600">{state.error}</span>
          </div>
        </div>
      )}

      {/* 键列表 */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {/* 表头 */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
          <div className="flex items-center">
            <div className="w-10">
              <input
                type="checkbox"
                checked={state.keys.length > 0 && state.selectedKeys.size === state.keys.length}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
            </div>
            <div className="flex-1 font-medium text-gray-700">键名</div>
            <div className="w-24 text-center font-medium text-gray-700">类型</div>
            <div className="w-32 text-center font-medium text-gray-700">TTL</div>
            <div className="w-24 text-center font-medium text-gray-700">操作</div>
          </div>
        </div>

        {/* 加载状态 */}
        {state.loading && state.keys.length === 0 && (
          <div className="flex justify-center items-center py-12">
            <Loading size="lg" />
          </div>
        )}

        {/* 未连接状态 */}
        {!state.isConnected && !state.loading && (
          <div className="text-center py-12">
            <Plug className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">请先点击"连接"按钮</p>
            <p className="text-sm text-gray-400 mt-1">选择数据库后点击连接按钮加载键列表</p>
          </div>
        )}

        {/* 空状态 - 已连接但无数据 */}
        {state.isConnected && !state.loading && state.keys.length === 0 && (
          <div className="text-center py-12">
            <Key className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">没有找到匹配的键</p>
            <p className="text-sm text-gray-400 mt-1">尝试修改搜索条件或切换数据库</p>
          </div>
        )}

        {/* 键列表 */}
        {state.keys.length > 0 && (
          <div className="divide-y divide-gray-200">
            {state.keys.map((keyInfo) => (
              <div
                key={keyInfo.key}
                className={`px-4 py-3 hover:bg-gray-50 transition-colors ${
                  state.selectedKeys.has(keyInfo.key) ? 'bg-red-50' : ''
                }`}
              >
                <div className="flex items-center">
                  {/* 选择框 */}
                  <div className="w-10">
                    <input
                      type="checkbox"
                      checked={state.selectedKeys.has(keyInfo.key)}
                      onChange={(e) => handleSelectKey(keyInfo.key, e.target.checked)}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                  </div>

                  {/* 键名 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      {KEY_TYPE_ICONS[keyInfo.type] || <Key className="w-4 h-4 text-gray-400" />}
                      <span className="ml-2 font-mono text-sm text-gray-900 truncate" title={keyInfo.key}>
                        {keyInfo.key}
                      </span>
                    </div>
                  </div>

                  {/* 类型 */}
                  <div className="w-24 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      KEY_TYPE_COLORS[keyInfo.type] || 'bg-gray-100 text-gray-800'
                    }`}>
                      {keyInfo.type}
                    </span>
                  </div>

                  {/* TTL */}
                  <div className="w-32 text-center">
                    <span className={`text-sm ${
                      keyInfo.ttl === -1 ? 'text-gray-500' : 'text-orange-600'
                    }`}>
                      {formatTTL(keyInfo.ttl)}
                    </span>
                  </div>

                  {/* 操作 */}
                  <div className="w-24 text-center">
                    <button
                      onClick={() => handleViewKey(keyInfo)}
                      className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                      title="查看详情"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 加载更多 */}
        {state.hasMore && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleLoadMore}
              disabled={state.loading}
              className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 flex items-center justify-center"
            >
              {state.loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  加载中...
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4 mr-1" />
                  加载更多
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 键详情弹窗 */}
      <Modal
        isOpen={state.showKeyDetail}
        onClose={handleCloseKeyDetail}
        title={`键详情: ${state.selectedKey?.key || ''}`}
        size="xl"
      >
        {state.selectedKey && connection && (
          <KeyDetail
            connection={connection}
            keyInfo={state.selectedKey}
            onClose={handleCloseKeyDetail}
            onUpdated={handleKeyUpdated}
          />
        )}
      </Modal>

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        isOpen={state.showDeleteConfirm}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title={getDangerousActionMessage({
          actionName: '删除',
          targetName: '键',
          targetCount: state.selectedKeys.size
        }).title}
        message={getDangerousActionMessage({
          actionName: '删除',
          targetName: '键',
          targetCount: state.selectedKeys.size
        }).message}
        warning={getDangerousActionMessage({
          actionName: '删除',
          targetName: '键',
          targetCount: state.selectedKeys.size
        }).warning}
        confirmText="确认删除"
        type="danger"
      />
    </div>
  )
}

export default KeyBrowser
