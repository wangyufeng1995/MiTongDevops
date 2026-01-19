/**
 * Nginx管理页面 - 占位页
 */
import React from 'react'
import { Card, Empty, Typography } from 'antd'
import { SettingOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const NginxManagement: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Empty
          image={<SettingOutlined style={{ fontSize: 64, color: '#1890ff' }} />}
          description={
            <div>
              <Title level={4} style={{ marginBottom: 8 }}>Nginx 管理</Title>
              <Text type="secondary">功能开发中，敬请期待...</Text>
            </div>
          }
        />
      </Card>
    </div>
  )
}

export default NginxManagement
