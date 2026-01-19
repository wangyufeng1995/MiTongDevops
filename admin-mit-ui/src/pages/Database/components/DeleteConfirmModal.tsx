/**
 * 美化的删除确认弹窗组件
 * 
 * 特点:
 * - 渐变色顶部背景（根据数据库类型变化）
 * - 居中图标、实例名称突出显示、警告提示
 * - 毛玻璃遮罩、缩放动画
 * 
 * Requirements: 9.1, 9.6, 9.7, 9.8
 */
import React, { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, Database, X, Trash2 } from 'lucide-react'

// 数据库类型配置
export type DatabaseType = 'postgresql' | 'mysql' | 'dm' | 'oracle'

interface DatabaseTypeConfig {
  name: string
  gradient: string
  iconBg: string
  buttonGradient: string
  buttonHover: string
}

const DATABASE_TYPE_CONFIGS: Record<DatabaseType, DatabaseTypeConfig> = {
  postgresql: {
    name: 'PostgreSQL',
    gradient: 'from-blue-500 to-indigo-600',
    iconBg: 'bg-blue-100',
    buttonGradient: 'from-blue-600 to-indigo-700',
    buttonHover: 'hover:from-blue-700 hover:to-indigo-800'
  },
  mysql: {
    name: 'MySQL',
    gradient: 'from-orange-500 to-amber-600',
    iconBg: 'bg-orange-100',
    buttonGradient: 'from-orange-600 to-amber-700',
    buttonHover: 'hover:from-orange-700 hover:to-amber-800'
  },
  dm: {
    name: '达梦 DM',
    gradient: 'from-red-500 to-rose-600',
    iconBg: 'bg-red-100',
    buttonGradient: 'from-red-600 to-rose-700',
    buttonHover: 'hover:from-red-700 hover:to-rose-800'
  },
  oracle: {
    name: 'Oracle',
    gradient: 'from-red-700 to-orange-600',
    iconBg: 'bg-red-100',
    buttonGradient: 'from-red-700 to-orange-700',
    buttonHover: 'hover:from-red-800 hover:to-orange-800'
  }
}

export interface DeleteConfirmModalProps {
  /** 是否显示弹窗 */
  isOpen: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 确认删除回调 */
  onConfirm: () => void | Promise<void>
  /** 要删除的实例名称 */
  itemName: string
  /** 数据库类型 */
  dbType: DatabaseType
  /** 是否正在加载 */
  loading?: boolean
  /** 自定义警告信息 */
  warningMessage?: string
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  dbType,
  loading = false,
  warningMessage = '此操作不可撤销，删除后将无法恢复连接配置。'
}) => {
  const [isAnimating, setIsAnimating] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  const config = DATABASE_TYPE_CONFIGS[dbType] || DATABASE_TYPE_CONFIGS.postgresql

  // 处理打开/关闭动画
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      // 延迟一帧以触发动画
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
      if (e.key === 'Escape' && !loading) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, loading, onClose])

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

  const handleConfirm = useCallback(async () => {
    await onConfirm()
  }, [onConfirm])

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !loading) {
      onClose()
    }
  }, [loading, onClose])

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
            <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center transform rotate-45">
              <div className="transform -rotate-45">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
            </div>
          </div>
          
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="pt-10 pb-6 px-6">
          {/* 标题 */}
          <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
            确认删除连接
          </h3>

          {/* 实例名称突出显示 */}
          <div className="bg-gray-100 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-center space-x-3">
              <div className={`w-10 h-10 rounded-lg ${config.iconBg} flex items-center justify-center`}>
                <Database className="w-5 h-5 text-gray-700" />
              </div>
              <div className="text-left">
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {config.name}
                </p>
                <p className="text-lg font-semibold text-gray-900 truncate max-w-[200px]">
                  {itemName}
                </p>
              </div>
            </div>
          </div>

          {/* 警告提示 */}
          <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-xl border border-red-100 mb-6">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 leading-relaxed">
              {warningMessage}
            </p>
          </div>

          {/* 操作按钮 */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={`flex-1 px-4 py-3 text-sm font-medium text-white bg-gradient-to-r ${config.buttonGradient} ${config.buttonHover} rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/25 active:scale-[0.98]`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  删除中...
                </span>
              ) : (
                '确认删除'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmModal
