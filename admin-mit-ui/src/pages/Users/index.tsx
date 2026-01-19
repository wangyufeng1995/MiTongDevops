/**
 * 用户管理主页面
 */
import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { UserList } from './UserList'
import { UserForm } from './UserForm'

export const UsersPage: React.FC = () => {
  return (
    <Routes>
      <Route index element={<UserList />} />
      <Route path="new" element={<UserForm />} />
      <Route path="edit/:id" element={<UserForm />} />
    </Routes>
  )
}

export default UsersPage