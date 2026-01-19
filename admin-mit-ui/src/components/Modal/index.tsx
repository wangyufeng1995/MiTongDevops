/**
 * 通用模态弹窗组件
 * 支持遮罩层点击关闭、ESC键关闭、关闭前确认等功能
 */
import React, { useEffect, useCallback, useRef, useState } from 'react'
import { X } from 'lucide-react'

export interface ModalProps {
  /** 是否显示弹窗 */
  isOpen: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 弹窗标题 */
  title?: string
  /** 弹窗内容 */
  children: React.ReactNode
  /** 点击遮罩层是否关闭弹窗，默认 true */
  closeOnOverlayClick?: boolean
  /** 按 ESC 键是否关闭弹窗，默认 true */
  closeOnEsc?: boolean
  /** 是否显示关闭按钮，默认 true */
  showCloseButton?: boolean
  /** 弹窗尺寸 */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** 关闭前是否需要确认 */
  confirmOnClose?: boolean
  /** 表单是否有未保存的数据 */
  isDirty?: boolean
  /** 确认关闭的提示文本 */
  confirmMessage?: string
  /** 自定义类名 */
  className?: string
  /** 底部内容 */
  footer?: React.ReactNode
}

const sizeClasses = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  showCloseButton = true,
  size = 'md',
  confirmOnClose = false,
  isDirty = false,
  confirmMessage = '您有未保存的更改，确定要关闭吗？',
  className = '',
  footer,
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const modalContentRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  // 处理关闭逻辑
  const handleClose = useCallback(() => {
    if (confirmOnClose && isDirty) {
      setShowConfirmDialog(true)
    } else {
      onClose()
    }
  }, [confirmOnClose, isDirty, onClose])

  // 确认关闭
  const handleConfirmClose = useCallback(() => {
    setShowConfirmDialog(false)
    onClose()
  }, [onClose])

  // 取消关闭
  const handleCancelClose = useCallback(() => {
    setShowConfirmDialog(false)
  }, [])

  // 处理遮罩层点击
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (closeOnOverlayClick && e.target === e.currentTarget) {
        handleClose()
      }
    },
    [closeOnOverlayClick, handleClose]
  )

  // 处理内容区域点击（阻止冒泡）
  const handleContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
  }, [])

  // 处理 ESC 键
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 如果确认对话框打开，先关闭确认对话框
        if (showConfirmDialog) {
          setShowConfirmDialog(false)
        } else {
          handleClose()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeOnEsc, handleClose, showConfirmDialog])

  // 焦点管理
  useEffect(() => {
    if (isOpen) {
      // 保存当前焦点元素
      previousActiveElement.current = document.activeElement as HTMLElement
      // 聚焦到弹窗内容
      modalContentRef.current?.focus()
    } else {
      // 恢复焦点
      previousActiveElement.current?.focus()
    }
  }, [isOpen])

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

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      data-testid="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        data-testid="modal-overlay"
        onClick={handleOverlayClick}
        aria-hidden="true"
      >
        {/* 内容容器 */}
        <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
          {/* 弹窗内容 */}
          <div
            ref={modalContentRef}
            className={`relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full ${sizeClasses[size]} ${className}`}
            data-testid="modal-content"
            onClick={handleContentClick}
            tabIndex={-1}
          >
            {/* 头部 */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                {title && (
                  <h3
                    id="modal-title"
                    className="text-lg font-medium text-gray-900"
                    data-testid="modal-title"
                  >
                    {title}
                  </h3>
                )}
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                    data-testid="modal-close-button"
                    aria-label="关闭"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}

            {/* 主体内容 */}
            <div className="px-4 py-4 max-h-[75vh] overflow-y-auto" data-testid="modal-body">
              {children}
            </div>

            {/* 底部 */}
            {footer && (
              <div
                className="px-4 py-3 border-t border-gray-200 bg-gray-50"
                data-testid="modal-footer"
              >
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 确认关闭对话框 */}
      {showConfirmDialog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          data-testid="confirm-dialog"
        >
          <div
            className="fixed inset-0 bg-gray-500 bg-opacity-50"
            onClick={handleCancelClose}
          />
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h4 className="text-lg font-medium text-gray-900 mb-4">确认关闭</h4>
            <p className="text-sm text-gray-500 mb-6" data-testid="confirm-message">
              {confirmMessage}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleCancelClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                data-testid="confirm-cancel-button"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                data-testid="confirm-close-button"
              >
                确认关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Modal
