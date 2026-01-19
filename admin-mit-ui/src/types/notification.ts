/**
 * 系统通知类型定义
 */

// 通知类型
export type NotificationType = 'info' | 'success' | 'warning' | 'error'

// 通知分类
export type NotificationCategory = 'system' | 'alert' | 'task' | 'security'

// 关联类型
export type RelatedType = 'host' | 'playbook' | 'alert' | 'probe'

// 系统通知接口
export interface SystemNotification {
  id: number
  tenant_id: number
  title: string
  message: string
  type: NotificationType
  category: NotificationCategory
  is_read: boolean
  is_global: boolean
  target_user_id?: number
  related_type?: RelatedType
  related_id?: number
  created_at: string
  read_at?: string
  expires_at?: string
  time_ago: string
}

// 创建通知请求
export interface CreateNotificationRequest {
  title: string
  message: string
  type?: NotificationType
  category?: NotificationCategory
  is_global?: boolean
  target_user_id?: number
  related_type?: RelatedType
  related_id?: number
  expires_in_days?: number
}

// 更新通知请求
export interface UpdateNotificationRequest {
  title?: string
  message?: string
  type?: NotificationType
  category?: NotificationCategory
  is_global?: boolean
  target_user_id?: number
  expires_in_days?: number | null
}

// 通知列表响应
export interface NotificationListResponse {
  items: SystemNotification[]
  pagination: {
    page: number
    per_page: number
    total: number
    pages: number
    has_prev: boolean
    has_next: boolean
  }
  unread_count: number
}

// 通知统计
export interface NotificationStats {
  total: number
  unread: number
  read: number
  categories: {
    system: number
    alert: number
    task: number
    security: number
  }
}

// 通知查询参数
export interface NotificationQueryParams {
  page?: number
  per_page?: number
  is_read?: boolean
  category?: NotificationCategory
}

// 通知图标映射
export const NOTIFICATION_ICONS: Record<NotificationCategory, string> = {
  system: '🔔',
  alert: '⚠️',
  task: '✅',
  security: '🔒'
}

// 通知类型颜色映射
export const NOTIFICATION_TYPE_COLORS: Record<NotificationType, {
  bg: string
  text: string
  border: string
}> = {
  info: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200'
  },
  success: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200'
  },
  warning: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200'
  },
  error: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200'
  }
}

// 通知分类标签映射
export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  system: '系统通知',
  alert: '告警通知',
  task: '任务通知',
  security: '安全通知'
}
