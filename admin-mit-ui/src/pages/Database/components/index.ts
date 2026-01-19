/**
 * Database Management Components
 * 
 * 数据库管理页面的美化组件集合
 */

// 删除确认弹窗
export { 
  DeleteConfirmModal, 
  type DeleteConfirmModalProps,
  type DatabaseType as DeleteModalDatabaseType
} from './DeleteConfirmModal'

// Toast 消息提示
export { 
  DatabaseToast, 
  DatabaseToastContainer, 
  databaseToast,
  type DatabaseToastProps,
  type DatabaseToastType
} from './Toast'

// 数据库类型选择器
export { 
  DatabaseTypeSelector, 
  DATABASE_TYPES,
  getDatabaseTypeConfig,
  getDefaultPort,
  type DatabaseType,
  type DatabaseTypeConfig,
  type DatabaseTypeSelectorProps
} from './DatabaseTypeSelector'

// 危险操作确认弹窗
export {
  DangerousOperationModal,
  type DangerousOperationModalProps,
  type DangerousOperationType
} from './DangerousOperationModal'

// 连接错误弹窗
export {
  ConnectionErrorModal,
  type ConnectionErrorModalProps,
  type ConnectionErrorType
} from './ConnectionErrorModal'
