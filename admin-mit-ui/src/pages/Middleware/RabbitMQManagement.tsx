/**
 * RabbitMQ管理页面 - 占位页
 */
import React from 'react'
import { Card, Empty, Typography } from 'antd'
import { CloudServerOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const RabbitMQManagement: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Empty
          image={<CloudServerOutlined style={{ fontSize: 64, color: '#ff6600' }} />}
          description={
            <div>
              <Title level={4} style={{ marginBottom: 8 }}>RabbitMQ 管理</Title>
              <Text type="secondary">功能开发中，敬请期待...</Text>
            </div>
          }
        />
      </Card>
    </div>
  )
}

export default RabbitMQManagement
