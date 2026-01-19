import { Routes, Route, Navigate } from 'react-router-dom'
import { RuleList } from './RuleList'
import { RuleForm } from './RuleForm'

/**
 * 告警规则管理页面
 */
export const RulesPage: React.FC = () => {
  return (
    <Routes>
      <Route index element={<Navigate to="list" replace />} />
      <Route path="list" element={<RuleList />} />
      <Route path="create" element={<RuleForm />} />
      <Route path="edit/:id" element={<RuleForm />} />
    </Routes>
  )
}