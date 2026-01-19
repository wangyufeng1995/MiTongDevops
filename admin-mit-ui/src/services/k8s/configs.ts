/**
 * K8S配置管理 API 服务
 */
import { api } from '../api'
import { handleK8sError } from '../../utils/k8s'
import type {
  K8sConfigMap,
  K8sSecret,
  CreateConfigMapRequest,
  CreateSecretRequest,
  DeleteConfigRequest,
  ConfigMapListResponse,
  SecretListResponse,
  ConfigListParams,
} from '../../types/k8s'

export class ConfigsService {
  /**
   * 获取ConfigMap列表
   */
  async getConfigMaps(params: ConfigListParams): Promise<ConfigMapListResponse> {
    try {
      const response = await api.get('/api/k8s/configmaps', { params })
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取ConfigMap详情
   */
  async getConfigMapDetail(
    clusterId: number,
    namespace: string,
    name: string
  ): Promise<K8sConfigMap> {
    try {
      const response = await api.get(`/api/k8s/configmaps/${name}`, {
        params: { cluster_id: clusterId, namespace },
      })
      return response.data.configmap
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 创建ConfigMap
   */
  async createConfigMap(data: CreateConfigMapRequest): Promise<K8sConfigMap> {
    try {
      const response = await api.post('/api/k8s/configmaps', data)
      return response.data.configmap
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 删除ConfigMap
   */
  async deleteConfigMap(data: DeleteConfigRequest): Promise<void> {
    try {
      await api.post('/api/k8s/configmaps/delete', data)
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取Secret列表
   */
  async getSecrets(params: ConfigListParams): Promise<SecretListResponse> {
    try {
      const response = await api.get('/api/k8s/secrets', { params })
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取Secret详情
   */
  async getSecretDetail(
    clusterId: number,
    namespace: string,
    name: string
  ): Promise<K8sSecret> {
    try {
      const response = await api.get(`/api/k8s/secrets/${name}`, {
        params: { cluster_id: clusterId, namespace },
      })
      return response.data.secret
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 创建Secret
   */
  async createSecret(data: CreateSecretRequest): Promise<K8sSecret> {
    try {
      const response = await api.post('/api/k8s/secrets', data)
      return response.data.secret
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 删除Secret
   */
  async deleteSecret(data: DeleteConfigRequest): Promise<void> {
    try {
      await api.post('/api/k8s/secrets/delete', data)
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 检查配置使用情况
   */
  async checkConfigUsage(
    clusterId: number,
    namespace: string,
    configType: 'configmap' | 'secret',
    name: string
  ): Promise<any[]> {
    try {
      const response = await api.get('/api/k8s/configs/usage', {
        params: { cluster_id: clusterId, namespace, config_type: configType, name },
      })
      return response.data.workloads || []
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }
}

export const configsService = new ConfigsService()
