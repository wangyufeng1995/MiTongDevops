/**
 * StatefulSet详情组件
 * Requirements: 4.3, 4.6
 */
import React from 'react'
import { WorkloadDetail } from './WorkloadDetail'

interface StatefulSetDetailProps {
  clusterId: number
  namespace: string
  name: string
}

/**
 * StatefulSet详情组件
 * 
 * 显示StatefulSet的详细信息，包括�?
 * - 基本信息（副本数、更新策略等�?
 * - Pod列表
 * - 容器信息（镜像、端口、环境变量、资源限制）
 * - 持久化卷声明（PVC�?
 * - Pod日志查看
 */
export const StatefulSetDetail: React.FC<StatefulSetDetailProps> = ({
  clusterId,
  namespace,
  name,
}) => {
  return (
    <WorkloadDetail
      clusterId={clusterId}
      namespace={namespace}
      type="statefulset"
      name={name}
    />
  )
}

export default StatefulSetDetail
