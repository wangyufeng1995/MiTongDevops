/**
 * DaemonSet详情组件
 * Requirements: 4.3, 4.6
 */
import React from 'react'
import { WorkloadDetail } from './WorkloadDetail'

interface DaemonSetDetailProps {
  clusterId: number
  namespace: string
  name: string
}

/**
 * DaemonSet详情组件
 * 
 * 显示DaemonSet的详细信息，包括�?
 * - 基本信息（节点选择器、更新策略等�?
 * - Pod列表（每个节点一个Pod�?
 * - 容器信息（镜像、端口、环境变量、资源限制）
 * - Pod日志查看
 * 
 * 注意：DaemonSet不支持扩缩容操作，因为它会在每个匹配的节点上运行一个Pod
 */
export const DaemonSetDetail: React.FC<DaemonSetDetailProps> = ({
  clusterId,
  namespace,
  name,
}) => {
  return (
    <WorkloadDetail
      clusterId={clusterId}
      namespace={namespace}
      type="daemonset"
      name={name}
    />
  )
}

export default DaemonSetDetail
