/**
 * 数据库连接配置表单组件
 * 
 * 特点:
 * - 数据库类型选择器
 * - 分组布局（基本信息、连接参数、Oracle 特定参数）
 * - 图标标签、输入框悬停效果
 * - 测试连接功能
 * 
 * Requirements: 1.1, 1.2, 1.5, 1.8, 9.3, 9.8, 9.9
 */
import React, { useState, useEffect } from 'react'
import {
  Server,
  User,
  Lock,
  Database,
  Clock,
  FileText,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle,
  XCircle,
  Globe,
  Hash,
  Key
} from 'lucide-react'
import { 
  databaseService, 
  DatabaseConnection, 
  CreateDatabaseConnectionRequest, 
  UpdateDatabaseConnectionRequest,
  DatabaseType
} from '../../services/database'
import { 
  DatabaseTypeSelector, 
  databaseToast
} from './components'

interface ConnectionFormProps {
  connection?: DatabaseConnection | null
  onSuccess: () => void
  onCancel: () => void
}

interface FormData {
  name: string
  db_type: DatabaseType | null
  host: string
  port: number
  username: string
  password: string
  database: string
  schema: string
  // Oracle 特定参数
  service_name: string
  sid: string
  timeout: number
  description: string
}

interface FormErrors {
  name?: string
  db_type?: string
  host?: string
  port?: string
  username?: string
  password?: string
  database?: string
  timeout?: string
  oracle?: string
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  connection,
  onSuccess,
  onCancel
}) => {
  const isEditing = !!connection

  const [formData, setFormData] = useState<FormData>({
    name: '',
    db_type: null,
    host: 'localhost',
    port: 5432,
    username: '',
    password: '',
    database: '',
    schema: '',
    service_name: '',
    sid: '',
    timeout: 10,
    description: ''
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // 初始化表单数据
  useEffect(() => {
    if (connection) {
      setFormData({
        name: connection.name || '',
        db_type: connection.db_type || null,
        host: connection.host || 'localhost',
        port: connection.port || 5432,
        username: connection.username || '',
        password: '',
        database: connection.database || '',
        schema: connection.schema || '',
        service_name: connection.service_name || '',
        sid: connection.sid || '',
        timeout: connection.timeout || 10,
        description: connection.description || ''
      })
    }
  }, [connection])

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = '请输入连接名称'
    } else if (formData.name.length > 100) {
      newErrors.name = '连接名称不能超过100个字符'
    }

    if (!formData.db_type) {
      newErrors.db_type = '请选择数据库类型'
    }

    if (!formData.host.trim()) {
      newErrors.host = '请输入主机地址'
    }

    if (formData.port < 1 || formData.port > 65535) {
      newErrors.port = '端口号必须在 1-65535 之间'
    }

    if (!formData.username.trim()) {
      newErrors.username = '请输入用户名'
    }

    if (!isEditing && !formData.password) {
      newErrors.password = '请输入密码'
    }

    if (formData.timeout < 1 || formData.timeout > 60) {
      newErrors.timeout = '超时时间必须在 1-60 秒之间'
    }

    // Oracle 特定验证
    if (formData.db_type === 'oracle') {
      if (!formData.service_name && !formData.sid) {
        newErrors.oracle = '请输入 Service Name 或 SID'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 处理输入变化
  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
    setTestResult(null)
  }

  // 处理数据库类型变化
  const handleTypeChange = (type: DatabaseType, defaultPort: number) => {
    setFormData(prev => ({
      ...prev,
      db_type: type,
      port: defaultPort
    }))
    setErrors(prev => ({ ...prev, db_type: undefined }))
    setTestResult(null)
  }

  // 测试连接
  const handleTestConnection = async () => {
    if (testing) return

    // 验证必填字段
    if (!formData.db_type || !formData.host || !formData.username) {
      databaseToast.warning('请填写必要信息', '请先填写数据库类型、主机地址和用户名')
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      // 如果是编辑模式且有连接ID，使用已保存的连接测试
      if (isEditing && connection) {
        const result = await databaseService.testConnection(connection.id)
        setTestResult({
          success: result.connected,
          message: result.connected ? '连接成功' : (result.message || '连接失败')
        })
      } else {
        // 新建模式，使用配置测试
        const testConfig: CreateDatabaseConnectionRequest = {
          name: formData.name || 'test',
          db_type: formData.db_type!,
          host: formData.host,
          port: formData.port,
          username: formData.username,
          password: formData.password,
          database: formData.database || undefined,
          schema: formData.schema || undefined,
          service_name: formData.service_name || undefined,
          sid: formData.sid || undefined,
          timeout: formData.timeout
        }
        const result = await databaseService.testConnectionConfig(testConfig)
        setTestResult({
          success: result.connected,
          message: result.connected ? '连接成功' : (result.message || '连接失败')
        })
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || '测试连接失败'
      })
    } finally {
      setTesting(false)
    }
  }

  // 提交表单
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    if (!validateForm()) return

    setSubmitting(true)

    try {
      const data: CreateDatabaseConnectionRequest | UpdateDatabaseConnectionRequest = {
        name: formData.name.trim(),
        db_type: formData.db_type!,
        host: formData.host.trim(),
        port: formData.port,
        username: formData.username.trim(),
        database: formData.database.trim() || undefined,
        schema: formData.schema.trim() || undefined,
        timeout: formData.timeout,
        description: formData.description.trim() || undefined
      }

      // Oracle 特定参数
      if (formData.db_type === 'oracle') {
        data.service_name = formData.service_name.trim() || undefined
        data.sid = formData.sid.trim() || undefined
      }

      // 密码处理
      if (formData.password) {
        data.password = formData.password
      }

      if (isEditing && connection) {
        await databaseService.updateConnection(connection.id, data)
      } else {
        await databaseService.createConnection(data as CreateDatabaseConnectionRequest)
      }

      onSuccess()
    } catch (error: any) {
      setErrors({ name: error.message || '保存失败' })
    } finally {
      setSubmitting(false)
    }
  }

  // 输入框样式
  const inputClass = (hasError: boolean) => `
    w-full px-3 py-2 border rounded-lg transition-all text-sm
    focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
    ${hasError ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300 bg-white'}
  `

  return (
    <div className="space-y-5">
      {/* 数据库类型选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          数据库类型 <span className="text-red-500">*</span>
        </label>
        <DatabaseTypeSelector
          value={formData.db_type}
          onChange={handleTypeChange}
          disabled={isEditing}
          editMode={isEditing}
        />
        {errors.db_type && <p className="mt-1 text-xs text-red-500">{errors.db_type}</p>}
      </div>

      {/* 基本信息 */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
        <h4 className="text-sm font-medium text-gray-700 flex items-center">
          <Database className="w-4 h-4 mr-2 text-gray-400" />
          基本信息
        </h4>

        {/* 连接名称 */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
            <FileText className="w-4 h-4 mr-1.5 text-gray-400" />
            连接名称 <span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="例如：生产环境 PostgreSQL"
            className={inputClass(!!errors.name)}
          />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
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
      </div>

      {/* 连接参数 */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
        <h4 className="text-sm font-medium text-gray-700 flex items-center">
          <Server className="w-4 h-4 mr-2 text-gray-400" />
          连接参数
        </h4>

        <div className="grid grid-cols-3 gap-4">
          {/* 主机地址 */}
          <div className="col-span-2">
            <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
              <Globe className="w-4 h-4 mr-1.5 text-gray-400" />
              主机地址 <span className="text-red-500 ml-0.5">*</span>
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

          {/* 端口 */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
              <Hash className="w-4 h-4 mr-1.5 text-gray-400" />
              端口 <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="number"
              value={formData.port}
              onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 5432)}
              className={inputClass(!!errors.port)}
            />
            {errors.port && <p className="mt-1 text-xs text-red-500">{errors.port}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* 用户名 */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
              <User className="w-4 h-4 mr-1.5 text-gray-400" />
              用户名 <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              placeholder="数据库用户名"
              className={inputClass(!!errors.username)}
            />
            {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username}</p>}
          </div>

          {/* 密码 */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
              <Lock className="w-4 h-4 mr-1.5 text-gray-400" />
              密码 {!isEditing && <span className="text-red-500 ml-0.5">*</span>}
              {isEditing && <span className="text-gray-400 text-xs ml-1">(留空不修改)</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder={isEditing ? '留空不修改' : '数据库密码'}
                className={`${inputClass(!!errors.password)} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* 数据库名 */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
              <Database className="w-4 h-4 mr-1.5 text-gray-400" />
              数据库名
            </label>
            <input
              type="text"
              value={formData.database}
              onChange={(e) => handleInputChange('database', e.target.value)}
              placeholder="可选"
              className={inputClass(false)}
            />
          </div>

          {/* Schema */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
              <Key className="w-4 h-4 mr-1.5 text-gray-400" />
              Schema
            </label>
            <input
              type="text"
              value={formData.schema}
              onChange={(e) => handleInputChange('schema', e.target.value)}
              placeholder="可选"
              className={inputClass(false)}
            />
          </div>
        </div>

        {/* 超时设置 */}
        <div className="w-1/3">
          <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
            <Clock className="w-4 h-4 mr-1.5 text-gray-400" />
            连接超时
          </label>
          <div className="relative">
            <input
              type="number"
              value={formData.timeout}
              onChange={(e) => handleInputChange('timeout', parseInt(e.target.value) || 10)}
              min={1}
              max={60}
              className={inputClass(!!errors.timeout)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">秒</span>
          </div>
          {errors.timeout && <p className="mt-1 text-xs text-red-500">{errors.timeout}</p>}
        </div>
      </div>

      {/* Oracle 特定参数 */}
      {formData.db_type === 'oracle' && (
        <div className="space-y-4 p-4 bg-orange-50 rounded-lg border border-orange-100">
          <h4 className="text-sm font-medium text-orange-700 flex items-center">
            <Server className="w-4 h-4 mr-2 text-orange-500" />
            Oracle 连接参数
          </h4>

          <div className="grid grid-cols-2 gap-4">
            {/* Service Name */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
                Service Name
              </label>
              <input
                type="text"
                value={formData.service_name}
                onChange={(e) => handleInputChange('service_name', e.target.value)}
                placeholder="Oracle Service Name"
                className={inputClass(!!errors.oracle)}
              />
            </div>

            {/* SID */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
                SID
              </label>
              <input
                type="text"
                value={formData.sid}
                onChange={(e) => handleInputChange('sid', e.target.value)}
                placeholder="Oracle SID"
                className={inputClass(!!errors.oracle)}
              />
            </div>
          </div>
          {errors.oracle && <p className="mt-1 text-xs text-red-500">{errors.oracle}</p>}
          <p className="text-xs text-orange-600">请填写 Service Name 或 SID 其中之一</p>
        </div>
      )}

      {/* 测试结果 */}
      {testResult && (
        <div className={`p-3 rounded-lg flex items-center ${
          testResult.success 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {testResult.success ? (
            <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 mr-2 flex-shrink-0" />
          )}
          <span className="text-sm">{testResult.message}</span>
        </div>
      )}

      {/* 底部按钮 */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testing || !formData.db_type}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
        >
          {testing ? (
            <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-1.5" />
          )}
          测试连接
        </button>
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
          className="inline-flex items-center px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
        >
          {submitting ? (
            <>
              <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
              保存中...
            </>
          ) : (
            isEditing ? '保存修改' : '添加连接'
          )}
        </button>
      </div>
    </div>
  )
}

export default ConnectionForm
