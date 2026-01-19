/**
 * Deployment详情组件
 * Requirements: 4.3, 4.6
 */
import React from 'react'
import { WorkloadDetail } from './WorkloadDetail'

interface DeploymentDetailProps {
  clusterId: number
  namespace: string
  name: string
}

/**
 * Deployment详情组件
 * 
 * 显示Deployment的详细信息，包括�?
 * - 基本信息（副本数、更新策略等�?
 * - Pod列表
 * - 容器信息（镜像、端口、环境变量、资源限制）
 * - Pod日志查看
 */
export const DeploymentDetail: React.FC<DeploymentDetailProps> = ({
  clusterId,
  namespace,
  name,
}) => {
  return (
    <WorkloadDetail
      clusterId={clusterId}
      namespace={namespace}
      type="deployment"
      name={name}
    />
  )
}

export default DeploymentDetail
