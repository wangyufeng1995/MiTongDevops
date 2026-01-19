// 导出所有类型定义
// 使用具名导出避免类型重复冲突

// 基础类型（从common导出）
export type {
  Role,
  Tenant,
  Permission,
  PaginationParams,
  ApiResponse,
  PaginationResponse
} from './common'

// 认证相关（排除重复的Role和Tenant）
export type {
  User,
  LoginRequest,
  LoginResponse
} from './auth'

// 用户管理
export type * from './user'

// 角色管理
export type {
  ExtendedRole,
  RoleListResponse
} from './role'

// 日志
export type {
  OperationLog
} from './log'

// 主机管理
export type * from './host'
export type * from './webshell'
export type * from './ansible'

// 监控告警 - 分别导出避免冲突
export type {
  AlertChannel,
  AlertRule,
  AlertRecord,
  MonitorDashboardData
} from './monitor'

export type {
  AlertStatus
} from './alert'

// 审计日志
export type * from './audit'

// 如果需要运行时值，请直接从具体文件导入
// 例如: import { someFunction } from './auth'