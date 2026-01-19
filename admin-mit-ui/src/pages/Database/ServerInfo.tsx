/**
 * 服务器信息组件
 * 
 * 显示数据库服务器的详细信息：
 * - 版本信息
 * - 当前连接数
 * - 数据库大小
 * - 服务器运行时间
 * - 支持刷新功能
 * 
 * Requirements: 5.1-5.5
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Server,
  RefreshCw,
  Database,
  Clock,
  Users,
  HardDrive,
  Activity,
  AlertCircle,
  Info,
  Gauge
} from 'lucide-react'
import { 
  databaseService, 
  DatabaseConnection, 
  ServerInfo as ServerInfoType,
  DatabaseType
} from '../../services/database'
import { databaseToast } from './components'

interface ServerInfoProps {
  connection: DatabaseConnection
  onRefresh?: () => void
}

// 数据库类型颜色配置
const DatabaseTypeColors: Record<DatabaseType, { 
  gradient: string
  bg: string
  text: string
  iconBg: string
}> = {
  postgresql: {
    gradient: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    iconBg: 'bg-blue-100'
  },
  mysql: {
    gradient: 'from-orange-500 to-amber-600',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    iconBg: 'bg-orange-100'
  },
  dm: {
    gradient: 'from-red-500 to-rose-600',
    bg: 'bg-red-50',
    text: 'text-red-700',
    iconBg: 'bg-red-100'
  },
  oracle: {
    gradient: 'from-red-700 to-orange-600',
    bg: 'bg-red-50',
    text: 'text-red-800',
    iconBg: 'bg-red-100'
  }
}

// 信息卡片组件
interface InfoCardProps {
  icon: React.ElementType
  label: string
  value: string | number | undefined
  subValue?: string
  iconColor?: string
  loading?: boolean
}

const InfoCard: React.FC<InfoCardProps> = ({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  iconColor = 'text-gray-600',
  loading = false
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
    <div className="flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
        {loading ? (
          <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
        ) : (
          <>
            <p className="text-lg font-semibold text-gray-900 truncate">
              {value ?? '-'}
            </p>
            {subValue && (
              <p className="text-xs text-gray-500 mt-0.5">{subValue}</p>
            )}
          </>
        )}
      </div>
    </div>
  </div>
)

export const ServerInfo: React.FC<ServerInfoProps> = ({ connection, onRefresh }) => {
  const [serverInfo, setServerInfo] = useState<ServerInfoType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const colors = DatabaseTypeColors[connection.db_type as DatabaseType] || DatabaseTypeColors.postgresql

  // 加载服务器信息
  const loadServerInfo = useCallback(async (showToast = false) => {
    try {
      if (showToast) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)
      
      const info = await databaseService.getServerInfo(connection.id)
      setServerInfo(info)
      setLastRefresh(new Date())
      
      if (showToast) {
        databaseToast.success('刷新成功', '服务器信息已更新')
      }
      
      onRefresh?.()
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || '获取服务器信息失败'
      setError(errorMessage)
      if (showToast) {
        databaseToast.error('刷新失败', errorMessage)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [connection.id, onRefresh])

  // 初始加载
  useEffect(() => {
    loadServerInfo()
  }, [loadServerInfo])

  // 手动刷新
  const handleRefresh = () => {
    loadServerInfo(true)
  }

  // 格式化运行时间
  const formatUptime = (uptime?: string): string => {
    if (!uptime) return '-'
    return uptime
  }

  // 格式化数据库大小
  const formatSize = (size?: string): string => {
    if (!size) return '-'
    return size
  }

  // 格式化最后刷新时间
  const formatLastRefresh = (): string => {
    if (!lastRefresh) return ''
    return lastRefresh.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 头部 */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center shadow-sm`}>
              <Server className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">服务器信息</h3>
              <p className="text-xs text-gray-500">
                {connection.name} · {connection.host}:{connection.port}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-gray-400">
                最后更新: {formatLastRefresh()}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="刷新服务器信息"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>刷新</span>
            </button>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto p-4">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">获取服务器信息失败</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                <button
                  onClick={handleRefresh}
                  className="mt-3 px-3 py-1.5 text-sm text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                >
                  重试
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 基本信息卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 数据库版本 */}
              <InfoCard
                icon={Database}
                label="数据库版本"
                value={serverInfo?.version}
                iconColor="text-blue-600"
                loading={loading}
              />
              
              {/* 当前连接数 */}
              <InfoCard
                icon={Users}
                label="当前连接数"
                value={serverInfo?.connections}
                iconColor="text-green-600"
                loading={loading}
              />
              
              {/* 数据库大小 */}
              <InfoCard
                icon={HardDrive}
                label="数据库大小"
                value={formatSize(serverInfo?.database_size)}
                iconColor="text-purple-600"
                loading={loading}
              />
              
              {/* 运行时间 */}
              <InfoCard
                icon={Clock}
                label="运行时间"
                value={formatUptime(serverInfo?.uptime)}
                iconColor="text-amber-600"
                loading={loading}
              />
              
              {/* 数据库类型 */}
              <InfoCard
                icon={Activity}
                label="数据库类型"
                value={serverInfo?.db_type?.toUpperCase() || connection.db_type.toUpperCase()}
                iconColor="text-indigo-600"
                loading={loading}
              />
              
              {/* 主机地址 */}
              <InfoCard
                icon={Server}
                label="主机地址"
                value={`${connection.host}:${connection.port}`}
                iconColor="text-gray-600"
                loading={loading}
              />
            </div>

            {/* 额外信息（如果有） */}
            {serverInfo && Object.keys(serverInfo).length > 5 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-gray-500" />
                  <h4 className="text-sm font-medium text-gray-700">详细信息</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(serverInfo)
                    .filter(([key]) => !['version', 'uptime', 'connections', 'database_size', 'db_type'].includes(key))
                    .map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">{key}</span>
                        <span className="text-sm font-medium text-gray-900">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            {/* 连接信息 */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Gauge className="w-4 h-4 text-gray-500" />
                <h4 className="text-sm font-medium text-gray-700">连接配置</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">连接名称</span>
                  <span className="text-sm font-medium text-gray-900">{connection.name}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">用户名</span>
                  <span className="text-sm font-medium text-gray-900">{connection.username}</span>
                </div>
                {connection.database && (
                  <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">数据库</span>
                    <span className="text-sm font-medium text-gray-900">{connection.database}</span>
                  </div>
                )}
                {connection.schema && (
                  <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Schema</span>
                    <span className="text-sm font-medium text-gray-900">{connection.schema}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">超时时间</span>
                  <span className="text-sm font-medium text-gray-900">{connection.timeout}s</span>
                </div>
                {connection.description && (
                  <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg col-span-2">
                    <span className="text-sm text-gray-600">描述</span>
                    <span className="text-sm font-medium text-gray-900">{connection.description}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ServerInfo
