/**
 * Ansible Playbook 执行工作流页面 - 美化版
 * 支持执行配置、实时日志显示和结果展示
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Play, CheckCircle, XCircle, Clock, AlertCircle,
  Server, RefreshCw, Terminal, ChevronDown, ChevronRight, StopCircle,
  FileText, Zap, Activity, Users
} from 'lucide-react'
import { ansibleService } from '../../services/ansible'
import { hostsService } from '../../services/hosts'
import { hostGroupsService } from '../../services/hostGroups'
import { Loading } from '../../components/Loading'
import { useTheme } from '../../hooks/useTheme'
import { formatDateTime } from '../../utils'
import { ConfirmDialog, useConfirmDialog } from '../../components/Monitor'
import type { AnsiblePlaybook, PlaybookExecution } from '../../types/ansible'
import type { Host, HostGroup } from '../../types/host'

type WorkflowStep = 'config' | 'executing' | 'completed'

interface HostExecutionStatus {
  hostId: number
  hostName: string
  hostname: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  output?: string
  error?: string
  startedAt?: string
  finishedAt?: string
}

const ExecutionWorkflow: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const executionIdFromUrl = searchParams.get('execution_id')
  const { isDark } = useTheme()
  
  const [playbook, setPlaybook] = useState<AnsiblePlaybook | null>(null)
  const [hosts, setHosts] = useState<Host[]>([])
  const [hostGroups, setHostGroups] = useState<HostGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 工作流状态
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('config')
  const [execution, setExecution] = useState<PlaybookExecution | null>(null)
  const [hostStatuses, setHostStatuses] = useState<HostExecutionStatus[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [expandedHosts, setExpandedHosts] = useState<Set<number>>(new Set())
  
  // 执行配置
  const [selectedHostIds, setSelectedHostIds] = useState<number[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [selectionMode, setSelectionMode] = useState<'hosts' | 'group'>('hosts')
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const sseCloseRef = useRef<(() => void) | null>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const confirmDialog = useConfirmDialog()
  const [stopping, setStopping] = useState(false)

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      if (!id) {
        setError('无效的 Playbook ID')
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        const [playbookData, hostsResponse, groupsResponse] = await Promise.all([
          ansibleService.getPlaybook(Number(id)),
          hostsService.getHosts({ per_page: 1000 }),
          hostGroupsService.getGroups({ per_page: 100 })
        ])
        setPlaybook(playbookData)
        const hostsList = (hostsResponse as any).data?.hosts || (hostsResponse as any).hosts || []
        setHosts(hostsList)
        setHostGroups((groupsResponse as any).data?.groups || (groupsResponse as any).groups || [])
        
        if (executionIdFromUrl) {
          const executionData = await ansibleService.getExecution(Number(executionIdFromUrl))
          setExecution(executionData)
          if (executionData.host_ids) setSelectedHostIds(executionData.host_ids)
          if (executionData.output) setLogs(executionData.output.split('\n').filter(Boolean))
          
          if (['success', 'failed', 'cancelled'].includes(executionData.status)) {
            setCurrentStep('completed')
            const statuses: HostExecutionStatus[] = (executionData.host_ids || []).map((hostId: number) => {
              const host = hostsList.find((h: Host) => h.id === hostId)
              return {
                hostId, hostName: host?.name || '未知主机', hostname: host?.hostname || '',
                status: executionData.status === 'success' ? 'success' : executionData.status === 'failed' ? 'failed' : 'pending',
                output: executionData.output, error: executionData.error_message,
                startedAt: executionData.started_at, finishedAt: executionData.finished_at
              }
            })
            setHostStatuses(statuses)
          } else if (executionData.status === 'running') {
            setCurrentStep('executing')
            // 启动轮询
            pollingRef.current = setInterval(async () => {
              try {
                const data = await ansibleService.getExecution(executionData.id)
                setExecution(data)
                if (data.output) setLogs(data.output.split('\n').filter(Boolean))
                if (['success', 'failed', 'cancelled'].includes(data.status)) {
                  setCurrentStep('completed')
                  if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
                }
              } catch (err) { console.error('Failed to poll:', err) }
            }, 2000)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载数据失败')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id, executionIdFromUrl])

  useEffect(() => { return () => { 
    if (pollingRef.current) clearInterval(pollingRef.current)
    if (sseCloseRef.current) sseCloseRef.current()
  } }, [])

  const updateHostStatuses = useCallback((executionData: PlaybookExecution) => {
    setHostStatuses(prev => {
      return selectedHostIds.map(hostId => {
        const host = hosts.find(h => h.id === hostId)
        return {
          hostId, hostName: host?.name || '未知主机', hostname: host?.hostname || '',
          status: executionData.status === 'success' ? 'success' : executionData.status === 'failed' ? 'failed' : 'pending',
          output: executionData.output, error: executionData.error_message,
          startedAt: executionData.started_at, finishedAt: executionData.finished_at
        }
      })
    })
  }, [selectedHostIds, hosts])

  const pollExecutionStatus = useCallback(async (executionId: number) => {
    try {
      const data = await ansibleService.getExecution(executionId)
      setExecution(data)
      if (data.output) setLogs(data.output.split('\n').filter(Boolean))
      if (['success', 'failed', 'cancelled'].includes(data.status)) {
        setCurrentStep('completed')
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
        if (sseCloseRef.current) { sseCloseRef.current(); sseCloseRef.current = null }
        updateHostStatuses(data)
      }
    } catch (err) { console.error('Failed to poll execution status:', err) }
  }, [updateHostStatuses])

  const handleStopExecution = useCallback(() => {
    if (!execution) return
    confirmDialog.show({
      title: '停止执行', variant: 'warning', confirmText: '停止执行',
      message: (<div className="space-y-2"><p>确定要停止当前执行吗？</p><p className={`text-xs ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>⚠️ 任务将被中断，已执行的操作不会回滚</p></div>),
      onConfirm: async () => {
        setStopping(true)
        try {
          await ansibleService.stopExecution(execution.id)
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
          if (sseCloseRef.current) { sseCloseRef.current(); sseCloseRef.current = null }
          pollExecutionStatus(execution.id)
        } catch (err) { console.error('停止执行失败:', err) } finally { setStopping(false) }
      }
    })
  }, [execution, isDark, confirmDialog, pollExecutionStatus])

  const handleStartExecution = async () => {
    if (selectedHostIds.length === 0) { alert('请选择至少一个目标主机'); return }
    try {
      setCurrentStep('executing')
      setLogs(['正在启动执行...'])
      const initialStatuses: HostExecutionStatus[] = selectedHostIds.map(hostId => {
        const host = hosts.find(h => h.id === hostId)
        return { hostId, hostName: host?.name || '未知主机', hostname: host?.hostname || '', status: 'pending' }
      })
      setHostStatuses(initialStatuses)
      const result = await ansibleService.executePlaybook(Number(id), { host_ids: selectedHostIds, variables: playbook?.variables || {} })
      setExecution(result)
      setLogs(prev => [...prev, `执行已启动，执行ID: ${result.id}`])
      
      // 使用轮询获取实时日志
      pollingRef.current = setInterval(() => pollExecutionStatus(result.id), 2000)
    } catch (err) { setError(err instanceof Error ? err.message : '执行失败'); setCurrentStep('config') }
  }

  useEffect(() => {
    if (selectionMode === 'group' && selectedGroupId) {
      const groupHosts = hosts.filter(h => h.group_id === selectedGroupId)
      setSelectedHostIds(groupHosts.map(h => h.id))
    }
  }, [selectedGroupId, selectionMode, hosts])

  useEffect(() => { if (logContainerRef.current) logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight }, [logs])

  const toggleHostExpand = (hostId: number) => {
    setExpandedHosts(prev => { const newSet = new Set(prev); newSet.has(hostId) ? newSet.delete(hostId) : newSet.add(hostId); return newSet })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-500" />
      case 'failed': return <XCircle className="w-5 h-5 text-red-500" />
      case 'running': return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
      case 'pending': return <Clock className="w-5 h-5 text-gray-400" />
      default: return <AlertCircle className="w-5 h-5 text-yellow-500" />
    }
  }

  const getStatusText = (status: string) => ({ success: '成功', failed: '失败', running: '运行中', pending: '等待中', cancelled: '已取消', skipped: '已跳过' }[status] || status)
  const getStatusColor = (status: string) => ({ success: 'emerald', failed: 'red', running: 'blue', pending: 'gray', cancelled: 'amber' }[status] || 'gray')

  if (loading) return (<div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}><Loading /></div>)

  if (error || !playbook) return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className={`p-6 rounded-2xl ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <h3 className={`font-medium ${isDark ? 'text-red-300' : 'text-red-800'}`}>加载失败</h3>
              <p className={`text-sm mt-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error || 'Playbook 不存在'}</p>
            </div>
          </div>
          <button onClick={() => navigate('/hostoperate/ansible/playbooks')} className="mt-4 text-sm text-red-600 hover:text-red-800">返回 Playbook 列表</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      {/* 顶部导航栏 */}
      <div className={`flex-shrink-0 border-b ${isDark ? 'bg-slate-800/80 border-slate-700/50 backdrop-blur-xl' : 'bg-white/80 border-gray-200 backdrop-blur-xl'}`}>
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate('/hostoperate/ansible/playbooks')} className={`flex items-center space-x-2 px-3 py-2 rounded-xl transition-all ${isDark ? 'text-gray-400 hover:text-white hover:bg-slate-700/50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}>
                <ArrowLeft className="w-4 h-4" /><span className="text-sm font-medium">返回</span>
              </button>
              <div className={`h-8 w-px ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`} />
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/25`}>
                  <Play className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>执行 Playbook</h1>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{playbook.name} · v{playbook.version}</p>
                </div>
              </div>
            </div>
            
            {/* 步骤指示器 */}
            <div className="flex items-center space-x-2">
              {[{ key: 'config', label: '配置', icon: FileText }, { key: 'executing', label: '执行中', icon: Zap }, { key: 'completed', label: '完成', icon: CheckCircle }].map((step, index) => {
                const Icon = step.icon
                const isActive = currentStep === step.key
                const isPast = ['config', 'executing', 'completed'].indexOf(currentStep) > index
                return (
                  <React.Fragment key={step.key}>
                    <div className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all ${isActive ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25' : isPast ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600') : (isDark ? 'bg-slate-700/50 text-gray-400' : 'bg-gray-100 text-gray-500')}`}>
                      <Icon className="w-4 h-4" /><span className="text-sm font-medium">{step.label}</span>
                    </div>
                    {index < 2 && <div className={`w-8 h-0.5 ${isPast ? 'bg-emerald-500' : isDark ? 'bg-slate-700' : 'bg-gray-200'}`} />}
                  </React.Fragment>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 - 填充满屏幕 */}
      <div className="flex-1 p-6 overflow-hidden">
        {/* 步骤1: 配置 */}
        {currentStep === 'config' && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* 左侧: 主机选择 - 占3列 */}
            <div className={`lg:col-span-3 flex flex-col rounded-2xl overflow-hidden ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-200'} shadow-xl ${isDark ? 'shadow-black/20' : 'shadow-gray-200/50'}`}>
              <div className={`flex-shrink-0 px-6 py-4 border-b ${isDark ? 'border-slate-700/50 bg-slate-800/30' : 'border-gray-100 bg-gray-50/50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                      <Server className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                    </div>
                    <div>
                      <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>选择目标主机</h3>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>选择要执行 Playbook 的主机</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                    已选 {selectedHostIds.length} 台
                  </div>
                </div>
              </div>
              
              <div className="flex-shrink-0 px-6 py-4">
                <div className="flex items-center space-x-3">
                  <div className="flex rounded-xl overflow-hidden border ${isDark ? 'border-slate-600' : 'border-gray-200'}">
                    <button onClick={() => { setSelectionMode('hosts'); setSelectedGroupId(null) }} className={`px-4 py-2 text-sm font-medium transition-all ${selectionMode === 'hosts' ? 'bg-blue-500 text-white' : isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      <Users className="w-4 h-4 inline mr-2" />按主机
                    </button>
                    <button onClick={() => setSelectionMode('group')} className={`px-4 py-2 text-sm font-medium transition-all ${selectionMode === 'group' ? 'bg-blue-500 text-white' : isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      <Server className="w-4 h-4 inline mr-2" />按主机组
                    </button>
                  </div>
                  {selectionMode === 'group' && (
                    <select value={selectedGroupId || ''} onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)} className={`flex-1 px-4 py-2 rounded-xl border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                      <option value="">选择主机组</option>
                      {hostGroups.map(group => (<option key={group.id} value={group.id}>{group.name} ({hosts.filter(h => h.group_id === group.id).length} 台)</option>))}
                    </select>
                  )}
                  {selectionMode === 'hosts' && (
                    <div className="flex space-x-2">
                      <button onClick={() => setSelectedHostIds(hosts.map(h => h.id))} className={`px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>全选</button>
                      <button onClick={() => setSelectedHostIds([])} className={`px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>清空</button>
                    </div>
                  )}
                </div>
              </div>

              <div className={`flex-1 overflow-y-auto px-6 pb-6`}>
                <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-700/50' : 'border-gray-200'}`}>
                  {hosts.length === 0 ? (
                    <div className={`p-8 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>暂无可用主机</div>
                  ) : (
                    <div className="divide-y divide-slate-700/30">
                      {hosts.map(host => (
                        <label key={host.id} className={`flex items-center p-4 cursor-pointer transition-all ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'} ${selectedHostIds.includes(host.id) ? (isDark ? 'bg-blue-500/10 border-l-4 border-l-blue-500' : 'bg-blue-50 border-l-4 border-l-blue-500') : ''}`}>
                          <input type="checkbox" checked={selectedHostIds.includes(host.id)} onChange={(e) => { e.target.checked ? setSelectedHostIds([...selectedHostIds, host.id]) : setSelectedHostIds(selectedHostIds.filter(i => i !== host.id)) }} disabled={selectionMode === 'group'} className="w-5 h-5 text-blue-500 rounded-lg" />
                          <div className="ml-4 flex-1">
                            <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{host.name}</div>
                            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{host.hostname}:{host.port || 22}</div>
                          </div>
                          <span className={`px-3 py-1 rounded-lg text-xs font-medium ${host.status === 1 ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700') : (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700')}`}>
                            {host.status === 1 ? '在线' : '离线'}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 右侧: Playbook 信息 - 占2列 */}
            <div className={`lg:col-span-2 flex flex-col rounded-2xl overflow-hidden ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-200'} shadow-xl ${isDark ? 'shadow-black/20' : 'shadow-gray-200/50'}`}>
              <div className={`flex-shrink-0 px-6 py-4 border-b ${isDark ? 'border-slate-700/50 bg-slate-800/30' : 'border-gray-100 bg-gray-50/50'}`}>
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                    <FileText className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Playbook 信息</h3>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>即将执行的脚本详情</p>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-700/30' : 'bg-gray-50'}`}>
                  <label className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>名称</label>
                  <p className={`mt-1 text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{playbook.name}</p>
                </div>
                <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-700/30' : 'bg-gray-50'}`}>
                  <label className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>描述</label>
                  <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{playbook.description || '无描述'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-700/30' : 'bg-gray-50'}`}>
                    <label className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>版本</label>
                    <p className={`mt-1 font-mono text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>v{playbook.version}</p>
                  </div>
                  <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-700/30' : 'bg-gray-50'}`}>
                    <label className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>执行次数</label>
                    <p className={`mt-1 text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{playbook.execution_count || 0}</p>
                  </div>
                </div>
                {(playbook as any).tags && (playbook as any).tags.length > 0 && (
                  <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-700/30' : 'bg-gray-50'}`}>
                    <label className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>标签</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(playbook as any).tags.map((tag: string, i: number) => (<span key={i} className={`px-2 py-1 rounded-lg text-xs ${isDark ? 'bg-slate-600 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>{tag}</span>))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className={`flex-shrink-0 p-6 border-t ${isDark ? 'border-slate-700/50' : 'border-gray-100'}`}>
                <button onClick={handleStartExecution} disabled={selectedHostIds.length === 0} className="w-full flex items-center justify-center px-6 py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40">
                  <Play className="w-5 h-5 mr-2" />开始执行 ({selectedHostIds.length} 台主机)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 步骤2&3: 执行中/完成 */}
        {(currentStep === 'executing' || currentStep === 'completed') && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" style={{ height: 'calc(100vh - 280px)', maxHeight: '700px' }}>
            {/* 左侧: 执行状态概览 */}
            <div className={`lg:col-span-1 flex flex-col space-y-6 overflow-hidden`}>
              {/* 状态卡片 */}
              <div className={`flex-shrink-0 rounded-2xl overflow-hidden ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-200'} shadow-xl`}>
                <div className={`p-6 ${execution?.status === 'success' ? 'bg-gradient-to-br from-emerald-500/20 to-cyan-500/20' : execution?.status === 'failed' ? 'bg-gradient-to-br from-red-500/20 to-rose-500/20' : 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>执行状态</p>
                      <p className={`text-2xl font-bold mt-1 ${execution?.status === 'success' ? 'text-emerald-500' : execution?.status === 'failed' ? 'text-red-500' : 'text-blue-500'}`}>
                        {getStatusText(execution?.status || 'pending')}
                      </p>
                    </div>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${execution?.status === 'success' ? 'bg-emerald-500/20' : execution?.status === 'failed' ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
                      {execution?.status === 'running' ? <Activity className="w-7 h-7 text-blue-500 animate-pulse" /> : getStatusIcon(execution?.status || 'pending')}
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>执行 ID</span>
                    <span className={`font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>{execution?.id || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>目标主机</span>
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedHostIds.length} 台</span>
                  </div>
                  {execution?.started_at && (
                    <div className="flex justify-between text-sm">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>开始时间</span>
                      <span className={isDark ? 'text-white' : 'text-gray-900'}>{formatDateTime(execution.started_at, 'HH:mm:ss')}</span>
                    </div>
                  )}
                  {execution?.finished_at && (
                    <div className="flex justify-between text-sm">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>结束时间</span>
                      <span className={isDark ? 'text-white' : 'text-gray-900'}>{formatDateTime(execution.finished_at, 'HH:mm:ss')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 主机状态列表 - 可滚动 */}
              <div className={`flex-1 flex flex-col rounded-2xl overflow-hidden ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-200'} shadow-xl min-h-0`}>
                <div className={`flex-shrink-0 px-4 py-3 border-b ${isDark ? 'border-slate-700/50' : 'border-gray-100'}`}>
                  <h3 className={`font-semibold flex items-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    <Server className="w-4 h-4 mr-2 text-blue-500" />主机状态
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {hostStatuses.map(hostStatus => (
                    <div key={hostStatus.hostId} className={`border-b last:border-b-0 ${isDark ? 'border-slate-700/30' : 'border-gray-100'}`}>
                      <div className={`flex items-center p-3 cursor-pointer transition-colors ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'}`} onClick={() => toggleHostExpand(hostStatus.hostId)}>
                        <div className="flex-shrink-0">{getStatusIcon(hostStatus.status)}</div>
                        <div className="ml-3 flex-1 min-w-0">
                          <div className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{hostStatus.hostName}</div>
                          <div className={`text-xs truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{hostStatus.hostname}</div>
                        </div>
                        {expandedHosts.has(hostStatus.hostId) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </div>
                      {expandedHosts.has(hostStatus.hostId) && hostStatus.error && (
                        <div className={`mx-3 mb-3 p-2 rounded-lg text-xs ${isDark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-700'}`}>{hostStatus.error}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>            {/* 右侧: 执行日志 - 占3列，固定高度 */}
            <div className={`lg:col-span-3 flex flex-col rounded-2xl overflow-hidden ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-200'} shadow-xl`} style={{ height: 'calc(100vh - 280px)', maxHeight: '700px' }}>
              <div className={`flex-shrink-0 px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-slate-700/50 bg-slate-800/30' : 'border-gray-100 bg-gray-50/50'}`}>
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                    <Terminal className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>执行日志</h3>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>实时输出 · {logs.length} 行</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {currentStep === 'executing' && execution && (
                    <button onClick={handleStopExecution} disabled={stopping} className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-lg shadow-red-500/25 ${stopping ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <StopCircle className={`w-4 h-4 ${stopping ? 'animate-spin' : ''}`} /><span>{stopping ? '停止中...' : '停止执行'}</span>
                    </button>
                  )}
                  {currentStep === 'completed' && (
                    <div className="flex items-center space-x-2">
                      <button onClick={() => { setCurrentStep('config'); setExecution(null); setLogs([]); setHostStatuses([]) }} className={`px-4 py-2 rounded-xl text-sm font-medium ${isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>重新执行</button>
                      <button onClick={() => navigate('/hostoperate/ansible/playbooks')} className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-500 text-white hover:bg-blue-600">返回列表</button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 日志内容 - 固定高度可滚动 */}
              <div ref={logContainerRef} className={`flex-1 overflow-y-auto p-4 font-mono text-sm ${isDark ? 'bg-slate-900/50' : 'bg-gray-900'}`}>
                {logs.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />等待日志输出...
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {logs.map((log, index) => (
                      <div key={index} className="flex">
                        <span className="flex-shrink-0 w-14 text-gray-600 select-none">[{String(index + 1).padStart(4, '0')}]</span>
                        <span className={`flex-1 break-all ${
                          log.includes('TASK') ? 'text-cyan-400 font-semibold' :
                          log.includes('ok:') || log.includes('ok=') ? 'text-emerald-400' :
                          log.includes('changed:') || log.includes('changed=') ? 'text-yellow-400' :
                          log.includes('failed:') || log.includes('fatal:') || log.includes('ERROR') ? 'text-red-400 font-semibold' :
                          log.includes('PLAY') ? 'text-purple-400 font-semibold' :
                          log.includes('skipping:') ? 'text-gray-500' :
                          'text-gray-300'
                        }`}>{log}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog {...confirmDialog.dialogProps} />
    </div>
  )
}

export default ExecutionWorkflow
