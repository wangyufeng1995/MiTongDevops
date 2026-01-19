/**
 * 系统通知 API 服务
 */
import { api } from './api'
import type {
  SystemNotification,
  CreateNotificationRequest,
  UpdateNotificationRequest,
  NotificationListResponse,
  NotificationStats,
  NotificationQueryParams
} from '../types/notification'

class NotificationService {
  /**
   * 获取通知列表
   */
  async getNotifications(params?: NotificationQueryParams): Promise<NotificationListResponse> {
    const response = await api.get('/api/notifications', { params })
    return response.data
  }

  /**
   * 标记通知为已读
   */
  async markAsRead(notificationId: number): Promise<SystemNotification> {
    const response = await api.post(`/api/notifications/${notificationId}/read`)
    return response.data
  }

  /**
   * 标记所有通知为已读
   */
  async markAllAsRead(): Promise<void> {
    await api.post('/api/notifications/read-all')
  }

  /**
   * 创建通知（管理员）
   */
  async createNotification(data: CreateNotificationRequest): Promise<SystemNotification> {
    const response = await api.post('/api/notifications', data)
    return response.data
  }

  /**
   * 更新通知（管理员）
   */
  async updateNotification(
    notificationId: number,
    data: UpdateNotificationRequest
  ): Promise<SystemNotification> {
    const response = await api.put(`/api/notifications/${notificationId}`, data)
    return response.data
  }

  /**
   * 删除通知（管理员）
   */
  async deleteNotification(notificationId: number): Promise<void> {
    await api.delete(`/api/notifications/${notificationId}`)
  }

  /**
   * 获取通知统计
   */
  async getStats(): Promise<NotificationStats> {
    const response = await api.get('/api/notifications/stats')
    return response.data
  }

  /**
   * 轮询获取未读通知数量
   */
  async pollUnreadCount(): Promise<number> {
    try {
      const response = await this.getNotifications({ page: 1, per_page: 1, is_read: false })
      return response.unread_count
    } catch (error) {
      console.error('获取未读通知数量失败:', error)
      return 0
    }
  }
}

export const notificationService = new NotificationService()
export default notificationService
