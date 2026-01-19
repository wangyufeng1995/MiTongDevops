/**
 * Pod展开行组件
 * 在工作负载列表中展开显示关联的Pod列表
 * Requirements: 1.1, 1.2, 1.4, 1.5
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Table,
  Button,
  Space,
  Tooltip,
  Alert,
  Spin,
  Tag,
  Popconfirm,
  message,
} from 'antd'
import {
  EyeOutlined,
  FileTextOutlined,
  CodeOutlined,
  ReloadOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { podsService } from '../../../services/k8s/pods'
import { workloadsService } from '../../../services/k8s/workloads'
import { StatusBadge } from '../../../components/K8s/StatusBadge'
import { useAuthStore } from '../../../store/auth'
import { formatDateTime } from '../../../utils'
import type { K8sPod, WorkloadType, PodStatus } from '../../../types/k8s'

export interface PodExpandedRowProps {
  clusterId: number
  namespace: string
  workloadName: string
  workloadType: WorkloadType
  labelSelector: Record<string, string>
  onViewDetail?: (pod: K8sPod) => void
  onViewLogs?: (pod: K8sPod) => void
  onOpenShell?: (pod: K8sPod) => void
  onDeletePod?: (pod: K8sPod) => void
}

export const PodExpandedRow: React.FC<PodExpandedRowProps> = ({
  clusterId,
  namespace,
  workloadName,
  workloadType,
  labelSelector,
  onViewDetail,
  onViewLogs,
  onOpenShell,
  onDeletePod,
}) => {
  const [pods, setPods] = useState<K8sPod[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { isAdmin } = useAuthStore()
  const canUseShell = isAdmin()

  // 加载Pod列表
  const loadPods = useCallback(async () => {
    if (!clusterId || !namespace || !labelSelector || Object.keys(labelSelector).length === 0) {
      setPods([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const podList = await podsService.getPodsByWorkload(
        clusterId,
        namespace,
        labelSelector
      )
      setPods(podList)
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || '获取Pod列表失败'
      setError(errorMessage)
      setPods([])
    } finally {
      setLoading(false)
    }
  }, [clusterId, namespace, labelSelector])

  // 初始加载
  useEffect(() => {
    loadPods()
  }, [loadPods])

  // 刷新Pod列表
  const handleRefresh = () => {
    loadPods()
  }

  // 删除Pod
  const handleDeletePod = async (pod: K8sPod) => {
    try {
      await workloadsService.deletePod({
        cluster_id: clusterId,
        namespace: namespace,
        pod_name: pod.name,
      })
      message.success(`Pod "${pod.name}" 删除成功`)
      loadPods() // 刷新列表
      onDeletePod?.(pod)
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || '删除Pod失败'
      message.error(errorMessage)
    }
  }

  // 渲染Pod状态
  const renderPodStatus = (status: PodStatus, phase: string) => {
    return (
      <Space size="small">
        <StatusBadge status={status} size="sm" />
        {phase && phase !== status && (
          <Tag color="default" style={{ fontSize: '11px' }}>
            {phase}
          </Tag>
        )}
      </Space>
    )
  }

  // 渲染容器数量
  const renderContainerCount = (pod: K8sPod) => {
    const total = pod.containers?.length || 0
    const ready = pod.containers?.filter(c => c.ready).length || 0
    const color = ready === total ? 'green' : ready > 0 ? 'orange' : 'red'
    
    return (
      <Tag color={color}>
        {ready}/{total}
      </Tag>
    )
  }

  // 表格列定义
  const columns: ColumnsType<K8sPod> = [
    {
      title: 'Pod名称',
      dataIndex: 'name',
      key: 'name',
      width: 280,
      ellipsis: true,
      render: (name: string) => (
        <Tooltip title={name}>
          <span style={{ fontWeight: 500, fontSize: '13px' }}>{name}</span>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 140,
      render: (_, record) => renderPodStatus(record.status, record.phase),
    },
    {
      title: '容器',
      key: 'containers',
      width: 80,
      align: 'center',
      render: (_, record) => renderContainerCount(record),
    },
    {
      title: '重启次数',
      dataIndex: 'restart_count',
      key: 'restart_count',
      width: 90,
      align: 'center',
      render: (count: number) => (
        <span style={{ color: count > 0 ? '#faad14' : '#52c41a' }}>
          {count}
        </span>
      ),
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      width: 130,
      render: (ip: string) => ip || '-',
    },
    {
      title: '节点',
      dataIndex: 'node_name',
      key: 'node_name',
      width: 150,
      ellipsis: true,
      render: (nodeName: string) => (
        <Tooltip title={nodeName}>
          <span>{nodeName || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time: string) => formatDateTime(time),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onViewDetail?.(record)}
            />
          </Tooltip>
          <Tooltip title="查看日志">
            <Button
              type="link"
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => onViewLogs?.(record)}
            />
          </Tooltip>
          {canUseShell && (
            <Tooltip title="终端">
              <Button
                type="link"
                size="small"
                icon={<CodeOutlined />}
                onClick={() => onOpenShell?.(record)}
                disabled={record.status !== 'Running'}
              />
            </Tooltip>
          )}
          {canUseShell && (
            <Popconfirm
              title="确定要删除这个Pod吗？"
              description="删除后Pod将被重新调度（如果由控制器管理）"
              onConfirm={() => handleDeletePod(record)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="删除">
                <Button
                  type="link"
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  // 加载中状态
  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin spinning={true}>
          <div style={{ padding: '20px' }}>加载Pod列表中...</div>
        </Spin>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div style={{ padding: '16px' }}>
        <Alert
          type="error"
          showIcon
          title="获取Pod列表失败"
          description={error}
          action={
            <Button size="small" onClick={handleRefresh}>
              重试
            </Button>
          }
        />
      </div>
    )
  }

  // 空状态
  if (pods.length === 0) {
    return (
      <div style={{ padding: '16px' }}>
        <Alert
          type="info"
          showIcon
          title="暂无Pod"
          description={`工作负载 ${workloadName} 当前没有运行中的Pod`}
          action={
            <Button size="small" icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 16px 16px' }}>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', color: '#666' }}>
          共 {pods.length} 个Pod
        </span>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
        >
          刷新
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={pods}
        rowKey="name"
        size="small"
        pagination={false}
        scroll={{ x: 1100 }}
        style={{ 
          backgroundColor: '#fafafa',
          borderRadius: '4px',
        }}
      />
    </div>
  )
}

export default PodExpandedRow
