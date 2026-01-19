/**
 * 调试面板 - 用于诊断 AI 模型配置加载问题
 */
import React, { useState } from 'react'
import { Bug, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface DebugInfo {
  hasToken: boolean
  hasCookie: boolean
  tokenPreview: string
  cookiePreview: string
  apiResponse?: any
  apiError?: any
}

export const DebugPanel: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [loading, setLoading] = useState(false)

  const runDiagnostics = async () => {
    setLoading(true)
    
    try {
      // 检查 token
      const token = localStorage.getItem('access_token')
      const hasToken = !!token
      const tokenPreview = token ? `${token.substring(0, 20)}...` : '未设置'
      
      // 检查 cookie
      const cookies = document.cookie
      const hasCookie = cookies.includes('session_id')
      const cookiePreview = hasCookie ? '已设置' : '未设置'
      
      // 测试 API 调用
      let apiResponse = null
      let apiError = null
      
      try {
        const response = await fetch('/api/ai-model-config', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        })
        
        const data = await response.json()
        
        if (response.ok) {
          apiResponse = {
            status: response.status,
            statusText: response.statusText,
            data: data
          }
        } else {
          apiError = {
            status: response.status,
            statusText: response.statusText,
            data: data
          }
        }
      } catch (error: any) {
        apiError = {
          message: error.message,
          stack: error.stack
        }
      }
      
      setDebugInfo({
        hasToken,
        hasCookie,
        tokenPreview,
        cookiePreview,
        apiResponse,
        apiError
      })
    } catch (error) {
      console.error('诊断失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const StatusIcon: React.FC<{ status: boolean }> = ({ status }) => {
    return status ? (
      <CheckCircle className="w-5 h-5 text-green-600" />
    ) : (
      <XCircle className="w-5 h-5 text-red-600" />
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Bug className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">诊断工具</h3>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {loading ? '诊断中...' : '运行诊断'}
        </button>
      </div>

      {debugInfo && (
        <div className="space-y-4">
          {/* 认证状态 */}
          <div className="border-t pt-4">
            <h4 className="font-semibold text-gray-900 mb-3">认证状态</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <StatusIcon status={debugInfo.hasToken} />
                  <span className="text-sm font-medium text-gray-700">Access Token</span>
                </div>
                <span className="text-xs text-gray-500 font-mono">{debugInfo.tokenPreview}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <StatusIcon status={debugInfo.hasCookie} />
                  <span className="text-sm font-medium text-gray-700">Session Cookie</span>
                </div>
                <span className="text-xs text-gray-500">{debugInfo.cookiePreview}</span>
              </div>
            </div>
          </div>

          {/* API 响应 */}
          {debugInfo.apiResponse && (
            <div className="border-t pt-4">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>API 响应成功</span>
              </h4>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-semibold text-green-900">状态码:</span>
                    <span className="ml-2 text-green-700">{debugInfo.apiResponse.status}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-green-900">配置数量:</span>
                    <span className="ml-2 text-green-700">
                      {Array.isArray(debugInfo.apiResponse.data?.data) 
                        ? debugInfo.apiResponse.data.data.length 
                        : 0}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-green-900">完整响应:</span>
                    <pre className="mt-2 p-3 bg-white border border-green-200 rounded text-xs overflow-auto max-h-64">
                      {JSON.stringify(debugInfo.apiResponse.data, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* API 错误 */}
          {debugInfo.apiError && (
            <div className="border-t pt-4">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <span>API 请求失败</span>
              </h4>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  {debugInfo.apiError.status && (
                    <div>
                      <span className="font-semibold text-red-900">状态码:</span>
                      <span className="ml-2 text-red-700">{debugInfo.apiError.status}</span>
                    </div>
                  )}
                  {debugInfo.apiError.message && (
                    <div>
                      <span className="font-semibold text-red-900">错误消息:</span>
                      <span className="ml-2 text-red-700">{debugInfo.apiError.message}</span>
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-red-900">详细信息:</span>
                    <pre className="mt-2 p-3 bg-white border border-red-200 rounded text-xs overflow-auto max-h-64">
                      {JSON.stringify(debugInfo.apiError, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 建议 */}
          <div className="border-t pt-4">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              <span>诊断建议</span>
            </h4>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <ul className="space-y-2 text-sm text-blue-900">
                {!debugInfo.hasToken && (
                  <li>❌ 缺少 Access Token - 请重新登录</li>
                )}
                {!debugInfo.hasCookie && (
                  <li>❌ 缺少 Session Cookie - 请重新登录</li>
                )}
                {debugInfo.apiError?.status === 401 && (
                  <li>❌ 认证失败 (401) - Token 可能已过期，请重新登录</li>
                )}
                {debugInfo.apiError?.status === 403 && (
                  <li>❌ 权限不足 (403) - 当前用户没有访问权限</li>
                )}
                {debugInfo.apiResponse && Array.isArray(debugInfo.apiResponse.data?.data) && debugInfo.apiResponse.data.data.length === 0 && (
                  <li>⚠️ 数据库中没有配置数据，或租户隔离导致查询不到数据</li>
                )}
                {debugInfo.hasToken && debugInfo.hasCookie && debugInfo.apiResponse && (
                  <li>✅ 认证正常，API 调用成功</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {!debugInfo && !loading && (
        <div className="text-center py-8 text-gray-500">
          <Bug className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p>点击"运行诊断"按钮开始检查</p>
        </div>
      )}
    </div>
  )
}

export default DebugPanel
