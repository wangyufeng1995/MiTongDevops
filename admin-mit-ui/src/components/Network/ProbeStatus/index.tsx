/**
 * Network Probe Status Component
 * 
 * Displays probe status - supports both real-time SSE updates and static display
 */
import React from 'react'
import { useNetworkProbeSSE, SSEConnectionState } from '../../../hooks/useNetworkProbeSSE'
import { Activity, AlertCircle, AlertTriangle, CheckCircle, Clock, WifiOff } from 'lucide-react'
import { NetworkProbe } from '../../../types/network'
import { formatDateTime } from '../../../utils'
import { useTheme } from '../../../hooks/useTheme'

export interface ProbeStatusProps {
  // For real-time SSE updates
  probeId?: number
  autoConnect?: boolean
  showConnectionState?: boolean
  // For static display
  probe?: NetworkProbe
  showDetails?: boolean
}

// Static probe status display component
const StaticProbeStatus: React.FC<{ probe: NetworkProbe; showDetails?: boolean }> = ({ 
  probe, 
  showDetails = false 
}) => {
  const { isDark } = useTheme()
  
  // 使用类型断言访问可能存在的字段
  const probeData = probe as NetworkProbe & {
    last_probe_status?: string
    last_response_time?: number
    last_probed_at?: string
  }

  const getStatusInfo = () => {
    if (!probeData.last_probe_status) {
      return {
        icon: <Clock className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />,
        text: '未探测',
        color: isDark ? 'text-gray-400' : 'text-gray-500'
      }
    }

    switch (probeData.last_probe_status) {
      case 'success':
        return {
          icon: <CheckCircle className={`w-4 h-4 ${isDark ? 'text-green-400' : 'text-green-500'}`} />,
          text: '成功',
          color: isDark ? 'text-green-400' : 'text-green-600'
        }
      case 'failed':
        return {
          icon: <AlertCircle className={`w-4 h-4 ${isDark ? 'text-red-400' : 'text-red-500'}`} />,
          text: '失败',
          color: isDark ? 'text-red-400' : 'text-red-600'
        }
      case 'timeout':
        return {
          icon: <Clock className={`w-4 h-4 ${isDark ? 'text-yellow-400' : 'text-yellow-500'}`} />,
          text: '超时',
          color: isDark ? 'text-yellow-400' : 'text-yellow-600'
        }
      case 'running':
        return {
          icon: <Activity className={`w-4 h-4 animate-pulse ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />,
          text: '探测中',
          color: isDark ? 'text-blue-400' : 'text-blue-600'
        }
      case 'unknown':
        return {
          icon: <AlertTriangle className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />,
          text: '未知',
          color: isDark ? 'text-gray-400' : 'text-gray-600'
        }
      default:
        return {
          icon: <Clock className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />,
          text: probeData.last_probe_status,
          color: isDark ? 'text-gray-400' : 'text-gray-500'
        }
    }
  }

  const statusInfo = getStatusInfo()

  return (
    <div className="flex flex-col">
      <div className="flex items-center space-x-2">
        {statusInfo.icon}
        <span className={`text-sm font-medium ${statusInfo.color}`}>
          {statusInfo.text}
        </span>
        {probeData.last_response_time !== undefined && probeData.last_response_time !== null && (
          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            ({probeData.last_response_time}ms)
          </span>
        )}
      </div>
      {showDetails && probeData.last_probed_at && (
        <div className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          {formatDateTime(probeData.last_probed_at, 'YYYY/MM/DD HH:mm:ss')}
        </div>
      )}
    </div>
  )
}

// Real-time SSE probe status component
const RealtimeProbeStatus: React.FC<{
  probeId: number
  autoConnect?: boolean
  showConnectionState?: boolean
}> = ({
  probeId,
  autoConnect = true,
  showConnectionState = false
}) => {
  const { isDark } = useTheme()
  const {
    connectionState,
    isConnected,
    isConnecting,
    latestStatus,
    reconnectAttempt,
    error,
    connect,
    disconnect
  } = useNetworkProbeSSE({
    probeId,
    autoConnect,
    onStatusUpdate: (event) => {
      console.log('Probe status update:', event)
    },
    onError: (err) => {
      console.error('SSE connection error:', err)
    }
  })

  const getStatusIcon = () => {
    if (!latestStatus) {
      return <Clock className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
    }

    switch (latestStatus.status) {
      case 'success':
        return <CheckCircle className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-500'}`} />
      case 'failed':
        return <AlertCircle className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
      case 'timeout':
        return <Clock className={`w-5 h-5 ${isDark ? 'text-yellow-400' : 'text-yellow-500'}`} />
      case 'running':
        return <Activity className={`w-5 h-5 animate-pulse ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
      case 'unknown':
        return <AlertTriangle className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
      default:
        return <Clock className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
    }
  }

  const getStatusText = () => {
    if (!latestStatus) {
      return '等待状态...'
    }

    switch (latestStatus.status) {
      case 'success':
        return `成功 (${latestStatus.response_time}ms)`
      case 'failed':
        return `失败: ${latestStatus.error_message || '未知错误'}`
      case 'timeout':
        return '超时'
      case 'running':
        return '探测中...'
      case 'unknown':
        return '未知 (超过180秒未更新)'
      default:
        return '未知状态'
    }
  }

  const getConnectionStateColor = () => {
    switch (connectionState) {
      case SSEConnectionState.CONNECTED:
        return isDark ? 'text-green-400' : 'text-green-600'
      case SSEConnectionState.CONNECTING:
        return isDark ? 'text-blue-400' : 'text-blue-600'
      case SSEConnectionState.RECONNECTING:
        return isDark ? 'text-yellow-400' : 'text-yellow-600'
      case SSEConnectionState.ERROR:
        return isDark ? 'text-red-400' : 'text-red-600'
      default:
        return isDark ? 'text-gray-400' : 'text-gray-600'
    }
  }

  return (
    <div className={`rounded-lg shadow p-4 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
      {/* Connection State (optional) */}
      {showConnectionState && (
        <div className={`mb-3 pb-3 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 
                isConnecting ? 'bg-blue-500 animate-pulse' : 
                isDark ? 'bg-gray-600' : 'bg-gray-400'
              }`} />
              <span className={`text-sm font-medium ${getConnectionStateColor()}`}>
                {connectionState === SSEConnectionState.CONNECTED && '已连接'}
                {connectionState === SSEConnectionState.CONNECTING && '连接中...'}
                {connectionState === SSEConnectionState.RECONNECTING && `重连中 (${reconnectAttempt})...`}
                {connectionState === SSEConnectionState.ERROR && '连接错误'}
                {connectionState === SSEConnectionState.DISCONNECTED && '已断开'}
              </span>
            </div>
            
            {!isConnected && !isConnecting && (
              <button
                onClick={connect}
                className={`text-sm font-medium ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
              >
                重新连接
              </button>
            )}
            
            {isConnected && (
              <button
                onClick={disconnect}
                className={`text-sm font-medium ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-700'}`}
              >
                断开连接
              </button>
            )}
          </div>
          
          {error && (
            <div className={`mt-2 text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>
              {error.message}
            </div>
          )}
        </div>
      )}

      {/* Probe Status */}
      <div className="flex items-center space-x-3">
        {getStatusIcon()}
        <div className="flex-1">
          <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {getStatusText()}
          </div>
          {latestStatus && (
            <div className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              最后更新: {formatDateTime(latestStatus.timestamp, 'HH:mm:ss')}
            </div>
          )}
        </div>
      </div>

      {/* Additional Status Details */}
      {latestStatus && latestStatus.status_code && (
        <div className={`mt-3 pt-3 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className={isDark ? 'text-gray-500' : 'text-gray-500'}>状态码:</span>
              <span className={`ml-2 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{latestStatus.status_code}</span>
            </div>
            {latestStatus.response_time && (
              <div>
                <span className={isDark ? 'text-gray-500' : 'text-gray-500'}>响应时间:</span>
                <span className={`ml-2 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{latestStatus.response_time}ms</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No Connection Warning */}
      {!isConnected && !isConnecting && !error && (
        <div className={`mt-3 flex items-center space-x-2 text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          <WifiOff className="w-4 h-4" />
          <span>实时更新已禁用</span>
        </div>
      )}
    </div>
  )
}

export const ProbeStatus: React.FC<ProbeStatusProps> = ({
  probeId,
  autoConnect = true,
  showConnectionState = false,
  probe,
  showDetails = false
}) => {
  const { isDark } = useTheme()
  
  // If probe object is provided, use static display
  if (probe) {
    return <StaticProbeStatus probe={probe} showDetails={showDetails} />
  }

  // If probeId is provided, use real-time SSE display
  if (probeId) {
    return (
      <RealtimeProbeStatus
        probeId={probeId}
        autoConnect={autoConnect}
        showConnectionState={showConnectionState}
      />
    )
  }

  // Fallback
  return (
    <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
      无探测状态
    </div>
  )
}
