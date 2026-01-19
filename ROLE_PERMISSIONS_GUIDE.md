# 角色权限体系详细说明

## 概述

MiTong运维平台采用基于角色的访问控制（RBAC）系统，通过角色分配权限，用户通过角色获得相应的系统访问权限。

## 系统角色类型

### 1. super_admin（超级管理员）
**角色描述**：系统最高权限角色，拥有所有功能的完全访问权限

**权限范围**：
- ✅ **用户管理**：创建、查看、编辑、删除所有用户
- ✅ **角色管理**：创建、查看、编辑、删除所有角色
- ✅ **菜单管理**：管理系统菜单结构
- ✅ **主机管理**：管理所有主机资源
- ✅ **Ansible管理**：管理和执行所有自动化脚本
- ✅ **监控告警**：配置和管理所有监控规则
- ✅ **网络探测**：管理网络探测功能
- ✅ **日志管理**：查看和导出系统日志

**具体权限列表**：
```
用户管理: user:read, user:create, user:update, user:delete
角色管理: role:read, role:create, role:update, role:delete
菜单管理: menu:read, menu:create, menu:update, menu:delete
主机管理: host:read, host:create, host:update, host:delete
Ansible: ansible:read, ansible:create, ansible:update, ansible:delete
监控告警: monitor:read, monitor:create, monitor:update, monitor:delete
网络探测: network:read, network:create, network:update, network:delete
日志管理: log:read
```

**适用场景**：
- 系统初始化和配置
- 紧急故障处理
- 系统架构调整
- 安全策略管理

---

### 2. admin（管理员）
**角色描述**：系统管理员角色，拥有大部分管理权限，但受到一定限制

**权限范围**：
- ✅ **用户管理**：可以管理普通用户，但不能管理超级管理员
- ✅ **角色管理**：可以管理普通角色，但不能修改超级管理员角色
- ✅ **主机管理**：完全的主机管理权限
- ✅ **Ansible管理**：完全的自动化脚本管理权限
- ✅ **监控告警**：完全的监控配置权限
- ✅ **网络探测**：完全的网络探测管理权限
- ⚠️ **菜单管理**：受限的菜单管理权限
- ⚠️ **日志管理**：只能查看日志，不能删除

**具体权限列表**：
```
用户管理: user:read, user:create, user:update, user:delete
角色管理: role:read, role:create, role:update
主机管理: host:read, host:create, host:update, host:delete, host:connect, host:webshell
Ansible: ansible:read, ansible:create, ansible:update, ansible:delete, ansible:execute
监控告警: monitor:read, monitor:channel, monitor:rule, monitor:alert
网络探测: network:read, network:create, network:update, network:delete, network:execute, network:group
日志管理: log:read
```

**适用场景**：
- 日常系统管理
- 用户账户管理
- 运维任务执行
- 监控配置管理

---

### 3. 系统管理员（自定义角色）
**角色描述**：专注于系统运维的管理员角色

**权限范围**：
- ✅ **主机管理**：完全的主机管理权限
- ✅ **Ansible管理**：执行和管理自动化脚本
- ✅ **监控告警**：查看和处理告警
- ✅ **网络探测**：执行网络探测任务
- ✅ **日志管理**：查看系统日志
- ❌ **用户管理**：无用户管理权限
- ❌ **角色管理**：无角色管理权限

**具体权限列表**：
```
主机管理: host:read, host:create, host:update, host:delete, host:connect, host:webshell
Ansible: ansible:read, ansible:execute
监控告警: monitor:read, monitor:alert
网络探测: network:read, network:execute
日志管理: log:read
```

**适用场景**：
- 专业运维工程师
- 系统监控专员
- 自动化运维执行

---

### 4. 普通用户（user）
**角色描述**：基础用户角色，只有查看权限

**权限范围**：
- ✅ **查看权限**：可以查看大部分系统信息
- ❌ **修改权限**：不能进行任何修改操作
- ❌ **删除权限**：不能删除任何数据
- ❌ **创建权限**：不能创建新的资源

**具体权限列表**：
```
用户管理: user:read
角色管理: role:read
主机管理: host:read
Ansible: ansible:read
监控告警: monitor:read
网络探测: network:read
日志管理: log:read
```

**适用场景**：
- 业务人员查看系统状态
- 临时访问用户
- 审计和监督人员
- 实习生或新员工

---

## 权限模块详解

### 用户管理模块 (user)
| 权限代码 | 权限名称 | 功能描述 |
|---------|---------|---------|
| `user:read` | 查看用户 | 查看用户列表和用户详细信息 |
| `user:create` | 创建用户 | 创建新的用户账户 |
| `user:update` | 编辑用户 | 修改用户信息、状态、角色分配 |
| `user:delete` | 删除用户 | 删除用户账户（不可恢复） |
| `user:export` | 导出用户 | 导出用户列表数据 |

### 角色管理模块 (role)
| 权限代码 | 权限名称 | 功能描述 |
|---------|---------|---------|
| `role:read` | 查看角色 | 查看角色列表和角色详细信息 |
| `role:create` | 创建角色 | 创建新的角色 |
| `role:update` | 编辑角色 | 修改角色信息和权限配置 |
| `role:delete` | 删除角色 | 删除角色（不可恢复） |
| `role:export` | 导出角色 | 导出角色配置数据 |

### 主机管理模块 (host)
| 权限代码 | 权限名称 | 功能描述 |
|---------|---------|---------|
| `host:read` | 查看主机 | 查看主机列表和主机信息 |
| `host:create` | 添加主机 | 添加新的主机到系统 |
| `host:update` | 编辑主机 | 修改主机配置信息 |
| `host:delete` | 删除主机 | 从系统中删除主机 |
| `host:connect` | 连接主机 | 建立到主机的连接 |
| `host:webshell` | 使用WebShell | 通过Web界面访问主机终端 |

### Ansible管理模块 (ansible)
| 权限代码 | 权限名称 | 功能描述 |
|---------|---------|---------|
| `ansible:read` | 查看Playbook | 查看自动化脚本列表 |
| `ansible:create` | 创建Playbook | 创建新的自动化脚本 |
| `ansible:update` | 编辑Playbook | 修改自动化脚本内容 |
| `ansible:delete` | 删除Playbook | 删除自动化脚本 |
| `ansible:execute` | 执行Playbook | 执行自动化脚本任务 |

### 监控告警模块 (monitor)
| 权限代码 | 权限名称 | 功能描述 |
|---------|---------|---------|
| `monitor:read` | 查看监控 | 查看监控数据和告警信息 |
| `monitor:channel` | 管理告警渠道 | 配置告警通知渠道 |
| `monitor:rule` | 管理告警规则 | 创建和修改告警规则 |
| `monitor:alert` | 处理告警 | 确认和处理告警事件 |

### 网络探测模块 (network)
| 权限代码 | 权限名称 | 功能描述 |
|---------|---------|---------|
| `network:read` | 查看探测 | 查看网络探测结果 |
| `network:create` | 创建探测 | 创建新的网络探测任务 |
| `network:update` | 编辑探测 | 修改网络探测配置 |
| `network:delete` | 删除探测 | 删除网络探测任务 |
| `network:execute` | 执行探测 | 手动执行网络探测 |
| `network:group` | 管理分组 | 管理网络探测分组 |

### 日志管理模块 (log)
| 权限代码 | 权限名称 | 功能描述 |
|---------|---------|---------|
| `log:read` | 查看日志 | 查看系统操作日志 |
| `log:export` | 导出日志 | 导出日志数据 |

### 菜单管理模块 (menu)
| 权限代码 | 权限名称 | 功能描述 |
|---------|---------|---------|
| `menu:read` | 查看菜单 | 查看菜单配置 |
| `menu:create` | 创建菜单 | 创建新的菜单项 |
| `menu:update` | 编辑菜单 | 修改菜单结构和配置 |
| `menu:delete` | 删除菜单 | 删除菜单项 |

---

## 权限继承和限制

### 权限继承规则
1. **super_admin** > **admin** > **系统管理员** > **普通用户**
2. 高级角色包含低级角色的所有权限
3. 用户可以同时拥有多个角色，权限取并集

### 特殊限制规则
1. **租户隔离**：所有权限都在租户范围内生效
2. **自我保护**：用户不能删除自己的账户
3. **角色保护**：不能删除正在使用的角色
4. **超级管理员保护**：普通管理员不能修改超级管理员

---

## 权限检查机制

### 前端权限检查
```typescript
// 检查单个权限
hasPermission('user:create')

// 检查多个权限（任一）
hasAnyPermission(['user:create', 'user:update'])

// 检查多个权限（全部）
hasAllPermissions(['user:read', 'user:create'])

// 检查是否为管理员
isAdmin()
```

### 后端权限检查
```python
# 装饰器权限检查
@role_required('admin', 'super_admin')
@tenant_required

# 服务层权限检查
auth_service.has_role('admin')
auth_service.has_permission('user:create')
```

---

## 最佳实践建议

### 1. 角色分配原则
- **最小权限原则**：只分配必要的权限
- **职责分离**：不同职能使用不同角色
- **定期审查**：定期检查和调整权限分配

### 2. 安全建议
- **超级管理员账户**：限制数量，定期更换密码
- **权限审计**：记录所有权限变更操作
- **访问监控**：监控异常权限使用行为

### 3. 运维建议
- **角色模板**：为常见职位创建标准角色模板
- **权限文档**：维护详细的权限说明文档
- **培训计划**：对用户进行权限使用培训

---

## 常见问题解答

### Q: 如何为新员工分配合适的角色？
A: 根据员工的工作职责选择对应角色：
- 运维工程师 → 系统管理员
- 业务人员 → 普通用户
- 部门主管 → admin
- 系统架构师 → super_admin

### Q: 用户忘记密码怎么办？
A: 具有 `user:update` 权限的管理员可以重置用户密码。

### Q: 如何临时提升用户权限？
A: 管理员可以临时为用户分配更高级别的角色，任务完成后及时回收。

### Q: 权限变更多久生效？
A: 权限变更立即生效，用户需要重新登录以获取最新权限。

---

## 技术实现细节

### 数据库设计
```sql
-- 角色表
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    permissions JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户角色关联表
CREATE TABLE user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role_id)
);
```

### 权限存储格式
```json
{
  "permissions": [
    "user:read",
    "user:create",
    "user:update",
    "host:read",
    "host:connect"
  ]
}
```

这个权限体系确保了系统的安全性和可管理性，同时提供了足够的灵活性来适应不同的组织需求。