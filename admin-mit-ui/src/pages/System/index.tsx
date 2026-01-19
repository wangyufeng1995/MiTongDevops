/**
 * 系统设置主页面
 */
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { SystemSettings } from './SystemSettings'
import { SecuritySettings } from './SecuritySettings'
import { BackupSettings } from './BackupSettings'
import { NotificationCenter } from './NotificationCenter'

export const SystemMain: React.FC = () => {
  return (
    <Routes>
      <Route index element={<Navigate to="general" replace />} />
      <Route path="general" element={<SystemSettings />} />
      <Route path="security" element={<SecuritySettings />} />
      <Route path="backup" element={<BackupSettings />} />
      {/* 通知中心路由 */}
      <Route path="notification" element={<NotificationCenter />} />
      {/* 旧路由重定向 */}
      <Route path="notification-center" element={<Navigate to="/settings/notification" replace />} />
      <Route path="notifications" element={<Navigate to="/settings/notification" replace />} />
      <Route path="*" element={<Navigate to="general" replace />} />
    </Routes>
  )
}

export default SystemMain