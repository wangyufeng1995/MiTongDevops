/**
 * ConfigMap详情组件 - 美化版
 */
import React, { useState, useEffect } from 'react'
import { Spin, message } from 'antd'
import { FileText, Tag, Clock, Layers, Copy, Check } from 'lucide-react'
import { useTheme } from '../../../hooks/useTheme'
import { configsService } from '../../../services/k8s/configs'
import type { K8sConfigMap } from '../../../types/k8s'
import { formatDateTime } from '../../../utils'

interface ConfigMapDetailProps {
  clusterId: number
  namespace: string
  name: string
}

export const ConfigMapDetail: React.FC<ConfigMapDetailProps> = ({ clusterId, namespace, name }) => {
  const { isDark } = useTheme()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [configMap, setConfigMap] = useState<K8sConfigMap>()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(undefined)
        const data = await configsService.getConfigMapDetail(clusterId, namespace, name)
        setConfigMap(data)
      } catch (err: any) {
        setError(err.response?.data?.message || '加载ConfigMap详情失败')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [clusterId, namespace, name])

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      message.success('已复制到剪贴板')
      setTimeout(() => setCopiedKey(null), 2000)
    } catch { message.error('复制失败') }
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Spin size="large" /><span className={`ml-3 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>加载中...</span></div>
  if (error) return <div className={`p-4 rounded-lg ${isDark ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'}`}>{error}</div>
  if (!configMap) return null

  return (
    <div className="space-y-4">
      {/* 基本信息 */}
      <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-slate-800/50 border border-slate-700' : 'bg-white border border-gray-200'}`}>
        <div className={`px-4 py-3 flex items-center gap-2 ${isDark ? 'bg-amber-500/10 border-b border-slate-700' : 'bg-amber-50 border-b border-gray-200'}`}>
          <FileText className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
          <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>基本信息</span>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <div className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>名称</div>
            <div className={`flex items-center gap-1.5 font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              <FileText className={`w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              {configMap.name}
            </div>
          </div>
          <div>
            <div className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>命名空间</div>
            <div className={`flex items-center gap-1.5 font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              <Layers className={`w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              {configMap.namespace}
            </div>
          </div>
          <div className="col-span-2">
            <div className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>创建时间</div>
            <div className={`flex items-center gap-1.5 font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              <Clock className={`w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              {formatDateTime(configMap.created_at)}
            </div>
          </div>
          {configMap.labels && Object.keys(configMap.labels).length > 0 && (
            <div className="col-span-2">
              <div className={`text-xs mb-1.5 flex items-center gap-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}><Tag className="w-3 h-3" />标签</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(configMap.labels).map(([k, v]) => (
                  <span key={k} className={`inline-flex px-2 py-0.5 rounded text-xs ${isDark ? 'bg-slate-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>{k}: {v}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 配置数据 */}
      <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-slate-800/50 border border-slate-700' : 'bg-white border border-gray-200'}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'bg-orange-500/10 border-b border-slate-700' : 'bg-orange-50 border-b border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <FileText className={`w-4 h-4 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
            <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>配置数据</span>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'}`}>
            {Object.keys(configMap.data || {}).length} 项
          </span>
        </div>
        <div className="divide-y divide-slate-700/50">
          {configMap.data && Object.keys(configMap.data).length > 0 ? (
            Object.entries(configMap.data).map(([key, value]) => (
              <div key={key} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-medium text-sm ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{key}</span>
                  <button
                    onClick={() => handleCopy(key, value)}
                    className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                    title="复制"
                  >
                    {copiedKey === key ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <pre className={`p-3 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all ${
                  isDark ? 'bg-slate-900 text-green-400' : 'bg-gray-50 text-gray-700'
                }`}>{value}</pre>
              </div>
            ))
          ) : (
            <div className={`p-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>暂无配置数据</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ConfigMapDetail
