import React from 'react'
import { Activity } from 'lucide-react'
import { useTheme } from '../../../hooks/useTheme'

export interface ProbeAnalysisHeaderProps {
  title?: string
  subtitle?: string
}

export const ProbeAnalysisHeader: React.FC<ProbeAnalysisHeaderProps> = ({
  title = '网络探测分析',
  subtitle = '深度分析网络探测性能和可靠性指标',
}) => {
  const { isDark } = useTheme()

  return (
    <div className={`flex items-center justify-between px-6 py-4 border-b ${
      isDark ? 'bg-slate-900/80 border-slate-700/50' : 'bg-white border-gray-200'
    }`}>
      {/* 左侧：图标和标题 */}
      <div className="flex items-center space-x-3">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl blur-lg opacity-30"></div>
          <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-500 shadow-lg">
            <Activity className="w-5 h-5 text-white" />
          </div>
        </div>
        <div>
          <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h1>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

export default ProbeAnalysisHeader
