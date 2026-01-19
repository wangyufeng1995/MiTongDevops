import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { useAuthStore } from '../store/auth'
import { useAppStore } from '../store/app'
import { Loading } from '../components/Loading'

// Eager load critical components
import { LoginPage } from '../pages/Login'
import { DashboardLayout } from '../layouts/DashboardLayout'
import { DashboardPage } from '../pages/Dashboard'

// Lazy load non-critical pages for code splitting
const UsersPage = lazy(() => import('../pages/Users').then(m => ({ default: m.UsersPage })))
const RolesPage = lazy(() => import('../pages/Roles').then(m => ({ default: m.RolesPage })))
const MenusPage = lazy(() => import('../pages/Menus').then(m => ({ default: m.MenusPage })))
const AuditPage = lazy(() => import('../pages/Audit').then(m => ({ default: m.AuditPage })))
const HostsPage = lazy(() => import('../pages/Hosts').then(m => ({ default: m.HostsPage })))
const AnsibleMain = lazy(() => import('../pages/Ansible').then(m => ({ default: m.AnsibleMain })))
const MonitorMain = lazy(() => import('../pages/Monitor').then(m => ({ default: m.MonitorMain })))
const NetworkProbePage = lazy(() => import('../pages/Network').then(m => ({ default: m.NetworkProbePage })))
const NetworkDashboardPage = lazy(() => import('../pages/Network/Dashboard').then(m => ({ default: m.NetworkDashboard })))
const NetworkProbeEnhanced = lazy(() => import('../pages/Network/NetworkProbeEnhanced').then(m => ({ default: m.default })))
const NetworkProbeVisualizer = lazy(() => import('../pages/Network/NetworkProbeVisualizer').then(m => ({ default: m.default })))
const NetworkProbeBuilder = lazy(() => import('../pages/Network/NetworkProbeBuilder').then(m => ({ default: m.default })))
const NetworkProbeAnalytics = lazy(() => import('../pages/Network/NetworkProbeAnalytics').then(m => ({ default: m.default })))
const NetworkGroupsPage = lazy(() => import('../pages/Network/Groups').then(m => ({ default: m.NetworkGroupsPage })))
const SystemMain = lazy(() => import('../pages/System').then(m => ({ default: m.SystemMain })))
const RedisPage = lazy(() => import('../pages/Redis').then(m => ({ default: m.RedisPage })))
const DatabasePage = lazy(() => import('../pages/Database').then(m => ({ default: m.DatabasePage })))
const PermissionsGuide = lazy(() => import('../pages/System/PermissionsGuide').then(m => ({ default: m.PermissionsGuide })))

// 主机命令过滤配置页面
const GlobalCommandFilterPage = lazy(() => import('../pages/Hosts/GlobalCommandFilter').then(m => ({ default: m.GlobalCommandFilter })))

// K8S运维管理页面
const K8sClustersPage = lazy(() => import('../pages/K8s/Clusters').then(m => ({ default: m.default })))
const K8sNamespacesPage = lazy(() => import('../pages/K8s/Namespaces').then(m => ({ default: m.default })))
const K8sWorkloadsPage = lazy(() => import('../pages/K8s/Workloads').then(m => ({ default: m.default })))
const K8sServicesPage = lazy(() => import('../pages/K8s/Services').then(m => ({ default: m.default })))
const K8sConfigsPage = lazy(() => import('../pages/K8s/Configs').then(m => ({ default: m.default })))
const K8sStoragePage = lazy(() => import('../pages/K8s/Storage').then(m => ({ default: m.default })))

// 中间件管理占位页面
const NginxManagement = lazy(() => import('../pages/Middleware/NginxManagement'))
const RabbitMQManagement = lazy(() => import('../pages/Middleware/RabbitMQManagement'))
const KafkaManagement = lazy(() => import('../pages/Middleware/KafkaManagement'))

// AI运维页面
const AIOpsRoutes = lazy(() => import('../pages/AIOps').then(m => ({ default: m.AIOpsRoutes })))

interface ProtectedRouteProps {
  children: React.ReactNode
  permission?: string
  permissions?: string[]
  requireAll?: boolean
  adminOnly?: boolean
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  permission,
  permissions = [],
  requireAll = false,
  adminOnly = false
}) => {
  const { isAuthenticated, hasPermission, hasAnyPermission, hasAllPermissions, isAdmin } = useAuthStore()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // 检查管理员权限
  if (adminOnly && !isAdmin()) {
    return <Navigate to="/dashboard" replace />
  }

  // 检查单个权限
  if (permission && !hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />
  }

  // 检查多个权限
  if (permissions.length > 0) {
    const hasRequiredPermissions = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions)
    
    if (!hasRequiredPermissions) {
      return <Navigate to="/dashboard" replace />
    }
  }
  
  return <>{children}</>
}

/**
 * 面包屑更新 Hook
 */
const useBreadcrumbUpdater = () => {
  const location = useLocation()
  const { setBreadcrumbs } = useAppStore()

  useEffect(() => {
    // 根据当前路径更新面包屑
    const pathSegments = location.pathname.split('/').filter(Boolean)
    
    // 路径到面包屑的映射
    const breadcrumbMap: Record<string, { title: string; icon?: string }> = {
      // 首页
      dashboard: { title: '仪表盘', icon: 'home' },
      
      // 基础管理
      users: { title: '用户管理' },
      roles: { title: '角色管理' },
      menus: { title: '菜单管理' },
      
      // 运维审计
      audit: { title: '运维审计' },
      operations: { title: '操作日志' },
      hosts: { title: '主机审计' },
      
      // AI运维
      'ai-ops': { title: 'AI运维' },
      assistant: { title: 'AI助手' },
      analysis: { title: '智能分析' },
      'model-config': { title: 'AI模型配置' },
      
      // 主机运维
      hostoperate: { title: '主机运维' },
      hosts: { title: '主机列表' },
      'host-groups': { title: '主机分组' },
      webshell: { title: 'Web 终端' },
      ansible: { title: 'Ansible 管理' },
      playbooks: { title: 'Playbook 管理' },
      executions: { title: '执行历史' },
      audit: { title: '审计日志' },
      'command-filter': { title: '命令过滤配置' },
      
      // 监控告警
      monitor: { title: '监控告警' },
      alerts: { title: '告警记录' },
      channels: { title: '告警渠道' },
      rules: { title: '告警规则' },
      history: { title: '告警历史' },
      statistics: { title: '告警统计' },
      datasource: { title: '云监控数据源' },
      grafana: { title: 'Grafana 仪表盘' },
      
      // 网络运维
      network: { title: '网络运维' },
      probes: { title: '探测管理' },
      visualizer: { title: '数据可视化' },
      builder: { title: '配置构建器' },
      analytics: { title: '深度分析' },
      groups: { title: '探测分组' },
      
      // Redis 管理
      'redis-manager': { title: 'Redis 管理' },
      'middleware/redis-manager': { title: 'Redis 管理' },
      redis: { title: 'Redis 管理' },
      connections: { title: '连接管理' },
      keys: { title: '键浏览器' },
      server: { title: '服务器信息' },
      cluster: { title: '集群信息' },
      
      // 数据库管理
      'database-manager': { title: '数据库管理' },
      'middleware/database-manager': { title: '数据库管理' },
      database: { title: '数据库管理' },
      
      // K8S运维管理
      k8s: { title: 'K8S运维' },
      'k8s-manager': { title: 'K8S运维' },
      'middleware/k8s-manager': { title: 'K8S运维' },
      clusters: { title: '集群管理' },
      namespaces: { title: '命名空间' },
      workloads: { title: '工作负载' },
      deployments: { title: 'Deployments' },
      statefulsets: { title: 'StatefulSets' },
      daemonsets: { title: 'DaemonSets' },
      services: { title: '服务发现' },
      ingresses: { title: 'Ingresses' },
      configs: { title: '配置管理' },
      configmaps: { title: 'ConfigMaps' },
      secrets: { title: 'Secrets' },
      storage: { title: '存储管理' },
      'persistent-volumes': { title: '持久卷' },
      'persistent-volume-claims': { title: '持久卷声明' },
      'storage-classes': { title: '存储类' },
      
      // 系统设置
      settings: { title: '系统设置' },
      general: { title: '基本设置' },
      security: { title: '安全设置' },
      backup: { title: '备份恢复' },
      notification: { title: '通知设置' },
      
      // 权限说明
      'permissions-guide': { title: '权限说明' },
      
      // 通用操作
      list: { title: '列表' },
      new: { title: '新建' },
      edit: { title: '编辑' },
      execute: { title: '执行' },
      detail: { title: '详情' },
      create: { title: '创建' },
    }

    // 特殊路径映射：处理上下文相关的面包屑标题
    // 例如 /hostoperate/hosts/groups 中的 groups 应该显示为 "主机分组"
    const contextualTitleMap: Record<string, Record<string, string>> = {
      'hostoperate/hosts': {
        'groups': '主机分组',
        'new': '新建主机',
        'audit': '审计日志',
        'command-filter': '命令过滤配置',
      },
      'hostoperate/hosts/groups': {
        'new': '创建分组',
      },
      'hostoperate': {
        'hosts': '主机列表',
      },
      'monitor': {
        'datasource': '云监控数据源',
        'grafana': 'Grafana 仪表盘',
        'alerts': '告警记录',
        'channels': '告警渠道',
        'rules': '告警规则',
        'history': '告警历史',
        'dashboard': '监控大屏',
      },
      'middleware/k8s-manager': {
        'clusters': '集群管理',
        'namespaces': '命名空间',
        'workloads': '工作负载',
        'services': '服务发现',
        'configs': '配置管理',
        'storage': '存储管理',
      },
      'middleware/k8s-manager/clusters': {
        'new': '新建集群',
        'edit': '编辑集群',
      },
      'middleware/k8s-manager/namespaces': {
        'new': '创建命名空间',
      },
      'middleware/k8s-manager/workloads': {
        'deployments': 'Deployments',
        'statefulsets': 'StatefulSets',
        'daemonsets': 'DaemonSets',
      },
      'middleware/k8s-manager/configs': {
        'configmaps': 'ConfigMaps',
        'secrets': 'Secrets',
      },
    }

    const breadcrumbs = pathSegments.map((segment, index) => {
      // 检查是否是数字ID，如果是则显示为"详情"
      const isNumericId = /^\d+$/.test(segment)
      
      // 构建当前路径上下文
      const contextPath = pathSegments.slice(0, index).join('/')
      
      // 优先使用上下文相关的标题映射
      let config: { title: string; icon?: string }
      if (isNumericId) {
        // 根据上下文确定详情页面的标题
        if (contextPath === 'hostoperate/hosts') {
          config = { title: '主机详情' }
        } else if (contextPath === 'hostoperate/hosts/groups') {
          config = { title: '编辑分组' }
        } else {
          config = { title: '详情' }
        }
      } else if (contextualTitleMap[contextPath]?.[segment]) {
        config = { title: contextualTitleMap[contextPath][segment] }
      } else {
        config = breadcrumbMap[segment] || { title: segment }
      }
      
      const isLast = index === pathSegments.length - 1
      
      return {
        title: config.title,
        path: isLast ? undefined : `/${pathSegments.slice(0, index + 1).join('/')}`,
        icon: config.icon
      }
    })

    setBreadcrumbs(breadcrumbs)
  }, [location.pathname, setBreadcrumbs]) // 添加 setBreadcrumbs 到依赖数组
}

export const AppRouter: React.FC = () => {
  const { isAuthenticated } = useAuthStore()
  
  // 更新面包屑
  useBreadcrumbUpdater()

  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
        } 
      />
      
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        
        {/* 仪表盘 */}
        <Route path="dashboard" element={<DashboardPage />} />
        
        {/* 用户管理 - 需要用户管理权限 */}
        <Route 
          path="users/*" 
          element={
            <ProtectedRoute permission="user:read">
              <Suspense fallback={<Loading />}>
                <UsersPage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 角色管理 - 需要角色管理权限 */}
        <Route 
          path="roles/*" 
          element={
            <ProtectedRoute permission="role:read">
              <Suspense fallback={<Loading />}>
                <RolesPage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 菜单管理 - 需要菜单管理权限 */}
        <Route 
          path="menus/*" 
          element={
            <ProtectedRoute permission="menu:read">
              <Suspense fallback={<Loading />}>
                <MenusPage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 运维审计 - 需要日志查看权限 */}
        <Route 
          path="audit/*" 
          element={
            <ProtectedRoute permission="log:read">
              <Suspense fallback={<Loading />}>
                <AuditPage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 操作日志旧路径兼容 - 重定向到运维审计 */}
        <Route 
          path="logs/*" 
          element={<Navigate to="/audit/operations" replace />}
        />
        
        {/* AI运维 - 所有登录用户都可以访问 */}
        <Route 
          path="ai-ops/*" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<Loading />}>
                <AIOpsRoutes />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 权限说明 - 所有登录用户都可以查看 */}
        <Route 
          path="permissions-guide" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<Loading />}>
                <PermissionsGuide />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 主机运维 */}
        {/* SSH 主机 - 需要主机管理权限 */}
        <Route 
          path="hostoperate/hosts/*" 
          element={
            <ProtectedRoute permission="host:read">
              <Suspense fallback={<Loading />}>
                <HostsPage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* Ansible 管理 - 需要 Ansible 权限 */}
        <Route 
          path="hostoperate/ansible/*" 
          element={
            <ProtectedRoute permission="ansible:read">
              <Suspense fallback={<Loading />}>
                <AnsibleMain />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 主机审计 - 重定向到运维审计模块 */}
        <Route 
          path="hostoperate/audit" 
          element={<Navigate to="/audit/hosts" replace />}
        />
        
        {/* 命令过滤配置 - 全局配置，需要审计配置权限 */}
        <Route 
          path="hostoperate/command-filter" 
          element={
            <ProtectedRoute permissions={['host:audit:config', 'host:read']}>
              <Suspense fallback={<Loading />}>
                <GlobalCommandFilterPage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 主机管理 - 兼容旧路径，重定向到新路径 */}
        <Route 
          path="hosts/*" 
          element={<Navigate to="/hostoperate/hosts" replace />}
        />
        
        {/* Ansible 管理 - 兼容旧路径，重定向到新路径 */}
        <Route 
          path="ansible/*" 
          element={<Navigate to="/hostoperate/ansible" replace />}
        />
        
        {/* devops 旧路径兼容 */}
        <Route 
          path="devops/*" 
          element={<Navigate to="/hostoperate/hosts" replace />}
        />
        
        {/* 监控告警 - 统一路由入口 */}
        <Route 
          path="monitor/*" 
          element={
            <ProtectedRoute permission="monitor:read">
              <Suspense fallback={<Loading />}>
                <MonitorMain />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 网络运维 */}
        {/* 网络探测主页面 - 需要网络探测权限 */}
        <Route 
          path="network" 
          element={
            <ProtectedRoute permission="network:read">
              <Suspense fallback={<Loading />}>
                <NetworkProbePage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 探测大屏 */}
        <Route 
          path="network/dashboard" 
          element={
            <ProtectedRoute permission="network:read">
              <Suspense fallback={<Loading />}>
                <NetworkDashboardPage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 探测管理 */}
        <Route 
          path="network/probes" 
          element={
            <ProtectedRoute permission="network:read">
              <Suspense fallback={<Loading />}>
                <NetworkProbeEnhanced />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 数据可视化 */}
        <Route 
          path="network/visualizer" 
          element={
            <ProtectedRoute permission="network:read">
              <Suspense fallback={<Loading />}>
                <NetworkProbeVisualizer />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 配置构建器 */}
        <Route 
          path="network/builder" 
          element={
            <ProtectedRoute permission="network:read">
              <Suspense fallback={<Loading />}>
                <NetworkProbeBuilder />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 深度分析 */}
        <Route 
          path="network/analytics" 
          element={
            <ProtectedRoute permission="network:read">
              <Suspense fallback={<Loading />}>
                <NetworkProbeAnalytics />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 探测分组 */}
        <Route 
          path="network/groups" 
          element={
            <ProtectedRoute permission="network:read">
              <Suspense fallback={<Loading />}>
                <NetworkGroupsPage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 网络探测通配路由 - 兼容旧路径 */}
        <Route 
          path="network/*" 
          element={<Navigate to="/network" replace />}
        />
        
        {/* Redis 管理 - 所有登录用户可访问 */}
        <Route 
          path="middleware/redis-manager" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<Loading />}>
                <RedisPage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* Redis 旧路径兼容 */}
        <Route 
          path="redis-manager" 
          element={<Navigate to="/middleware/redis-manager" replace />}
        />
        <Route 
          path="redis" 
          element={<Navigate to="/middleware/redis-manager" replace />}
        />
        
        {/* 数据库管理 - 所有登录用户可访问 */}
        <Route 
          path="middleware/database-manager" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<Loading />}>
                <DatabasePage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 数据库管理旧路径兼容 */}
        <Route 
          path="database-manager" 
          element={<Navigate to="/middleware/database-manager" replace />}
        />
        <Route 
          path="database" 
          element={<Navigate to="/middleware/database-manager" replace />}
        />
        
        {/* K8S运维管理 */}
        {/* 集群管理 - 所有登录用户可访问 */}
        <Route 
          path="middleware/k8s-manager/clusters" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<Loading />}>
                <K8sClustersPage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 命名空间管理 - 所有登录用户可访问 */}
        <Route 
          path="middleware/k8s-manager/namespaces" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<Loading />}>
                <K8sNamespacesPage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 工作负载管理 - 所有登录用户可访问 */}
        <Route 
          path="middleware/k8s-manager/workloads" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<Loading />}>
                <K8sWorkloadsPage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 服务发现 - 所有登录用户可访问 */}
        <Route 
          path="middleware/k8s-manager/services" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<Loading />}>
                <K8sServicesPage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 配置管理 - 所有登录用户可访问 */}
        <Route 
          path="middleware/k8s-manager/configs" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<Loading />}>
                <K8sConfigsPage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 存储管理 - 所有登录用户可访问 */}
        <Route 
          path="middleware/k8s-manager/storage" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<Loading />}>
                <K8sStoragePage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* K8S旧路径兼容 */}
        <Route 
          path="k8s-manager/*" 
          element={<Navigate to="/middleware/k8s-manager/clusters" replace />}
        />
        <Route 
          path="k8s/*" 
          element={<Navigate to="/middleware/k8s-manager/clusters" replace />}
        />
        
        {/* Nginx管理 - 占位页 */}
        <Route 
          path="middleware/nginx" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<Loading />}>
                <NginxManagement />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* RabbitMQ管理 - 占位页 */}
        <Route 
          path="middleware/rabbitmq" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<Loading />}>
                <RabbitMQManagement />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* Kafka管理 - 占位页 */}
        <Route 
          path="middleware/kafka" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<Loading />}>
                <KafkaManagement />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        {/* 系统设置 - 需要系统设置权限或管理员 */}
        <Route 
          path="settings/*" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<Loading />}>
                <SystemMain />
              </Suspense>
            </ProtectedRoute>
          } 
        />
      </Route>
      
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}