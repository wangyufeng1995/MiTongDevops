/**
 * AI模型配置页面 - 模块化展示
 */
import React, { useState, useEffect } from 'react'
import { Settings, Plus, Loader2 } from 'lucide-react'
import { aiModelConfigService, AIModelConfig } from '../../services/aiModelConfig'
import { ConfigForm, ConfigCard } from './components'
import { useNotification } from '../../hooks/useNotification'
import EmptyState from '../../components/Notification/EmptyState'
import Modal from '../../components/Notification/Modal'

export const ModelConfig: React.FC = () => {
  const [configs, setConfigs] = useState<AIModelConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingConfig, setEditingConfig] = useState<AIModelConfig | null>(null)
  const notification = useNotification()

  // 加载配置列表
  const loadConfigs = async () => {
    try {
      setLoading(true)
      const response = await aiModelConfigService.getConfigs()
      
      // 检查响应格式 - 后端返回 {success, code, message, data}
      if (response.code === 200 || response.success) {
        setConfigs(Array.isArray(response.data) ? response.data : [])
      } else {
        notification.error(response.message || '加载配置失败')
      }
    } catch (error: any) {
      // 详细的错误处理
      if (error.response?.status === 401) {
        notification.error('认证失败，请重新登录')
      } else if (error.response?.status === 403) {
        notification.error('权限不足，无法访问')
      } else {
        notification.error(error.response?.data?.message || error.message || '加载配置失败')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfigs()
  }, [])

  // 创建新配置
  const handleCreate = () => {
    setEditingConfig(null)
    setShowForm(true)
  }

  // 编辑配置
  const handleEdit = async (config: AIModelConfig) => {
    try {
      // 获取完整配置（包含API密钥）
      const response = await aiModelConfigService.getConfig(config.id!)
      if (response.code === 200 || response.success) {
        setEditingConfig(response.data)
        setShowForm(true)
      } else {
        notification.error(response.message || '加载配置失败')
      }
    } catch (error: any) {
      notification.error(error.response?.data?.message || error.message || '加载配置失败')
    }
  }

  // 删除配置
  const handleDelete = async (id: number) => {
    const confirmed = await notification.confirm(
      '确认删除',
      '确定要删除这个配置吗？此操作无法撤销。',
      true
    )
    
    if (!confirmed) return

    try {
      const response = await aiModelConfigService.deleteConfig(id)
      
      if (response.code === 200 || response.success) {
        notification.success('删除成功')
        loadConfigs()
      } else {
        notification.error(response.message || '删除失败')
      }
    } catch (error: any) {
      notification.error(error.response?.data?.message || error.message || '删除失败')
    }
  }

  // 设置默认配置
  const handleSetDefault = async (id: number) => {
    try {
      const response = await aiModelConfigService.setDefault(id)
      if (response.code === 200 || response.success) {
        notification.success('设置默认配置成功')
        loadConfigs()
      } else {
        notification.error(response.message || '设置失败')
      }
    } catch (error: any) {
      notification.error(error.response?.data?.message || error.message || '设置失败')
    }
  }

  // 保存配置
  const handleSave = async (config: AIModelConfig) => {
    try {
      // 检查配置名称唯一性
      const isDuplicate = configs.some(c => 
        c.name === config.name && c.id !== editingConfig?.id
      )
      
      if (isDuplicate) {
        notification.error('配置名称已存在，请使用其他名称')
        return
      }

      if (editingConfig?.id) {
        // 更新
        const response = await aiModelConfigService.updateConfig(editingConfig.id, config)
        if (response.code === 200 || response.success) {
          notification.success('更新成功')
          setShowForm(false)
          await loadConfigs()
        } else {
          notification.error(response.message || '更新失败')
        }
      } else {
        // 创建
        const response = await aiModelConfigService.createConfig(config)
        if (response.code === 200 || response.success) {
          notification.success('创建成功')
          setShowForm(false)
          await loadConfigs()
        } else {
          notification.error(response.message || '创建失败')
        }
      }
    } catch (error: any) {
      notification.error(error.response?.data?.message || error.message || '保存失败')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页面头部 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">AI模型配置</h1>
                <p className="text-gray-500 mt-1">管理AI模型配置，支持多个配置切换</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleCreate}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-sm hover:shadow-md flex items-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>新建配置</span>
              </button>
              <button
                onClick={loadConfigs}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all shadow-sm hover:shadow-md flex items-center space-x-2"
              >
                <Settings className="w-5 h-5" />
                <span>刷新</span>
              </button>
            </div>
          </div>
        </div>

        {/* 配置表单 Modal */}
        <Modal
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          title={editingConfig ? '编辑配置' : '新建配置'}
          size="xl"
          closeOnOverlayClick={true}
          closeOnEsc={true}
        >
          <ConfigForm
            config={editingConfig}
            configs={configs}
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
          />
        </Modal>

        {/* 配置列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <>
            {configs.length === 0 ? (
              <EmptyState
                illustration="config"
                title="暂无配置"
                description="点击「新建配置」按钮创建第一个AI模型配置"
                action={{
                  label: '新建配置',
                  onClick: handleCreate,
                  icon: <Plus className="w-5 h-5" />
                }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {configs.map((config) => (
                  <ConfigCard
                    key={config.id}
                    config={config}
                    onEdit={() => handleEdit(config)}
                    onDelete={() => handleDelete(config.id!)}
                    onSetDefault={() => handleSetDefault(config.id!)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* 提示信息 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Settings className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-1">使用说明</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• 可以创建多个配置，方便在不同场景下切换</li>
                <li>• 标记为"默认"的配置将在AI助手中优先使用</li>
                <li>• API密钥会加密存储，确保安全</li>
                <li>• 不同模型适合不同的任务场景</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ModelConfig
