/**
 * Redis 连接配置表单组件
 * 
 * 支持单机和集群模式配置，包含表单验证
 */
import React, { useState, useEffect } from 'react'
import {
  Server,
  Network,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle,
  XCircle,
  Database,
  Lock,
  Clock,
  FileText
} from 'lucide-react'
import { redisService, RedisConnection, CreateRedisConnectionRequest, UpdateRedisConnectionRequest } from '../../services/redis'

interface ConnectionFormProps {
  connection?: RedisConnection | null
  onSuccess: () => void
  onCancel: () => void
}

interface FormData {
  name: string
  connection_type: 'standalone' | 'cluster'
  host: string
  port: number
  password: string
  database: number
  cluster_nodes: string[]
  timeout: number
  description: string
}

interface FormErrors {
  name?: string
  host?: string
  port?: string
  cluster_nodes?: string
  timeout?: string
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  connection,
  onSuccess,
  onCancel
}) => {
  const isEditing = !!connection

  const [formData, setFormData] = useState<FormData>({
    name: '',
    connection_type: 'standalone',
    host: 'localhost',
    port: 6379,
    password: '',
    database: 0,
    cluster_nodes: [''],
    timeout: 5,
    description: ''
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    if (connection) {
      setFormData({
        name: connection.name || '',
        connection_type: connection.connection_type || 'standalone',
        host: connection.host || 'localhost',
        port: connection.port || 6379,
        password: '',
        database: connection.database || 0,
        cluster_nodes: connection.cluster_nodes?.length ? connection.cluster_nodes : [''],
        timeout: connection.timeout || 5,
        description: connection.description || ''
      })
    }
  }, [connection])

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = '请输入实例名称'
    } else if (formData.name.length > 100) {
      newErrors.name = '实例名称不能超过100个字符'
    }

    if (formData.connection_type === 'standalone') {
      if (!formData.host.trim()) {
        newErrors.host = '请输入主机地址'
      }
      if (formData.port < 1 || formData.port > 65535) {
        newErrors.port = '端口号必须在 1-65535 之间'
      }
    } else {
      const validNodes = formData.cluster_nodes.filter(node => node.trim())
      if (validNodes.length === 0) {
        newErrors.cluster_nodes = '请至少添加一个集群节点'
      }
    }

    if (formData.timeout < 1 || formData.timeout > 60) {
      newErrors.timeout = '超时时间必须在 1-60 秒之间'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
    setTestResult(null)
  }

  const handleTypeChange = (type: 'standalone' | 'cluster') => {
    setFormData(prev => ({
      ...prev,
      connection_type: type,
      cluster_nodes: type === 'cluster' ? (prev.cluster_nodes.length ? prev.cluster_nodes : ['']) : prev.cluster_nodes
    }))
    setErrors({})
    setTestResult(null)
  }

  const handleAddNode = () => {
    setFormData(prev => ({
      ...prev,
      cluster_nodes: [...prev.cluster_nodes, '']
    }))
  }

  const handleRemoveNode = (index: number) => {
    setFormData(prev => ({
      ...prev,
      cluster_nodes: prev.cluster_nodes.filter((_, i) => i !== index)
    }))
  }

  const handleNodeChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      cluster_nodes: prev.cluster_nodes.map((node, i) => i === index ? value : node)
    }))
    if (errors.cluster_nodes) {
      setErrors(prev => ({ ...prev, cluster_nodes: undefined }))
    }
  }

  const handleTestConnection = async () => {
    if (!connection || testing) return

    setTesting(true)
    setTestResult(null)

    try {
      const result = await redisService.testConnection(connection.id)
      // 兼容 success 和 connected 两种返回格式
      const isSuccess = result.success || result.connected
      setTestResult({
        success: isSuccess,
        message: isSuccess
          ? (result.message || `连接成功${result.latency_ms ? ` (${result.latency_ms}ms)` : ''}`)
          : (result.message || '连接失败')
      })
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || '测试连接失败'
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    if (!validateForm()) return

    setSubmitting(true)

    try {
      const data: CreateRedisConnectionRequest | UpdateRedisConnectionRequest = {
        name: formData.name.trim(),
        connection_type: formData.connection_type,
        timeout: formData.timeout,
        description: formData.description.trim()
      }

      if (formData.connection_type === 'standalone') {
        data.host = formData.host.trim()
        data.port = formData.port
        data.database = formData.database
      } else {
        data.cluster_nodes = formData.cluster_nodes.filter(node => node.trim())
      }

      if (formData.password) {
        data.password = formData.password
      }

      if (isEditing && connection) {
        await redisService.updateConnection(connection.id, data)
      } else {
        await redisService.createConnection(data as CreateRedisConnectionRequest)
      }

      onSuccess()
    } catch (error: any) {
      setErrors({ name: error.message || '保存失败' })
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = (hasError: boolean) => `
    w-full px-3 py-2 border rounded-lg transition-all text-sm
    focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500
    ${hasError ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300 bg-white'}
  `

  return (
    <div className="space-y-5">
      {/* 连接类型选择 - 编辑时只显示当前类型，新建时显示两个选项 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">连接类型</label>
        {isEditing ? (
          // 编辑模式：只显示当前类型（不可切换）
          <div className={`flex items-center justify-center px-4 py-3 border-2 rounded-lg ${
            formData.connection_type === 'standalone'
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-purple-500 bg-purple-50 text-purple-700'
          }`}>
            {formData.connection_type === 'standalone' ? (
              <>
                <Server className="w-5 h-5 mr-2" />
                <span className="font-medium">单机模式</span>
              </>
            ) : (
              <>
                <Network className="w-5 h-5 mr-2" />
                <span className="font-medium">集群模式</span>
              </>
            )}
          </div>
        ) : (
          // 新建模式：显示两个选项
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleTypeChange('standalone')}
              className={`flex items-center justify-center px-4 py-3 border-2 rounded-lg transition-all ${
                formData.connection_type === 'standalone'
                  ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Server className="w-5 h-5 mr-2" />
              <span className="font-medium">单机模式</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('cluster')}
              className={`flex items-center justify-center px-4 py-3 border-2 rounded-lg transition-all ${
                formData.connection_type === 'cluster'
                  ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Network className="w-5 h-5 mr-2" />
              <span className="font-medium">集群模式</span>
            </button>
          </div>
        )}
      </div>

      {/* 实例名称 */}
      <div>
        <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
          <Database className="w-4 h-4 mr-1.5 text-gray-400" />
          实例名称 <span className="text-red-500 ml-0.5">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          placeholder="例如：生产环境 Redis"
          className={inputClass(!!errors.name)}
        />
        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
      </div>

      {/* 单机模式配置 */}
      {formData.connection_type === 'standalone' && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                主机地址 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.host}
                onChange={(e) => handleInputChange('host', e.target.value)}
                placeholder="localhost 或 IP地址"
                className={inputClass(!!errors.host)}
              />
              {errors.host && <p className="mt-1 text-xs text-red-500">{errors.host}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                端口 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 6379)}
                className={inputClass(!!errors.port)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">数据库</label>
              <input
                type="number"
                value={formData.database}
                onChange={(e) => handleInputChange('database', Math.min(15, Math.max(0, parseInt(e.target.value) || 0)))}
                min={0}
                max={15}
                placeholder="0-15"
                className={inputClass(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* 集群模式配置 */}
      {formData.connection_type === 'cluster' && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center text-sm font-medium text-gray-700">
              <Network className="w-4 h-4 mr-1.5 text-gray-400" />
              集群节点 <span className="text-red-500 ml-0.5">*</span>
            </label>
            <button
              type="button"
              onClick={handleAddNode}
              className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              添加节点
            </button>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {formData.cluster_nodes.map((node, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-6">{index + 1}.</span>
                <input
                  type="text"
                  value={node}
                  onChange={(e) => handleNodeChange(index, e.target.value)}
                  placeholder="host:port (例如: 192.168.1.1:6379)"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white"
                />
                {formData.cluster_nodes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveNode(index)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {errors.cluster_nodes && <p className="mt-2 text-xs text-red-500">{errors.cluster_nodes}</p>}
        </div>
      )}

      {/* 认证与高级设置 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 密码 */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
            <Lock className="w-4 h-4 mr-1.5 text-gray-400" />
            密码
            {isEditing && <span className="text-gray-400 text-xs ml-1">(留空不修改)</span>}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              placeholder="可选"
              className={`${inputClass(false)} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 超时 */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
            <Clock className="w-4 h-4 mr-1.5 text-gray-400" />
            连接超时
          </label>
          <div className="relative">
            <input
              type="number"
              value={formData.timeout}
              onChange={(e) => handleInputChange('timeout', parseInt(e.target.value) || 5)}
              min={1}
              max={60}
              className={inputClass(!!errors.timeout)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">秒</span>
          </div>
        </div>
      </div>

      {/* 备注 */}
      <div>
        <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
          <FileText className="w-4 h-4 mr-1.5 text-gray-400" />
          备注
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder="可选，添加备注信息"
          rows={2}
          className={`${inputClass(false)} resize-none`}
        />
      </div>

      {/* 测试结果 */}
      {testResult && (
        <div className={`p-3 rounded-lg flex items-center ${
          testResult.success 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {testResult.success ? <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" /> : <XCircle className="w-4 h-4 mr-2 flex-shrink-0" />}
          <span className="text-sm">{testResult.message}</span>
        </div>
      )}

      {/* 底部按钮 */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
        {isEditing && (
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
          >
            {testing ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
            测试连接
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          取消
        </button>
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={submitting}
          className="inline-flex items-center px-5 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 shadow-sm"
        >
          {submitting ? (
            <>
              <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
              保存中...
            </>
          ) : (
            isEditing ? '保存修改' : '添加实例'
          )}
        </button>
      </div>
    </div>
  )
}

export default ConnectionForm
