/**
 * Ansible 执行日志显示演示页面
 * 用于测试 ExecutionLogDisplay 组件功能
 */
import React, { useState, useEffect, useCallback } from 'react'
import { ExecutionLogDisplay, LogEntry } from '../../components/Ansible'
import { PlaybookExecution } from '../../types/ansible'

const ExecutionLogDemo: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isRealtime, setIsRealtime] = useState(true)
  const [loading, setLoading] = useState(false)

  const mockExecution: PlaybookExecution = {
    id: 1,
    tenant_id: 1,
    playbook_id: 1,
    host_ids: [1, 2, 3],
    variables: { demo_var: 'Hello World' },
    status: 'running',
    started_at: new Date().toISOString(),
    created_by: 1,
    created_at: new Date().toISOString(),
    playbook: {
      id: 1,
      tenant_id: 1,
      name: 'Demo Playbook',
      description: 'Demo playbook for testing',
      content: '---\n- name: Demo\n  hosts: all\n  tasks:\n    - debug: msg="Hello"',
      version: '1.0',
      created_by: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    hosts: [
      { id: 1, name: 'web-01', hostname: '192.168.1.10' },
      { id: 2, name: 'web-02', hostname: '192.168.1.11' },
      { id: 3, name: 'db-01', hostname: '192.168.1.20' }
    ]
  }

  // 生成模拟日志数据
  const generateMockLogs = useCallback((): LogEntry[] => {
    const hosts = ['web-01', 'web-02', 'db-01']
    const tasks = [
      'Gathering Facts',
      'Install packages',
      'Configure services',
      'Start services',
      'Verify installation'
    ]
    const modules = ['setup', 'package', 'template', 'service', 'command']
    
    const mockLogs: LogEntry[] = []
    let logId = 1

    // PLAY 开始
    mockLogs.push({
      id: `log-${logId++}`,
      timestamp: new Date(Date.now() - 300000).toISOString(),
      level: 'PLAY',
      message: 'PLAY [Demo Playbook] ********************************************************'
    })

    // 为每个主机生成任务日志
    hosts.forEach((host, hostIndex) => {
      tasks.forEach((task, taskIndex) => {
        const timestamp = new Date(Date.now() - 250000 + hostIndex * 10000 + taskIndex * 5000).toISOString()
        
        // TASK 开始
        mockLogs.push({
          id: `log-${logId++}`,
          timestamp,
          level: 'TASK',
          message: `TASK [${task}] ****************************************************`,
          host,
          task
        })

        // 任务执行详情
        if (taskIndex === 0) {
          // Gathering Facts - INFO 级别
          mockLogs.push({
            id: `log-${logId++}`,
            timestamp: new Date(new Date(timestamp).getTime() + 1000).toISOString(),
            level: 'INFO',
            message: `ok: [${host}]`,
            host,
            task,
            module: modules[taskIndex]
          })
        } else if (taskIndex === 1) {
          // Install packages - 可能有警告
          if (hostIndex === 1) {
            mockLogs.push({
              id: `log-${logId++}`,
              timestamp: new Date(new Date(timestamp).getTime() + 2000).toISOString(),
              level: 'WARNING',
              message: `[WARNING]: Package repository cache is outdated on ${host}`,
              host,
              task,
              module: modules[taskIndex]
            })
          }
          mockLogs.push({
            id: `log-${logId++}`,
            timestamp: new Date(new Date(timestamp).getTime() + 3000).toISOString(),
            level: 'INFO',
            message: `changed: [${host}] => (item=curl)`,
            host,
            task,
            module: modules[taskIndex]
          })
          mockLogs.push({
            id: `log-${logId++}`,
            timestamp: new Date(new Date(timestamp).getTime() + 4000).toISOString(),
            level: 'INFO',
            message: `changed: [${host}] => (item=wget)`,
            host,
            task,
            module: modules[taskIndex]
          })
        } else if (taskIndex === 2) {
          // Configure services - 可能有错误
          if (hostIndex === 2 && host === 'db-01') {
            mockLogs.push({
              id: `log-${logId++}`,
              timestamp: new Date(new Date(timestamp).getTime() + 2000).toISOString(),
              level: 'ERROR',
              message: `fatal: [${host}]: FAILED! => {"changed": false, "msg": "Template not found: /etc/mysql/my.cnf.j2"}`,
              host,
              task,
              module: modules[taskIndex]
            })
          } else {
            mockLogs.push({
              id: `log-${logId++}`,
              timestamp: new Date(new Date(timestamp).getTime() + 2000).toISOString(),
              level: 'INFO',
              message: `changed: [${host}]`,
              host,
              task,
              module: modules[taskIndex]
            })
          }
        } else {
          // 其他任务
          mockLogs.push({
            id: `log-${logId++}`,
            timestamp: new Date(new Date(timestamp).getTime() + 1500).toISOString(),
            level: 'INFO',
            message: `ok: [${host}]`,
            host,
            task,
            module: modules[taskIndex]
          })
        }

        // 添加一些调试信息
        if (taskIndex === 4) {
          mockLogs.push({
            id: `log-${logId++}`,
            timestamp: new Date(new Date(timestamp).getTime() + 2000).toISOString(),
            level: 'DEBUG',
            message: `Verification command output: Service is running on ${host}`,
            host,
            task,
            module: modules[taskIndex]
          })
        }
      })
    })

    // PLAY RECAP
    mockLogs.push({
      id: `log-${logId++}`,
      timestamp: new Date(Date.now() - 10000).toISOString(),
      level: 'RECAP',
      message: 'PLAY RECAP *********************************************************************'
    })

    hosts.forEach(host => {
      const hasError = host === 'db-01'
      mockLogs.push({
        id: `log-${logId++}`,
        timestamp: new Date(Date.now() - 9000).toISOString(),
        level: 'RECAP',
        message: hasError 
          ? `${host}                     : ok=4    changed=2    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0`
          : `${host}                     : ok=5    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0`,
        host
      })
    })

    return mockLogs
  }, [])

  // 初始化日志
  useEffect(() => {
    setLogs(generateMockLogs())
  }, [generateMockLogs])

  // 模拟实时日志更新
  useEffect(() => {
    if (!isRealtime) return

    const interval = setInterval(() => {
      const newLog: LogEntry = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: Math.random() > 0.8 ? 'WARNING' : 'INFO',
        message: `Real-time log entry: ${new Date().toLocaleTimeString('zh-CN')}`,
        host: ['web-01', 'web-02', 'db-01'][Math.floor(Math.random() * 3)],
        task: 'Monitor task'
      }
      
      setLogs(prev => [...prev, newLog])
    }, 3000)

    return () => clearInterval(interval)
  }, [isRealtime])

  // 处理实时更新切换
  const handleToggleRealtime = useCallback((enabled: boolean) => {
    setIsRealtime(enabled)
  }, [])

  // 处理刷新
  const handleRefresh = useCallback(() => {
    setLoading(true)
    setTimeout(() => {
      setLogs(generateMockLogs())
      setLoading(false)
    }, 1000)
  }, [generateMockLogs])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Ansible 执行日志显示演示
          </h1>
          <p className="text-gray-600">
            测试执行日志实时显示、滚动、搜索、级别筛选和导出功能
          </p>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-2">功能特性</h2>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• 实时日志显示和更新控制</li>
            <li>• 日志搜索（支持内容、主机、任务搜索）</li>
            <li>• 日志级别筛选（DEBUG、INFO、WARNING、ERROR、CRITICAL、TASK、PLAY、RECAP）</li>
            <li>• 主机筛选和显示选项配置</li>
            <li>• 日志选择和批量操作（复制、导出）</li>
            <li>• 自动滚动和手动滚动控制</li>
            <li>• 日志导出功能（支持选中日志或全部日志）</li>
            <li>• 响应式设计和深色主题日志显示</li>
          </ul>
        </div>

        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 mb-2">演示说明</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 日志包含不同级别的示例数据（INFO、WARNING、ERROR、DEBUG等）</li>
            <li>• 实时更新功能会每3秒添加一条新日志</li>
            <li>• 可以测试搜索功能，例如搜索 "web-01" 或 "ERROR"</li>
            <li>• 可以测试级别筛选，例如只显示 WARNING 和 ERROR 级别</li>
            <li>• 可以选择日志并导出为文本文件</li>
          </ul>
        </div>

        <ExecutionLogDisplay
          execution={mockExecution}
          logs={logs}
          isRealtime={isRealtime}
          onToggleRealtime={handleToggleRealtime}
          onRefresh={handleRefresh}
          loading={loading}
        />

        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-medium text-gray-800 mb-2">日志统计</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">总日志数:</span>
              <span className="ml-2 font-medium">{logs.length}</span>
            </div>
            <div>
              <span className="text-gray-600">错误数:</span>
              <span className="ml-2 font-medium text-red-600">
                {logs.filter(log => log.level === 'ERROR').length}
              </span>
            </div>
            <div>
              <span className="text-gray-600">警告数:</span>
              <span className="ml-2 font-medium text-yellow-600">
                {logs.filter(log => log.level === 'WARNING').length}
              </span>
            </div>
            <div>
              <span className="text-gray-600">主机数:</span>
              <span className="ml-2 font-medium">
                {new Set(logs.filter(log => log.host).map(log => log.host)).size}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExecutionLogDemo