/**
 * 运维审计页面路由
 */
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { OperationLogs } from './OperationLogs'
import { HostAudit } from './HostAudit'

export const AuditPage: React.FC = () => {
  return (
    <Routes>
      <Route index element={<Navigate to="operations" replace />} />
      <Route path="operations" element={<OperationLogs />} />
      <Route path="hosts" element={<HostAudit />} />
      <Route path="*" element={<Navigate to="operations" replace />} />
    </Routes>
  )
}

export default AuditPage
