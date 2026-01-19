import { Routes, Route, Navigate } from 'react-router-dom'
import { ChannelsPage } from './Channels'
import { RulesPage } from './Rules'
import { DashboardPage } from './Dashboard'
import { HistoryPage } from './History'
import { AlertsPage } from './Alerts'
import { DatasourcePage } from './Datasource'
import { GrafanaPage } from './Grafana'

/**
 * 监控告警主页面
 */
export const MonitorMain: React.FC = () => {
  return (
    <Routes>
      <Route index element={<Navigate to="alerts" replace />} />
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="alerts/*" element={<AlertsPage />} />
      <Route path="channels/*" element={<ChannelsPage />} />
      <Route path="rules/*" element={<RulesPage />} />
      <Route path="history/*" element={<HistoryPage />} />
      <Route path="datasource" element={<DatasourcePage />} />
      <Route path="grafana" element={<GrafanaPage />} />
    </Routes>
  )
}

export { MonitorMain as MonitorPage }