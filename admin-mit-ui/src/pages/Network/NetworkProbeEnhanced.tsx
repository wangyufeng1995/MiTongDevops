/**
 * Enhanced Network Probe Page
 * 
 * 增强版网络探测页面，包含以下功能：
 * - 实时状态监控
 * - 批量操作
 * - 高级筛选
 * - 探测结果可视化
 * - 快速测试
 * - 导入导出配置
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Download,
  Upload,
  Filter,
  Play,
  Pause,
  RotateCcw,
  Search,
  Settings,
  TrendingUp,
  Zap,
  Globe,
  Wifi,
  Eye,
  EyeOff,
  MoreHorizontal,
  Plus,
  Trash2,
  Edit,
  Copy,
  BarChart3,
  RefreshCw,
  X,
  AlertTriangle
} from 'lucide-react'
import { networkProbeService, networkProbeGroupService } from '../../services/network'
import { NetworkProbe, UpdateNetworkProbeRequest, NetworkProbeGroup } from '../../types/network'
import { ProbeStatus } from '../../components/Network/ProbeStatus'
import { ProbeAnalysisHeader } from '../../components/Network/ProbeAnalysisHeader'
import { formatDateTime } from '../../utils'
import { useTheme } from '../../hooks/useTheme'

interface ProbeWithStatus extends NetworkProbe {
  lastResult?: {
    status: 'success' | 'failed' | 'timeout' | 'unknown'
    response_time?: number
    status_code?: number
    probed_at: string
    error_message?: string
    is_expired?: boolean
  }
}

interface FilterOptions {
  protocol: string
  status: string
  group_id: string
  enabled: string
  auto_probe: string
}

export const NetworkProbeEnhanced: React.FC = () => {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const [probes, setProbes] = useState<ProbeWithStatus[]>([])
  const [filteredProbes, setFilteredProbes] = useState<ProbeWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProbes, setSelectedProbes] = useState<Set<number>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<FilterOptions>({
    protocol: '',
    status: '',
    group_id: '',
    enabled: '',
    auto_probe: ''
  })
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30)
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // 分析头部状态
  const [timeRange, setTimeRange] = useState('7d')
  const [analysisViewMode, setAnalysisViewMode] = useState('overview')
  
  // 编辑弹窗状态
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingProbe, setEditingProbe] = useState<NetworkProbe | null>(null)
  const [editFormData, setEditFormData] = useState<UpdateNetworkProbeRequest>({})
  const [editLoading, setEditLoading] = useState(false)
  const [groups, setGroups] = useState<NetworkProbeGroup[]>([])
  
  // 删除弹窗状态
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletingProbe, setDeletingProbe] = useState<NetworkProbe | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  
  // 批量操作确认弹窗状态
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false)
  const [batchAction, setBatchAction] = useState<'start' | 'stop' | 'delete' | 'enable' | 'disable' | null>(null)

  // 显示通知
  const showNotification = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }, [])

  // 加载数据
  const loadData = useCallback(async () => {
    if (!mountedRef.current) return
    
    try {
      setLoading(true)
      
      // 加载探测任务（包含 last_result，已经有过期判断）
      const probesResponse = await networkProbeService.getAll()

      if (mountedRef.current) {
        if (probesResponse.success && probesResponse.data) {
          // 直接使用 API 返回的 last_result，它已经包含了过期判断逻辑
          const probesWithStatus = probesResponse.data.map((probe) => ({
            ...probe,
            lastResult: probe.last_result // 使用 API 返回的 last_result，包含过期判断
          }))
          
          setProbes(probesWithStatus)
        }
      }
    } catch (error) {
      console.error('加载数据失败:', error)
      if (mountedRef.current) {
        showNotification('error', '加载数据失败')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [showNotification])

  // 初始加载
  useEffect(() => {
    mountedRef.current = true
    loadData()
    loadGroups()
    
    return () => {
      mountedRef.current = false
    }
  }, [loadData])

  // 加载分组列表
  const loadGroups = async () => {
    try {
      const response = await networkProbeGroupService.getAll()
      if (response.success && response.data) {
        setGroups(response.data)
      }
    } catch (error) {
      console.error('加载分组失败:', error)
    }
  }

  // 打开编辑弹窗
  const openEditModal = (probe: NetworkProbe) => {
    setEditingProbe(probe)
    setEditFormData({
      name: probe.name,
      description: probe.description || '',
      protocol: probe.protocol,
      target_url: probe.target_url,
      method: probe.method || 'GET',
      headers: probe.headers || {},
      body: probe.body || '',
      timeout: probe.timeout,
      interval_seconds: probe.interval_seconds,
      auto_probe_enabled: probe.auto_probe_enabled,
      enabled: probe.enabled,
      group_id: probe.group_id,
    })
    setEditModalOpen(true)
  }

  // 关闭编辑弹窗
  const closeEditModal = () => {
    setEditModalOpen(false)
    setEditingProbe(null)
    setEditFormData({})
  }

  // 提交编辑
  const handleEditSubmit = async () => {
    if (!editingProbe) return
    
    setEditLoading(true)
    try {
      const response = await networkProbeService.update(editingProbe.id, editFormData)
      if (response.success) {
        showNotification('success', '探测任务更新成功')
        closeEditModal()
        loadData()
      } else {
        showNotification('error', response.message || '更新失败')
      }
    } catch (error) {
      console.error('更新探测任务失败:', error)
      showNotification('error', '更新失败')
    } finally {
      setEditLoading(false)
    }
  }

  // 打开删除弹窗
  const openDeleteModal = (probe: NetworkProbe) => {
    setDeletingProbe(probe)
    setDeleteModalOpen(true)
  }

  // 关闭删除弹窗
  const closeDeleteModal = () => {
    setDeleteModalOpen(false)
    setDeletingProbe(null)
  }

  // 确认删除
  const handleDeleteConfirm = async () => {
    if (!deletingProbe) return
    
    setDeleteLoading(true)
    try {
      const response = await networkProbeService.delete(deletingProbe.id)
      if (response.success) {
        showNotification('success', '探测任务已删除')
        closeDeleteModal()
        loadData()
      } else {
        showNotification('error', response.message || '删除失败')
      }
    } catch (error) {
      console.error('删除探测任务失败:', error)
      showNotification('error', '删除失败')
    } finally {
      setDeleteLoading(false)
    }
  }

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      loadData()
    }, refreshInterval * 1000)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, loadData])

  // 筛选和搜索
  useEffect(() => {
    let filtered = probes

    // 搜索筛选
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(probe => 
        probe.name.toLowerCase().includes(term) ||
        probe.target_url.toLowerCase().includes(term) ||
        (probe.description && probe.description.toLowerCase().includes(term))
      )
    }

    // 协议筛选
    if (filters.protocol) {
      filtered = filtered.filter(probe => probe.protocol === filters.protocol)
    }

    // 状态筛选
    if (filters.status) {
      filtered = filtered.filter(probe => {
        if (!probe.lastResult) return filters.status === 'unknown'
        return probe.lastResult.status === filters.status
      })
    }

    // 启用状态筛选
    if (filters.enabled) {
      const enabled = filters.enabled === 'true'
      filtered = filtered.filter(probe => probe.enabled === enabled)
    }

    // 自动探测筛选
    if (filters.auto_probe) {
      const autoProbe = filters.auto_probe === 'true'
      filtered = filtered.filter(probe => probe.auto_probe_enabled === autoProbe)
    }

    setFilteredProbes(filtered)
  }, [probes, searchTerm, filters])

  // 打开批量操作确认弹窗
  const openBatchConfirm = (action: 'start' | 'stop' | 'delete' | 'enable' | 'disable') => {
    if (selectedProbes.size === 0) {
      showNotification('info', '请先选择要操作的探测任务')
      return
    }
    setBatchAction(action)
    setBatchConfirmOpen(true)
  }

  // 关闭批量操作确认弹窗
  const closeBatchConfirm = () => {
    setBatchConfirmOpen(false)
    setBatchAction(null)
  }

  // 执行批量操作
  const executeBatchAction = async () => {
    if (!batchAction) return
    
    closeBatchConfirm()
    setActionLoading(`batch-${batchAction}`)
    const action = batchAction
    
    try {
      const promises = Array.from(selectedProbes).map(async (probeId) => {
        switch (action) {
          case 'start':
            return networkProbeService.start(probeId)
          case 'stop':
            return networkProbeService.stop(probeId)
          case 'delete':
            return networkProbeService.delete(probeId)
          case 'enable':
          case 'disable':
            const probe = probes.find(p => p.id === probeId)
            if (probe) {
              return networkProbeService.update(probeId, { enabled: action === 'enable' })
            }
            return Promise.resolve({ success: false, message: '探测任务不存在' })
          default:
            return Promise.resolve({ success: false, message: '未知操作' })
        }
      })

      const results = await Promise.all(promises)
      const successCount = results.filter(r => r.success).length
      const failedCount = results.length - successCount

      if (successCount > 0) {
        showNotification('success', `成功操作 ${successCount} 个探测任务${failedCount > 0 ? `，失败 ${failedCount} 个` : ''}`)
        setSelectedProbes(new Set())
        loadData()
      } else {
        showNotification('error', '批量操作失败')
      }
    } catch (error) {
      console.error('Batch action failed:', error)
      showNotification('error', '批量操作失败')
    } finally {
      setActionLoading(null)
    }
  }

  // 快速测试
  const handleQuickTest = async (probe: NetworkProbe) => {
    setActionLoading(`test-${probe.id}`)
    
    try {
      const response = await networkProbeService.probe(probe.id)
      if (response.success && response.data) {
        // 直接刷新数据以显示最新结果，不显示提示框
        loadData()
      } else {
        showNotification('error', response.message || '测试失败')
      }
    } catch (error) {
      console.error('Quick test failed:', error)
      showNotification('error', '测试失败')
    } finally {
      setActionLoading(null)
    }
  }

  // 导出配置
  const handleExportConfig = () => {
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      probes: probes.map(probe => ({
        name: probe.name,
        description: probe.description,
        protocol: probe.protocol,
        target_url: probe.target_url,
        method: probe.method,
        headers: probe.headers,
        body: probe.body,
        timeout: probe.timeout,
        interval_seconds: probe.interval_seconds,
        auto_probe_enabled: probe.auto_probe_enabled,
        enabled: probe.enabled
      }))
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `network-probes-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showNotification('success', '配置导出成功')
  }

  // 导入配置
  const handleImportConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string
        const importData = JSON.parse(content)

        if (!importData.probes || !Array.isArray(importData.probes)) {
          throw new Error('无效的配置文件格式')
        }

        setActionLoading('import')
        
        let successCount = 0
        let failedCount = 0

        for (const probeConfig of importData.probes) {
          try {
            const response = await networkProbeService.create(probeConfig as CreateNetworkProbeRequest)
            if (response.success) {
              successCount++
            } else {
              failedCount++
            }
          } catch (error) {
            failedCount++
          }
        }

        showNotification('success', 
          `导入完成 - 成功: ${successCount}, 失败: ${failedCount}`
        )
        
        if (successCount > 0) {
          loadData()
        }
      } catch (error) {
        console.error('Import failed:', error)
        showNotification('error', '导入失败：配置文件格式错误')
      } finally {
        setActionLoading(null)
        // 清空文件输入
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    }

    reader.readAsText(file)
  }

  // 获取状态颜色
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200'
      case 'failed': return 'text-red-600 bg-red-50 border-red-200'
      case 'timeout': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'unknown': return 'text-gray-600 bg-gray-50 border-gray-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  // 获取状态文本
  const getStatusText = (status?: string) => {
    switch (status) {
      case 'success': return '成功'
      case 'failed': return '失败'
      case 'timeout': return '超时'
      case 'unknown': return '未知'
      default: return '未知'
    }
  }

  // 获取协议图标
  const getProtocolIcon = (protocol: string) => {
    switch (protocol) {
      case 'http':
      case 'https':
        return <Globe className="w-4 h-4" />
      case 'websocket':
        return <Wifi className="w-4 h-4" />
      case 'tcp':
      case 'udp':
        return <Activity className="w-4 h-4" />
      default:
        return <Zap className="w-4 h-4" />
    }
  }

  if (loading && probes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">正在加载网络探测数据...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gray-50'}`}>
      {/* 分析头部 */}
      <ProbeAnalysisHeader
        title="网络探测分析"
        subtitle="深度分析网络探测性能和可靠性指标"
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        viewMode={analysisViewMode}
        onViewModeChange={setAnalysisViewMode}
        autoRefresh={autoRefresh}
        onAutoRefreshChange={setAutoRefresh}
        onFilter={() => setShowFilters(!showFilters)}
        onExport={handleExportConfig}
        onRefresh={loadData}
        loading={loading}
      />

      <div className="flex-1 p-6">
        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportConfig}
          className="hidden"
        />

        {/* 通知 */}
        {notification && (
          <div className={`mb-4 px-4 py-3 rounded-lg border ${
            notification.type === 'success' 
              ? isDark ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-green-50 border-green-200 text-green-700'
              : notification.type === 'error' 
                ? isDark ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-700'
                : isDark ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}>
            {notification.message}
          </div>
        )}

        {/* 头部统计 - 从探测列表计算 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className={`rounded-lg shadow p-4 ${isDark ? 'bg-slate-800/60 border border-slate-700/50' : 'bg-white'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>总探测数</p>
                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{probes.length}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className={`rounded-lg shadow p-4 ${isDark ? 'bg-slate-800/60 border border-slate-700/50' : 'bg-white'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>活跃探测</p>
                <p className="text-2xl font-bold text-green-500">
                  {probes.filter(p => p.enabled && p.auto_probe_enabled).length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className={`rounded-lg shadow p-4 ${isDark ? 'bg-slate-800/60 border border-slate-700/50' : 'bg-white'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>成功率</p>
                <p className="text-2xl font-bold text-blue-500">
                  {(() => {
                    const probesWithResult = probes.filter(p => p.lastResult)
                    if (probesWithResult.length === 0) return '0.0'
                    const successCount = probesWithResult.filter(p => p.lastResult?.status === 'success').length
                    return ((successCount / probesWithResult.length) * 100).toFixed(1)
                  })()}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className={`rounded-lg shadow p-4 ${isDark ? 'bg-slate-800/60 border border-slate-700/50' : 'bg-white'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>平均响应</p>
                <p className="text-2xl font-bold text-purple-500">
                  {(() => {
                    const probesWithTime = probes.filter(p => p.lastResult?.response_time)
                    if (probesWithTime.length === 0) return '0'
                    const totalTime = probesWithTime.reduce((sum, p) => sum + (p.lastResult?.response_time || 0), 0)
                    return Math.round(totalTime / probesWithTime.length)
                  })()}ms
                </p>
              </div>
              <Zap className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* 工具栏 */}
        <div className={`rounded-xl p-4 mb-6 ${isDark ? 'bg-slate-800/60 border border-slate-700/50' : 'bg-white shadow-sm border border-gray-100'}`}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* 左侧：搜索和筛选 */}
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  placeholder="搜索探测任务..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-10 pr-4 py-2 w-56 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                    isDark ? 'bg-slate-700/50 border-slate-600 text-gray-200 placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 hover:border-gray-300'
                  }`}
                />
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  showFilters 
                    ? isDark ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400' : 'bg-blue-50 border border-blue-200 text-blue-600'
                    : isDark ? 'bg-slate-700/50 border border-slate-600 text-gray-300 hover:bg-slate-700' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>筛选</span>
              </button>

              <div className={`flex items-center space-x-1 p-1 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${
                    viewMode === 'grid' 
                      ? isDark ? 'bg-blue-500 text-white shadow-lg' : 'bg-white text-blue-600 shadow-sm'
                      : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${
                    viewMode === 'list' 
                      ? isDark ? 'bg-blue-500 text-white shadow-lg' : 'bg-white text-blue-600 shadow-sm'
                      : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 右侧：操作按钮 */}
            <div className="flex items-center space-x-3">
              {/* 自动刷新 */}
              <div className={`flex items-center space-x-2 px-3 py-2 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-9 h-5 rounded-full transition-colors ${autoRefresh ? 'bg-blue-500' : isDark ? 'bg-slate-600' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoRefresh ? 'translate-x-4' : ''}`}></div>
                    </div>
                  </div>
                  <span className={`ml-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>自动刷新</span>
                </label>
                
                {autoRefresh && (
                  <select
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    className={`text-sm border rounded-lg px-2 py-1 ${isDark ? 'bg-slate-600 border-slate-500 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}
                  >
                    <option value={10}>10s</option>
                    <option value={30}>30s</option>
                    <option value={60}>60s</option>
                  </select>
                )}
              </div>

              {/* 批量操作 */}
              {selectedProbes.size > 0 && (
                <div className={`flex items-center space-x-2 pl-3 border-l ${isDark ? 'border-slate-600' : 'border-gray-200'}`}>
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>已选 {selectedProbes.size} 项</span>
                  <button
                    onClick={() => openBatchConfirm('start')}
                    disabled={!!actionLoading}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>启动</span>
                  </button>
                  <button
                    onClick={() => openBatchConfirm('stop')}
                    disabled={!!actionLoading}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>停止</span>
                  </button>
                  <button
                    onClick={() => openBatchConfirm('delete')}
                    disabled={!!actionLoading}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>删除</span>
                  </button>
                </div>
              )}

              {/* 导入导出 */}
              <div className={`flex items-center space-x-2 pl-3 border-l ${isDark ? 'border-slate-600' : 'border-gray-200'}`}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!!actionLoading}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                    isDark ? 'bg-slate-700/50 border border-slate-600 text-gray-300 hover:bg-slate-700' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>导入</span>
                </button>
                <button
                  onClick={handleExportConfig}
                  disabled={!!actionLoading}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                    isDark ? 'bg-slate-700/50 border border-slate-600 text-gray-300 hover:bg-slate-700' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span>导出</span>
                </button>
              </div>

              {/* 刷新按钮 */}
              <button
                onClick={loadData}
                disabled={loading}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                  isDark 
                    ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30' 
                    : 'bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>刷新</span>
              </button>

              {/* 创建按钮 */}
              <button
                onClick={() => navigate('/network/builder')}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg shadow-emerald-500/25"
              >
                <Plus className="w-4 h-4" />
                <span>创建探测</span>
              </button>
            </div>
          </div>

          {/* 筛选面板 */}
          {showFilters && (
            <div className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>协议</label>
                  <select
                    value={filters.protocol}
                    onChange={(e) => setFilters(prev => ({ ...prev, protocol: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}
                  >
                    <option value="">全部协议</option>
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                    <option value="websocket">WebSocket</option>
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>状态</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}
                  >
                    <option value="">全部状态</option>
                    <option value="success">成功</option>
                    <option value="failed">失败</option>
                    <option value="timeout">超时</option>
                    <option value="unknown">未知</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>启用状态</label>
                  <select
                    value={filters.enabled}
                    onChange={(e) => setFilters(prev => ({ ...prev, enabled: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}
                  >
                    <option value="">全部</option>
                    <option value="true">已启用</option>
                    <option value="false">已禁用</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>自动探测</label>
                  <select
                    value={filters.auto_probe}
                    onChange={(e) => setFilters(prev => ({ ...prev, auto_probe: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}
                  >
                    <option value="">全部</option>
                    <option value="true">已启用</option>
                    <option value="false">已禁用</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() => setFilters({
                      protocol: '',
                      status: '',
                      group_id: '',
                      enabled: '',
                      auto_probe: ''
                    })}
                    className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    清除筛选
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 探测任务列表 */}
        <div className={`rounded-xl ${isDark ? 'bg-slate-800/60 border border-slate-700/50' : 'bg-white shadow-sm border border-gray-100'}`}>
          {filteredProbes.length === 0 ? (
            <div className="text-center py-12">
              <Activity className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
              <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                {searchTerm || Object.values(filters).some(f => f) ? '没有找到匹配的探测任务' : '暂无探测任务'}
              </p>
              {!searchTerm && !Object.values(filters).some(f => f) && (
                <button
                onClick={() => navigate('/network/builder')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                创建第一个探测任务
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProbes.map((probe) => (
                <div key={probe.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  {/* 卡片头部 */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedProbes.has(probe.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedProbes)
                          if (e.target.checked) {
                            newSelected.add(probe.id)
                          } else {
                            newSelected.delete(probe.id)
                          }
                          setSelectedProbes(newSelected)
                        }}
                        className="rounded"
                      />
                      <div className="flex items-center space-x-2">
                        {getProtocolIcon(probe.protocol)}
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {probe.protocol.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 探测信息 */}
                  <div className="mb-3">
                    <h3 className="font-medium text-gray-900 mb-1">{probe.name}</h3>
                    <p className="text-sm text-gray-500 truncate">{probe.target_url}</p>
                    {probe.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{probe.description}</p>
                    )}
                  </div>

                  {/* 状态信息 */}
                  <div className="mb-4">
                    {probe.lastResult ? (
                      <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm border ${getStatusColor(probe.lastResult.status)}`}>
                        {probe.lastResult.status === 'success' && <CheckCircle className="w-4 h-4" />}
                        {probe.lastResult.status === 'failed' && <AlertCircle className="w-4 h-4" />}
                        {probe.lastResult.status === 'timeout' && <Clock className="w-4 h-4" />}
                        {probe.lastResult.status === 'unknown' && <AlertTriangle className="w-4 h-4" />}
                        <span>{getStatusText(probe.lastResult.status)}</span>
                        {probe.lastResult.response_time && (
                          <span>• {probe.lastResult.response_time}ms</span>
                        )}
                      </div>
                    ) : (
                      <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm border text-gray-600 bg-gray-50 border-gray-200">
                        <span>未探测</span>
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleQuickTest(probe)}
                        disabled={actionLoading === `test-${probe.id}`}
                        className="flex items-center space-x-1 px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        {actionLoading === `test-${probe.id}` ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Zap className="w-3 h-3" />
                        )}
                        <span>探测</span>
                      </button>

                      {probe.auto_probe_enabled ? (
                        <button
                          onClick={() => networkProbeService.stop(probe.id).then(() => loadData())}
                          className="flex items-center space-x-1 px-2 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                        >
                          <Pause className="w-3 h-3" />
                          <span>停止</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => networkProbeService.start(probe.id).then(() => loadData())}
                          className="flex items-center space-x-1 px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                          <Play className="w-3 h-3" />
                          <span>启动</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => openEditModal(probe)}
                        className="p-1 text-gray-600 hover:text-blue-600"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {/* TODO: 复制探测任务 */}}
                        className="p-1 text-gray-600 hover:text-green-600"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(probe)}
                        className="p-1 text-gray-600 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 实时状态组件 */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <ProbeStatus 
                      probeId={probe.id} 
                      autoConnect={probe.auto_probe_enabled}
                      showConnectionState={false}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* 列表视图 */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedProbes.size === filteredProbes.length && filteredProbes.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProbes(new Set(filteredProbes.map(p => p.id)))
                        } else {
                          setSelectedProbes(new Set())
                        }
                      }}
                      className="rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    探测任务
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    协议
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态码
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    响应时间
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    最后探测
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProbes.map((probe) => (
                  <tr key={probe.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedProbes.has(probe.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedProbes)
                          if (e.target.checked) {
                            newSelected.add(probe.id)
                          } else {
                            newSelected.delete(probe.id)
                          }
                          setSelectedProbes(newSelected)
                        }}
                        className="rounded"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{probe.name}</div>
                        <div className={`text-sm truncate max-w-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{probe.target_url}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getProtocolIcon(probe.protocol)}
                        <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                          {probe.protocol.toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {probe.lastResult ? (
                        <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm border ${getStatusColor(probe.lastResult.status)}`}>
                          {probe.lastResult.status === 'success' && <CheckCircle className="w-4 h-4" />}
                          {probe.lastResult.status === 'failed' && <AlertCircle className="w-4 h-4" />}
                          {probe.lastResult.status === 'timeout' && <Clock className="w-4 h-4" />}
                          {probe.lastResult.status === 'unknown' && <AlertTriangle className="w-4 h-4" />}
                          <span>{getStatusText(probe.lastResult.status)}</span>
                        </div>
                      ) : (
                        <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>未探测</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {probe.lastResult?.status_code ? (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          probe.lastResult.status_code >= 200 && probe.lastResult.status_code < 300 
                            ? isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                            : probe.lastResult.status_code >= 300 && probe.lastResult.status_code < 400
                            ? isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                            : probe.lastResult.status_code >= 400 && probe.lastResult.status_code < 500
                            ? isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                            : isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
                        }`}>
                          {probe.lastResult.status_code}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {probe.lastResult?.response_time ? `${probe.lastResult.response_time}ms` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {probe.lastResult?.probed_at ? formatDateTime(probe.lastResult.probed_at, 'YYYY/MM/DD HH:mm:ss') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleQuickTest(probe)}
                          disabled={actionLoading === `test-${probe.id}`}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 text-sm font-medium rounded-md hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === `test-${probe.id}` ? (
                            <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                          ) : (
                            <Zap className="w-3.5 h-3.5 mr-1" />
                          )}
                          探测
                        </button>
                        <button
                          onClick={() => openEditModal(probe)}
                          className="inline-flex items-center px-3 py-1.5 bg-gray-50 text-gray-600 text-sm font-medium rounded-md hover:bg-gray-100 border border-gray-200 transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5 mr-1" />
                          编辑
                        </button>
                        <button
                          onClick={() => openDeleteModal(probe)}
                          className="inline-flex items-center px-3 py-1.5 bg-red-50 text-red-600 text-sm font-medium rounded-md hover:bg-red-100 border border-red-200 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 加载状态 - 仅在批量操作和导入时显示遮罩 */}
      {actionLoading && (actionLoading.startsWith('batch-') || actionLoading === 'import') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
            <span>处理中...</span>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editModalOpen && editingProbe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Edit className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">编辑探测任务</h3>
                  <p className="text-sm text-gray-500">修改 "{editingProbe.name}" 的配置</p>
                </div>
              </div>
              <button
                onClick={closeEditModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="space-y-5">
                {/* 基本信息 */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center">
                    <Settings className="w-4 h-4 mr-2" />
                    基本信息
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        任务名称 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editFormData.name || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                        placeholder="输入任务名称"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        所属分组
                      </label>
                      <select
                        value={editFormData.group_id || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, group_id: e.target.value ? Number(e.target.value) : undefined }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      >
                        <option value="">未分组</option>
                        {groups.map(group => (
                          <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      描述
                    </label>
                    <textarea
                      value={editFormData.description || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow resize-none"
                      placeholder="输入任务描述"
                    />
                  </div>
                </div>

                {/* 协议配置 */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center">
                    <Globe className="w-4 h-4 mr-2" />
                    协议配置
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        协议类型 <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={editFormData.protocol || 'http'}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, protocol: e.target.value as any }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      >
                        <option value="http">HTTP</option>
                        <option value="https">HTTPS</option>
                        <option value="websocket">WebSocket</option>
                        <option value="tcp">TCP</option>
                        <option value="udp">UDP</option>
                      </select>
                    </div>
                    
                    {(editFormData.protocol === 'http' || editFormData.protocol === 'https') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          请求方法
                        </label>
                        <select
                          value={editFormData.method || 'GET'}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, method: e.target.value as any }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      目标地址 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editFormData.target_url || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, target_url: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      placeholder="https://example.com/api/health"
                    />
                  </div>

                  {/* HTTP/HTTPS 请求头和请求体 */}
                  {(editFormData.protocol === 'http' || editFormData.protocol === 'https') && (
                    <>
                      {/* 请求头 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          请求头 (JSON格式)
                        </label>
                        <textarea
                          value={typeof editFormData.headers === 'object' ? JSON.stringify(editFormData.headers, null, 2) : '{}'}
                          onChange={(e) => {
                            try {
                              const headers = JSON.parse(e.target.value)
                              setEditFormData(prev => ({ ...prev, headers }))
                            } catch {
                              // 允许用户输入不完整的JSON
                            }
                          }}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow font-mono text-sm resize-none"
                          placeholder='{"Content-Type": "application/json"}'
                        />
                        <p className="mt-1 text-xs text-gray-500">示例: {"{"}"Authorization": "Bearer token", "Content-Type": "application/json"{"}"}</p>
                      </div>

                      {/* 请求体 - 仅POST方法显示 */}
                      {editFormData.method === 'POST' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            请求体
                          </label>
                          <textarea
                            value={editFormData.body || ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, body: e.target.value }))}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow font-mono text-sm resize-none"
                            placeholder='{"key": "value"}'
                          />
                          <p className="mt-1 text-xs text-gray-500">支持 JSON、XML 或其他格式的请求体内容</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* 探测设置 */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    探测设置
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        超时时间 (秒)
                      </label>
                      <input
                        type="number"
                        value={editFormData.timeout || 30}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, timeout: Number(e.target.value) }))}
                        min={1}
                        max={300}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        探测间隔 (秒)
                      </label>
                      <input
                        type="number"
                        value={editFormData.interval_seconds || 60}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, interval_seconds: Number(e.target.value) }))}
                        min={10}
                        max={86400}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-6">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editFormData.auto_probe_enabled || false}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, auto_probe_enabled: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">启用自动探测</span>
                    </label>
                    
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editFormData.enabled !== false}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">启用探测任务</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* 弹窗底部 */}
            <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={closeEditModal}
                disabled={editLoading}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={editLoading || !editFormData.name || !editFormData.target_url}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {editLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{editLoading ? '保存中...' : '保存修改'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteModalOpen && deletingProbe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">删除确认</h3>
                  <p className="text-sm text-gray-500">此操作不可撤销</p>
                </div>
              </div>
              <button
                onClick={closeDeleteModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800">
                  您确定要删除探测任务 <span className="font-semibold">"{deletingProbe.name}"</span> 吗？
                </p>
                <p className="text-sm text-red-600 mt-2">
                  删除后，该任务的所有探测记录和配置将被永久删除。
                </p>
              </div>
              
              <div className={`rounded-lg p-3 ${isDark ? 'bg-slate-700' : 'bg-gray-50'}`}>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  <div className="flex justify-between py-1">
                    <span>目标地址:</span>
                    <span className={`truncate max-w-[200px] ${isDark ? 'text-white' : 'text-gray-900'}`}>{deletingProbe.target_url}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>协议:</span>
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>{deletingProbe.protocol.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 弹窗底部 */}
            <div className={`flex items-center justify-end space-x-3 px-6 py-4 border-t ${isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50'}`}>
              <button
                onClick={closeDeleteModal}
                disabled={deleteLoading}
                className={`px-4 py-2 border rounded-lg transition-colors disabled:opacity-50 ${
                  isDark ? 'text-gray-300 bg-slate-700 border-slate-600 hover:bg-slate-600' : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {deleteLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                <Trash2 className="w-4 h-4" />
                <span>{deleteLoading ? '删除中...' : '确认删除'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 批量操作确认弹窗 */}
      {batchConfirmOpen && batchAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all ${
            isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'
          }`}>
            {/* 弹窗头部 */}
            <div className={`px-6 py-5 ${
              batchAction === 'delete' 
                ? isDark ? 'bg-gradient-to-r from-red-500/20 to-orange-500/20' : 'bg-gradient-to-r from-red-50 to-orange-50'
                : batchAction === 'start' || batchAction === 'enable'
                ? isDark ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20' : 'bg-gradient-to-r from-emerald-50 to-teal-50'
                : isDark ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20' : 'bg-gradient-to-r from-amber-50 to-yellow-50'
            }`}>
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  batchAction === 'delete' 
                    ? isDark ? 'bg-red-500/30' : 'bg-red-100'
                    : batchAction === 'start' || batchAction === 'enable'
                    ? isDark ? 'bg-emerald-500/30' : 'bg-emerald-100'
                    : isDark ? 'bg-amber-500/30' : 'bg-amber-100'
                }`}>
                  {batchAction === 'delete' && <Trash2 className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-600'}`} />}
                  {batchAction === 'start' && <Play className={`w-6 h-6 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />}
                  {batchAction === 'stop' && <Pause className={`w-6 h-6 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />}
                  {batchAction === 'enable' && <CheckCircle className={`w-6 h-6 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />}
                  {batchAction === 'disable' && <AlertCircle className={`w-6 h-6 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />}
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {batchAction === 'delete' && '批量删除确认'}
                    {batchAction === 'start' && '批量启动确认'}
                    {batchAction === 'stop' && '批量停止确认'}
                    {batchAction === 'enable' && '批量启用确认'}
                    {batchAction === 'disable' && '批量禁用确认'}
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {batchAction === 'delete' ? '此操作不可撤销' : '请确认您的操作'}
                  </p>
                </div>
              </div>
            </div>

            {/* 弹窗内容 */}
            <div className="px-6 py-5">
              <div className={`rounded-xl p-4 mb-4 ${
                batchAction === 'delete' 
                  ? isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'
                  : batchAction === 'start' || batchAction === 'enable'
                  ? isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'
                  : isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'
              }`}>
                <p className={`text-sm ${
                  batchAction === 'delete' 
                    ? isDark ? 'text-red-300' : 'text-red-800'
                    : batchAction === 'start' || batchAction === 'enable'
                    ? isDark ? 'text-emerald-300' : 'text-emerald-800'
                    : isDark ? 'text-amber-300' : 'text-amber-800'
                }`}>
                  您确定要对 <span className="font-bold">{selectedProbes.size}</span> 个探测任务执行
                  <span className="font-bold">
                    {batchAction === 'delete' && ' "删除" '}
                    {batchAction === 'start' && ' "启动自动探测" '}
                    {batchAction === 'stop' && ' "停止自动探测" '}
                    {batchAction === 'enable' && ' "启用" '}
                    {batchAction === 'disable' && ' "禁用" '}
                  </span>
                  操作吗？
                </p>
                {batchAction === 'delete' && (
                  <p className={`text-sm mt-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                    ⚠️ 删除后，所有相关的探测记录和配置将被永久删除。
                  </p>
                )}
              </div>
              
              {/* 选中的任务数量展示 */}
              <div className={`flex items-center justify-center space-x-2 py-3 rounded-xl ${
                isDark ? 'bg-slate-700/50' : 'bg-gray-50'
              }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isDark ? 'bg-blue-500/20' : 'bg-blue-100'
                }`}>
                  <Activity className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                </div>
                <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  已选择 {selectedProbes.size} 个探测任务
                </span>
              </div>
            </div>

            {/* 弹窗底部 */}
            <div className={`flex items-center justify-end space-x-3 px-6 py-4 border-t ${
              isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-100 bg-gray-50'
            }`}>
              <button
                onClick={closeBatchConfirm}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isDark 
                    ? 'text-gray-300 bg-slate-700 hover:bg-slate-600 border border-slate-600' 
                    : 'text-gray-700 bg-white hover:bg-gray-50 border border-gray-300'
                }`}
              >
                取消
              </button>
              <button
                onClick={executeBatchAction}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all flex items-center space-x-2 shadow-lg ${
                  batchAction === 'delete' 
                    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-red-500/25'
                    : batchAction === 'start' || batchAction === 'enable'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/25'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25'
                }`}
              >
                {batchAction === 'delete' && <Trash2 className="w-4 h-4" />}
                {batchAction === 'start' && <Play className="w-4 h-4" />}
                {batchAction === 'stop' && <Pause className="w-4 h-4" />}
                {batchAction === 'enable' && <CheckCircle className="w-4 h-4" />}
                {batchAction === 'disable' && <AlertCircle className="w-4 h-4" />}
                <span>确认执行</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

export default NetworkProbeEnhanced