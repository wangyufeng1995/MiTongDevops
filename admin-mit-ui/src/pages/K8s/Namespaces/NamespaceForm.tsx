/**
 * K8S命名空间创建表单组件 - 美化版
 */
import React, { useState } from 'react'
import { message } from 'antd'
import { Plus, X, Info, Tag, Rocket, AlertTriangle } from 'lucide-react'
import { useTheme } from '../../../hooks/useTheme'
import { namespacesService } from '../../../services/k8s/namespaces'
import type { CreateNamespaceRequest } from '../../../types/k8s'

interface NamespaceFormProps {
  clusterId: number
  clusterName?: string
  onSuccess: () => void
  onCancel: () => void
}

export const NamespaceForm: React.FC<NamespaceFormProps> = ({ clusterId, clusterName, onSuccess, onCancel }) => {
  const { isDark } = useTheme()
  const [name, setName] = useState('')
  const [labels, setLabels] = useState<Array<{ key: string; value: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateName = (value: string): string | null => {
    if (!value) return '请输入命名空间名称'
    if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(value)) return '名称只能包含小写字母、数字和连字符，且必须以字母或数字开头和结尾'
    if (value.length > 63) return '名称长度不能超过63个字符'
    if (['default', 'kube-system', 'kube-public', 'kube-node-lease'].includes(value)) return '不能使用系统保留的命名空间名称'
    return null
  }

  const validateLabelKey = (key: string): boolean => {
    if (!key) return false
    const regex = /^([a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*\/)?[a-zA-Z0-9]([-_\.a-zA-Z0-9]*[a-zA-Z0-9])?$/
    return regex.test(key) && key.length <= 253
  }

  const validateLabelValue = (value: string): boolean => {
    if (!value) return true
    return /^[a-zA-Z0-9]([-_\.a-zA-Z0-9]*[a-zA-Z0-9])?$/.test(value) && value.length <= 63
  }

  const handleSubmit = async () => {
    const nameError = validateName(name)
    if (nameError) { setError(nameError); return }
    
    const validLabels: Record<string, string> = {}
    for (const label of labels) {
      if (label.key || label.value) {
        if (!label.key) { setError('标签键不能为空'); return }
        if (!validateLabelKey(label.key)) { setError(`标签键 "${label.key}" 格式不正确`); return }
        if (label.value && !validateLabelValue(label.value)) { setError(`标签值 "${label.value}" 格式不正确`); return }
        validLabels[label.key] = label.value
      }
    }

    setLoading(true)
    setError(null)
    try {
      const request: CreateNamespaceRequest = { cluster_id: clusterId, name, labels: Object.keys(validLabels).length > 0 ? validLabels : undefined }
      await namespacesService.createNamespace(request)
      message.success('命名空间创建成功')
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.message || '创建失败')
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="space-y-5">
      {/* 集群信息 */}
      {clusterName && (
        <div className={`p-3 rounded-lg flex items-center gap-3 ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
          <Info className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          <span className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>将在集群 <span className="font-semibold">"{clusterName}"</span> 中创建命名空间</span>
        </div>
      )}

      {/* 命名空间名称 */}
      <div>
        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          命名空间名称 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null) }}
          placeholder="例如: my-namespace"
          maxLength={63}
          className={`w-full px-4 py-2.5 rounded-xl text-sm transition-all ${
            isDark ? 'bg-slate-800 border-slate-600 text-white placeholder-gray-500 focus:border-cyan-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-cyan-500'
          } border focus:outline-none focus:ring-2 focus:ring-cyan-500/20`}
        />
        <p className={`mt-1.5 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{name.length}/63 字符</p>
      </div>

      {/* 命名规则说明 */}
      <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-800/50 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
        <div className={`text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>命名规则</div>
        <ul className={`text-xs space-y-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          <li>• 只能包含小写字母、数字和连字符(-)</li>
          <li>• 必须以字母或数字开头和结尾</li>
          <li>• 长度不能超过63个字符</li>
          <li>• 不能使用系统保留名称(default, kube-system等)</li>
        </ul>
      </div>

      {/* 标签 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <Tag className="w-4 h-4 inline mr-1.5" />标签 (可选)
          </label>
          <button
            type="button"
            onClick={() => setLabels([...labels, { key: '', value: '' }])}
            className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5 transition-colors ${
              isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />添加标签
          </button>
        </div>

        {labels.length > 0 && (
          <div className="space-y-2 mb-3">
            {labels.map((label, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={label.key}
                  onChange={(e) => { const newLabels = [...labels]; newLabels[index].key = e.target.value; setLabels(newLabels); setError(null) }}
                  placeholder="键 (例如: app)"
                  className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                    isDark ? 'bg-slate-800 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } border focus:outline-none focus:ring-2 focus:ring-cyan-500/20 ${label.key && !validateLabelKey(label.key) ? 'border-red-500' : ''}`}
                />
                <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>=</span>
                <input
                  type="text"
                  value={label.value}
                  onChange={(e) => { const newLabels = [...labels]; newLabels[index].value = e.target.value; setLabels(newLabels); setError(null) }}
                  placeholder="值 (例如: frontend)"
                  className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                    isDark ? 'bg-slate-800 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } border focus:outline-none focus:ring-2 focus:ring-cyan-500/20 ${label.value && !validateLabelValue(label.value) ? 'border-red-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setLabels(labels.filter((_, i) => i !== index))}
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-50'}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className={`p-3 rounded-lg flex items-center gap-3 ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
          <span className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error}</span>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={onCancel}
          disabled={loading}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || !name}
          className={`px-5 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
            name && !loading
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 shadow-lg shadow-cyan-500/25'
              : 'opacity-50 cursor-not-allowed bg-gray-400 text-gray-200'
          }`}
        >
          <Rocket className="w-4 h-4" />
          {loading ? '创建中...' : '创建'}
        </button>
      </div>
    </div>
  )
}

export default NamespaceForm
