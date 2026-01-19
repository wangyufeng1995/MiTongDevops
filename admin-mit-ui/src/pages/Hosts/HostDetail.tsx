/**
 * 主机详情组件
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Server,
  Edit,
  Activity,
  Terminal,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  FolderOpen,
  Key,
  Lock,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Calendar,
  User,
  Globe,
  Shield,
  FileText
} from 'lucide-react'
import { Loading } from '../../components/Loading'
import { hostsService } from '../../services/hosts'
import { formatDateTime } from '../../utils'
import { useAuthStore } from '../../store/auth'
import type { Host, ProbeHistoryItem, ProbeStatus } from '../../types/host'

interface HostDetailState {
  host: Host | null
  loading: boolean
  error: string | null
  probing: boolean
  probeHistory: ProbeHistoryItem[]
  historyLoading: boolean
}

export const HostDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const hostId = parseInt(id || '0')

  const [state, setState] = useState<HostDetailState>({
    host: null,
    loading: true,
    error: null,
    probing: false,
    probeHistory: [],
    historyLoading: false
  })

  // 加载主机详情
  const loadHost = useCallback(async () => {
    if (!hostId) return

    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      const host = await hostsService.getHost(hostId)
      setState(prev => ({ ...prev, host, loading: false }))
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || '加载主机详情失败',
        loading: false
      }))
    }
  }, [hostId])

  // 加载探测历史
  const loadProbeHistory = useCallback(async () => {
    if (!hostId) return

    try {
      setState(prev => ({ ...prev, historyLoading: true }))
      const response = await hostsService.getProbeHistory(hostId, { limit: 10 })
      setState(prev => ({
        ...prev,
        probeHistory: response.history || [],
        historyLoading: false
      }))
    } catch (error: any) {
      console.error('加载探测历史失败:', error.message)
      setState(prev => ({ ...prev, historyLoading: false }))
    }
  }, [hostId])

  // 初始加载
  useEffect(() => {
    loadHost()
    loadProbeHistory()
  }, [loadHost, loadProbeHistory])

  // 执行探测
  const handleProbe = async () => {
    if (!hostId || state.probing) return

    setState(prev => ({ ...prev, probing: true }))

    try {
      const result = await hostsService.probeHost(hostId)
      // 轮询任务状态
      pollProbeStatus(result.task_id)
    } catch (error: any) {
      console.error('探测失败:', error.message)
      setState(prev => ({ ...prev, probing: false }))
    }
  }

  // 轮询探测任务状态
  const pollProbeStatus = async (taskId: string) => {
    const maxAttempts = 30
    let attempts = 0

    const poll = async () => {
      try {
        const status = await hostsService.getProbeTaskStatus(taskId)

        if (status.status === 'success' || status.status === 'failed') {
          // 更新主机状态
          setState(prev => ({
            ...prev,
            host: prev.host ? {
              ...prev.host,
              last_probe_status: status.status,
              last_probe_at: new Date().toISOString(),
              last_probe_message: status.result?.message
            } : null,
            probing: false
          }))
          // 刷新探测历史
          loadProbeHistory()
          return
        }

        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000)
        } else {
          setState(prev => ({ ...prev, probing: false }))
        }
      } catch (error) {
        setState(prev => ({ ...prev, probing: false }))
      }
    }

    poll()
  }

  // 格式化探测状态
  const getProbeStatusDisplay = (status: ProbeStatus | null | undefined) => {
    if (state.probing) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          探测中
        </span>
      )
    }

    if (!status) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
          <Clock className="w-4 h-4 mr-2" />
          未探测
        </span>
      )
    }

    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-4 h-4 mr-2" />
            可达
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircle className="w-4 h-4 mr-2" />
            不可达
          </span>
        )
      case 'pending':
      case 'running':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            探测中
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
            <Clock className="w-4 h-4 mr-2" />
            未知
          </span>
        )
    }
  }

  // 格式化历史记录状态
  const getHistoryStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            成功
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            失败
          </span>
        )
      case 'timeout':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            超时
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
            {status}
          </span>
        )
    }
  }

  if (state.loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loading size="lg" />
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/hostoperate/hosts')}
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            返回列表
          </button>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-sm text-red-600">{state.error}</div>
        </div>
      </div>
    )
  }

  if (!state.host) {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/hostoperate/hosts')}
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            返回列表
          </button>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="text-sm text-yellow-600">主机不存在</div>
        </div>
      </div>
    )
  }

  const { host } = state

  return (
    <div className="space-y-6">
      {/* 页面标题和操作按钮 */}
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/hostoperate/hosts')}
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            返回列表
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
              <Server className="w-6 h-6 mr-2 text-gray-400" />
              {host.name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {host.hostname}:{host.port}
            </p>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center space-x-3">
          {/* 探测按钮 */}
          <button
            onClick={handleProbe}
            disabled={state.probing}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            title="探测连接"
          >
            {state.probing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                探测中...
              </>
            ) : (
              <>
                <Activity className="w-4 h-4 mr-2" />
                探测
              </>
            )}
          </button>

          {/* WebShell 按钮 */}
          <button
            onClick={() => navigate(`/hosts/${host.id}/webshell`)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            title="打开 WebShell"
          >
            <Terminal className="w-4 h-4 mr-2" />
            WebShell
          </button>

          {/* 审计日志按钮 */}
          {hasPermission('host:audit') && (
            <button
              onClick={() => navigate(`/audit/hosts`)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              title="查看审计日志"
            >
              <FileText className="w-4 h-4 mr-2" />
              审计日志
            </button>
          )}

          {/* 命令过滤配置按钮 */}
          {hasPermission('host:audit:config') && (
            <button
              onClick={() => navigate(`/hostoperate/hosts/${host.id}/command-filter`)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              title="命令过滤配置"
            >
              <Shield className="w-4 h-4 mr-2" />
              命令过滤
            </button>
          )}

          {/* 编辑按钮 */}
          {hasPermission('host:update') && (
            <button
              onClick={() => navigate(`/hosts/${host.id}/edit`)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              title="编辑主机"
            >
              <Edit className="w-4 h-4 mr-2" />
              编辑
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：基本信息和系统信息 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 基本信息卡片 */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">基本信息</h2>
            </div>
            <div className="px-6 py-4">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500 flex items-center">
                    <Server className="w-4 h-4 mr-2" />
                    主机名称
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">{host.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 flex items-center">
                    <Globe className="w-4 h-4 mr-2" />
                    主机地址
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">{host.hostname}:{host.port}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    用户名
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">{host.username}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 flex items-center">
                    {host.auth_type === 'password' ? (
                      <Lock className="w-4 h-4 mr-2" />
                    ) : (
                      <Key className="w-4 h-4 mr-2" />
                    )}
                    认证方式
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {host.auth_type === 'password' ? '密码认证' : '密钥认证'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 flex items-center">
                    <FolderOpen className="w-4 h-4 mr-2" />
                    所属分组
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {host.group ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {host.group.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">未分组</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 flex items-center">
                    <Activity className="w-4 h-4 mr-2" />
                    探测状态
                  </dt>
                  <dd className="mt-1">
                    {getProbeStatusDisplay(host.last_probe_status)}
                    {host.last_probe_at && (
                      <div className="text-xs text-gray-500 mt-1">
                        最后探测: {formatDateTime(host.last_probe_at)}
                      </div>
                    )}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">描述</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {host.description || <span className="text-gray-400">无描述</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    创建时间
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDateTime(host.created_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    更新时间
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDateTime(host.updated_at)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* 系统信息卡片 */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">系统信息</h2>
            </div>
            <div className="px-6 py-4">
              {host.host_info ? (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">操作系统</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {host.host_info.os_name || '-'} {host.host_info.os_version || ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">内核版本</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {host.host_info.kernel_version || '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 flex items-center">
                      <Cpu className="w-4 h-4 mr-2" />
                      CPU 核心数
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {host.host_info.cpu_cores ? `${host.host_info.cpu_cores} 核` : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 flex items-center">
                      <MemoryStick className="w-4 h-4 mr-2" />
                      总内存
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {host.host_info.total_memory
                        ? `${(host.host_info.total_memory / 1024 / 1024 / 1024).toFixed(2)} GB`
                        : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 flex items-center">
                      <HardDrive className="w-4 h-4 mr-2" />
                      磁盘总量
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {host.host_info.disk_total
                        ? `${(host.host_info.disk_total / 1024 / 1024 / 1024).toFixed(2)} GB`
                        : '-'}
                    </dd>
                  </div>
                  {host.host_info.updated_at && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">信息更新时间</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {formatDateTime(host.host_info.updated_at)}
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Network className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>暂无系统信息</p>
                  <p className="text-sm mt-1">请先执行探测以获取系统信息</p>
                </div>
              )}
            </div>
          </div>

          {/* 性能指标卡片 */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">性能指标</h2>
            </div>
            <div className="px-6 py-4">
              {host.latest_metrics ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {/* CPU 使用率 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-500 flex items-center">
                        <Cpu className="w-4 h-4 mr-2" />
                        CPU 使用率
                      </span>
                      <span className="text-lg font-semibold text-gray-900">
                        {host.latest_metrics.cpu_usage?.toFixed(1) || 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          (host.latest_metrics.cpu_usage || 0) > 80
                            ? 'bg-red-500'
                            : (host.latest_metrics.cpu_usage || 0) > 60
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(host.latest_metrics.cpu_usage || 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* 内存使用率 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-500 flex items-center">
                        <MemoryStick className="w-4 h-4 mr-2" />
                        内存使用率
                      </span>
                      <span className="text-lg font-semibold text-gray-900">
                        {host.latest_metrics.memory_usage?.toFixed(1) || 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          (host.latest_metrics.memory_usage || 0) > 80
                            ? 'bg-red-500'
                            : (host.latest_metrics.memory_usage || 0) > 60
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(host.latest_metrics.memory_usage || 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* 磁盘使用率 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-500 flex items-center">
                        <HardDrive className="w-4 h-4 mr-2" />
                        磁盘使用率
                      </span>
                      <span className="text-lg font-semibold text-gray-900">
                        {host.latest_metrics.disk_usage?.toFixed(1) || 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          (host.latest_metrics.disk_usage || 0) > 80
                            ? 'bg-red-500'
                            : (host.latest_metrics.disk_usage || 0) > 60
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(host.latest_metrics.disk_usage || 0, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>暂无性能数据</p>
                  <p className="text-sm mt-1">性能数据将在主机连接后自动采集</p>
                </div>
              )}

              {host.latest_metrics?.collected_at && (
                <div className="mt-4 text-xs text-gray-500 text-right">
                  数据采集时间: {formatDateTime(host.latest_metrics.collected_at)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：探测历史 */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">探测历史</h2>
              <button
                onClick={loadProbeHistory}
                disabled={state.historyLoading}
                className="text-gray-400 hover:text-gray-600"
                title="刷新"
              >
                <RefreshCw className={`w-4 h-4 ${state.historyLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="px-6 py-4">
              {state.historyLoading ? (
                <div className="flex justify-center py-8">
                  <Loading size="md" />
                </div>
              ) : state.probeHistory.length > 0 ? (
                <div className="space-y-4">
                  {state.probeHistory.map((item) => (
                    <div
                      key={item.id}
                      className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        {getHistoryStatusBadge(item.status)}
                        <span className="text-xs text-gray-500">
                          {formatDateTime(item.probed_at, 'MM/DD HH:mm:ss')}
                        </span>
                      </div>
                      {item.message && (
                        <p className="text-sm text-gray-600 mb-1">{item.message}</p>
                      )}
                      {item.response_time !== undefined && item.response_time !== null && (
                        <p className="text-xs text-gray-500">
                          响应时间: {item.response_time.toFixed(2)}s
                        </p>
                      )}
                      {item.ansible_output && (
                        <details className="mt-2">
                          <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                            查看详细输出
                          </summary>
                          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-700 overflow-x-auto max-h-32">
                            {item.ansible_output}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>暂无探测记录</p>
                  <p className="text-sm mt-1">点击探测按钮开始检测</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
