/**
 * 数据库管理 API 服务
 * 
 * 提供数据库连接配置的 CRUD 操作，Schema 浏览，SQL 查询执行等功能。
 * 
 * Requirements: 1.1-1.8, 3.1-3.6, 4.2-4.8
 */
import { api } from './api'

// ==================== 类型定义 ====================

/**
 * 数据库类型
 */
export type DatabaseType = 'postgresql' | 'mysql' | 'dm' | 'oracle'

/**
 * 数据库类型配置
 */
export interface DatabaseTypeConfig {
  name: string
  icon: string
  color: string
  defaultPort: number
  gradient: string
}

/**
 * 数据库类型配置映射
 */
export const DATABASE_TYPES: Record<DatabaseType, DatabaseTypeConfig> = {
  postgresql: {
    name: 'PostgreSQL',
    icon: 'postgresql-icon',
    color: 'blue',
    defaultPort: 5432,
    gradient: 'from-blue-500 to-indigo-600'
  },
  mysql: {
    name: 'MySQL',
    icon: 'mysql-icon',
    color: 'orange',
    defaultPort: 3306,
    gradient: 'from-orange-500 to-amber-600'
  },
  dm: {
    name: '达梦 DM',
    icon: 'dm-icon',
    color: 'red',
    defaultPort: 5236,
    gradient: 'from-red-500 to-rose-600'
  },
  oracle: {
    name: 'Oracle',
    icon: 'oracle-icon',
    color: 'red-brown',
    defaultPort: 1521,
    gradient: 'from-red-700 to-orange-600'
  }
}

/**
 * 数据库连接配置
 */
export interface DatabaseConnection {
  id: number
  name: string
  db_type: DatabaseType
  host: string
  port: number
  username: string
  database?: string
  schema?: string
  service_name?: string  // Oracle
  sid?: string           // Oracle
  timeout: number
  description?: string
  status: number
  created_at: string
  updated_at: string
}

/**
 * 创建连接请求
 */
export interface CreateDatabaseConnectionRequest {
  name: string
  db_type: DatabaseType
  host: string
  port: number
  username: string
  password: string
  database?: string
  schema?: string
  service_name?: string  // Oracle
  sid?: string           // Oracle
  timeout?: number
  description?: string
}

/**
 * 更新连接请求
 */
export interface UpdateDatabaseConnectionRequest {
  name?: string
  db_type?: DatabaseType
  host?: string
  port?: number
  username?: string
  password?: string
  database?: string
  schema?: string
  service_name?: string  // Oracle
  sid?: string           // Oracle
  timeout?: number
  description?: string
  status?: number
}

/**
 * 连接列表响应
 */
export interface DatabaseConnectionListResponse {
  connections: DatabaseConnection[]
  pagination: {
    page: number
    per_page: number
    total: number
    pages: number
    has_prev: boolean
    has_next: boolean
  }
}

/**
 * 测试连接响应
 */
export interface TestConnectionResponse {
  connected: boolean
  message: string
}

/**
 * 连接状态响应
 */
export interface ConnectionStatusResponse {
  connected: boolean
  connection_id: number
  message?: string
}

/**
 * 断开连接响应
 */
export interface DisconnectResponse {
  connection_id: number
  disconnected: boolean
  message?: string
}

/**
 * 表信息
 */
export interface TableInfo {
  name: string
  type: 'table' | 'view'
  schema: string
  row_count?: number
  size?: string
}

/**
 * 列信息
 */
export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  default_value?: string
  is_primary_key: boolean
  comment?: string
}

/**
 * 索引信息
 */
export interface IndexInfo {
  name: string
  columns: string[]
  is_unique: boolean
  is_primary: boolean
}

/**
 * 查询结果
 */
export interface QueryResult {
  columns: string[]
  rows: any[][]
  row_count: number
  execution_time: number  // 毫秒
  affected_rows?: number
  pagination?: {
    page: number
    per_page: number
    total: number
    pages: number
    has_prev: boolean
    has_next: boolean
  }
}

/**
 * 服务器信息
 */
export interface ServerInfo {
  version: string
  uptime?: string
  connections: number
  database_size?: string
  db_type: DatabaseType
  [key: string]: any  // 允许额外的数据库特定字段
}

/**
 * 执行查询请求
 */
export interface ExecuteQueryRequest {
  sql: string
  page?: number
  per_page?: number
  max_rows?: number
}

/**
 * 导出 CSV 请求
 */
export interface ExportCsvRequest {
  sql: string
  max_rows?: number
}

// ==================== 服务类 ====================

class DatabaseService {
  private baseUrl = '/api/database'

  // ==================== 数据库类型 ====================

  /**
   * 获取支持的数据库类型列表
   */
  async getDatabaseTypes(): Promise<DatabaseTypeConfig[]> {
    const response = await api.get(`${this.baseUrl}/types`)
    return response.data.types
  }

  // ==================== 连接配置管理 ====================

  /**
   * 获取连接列表
   */
  async getConnections(params?: {
    page?: number
    per_page?: number
    search?: string
    db_type?: DatabaseType
    status?: number
  }): Promise<DatabaseConnectionListResponse> {
    const response = await api.get(`${this.baseUrl}/connections`, { params })
    return response.data
  }

  /**
   * 获取单个连接详情
   */
  async getConnection(id: number): Promise<DatabaseConnection> {
    const response = await api.get(`${this.baseUrl}/connections/${id}`)
    return response.data.connection
  }

  /**
   * 创建连接
   */
  async createConnection(data: CreateDatabaseConnectionRequest): Promise<DatabaseConnection> {
    const response = await api.post(`${this.baseUrl}/connections`, data)
    return response.data.connection
  }

  /**
   * 更新连接
   */
  async updateConnection(id: number, data: UpdateDatabaseConnectionRequest): Promise<DatabaseConnection> {
    const response = await api.post(`${this.baseUrl}/connections/${id}/update`, data)
    return response.data.connection
  }

  /**
   * 删除连接
   */
  async deleteConnection(id: number): Promise<void> {
    await api.post(`${this.baseUrl}/connections/${id}/delete`)
  }

  /**
   * 测试已保存的连接
   */
  async testConnection(id: number): Promise<TestConnectionResponse> {
    const response = await api.post(`${this.baseUrl}/connections/${id}/test`)
    return response.data
  }

  /**
   * 测试连接配置（不保存）
   */
  async testConnectionConfig(config: CreateDatabaseConnectionRequest): Promise<TestConnectionResponse> {
    const response = await api.post(`${this.baseUrl}/connections/test`, config)
    return response.data
  }

  // ==================== 连接操作 ====================

  /**
   * 建立数据库连接
   */
  async connect(id: number): Promise<ConnectionStatusResponse> {
    const response = await api.post(`${this.baseUrl}/connections/${id}/connect`)
    return response.data
  }

  /**
   * 断开数据库连接
   */
  async disconnect(id: number): Promise<DisconnectResponse> {
    const response = await api.post(`${this.baseUrl}/connections/${id}/disconnect`)
    return response.data
  }

  // ==================== Schema 浏览 ====================

  /**
   * 获取数据库列表
   */
  async getDatabases(connId: number): Promise<string[]> {
    const response = await api.get(`${this.baseUrl}/${connId}/databases`)
    return response.data.databases
  }

  /**
   * 获取 Schema 列表
   */
  async getSchemas(connId: number, database?: string): Promise<string[]> {
    const params = database ? { database } : undefined
    const response = await api.get(`${this.baseUrl}/${connId}/schemas`, { params })
    return response.data.schemas
  }

  /**
   * 获取表列表
   */
  async getTables(connId: number, params?: {
    schema?: string
    search?: string
  }): Promise<TableInfo[]> {
    const response = await api.get(`${this.baseUrl}/${connId}/tables`, { params })
    return response.data.tables
  }

  /**
   * 获取表的列信息
   */
  async getTableColumns(connId: number, tableName: string, schema?: string): Promise<ColumnInfo[]> {
    const params = schema ? { schema } : undefined
    const response = await api.get(
      `${this.baseUrl}/${connId}/tables/${encodeURIComponent(tableName)}/columns`,
      { params }
    )
    return response.data.columns
  }

  /**
   * 获取表的索引信息
   */
  async getTableIndexes(connId: number, tableName: string, schema?: string): Promise<IndexInfo[]> {
    const params = schema ? { schema } : undefined
    const response = await api.get(
      `${this.baseUrl}/${connId}/tables/${encodeURIComponent(tableName)}/indexes`,
      { params }
    )
    return response.data.indexes
  }

  // ==================== SQL 查询 ====================

  /**
   * 执行 SQL 查询
   */
  async executeQuery(connId: number, request: ExecuteQueryRequest): Promise<QueryResult> {
    const response = await api.post(`${this.baseUrl}/${connId}/query`, request)
    return response.data
  }

  /**
   * 导出查询结果为 CSV
   */
  async exportCsv(connId: number, request: ExportCsvRequest): Promise<Blob> {
    const response = await api.post(`${this.baseUrl}/${connId}/export`, request, {
      responseType: 'blob'
    })
    // 如果响应是 Blob，直接返回
    if (response.data instanceof Blob) {
      return response.data
    }
    // 否则创建 Blob
    return new Blob([response.data], { type: 'text/csv;charset=utf-8' })
  }

  /**
   * 下载 CSV 文件
   * 辅助方法：执行导出并触发浏览器下载
   */
  async downloadCsv(connId: number, request: ExportCsvRequest, filename?: string): Promise<void> {
    const blob = await this.exportCsv(connId, request)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || 'query_result.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  // ==================== 服务器信息 ====================

  /**
   * 获取数据库服务器信息
   */
  async getServerInfo(connId: number): Promise<ServerInfo> {
    const response = await api.get(`${this.baseUrl}/${connId}/info`)
    return response.data
  }
}

export const databaseService = new DatabaseService()
