/**
 * K8S集群图表组件
 * 使用ECharts展示集群统计数据和资源使用情况
 */
import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { Card } from 'antd'

/**
 * 集群状态分布图表属性
 */
interface ClusterStatusChartProps {
  online: number
  offline: number
  error: number
  title?: string
  height?: number
}

/**
 * 集群状态分布饼图
 */
export const ClusterStatusChart: React.FC<ClusterStatusChartProps> = ({
  online,
  offline,
  error,
  title = '集群状态分布',
  height = 300,
}) => {
  const option: EChartsOption = useMemo(
    () => ({
      title: {
        text: title,
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'normal',
        },
      },
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        bottom: 20,
      },
      series: [
        {
          name: '集群状态',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 20,
              fontWeight: 'bold',
            },
          },
          labelLine: {
            show: false,
          },
          data: [
            {
              value: online,
              name: '在线',
              itemStyle: { color: '#52c41a' },
            },
            {
              value: offline,
              name: '离线',
              itemStyle: { color: '#d9d9d9' },
            },
            {
              value: error,
              name: '错误',
              itemStyle: { color: '#ff4d4f' },
            },
          ],
        },
      ],
    }),
    [online, offline, error, title]
  )

  return <ReactECharts option={option} style={{ height }} />
}

/**
 * 资源使用趋势图表属性
 */
interface ResourceTrendChartProps {
  data: {
    dates: string[]
    nodes: number[]
    pods: number[]
    namespaces: number[]
  }
  title?: string
  height?: number
}

/**
 * 资源使用趋势折线图
 */
export const ResourceTrendChart: React.FC<ResourceTrendChartProps> = ({
  data,
  title = '资源使用趋势',
  height = 300,
}) => {
  const option: EChartsOption = useMemo(
    () => ({
      title: {
        text: title,
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'normal',
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
      },
      legend: {
        data: ['节点数', 'Pod数', '命名空间数'],
        bottom: 10,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.dates,
      },
      yAxis: {
        type: 'value',
      },
      series: [
        {
          name: '节点数',
          type: 'line',
          smooth: true,
          data: data.nodes,
          itemStyle: { color: '#1890ff' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
                { offset: 1, color: 'rgba(24, 144, 255, 0.05)' },
              ],
            },
          },
        },
        {
          name: 'Pod数',
          type: 'line',
          smooth: true,
          data: data.pods,
          itemStyle: { color: '#52c41a' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(82, 196, 26, 0.3)' },
                { offset: 1, color: 'rgba(82, 196, 26, 0.05)' },
              ],
            },
          },
        },
        {
          name: '命名空间数',
          type: 'line',
          smooth: true,
          data: data.namespaces,
          itemStyle: { color: '#722ed1' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(114, 46, 209, 0.3)' },
                { offset: 1, color: 'rgba(114, 46, 209, 0.05)' },
              ],
            },
          },
        },
      ],
    }),
    [data, title]
  )

  return <ReactECharts option={option} style={{ height }} />
}

/**
 * 资源分布柱状图属性
 */
interface ResourceDistributionChartProps {
  data: {
    clusters: string[]
    nodes: number[]
    pods: number[]
  }
  title?: string
  height?: number
}

/**
 * 资源分布柱状图
 */
export const ResourceDistributionChart: React.FC<ResourceDistributionChartProps> = ({
  data,
  title = '集群资源分布',
  height = 300,
}) => {
  const option: EChartsOption = useMemo(
    () => ({
      title: {
        text: title,
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'normal',
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
      },
      legend: {
        data: ['节点数', 'Pod数'],
        bottom: 10,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: data.clusters,
        axisLabel: {
          interval: 0,
          rotate: 30,
        },
      },
      yAxis: [
        {
          type: 'value',
          name: '节点数',
          position: 'left',
        },
        {
          type: 'value',
          name: 'Pod数',
          position: 'right',
        },
      ],
      series: [
        {
          name: '节点数',
          type: 'bar',
          data: data.nodes,
          itemStyle: { color: '#1890ff' },
          yAxisIndex: 0,
        },
        {
          name: 'Pod数',
          type: 'bar',
          data: data.pods,
          itemStyle: { color: '#52c41a' },
          yAxisIndex: 1,
        },
      ],
    }),
    [data, title]
  )

  return <ReactECharts option={option} style={{ height }} />
}

/**
 * 资源使用率仪表盘属性
 */
interface ResourceGaugeChartProps {
  value: number
  title: string
  max?: number
  height?: number
}

/**
 * 资源使用率仪表盘
 */
export const ResourceGaugeChart: React.FC<ResourceGaugeChartProps> = ({
  value,
  title,
  max = 100,
  height = 250,
}) => {
  const option: EChartsOption = useMemo(
    () => ({
      series: [
        {
          type: 'gauge',
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max,
          splitNumber: 8,
          axisLine: {
            lineStyle: {
              width: 6,
              color: [
                [0.3, '#52c41a'],
                [0.7, '#faad14'],
                [1, '#ff4d4f'],
              ],
            },
          },
          pointer: {
            icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
            length: '12%',
            width: 20,
            offsetCenter: [0, '-60%'],
            itemStyle: {
              color: 'auto',
            },
          },
          axisTick: {
            length: 12,
            lineStyle: {
              color: 'auto',
              width: 2,
            },
          },
          splitLine: {
            length: 20,
            lineStyle: {
              color: 'auto',
              width: 5,
            },
          },
          axisLabel: {
            color: '#464646',
            fontSize: 12,
            distance: -60,
            formatter: (value: number) => {
              if (value === max) {
                return `${max}`
              }
              return value.toString()
            },
          },
          title: {
            offsetCenter: [0, '-20%'],
            fontSize: 16,
          },
          detail: {
            fontSize: 30,
            offsetCenter: [0, '0%'],
            valueAnimation: true,
            formatter: (value: number) => `${value.toFixed(1)}%`,
            color: 'auto',
          },
          data: [
            {
              value,
              name: title,
            },
          ],
        },
      ],
    }),
    [value, title, max]
  )

  return <ReactECharts option={option} style={{ height }} />
}

/**
 * 图表卡片包装器
 */
interface ChartCardProps {
  title?: string
  extra?: React.ReactNode
  children: React.ReactNode
  loading?: boolean
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  extra,
  children,
  loading = false,
}) => {
  return (
    <Card
      title={title}
      extra={extra}
      variant="borderless"
      loading={loading}
      styles={{ body: { padding: '24px' } }}
    >
      {children}
    </Card>
  )
}
