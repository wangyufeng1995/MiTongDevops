/**
 * 响应式布局组件
 * 提供统一的响应式布局，适配不同屏幕尺寸
 */
import React from 'react'
import { Row, Col, Card, Space, Breadcrumb } from 'antd'
import { HomeOutlined } from '@ant-design/icons'
import type { ColProps } from 'antd'

/**
 * 页面容器属�?
 */
interface PageContainerProps {
  children: React.ReactNode
  title?: string
  breadcrumb?: Array<{ title: string; href?: string }>
  extra?: React.ReactNode
  background?: string
}

/**
 * 页面容器组件
 * 提供统一的页面布局和面包屑导航
 */
export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  title,
  breadcrumb,
  extra,
  background = '#f0f2f5',
}) => {
  return (
    <div style={{ padding: '8px 16px 16px 16px', background, minHeight: '100vh' }}>
      {/* 面包屑导�?*/}
      {breadcrumb && breadcrumb.length > 0 && (
        <Breadcrumb
          style={{ marginBottom: 12 }}
          items={[
            {
              title: (
                <>
                  <HomeOutlined />
                  <span>首页</span>
                </>
              ),
            },
            ...breadcrumb.map((item) => ({
              title: item.title,
              href: item.href,
            })),
          ]}
        />
      )}

      {/* 页面标题 */}
      {title && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>{title}</h1>
          {extra && <Space>{extra}</Space>}
        </div>
      )}

      {/* 页面内容 */}
      {children}
    </div>
  )
}

/**
 * 响应式网格属�?
 */
interface ResponsiveGridProps {
  children: React.ReactNode
  gutter?: number | [number, number]
  cols?: {
    xs?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
    xxl?: number
  }
}

/**
 * 响应式网格组�?
 * 自动适配不同屏幕尺寸的列�?
 */
export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  gutter = [16, 16],
  cols = { xs: 1, sm: 2, md: 3, lg: 4, xl: 4, xxl: 6 },
}) => {
  const colSpan: ColProps = {
    xs: cols.xs ? 24 / cols.xs : 24,
    sm: cols.sm ? 24 / cols.sm : 12,
    md: cols.md ? 24 / cols.md : 8,
    lg: cols.lg ? 24 / cols.lg : 6,
    xl: cols.xl ? 24 / cols.xl : 6,
    xxl: cols.xxl ? 24 / cols.xxl : 4,
  }

  return (
    <Row gutter={gutter}>
      {React.Children.map(children, (child) => (
        <Col {...colSpan}>{child}</Col>
      ))}
    </Row>
  )
}

/**
 * 统计卡片网格属�?
 */
interface StatisticsGridProps {
  children: React.ReactNode
  gutter?: number | [number, number]
}

/**
 * 统计卡片网格
 * 专门用于展示统计卡片的响应式网格
 */
export const StatisticsGrid: React.FC<StatisticsGridProps> = ({
  children,
  gutter = [16, 16],
}) => {
  return (
    <Row gutter={gutter}>
      {React.Children.map(children, (child) => (
        <Col xs={24} sm={12} lg={6}>
          {child}
        </Col>
      ))}
    </Row>
  )
}

/**
 * 图表网格属�?
 */
interface ChartGridProps {
  children: React.ReactNode
  gutter?: number | [number, number]
  layout?: '1-1' | '2-1' | '1-2' | '1-1-1'
}

/**
 * 图表网格
 * 提供常见的图表布局模式
 */
export const ChartGrid: React.FC<ChartGridProps> = ({
  children,
  gutter = [16, 16],
  layout = '1-1',
}) => {
  const childArray = React.Children.toArray(children)

  const layouts = {
    '1-1': [
      { xs: 24, lg: 12 },
      { xs: 24, lg: 12 },
    ],
    '2-1': [
      { xs: 24, lg: 16 },
      { xs: 24, lg: 8 },
    ],
    '1-2': [
      { xs: 24, lg: 8 },
      { xs: 24, lg: 16 },
    ],
    '1-1-1': [
      { xs: 24, lg: 8 },
      { xs: 24, lg: 8 },
      { xs: 24, lg: 8 },
    ],
  }

  const colSpans = layouts[layout] || layouts['1-1']

  return (
    <Row gutter={gutter}>
      {childArray.map((child, index) => (
        <Col key={index} {...colSpans[index]}>
          {child}
        </Col>
      ))}
    </Row>
  )
}

/**
 * 内容卡片属�?
 */
interface ContentCardProps {
  title?: React.ReactNode
  extra?: React.ReactNode
  children: React.ReactNode
  loading?: boolean
  bordered?: boolean
  hoverable?: boolean
  style?: React.CSSProperties
}

/**
 * 内容卡片
 * 统一样式的卡片组�?
 */
export const ContentCard: React.FC<ContentCardProps> = ({
  title,
  extra,
  children,
  loading = false,
  bordered = false,
  hoverable = false,
  style,
}) => {
  return (
    <Card
      title={title}
      extra={extra}
      loading={loading}
      bordered={bordered}
      hoverable={hoverable}
      style={{
        boxShadow:
          '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
        ...style,
      }}
    >
      {children}
    </Card>
  )
}

export default PageContainer
