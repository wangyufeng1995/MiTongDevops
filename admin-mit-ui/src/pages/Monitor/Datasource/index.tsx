/**
 * 云监控数据源页面
 * 
 * 左侧：数据源配置列表
 * 右侧：PromQL 查询编辑器和结果展示
 * 
 * Requirements: 1.1, 9.1
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Database,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Save
} from 'lucide-react'
import { Modal } from '../../../components/Modal'
import { Loading } from '../../../components/Loading'
import { ConfigList } from './ConfigList'
import { ConfigForm } from './ConfigForm'
import { QueryEditor } from './QueryEditor'
import { QueryResult } from './QueryResult'
import { SavedQueries } from './SavedQueries'
import { QueryTemplates } from './QueryTemplates'
import { useTheme } from '../../../hooks/useTheme'
import { 
  datasourceService, 
  DatasourceConfig,
  PromQLQueryResult
} from '../../../services/datasource'

// Toast 通知组件
const Toast: React.FC<{
  message: string
  type: 'success' | 'error' | 'info'
  onClose: () => void
}> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  const config = {
    success: {
      bg: 'from-green-500 to-emerald-600',
      icon: '✓',
      border: 'border-green-400'
    },
    error: {
      bg: 'from-red-500 to-rose-600',
      icon: '✕',
      border: 'border-red-400'
    },
    info: {
      bg: 'from-blue-500 to-indigo-600',
      icon: 'ℹ',
      border: 'border-blue-400'
    }
  }[type]

  return (
    <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-5 fade-in duration-300">
      <div className={`bg-gradient-to-r ${config.bg} text-white px-5 py-3 rounded-xl shadow-2xl border-2 ${config.border} backdrop-blur-sm flex items-center space-x-3 min-w-[300px]`}>
        <span className="text-xl font-bold">{config.icon}</span>
        <span className="font-medium">{message}</span>
      </div>
    </div>
  )
}

export const DatasourcePage: React.FC = () => {
  const { isDark } = useTheme()
  // 配置列表状态
  const [configs, setConfigs] = useState<DatasourceConfig[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(true)
  const [selectedConfig, setSelectedConfig] = useState<DatasourceConfig | null>(null)
  
  // 侧边栏折叠状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  // 弹窗状态
  const [showConfigForm, setShowConfigForm] = useState(false)
  const [editingConfig, setEditingConfig] = useState<DatasourceConfig | null>(null)
  const [showSavedQueries, setShowSavedQueries] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  
  // 查询状态
  const [queryResult, setQueryResult] = useState<PromQLQueryResult | null>(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [currentQuery, setCurrentQuery] = useState('')
  
  // Toast 状态
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // 显示 Toast
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type })
  }, [])

  // 加载配置列表
  const loadConfigs = useCallback(async () => {
    try {
      setLoadingConfigs(true)
      const response = await datasourceService.getConfigs({ per_page: 100 })
      
      // 确保 configs 是数组
      const configs = response?.configs || []
      setConfigs(configs)
      
      // 自动选择默认配置或第一个配置
      if (configs.length > 0) {
        const defaultConfig = configs.find(c => c.is_default) || configs[0]
        if (!selectedConfig) {
          setSelectedConfig(defaultConfig)
        }
      }
    } catch (error: any) {
      console.error('Load configs error:', error)
      showToast(error.message || '加载配置列表失败', 'error')
      setConfigs([])
    } finally {
      setLoadingConfigs(false)
    }
  }, [selectedConfig, showToast])

  useEffect(() => {
    loadConfigs()
  }, [])

  // 选择配置
  const handleSelectConfig = (config: DatasourceConfig) => {
    setSelectedConfig(config)
    setQueryResult(null)
  }

  // 新建配置
  const handleCreateConfig = () => {
    setEditingConfig(null)
    setShowConfigForm(true)
  }

  // 编辑配置
  const handleEditConfig = (config: DatasourceConfig) => {
    setEditingConfig(config)
    setShowConfigForm(true)
  }

  // 删除配置
  const handleDeleteConfig = async (config: DatasourceConfig) => {
    if (!window.confirm(`确定要删除数据源 "${config.name}" 吗？`)) {
      return
    }
    
    try {
      await datasourceService.deleteConfig(config.id)
      showToast('删除成功', 'success')
      
      // 如果删除的是当前选中的配置，清除选中状态
      if (selectedConfig?.id === config.id) {
        setSelectedConfig(null)
        setQueryResult(null)
      }
      
      loadConfigs()
    } catch (error: any) {
      showToast(error.message || '删除失败', 'error')
    }
  }

  // 测试连接
  const handleTestConnection = async (config: DatasourceConfig) => {
    try {
      const result = await datasourceService.testConnection(config.id)
      if (result.connected) {
        showToast(`连接成功！响应时间: ${result.response_time_ms}ms`, 'success')
      } else {
        showToast(`连接失败: ${result.error}`, 'error')
      }
    } catch (error: any) {
      showToast(error.message || '测试连接失败', 'error')
    }
  }

  // 设置默认配置
  const handleSetDefault = async (config: DatasourceConfig) => {
    try {
      await datasourceService.setDefault(config.id)
      showToast('设置默认成功', 'success')
      loadConfigs()
    } catch (error: any) {
      showToast(error.message || '设置默认失败', 'error')
    }
  }

  // 保存配置（新建或更新）
  const handleSaveConfig = async (data: any) => {
    try {
      if (editingConfig) {
        await datasourceService.updateConfig(editingConfig.id, data)
        showToast('更新成功', 'success')
      } else {
        await datasourceService.createConfig(data)
        showToast('创建成功', 'success')
      }
      setShowConfigForm(false)
      loadConfigs()
    } catch (error: any) {
      showToast(error.message || '保存失败', 'error')
    }
  }

  // 执行查询
  const handleExecuteQuery = async (query: string, queryType: 'instant' | 'range', options?: {
    time?: string
    start?: string
    end?: string
    step?: string
  }) => {
    if (!selectedConfig) {
      showToast('请先选择数据源', 'error')
      return
    }
    
    if (!query.trim()) {
      showToast('请输入查询语句', 'error')
      return
    }
    
    setCurrentQuery(query)
    setQueryLoading(true)
    
    try {
      let result: PromQLQueryResult
      
      if (queryType === 'instant') {
        result = await datasourceService.executeInstantQuery({
          config_id: selectedConfig.id,
          query,
          time: options?.time
        })
      } else {
        result = await datasourceService.executeRangeQuery({
          config_id: selectedConfig.id,
          query,
          start: options?.start || new Date(Date.now() - 3600000).toISOString(),
          end: options?.end || new Date().toISOString(),
          step: options?.step || '15s'
        })
      }
      
      console.log('Query result:', result)
      console.log('Result status:', result?.status)
      console.log('Result data:', result?.data)
      
      setQueryResult(result)
      
      if (result.status === 'error') {
        showToast(result.error || '查询失败', 'error')
      } else if (result.status === 'success') {
        const resultCount = result.data?.result?.length || 0
        console.log('Result count:', resultCount)
        if (resultCount > 0) {
          showToast(`查询成功，返回 ${resultCount} 条结果`, 'success')
        }
      }
    } catch (error: any) {
      console.error('Query error:', error)
      showToast(error.message || '查询执行失败', 'error')
      setQueryResult(null)
    } finally {
      setQueryLoading(false)
    }
  }

  // 加载保存的查询
  const handleLoadSavedQuery = (query: string) => {
    setCurrentQuery(query)
    setShowSavedQueries(false)
  }

  // 加载模板查询
  const handleLoadTemplate = (query: string) => {
    setCurrentQuery(query)
    setShowTemplates(false)
  }

  // 保存当前查询
  const handleSaveCurrentQuery = async (name: string, description?: string) => {
    if (!selectedConfig) {
      showToast('请先选择数据源', 'error')
      return
    }
    
    if (!currentQuery.trim()) {
      showToast('请先输入查询语句', 'error')
      return
    }
    
    try {
      await datasourceService.saveQuery({
        config_id: selectedConfig.id,
        name,
        query: currentQuery,
        description
      })
      showToast('保存成功', 'success')
    } catch (error: any) {
      showToast(error.message || '保存失败', 'error')
    }
  }

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20'}`}>
      {/* Toast 通知 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* 页面头部 - 现代化设计 */}
      <div className={`${isDark ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur-xl border-b ${isDark ? 'border-slate-700/50' : 'border-gray-200/50'} shadow-sm`}>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl blur-lg opacity-20 animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl shadow-lg">
                  <Database className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent'}`}>
                  云监控数据源
                </h1>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-0.5 flex items-center space-x-2`}>
                  <span>配置和查询 Prometheus/VictoriaMetrics 数据源</span>
                  {selectedConfig && (
                    <>
                      <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>•</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        已连接: {selectedConfig.name}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowTemplates(true)}
                className={`group flex items-center space-x-2 px-4 py-2.5 ${isDark ? 'text-gray-300 hover:text-indigo-400 bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-indigo-500' : 'text-gray-700 hover:text-indigo-600 bg-white hover:bg-indigo-50 border-gray-200 hover:border-indigo-200'} border rounded-xl transition-all duration-200 shadow-sm hover:shadow-md`}
              >
                <BookOpen className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="font-medium">查询模板</span>
              </button>
              <button
                onClick={() => setShowSavedQueries(true)}
                className={`group flex items-center space-x-2 px-4 py-2.5 ${isDark ? 'text-gray-300 hover:text-blue-400 bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-blue-500' : 'text-gray-700 hover:text-blue-600 bg-white hover:bg-blue-50 border-gray-200 hover:border-blue-200'} border rounded-xl transition-all duration-200 shadow-sm hover:shadow-md`}
              >
                <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="font-medium">已保存</span>
              </button>
              <button
                onClick={loadConfigs}
                disabled={loadingConfigs}
                className={`group flex items-center space-x-2 px-4 py-2.5 ${isDark ? 'text-gray-300 hover:text-white bg-slate-700 hover:bg-slate-600 border-slate-600' : 'text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 border-gray-200'} border rounded-xl transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50`}
              >
                <RefreshCw className={`w-4 h-4 group-hover:scale-110 transition-transform ${loadingConfigs ? 'animate-spin' : ''}`} />
                <span className="font-medium">刷新</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* 左侧配置列表 - 现代卡片设计 */}
        <div 
          className={`${isDark ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur-xl rounded-2xl border ${isDark ? 'border-slate-700/50' : 'border-gray-200/50'} shadow-xl flex flex-col transition-all duration-300 ${
            sidebarCollapsed ? 'w-16' : 'w-80'
          }`}
        >
          {/* 侧边栏头部 */}
          <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-slate-700/50' : 'border-gray-200/50'}`}>
            {!sidebarCollapsed && (
              <>
                <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-800'} flex items-center space-x-2`}>
                  <span>数据源配置</span>
                  <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-blue-600 bg-blue-100 rounded-full">
                    {configs.length}
                  </span>
                </span>
                <button
                  onClick={handleCreateConfig}
                  className="group p-2 text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                  title="新建配置"
                >
                  <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
                </button>
              </>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`p-2 ${isDark ? 'text-gray-400 hover:text-white hover:bg-slate-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'} rounded-lg transition-all duration-200`}
              title={sidebarCollapsed ? '展开' : '收起'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* 配置列表 */}
          {!sidebarCollapsed && (
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {loadingConfigs ? (
                <div className="flex items-center justify-center h-32">
                  <Loading size="md" text="加载中..." />
                </div>
              ) : (
                <ConfigList
                  configs={configs}
                  selectedConfig={selectedConfig}
                  onSelect={handleSelectConfig}
                  onEdit={handleEditConfig}
                  onDelete={handleDeleteConfig}
                  onTest={handleTestConnection}
                  onSetDefault={handleSetDefault}
                />
              )}
            </div>
          )}
        </div>

        {/* 右侧查询区域 - 现代卡片设计 */}
        <div className={`flex-1 flex flex-col overflow-hidden ${isDark ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur-xl rounded-2xl border ${isDark ? 'border-slate-700/50' : 'border-gray-200/50'} shadow-xl`}>
          {selectedConfig ? (
            <>
              {/* 查询编辑器 */}
              <div className={`border-b ${isDark ? 'border-slate-700/50' : 'border-gray-200/50'}`}>
                <QueryEditor
                  configId={selectedConfig.id}
                  initialQuery={currentQuery}
                  onExecute={handleExecuteQuery}
                  onSave={handleSaveCurrentQuery}
                  loading={queryLoading}
                />
              </div>

              {/* 查询结果 */}
              <div className="flex-1 overflow-hidden">
                <QueryResult
                  result={queryResult}
                  loading={queryLoading}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                  <div className={`relative ${isDark ? 'bg-gradient-to-br from-blue-900 to-indigo-900' : 'bg-gradient-to-br from-blue-100 to-indigo-100'} p-6 rounded-full`}>
                    <Database className={`w-16 h-16 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                  </div>
                </div>
                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
                  {configs.length === 0 ? '暂无数据源配置' : '请选择数据源'}
                </h3>
                <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'} mb-6 leading-relaxed`}>
                  {configs.length === 0 
                    ? '创建您的第一个数据源配置，开始监控数据查询之旅'
                    : '从左侧列表选择一个数据源，开始执行 PromQL 查询'
                  }
                </p>
                {configs.length === 0 && (
                  <button
                    onClick={handleCreateConfig}
                    className="group inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
                    <span className="font-semibold">新建数据源</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 配置表单弹窗 */}
      <Modal
        isOpen={showConfigForm}
        onClose={() => setShowConfigForm(false)}
        title={editingConfig ? '编辑数据源' : '新建数据源'}
        size="lg"
      >
        <ConfigForm
          config={editingConfig}
          onSave={handleSaveConfig}
          onCancel={() => setShowConfigForm(false)}
        />
      </Modal>

      {/* 已保存查询弹窗 */}
      <Modal
        isOpen={showSavedQueries}
        onClose={() => setShowSavedQueries(false)}
        title="已保存的查询"
        size="lg"
      >
        <SavedQueries
          configId={selectedConfig?.id}
          onLoad={handleLoadSavedQuery}
          onClose={() => setShowSavedQueries(false)}
        />
      </Modal>

      {/* 查询模板弹窗 */}
      <Modal
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        title="查询模板"
        size="lg"
      >
        <QueryTemplates
          onLoad={handleLoadTemplate}
          onClose={() => setShowTemplates(false)}
        />
      </Modal>
    </div>
  )
}

export default DatasourcePage
