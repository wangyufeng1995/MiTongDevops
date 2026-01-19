/**
 * Redis List 类型编辑器
 * 
 * 支持 List 类型键值的查看和编辑，包括添加、删除列表元素
 * Requirements: 4.5
 */
import React, { useState, useEffect } from 'react'
import { Save, RefreshCw, Plus, Trash2, CheckCircle, XCircle, ArrowUp, ArrowDown } from 'lucide-react'

export interface ListEditorProps {
  connectionId: number
  keyName: string
  initialValue: string[]
  ttl?: number
  readOnly?: boolean
  onSave?: (value: string[]) => Promise<void>
  onRefresh?: () => Promise<void>
}

interface ListElement {
  index: number
  value: string
  isNew?: boolean
}

interface EditorState {
  elements: ListElement[]
  saving: boolean
  error: string | null
  isDirty: boolean
  showAddForm: boolean
  newValue: string
  addPosition: 'head' | 'tail'
  toast: {
    show: boolean
    type: 'success' | 'error'
    message: string
  }
}

export const ListEditor: React.FC<ListEditorProps> = ({
  connectionId,
  keyName,
  initialValue,
  ttl,
  readOnly = false,
  onSave,
  onRefresh
}) => {
  const [state, setState] = useState<EditorState>({
    elements: initialValue.map((value, index) => ({ index, value })),
    saving: false,
    error: null,
    isDirty: false,
    showAddForm: false,
    newValue: '',
    addPosition: 'tail',
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
      elements: initialValue.map((value, index) => ({ index, value })),
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

  // 添加元素
  const handleAddElement = () => {
    if (!state.newValue.trim()) {
      showToast('error', '元素值不能为空')
      return
    }

    setState(prev => {
      const newElement: ListElement = {
        index: prev.elements.length,
        value: state.newValue,
        isNew: true
      }
      
      const newElements = state.addPosition === 'head'
        ? [newElement, ...prev.elements.map((e, i) => ({ ...e, index: i + 1 }))]
        : [...prev.elements, newElement]

      return {
        ...prev,
        elements: newElements,
        isDirty: true,
        showAddForm: false,
        newValue: ''
      }
    })
    showToast('success', '元素已添加，记得保存更改')
  }

  // 更新元素值
  const handleElementChange = (index: number, newValue: string) => {
    setState(prev => ({
      ...prev,
      elements: prev.elements.map((e, i) => 
        i === index ? { ...e, value: newValue } : e
      ),
      isDirty: true
    }))
  }

  // 删除元素
  const handleDeleteElement = (index: number) => {
    if (!confirm('确定要删除这个元素吗？')) return

    setState(prev => ({
      ...prev,
      elements: prev.elements.filter((_, i) => i !== index).map((e, i) => ({ ...e, index: i })),
      isDirty: true
    }))
    showToast('success', '元素已删除，记得保存更改')
  }

  // 上移元素
  const handleMoveUp = (index: number) => {
    if (index === 0) return

    setState(prev => {
      const newElements = [...prev.elements]
      const temp = newElements[index]
      newElements[index] = newElements[index - 1]
      newElements[index - 1] = temp
      return {
        ...prev,
        elements: newElements.map((e, i) => ({ ...e, index: i })),
        isDirty: true
      }
    })
  }

  // 下移元素
  const handleMoveDown = (index: number) => {
    if (index === state.elements.length - 1) return

    setState(prev => {
      const newElements = [...prev.elements]
      const temp = newElements[index]
      newElements[index] = newElements[index + 1]
      newElements[index + 1] = temp
      return {
        ...prev,
        elements: newElements.map((e, i) => ({ ...e, index: i })),
        isDirty: true
      }
    })
  }

  // 保存所有更改
  const handleSave = async () => {
    if (!onSave || readOnly) return

    try {
      setState(prev => ({ ...prev, saving: true, error: null }))
      
      const listValue = state.elements.map(e => e.value)
      await onSave(listValue)
      
      setState(prev => ({ 
        ...prev, 
        isDirty: false,
        elements: prev.elements.map(e => ({ ...e, isNew: false }))
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
          <span>类型: <span className="font-medium text-blue-600">List</span></span>
          <span>元素数: <span className="font-medium">{state.elements.length}</span></span>
          {state.isDirty && (
            <span className="text-orange-600 font-medium">● 未保存</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {!readOnly && (
            <button
              onClick={() => setState(prev => ({ ...prev, showAddForm: !prev.showAddForm }))}
              className="inline-flex items-center px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded"
            >
              <Plus className="w-4 h-4 mr-1" />
              添加元素
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

      {/* 添加元素表单 */}
      {state.showAddForm && !readOnly && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium text-blue-900">添加新元素</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">元素值</label>
              <textarea
                value={state.newValue}
                onChange={(e) => setState(prev => ({ ...prev, newValue: e.target.value }))}
                placeholder="输入元素值..."
                rows={3}
                className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">添加位置</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="head"
                    checked={state.addPosition === 'head'}
                    onChange={(e) => setState(prev => ({ ...prev, addPosition: e.target.value as 'head' | 'tail' }))}
                    className="mr-2"
                  />
                  <span className="text-sm">列表头部 (LPUSH)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="tail"
                    checked={state.addPosition === 'tail'}
                    onChange={(e) => setState(prev => ({ ...prev, addPosition: e.target.value as 'head' | 'tail' }))}
                    className="mr-2"
                  />
                  <span className="text-sm">列表尾部 (RPUSH)</span>
                </label>
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setState(prev => ({ ...prev, showAddForm: false, newValue: '' }))}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              取消
            </button>
            <button
              onClick={handleAddElement}
              className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded"
            >
              添加
            </button>
          </div>
        </div>
      )}

      {/* 元素列表 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-700">
            <div className="col-span-1">索引</div>
            <div className="col-span-9">值</div>
            <div className="col-span-2 text-right">操作</div>
          </div>
        </div>
        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {state.elements.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              List 为空
            </div>
          ) : (
            state.elements.map((element, index) => (
              <div key={index} className={`px-4 py-3 hover:bg-gray-50 ${element.isNew ? 'bg-green-50' : ''}`}>
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* 索引 */}
                  <div className="col-span-1">
                    <span className="inline-flex items-center justify-center w-8 h-8 text-xs font-medium text-gray-700 bg-gray-100 rounded">
                      {index}
                    </span>
                  </div>
                  
                  {/* 值 */}
                  <div className="col-span-9">
                    <textarea
                      value={element.value}
                      onChange={(e) => handleElementChange(index, e.target.value)}
                      readOnly={readOnly}
                      rows={2}
                      className={`w-full px-2 py-1 text-sm font-mono border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y ${
                        readOnly ? 'bg-gray-50 border-gray-200' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="col-span-2 flex justify-end space-x-1">
                    {!readOnly && (
                      <>
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="上移"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === state.elements.length - 1}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="下移"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteElement(index)}
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
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <p>• List 类型是有序的字符串列表</p>
        <p>• 索引从 0 开始，支持从头部或尾部添加元素</p>
        <p>• 可以调整元素顺序，或删除指定元素</p>
        {!readOnly && <p>• 修改后点击"保存更改"按钮保存到 Redis</p>}
      </div>
    </div>
  )
}

export default ListEditor
