/**
 * Network Probe Main Page
 * 
 * 网络探测主页面，整合所有网络探测功能
 */
import React, { useState } from 'react'
import { 
  Activity, 
  BarChart3,
  Settings,
  Eye,
  Wrench,
  TrendingUp
} from 'lucide-react'
import NetworkProbeEnhanced from './NetworkProbeEnhanced'
import NetworkProbeVisualizer from './NetworkProbeVisualizer'
import NetworkProbeBuilder from './NetworkProbeBuilder'
import NetworkProbeAnalytics from './NetworkProbeAnalytics'
import { NetworkDashboard } from './Dashboard'

type TabType = 'dashboard' | 'probes' | 'visualizer' | 'builder' | 'analytics'

export const NetworkProbePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')

  const tabs = [
    {
      id: 'dashboard' as TabType,
      name: '监控大屏',
      icon: <Eye className="w-4 h-4" />,
      description: '实时监控和状态展示'
    },
    {
      id: 'probes' as TabType,
      name: '探测管理',
      icon: <Activity className="w-4 h-4" />,
      description: '探测任务管理和操作'
    },
    {
      id: 'visualizer' as TabType,
      name: '数据可视化',
      icon: <BarChart3 className="w-4 h-4" />,
      description: '性能指标可视化展示'
    },
    {
      id: 'builder' as TabType,
      name: '配置构建器',
      icon: <Wrench className="w-4 h-4" />,
      description: '可视化创建探测配置'
    },
    {
      id: 'analytics' as TabType,
      name: '深度分析',
      icon: <TrendingUp className="w-4 h-4" />,
      description: '性能分析和趋势预测'
    }
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <NetworkDashboard />
      case 'probes':
        return <NetworkProbeEnhanced />
      case 'visualizer':
        return <NetworkProbeVisualizer />
      case 'builder':
        return <NetworkProbeBuilder />
      case 'analytics':
        return <NetworkProbeAnalytics />
      default:
        return <NetworkDashboard />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 标签导航 */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">网络探测系统</h1>
              <p className="text-sm text-gray-600 mt-1">
                全方位网络服务监控和分析平台
              </p>
            </div>
          </div>

          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {tab.icon}
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1">
        {renderContent()}
      </div>
    </div>
  )
}

export default NetworkProbePage