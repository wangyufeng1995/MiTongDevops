/**
 * ModalContainer - 渲染所有活动的 Modal
 */
import React from 'react'
import { useNotificationContext } from '../../contexts/NotificationContext'
import Modal from './Modal'

export const ModalContainer: React.FC = () => {
  const { modals, dismissModal } = useNotificationContext()

  return (
    <>
      {modals.map((modal) => (
        <Modal
          key={modal.id}
          isOpen={true}
          onClose={() => dismissModal(modal.id, false)}
          title={modal.config.title}
          size={modal.config.size}
          closeOnOverlayClick={modal.config.closeOnOverlayClick}
          closeOnEsc={modal.config.closeOnEsc}
          danger={modal.config.danger}
          footer={
            modal.config.footer || (
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => dismissModal(modal.id, false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => dismissModal(modal.id, true)}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                    modal.config.danger
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  确认
                </button>
              </div>
            )
          }
        >
          {modal.config.content}
        </Modal>
      ))}
    </>
  )
}

export default ModalContainer
