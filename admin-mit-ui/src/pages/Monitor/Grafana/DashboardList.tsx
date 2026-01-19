/**
 * Grafana 仪表盘列表组件
 * 
 * 显示仪表盘列表，支持选择、编辑、删除、设置默认
 * 
 * Requirements: 4.2, 4.3, 5.3
 */
import React from 'react'
import {
  LayoutDashboard,
  Edit2,
  Trash2,
  Star,
  MoreVertical,
  Plus
} from 'lucide-react'
import { GrafanaDashboard } from '../../../services/grafana'

interface DashboardListProps {
  dashboards: GrafanaDashboard[]
  selectedDashboard: GrafanaDashboard | null
  onSelect: (dashboard: GrafanaDashboard) => void
  onEdit: (dashboard: GrafanaDashboard) => void
  onDelete: (dashboard: GrafanaDashboard) => void
  onSetDefault: (dashboard: GrafanaDashboard) => void
  onCreate: () => void
}

export const DashboardList: React.FC<DashboardListProps> = ({
  dashboards,
  selectedDashboard,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
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

  // 按 sort_order 排序
  const sortedDashboards = [...dashboards].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="border-t-2 border-orange-100 mt-4">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-50 to-red-50">
        <span className="text-xs font-bold text-orange-700 uppercase tracking-wider">仪表盘列表</span>
        <button
          onClick={onCreate}
          className="p-1.5 text-orange-600 hover:bg-white rounded-lg transition-all hover:scale-110 shadow-sm"
          title="添加仪表盘"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* 仪表盘列表 */}
      {sortedDashboards.length === 0 ? (
        <div className="p-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-orange-100 to-red-100 mb-3">
            <LayoutDashboard className="w-8 h-8 text-orange-500" />
          </div>
          <p className="text-xs text-gray-600 mb-3">暂无仪表盘</p>
          <button
            onClick={onCreate}
            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs rounded-lg hover:from-orange-600 hover:to-red-600 transition-all shadow-md hover:shadow-lg hover:scale-105"
          >
            <Plus className="w-3 h-3" />
            <span>添加仪表盘</span>
          </button>
        </div>
      ) : (
        <div className="space-y-1 p-2">
          {sortedDashboards.map((dashboard) => {
            const isSelected = selectedDashboard?.id === dashboard.id
            
            return (
              <div
                key={dashboard.id}
                className={`relative px-3 py-2.5 cursor-pointer transition-all duration-200 rounded-lg ${
                  isSelected 
                    ? 'bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 shadow-md scale-[1.02]' 
                    : 'bg-white/60 hover:bg-white text-gray-700 hover:shadow-sm'
                }`}
                onClick={() => onSelect(dashboard)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <div className={`p-1 rounded-md ${
                      isSelected 
                        ? 'bg-gradient-to-br from-orange-400 to-red-500' 
                        : 'bg-gradient-to-br from-orange-300 to-red-400'
                    }`}>
                      <LayoutDashboard className="w-3.5 h-3.5 text-white flex-shrink-0" />
                    </div>
                    <span className={`text-sm truncate font-medium ${
                      isSelected ? 'text-orange-900' : 'text-gray-800'
                    }`}>
                      {dashboard.name}
                    </span>
                    {dashboard.is_default && (
                      <div className="flex items-center space-x-0.5 px-1.5 py-0.5 bg-yellow-100 rounded-full">
                        <Star className="w-3 h-3 text-yellow-600 fill-yellow-500 flex-shrink-0" />
                        <span className="text-xs text-yellow-700 font-medium">默认</span>
                      </div>
                    )}
                  </div>

                  {/* 操作菜单 */}
                  <div className="relative ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenuId(openMenuId === dashboard.id ? null : dashboard.id)
                      }}
                      className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {/* 下拉菜单 */}
                    {openMenuId === dashboard.id && (
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
                              onEdit(dashboard)
                            }}
                            className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 hover:text-orange-700 transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>编辑</span>
                          </button>
                          {!dashboard.is_default && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                closeMenu()
                                onSetDefault(dashboard)
                              }}
                              className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-yellow-50 hover:to-orange-50 hover:text-yellow-700 transition-all"
                            >
                              <Star className="w-3.5 h-3.5" />
                              <span>设为默认</span>
                            </button>
                          )}
                          <div className="border-t border-gray-100 my-1" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              closeMenu()
                              onDelete(dashboard)
                            }}
                            className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>删除</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                {/* 描述 */}
                {dashboard.description && (
                  <p className="text-xs text-gray-500 mt-1.5 truncate pl-7">
                    {dashboard.description}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default DashboardList
