/**
 * Redis 管理 API 服务
 */
import { api } from './api'

// Redis 连接配置类型
export interface RedisConnection {
  id: number
  name: string
  connection_type: 'standalone' | 'cluster'
  host?: string
  port?: number
  database?: number
  cluster_nodes?: string[]
  timeout: number
  description?: string
  status: number
  created_at: string
  updated_at: string
}

// 创建连接请求
export interface CreateRedisConnectionRequest {
  name: string
  connection_type: 'standalone' | 'cluster'
  host?: string
  port?: number
  password?: string
  database?: number
  cluster_nodes?: string[]
  timeout?: number
  description?: string
}

// 更新连接请求
export interface UpdateRedisConnectionRequest {
  name?: string
  connection_type?: 'standalone' | 'cluster'
  host?: string
  port?: number
  password?: string
  database?: number
  cluster_nodes?: string[]
  timeout?: number
  description?: string
  status?: number
}

// 连接列表响应
export interface RedisConnectionListResponse {
  connections: RedisConnection[]
  pagination: {
    page: number
    per_page: number
    total: number
    pages: number
    has_prev: boolean
    has_next: boolean
  }
}

// 测试连接响应
export interface TestConnectionResponse {
  success?: boolean
  connected?: boolean  // 后端可能返回 connected 而不是 success
  message: string
  latency_ms?: number
}

// 连接状态响应
export interface ConnectionStatusResponse {
  connected: boolean
  message: string
}

// 键信息
export interface KeyInfo {
  key: string
  type: 'string' | 'list' | 'set' | 'zset' | 'hash' | 'stream'
  ttl: number  // -1 表示永不过期, -2 表示键不存在
  size?: number
  encoding?: string
}

// 键详情（包含值）
export interface KeyDetail extends KeyInfo {
  value: any
}

// 扫描键响应
export interface ScanKeysResponse {
  cursor: number
  keys: KeyInfo[]
  total_scanned: number
}

// 创建键请求
export interface CreateKeyRequest {
  key: string
  value: any
  type?: 'string' | 'list' | 'set' | 'zset' | 'hash' | 'stream'
  ttl?: number
}

// 更新键请求
export interface UpdateKeyRequest {
  value: any
  type?: 'string' | 'list' | 'set' | 'zset' | 'hash' | 'stream'
  ttl?: number
}

// 设置 TTL 请求
export interface SetTTLRequest {
  ttl: number  // -1 或 0 表示移除过期时间
}

class RedisService {
  private baseUrl = '/api/redis'

  /**
   * 获取连接列表
   */
  async getConnections(params?: {
    page?: number
    per_page?: number
    search?: string
  }): Promise<RedisConnectionListResponse> {
    const response = await api.get(`${this.baseUrl}/connections`, { params })
    return response.data
  }

  /**
   * 获取单个连接详情
   */
  async getConnection(id: number): Promise<RedisConnection> {
    const response = await api.get(`${this.baseUrl}/connections/${id}`)
    return response.data.connection
  }

  /**
   * 创建连接
   */
  async createConnection(data: CreateRedisConnectionRequest): Promise<RedisConnection> {
    const response = await api.post(`${this.baseUrl}/connections`, data)
    return response.data.connection
  }

  /**
   * 更新连接
   */
  async updateConnection(id: number, data: UpdateRedisConnectionRequest): Promise<RedisConnection> {
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
   * 测试连接
   */
  async testConnection(id: number): Promise<TestConnectionResponse> {
    const response = await api.post(`${this.baseUrl}/connections/${id}/test`)
    return response.data
  }

  /**
   * 建立连接
   */
  async connect(id: number): Promise<ConnectionStatusResponse> {
    const response = await api.post(`${this.baseUrl}/connections/${id}/connect`)
    return response.data
  }

  /**
   * 断开连接
   */
  async disconnect(id: number): Promise<ConnectionStatusResponse> {
    const response = await api.post(`${this.baseUrl}/connections/${id}/disconnect`)
    return response.data
  }

  // ==================== 键值操作 ====================

  /**
   * 扫描键列表
   */
  async scanKeys(connId: number, params?: {
    pattern?: string
    cursor?: number
    count?: number
    database?: number
  }): Promise<ScanKeysResponse> {
    const response = await api.get(`${this.baseUrl}/${connId}/keys`, { params })
    return response.data
  }

  /**
   * 获取键详情
   */
  async getKeyDetail(connId: number, key: string): Promise<KeyDetail> {
    const response = await api.get(`${this.baseUrl}/${connId}/keys/${encodeURIComponent(key)}`)
    return response.data
  }

  /**
   * 创建键
   */
  async createKey(connId: number, data: CreateKeyRequest): Promise<{ key: string; type: string; created: boolean }> {
    const response = await api.post(`${this.baseUrl}/${connId}/keys`, data)
    return response.data
  }

  /**
   * 更新键值
   */
  async updateKey(connId: number, key: string, data: UpdateKeyRequest): Promise<{ key: string; updated: boolean }> {
    const response = await api.post(`${this.baseUrl}/${connId}/keys/${encodeURIComponent(key)}/update`, data)
    return response.data
  }

  /**
   * 删除键（支持批量）
   */
  async deleteKeys(connId: number, keys: string[]): Promise<{ deleted_count: number; requested_count: number }> {
    const response = await api.post(`${this.baseUrl}/${connId}/keys/delete`, { keys })
    return response.data
  }

  /**
   * 设置键的 TTL
   */
  async setKeyTTL(connId: number, key: string, ttl: number): Promise<{ key: string; ttl: number; updated: boolean }> {
    const response = await api.post(`${this.baseUrl}/${connId}/keys/${encodeURIComponent(key)}/ttl`, { ttl })
    return response.data
  }

  // ==================== 服务器信息 ====================

  /**
   * 获取服务器信息
   */
  async getServerInfo(connId: number): Promise<any> {
    const response = await api.get(`${this.baseUrl}/${connId}/info`)
    return response.data
  }

  /**
   * 获取集群信息
   */
  async getClusterInfo(connId: number): Promise<any> {
    const response = await api.get(`${this.baseUrl}/${connId}/cluster/info`)
    return response.data
  }

  /**
   * 获取集群节点列表
   */
  async getClusterNodes(connId: number): Promise<any[]> {
    const response = await api.get(`${this.baseUrl}/${connId}/cluster/nodes`)
    return response.data
  }

  // ==================== Hash 操作 ====================

  /**
   * 获取 Hash 所有字段
   */
  async hgetAll(connId: number, key: string): Promise<Record<string, string>> {
    const response = await api.get(`${this.baseUrl}/${connId}/hash/${encodeURIComponent(key)}`)
    return response.data
  }

  /**
   * 设置 Hash 字段
   */
  async hset(connId: number, key: string, field: string, value: string): Promise<{ set: boolean }> {
    const response = await api.post(`${this.baseUrl}/${connId}/hash/${encodeURIComponent(key)}`, { field, value })
    return response.data
  }

  /**
   * 删除 Hash 字段
   */
  async hdel(connId: number, key: string, fields: string[]): Promise<{ deleted_count: number }> {
    const response = await api.post(`${this.baseUrl}/${connId}/hash/${encodeURIComponent(key)}/delete-fields`, { fields })
    return response.data
  }

  // ==================== List 操作 ====================

  /**
   * 获取 List 元素
   */
  async lrange(connId: number, key: string, start: number = 0, stop: number = -1): Promise<string[]> {
    const response = await api.get(`${this.baseUrl}/${connId}/list/${encodeURIComponent(key)}`, {
      params: { start, stop }
    })
    return response.data
  }

  /**
   * 添加 List 元素
   */
  async lpush(connId: number, key: string, values: string[]): Promise<{ length: number }> {
    const response = await api.post(`${this.baseUrl}/${connId}/list/${encodeURIComponent(key)}`, { values })
    return response.data
  }

  /**
   * 删除 List 元素
   */
  async lrem(connId: number, key: string, count: number, value: string): Promise<{ removed_count: number }> {
    const response = await api.post(`${this.baseUrl}/${connId}/list/${encodeURIComponent(key)}/delete-elements`, {
      count,
      value
    })
    return response.data
  }

  // ==================== Set 操作 ====================

  /**
   * 获取 Set 成员
   */
  async smembers(connId: number, key: string): Promise<string[]> {
    const response = await api.get(`${this.baseUrl}/${connId}/set/${encodeURIComponent(key)}`)
    return response.data
  }

  /**
   * 添加 Set 成员
   */
  async sadd(connId: number, key: string, members: string[]): Promise<{ added_count: number }> {
    const response = await api.post(`${this.baseUrl}/${connId}/set/${encodeURIComponent(key)}`, { members })
    return response.data
  }

  /**
   * 删除 Set 成员
   */
  async srem(connId: number, key: string, members: string[]): Promise<{ removed_count: number }> {
    const response = await api.post(`${this.baseUrl}/${connId}/set/${encodeURIComponent(key)}/delete-members`, { members })
    return response.data
  }

  // ==================== ZSet 操作 ====================

  /**
   * 获取 ZSet 成员
   */
  async zrange(connId: number, key: string, start: number = 0, stop: number = -1, withscores: boolean = true): Promise<Array<{ member: string; score: number }>> {
    const response = await api.get(`${this.baseUrl}/${connId}/zset/${encodeURIComponent(key)}`, {
      params: { start, stop, withscores }
    })
    return response.data
  }

  /**
   * 添加 ZSet 成员
   */
  async zadd(connId: number, key: string, mapping: Record<string, number>): Promise<{ added_count: number }> {
    const response = await api.post(`${this.baseUrl}/${connId}/zset/${encodeURIComponent(key)}`, { mapping })
    return response.data
  }

  /**
   * 删除 ZSet 成员
   */
  async zrem(connId: number, key: string, members: string[]): Promise<{ removed_count: number }> {
    const response = await api.post(`${this.baseUrl}/${connId}/zset/${encodeURIComponent(key)}/delete-members`, { members })
    return response.data
  }
}

export const redisService = new RedisService()
