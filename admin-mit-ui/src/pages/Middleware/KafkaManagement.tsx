/**
 * Kafka管理页面 - 占位页
 */
import React from 'react'
import { Card, Empty, Typography } from 'antd'
import { ThunderboltOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const KafkaManagement: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Empty
          image={<ThunderboltOutlined style={{ fontSize: 64, color: '#52c41a' }} />}
          description={
            <div>
              <Title level={4} style={{ marginBottom: 8 }}>Kafka 管理</Title>
              <Text type="secondary">功能开发中，敬请期待...</Text>
            </div>
          }
        />
      </Card>
    </div>
  )
}

export default KafkaManagement
