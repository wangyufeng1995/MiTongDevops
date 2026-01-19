/**
 * 美化的确认对话框组件
 */
import React from 'react'
import { AlertTriangle, XCircle, CheckCircle, Info, X, Loader2 } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'

export type ConfirmDialogVariant = 'danger' | 'warning' | 'success' | 'info'

export interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string | React.ReactNode
  confirmText?: string
  cancelText?: string
  variant?: ConfirmDialogVariant
  loading?: boolean
  icon?: React.ReactNode
}

const variantConfig = {
  danger: {
    icon: XCircle,
    iconBg: 'bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-500/20 dark:to-rose-500/20',
    iconColor: 'text-red-500 dark:text-red-400',
    buttonBg: 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-lg shadow-red-500/25',
    accentColor: 'from-red-500 to-rose-500',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-500/20 dark:to-orange-500/20',
    iconColor: 'text-amber-500 dark:text-amber-400',
    buttonBg: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/25',
    accentColor: 'from-amber-500 to-orange-500',
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-500/20 dark:to-teal-500/20',
    iconColor: 'text-emerald-500 dark:text-emerald-400',
    buttonBg: 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25',
    accentColor: 'from-emerald-500 to-teal-500',
  },
  info: {
    icon: Info,
    iconBg: 'bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-500/20 dark:to-cyan-500/20',
    iconColor: 'text-blue-500 dark:text-blue-400',
    buttonBg: 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-lg shadow-blue-500/25',
    accentColor: 'from-blue-500 to-cyan-500',
  },
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'danger',
  loading = false,
  icon,
}) => {
  const { isDark } = useTheme()
  const config = variantConfig[variant]
  const IconComponent = config.icon

  if (!isOpen) return null

  const handleConfirm = async () => {
    await onConfirm()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={loading ? undefined : onClose}
      />
      
      {/* 对话框 */}
      <div className={`relative w-full max-w-md transform transition-all duration-300 ease-out scale-100 opacity-100 ${
        isDark ? 'bg-slate-800/95' : 'bg-white'
      } rounded-2xl shadow-2xl overflow-hidden border ${isDark ? 'border-slate-700/50' : 'border-gray-200'}`}>
        
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          disabled={loading}
          className={`absolute top-4 right-4 p-2 rounded-xl transition-all ${
            isDark 
              ? 'text-gray-400 hover:text-gray-200 hover:bg-slate-700/80' 
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* 内容区域 */}
        <div className="p-6 pt-5">
          {/* 图标和标题 */}
          <div className="flex items-start space-x-4">
            <div className={`flex-shrink-0 w-14 h-14 rounded-2xl ${config.iconBg} flex items-center justify-center shadow-sm`}>
              {icon || <IconComponent className={`w-7 h-7 ${config.iconColor}`} />}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {title}
              </h3>
              <div className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {message}
              </div>
            </div>
          </div>
        </div>

        {/* 按钮区域 */}
        <div className={`px-6 py-4 flex items-center justify-end space-x-3 ${
          isDark ? 'bg-slate-900/50 border-t border-slate-700/50' : 'bg-gray-50/80 border-t border-gray-100'
        }`}>
          <button
            onClick={onClose}
            disabled={loading}
            className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-all ${
              isDark 
                ? 'bg-slate-700 text-gray-300 hover:bg-slate-600 border border-slate-600' 
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`px-5 py-2.5 text-sm font-medium text-white rounded-xl transition-all ${config.buttonBg} ${
              loading ? 'opacity-80 cursor-not-allowed' : ''
            } flex items-center space-x-2`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// 简化的 Hook 用于管理确认对话框状态
export interface UseConfirmDialogOptions {
  title: string
  message: string | React.ReactNode
  confirmText?: string
  cancelText?: string
  variant?: ConfirmDialogVariant
  onConfirm: () => void | Promise<void>
}

export interface ConfirmDialogState {
  isOpen: boolean
  title: string
  message: string | React.ReactNode
  confirmText: string
  cancelText: string
  variant: ConfirmDialogVariant
  loading: boolean
  onConfirm: () => void | Promise<void>
}

export const useConfirmDialog = () => {
  const [state, setState] = React.useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '确认',
    cancelText: '取消',
    variant: 'danger',
    loading: false,
    onConfirm: () => {},
  })

  const show = React.useCallback((options: UseConfirmDialogOptions) => {
    setState({
      isOpen: true,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText || '确认',
      cancelText: options.cancelText || '取消',
      variant: options.variant || 'danger',
      loading: false,
      onConfirm: options.onConfirm,
    })
  }, [])

  const close = React.useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }))
  }, [])

  const setLoading = React.useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }))
  }, [])

  const handleConfirm = React.useCallback(async () => {
    setLoading(true)
    try {
      await state.onConfirm()
      close()
    } catch (error) {
      console.error('Confirm action failed:', error)
    } finally {
      setLoading(false)
    }
  }, [state.onConfirm, close, setLoading])

  const dialogProps: ConfirmDialogProps = {
    isOpen: state.isOpen,
    onClose: close,
    onConfirm: handleConfirm,
    title: state.title,
    message: state.message,
    confirmText: state.confirmText,
    cancelText: state.cancelText,
    variant: state.variant,
    loading: state.loading,
  }

  return { show, close, dialogProps }
}

export default ConfirmDialog
