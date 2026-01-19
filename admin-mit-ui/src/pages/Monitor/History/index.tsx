import { Routes, Route, Navigate } from 'react-router-dom'
import { AlertHistory } from './AlertHistory'
import { AlertStatistics } from './AlertStatistics'

/**
 * 告警历史页面
 */
export const HistoryPage: React.FC = () => {
  return (
    <Routes>
      <Route index element={<Navigate to="alerts" replace />} />
      <Route path="alerts" element={<AlertHistory />} />
      <Route path="statistics" element={<AlertStatistics />} />
    </Routes>
  )
}