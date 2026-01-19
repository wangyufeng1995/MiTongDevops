/**
 * 配置表单组件
 */
import React, { useState, useEffect } from 'react'
import { Save, X, Key, Cpu, Database } from 'lucide-react'
import { AIModelConfig } from '../../../services/aiModelConfig'

interface ConfigFormProps {
  config: AIModelConfig | null
  configs: AIModelConfig[]
  onSave: (config: AIModelConfig) => void
  onCancel: () => void
}

export const ConfigForm: React.FC<ConfigFormProps> = ({ config, configs, onSave, onCancel }) => {
  const [formData, setFormData] = useState<AIModelConfig>({
    name: '',
    description: '',
    api_key: '',
    api_endpoint: '',
    timeout: 30,
    model_name: 'gpt-4',
    temperature: 0.7,
    max_tokens: 2000,
    top_p: 1.0,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
    system_prompt: '你是一个专业的运维助手，擅长解决Linux系统管理、容器编排、网络配置、数据库优化等运维相关问题。请用简洁、专业的语言回答用户的问题，并在必要时提供具体的命令示例。',
    is_active: true,
    is_default: false
  })

  const [nameError, setNameError] = useState<string>('')

  useEffect(() => {
    if (config) {
      setFormData(config)
    }
  }, [config])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // 验证配置名称唯一性
    const isDuplicate = configs.some(c => 
      c.name.trim() === formData.name.trim() && c.id !== config?.id
    )
    
    if (isDuplicate) {
      setNameError('配置名称已存在，请使用其他名称')
      return
    }
    
    onSave(formData)
  }

  const handleChange = (field: keyof AIModelConfig, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // 清除名称错误提示
    if (field === 'name') {
      setNameError('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 基本信息 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            配置名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="例如：生产环境GPT-4"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white ${
              nameError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {nameError && (
            <p className="mt-1 text-sm text-red-500">{nameError}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            描述
          </label>
          <input
            type="text"
            value={formData.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="配置说明"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>

      {/* API配置 */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="flex items-center space-x-2 mb-4">
          <Key className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">API配置</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API密钥 <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              value={formData.api_key}
              onChange={(e) => handleChange('api_key', e.target.value)}
              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                API端点
              </label>
              <input
                type="text"
                value={formData.api_endpoint || ''}
                onChange={(e) => handleChange('api_endpoint', e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                超时时间（秒）
              </label>
              <input
                type="number"
                min={5}
                max={120}
                value={formData.timeout}
                onChange={(e) => handleChange('timeout', parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 模型参数 */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="flex items-center space-x-2 mb-4">
          <Cpu className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">模型参数</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              模型名称 <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.model_name}
              onChange={(e) => handleChange('model_name', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
            >
              <optgroup label="OpenAI">
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </optgroup>
              <optgroup label="Anthropic">
                <option value="claude-3-opus">Claude 3 Opus</option>
                <option value="claude-3-sonnet">Claude 3 Sonnet</option>
              </optgroup>
              <optgroup label="DeepSeek">
                <option value="deepseek-chat">DeepSeek Chat</option>
                <option value="deepseek-coder">DeepSeek Coder</option>
              </optgroup>
              <optgroup label="阿里云通义千问">
                <option value="qwen-turbo">Qwen Turbo</option>
                <option value="qwen-plus">Qwen Plus</option>
                <option value="qwen-max">Qwen Max</option>
                <option value="qwen3-72b">Qwen3 72B</option>
                <option value="qwen3-32b">Qwen3 32B</option>
                <option value="qwen3-14b">Qwen3 14B</option>
              </optgroup>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                温度: {formData.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={formData.temperature}
                onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>精确</span>
                <span>创造</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                最大令牌数: {formData.max_tokens}
              </label>
              <input
                type="range"
                min="100"
                max="4000"
                step="100"
                value={formData.max_tokens}
                onChange={(e) => handleChange('max_tokens', parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>100</span>
                <span>4000</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Top P
              </label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={formData.top_p}
                onChange={(e) => handleChange('top_p', parseFloat(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                频率惩罚
              </label>
              <input
                type="number"
                min={-2}
                max={2}
                step={0.1}
                value={formData.frequency_penalty}
                onChange={(e) => handleChange('frequency_penalty', parseFloat(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                存在惩罚
              </label>
              <input
                type="number"
                min={-2}
                max={2}
                step={0.1}
                value={formData.presence_penalty}
                onChange={(e) => handleChange('presence_penalty', parseFloat(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 系统提示词 */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="flex items-center space-x-2 mb-4">
          <Database className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">系统提示词</h3>
        </div>

        <textarea
          rows={4}
          value={formData.system_prompt || ''}
          onChange={(e) => handleChange('system_prompt', e.target.value)}
          placeholder="定义AI助手的角色和行为方式..."
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none dark:bg-gray-800 dark:text-white"
        />
      </div>

      {/* 状态设置 */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="space-y-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => handleChange('is_active', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">启用此配置</span>
          </label>

          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_default}
              onChange={(e) => handleChange('is_default', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">设为默认配置</span>
          </label>
        </div>
      </div>

      {/* 表单底部按钮 */}
      <div className="flex items-center justify-end space-x-3 pt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
        >
          <X className="w-4 h-4" />
          <span>取消</span>
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-sm hover:shadow-md flex items-center space-x-2"
        >
          <Save className="w-4 h-4" />
          <span>保存</span>
        </button>
      </div>
    </form>
  )
}
