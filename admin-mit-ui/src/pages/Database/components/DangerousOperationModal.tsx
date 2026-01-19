/**
 * 危险操作确认弹窗组件
 * 
 * 用于敏感 SQL 操作（DROP、DELETE、TRUNCATE）的二次确认
 * 
 * 特点:
 * - 渐变色顶部背景（警告色）
 * - 居中警告图标
 * - SQL 语句预览
 * - 需要输入确认文字才能执行
 * - 毛玻璃遮罩、缩放动画
 * 
 * Requirements: 6.5, 7.4
 */
import React, { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, X, ShieldAlert, Code, AlertOctagon } from 'lucide-react'

// 危险操作类型
export type DangerousOperationType = 'DROP' | 'DELETE' | 'TRUNCATE' | 'ALTER' | 'UPDATE'

interface DangerousOperationConfig {
  title: string
  description: string
  gradient: string
  confirmText: string
  icon: React.ElementType
}

const OPERATION_CONFIGS: Record<DangerousOperationType, DangerousOperationConfig> = {
  DROP: {
    title: '删除操作确认',
    description: '此操作将永久删除数据库对象，无法恢复！',
    gradient: 'from-red-600 to-rose-700',
    confirmText: 'DROP',
    icon: AlertOctagon
  },
  DELETE: {
    title: '删除数据确认',
    description: '此操作将删除数据，请确保已备份重要数据！',
    gradient: 'from-red-500 to-orange-600',
    confirmText: 'DELETE',
    icon: AlertTriangle
  },
  TRUNCATE: {
    title: '清空表确认',
    description: '此操作将清空表中所有数据，无法恢复！',
    gradient: 'from-red-600 to-pink-600',
    confirmText: 'TRUNCATE',
    icon: ShieldAlert
  },
  ALTER: {
    title: '修改结构确认',
    description: '此操作将修改数据库结构，可能影响现有数据！',
    gradient: 'from-amber-500 to-orange-600',
    confirmText: 'ALTER',
    icon: AlertTriangle
  },
  UPDATE: {
    title: '更新数据确认',
    description: '此操作将修改数据，请确保 WHERE 条件正确！',
    gradient: 'from-amber-500 to-yellow-600',
    confirmText: 'UPDATE',
    icon: AlertTriangle
  }
}

export interface DangerousOperationModalProps {
  /** 是否显示弹窗 */
  isOpen: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 确认执行回调 */
  onConfirm: () => void | Promise<void>
  /** 危险操作类型 */
  operationType: DangerousOperationType
  /** SQL 语句 */
  sql: string
  /** 是否正在执行 */
  loading?: boolean
}

export const DangerousOperationModal: React.FC<DangerousOperationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  operationType,
  sql,
  loading = false
}) => {
  const [isAnimating, setIsAnimating] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')
  const [inputError, setInputError] = useState(false)

  const config = OPERATION_CONFIGS[operationType]
  const Icon = config.icon
  const isConfirmValid = confirmInput.toUpperCase() === config.confirmText

  // 处理打开/关闭动画
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      setConfirmInput('')
      setInputError(false)
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
    if (!isConfirmValid) {
      setInputError(true)
      return
    }
    await onConfirm()
  }, [isConfirmValid, onConfirm])

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !loading) {
      onClose()
    }
  }, [loading, onClose])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmInput(e.target.value)
    setInputError(false)
  }

  // 格式化 SQL 显示（截断过长的 SQL）
  const formatSql = (sql: string): string => {
    const maxLength = 500
    if (sql.length > maxLength) {
      return sql.substring(0, maxLength) + '...'
    }
    return sql
  }

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
        className={`absolute inset-0 bg-gray-900/70 backdrop-blur-sm transition-opacity duration-300 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* 弹窗内容 */}
      <div
        className={`relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300 ${
          isAnimating 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 渐变色顶部背景 */}
        <div className={`h-28 bg-gradient-to-r ${config.gradient} relative`}>
          {/* 装饰性圆形 */}
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center transform rotate-45">
              <div className="transform -rotate-45">
                <Icon className="w-8 h-8 text-red-500" />
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
        <div className="pt-12 pb-6 px-6">
          {/* 标题 */}
          <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
            {config.title}
          </h3>
          
          {/* 描述 */}
          <p className="text-sm text-gray-600 text-center mb-4">
            {config.description}
          </p>

          {/* SQL 预览 */}
          <div className="bg-gray-900 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Code className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400 uppercase tracking-wide">SQL 语句</span>
            </div>
            <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap break-all max-h-32 overflow-auto">
              {formatSql(sql)}
            </pre>
          </div>

          {/* 确认输入 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              请输入 <span className="text-red-600 font-bold">{config.confirmText}</span> 以确认执行
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={handleInputChange}
              placeholder={`输入 ${config.confirmText}`}
              className={`w-full px-4 py-3 border-2 rounded-xl text-center font-mono text-lg uppercase tracking-wider transition-colors ${
                inputError 
                  ? 'border-red-500 bg-red-50 focus:ring-red-500' 
                  : isConfirmValid
                    ? 'border-green-500 bg-green-50 focus:ring-green-500'
                    : 'border-gray-300 focus:border-red-500 focus:ring-red-500'
              } focus:outline-none focus:ring-2`}
              disabled={loading}
              autoFocus
            />
            {inputError && (
              <p className="mt-2 text-sm text-red-600 text-center">
                请输入正确的确认文字
              </p>
            )}
          </div>

          {/* 警告提示 */}
          <div className="flex items-start space-x-3 p-3 bg-amber-50 rounded-xl border border-amber-200 mb-6">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 leading-relaxed">
              此操作可能无法撤销，请确保您了解操作的影响。建议在执行前备份相关数据。
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
              disabled={loading || !isConfirmValid}
              className={`flex-1 px-4 py-3 text-sm font-medium text-white bg-gradient-to-r ${config.gradient} rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/25 active:scale-[0.98] ${
                isConfirmValid ? 'hover:shadow-xl' : ''
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  执行中...
                </span>
              ) : (
                '确认执行'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DangerousOperationModal
