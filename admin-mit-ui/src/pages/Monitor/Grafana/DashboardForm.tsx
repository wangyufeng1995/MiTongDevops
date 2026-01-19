/**
 * Grafana 仪表盘表单组件
 * 
 * 实现仪表盘配置表单（名称、URL、描述、排序、默认）
 * 
 * Requirements: 4.2, 4.3
 */
import React, { useState, useEffect } from 'react'
import { Save, X } from 'lucide-react'
import { 
  GrafanaDashboard, 
  CreateDashboardRequest 
} from '../../../services/grafana'

interface DashboardFormProps {
  dashboard: GrafanaDashboard | null
  baseUrl: string  // Grafana 服务器基础 URL
  onSave: (data: CreateDashboardRequest) => void
  onCancel: () => void
}

export const DashboardForm: React.FC<DashboardFormProps> = ({
  dashboard,
  baseUrl,
  onSave,
  onCancel
}) => {
  // 表单状态
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [isDefault, setIsDefault] = useState(false)
  
  // UI 状态
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // 初始化表单数据
  useEffect(() => {
    if (dashboard) {
      setName(dashboard.name)
      setUrl(dashboard.url)
      setDescription(dashboard.description || '')
      setSortOrder(dashboard.sort_order)
      setIsDefault(dashboard.is_default)
    } else {
      // 重置表单
      setName('')
      setUrl('')
      setDescription('')
      setSortOrder(0)
      setIsDefault(false)
    }
    setErrors({})
  }, [dashboard])

  // 验证表单
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = '请输入仪表盘名称'
    }

    if (!url.trim()) {
      newErrors.url = '请输入仪表盘 URL'
    } else if (!/^https?:\/\/.+/.test(url)) {
      newErrors.url = 'URL 格式不正确，需要以 http:// 或 https:// 开头'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setSubmitting(true)

    try {
      const data: CreateDashboardRequest = {
        name: name.trim(),
        url: url.trim(),
        description: description.trim() || undefined,
        sort_order: sortOrder,
        is_default: isDefault
      }

      await onSave(data)
    } finally {
      setSubmitting(false)
    }
  }

  // 自动补全 URL
  const handleUrlBlur = () => {
    if (url && !url.startsWith('http') && baseUrl) {
      // 如果用户只输入了路径，自动补全基础 URL
      const cleanBaseUrl = baseUrl.replace(/\/$/, '')
      const cleanPath = url.startsWith('/') ? url : `/${url}`
      setUrl(`${cleanBaseUrl}${cleanPath}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 p-6">
      {/* 名称 */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          仪表盘名称 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：系统概览"
          className={`w-full px-4 py-2.5 border-2 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all ${
            errors.name ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-orange-300'
          }`}
        />
        {errors.name && (
          <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
            <span>⚠️</span>
            <span>{errors.name}</span>
          </p>
        )}
      </div>

      {/* 仪表盘 URL */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          仪表盘 URL <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={handleUrlBlur}
          placeholder="例如：http://grafana.example.com:3000/d/xxx/dashboard-name"
          className={`w-full px-4 py-2.5 border-2 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all font-mono text-sm ${
            errors.url ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-orange-300'
          }`}
        />
        {errors.url && (
          <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
            <span>⚠️</span>
            <span>{errors.url}</span>
          </p>
        )}
        <p className="mt-2 text-xs text-gray-600 bg-orange-50 rounded-lg p-2 border border-orange-100">
          💡 完整的 Grafana 仪表盘 URL，可以从 Grafana 中复制
        </p>
      </div>

      {/* 描述 */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          描述
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="可选：仪表盘的简要描述"
          rows={2}
          className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none bg-white hover:border-orange-300 transition-all"
        />
      </div>

      {/* 排序和默认设置 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            排序顺序
          </label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
            min={0}
            className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white hover:border-orange-300 transition-all"
          />
          <p className="mt-2 text-xs text-gray-600 bg-orange-50 rounded-lg p-2 border border-orange-100">
            📊 数字越小越靠前
          </p>
        </div>
        <div className="flex items-end pb-2">
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-3 border-2 border-yellow-100 w-full">
            <label className="flex items-center space-x-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-5 h-5 text-orange-600 border-gray-300 rounded-lg focus:ring-orange-500 focus:ring-2"
              />
              <span className="text-sm font-medium text-gray-800 group-hover:text-orange-700 transition-colors">设为默认仪表盘</span>
            </label>
          </div>
        </div>
      </div>

      {/* 按钮 */}
      <div className="flex justify-end space-x-3 pt-6 border-t-2 border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="flex items-center space-x-2 px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 transition-all"
        >
          <X className="w-4 h-4" />
          <span>取消</span>
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 disabled:opacity-50 transition-all shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 hover:scale-105"
        >
          <Save className="w-4 h-4" />
          <span>{submitting ? '保存中...' : '保存'}</span>
        </button>
      </div>
    </form>
  )
}

export default DashboardForm
