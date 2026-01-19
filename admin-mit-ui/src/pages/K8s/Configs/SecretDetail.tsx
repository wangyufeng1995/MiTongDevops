/**
 * Secret详情组件
 * 显示Secret的配置数据（敏感数据脱敏）
 * Requirements: 6.3
 */
import React, { useState, useEffect } from 'react'
import {
  Descriptions,
  Spin,
  Alert,
  Card,
  Typography,
  Space,
  Tag,
  Button,
  Tooltip,
} from 'antd'
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons'
import { configsService } from '../../../services/k8s/configs'
import type { K8sSecret } from '../../../types/k8s'
import { formatDateTime } from '../../../utils'

const { Paragraph, Text } = Typography

interface SecretDetailProps {
  clusterId: number
  namespace: string
  name: string
}

export const SecretDetail: React.FC<SecretDetailProps> = ({
  clusterId,
  namespace,
  name,
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [secret, setSecret] = useState<K8sSecret>()
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadSecretDetail()
  }, [clusterId, namespace, name])

  const loadSecretDetail = async () => {
    try {
      setLoading(true)
      setError(undefined)

      const data = await configsService.getSecretDetail(
        clusterId,
        namespace,
        name
      )

      setSecret(data)
    } catch (err: any) {
      setError(err.response?.data?.message || '加载Secret详情失败')
    } finally {
      setLoading(false)
    }
  }

  const toggleKeyVisibility = (key: string) => {
    setVisibleKeys((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  const maskValue = (value: string): string => {
    // 脱敏显示：只显示前4个字符和后4个字符
    if (value.length <= 8) {
      return '********'
    }
    return `${value.substring(0, 4)}${'*'.repeat(Math.min(value.length - 8, 20))}${value.substring(value.length - 4)}`
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error) {
    return <Alert title="加载失败" description={error} type="error" showIcon />
  }

  if (!secret) {
    return null
  }

  return (
    <div>
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="名称" span={2}>
          {secret.name}
        </Descriptions.Item>
        <Descriptions.Item label="命名空间" span={2}>
          {secret.namespace}
        </Descriptions.Item>
        <Descriptions.Item label="类型" span={2}>
          <Tag color="green">{secret.type}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="创建时间" span={2}>
          {formatDateTime(secret.created_at)}
        </Descriptions.Item>
        {secret.labels && Object.keys(secret.labels).length > 0 && (
          <Descriptions.Item label="标签" span={2}>
            <Space wrap>
              {Object.entries(secret.labels).map(([key, value]) => (
                <Tag key={key}>
                  {key}: {value}
                </Tag>
              ))}
            </Space>
          </Descriptions.Item>
        )}
      </Descriptions>

      <Card
        title={
          <Space>
            <span>配置数据</span>
            <Tag color="warning">敏感数据已脱敏</Tag>
          </Space>
        }
        size="small"
        style={{ marginTop: 16 }}
        styles={{ body: { padding: 0 } }}
      >
        {secret.data && Object.keys(secret.data).length > 0 ? (
          <div>
            {Object.entries(secret.data).map(([key, value]) => {
              const isVisible = visibleKeys.has(key)
              return (
                <div
                  key={key}
                  style={{
                    borderBottom: '1px solid #f0f0f0',
                    padding: '12px 16px',
                  }}
                >
                  <div
                    style={{
                      marginBottom: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text strong>{key}</Text>
                    <Tooltip title={isVisible ? '隐藏' : '显示'}>
                      <Button
                        type="text"
                        size="small"
                        icon={
                          isVisible ? (
                            <EyeInvisibleOutlined />
                          ) : (
                            <EyeOutlined />
                          )
                        }
                        onClick={() => toggleKeyVisibility(key)}
                      />
                    </Tooltip>
                  </div>
                  <Paragraph
                    copyable={isVisible}
                    style={{
                      marginBottom: 0,
                      backgroundColor: '#f5f5f5',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      color: isVisible ? 'inherit' : '#999',
                    }}
                  >
                    {isVisible ? value : maskValue(value)}
                  </Paragraph>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>
            暂无配置数据
          </div>
        )}
      </Card>

      <Alert
        title="安全提示"
        description="Secret数据已脱敏显示，点击眼睛图标可以查看完整内容。请注意保护敏感信息。"
        type="warning"
        showIcon
        style={{ marginTop: 16 }}
      />
    </div>
  )
}
