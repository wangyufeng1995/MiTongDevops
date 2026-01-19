/**
 * 动态路由生成工具
 * 根据菜单数据生成前端路由配置
 */
import { MenuTreeNode } from '../services/menus'

export interface RouteConfig {
  path: string
  component: string
  name: string
  meta?: {
    title: string
    icon?: string
    requiresAuth?: boolean
    permissions?: string[]
  }
  children?: RouteConfig[]
}

/**
 * 将菜单树转换为路由配置
 */
export const generateRoutesFromMenus = (menus: MenuTreeNode[]): RouteConfig[] => {
  const routes: RouteConfig[] = []

  const processMenu = (menu: MenuTreeNode): RouteConfig | null => {
    // 只处理启用的菜单
    if (menu.status !== 1) return null

    // 只有有路径的菜单才生成路由
    if (!menu.path) return null

    const route: RouteConfig = {
      path: menu.path,
      component: menu.component || 'DefaultComponent',
      name: menu.name,
      meta: {
        title: menu.name,
        icon: menu.icon,
        requiresAuth: true
      }
    }

    // 处理子菜单
    if (menu.children && menu.children.length > 0) {
      const childRoutes = menu.children
        .map(processMenu)
        .filter((route): route is RouteConfig => route !== null)
      
      if (childRoutes.length > 0) {
        route.children = childRoutes
      }
    }

    return route
  }

  menus.forEach(menu => {
    const route = processMenu(menu)
    if (route) {
      routes.push(route)
    }
  })

  return routes
}

/**
 * 生成面包屑导航数据
 */
export const generateBreadcrumbsFromMenus = (
  menus: MenuTreeNode[], 
  currentPath: string
): Array<{ title: string; path?: string; icon?: string }> => {
  const breadcrumbs: Array<{ title: string; path?: string; icon?: string }> = []

  const findMenuPath = (menuList: MenuTreeNode[], targetPath: string, path: MenuTreeNode[] = []): MenuTreeNode[] | null => {
    for (const menu of menuList) {
      const currentPath = [...path, menu]
      
      if (menu.path === targetPath) {
        return currentPath
      }
      
      if (menu.children && menu.children.length > 0) {
        const result = findMenuPath(menu.children, targetPath, currentPath)
        if (result) return result
      }
    }
    return null
  }

  const menuPath = findMenuPath(menus, currentPath)
  if (menuPath) {
    menuPath.forEach((menu, index) => {
      const isLast = index === menuPath.length - 1
      breadcrumbs.push({
        title: menu.name,
        path: isLast ? undefined : menu.path,
        icon: menu.icon
      })
    })
  }

  return breadcrumbs
}

/**
 * 生成侧边栏菜单数据
 */
export const generateSidebarMenusFromMenus = (menus: MenuTreeNode[]): MenuTreeNode[] => {
  const filterEnabledMenus = (menuList: MenuTreeNode[]): MenuTreeNode[] => {
    return menuList
      .filter(menu => menu.status === 1) // 只显示启用的菜单
      .map(menu => ({
        ...menu,
        children: menu.children ? filterEnabledMenus(menu.children) : []
      }))
      .sort((a, b) => a.sort_order - b.sort_order) // 按排序值排序
  }

  return filterEnabledMenus(menus)
}

/**
 * 检查用户是否有菜单访问权限
 */
export const checkMenuPermission = (
  menu: MenuTreeNode, 
  _userPermissions: string[]
): boolean => {
  // 如果菜单没有设置权限要求，默认允许访问
  if (!menu.path) return true

  // 这里可以根据实际需求实现权限检查逻辑
  // 例如：检查用户是否有对应的路由访问权限
  // const hasPermission = userPermissions.some(p => menu.path?.includes(p))
  
  return true
}

/**
 * 根据用户权限过滤菜单
 */
export const filterMenusByPermissions = (
  menus: MenuTreeNode[], 
  userPermissions: string[]
): MenuTreeNode[] => {
  const filterMenus = (menuList: MenuTreeNode[]): MenuTreeNode[] => {
    return menuList
      .filter(menu => checkMenuPermission(menu, userPermissions))
      .map(menu => ({
        ...menu,
        children: menu.children ? filterMenus(menu.children) : []
      }))
  }

  return filterMenus(menus)
}

/**
 * 获取菜单的完整路径（包含父级路径）
 */
export const getMenuFullPath = (
  menus: MenuTreeNode[], 
  menuId: number
): string | null => {
  const findMenu = (menuList: MenuTreeNode[], targetId: number, parentPath = ''): string | null => {
    for (const menu of menuList) {
      const currentPath = parentPath + (menu.path || '')
      
      if (menu.id === targetId) {
        return currentPath
      }
      
      if (menu.children && menu.children.length > 0) {
        const result = findMenu(menu.children, targetId, currentPath)
        if (result) return result
      }
    }
    return null
  }

  return findMenu(menus, menuId)
}

/**
 * 扁平化菜单树
 */
export const flattenMenuTree = (menus: MenuTreeNode[]): MenuTreeNode[] => {
  const flattened: MenuTreeNode[] = []

  const flatten = (menuList: MenuTreeNode[]) => {
    menuList.forEach(menu => {
      flattened.push(menu)
      if (menu.children && menu.children.length > 0) {
        flatten(menu.children)
      }
    })
  }

  flatten(menus)
  return flattened
}

/**
 * 构建菜单树（从扁平数据）
 */
export const buildMenuTree = (flatMenus: MenuTreeNode[]): MenuTreeNode[] => {
  const menuMap = new Map<number, MenuTreeNode>()
  const rootMenus: MenuTreeNode[] = []

  // 创建菜单映射
  flatMenus.forEach(menu => {
    menuMap.set(menu.id, { ...menu, children: [] })
  })

  // 构建树形结构
  flatMenus.forEach(menu => {
    const menuNode = menuMap.get(menu.id)!
    
    if (menu.parent_id && menuMap.has(menu.parent_id)) {
      const parent = menuMap.get(menu.parent_id)!
      parent.children.push(menuNode)
    } else {
      rootMenus.push(menuNode)
    }
  })

  // 按排序值排序
  const sortMenus = (menus: MenuTreeNode[]) => {
    menus.sort((a, b) => a.sort_order - b.sort_order)
    menus.forEach(menu => {
      if (menu.children.length > 0) {
        sortMenus(menu.children)
      }
    })
  }

  sortMenus(rootMenus)
  return rootMenus
}

/**
 * 验证菜单路径的唯一性
 */
export const validateMenuPathUniqueness = (
  menus: MenuTreeNode[], 
  path: string, 
  excludeId?: number
): boolean => {
  const flatMenus = flattenMenuTree(menus)
  
  return !flatMenus.some(menu => 
    menu.path === path && 
    menu.id !== excludeId
  )
}

/**
 * 获取菜单的层级深度
 */
export const getMenuDepth = (menus: MenuTreeNode[], menuId: number): number => {
  const findDepth = (menuList: MenuTreeNode[], targetId: number, depth = 0): number => {
    for (const menu of menuList) {
      if (menu.id === targetId) {
        return depth
      }
      
      if (menu.children && menu.children.length > 0) {
        const result = findDepth(menu.children, targetId, depth + 1)
        if (result !== -1) return result
      }
    }
    return -1
  }

  return findDepth(menus, menuId)
}

/**
 * 检查菜单是否可以移动到指定位置
 */
export const canMoveMenu = (
  menus: MenuTreeNode[], 
  sourceId: number, 
  targetId: number
): boolean => {
  // 不能移动到自己
  if (sourceId === targetId) return false

  // 不能移动到自己的子菜单下
  const sourceMenu = flattenMenuTree(menus).find(m => m.id === sourceId)
  if (!sourceMenu) return false

  const isDescendant = (menu: MenuTreeNode, ancestorId: number): boolean => {
    if (menu.id === ancestorId) return true
    return menu.children.some(child => isDescendant(child, ancestorId))
  }

  return !isDescendant(sourceMenu, targetId)
}