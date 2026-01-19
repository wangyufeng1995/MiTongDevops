/**
 * Grafana 配置列表组件
 * 
 * 显示 Grafana 配置列表，支持选择、编辑、删除
 * 
 * Requirements: 4.1, 4.4, 4.5
 */
import React from 'react'
import {
  BarChart3,
  Edit2,
  Trash2,
  MoreVertical,
  CheckCircle,
  XCircle,
  Plus
} from 'lucide-react'
import { GrafanaConfig } from '../../../services/grafana'

interface ConfigListProps {
  configs: GrafanaConfig[]
  selectedConfig: GrafanaConfig | null
  onSelect: (config: GrafanaConfig) => void
  onEdit: (config: GrafanaConfig) => void
  onDelete: (config: GrafanaConfig) => void
  onCreate: () => void
}

export const ConfigList: React.FC<ConfigListProps> = ({
  configs,
  selectedConfig,
  onSelect,
  onEdit,
  onDelete,
  onCreate
}) => {
  const [openMenuId, setOpenMenuId] = React.useState<number | null>(null)

  // 关闭菜单
  const closeMenu = () => setOpenMenuId(null)

  // 点击外部关闭菜单
  React.useEffect(() => {
    const handleClickOutside = () => closeMenu()
    if (openMenuId !== null) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenuId])

  if (configs.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-orange-100 to-red-100 mb-4">
          <BarChart3 className="w-10 h-10 text-orange-500" />
        </div>
        <p className="text-sm text-gray-600 mb-4">暂无 Grafana 配置</p>
        <button
          onClick={onCreate}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          <span>创建配置</span>
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-2">
      {configs.map((config) => {
        const isSelected = selectedConfig?.id === config.id
        const dashboardCount = config.dashboards?.length || 0
        
        return (
          <div
            key={config.id}
            className={`relative p-4 cursor-pointer transition-all duration-200 rounded-xl ${
              isSelected 
                ? 'bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-300 shadow-lg shadow-orange-500/20' 
                : 'bg-white/80 backdrop-blur-sm border-2 border-transparent hover:border-orange-200 hover:shadow-md hover:scale-[1.02]'
            }`}
            onClick={() => onSelect(config)}
          >
            {/* 配置信息 */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-2">
                  <div className={`p-1.5 rounded-lg ${
                    config.status === 1 
                      ? 'bg-gradient-to-br from-green-400 to-emerald-500' 
                      : 'bg-gray-300'
                  }`}>
                    <BarChart3 className="w-4 h-4 text-white" />
                  </div>
                  {config.status === 1 ? (
                    <div className="flex items-center space-x-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      <CheckCircle className="w-3 h-3" />
                      <span>已启用</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
                      <XCircle className="w-3 h-3" />
                      <span>已禁用</span>
                    </div>
                  )}
                </div>
                <h4 className="font-semibold text-gray-900 truncate mb-1">
                  {config.name}
                </h4>
                <p className="text-xs text-gray-600 truncate mb-1 font-mono">
                  {config.url}
                </p>
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <div className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
                    {dashboardCount} 个仪表盘
                  </div>
                </div>
              </div>

              {/* 操作菜单 */}
              <div className="relative ml-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenuId(openMenuId === config.id ? null : config.id)
                  }}
                  className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* 下拉菜单 */}
                {openMenuId === config.id && (
                  <>
                    <div 
                      className="fixed inset-0 z-10"
                      onClick={(e) => {
                        e.stopPropagation()
                        closeMenu()
                      }}
                    />
                    <div className="absolute right-0 top-full mt-1 w-36 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-200 py-1 z-20 overflow-hidden">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          closeMenu()
                          onEdit(config)
                        }}
                        className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 hover:text-orange-700 transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span>编辑</span>
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          closeMenu()
                          onDelete(config)
                        }}
                        className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>删除</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ConfigList
