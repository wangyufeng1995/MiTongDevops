/**
 * Redis 连接错误提示组件
 * 
 * 显示连接断开提示和重连选项
 * Requirements: 8.1, 8.3
 */
import React, { useState } from 'react'
import { AlertTriangle, RefreshCw, XCircle, Wifi, WifiOff } from 'lucide-react'

export interface RedisConnectionErrorProps {
  isVisible: boolean
  connectionName: string
  errorMessage: string
  onReconnect: () => Promise<void>
  onDismiss: () => void
  canRetry?: boolean
}

export const RedisConnectionError: React.FC<RedisConnectionErrorProps> = ({
  isVisible,
  connectionName,
  errorMessage,
  onReconnect,
  onDismiss,
  canRetry = true
}) => {
  const [reconnecting, setReconnecting] = useState(false)

  const handleReconnect = async () => {
    setReconnecting(true)
    try {
      await onReconnect()
    } catch (error) {
      // 错误由父组件处理
    } finally {
      setReconnecting(false)
    }
  }

  if (!isVisible) return null

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-white rounded-lg shadow-2xl border-2 border-orange-200 overflow-hidden">
        {/* 顶部装饰条 */}
        <div className="h-2 bg-gradient-to-r from-orange-400 to-red-500" />
        
        <div className="p-5">
          {/* 标题和图标 */}
          <div className="flex items-start space-x-3 mb-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <WifiOff className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <AlertTriangle className="w-5 h-5 text-orange-500 mr-2" />
                连接已断开
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                与 Redis 连接 <span className="font-medium text-gray-900">"{connectionName}"</span> 的连接已断开
              </p>
            </div>
          </div>

          {/* 错误详情 */}
          <div className="bg-gray-50 rounded-md p-3 mb-4">
            <p className="text-sm text-gray-700">
              <span className="font-medium">错误信息:</span> {errorMessage}
            </p>
          </div>

          {/* 提示信息 */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
            <p className="text-sm text-blue-800">
              <span className="font-medium">提示:</span> 请检查网络连接和 Redis 服务器状态
            </p>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={onDismiss}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            >
              关闭
            </button>
            {canRetry && (
              <button
                onClick={handleReconnect}
                disabled={reconnecting}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reconnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    重连中...
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4 mr-2" />
                    重新连接
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RedisConnectionError
