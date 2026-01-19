/**
 * Redis ZSet (Sorted Set) 类型编辑器
 * 
 * 支持 ZSet 类型键值的查看和编辑，包括添加、修改、删除有序集合成员及分数
 * Requirements: 4.7
 */
import React, { useState, useEffect } from 'react'
import { Save, RefreshCw, Plus, Trash2, Edit2, CheckCircle, XCircle, Search, ArrowUpDown } from 'lucide-react'

export interface ZSetEditorProps {
  connectionId: number
  keyName: string
  initialValue: Array<{ member: string; score: number }>
  ttl?: number
  readOnly?: boolean
  onSave?: (value: Array<{ member: string; score: number }>) => Promise<void>
  onRefresh?: () => Promise<void>
}

interface ZSetMember {
  member: string
  score: number
  isNew?: boolean
  isEditing?: boolean
  originalMember?: string
}

interface EditorState {
  members: ZSetMember[]
  searchTerm: string
  sortOrder: 'asc' | 'desc'
  saving: boolean
  error: string | null
  isDirty: boolean
  showAddForm: boolean
  newMember: string
  newScore: string
  toast: {
    show: boolean
    type: 'success' | 'error'
    message: string
  }
}

export const ZSetEditor: React.FC<ZSetEditorProps> = ({
  connectionId,
  keyName,
  initialValue,
  ttl,
  readOnly = false,
  onSave,
  onRefresh
}) => {
  const [state, setState] = useState<EditorState>({
    members: initialValue.map(({ member, score }) => ({ member, score })),
    searchTerm: '',
    sortOrder: 'asc',
    saving: false,
    error: null,
    isDirty: false,
    showAddForm: false,
    newMember: '',
    newScore: '',
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
      members: initialValue.map(({ member, score }) => ({ member, score })),
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
    if (!state.newMember.trim()) {
      showToast('error', '成员值不能为空')
      return
    }

    const score = parseFloat(state.newScore)
    if (isNaN(score)) {
      showToast('error', '分数必须是有效的数字')
      return
    }

    // 检查成员是否已存在
    if (state.members.some(m => m.member === state.newMember)) {
      showToast('error', '成员已存在，ZSet 不允许重复成员')
      return
    }

    setState(prev => ({
      ...prev,
      members: [...prev.members, { member: state.newMember, score, isNew: true }],
      isDirty: true,
      showAddForm: false,
      newMember: '',
      newScore: ''
    }))
    showToast('success', '成员已添加，记得保存更改')
  }

  // 开始编辑成员
  const handleStartEdit = (index: number) => {
    setState(prev => ({
      ...prev,
      members: prev.members.map((m, i) => 
        i === index ? { ...m, isEditing: true, originalMember: m.member } : m
      )
    }))
  }

  // 更新成员名
  const handleMemberChange = (index: number, newMember: string) => {
    setState(prev => ({
      ...prev,
      members: prev.members.map((m, i) => 
        i === index ? { ...m, member: newMember } : m
      ),
      isDirty: true
    }))
  }

  // 更新分数
  const handleScoreChange = (index: number, newScore: string) => {
    const score = parseFloat(newScore)
    if (isNaN(score)) return

    setState(prev => ({
      ...prev,
      members: prev.members.map((m, i) => 
        i === index ? { ...m, score } : m
      ),
      isDirty: true
    }))
  }

  // 完成编辑
  const handleFinishEdit = (index: number) => {
    setState(prev => ({
      ...prev,
      members: prev.members.map((m, i) => 
        i === index ? { ...m, isEditing: false, originalMember: undefined } : m
      )
    }))
  }

  // 删除成员
  const handleDeleteMember = (index: number) => {
    if (!confirm('确定要删除这个成员吗？')) return

    setState(prev => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== index),
      isDirty: true
    }))
    showToast('success', '成员已删除，记得保存更改')
  }

  // 切换排序顺序
  const toggleSortOrder = () => {
    setState(prev => ({
      ...prev,
      sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }))
  }

  // 保存所有更改
  const handleSave = async () => {
    if (!onSave || readOnly) return

    try {
      setState(prev => ({ ...prev, saving: true, error: null }))
      
      const zsetValue = state.members.map(({ member, score }) => ({ member, score }))
      await onSave(zsetValue)
      
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

  // 过滤和排序成员
  const filteredAndSortedMembers = state.members
    .filter(m => 
      m.member.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
      m.score.toString().includes(state.searchTerm)
    )
    .sort((a, b) => {
      const diff = a.score - b.score
      return state.sortOrder === 'asc' ? diff : -diff
    })

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
          <span>类型: <span className="font-medium text-orange-600">ZSet</span></span>
          <span>成员数: <span className="font-medium">{state.members.length}</span></span>
          {state.isDirty && (
            <span className="text-orange-600 font-medium">● 未保存</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleSortOrder}
            className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
            title="切换排序"
          >
            <ArrowUpDown className="w-4 h-4 mr-1" />
            {state.sortOrder === 'asc' ? '升序' : '降序'}
          </button>
          {!readOnly && (
            <button
              onClick={() => setState(prev => ({ ...prev, showAddForm: !prev.showAddForm }))}
              className="inline-flex items-center px-3 py-1.5 text-sm text-white bg-orange-600 hover:bg-orange-700 rounded"
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
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium text-orange-900">添加新成员</h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">成员值</label>
              <input
                type="text"
                value={state.newMember}
                onChange={(e) => setState(prev => ({ ...prev, newMember: e.target.value }))}
                placeholder="member_value"
                className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">分数</label>
              <input
                type="number"
                step="any"
                value={state.newScore}
                onChange={(e) => setState(prev => ({ ...prev, newScore: e.target.value }))}
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">注意: ZSet 不允许重复成员，但可以有相同的分数</p>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setState(prev => ({ ...prev, showAddForm: false, newMember: '', newScore: '' }))}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              取消
            </button>
            <button
              onClick={handleAddMember}
              className="px-3 py-1.5 text-sm text-white bg-orange-600 hover:bg-orange-700 rounded"
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
            placeholder="搜索成员或分数..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      )}

      {/* 成员列表 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-700">
            <div className="col-span-2">分数</div>
            <div className="col-span-8">成员值</div>
            <div className="col-span-2 text-right">操作</div>
          </div>
        </div>
        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {filteredAndSortedMembers.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              {state.searchTerm ? '没有匹配的成员' : 'ZSet 为空'}
            </div>
          ) : (
            filteredAndSortedMembers.map((member, index) => (
              <div key={index} className={`px-4 py-3 hover:bg-gray-50 ${member.isNew ? 'bg-green-50' : ''}`}>
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* 分数 */}
                  <div className="col-span-2">
                    {member.isEditing || !readOnly ? (
                      <input
                        type="number"
                        step="any"
                        value={member.score}
                        onChange={(e) => handleScoreChange(index, e.target.value)}
                        readOnly={readOnly && !member.isEditing}
                        className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                          readOnly && !member.isEditing ? 'bg-gray-50 border-gray-200' : 'border-gray-300'
                        }`}
                      />
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 text-sm font-medium text-orange-700 bg-orange-100 rounded">
                        {member.score}
                      </span>
                    )}
                  </div>
                  
                  {/* 成员值 */}
                  <div className="col-span-8">
                    {member.isEditing ? (
                      <input
                        type="text"
                        value={member.member}
                        onChange={(e) => handleMemberChange(index, e.target.value)}
                        className="w-full px-2 py-1 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    ) : (
                      <span className="font-mono text-sm text-gray-900 break-all">{member.member}</span>
                    )}
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="col-span-2 flex justify-end space-x-1">
                    {!readOnly && (
                      <>
                        {member.isEditing ? (
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
                          onClick={() => handleDeleteMember(index)}
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
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <p>• ZSet (Sorted Set) 是有序的字符串集合</p>
        <p>• 每个成员关联一个分数，用于排序</p>
        <p>• 成员是唯一的，但分数可以重复</p>
        <p>• 适合存储排行榜、优先级队列等需要排序的数据</p>
        {!readOnly && <p>• 修改后点击"保存更改"按钮保存到 Redis</p>}
      </div>
    </div>
  )
}

export default ZSetEditor
