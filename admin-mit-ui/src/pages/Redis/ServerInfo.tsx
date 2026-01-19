/**
 * Redis 服务器信息组件
 * 
 * 显示 Redis 服务器的详细信息，包括版本、内存、连接数、命令统计、持久化状态等
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Server,
  RefreshCw,
  Database,
  Cpu,
  HardDrive,
  Users,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info
} from 'lucide-react'
import { Loading } from '../../components/Loading'
import { redisService, RedisConnection } from '../../services/redis'

interface ServerInfoProps {
  connection: RedisConnection | null
}

interface ServerInfoData {
  // 服务器信息
  redis_version: string
  redis_mode: string
  os: string
  arch_bits: string
  process_id: string
  uptime_in_seconds: number
  uptime_in_days: number
  
  // 内存信息
  used_memory: number
  used_memory_human: string
  used_memory_peak: number
  used_memory_peak_human: string
  used_memory_rss: number
  used_memory_rss_human: string
  mem_fragmentation_ratio: number
  maxmemory: number
  maxmemory_human: string
  maxmemory_policy: string
  
  // 客户端信息
  connected_clients: number
  blocked_clients: number
  
  // 统计信息
  total_connections_received: number
  total_commands_processed: number
  instantaneous_ops_per_sec: number
  total_net_input_bytes: number
  total_net_output_bytes: number
  rejected_connections: number
  expired_keys: number
  evicted_keys: number
  keyspace_hits: number
  keyspace_misses: number
  
  // 持久化信息
  rdb_changes_since_last_save: number
  rdb_last_save_time: number
  rdb_last_bgsave_status: string
  aof_enabled: boolean
  aof_rewrite_in_progress: boolean
  aof_last_rewrite_time_sec: number
  aof_last_bgrewrite_status: string
  
  // 复制信息
  role: string
  connected_slaves: number
  master_host?: string
  master_port?: number
  master_link_status?: string
  
  // 键空间信息
  keyspace: Record<string, {
    keys: number
    expires: number
    avg_ttl: number
  }>
}

interface ServerInfoState {
  serverInfo: ServerInfoData | null
  loading: boolean
  error: string | null
  lastRefresh: Date | null
  autoRefresh: boolean
  refreshInterval: number
}

export const ServerInfo: React.FC<ServerInfoProps> = ({ connection }) => {
  const [state, setState] = useState<ServerInfoState>({
    serverInfo: null,
    loading: false,
    error: null,
    lastRefresh: null,
    autoRefresh: false,
    refreshInterval: 5000 // 5 秒
  })

  // 加载服务器信息
  const loadServerInfo = useCallback(async () => {
    if (!connection) return

    try {
      setState(prev => ({ ...prev, loading: true, error: null }))

      const response = await redisService.getServerInfo(connection.id)
      
      setState(prev => ({
        ...prev,
        serverInfo: response,
        loading: false,
        lastRefresh: new Date()
      }))
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || '加载服务器信息失败',
        loading: false
      }))
    }
  }, [connection])

  // 初始加载
  useEffect(() => {
    if (connection) {
      loadServerInfo()
    }
  }, [connection?.id])

  // 自动刷新
  useEffect(() => {
    if (!state.autoRefresh || !connection) return

    const timer = setInterval(() => {
      loadServerInfo()
    }, state.refreshInterval)

    return () => clearInterval(timer)
  }, [state.autoRefresh, state.refreshInterval, connection, loadServerInfo])

  // 切换自动刷新
  const toggleAutoRefresh = useCallback(() => {
    setState(prev => ({ ...prev, autoRefresh: !prev.autoRefresh }))
  }, [])

  // 格式化字节数
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  // 格式化运行时间
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) {
      return `${days} 天 ${hours} 小时`
    } else if (hours > 0) {
      return `${hours} 小时 ${minutes} 分钟`
    } else {
      return `${minutes} 分钟`
    }
  }

  // 格式化时间戳
  const formatTimestamp = (timestamp: number): string => {
    if (!timestamp) return '-'
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('zh-CN')
  }

  // 格式化数字
  const formatNumber = (num: number): string => {
    return num.toLocaleString('zh-CN')
  }

  // 计算命中率
  const calculateHitRate = (): string => {
    if (!state.serverInfo) return '0%'
    const { keyspace_hits, keyspace_misses } = state.serverInfo
    const total = keyspace_hits + keyspace_misses
    if (total === 0) return '0%'
    return `${((keyspace_hits / total) * 100).toFixed(2)}%`
  }

  // 如果没有选择连接
  if (!connection) {
    return (
      <div className="text-center text-gray-500 py-12">
        <Server className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p>请先选择一个 Redis 连接</p>
        <p className="text-sm mt-2">在"连接管理"标签页中选择或创建连接</p>
      </div>
    )
  }

  // 加载状态
  if (state.loading && !state.serverInfo) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loading size="lg" />
      </div>
    )
  }

  // 错误状态
  if (state.error && !state.serverInfo) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-6">
        <div className="flex items-center">
          <XCircle className="w-6 h-6 text-red-500 mr-3" />
          <div>
            <h3 className="text-lg font-medium text-red-800">加载失败</h3>
            <p className="text-sm text-red-600 mt-1">{state.error}</p>
            <button
              onClick={loadServerInfo}
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

  if (!state.serverInfo) {
    return null
  }

  const info = state.serverInfo

  return (
    <div className="space-y-6">
      {/* 工具栏 */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Server className="w-5 h-5 mr-2 text-red-500" />
              服务器信息
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
              onClick={loadServerInfo}
              disabled={state.loading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${state.loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
          <Info className="w-5 h-5 mr-2 text-blue-500" />
          基本信息
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">Redis 版本</div>
            <div className="text-lg font-semibold text-gray-900">{info.redis_version}</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">运行模式</div>
            <div className="text-lg font-semibold text-gray-900">{info.redis_mode}</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">操作系统</div>
            <div className="text-lg font-semibold text-gray-900">{info.os}</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">运行时间</div>
            <div className="text-lg font-semibold text-gray-900">{formatUptime(info.uptime_in_seconds)}</div>
            <div className="text-xs text-gray-400 mt-1">{info.uptime_in_days} 天</div>
          </div>
        </div>
      </div>

      {/* 内存信息 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
          <HardDrive className="w-5 h-5 mr-2 text-purple-500" />
          内存使用
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">已用内存</div>
            <div className="text-lg font-semibold text-gray-900">{info.used_memory_human}</div>
            <div className="text-xs text-gray-400 mt-1">{formatBytes(info.used_memory)}</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">峰值内存</div>
            <div className="text-lg font-semibold text-gray-900">{info.used_memory_peak_human}</div>
            <div className="text-xs text-gray-400 mt-1">{formatBytes(info.used_memory_peak)}</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">内存碎片率</div>
            <div className={`text-lg font-semibold ${
              info.mem_fragmentation_ratio > 1.5 ? 'text-orange-600' : 'text-green-600'
            }`}>
              {info.mem_fragmentation_ratio.toFixed(2)}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {info.mem_fragmentation_ratio > 1.5 ? '偏高' : '正常'}
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">最大内存</div>
            <div className="text-lg font-semibold text-gray-900">
              {info.maxmemory > 0 ? info.maxmemory_human : '无限制'}
            </div>
            {info.maxmemory > 0 && (
              <div className="text-xs text-gray-400 mt-1">{info.maxmemory_policy}</div>
            )}
          </div>
        </div>
      </div>

      {/* 客户端和连接 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2 text-green-500" />
          客户端连接
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">当前连接数</div>
            <div className="text-lg font-semibold text-gray-900">{formatNumber(info.connected_clients)}</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">阻塞客户端</div>
            <div className="text-lg font-semibold text-gray-900">{formatNumber(info.blocked_clients)}</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">总连接数</div>
            <div className="text-lg font-semibold text-gray-900">{formatNumber(info.total_connections_received)}</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">拒绝连接数</div>
            <div className={`text-lg font-semibold ${
              info.rejected_connections > 0 ? 'text-red-600' : 'text-gray-900'
            }`}>
              {formatNumber(info.rejected_connections)}
            </div>
          </div>
        </div>
      </div>

      {/* 命令统计 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-orange-500" />
          命令统计
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">总命令数</div>
            <div className="text-lg font-semibold text-gray-900">{formatNumber(info.total_commands_processed)}</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">每秒操作数</div>
            <div className="text-lg font-semibold text-gray-900">{formatNumber(info.instantaneous_ops_per_sec)}</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">键命中率</div>
            <div className="text-lg font-semibold text-green-600">{calculateHitRate()}</div>
            <div className="text-xs text-gray-400 mt-1">
              命中: {formatNumber(info.keyspace_hits)} / 未命中: {formatNumber(info.keyspace_misses)}
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">过期/驱逐键</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatNumber(info.expired_keys)} / {formatNumber(info.evicted_keys)}
            </div>
          </div>
        </div>
      </div>

      {/* 持久化信息 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
          <Database className="w-5 h-5 mr-2 text-cyan-500" />
          持久化状态
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* RDB */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">RDB 快照</h4>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                info.rdb_last_bgsave_status === 'ok' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {info.rdb_last_bgsave_status === 'ok' ? (
                  <><CheckCircle className="w-3 h-3 mr-1" /> 正常</>
                ) : (
                  <><XCircle className="w-3 h-3 mr-1" /> 异常</>
                )}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">上次保存时间:</span>
                <span className="text-gray-900">{formatTimestamp(info.rdb_last_save_time)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">未保存变更:</span>
                <span className="text-gray-900">{formatNumber(info.rdb_changes_since_last_save)}</span>
              </div>
            </div>
          </div>

          {/* AOF */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">AOF 日志</h4>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                info.aof_enabled 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {info.aof_enabled ? (
                  <><CheckCircle className="w-3 h-3 mr-1" /> 已启用</>
                ) : (
                  <><XCircle className="w-3 h-3 mr-1" /> 未启用</>
                )}
              </span>
            </div>
            {info.aof_enabled && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">重写状态:</span>
                  <span className="text-gray-900">
                    {info.aof_rewrite_in_progress ? '进行中' : '空闲'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">上次重写耗时:</span>
                  <span className="text-gray-900">{info.aof_last_rewrite_time_sec} 秒</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">上次重写状态:</span>
                  <span className={info.aof_last_bgrewrite_status === 'ok' ? 'text-green-600' : 'text-red-600'}>
                    {info.aof_last_bgrewrite_status}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 复制信息 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
          <Cpu className="w-5 h-5 mr-2 text-indigo-500" />
          复制信息
        </h3>
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">角色</div>
              <div className={`text-lg font-semibold ${
                info.role === 'master' ? 'text-blue-600' : 'text-purple-600'
              }`}>
                {info.role === 'master' ? '主节点' : '从节点'}
              </div>
            </div>
            {info.role === 'master' && (
              <div>
                <div className="text-sm text-gray-500 mb-1">从节点数量</div>
                <div className="text-lg font-semibold text-gray-900">{info.connected_slaves}</div>
              </div>
            )}
            {info.role === 'slave' && info.master_host && (
              <>
                <div>
                  <div className="text-sm text-gray-500 mb-1">主节点地址</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {info.master_host}:{info.master_port}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">连接状态</div>
                  <div className={`text-lg font-semibold ${
                    info.master_link_status === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {info.master_link_status === 'up' ? '已连接' : '断开'}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 键空间信息 */}
      {Object.keys(info.keyspace).length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
            <Database className="w-5 h-5 mr-2 text-red-500" />
            键空间统计
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(info.keyspace).map(([db, stats]) => (
              <div key={db} className="border border-gray-200 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-700 mb-2">{db.toUpperCase()}</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">键数量:</span>
                    <span className="text-gray-900 font-medium">{formatNumber(stats.keys)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">过期键:</span>
                    <span className="text-gray-900">{formatNumber(stats.expires)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">平均 TTL:</span>
                    <span className="text-gray-900">{stats.avg_ttl > 0 ? `${Math.floor(stats.avg_ttl / 1000)}s` : '-'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ServerInfo
