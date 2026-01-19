/**
 * 服务健康状态卡片组件
 * 
 * 显示 Celery、SSE、数据库、Redis 等服务的健康状态
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  RefreshCw,
  Server,
  Wifi,
  XCircle,
  Zap
} from 'lucide-react'
import { healthService, ServicesHealthStatus } from '../../services/health'

interface ServiceHealthCardProps {
  /** 自动刷新间隔（秒），0 表示不自动刷新 */
  refreshInterval?: number
  /** 是否显示详细信息 */
  showDetails?: boolean
  /** 是否紧凑模式 */
  compact?: boolean
  /** 自定义类名 */
  className?: string
}

type ServiceStatus = 'healthy' | 'unhealthy' | 'degraded' | 'unknown' | 'loading'

const getStatusColor = (status: ServiceStatus) => {
  switch (status) {
    case 'healthy':
      return 'text-green-600'
    case 'unhealthy':
      return 'text-red-600'
    case 'degraded':
      return 'text-yellow-600'
    case 'loading':
      return 'text-blue-600'
    default:
      return 'text-gray-500'
  }
}

const getStatusBgColor = (status: ServiceStatus) => {
  switch (status) {
    case 'healthy':
      return 'bg-green-50 border-green-200'
    case 'unhealthy':
      return 'bg-red-50 border-red-200'
    case 'degraded':
      return 'bg-yellow-50 border-yellow-200'
    case 'loading':
      return 'bg-blue-50 border-blue-200'
    default:
      return 'bg-gray-50 border-gray-200'
  }
}

const getStatusIcon = (status: ServiceStatus) => {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="w-5 h-5 text-green-600" />
    case 'unhealthy':
      return <XCircle className="w-5 h-5 text-red-600" />
    case 'degraded':
      return <AlertCircle className="w-5 h-5 text-yellow-600" />
    case 'loading':
      return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
    default:
      return <Clock className="w-5 h-5 text-gray-500" />
  }
}

const getStatusText = (status: ServiceStatus) => {
  switch (status) {
    case 'healthy':
      return '正常'
    case 'unhealthy':
      return '异常'
    case 'degraded':
      return '降级'
    case 'loading':
      return '检查中'
    default:
      return '未知'
  }
}

export const ServiceHealthCard: React.FC<ServiceHealthCardProps> = ({
  refreshInterval = 30,
  showDetails = true,
  compact = false,
  className = ''
}) => {
  const [healthData, setHealthData] = useState<ServicesHealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const mountedRef = useRef(true)

  const loadHealthData = useCallback(async () => {
    if (!mountedRef.current) return

    try {
      setLoading(true)
      setError(null)

      const response = await healthService.getServicesHealth()

      if (mountedRef.current) {
        if (response.success && response.data) {
          setHealthData(response.data)
        } else {
          setError(response.message || '获取健康状态失败')
        }
        setLastRefresh(new Date())
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || '网络错误')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    loadHealthData()

    return () => {
      mountedRef.current = false
    }
  }, [loadHealthData])

  useEffect(() => {
    if (refreshInterval <= 0) return

    const interval = setInterval(loadHealthData, refreshInterval * 1000)
    return () => clearInterval(interval)
  }, [refreshInterval, loadHealthData])

  const overallStatus: ServiceStatus = loading
    ? 'loading'
    : error
    ? 'unknown'
    : (healthData?.status as ServiceStatus) || 'unknown'

  if (compact) {
    return (
      <div className={`flex items-center space-x-4 ${className}`}>
        {/* Celery 状态 */}
        <div className="flex items-center space-x-2" title="Celery 任务队列">
          <Zap className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">Celery:</span>
          {loading ? (
            <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
          ) : healthData?.services?.celery?.status === 'healthy' ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500" />
          )}
        </div>

        {/* SSE 状态 */}
        <div className="flex items-center space-x-2" title="SSE 实时推送">
          <Wifi className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">SSE:</span>
          {loading ? (
            <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
          ) : healthData?.services?.sse?.status === 'healthy' ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500" />
          )}
        </div>

        {/* 刷新按钮 */}
        <button
          onClick={loadHealthData}
          disabled={loading}
          className="p-1 hover:bg-gray-100 rounded"
          title="刷新状态"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow border ${className}`}>
      {/* 头部 */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Server className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">服务健康状态</h3>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs text-gray-500">
            更新于 {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={loadHealthData}
            disabled={loading}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm rounded-lg transition-colors"
            title="刷新状态"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>健康检查</span>
          </button>
        </div>
      </div>

      {/* 总体状态 */}
      <div className={`px-4 py-3 border-b ${getStatusBgColor(overallStatus)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon(overallStatus)}
            <span className={`font-medium ${getStatusColor(overallStatus)}`}>
              系统状态: {getStatusText(overallStatus)}
            </span>
          </div>
          {healthData?.response_time_ms && (
            <span className="text-sm text-gray-500">
              响应时间: {healthData.response_time_ms}ms
            </span>
          )}
        </div>
      </div>

      {/* 服务详情 */}
      {showDetails && (
        <div className="p-4 grid grid-cols-2 gap-4">
          {/* Celery 状态 */}
          <ServiceItem
            icon={<Zap className="w-5 h-5" />}
            name="Celery"
            description="任务队列"
            status={healthData?.services?.celery?.status || 'unknown'}
            loading={loading}
            details={
              healthData?.services?.celery && (
                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                  <div>Workers: {healthData.services.celery.workers?.length || 0}</div>
                  <div>活跃任务: {healthData.services.celery.active_tasks || 0}</div>
                  <div>预留任务: {healthData.services.celery.reserved_tasks || 0}</div>
                </div>
              )
            }
          />

          {/* SSE 状态 */}
          <ServiceItem
            icon={<Wifi className="w-5 h-5" />}
            name="SSE"
            description="实时推送"
            status={healthData?.services?.sse?.status || 'unknown'}
            loading={loading}
            details={
              healthData?.services?.sse && (
                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                  <div>总连接: {healthData.services.sse.total_connections || 0}</div>
                  <div>活跃连接: {healthData.services.sse.active_connections || 0}</div>
                </div>
              )
            }
          />

          {/* 数据库状态 */}
          <ServiceItem
            icon={<Database className="w-5 h-5" />}
            name="数据库"
            description="PostgreSQL"
            status={healthData?.services?.database?.status || 'unknown'}
            loading={loading}
            details={
              healthData?.services?.database?.response_time_ms && (
                <div className="text-xs text-gray-500 mt-1">
                  响应: {healthData.services.database.response_time_ms}ms
                </div>
              )
            }
          />

          {/* Redis 状态 */}
          <ServiceItem
            icon={<Activity className="w-5 h-5" />}
            name="Redis"
            description="缓存服务"
            status={healthData?.services?.redis?.status || 'unknown'}
            loading={loading}
            details={
              healthData?.services?.redis?.response_time_ms && (
                <div className="text-xs text-gray-500 mt-1">
                  响应: {healthData.services.redis.response_time_ms}ms
                </div>
              )
            }
          />
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-200">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}
    </div>
  )
}

interface ServiceItemProps {
  icon: React.ReactNode
  name: string
  description: string
  status: string
  loading: boolean
  details?: React.ReactNode
}

const ServiceItem: React.FC<ServiceItemProps> = ({
  icon,
  name,
  description,
  status,
  loading,
  details
}) => {
  const serviceStatus: ServiceStatus = loading
    ? 'loading'
    : (status as ServiceStatus) || 'unknown'

  return (
    <div className={`p-3 rounded-lg border ${getStatusBgColor(serviceStatus)}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2">
          <div className={getStatusColor(serviceStatus)}>{icon}</div>
          <div>
            <div className="font-medium text-gray-900">{name}</div>
            <div className="text-xs text-gray-500">{description}</div>
          </div>
        </div>
        {getStatusIcon(serviceStatus)}
      </div>
      {details}
    </div>
  )
}

export default ServiceHealthCard
