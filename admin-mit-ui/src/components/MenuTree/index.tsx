/**
 * 菜单树形展示组件
 * 支持拖拽排序、展开收起、操作按钮等功能
 */
import React, { useState, useCallback } from 'react'
import { 
  ChevronDown, 
  ChevronRight, 
  Menu as MenuIcon, 
  Folder, 
  FolderOpen,
  Edit, 
  Trash2, 
  Plus,
  GripVertical,
  Eye,
  EyeOff
} from 'lucide-react'
import { MenuTreeNode } from '../../services/menus'
import clsx from 'clsx'

export interface MenuTreeProps {
  menus: MenuTreeNode[]
  onEdit?: (menu: MenuTreeNode) => void
  onDelete?: (menu: MenuTreeNode) => void
  onAdd?: (parentMenu?: MenuTreeNode) => void
  onToggleStatus?: (menu: MenuTreeNode) => void
  onMove?: (draggedMenu: MenuTreeNode, targetMenu: MenuTreeNode, position: 'before' | 'after' | 'inside') => void
  expandedKeys?: Set<number>
  onExpandedKeysChange?: (keys: Set<number>) => void
  selectedKey?: number
  onSelect?: (menu: MenuTreeNode) => void
  draggable?: boolean
  showActions?: boolean
  className?: string
}

export interface MenuTreeNodeProps {
  menu: MenuTreeNode
  level: number
  expandedKeys: Set<number>
  selectedKey?: number
  onToggleExpand: (menuId: number) => void
  onSelect: (menu: MenuTreeNode) => void
  onEdit?: (menu: MenuTreeNode) => void
  onDelete?: (menu: MenuTreeNode) => void
  onAdd?: (parentMenu: MenuTreeNode) => void
  onToggleStatus?: (menu: MenuTreeNode) => void
  onDragStart?: (menu: MenuTreeNode) => void
  onDragOver?: (e: React.DragEvent, menu: MenuTreeNode) => void
  onDrop?: (e: React.DragEvent, menu: MenuTreeNode) => void
  draggable?: boolean
  showActions?: boolean
}

const MenuTreeNodeComponent: React.FC<MenuTreeNodeProps> = ({
  menu,
  level,
  expandedKeys,
  selectedKey,
  onToggleExpand,
  onSelect,
  onEdit,
  onDelete,
  onAdd,
  onToggleStatus,
  onDragStart,
  onDragOver,
  onDrop,
  draggable = false,
  showActions = true
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragPosition, setDragPosition] = useState<'before' | 'after' | 'inside'>('inside')

  const hasChildren = menu.children && menu.children.length > 0
  const isExpanded = expandedKeys.has(menu.id)
  const isSelected = selectedKey === menu.id
  const paddingLeft = level * 24 + 12

  // 获取菜单图标
  const getMenuIcon = () => {
    if (menu.icon) {
      // 这里可以根据图标名称返回对应的图标组件
      return <MenuIcon className="w-4 h-4" />
    }
    
    if (hasChildren) {
      return isExpanded ? (
        <FolderOpen className="w-4 h-4 text-blue-500" />
      ) : (
        <Folder className="w-4 h-4 text-blue-500" />
      )
    }
    
    return <MenuIcon className="w-4 h-4 text-gray-500" />
  }

  // 处理拖拽开始
  const handleDragStart = (e: React.DragEvent) => {
    if (!draggable || !onDragStart) return
    e.dataTransfer.effectAllowed = 'move'
    onDragStart(menu)
  }

  // 处理拖拽悬停
  const handleDragOver = (e: React.DragEvent) => {
    if (!draggable || !onDragOver) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height
    
    let position: 'before' | 'after' | 'inside' = 'inside'
    if (y < height * 0.25) {
      position = 'before'
    } else if (y > height * 0.75) {
      position = 'after'
    } else if (hasChildren) {
      position = 'inside'
    }
    
    setDragPosition(position)
    setIsDragOver(true)
    onDragOver(e, menu)
  }

  // 处理拖拽离开
  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  // 处理拖拽放置
  const handleDrop = (e: React.DragEvent) => {
    if (!draggable || !onDrop) return
    e.preventDefault()
    setIsDragOver(false)
    onDrop(e, menu)
  }

  // 处理点击展开/收起
  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasChildren) {
      onToggleExpand(menu.id)
    }
  }

  // 处理选择菜单
  const handleSelect = () => {
    onSelect(menu)
  }

  return (
    <div className="select-none">
      {/* 菜单节点 */}
      <div
        className={clsx(
          'group flex items-center py-2 px-2 rounded-md cursor-pointer transition-colors relative',
          isSelected && 'bg-blue-50 border border-blue-200',
          !isSelected && 'hover:bg-gray-50',
          isDragOver && 'bg-blue-100',
          menu.status === 0 && 'opacity-60'
        )}
        style={{ paddingLeft }}
        onClick={handleSelect}
        draggable={draggable}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 拖拽指示器 */}
        {isDragOver && (
          <div
            className={clsx(
              'absolute left-0 right-0 h-0.5 bg-blue-500',
              dragPosition === 'before' && 'top-0',
              dragPosition === 'after' && 'bottom-0',
              dragPosition === 'inside' && 'top-1/2 transform -translate-y-1/2 h-full bg-blue-100 opacity-50'
            )}
          />
        )}

        {/* 拖拽手柄 */}
        {draggable && (
          <div className="opacity-0 group-hover:opacity-100 mr-2 cursor-grab active:cursor-grabbing">
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
        )}

        {/* 展开/收起按钮 */}
        <button
          onClick={handleToggleExpand}
          className={clsx(
            'flex items-center justify-center w-4 h-4 mr-2 rounded hover:bg-gray-200',
            !hasChildren && 'invisible'
          )}
        >
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="w-3 h-3 text-gray-600" />
            ) : (
              <ChevronRight className="w-3 h-3 text-gray-600" />
            )
          )}
        </button>

        {/* 菜单图标 */}
        <div className="mr-3">
          {getMenuIcon()}
        </div>

        {/* 菜单信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span className={clsx(
              'font-medium truncate',
              menu.status === 1 ? 'text-gray-900' : 'text-gray-500'
            )}>
              {menu.name}
            </span>
            
            {menu.path && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {menu.path}
              </span>
            )}
            
            {menu.status === 0 && (
              <span className="text-xs text-red-500 bg-red-100 px-2 py-0.5 rounded">
                已禁用
              </span>
            )}
          </div>
          
          {menu.component && (
            <div className="text-xs text-gray-500 mt-1">
              组件: {menu.component}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        {showActions && (onAdd || onEdit || onDelete || onToggleStatus) && (
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100">
            {onAdd && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAdd(menu)
                }}
                className="p-1 text-green-600 hover:text-green-800 hover:bg-green-100 rounded"
                title="添加子菜单"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
            
            {onToggleStatus && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleStatus(menu)
                }}
                className={clsx(
                  'p-1 rounded',
                  menu.status === 1
                    ? 'text-orange-600 hover:text-orange-800 hover:bg-orange-100'
                    : 'text-green-600 hover:text-green-800 hover:bg-green-100'
                )}
                title={menu.status === 1 ? '禁用菜单' : '启用菜单'}
              >
                {menu.status === 1 ? (
                  <EyeOff className="w-3 h-3" />
                ) : (
                  <Eye className="w-3 h-3" />
                )}
              </button>
            )}
            
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(menu)
                }}
                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded"
                title="编辑菜单"
              >
                <Edit className="w-3 h-3" />
              </button>
            )}
            
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(menu)
                }}
                className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
                title="删除菜单"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 子菜单 */}
      {hasChildren && isExpanded && (
        <div className="ml-4">
          {menu.children.map((child) => (
            <MenuTreeNodeComponent
              key={child.id}
              menu={child}
              level={level + 1}
              expandedKeys={expandedKeys}
              selectedKey={selectedKey}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              onAdd={onAdd}
              onToggleStatus={onToggleStatus}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              draggable={draggable}
              showActions={showActions}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const MenuTree: React.FC<MenuTreeProps> = ({
  menus,
  onEdit,
  onDelete,
  onAdd,
  onToggleStatus,
  onMove,
  expandedKeys = new Set(),
  onExpandedKeysChange,
  selectedKey,
  onSelect,
  draggable = false,
  showActions = true,
  className
}) => {
  const [draggedMenu, setDraggedMenu] = useState<MenuTreeNode | null>(null)

  // 处理展开/收起
  const handleToggleExpand = useCallback((menuId: number) => {
    const newExpandedKeys = new Set(expandedKeys)
    if (newExpandedKeys.has(menuId)) {
      newExpandedKeys.delete(menuId)
    } else {
      newExpandedKeys.add(menuId)
    }
    onExpandedKeysChange?.(newExpandedKeys)
  }, [expandedKeys, onExpandedKeysChange])

  // 处理选择
  const handleSelect = useCallback((menu: MenuTreeNode) => {
    onSelect?.(menu)
  }, [onSelect])

  // 处理拖拽开始
  const handleDragStart = useCallback((menu: MenuTreeNode) => {
    setDraggedMenu(menu)
  }, [])

  // 处理拖拽悬停
  const handleDragOver = useCallback((e: React.DragEvent, menu: MenuTreeNode) => {
    if (!draggedMenu || draggedMenu.id === menu.id) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [draggedMenu])

  // 处理拖拽放置
  const handleDrop = useCallback((e: React.DragEvent, targetMenu: MenuTreeNode) => {
    if (!draggedMenu || !onMove || draggedMenu.id === targetMenu.id) return
    
    e.preventDefault()
    
    // 根据拖拽位置确定操作类型
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height
    
    let position: 'before' | 'after' | 'inside' = 'inside'
    if (y < height * 0.25) {
      position = 'before'
    } else if (y > height * 0.75) {
      position = 'after'
    } else if (targetMenu.children && targetMenu.children.length > 0) {
      position = 'inside'
    }
    
    onMove(draggedMenu, targetMenu, position)
    setDraggedMenu(null)
  }, [draggedMenu, onMove])

  // 递归渲染菜单树
  const renderMenuTree = (menuList: MenuTreeNode[], level = 0): React.ReactNode => {
    return menuList.map((menu) => (
      <MenuTreeNodeComponent
        key={menu.id}
        menu={menu}
        level={level}
        expandedKeys={expandedKeys}
        selectedKey={selectedKey}
        onToggleExpand={handleToggleExpand}
        onSelect={handleSelect}
        onEdit={onEdit}
        onDelete={onDelete}
        onAdd={onAdd}
        onToggleStatus={onToggleStatus}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        draggable={draggable}
        showActions={showActions}
      />
    ))
  }

  return (
    <div className={clsx('menu-tree', className)}>
      {menus && menus.length > 0 ? (
        renderMenuTree(menus)
      ) : (
        <div className="text-center py-8 text-gray-500">
          <MenuIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>暂无菜单数据</p>
          {onAdd && (
            <button
              onClick={() => onAdd()}
              className="mt-2 text-blue-600 hover:text-blue-800"
            >
              点击添加菜单
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default MenuTree