/**
 * WebShell 会话存储服务
 * 用于管理会话历史记录和状态持久化
 */
import { WebShellTab, SessionHistoryRecord, SessionCommand, SessionStatistics } from '../types/webshell'

const STORAGE_KEYS = {
  SESSIONS: 'webshell_sessions',
  HISTORY: 'webshell_history',
  COMMANDS: 'webshell_commands',
  ACTIVE_TABS: 'webshell_active_tabs'
}

export class SessionStorageService {
  /**
   * 保存活动标签页
   */
  saveActiveTabs(tabs: WebShellTab[]): void {
    try {
      const serializedTabs = tabs.map(tab => ({
        ...tab,
        // 不保存敏感信息，只保存基本状态
        commandHistory: tab.commandHistory.slice(-50) // 只保存最近50条命令
      }))
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TABS, JSON.stringify(serializedTabs))
    } catch (error) {
      console.error('Failed to save active tabs:', error)
    }
  }

  /**
   * 加载活动标签页
   */
  loadActiveTabs(): WebShellTab[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_TABS)
      if (!stored) return []
      
      const tabs: WebShellTab[] = JSON.parse(stored)
      // 重置所有标签页状态为断开连接
      return tabs.map(tab => ({
        ...tab,
        status: 'disconnected' as const,
        isActive: false
      }))
    } catch (error) {
      console.error('Failed to load active tabs:', error)
      return []
    }
  }

  /**
   * 保存会话历史记录
   */
  saveSessionHistory(record: SessionHistoryRecord): void {
    try {
      const history = this.loadSessionHistory()
      const existingIndex = history.findIndex(h => h.sessionId === record.sessionId)
      
      if (existingIndex >= 0) {
        history[existingIndex] = record
      } else {
        history.unshift(record)
      }
      
      // 限制历史记录数量
      const limitedHistory = history.slice(0, 1000)
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(limitedHistory))
    } catch (error) {
      console.error('Failed to save session history:', error)
    }
  }

  /**
   * 加载会话历史记录
   */
  loadSessionHistory(): SessionHistoryRecord[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HISTORY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Failed to load session history:', error)
      return []
    }
  }

  /**
   * 保存命令记录
   */
  saveCommand(command: SessionCommand): void {
    try {
      const commands = this.loadCommands(command.sessionId)
      commands.push(command)
      
      // 按会话ID分组存储命令
      const allCommands = this.loadAllCommands()
      allCommands[command.sessionId] = commands.slice(-500) // 每个会话最多保存500条命令
      
      localStorage.setItem(STORAGE_KEYS.COMMANDS, JSON.stringify(allCommands))
    } catch (error) {
      console.error('Failed to save command:', error)
    }
  }

  /**
   * 加载指定会话的命令记录
   */
  loadCommands(sessionId: string): SessionCommand[] {
    try {
      const allCommands = this.loadAllCommands()
      return allCommands[sessionId] || []
    } catch (error) {
      console.error('Failed to load commands:', error)
      return []
    }
  }

  /**
   * 加载所有命令记录
   */
  private loadAllCommands(): Record<string, SessionCommand[]> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.COMMANDS)
      return stored ? JSON.parse(stored) : {}
    } catch (error) {
      console.error('Failed to load all commands:', error)
      return {}
    }
  }

  /**
   * 删除会话相关数据
   */
  deleteSessionData(sessionId: string): void {
    try {
      // 删除历史记录
      const history = this.loadSessionHistory()
      const filteredHistory = history.filter(h => h.sessionId !== sessionId)
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(filteredHistory))
      
      // 删除命令记录
      const allCommands = this.loadAllCommands()
      delete allCommands[sessionId]
      localStorage.setItem(STORAGE_KEYS.COMMANDS, JSON.stringify(allCommands))
    } catch (error) {
      console.error('Failed to delete session data:', error)
    }
  }

  /**
   * 获取会话统计信息
   */
  getSessionStatistics(): SessionStatistics {
    try {
      const history = this.loadSessionHistory()
      const allCommands = this.loadAllCommands()
      
      const totalSessions = history.length
      const activeSessions = 0 // 活动会话需要从运行时状态获取
      const totalCommands = Object.values(allCommands).reduce((sum, commands) => sum + commands.length, 0)
      
      // 计算平均会话时长
      const completedSessions = history.filter(h => h.duration && h.duration > 0)
      const averageSessionDuration = completedSessions.length > 0
        ? completedSessions.reduce((sum, h) => sum + (h.duration || 0), 0) / completedSessions.length
        : 0
      
      // 统计最常用的主机
      const hostUsage = new Map<number, { hostName: string; count: number }>()
      history.forEach(h => {
        const existing = hostUsage.get(h.hostId)
        if (existing) {
          existing.count++
        } else {
          hostUsage.set(h.hostId, { hostName: h.hostName, count: 1 })
        }
      })
      
      const mostUsedHosts = Array.from(hostUsage.entries())
        .map(([hostId, { hostName, count }]) => ({ hostId, hostName, sessionCount: count }))
        .sort((a, b) => b.sessionCount - a.sessionCount)
        .slice(0, 10)
      
      // 最近的会话
      const recentSessions = history.slice(0, 10)
      
      return {
        totalSessions,
        activeSessions,
        totalCommands,
        averageSessionDuration,
        mostUsedHosts,
        recentSessions
      }
    } catch (error) {
      console.error('Failed to get session statistics:', error)
      return {
        totalSessions: 0,
        activeSessions: 0,
        totalCommands: 0,
        averageSessionDuration: 0,
        mostUsedHosts: [],
        recentSessions: []
      }
    }
  }

  /**
   * 清理过期数据
   */
  cleanupExpiredData(maxAge: number = 30 * 24 * 60 * 60 * 1000): void {
    try {
      const cutoffTime = Date.now() - maxAge
      
      // 清理过期历史记录
      const history = this.loadSessionHistory()
      const validHistory = history.filter(h => new Date(h.startTime).getTime() > cutoffTime)
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(validHistory))
      
      // 清理过期命令记录
      const allCommands = this.loadAllCommands()
      const validSessionIds = new Set(validHistory.map(h => h.sessionId))
      const cleanedCommands: Record<string, SessionCommand[]> = {}
      
      Object.entries(allCommands).forEach(([sessionId, commands]) => {
        if (validSessionIds.has(sessionId)) {
          cleanedCommands[sessionId] = commands
        }
      })
      
      localStorage.setItem(STORAGE_KEYS.COMMANDS, JSON.stringify(cleanedCommands))
    } catch (error) {
      console.error('Failed to cleanup expired data:', error)
    }
  }

  /**
   * 清空所有数据
   */
  clearAllData(): void {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key)
      })
    } catch (error) {
      console.error('Failed to clear all data:', error)
    }
  }
}

// 创建全局实例
export const sessionStorageService = new SessionStorageService()