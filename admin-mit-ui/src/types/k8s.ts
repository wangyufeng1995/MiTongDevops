/**
 * K8S运维管理系统类型定义
 */

import { PaginationParams, PaginatedResponse } from './api'

// ==================== 集群管理类型 ====================

/**
 * 集群认证类型
 */
export type ClusterAuthType = 'token' | 'kubeconfig'

/**
 * 集群状态
 */
export type ClusterStatus = 'online' | 'offline' | 'error' | 'pending'

/**
 * K8S集群
 */
export interface K8sCluster {
  id: number
  name: string
  api_server: string
  auth_type: ClusterAuthType
  description?: string
  status: ClusterStatus
  version?: string
  node_count?: number
  namespace_count?: number
  pod_count?: number
  last_connected_at?: string
  last_sync_at?: string
  created_at: string
  updated_at: string
  // 敏感信息（仅在获取详情时返回）
  token?: string
  kubeconfig?: string
}

/**
 * 创建集群请求
 */
export interface CreateClusterRequest {
  name: string
  api_server: string
  auth_type: ClusterAuthType
  token?: string
  kubeconfig?: string
  description?: string
}

/**
 * 更新集群请求
 */
export interface UpdateClusterRequest {
  id: number
  name?: string
  api_server?: string
  auth_type?: ClusterAuthType
  token?: string
  kubeconfig?: string
  description?: string
}

/**
 * 集群连接测试请求
 */
export interface ClusterTestRequest {
  id?: number
  api_server?: string
  auth_type?: ClusterAuthType
  token?: string
  kubeconfig?: string
}

/**
 * 集群连接测试响应
 */
export interface ClusterTestResponse {
  success: boolean
  message: string
  version?: string
  node_count?: number
}

/**
 * 集群状态响应
 */
export interface ClusterStatusResponse {
  status: ClusterStatus
  version?: string
  node_count?: number
  namespace_count?: number
  pod_count?: number
  nodes?: ClusterNode[]
  resource_quota?: ResourceQuota
}

/**
 * 集群节点
 */
export interface ClusterNode {
  name: string
  status: string
  roles: string[]
  age: string
  version: string
  internal_ip?: string
  external_ip?: string
  os_image?: string
  kernel_version?: string
  container_runtime?: string
}

/**
 * 资源配额
 */
export interface ResourceQuota {
  cpu_capacity?: string
  cpu_allocatable?: string
  memory_capacity?: string
  memory_allocatable?: string
  pods_capacity?: string
  pods_allocatable?: string
}

/**
 * 集群列表响应
 */
export interface ClusterListResponse extends PaginatedResponse<K8sCluster> {
  clusters?: K8sCluster[]
}

/**
 * 集群列表查询参数
 */
export interface ClusterListParams extends PaginationParams {
  status?: ClusterStatus
}

// ==================== 命名空间类型 ====================

/**
 * 命名空间状态
 */
export type NamespaceStatus = 'Active' | 'Terminating'

/**
 * K8S命名空间
 */
export interface K8sNamespace {
  name: string
  status: NamespaceStatus
  created_at: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  resource_quota?: NamespaceResourceQuota
}

/**
 * 命名空间资源配额
 */
export interface NamespaceResourceQuota {
  cpu_limit?: string
  cpu_used?: string
  memory_limit?: string
  memory_used?: string
  pods_limit?: string
  pods_used?: string
}

/**
 * 创建命名空间请求
 */
export interface CreateNamespaceRequest {
  cluster_id: number
  name: string
  labels?: Record<string, string>
}

/**
 * 删除命名空间请求
 */
export interface DeleteNamespaceRequest {
  cluster_id: number
  namespace: string
}

/**
 * 命名空间列表响应
 */
export interface NamespaceListResponse extends PaginatedResponse<K8sNamespace> {
  namespaces?: K8sNamespace[]
}

/**
 * 命名空间列表查询参数
 */
export interface NamespaceListParams extends PaginationParams {
  cluster_id: number
}

// ==================== 工作负载类型 ====================

/**
 * 工作负载类型
 */
export type WorkloadType = 'deployment' | 'statefulset' | 'daemonset'

/**
 * 工作负载状态
 */
export type WorkloadStatus = 'Running' | 'Pending' | 'Failed' | 'Unknown'

/**
 * K8S工作负载
 */
export interface K8sWorkload {
  name: string
  type: WorkloadType
  namespace: string
  replicas?: number
  available_replicas?: number
  ready_replicas?: number
  updated_replicas?: number
  status: WorkloadStatus
  images: string[]
  created_at: string
  labels?: Record<string, string>
  selector?: Record<string, string>
}

/**
 * 工作负载详情
 */
export interface WorkloadDetail extends K8sWorkload {
  pods: Pod[]
  containers: Container[]
  conditions?: WorkloadCondition[]
  strategy?: DeploymentStrategy
  volume_claim_templates?: PersistentVolumeClaim[]
}

/**
 * Pod信息
 */
export interface Pod {
  name: string
  namespace: string
  status: string
  phase: string
  node_name?: string
  pod_ip?: string
  host_ip?: string
  start_time?: string
  restart_count: number
  containers: PodContainer[]
  conditions?: PodCondition[]
}

/**
 * Pod容器
 */
export interface PodContainer {
  name: string
  image: string
  ready: boolean
  restart_count: number
  state: ContainerState
}

/**
 * 容器状态
 */
export interface ContainerState {
  running?: {
    started_at: string
  }
  waiting?: {
    reason: string
    message?: string
  }
  terminated?: {
    exit_code: number
    reason: string
    message?: string
    started_at?: string
    finished_at?: string
  }
}

/**
 * Pod条件
 */
export interface PodCondition {
  type: string
  status: string
  last_probe_time?: string
  last_transition_time?: string
  reason?: string
  message?: string
}

/**
 * 容器信息
 */
export interface Container {
  name: string
  image: string
  ports?: ContainerPort[]
  env?: EnvVar[]
  resources?: ResourceRequirements
  volume_mounts?: VolumeMount[]
}

/**
 * 容器端口
 */
export interface ContainerPort {
  name?: string
  container_port: number
  protocol: string
}

/**
 * 环境变量
 */
export interface EnvVar {
  name: string
  value?: string
  value_from?: EnvVarSource
}

/**
 * 环境变量来源
 */
export interface EnvVarSource {
  config_map_key_ref?: {
    name: string
    key: string
  }
  secret_key_ref?: {
    name: string
    key: string
  }
  field_ref?: {
    field_path: string
  }
}

/**
 * 资源需求
 */
export interface ResourceRequirements {
  limits?: {
    cpu?: string
    memory?: string
  }
  requests?: {
    cpu?: string
    memory?: string
  }
}

/**
 * 卷挂载
 */
export interface VolumeMount {
  name: string
  mount_path: string
  read_only?: boolean
  sub_path?: string
}

/**
 * 工作负载条件
 */
export interface WorkloadCondition {
  type: string
  status: string
  last_update_time?: string
  last_transition_time?: string
  reason?: string
  message?: string
}

/**
 * 部署策略
 */
export interface DeploymentStrategy {
  type: string
  rolling_update?: {
    max_surge?: string
    max_unavailable?: string
  }
}

/**
 * 扩缩容请求
 */
export interface ScaleWorkloadRequest {
  cluster_id: number
  namespace: string
  type: WorkloadType
  name: string
  replicas: number
}

/**
 * 重启工作负载请求
 */
export interface RestartWorkloadRequest {
  cluster_id: number
  namespace: string
  type: WorkloadType
  name: string
}

/**
 * 工作负载列表响应
 */
export interface WorkloadListResponse extends PaginatedResponse<K8sWorkload> {
  workloads?: K8sWorkload[]
}

/**
 * 工作负载列表查询参数
 */
export interface WorkloadListParams extends PaginationParams {
  cluster_id: number
  namespace: string
  type?: WorkloadType
}

/**
 * Pod日志查询参数
 */
export interface PodLogsParams {
  cluster_id: number
  namespace: string
  pod_name: string
  container?: string
  tail_lines?: number
  follow?: boolean
}

// ==================== 服务发现类型 ====================

/**
 * 服务类型
 */
export type ServiceType = 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName'

/**
 * K8S服务
 */
export interface K8sService {
  name: string
  namespace: string
  type: ServiceType
  cluster_ip?: string
  external_ips?: string[]
  ports: ServicePort[]
  selector?: Record<string, string>
  created_at: string
  labels?: Record<string, string>
}

/**
 * 服务端口
 */
export interface ServicePort {
  name?: string
  protocol: string
  port: number
  target_port: number | string
  node_port?: number
}

/**
 * 服务详情
 */
export interface ServiceDetail extends K8sService {
  endpoints?: ServiceEndpoint[]
  pods?: Pod[]
}

/**
 * 服务端点
 */
export interface ServiceEndpoint {
  addresses: EndpointAddress[]
  ports: EndpointPort[]
}

/**
 * 端点地址
 */
export interface EndpointAddress {
  ip: string
  hostname?: string
  node_name?: string
  target_ref?: {
    kind: string
    name: string
    namespace: string
  }
}

/**
 * 端点端口
 */
export interface EndpointPort {
  name?: string
  port: number
  protocol: string
}

/**
 * K8S Ingress
 */
export interface K8sIngress {
  name: string
  namespace: string
  hosts: string[]
  paths: IngressPath[]
  tls?: IngressTLS[]
  created_at: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
}

/**
 * Ingress路径
 */
export interface IngressPath {
  path: string
  path_type: string
  backend: IngressBackend
}

/**
 * Ingress后端
 */
export interface IngressBackend {
  service_name: string
  service_port: number | string
}

/**
 * Ingress TLS
 */
export interface IngressTLS {
  hosts: string[]
  secret_name: string
}

/**
 * 服务列表响应
 */
export interface ServiceListResponse extends PaginatedResponse<K8sService> {
  services?: K8sService[]
}

/**
 * Ingress列表响应
 */
export interface IngressListResponse extends PaginatedResponse<K8sIngress> {
  ingresses?: K8sIngress[]
}

/**
 * 服务列表查询参数
 */
export interface ServiceListParams extends PaginationParams {
  cluster_id: number
  namespace: string
  type?: ServiceType
}

/**
 * Ingress列表查询参数
 */
export interface IngressListParams extends PaginationParams {
  cluster_id: number
  namespace: string
}

// ==================== 配置管理类型 ====================

/**
 * 配置类型
 */
export type ConfigType = 'configmap' | 'secret'

/**
 * K8S ConfigMap
 */
export interface K8sConfigMap {
  name: string
  namespace: string
  data: Record<string, string>
  created_at: string
  labels?: Record<string, string>
}

/**
 * K8S Secret
 */
export interface K8sSecret {
  name: string
  namespace: string
  type: string
  data: Record<string, string> // 已脱敏的数据
  created_at: string
  labels?: Record<string, string>
}

/**
 * 创建ConfigMap请求
 */
export interface CreateConfigMapRequest {
  cluster_id: number
  namespace: string
  name: string
  data: Record<string, string>
  labels?: Record<string, string>
}

/**
 * 创建Secret请求
 */
export interface CreateSecretRequest {
  cluster_id: number
  namespace: string
  name: string
  type?: string
  data: Record<string, string>
  labels?: Record<string, string>
}

/**
 * 删除配置请求
 */
export interface DeleteConfigRequest {
  cluster_id: number
  namespace: string
  name: string
}

/**
 * ConfigMap列表响应
 */
export interface ConfigMapListResponse extends PaginatedResponse<K8sConfigMap> {
  configmaps?: K8sConfigMap[]
}

/**
 * Secret列表响应
 */
export interface SecretListResponse extends PaginatedResponse<K8sSecret> {
  secrets?: K8sSecret[]
}

/**
 * 配置列表查询参数
 */
export interface ConfigListParams extends PaginationParams {
  cluster_id: number
  namespace: string
}

// ==================== 存储管理类型 ====================

/**
 * 存储状态
 */
export type StorageStatus = 'Available' | 'Bound' | 'Released' | 'Failed' | 'Pending'

/**
 * 访问模式
 */
export type AccessMode = 'ReadWriteOnce' | 'ReadOnlyMany' | 'ReadWriteMany' | 'ReadWriteOncePod'

/**
 * 回收策略
 */
export type ReclaimPolicy = 'Retain' | 'Recycle' | 'Delete'

/**
 * K8S持久化卷
 */
export interface K8sPersistentVolume {
  name: string
  capacity: string
  access_modes: AccessMode[]
  reclaim_policy: ReclaimPolicy
  status: StorageStatus
  claim?: string
  storage_class?: string
  volume_mode?: string
  created_at: string
  labels?: Record<string, string>
}

/**
 * K8S持久化卷声明
 */
export interface PersistentVolumeClaim {
  name: string
  namespace: string
  status: StorageStatus
  volume_name?: string
  capacity?: string
  access_modes: AccessMode[]
  storage_class?: string
  volume_mode?: string
  created_at: string
  labels?: Record<string, string>
}

/**
 * K8S存储类
 */
export interface K8sStorageClass {
  name: string
  provisioner: string
  parameters?: Record<string, string>
  reclaim_policy?: ReclaimPolicy
  volume_binding_mode?: string
  allow_volume_expansion?: boolean
  created_at: string
  labels?: Record<string, string>
}

/**
 * PV列表响应
 */
export interface PersistentVolumeListResponse extends PaginatedResponse<K8sPersistentVolume> {
  persistent_volumes?: K8sPersistentVolume[]
}

/**
 * PVC列表响应
 */
export interface PersistentVolumeClaimListResponse extends PaginatedResponse<PersistentVolumeClaim> {
  persistent_volume_claims?: PersistentVolumeClaim[]
}

/**
 * StorageClass列表响应
 */
export interface StorageClassListResponse extends PaginatedResponse<K8sStorageClass> {
  storage_classes?: K8sStorageClass[]
}

/**
 * 存储列表查询参数
 */
export interface StorageListParams extends PaginationParams {
  cluster_id: number
  namespace?: string
  status?: StorageStatus
}

// ==================== 错误类型 ====================

/**
 * K8S错误代码
 */
export type K8sErrorCode =
  | 'CONNECTION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'PERMISSION_DENIED'
  | 'RESOURCE_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT_ERROR'
  | 'TIMEOUT_ERROR'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'

/**
 * K8S错误响应
 */
export interface K8sErrorResponse {
  success: false
  error_code: K8sErrorCode
  message: string
  details?: string
  field?: string
  suggestions?: string[]
}

// ==================== 操作审计类型 ====================

/**
 * 操作类型
 */
export type OperationType = 'create' | 'update' | 'delete' | 'scale' | 'restart'

/**
 * 资源类型
 */
export type ResourceType =
  | 'cluster'
  | 'namespace'
  | 'deployment'
  | 'statefulset'
  | 'daemonset'
  | 'service'
  | 'ingress'
  | 'configmap'
  | 'secret'
  | 'persistentvolume'
  | 'persistentvolumeclaim'
  | 'storageclass'

/**
 * K8S操作日志
 */
export interface K8sOperation {
  id: number
  tenant_id: number
  user_id: number
  cluster_id?: number
  operation_type: OperationType
  resource_type: ResourceType
  resource_name?: string
  namespace?: string
  operation_data?: any
  status: 'success' | 'failed'
  error_message?: string
  created_at: string
}

// ==================== Pod展开功能类型 ====================

/**
 * Pod状态
 */
export type PodStatus = 'Running' | 'Pending' | 'Succeeded' | 'Failed' | 'Unknown'

/**
 * K8S Pod（用于工作负载展开显示）
 */
export interface K8sPod {
  name: string
  namespace: string
  status: PodStatus
  phase: string
  ip: string
  node_name: string
  restart_count: number
  created_at: string
  labels: Record<string, string>
  annotations: Record<string, string>
  containers: K8sPodContainer[]
  conditions: K8sPodCondition[]
  owner_references?: K8sOwnerReference[]
}

/**
 * Pod容器详情
 */
export interface K8sPodContainer {
  name: string
  image: string
  ready: boolean
  restart_count: number
  state: 'running' | 'waiting' | 'terminated'
  state_reason?: string
  state_message?: string
  started_at?: string
  finished_at?: string
  exit_code?: number
  resources: {
    requests?: { cpu?: string; memory?: string }
    limits?: { cpu?: string; memory?: string }
  }
}

/**
 * Pod条件详情
 */
export interface K8sPodCondition {
  type: string
  status: 'True' | 'False' | 'Unknown'
  reason?: string
  message?: string
  last_transition_time?: string
  last_probe_time?: string
}

/**
 * Pod事件
 */
export interface K8sPodEvent {
  type: string
  reason: string
  message: string
  count: number
  first_timestamp: string
  last_timestamp: string
  source?: {
    component?: string
    host?: string
  }
}

/**
 * K8S Owner Reference
 */
export interface K8sOwnerReference {
  api_version: string
  kind: string
  name: string
  uid: string
  controller?: boolean
  block_owner_deletion?: boolean
}

/**
 * Pod Shell会话状态
 */
export type PodShellStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

/**
 * Pod Shell会话
 */
export interface K8sPodShellSession {
  session_id: string
  cluster_id: number
  namespace: string
  pod_name: string
  container: string
  status: PodShellStatus
  created_at: string
  error_message?: string
}

/**
 * Pod列表查询参数
 */
export interface PodListParams {
  cluster_id: number
  namespace: string
  label_selector?: string
}

/**
 * Pod列表响应数据
 */
export interface PodListResponseData {
  pods: K8sPod[]
}

/**
 * Pod详情响应数据
 */
export interface PodDetailResponseData {
  pod: K8sPod
  events: K8sPodEvent[]
}

/**
 * Pod容器列表响应数据
 */
export interface PodContainersResponseData {
  containers: K8sPodContainer[]
}

/**
 * Pod日志查询参数（扩展）
 */
export interface PodLogsQueryParams {
  cluster_id: number
  namespace: string
  pod_name: string
  container?: string
  tail_lines?: number
  timestamps?: boolean
  search?: string
}

/**
 * Pod日志响应数据
 */
export interface PodLogsResponseData {
  pod_name: string
  container: string
  logs: string
  line_count?: number
}

/**
 * Pod Shell创建请求
 */
export interface PodShellCreateRequest {
  cluster_id: number
  namespace: string
  pod_name: string
  container: string
  cols?: number
  rows?: number
}

/**
 * Pod Shell输入请求
 */
export interface PodShellInputRequest {
  session_id: string
  data: string
}

/**
 * Pod Shell调整大小请求
 */
export interface PodShellResizeRequest {
  session_id: string
  cols: number
  rows: number
}

/**
 * Pod Shell终止请求
 */
export interface PodShellTerminateRequest {
  session_id: string
}
