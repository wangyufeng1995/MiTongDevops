/**
 * Ansible 执行界面演示页面
 * 用于测试 ExecutionInterface 组件功能
 */
import React, { useState } from 'react'
import { ExecutionInterface } from '../../components/Ansible'
import { AnsiblePlaybook, PlaybookExecution } from '../../types/ansible'
import { Host } from '../../types/host'

const ExecutionDemo: React.FC = () => {
  const [execution, setExecution] = useState<PlaybookExecution | null>(null)

  const mockPlaybook: AnsiblePlaybook = {
    id: 1,
    tenant_id: 1,
    name: 'Demo Playbook',
    description: 'This is a demo playbook for testing execution interface',
    content: `---
- name: Demo Playbook
  hosts: all
  become: yes
  vars:
    demo_var: "Hello World"
  
  tasks:
    - name: Print message
      debug:
        msg: "{{ demo_var }}"
    
    - name: Install packages
      package:
        name:
          - curl
          - wget
        state: present`,
    variables: {
      demo_var: 'Hello World',
      environment: 'demo'
    },
    version: '1.0',
    created_by: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    creator: {
      id: 1,
      username: 'demo',
      full_name: 'Demo User'
    }
  }

  const mockHosts: Host[] = [
    {
      id: 1,
      tenant_id: 1,
      name: 'Web Server 1',
      hostname: '192.168.1.10',
      port: 22,
      username: 'root',
      auth_type: 'password',
      description: 'Production web server',
      status: 1,
      last_connected_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 2,
      tenant_id: 1,
      name: 'Database Server',
      hostname: '192.168.1.20',
      port: 22,
      username: 'admin',
      auth_type: 'key',
      description: 'MySQL database server',
      status: 1,
      last_connected_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 3,
      tenant_id: 1,
      name: 'Cache Server',
      hostname: '192.168.1.30',
      port: 22,
      username: 'redis',
      auth_type: 'key',
      description: 'Redis cache server',
      status: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 4,
      tenant_id: 1,
      name: 'Load Balancer',
      hostname: '192.168.1.40',
      port: 22,
      username: 'nginx',
      auth_type: 'password',
      description: 'Nginx load balancer',
      status: 1,
      last_connected_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ]

  const handleExecute = (executionResult: PlaybookExecution) => {
    console.log('Execution started:', executionResult)
    setExecution(executionResult)
    alert(`Playbook 执行已启动！执行 ID: ${executionResult.id}`)
  }

  const handleCancel = () => {
    console.log('Execution cancelled')
    alert('执行已取消')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Ansible 执行界面演示
          </h1>
          <p className="text-gray-600">
            测试 Playbook 执行配置界面、主机选择组件、执行参数配置和执行确认对话框
          </p>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-2">功能特性</h2>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• 目标主机选择（支持搜索、筛选、全选）</li>
            <li>• 执行参数配置（并行执行、错误处理、详细级别等）</li>
            <li>• 高级配置（试运行模式、检查模式）</li>
            <li>• 变量配置（默认变量显示、自定义变量编辑）</li>
            <li>• 执行确认对话框（显示执行摘要和警告信息）</li>
            <li>• 表单验证（主机选择、变量格式等）</li>
          </ul>
        </div>

        <ExecutionInterface
          playbook={mockPlaybook}
          availableHosts={mockHosts}
          onExecute={handleExecute}
          onCancel={handleCancel}
        />

        {execution && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-sm font-medium text-green-800 mb-2">执行结果</h3>
            <pre className="text-sm text-green-700 whitespace-pre-wrap">
              {JSON.stringify(execution, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default ExecutionDemo