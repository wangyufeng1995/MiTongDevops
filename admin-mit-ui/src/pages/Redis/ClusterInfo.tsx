/**
 * Redis 集群信息组件
 * 
 * 显示 Redis 集群的状态、节点列表、槽位分布等信息
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Network,
  RefreshCw,
  Server,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Circle,
  Database,
  Activity,
  Layers
} from 'lucide-react'
import { Loading } from '../../components/Loading'
import { redisService, RedisConnection } from '../../services/redis'

interface ClusterInfoProps {
  connection: RedisConnection | null
}

interface ClusterInfoData {
  cluster_state: 'ok' | 'fail'
  cluster_slots_assigned: number
  cluster_slots_ok: number
  cluster_slots_pfail: number
  cluster_slots_fail: number
  cluster_known_nodes: number
  cluster_size: number
  cluster_current_epoch: number
  cluster_my_epoch: number
  cluster_stats_messages_sent: number
  cluster_stats_messages_received: number
}

interface ClusterNode {
  id: string
  host: string
  port: number
  role: 'master' | 'slave'
  master_id?: string
  slots: string
  slot_count: number
  flags: string[]
  connected: boolean
  ping_sent: number
  pong_recv: number
  config_epoch: number
  link_state: string
}

interface ClusterInfoState {
  clusterInfo: ClusterInfoData | null
  clusterNodes: ClusterNode[]
  loading: boolean
  error: string | null
  lastRefresh: Date | null
  autoRefresh: boolean
  refreshInterval: number
}

export const ClusterInfo: React.FC<ClusterInfoProps> = ({ connection }) => {
  const [state, setState] = useState<ClusterInfoState>({
    clusterInfo: null,
    clusterNodes: [],
    loading: false,
    error: null,
    lastRefresh: null,
    autoRefresh: false,
    refreshInterval: 5000 // 5 秒
  })

  // 加载集群信息
  const loadClusterInfo = useCallback(async () => {
    if (!connection) return

    // 检查是否为集群模式
    if (connection.connection_type !== 'cluster') {
      setState(prev => ({
        ...prev,
        error: '当前连接不是集群模式',
        loading: false
      }))
      return
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }))

      // 并行加载集群信息和节点列表
      const [infoResponse, nodesResponse] = await Promise.all([
        redisService.getClusterInfo(connection.id),
        redisService.getClusterNodes(connection.id)
      ])

      setState(prev => ({
        ...prev,
        clusterInfo: infoResponse,
        clusterNodes: nodesResponse,
        loading: false,
        lastRefresh: new Date()
      }))
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || '加载集群信息失败',
        loading: false
      }))
    }
  }, [connection])

  // 初始加载
  useEffect(() => {
    if (connection) {
      loadClusterInfo()
    }
  }, [connection?.id])

  // 自动刷新
  useEffect(() => {
    if (!state.autoRefresh || !connection) return

    const timer = setInterval(() => {
      loadClusterInfo()
    }, state.refreshInterval)

    return () => clearInterval(timer)
  }, [state.autoRefresh, state.refreshInterval, connection, loadClusterInfo])

  // 切换自动刷新
  const toggleAutoRefresh = useCallback(() => {
    setState(prev => ({ ...prev, autoRefresh: !prev.autoRefresh }))
  }, [])

  // 格式化数字
  const formatNumber = (num: number): string => {
    return num.toLocaleString('zh-CN')
  }

  // 获取节点状态图标
  const getNodeStatusIcon = (node: ClusterNode) => {
    if (!node.connected) {
      return <XCircle className="w-5 h-5 text-red-500" />
    }
    if (node.flags.includes('fail')) {
      return <XCircle className="w-5 h-5 text-red-500" />
    }
    if (node.flags.includes('pfail')) {
      return <AlertTriangle className="w-5 h-5 text-orange-500" />
    }
    return <CheckCircle className="w-5 h-5 text-green-500" />
  }

  // 获取节点状态文本
  const getNodeStatusText = (node: ClusterNode): string => {
    if (!node.connected) return '断开'
    if (node.flags.includes('fail')) return '失败'
    if (node.flags.includes('pfail')) return '可能失败'
    return '正常'
  }

  // 获取节点状态颜色
  const getNodeStatusColor = (node: ClusterNode): string => {
    if (!node.connected || node.flags.includes('fail')) return 'text-red-600'
    if (node.flags.includes('pfail')) return 'text-orange-600'
    return 'text-green-600'
  }

  // 获取角色显示
  const getRoleDisplay = (node: ClusterNode) => {
    if (node.role === 'master') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Server className="w-3 h-3 mr-1" />
          主节点
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
        <Database className="w-3 h-3 mr-1" />
        从节点
      </span>
    )
  }

  // 计算槽位覆盖率
  const calculateSlotCoverage = (): number => {
    if (!state.clusterInfo) return 0
    return (state.clusterInfo.cluster_slots_assigned / 16384) * 100
  }

  // 如果没有选择连接
  if (!connection) {
    return (
      <div className="text-center text-gray-500 py-12">
        <Network className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p>请先选择一个 Redis 连接</p>
        <p className="text-sm mt-2">在"连接管理"标签页中选择或创建连接</p>
      </div>
    )
  }

  // 检查是否为集群模式
  if (connection.connection_type !== 'cluster') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6">
        <div className="flex items-center">
          <AlertTriangle className="w-6 h-6 text-yellow-500 mr-3" />
          <div>
            <h3 className="text-lg font-medium text-yellow-800">非集群模式</h3>
            <p className="text-sm text-yellow-600 mt-1">
              当前连接 "{connection.name}" 不是集群模式，无法查看集群信息。
            </p>
            <p className="text-sm text-yellow-600 mt-1">
              请在"连接管理"中选择一个集群类型的连接。
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 加载状态
  if (state.loading && !state.clusterInfo) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loading size="lg" />
      </div>
    )
  }

  // 错误状态
  if (state.error && !state.clusterInfo) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-6">
        <div className="flex items-center">
          <XCircle className="w-6 h-6 text-red-500 mr-3" />
          <div>
            <h3 className="text-lg font-medium text-red-800">加载失败</h3>
            <p className="text-sm text-red-600 mt-1">{state.error}</p>
            <button
              onClick={loadClusterInfo}
              className="mt-3 inline-flex items-center px-3 py-1.5 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              重试
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!state.clusterInfo) {
    return null
  }

  const info = state.clusterInfo
  const masterNodes = state.clusterNodes.filter(n => n.role === 'master')
  const slaveNodes = state.clusterNodes.filter(n => n.role === 'slave')

  return (
    <div className="space-y-6">
      {/* 工具栏 */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Network className="w-5 h-5 mr-2 text-red-500" />
              集群信息
            </h2>
            {state.lastRefresh && (
              <span className="text-sm text-gray-500">
                最后更新: {state.lastRefresh.toLocaleTimeString('zh-CN')}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {/* 自动刷新开关 */}
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.autoRefresh}
                onChange={toggleAutoRefresh}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">自动刷新</span>
            </label>
            {/* 刷新按钮 */}
            <button
              onClick={loadClusterInfo}
              disabled={state.loading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${state.loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>
      </div>

      {/* 集群状态概览 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-green-500" />
          集群状态
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">集群状态</div>
            <div className="flex items-center space-x-2">
              {info.cluster_state === 'ok' ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-lg font-semibold text-green-600">正常</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-500" />
                  <span className="text-lg font-semibold text-red-600">异常</span>
                </>
              )}
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">集群大小</div>
            <div className="text-lg font-semibold text-gray-900">{info.cluster_size} 个分片</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">已知节点</div>
            <div className="text-lg font-semibold text-gray-900">{info.cluster_known_nodes} 个</div>
            <div className="text-xs text-gray-400 mt-1">
              主: {masterNodes.length} / 从: {slaveNodes.length}
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">当前纪元</div>
            <div className="text-lg font-semibold text-gray-900">{info.cluster_current_epoch}</div>
          </div>
        </div>
      </div>

      {/* 槽位分布 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
          <Layers className="w-5 h-5 mr-2 text-purple-500" />
          槽位分布
        </h3>
        <div className="space-y-4">
          {/* 槽位统计 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-500 mb-1">已分配槽位</div>
              <div className="text-lg font-semibold text-gray-900">
                {formatNumber(info.cluster_slots_assigned)} / 16384
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {calculateSlotCoverage().toFixed(2)}%
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-500 mb-1">正常槽位</div>
              <div className="text-lg font-semibold text-green-600">
                {formatNumber(info.cluster_slots_ok)}
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-500 mb-1">可能失败</div>
              <div className={`text-lg font-semibold ${
                info.cluster_slots_pfail > 0 ? 'text-orange-600' : 'text-gray-900'
              }`}>
                {formatNumber(info.cluster_slots_pfail)}
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-500 mb-1">失败槽位</div>
              <div className={`text-lg font-semibold ${
                info.cluster_slots_fail > 0 ? 'text-red-600' : 'text-gray-900'
              }`}>
                {formatNumber(info.cluster_slots_fail)}
              </div>
            </div>
          </div>

          {/* 槽位覆盖进度条 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">槽位覆盖率</span>
              <span className="text-sm text-gray-500">{calculateSlotCoverage().toFixed(2)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  calculateSlotCoverage() === 100 ? 'bg-green-500' : 'bg-orange-500'
                }`}
                style={{ width: `${calculateSlotCoverage()}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 节点列表 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
          <Server className="w-5 h-5 mr-2 text-blue-500" />
          节点列表
        </h3>

        {/* 主节点 */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">主节点 ({masterNodes.length})</h4>
          <div className="space-y-3">
            {masterNodes.map((node) => (
              <div
                key={node.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      {getNodeStatusIcon(node)}
                      <div>
                        <div className="font-medium text-gray-900">
                          {node.host}:{node.port}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">{node.id}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                      <div>
                        <span className="text-gray-500">状态:</span>
                        <span className={`ml-2 font-medium ${getNodeStatusColor(node)}`}>
                          {getNodeStatusText(node)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">槽位数:</span>
                        <span className="ml-2 font-medium text-gray-900">{node.slot_count}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">纪元:</span>
                        <span className="ml-2 font-medium text-gray-900">{node.config_epoch}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">链接:</span>
                        <span className={`ml-2 font-medium ${
                          node.link_state === 'connected' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {node.link_state === 'connected' ? '已连接' : '断开'}
                        </span>
                      </div>
                    </div>
                    {node.slots && (
                      <div className="mt-2 text-xs text-gray-500">
                        <span className="font-medium">槽位范围:</span>
                        <span className="ml-2 font-mono">{node.slots}</span>
                      </div>
                    )}
                  </div>
                  <div className="ml-4">
                    {getRoleDisplay(node)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 从节点 */}
        {slaveNodes.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">从节点 ({slaveNodes.length})</h4>
            <div className="space-y-3">
              {slaveNodes.map((node) => (
                <div
                  key={node.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        {getNodeStatusIcon(node)}
                        <div>
                          <div className="font-medium text-gray-900">
                            {node.host}:{node.port}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">{node.id}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                        <div>
                          <span className="text-gray-500">状态:</span>
                          <span className={`ml-2 font-medium ${getNodeStatusColor(node)}`}>
                            {getNodeStatusText(node)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">主节点:</span>
                          <span className="ml-2 font-mono text-xs text-gray-600">
                            {node.master_id ? node.master_id.substring(0, 8) : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">纪元:</span>
                          <span className="ml-2 font-medium text-gray-900">{node.config_epoch}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">链接:</span>
                          <span className={`ml-2 font-medium ${
                            node.link_state === 'connected' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {node.link_state === 'connected' ? '已连接' : '断开'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-4">
                      {getRoleDisplay(node)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 集群消息统计 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-orange-500" />
          消息统计
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">已发送消息</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatNumber(info.cluster_stats_messages_sent)}
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">已接收消息</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatNumber(info.cluster_stats_messages_received)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClusterInfo
