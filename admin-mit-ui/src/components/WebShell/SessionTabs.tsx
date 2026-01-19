/**
 * WebShell 会话标签页组件
 */
import React, { useState } from 'react'
import { X, Plus, Wifi, WifiOff, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { WebShellTab } from '../../types/webshell'

export interface SessionTabsProps {
  tabs: WebShellTab[]
  activeTabId: string | null
  onTabClick: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onNewTab?: () => void
  className?: string
}

const SessionTabs: React.FC<SessionTabsProps> = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onNewTab,
  className = ''
}) => {
  const [draggedTab, setDraggedTab] = useState<string | null>(null)
  const [dragOverTab, setDragOverTab] = useState<string | null>(null)

  // 获取状态图标
  const getStatusIcon = (status: WebShellTab['status']) => {
    switch (status) {
      case 'connected':
        return <Wifi size={12} className="text-green-500" />
      case 'connecting':
        return <Loader2 size={12} className="text-blue-500 animate-spin" />
      case 'reconnecting':
        return <RefreshCw size={12} className="text-yellow-500 animate-spin" />
      case 'error':
        return <AlertCircle size={12} className="text-red-500" />
      case 'disconnected':
      default:
        return <WifiOff size={12} className="text-gray-400" />
    }
  }

  // 获取状态颜色类
  const getStatusColorClass = (status: WebShellTab['status'], isActive: boolean) => {
    if (isActive) {
      switch (status) {
        case 'connected':
          return 'border-green-500 bg-green-50'
        case 'connecting':
          return 'border-blue-500 bg-blue-50'
        case 'reconnecting':
          return 'border-yellow-500 bg-yellow-50'
        case 'error':
          return 'border-red-500 bg-red-50'
        case 'disconnected':
        default:
          return 'border-gray-300 bg-white'
      }
    } else {
      return 'border-gray-200 bg-gray-50 hover:bg-gray-100'
    }
  }

  // 处理拖拽开始
  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTab(tabId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', tabId)
  }

  // 处理拖拽结束
  const handleDragEnd = () => {
    setDraggedTab(null)
    setDragOverTab(null)
  }

  // 处理拖拽悬停
  const handleDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTab(tabId)
  }

  // 处理拖拽离开
  const handleDragLeave = () => {
    setDragOverTab(null)
  }

  // 处理放置
  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault()
    const sourceTabId = e.dataTransfer.getData('text/plain')
    
    if (sourceTabId !== targetTabId) {
      // 这里可以实现标签页重排序逻辑
      console.log('Move tab', sourceTabId, 'to position of', targetTabId)
    }
    
    setDraggedTab(null)
    setDragOverTab(null)
  }

  // 处理标签页点击
  const handleTabClick = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault()
    onTabClick(tabId)
  }

  // 处理关闭按钮点击
  const handleCloseClick = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault()
    e.stopPropagation()
    onTabClose(tabId)
  }

  // 处理新建标签页
  const handleNewTabClick = (e: React.MouseEvent) => {
    e.preventDefault()
    onNewTab?.()
  }

  return (
    <div className={`flex items-center bg-gray-100 border-b border-gray-200 ${className}`}>
      {/* 标签页列表 */}
      <div className="flex-1 flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        <div className="flex items-center space-x-1 px-2 py-1 min-w-max">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            const isDragged = draggedTab === tab.id
            const isDragOver = dragOverTab === tab.id
            
            return (
              <div
                key={tab.id}
                draggable
                onDragStart={(e) => handleDragStart(e, tab.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, tab.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, tab.id)}
                onClick={(e) => handleTabClick(e, tab.id)}
                className={`
                  group relative flex items-center space-x-2 px-3 py-2 rounded-t-lg border-t border-l border-r cursor-pointer
                  transition-all duration-200 min-w-0 max-w-xs
                  ${getStatusColorClass(tab.status, isActive)}
                  ${isDragged ? 'opacity-50' : ''}
                  ${isDragOver ? 'ring-2 ring-blue-300' : ''}
                `}
              >
                {/* 状态图标 */}
                <div className="flex-shrink-0">
                  {getStatusIcon(tab.status)}
                </div>
                
                {/* 标签页标题 */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {tab.title}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {tab.hostname}
                  </div>
                </div>
                
                {/* 关闭按钮 */}
                <button
                  onClick={(e) => handleCloseClick(e, tab.id)}
                  className="flex-shrink-0 p-1 rounded-full hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="关闭标签页"
                >
                  <X size={12} className="text-gray-500 hover:text-gray-700" />
                </button>
                
                {/* 活动指示器 */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      
      {/* 新建标签页按钮 */}
      {onNewTab && (
        <div className="flex-shrink-0 px-2">
          <button
            onClick={handleNewTabClick}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-200 transition-colors"
            title="新建标签页"
          >
            <Plus size={16} className="text-gray-600" />
          </button>
        </div>
      )}
      
      {/* 标签页计数 */}
      {tabs.length > 0 && (
        <div className="flex-shrink-0 px-3 py-2 text-xs text-gray-500 border-l border-gray-200">
          {tabs.length} 个会话
        </div>
      )}
    </div>
  )
}

export default SessionTabs