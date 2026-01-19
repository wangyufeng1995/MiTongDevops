import { useState } from 'react'
import { api } from '../services/api'

export const CSRFTest: React.FC = () => {
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const testCSRFProtected = async () => {
    setLoading(true)
    try {
      const response = await api.post('/api/test/csrf-test', {
        message: 'Testing CSRF protection'
      })
      setResult(`CSRF 保护测试成功: ${JSON.stringify(response)}`)
    } catch (error: any) {
      setResult(`CSRF 保护测试失败: ${error.response?.data?.message || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const testNonCSRFProtected = async () => {
    setLoading(true)
    try {
      const response = await api.post('/api/test/no-csrf-test', {
        message: 'Testing without CSRF protection'
      })
      setResult(`无 CSRF 保护测试成功: ${JSON.stringify(response)}`)
    } catch (error: any) {
      setResult(`无 CSRF 保护测试失败: ${error.response?.data?.message || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">CSRF 保护测试</h3>
      
      <div className="space-y-4">
        <div className="flex space-x-4">
          <button
            onClick={testCSRFProtected}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? '测试中...' : '测试 CSRF 保护端点'}
          </button>
          
          <button
            onClick={testNonCSRFProtected}
            disabled={loading}
            className="btn btn-secondary"
          >
            {loading ? '测试中...' : '测试无 CSRF 保护端点'}
          </button>
        </div>
        
        {result && (
          <div className="mt-4 p-4 bg-gray-100 rounded-md">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap">{result}</pre>
          </div>
        )}
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>• CSRF 保护端点需要有效的 CSRF token</p>
        <p>• 无 CSRF 保护端点不需要 CSRF token</p>
        <p>• CSRF token 会自动在请求头中发送</p>
      </div>
    </div>
  )
}