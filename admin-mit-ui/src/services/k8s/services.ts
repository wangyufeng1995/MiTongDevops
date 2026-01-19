/**
 * K8S服务发现管理 API 服务
 */
import { api } from '../api'
import { handleK8sError } from '../../utils/k8s'
import type {
  K8sService,
  K8sIngress,
  ServiceDetail,
  ServiceListResponse,
  IngressListResponse,
  ServiceListParams,
  IngressListParams,
} from '../../types/k8s'

export class K8sServicesService {
  /**
   * 获取Service列表
   */
  async getServices(params: ServiceListParams): Promise<ServiceListResponse> {
    try {
      const response = await api.get('/api/k8s/services', { params })
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取Service详情
   */
  async getServiceDetail(
    clusterId: number,
    namespace: string,
    name: string
  ): Promise<ServiceDetail> {
    try {
      const response = await api.get(`/api/k8s/services/detail/${name}`, {
        params: { cluster_id: clusterId, namespace },
      })
      return response.data.data?.service || response.data.service
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取Service的YAML配置
   */
  async getServiceYaml(
    clusterId: number,
    namespace: string,
    name: string
  ): Promise<{ yaml: string; name: string; namespace: string; kind: string }> {
    try {
      const response = await api.get(`/api/k8s/services/${name}/yaml`, {
        params: { cluster_id: clusterId, namespace },
      })
      // 兼容不同的响应结构
      const data = response.data.data || response.data
      if (!data || !data.yaml) {
        throw new Error('获取YAML配置失败：响应数据格式错误')
      }
      return data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 更新Service配置
   */
  async updateService(data: {
    cluster_id: number
    namespace: string
    name: string
    yaml_content: string
  }): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.put(`/api/k8s/services/${data.name}`, {
        cluster_id: data.cluster_id,
        namespace: data.namespace,
        yaml_content: data.yaml_content,
      })
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取Service的Endpoints
   */
  async getServiceEndpoints(
    clusterId: number,
    namespace: string,
    name: string
  ): Promise<any> {
    try {
      const response = await api.get('/api/k8s/services/endpoints', {
        params: { cluster_id: clusterId, namespace, name },
      })
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取Ingress列表
   */
  async getIngresses(params: IngressListParams): Promise<IngressListResponse> {
    try {
      const response = await api.get('/api/k8s/services/ingresses', { params })
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取Ingress详情
   */
  async getIngressDetail(
    clusterId: number,
    namespace: string,
    name: string
  ): Promise<K8sIngress> {
    try {
      const response = await api.get(`/api/k8s/services/ingresses/${name}`, {
        params: { cluster_id: clusterId, namespace },
      })
      return response.data.ingress
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取Ingress的YAML配置
   */
  async getIngressYaml(
    clusterId: number,
    namespace: string,
    name: string
  ): Promise<{ yaml: string; name: string; namespace: string; kind: string }> {
    try {
      const response = await api.get(`/api/k8s/services/ingresses/${name}/yaml`, {
        params: { cluster_id: clusterId, namespace },
      })
      // 兼容不同的响应结构
      const data = response.data.data || response.data
      if (!data || !data.yaml) {
        throw new Error('获取YAML配置失败：响应数据格式错误')
      }
      return data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 更新Ingress配置
   */
  async updateIngress(data: {
    cluster_id: number
    namespace: string
    name: string
    yaml_content: string
  }): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.put(`/api/k8s/services/ingresses/${data.name}`, {
        cluster_id: data.cluster_id,
        namespace: data.namespace,
        yaml_content: data.yaml_content,
      })
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 删除Service
   */
  async deleteService(data: {
    cluster_id: number
    namespace: string
    name: string
  }): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post(`/api/k8s/services/${data.name}/delete`, {
        cluster_id: data.cluster_id,
        namespace: data.namespace,
      })
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 删除Ingress
   */
  async deleteIngress(data: {
    cluster_id: number
    namespace: string
    name: string
  }): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post(`/api/k8s/services/ingresses/${data.name}/delete`, {
        cluster_id: data.cluster_id,
        namespace: data.namespace,
      })
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }
}

export const k8sServicesService = new K8sServicesService()
