/**
 * 确认对话框组件
 * 
 * 用于危险操作的二次确认
 * Requirements: 8.4
 */
import React from 'react'
import { AlertTriangle, Info, XCircle } from 'lucide-react'
import { Modal } from '../Modal'

export interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  warning?: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
  loading?: boolean
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  warning,
  confirmText = '确认',
  cancelText = '取消',
  type = 'danger',
  loading = false
}) => {
  const handleConfirm = async () => {
    await onConfirm()
  }

  // 根据类型选择图标和颜色
  const getIconAndColors = () => {
    switch (type) {
      case 'danger':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-red-600" />,
          iconBg: 'bg-red-100',
          buttonBg: 'bg-red-600 hover:bg-red-700',
          buttonText: 'text-white'
        }
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-yellow-600" />,
          iconBg: 'bg-yellow-100',
          buttonBg: 'bg-yellow-600 hover:bg-yellow-700',
          buttonText: 'text-white'
        }
      case 'info':
        return {
          icon: <Info className="w-5 h-5 text-blue-600" />,
          iconBg: 'bg-blue-100',
          buttonBg: 'bg-blue-600 hover:bg-blue-700',
          buttonText: 'text-white'
        }
      default:
        return {
          icon: <AlertTriangle className="w-5 h-5 text-red-600" />,
          iconBg: 'bg-red-100',
          buttonBg: 'bg-red-600 hover:bg-red-700',
          buttonText: 'text-white'
        }
    }
  }

  const { icon, iconBg, buttonBg, buttonText } = getIconAndColors()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
    >
      <div className="space-y-4">
        {/* 图标和消息 */}
        <div className="flex items-start space-x-3">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full ${iconBg} flex items-center justify-center`}>
            {icon}
          </div>
          <div className="flex-1">
            <p className="text-gray-900 font-medium">{message}</p>
            {warning && (
              <p className="text-sm text-gray-500 mt-2">{warning}</p>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`px-4 py-2 border border-transparent rounded-md text-sm font-medium ${buttonText} ${buttonBg} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? '处理中...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ConfirmDialog
