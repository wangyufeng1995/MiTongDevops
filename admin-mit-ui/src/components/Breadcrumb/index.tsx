import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { useAppStore, BreadcrumbItem } from '../../store/app'

interface BreadcrumbProps {
  items?: BreadcrumbItem[]
  className?: string
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ 
  items: propItems, 
  className = '' 
}) => {
  const { breadcrumbs } = useAppStore()
  const location = useLocation()
  
  // 使用传入的 items 或者从 store 中获取
  const items = propItems || breadcrumbs
  
  // 如果没有面包屑项目，根据当前路径生成默认面包屑
  const defaultItems = React.useMemo(() => {
    if (items.length > 0) return items
    
    const pathSegments = location.pathname.split('/').filter(Boolean)
    const breadcrumbItems: BreadcrumbItem[] = []
    
    // 添加首页
    breadcrumbItems.push({ title: '首页', path: '/dashboard', icon: 'home' })
    
    // 根据路径段生成面包屑
    let currentPath = ''
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`
      
      // 跳过 dashboard，因为已经作为首页添加了
      if (segment === 'dashboard') return
      
      // 简单的路径到标题映射
      const titleMap: Record<string, string> = {
        // 基础管理
        users: '用户管理',
        roles: '角色管理',
        menus: '菜单管理',
        logs: '操作日志',
        
        // 主机运维
        devops: '主机运维',
        hosts: '主机列表',
        webshell: 'Web 终端',
        ansible: 'Ansible 管理',
        playbooks: 'Playbook 管理',
        executions: '执行历史',
        
        // 监控告警
        monitor: '监控告警',
        alerts: '告警记录',
        channels: '告警渠道',
        rules: '告警规则',
        history: '告警历史',
        statistics: '告警统计',
        
        // 网络运维
        network: '网络运维',
        probes: '探测管理',
        visualizer: '数据可视化',
        builder: '配置构建器',
        analytics: '深度分析',
        groups: '探测分组',
        
        // 系统设置
        settings: '系统设置',
        general: '基本设置',
        security: '安全设置',
        backup: '备份恢复',
        notification: '通知设置',
        
        // 权限说明
        'permissions-guide': '权限说明',
        
        // 通用操作
        list: '列表',
        new: '新建',
        edit: '编辑',
        execute: '执行',
        detail: '详情',
        create: '创建',
      }
      
      // 上下文相关的标题映射
      const contextualTitleMap: Record<string, Record<string, string>> = {
        'devops/hosts': {
          'groups': '主机分组',
          'new': '新建主机',
        },
        'devops': {
          'hosts': '主机列表',
        },
      }
      
      // 构建当前路径上下文
      const contextPath = pathSegments.slice(0, index).join('/')
      
      // 检查是否是数字ID，如果是则显示为"主机详情"
      const isNumericId = /^\d+$/.test(segment)
      
      // 优先使用上下文相关的标题映射
      let title: string
      if (isNumericId) {
        // 根据上下文确定详情页面的标题
        if (contextPath === 'devops/hosts') {
          title = '主机详情'
        } else {
          title = '详情'
        }
      } else if (contextualTitleMap[contextPath]?.[segment]) {
        title = contextualTitleMap[contextPath][segment]
      } else {
        title = titleMap[segment] || segment
      }
      
      breadcrumbItems.push({
        title,
        path: index === pathSegments.length - 1 ? undefined : currentPath
      })
    })
    
    return breadcrumbItems
  }, [items, location.pathname])

  if (defaultItems.length <= 1) {
    return null
  }

  return (
    <nav className={`flex ${className}`} aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        {defaultItems.map((item, index) => (
          <li key={index} className="inline-flex items-center">
            {index > 0 && (
              <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />
            )}
            
            <div className="flex items-center">
              {item.icon === 'home' && (
                <Home className="w-4 h-4 mr-1 text-gray-400" />
              )}
              
              {item.path ? (
                <Link
                  to={item.path}
                  className="text-sm font-medium text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white transition-colors"
                >
                  {item.title}
                </Link>
              ) : (
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {item.title}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  )
}

export default Breadcrumb