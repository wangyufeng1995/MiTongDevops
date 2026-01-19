import { Routes, Route, Navigate } from 'react-router-dom'
import { ChannelList } from './ChannelList'
import { ChannelForm } from './ChannelForm'

/**
 * 告警渠道管理页面
 */
export const ChannelsPage: React.FC = () => {
  return (
    <Routes>
      <Route index element={<Navigate to="list" replace />} />
      <Route path="list" element={<ChannelList />} />
      <Route path="create" element={<ChannelForm />} />
      <Route path="edit/:id" element={<ChannelForm />} />
    </Routes>
  )
}