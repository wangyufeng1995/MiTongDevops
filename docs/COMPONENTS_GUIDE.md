# 组件使用指南

本文档介绍 MiTong 运维平台前端组件的使用方法。

## 目录

- [布局组件](#布局组件)
- [表单组件](#表单组件)
- [表格组件](#表格组件)
- [弹窗组件](#弹窗组件)
- [头像组件](#头像组件)
- [终端组件](#终端组件)
- [网络探测组件](#网络探测组件)
- [监控组件](#监控组件)
- [K8s 组件](#k8s-组件)

---

## 布局组件

### Header

顶部导航栏组件，包含用户信息、通知、主题切换等功能。

```tsx
import { Header } from '@/components/Layout/Header'

<Header />
```

### Sidebar

侧边栏导航组件，支持菜单折叠、权限控制。

```tsx
import { Sidebar } from '@/components/Layout/Sidebar'

<Sidebar collapsed={false} onCollapse={setCollapsed} />
```

### Breadcrumb

面包屑导航组件。

```tsx
import { Breadcrumb } from '@/components/Breadcrumb'

<Breadcrumb items={[
  { label: '首页', path: '/' },
  { label: '用户管理', path: '/users' },
  { label: '用户列表' }
]} />
```

---

## 表单组件

### Input

输入框组件，支持深色主题。

```tsx
import { Input } from '@/components/Form/Input'

<Input
  label="用户名"
  placeholder="请输入用户名"
  value={username}
  onChange={(e) => setUsername(e.target.value)}
  error="用户名不能为空"
/>
```

**Props:**
| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| label | string | - | 标签文本 |
| placeholder | string | - | 占位符 |
| value | string | - | 输入值 |
| onChange | function | - | 值变化回调 |
| error | string | - | 错误提示 |
| disabled | boolean | false | 是否禁用 |

### Select

下拉选择组件。

```tsx
import { Select } from '@/components/Form/Select'

<Select
  label="角色"
  value={role}
  onChange={setRole}
  options={[
    { value: 'admin', label: '管理员' },
    { value: 'user', label: '普通用户' }
  ]}
/>
```

### DatePicker

日期选择器组件。

```tsx
import { DatePicker } from '@/components/Form/DatePicker'

<DatePicker
  label="开始日期"
  value={startDate}
  onChange={setStartDate}
/>
```

### PasswordStrength

密码强度指示器组件。

```tsx
import { PasswordStrength } from '@/components/PasswordStrength'

<PasswordStrength password={password} />
```

### PasswordGenerator

密码生成器组件。

```tsx
import { PasswordGenerator } from '@/components/PasswordGenerator'

<PasswordGenerator onGenerate={(pwd) => setPassword(pwd)} />
```

---

## 表格组件

### DataTable

数据表格组件，支持分页、排序、筛选。

```tsx
import { DataTable } from '@/components/Table/DataTable'

<DataTable
  columns={[
    { key: 'name', title: '名称', sortable: true },
    { key: 'email', title: '邮箱' },
    { key: 'status', title: '状态', render: (val) => <StatusBadge status={val} /> }
  ]}
  data={users}
  loading={loading}
  pagination={{
    current: page,
    pageSize: 10,
    total: total,
    onChange: setPage
  }}
/>
```

### ActionColumn

操作列组件。

```tsx
import { ActionColumn } from '@/components/Table/ActionColumn'

<ActionColumn
  actions={[
    { label: '编辑', icon: <Edit />, onClick: () => handleEdit(row) },
    { label: '删除', icon: <Trash />, onClick: () => handleDelete(row), danger: true }
  ]}
/>
```

### TableExport

表格导出组件。

```tsx
import { TableExport } from '@/components/Table/TableExport'

<TableExport
  data={data}
  columns={columns}
  filename="users-export"
/>
```

---

## 弹窗组件

### Modal

通用弹窗组件。

```tsx
import { Modal } from '@/components/Modal'

<Modal
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title="编辑用户"
  footer={
    <>
      <Button onClick={() => setIsOpen(false)}>取消</Button>
      <Button type="primary" onClick={handleSubmit}>确定</Button>
    </>
  }
>
  <form>...</form>
</Modal>
```

### ConfirmModal

确认弹窗组件，支持多种类型（删除、警告等）。

```tsx
import { ConfirmModal } from '@/components/ConfirmModal'

<ConfirmModal
  open={confirmOpen}
  onClose={() => setConfirmOpen(false)}
  onConfirm={handleDelete}
  title="删除确认"
  message="确定要删除这条记录吗？"
  type="danger"
/>
```

### ConfirmDialog

简化版确认对话框。

```tsx
import { ConfirmDialog } from '@/components/ConfirmDialog'

<ConfirmDialog
  open={dialogOpen}
  title="操作确认"
  content="确定要执行此操作吗？"
  onConfirm={handleConfirm}
  onCancel={() => setDialogOpen(false)}
/>
```

---

## 头像组件

基于 DiceBear 的头像系统。

### Avatar

头像显示组件。

```tsx
import { Avatar } from '@/components/Avatar'

<Avatar
  seed="user123"
  style="avataaars"
  size={48}
/>
```

### AvatarEditor

头像编辑器组件。

```tsx
import { AvatarEditor } from '@/components/Avatar/AvatarEditor'

<AvatarEditor
  initialConfig={avatarConfig}
  onSave={(config) => saveAvatar(config)}
/>
```

### AvatarGenerator

随机头像生成器。

```tsx
import { AvatarGenerator } from '@/components/Avatar/AvatarGenerator'

<AvatarGenerator
  onGenerate={(config) => setAvatarConfig(config)}
/>
```

**支持的头像风格:**
- `avataaars` - 卡通人物
- `bottts` - 机器人
- `identicon` - 几何图形
- `initials` - 首字母
- `pixel-art` - 像素风格

---

## 终端组件

### Terminal

基础终端组件。

```tsx
import { Terminal } from '@/components/Terminal'

<Terminal
  onData={(data) => sendToServer(data)}
  onResize={(cols, rows) => resizeTerminal(cols, rows)}
/>
```

### SSHTerminal

SSH 终端组件。

```tsx
import { SSHTerminal } from '@/components/Terminal/SSHTerminal'

<SSHTerminal
  hostId={hostId}
  onConnect={() => console.log('Connected')}
  onDisconnect={() => console.log('Disconnected')}
/>
```

### WebShellTerminal

WebShell 终端组件，支持多会话。

```tsx
import { WebShellTerminal } from '@/components/WebShell/WebShellTerminal'

<WebShellTerminal
  sessionId={sessionId}
  hostInfo={hostInfo}
/>
```

### SessionManager

会话管理组件。

```tsx
import { SessionManager } from '@/components/WebShell/SessionManager'

<SessionManager
  sessions={sessions}
  activeSession={activeSessionId}
  onSelect={setActiveSession}
  onClose={closeSession}
/>
```

---

## 网络探测组件

### ProbeAnalysisHeader

探测分析页面头部组件。

```tsx
import { ProbeAnalysisHeader } from '@/components/Network/ProbeAnalysisHeader'

<ProbeAnalysisHeader
  title="网络探测分析"
  subtitle="深度分析网络探测性能"
  loading={loading}
  onRefresh={handleRefresh}
/>
```

### ProbeStatus

探测状态显示组件，支持 SSE 实时更新。

```tsx
import { ProbeStatus } from '@/components/Network/ProbeStatus'

<ProbeStatus
  probeId={probeId}
  autoConnect={true}
  showConnectionState={true}
/>
```

### ProbeControls

探测控制组件。

```tsx
import { ProbeControls } from '@/components/Network/ProbeControls'

<ProbeControls
  probe={probe}
  onStart={handleStart}
  onStop={handleStop}
  onTest={handleTest}
/>
```

---

## 监控组件

### MonitorPageLayout

监控页面布局组件。

```tsx
import { MonitorPageLayout } from '@/components/Monitor/MonitorPageLayout'

<MonitorPageLayout
  title="主机监控"
  actions={<Button>添加监控</Button>}
>
  {children}
</MonitorPageLayout>
```

### FilterBar

筛选栏组件。

```tsx
import { FilterBar } from '@/components/Monitor/FilterBar'

<FilterBar
  filters={filters}
  onChange={setFilters}
  onReset={resetFilters}
/>
```

### FormCard

表单卡片组件。

```tsx
import { FormCard } from '@/components/Monitor/FormCard'

<FormCard title="告警规则配置">
  <form>...</form>
</FormCard>
```

---

## K8s 组件

### ClusterSelector

集群选择器组件。

```tsx
import { ClusterSelector } from '@/components/K8s/ClusterSelector'

<ClusterSelector
  clusters={clusters}
  selected={selectedCluster}
  onChange={setSelectedCluster}
/>
```

### NamespaceSelector

命名空间选择器。

```tsx
import { NamespaceSelector } from '@/components/K8s/NamespaceSelector'

<NamespaceSelector
  clusterId={clusterId}
  selected={namespace}
  onChange={setNamespace}
/>
```

### PodList

Pod 列表组件。

```tsx
import { PodList } from '@/components/K8s/PodList'

<PodList
  pods={pods}
  onSelect={handlePodSelect}
  onDelete={handlePodDelete}
/>
```

### ResourceCard

资源卡片组件。

```tsx
import { ResourceCard } from '@/components/K8s/ResourceCard'

<ResourceCard
  title="Deployments"
  count={deployments.length}
  icon={<DeploymentIcon />}
  onClick={() => navigate('/k8s/deployments')}
/>
```

### StatusBadge

状态徽章组件。

```tsx
import { StatusBadge } from '@/components/K8s/StatusBadge'

<StatusBadge status="Running" />
<StatusBadge status="Pending" />
<StatusBadge status="Failed" />
```

---

## 通用组件

### Loading

加载状态组件。

```tsx
import { Loading } from '@/components/Loading'

<Loading />
<Loading size="large" text="加载中..." />
```

### Toast

消息提示组件。

```tsx
import { Toast } from '@/components/Toast'

Toast.success('操作成功')
Toast.error('操作失败')
Toast.info('提示信息')
Toast.warning('警告信息')
```

### ErrorBoundary

错误边界组件。

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary'

<ErrorBoundary fallback={<ErrorPage />}>
  <App />
</ErrorBoundary>
```

### PermissionGuard

权限守卫组件。

```tsx
import { PermissionGuard } from '@/components/PermissionGuard'

<PermissionGuard permissions={['user:create']}>
  <Button>创建用户</Button>
</PermissionGuard>
```

---

## 主题支持

所有组件都支持深色/浅色主题切换，使用 `useTheme` hook：

```tsx
import { useTheme } from '@/hooks/useTheme'

const MyComponent = () => {
  const { isDark, toggleTheme } = useTheme()
  
  return (
    <div className={isDark ? 'bg-slate-800' : 'bg-white'}>
      {/* 组件内容 */}
    </div>
  )
}
```

---

## 最佳实践

1. **组件导入**: 优先使用 index 文件导出的组件
2. **主题适配**: 使用 `isDark` 条件渲染不同主题样式
3. **错误处理**: 表单组件配合错误状态使用
4. **性能优化**: 大列表使用虚拟滚动
5. **无障碍**: 确保组件有正确的 ARIA 属性
