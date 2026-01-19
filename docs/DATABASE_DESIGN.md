# 数据库设计文档

## 目录

- [数据库概述](#数据库概述)
- [核心表设计](#核心表设计)
- [索引设计](#索引设计)
- [数据迁移](#数据迁移)

## 数据库概述

### 数据库选型

- **数据库**: PostgreSQL 12+
- **ORM**: SQLAlchemy 2.x
- **迁移工具**: Alembic 1.x

### 命名规范

- **表名**: 小写字母 + 下划线，复数形式 (例如: `users`, `ssh_hosts`)
- **字段名**: 小写字母 + 下划线 (例如: `user_id`, `created_at`)
- **索引名**: `idx_<表名>_<字段名>` (例如: `idx_users_tenant_id`)
- **外键名**: `fk_<表名>_<字段名>` (例如: `fk_users_tenant_id`)

### 通用字段

所有业务表都包含以下字段：

- `id`: 主键，自增整数
- `tenant_id`: 租户 ID，用于多租户数据隔离
- `created_at`: 创建时间
- `updated_at`: 更新时间

## 核心表设计

### 1. 租户表 (tenants)

```sql
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '租户名称',
    code VARCHAR(50) UNIQUE NOT NULL COMMENT '租户代码',
    status INTEGER DEFAULT 1 COMMENT '状态: 1-启用, 0-禁用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tenants_code ON tenants(code);
CREATE INDEX idx_tenants_status ON tenants(status);
```

### 2. 用户表 (users)

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    username VARCHAR(50) NOT NULL COMMENT '用户名',
    email VARCHAR(100) NOT NULL COMMENT '邮箱',
    password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
    full_name VARCHAR(100) COMMENT '全名',
    avatar_style VARCHAR(50) DEFAULT 'avataaars' COMMENT 'DiceBear 头像风格',
    avatar_seed VARCHAR(100) COMMENT '头像种子值',
    avatar_config JSON COMMENT '头像配置参数',
    status INTEGER DEFAULT 1 COMMENT '状态: 1-启用, 0-禁用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, username),
    UNIQUE(tenant_id, email)
);
```

CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
```

### 3. 角色表 (roles)

```sql
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name VARCHAR(50) NOT NULL COMMENT '角色名称',
    description TEXT COMMENT '角色描述',
    permissions JSON COMMENT '权限列表',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_roles_tenant_id ON roles(tenant_id);
```

### 4. 用户角色关联表 (user_roles)

```sql
CREATE TABLE user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
```

### 5. 菜单表 (menus)

```sql
CREATE TABLE menus (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    parent_id INTEGER REFERENCES menus(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL COMMENT '菜单名称',
    path VARCHAR(100) COMMENT '路由路径',
    component VARCHAR(100) COMMENT '组件路径',
    icon VARCHAR(50) COMMENT '图标',
    sort_order INTEGER DEFAULT 0 COMMENT '排序',
    status INTEGER DEFAULT 1 COMMENT '状态: 1-启用, 0-禁用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_menus_tenant_id ON menus(tenant_id);
CREATE INDEX idx_menus_parent_id ON menus(parent_id);
CREATE INDEX idx_menus_sort_order ON menus(sort_order);
```

### 6. 操作日志表 (operation_logs)

```sql
CREATE TABLE operation_logs (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL COMMENT '操作类型',
    resource VARCHAR(50) NOT NULL COMMENT '资源类型',
    resource_id INTEGER COMMENT '资源 ID',
    details JSON COMMENT '操作详情',
    ip_address INET COMMENT 'IP 地址',
    user_agent TEXT COMMENT '用户代理',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_operation_logs_tenant_id ON operation_logs(tenant_id);
CREATE INDEX idx_operation_logs_user_id ON operation_logs(user_id);
CREATE INDEX idx_operation_logs_action ON operation_logs(action);
CREATE INDEX idx_operation_logs_created_at ON operation_logs(created_at);
```

完整的数据库表结构请参考项目中的 `migrations/` 目录。

## 索引设计

### 索引策略

1. **主键索引**: 所有表的 `id` 字段自动创建主键索引
2. **外键索引**: 所有外键字段创建索引
3. **查询索引**: 频繁查询的字段创建索引
4. **唯一索引**: 需要保证唯一性的字段创建唯一索引
5. **复合索引**: 多字段联合查询创建复合索引

### 索引优化建议

- 避免在低基数字段创建索引
- 定期分析和优化索引
- 使用 EXPLAIN 分析查询计划
- 删除未使用的索引

## 数据迁移

### Alembic 使用

```bash
# 初始化迁移
flask db init

# 生成迁移文件
flask db migrate -m "描述信息"

# 执行迁移
flask db upgrade

# 回滚迁移
flask db downgrade

# 查看迁移历史
flask db history
```

### 迁移最佳实践

1. 每次数据库变更都生成迁移文件
2. 迁移文件添加详细的描述信息
3. 测试环境先执行迁移
4. 生产环境执行前备份数据库
5. 保留所有迁移文件，不要删除

详细的数据库维护指南请参考 `DATABASE_MAINTENANCE.md`。
