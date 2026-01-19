/**
 * WebShell 会话管理主组件
 */
import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Plus, History, Settings, Monitor } from 'lucide-react'
import WebShellTerminal, { WebShellTerminalRef } from './WebShellTerminal'
import SessionTabs from './SessionTabs'
import SessionHistory from './SessionHistory'
import { useSessionManager } from '../../hooks/useSessionManager'
import { Host } from '../../types/host'

export interface SessionManagerProps {
  hosts: Host[]
  onHostSelect?: () => void
  className?: string
}

type ViewMode = 'terminal' | 'history' | 'settings'

const SessionManager: React.FC<SessionManagerProps> = ({
  hosts,
  onHostSelect,
  className = ''
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('terminal')
  const [showHostSelector, setShowHostSelector] = useState(false)
  const terminalRefs = useRef<Map<string, WebShellTerminalRef>>(new Map())

  const {
    tabs,
    activeTabId,
    createTab,
    closeTab,
    switchTab,
    updateTabStatus,
    updateTabActivity,
    addCommand,
    sessionHistory,
    statistics,
    refreshStatistics,
    clearAllData
  } = useSessionManager({
    maxTabs: 10,
    autoSave: true,
    autoCleanup: true
  })

  // 获取当前活动标签页
  const activeTab = tabs.find(tab => tab.id === activeTabId)

  // 处理新建标签页
  const handleNewTab = useCallback(() => {
    if (hosts.length === 0) {
      onHostSelect?.()
      return
    }

    if (hosts.length === 1) {
      createTab(hosts[0])
    } else {
      setShowHostSelector(true)
    }
  }, [hosts, createTab, onHostSelect])

  // 处理主机选择
  const handleHostSelect = useCallback((host: Host) => {
    createTab(host)
    setShowHostSelector(false)
  }, [createTab])

  // 处理标签页切换
  const handleTabSwitch = useCallback((tabId: string) => {
    switchTab(tabId)
    // 聚焦到对应的终端
    const terminalRef = terminalRefs.current.get(tabId)
    if (terminalRef) {
      setTimeout(() => {
        terminalRef.focusTerminal()
      }, 100)
    }
  }, [switchTab])

  // 处理标签页关闭
  const handleTabClose = useCallback((tabId: string) => {
    const terminalRef = terminalRefs.current.get(tabId)
    if (terminalRef) {
      terminalRef.disconnectFromHost()
      terminalRefs.current.delete(tabId)
    }
    closeTab(tabId)
  }, [closeTab])

  // 处理终端连接状态变化
  const handleConnectionStateChange = useCallback((tabId: string, state: any) => {
    const statusMap: Record<string, any> = {
      'connected': 'connected',
      'connecting': 'connecting',
      'reconnecting': 'reconnecting',
      'error': 'error',
      'disconnected': 'disconnected'
    }
    updateTabStatus(tabId, statusMap[state] || 'disconnected')
  }, [updateTabStatus])

  // 处理终端数据输入（用于记录命令历史）
  const handleTerminalData = useCallback((tabId: string, data: string) => {
    updateTabActivity(tabId)
    
    // 检测回车键，记录命令
    if (data === '\r') {
      // 这里需要从终端获取当前输入的命令
      // 由于 xterm.js 的限制，我们需要在 WebShellTerminal 组件中处理
    }
  }, [updateTabActivity])

  // 处理会话删除
  const handleDeleteSession = useCallback((sessionId: string) => {
    // 实现会话删除逻辑
    console.log('Delete session:', sessionId)
  }, [])

  // 处理清空历史
  const handleClearHistory = useCallback(() => {
    if (window.confirm('确定要清空所有会话历史记录吗？此操作不可撤销。')) {
      clearAllData()
    }
  }, [clearAllData])

  // 注册终端引用
  const registerTerminalRef = useCallback((tabId: string, ref: WebShellTerminalRef | null) => {
    if (ref) {
      terminalRefs.current.set(tabId, ref)
    } else {
      terminalRefs.current.delete(tabId)
    }
  }, [])

  // 定期刷新统计信息
  useEffect(() => {
    const interval = setInterval(refreshStatistics, 30000)
    return () => clearInterval(interval)
  }, [refreshStatistics])

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900">WebShell 会话管理</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('terminal')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'terminal'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Monitor size={16} className="inline mr-1" />
              终端
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'history'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <History size={16} className="inline mr-1" />
              历史记录
            </button>
            <button
              onClick={() => setViewMode('settings')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'settings'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Settings size={16} className="inline mr-1" />
              设置
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            活动会话: {statistics.activeSessions} / 总会话: {statistics.totalSessions}
          </span>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {viewMode === 'terminal' && (
          <>
            {/* 标签页 */}
            <SessionTabs
              tabs={tabs}
              activeTabId={activeTabId}
              onTabClick={handleTabSwitch}
              onTabClose={handleTabClose}
              onNewTab={handleNewTab}
            />

            {/* 终端区域 */}
            <div className="flex-1 relative">
              {tabs.length === 0 ? (
                <div className="flex items-center justify-center h-full bg-gray-50">
                  <div className="text-center">
                    <Monitor size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">暂无活动会话</h3>
                    <p className="text-gray-500 mb-4">点击下方按钮创建新的 WebShell 会话</p>
                    <button
                      onClick={handleNewTab}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Plus size={16} className="mr-2" />
                      新建会话
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full">
                  {tabs.map((tab) => (
                    <div
                      key={tab.id}
                      className={`h-full ${tab.id === activeTabId ? 'block' : 'hidden'}`}
                    >
                      <WebShellTerminal
                        ref={(ref) => registerTerminalRef(tab.id, ref)}
                        hostId={tab.hostId}
                        className="h-full"
                        autoConnect={false}
                        onConnectionStateChange={(state) => handleConnectionStateChange(tab.id, state)}
                        onError={(error) => console.error('Terminal error:', error)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {viewMode === 'history' && (
          <div className="flex-1 overflow-auto p-6">
            <SessionHistory
              history={sessionHistory}
              statistics={statistics}
              onDeleteSession={handleDeleteSession}
              onClearHistory={handleClearHistory}
            />
          </div>
        )}

        {viewMode === 'settings' && (
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-2xl">
              <h3 className="text-lg font-medium text-gray-900 mb-4">会话管理设置</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    最大标签页数量
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    defaultValue="10"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    超过此数量时，会自动关闭最旧的非活动标签页
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    自动保存会话状态
                  </label>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      自动保存标签页状态和命令历史
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    自动清理过期数据
                  </label>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      自动清理 30 天前的会话历史记录
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={handleClearHistory}
                    className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    清空所有数据
                  </button>
                  <p className="mt-2 text-sm text-gray-500">
                    这将删除所有会话历史记录和命令历史，此操作不可撤销
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 主机选择弹窗 */}
      {showHostSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">选择主机</h3>
            </div>
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              {hosts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">暂无可用主机</p>
                  <button
                    onClick={() => {
                      setShowHostSelector(false)
                      onHostSelect?.()
                    }}
                    className="mt-4 text-blue-600 hover:text-blue-800"
                  >
                    添加主机
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {hosts.map((host) => (
                    <button
                      key={host.id}
                      onClick={() => handleHostSelect(host)}
                      className="w-full text-left px-4 py-3 rounded-md hover:bg-gray-50 border border-gray-200"
                    >
                      <div className="font-medium text-gray-900">{host.name}</div>
                      <div className="text-sm text-gray-500">{host.hostname}:{host.port}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowHostSelector(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SessionManager