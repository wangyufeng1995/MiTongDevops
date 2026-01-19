/**
 * K8S工作负载管理 API 服务
 */
import { api } from '../api'
import { handleK8sError } from '../../utils/k8s'
import type {
  K8sWorkload,
  WorkloadDetail,
  ScaleWorkloadRequest,
  RestartWorkloadRequest,
  WorkloadListResponse,
  WorkloadListParams,
  PodLogsParams,
  WorkloadType,
} from '../../types/k8s'

export class WorkloadsService {
  /**
   * 获取工作负载列表
   */
  async getWorkloads(params: WorkloadListParams): Promise<WorkloadListResponse> {
    try {
      const response = await api.get('/api/k8s/workloads', { params })
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取工作负载详情
   */
  async getWorkloadDetail(
    clusterId: number,
    namespace: string,
    type: WorkloadType,
    name: string
  ): Promise<WorkloadDetail> {
    try {
      const response = await api.get('/api/k8s/workloads/detail', {
        params: { cluster_id: clusterId, namespace, type, name },
      })
      // 后端返回的数据在 response.data.data 中
      return response.data.data || response.data.workload || response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 扩缩容工作负载
   */
  async scaleWorkload(data: ScaleWorkloadRequest): Promise<K8sWorkload> {
    try {
      const response = await api.post('/api/k8s/workloads/scale', data)
      return response.data.workload
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 重启工作负载
   */
  async restartWorkload(data: RestartWorkloadRequest): Promise<K8sWorkload> {
    try {
      const response = await api.post('/api/k8s/workloads/restart', data)
      return response.data.workload
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取Pod日志
   */
  async getPodLogs(params: PodLogsParams): Promise<string> {
    try {
      const response = await api.get('/api/k8s/pods/logs', { params })
      return response.data.logs
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 删除Pod
   */
  async deletePod(data: {
    cluster_id: number
    namespace: string
    pod_name: string
    grace_period_seconds?: number
  }): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post('/api/k8s/workloads/pods/delete', data)
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 通过YAML创建或更新K8S资源
   */
  async applyYaml(data: {
    cluster_id: number
    namespace: string
    yaml_content: string
  }): Promise<{
    success: boolean
    message: string
    data: {
      action: 'created' | 'updated'
      kind: string
      name: string
      namespace: string
    }
  }> {
    try {
      const response = await api.post('/api/k8s/workloads/apply', data)
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取工作负载YAML配置
   */
  async getWorkloadYaml(
    clusterId: number,
    namespace: string,
    type: WorkloadType,
    name: string
  ): Promise<{ yaml: string; name: string; namespace: string; type: string }> {
    try {
      const response = await api.get(`/api/k8s/workloads/${name}/yaml`, {
        params: { cluster_id: clusterId, namespace, type },
      })
      // API 返回格式: { data: { yaml, name, ... }, success: true }
      // response.data 是 axios 解析后的响应体
      const result = response.data?.data || response.data
      return result
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 更新工作负载
   */
  async updateWorkload(data: {
    cluster_id: number
    namespace: string
    type: WorkloadType
    name: string
    yaml_content: string
  }): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.put(`/api/k8s/workloads/${data.name}`, data)
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 删除工作负载 (使用POST请求)
   */
  async deleteWorkload(data: {
    cluster_id: number
    namespace: string
    type: WorkloadType
    name: string
  }): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post(`/api/k8s/workloads/${data.name}/delete`, data)
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取Deployment列表
   */
  async getDeployments(clusterId: number, namespace: string): Promise<K8sWorkload[]> {
    try {
      const response = await this.getWorkloads({
        cluster_id: clusterId,
        namespace,
        type: 'deployment',
      })
      return response.workloads || []
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取StatefulSet列表
   */
  async getStatefulSets(clusterId: number, namespace: string): Promise<K8sWorkload[]> {
    try {
      const response = await this.getWorkloads({
        cluster_id: clusterId,
        namespace,
        type: 'statefulset',
      })
      return response.workloads || []
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取DaemonSet列表
   */
  async getDaemonSets(clusterId: number, namespace: string): Promise<K8sWorkload[]> {
    try {
      const response = await this.getWorkloads({
        cluster_id: clusterId,
        namespace,
        type: 'daemonset',
      })
      return response.workloads || []
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }
}

export const workloadsService = new WorkloadsService()
