/**
 * K8S集群详情组件
 * 显示集群详细信息、节点列表、资源统计图表
 */
import React, { useState, useEffect } from 'react'
import {
  Descriptions,
  Card,
  Table,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Progress,
  Empty,
  Spin,
  Alert,
  Tabs,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ApiOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import {
  ResourceGaugeChart,
  ChartCard,
} from '../../../components/K8s/ClusterChart'
import type { ColumnsType } from 'antd/es/table'
import type {
  K8sCluster,
  ClusterStatusResponse,
  ClusterNode,
} from '../../../types/k8s'
import { formatDateTime } from '../../../utils'

interface ClusterDetailProps {
  cluster: K8sCluster
  status?: ClusterStatusResponse
}

export const ClusterDetail: React.FC<ClusterDetailProps> = ({
  cluster,
  status,
}) => {
  const [loading, setLoading] = useState(false)

  // 渲染状态标签
  const renderStatusTag = (status: string) => {
    const statusConfig: Record<
      string,
      { color: string; icon: React.ReactNode }
    > = {
      online: { color: 'success', icon: <CheckCircleOutlined /> },
      offline: { color: 'default', icon: <CloseCircleOutlined /> },
      error: { color: 'error', icon: <CloseCircleOutlined /> },
      pending: { color: 'processing', icon: <CheckCircleOutlined /> },
      Ready: { color: 'success', icon: <CheckCircleOutlined /> },
      NotReady: { color: 'error', icon: <CloseCircleOutlined /> },
    }

    const config = statusConfig[status] || {
      color: 'default',
      icon: <CheckCircleOutlined />,
    }

    return (
      <Tag icon={config.icon} color={config.color}>
        {status}
      </Tag>
    )
  }

  // 节点表格列定义
  const nodeColumns: ColumnsType<ClusterNode> = [
    {
      title: '节点名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text) => (
        <Space>
          <CloudServerOutlined style={{ color: '#1890ff' }} />
          {text}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => renderStatusTag(status),
    },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      width: 150,
      render: (roles: string[]) => (
        <Space>
          {roles.map((role) => (
            <Tag key={role} color={role === 'master' ? 'gold' : 'blue'}>
              {role}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 120,
    },
    {
      title: '内部IP',
      dataIndex: 'internal_ip',
      key: 'internal_ip',
      width: 150,
    },
    {
      title: '外部IP',
      dataIndex: 'external_ip',
      key: 'external_ip',
      width: 150,
      render: (ip) => ip || '-',
    },
    {
      title: '操作系统',
      dataIndex: 'os_image',
      key: 'os_image',
      ellipsis: true,
    },
    {
      title: '容器运行时',
      dataIndex: 'container_runtime',
      key: 'container_runtime',
      width: 150,
    },
    {
      title: '运行时长',
      dataIndex: 'age',
      key: 'age',
      width: 120,
    },
  ]

  // 计算资源使用率
  const calculateUsagePercent = (used?: string, total?: string): number => {
    if (!used || !total) return 0

    const parseValue = (value: string): number => {
      const num = parseFloat(value)
      if (value.includes('Ki')) return num * 1024
      if (value.includes('Mi')) return num * 1024 * 1024
      if (value.includes('Gi')) return num * 1024 * 1024 * 1024
      if (value.includes('Ti')) return num * 1024 * 1024 * 1024 * 1024
      if (value.includes('m')) return num / 1000 // CPU millicores
      return num
    }

    const usedValue = parseValue(used)
    const totalValue = parseValue(total)

    if (totalValue === 0) return 0
    return Math.round((usedValue / totalValue) * 100)
  }

  // 渲染资源配额卡片
  const renderResourceQuota = () => {
    if (!status?.resource_quota) {
      return (
        <Card title="资源配额">
          <Empty description="暂无资源配额信息" />
        </Card>
      )
    }

    const quota = status.resource_quota
    const cpuPercent = calculateUsagePercent(
      quota.cpu_allocatable,
      quota.cpu_capacity
    )
    const memoryPercent = calculateUsagePercent(
      quota.memory_allocatable,
      quota.memory_capacity
    )
    const podsPercent = calculateUsagePercent(
      quota.pods_allocatable,
      quota.pods_capacity
    )

    return (
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="资源配额统计">
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Card size="small">
                  <Statistic
                    title="CPU"
                    value={quota.cpu_allocatable || '-'}
                    suffix={`/ ${quota.cpu_capacity || '-'}`}
                    prefix={<DatabaseOutlined />}
                  />
                  {quota.cpu_capacity && (
                    <Progress
                      percent={cpuPercent}
                      status={cpuPercent > 80 ? 'exception' : 'normal'}
                      style={{ marginTop: 8 }}
                    />
                  )}
                </Card>
              </Col>
              <Col span={24}>
                <Card size="small">
                  <Statistic
                    title="内存"
                    value={quota.memory_allocatable || '-'}
                    suffix={`/ ${quota.memory_capacity || '-'}`}
                    prefix={<DatabaseOutlined />}
                  />
                  {quota.memory_capacity && (
                    <Progress
                      percent={memoryPercent}
                      status={memoryPercent > 80 ? 'exception' : 'normal'}
                      style={{ marginTop: 8 }}
                    />
                  )}
                </Card>
              </Col>
              <Col span={24}>
                <Card size="small">
                  <Statistic
                    title="Pods"
                    value={quota.pods_allocatable || '-'}
                    suffix={`/ ${quota.pods_capacity || '-'}`}
                    prefix={<AppstoreOutlined />}
                  />
                  {quota.pods_capacity && (
                    <Progress
                      percent={podsPercent}
                      status={podsPercent > 80 ? 'exception' : 'normal'}
                      style={{ marginTop: 8 }}
                    />
                  )}
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="资源使用率">
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <ResourceGaugeChart
                  value={cpuPercent}
                  title="CPU使用率"
                  height={150}
                />
              </Col>
              <Col span={24}>
                <ResourceGaugeChart
                  value={memoryPercent}
                  title="内存使用率"
                  height={150}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    )
  }

  return (
    <Spin spinning={loading}>
      <Tabs
        defaultActiveKey="info"
        items={[
          {
            key: 'info',
            label: (
              <span>
                <UnorderedListOutlined />
                基本信息
              </span>
            ),
            children: (
              <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                {/* 基本信息 */}
                <Card title="基本信息">
                  <Descriptions column={2} bordered>
                    <Descriptions.Item label="集群名称">
                      {cluster.name}
                    </Descriptions.Item>
                    <Descriptions.Item label="状态">
                      {renderStatusTag(cluster.status)}
                    </Descriptions.Item>
                    <Descriptions.Item label="API地址" span={2}>
                      {cluster.api_server}
                    </Descriptions.Item>
                    <Descriptions.Item label="认证方式">
                      <Tag color={cluster.auth_type === 'token' ? 'blue' : 'green'}>
                        {cluster.auth_type === 'token' ? 'Token' : 'Kubeconfig'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="K8S版本">
                      {status?.version || cluster.version || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="节点数">
                      {status?.node_count || cluster.node_count || 0}
                    </Descriptions.Item>
                    <Descriptions.Item label="命名空间数">
                      {status?.namespace_count || cluster.namespace_count || 0}
                    </Descriptions.Item>
                    <Descriptions.Item label="Pod数">
                      {status?.pod_count || cluster.pod_count || 0}
                    </Descriptions.Item>
                    <Descriptions.Item label="创建时间">
                      {formatDateTime(cluster.created_at)}
                    </Descriptions.Item>
                    <Descriptions.Item label="最后连接">
                      {cluster.last_connected_at
                        ? formatDateTime(cluster.last_connected_at)
                        : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="最后同步">
                      {cluster.last_sync_at ? formatDateTime(cluster.last_sync_at) : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="描述" span={2}>
                      {cluster.description || '-'}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                {/* 集群统计 */}
                {cluster.status === 'online' && status && (
                  <Row gutter={16}>
                    <Col span={8}>
                      <Card>
                        <Statistic
                          title="节点总数"
                          value={status.node_count || 0}
                          prefix={<CloudServerOutlined />}
                          styles={{ content: { color: '#3f8600' } }}
                        />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card>
                        <Statistic
                          title="命名空间数"
                          value={status.namespace_count || 0}
                          prefix={<AppstoreOutlined />}
                          styles={{ content: { color: '#1890ff' } }}
                        />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card>
                        <Statistic
                          title="Pod总数"
                          value={status.pod_count || 0}
                          prefix={<DatabaseOutlined />}
                          styles={{ content: { color: '#722ed1' } }}
                        />
                      </Card>
                    </Col>
                  </Row>
                )}

                {/* 离线提示 */}
                {cluster.status !== 'online' && (
                  <Alert
                    title="集群离线"
                    description="集群当前处于离线状态，无法获取详细信息。请检查集群连接配置。"
                    type="warning"
                    showIcon
                  />
                )}
              </Space>
            ),
          },
          {
            key: 'resources',
            label: (
              <span>
                <BarChartOutlined />
                资源配额
              </span>
            ),
            children: (
              <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                {/* 资源配额 */}
                {cluster.status === 'online' && renderResourceQuota()}

                {/* 离线提示 */}
                {cluster.status !== 'online' && (
                  <Alert
                    title="集群离线"
                    description="集群当前处于离线状态，无法获取资源配额信息。"
                    type="warning"
                    showIcon
                  />
                )}
              </Space>
            ),
          },
          {
            key: 'nodes',
            label: (
              <span>
                <CloudServerOutlined />
                节点列表
              </span>
            ),
            children: (
              <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                {/* 节点列表 */}
                {cluster.status === 'online' && status?.nodes && (
                  <Card title="节点列表">
                    {status.nodes.length > 0 ? (
                      <Table
                        columns={nodeColumns}
                        dataSource={status.nodes}
                        rowKey="name"
                        pagination={false}
                        scroll={{ x: 1200 }}
                      />
                    ) : (
                      <Empty description="暂无节点信息" />
                    )}
                  </Card>
                )}

                {/* 离线提示 */}
                {cluster.status !== 'online' && (
                  <Alert
                    title="集群离线"
                    description="集群当前处于离线状态，无法获取节点信息。"
                    type="warning"
                    showIcon
                  />
                )}
              </Space>
            ),
          },
        ]}
      />
    </Spin>
  )
}

export default ClusterDetail
