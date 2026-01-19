/**
 * 菜单列表页面 - 优化版
 * 采用表格形式展示菜单树，更清晰直观
 */
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { 
  Menu, RefreshCw, Search, ChevronDown, ChevronRight, Info, 
  Layers, FolderTree, CheckCircle, XCircle, Folder, FolderOpen,
  ExternalLink, Code, Hash
} from 'lucide-react'
import { menuService, MenuTreeNode } from '../../services/menus'
import { useTheme } from '../../hooks/useTheme'

export const MenuList: React.FC = () => {
  const { isDark } = useTheme()
  const abortControllerRef = useRef<AbortController | null>(null)

  const [menus, setMenus] = useState<MenuTreeNode[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<Set<number>>(new Set())
  const [keyword, setKeyword] = useState('')

  const loadMenuTree = async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    abortControllerRef.current = new AbortController()
    setLoading(true)

    try {
      const response = await menuService.getMenuTree()
      if (response.success) {
        let data = (response.data as any)?.menus || response.data || []
        if (!Array.isArray(data)) data = []
        setMenus(data)
        // 默认收起所有菜单
        setExpandedKeys(new Set())
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return
      console.error('加载菜单树失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMenuTree()
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort() }
  }, [])

  // 统计数据
  const statistics = useMemo(() => {
    const countMenus = (items: MenuTreeNode[]): { total: number; enabled: number; disabled: number } => {
      let total = 0, enabled = 0, disabled = 0
      items.forEach(menu => {
        total++
        if (menu.status === 1) enabled++; else disabled++
        if (menu.children?.length) {
          const childStats = countMenus(menu.children)
          total += childStats.total
          enabled += childStats.enabled
          disabled += childStats.disabled
        }
      })
      return { total, enabled, disabled }
    }
    const stats = countMenus(menus)
    return { ...stats, topLevel: menus.length }
  }, [menus])

  // 过滤菜单
  const filteredMenus = useMemo(() => {
    if (!keyword.trim()) return menus
    
    const filterTree = (items: MenuTreeNode[]): MenuTreeNode[] => {
      return items.reduce((acc: MenuTreeNode[], menu) => {
        const kw = keyword.toLowerCase()
        const nameMatch = menu.name.toLowerCase().includes(kw)
        const pathMatch = menu.path?.toLowerCase().includes(kw)
        
        if (menu.children?.length) {
          const filteredChildren = filterTree(menu.children)
          if (filteredChildren.length > 0) {
            acc.push({ ...menu, children: filteredChildren })
            return acc
          }
        }
        
        if (nameMatch || pathMatch) {
          acc.push({ ...menu, children: [] })
        }
        return acc
      }, [])
    }
    return filterTree(menus)
  }, [menus, keyword])

  const toggleExpand = (id: number) => {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => {
    const getAllIds = (items: MenuTreeNode[]): number[] => {
      return items.flatMap(m => [m.id, ...(m.children?.length ? getAllIds(m.children) : [])])
    }
    setExpandedKeys(new Set(getAllIds(menus)))
  }

  const collapseAll = () => setExpandedKeys(new Set())

  // 渲染菜单行
  const renderMenuRow = (menu: MenuTreeNode, level: number = 0): React.ReactNode => {
    const hasChildren = menu.children && menu.children.length > 0
    const isExpanded = expandedKeys.has(menu.id)
    const indent = level * 24

    return (
      <React.Fragment key={menu.id}>
        <tr className={`${isDark ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'} transition-colors`}>
          {/* 菜单名称 */}
          <td className="py-3 px-4">
            <div className="flex items-center" style={{ paddingLeft: indent }}>
              {/* 展开/收起按钮 */}
              <button
                onClick={() => hasChildren && toggleExpand(menu.id)}
                className={`w-6 h-6 flex items-center justify-center rounded transition-colors mr-2 ${
                  hasChildren 
                    ? isDark ? 'hover:bg-slate-600' : 'hover:bg-gray-200'
                    : 'invisible'
                }`}
              >
                {hasChildren && (
                  isExpanded 
                    ? <ChevronDown className="w-4 h-4 text-gray-500" />
                    : <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </button>
              
              {/* 图标 */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
                hasChildren
                  ? isExpanded
                    ? 'bg-blue-100 dark:bg-blue-900/30'
                    : 'bg-blue-50 dark:bg-blue-900/20'
                  : 'bg-gray-100 dark:bg-gray-700/50'
              }`}>
                {hasChildren ? (
                  isExpanded 
                    ? <FolderOpen className="w-4 h-4 text-blue-500" />
                    : <Folder className="w-4 h-4 text-blue-500" />
                ) : (
                  <Menu className="w-4 h-4 text-gray-500" />
                )}
              </div>
              
              {/* 名称 */}
              <span className={`font-medium ${
                menu.status === 1 
                  ? isDark ? 'text-white' : 'text-gray-900'
                  : 'text-gray-400'
              }`}>
                {menu.name}
              </span>
            </div>
          </td>
          
          {/* 路径 */}
          <td className="py-3 px-4">
            {menu.path ? (
              <div className="flex items-center space-x-2">
                <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                <code className={`text-sm px-2 py-1 rounded ${
                  isDark ? 'bg-slate-700 text-cyan-400' : 'bg-gray-100 text-blue-600'
                }`}>
                  {menu.path}
                </code>
              </div>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </td>
          
          {/* 组件 */}
          <td className="py-3 px-4">
            {menu.component ? (
              <div className="flex items-center space-x-2">
                <Code className="w-3.5 h-3.5 text-gray-400" />
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  {menu.component}
                </span>
              </div>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </td>
          
          {/* 排序 */}
          <td className="py-3 px-4 text-center">
            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              isDark ? 'bg-slate-700 text-gray-300' : 'bg-gray-100 text-gray-600'
            }`}>
              {menu.sort_order}
            </span>
          </td>
          
          {/* 状态 */}
          <td className="py-3 px-4 text-center">
            {menu.status === 1 ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <CheckCircle className="w-3 h-3" />
                <span>启用</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                <XCircle className="w-3 h-3" />
                <span>禁用</span>
              </span>
            )}
          </td>
        </tr>
        
        {/* 子菜单 */}
        {hasChildren && isExpanded && menu.children.map(child => renderMenuRow(child, level + 1))}
      </React.Fragment>
    )
  }

  return (
    <div className={`min-h-screen p-6 ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      {/* 页面标题 */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Menu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              菜单管理
            </h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              查看系统菜单结构（只读模式）
            </p>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: '总菜单数', value: statistics.total, icon: Layers, color: 'blue' },
          { label: '一级菜单', value: statistics.topLevel, icon: FolderTree, color: 'purple' },
          { label: '启用菜单', value: statistics.enabled, icon: CheckCircle, color: 'emerald' },
          { label: '禁用菜单', value: statistics.disabled, icon: XCircle, color: 'red' },
        ].map((stat, idx) => (
          <div key={idx} className={`p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{stat.label}</p>
                <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${stat.color}-100 dark:bg-${stat.color}-900/30`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-500`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 工具栏 */}
      <div className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* 搜索 */}
          <div className="relative flex-1 max-w-md">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索菜单名称或路径..."
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border transition-all focus:ring-2 focus:ring-blue-500 ${
                isDark 
                  ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-500' 
                  : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>
          
          {/* 操作按钮 */}
          <div className="flex items-center space-x-2">
            <button
              onClick={expandAll}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <ChevronDown className="w-4 h-4" />
              <span>展开全部</span>
            </button>
            <button
              onClick={collapseAll}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
              <span>收起全部</span>
            </button>
            <button
              onClick={loadMenuTree}
              disabled={loading}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                isDark ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-500 text-white hover:bg-blue-600'
              } disabled:opacity-50`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>刷新</span>
            </button>
          </div>
        </div>
      </div>

      {/* 只读提示 */}
      <div className={`mb-4 p-3 rounded-lg flex items-center space-x-3 ${
        isDark ? 'bg-blue-900/20 border border-blue-800/30' : 'bg-blue-50 border border-blue-100'
      }`}>
        <Info className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
        <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
          系统菜单结构已固定，此页面仅用于查看。如需修改请联系管理员。
        </p>
      </div>

      {/* 菜单表格 */}
      <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
        <table className="w-full">
          <thead>
            <tr className={isDark ? 'bg-slate-700/50' : 'bg-gray-50'}>
              <th className={`py-3 px-4 text-left text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                菜单名称
              </th>
              <th className={`py-3 px-4 text-left text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                路径
              </th>
              <th className={`py-3 px-4 text-left text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                组件
              </th>
              <th className={`py-3 px-4 text-center text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`} style={{ width: 80 }}>
                排序
              </th>
              <th className={`py-3 px-4 text-center text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`} style={{ width: 100 }}>
                状态
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-gray-100'}`}>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <RefreshCw className={`w-8 h-8 mx-auto mb-3 animate-spin ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>加载中...</p>
                </td>
              </tr>
            ) : filteredMenus.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <Menu className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                  <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                    {keyword ? '没有找到匹配的菜单' : '暂无菜单数据'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredMenus.map(menu => renderMenuRow(menu))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default MenuList
