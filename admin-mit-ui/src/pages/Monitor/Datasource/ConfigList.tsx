/**
 * 数据源配置列表组件
 * 
 * 显示配置列表，支持新建、编辑、删除、测试连接
 * 
 * Requirements: 1.1, 1.4, 1.5, 1.6
 */
import React from 'react'
import {
  Database,
  Edit2,
  Trash2,
  Zap,
  Star,
  MoreVertical,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { DatasourceConfig, DATASOURCE_TYPES } from '../../../services/datasource'

interface ConfigListProps {
  configs: DatasourceConfig[]
  selectedConfig: DatasourceConfig | null
  onSelect: (config: DatasourceConfig) => void
  onEdit: (config: DatasourceConfig) => void
  onDelete: (config: DatasourceConfig) => void
  onTest: (config: DatasourceConfig) => void
  onSetDefault: (config: DatasourceConfig) => void
}

export const ConfigList: React.FC<ConfigListProps> = ({
  configs,
  selectedConfig,
  onSelect,
  onEdit,
  onDelete,
  onTest,
  onSetDefault
}) => {
  const [openMenuId, setOpenMenuId] = React.useState<number | null>(null)

  // 关闭菜单
  const closeMenu = () => setOpenMenuId(null)

  // 点击外部关闭菜单
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // 检查点击是否在菜单外部
      const target = e.target as HTMLElement
      if (!target.closest('.dropdown-menu-container')) {
        closeMenu()
      }
    }
    
    if (openMenuId !== null) {
      // 延迟添加监听器，避免立即触发
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
      }, 0)
      
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenuId])

  if (configs.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="relative inline-block mb-4">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full blur-xl opacity-20"></div>
          <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-full">
            <Database className="w-10 h-10 text-blue-500" />
          </div>
        </div>
        <p className="text-sm font-medium text-gray-700">暂无数据源配置</p>
        <p className="text-xs text-gray-500 mt-1">点击上方 "+" 按钮创建</p>
      </div>
    )
  }

  return (
    <div className="p-2 space-y-2">
      {configs.map((config) => {
        const isSelected = selectedConfig?.id === config.id
        const typeConfig = DATASOURCE_TYPES[config.type] || DATASOURCE_TYPES.prometheus
        
        return (
          <div
            key={config.id}
            className={`group relative p-3 cursor-pointer rounded-xl transition-all duration-200 ${
              isSelected 
                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 shadow-md scale-[1.02]' 
                : 'bg-white hover:bg-gray-50 border-2 border-transparent hover:border-gray-200 hover:shadow-md'
            }`}
            onClick={() => onSelect(config)}
          >
            {/* 选中指示器 */}
            {isSelected && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-r-full"></div>
            )}

            {/* 配置信息 */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 pl-2">
                <div className="flex items-center space-x-2 mb-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r ${typeConfig.gradient} text-white shadow-sm`}>
                    {typeConfig.name}
                  </span>
                  {config.is_default && (
                    <div className="relative group/star">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-400 drop-shadow-sm animate-pulse" />
                      <span className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover/star:opacity-100 transition-opacity whitespace-nowrap">
                        默认数据源
                      </span>
                    </div>
                  )}
                  {config.status === 1 ? (
                    <div className="relative group/status">
                      <CheckCircle className="w-4 h-4 text-green-500 drop-shadow-sm" />
                      <span className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover/status:opacity-100 transition-opacity whitespace-nowrap">
                        已启用
                      </span>
                    </div>
                  ) : (
                    <div className="relative group/status">
                      <XCircle className="w-4 h-4 text-gray-400" />
                      <span className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover/status:opacity-100 transition-opacity whitespace-nowrap">
                        已禁用
                      </span>
                    </div>
                  )}
                </div>
                <h4 className={`font-semibold truncate transition-colors ${
                  isSelected ? 'text-blue-900' : 'text-gray-900 group-hover:text-gray-700'
                }`}>
                  {config.name}
                </h4>
                <p className="text-xs text-gray-500 truncate mt-1 font-mono">
                  {config.url}
                </p>
              </div>

              {/* 操作菜单 */}
              <div className="relative ml-2 dropdown-menu-container">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenuId(openMenuId === config.id ? null : config.id)
                  }}
                  className={`p-1.5 rounded-lg transition-all duration-200 ${
                    isSelected 
                      ? 'text-blue-600 hover:bg-blue-100' 
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* 下拉菜单 */}
                {openMenuId === config.id && (
                  <>
                    {/* 遮罩层 */}
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={(e) => {
                        e.stopPropagation()
                        closeMenu()
                      }}
                    />
                    
                    {/* 菜单内容 */}
                    <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-2xl border border-gray-200 py-1.5 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          closeMenu()
                          onTest(config)
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors rounded-lg mx-1"
                      >
                        <Zap className="w-4 h-4" />
                        <span className="font-medium">测试连接</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          closeMenu()
                          onEdit(config)
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors rounded-lg mx-1"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span className="font-medium">编辑</span>
                      </button>
                      {!config.is_default && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            closeMenu()
                            onSetDefault(config)
                          }}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-yellow-50 hover:text-yellow-700 transition-colors rounded-lg mx-1"
                        >
                          <Star className="w-4 h-4" />
                          <span className="font-medium">设为默认</span>
                        </button>
                      )}
                      <div className="border-t border-gray-100 my-1.5" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          closeMenu()
                          onDelete(config)
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors rounded-lg mx-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="font-medium">删除</span>
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
