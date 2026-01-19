/**
 * K8S资源图标�?
 * 提供统一的K8S资源图标，增强视觉识�?
 */
import React from 'react'
import {
  CloudServerOutlined,
  FolderOutlined,
  AppstoreOutlined,
  ApiOutlined,
  FileTextOutlined,
  LockOutlined,
  DatabaseOutlined,
  HddOutlined,
  ClusterOutlined,
  ContainerOutlined,
  DeploymentUnitOutlined,
  GlobalOutlined,
  SettingOutlined,
  SafetyOutlined,
  NodeIndexOutlined,
  BoxPlotOutlined,
} from '@ant-design/icons'

/**
 * 资源类型图标映射
 */
export const K8sResourceIcons = {
  // 集群相关
  cluster: CloudServerOutlined,
  node: NodeIndexOutlined,
  
  // 命名空间
  namespace: FolderOutlined,
  
  // 工作负载
  deployment: DeploymentUnitOutlined,
  statefulset: DatabaseOutlined,
  daemonset: ClusterOutlined,
  pod: AppstoreOutlined,
  container: ContainerOutlined,
  
  // 服务发现
  service: ApiOutlined,
  ingress: GlobalOutlined,
  endpoint: BoxPlotOutlined,
  
  // 配置
  configmap: FileTextOutlined,
  secret: LockOutlined,
  
  // 存储
  persistentVolume: HddOutlined,
  persistentVolumeClaim: DatabaseOutlined,
  storageClass: SettingOutlined,
  
  // 其他
  default: AppstoreOutlined,
}

/**
 * 获取资源图标组件
 */
export const getResourceIcon = (resourceType: string): React.ComponentType => {
  const type = resourceType.toLowerCase().replace(/[-_]/g, '')
  return K8sResourceIcons[type as keyof typeof K8sResourceIcons] || K8sResourceIcons.default
}

/**
 * 资源图标组件
 */
interface ResourceIconProps {
  type: string
  style?: React.CSSProperties
  className?: string
}

export const ResourceIcon: React.FC<ResourceIconProps> = ({
  type,
  style,
  className,
}) => {
  const IconComponent = getResourceIcon(type)
  return <IconComponent style={style} className={className} />
}

/**
 * 带背景的资源图标
 */
interface ResourceIconWithBgProps {
  type: string
  size?: 'small' | 'medium' | 'large'
  color?: string
}

export const ResourceIconWithBg: React.FC<ResourceIconWithBgProps> = ({
  type,
  size = 'medium',
  color = '#1890ff',
}) => {
  const IconComponent = getResourceIcon(type)
  
  const sizeConfig = {
    small: { container: 32, icon: 16 },
    medium: { container: 40, icon: 20 },
    large: { container: 56, icon: 28 },
  }
  
  const { container, icon } = sizeConfig[size]
  
  return (
    <div
      style={{
        width: container,
        height: container,
        borderRadius: 8,
        backgroundColor: `${color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <IconComponent style={{ fontSize: icon, color }} />
    </div>
  )
}

export default ResourceIcon
