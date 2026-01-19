/**
 * 连接错误/断开提示弹窗组件
 * 
 * 用于显示数据库连接断开提示，并提供重连选项
 * 
 * 特点:
 * - 渐变色顶部背景
 * - 连接状态图标
 * - 错误信息显示
 * - 重连和关闭选项
 * - 毛玻璃遮罩、缩放动画
 * 
 * Requirements: 7.1, 7.2, 7.3
 */
import React, { useState, useEffect, useCallback } from 'react'
import { 
  Unlink, 
  X, 
  RefreshCw, 
  AlertCircle, 
  WifiOff,
  Clock,
  Server
} from 'lucide-react'

// 错误类型
export type ConnectionErrorType = 'disconnected' | 'timeout' | 'auth_failed' | 'network_error' | 'unknown'

interface ErrorConfig {
  title: string
  description: string
  gradient: string
  icon: React.ElementType
  canRetry: boolean
}

const ERROR_CONFIGS: Record<ConnectionErrorType, ErrorConfig> = {
  disconnected: {
    title: '连接已断开',
    description: '与数据库服务器的连接已断开，请检查网络或重新连接。',
    gradient: 'from-red-500 to-rose-600',
    icon: Unlink,
    canRetry: true
  },
  timeout: {
    title: '连接超时',
    description: '连接数据库服务器超时，请检查网络状况或服务器是否正常运行。',
    gradient: 'from-amber-500 to-orange-600',
    icon: Clock,
    canRetry: true
  },
  auth_failed: {
    title: '认证失败',
    description: '数据库认证失败，请检查用户名和密码是否正确。',
    gradient: 'from-red-600 to-pink-600',
    icon: AlertCircle,
    canRetry: false
  },
  network_error: {
    title: '网络错误',
    description: '无法连接到数据库服务器，请检查网络连接和服务器地址。',
    gradient: 'from-gray-600 to-slate-700',
    icon: WifiOff,
    canRetry: true
  },
  unknown: {
    title: '连接错误',
    description: '发生未知错误，请稍后重试或联系管理员。',
    gradient: 'from-gray-500 to-gray-600',
    icon: AlertCircle,
    canRetry: true
  }
}

export interface ConnectionErrorModalProps {
  /** 是否显示弹窗 */
  isOpen: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 重连回调 */
  onReconnect?: () => void | Promise<void>
  /** 错误类型 */
  errorType: ConnectionErrorType
  /** 错误详情 */
  errorMessage?: string
  /** 连接名称 */
  connectionName?: string
  /** 是否正在重连 */
  reconnecting?: boolean
}

export const ConnectionErrorModal: React.FC<ConnectionErrorModalProps> = ({
  isOpen,
  onClose,
  onReconnect,
  errorType,
  errorMessage,
  connectionName,
  reconnecting = false
}) => {
  const [isAnimating, setIsAnimating] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  const config = ERROR_CONFIGS[errorType]
  const Icon = config.icon

  // 处理打开/关闭动画
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      requestAnimationFrame(() => {
        setIsAnimating(true)
      })
    } else {
      setIsAnimating(false)
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // 处理 ESC 键关闭
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !reconnecting) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, reconnecting, onClose])

  // 防止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleReconnect = useCallback(async () => {
    if (onReconnect) {
      await onReconnect()
    }
  }, [onReconnect])

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !reconnecting) {
      onClose()
    }
  }, [reconnecting, onClose])

  if (!isVisible) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleOverlayClick}
    >
      {/* 毛玻璃遮罩 */}
      <div 
        className={`absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* 弹窗内容 */}
      <div
        className={`relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300 ${
          isAnimating 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 渐变色顶部背景 */}
        <div className={`h-24 bg-gradient-to-r ${config.gradient} relative`}>
          {/* 装饰性圆形 */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2">
            <div className="w-14 h-14 bg-white rounded-2xl shadow-lg flex items-center justify-center transform rotate-45">
              <div className="transform -rotate-45">
                <Icon className="w-7 h-7 text-red-500" />
              </div>
            </div>
          </div>
          
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            disabled={reconnecting}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="pt-10 pb-6 px-6">
          {/* 标题 */}
          <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
            {config.title}
          </h3>

          {/* 连接名称 */}
          {connectionName && (
            <div className="flex items-center justify-center gap-2 mb-3">
              <Server className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">{connectionName}</span>
            </div>
          )}

          {/* 描述 */}
          <p className="text-sm text-gray-600 text-center mb-4">
            {config.description}
          </p>

          {/* 错误详情 */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 font-mono break-all">
                  {errorMessage}
                </p>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={reconnecting}
              className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              关闭
            </button>
            {config.canRetry && onReconnect && (
              <button
                onClick={handleReconnect}
                disabled={reconnecting}
                className={`flex-1 px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25 active:scale-[0.98]`}
              >
                {reconnecting ? (
                  <span className="flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    重连中...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    重新连接
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConnectionErrorModal
