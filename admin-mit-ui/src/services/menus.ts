import { BaseApiService } from './base'
import { api } from './api'
import { ApiResponse } from '../types/api'

export interface Menu {
  id: number
  parent_id?: number
  name: string
  path?: string
  component?: string
  icon?: string
  sort_order: number
  status: number
  children?: Menu[]
  created_at: string
  updated_at: string
}

export interface CreateMenuRequest {
  parent_id?: number
  name: string
  path?: string
  component?: string
  icon?: string
  sort_order?: number
  status?: number
}

export interface UpdateMenuRequest {
  parent_id?: number
  name?: string
  path?: string
  component?: string
  icon?: string
  sort_order?: number
  status?: number
}

export interface MenuTreeNode extends Menu {
  children: MenuTreeNode[]
}

export class MenuService extends BaseApiService<Menu, CreateMenuRequest, UpdateMenuRequest> {
  constructor() {
    super('/api/menus')
  }

  /**
   * 获取菜单树结构
   */
  async getMenuTree(): Promise<ApiResponse<MenuTreeNode[]>> {
    return api.get<MenuTreeNode[]>(`${this.baseUrl}/tree`)
  }

  /**
   * 获取用户可访问的菜单
   */
  async getUserMenus(): Promise<ApiResponse<MenuTreeNode[]>> {
    return api.get<MenuTreeNode[]>(`${this.baseUrl}/user-menus`)
  }

  /**
   * 更新菜单排序
   */
  async updateMenuOrder(menuOrders: { id: number; sort_order: number; parent_id?: number }[]): Promise<ApiResponse<void>> {
    return api.post<void>(`${this.baseUrl}/update-order`, { menu_orders: menuOrders })
  }

  /**
   * 移动菜单到新的父级
   */
  async moveMenu(id: number, newParentId?: number, newSortOrder?: number): Promise<ApiResponse<Menu>> {
    return api.post<Menu>(`${this.baseUrl}/${id}/move`, {
      parent_id: newParentId,
      sort_order: newSortOrder
    })
  }

  /**
   * 获取菜单的子菜单数量
   */
  async getChildrenCount(id: number): Promise<ApiResponse<{ count: number }>> {
    return api.get<{ count: number }>(`${this.baseUrl}/${id}/children/count`)
  }

  /**
   * 检查菜单路径是否可用
   */
  async checkMenuPath(path: string, excludeId?: number): Promise<ApiResponse<{ available: boolean }>> {
    const params = new URLSearchParams({ path })
    if (excludeId) params.append('exclude_id', excludeId.toString())
    
    return api.get<{ available: boolean }>(`${this.baseUrl}/check-path?${params}`)
  }
}

export const menuService = new MenuService()