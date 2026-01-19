import React, { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAppStore } from '../../store/app'
import { useAuthStore } from '../../store/auth'
import { menuService, MenuTreeNode } from '../../services/menus'
import { 
  LayoutDashboard, 
  Users, 
  Shield, 
  Menu as MenuIcon, 
  Settings,
  Server,
  Monitor,
  Network,
  FileText,
  ChevronLeft,
  ChevronRight,
  Play,
  Home,
  Folder,
  Globe,
  AlertTriangle,
  Terminal,
  Database,
  Activity,
  Bell,
  History,
  BarChart3,
  Radar,
  Filter,
  FileSearch,
  Layers,
  Box,
  HardDrive,
  MessageSquare,
  Container,
  // 新增图标
  UserCog,
  ShieldCheck,
  ListTree,
  ServerCog,
  FolderTree,
  ScrollText,
  Workflow,
  BellRing,
  ListChecks,
  ClipboardList,
  Gauge,
  ScanLine,
  LineChart,
  Wrench,
  TrendingUp,
  FolderKanban,
  DatabaseZap,
  TableProperties,
  CloudCog,
  Boxes,
  GitBranch,
  Cog,
  Archive,
  BellDot,
  Lock,
  KeyRound,
  Cpu,
  MemoryStick,
  Rabbit,
  Radio,
  // AI运维相关图标
  Brain,
  Sparkles,
  Zap
} from 'lucide-react'

// 美化的 Tooltip 组件
interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  disabled?: boolean
  position?: 'right' | 'top'
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, disabled = false, position = 'right' }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)

  const handleMouseEnter = () => {
    if (disabled) return
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      if (position === 'right') {
        setCoords({
          top: rect.top + rect.height / 2,
          left: rect.right + 8
        })
      } else {
        setCoords({
          top: rect.top - 8,
          left: rect.left + rect.width / 2
        })
      }
    }
    setIsVisible(true)
  }

  const handleMouseLeave = () => {
    setIsVisible(false)
  }

  return (
    <div 
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative"
    >
      {children}
      {isVisible && !disabled && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: position === 'right' ? coords.top : coords.top,
            left: coords.left,
            transform: position === 'right' ? 'translateY(-50%)' : 'translate(-50%, -100%)'
          }}
        >
          <div className="relative">
            {position === 'right' && (
              <div className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2">
                <div className="border-8 border-transparent border-r-gray-800" />
              </div>
            )}
            <div className="bg-gray-800 text-white text-sm px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
              {content}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 子菜单弹出框组件
interface SubMenuPopupProps {
  items: MenuItem[]
  parentName: string
  onClose: () => void
}

const SubMenuPopup: React.FC<SubMenuPopupProps> = ({ items, parentName, onClose }) => {
  const location = useLocation()
  
  return (
    <div 
      className="bg-white rounded-lg shadow-2xl border border-gray-200 py-2 min-w-[180px] overflow-hidden"
      onMouseLeave={onClose}
    >
      <div className="px-4 py-2 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
        <span className="text-sm font-semibold text-gray-700">{parentName}</span>
      </div>
      <div className="py-1">
        {items.map((child, index) => {
          const ChildIcon = child.icon
          // 精确匹配：只有完全相等或者是子路径才算激活
          // 排除同级菜单的误匹配（如 /hosts 不应该匹配 /hosts/groups）
          const isExactMatch = location.pathname === child.path
          const isChildPath = location.pathname.startsWith(child.path + '/')
          // 检查是否有其他同级菜单更精确匹配当前路径
          const hasMoreSpecificMatch = items.some(sibling => 
            sibling.path !== child.path && 
            sibling.path.startsWith(child.path + '/') &&
            (location.pathname === sibling.path || location.pathname.startsWith(sibling.path + '/'))
          )
          const isActive = (isExactMatch || isChildPath) && !hasMoreSpecificMatch
          return (
            <NavLink
              key={`${child.path}-${index}`}
              to={child.path}
              onClick={onClose}
              className={`flex items-center px-4 py-2.5 text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-blue-50 text-blue-600 border-l-3 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:pl-5'
              }`}
            >
              <ChildIcon className={`w-4 h-4 mr-3 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
              <span className="font-medium">{child.name}</span>
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}

// 图标映射 - 确保每个菜单使用唯一图标
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  // 顶级菜单图标
  'dashboard': LayoutDashboard,        // 仪表盘
  'user': Users,                       // 用户管理
  'team': ShieldCheck,                 // 角色管理
  'menu': ListTree,                    // 菜单管理
  'server': ServerCog,                 // 主机运维
  'alert': BellRing,                   // 监控告警
  'global': Globe,                     // 网络运维
  'layers': Layers,                    // 中间件运维
  'box': Box,                          // K8S运维
  'file-text': ScrollText,             // 操作日志
  'setting': Cog,                      // 系统设置
  'brain': Brain,                      // AI运维
  
  // 主机运维子菜单
  'desktop': Server,                   // SSH主机
  'folder': FolderTree,                // 主机分组
  'file-search': FileSearch,           // 文件搜索（主机审计使用）
  'filter': Filter,                    // 命令过滤
  'play-circle': Workflow,             // Ansible管理
  'code': Terminal,                    // Web终端
  
  // 运维审计子菜单
  'scroll-text': ScrollText,           // 操作日志
  
  // AI运维子菜单
  'sparkles': Sparkles,                // AI助手
  'zap': Zap,                          // 智能分析
  
  // 监控告警子菜单
  'monitor-dashboard': Gauge,          // 监控大屏
  'warning': AlertTriangle,            // 告警记录
  'notification': Bell,                // 告警渠道
  'rule': ListChecks,                  // 告警规则
  'history': ClipboardList,            // 告警历史
  
  // 网络运维子菜单
  'radar-chart': Radar,                // 探测大屏
  'activity': Activity,                // 探测管理
  'line-chart': LineChart,             // 数据可视化
  'builder': Wrench,                   // 配置构建器
  'analytics': TrendingUp,             // 深度分析
  'probe-group': FolderKanban,         // 探测分组
  
  // 中间件运维子菜单
  'redis': DatabaseZap,                // Redis管理
  'database': Database,                // 数据库管理
  'nginx': Globe,                      // Nginx管理 (使用Globe表示网络服务)
  'rabbitmq': Rabbit,                  // RabbitMQ管理
  'kafka': Radio,                      // Kafka管理
  
  // K8S运维子菜单
  'cluster': CloudCog,                 // 集群管理
  'namespace': Boxes,                  // 命名空间
  'workload': Cpu,                     // 工作负载
  'service': GitBranch,                // 服务发现
  'config': Settings,                  // 配置管理
  'storage': HardDrive,                // 存储管理
  
  // 系统设置子菜单
  'general': Settings,                 // 基本设置
  'security': Lock,                    // 安全设置
  'backup': Archive,                   // 备份恢复
  'notify-setting': BellDot,           // 通知设置
  
  // 兼容旧图标名称
  'home': Home,
  'shield': Shield,
  'hard-drive': HardDrive,
  'message-square': MessageSquare,
  'container': Container,
  
  // 后端图标名称映射（PascalCase）
  'FileSearch': FileSearch,
  'Filter': Filter,
  'Shield': Shield,
  'Server': Server,
  'Folder': FolderTree,
  'Play': Play,
  'Terminal': Terminal,
  'ScrollText': ScrollText,
  'Layers': Layers,
  'Box': Box,
  'Database': Database,
  'Globe': Globe,
  'MessageSquare': MessageSquare,
  'Activity': Activity,
  'Settings': Settings,
  'HardDrive': HardDrive,
  'LayoutDashboard': LayoutDashboard,
  'Monitor': Monitor,
  'Network': Network,
  'Bell': Bell,
  'History': ClipboardList,
  'BarChart3': BarChart3,
  'Radar': Radar,
  'Users': Users,
  'ShieldCheck': ShieldCheck,
  'ListTree': ListTree,
  'ServerCog': ServerCog,
  'FolderTree': FolderTree,
  'Workflow': Workflow,
  'BellRing': BellRing,
  'ListChecks': ListChecks,
  'ClipboardList': ClipboardList,
  'Gauge': Gauge,
  'AlertTriangle': AlertTriangle,
  'LineChart': LineChart,
  'Wrench': Wrench,
  'TrendingUp': TrendingUp,
  'FolderKanban': FolderKanban,
  'DatabaseZap': DatabaseZap,
  'CloudCog': CloudCog,
  'Boxes': Boxes,
  'GitBranch': GitBranch,
  'Cog': Cog,
  'Archive': Archive,
  'BellDot': BellDot,
  'Lock': Lock,
  'Cpu': Cpu,
  'Rabbit': Rabbit,
  'Radio': Radio,
  'Brain': Brain,
  'Sparkles': Sparkles,
  'Zap': Zap,
}

// 获取图标组件
const getIconComponent = (iconName?: string): React.ComponentType<{ className?: string }> => {
  if (!iconName) return MenuIcon
  return iconMap[iconName] || MenuIcon
}

interface MenuItem {
  name: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  permission?: string
  adminOnly?: boolean
  children?: MenuItem[]
}

// ============================================
// 固定菜单配置 - 这些菜单不会从后端加载
// ============================================
const FIXED_MENU_STRUCTURE = [
  {
    name: '仪表盘',
    path: '/dashboard',
    icon: 'dashboard',
    children: []
  },
  {
    name: '用户管理',
    path: '/users',
    icon: 'user',
    children: []
  },
  {
    name: '角色管理',
    path: '/roles',
    icon: 'team',
    children: []
  },
  {
    name: '菜单管理',
    path: '/menus',
    icon: 'menu',
    children: []
  }
]

// ============================================
// 动态菜单的路径前缀 - 这些菜单从后端加载
// 如果后端返回的菜单 path 以这些前缀开头，则使用后端数据
// ============================================
const DYNAMIC_MENU_PREFIXES = [
  '/hostoperate',  // 主机运维
  '/monitor',      // 监控告警
  '/network',      // 网络运维
  '/settings',     // 系统设置
  '/middleware',   // 中间件运维（包含 Redis、数据库、K8S）
  '/audit',        // 运维审计
  '/ai-ops',       // AI运维
]

// ============================================
// 后备菜单配置 - 当后端 API 失败时使用
// 注意：系统设置始终放在最后，操作日志放在倒数第二
// ============================================
const FALLBACK_DYNAMIC_MENUS = [
  {
    name: '主机运维',
    path: '/hostoperate',
    icon: 'server',
    children: [
      { name: 'SSH 主机', path: '/hostoperate/hosts', icon: 'desktop' },
      { name: '主机分组', path: '/hostoperate/hosts/groups', icon: 'folder' },
      { name: '命令过滤', path: '/hostoperate/command-filter', icon: 'filter' },
      { name: 'Ansible 管理', path: '/hostoperate/ansible', icon: 'play-circle' }
    ]
  },
  {
    name: '监控告警',
    path: '/monitor',
    icon: 'alert',
    children: [
      { name: '监控大屏', path: '/monitor/dashboard', icon: 'monitor-dashboard' },
      { name: '告警记录', path: '/monitor/alerts', icon: 'warning' },
      { name: '告警渠道', path: '/monitor/channels', icon: 'notification' },
      { name: '告警规则', path: '/monitor/rules', icon: 'rule' },
      { name: '告警历史', path: '/monitor/history', icon: 'history' }
    ]
  },
  {
    name: '网络运维',
    path: '/network',
    icon: 'global',
    children: [
      { name: '探测大屏', path: '/network/dashboard', icon: 'radar-chart' },
      { name: '探测管理', path: '/network/probes', icon: 'activity' },
      { name: '数据可视化', path: '/network/visualizer', icon: 'line-chart' },
      { name: '配置构建器', path: '/network/builder', icon: 'builder' },
      { name: '深度分析', path: '/network/analytics', icon: 'analytics' },
      { name: '探测分组', path: '/network/groups', icon: 'probe-group' }
    ]
  },
  {
    name: '中间件运维',
    path: '/middleware',
    icon: 'layers',
    children: [
      { name: 'Redis管理', path: '/middleware/redis-manager', icon: 'redis' },
      { name: '数据库管理', path: '/middleware/database-manager', icon: 'database' },
      { name: 'Nginx管理', path: '/middleware/nginx', icon: 'nginx' },
      { name: 'RabbitMQ管理', path: '/middleware/rabbitmq', icon: 'rabbitmq' },
      { name: 'Kafka管理', path: '/middleware/kafka', icon: 'kafka' }
    ]
  },
  {
    name: 'K8S运维',
    path: '/middleware/k8s-manager',
    icon: 'box',
    children: [
      { name: '集群管理', path: '/middleware/k8s-manager/clusters', icon: 'cluster' },
      { name: '命名空间', path: '/middleware/k8s-manager/namespaces', icon: 'namespace' },
      { name: '工作负载', path: '/middleware/k8s-manager/workloads', icon: 'workload' },
      { name: '服务发现', path: '/middleware/k8s-manager/services', icon: 'service' },
      { name: '配置管理', path: '/middleware/k8s-manager/configs', icon: 'config' },
      { name: '存储管理', path: '/middleware/k8s-manager/storage', icon: 'storage' }
    ]
  },
  {
    name: '运维审计',
    path: '/audit',
    icon: 'shield',
    children: [
      { name: '操作日志', path: '/audit/operations', icon: 'scroll-text' },
      { name: '主机审计', path: '/audit/hosts', icon: 'file-search' }
    ]
  },
  {
    name: 'AI运维',
    path: '/ai-ops',
    icon: 'brain',
    children: [
      { name: 'AI助手', path: '/ai-ops/assistant', icon: 'sparkles' },
      { name: '智能分析', path: '/ai-ops/analysis', icon: 'zap' },
      { name: 'AI模型配置', path: '/ai-ops/model-config', icon: 'settings' }
    ]
  },
  {
    name: '系统设置',
    path: '/settings',
    icon: 'setting',
    children: [
      { name: '基本设置', path: '/settings/general', icon: 'general' },
      { name: '安全设置', path: '/settings/security', icon: 'security' },
      { name: '备份恢复', path: '/settings/backup', icon: 'backup' },
      { name: '通知设置', path: '/settings/notification', icon: 'notify-setting' }
    ]
  }
]

// 菜单排序优先级（确保系统设置始终在最后）
const MENU_SORT_PRIORITY: Record<string, number> = {
  '/dashboard': 1,
  '/users': 2,
  '/roles': 3,
  '/menus': 4,
  '/hostoperate': 10,
  '/monitor': 20,
  '/network': 30,
  '/middleware': 40,
  '/middleware/k8s-manager': 50,
  '/audit': 900,
  '/ai-ops': 910,
  '/settings': 999,
}

// 对菜单进行排序，确保系统设置在最后
const sortMenus = (menus: MenuItem[]): MenuItem[] => {
  return [...menus].sort((a, b) => {
    const priorityA = MENU_SORT_PRIORITY[a.path] ?? 100
    const priorityB = MENU_SORT_PRIORITY[b.path] ?? 100
    return priorityA - priorityB
  })
}

// 将配置转换为组件菜单格式
const convertConfigToMenuItem = (config: any): MenuItem => {
  return {
    name: config.name,
    path: config.path,
    icon: getIconComponent(config.icon),
    permission: config.permission,
    adminOnly: config.adminOnly,
    children: config.children?.map(convertConfigToMenuItem) || []
  }
}

// 将后端菜单数据转换为组件菜单格式
const convertApiMenuToMenuItem = (menu: MenuTreeNode): MenuItem => {
  return {
    name: menu.name,
    path: menu.path || '',
    icon: getIconComponent(menu.icon),
    children: menu.children?.map(convertApiMenuToMenuItem) || []
  }
}

interface SidebarItemProps {
  item: MenuItem
  collapsed: boolean
  level?: number
}

const SidebarItem: React.FC<SidebarItemProps> = ({ item, collapsed, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 })
  const itemRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const Icon = item.icon
  const hasChildren = item.children && item.children.length > 0
  const paddingLeft = level * 12 + 12

  // 检查当前菜单项是否应该被激活
  // 需要排除有更精确匹配的情况（如 /hosts 不应该在访问 /hosts/groups 时激活）
  const checkIsActive = (path: string, siblings?: MenuItem[]): boolean => {
    const isExactMatch = location.pathname === path
    const isChildPath = location.pathname.startsWith(path + '/')
    
    if (isExactMatch) return true
    if (!isChildPath) return false
    
    // 如果有同级菜单更精确匹配当前路径，则不激活
    if (siblings) {
      const hasMoreSpecificMatch = siblings.some(sibling => 
        sibling.path !== path && 
        sibling.path.startsWith(path + '/') &&
        (location.pathname === sibling.path || location.pathname.startsWith(sibling.path + '/'))
      )
      if (hasMoreSpecificMatch) return false
    }
    
    return true
  }

  const isActiveParent = hasChildren && item.children!.some(
    child => location.pathname === child.path || location.pathname.startsWith(child.path + '/')
  )

  const toggleExpanded = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  const handleMouseEnter = () => {
    if (collapsed && hasChildren && itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect()
      setPopupPosition({
        top: rect.top,
        left: rect.right + 8
      })
      setShowPopup(true)
    }
  }

  const handleMouseLeave = () => {
    setShowPopup(false)
  }

  if (hasChildren && !collapsed) {
    return (
      <div>
        <div
          className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
            isActiveParent 
              ? 'bg-blue-50 text-blue-700' 
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
          style={{ paddingLeft: paddingLeft }}
          onClick={toggleExpanded}
        >
          <Icon className={`flex-shrink-0 w-5 h-5 mr-3 ${isActiveParent ? 'text-blue-600' : ''}`} />
          <span className="truncate flex-1">{item.name}</span>
          <ChevronRight 
            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          />
        </div>
        
        <div className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'max-h-96' : 'max-h-0'}`}>
          <div className="ml-4 mt-1 space-y-1">
            {item.children!.map((child, index) => (
              <SidebarItem
                key={`${child.path}-${index}`}
                item={child}
                collapsed={collapsed}
                level={level + 1}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (hasChildren && collapsed) {
    return (
      <div 
        ref={itemRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative"
      >
        <div
          className={`group flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
            isActiveParent 
              ? 'bg-blue-100 text-blue-700' 
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Icon className={`w-5 h-5 ${isActiveParent ? 'text-blue-600' : ''}`} />
        </div>
        
        {showPopup && (
          <div
            className="fixed z-[9999]"
            style={{ top: popupPosition.top, left: popupPosition.left }}
            onMouseEnter={() => setShowPopup(true)}
            onMouseLeave={() => setShowPopup(false)}
          >
            <SubMenuPopup 
              items={item.children!} 
              parentName={item.name}
              onClose={() => setShowPopup(false)}
            />
          </div>
        )}
      </div>
    )
  }

  if (collapsed) {
    return (
      <Tooltip content={item.name} disabled={!collapsed}>
        <NavLink
          to={item.path}
          className={
            `group flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              location.pathname === item.path
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`
          }
        >
          <Icon className="w-5 h-5" />
        </NavLink>
      </Tooltip>
    )
  }

  // 判断当前路径是否激活（精确匹配或子路径匹配）
  const isExactMatch = location.pathname === item.path
  const isChildPath = location.pathname.startsWith(item.path + '/')
  const isCurrentPathActive = isExactMatch || isChildPath

  return (
    <NavLink
      to={item.path}
      className={
        `group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          isCurrentPathActive
            ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-700'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`
      }
      style={{ paddingLeft: paddingLeft }}
    >
      <Icon className="flex-shrink-0 w-5 h-5 mr-3" />
      <span className="truncate flex-1">{item.name}</span>
    </NavLink>
  )
}

export const Sidebar: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar } = useAppStore()
  const { user, isAuthenticated } = useAuthStore()
  const [dynamicMenus, setDynamicMenus] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)

  // 加载动态菜单
  useEffect(() => {
    const loadDynamicMenus = async () => {
      if (!isAuthenticated) {
        setLoading(false)
        return
      }

      try {
        const response = await menuService.getUserMenus()
        if (response.data) {
          // 过滤出动态菜单（根据路径前缀）
          const apiMenus = response.data
            .filter(menu => {
              const path = menu.path || ''
              return DYNAMIC_MENU_PREFIXES.some(prefix => path.startsWith(prefix)) ||
                     // 也包括运维审计等没有子菜单的动态项
                     path === '/audit'
            })
            .map(convertApiMenuToMenuItem)
          
          if (apiMenus.length > 0) {
            setDynamicMenus(apiMenus)
          } else {
            // 如果后端没有返回动态菜单，使用后备配置
            setDynamicMenus(FALLBACK_DYNAMIC_MENUS.map(convertConfigToMenuItem))
          }
        }
      } catch (error) {
        console.error('加载动态菜单失败，使用后备配置:', error)
        // API 失败时使用后备配置
        setDynamicMenus(FALLBACK_DYNAMIC_MENUS.map(convertConfigToMenuItem))
      } finally {
        setLoading(false)
      }
    }

    loadDynamicMenus()
  }, [isAuthenticated])

  // 合并固定菜单和动态菜单，并排序确保系统设置在最后
  const fixedMenuItems = FIXED_MENU_STRUCTURE.map(convertConfigToMenuItem)
  const allMenuItems = sortMenus([...fixedMenuItems, ...dynamicMenus])

  return (
    <div className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 flex flex-col ${
      sidebarCollapsed ? 'w-16' : 'w-64'
    } ${sidebarCollapsed ? 'md:translate-x-0' : 'translate-x-0'}`}>
      {/* 头部 */}
      <div className="flex-shrink-0 flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
        {!sidebarCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">MT</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">MiTong运维</h1>
            </div>
          </div>
        )}
        
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
          title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* 导航菜单 - 可滚动区域 */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          allMenuItems.map((item, index) => (
            <SidebarItem
              key={`${item.path}-${index}`}
              item={item}
              collapsed={sidebarCollapsed}
            />
          ))
        )}
      </nav>

      {/* 底部用户信息 */}
      {!sidebarCollapsed && user && (
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
              <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">
                {user.full_name?.[0] || user.username?.[0] || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user.full_name || user.username}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user.roles?.map(role => role.name).join(', ') || '无角色'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
