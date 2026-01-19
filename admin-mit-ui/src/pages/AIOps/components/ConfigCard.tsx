/**
 * 配置卡片组件
 */
import React from 'react'
import { Edit, Trash2, Star, CheckCircle, XCircle } from 'lucide-react'
import { AIModelConfig } from '../../../services/aiModelConfig'

interface ConfigCardProps {
  config: AIModelConfig
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
}

// 模型名称映射表
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  // OpenAI
  'gpt-4': 'GPT-4',
  'gpt-4-turbo': 'GPT-4 Turbo',
  'gpt-3.5-turbo': 'GPT-3.5 Turbo',
  // Anthropic
  'claude-3-opus': 'Claude 3 Opus',
  'claude-3-sonnet': 'Claude 3 Sonnet',
  // DeepSeek
  'deepseek-chat': 'DeepSeek Chat',
  'deepseek-coder': 'DeepSeek Coder',
  // 阿里云通义千问
  'qwen-turbo': 'Qwen Turbo',
  'qwen-plus': 'Qwen Plus',
  'qwen-max': 'Qwen Max',
  'qwen3-72b': 'Qwen3 72B',
  'qwen3-32b': 'Qwen3 32B',
  'qwen3-14b': 'Qwen3 14B',
}

export const ConfigCard: React.FC<ConfigCardProps> = ({
  config,
  onEdit,
  onDelete,
  onSetDefault
}) => {
  // 获取友好的模型显示名称
  const getModelDisplayName = (modelName: string) => {
    return MODEL_DISPLAY_NAMES[modelName] || modelName
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border-2 transition-all hover:shadow-md ${
      config.is_default ? 'border-blue-500' : 'border-gray-200'
    }`}>
      {/* 卡片头部 */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="text-lg font-semibold text-gray-900">{config.name}</h3>
              {config.is_default && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full flex items-center">
                  <Star className="w-3 h-3 mr-1" />
                  默认
                </span>
              )}
            </div>
            {config.description && (
              <p className="text-sm text-gray-500">{config.description}</p>
            )}
          </div>
          <div className={`w-2 h-2 rounded-full ${config.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
        </div>

        {/* 模型信息 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">模型</span>
            <span className="font-medium text-gray-900">{getModelDisplayName(config.model_name)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">温度</span>
            <span className="font-medium text-gray-900">{config.temperature}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">最大令牌</span>
            <span className="font-medium text-gray-900">{config.max_tokens}</span>
          </div>
          {config.api_key_masked && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">API密钥</span>
              <span className="font-mono text-xs text-gray-500">{config.api_key_masked}</span>
            </div>
          )}
        </div>
      </div>

      {/* 卡片底部操作 */}
      <div className="p-4 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {config.is_active ? (
            <span className="text-xs text-green-600 flex items-center">
              <CheckCircle className="w-3 h-3 mr-1" />
              已启用
            </span>
          ) : (
            <span className="text-xs text-gray-400 flex items-center">
              <XCircle className="w-3 h-3 mr-1" />
              已禁用
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {!config.is_default && (
            <button
              onClick={onSetDefault}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="设为默认"
            >
              <Star className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="编辑"
          >
            <Edit className="w-4 h-4" />
          </button>
          {!config.is_default && (
            <button
              onClick={onDelete}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
