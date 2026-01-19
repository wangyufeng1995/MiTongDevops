/**
 * WebShell 会话管理 Hook
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { WebShellTab, SessionHistoryRecord, SessionCommand, SessionStatistics } from '../types/webshell'
import { sessionStorageService } from '../services/sessionStorage'
import { Host } from '../types/host'

export interface UseSessionManagerOptions {
  maxTabs?: number
  autoSave?: boolean
  autoCleanup?: boolean
}

export interface UseSessionManagerReturn {
  // 标签页管理
  tabs: WebShellTab[]
  activeTabId: string | null
  
  // 标签页操作
  createTab: (host: Host) => string
  closeTab: (tabId: string) => void
  switchTab: (tabId: string) => void
  updateTabStatus: (tabId: string, status: WebShellTab['status']) => void
  updateTabTitle: (tabId: string, title: string) => void
  updateTabActivity: (tabId: string) => void
  
  // 命令历史
  addCommand: (tabId: string, command: string) => void
  getCommandHistory: (tabId: string) => string[]
  clearCommandHistory: (tabId: string) => void
  
  // 会话历史
  sessionHistory: SessionHistoryRecord[]
  startSession: (tabId: string) => void
  endSession: (tabId: string, status?: 'completed' | 'interrupted' | 'error') => void
  
  // 统计信息
  statistics: SessionStatistics
  refreshStatistics: () => void
  
  // 数据管理
  saveState: () => void
  loadState: () => void
  clearAllData: () => void
}

export const useSessionManager = (options: UseSessionManagerOptions = {}): UseSessionManagerReturn => {
  const {
    maxTabs = 10,
    autoSave = true,
    autoCleanup = true
  } = options

  const [tabs, setTabs] = useState<WebShellTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryRecord[]>([])
  const [statistics, setStatistics] = useState<SessionStatistics>({
    totalSessions: 0,
    activeSessions: 0,
    totalCommands: 0,
    averageSessionDuration: 0,
    mostUsedHosts: [],
    recentSessions: []
  })

  const sessionStartTimes = useRef<Map<string, number>>(new Map())
  const commandCounts = useRef<Map<string, number>>(new Map())

  // 生成唯一ID
  const generateId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // 创建新标签页
  const createTab = useCallback((host: Host): string => {
    const tabId = generateId()
    const sessionId = generateId()
    const now = new Date().toISOString()

    const newTab: WebShellTab = {
      id: tabId,
      sessionId,
      hostId: host.id,
      hostName: host.name,
      hostname: host.hostname,
      title: `${host.name} (${host.hostname})`,
      status: 'disconnected',
      isActive: false,
      createdAt: now,
      lastActiveAt: now,
      commandHistory: [],
      currentDirectory: '~'
    }

    setTabs(prevTabs => {
      // 检查标签页数量限制
      let updatedTabs = [...prevTabs]
      if (updatedTabs.length >= maxTabs) {
        // 关闭最旧的非活动标签页
        const inactiveTabs = updatedTabs.filter(tab => !tab.isActive)
        if (inactiveTabs.length > 0) {
          const oldestTab = inactiveTabs.reduce((oldest, current) => 
            new Date(current.lastActiveAt) < new Date(oldest.lastActiveAt) ? current : oldest
          )
          updatedTabs = updatedTabs.filter(tab => tab.id !== oldestTab.id)
        }
      }

      // 设置其他标签页为非活动状态
      updatedTabs = updatedTabs.map(tab => ({ ...tab, isActive: false }))
      
      // 添加新标签页
      const newTabs = [...updatedTabs, { ...newTab, isActive: true }]
      
      if (autoSave) {
        sessionStorageService.saveActiveTabs(newTabs)
      }
      
      return newTabs
    })

    setActiveTabId(tabId)
    return tabId
  }, [generateId, maxTabs, autoSave])

  // 关闭标签页
  const closeTab = useCallback((tabId: string) => {
    setTabs(prevTabs => {
      const tabToClose = prevTabs.find(tab => tab.id === tabId)
      if (!tabToClose) return prevTabs

      // 结束会话
      endSession(tabId, 'interrupted')

      const remainingTabs = prevTabs.filter(tab => tab.id !== tabId)
      
      // 如果关闭的是活动标签页，切换到下一个标签页
      if (tabToClose.isActive && remainingTabs.length > 0) {
        const nextTab = remainingTabs[remainingTabs.length - 1]
        nextTab.isActive = true
        setActiveTabId(nextTab.id)
      } else if (remainingTabs.length === 0) {
        setActiveTabId(null)
      }

      if (autoSave) {
        sessionStorageService.saveActiveTabs(remainingTabs)
      }

      return remainingTabs
    })
  }, [autoSave])

  // 切换标签页
  const switchTab = useCallback((tabId: string) => {
    setTabs(prevTabs => {
      const updatedTabs = prevTabs.map(tab => ({
        ...tab,
        isActive: tab.id === tabId,
        lastActiveAt: tab.id === tabId ? new Date().toISOString() : tab.lastActiveAt
      }))

      if (autoSave) {
        sessionStorageService.saveActiveTabs(updatedTabs)
      }

      return updatedTabs
    })
    setActiveTabId(tabId)
  }, [autoSave])

  // 更新标签页状态
  const updateTabStatus = useCallback((tabId: string, status: WebShellTab['status']) => {
    setTabs(prevTabs => {
      const updatedTabs = prevTabs.map(tab => 
        tab.id === tabId ? { ...tab, status, lastActiveAt: new Date().toISOString() } : tab
      )

      if (autoSave) {
        sessionStorageService.saveActiveTabs(updatedTabs)
      }

      return updatedTabs
    })

    // 如果连接成功，开始会话
    if (status === 'connected') {
      startSession(tabId)
    }
  }, [autoSave])

  // 更新标签页标题
  const updateTabTitle = useCallback((tabId: string, title: string) => {
    setTabs(prevTabs => {
      const updatedTabs = prevTabs.map(tab => 
        tab.id === tabId ? { ...tab, title, lastActiveAt: new Date().toISOString() } : tab
      )

      if (autoSave) {
        sessionStorageService.saveActiveTabs(updatedTabs)
      }

      return updatedTabs
    })
  }, [autoSave])

  // 更新标签页活动时间
  const updateTabActivity = useCallback((tabId: string) => {
    setTabs(prevTabs => {
      const updatedTabs = prevTabs.map(tab => 
        tab.id === tabId ? { ...tab, lastActiveAt: new Date().toISOString() } : tab
      )

      if (autoSave) {
        sessionStorageService.saveActiveTabs(updatedTabs)
      }

      return updatedTabs
    })
  }, [autoSave])

  // 添加命令到历史
  const addCommand = useCallback((tabId: string, command: string) => {
    if (!command.trim()) return

    setTabs(prevTabs => {
      const updatedTabs = prevTabs.map(tab => {
        if (tab.id === tabId) {
          const newHistory = [...tab.commandHistory, command].slice(-100) // 限制历史记录数量
          
          // 保存命令记录
          const sessionCommand: SessionCommand = {
            id: generateId(),
            sessionId: tab.sessionId,
            command,
            timestamp: new Date().toISOString()
          }
          sessionStorageService.saveCommand(sessionCommand)
          
          // 更新命令计数
          const currentCount = commandCounts.current.get(tab.sessionId) || 0
          commandCounts.current.set(tab.sessionId, currentCount + 1)

          return {
            ...tab,
            commandHistory: newHistory,
            lastActiveAt: new Date().toISOString()
          }
        }
        return tab
      })

      if (autoSave) {
        sessionStorageService.saveActiveTabs(updatedTabs)
      }

      return updatedTabs
    })
  }, [generateId, autoSave])

  // 获取命令历史
  const getCommandHistory = useCallback((tabId: string): string[] => {
    const tab = tabs.find(t => t.id === tabId)
    return tab?.commandHistory || []
  }, [tabs])

  // 清空命令历史
  const clearCommandHistory = useCallback((tabId: string) => {
    setTabs(prevTabs => {
      const updatedTabs = prevTabs.map(tab => 
        tab.id === tabId ? { ...tab, commandHistory: [] } : tab
      )

      if (autoSave) {
        sessionStorageService.saveActiveTabs(updatedTabs)
      }

      return updatedTabs
    })
  }, [autoSave])

  // 开始会话
  const startSession = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId)
    if (!tab) return

    sessionStartTimes.current.set(tab.sessionId, Date.now())
    commandCounts.current.set(tab.sessionId, 0)
  }, [tabs])

  // 结束会话
  const endSession = useCallback((tabId: string, status: 'completed' | 'interrupted' | 'error' = 'completed') => {
    const tab = tabs.find(t => t.id === tabId)
    if (!tab) return

    const startTime = sessionStartTimes.current.get(tab.sessionId)
    const commandCount = commandCounts.current.get(tab.sessionId) || 0
    
    if (startTime) {
      const endTime = Date.now()
      const duration = endTime - startTime

      const historyRecord: SessionHistoryRecord = {
        id: generateId(),
        sessionId: tab.sessionId,
        hostId: tab.hostId,
        hostName: tab.hostName,
        hostname: tab.hostname,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        duration,
        commandCount,
        status,
        lastCommand: tab.commandHistory[tab.commandHistory.length - 1]
      }

      sessionStorageService.saveSessionHistory(historyRecord)
      setSessionHistory(prev => [historyRecord, ...prev.slice(0, 99)]) // 限制内存中的历史记录

      // 清理会话数据
      sessionStartTimes.current.delete(tab.sessionId)
      commandCounts.current.delete(tab.sessionId)
    }
  }, [tabs, generateId])

  // 刷新统计信息
  const refreshStatistics = useCallback(() => {
    const stats = sessionStorageService.getSessionStatistics()
    stats.activeSessions = tabs.filter(tab => tab.status === 'connected').length
    setStatistics(stats)
  }, [tabs])

  // 保存状态
  const saveState = useCallback(() => {
    sessionStorageService.saveActiveTabs(tabs)
  }, [tabs])

  // 加载状态
  const loadState = useCallback(() => {
    const savedTabs = sessionStorageService.loadActiveTabs()
    const savedHistory = sessionStorageService.loadSessionHistory()
    
    setTabs(savedTabs)
    setSessionHistory(savedHistory.slice(0, 100)) // 限制内存中的历史记录
    
    // 设置活动标签页
    const activeTab = savedTabs.find(tab => tab.isActive)
    setActiveTabId(activeTab?.id || null)
    
    refreshStatistics()
  }, [refreshStatistics])

  // 清空所有数据
  const clearAllData = useCallback(() => {
    sessionStorageService.clearAllData()
    setTabs([])
    setActiveTabId(null)
    setSessionHistory([])
    setStatistics({
      totalSessions: 0,
      activeSessions: 0,
      totalCommands: 0,
      averageSessionDuration: 0,
      mostUsedHosts: [],
      recentSessions: []
    })
    sessionStartTimes.current.clear()
    commandCounts.current.clear()
  }, [])

  // 初始化时加载状态
  useEffect(() => {
    loadState()
  }, [loadState])

  // 定期刷新统计信息
  useEffect(() => {
    const interval = setInterval(refreshStatistics, 30000) // 每30秒刷新一次
    return () => clearInterval(interval)
  }, [refreshStatistics])

  // 定期清理过期数据
  useEffect(() => {
    if (autoCleanup) {
      const cleanup = () => {
        sessionStorageService.cleanupExpiredData()
        refreshStatistics()
      }
      
      // 立即执行一次清理
      cleanup()
      
      // 每小时清理一次
      const interval = setInterval(cleanup, 60 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [autoCleanup, refreshStatistics])

  return {
    // 标签页管理
    tabs,
    activeTabId,
    
    // 标签页操作
    createTab,
    closeTab,
    switchTab,
    updateTabStatus,
    updateTabTitle,
    updateTabActivity,
    
    // 命令历史
    addCommand,
    getCommandHistory,
    clearCommandHistory,
    
    // 会话历史
    sessionHistory,
    startSession,
    endSession,
    
    // 统计信息
    statistics,
    refreshStatistics,
    
    // 数据管理
    saveState,
    loadState,
    clearAllData
  }
}