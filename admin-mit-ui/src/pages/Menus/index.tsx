/**
 * 菜单管理页面路由
 * 只读模式 - 移除编辑功能
 */
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { MenuList } from './MenuList'

export const MenusPage: React.FC = () => {
  return (
    <Routes>
      <Route index element={<MenuList />} />
      <Route path="*" element={<Navigate to="/menus" replace />} />
    </Routes>
  )
}

export default MenusPage