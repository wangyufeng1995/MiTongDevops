/**
 * 系统通知管理页面
 * 
 * 功能特性：
 * - 通知列表展示
 * - 创建/编辑/删除通知
 * - 通知分类筛选
 * - 通知统计
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Filter,
  Search,
  AlertTriangle,
  CheckCircle,
  X
} from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { notificationService } from '../../services/notification'
import { formatDateTime } from '../../utils'
import type {
  SystemNotification,
  NotificationType,
  NotificationCategory,
  CreateNotificationRequest
} from '../../types/notification'
import {
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_TYPE_COLORS,
  NOTIFICATION_ICONS
} from '../../types/notification'

export const NotificationManagement: React.FC = () => {
  const navigate = useNavigate()
  const { isAdmin } = useAuthStore()
  
  const [notifications, setNotifications] = useState<SystemNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // 筛选和分页
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | ''>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [unreadCount, setUnreadCount] = useState(0)
  
  // 表单状态
  const [showForm, setShowForm] = useState(false)
  const [editingNotification, setEditingNotification] = useState<SystemNotification | null>(null)
  const [formData, setFormData] = useState<CreateNotificationRequest>({
    title: '',
    message: '',
    type: 'info',
    category: 'system',
    is_global: true,
    expires_in_days: 7
  })

  // 检查管理员权限
  useEffect(() => {
    if (!isAdmin()) {
      navigate('/dashboard')
    }
  }, [isAdmin, navigate])

  // 加载通知列表
  const loadNotifications = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await notificationService.getNotifications({
        page: currentPage,
        per_page: 20,
        category: categoryFilter || undefined
      })
      
      setNotifications(response.items)
      setTotalPages(response.pagination.pages)
      setUnreadCount(response.unread_count)
    } catch (err: any) {
      console.error('加载通知失败:', err)
      setError(err.response?.data?.message || '加载通知失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [currentPage, categoryFilter])

  // 创建通知
  const handleCreate = async () => {
    try {
      setError(null)
      setSuccess(null)
      
      await notificationService.createNotification(formData)
      
      setSuccess('通知创建成功')
      setShowForm(false)
      resetForm()
      loadNotifications()
      
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('创建通知失败:', err)
      setError(err.response?.data?.message || '创建通知失败')
    }
  }

  // 更新通知
  const handleUpdate = async () => {
    if (!editingNotification) return
    
    try {
      setError(null)
      setSuccess(null)
      
      await notificationService.updateNotification(editingNotification.id, {
        title: formData.title,
        message: formData.message,
        type: formData.type,
        category: formData.category,
        is_global: formData.is_global,
        expires_in_days: formData.expires_in_days
      })
      
      setSuccess('通知更新成功')
      setShowForm(false)
      setEditingNotification(null)
      resetForm()
      loadNotifications()
      
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('更新通知失败:', err)
      setError(err.response?.data?.message || '更新通知失败')
    }
  }

  // 删除通知
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条通知吗？')) return
    
    try {
      setError(null)
      setSuccess(null)
      
      await notificationService.deleteNotification(id)
      
      setSuccess('通知删除成功')
      loadNotifications()
      
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('删除通知失败:', err)
      setError(err.response?.data?.message || '删除通知失败')
    }
  }

  // 编辑通知
  const handleEdit = (notification: SystemNotification) => {
    setEditingNotification(notification)
    setFormData({
      title: notification.title,
      message: notification.message,
      type: notification.type,
      category: notification.category,
      is_global: notification.is_global,
      target_user_id: notification.target_user_id,
      expires_in_days: notification.expires_at ? 7 : undefined
    })
    setShowForm(true)
  }

  // 重置表单
  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      type: 'info',
      category: 'system',
      is_global: true,
      expires_in_days: 7
    })
    setEditingNotification(null)
  }

  // 筛选通知
  const filteredNotifications = notifications.filter(notification =>
    notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    notification.message.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!isAdmin()) {
    return null
  }

  return (
    <div className="p-6">
      {/* 页面头部 */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">系统通知管理</h1>
            <p className="text-gray-600 mt-1">管理系统通知和消息推送</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={loadNotifications}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>刷新</span>
            </button>
            
            <button
              onClick={() => {
                resetForm()
                setShowForm(true)
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>创建通知</span>
            </button>
          </div>
        </div>
      </div>

      {/* 消息提示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            <span className="text-green-700">{success}</span>
          </div>
        </div>
      )}

      {/* 筛选和搜索 */}
      <div className="mb-6 bg-white rounded-lg shadow border p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              分类筛选
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value as NotificationCategory | '')
                setCurrentPage(1)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">全部分类</option>
              {Object.entries(NOTIFICATION_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              搜索通知
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索标题或内容..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* 通知列表 */}
      <div className="bg-white rounded-lg shadow border">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">加载中...</p>
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredNotifications.map((notification) => {
              const typeColors = NOTIFICATION_TYPE_COLORS[notification.type]
              const icon = NOTIFICATION_ICONS[notification.category]
              
              return (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    !notification.is_read ? 'bg-blue-50/30' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <span className="text-2xl">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </h3>
                          <span className={`px-2 py-0.5 text-xs rounded ${typeColors.bg} ${typeColors.text}`}>
                            {notification.type}
                          </span>
                          <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700">
                            {NOTIFICATION_CATEGORY_LABELS[notification.category]}
                          </span>
                          {notification.is_global && (
                            <span className="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-700">
                              全局
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>{notification.time_ago}</span>
                          {notification.expires_at && (
                            <span>过期时间: {formatDateTime(notification.expires_at, 'YYYY/MM/DD HH:mm')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleEdit(notification)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="编辑"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(notification.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>暂无通知</p>
          </div>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center space-x-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            上一页
          </button>
          <span className="text-sm text-gray-600">
            第 {currentPage} / {totalPages} 页
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}

      {/* 创建/编辑表单模态框 */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingNotification ? '编辑通知' : '创建通知'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false)
                    resetForm()
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    通知标题 *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="输入通知标题"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    通知内容 *
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="输入通知内容"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      通知类型
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as NotificationType })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="info">信息</option>
                      <option value="success">成功</option>
                      <option value="warning">警告</option>
                      <option value="error">错误</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      通知分类
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as NotificationCategory })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {Object.entries(NOTIFICATION_CATEGORY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    过期天数
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.expires_in_days || ''}
                    onChange={(e) => setFormData({ ...formData, expires_in_days: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="留空表示永不过期"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_global"
                    checked={formData.is_global}
                    onChange={(e) => setFormData({ ...formData, is_global: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="is_global" className="text-sm text-gray-700">
                    全局通知（所有用户可见）
                  </label>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowForm(false)
                    resetForm()
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={editingNotification ? handleUpdate : handleCreate}
                  disabled={!formData.title || !formData.message}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {editingNotification ? '更新' : '创建'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
