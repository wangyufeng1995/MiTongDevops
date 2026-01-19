/**
 * Redis String 类型编辑器
 * 
 * 支持 String 类型键值的查看和编辑
 * Requirements: 4.2, 4.3
 */
import React, { useState, useEffect } from 'react'
import { Save, RefreshCw, Copy, CheckCircle, XCircle } from 'lucide-react'

export interface StringEditorProps {
  connectionId: number
  keyName: string
  initialValue: string
  ttl?: number
  readOnly?: boolean
  onSave?: (value: string) => Promise<void>
  onRefresh?: () => Promise<void>
}

interface EditorState {
  value: string
  saving: boolean
  error: string | null
  isDirty: boolean
  toast: {
    show: boolean
    type: 'success' | 'error'
    message: string
  }
}

export const StringEditor: React.FC<StringEditorProps> = ({
  connectionId,
  keyName,
  initialValue,
  ttl,
  readOnly = false,
  onSave,
  onRefresh
}) => {
  const [state, setState] = useState<EditorState>({
    value: initialValue,
    saving: false,
    error: null,
    isDirty: false,
    toast: {
      show: false,
      type: 'success',
      message: ''
    }
  })

  // 当初始值变化时更新编辑器
  useEffect(() => {
    setState(prev => ({
      ...prev,
      value: initialValue,
      isDirty: false
    }))
  }, [initialValue])

  // 显示消息提示
  const showToast = (type: 'success' | 'error', message: string) => {
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
  }

  // 处理值变化
  const handleValueChange = (newValue: string) => {
    setState(prev => ({
      ...prev,
      value: newValue,
      isDirty: newValue !== initialValue,
      error: null
    }))
  }

  // 保存值
  const handleSave = async () => {
    if (!onSave || readOnly) return

    try {
      setState(prev => ({ ...prev, saving: true, error: null }))
      await onSave(state.value)
      setState(prev => ({ ...prev, isDirty: false }))
      showToast('success', '保存成功')
    } catch (error: any) {
      const errorMsg = error.message || '保存失败'
      setState(prev => ({ ...prev, error: errorMsg }))
      showToast('error', errorMsg)
    } finally {
      setState(prev => ({ ...prev, saving: false }))
    }
  }

  // 刷新值
  const handleRefresh = async () => {
    if (!onRefresh) return

    try {
      await onRefresh()
      setState(prev => ({ ...prev, isDirty: false, error: null }))
      showToast('success', '刷新成功')
    } catch (error: any) {
      showToast('error', error.message || '刷新失败')
    }
  }

  // 复制值
  const handleCopy = () => {
    navigator.clipboard.writeText(state.value)
    showToast('success', '已复制到剪贴板')
  }

  // 获取字节大小
  const getByteSize = (str: string): string => {
    const bytes = new Blob([str]).size
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="space-y-4">
      {/* Toast 消息提示 */}
      {state.toast.show && (
        <div className="fixed top-4 right-4 z-[100] max-w-md animate-in slide-in-from-top-2 fade-in duration-300">
          <div className={`px-4 py-3 rounded-lg shadow-xl border flex items-start space-x-3 ${
            state.toast.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
              state.toast.type === 'success' ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {state.toast.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{state.toast.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* 编辑器头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <span>类型: <span className="font-medium text-green-600">String</span></span>
          <span>大小: <span className="font-medium">{getByteSize(state.value)}</span></span>
          <span>字符数: <span className="font-medium">{state.value.length}</span></span>
          {state.isDirty && (
            <span className="text-orange-600 font-medium">● 未保存</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            title="复制值"
          >
            <Copy className="w-4 h-4" />
          </button>
          {onRefresh && (
            <button
              onClick={handleRefresh}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              title="刷新"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 文本编辑器 */}
      <div className="relative">
        <textarea
          value={state.value}
          onChange={(e) => handleValueChange(e.target.value)}
          readOnly={readOnly}
          className={`w-full h-96 px-4 py-3 font-mono text-sm border rounded-lg focus:outline-none focus:ring-2 resize-y ${
            readOnly
              ? 'bg-gray-50 text-gray-700 border-gray-200 cursor-not-allowed'
              : 'bg-white text-gray-900 border-gray-300 focus:ring-red-500'
          }`}
          placeholder={readOnly ? '(空值)' : '输入字符串值...'}
          spellCheck={false}
        />
        {state.error && (
          <div className="absolute bottom-2 left-2 right-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {state.error}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      {!readOnly && onSave && (
        <div className="flex justify-end space-x-3">
          <button
            onClick={handleSave}
            disabled={!state.isDirty || state.saving}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.saving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                保存更改
              </>
            )}
          </button>
        </div>
      )}

      {/* 提示信息 */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>• String 类型存储文本或二进制数据</p>
        <p>• 最大值大小: 512 MB</p>
        {!readOnly && <p>• 修改后点击"保存更改"按钮保存到 Redis</p>}
      </div>
    </div>
  )
}

export default StringEditor
