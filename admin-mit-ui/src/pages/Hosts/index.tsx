/**
 * 主机管理页面
 */
import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { HostList } from './HostList'
import { HostForm } from './HostForm'
import { HostDetail } from './HostDetail'
import { HostGroupList } from './HostGroupList'
import { HostGroupFormPage } from './HostGroupFormPage'
import WebShell from './WebShell'
import { HostAudit } from './HostAudit'
import { CommandFilterConfig } from './CommandFilterConfig'
import { GlobalCommandFilter } from './GlobalCommandFilter'

export const HostsPage: React.FC = () => {
  return (
    <Routes>
        {/* 主机列表 */}
        <Route index element={<HostList />} />
        
        {/* 主机创建/编辑 */}
        <Route path="new" element={<HostForm />} />
        <Route path=":id/edit" element={<HostForm />} />
        
        {/* 主机详情 */}
        <Route path=":id" element={<HostDetail />} />
        
        {/* WebShell */}
        <Route path=":id/webshell" element={<WebShell />} />
        
        {/* 主机审计 */}
        <Route path=":hostId/audit" element={<HostAudit />} />
        
        {/* 命令过滤配置 - 主机级别 */}
        <Route path=":hostId/command-filter" element={<CommandFilterConfig />} />
        
        {/* 全局命令过滤配置 */}
        <Route path="command-filter" element={<GlobalCommandFilter />} />
        
        {/* 主机分组管理 */}
        <Route path="groups" element={<HostGroupList />} />
        <Route path="groups/new" element={<HostGroupFormPage />} />
        <Route path="groups/:id/edit" element={<HostGroupFormPage />} />
      </Routes>
  )
}