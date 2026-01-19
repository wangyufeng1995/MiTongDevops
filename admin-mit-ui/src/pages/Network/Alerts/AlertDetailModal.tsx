import React from 'react'
import { NetworkAlertRecord } from '../../../types/network'
import { formatDateTime } from '../../../utils'

interface AlertDetailModalProps {
  alert: NetworkAlertRecord | null
  onClose: () => void
}

export const AlertDetailModal: React.FC<AlertDetailModalProps> = ({ alert, onClose }) => {
  if (!alert) return null

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A'
    return formatDateTime(dateString, 'YYYY/MM/DD HH:mm:ss')
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { bg: 'bg-red-100', text: 'text-red-800', label: 'Active' },
      acknowledged: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Acknowledged' },
      resolved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Resolved' },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Alert Details</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            {getStatusBadge(alert.status)}
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">{alert.message}</p>
          </div>

          {/* Alert Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rule ID</label>
              <p className="text-sm text-gray-900">{alert.rule_id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Probe ID</label>
              <p className="text-sm text-gray-900">{alert.probe_id}</p>
            </div>
          </div>

          {/* Triggered Value */}
          {alert.triggered_value !== undefined && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Triggered Value</label>
              <p className="text-sm text-gray-900">{alert.triggered_value}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Triggered At</label>
              <p className="text-sm text-gray-900">{formatDate(alert.first_triggered_at)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Triggered At</label>
              <p className="text-sm text-gray-900">{formatDate(alert.last_triggered_at)}</p>
            </div>
            {alert.acknowledged_at && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Acknowledged At</label>
                <p className="text-sm text-gray-900">{formatDate(alert.acknowledged_at)}</p>
              </div>
            )}
            {alert.acknowledged_by && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Acknowledged By</label>
                <p className="text-sm text-gray-900">User ID: {alert.acknowledged_by}</p>
              </div>
            )}
            {alert.resolved_at && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resolved At</label>
                <p className="text-sm text-gray-900">{formatDate(alert.resolved_at)}</p>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tenant ID</label>
              <p className="text-sm text-gray-900">{alert.tenant_id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Created At</label>
              <p className="text-sm text-gray-900">{formatDate(alert.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
