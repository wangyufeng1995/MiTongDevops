import React, { useState } from 'react'
import { Plus, FolderTree, AlertCircle, CheckCircle } from 'lucide-react'
import { GroupList } from './GroupList'
import { GroupForm } from './GroupForm'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { networkProbeGroupService } from '../../../services/network'
import { NetworkProbeGroup, CreateNetworkProbeGroupRequest, UpdateNetworkProbeGroupRequest } from '../../../types/network'
import { useTheme } from '../../../hooks/useTheme'

export const NetworkGroupsPage: React.FC = () => {
  const { isDark } = useTheme()
  const [showForm, setShowForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<NetworkProbeGroup | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<NetworkProbeGroup | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  const handleCreate = () => { setEditingGroup(null); setShowForm(true) }
  const handleEdit = (group: NetworkProbeGroup) => { setEditingGroup(group); setShowForm(true) }
  const handleDelete = (group: NetworkProbeGroup) => { setDeletingGroup(group) }

  const handleFormSubmit = async (data: CreateNetworkProbeGroupRequest | UpdateNetworkProbeGroupRequest) => {
    try {
      if (editingGroup) {
        const response = await networkProbeGroupService.update(editingGroup.id, data as UpdateNetworkProbeGroupRequest)
        if (response.success) {
          showNotification('success', '分组更新成功'); setShowForm(false); setEditingGroup(null); setRefreshTrigger(prev => prev + 1)
        } else { throw new Error(response.message || '更新分组失败') }
      } else {
        const response = await networkProbeGroupService.create(data as CreateNetworkProbeGroupRequest)
        if (response.success) {
          showNotification('success', '分组创建成功'); setShowForm(false); setRefreshTrigger(prev => prev + 1)
        } else { throw new Error(response.message || '创建分组失败') }
      }
    } catch (err: any) { showNotification('error', err.message || '操作失败'); throw err }
  }

  const handleFormCancel = () => { setShowForm(false); setEditingGroup(null) }

  const handleDeleteConfirm = async () => {
    if (!deletingGroup) return
    try {
      const response = await networkProbeGroupService.deleteWithMigration(deletingGroup.id)
      if (response.success) {
        showNotification('success', '分组删除成功'); setDeletingGroup(null); setRefreshTrigger(prev => prev + 1)
      } else { throw new Error(response.message || '删除分组失败') }
    } catch (err: any) { showNotification('error', err.message || '删除分组失败'); throw err }
  }

  const handleDeleteCancel = () => { setDeletingGroup(null) }

  return (
    <div className={`h-full flex flex-col overflow-hidden ${isDark ? 'bg-[#0f172a]' : 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50'}`}>
      {/* 头部 */}
      <div className={`flex-shrink-0 px-6 py-4 backdrop-blur-xl border-b ${isDark ? 'bg-slate-900/80 border-slate-700/50' : 'bg-white/70 border-gray-200/80'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className={`absolute inset-0 rounded-2xl blur-xl opacity-50 ${isDark ? 'bg-violet-500' : 'bg-violet-400'}`}></div>
              <div className="relative p-3 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-500 shadow-xl">
                <FolderTree className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {showForm ? (editingGroup ? '编辑分组' : '创建分组') : '探测分组管理'}
              </h1>
              <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                管理网络探测目标分组，便于组织和管理
              </p>
            </div>
          </div>
          {!showForm && (
            <button onClick={handleCreate}
              className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-white text-sm font-medium overflow-hidden transition-all">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-purple-600 to-fuchsia-500"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-purple-700 to-fuchsia-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Plus className="relative w-4 h-4" />
              <span className="relative">创建分组</span>
            </button>
          )}
        </div>
      </div>

      {/* 通知 */}
      {notification && (
        <div className={`mx-6 mt-4 px-4 py-3 rounded-xl flex items-center space-x-3 ${
          notification.type === 'success'
            ? isDark ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : isDark ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-6">
        {showForm ? (
          <div className={`rounded-2xl p-6 ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-lg shadow-gray-200/50'}`}>
            <GroupForm group={editingGroup} onSubmit={handleFormSubmit} onCancel={handleFormCancel} />
          </div>
        ) : (
          <GroupList onEdit={handleEdit} onDelete={handleDelete} refreshTrigger={refreshTrigger} />
        )}
      </div>

      {/* 删除确认弹窗 */}
      {deletingGroup && (
        <DeleteConfirmModal group={deletingGroup} onConfirm={handleDeleteConfirm} onCancel={handleDeleteCancel} />
      )}
    </div>
  )
}

export default NetworkGroupsPage
