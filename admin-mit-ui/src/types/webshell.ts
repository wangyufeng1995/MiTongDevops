/**
 * WebShell 会话管理相关类型定义
 */

export interface WebShellSessionInfo {
  id: string
  hostId: number
  hostName: string
  hostname: string
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  createdAt: string
  lastActiveAt: string
  title?: string
  isActive?: boolean
}

export interface WebShellTab {
  id: string
  sessionId: string
  hostId: number
  hostName: string
  hostname: string
  title: string
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  isActive: boolean
  createdAt: string
  lastActiveAt: string
  commandHistory: string[]
  currentDirectory?: string
}

export interface SessionHistoryRecord {
  id: string
  sessionId: string
  hostId: number
  hostName: string
  hostname: string
  startTime: string
  endTime?: string
  duration?: number
  commandCount: number
  status: 'completed' | 'interrupted' | 'error'
  lastCommand?: string
}

export interface SessionCommand {
  id: string
  sessionId: string
  command: string
  timestamp: string
  output?: string
  exitCode?: number
  duration?: number
}

export interface SessionStatistics {
  totalSessions: number
  activeSessions: number
  totalCommands: number
  averageSessionDuration: number
  mostUsedHosts: Array<{
    hostId: number
    hostName: string
    sessionCount: number
  }>
  recentSessions: SessionHistoryRecord[]
}