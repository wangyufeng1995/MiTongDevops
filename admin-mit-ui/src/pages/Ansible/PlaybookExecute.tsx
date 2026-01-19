/**
 * Ansible Playbook 执行页面 - 美化版
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { 
  ArrowLeft, Play, AlertCircle, Server, Settings, Eye, EyeOff, 
  CheckCircle, FolderTree, History
} from 'lucide-react'
import { ansibleService } from '../../services/ansible'
import { hostsService } from '../../services/hosts'
import { hostGroupsService } from '../../services/hostGroups'
import { useTheme } from '../../hooks/useTheme'
import { MonitorPageLayout, MonitorLoadingState } from '../../components/Monitor'
import { FormCard, FormInput, TextInput, TextArea, SelectInput, Checkbox, ActionButton, StatusBadge } from '../../components/Monitor/FormCard'
import type { AnsiblePlaybook } from '../../types/ansible'
import type { Host, HostGroup } from '../../types/host'

interface ExecutionConfig {
  selectedHostIds: number[]
  variables: Record<string, any>
  customVariables: string
  executeInParallel: boolean
  maxParallelHosts: number
  continueOnError: boolean
  verboseLevel: number
  dryRun: boolean
  checkMode: boolean
}

const PlaybookExecute: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { isDark } = useTheme()
  
  const [playbook, setPlaybook] = useState<AnsiblePlaybook | null>(null)
  const [hosts, setHosts] = useState<Host[]>([])
  const [hostGroups, setHostGroups] = useState<HostGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showVariables, setShowVariables] = useState(false)
  const [hostFilter, setHostFilter] = useState('')
  const [selectionMode, setSelectionMode] = useState<'hosts' | 'group'>('hosts')
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [validationErrors, setValidationErrors] = useState<{ field: string; message: string }[]>([])

  const [config, setConfig] = useState<ExecutionConfig>({
    selectedHostIds: [], variables: {}, customVariables: '{}',
    executeInParallel: true, maxParallelHosts: 5, continueOnError: false,
    verboseLevel: 1, dryRun: false, checkMode: false
  })

  useEffect(() => {
    const loadData = async () => {
      if (!id) { setError('无效的 Playbook ID'); setLoading(false); return }
      try {
        setLoading(true)
        const [playbookData, hostsResponse, groupsResponse] = await Promise.all([
          ansibleService.getPlaybook(Number(id)),
          hostsService.getHosts({ per_page: 1000 }),
          hostGroupsService.getGroups({ per_page: 100 })
        ])
        setPlaybook(playbookData)
        setConfig(prev => ({ ...prev, variables: playbookData.variables || {} }))
        setHosts((hostsResponse as any).data?.hosts || (hostsResponse as any).hosts || [])
        setHostGroups((groupsResponse as any).data?.groups || (groupsResponse as any).groups || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载数据失败')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id])

  useEffect(() => {
    if (selectionMode === 'group' && selectedGroupId) {
      const groupHostIds = hosts.filter(h => h.group_id === selectedGroupId).map(h => h.id)
      setConfig(prev => ({ ...prev, selectedHostIds: groupHostIds }))
    }
  }, [selectedGroupId, selectionMode, hosts])

  const handleConfigChange = useCallback((field: keyof ExecutionConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }))
    setValidationErrors(prev => prev.filter(e => e.field !== field))
  }, [])

  const handleHostSelection = useCallback((hostId: number, selected: boolean) => {
    handleConfigChange('selectedHostIds', selected 
      ? [...config.selectedHostIds, hostId]
      : config.selectedHostIds.filter(i => i !== hostId)
    )
  }, [config.selectedHostIds, handleConfigChange])

  const handleSelectAllHosts = useCallback((selectAll: boolean) => {
    const filteredIds = hosts
      .filter(h => h.name.toLowerCase().includes(hostFilter.toLowerCase()) || h.hostname.toLowerCase().includes(hostFilter.toLowerCase()))
      .map(h => h.id)
    handleConfigChange('selectedHostIds', selectAll 
      ? [...new Set([...config.selectedHostIds, ...filteredIds])]
      : config.selectedHostIds.filter(i => !filteredIds.includes(i))
    )
  }, [hosts, hostFilter, config.selectedHostIds, handleConfigChange])

  const validateConfig = useCallback(() => {
    const errors: { field: string; message: string }[] = []
    if (config.selectedHostIds.length === 0) errors.push({ field: 'selectedHostIds', message: '请至少选择一个目标主机' })
    if (config.customVariables.trim()) {
      try { JSON.parse(config.customVariables) }
      catch { errors.push({ field: 'customVariables', message: '自定义变量必须是有效的 JSON 格式' }) }
    }
    return errors
  }, [config])

  const handleExecute = useCallback(async () => {
    if (!playbook) return
    try {
      setIsExecuting(true)
      setShowConfirmDialog(false)
      let mergedVariables = { ...config.variables }
      if (config.customVariables.trim()) {
        try { mergedVariables = { ...mergedVariables, ...JSON.parse(config.customVariables) } }
        catch {}
      }
      mergedVariables._execution_options = {
        parallel: config.executeInParallel, max_parallel_hosts: config.maxParallelHosts,
        continue_on_error: config.continueOnError, verbose_level: config.verboseLevel,
        dry_run: config.dryRun, check_mode: config.checkMode
      }
      const execution = await ansibleService.executePlaybook(playbook.id, {
        host_ids: config.selectedHostIds, variables: mergedVariables
      })
      navigate(`/hostoperate/ansible/playbooks/${playbook.id}/execute?execution_id=${execution.id}`)
    } catch (err) {
      setValidationErrors([{ field: 'general', message: err instanceof Error ? err.message : '执行失败' }])
    } finally {
      setIsExecuting(false)
    }
  }, [config, playbook, navigate])

  const handleExecuteConfirm = useCallback(() => {
    const errors = validateConfig()
    if (errors.length > 0) { setValidationErrors(errors); return }
    setShowConfirmDialog(true)
  }, [validateConfig])

  const filteredHosts = hosts.filter(h => 
    h.name.toLowerCase().includes(hostFilter.toLowerCase()) || 
    h.hostname.toLowerCase().includes(hostFilter.toLowerCase())
  )
  const selectedHosts = hosts.filter(h => config.selectedHostIds.includes(h.id))
  const getFieldError = (field: string) => validationErrors.find(e => e.field === field)?.message

  if (loading) return <MonitorLoadingState message="正在加载 Playbook..." icon={Play} />

  if (error || !playbook) {
    return (
      <MonitorPageLayout title="执行 Playbook" icon={Play} iconGradient="from-emerald-500 to-cyan-500" showRefresh={false} showFullscreen={false}>
        <div className={`p-6 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start space-x-3">
            <AlertCircle className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
            <div>
              <h3 className={`font-medium ${isDark ? 'text-red-300' : 'text-red-800'}`}>{error || 'Playbook 不存在'}</h3>
              <button onClick={() => navigate('/hostoperate/ansible/playbooks')} className={`mt-2 text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                返回 Playbook 列表
              </button>
            </div>
          </div>
        </div>
      </MonitorPageLayout>
    )
  }

  const headerActions = (
    <div className="flex items-center space-x-3">
      <button onClick={() => navigate('/hostoperate/ansible/executions')} className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all ${isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
        <History className="w-4 h-4" /><span>执行历史</span>
      </button>
      <button onClick={() => navigate('/hostoperate/ansible/playbooks')} className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all ${isDark ? 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
        <ArrowLeft className="w-4 h-4" /><span>返回列表</span>
      </button>
    </div>
  )

  return (
    <MonitorPageLayout
      title={`执行: ${playbook.name}`}
      subtitle={`版本 ${playbook.version}`}
      icon={Play}
      iconGradient="from-emerald-500 via-green-500 to-cyan-500"
      headerActions={headerActions}
      showRefresh={false}
      showFullscreen={false}
    >
      {getFieldError('general') && (
        <div className={`mb-6 p-4 rounded-xl border flex items-start space-x-3 ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
          <AlertCircle className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
          <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{getFieldError('general')}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <FormCard title="目标主机选择" icon={Server}>
            <div className="flex items-center space-x-2 mb-4">
              <div className={`flex items-center p-1 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                <button onClick={() => { setSelectionMode('hosts'); setSelectedGroupId(null) }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectionMode === 'hosts' ? (isDark ? 'bg-slate-600 text-white' : 'bg-white text-gray-900 shadow-sm') : (isDark ? 'text-gray-400' : 'text-gray-600')}`}>
                  <Server className="w-4 h-4 inline mr-1.5" />按主机
                </button>
                <button onClick={() => { setSelectionMode('group'); setConfig(prev => ({ ...prev, selectedHostIds: [] })) }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectionMode === 'group' ? (isDark ? 'bg-slate-600 text-white' : 'bg-white text-gray-900 shadow-sm') : (isDark ? 'text-gray-400' : 'text-gray-600')}`}>
                  <FolderTree className="w-4 h-4 inline mr-1.5" />按主机组
                </button>
              </div>
            </div>

            {getFieldError('selectedHostIds') && (
              <div className={`mb-4 p-3 rounded-xl text-sm ${isDark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-600'}`}>
                {getFieldError('selectedHostIds')}
              </div>
            )}

            {selectionMode === 'group' && (
              <div className="mb-4">
                <SelectInput
                  value={selectedGroupId || ''}
                  onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
                  options={[{ value: '', label: '请选择主机组' }, ...hostGroups.map(g => ({ value: g.id, label: `${g.name} (${hosts.filter(h => h.group_id === g.id).length} 台)` }))]}
                />
              </div>
            )}

            {selectionMode === 'hosts' && (
              <>
                <div className="flex items-center space-x-2 mb-4">
                  <TextInput placeholder="搜索主机..." value={hostFilter} onChange={(e) => setHostFilter(e.target.value)} className="flex-1" />
                  <button onClick={() => handleSelectAllHosts(true)} className={`px-3 py-2 text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>全选</button>
                  <button onClick={() => handleSelectAllHosts(false)} className={`px-3 py-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>取消</button>
                </div>
                <div className={`border rounded-xl max-h-64 overflow-y-auto ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                  {filteredHosts.length === 0 ? (
                    <div className={`p-6 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{hostFilter ? '没有找到匹配的主机' : '暂无可用主机'}</div>
                  ) : (
                    <div className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-gray-100'}`}>
                      {filteredHosts.map(host => (
                        <label key={host.id} className={`flex items-center p-3 cursor-pointer transition-colors ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'}`}>
                          <input type="checkbox" checked={config.selectedHostIds.includes(host.id)} onChange={(e) => handleHostSelection(host.id, e.target.checked)} className={`w-4 h-4 rounded ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`} />
                          <div className="ml-3 flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{host.name}</span>
                              <StatusBadge status={host.status === 1 ? 'success' : 'error'}>{host.status === 1 ? '在线' : '离线'}</StatusBadge>
                            </div>
                            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{host.hostname}:{host.port}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {config.selectedHostIds.length > 0 && (
              <div className={`mt-4 p-3 rounded-xl ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'}`}>
                <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>已选择 {config.selectedHostIds.length} 个主机</p>
              </div>
            )}
          </FormCard>
        </div>

        <div className="space-y-6">
          <FormCard title="执行参数" icon={Settings}>
            <div className="space-y-4">
              <Checkbox label="并行执行" checked={config.executeInParallel} onChange={(v) => handleConfigChange('executeInParallel', v)} description="同时在多台主机上执行" />
              {config.executeInParallel && (
                <FormInput label="最大并行数">
                  <TextInput type="number" min={1} max={50} value={config.maxParallelHosts} onChange={(e) => handleConfigChange('maxParallelHosts', Number(e.target.value))} />
                </FormInput>
              )}
              <Checkbox label="遇错继续" checked={config.continueOnError} onChange={(v) => handleConfigChange('continueOnError', v)} description="某主机失败时继续执行" />
              <FormInput label="详细级别">
                <SelectInput value={config.verboseLevel} onChange={(e) => handleConfigChange('verboseLevel', Number(e.target.value))} options={[{ value: 0, label: '0 - 静默' }, { value: 1, label: '1 - 正常' }, { value: 2, label: '2 - 详细' }, { value: 3, label: '3 - 更详细' }, { value: 4, label: '4 - 调试' }]} />
              </FormInput>
              <div className={`pt-4 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                <Checkbox label="试运行模式" checked={config.dryRun} onChange={(v) => handleConfigChange('dryRun', v)} description="不执行实际操作" />
                <div className="mt-3"><Checkbox label="检查模式" checked={config.checkMode} onChange={(v) => handleConfigChange('checkMode', v)} description="预测变更但不执行" /></div>
              </div>
            </div>
          </FormCard>

          <FormCard title="变量配置" icon={Eye} headerActions={<button onClick={() => setShowVariables(!showVariables)} className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{showVariables ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>}>
            {showVariables ? (
              <div className="space-y-4">
                {Object.keys(config.variables).length > 0 && (
                  <div>
                    <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>默认变量</label>
                    <pre className={`p-3 rounded-xl text-xs overflow-auto ${isDark ? 'bg-slate-900 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>{JSON.stringify(config.variables, null, 2)}</pre>
                  </div>
                )}
                <FormInput label="自定义变量" error={getFieldError('customVariables')} hint="将覆盖同名默认变量">
                  <TextArea value={config.customVariables} onChange={(e) => handleConfigChange('customVariables', e.target.value)} placeholder='{"key": "value"}' rows={4} className="font-mono text-sm" error={!!getFieldError('customVariables')} />
                </FormInput>
              </div>
            ) : (
              <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>点击眼睛图标查看变量</p>
            )}
          </FormCard>
        </div>
      </div>

      <div className={`mt-6 p-4 rounded-xl flex items-center justify-end space-x-3 ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-gray-50 border border-gray-100'}`}>
        <ActionButton variant="secondary" onClick={() => navigate('/hostoperate/ansible/playbooks')}>取消</ActionButton>
        <ActionButton variant="success" onClick={handleExecuteConfirm} loading={isExecuting} disabled={config.selectedHostIds.length === 0}>
          <Play className="w-4 h-4" />执行 Playbook
        </ActionButton>
      </div>

      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`rounded-2xl shadow-2xl max-w-md w-full mx-4 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className={`px-6 py-4 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>确认执行</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className={`p-3 rounded-xl max-h-32 overflow-y-auto ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                <p className={`text-sm mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>目标主机：</p>
                <ul className={`text-sm space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {selectedHosts.map(h => <li key={h.id}>{h.name} ({h.hostname})</li>)}
                </ul>
              </div>
              <div className={`space-y-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                <div className="flex justify-between"><span>Playbook:</span><span className="font-medium">{playbook.name}</span></div>
                <div className="flex justify-between"><span>主机数:</span><span className="font-medium">{config.selectedHostIds.length}</span></div>
                <div className="flex justify-between"><span>执行模式:</span><span className="font-medium">{config.dryRun ? '试运行' : config.checkMode ? '检查模式' : '正常执行'}</span></div>
              </div>
            </div>
            <div className={`px-6 py-4 border-t flex justify-end space-x-3 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
              <ActionButton variant="secondary" onClick={() => setShowConfirmDialog(false)}>取消</ActionButton>
              <ActionButton variant="success" onClick={handleExecute} loading={isExecuting}><CheckCircle className="w-4 h-4" />确认执行</ActionButton>
            </div>
          </div>
        </div>
      )}
    </MonitorPageLayout>
  )
}

export default PlaybookExecute
