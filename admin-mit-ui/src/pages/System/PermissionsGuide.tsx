/**
 * 权限说明页面
 */
import React from 'react'
import { RolePermissions } from '../../components/RolePermissions'

export const PermissionsGuide: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">权限说明</h1>
        <p className="mt-1 text-sm text-gray-600">
          了解系统中各个角色的权限配置和功能说明
        </p>
      </div>

      {/* 权限介绍组件 */}
      <RolePermissions />
    </div>
  )
}

export default PermissionsGuide