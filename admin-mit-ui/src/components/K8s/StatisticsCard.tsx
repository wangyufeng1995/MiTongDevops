/**
 * 统计卡片组件
 * 用于展示K8S资源统计信息，支持图标、趋势和自定义样�?
 */
import React from 'react'
import { Card, Statistic, Tooltip } from 'antd'
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import type { StatisticProps } from 'antd'

interface StatisticsCardProps {
  title: string
  value: number | string
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  precision?: number
  valueStyle?: React.CSSProperties
  trend?: {
    value: number
    isPositive: boolean
  }
  tooltip?: string
  loading?: boolean
  icon?: React.ReactNode
  color?: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'cyan'
  onClick?: () => void
}

/**
 * 颜色配置
 */
const colorConfig = {
  blue: {
    bg: '#e6f7ff',
    border: '#91d5ff',
    icon: '#1890ff',
    value: '#1890ff',
  },
  green: {
    bg: '#f6ffed',
    border: '#b7eb8f',
    icon: '#52c41a',
    value: '#3f8600',
  },
  red: {
    bg: '#fff1f0',
    border: '#ffccc7',
    icon: '#ff4d4f',
    value: '#cf1322',
  },
  orange: {
    bg: '#fff7e6',
    border: '#ffd591',
    icon: '#fa8c16',
    value: '#d46b08',
  },
  purple: {
    bg: '#f9f0ff',
    border: '#d3adf7',
    icon: '#722ed1',
    value: '#531dab',
  },
  cyan: {
    bg: '#e6fffb',
    border: '#87e8de',
    icon: '#13c2c2',
    value: '#08979c',
  },
}

/**
 * StatisticsCard组件
 * 
 * 增强的统计卡片，支持图标、趋势显示和自定义颜�?
 * 
 * @example
 * <StatisticsCard
 *   title="总集群数"
 *   value={10}
 *   icon={<ApiOutlined />}
 *   color="blue"
 *   trend={{ value: 2, isPositive: true }}
 *   tooltip="当前系统中的集群总数"
 * />
 */
export const StatisticsCard: React.FC<StatisticsCardProps> = ({
  title,
  value,
  prefix,
  suffix,
  precision,
  valueStyle,
  trend,
  tooltip,
  loading = false,
  icon,
  color = 'blue',
  onClick,
}) => {
  const colors = colorConfig[color]

  return (
    <Card
      variant="borderless"
      loading={loading}
      hoverable={!!onClick}
      onClick={onClick}
      style={{
        borderLeft: `4px solid ${colors.border}`,
        cursor: onClick ? 'pointer' : 'default',
      }}
      styles={{ body: { padding: '20px 24px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: '#8c8c8c', fontSize: 14 }}>
              {title}
            </span>
            {tooltip && (
              <Tooltip title={tooltip}>
                <InfoCircleOutlined
                  style={{ marginLeft: 4, color: '#8c8c8c', fontSize: 12 }}
                />
              </Tooltip>
            )}
          </div>
          <Statistic
            value={value}
            precision={precision}
            prefix={prefix}
            suffix={suffix}
            styles={{
              content: {
                color: colors.value,
                fontSize: 28,
                fontWeight: 600,
                ...valueStyle,
              }
            }}
          />
          {trend && (
            <div style={{ marginTop: 8, fontSize: 12 }}>
              <span style={{ color: trend.isPositive ? '#3f8600' : '#cf1322' }}>
                {trend.isPositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                {' '}
                {Math.abs(trend.value)}%
              </span>
              <span style={{ color: '#8c8c8c', marginLeft: 4 }}>
                较上�?
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 8,
              backgroundColor: colors.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              color: colors.icon,
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}

export default StatisticsCard
