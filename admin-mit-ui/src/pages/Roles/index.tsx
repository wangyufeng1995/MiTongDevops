/**
 * 角色管理主页面
 */
import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { RoleList } from './RoleList'
import { RoleForm } from './RoleForm'

export const RolesPage: React.FC = () => {
  return (
    <Routes>
      <Route index element={<RoleList />} />
      <Route path="new" element={<RoleForm />} />
      <Route path="edit/:id" element={<RoleForm />} />
    </Routes>
  )
}

export default RolesPage