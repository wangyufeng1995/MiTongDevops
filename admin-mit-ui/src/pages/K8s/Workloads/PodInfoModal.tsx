/**
 * Pod详情弹窗组件
 * 显示Pod基本信息、容器列表、标签、注解、事件
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Modal,
  Descriptions,
  Table,
  Tag,
  Space,
  Spin,
  Alert,
  Collapse,
  Empty,
  Tooltip,
} from 'antd'
import {
  InfoCircleOutlined,
  ContainerOutlined,
  TagsOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { podsService } from '../../../services/k8s/pods'
import { StatusBadge } from '../../../components/K8s/StatusBadge'
import { formatDateTime } from '../../../utils'
import type { K8sPod, K8sPodContainer, K8sPodEvent, K8sPodCondition } from '../../../types/k8s'

export interface PodInfoModalProps {
  visible: boolean
  clusterId: number
  namespace: string
  podName: string
  onClose: () => void
}

/**
 * Pod详情弹窗组件
 */
export const PodInfoModal: React.FC<PodInfoModalProps> = ({
  visible,
  clusterId,
  namespace,
  podName,
  onClose,
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pod, setPod] = useState<K8sPod | null>(null)
  const [events, setEvents] = useState<K8sPodEvent[]>([])

  // 加载Pod详情
  const loadPodDetail = useCallback(async () => {
    if (!clusterId || !namespace || !podName) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await podsService.getPodDetail(clusterId, namespace, podName)
      setPod(result.pod)
      setEvents(result.events || [])
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || '获取Pod详情失败'
      setError(errorMessage)
      setPod(null)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [clusterId, namespace, podName])

  // 弹窗打开时加载数据
  useEffect(() => {
    if (visible) {
      loadPodDetail()
    }
  }, [visible, loadPodDetail])

  // 关闭弹窗时清理状态
  const handleClose = () => {
    setPod(null)
    setEvents([])
    setError(null)
    onClose()
  }

  // 渲染容器状态图标
  const renderContainerStateIcon = (state: string) => {
    switch (state) {
      case 'running':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'waiting':
        return <ClockCircleOutlined style={{ color: '#faad14' }} />
      case 'terminated':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />
    }
  }

  // 渲染容器状态标签
  const renderContainerState = (container: K8sPodContainer) => {
    const stateColors: Record<string, string> = {
      running: 'green',
      waiting: 'orange',
      terminated: 'red',
    }
    
    return (
      <Space size="small">
        {renderContainerStateIcon(container.state)}
        <Tag color={stateColors[container.state] || 'default'}>
          {container.state}
        </Tag>
        {container.state_reason && (
          <Tooltip title={container.state_message}>
            <span style={{ color: '#666', fontSize: '12px' }}>
              ({container.state_reason})
            </span>
          </Tooltip>
        )}
      </Space>
    )
  }

  // 渲染资源信息
  const renderResources = (container: K8sPodContainer) => {
    const { resources } = container
    if (!resources || (!resources.requests && !resources.limits)) {
      return <span style={{ color: '#999' }}>-</span>
    }

    const parts: string[] = []
    if (resources.requests?.cpu) parts.push(`CPU请求: ${resources.requests.cpu}`)
    if (resources.limits?.cpu) parts.push(`CPU限制: ${resources.limits.cpu}`)
    if (resources.requests?.memory) parts.push(`内存请求: ${resources.requests.memory}`)
    if (resources.limits?.memory) parts.push(`内存限制: ${resources.limits.memory}`)

    return (
      <Tooltip title={parts.join(' | ')}>
        <span style={{ fontSize: '12px' }}>
          {resources.limits?.cpu || resources.requests?.cpu || '-'} / {resources.limits?.memory || resources.requests?.memory || '-'}
        </span>
      </Tooltip>
    )
  }

  // 容器列表表格列定义
  const containerColumns: ColumnsType<K8sPodContainer> = [
    {
      title: '容器名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name: string) => (
        <span style={{ fontWeight: 500 }}>{name}</span>
      ),
    },
    {
      title: '镜像',
      dataIndex: 'image',
      key: 'image',
      ellipsis: true,
      render: (image: string) => (
        <Tooltip title={image}>
          <span style={{ fontSize: '12px' }}>{image}</span>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      key: 'state',
      width: 180,
      render: (_, record) => renderContainerState(record),
    },
    {
      title: '就绪',
      dataIndex: 'ready',
      key: 'ready',
      width: 80,
      align: 'center',
      render: (ready: boolean) => (
        ready ? (
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px' }} />
        ) : (
          <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: '16px' }} />
        )
      ),
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
      title: '资源',
      key: 'resources',
      width: 150,
      render: (_, record) => renderResources(record),
    },
  ]

  // 事件列表表格列定义
  const eventColumns: ColumnsType<K8sPodEvent> = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: string) => (
        <Tag color={type === 'Normal' ? 'blue' : 'orange'}>
          {type}
        </Tag>
      ),
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 120,
      render: (reason: string) => (
        <span style={{ fontWeight: 500 }}>{reason}</span>
      ),
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (message: string) => (
        <Tooltip title={message}>
          <span style={{ fontSize: '12px' }}>{message}</span>
        </Tooltip>
      ),
    },
    {
      title: '次数',
      dataIndex: 'count',
      key: 'count',
      width: 70,
      align: 'center',
    },
    {
      title: '最后发生时间',
      dataIndex: 'last_timestamp',
      key: 'last_timestamp',
      width: 160,
      render: (time: string) => formatDateTime(time),
    },
  ]

  // 渲染条件状态
  const renderConditions = (conditions: K8sPodCondition[]) => {
    if (!conditions || conditions.length === 0) {
      return <Empty description="暂无条件信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
    }

    return (
      <Space wrap size="small">
        {conditions.map((condition, index) => {
          const isTrue = condition.status === 'True'
          const color = isTrue ? 'green' : condition.status === 'False' ? 'red' : 'default'
          const icon = isTrue ? (
            <CheckCircleOutlined />
          ) : condition.status === 'False' ? (
            <CloseCircleOutlined />
          ) : (
            <ClockCircleOutlined />
          )

          return (
            <Tooltip
              key={index}
              title={
                <div>
                  <div>状态: {condition.status}</div>
                  {condition.reason && <div>原因: {condition.reason}</div>}
                  {condition.message && <div>消息: {condition.message}</div>}
                  {condition.last_transition_time && (
                    <div>转换时间: {formatDateTime(condition.last_transition_time)}</div>
                  )}
                </div>
              }
            >
              <Tag color={color} icon={icon}>
                {condition.type}
              </Tag>
            </Tooltip>
          )
        })}
      </Space>
    )
  }

  // 渲染标签和注解
  const renderLabelsOrAnnotations = (data: Record<string, string> | undefined, type: 'labels' | 'annotations') => {
    if (!data || Object.keys(data).length === 0) {
      return <Empty description={`暂无${type === 'labels' ? '标签' : '注解'}`} image={Empty.PRESENTED_IMAGE_SIMPLE} />
    }

    return (
      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {Object.entries(data).map(([key, value]) => (
          <div
            key={key}
            style={{
              padding: '6px 10px',
              marginBottom: '6px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          >
            <span style={{ fontWeight: 500, color: type === 'labels' ? '#1890ff' : '#722ed1' }}>
              {key}
            </span>
            <span style={{ color: '#666', margin: '0 8px' }}>=</span>
            <span style={{ wordBreak: 'break-all' }}>{value}</span>
          </div>
        ))}
      </div>
    )
  }

  // 渲染弹窗内容
  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <Spin size="large" spinning={true}>
            <div style={{ padding: '20px' }}>加载Pod详情中...</div>
          </Spin>
        </div>
      )
    }

    if (error) {
      return (
        <Alert
          type="error"
          showIcon
          title="获取Pod详情失败"
          description={error}
          type="error"
          showIcon
        />
      )
    }

    if (!pod) {
      return (
        <Empty description="暂无Pod信息" />
      )
    }

    return (
      <div>
        {/* 基本信息 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <InfoCircleOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
            <span style={{ fontWeight: 500, fontSize: '14px' }}>基本信息</span>
          </div>
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Pod名称">{pod.name}</Descriptions.Item>
            <Descriptions.Item label="命名空间">{pod.namespace}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <StatusBadge status={pod.status} size="sm" />
            </Descriptions.Item>
            <Descriptions.Item label="阶段">
              <Tag>{pod.phase}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="IP地址">{pod.ip || '-'}</Descriptions.Item>
            <Descriptions.Item label="节点">{pod.node_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="重启次数">
              <span style={{ color: pod.restart_count > 0 ? '#faad14' : '#52c41a' }}>
                {pod.restart_count}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {formatDateTime(pod.created_at)}
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* 条件状态 */}
        {pod.conditions && pod.conditions.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <CheckCircleOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
              <span style={{ fontWeight: 500, fontSize: '14px' }}>条件状态</span>
            </div>
            {renderConditions(pod.conditions)}
          </div>
        )}

        {/* 容器列表 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <ContainerOutlined style={{ marginRight: '8px', color: '#722ed1' }} />
            <span style={{ fontWeight: 500, fontSize: '14px' }}>
              容器列表 ({pod.containers?.length || 0})
            </span>
          </div>
          <Table
            columns={containerColumns}
            dataSource={pod.containers || []}
            rowKey="name"
            size="small"
            pagination={false}
            scroll={{ x: 800 }}
          />
        </div>

        {/* 标签和注解（可折叠） */}
        <Collapse
          defaultActiveKey={[]}
          style={{ marginBottom: '16px' }}
          items={[
            {
              key: 'labels',
              label: (
                <Space>
                  <TagsOutlined style={{ color: '#1890ff' }} />
                  <span>标签 ({Object.keys(pod.labels || {}).length})</span>
                </Space>
              ),
              children: renderLabelsOrAnnotations(pod.labels, 'labels'),
            },
            {
              key: 'annotations',
              label: (
                <Space>
                  <TagsOutlined style={{ color: '#722ed1' }} />
                  <span>注解 ({Object.keys(pod.annotations || {}).length})</span>
                </Space>
              ),
              children: renderLabelsOrAnnotations(pod.annotations, 'annotations'),
            },
          ]}
        />

        {/* 事件列表 */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <HistoryOutlined style={{ marginRight: '8px', color: '#faad14' }} />
            <span style={{ fontWeight: 500, fontSize: '14px' }}>
              事件列表 ({events.length})
            </span>
          </div>
          {events.length > 0 ? (
            <Table
              columns={eventColumns}
              dataSource={events}
              rowKey={(record, index) => `${record.reason}-${index}`}
              size="small"
              pagination={false}
              scroll={{ x: 700, y: 200 }}
            />
          ) : (
            <Empty description="暂无事件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </div>
      </div>
    )
  }

  return (
    <Modal
      title={
        <Space>
          <InfoCircleOutlined />
          <span>Pod详情 - {podName}</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={900}
      destroyOnHidden
      styles={{
        body: {
          maxHeight: '70vh',
          overflowY: 'auto',
          padding: '16px 24px',
        },
      }}
    >
      {renderContent()}
    </Modal>
  )
}

export default PodInfoModal
