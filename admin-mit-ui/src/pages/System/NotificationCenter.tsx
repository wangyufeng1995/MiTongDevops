/**
 * 通知中心页面 - 美化版
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Trash2, RefreshCw, Filter, Search, AlertTriangle, CheckCircle, X, Send, Users, User, MessageSquare, CheckCheck } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useTheme } from '../../hooks/useTheme'
import { formatDateTime } from '../../utils'
import { notificationService } from '../../services/notification'
import type { SystemNotification, NotificationType, NotificationCategory, CreateNotificationRequest } from '../../types/notification'
import { NOTIFICATION_CATEGORY_LABELS, NOTIFICATION_TYPE_COLORS, NOTIFICATION_ICONS } from '../../types/notification'
import { SettingsPageLayout, SettingsCard, SettingsStatCard, SettingsAlert, FormSelect } from '../../components/Settings'

export const NotificationCenter: React.FC = () => {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { isAdmin } = useAuthStore()
  
  const [notifications, setNotifications] = useState<SystemNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | ''>('')
  const [readFilter, setReadFilter] = useState<'all' | 'read' | 'unread'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showSendForm, setShowSendForm] = useState(false)
  const [formData, setFormData] = useState<CreateNotificationRequest>({
    title: '', message: '', type: 'info', category: 'system', is_global: true, expires_in_days: 7
  })

  const loadNotifications = async () => {
    try {
      setLoading(true)
      setError(null)
      const params: any = { page: currentPage, per_page: 20, category: categoryFilter || undefined }
      if (readFilter !== 'all') params.is_read = readFilter === 'read'
      const response = await notificationService.getNotifications(params)
      setNotifications(response.items)
      setTotalPages(response.pagination.pages)
      setUnreadCount(response.unread_count)
    } catch (err: any) {
      setError(err.response?.data?.message || '加载通知失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadNotifications() }, [currentPage, categoryFilter, readFilter])

  const handleMarkAsRead = async (id: number) => {
    try { await notificationService.markAsRead(id); loadNotifications() } catch (err: any) { setError(err.response?.data?.message || '标记已读失败') }
  }

  const handleMarkAllAsRead = async () => {
    try { await notificationService.markAllAsRead(); setSuccess('所有通知已标记为已读'); loadNotifications(); setTimeout(() => setSuccess(null), 3000) } catch (err: any) { setError(err.response?.data?.message || '标记已读失败') }
  }

  const handleSendMessage = async () => {
    try {
      setError(null)
      if (!formData.title || !formData.message) { setError('标题和内容不能为空'); return }
      await notificationService.createNotification(formData)
      setSuccess('消息发送成功'); setShowSendForm(false); setFormData({ title: '', message: '', type: 'info', category: 'system', is_global: true, expires_in_days: 7 }); loadNotifications()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) { setError(err.response?.data?.message || '发送消息失败') }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条通知吗？')) return
    try { await notificationService.deleteNotification(id); setSuccess('通知删除成功'); loadNotifications(); setTimeout(() => setSuccess(null), 3000) } catch (err: any) { setError(err.response?.data?.message || '删除通知失败') }
  }

  const filteredNotifications = notifications.filter(n => n.title.toLowerCase().includes(searchTerm.toLowerCase()) || n.message.toLowerCase().includes(searchTerm.toLowerCase()))

  const headerActions = (
    <>
      {unreadCount > 0 && (
        <button onClick={handleMarkAllAsRead} className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isDark ? 'bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700 text-gray-300' : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 shadow-sm'}`}>
          <CheckCheck className="w-4 h-4" /><span>全部已读</span>
        </button>
      )}
      {isAdmin() && (
        <button onClick={() => { setFormData({ title: '', message: '', type: 'info', category: 'system', is_global: true, expires_in_days: 7 }); setShowSendForm(true) }}
          className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium overflow-hidden transition-all">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <Send className="relative w-4 h-4" /><span className="relative">发送消息</span>
        </button>
      )}
    </>
  )

  return (
    <SettingsPageLayout title="通知中心" subtitle="查看和管理系统通知消息" icon={Bell}
      iconGradient="from-amber-500 via-orange-500 to-red-500" headerActions={headerActions}
      loading={loading} onRefresh={loadNotifications} showSave={false}>
      
      {error && <SettingsAlert type="error" message={error} onClose={() => setError(null)} />}
      {success && <SettingsAlert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
        <SettingsStatCard title="未读消息" value={unreadCount} icon={Bell} variant="info" valueColorClass="text-blue-500" iconColorClass="text-blue-400" glowColor="bg-blue-500" />
        <SettingsStatCard title="全部消息" value={notifications.length} icon={MessageSquare} glowColor="bg-gray-500" />
        <SettingsStatCard title="系统通知" value={notifications.filter(n => n.category === 'system').length} icon={CheckCircle} variant="success" valueColorClass="text-emerald-500" iconColorClass="text-emerald-400" glowColor="bg-emerald-500" />
        <SettingsStatCard title="告警通知" value={notifications.filter(n => n.category === 'alert').length} icon={AlertTriangle} variant="danger" valueColorClass="text-red-500" iconColorClass="text-red-400" glowColor="bg-red-500" />
      </div>

      {/* 筛选和搜索 */}
      <SettingsCard className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}><Filter className="w-4 h-4 inline mr-1" />分类筛选</label>
            <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value as NotificationCategory | ''); setCurrentPage(1) }}
              className={`w-full px-3 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
              <option value="">全部分类</option>
              {Object.entries(NOTIFICATION_CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>状态筛选</label>
            <select value={readFilter} onChange={(e) => { setReadFilter(e.target.value as 'all' | 'read' | 'unread'); setCurrentPage(1) }}
              className={`w-full px-3 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
              <option value="all">全部</option><option value="unread">未读</option><option value="read">已读</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}><Search className="w-4 h-4 inline mr-1" />搜索通知</label>
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="搜索标题或内容..."
              className={`w-full px-3 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
          </div>
        </div>
      </SettingsCard>

      {/* 通知列表 */}
      <SettingsCard noPadding>
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>加载中...</p>
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-gray-100'}`}>
            {filteredNotifications.map((notification) => {
              const typeColors = NOTIFICATION_TYPE_COLORS[notification.type]
              const icon = NOTIFICATION_ICONS[notification.category]
              return (
                <div key={notification.id} className={`p-5 transition-colors ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'} ${!notification.is_read ? (isDark ? 'bg-blue-900/20 border-l-4 border-l-blue-500' : 'bg-blue-50/50 border-l-4 border-l-blue-500') : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <span className="text-2xl">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{notification.title}</h3>
                          {!notification.is_read && <span className={`px-2 py-0.5 text-xs rounded-full ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>未读</span>}
                          <span className={`px-2 py-0.5 text-xs rounded-full ${typeColors.bg} ${typeColors.text}`}>{notification.type}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${isDark ? 'bg-slate-600 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>{NOTIFICATION_CATEGORY_LABELS[notification.category]}</span>
                          {notification.is_global && <span className={`px-2 py-0.5 text-xs rounded-full ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>全局</span>}
                        </div>
                        <p className={`text-sm mb-2 whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{notification.message}</p>
                        <div className={`flex items-center space-x-4 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          <span>{notification.time_ago}</span>
                          {notification.expires_at && <span>过期: {formatDateTime(notification.expires_at, 'YYYY/MM/DD HH:mm')}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 ml-4">
                      {!notification.is_read && (
                        <button onClick={() => handleMarkAsRead(notification.id)} title="标记已读"
                          className={`p-2 rounded-lg transition-colors ${isDark ? 'text-blue-400 hover:bg-blue-500/20' : 'text-blue-600 hover:bg-blue-50'}`}>
                          <CheckCheck className="w-4 h-4" />
                        </button>
                      )}
                      {isAdmin() && (
                        <button onClick={() => handleDelete(notification.id)} title="删除"
                          className={`p-2 rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-600 hover:bg-red-50'}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Bell className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
            <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>暂无通知</p>
          </div>
        )}
      </SettingsCard>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center space-x-2">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
            className={`px-4 py-2 rounded-xl disabled:opacity-50 ${isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'border border-gray-200 hover:bg-gray-50'}`}>上一页</button>
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>第 {currentPage} / {totalPages} 页</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
            className={`px-4 py-2 rounded-xl disabled:opacity-50 ${isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'border border-gray-200 hover:bg-gray-50'}`}>下一页</button>
        </div>
      )}

      {/* 发送消息模态框 */}
      {showSendForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
                    <Send className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                  </div>
                  <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>发送站内消息</h2>
                </div>
                <button onClick={() => setShowSendForm(false)} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>消息标题 *</label>
                  <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="输入消息标题"
                    className={`w-full px-3 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>消息内容 *</label>
                  <textarea value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} placeholder="输入消息内容" rows={5}
                    className={`w-full px-3 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>消息类型</label>
                    <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as NotificationType })}
                      className={`w-full px-3 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                      <option value="info">💡 信息</option><option value="success">✅ 成功</option><option value="warning">⚠️ 警告</option><option value="error">❌ 错误</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>消息分类</label>
                    <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value as NotificationCategory })}
                      className={`w-full px-3 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-700/50 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                      {Object.entries(NOTIFICATION_CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>过期天数</label>
                  <input type="number" min="1" value={formData.expires_in_days || ''} onChange={(e) => setFormData({ ...formData, expires_in_days: e.target.value ? parseInt(e.target.value) : undefined })} placeholder="留空表示永不过期"
                    className={`w-full px-3 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                </div>
                <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-blue-50'}`}>
                  <div className="flex items-start space-x-3 mb-3">
                    <input type="radio" id="global" checked={formData.is_global} onChange={() => setFormData({ ...formData, is_global: true, target_user_id: undefined })} className="mt-1" />
                    <div className="flex-1">
                      <label htmlFor="global" className={`text-sm font-medium cursor-pointer flex items-center ${isDark ? 'text-white' : 'text-gray-900'}`}><Users className="w-4 h-4 mr-1" />发送给所有用户</label>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>消息将推送给租户内的所有用户</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <input type="radio" id="specific" checked={!formData.is_global} onChange={() => setFormData({ ...formData, is_global: false })} className="mt-1" />
                    <div className="flex-1">
                      <label htmlFor="specific" className={`text-sm font-medium cursor-pointer flex items-center ${isDark ? 'text-white' : 'text-gray-900'}`}><User className="w-4 h-4 mr-1" />发送给指定用户</label>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>仅指定用户可见</p>
                      {!formData.is_global && (
                        <input type="number" value={formData.target_user_id || ''} onChange={(e) => setFormData({ ...formData, target_user_id: e.target.value ? parseInt(e.target.value) : undefined })} placeholder="输入用户ID"
                          className={`w-full px-3 py-2 mt-2 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-600 border-slate-500 text-white placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end space-x-3">
                <button onClick={() => setShowSendForm(false)} className={`px-4 py-2.5 rounded-xl font-medium transition-all ${isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>取消</button>
                <button onClick={handleSendMessage} disabled={!formData.title || !formData.message}
                  className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium overflow-hidden transition-all disabled:opacity-50">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <Send className="relative w-4 h-4" /><span className="relative">发送消息</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SettingsPageLayout>
  )
}
