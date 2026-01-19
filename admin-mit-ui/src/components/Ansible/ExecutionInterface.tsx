/**
 * Ansible Playbook 执行界面组件
 * 提供 Playbook 执行配置、主机选择、参数配置和执行确认功能
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Play,
  Settings,
  Server,
  AlertCircle,
  CheckCircle,
  X,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Clock,
  User,
  FolderTree
} from 'lucide-react'
import { Loading } from '../Loading'
import { ansibleService } from '../../services/ansible'
import { AnsiblePlaybook, ExecutePlaybookRequest, PlaybookExecution } from '../../types/ansible'
import { Host, HostGroup } from '../../types/host'
import { formatDateTime } from '../../utils'

export interface ExecutionInterfaceProps {
  playbook: AnsiblePlaybook
  availableHosts?: Host[]
  availableHostGroups?: HostGroup[]
  onExecute?: (execution: PlaybookExecution) => void
  onCancel?: () => void
  loading?: boolean
  className?: string
}

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

interface ValidationError {
  field: string
  message: string
}

const ExecutionInterface: React.FC<ExecutionInterfaceProps> = ({
  playbook,
  availableHosts = [],
  availableHostGroups = [],
  onExecute,
  onCancel,
  loading = false,
  className = ''
}) => {
  const [config, setConfig] = useState<ExecutionConfig>({
    selectedHostIds: [],
    variables: playbook.variables || {},
    customVariables: '{}',
    executeInParallel: true,
    maxParallelHosts: 5,
    continueOnError: false,
    verboseLevel: 1,
    dryRun: false,
    checkMode: false
  })

  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [showVariables, setShowVariables] = useState(false)
  const [hostFilter, setHostFilter] = useState('')
  const [selectedHosts, setSelectedHosts] = useState<Host[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [selectionMode, setSelectionMode] = useState<'hosts' | 'group'>('hosts')

  // 初始化选中的主机列表
  useEffect(() => {
    const hosts = availableHosts.filter(host => config.selectedHostIds.includes(host.id))
    setSelectedHosts(hosts)
  }, [config.selectedHostIds, availableHosts])

  // 当选择主机组时，自动选中该组内的所有主机
  useEffect(() => {
    if (selectionMode === 'group' && selectedGroupId) {
      const groupHosts = availableHosts.filter(host => host.group_id === selectedGroupId)
      const groupHostIds = groupHosts.map(h => h.id)
      setConfig(prev => ({ ...prev, selectedHostIds: groupHostIds }))
    }
  }, [selectedGroupId, selectionMode, availableHosts])

  // 处理选择模式切换
  const handleSelectionModeChange = useCallback((mode: 'hosts' | 'group') => {
    setSelectionMode(mode)
    if (mode === 'hosts') {
      setSelectedGroupId(null)
    } else {
      setConfig(prev => ({ ...prev, selectedHostIds: [] }))
    }
  }, [])

  // 处理配置变更
  const handleConfigChange = useCallback((field: keyof ExecutionConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }))
    
    // 清除相关字段的验证错误
    setValidationErrors(prev => prev.filter(error => error.field !== field))
  }, [])

  // 处理主机选择
  const handleHostSelection = useCallback((hostId: number, selected: boolean) => {
    if (selected) {
      handleConfigChange('selectedHostIds', [...config.selectedHostIds, hostId])
    } else {
      handleConfigChange('selectedHostIds', config.selectedHostIds.filter(id => id !== hostId))
    }
  }, [config.selectedHostIds, handleConfigChange])

  // 处理全选/取消全选
  const handleSelectAllHosts = useCallback((selectAll: boolean) => {
    const filteredHosts = availableHosts.filter(host => 
      host.name.toLowerCase().includes(hostFilter.toLowerCase()) ||
      host.hostname.toLowerCase().includes(hostFilter.toLowerCase())
    )
    
    if (selectAll) {
      const allHostIds = [...new Set([...config.selectedHostIds, ...filteredHosts.map(h => h.id)])]
      handleConfigChange('selectedHostIds', allHostIds)
    } else {
      const filteredHostIds = filteredHosts.map(h => h.id)
      handleConfigChange('selectedHostIds', config.selectedHostIds.filter(id => !filteredHostIds.includes(id)))
    }
  }, [availableHosts, hostFilter, config.selectedHostIds, handleConfigChange])

  // 验证执行配置
  const validateConfig = useCallback((): ValidationError[] => {
    const errors: ValidationError[] = []

    // 验证主机选择
    if (config.selectedHostIds.length === 0) {
      errors.push({ field: 'selectedHostIds', message: '请至少选择一个目标主机' })
    }

    // 验证自定义变量
    if (config.customVariables.trim()) {
      try {
        JSON.parse(config.customVariables)
      } catch (error) {
        errors.push({ field: 'customVariables', message: '自定义变量必须是有效的 JSON 格式' })
      }
    }

    // 验证并行主机数量
    if (config.executeInParallel && config.maxParallelHosts < 1) {
      errors.push({ field: 'maxParallelHosts', message: '并行主机数量必须大于 0' })
    }

    // 验证详细级别
    if (config.verboseLevel < 0 || config.verboseLevel > 4) {
      errors.push({ field: 'verboseLevel', message: '详细级别必须在 0-4 之间' })
    }

    return errors
  }, [config])

  // 处理执行确认
  const handleExecuteConfirm = useCallback(() => {
    const errors = validateConfig()
    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }

    setShowConfirmDialog(true)
  }, [validateConfig])

  // 处理执行
  const handleExecute = useCallback(async () => {
    try {
      setIsExecuting(true)
      setShowConfirmDialog(false)

      // 合并变量
      let mergedVariables = { ...config.variables }
      if (config.customVariables.trim()) {
        try {
          const customVars = JSON.parse(config.customVariables)
          mergedVariables = { ...mergedVariables, ...customVars }
        } catch (error) {
          console.error('Failed to parse custom variables:', error)
        }
      }

      // 添加执行选项到变量中
      mergedVariables._execution_options = {
        parallel: config.executeInParallel,
        max_parallel_hosts: config.maxParallelHosts,
        continue_on_error: config.continueOnError,
        verbose_level: config.verboseLevel,
        dry_run: config.dryRun,
        check_mode: config.checkMode
      }

      const executeRequest: ExecutePlaybookRequest = {
        host_ids: config.selectedHostIds,
        variables: mergedVariables
      }

      const execution = await ansibleService.executePlaybook(playbook.id, executeRequest)
      onExecute?.(execution)
    } catch (error) {
      console.error('Failed to execute playbook:', error)
      const errorMessage = error instanceof Error ? error.message : '执行失败'
      setValidationErrors([{ field: 'general', message: errorMessage }])
    } finally {
      setIsExecuting(false)
    }
  }, [config, playbook.id, onExecute])

  // 获取过滤后的主机列表
  const filteredHosts = availableHosts.filter(host => 
    host.name.toLowerCase().includes(hostFilter.toLowerCase()) ||
    host.hostname.toLowerCase().includes(hostFilter.toLowerCase())
  )

  // 获取字段错误信息
  const getFieldError = (field: string) => {
    return validationErrors.find(error => error.field === field)?.message
  }

  // 格式化主机状态
  const getHostStatusBadge = (host: Host) => {
    const isOnline = host.status === 1
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        {isOnline ? '在线' : '离线'}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm ${className}`}>
      {/* 头部 */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Play size={24} className="text-green-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">执行 Playbook</h2>
              <p className="text-sm text-gray-600">{playbook.name}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              版本: {playbook.version}
            </span>
            {playbook.creator && (
              <div className="flex items-center space-x-1 text-sm text-gray-500">
                <User size={14} />
                <span>{playbook.creator.full_name || playbook.creator.username}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {validationErrors.some(error => error.field === 'general') && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <AlertCircle size={16} className="text-red-400 mt-0.5 mr-2 flex-shrink-0" />
            <div className="text-sm text-red-700">
              {getFieldError('general')}
            </div>
          </div>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* 目标主机选择 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Server size={20} className="mr-2 text-blue-500" />
              目标主机选择
            </h3>
            <div className="flex items-center space-x-4">
              {/* 选择模式切换 */}
              <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => handleSelectionModeChange('hosts')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    selectionMode === 'hosts'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Server size={14} className="inline mr-1" />
                  按主机
                </button>
                <button
                  onClick={() => handleSelectionModeChange('group')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    selectionMode === 'group'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <FolderTree size={14} className="inline mr-1" />
                  按主机组
                </button>
              </div>
            </div>
          </div>

          {getFieldError('selectedHostIds') && (
            <div className="mb-3 text-sm text-red-600">{getFieldError('selectedHostIds')}</div>
          )}

          {/* 主机组选择模式 */}
          {selectionMode === 'group' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择主机组
              </label>
              <select
                value={selectedGroupId || ''}
                onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">请选择主机组</option>
                {availableHostGroups.map(group => {
                  const groupHostCount = availableHosts.filter(h => h.group_id === group.id).length
                  return (
                    <option key={group.id} value={group.id}>
                      {group.name} ({groupHostCount} 台主机)
                    </option>
                  )
                })}
              </select>
              {selectedGroupId && (
                <p className="mt-2 text-sm text-gray-500">
                  已选择主机组内 {availableHosts.filter(h => h.group_id === selectedGroupId).length} 台主机
                </p>
              )}
            </div>
          )}

          {/* 主机列表选择模式 */}
          {selectionMode === 'hosts' && (
            <>
              <div className="flex items-center space-x-2 mb-3">
                <input
                  type="text"
                  placeholder="搜索主机..."
                  value={hostFilter}
                  onChange={(e) => setHostFilter(e.target.value)}
                  className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={() => handleSelectAllHosts(true)}
                  className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  全选
                </button>
                <button
                  onClick={() => handleSelectAllHosts(false)}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  取消全选
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                {filteredHosts.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    {hostFilter ? '没有找到匹配的主机' : '暂无可用主机'}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredHosts.map(host => (
                      <div key={host.id} className="p-3 hover:bg-gray-50">
                        <label className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={config.selectedHostIds.includes(host.id)}
                            onChange={(e) => handleHostSelection(host.id, e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{host.name}</p>
                                <p className="text-sm text-gray-500">{host.hostname}:{host.port}</p>
                              </div>
                              <div className="flex items-center space-x-2">
                                {host.group && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                    {host.group.name}
                                  </span>
                                )}
                                {getHostStatusBadge(host)}
                                {host.last_connected_at && (
                                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                                    <Clock size={12} />
                                    <span>
                                      {formatDateTime(host.last_connected_at, 'YYYY/MM/DD HH:mm:ss')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {host.description && (
                              <p className="text-xs text-gray-400 mt-1">{host.description}</p>
                            )}
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {config.selectedHostIds.length > 0 && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                已选择 {config.selectedHostIds.length} 个主机：
                {selectedHosts.map(host => host.name).join(', ')}
              </p>
            </div>
          )}
        </div>

        {/* 执行参数配置 */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Settings size={20} className="mr-2 text-purple-500" />
            执行参数配置
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 基础配置 */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-700">基础配置</h4>
              
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.executeInParallel}
                    onChange={(e) => handleConfigChange('executeInParallel', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">并行执行</span>
                </label>
              </div>

              {config.executeInParallel && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    最大并行主机数
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={config.maxParallelHosts}
                    onChange={(e) => handleConfigChange('maxParallelHosts', Number(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      getFieldError('maxParallelHosts') ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {getFieldError('maxParallelHosts') && (
                    <p className="mt-1 text-sm text-red-600">{getFieldError('maxParallelHosts')}</p>
                  )}
                </div>
              )}

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.continueOnError}
                    onChange={(e) => handleConfigChange('continueOnError', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">遇到错误时继续执行</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  详细级别
                </label>
                <select
                  value={config.verboseLevel}
                  onChange={(e) => handleConfigChange('verboseLevel', Number(e.target.value))}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    getFieldError('verboseLevel') ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value={0}>0 - 静默模式</option>
                  <option value={1}>1 - 正常输出</option>
                  <option value={2}>2 - 详细输出</option>
                  <option value={3}>3 - 更详细输出</option>
                  <option value={4}>4 - 调试输出</option>
                </select>
                {getFieldError('verboseLevel') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('verboseLevel')}</p>
                )}
              </div>
            </div>

            {/* 高级配置 */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-700">高级配置</h4>
              
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.dryRun}
                    onChange={(e) => handleConfigChange('dryRun', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">试运行模式（不执行实际操作）</span>
                </label>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.checkMode}
                    onChange={(e) => handleConfigChange('checkMode', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">检查模式（预测变更）</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 变量配置 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">变量配置</h3>
            <button
              onClick={() => setShowVariables(!showVariables)}
              className="flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              {showVariables ? <EyeOff size={16} className="mr-1" /> : <Eye size={16} className="mr-1" />}
              {showVariables ? '隐藏变量' : '显示变量'}
            </button>
          </div>

          {showVariables && (
            <div className="space-y-4">
              {/* 默认变量 */}
              {Object.keys(config.variables).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">默认变量</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                      {JSON.stringify(config.variables, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* 自定义变量 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  自定义变量 (JSON 格式)
                </label>
                <textarea
                  value={config.customVariables}
                  onChange={(e) => handleConfigChange('customVariables', e.target.value)}
                  rows={6}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm ${
                    getFieldError('customVariables') ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder='{"key": "value"}'
                />
                {getFieldError('customVariables') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('customVariables')}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  自定义变量将覆盖同名的默认变量
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isExecuting}
          >
            <X size={16} className="mr-2" />
            取消
          </button>
          <button
            type="button"
            onClick={handleExecuteConfirm}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isExecuting || config.selectedHostIds.length === 0}
          >
            <Play size={16} className="mr-2" />
            执行 Playbook
          </button>
        </div>
      </div>

      {/* 执行确认对话框 */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">确认执行</h3>
            </div>
            <div className="px-6 py-4">
              <div className="mb-4">
                <p className="text-sm text-gray-700 mb-2">
                  即将在以下主机上执行 Playbook：
                </p>
                <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <ul className="text-sm text-gray-600 space-y-1">
                    {selectedHosts.map(host => (
                      <li key={host.id} className="flex items-center justify-between">
                        <span>{host.name}</span>
                        <span className="text-xs text-gray-500">{host.hostname}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Playbook:</span>
                  <span className="font-medium">{playbook.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>目标主机数:</span>
                  <span className="font-medium">{config.selectedHostIds.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>执行模式:</span>
                  <span className="font-medium">
                    {config.dryRun ? '试运行' : config.checkMode ? '检查模式' : '正常执行'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>并行执行:</span>
                  <span className="font-medium">
                    {config.executeInParallel ? `是 (最多${config.maxParallelHosts}个)` : '否'}
                  </span>
                </div>
              </div>

              {(config.dryRun || config.checkMode) && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start">
                    <AlertCircle size={16} className="text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
                    <div className="text-sm text-yellow-700">
                      {config.dryRun && '试运行模式：不会执行实际操作，仅显示将要执行的任务。'}
                      {config.checkMode && '检查模式：预测变更但不执行实际操作。'}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={isExecuting}
              >
                取消
              </button>
              <button
                onClick={handleExecute}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isExecuting}
              >
                {isExecuting ? (
                  <>
                    <RefreshCw size={16} className="mr-2 animate-spin" />
                    执行中...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} className="mr-2" />
                    确认执行
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExecutionInterface