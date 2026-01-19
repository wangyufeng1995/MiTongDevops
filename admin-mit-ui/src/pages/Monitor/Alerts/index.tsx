import { Routes, Route, Navigate } from 'react-router-dom'
import { AlertList } from './AlertList'
import { AlertDetail } from './AlertDetail'
import { AlertStatistics } from './AlertStatistics'

/**
 * 告警管理页面
 */
export const AlertsPage: React.FC = () => {
  return (
    <Routes>
      <Route index element={<Navigate to="list" replace />} />
      <Route path="list" element={<AlertList />} />
      <Route path="statistics" element={<AlertStatistics />} />
      <Route path="detail/:id" element={<AlertDetail />} />
    </Routes>
  )
}