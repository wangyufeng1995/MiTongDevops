import React, { useState } from 'react'
import { Plus, Bell, History, ArrowLeft } from 'lucide-react'
import { NetworkAlertRule, NetworkAlertRecord } from '../../../types/network'
import { networkAlertRuleService } from '../../../services/network'
import { AlertRuleList } from './AlertRuleList'
import { AlertRuleForm } from './AlertRuleForm'
import { AlertHistoryList } from './AlertHistoryList'
import { AlertDetailModal } from './AlertDetailModal'
import { useTheme } from '../../../hooks/useTheme'

type ViewMode = 'rules' | 'history' | 'create-rule' | 'edit-rule'

export const NetworkAlertsPage: React.FC = () => {
  const { isDark } = useTheme()
  const [viewMode, setViewMode] = useState<ViewMode>('rules')
  const [selectedRule, setSelectedRule] = useState<NetworkAlertRule | null>(null)
  const [selectedAlert, setSelectedAlert] = useState<NetworkAlertRecord | null>(null)
  const [historyRuleId, setHistoryRuleId] = useState<number | undefined>(undefined)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleCreateRule = () => { setSelectedRule(null); setViewMode('create-rule') }
  const handleEditRule = (rule: NetworkAlertRule) => { setSelectedRule(rule); setViewMode('edit-rule') }
  const handleViewHistory = (ruleId?: number) => { setHistoryRuleId(ruleId); setViewMode('history') }
  const handleViewAllHistory = () => { setHistoryRuleId(undefined); setViewMode('history') }
  const handleViewDetail = (alert: NetworkAlertRecord) => { setSelectedAlert(alert) }
  const handleCloseDetail = () => { setSelectedAlert(null) }

  const handleSubmitRule = async (data: Partial<NetworkAlertRule>) => {
    try {
      if (selectedRule) { await networkAlertRuleService.update(selectedRule.id, data) }
      else { await networkAlertRuleService.create(data) }
      setRefreshTrigger(prev => prev + 1); setViewMode('rules')
    } catch (err: any) { throw new Error(err.message || '保存告警规则失败') }
  }

  const handleCancelForm = () => { setSelectedRule(null); setViewMode('rules') }
  const handleBackToRules = () => { setHistoryRuleId(undefined); setViewMode('rules') }

  const getTitle = () => {
    switch (viewMode) {
      case 'rules': return '告警规则'
      case 'history': return '告警历史'
      case 'create-rule': return '创建告警规则'
      case 'edit-rule': return '编辑告警规则'
    }
  }

  const getSubtitle = () => {
    switch (viewMode) {
      case 'rules': return '管理网络探测的告警规则'
      case 'history': return '查看和管理告警历史记录'
      case 'create-rule': return '为网络探测监控创建新的告警规则'
      case 'edit-rule': return '更新告警规则配置'
    }
  }

  return (
    <div className={`h-full flex flex-col overflow-hidden ${isDark ? 'bg-[#0f172a]' : 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50'}`}>
      {/* 头部 */}
      <div className={`flex-shrink-0 px-6 py-4 backdrop-blur-xl border-b ${isDark ? 'bg-slate-900/80 border-slate-700/50' : 'bg-white/70 border-gray-200/80'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className={`absolute inset-0 rounded-2xl blur-xl opacity-50 ${isDark ? 'bg-orange-500' : 'bg-orange-400'}`}></div>
              <div className="relative p-3 rounded-2xl bg-gradient-to-br from-orange-500 via-red-500 to-rose-500 shadow-xl">
                <Bell className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{getTitle()}</h1>
              <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{getSubtitle()}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {viewMode === 'rules' && (
              <>
                <button onClick={handleViewAllHistory}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all ${
                    isDark ? 'bg-slate-800/80 border border-slate-700/50 text-slate-300 hover:bg-slate-700' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm'
                  }`}>
                  <History className="w-4 h-4" />
                  <span>告警历史</span>
                </button>
                <button onClick={handleCreateRule}
                  className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-white text-sm font-medium overflow-hidden transition-all">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-red-500 to-rose-500"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-600 via-red-600 to-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <Plus className="relative w-4 h-4" />
                  <span className="relative">创建规则</span>
                </button>
              </>
            )}
            {(viewMode === 'history' || viewMode === 'create-rule' || viewMode === 'edit-rule') && (
              <button onClick={handleBackToRules}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all ${
                  isDark ? 'bg-slate-800/80 border border-slate-700/50 text-slate-300 hover:bg-slate-700' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm'
                }`}>
                <ArrowLeft className="w-4 h-4" />
                <span>返回规则</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className={`rounded-2xl ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-gray-100 shadow-lg shadow-gray-200/50'}`}>
          <div className="p-6">
            {viewMode === 'rules' && (
              <AlertRuleList onEdit={handleEditRule} onViewHistory={handleViewHistory} refreshTrigger={refreshTrigger} />
            )}
            {viewMode === 'history' && (
              <AlertHistoryList ruleId={historyRuleId} onViewDetail={handleViewDetail} />
            )}
            {(viewMode === 'create-rule' || viewMode === 'edit-rule') && (
              <AlertRuleForm rule={selectedRule} onSubmit={handleSubmitRule} onCancel={handleCancelForm} />
            )}
          </div>
        </div>
      </div>

      {/* 告警详情弹窗 */}
      {selectedAlert && <AlertDetailModal alert={selectedAlert} onClose={handleCloseDetail} />}
    </div>
  )
}

export default NetworkAlertsPage
