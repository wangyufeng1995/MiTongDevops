/**
 * K8S命名空间管理 API 服务
 */
import { api } from '../api'
import { handleK8sError } from '../../utils/k8s'
import type {
  K8sNamespace,
  CreateNamespaceRequest,
  DeleteNamespaceRequest,
  NamespaceListResponse,
  NamespaceListParams,
} from '../../types/k8s'

export class NamespacesService {
  /**
   * 获取命名空间列表
   */
  async getNamespaces(params: NamespaceListParams): Promise<NamespaceListResponse> {
    try {
      const response = await api.get('/api/k8s/namespaces', { params })
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取单个命名空间详情
   */
  async getNamespace(clusterId: number, name: string): Promise<K8sNamespace> {
    try {
      const response = await api.get(`/api/k8s/namespaces/${name}`, {
        params: { cluster_id: clusterId },
      })
      return response.data.namespace
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 创建命名空间
   */
  async createNamespace(data: CreateNamespaceRequest): Promise<K8sNamespace> {
    try {
      const response = await api.post('/api/k8s/namespaces', data)
      return response.data.namespace
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 删除命名空间
   */
  async deleteNamespace(data: DeleteNamespaceRequest): Promise<void> {
    try {
      await api.post('/api/k8s/namespaces/delete', data)
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取命名空间资源配额
   */
  async getNamespaceQuotas(clusterId: number, namespace: string): Promise<any> {
    try {
      const response = await api.get('/api/k8s/namespaces/quotas', {
        params: { cluster_id: clusterId, namespace },
      })
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }
}

export const namespacesService = new NamespacesService()
