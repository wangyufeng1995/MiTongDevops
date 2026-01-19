/**
 * Redis Hash 类型编辑器
 * 
 * 支持 Hash 类型键值的查看和编辑，包括添加、修改、删除字段
 * Requirements: 4.4
 */
import React, { useState, useEffect } from 'react'
import { Save, RefreshCw, Plus, Trash2, Edit2, CheckCircle, XCircle, Search } from 'lucide-react'

export interface HashEditorProps {
  connectionId: number
  keyName: string
  initialValue: Record<string, string>
  ttl?: number
  readOnly?: boolean
  onSave?: (value: Record<string, string>) => Promise<void>
  onRefresh?: () => Promise<void>
}

interface HashField {
  field: string
  value: string
  isNew?: boolean
  isEditing?: boolean
  originalField?: string
}

interface EditorState {
  fields: HashField[]
  searchTerm: string
  saving: boolean
  error: string | null
  isDirty: boolean
  showAddForm: boolean
  newField: string
  newValue: string
  toast: {
    show: boolean
    type: 'success' | 'error'
    message: string
  }
}

export const HashEditor: React.FC<HashEditorProps> = ({
  connectionId,
  keyName,
  initialValue,
  ttl,
  readOnly = false,
  onSave,
  onRefresh
}) => {
  const [state, setState] = useState<EditorState>({
    fields: Object.entries(initialValue).map(([field, value]) => ({ field, value })),
    searchTerm: '',
    saving: false,
    error: null,
    isDirty: false,
    showAddForm: false,
    newField: '',
    newValue: '',
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
      fields: Object.entries(initialValue).map(([field, value]) => ({ field, value })),
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

  // 添加新字段
  const handleAddField = () => {
    if (!state.newField.trim()) {
      showToast('error', '字段名不能为空')
      return
    }

    // 检查字段是否已存在
    if (state.fields.some(f => f.field === state.newField)) {
      showToast('error', '字段已存在')
      return
    }

    setState(prev => ({
      ...prev,
      fields: [...prev.fields, { field: state.newField, value: state.newValue, isNew: true }],
      isDirty: true,
      showAddForm: false,
      newField: '',
      newValue: ''
    }))
    showToast('success', '字段已添加，记得保存更改')
  }

  // 开始编辑字段
  const handleStartEdit = (index: number) => {
    setState(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => 
        i === index ? { ...f, isEditing: true, originalField: f.field } : f
      )
    }))
  }

  // 更新字段名
  const handleFieldNameChange = (index: number, newField: string) => {
    setState(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => 
        i === index ? { ...f, field: newField } : f
      ),
      isDirty: true
    }))
  }

  // 更新字段值
  const handleFieldValueChange = (index: number, newValue: string) => {
    setState(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => 
        i === index ? { ...f, value: newValue } : f
      ),
      isDirty: true
    }))
  }

  // 完成编辑
  const handleFinishEdit = (index: number) => {
    setState(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => 
        i === index ? { ...f, isEditing: false, originalField: undefined } : f
      )
    }))
  }

  // 删除字段
  const handleDeleteField = (index: number) => {
    if (!confirm('确定要删除这个字段吗？')) return

    setState(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index),
      isDirty: true
    }))
    showToast('success', '字段已删除，记得保存更改')
  }

  // 保存所有更改
  const handleSave = async () => {
    if (!onSave || readOnly) return

    try {
      setState(prev => ({ ...prev, saving: true, error: null }))
      
      // 转换为对象格式
      const hashValue = state.fields.reduce((acc, { field, value }) => {
        acc[field] = value
        return acc
      }, {} as Record<string, string>)

      await onSave(hashValue)
      setState(prev => ({ 
        ...prev, 
        isDirty: false,
        fields: prev.fields.map(f => ({ ...f, isNew: false }))
      }))
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
      setState(prev => ({ ...prev, isDirty: false, error: null, showAddForm: false }))
      showToast('success', '刷新成功')
    } catch (error: any) {
      showToast('error', error.message || '刷新失败')
    }
  }

  // 过滤字段
  const filteredFields = state.fields.filter(f => 
    f.field.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
    f.value.toLowerCase().includes(state.searchTerm.toLowerCase())
  )

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
          <span>类型: <span className="font-medium text-red-600">Hash</span></span>
          <span>字段数: <span className="font-medium">{state.fields.length}</span></span>
          {state.isDirty && (
            <span className="text-orange-600 font-medium">● 未保存</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {!readOnly && (
            <button
              onClick={() => setState(prev => ({ ...prev, showAddForm: !prev.showAddForm }))}
              className="inline-flex items-center px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded"
            >
              <Plus className="w-4 h-4 mr-1" />
              添加字段
            </button>
          )}
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

      {/* 添加字段表单 */}
      {state.showAddForm && !readOnly && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium text-blue-900">添加新字段</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">字段名</label>
              <input
                type="text"
                value={state.newField}
                onChange={(e) => setState(prev => ({ ...prev, newField: e.target.value }))}
                placeholder="field_name"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">字段值</label>
              <input
                type="text"
                value={state.newValue}
                onChange={(e) => setState(prev => ({ ...prev, newValue: e.target.value }))}
                placeholder="field_value"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setState(prev => ({ ...prev, showAddForm: false, newField: '', newValue: '' }))}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              取消
            </button>
            <button
              onClick={handleAddField}
              className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded"
            >
              添加
            </button>
          </div>
        </div>
      )}

      {/* 搜索框 */}
      {state.fields.length > 5 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={state.searchTerm}
            onChange={(e) => setState(prev => ({ ...prev, searchTerm: e.target.value }))}
            placeholder="搜索字段或值..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      )}

      {/* 字段列表 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-700">
            <div className="col-span-4">字段名</div>
            <div className="col-span-6">字段值</div>
            <div className="col-span-2 text-right">操作</div>
          </div>
        </div>
        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {filteredFields.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              {state.searchTerm ? '没有匹配的字段' : 'Hash 为空'}
            </div>
          ) : (
            filteredFields.map((field, index) => (
              <div key={index} className={`px-4 py-3 hover:bg-gray-50 ${field.isNew ? 'bg-green-50' : ''}`}>
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* 字段名 */}
                  <div className="col-span-4">
                    {field.isEditing ? (
                      <input
                        type="text"
                        value={field.field}
                        onChange={(e) => handleFieldNameChange(index, e.target.value)}
                        className="w-full px-2 py-1 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    ) : (
                      <span className="font-mono text-sm text-gray-900 break-all">{field.field}</span>
                    )}
                  </div>
                  
                  {/* 字段值 */}
                  <div className="col-span-6">
                    {field.isEditing || !readOnly ? (
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => handleFieldValueChange(index, e.target.value)}
                        readOnly={readOnly && !field.isEditing}
                        className={`w-full px-2 py-1 text-sm font-mono border rounded focus:outline-none focus:ring-2 focus:ring-red-500 ${
                          readOnly && !field.isEditing ? 'bg-gray-50 border-gray-200' : 'border-gray-300'
                        }`}
                      />
                    ) : (
                      <span className="font-mono text-sm text-gray-700 break-all">{field.value}</span>
                    )}
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="col-span-2 flex justify-end space-x-1">
                    {!readOnly && (
                      <>
                        {field.isEditing ? (
                          <button
                            onClick={() => handleFinishEdit(index)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="完成编辑"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(index)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteField(index)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
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
        <p>• Hash 类型存储字段-值对的映射</p>
        <p>• 适合存储对象数据，如用户信息、配置项等</p>
        {!readOnly && <p>• 可以添加、修改、删除字段，修改后点击"保存更改"</p>}
      </div>
    </div>
  )
}

export default HashEditor
