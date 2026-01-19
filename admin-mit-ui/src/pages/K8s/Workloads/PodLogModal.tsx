/**
 * Pod日志弹窗组件
 * 显示Pod容器日志，支持容器选择、行数设置、搜索、下载
 * Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Modal,
  Select,
  InputNumber,
  Input,
  Button,
  Space,
  Spin,
  Alert,
  Empty,
  Tooltip,
  message,
} from 'antd'
import {
  FileTextOutlined,
  SearchOutlined,
  DownloadOutlined,
  ReloadOutlined,
  ClearOutlined,
} from '@ant-design/icons'
import { podsService } from '../../../services/k8s/pods'
import type { K8sPodContainer } from '../../../types/k8s'

export interface PodLogModalProps {
  visible: boolean
  clusterId: number
  namespace: string
  podName: string
  containers: K8sPodContainer[]
  onClose: () => void
}

/**
 * Pod日志弹窗组件
 */
export const PodLogModal: React.FC<PodLogModalProps> = ({
  visible,
  clusterId,
  namespace,
  podName,
  containers,
  onClose,
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string>('')
  const [selectedContainer, setSelectedContainer] = useState<string>('')
  const [tailLines, setTailLines] = useState<number>(100)
  const [searchText, setSearchText] = useState<string>('')
  const [downloading, setDownloading] = useState(false)

  // 初始化选中的容器
  useEffect(() => {
    if (visible && containers && containers.length > 0 && !selectedContainer) {
      setSelectedContainer(containers[0].name)
    }
  }, [visible, containers, selectedContainer])

  // 加载Pod日志
  const loadPodLogs = useCallback(async () => {
    if (!clusterId || !namespace || !podName || !selectedContainer) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await podsService.getPodLogs({
        cluster_id: clusterId,
        namespace,
        pod_name: podName,
        container: selectedContainer,
        tail_lines: tailLines,
        timestamps: true,
      })
      setLogs(result.logs || '')
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || '获取Pod日志失败'
      setError(errorMessage)
      setLogs('')
    } finally {
      setLoading(false)
    }
  }, [clusterId, namespace, podName, selectedContainer, tailLines])

  // 弹窗打开或参数变化时加载日志
  useEffect(() => {
    if (visible && selectedContainer) {
      loadPodLogs()
    }
  }, [visible, selectedContainer, tailLines, loadPodLogs])

  // 关闭弹窗时清理状态
  const handleClose = () => {
    setLogs('')
    setError(null)
    setSearchText('')
    setSelectedContainer('')
    onClose()
  }

  // 容器选择变化
  const handleContainerChange = (value: string) => {
    setSelectedContainer(value)
    setSearchText('')
  }

  // 行数变化
  const handleTailLinesChange = (value: number | null) => {
    if (value && value > 0 && value <= 10000) {
      setTailLines(value)
    }
  }

  // 搜索文本变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value)
  }

  // 清除搜索
  const handleClearSearch = () => {
    setSearchText('')
  }

  // 刷新日志
  const handleRefresh = () => {
    loadPodLogs()
  }

  // 下载日志
  const handleDownload = async () => {
    if (!clusterId || !namespace || !podName || !selectedContainer) {
      message.error('缺少必要参数')
      return
    }

    setDownloading(true)

    try {
      const blob = await podsService.downloadPodLogs({
        cluster_id: clusterId,
        namespace,
        pod_name: podName,
        container: selectedContainer,
        tail_lines: 10000, // 下载时获取更多行
        timestamps: true,
      })

      // 创建下载链接
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${podName}-${selectedContainer}-${Date.now()}.log`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      message.success('日志下载成功')
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || '下载日志失败'
      message.error(errorMessage)
    } finally {
      setDownloading(false)
    }
  }

  // 处理日志搜索和高亮
  const processedLogs = useMemo(() => {
    if (!logs) {
      return ''
    }

    if (!searchText) {
      return logs
    }

    // 按行分割日志
    const lines = logs.split('\n')
    
    // 过滤包含搜索关键词的行
    const filteredLines = lines.filter(line => 
      line.toLowerCase().includes(searchText.toLowerCase())
    )

    return filteredLines.join('\n')
  }, [logs, searchText])

  // 高亮搜索关键词
  const highlightedLogs = useMemo(() => {
    if (!searchText || !processedLogs) {
      return processedLogs
    }

    // 使用正则表达式进行大小写不敏感的替换
    const regex = new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return processedLogs.replace(regex, '<mark style="background-color: #ffeb3b; padding: 0 2px;">$1</mark>')
  }, [processedLogs, searchText])

  // 渲染日志内容
  const renderLogContent = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <Spin size="large" spinning={true}>
            <div style={{ padding: '20px' }}>加载日志中...</div>
          </Spin>
        </div>
      )
    }

    if (error) {
      return (
        <Alert
          type="error"
          showIcon
          title="获取日志失败"
          description={error}
          type="error"
          showIcon
        />
      )
    }

    if (!logs) {
      return (
        <Empty description="暂无日志" />
      )
    }

    const lineCount = processedLogs.split('\n').filter(line => line.trim()).length

    return (
      <div>
        {/* 日志统计信息 */}
        <div style={{ 
          marginBottom: '8px', 
          fontSize: '12px', 
          color: '#666',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>
            {searchText ? (
              <>匹配 <strong style={{ color: '#1890ff' }}>{lineCount}</strong> 行</>
            ) : (
              <>共 <strong style={{ color: '#1890ff' }}>{lineCount}</strong> 行</>
            )}
          </span>
          {searchText && (
            <span style={{ color: '#faad14' }}>
              已过滤，仅显示包含 "{searchText}" 的行
            </span>
          )}
        </div>

        {/* 日志内容 */}
        <div
          style={{
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            padding: '12px',
            borderRadius: '4px',
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: '12px',
            lineHeight: '1.6',
            maxHeight: '500px',
            overflowY: 'auto',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
          dangerouslySetInnerHTML={{ __html: highlightedLogs }}
        />
      </div>
    )
  }

  return (
    <Modal
      title={
        <Space>
          <FileTextOutlined />
          <span>Pod日志 - {podName}</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={1000}
      destroyOnHidden
      styles={{
        body: {
          padding: '16px 24px',
        },
      }}
    >
      {/* 控制栏 */}
      <div style={{ marginBottom: '16px' }}>
        <Space wrap size="middle" style={{ width: '100%' }}>
          {/* 容器选择（多容器时显示） */}
          {containers && containers.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '8px', fontSize: '14px' }}>容器:</span>
              <Select
                value={selectedContainer}
                onChange={handleContainerChange}
                style={{ width: 200 }}
                placeholder="选择容器"
              >
                {containers.map(container => (
                  <Select.Option key={container.name} value={container.name}>
                    {container.name}
                  </Select.Option>
                ))}
              </Select>
            </div>
          )}

          {/* 单容器时显示容器名称 */}
          {containers && containers.length === 1 && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '8px', fontSize: '14px' }}>容器:</span>
              <span style={{ fontWeight: 500 }}>{containers[0].name}</span>
            </div>
          )}

          {/* 日志行数设置 */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '8px', fontSize: '14px' }}>行数:</span>
            <InputNumber
              value={tailLines}
              onChange={handleTailLinesChange}
              min={10}
              max={10000}
              step={100}
              style={{ width: 120 }}
              placeholder="日志行数"
            />
          </div>

          {/* 搜索框 */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <Input
              placeholder="搜索日志内容"
              value={searchText}
              onChange={handleSearchChange}
              prefix={<SearchOutlined />}
              suffix={
                searchText && (
                  <Tooltip title="清除搜索">
                    <ClearOutlined
                      onClick={handleClearSearch}
                      style={{ cursor: 'pointer', color: '#999' }}
                    />
                  </Tooltip>
                )
              }
              allowClear
            />
          </div>

          {/* 操作按钮 */}
          <Space>
            <Tooltip title="刷新日志">
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={loading}
              >
                刷新
              </Button>
            </Tooltip>
            <Tooltip title="下载日志文件">
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownload}
                loading={downloading}
                disabled={!logs}
              >
                下载
              </Button>
            </Tooltip>
          </Space>
        </Space>
      </div>

      {/* 日志内容区域 */}
      {renderLogContent()}
    </Modal>
  )
}

export default PodLogModal
