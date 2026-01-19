/**
 * 主机分组管理 API 服务
 */
import { api } from './api'
import type {
  HostGroup,
  CreateHostGroupRequest,
  UpdateHostGroupRequest,
  HostGroupListResponse
} from '../types/host'

export class HostGroupsService {
  /**
   * 获取分组列表
   */
  async getGroups(params?: {
    page?: number
    per_page?: number
  }): Promise<HostGroupListResponse> {
    const response = await api.get('/api/host-groups', { params })
    // api.get 返回 { success, data: { groups, pagination } }
    return response.data
  }

  /**
   * 获取单个分组详情
   */
  async getGroup(id: number): Promise<HostGroup> {
    const response = await api.get(`/api/host-groups/${id}`)
    return response.data.group
  }

  /**
   * 创建分组
   */
  async createGroup(data: CreateHostGroupRequest): Promise<HostGroup> {
    const response = await api.post('/api/host-groups', data)
    return response.data.group
  }

  /**
   * 更新分组
   */
  async updateGroup(id: number, data: UpdateHostGroupRequest): Promise<HostGroup> {
    const response = await api.post(`/api/host-groups/${id}/update`, data)
    return response.data.group
  }

  /**
   * 删除分组
   */
  async deleteGroup(id: number): Promise<void> {
    await api.post(`/api/host-groups/${id}/delete`)
  }
}

export const hostGroupsService = new HostGroupsService()
