/**
 * 美化确认弹窗组件
 */
import React from 'react'
import { AlertTriangle, X, LogOut, Trash2, Save, Info } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'

export type ConfirmModalType = 'warning' | 'danger' | 'info' | 'leave'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  type?: ConfirmModalType
  loading?: boolean
}

const typeConfig = {
  warning: {
    gradient: 'from-amber-500 via-orange-500 to-amber-600',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    confirmGradient: 'from-amber-500 to-orange-500',
    confirmHover: 'from-amber-600 to-orange-600'
  },
  danger: {
    gradient: 'from-red-500 via-rose-500 to-red-600',
    icon: Trash2,
    iconColor: 'text-red-500',
    confirmGradient: 'from-red-500 to-rose-500',
    confirmHover: 'from-red-600 to-rose-600'
  },
  info: {
    gradient: 'from-blue-500 via-cyan-500 to-blue-600',
    icon: Info,
    iconColor: 'text-blue-500',
    confirmGradient: 'from-blue-500 to-cyan-500',
    confirmHover: 'from-blue-600 to-cyan-600'
  },
  leave: {
    gradient: 'from-amber-500 via-orange-500 to-amber-600',
    icon: LogOut,
    iconColor: 'text-amber-500',
    confirmGradient: 'from-amber-500 to-orange-500',
    confirmHover: 'from-amber-600 to-orange-600'
  }
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen, onClose, onConfirm, title = '确认操作', message = '确定要执行此操作吗？',
  confirmText = '确认', cancelText = '取消', type = 'warning', loading = false
}) => {
  const { isDark } = useTheme()
  
  if (!isOpen) return null

  const config = typeConfig[type]
  const Icon = config.icon

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !loading) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleOverlayClick}>
      {/* 遮罩层 */}
      <div className={`absolute inset-0 ${isDark ? 'bg-black/60' : 'bg-black/40'} backdrop-blur-sm transition-opacity`} />
      
      {/* 弹窗内容 */}
      <div className={`relative w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden transform transition-all ${isDark ? 'bg-slate-800' : 'bg-white'}`}
        onClick={e => e.stopPropagation()}>
        
        {/* 顶部渐变装饰 */}
        <div className={`h-20 bg-gradient-to-br ${config.gradient} relative overflow-hidden`}>
          {/* 装饰圆圈 */}
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
          
          {/* 图标 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-transform ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              <Icon className={`w-7 h-7 ${config.iconColor}`} />
            </div>
          </div>
          
          {/* 关闭按钮 */}
          <button onClick={onClose} disabled={loading}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
        
        {/* 内容区域 */}
        <div className="px-6 pb-6 pt-5">
          {/* 标题 */}
          <h3 className={`text-lg font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {title}
          </h3>
          
          {/* 消息 */}
          <div className={`rounded-xl px-4 py-3 mb-5 ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
            <p className={`text-center text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              {message}
            </p>
          </div>
          
          {/* 按钮 */}
          <div className="flex gap-3">
            <button onClick={onClose} disabled={loading}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-all disabled:opacity-50 ${isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {cancelText}
            </button>
            <button onClick={onConfirm} disabled={loading}
              className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-all disabled:opacity-50 bg-gradient-to-r ${config.confirmGradient} hover:${config.confirmHover}`}>
              {loading ? (
                <span className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  处理中...
                </span>
              ) : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
