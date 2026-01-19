/**
 * 编辑K8S资源弹窗组件 - 美化版
 * 通过YAML编辑Service或Ingress资源
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Modal, message, Spin } from 'antd'
import { Edit, Save, RotateCcw, X, FileCode, Info, AlertTriangle, Server, Globe } from 'lucide-react'
import { useTheme } from '../../../hooks/useTheme'
import { k8sServicesService } from '../../../services/k8s/services'

export interface EditResourceModalProps {
  visible: boolean
  clusterId: number
  namespace: string
  resourceName: string
  resourceType: 'service' | 'ingress'
  onClose: () => void
  onSuccess: () => void
}

export const EditResourceModal: React.FC<EditResourceModalProps> = ({
  visible, clusterId, namespace, resourceName, resourceType, onClose, onSuccess,
}) => {
  const { isDark } = useTheme()
  const [yamlContent, setYamlContent] = useState('')
  const [originalYaml, setOriginalYaml] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resourceTypeLabel = resourceType === 'service' ? 'Service' : 'Ingress'
  const IconComponent = resourceType === 'service' ? Server : Globe

  const loadYaml = useCallback(async () => {
    if (!visible || !clusterId || !namespace || !resourceName) return
    setLoading(true)
    setError(null)
    try {
      const result = resourceType === 'service'
        ? await k8sServicesService.getServiceYaml(clusterId, namespace, resourceName)
        : await k8sServicesService.getIngressYaml(clusterId, namespace, resourceName)
      if (result && result.yaml) {
        setYamlContent(result.yaml)
        setOriginalYaml(result.yaml)
      } else {
        setError('获取YAML配置失败：响应数据格式错误')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || '加载YAML失败')
    } finally {
      setLoading(false)
    }
  }, [visible, clusterId, namespace, resourceName, resourceType])

  useEffect(() => {
    if (visible) loadYaml()
    else { setYamlContent(''); setOriginalYaml(''); setError(null) }
  }, [visible, loadYaml])

  const handleSave = useCallback(async () => {
    if (!yamlContent.trim()) { setError('YAML内容不能为空'); return }
    setSaving(true)
    setError(null)
    try {
      if (resourceType === 'service') {
        await k8sServicesService.updateService({ cluster_id: clusterId, namespace, name: resourceName, yaml_content: yamlContent })
      } else {
        await k8sServicesService.updateIngress({ cluster_id: clusterId, namespace, name: resourceName, yaml_content: yamlContent })
      }
      message.success(`${resourceTypeLabel} 更新成功`)
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || '更新失败')
    } finally {
      setSaving(false)
    }
  }, [yamlContent, clusterId, namespace, resourceName, resourceType, resourceTypeLabel, onSuccess])

  const hasChanges = yamlContent !== originalYaml


  return (
    <Modal
      open={visible}
      onCancel={saving ? undefined : onClose}
      width={900}
      footer={null}
      closable={false}
      destroyOnClose
      maskClosable={!saving}
      className={isDark ? 'dark-modal' : ''}
      styles={{
        body: { background: isDark ? '#1e293b' : '#ffffff', borderRadius: '16px', padding: 0, overflow: 'hidden' },
        mask: { backgroundColor: 'rgba(0, 0, 0, 0.6)' },
      }}
    >
      {/* Header */}
      <div className={`px-6 py-4 border-b ${isDark ? 'border-slate-700 bg-gradient-to-r from-emerald-900/30 to-teal-900/30' : 'border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50'}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
            <IconComponent className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
          </div>
          <div className="flex-1">
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              编辑 {resourceTypeLabel}
            </h3>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              修改YAML配置并应用更新
            </p>
          </div>
          <button 
            onClick={saving ? undefined : onClose} 
            disabled={saving}
            className={`p-2 rounded-lg transition-colors ${saving ? 'opacity-50 cursor-not-allowed' : ''} ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className={`mx-6 mt-4 p-3 rounded-lg flex items-center gap-3 ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
        <Info className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
        <div className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
          <span className="font-medium">命名空间:</span> {namespace} &nbsp;|&nbsp; <span className="font-medium">资源名称:</span> {resourceName}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spin size="large" />
            <span className={`ml-3 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>加载YAML配置中...</span>
          </div>
        ) : (
          <>
            {/* YAML Editor */}
            <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-slate-600' : 'border-gray-300'}`}>
              <div className={`px-4 py-2 flex items-center justify-between ${isDark ? 'bg-slate-800 border-b border-slate-700' : 'bg-gray-100 border-b border-gray-200'}`}>
                <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                  <FileCode className="w-4 h-4 inline mr-2" />YAML 配置
                </span>
                {hasChanges && (
                  <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-500 font-medium">
                    已修改
                  </span>
                )}
              </div>
              <textarea
                value={yamlContent}
                onChange={(e) => { setYamlContent(e.target.value); setError(null) }}
                disabled={saving}
                className={`w-full h-96 p-4 font-mono text-sm resize-none focus:outline-none ${
                  isDark 
                    ? 'bg-slate-900 text-green-400 placeholder-slate-600' 
                    : 'bg-white text-gray-800 placeholder-gray-400'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                placeholder="YAML 配置内容..."
                spellCheck={false}
              />
            </div>

            {/* Warning when changes detected */}
            {hasChanges && (
              <div className={`mt-4 p-3 rounded-lg flex items-center gap-3 ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                <span className={`text-sm ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                  配置已修改，保存后将立即应用到集群
                </span>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className={`mt-4 p-3 rounded-lg flex items-center gap-3 ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
                <X className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                <span className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className={`px-6 py-4 border-t flex items-center justify-end gap-3 ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-gray-50'}`}>
        <button
          onClick={onClose}
          disabled={saving}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            saving ? 'opacity-50 cursor-not-allowed' : ''
          } ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          取消
        </button>
        <button
          onClick={() => { setYamlContent(originalYaml); setError(null) }}
          disabled={!hasChanges || loading || saving}
          className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
            hasChanges && !loading && !saving
              ? isDark ? 'bg-slate-600 text-white hover:bg-slate-500' : 'bg-gray-300 text-gray-800 hover:bg-gray-400'
              : 'opacity-50 cursor-not-allowed bg-gray-300 text-gray-500'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          重置
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving || loading}
          className={`px-5 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
            hasChanges && !saving && !loading
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25'
              : 'opacity-50 cursor-not-allowed bg-gray-400 text-gray-200'
          }`}
        >
          {saving ? (
            <>
              <Spin size="small" />
              保存中...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              保存更改
            </>
          )}
        </button>
      </div>
    </Modal>
  )
}

export default EditResourceModal
