/**
 * Ansible 执行详情页面
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw, XCircle, CheckCircle, Clock, AlertCircle, Server, User, Calendar, FileText, Settings, Play } from 'lucide-react'
import { ansibleService } from '../../services/ansible'
import { PlaybookExecution } from '../../types/ansible'
import { Loading } from '../../components/Loading'
import { ExecutionLogDisplay } from '../../components/Ansible'
import { formatDateTime } from '../../utils'
import { useTheme } from '../../hooks/useTheme'

const ExecutionDetail: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { isDark } = useTheme()
  const [execution, setExecution] = useState<PlaybookExecution | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error' | 'warning'; title: string; message: string }>({ show: false, type: 'success', title: '', message: '' })

  const showToast = (type: 'success' | 'error' | 'warning', title: string, message: string = '') => {
    setToast({ show: true, type, title, message })
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 5000)
  }

  // 加载执行详情
  const loadExecution = useCallback(async () => {
    if (!id) return
    
    try {
      setLoading(true)
      const data = await ansibleService.getExecution(parseInt(id))
      setExecution(data)
    } catch (error) {
      console.error('Failed to load execution:', error)
    } finally {
      setLoading(false)
    }
  }, [id])

  // 刷新执行详情
  const refreshExecution = useCallback(async () => {
    if (!id) return
    
    try {
      setRefreshing(true)
      const data = await ansibleService.getExecution(parseInt(id))
      setExecution(data)
    } catch (error) {
      console.error('Failed to refresh execution:', error)
    } finally {
      setRefreshing(false)
    }
  }, [id])

  // 初始加载
  useEffect(() => {
    loadExecution()
  }, [loadExecution])

  // 自动刷新运行中的任务
  useEffect(() => {
    if (execution?.status === 'running') {
      const interval = setInterval(refreshExecution, 5000) // 每5秒刷新一次
      return () => clearInterval(interval)
    }
  }, [execution?.status, refreshExecution])

  // 停止执行
  const handleStopExecution = useCallback(async () => {
    if (!execution) return
    
    if (!window.confirm(`确定要停止执行 "${execution.playbook?.name}" 吗？`)) {
      return
    }

    try {
      await ansibleService.stopExecution(execution.id)
      await refreshExecution()
      showToast('success', '停止成功', '任务已停止执行')
    } catch (error: any) {
      console.error('Failed to stop execution:', error)
      showToast('error', '停止失败', error.response?.data?.message || '停止执行失败，请重试')
    }
  }, [execution, refreshExecution])

  // 重新执行
  const handleReExecute = useCallback(async () => {
    if (!execution || !execution.playbook) return
    
    if (!window.confirm(`确定要重新执行 Playbook "${execution.playbook.name}" 吗？`)) {
      return
    }

    try {
      const newExecution = await ansibleService.executePlaybook(execution.playbook_id, {
        host_ids: execution.host_ids,
        variables: execution.variables
      })
      
      showToast('success', '执行成功', '已创建新的执行任务')
      // 跳转到新的执行详情页
      setTimeout(() => {
        navigate(`/hostoperate/ansible/playbooks/${execution.playbook_id}/execute?execution_id=${newExecution.id}`)
      }, 1000)
    } catch (error: any) {
      console.error('Failed to re-execute playbook:', error)
      const errorMessage = error.response?.data?.message || error.message || '重新执行失败，请重试'
      showToast('error', '执行失败', errorMessage)
    }
  }, [execution, navigate])

  // 状态图标和颜色
  const getStatusIcon = (status: PlaybookExecution['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={20} className="text-green-500" />
      case 'failed':
        return <XCircle size={20} className="text-red-500" />
      case 'running':
        return <RefreshCw size={20} className="text-blue-500 animate-spin" />
      case 'pending':
        return <Clock size={20} className="text-yellow-500" />
      default:
        return <AlertCircle size={20} className="text-gray-500" />
    }
  }

  const getStatusText = (status: PlaybookExecution['status']) => {
    switch (status) {
      case 'success':
        return '执行成功'
      case 'failed':
        return '执行失败'
      case 'running':
        return '正在执行'
      case 'pending':
        return '等待执行'
      default:
        return '未知状态'
    }
  }

  const getStatusColor = (status: PlaybookExecution['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // 计算执行时长
  const getExecutionDuration = () => {
    if (!execution?.started_at) return null
    
    const startTime = new Date(execution.started_at).getTime()
    const endTime = execution.finished_at ? new Date(execution.finished_at).getTime() : Date.now()
    const duration = Math.floor((endTime - startTime) / 1000)
    
    const hours = Math.floor(duration / 3600)
    const minutes = Math.floor((duration % 3600) / 60)
    const seconds = duration % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  }

  if (loading) {
    return <Loading />
  }

  if (!execution) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={48} className="text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">执行记录不存在</h2>
          <p className="text-gray-500 mb-4">请检查执行记录 ID 是否正确</p>
          <button
            onClick={() => navigate('/ansible/executions')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            返回执行历史
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast 提示 */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-top">
          <div className={`w-96 shadow-2xl rounded-xl overflow-hidden`}>
            <div className={`h-1.5 ${
              toast.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
              toast.type === 'error' ? 'bg-gradient-to-r from-red-500 to-rose-600' :
              'bg-gradient-to-r from-yellow-500 to-amber-600'
            }`} />
            <div className={`p-4 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              <div className="flex items-start">
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                  toast.type === 'success' ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
                  toast.type === 'error' ? 'bg-gradient-to-br from-red-500 to-rose-600' :
                  'bg-gradient-to-br from-yellow-500 to-amber-600'
                }`}>
                  {toast.type === 'success' ? <CheckCircle className="w-6 h-6 text-white" /> :
                   toast.type === 'error' ? <XCircle className="w-6 h-6 text-white" /> :
                   <AlertCircle className="w-6 h-6 text-white" />}
                </div>
                <div className="ml-4 flex-1 pt-0.5">
                  <p className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{toast.title}</p>
                  {toast.message && (
                    <p className={`mt-1 text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{toast.message}</p>
                  )}
                </div>
                <button
                  onClick={() => setToast(prev => ({ ...prev, show: false }))}
                  className={`flex-shrink-0 ml-2 p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
                >
                  <XCircle className={`w-4 h-4 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 页面头部 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/ansible/executions')}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft size={20} className="mr-2" />
                返回执行历史
              </button>
              <div className="h-6 border-l border-gray-300"></div>
              <div className="flex items-center space-x-2">
                <FileText size={20} className="text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900">
                  执行详情 #{execution.id}
                </h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={refreshExecution}
                disabled={refreshing}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <RefreshCw size={16} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                刷新
              </button>
              
              {execution.status === 'running' && (
                <button
                  onClick={handleStopExecution}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <XCircle size={16} className="mr-2" />
                  停止执行
                </button>
              )}
              
              {(execution.status === 'success' || execution.status === 'failed') && (
                <button
                  onClick={handleReExecute}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <Play size={16} className="mr-2" />
                  重新执行
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：执行信息 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 执行状态 */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">执行状态</h3>
              </div>
              <div className="p-6">
                <div className={`inline-flex items-center px-4 py-2 rounded-lg border ${getStatusColor(execution.status)}`}>
                  {getStatusIcon(execution.status)}
                  <span className="ml-2 font-medium">{getStatusText(execution.status)}</span>
                </div>
                
                {execution.error_message && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-start">
                      <AlertCircle size={16} className="text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-medium text-red-800">错误信息</h4>
                        <p className="text-sm text-red-700 mt-1">{execution.error_message}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Playbook 信息 */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Playbook 信息</h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                  <p className="text-sm text-gray-900">{execution.playbook?.name || '未知'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">版本</label>
                  <p className="text-sm text-gray-900">{execution.playbook?.version || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  <p className="text-sm text-gray-900">{execution.playbook?.description || '无描述'}</p>
                </div>
              </div>
            </div>

            {/* 执行信息 */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">执行信息</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center">
                  <User size={16} className="text-gray-400 mr-2" />
                  <div>
                    <label className="block text-sm font-medium text-gray-700">执行者</label>
                    <p className="text-sm text-gray-900">
                      {execution.creator?.full_name || execution.creator?.username || '未知'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <Calendar size={16} className="text-gray-400 mr-2" />
                  <div>
                    <label className="block text-sm font-medium text-gray-700">开始时间</label>
                    <p className="text-sm text-gray-900">
                      {execution.started_at 
                        ? formatDateTime(execution.started_at, 'YYYY/MM/DD HH:mm:ss')
                        : formatDateTime(execution.created_at, 'YYYY/MM/DD HH:mm:ss')
                      }
                    </p>
                  </div>
                </div>
                
                {execution.finished_at && (
                  <div className="flex items-center">
                    <Calendar size={16} className="text-gray-400 mr-2" />
                    <div>
                      <label className="block text-sm font-medium text-gray-700">结束时间</label>
                      <p className="text-sm text-gray-900">
                        {formatDateTime(execution.finished_at, 'YYYY/MM/DD HH:mm:ss')}
                      </p>
                    </div>
                  </div>
                )}
                
                {getExecutionDuration() && (
                  <div className="flex items-center">
                    <Clock size={16} className="text-gray-400 mr-2" />
                    <div>
                      <label className="block text-sm font-medium text-gray-700">执行时长</label>
                      <p className="text-sm text-gray-900">{getExecutionDuration()}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 目标主机 */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">目标主机</h3>
              </div>
              <div className="p-6">
                {execution.hosts && execution.hosts.length > 0 ? (
                  <div className="space-y-2">
                    {execution.hosts.map((host) => (
                      <div key={host.id} className="flex items-center p-2 bg-gray-50 rounded">
                        <Server size={16} className="text-gray-400 mr-2" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{host.name}</p>
                          <p className="text-xs text-gray-500">{host.hostname}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    {execution.host_ids.length} 台主机
                  </div>
                )}
              </div>
            </div>

            {/* 执行变量 */}
            {execution.variables && Object.keys(execution.variables).length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center">
                    <Settings size={16} className="text-gray-400 mr-2" />
                    <h3 className="text-lg font-medium text-gray-900">执行变量</h3>
                  </div>
                </div>
                <div className="p-6">
                  <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded overflow-x-auto">
                    {JSON.stringify(execution.variables, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* 右侧：执行日志 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">执行日志</h3>
              </div>
              <div className="p-6">
                <ExecutionLogDisplay
                  execution={execution}
                  autoRefresh={execution.status === 'running'}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExecutionDetail