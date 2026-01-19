/**
 * Redis 键详情组件
 * 
 * 根据键类型显示不同的编辑器，支持 TTL 设置
 * Requirements: 4.1, 4.10, 4.11
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Save,
  Clock,
  Key,
  Hash,
  List,
  Layers,
  SortAsc,
  Database,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  Infinity
} from 'lucide-react'
import { Loading } from '../../components/Loading'
import { useAuthStore } from '../../store/auth'
import { redisService, RedisConnection, KeyInfo, KeyDetail as KeyDetailType } from '../../services/redis'
import { showRedisError } from '../../utils/redisErrorHandler'

interface KeyDetailProps {
  connection: RedisConnection
  keyInfo: KeyInfo
  onClose: () => void
  onUpdated: () => void
}

interface KeyDetailState {
  loading: boolean
  saving: boolean
  error: string | null
  keyDetail: KeyDetailType | null
  // 编辑状态
  editedValue: string
  editedTTL: number | null
  showTTLInput: boolean
  // 消息提示
  toast: {
    show: boolean
    type: 'success' | 'error' | 'warning' | 'info'
    message: string
  }
}

// 键类型图标映射
const KEY_TYPE_ICONS: Record<string, React.ReactNode> = {
  string: <Key className="w-5 h-5 text-green-500" />,
  list: <List className="w-5 h-5 text-blue-500" />,
  set: <Layers className="w-5 h-5 text-purple-500" />,
  zset: <SortAsc className="w-5 h-5 text-orange-500" />,
  hash: <Hash className="w-5 h-5 text-red-500" />,
  stream: <Database className="w-5 h-5 text-cyan-500" />
}

// 键类型颜色映射
const KEY_TYPE_COLORS: Record<string, string> = {
  string: 'bg-green-100 text-green-800 border-green-200',
  list: 'bg-blue-100 text-blue-800 border-blue-200',
  set: 'bg-purple-100 text-purple-800 border-purple-200',
  zset: 'bg-orange-100 text-orange-800 border-orange-200',
  hash: 'bg-red-100 text-red-800 border-red-200',
  stream: 'bg-cyan-100 text-cyan-800 border-cyan-200'
}

export const KeyDetail: React.FC<KeyDetailProps> = ({
  connection,
  keyInfo,
  onClose,
  onUpdated
}) => {
  const { hasPermission } = useAuthStore()

  const [state, setState] = useState<KeyDetailState>({
    loading: true,
    saving: false,
    error: null,
    keyDetail: null,
    editedValue: '',
    editedTTL: null,
    showTTLInput: false,
    toast: {
      show: false,
      type: 'info',
      message: ''
    }
  })

  // 显示消息提示
  const showToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setState(prev => ({
      ...prev,
      toast: { show: true, type, message }
    }))
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        toast: { ...prev.toast, show: false }
      }))
    }, 3000)
  }, [])

  // 加载键详情
  const loadKeyDetail = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))

      const detail = await redisService.getKeyDetail(connection.id, keyInfo.key)

      // 格式化值用于显示
      let displayValue = ''
      if (detail.type === 'string') {
        displayValue = typeof detail.value === 'string' ? detail.value : JSON.stringify(detail.value)
      } else {
        displayValue = JSON.stringify(detail.value, null, 2)
      }

      setState(prev => ({
        ...prev,
        keyDetail: detail,
        editedValue: displayValue,
        editedTTL: detail.ttl > 0 ? detail.ttl : null,
        loading: false
      }))
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || '加载键详情失败',
        loading: false
      }))
    }
  }, [connection.id, keyInfo.key])

  // 初始加载
  useEffect(() => {
    loadKeyDetail()
  }, [loadKeyDetail])

  // 保存键值
  const handleSave = async () => {
    if (!state.keyDetail) return

    try {
      setState(prev => ({ ...prev, saving: true }))

      // 解析值
      let valueToSave: any = state.editedValue
      if (state.keyDetail.type !== 'string') {
        try {
          valueToSave = JSON.parse(state.editedValue)
        } catch {
          showToast('error', '值格式不正确，请检查 JSON 格式')
          setState(prev => ({ ...prev, saving: false }))
          return
        }
      }

      await redisService.updateKey(connection.id, keyInfo.key, {
        value: valueToSave,
        ttl: state.editedTTL && state.editedTTL > 0 ? state.editedTTL : undefined
      })

      showToast('success', '键值保存成功')
      onUpdated()
    } catch (error: any) {
      showRedisError(error, '保存键值')
    } finally {
      setState(prev => ({ ...prev, saving: false }))
    }
  }

  // 设置 TTL
  const handleSetTTL = async () => {
    if (!state.keyDetail) return

    try {
      setState(prev => ({ ...prev, saving: true }))

      const ttl = state.editedTTL || -1
      await redisService.setKeyTTL(connection.id, keyInfo.key, ttl)

      showToast('success', ttl > 0 ? `TTL 已设置为 ${ttl} 秒` : 'TTL 已移除')
      loadKeyDetail()
    } catch (error: any) {
      showRedisError(error, '设置 TTL')
    } finally {
      setState(prev => ({ ...prev, saving: false, showTTLInput: false }))
    }
  }

  // 移除 TTL
  const handleRemoveTTL = async () => {
    setState(prev => ({ ...prev, editedTTL: -1 }))
    try {
      setState(prev => ({ ...prev, saving: true }))
      await redisService.setKeyTTL(connection.id, keyInfo.key, -1)
      showToast('success', 'TTL 已移除，键将永不过期')
      loadKeyDetail()
    } catch (error: any) {
      showRedisError(error, '移除 TTL')
    } finally {
      setState(prev => ({ ...prev, saving: false }))
    }
  }

  // 复制键名
  const handleCopyKey = () => {
    navigator.clipboard.writeText(keyInfo.key)
    showToast('success', '键名已复制到剪贴板')
  }

  // 复制值
  const handleCopyValue = () => {
    navigator.clipboard.writeText(state.editedValue)
    showToast('success', '值已复制到剪贴板')
  }

  // 格式化 TTL 显示
  const formatTTL = (ttl: number): string => {
    if (ttl === -1) return '永不过期'
    if (ttl === -2) return '键不存在'
    if (ttl < 60) return `${ttl} 秒`
    if (ttl < 3600) return `${Math.floor(ttl / 60)} 分 ${ttl % 60} 秒`
    if (ttl < 86400) return `${Math.floor(ttl / 3600)} 时 ${Math.floor((ttl % 3600) / 60)} 分`
    return `${Math.floor(ttl / 86400)} 天 ${Math.floor((ttl % 86400) / 3600)} 时`
  }

  // 加载状态
  if (state.loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loading size="lg" />
      </div>
    )
  }

  // 错误状态
  if (state.error) {
    return (
      <div className="text-center py-8">
        <XCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
        <p className="text-red-600">{state.error}</p>
        <button
          onClick={loadKeyDetail}
          className="mt-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-800"
        >
          重试
        </button>
      </div>
    )
  }

  if (!state.keyDetail) return null

  return (
    <div className="space-y-4">
      {/* Toast 消息提示 */}
      {state.toast.show && (
        <div className="fixed top-4 right-4 z-[100] max-w-md animate-in slide-in-from-top-2 fade-in duration-300">
          <div className={`px-4 py-3 rounded-lg shadow-xl border flex items-start space-x-3 ${
            state.toast.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : state.toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : state.toast.type === 'warning'
              ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
              state.toast.type === 'success' ? 'bg-green-100' :
              state.toast.type === 'error' ? 'bg-red-100' :
              state.toast.type === 'warning' ? 'bg-yellow-100' : 'bg-blue-100'
            }`}>
              {state.toast.type === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
              {state.toast.type === 'error' && <XCircle className="w-4 h-4 text-red-600" />}
              {state.toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-600" />}
              {state.toast.type === 'info' && <Database className="w-4 h-4 text-blue-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{state.toast.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* 键信息卡片 */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        {/* 键名 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {KEY_TYPE_ICONS[state.keyDetail.type]}
            <span className="font-mono text-sm text-gray-900 break-all">{keyInfo.key}</span>
          </div>
          <button
            onClick={handleCopyKey}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
            title="复制键名"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>

        {/* 元信息 */}
        <div className="flex flex-wrap gap-4 text-sm">
          {/* 类型 */}
          <div className="flex items-center space-x-2">
            <span className="text-gray-500">类型:</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${
              KEY_TYPE_COLORS[state.keyDetail.type] || 'bg-gray-100 text-gray-800 border-gray-200'
            }`}>
              {state.keyDetail.type}
            </span>
          </div>

          {/* 编码 */}
          {state.keyDetail.encoding && (
            <div className="flex items-center space-x-2">
              <span className="text-gray-500">编码:</span>
              <span className="text-gray-900">{state.keyDetail.encoding}</span>
            </div>
          )}

          {/* 大小 */}
          {state.keyDetail.size !== undefined && (
            <div className="flex items-center space-x-2">
              <span className="text-gray-500">大小:</span>
              <span className="text-gray-900">{state.keyDetail.size}</span>
            </div>
          )}

          {/* TTL */}
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-gray-500">TTL:</span>
            <span className={`${state.keyDetail.ttl === -1 ? 'text-gray-500' : 'text-orange-600 font-medium'}`}>
              {formatTTL(state.keyDetail.ttl)}
            </span>
          </div>
        </div>
      </div>

      {/* TTL 设置 */}
      {hasPermission('redis:update') && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700 flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              过期时间设置
            </h4>
            <div className="flex items-center space-x-2">
              {state.showTTLInput ? (
                <>
                  <input
                    type="number"
                    min="1"
                    value={state.editedTTL || ''}
                    onChange={(e) => setState(prev => ({ ...prev, editedTTL: parseInt(e.target.value) || null }))}
                    placeholder="秒"
                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    onClick={handleSetTTL}
                    disabled={state.saving}
                    className="px-3 py-1 text-sm text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
                  >
                    确定
                  </button>
                  <button
                    onClick={() => setState(prev => ({ ...prev, showTTLInput: false }))}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                  >
                    取消
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setState(prev => ({ ...prev, showTTLInput: true }))}
                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded hover:bg-blue-50"
                  >
                    设置 TTL
                  </button>
                  {state.keyDetail.ttl > 0 && (
                    <button
                      onClick={handleRemoveTTL}
                      disabled={state.saving}
                      className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 flex items-center"
                    >
                      <Infinity className="w-3 h-3 mr-1" />
                      永不过期
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 值编辑器 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">值</h4>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyValue}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              title="复制值"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={loadKeyDetail}
              disabled={state.loading}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              title="刷新"
            >
              <RefreshCw className={`w-4 h-4 ${state.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 根据类型显示不同的编辑器 */}
        {state.keyDetail.type === 'string' ? (
          <textarea
            value={state.editedValue}
            onChange={(e) => setState(prev => ({ ...prev, editedValue: e.target.value }))}
            readOnly={!hasPermission('redis:update')}
            className="w-full h-48 px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-y"
            placeholder="键值内容"
          />
        ) : (
          <div className="relative">
            <textarea
              value={state.editedValue}
              onChange={(e) => setState(prev => ({ ...prev, editedValue: e.target.value }))}
              readOnly={!hasPermission('redis:update')}
              className="w-full h-64 px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-y"
              placeholder="JSON 格式的值"
            />
            <div className="absolute top-2 right-2 text-xs text-gray-400">
              JSON 格式
            </div>
          </div>
        )}

        {/* 类型提示 */}
        <p className="text-xs text-gray-500">
          {state.keyDetail.type === 'string' && '字符串类型，直接编辑文本内容'}
          {state.keyDetail.type === 'hash' && 'Hash 类型，使用 JSON 对象格式编辑'}
          {state.keyDetail.type === 'list' && 'List 类型，使用 JSON 数组格式编辑'}
          {state.keyDetail.type === 'set' && 'Set 类型，使用 JSON 数组格式编辑'}
          {state.keyDetail.type === 'zset' && 'ZSet 类型，使用 JSON 数组格式编辑 (包含 score)'}
        </p>
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          关闭
        </button>
        {hasPermission('redis:update') && (
          <button
            onClick={handleSave}
            disabled={state.saving}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {state.saving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                保存
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default KeyDetail
