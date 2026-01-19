/**
 * Pod Shell终端弹窗组件
 * 提供与Pod容器的交互式Shell连接
 * Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 4.7, 4.8, 5.3
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Modal,
  Select,
  Button,
  Space,
  Alert,
  Spin,
  Tag,
  Tooltip,
  message,
} from 'antd'
import {
  CodeOutlined,
  DisconnectOutlined,
  ReloadOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import { TerminalContainer } from '../../../components/Terminal'
import { TerminalRef } from '../../../components/Terminal/Terminal'
import { PodShellService } from '../../../services/k8s/podShell'
import { useAuthStore } from '../../../store/auth'
import type { K8sPodContainer, PodShellStatus } from '../../../types/k8s'

export interface PodShellModalProps {
  visible: boolean
  clusterId: number
  namespace: string
  podName: string
  containers: K8sPodContainer[]
  onClose: () => void
}

/**
 * Pod Shell终端弹窗组件
 */
export const PodShellModal: React.FC<PodShellModalProps> = ({
  visible,
  clusterId,
  namespace,
  podName,
  containers,
  onClose,
}) => {
  const [selectedContainer, setSelectedContainer] = useState<string>('')
  const [connectionStatus, setConnectionStatus] = useState<PodShellStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isTerminalReady, setIsTerminalReady] = useState(false)
  
  const terminalRef = useRef<TerminalRef>(null)
  const podShellServiceRef = useRef<PodShellService | null>(null)
  const cleanupListenersRef = useRef<(() => void)[]>([])
  const isTerminalReadyRef = useRef(false)
  
  const { isAdmin } = useAuthStore()
  const canUseShell = isAdmin()

  // 初始化选中的容器
  useEffect(() => {
    if (visible && containers && containers.length > 0 && !selectedContainer) {
      // 优先选择running状态的容器
      const runningContainer = containers.find(c => c.state === 'running')
      setSelectedContainer(runningContainer?.name || containers[0].name)
    }
  }, [visible, containers, selectedContainer])

  // 清理函数
  const cleanup = useCallback(() => {
    // 清理事件监听器
    cleanupListenersRef.current.forEach(cleanup => cleanup())
    cleanupListenersRef.current = []
    
    // 断开连接
    if (podShellServiceRef.current) {
      podShellServiceRef.current.disconnect()
      podShellServiceRef.current = null
    }
    
    setConnectionStatus('disconnected')
    setIsConnecting(false)
    setError(null)
  }, [])

  // 连接到Pod Shell
  const connectToShell = useCallback(async () => {
    if (!clusterId || !namespace || !podName || !selectedContainer) {
      message.error('缺少必要参数')
      return
    }

    if (!canUseShell) {
      message.error('您没有权限使用Pod Shell功能')
      return
    }

    // 清理之前的连接
    cleanup()

    setIsConnecting(true)
    setError(null)

    try {
      // 创建新的服务实例
      const service = new PodShellService()
      podShellServiceRef.current = service

      // 设置事件监听器
      const unsubscribeData = service.onTerminalData((data: string) => {
        if (terminalRef.current && isTerminalReadyRef.current) {
          terminalRef.current.write(data)
        }
      })
      cleanupListenersRef.current.push(unsubscribeData)

      const unsubscribeStatus = service.onStatusChange((status: PodShellStatus) => {
        setConnectionStatus(status)
        
        if (status === 'connected' && terminalRef.current) {
          terminalRef.current.writeln('\r\n\x1b[32m✓ Pod Shell 连接成功!\x1b[0m\r\n')
          terminalRef.current.focus()
        } else if (status === 'disconnected' && terminalRef.current) {
          terminalRef.current.writeln('\r\n\x1b[33m✗ Pod Shell 连接已断开\x1b[0m')
        } else if (status === 'error' && terminalRef.current) {
          terminalRef.current.writeln('\r\n\x1b[31m✗ Pod Shell 连接错误\x1b[0m')
        }
      })
      cleanupListenersRef.current.push(unsubscribeStatus)

      const unsubscribeError = service.onError((err: Error) => {
        setError(err.message)
        if (terminalRef.current) {
          terminalRef.current.writeln(`\r\n\x1b[31m错误: ${err.message}\x1b[0m`)
        }
      })
      cleanupListenersRef.current.push(unsubscribeError)

      const unsubscribeReconnecting = service.onReconnecting((info: { attempt: number; delay: number }) => {
        if (terminalRef.current) {
          terminalRef.current.writeln(`\r\n\x1b[33m⟳ 正在重连... (第${info.attempt}次尝试)\x1b[0m`)
        }
      })
      cleanupListenersRef.current.push(unsubscribeReconnecting)

      const unsubscribeTerminated = service.onTerminated((data: { message?: string }) => {
        if (terminalRef.current) {
          terminalRef.current.writeln(`\r\n\x1b[33m终端已终止${data.message ? ': ' + data.message : ''}\x1b[0m`)
        }
      })
      cleanupListenersRef.current.push(unsubscribeTerminated)

      // 获取终端尺寸
      const cols = terminalRef.current?.terminal?.cols || 80
      const rows = terminalRef.current?.terminal?.rows || 24

      // 连接
      await service.connect({
        cluster_id: clusterId,
        namespace,
        pod_name: podName,
        container: selectedContainer,
        cols,
        rows,
      })

      setIsConnecting(false)
    } catch (err: any) {
      const errorMessage = err.message || '连接Pod Shell失败'
      setError(errorMessage)
      setIsConnecting(false)
      
      if (terminalRef.current) {
        terminalRef.current.writeln(`\r\n\x1b[31m连接失败: ${errorMessage}\x1b[0m`)
      }
    }
  }, [clusterId, namespace, podName, selectedContainer, canUseShell, cleanup, isTerminalReady])

  // 断开连接
  const disconnectFromShell = useCallback(() => {
    cleanup()
    if (terminalRef.current) {
      terminalRef.current.writeln('\r\n\x1b[33m已断开连接\x1b[0m')
    }
  }, [cleanup])

  // 重新连接
  const reconnect = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.clear()
    }
    connectToShell()
  }, [connectToShell])

  // 处理终端就绪
  const handleTerminalReady = useCallback((terminal: any) => {
    setIsTerminalReady(true)
    isTerminalReadyRef.current = true
    
    // 显示欢迎信息
    terminal.writeln('\x1b[1;36m╔══════════════════════════════════════╗\x1b[0m')
    terminal.writeln('\x1b[1;36m║\x1b[0m      \x1b[1;33mPod Shell 终端\x1b[0m                  \x1b[1;36m║\x1b[0m')
    terminal.writeln('\x1b[1;36m╚══════════════════════════════════════╝\x1b[0m')
    terminal.writeln('')
    terminal.writeln(`\x1b[90mPod: ${podName}\x1b[0m`)
    terminal.writeln(`\x1b[90m命名空间: ${namespace}\x1b[0m`)
    terminal.writeln(`\x1b[90m容器: ${selectedContainer}\x1b[0m`)
    terminal.writeln('')
    terminal.writeln('\x1b[33m点击"连接"按钮开始连接到Pod容器\x1b[0m')
    terminal.writeln('')
  }, [podName, namespace, selectedContainer])

  // 处理终端数据输入
  const handleTerminalData = useCallback((data: string) => {
    if (connectionStatus !== 'connected') {
      if (data === '\r' && terminalRef.current) {
        terminalRef.current.writeln('')
        terminalRef.current.writeln('\x1b[31m请先连接到Pod Shell\x1b[0m')
      }
      return
    }

    // 发送数据到Pod Shell
    if (podShellServiceRef.current) {
      podShellServiceRef.current.sendInput(data)
    }
  }, [connectionStatus])

  // 处理终端大小调整
  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    if (connectionStatus === 'connected' && podShellServiceRef.current) {
      podShellServiceRef.current.resize(cols, rows)
    }
  }, [connectionStatus])

  // 关闭弹窗时清理
  const handleClose = useCallback(() => {
    cleanup()
    setSelectedContainer('')
    setIsTerminalReady(false)
    isTerminalReadyRef.current = false
    onClose()
  }, [cleanup, onClose])

  // 容器选择变化
  const handleContainerChange = useCallback((value: string) => {
    // 如果已连接，先断开
    if (connectionStatus === 'connected') {
      cleanup()
    }
    setSelectedContainer(value)
    setError(null)
    
    // 清空终端并显示新容器信息
    if (terminalRef.current) {
      terminalRef.current.clear()
      terminalRef.current.writeln('\x1b[1;36m╔══════════════════════════════════════╗\x1b[0m')
      terminalRef.current.writeln('\x1b[1;36m║\x1b[0m      \x1b[1;33mPod Shell 终端\x1b[0m                  \x1b[1;36m║\x1b[0m')
      terminalRef.current.writeln('\x1b[1;36m╚══════════════════════════════════════╝\x1b[0m')
      terminalRef.current.writeln('')
      terminalRef.current.writeln(`\x1b[90mPod: ${podName}\x1b[0m`)
      terminalRef.current.writeln(`\x1b[90m命名空间: ${namespace}\x1b[0m`)
      terminalRef.current.writeln(`\x1b[90m容器: ${value}\x1b[0m`)
      terminalRef.current.writeln('')
      terminalRef.current.writeln('\x1b[33m点击"连接"按钮开始连接到Pod容器\x1b[0m')
      terminalRef.current.writeln('')
    }
  }, [connectionStatus, cleanup, podName, namespace])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  // 渲染连接状态标签
  const renderStatusTag = useMemo(() => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <Tag icon={<CheckCircleOutlined />} color="success">
            已连接
          </Tag>
        )
      case 'connecting':
        return (
          <Tag icon={<LoadingOutlined />} color="processing">
            连接中
          </Tag>
        )
      case 'error':
        return (
          <Tag icon={<CloseCircleOutlined />} color="error">
            连接错误
          </Tag>
        )
      case 'disconnected':
      default:
        return (
          <Tag icon={<DisconnectOutlined />} color="default">
            未连接
          </Tag>
        )
    }
  }, [connectionStatus])

  // 终端配置
  const terminalOptions = useMemo(() => ({
    fontSize: 14,
    rows: 30,
    cols: 100,
    cursorBlink: true,
    allowProposedApi: true,
  }), [])

  // 权限检查
  if (!canUseShell) {
    return (
      <Modal
        title={
          <Space>
            <CodeOutlined />
            <span>Pod终端 - {podName}</span>
          </Space>
        }
        open={visible}
        onCancel={onClose}
        footer={null}
        width={1000}
        destroyOnHidden
      >
        <Alert
          type="warning"
          showIcon
          title="权限不足"
          description="您没有权限使用Pod Shell功能。只有运维管理员或超级管理员可以使用此功能。"
          type="error"
          showIcon
          icon={<WarningOutlined />}
        />
      </Modal>
    )
  }

  return (
    <Modal
      title={
        <Space>
          <CodeOutlined />
          <span>Pod终端 - {podName}</span>
          {renderStatusTag}
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
                disabled={isConnecting}
              >
                {containers.map(container => (
                  <Select.Option 
                    key={container.name} 
                    value={container.name}
                    disabled={container.state !== 'running'}
                  >
                    <Space>
                      <span>{container.name}</span>
                      {container.state !== 'running' && (
                        <Tag color="warning" style={{ fontSize: '10px' }}>
                          {container.state}
                        </Tag>
                      )}
                    </Space>
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

          {/* 操作按钮 */}
          <Space style={{ marginLeft: 'auto' }}>
            {connectionStatus === 'disconnected' || connectionStatus === 'error' ? (
              <Tooltip title="连接到Pod容器">
                <Button
                  type="primary"
                  icon={<CodeOutlined />}
                  onClick={connectToShell}
                  loading={isConnecting}
                  disabled={!selectedContainer}
                >
                  连接
                </Button>
              </Tooltip>
            ) : connectionStatus === 'connected' ? (
              <>
                <Tooltip title="断开连接">
                  <Button
                    icon={<DisconnectOutlined />}
                    onClick={disconnectFromShell}
                    danger
                  >
                    断开
                  </Button>
                </Tooltip>
                <Tooltip title="重新连接">
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={reconnect}
                  >
                    重连
                  </Button>
                </Tooltip>
              </>
            ) : (
              <Button loading disabled>
                连接中...
              </Button>
            )}
          </Space>
        </Space>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert
          type="error"
          showIcon
          title="连接错误"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: '16px' }}
        />
      )}

      {/* 终端区域 */}
      <div
        style={{
          height: '500px',
          backgroundColor: '#1e1e1e',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <TerminalContainer
          ref={terminalRef}
          className="w-full h-full"
          theme="default"
          showThemeSelector={false}
          showCopyPaste={true}
          showToolbar={true}
          onReady={handleTerminalReady}
          onData={handleTerminalData}
          onResize={handleTerminalResize}
          options={terminalOptions}
        />
      </div>

      {/* 提示信息 */}
      <div style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
        <Space separator={<span style={{ color: '#d9d9d9' }}>|</span>}>
          <span>快捷键: Ctrl+C 复制, Ctrl+V 粘贴, Ctrl+A 全选</span>
          <span>支持终端大小自适应</span>
        </Space>
      </div>
    </Modal>
  )
}

export default PodShellModal
