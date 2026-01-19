import React, { useState } from 'react'
import Toast from './Toast'
import AlertBox from './AlertBox'
import NotificationModal from './Modal'
import { useTheme } from '../../hooks/useTheme'

/**
 * Demo component to showcase notification components
 * This is for development/testing purposes only
 */
const NotificationDemo: React.FC = () => {
  const { isDark, toggleTheme } = useTheme()
  const [showToast, setShowToast] = useState(false)
  const [toastType, setToastType] = useState<'success' | 'error' | 'info' | 'warning'>('success')
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="p-8 space-y-8" style={{ minHeight: '100vh', backgroundColor: isDark ? '#111827' : '#F9FAFB' }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold" style={{ color: isDark ? '#F9FAFB' : '#111827' }}>
            Notification Components Demo
          </h1>
          <button
            onClick={toggleTheme}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600"
          >
            Toggle Theme ({isDark ? 'Dark' : 'Light'})
          </button>
        </div>

        {/* Toast Demo */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4" style={{ color: isDark ? '#F9FAFB' : '#111827' }}>
            Toast Notifications
          </h2>
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => { setToastType('success'); setShowToast(true); }}
              className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600"
            >
              Show Success Toast
            </button>
            <button
              onClick={() => { setToastType('error'); setShowToast(true); }}
              className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
            >
              Show Error Toast
            </button>
            <button
              onClick={() => { setToastType('info'); setShowToast(true); }}
              className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600"
            >
              Show Info Toast
            </button>
            <button
              onClick={() => { setToastType('warning'); setShowToast(true); }}
              className="px-4 py-2 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600"
            >
              Show Warning Toast
            </button>
          </div>
          {showToast && (
            <div className="fixed top-4 right-4 z-50">
              <Toast
                id="demo-toast"
                type={toastType}
                message={`This is a ${toastType} toast notification!`}
                onClose={() => setShowToast(false)}
              />
            </div>
          )}
        </section>

        {/* AlertBox Demo */}
        <section className="mb-8 space-y-4">
          <h2 className="text-2xl font-semibold mb-4" style={{ color: isDark ? '#F9FAFB' : '#111827' }}>
            Alert Boxes
          </h2>
          
          <AlertBox
            type="success"
            title="Success"
            message="Your operation completed successfully!"
          />
          
          <AlertBox
            type="error"
            title="Error"
            message="An error occurred while processing your request."
            actions={[
              { label: 'Retry', onClick: () => alert('Retry clicked'), variant: 'primary' },
              { label: 'Cancel', onClick: () => alert('Cancel clicked'), variant: 'secondary' }
            ]}
          />
          
          <AlertBox
            type="info"
            title="Information"
            message="Here's some helpful information about this feature."
          />
          
          <AlertBox
            type="warning"
            title="Warning"
            message="Please review your changes before proceeding."
            actions={[
              { label: 'Proceed', onClick: () => alert('Proceed clicked'), variant: 'primary' }
            ]}
          />
        </section>

        {/* Modal Demo */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4" style={{ color: isDark ? '#F9FAFB' : '#111827' }}>
            Modal Dialog
          </h2>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600"
          >
            Open Modal
          </button>
          
          <NotificationModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            title="Example Modal"
            size="md"
            footer={
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { alert('Confirmed!'); setShowModal(false); }}
                  className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600"
                >
                  Confirm
                </button>
              </div>
            }
          >
            <p>This is the modal content. You can put any content here.</p>
            <p className="mt-4">The modal supports different sizes and themes.</p>
          </NotificationModal>
        </section>
      </div>
    </div>
  )
}

export default NotificationDemo
