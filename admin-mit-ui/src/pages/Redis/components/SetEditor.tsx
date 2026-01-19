/**
 * Redis Set 类型编辑器
 * 
 * 支持 Set 类型键值的查看和编辑，包括添加、删除集合成员
 * Requirements: 4.6
 */
import React, { useState, useEffect } from 'react'
import { Save, RefreshCw, Plus, Trash2, CheckCircle, XCircle, Search } from 'lucide-react'

export interface SetEditorProps {
  connectionId: number
  keyName: string
  initialValue: string[]
  ttl?: number
  readOnly?: boolean
  onSave?: (value: string[]) => Promise<void>
  onRefresh?: () => Promise<void>
}

interface SetMember {
  value: string
  isNew?: boolean
}

interface EditorState {
  members: SetMember[]
  searchTerm: string
  saving: boolean
  error: string | null
  isDirty: boolean
  showAddForm: boolean
  newValue: string
  toast: {
    show: boolean
    type: 'success' | 'error'
    message: string
  }
}

export const SetEditor: React.FC<SetEditorProps> = ({
  connectionId,
  keyName,
  initialValue,
  ttl,
  readOnly = false,
  onSave,
  onRefresh
}) => {
  const [state, setState] = useState<EditorState>({
    members: initialValue.map(value => ({ value })),
    searchTerm: '',
    saving: false,
    error: null,
    isDirty: false,
    showAddForm: false,
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
      members: initialValue.map(value => ({ value })),
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

  // 添加成员
  const handleAddMember = () => {
    if (!state.newValue.trim()) {
      showToast('error', '成员值不能为空')
      return
    }

    // 检查成员是否已存在（Set 不允许重复）
    if (state.members.some(m => m.value === state.newValue)) {
      showToast('error', '成员已存在，Set 不允许重复值')
      return
    }

    setState(prev => ({
      ...prev,
      members: [...prev.members, { value: state.newValue, isNew: true }],
      isDirty: true,
      showAddForm: false,
      newValue: ''
    }))
    showToast('success', '成员已添加，记得保存更改')
  }

  // 删除成员
  const handleDeleteMember = (value: string) => {
    if (!confirm('确定要删除这个成员吗？')) return

    setState(prev => ({
      ...prev,
      members: prev.members.filter(m => m.value !== value),
      isDirty: true
    }))
    showToast('success', '成员已删除，记得保存更改')
  }

  // 保存所有更改
  const handleSave = async () => {
    if (!onSave || readOnly) return

    try {
      setState(prev => ({ ...prev, saving: true, error: null }))
      
      const setValue = state.members.map(m => m.value)
      await onSave(setValue)
      
      setState(prev => ({ 
        ...prev, 
        isDirty: false,
        members: prev.members.map(m => ({ ...m, isNew: false }))
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

  // 过滤成员
  const filteredMembers = state.members.filter(m => 
    m.value.toLowerCase().includes(state.searchTerm.toLowerCase())
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
          <span>类型: <span className="font-medium text-purple-600">Set</span></span>
          <span>成员数: <span className="font-medium">{state.members.length}</span></span>
          {state.isDirty && (
            <span className="text-orange-600 font-medium">● 未保存</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {!readOnly && (
            <button
              onClick={() => setState(prev => ({ ...prev, showAddForm: !prev.showAddForm }))}
              className="inline-flex items-center px-3 py-1.5 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded"
            >
              <Plus className="w-4 h-4 mr-1" />
              添加成员
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

      {/* 添加成员表单 */}
      {state.showAddForm && !readOnly && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium text-purple-900">添加新成员</h4>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">成员值</label>
            <textarea
              value={state.newValue}
              onChange={(e) => setState(prev => ({ ...prev, newValue: e.target.value }))}
              placeholder="输入成员值..."
              rows={3}
              className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="mt-1 text-xs text-gray-500">注意: Set 不允许重复值</p>
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setState(prev => ({ ...prev, showAddForm: false, newValue: '' }))}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              取消
            </button>
            <button
              onClick={handleAddMember}
              className="px-3 py-1.5 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded"
            >
              添加
            </button>
          </div>
        </div>
      )}

      {/* 搜索框 */}
      {state.members.length > 5 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={state.searchTerm}
            onChange={(e) => setState(prev => ({ ...prev, searchTerm: e.target.value }))}
            placeholder="搜索成员..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      )}

      {/* 成员列表 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <div className="flex items-center justify-between text-xs font-medium text-gray-700">
            <span>成员值</span>
            <span>操作</span>
          </div>
        </div>
        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {filteredMembers.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              {state.searchTerm ? '没有匹配的成员' : 'Set 为空'}
            </div>
          ) : (
            filteredMembers.map((member, index) => (
              <div key={index} className={`px-4 py-3 hover:bg-gray-50 ${member.isNew ? 'bg-green-50' : ''}`}>
                <div className="flex items-center justify-between">
                  {/* 成员值 */}
                  <div className="flex-1 min-w-0 mr-4">
                    <pre className="font-mono text-sm text-gray-900 whitespace-pre-wrap break-all">
                      {member.value}
                    </pre>
                  </div>
                  
                  {/* 操作按钮 */}
                  {!readOnly && (
                    <button
                      onClick={() => handleDeleteMember(member.value)}
                      className="flex-shrink-0 p-1.5 text-red-600 hover:bg-red-50 rounded"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
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
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <p>• Set 类型是无序的字符串集合</p>
        <p>• 集合中的成员是唯一的，不允许重复</p>
        <p>• 适合存储标签、关注列表等不重复的数据</p>
        {!readOnly && <p>• 修改后点击"保存更改"按钮保存到 Redis</p>}
      </div>
    </div>
  )
}

export default SetEditor
