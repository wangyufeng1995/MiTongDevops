/**
 * K8S集群表单组件
 * 支持Token和Kubeconfig认证方式切换、表单验证、连接测试
 */
import React, { useState, useEffect } from 'react'
import {
  Form,
  Input,
  Select,
  Button,
  Space,
  message,
  Alert,
  Radio,
  Spin,
  Tag,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ApiOutlined,
} from '@ant-design/icons'
import { clustersService } from '../../../services/k8s/clusters'
import type {
  K8sCluster,
  ClusterAuthType,
  CreateClusterRequest,
  UpdateClusterRequest,
  ClusterTestResponse,
} from '../../../types/k8s'

const { TextArea } = Input
const { Option } = Select

interface ClusterFormProps {
  cluster?: K8sCluster | null
  onSuccess: () => void
  onCancel: () => void
}

interface FormValues {
  name: string
  api_server: string
  auth_type: ClusterAuthType
  token?: string
  kubeconfig?: string
  description?: string
}

interface TestResult {
  success: boolean
  message: string
  version?: string
  node_count?: number
}

export const ClusterForm: React.FC<ClusterFormProps> = ({
  cluster,
  onSuccess,
  onCancel,
}) => {
  const [form] = Form.useForm<FormValues>()
  const [submitting, setSubmitting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [authType, setAuthType] = useState<ClusterAuthType>('token')
  const [loading, setLoading] = useState(false)

  // 初始化表单 - 编辑模式下加载完整信息
  useEffect(() => {
    const loadClusterDetail = async () => {
      if (cluster?.id) {
        setLoading(true)
        try {
          // 获取包含敏感信息的集群详情
          const detail = await clustersService.getClusterDetail(cluster.id)
          form.setFieldsValue({
            name: detail.name,
            api_server: detail.api_server,
            auth_type: detail.auth_type,
            description: detail.description,
            token: detail.token,
            kubeconfig: detail.kubeconfig,
          })
          setAuthType(detail.auth_type)
        } catch (error) {
          message.error('加载集群信息失败')
          // 回退到基本信息
          form.setFieldsValue({
            name: cluster.name,
            api_server: cluster.api_server,
            auth_type: cluster.auth_type,
            description: cluster.description,
          })
          setAuthType(cluster.auth_type)
        } finally {
          setLoading(false)
        }
      } else {
        form.setFieldsValue({
          auth_type: 'token',
        })
        setAuthType('token')
      }
    }

    loadClusterDetail()
  }, [cluster, form])

  // 认证方式切换
  const handleAuthTypeChange = (value: ClusterAuthType) => {
    setAuthType(value)
    setTestResult(null)
    // 清空认证相关字段
    form.setFieldsValue({
      token: undefined,
      kubeconfig: undefined,
    })
  }

  // 测试连接
  const handleTestConnection = async () => {
    try {
      // 验证必填字段
      await form.validateFields(['api_server', 'auth_type'])

      const values = form.getFieldsValue()

      // 验证认证信息
      if (authType === 'token' && !values.token) {
        message.warning('请输入Token')
        return
      }
      if (authType === 'kubeconfig' && !values.kubeconfig) {
        message.warning('请输入Kubeconfig')
        return
      }

      setTesting(true)
      setTestResult(null)

      const testData = {
        id: cluster?.id,
        api_server: values.api_server?.trim(),
        auth_type: values.auth_type,
        token: values.token?.trim(),
        kubeconfig: values.kubeconfig?.trim(),
      }

      const result: ClusterTestResponse = await clustersService.testConnection(
        testData
      )

      setTestResult({
        success: result.success,
        message: result.message,
        version: result.version,
        node_count: result.node_count,
      })

      if (result.success) {
        message.success('连接测试成功')
      } else {
        message.error('连接测试失败')
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || '连接测试失败'
      setTestResult({
        success: false,
        message: errorMsg,
      })
      message.error(errorMsg)
    } finally {
      setTesting(false)
    }
  }

  // 提交表单
  const handleSubmit = async (values: FormValues) => {
    try {
      setSubmitting(true)

      if (cluster) {
        // 更新集群
        const updateData: UpdateClusterRequest = {
          id: cluster.id,
          name: values.name,
          api_server: values.api_server,
          auth_type: values.auth_type,
          description: values.description,
        }

        // 只在修改时传递认证信息
        if (values.token) {
          updateData.token = values.token
        }
        if (values.kubeconfig) {
          updateData.kubeconfig = values.kubeconfig
        }

        await clustersService.updateCluster(updateData)
        message.success('更新成功')
      } else {
        // 创建集群
        const createData: CreateClusterRequest = {
          name: values.name,
          api_server: values.api_server,
          auth_type: values.auth_type,
          description: values.description,
        }

        if (values.auth_type === 'token') {
          createData.token = values.token
        } else {
          createData.kubeconfig = values.kubeconfig
        }

        await clustersService.createCluster(createData)
        message.success('创建成功')
      }

      onSuccess()
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 渲染测试结果
  const renderTestResult = () => {
    if (!testResult) return null

    return (
      <Alert
        title={testResult.success ? '连接成功' : '连接失败'}
        description={
          <div>
            <div>{testResult.message}</div>
            {testResult.success && testResult.version && (
              <div style={{ marginTop: 8 }}>
                <Space>
                  <Tag color="blue">版本: {testResult.version}</Tag>
                  {testResult.node_count !== undefined && (
                    <Tag color="green">节点数: {testResult.node_count}</Tag>
                  )}
                </Space>
              </div>
            )}
          </div>
        }
        type={testResult.success ? 'success' : 'error'}
        showIcon
        icon={
          testResult.success ? (
            <CheckCircleOutlined />
          ) : (
            <CloseCircleOutlined />
          )
        }
        style={{ marginBottom: 16 }}
      />
    )
  }

  return (
    <Spin spinning={submitting || loading}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          auth_type: 'token',
        }}
      >
        {/* 集群名称 */}
        <Form.Item
          label="集群名称"
          name="name"
          rules={[
            { required: true, message: '请输入集群名称' },
            { max: 100, message: '集群名称不能超过100个字符' },
          ]}
        >
          <Input
            placeholder="请输入集群名称，如：生产环境K8S"
            prefix={<ApiOutlined />}
          />
        </Form.Item>

        {/* API服务器地址 */}
        <Form.Item
          label="API服务器地址"
          name="api_server"
          rules={[
            { required: true, message: '请输入API服务器地址' },
            {
              pattern: /^https?:\/\/.+/,
              message: '请输入有效的URL地址（http或https）',
            },
          ]}
        >
          <Input placeholder="https://k8s-api.example.com:6443" />
        </Form.Item>

        {/* 认证方式 */}
        <Form.Item
          label="认证方式"
          name="auth_type"
          rules={[{ required: true, message: '请选择认证方式' }]}
        >
          <Radio.Group onChange={(e) => handleAuthTypeChange(e.target.value)}>
            <Radio value="token">Token认证</Radio>
            <Radio value="kubeconfig">Kubeconfig认证</Radio>
          </Radio.Group>
        </Form.Item>

        {/* Token认证 */}
        {authType === 'token' && (
          <Form.Item
            label="Token"
            name="token"
            rules={[
              {
                required: !cluster,
                message: '请输入Token',
              },
            ]}
            extra={
              cluster
                ? '留空则保持原有Token不变'
                : '请输入ServiceAccount的Token'
            }
          >
            <TextArea
              rows={4}
              placeholder="请输入Token"
              autoComplete="off"
            />
          </Form.Item>
        )}

        {/* Kubeconfig认证 */}
        {authType === 'kubeconfig' && (
          <Form.Item
            label="Kubeconfig"
            name="kubeconfig"
            rules={[
              {
                required: !cluster,
                message: '请输入Kubeconfig',
              },
            ]}
            extra={
              cluster
                ? '留空则保持原有Kubeconfig不变'
                : '请输入完整的Kubeconfig文件内容（YAML格式）'
            }
          >
            <TextArea
              rows={8}
              placeholder="apiVersion: v1&#10;kind: Config&#10;clusters:&#10;..."
              autoComplete="off"
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
          </Form.Item>
        )}

        {/* 描述 */}
        <Form.Item label="描述" name="description">
          <TextArea
            rows={3}
            placeholder="请输入集群描述信息（可选）"
            maxLength={500}
            showCount
          />
        </Form.Item>

        {/* 测试结果 */}
        {renderTestResult()}

        {/* 操作按钮 */}
        <Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              disabled={testing}
            >
              {cluster ? '更新' : '创建'}
            </Button>
            <Button
              onClick={handleTestConnection}
              loading={testing}
              disabled={submitting}
              icon={testing ? <LoadingOutlined /> : <ApiOutlined />}
            >
              测试连接
            </Button>
            <Button onClick={onCancel} disabled={submitting || testing}>
              取消
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Spin>
  )
}

export default ClusterForm
