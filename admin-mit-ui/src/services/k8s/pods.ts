/**
 * K8S Pod管理 API 服务
 * 用于工作负载展开功能中的Pod列表、详情、日志等操作
 */
import { api } from '../api'
import { handleK8sError } from '../../utils/k8s'
import type {
  K8sPod,
  K8sPodContainer,
  K8sPodEvent,
  PodListParams,
  PodListResponseData,
  PodDetailResponseData,
  PodContainersResponseData,
  PodLogsQueryParams,
  PodLogsResponseData,
} from '../../types/k8s'

export class PodsService {
  /**
   * 获取Pod列表
   * 支持通过label_selector过滤工作负载关联的Pod
   */
  async getPods(params: PodListParams): Promise<K8sPod[]> {
    try {
      const response = await api.get<PodListResponseData>('/api/k8s/workloads/pods', { params })
      return response.data?.pods || []
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取Pod详情
   * 包含基本信息、容器列表、标签、注解、事件
   */
  async getPodDetail(
    clusterId: number,
    namespace: string,
    podName: string
  ): Promise<{ pod: K8sPod; events: K8sPodEvent[] }> {
    try {
      const response = await api.get<PodDetailResponseData>('/api/k8s/workloads/pods/detail', {
        params: {
          cluster_id: clusterId,
          namespace,
          pod_name: podName,
        },
      })
      return {
        pod: response.data?.pod || {} as K8sPod,
        events: response.data?.events || [],
      }
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取Pod的容器列表
   */
  async getPodContainers(
    clusterId: number,
    namespace: string,
    podName: string
  ): Promise<K8sPodContainer[]> {
    try {
      const response = await api.get<PodContainersResponseData>('/api/k8s/workloads/pods/containers', {
        params: {
          cluster_id: clusterId,
          namespace,
          pod_name: podName,
        },
      })
      return response.data?.containers || []
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取Pod日志
   * 支持容器选择、行数限制、时间戳、搜索
   */
  async getPodLogs(params: PodLogsQueryParams): Promise<{
    podName: string
    container: string
    logs: string
    lineCount?: number
  }> {
    try {
      const response = await api.get<PodLogsResponseData>('/api/k8s/workloads/pods/logs', {
        params: {
          cluster_id: params.cluster_id,
          namespace: params.namespace,
          pod_name: params.pod_name,
          container: params.container,
          tail_lines: params.tail_lines || 100,
          timestamps: params.timestamps !== false,
          search: params.search,
        },
      })
      return {
        podName: response.data?.pod_name || params.pod_name,
        container: response.data?.container || params.container || '',
        logs: response.data?.logs || '',
        lineCount: response.data?.line_count,
      }
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 下载Pod日志
   * 返回日志内容作为Blob用于下载
   */
  async downloadPodLogs(params: PodLogsQueryParams): Promise<Blob> {
    try {
      const { logs } = await this.getPodLogs({
        ...params,
        tail_lines: params.tail_lines || 10000, // 下载时获取更多行
      })
      return new Blob([logs], { type: 'text/plain' })
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 根据工作负载获取关联的Pod列表
   * 通过工作负载的selector构建label_selector
   */
  async getPodsByWorkload(
    clusterId: number,
    namespace: string,
    selector: Record<string, string>
  ): Promise<K8sPod[]> {
    // 将selector对象转换为label_selector字符串
    const labelSelector = Object.entries(selector)
      .map(([key, value]) => `${key}=${value}`)
      .join(',')

    return this.getPods({
      cluster_id: clusterId,
      namespace,
      label_selector: labelSelector,
    })
  }
}

export const podsService = new PodsService()
