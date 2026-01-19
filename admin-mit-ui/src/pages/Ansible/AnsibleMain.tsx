/**
 * Ansible 主页面路由组件 - 美化版
 */
import React from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { FileText, History, GitBranch } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import PlaybookManagement from './PlaybookManagement'
import PlaybookCreate from './PlaybookCreate'
import PlaybookEdit from './PlaybookEdit'
import ExecutionWorkflow from './ExecutionWorkflow'
import ExecutionHistory from './ExecutionHistory'
import ExecutionDetail from './ExecutionDetail'
import PlaybookVersionHistory from './PlaybookVersionHistory'

const AnsibleNavTabs: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { isDark } = useTheme()
  
  const tabs = [
    { name: 'Playbook 管理', path: '/hostoperate/ansible/playbooks', icon: FileText },
    { name: '执行历史', path: '/hostoperate/ansible/executions', icon: History },
    { name: '历史版本', path: '/hostoperate/ansible/versions', icon: GitBranch }
  ]

  const isActive = (path: string) => {
    const currentPath = location.pathname
    if (path.includes('versions')) return currentPath.includes('versions')
    if (path.includes('playbooks')) return currentPath.includes('playbooks') || currentPath === '/hostoperate/ansible'
    return currentPath.includes('executions')
  }

  return (
    <div className={`${isDark ? 'bg-slate-800/50' : 'bg-white'} border-b ${isDark ? 'border-slate-700/50' : 'border-gray-200'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center space-x-1 py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = isActive(tab.path)
            return (
              <button 
                key={tab.path} 
                onClick={() => navigate(tab.path)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                  active 
                    ? isDark 
                      ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 shadow-lg shadow-blue-500/10' 
                      : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30'
                    : isDark 
                      ? 'text-gray-400 hover:text-gray-200 hover:bg-slate-700/50' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${active && !isDark ? 'text-white' : ''}`} />
                <span>{tab.name}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

const AnsibleMain: React.FC = () => {
  const location = useLocation()
  const { isDark } = useTheme()
  
  const shouldShowNavTabs = () => {
    const path = location.pathname
    const hideNavPatterns = ['/ansible/playbooks/new', /\/playbooks\/\d+\/edit$/, /\/playbooks\/\d+\/execute$/, /\/executions\/\d+$/]
    return !hideNavPatterns.some(p => typeof p === 'string' ? path.includes(p) : p.test(path))
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      {/* 导航标签 */}
      {shouldShowNavTabs() && <AnsibleNavTabs />}

      {/* 主内容区域 */}
      <div className="flex-1">
        <Routes>
          <Route index element={<Navigate to="playbooks" replace />} />
          <Route path="playbooks" element={<PlaybookManagement />} />
          <Route path="playbooks/new" element={<PlaybookCreate />} />
          <Route path="playbooks/:id/edit" element={<PlaybookEdit />} />
          <Route path="playbooks/:id/execute" element={<ExecutionWorkflow />} />
          <Route path="executions" element={<ExecutionHistory />} />
          <Route path="executions/:id" element={<ExecutionDetail />} />
          <Route path="versions" element={<PlaybookVersionHistory />} />
          <Route path="*" element={<Navigate to="playbooks" replace />} />
        </Routes>
      </div>
    </div>
  )
}

export default AnsibleMain