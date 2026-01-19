/**
 * K8S存储管理 API 服务
 */
import { api } from '../api'
import { handleK8sError } from '../../utils/k8s'
import type {
  K8sPersistentVolume,
  PersistentVolumeClaim,
  K8sStorageClass,
  PersistentVolumeListResponse,
  PersistentVolumeClaimListResponse,
  StorageClassListResponse,
  StorageListParams,
} from '../../types/k8s'

export class StorageService {
  /**
   * 获取PersistentVolume列表
   */
  async getPersistentVolumes(params: StorageListParams): Promise<PersistentVolumeListResponse> {
    try {
      const response = await api.get('/api/k8s/persistent-volumes', { params })
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取PersistentVolume详情
   */
  async getPersistentVolumeDetail(
    clusterId: number,
    name: string
  ): Promise<K8sPersistentVolume> {
    try {
      const response = await api.get(`/api/k8s/persistent-volumes/${name}`, {
        params: { cluster_id: clusterId },
      })
      return response.data.persistent_volume
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取PersistentVolumeClaim列表
   */
  async getPersistentVolumeClaims(
    params: StorageListParams
  ): Promise<PersistentVolumeClaimListResponse> {
    try {
      const response = await api.get('/api/k8s/persistent-volume-claims', { params })
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取PersistentVolumeClaim详情
   */
  async getPersistentVolumeClaimDetail(
    clusterId: number,
    namespace: string,
    name: string
  ): Promise<PersistentVolumeClaim> {
    try {
      const response = await api.get(`/api/k8s/persistent-volume-claims/${name}`, {
        params: { cluster_id: clusterId, namespace },
      })
      return response.data.persistent_volume_claim
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取StorageClass列表
   */
  async getStorageClasses(clusterId: number): Promise<StorageClassListResponse> {
    try {
      const response = await api.get('/api/k8s/storage-classes', {
        params: { cluster_id: clusterId },
      })
      return response.data
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }

  /**
   * 获取StorageClass详情
   */
  async getStorageClassDetail(clusterId: number, name: string): Promise<K8sStorageClass> {
    try {
      const response = await api.get(`/api/k8s/storage-classes/${name}`, {
        params: { cluster_id: clusterId },
      })
      return response.data.storage_class
    } catch (error) {
      handleK8sError(error)
      throw error
    }
  }
}

export const storageService = new StorageService()
