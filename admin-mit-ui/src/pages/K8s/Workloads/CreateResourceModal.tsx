/**
 * 创建K8S资源弹窗组件 - 美化版
 * 通过YAML创建或更新K8S资源
 */
import React, { useState, useCallback } from 'react'
import { Modal, message, Spin } from 'antd'
import { Plus, FileCode, X, Info, Copy, Trash2, Rocket, AlertTriangle } from 'lucide-react'
import { useTheme } from '../../../hooks/useTheme'
import { workloadsService } from '../../../services/k8s/workloads'

export interface CreateResourceModalProps {
  visible: boolean
  clusterId: number
  namespace: string
  onClose: () => void
  onSuccess: () => void
}

const EXAMPLE_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.14.2
        ports:
        - containerPort: 80`

export const CreateResourceModal: React.FC<CreateResourceModalProps> = ({
  visible, clusterId, namespace, onClose, onSuccess,
}) => {
  const { isDark } = useTheme()
  const [yamlContent, setYamlContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(async () => {
    if (!yamlContent.trim()) { setError('请输入YAML内容'); return }
    setLoading(true)
    setError(null)
    try {
      const result = await workloadsService.applyYaml({
        cluster_id: clusterId, namespace, yaml_content: yamlContent,
      })
      message.success(result.message || '资源创建/更新成功')
      setYamlContent('')
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || '创建资源失败')
    } finally {
      setLoading(false)
    }
  }, [yamlContent, clusterId, namespace, onSuccess])

  const handleClose = useCallback(() => {
    setYamlContent('')
    setError(null)
    onClose()
  }, [onClose])


  return (
    <Modal
      open={visible}
      onCancel={handleClose}
      width={900}
      footer={null}
      closable={false}
      destroyOnClose
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
            <Plus className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
          </div>
          <div className="flex-1">
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>创建 K8S 资源</h3>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>通过YAML配置创建或更新资源</p>
          </div>
          <button onClick={handleClose} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className={`mx-6 mt-4 p-3 rounded-lg flex items-center gap-3 ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
        <Info className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
        <div className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
          <span className="font-medium">目标命名空间:</span> {namespace}
          <span className={`ml-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>（如YAML中未指定namespace，将使用此命名空间）</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-3">
          <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
            <FileCode className="w-4 h-4 inline mr-2" />YAML 配置
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setYamlContent(EXAMPLE_YAML); setError(null) }}
              className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5 transition-colors ${
                isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />加载示例
            </button>
            <button
              onClick={() => { setYamlContent(''); setError(null) }}
              disabled={!yamlContent}
              className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5 transition-colors ${
                yamlContent
                  ? isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  : 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-400'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />清空
            </button>
          </div>
        </div>

        {/* YAML Editor */}
        <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-slate-600' : 'border-gray-300'}`}>
          <textarea
            value={yamlContent}
            onChange={(e) => { setYamlContent(e.target.value); setError(null) }}
            className={`w-full h-80 p-4 font-mono text-sm resize-none focus:outline-none ${
              isDark ? 'bg-slate-900 text-green-400 placeholder-slate-600' : 'bg-white text-gray-800 placeholder-gray-400'
            }`}
            placeholder={`请粘贴YAML内容，例如：\n\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: my-app\n  ...`}
            spellCheck={false}
          />
        </div>

        {/* Warning */}
        {yamlContent && (
          <div className={`mt-4 p-3 rounded-lg flex items-center gap-3 ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
            <span className={`text-sm ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
              应用后将立即在集群中创建或更新资源
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

        {/* Supported Types */}
        <div className={`mt-4 text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
          支持的资源类型: Deployment, StatefulSet, DaemonSet, ReplicaSet, Pod, Service, ConfigMap, Secret, PVC, Job, CronJob, Ingress
        </div>
      </div>

      {/* Footer */}
      <div className={`px-6 py-4 border-t flex items-center justify-end gap-3 ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-gray-50'}`}>
        <button
          onClick={handleClose}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={!yamlContent.trim() || loading}
          className={`px-5 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
            yamlContent.trim() && !loading
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25'
              : 'opacity-50 cursor-not-allowed bg-gray-400 text-gray-200'
          }`}
        >
          {loading ? (
            <>
              <Spin size="small" />
              应用中...
            </>
          ) : (
            <>
              <Rocket className="w-4 h-4" />
              应用配置
            </>
          )}
        </button>
      </div>
    </Modal>
  )
}

export default CreateResourceModal
