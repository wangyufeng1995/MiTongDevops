/**
 * K8S集群管理 API 服务
 */
import { api } from '../api'
import { handleK8sError } from '../../utils/k8s'
import type {
  K8sCluster,
  CreateClusterRequest,
  UpdateClusterRequest,
  ClusterTestRequest,
  ClusterTestResponse,
  ClusterStatusResponse,
  ClusterListResponse,
  ClusterListParams,
} from '../../types/k8s'

export class ClustersService {
  /**
   * 获取集群列表
   */
  async getClusters(params?: ClusterListParams): Promise<ClusterListResponse> {
    try {
      const response = await api.get('/api/k8s/clusters', { params })
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取单个集群详情（包含敏感信息，用于编辑）
   */
  async getClusterDetail(id: number): Promise<K8sCluster> {
    try {
      const response = await api.get('/api/k8s/clusters/detail', { params: { id } })
      // 处理响应格式
      if (response && typeof response === 'object' && 'data' in response) {
        return (response as any).data
      }
      return response as K8sCluster
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取单个集群详情
   */
  async getCluster(id: number): Promise<K8sCluster> {
    try {
      const response = await api.get(`/api/k8s/clusters/${id}`)
      return response.data.cluster
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 创建集群
   */
  async createCluster(data: CreateClusterRequest): Promise<K8sCluster> {
    try {
      const response = await api.post('/api/k8s/clusters', data)
      return response.data.cluster
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 更新集群
   */
  async updateCluster(data: UpdateClusterRequest): Promise<K8sCluster> {
    try {
      const response = await api.post('/api/k8s/clusters/update', data)
      return response.data.cluster
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 删除集群
   */
  async deleteCluster(id: number): Promise<void> {
    try {
      await api.post('/api/k8s/clusters/delete', { id })
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 测试集群连接
   */
  async testConnection(data: ClusterTestRequest): Promise<ClusterTestResponse> {
    try {
      const response = await api.post('/api/k8s/clusters/test', data)
      // api.post 已经处理了响应格式，直接返回 response
      if (response && typeof response === 'object' && 'success' in response) {
        return response as ClusterTestResponse
      }
      return (response as any).data || response
    } catch (error: any) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取集群状态
   */
  async getClusterStatus(id: number): Promise<ClusterStatusResponse> {
    try {
      const response = await api.get('/api/k8s/clusters/status', {
        params: { id },
      })
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 批量获取集群状态
   */
  async getBatchClusterStatus(ids: number[]): Promise<Record<number, ClusterStatusResponse>> {
    try {
      const promises = ids.map((id) => this.getClusterStatus(id))
      const results = await Promise.allSettled(promises)

      const statusMap: Record<number, ClusterStatusResponse> = {}
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          statusMap[ids[index]] = result.value
        }
      })

      return statusMap
    } catch (error) {
      console.error('批量获取集群状态失败:', error)
      throw error
    }
  }

  /**
   * 获取集群统计信息（用于仪表盘）
   */
  async getClusterStats(): Promise<{
    healthy: number
    warning: number
    error: number
    total: number
  }> {
    try {
      const response = await api.get('/api/k8s/clusters/stats')
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }
}

export const clustersService = new ClustersService()
