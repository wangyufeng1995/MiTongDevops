/**
 * 数据库类型选择器组件
 * 
 * 特点:
 * - 卡片式布局、类型图标、颜色标识
 * - 默认端口自动填充
 * - 平滑的选中动画效果
 * 
 * Requirements: 8.5, 8.6, 9.4
 */
import React from 'react'
import { Check } from 'lucide-react'

export type DatabaseType = 'postgresql' | 'mysql' | 'dm' | 'oracle'

export interface DatabaseTypeConfig {
  type: DatabaseType
  name: string
  description: string
  defaultPort: number
  gradient: string
  bgColor: string
  borderColor: string
  textColor: string
  iconColor: string
  icon: React.ReactNode
}

// PostgreSQL 图标
const PostgreSQLIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.128 0a10.134 10.134 0 0 0-2.755.403l-.063.02a10.922 10.922 0 0 0-1.612.49l-.094.037c-.243.097-.48.2-.712.31a9.85 9.85 0 0 0-1.89-.181c-.94 0-1.84.14-2.68.4a10.02 10.02 0 0 0-2.49 1.14A9.89 9.89 0 0 0 2.89 4.5a9.89 9.89 0 0 0-1.14 2.49 9.89 9.89 0 0 0-.4 2.68c0 .64.06 1.27.18 1.89a9.85 9.85 0 0 0 .31.71c.1.23.2.47.31.71.11.24.23.47.36.7.13.23.27.45.41.67.14.22.29.43.45.64.16.21.32.41.49.61.17.2.35.39.53.58.18.19.37.37.56.55.19.18.39.35.59.52.2.17.41.33.62.49.21.16.43.31.65.46.22.15.45.29.68.43.23.14.47.27.71.4.24.13.49.25.74.37.25.12.51.23.77.34.26.11.52.21.79.31.27.1.54.19.81.28.27.09.55.17.83.25.28.08.56.15.85.22.29.07.58.13.87.19.29.06.59.11.89.16.3.05.6.09.9.13.3.04.61.07.92.1.31.03.62.05.93.07.31.02.63.03.94.04.32.01.63.01.95.01.32 0 .63 0 .95-.01.31-.01.63-.02.94-.04.31-.02.62-.04.93-.07.31-.03.62-.06.92-.1.3-.04.6-.08.9-.13.3-.05.6-.1.89-.16.29-.06.58-.12.87-.19.29-.07.57-.14.85-.22.28-.08.56-.16.83-.25.27-.09.54-.18.81-.28.27-.1.53-.2.79-.31.26-.11.52-.22.77-.34.25-.12.5-.24.74-.37.24-.13.48-.26.71-.4.23-.14.46-.28.68-.43.22-.15.44-.3.65-.46.21-.16.42-.32.62-.49.2-.17.4-.34.59-.52.19-.18.38-.36.56-.55.18-.19.36-.38.53-.58.17-.2.33-.4.49-.61.16-.21.31-.42.45-.64.14-.22.28-.44.41-.67.13-.23.25-.46.36-.7.11-.24.21-.48.31-.71.1-.24.19-.48.28-.72a9.85 9.85 0 0 0 .18-1.89c0-.94-.14-1.84-.4-2.68a10.02 10.02 0 0 0-1.14-2.49A9.89 9.89 0 0 0 21.11 2.89a9.89 9.89 0 0 0-2.49-1.14A9.89 9.89 0 0 0 15.94.35c-.64 0-1.27.06-1.89.18a9.85 9.85 0 0 0-.71.31c-.23.1-.47.2-.71.31-.24.11-.47.23-.7.36-.23.13-.45.27-.67.41-.22.14-.43.29-.64.45-.21.16-.41.32-.61.49-.2.17-.39.35-.58.53-.19.18-.37.37-.55.56-.18.19-.35.39-.52.59-.17.2-.33.41-.49.62-.16.21-.31.43-.46.65-.15.22-.29.45-.43.68-.14.23-.27.47-.4.71-.13.24-.25.49-.37.74-.12.25-.23.51-.34.77-.11.26-.21.52-.31.79-.1.27-.19.54-.28.81-.09.27-.17.55-.25.83-.08.28-.15.56-.22.85-.07.29-.13.58-.19.87-.06.29-.11.59-.16.89-.05.3-.09.6-.13.9-.04.3-.07.61-.1.92-.03.31-.05.62-.07.93-.02.31-.03.63-.04.94-.01.32-.01.63-.01.95 0 .32 0 .63.01.95.01.31.02.63.04.94.02.31.04.62.07.93.03.31.06.62.1.92.04.3.08.6.13.9.05.3.1.6.16.89.06.29.12.58.19.87.07.29.14.57.22.85.08.28.16.56.25.83.09.27.18.54.28.81.1.27.2.53.31.79.11.26.22.52.34.77.12.25.24.5.37.74.13.24.26.48.4.71.14.23.28.46.43.68.15.22.3.44.46.65.16.21.32.42.49.62.17.2.34.4.52.59.18.19.36.38.55.56.19.18.38.36.58.53.2.17.4.33.61.49.21.16.42.31.64.45.22.14.44.28.67.41.23.13.46.25.7.36.24.11.48.21.71.31.24.1.48.19.72.28a9.85 9.85 0 0 0 1.89.18c.94 0 1.84-.14 2.68-.4a10.02 10.02 0 0 0 2.49-1.14 9.89 9.89 0 0 0 1.89-1.89c.54-.72 1-1.5 1.36-2.33.36-.83.62-1.71.78-2.62.16-.91.24-1.85.24-2.8 0-.95-.08-1.89-.24-2.8a10.134 10.134 0 0 0-.78-2.62 10.134 10.134 0 0 0-1.36-2.33 9.89 9.89 0 0 0-1.89-1.89 10.02 10.02 0 0 0-2.49-1.14A9.89 9.89 0 0 0 17.128 0z"/>
  </svg>
)

// MySQL 图标
const MySQLIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.178 10.641v4.777h-1.564V10.64H8.326V9.2h6.14v1.441h-2.288zm-5.083-1.441v6.218H5.53v-2.6H3.5v2.6H1.936V9.2H3.5v2.177h2.03V9.2h1.565zm10.178 0c.674 0 1.193.168 1.558.503.364.336.546.826.546 1.47v2.804c0 .644-.182 1.134-.546 1.47-.365.335-.884.503-1.558.503h-2.6V9.2h2.6zm-.156 5.277c.252 0 .44-.07.563-.21.123-.14.185-.35.185-.63v-2.596c0-.28-.062-.49-.185-.63-.123-.14-.311-.21-.563-.21h-.88v4.276h.88z"/>
  </svg>
)

// 达梦 DM 图标
const DMIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15H9V7h2v10zm4 0h-2V7h2v10z"/>
  </svg>
)

// Oracle 图标
const OracleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7.076 7.076C5.053 9.099 5.053 12.401 7.076 14.424c2.023 2.023 5.325 2.023 7.348 0 2.023-2.023 2.023-5.325 0-7.348-2.023-2.023-5.325-2.023-7.348 0zm6.348 6.348c-1.464 1.464-3.884 1.464-5.348 0-1.464-1.464-1.464-3.884 0-5.348 1.464-1.464 3.884-1.464 5.348 0 1.464 1.464 1.464 3.884 0 5.348z"/>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
  </svg>
)

export const DATABASE_TYPES: DatabaseTypeConfig[] = [
  {
    type: 'postgresql',
    name: 'PostgreSQL',
    description: '开源关系型数据库',
    defaultPort: 5432,
    gradient: 'from-blue-500 to-indigo-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
    textColor: 'text-blue-700',
    iconColor: 'text-blue-600',
    icon: <PostgreSQLIcon className="w-8 h-8" />
  },
  {
    type: 'mysql',
    name: 'MySQL',
    description: '流行的开源数据库',
    defaultPort: 3306,
    gradient: 'from-orange-500 to-amber-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-500',
    textColor: 'text-orange-700',
    iconColor: 'text-orange-600',
    icon: <MySQLIcon className="w-8 h-8" />
  },
  {
    type: 'dm',
    name: '达梦 DM',
    description: '国产关系型数据库',
    defaultPort: 5236,
    gradient: 'from-red-500 to-rose-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    textColor: 'text-red-700',
    iconColor: 'text-red-600',
    icon: <DMIcon className="w-8 h-8" />
  },
  {
    type: 'oracle',
    name: 'Oracle',
    description: '企业级数据库',
    defaultPort: 1521,
    gradient: 'from-red-700 to-orange-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-600',
    textColor: 'text-red-800',
    iconColor: 'text-red-700',
    icon: <OracleIcon className="w-8 h-8" />
  }
]

export interface DatabaseTypeSelectorProps {
  /** 当前选中的数据库类型 */
  value: DatabaseType | null
  /** 选择变化回调 */
  onChange: (type: DatabaseType, defaultPort: number) => void
  /** 是否禁用 */
  disabled?: boolean
  /** 是否为编辑模式（只显示当前类型） */
  editMode?: boolean
}

export const DatabaseTypeSelector: React.FC<DatabaseTypeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  editMode = false
}) => {
  // 编辑模式：只显示当前选中的类型
  if (editMode && value) {
    const selectedConfig = DATABASE_TYPES.find(db => db.type === value)
    if (!selectedConfig) return null

    return (
      <div className="w-full">
        <div 
          className={`relative flex items-center p-4 rounded-xl border-2 ${selectedConfig.borderColor} ${selectedConfig.bgColor}`}
        >
          {/* 图标 */}
          <div className={`flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${selectedConfig.gradient} flex items-center justify-center shadow-lg`}>
            <div className="text-white">
              {selectedConfig.icon}
            </div>
          </div>
          
          {/* 信息 */}
          <div className="ml-4 flex-1">
            <h4 className={`text-lg font-semibold ${selectedConfig.textColor}`}>
              {selectedConfig.name}
            </h4>
            <p className="text-sm text-gray-500 mt-0.5">
              {selectedConfig.description}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              默认端口: {selectedConfig.defaultPort}
            </p>
          </div>

          {/* 选中标记 */}
          <div className={`absolute top-3 right-3 w-6 h-6 rounded-full bg-gradient-to-br ${selectedConfig.gradient} flex items-center justify-center shadow`}>
            <Check className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>
    )
  }

  // 正常模式：显示所有类型供选择
  return (
    <div className="grid grid-cols-2 gap-4">
      {DATABASE_TYPES.map((dbConfig) => {
        const isSelected = value === dbConfig.type
        
        return (
          <button
            key={dbConfig.type}
            type="button"
            onClick={() => !disabled && onChange(dbConfig.type, dbConfig.defaultPort)}
            disabled={disabled}
            className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200 ${
              disabled 
                ? 'opacity-50 cursor-not-allowed' 
                : 'cursor-pointer hover:shadow-lg active:scale-[0.98]'
            } ${
              isSelected 
                ? `${dbConfig.borderColor} ${dbConfig.bgColor} shadow-md` 
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            {/* 选中标记 */}
            {isSelected && (
              <div className={`absolute top-2 right-2 w-5 h-5 rounded-full bg-gradient-to-br ${dbConfig.gradient} flex items-center justify-center shadow`}>
                <Check className="w-3 h-3 text-white" />
              </div>
            )}

            {/* 图标 */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all duration-200 ${
              isSelected 
                ? `bg-gradient-to-br ${dbConfig.gradient} shadow-lg` 
                : 'bg-gray-100'
            }`}>
              <div className={isSelected ? 'text-white' : dbConfig.iconColor}>
                {dbConfig.icon}
              </div>
            </div>
            
            {/* 名称 */}
            <h4 className={`text-sm font-semibold transition-colors duration-200 ${
              isSelected ? dbConfig.textColor : 'text-gray-700'
            }`}>
              {dbConfig.name}
            </h4>
            
            {/* 描述 */}
            <p className="text-xs text-gray-500 mt-1 text-center">
              {dbConfig.description}
            </p>
            
            {/* 默认端口 */}
            <div className={`mt-2 px-2 py-0.5 rounded-full text-xs transition-colors duration-200 ${
              isSelected 
                ? `${dbConfig.bgColor} ${dbConfig.textColor}` 
                : 'bg-gray-100 text-gray-500'
            }`}>
              端口 {dbConfig.defaultPort}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// 辅助函数：根据类型获取配置
export const getDatabaseTypeConfig = (type: DatabaseType): DatabaseTypeConfig | undefined => {
  return DATABASE_TYPES.find(db => db.type === type)
}

// 辅助函数：获取默认端口
export const getDefaultPort = (type: DatabaseType): number => {
  const config = getDatabaseTypeConfig(type)
  return config?.defaultPort || 5432
}

export default DatabaseTypeSelector
