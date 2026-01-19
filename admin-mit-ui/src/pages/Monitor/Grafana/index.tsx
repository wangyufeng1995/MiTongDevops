/**
 * Grafana 仪表盘页面
 * 
 * 左侧：Grafana 配置和仪表盘列表
 * 右侧：iframe 嵌入展示 Grafana 仪表盘
 * 
 * Requirements: 5.1, 9.2
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { Modal } from '../../../components/Modal'
import { Loading } from '../../../components/Loading'
import { ConfigList } from './ConfigList'
import { ConfigForm } from './ConfigForm'
import { DashboardList } from './DashboardList'
import { DashboardForm } from './DashboardForm'
import { DashboardViewer } from './DashboardViewer'
import { useTheme } from '../../../hooks/useTheme'
import {
  grafanaService,
  GrafanaConfig,
  GrafanaDashboard,
  CreateGrafanaConfigRequest,
  CreateDashboardRequest
} from '../../../services/grafana'

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

export const GrafanaPage: React.FC = () => {
  const { isDark } = useTheme()
  // 配置列表状态
  const [configs, setConfigs] = useState<GrafanaConfig[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(true)
  const [selectedConfig, setSelectedConfig] = useState<GrafanaConfig | null>(null)
  const [selectedDashboard, setSelectedDashboard] = useState<GrafanaDashboard | null>(null)
  
  // 侧边栏折叠状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  // 弹窗状态
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showDashboardModal, setShowDashboardModal] = useState(false)
  const [editingConfig, setEditingConfig] = useState<GrafanaConfig | null>(null)
  const [editingDashboard, setEditingDashboard] = useState<GrafanaDashboard | null>(null)
  
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
      const response = await grafanaService.getConfigs({ per_page: 100 })
      setConfigs(response.configs || [])
      
      // 自动选择第一个启用的配置
      if (response.configs && response.configs.length > 0) {
        const enabledConfig = response.configs.find(c => c.status === 1) || response.configs[0]
        if (!selectedConfig) {
          setSelectedConfig(enabledConfig)
          // 选择默认仪表盘或第一个仪表盘
          const defaultDashboard = grafanaService.getDefaultDashboard(enabledConfig)
          if (defaultDashboard) {
            setSelectedDashboard(defaultDashboard)
          } else if (enabledConfig.dashboards && enabledConfig.dashboards.length > 0) {
            setSelectedDashboard(enabledConfig.dashboards[0])
          }
        } else {
          // 更新当前选中的配置（可能有仪表盘变化）
          const updatedConfig = response.configs.find(c => c.id === selectedConfig.id)
          if (updatedConfig) {
            setSelectedConfig(updatedConfig)
            // 如果当前选中的仪表盘不存在了，重新选择
            if (selectedDashboard) {
              const dashboardStillExists = updatedConfig.dashboards?.find(d => d.id === selectedDashboard.id)
              if (!dashboardStillExists) {
                const defaultDashboard = grafanaService.getDefaultDashboard(updatedConfig)
                setSelectedDashboard(defaultDashboard || updatedConfig.dashboards?.[0] || null)
              }
            }
          }
        }
      }
    } catch (error: any) {
      showToast(error.message || '加载配置列表失败', 'error')
    } finally {
      setLoadingConfigs(false)
    }
  }, [selectedConfig, selectedDashboard, showToast])

  useEffect(() => {
    loadConfigs()
  }, [])

  // 选择配置
  const handleSelectConfig = (config: GrafanaConfig) => {
    setSelectedConfig(config)
    // 选择默认仪表盘或第一个仪表盘
    const defaultDashboard = grafanaService.getDefaultDashboard(config)
    if (defaultDashboard) {
      setSelectedDashboard(defaultDashboard)
    } else if (config.dashboards && config.dashboards.length > 0) {
      setSelectedDashboard(config.dashboards[0])
    } else {
      setSelectedDashboard(null)
    }
  }

  // 选择仪表盘
  const handleSelectDashboard = (dashboard: GrafanaDashboard) => {
    setSelectedDashboard(dashboard)
  }

  // 新建配置
  const handleCreateConfig = () => {
    setEditingConfig(null)
    setShowConfigModal(true)
  }

  // 编辑配置
  const handleEditConfig = (config: GrafanaConfig) => {
    setEditingConfig(config)
    setShowConfigModal(true)
  }

  // 删除配置
  const handleDeleteConfig = async (config: GrafanaConfig) => {
    if (!window.confirm(`确定要删除 Grafana 配置 "${config.name}" 吗？\n这将同时删除该配置下的所有仪表盘。`)) {
      return
    }
    
    try {
      await grafanaService.deleteConfig(config.id)
      showToast('删除成功', 'success')
      
      // 如果删除的是当前选中的配置，清除选中状态
      if (selectedConfig?.id === config.id) {
        setSelectedConfig(null)
        setSelectedDashboard(null)
      }
      
      loadConfigs()
    } catch (error: any) {
      showToast(error.message || '删除失败', 'error')
    }
  }

  // 保存配置（新建或更新）
  const handleSaveConfig = async (data: CreateGrafanaConfigRequest) => {
    try {
      if (editingConfig) {
        await grafanaService.updateConfig(editingConfig.id, data)
        showToast('更新成功', 'success')
      } else {
        await grafanaService.createConfig(data)
        showToast('创建成功', 'success')
      }
      setShowConfigModal(false)
      loadConfigs()
    } catch (error: any) {
      showToast(error.message || '保存失败', 'error')
    }
  }

  // 新建仪表盘
  const handleCreateDashboard = () => {
    if (!selectedConfig) {
      showToast('请先选择 Grafana 配置', 'error')
      return
    }
    setEditingDashboard(null)
    setShowDashboardModal(true)
  }

  // 编辑仪表盘
  const handleEditDashboard = (dashboard: GrafanaDashboard) => {
    setEditingDashboard(dashboard)
    setShowDashboardModal(true)
  }

  // 删除仪表盘
  const handleDeleteDashboard = async (dashboard: GrafanaDashboard) => {
    if (!window.confirm(`确定要删除仪表盘 "${dashboard.name}" 吗？`)) {
      return
    }
    
    try {
      await grafanaService.deleteDashboard(dashboard.id)
      showToast('删除成功', 'success')
      
      // 如果删除的是当前选中的仪表盘，清除选中状态
      if (selectedDashboard?.id === dashboard.id) {
        setSelectedDashboard(null)
      }
      
      loadConfigs()
    } catch (error: any) {
      showToast(error.message || '删除失败', 'error')
    }
  }

  // 设置默认仪表盘
  const handleSetDefaultDashboard = async (dashboard: GrafanaDashboard) => {
    try {
      await grafanaService.setDefaultDashboard(dashboard.id)
      showToast('设置默认成功', 'success')
      loadConfigs()
    } catch (error: any) {
      showToast(error.message || '设置默认失败', 'error')
    }
  }

  // 保存仪表盘（新建或更新）
  const handleSaveDashboard = async (data: CreateDashboardRequest) => {
    if (!selectedConfig) {
      showToast('请先选择 Grafana 配置', 'error')
      return
    }
    
    try {
      if (editingDashboard) {
        await grafanaService.updateDashboard(editingDashboard.id, data)
        showToast('更新成功', 'success')
      } else {
        await grafanaService.addDashboard(selectedConfig.id, data)
        showToast('添加成功', 'success')
      }
      setShowDashboardModal(false)
      loadConfigs()
    } catch (error: any) {
      showToast(error.message || '保存失败', 'error')
    }
  }


  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-slate-50 via-orange-50/30 to-red-50/20'}`}>
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
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl blur-lg opacity-20 animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-orange-500 to-red-600 p-3 rounded-xl shadow-lg">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'bg-gradient-to-r from-gray-900 via-orange-800 to-red-900 bg-clip-text text-transparent'}`}>
                  Grafana 仪表盘
                </h1>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-0.5 flex items-center space-x-2`}>
                  <span>嵌入展示 Grafana 监控仪表盘</span>
                  {selectedConfig && (
                    <>
                      <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>•</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        {selectedConfig.name}
                      </span>
                    </>
                  )}
                  {selectedDashboard && (
                    <>
                      <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>•</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {selectedDashboard.name}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
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
        {/* 左侧配置和仪表盘列表 - 现代卡片设计 */}
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
                  <span>Grafana 配置</span>
                  <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-orange-600 bg-orange-100 rounded-full">
                    {configs.length}
                  </span>
                </span>
                <button
                  onClick={handleCreateConfig}
                  className="group p-2 text-white bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
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

          {/* 配置和仪表盘列表 */}
          {!sidebarCollapsed && (
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {loadingConfigs ? (
                <div className="flex items-center justify-center h-32">
                  <Loading size="md" text="加载中..." />
                </div>
              ) : (
                <>
                  {/* 配置列表 */}
                  <ConfigList
                    configs={configs}
                    selectedConfig={selectedConfig}
                    onSelect={handleSelectConfig}
                    onEdit={handleEditConfig}
                    onDelete={handleDeleteConfig}
                    onCreate={handleCreateConfig}
                  />
                  
                  {/* 仪表盘列表 - 仅在选中配置时显示 */}
                  {selectedConfig && (
                    <DashboardList
                      dashboards={selectedConfig.dashboards || []}
                      selectedDashboard={selectedDashboard}
                      onSelect={handleSelectDashboard}
                      onEdit={handleEditDashboard}
                      onDelete={handleDeleteDashboard}
                      onSetDefault={handleSetDefaultDashboard}
                      onCreate={handleCreateDashboard}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* 右侧 iframe 展示区域 - 现代卡片设计 */}
        <div className={`flex-1 flex flex-col overflow-hidden ${isDark ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur-xl rounded-2xl border ${isDark ? 'border-slate-700/50' : 'border-gray-200/50'} shadow-xl`}>
          <DashboardViewer
            dashboard={selectedDashboard}
            config={selectedConfig}
            iframeHeight={selectedConfig?.iframe_height || 800}
          />
        </div>
      </div>

      {/* 配置表单弹窗 */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title={editingConfig ? '编辑 Grafana 配置' : '新建 Grafana 配置'}
        size="lg"
      >
        <ConfigForm
          config={editingConfig}
          onSave={handleSaveConfig}
          onCancel={() => setShowConfigModal(false)}
        />
      </Modal>

      {/* 仪表盘表单弹窗 */}
      <Modal
        isOpen={showDashboardModal}
        onClose={() => setShowDashboardModal(false)}
        title={editingDashboard ? '编辑仪表盘' : '添加仪表盘'}
        size="lg"
      >
        <DashboardForm
          dashboard={editingDashboard}
          baseUrl={selectedConfig?.url || ''}
          onSave={handleSaveDashboard}
          onCancel={() => setShowDashboardModal(false)}
        />
      </Modal>
    </div>
  )
}

export default GrafanaPage
