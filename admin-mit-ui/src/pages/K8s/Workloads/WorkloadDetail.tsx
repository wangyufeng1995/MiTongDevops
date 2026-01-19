/**
 * K8S工作负载详情组件
 * 显示Pod列表、容器信息、环境变量、资源限制
 * Requirements: 4.3, 4.6
 */
import React, { useState, useEffect } from 'react'
import {
  Tabs,
  Descriptions,
  Tag,
  Space,
  Spin,
  Alert,
  message,
  Modal,
  Button,
} from 'antd'
import {
  InfoCircleOutlined,
  ContainerOutlined,
  SettingOutlined,
  DatabaseOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { workloadsService } from '../../../services/k8s/workloads'
import { PodList } from '../../../components/K8s/PodList'
import type {
  WorkloadDetail as WorkloadDetailType,
  WorkloadType,
  Container,
  EnvVar,
  Pod,
} from '../../../types/k8s'
import { formatDateTime } from '../../../utils'

const { TabPane } = Tabs

interface WorkloadDetailProps {
  clusterId: number
  namespace: string
  type: WorkloadType
  name: string
}

/**
 * 工作负载详情组件
 */
export const WorkloadDetail: React.FC<WorkloadDetailProps> = ({
  clusterId,
  namespace,
  type,
  name,
}) => {
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<WorkloadDetailType | null>(null)
  const [logModalVisible, setLogModalVisible] = useState(false)
  const [logContent, setLogContent] = useState('')
  const [logLoading, setLogLoading] = useState(false)
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null)
  const [selectedContainer, setSelectedContainer] = useState<string>('')

  // 加载工作负载详情
  useEffect(() => {
    loadDetail()
  }, [clusterId, namespace, type, name])

  const loadDetail = async () => {
    try {
      setLoading(true)
      const data = await workloadsService.getWorkloadDetail(
        clusterId,
        namespace,
        type,
        name
      )
      setDetail(data)
    } catch (error: any) {
      message.error(error.response?.data?.message || '加载详情失败')
    } finally {
      setLoading(false)
    }
  }

  // 查看Pod日志
  const handleViewLogs = async (pod: Pod, container?: string) => {
    try {
      setLogLoading(true)
      setLogModalVisible(true)
      setSelectedPod(pod)
      setSelectedContainer(container || pod.containers[0]?.name || '')

      const logs = await workloadsService.getPodLogs({
        cluster_id: clusterId,
        namespace: pod.namespace,
        pod_name: pod.name,
        container: container || pod.containers[0]?.name,
        tail_lines: 500,
      })

      setLogContent(logs)
    } catch (error: any) {
      message.error(error.response?.data?.message || '获取日志失败')
      setLogContent('获取日志失败')
    } finally {
      setLogLoading(false)
    }
  }

  // 渲染环境变量
  const renderEnvVars = (envVars?: EnvVar[]) => {
    if (!envVars || envVars.length === 0) {
      return <div style={{ color: '#999' }}>无环境变量</div>
    }

    return (
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {envVars.map((env, index) => (
          <div
            key={index}
            style={{
              padding: '8px 12px',
              marginBottom: '8px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          >
            <div style={{ fontWeight: 500, marginBottom: '4px' }}>
              {env.name}
            </div>
            {env.value && (
              <div style={{ color: '#666' }}>
                值: {env.value}
              </div>
            )}
            {env.value_from?.config_map_key_ref && (
              <div style={{ color: '#1890ff' }}>
                来源: ConfigMap/{env.value_from.config_map_key_ref.name} (
                {env.value_from.config_map_key_ref.key})
              </div>
            )}
            {env.value_from?.secret_key_ref && (
              <div style={{ color: '#52c41a' }}>
                来源: Secret/{env.value_from.secret_key_ref.name} (
                {env.value_from.secret_key_ref.key})
              </div>
            )}
            {env.value_from?.field_ref && (
              <div style={{ color: '#722ed1' }}>
                来源: Field/{env.value_from.field_ref.field_path}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  // 渲染资源限制
  const renderResources = (container: Container) => {
    const { resources } = container

    if (!resources) {
      return <div style={{ color: '#999' }}>未设置资源限制</div>
    }

    return (
      <Descriptions column={2} size="small" bordered>
        {resources.requests?.cpu && (
          <Descriptions.Item label="CPU请求">
            {resources.requests.cpu}
          </Descriptions.Item>
        )}
        {resources.requests?.memory && (
          <Descriptions.Item label="内存请求">
            {resources.requests.memory}
          </Descriptions.Item>
        )}
        {resources.limits?.cpu && (
          <Descriptions.Item label="CPU限制">
            {resources.limits.cpu}
          </Descriptions.Item>
        )}
        {resources.limits?.memory && (
          <Descriptions.Item label="内存限制">
            {resources.limits.memory}
          </Descriptions.Item>
        )}
      </Descriptions>
    )
  }

  // 渲染容器端口
  const renderPorts = (container: Container) => {
    if (!container.ports || container.ports.length === 0) {
      return <div style={{ color: '#999' }}>无端口配置</div>
    }

    return (
      <Space wrap>
        {container.ports.map((port, index) => (
          <Tag key={index} color="blue">
            {port.name && `${port.name}: `}
            {port.container_port}/{port.protocol}
          </Tag>
        ))}
      </Space>
    )
  }

  // 渲染卷挂载
  const renderVolumeMounts = (container: Container) => {
    if (!container.volume_mounts || container.volume_mounts.length === 0) {
      return <div style={{ color: '#999' }}>无卷挂载</div>
    }

    return (
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {container.volume_mounts.map((mount, index) => (
          <div
            key={index}
            style={{
              padding: '8px 12px',
              marginBottom: '8px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          >
            <div style={{ fontWeight: 500 }}>{mount.name}</div>
            <div style={{ color: '#666', marginTop: '4px' }}>
              挂载路径: {mount.mount_path}
              {mount.sub_path && ` (子路径: ${mount.sub_path})`}
              {mount.read_only && (
                <Tag color="orange" style={{ marginLeft: '8px' }}>
                  只读
                </Tag>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!detail) {
    return (
      <Alert
        title="加载失败"
        description="无法加载工作负载详情"
        type="error"
        showIcon
      />
    )
  }

  return (
    <div>
      <Tabs defaultActiveKey="basic">
        {/* 基本信息 */}
        <TabPane
          tab={
            <span>
              <InfoCircleOutlined />
              基本信息
            </span>
          }
          key="basic"
        >
          <Descriptions column={2} bordered>
            <Descriptions.Item label="名称">{detail.name}</Descriptions.Item>
            <Descriptions.Item label="类型">
              {detail.type.toUpperCase()}
            </Descriptions.Item>
            <Descriptions.Item label="命名空间">
              {detail.namespace}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={detail.status === 'Running' ? 'green' : 'orange'}>
                {detail.status}
              </Tag>
            </Descriptions.Item>
            {detail.replicas !== undefined && (
              <>
                <Descriptions.Item label="期望副本数">
                  {detail.replicas}
                </Descriptions.Item>
                <Descriptions.Item label="可用副本数">
                  {detail.available_replicas || 0}
                </Descriptions.Item>
                <Descriptions.Item label="就绪副本数">
                  {detail.ready_replicas || 0}
                </Descriptions.Item>
                <Descriptions.Item label="更新副本数">
                  {detail.updated_replicas || 0}
                </Descriptions.Item>
              </>
            )}
            <Descriptions.Item label="创建时间" span={2}>
              {formatDateTime(detail.created_at)}
            </Descriptions.Item>
            {detail.labels && Object.keys(detail.labels).length > 0 && (
              <Descriptions.Item label="标签" span={2}>
                <Space wrap>
                  {Object.entries(detail.labels).map(([key, value]) => (
                    <Tag key={key} color="blue">
                      {key}: {value}
                    </Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            )}
            {detail.selector && Object.keys(detail.selector).length > 0 && (
              <Descriptions.Item label="选择器" span={2}>
                <Space wrap>
                  {Object.entries(detail.selector).map(([key, value]) => (
                    <Tag key={key} color="purple">
                      {key}: {value}
                    </Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            )}
            {detail.strategy && (
              <Descriptions.Item label="更新策略" span={2}>
                <div>
                  <div>类型: {detail.strategy.type}</div>
                  {detail.strategy.rolling_update && (
                    <div style={{ marginTop: '8px', color: '#666' }}>
                      <div>
                        最大激增: {detail.strategy.rolling_update.max_surge || '-'}
                      </div>
                      <div>
                        最大不可用:{' '}
                        {detail.strategy.rolling_update.max_unavailable || '-'}
                      </div>
                    </div>
                  )}
                </div>
              </Descriptions.Item>
            )}
          </Descriptions>

          {/* 条件信息 */}
          {detail.conditions && detail.conditions.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h4 style={{ marginBottom: '12px' }}>条件</h4>
              <Space wrap>
                {detail.conditions.map((condition, index) => (
                  <Tag
                    key={index}
                    color={condition.status === 'True' ? 'green' : 'default'}
                  >
                    {condition.type}: {condition.status}
                    {condition.reason && ` (${condition.reason})`}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
        </TabPane>

        {/* Pod列表 */}
        <TabPane
          tab={
            <span>
              <ContainerOutlined />
              Pod列表 ({detail.pods?.length || 0})
            </span>
          }
          key="pods"
        >
          <PodList
            pods={detail.pods || []}
            onViewLogs={handleViewLogs}
            emptyText="暂无Pod"
          />
        </TabPane>

        {/* 容器信息 */}
        <TabPane
          tab={
            <span>
              <DatabaseOutlined />
              容器信息 ({detail.containers?.length || 0})
            </span>
          }
          key="containers"
        >
          {detail.containers && detail.containers.length > 0 ? (
            <Tabs tabPosition="left">
              {detail.containers.map((container, index) => (
                <TabPane tab={container.name} key={index.toString()}>
                  <div style={{ padding: '0 16px' }}>
                    <Descriptions column={1} bordered>
                      <Descriptions.Item label="容器名称">
                        {container.name}
                      </Descriptions.Item>
                      <Descriptions.Item label="镜像">
                        {container.image}
                      </Descriptions.Item>
                      <Descriptions.Item label="端口">
                        {renderPorts(container)}
                      </Descriptions.Item>
                    </Descriptions>

                    <h4 style={{ marginTop: '24px', marginBottom: '12px' }}>
                      资源限制
                    </h4>
                    {renderResources(container)}

                    <h4 style={{ marginTop: '24px', marginBottom: '12px' }}>
                      环境变量
                    </h4>
                    {renderEnvVars(container.env)}

                    <h4 style={{ marginTop: '24px', marginBottom: '12px' }}>
                      卷挂载
                    </h4>
                    {renderVolumeMounts(container)}
                  </div>
                </TabPane>
              ))}
            </Tabs>
          ) : (
            <Alert
              title="暂无容器信息"
              type="info"
              showIcon
            />
          )}
        </TabPane>

        {/* 持久化卷声明（仅StatefulSet）*/}
        {type === 'statefulset' && detail.volume_claim_templates && (
          <TabPane
            tab={
              <span>
                <SettingOutlined />
                持久化卷声明
              </span>
            }
            key="pvc"
          >
            {detail.volume_claim_templates.length > 0 ? (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {detail.volume_claim_templates.map((pvc, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '16px',
                      marginBottom: '16px',
                      backgroundColor: '#f5f5f5',
                      borderRadius: '4px',
                    }}
                  >
                    <h4>{pvc.name}</h4>
                    <Descriptions column={2} size="small" style={{ marginTop: '12px' }}>
                      <Descriptions.Item label="状态">
                        <Tag color={pvc.status === 'Bound' ? 'green' : 'orange'}>
                          {pvc.status}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="容量">
                        {pvc.capacity || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="存储类">
                        {pvc.storage_class || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="访问模式">
                        <Space wrap>
                          {pvc.access_modes.map((mode, i) => (
                            <Tag key={i}>{mode}</Tag>
                          ))}
                        </Space>
                      </Descriptions.Item>
                    </Descriptions>
                  </div>
                ))}
              </div>
            ) : (
              <Alert
                title="暂无持久化卷声明"
                type="info"
                showIcon
              />
            )}
          </TabPane>
        )}
      </Tabs>

      {/* Pod日志弹窗 */}
      <Modal
        title={
          <span>
            <FileTextOutlined style={{ marginRight: '8px' }} />
            Pod日志 - {selectedPod?.name}
            {selectedContainer && ` / ${selectedContainer}`}
          </span>
        }
        open={logModalVisible}
        onCancel={() => setLogModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setLogModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={1000}
        styles={{ body: { padding: 0 } }}
      >
        <div
          style={{
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            padding: '16px',
            maxHeight: '600px',
            overflowY: 'auto',
            fontFamily: 'Consolas, Monaco, monospace',
            fontSize: '12px',
            lineHeight: '1.6',
          }}
        >
          {logLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin />
            </div>
          ) : (
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {logContent || '暂无日志'}
            </pre>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default WorkloadDetail
