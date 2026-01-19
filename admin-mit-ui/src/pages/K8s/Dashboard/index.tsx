/**
 * K8S运维仪表板
 * 展示集群整体状态、资源使用情况和趋势分析
 * Requirements: 8.4
 */
import React, { useState, useEffect } from 'react'
import { Row, Col, Card, Statistic, Space, Button, message, Spin } from 'antd'
import {
  ReloadOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
  FolderOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  PageContainer,
  StatisticsGrid,
  ChartGrid,
  ContentCard,
} from '../../../components/K8s/ResponsiveLayout'
import {
  StatisticsCard,
  ClusterStatusChart,
  ResourceTrendChart,
  ResourceDistributionChart,
  ResourceGaugeChart,
  ChartCard,
} from '../../../components/K8s'
import { clustersService } from '../../../services/k8s/clusters'
import type { K8sCluster, ClusterStatusResponse } from '../../../types/k8s'

interface DashboardState {
  clusters: K8sCluster[]
  clusterStatuses: Record<number, ClusterStatusResponse>
  loading: boolean
  refreshing: boolean
}

/**
 * K8S运维仪表板页面
 */
export const K8sDashboard: React.FC = () => {
  const [state, setState] = useState<DashboardState>({
    clusters: [],
    clusterStatuses: {},
    loading: true,
    refreshing: false,
  })

  // 加载数据
  const loadData = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true }))

      // 加载集群列表
      const response = await clustersService.getClusters({
        page: 1,
        per_page: 100,
      })

      const clusters = response.clusters || []
      setState((prev) => ({ ...prev, clusters }))

      // 加载集群状态
      if (clusters.length > 0) {
        const statusMap = await clustersService.getBatchClusterStatus(
          clusters.map((c) => c.id)
        )
        setState((prev) => ({
          ...prev,
          clusterStatuses: statusMap,
          loading: false,
        }))
      } else {
        setState((prev) => ({ ...prev, loading: false }))
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '加载数据失败')
      setState((prev) => ({ ...prev, loading: false }))
    }
  }

  // 刷新数据
  const handleRefresh = async () => {
    setState((prev) => ({ ...prev, refreshing: true }))
    await loadData()
    setState((prev) => ({ ...prev, refreshing: false }))
    message.success('数据已刷新')
  }

  useEffect(() => {
    loadData()
    // 每30秒自动刷新
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  // 计算统计数据
  const onlineCount = state.clusters.filter((c) => c.status === 'online').length
  const offlineCount = state.clusters.filter((c) => c.status === 'offline').length
  const errorCount = state.clusters.filter((c) => c.status === 'error').length

  const totalNodes = Object.values(state.clusterStatuses).reduce(
    (sum, status) => sum + (status.node_count || 0),
    0
  )

  const totalPods = Object.values(state.clusterStatuses).reduce(
    (sum, status) => sum + (status.pod_count || 0),
    0
  )

  const totalNamespaces = Object.values(state.clusterStatuses).reduce(
    (sum, status) => sum + (status.namespace_count || 0),
    0
  )

  // 计算资源使用率（模拟数据，实际应从API获取）
  const nodeUtilization = onlineCount > 0 ? (totalNodes / (onlineCount * 10)) * 100 : 0
  const podUtilization = onlineCount > 0 ? (totalPods / (onlineCount * 100)) * 100 : 0

  // 准备图表数据
  const chartData = {
    clusters: state.clusters.slice(0, 10).map((c) => c.name),
    nodes: state.clusters
      .slice(0, 10)
      .map((c) => state.clusterStatuses[c.id]?.node_count || 0),
    pods: state.clusters
      .slice(0, 10)
      .map((c) => state.clusterStatuses[c.id]?.pod_count || 0),
  }

  // 模拟趋势数据（实际应从API获取历史数据）
  const trendData = {
    dates: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    nodes: [45, 48, 50, 52, 55, 58, totalNodes],
    pods: [320, 350, 380, 420, 450, 480, totalPods],
    namespaces: [28, 30, 32, 35, 38, 40, totalNamespaces],
  }

  if (state.loading) {
    return (
      <PageContainer>
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large">
            <div style={{ padding: '20px', color: '#666' }}>加载中...</div>
          </Spin>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer
      breadcrumb={[{ title: 'K8S运维' }, { title: '仪表板' }]}
      extra={
        <Button
          icon={<ReloadOutlined />}
          loading={state.refreshing}
          onClick={handleRefresh}
        >
          刷新数据
        </Button>
      }
    >
      {/* 顶部统计卡片 */}
      <StatisticsGrid>
        <StatisticsCard
          title="总集群数"
          value={state.clusters.length}
          icon={<CloudServerOutlined />}
          color="blue"
          tooltip="当前系统中管理的所有K8S集群数量"
          trend={{ value: 5, isPositive: true }}
        />
        <StatisticsCard
          title="在线集群"
          value={onlineCount}
          icon={<CheckCircleOutlined />}
          color="green"
          tooltip="当前处于在线状态的集群数量"
        />
        <StatisticsCard
          title="总节点数"
          value={totalNodes}
          icon={<DatabaseOutlined />}
          color="purple"
          tooltip="所有在线集群的节点总数"
          trend={{ value: 8, isPositive: true }}
        />
        <StatisticsCard
          title="总Pod数"
          value={totalPods}
          icon={<AppstoreOutlined />}
          color="cyan"
          tooltip="所有在线集群的Pod总数"
          trend={{ value: 12, isPositive: true }}
        />
      </StatisticsGrid>

      {/* 第二行统计 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatisticsCard
            title="命名空间数"
            value={totalNamespaces}
            icon={<FolderOutlined />}
            color="orange"
            tooltip="所有在线集群的命名空间总数"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticsCard
            title="离线集群"
            value={offlineCount}
            icon={<WarningOutlined />}
            color="red"
            tooltip="当前处于离线状态的集群数量"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="节点利用率"
              value={nodeUtilization.toFixed(1)}
              suffix="%"
              styles={{
                content: {
                  color: nodeUtilization > 80 ? '#cf1322' : '#3f8600',
                }
              }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="Pod利用率"
              value={podUtilization.toFixed(1)}
              suffix="%"
              styles={{
                content: {
                  color: podUtilization > 80 ? '#cf1322' : '#3f8600',
                }
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 - 第一行 */}
      <ChartGrid layout="1-1" gutter={[16, 16]} style={{ marginTop: 24 }}>
        <ChartCard title="集群状态分布">
          <ClusterStatusChart
            online={onlineCount}
            offline={offlineCount}
            error={errorCount}
            title=""
            height={300}
          />
        </ChartCard>
        <ChartCard title="资源使用趋势">
          <ResourceTrendChart data={trendData} title="" height={300} />
        </ChartCard>
      </ChartGrid>

      {/* 图表区域 - 第二行 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={16}>
          <ChartCard title="集群资源分布">
            <ResourceDistributionChart data={chartData} title="" height={350} />
          </ChartCard>
        </Col>
        <Col xs={24} lg={8}>
          <ChartCard title="资源使用率">
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <ResourceGaugeChart
                  value={nodeUtilization}
                  title="节点利用率"
                  height={200}
                />
              </Col>
              <Col span={24}>
                <ResourceGaugeChart
                  value={podUtilization}
                  title="Pod利用率"
                  height={200}
                />
              </Col>
            </Row>
          </ChartCard>
        </Col>
      </Row>

      {/* 集群健康状态 */}
      <ContentCard
        title={
          <Space>
            <CloudServerOutlined style={{ fontSize: 18, color: '#1890ff' }} />
            <span>集群健康状态</span>
          </Space>
        }
        style={{ marginTop: 24 }}
      >
        <Row gutter={[16, 16]}>
          {state.clusters.slice(0, 6).map((cluster) => {
            const status = state.clusterStatuses[cluster.id]
            return (
              <Col xs={24} sm={12} lg={8} key={cluster.id}>
                <Card
                  size="small"
                  title={cluster.name}
                  extra={
                    <span
                      style={{
                        color:
                          cluster.status === 'online'
                            ? '#52c41a'
                            : cluster.status === 'error'
                            ? '#ff4d4f'
                            : '#d9d9d9',
                      }}
                    >
                      {cluster.status === 'online'
                        ? '在线'
                        : cluster.status === 'error'
                        ? '错误'
                        : '离线'}
                    </span>
                  }
                >
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>节点数:</span>
                      <strong>{status?.node_count || 0}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Pod数:</span>
                      <strong>{status?.pod_count || 0}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>命名空间:</span>
                      <strong>{status?.namespace_count || 0}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>版本:</span>
                      <strong>{status?.version || cluster.version || '-'}</strong>
                    </div>
                  </Space>
                </Card>
              </Col>
            )
          })}
        </Row>
      </ContentCard>
    </PageContainer>
  )
}

export default K8sDashboard
