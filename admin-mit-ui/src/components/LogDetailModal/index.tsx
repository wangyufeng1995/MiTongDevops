/**
 * 日志详情弹窗组件
 */
import React from 'react'
import { X } from 'lucide-react'
import { OperationLog } from '../../types/log'
import { formatDateTime } from '../../utils'

interface LogDetailModalProps {
  log: OperationLog
  onClose: () => void
}

export const LogDetailModal: React.FC<LogDetailModalProps> = ({ log, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" data-testid="log-detail-modal">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">操作日志详情</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                data-testid="close-button"
              >
                <span className="sr-only">关闭</span>
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">操作时间</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {formatDateTime(log.created_at, 'YYYY/MM/DD HH:mm:ss')}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">用户信息</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {log.user_full_name || log.username} ({log.username})
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">租户</label>
                  <p className="mt-1 text-sm text-gray-900">{log.tenant_name}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">操作类型</label>
                  <p className="mt-1 text-sm text-gray-900">{log.action}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">资源</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {log.resource} {log.resource_id && `(ID: ${log.resource_id})`}
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">HTTP方法</label>
                  <p className="mt-1 text-sm text-gray-900">{log.method}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">请求路径</label>
                  <p className="mt-1 text-sm text-gray-900 break-all">{log.path}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">状态码</label>
                  <p className="mt-1 text-sm text-gray-900">{log.status_code}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">响应时间</label>
                  <p className="mt-1 text-sm text-gray-900">{log.duration}ms</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">IP地址</label>
                  <p className="mt-1 text-sm text-gray-900">{log.ip_address}</p>
                </div>
              </div>
            </div>

            {/* 请求数据 */}
            {log.request_data && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">请求数据</label>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto max-h-40">
                  {JSON.stringify(log.request_data, null, 2)}
                </pre>
              </div>
            )}

            {/* 响应数据 */}
            {log.response_data && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">响应数据</label>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto max-h-40">
                  {JSON.stringify(log.response_data, null, 2)}
                </pre>
              </div>
            )}

            {/* User Agent */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700">User Agent</label>
              <p className="mt-1 text-xs text-gray-600 break-all">{log.user_agent}</p>
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors sm:ml-3 sm:w-auto sm:text-sm"
              data-testid="close-footer-button"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LogDetailModal