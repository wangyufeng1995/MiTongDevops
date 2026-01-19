# 架构设计文档

## 目录

- [系统概述](#系统概述)
- [技术架构](#技术架构)
- [系统架构](#系统架构)
- [数据架构](#数据架构)
- [安全架构](#安全架构)
- [部署架构](#部署架构)

## 系统概述

### 项目简介

MiTong运维平台是一个基于 React + Flask 的现代化运维管理平台，采用前后端分离架构，支持多租户模式。系统提供了完整的用户权限管理、主机运维管理、监控告警、网络探测等功能，适用于企业级运维场景。

### 核心特性

- **多租户架构**: 支持多租户数据隔离，适用于 SaaS 场景
- **前后端分离**: 前端使用 React 18，后端使用 Flask，通过 REST API 通信
- **权限管理**: 基于 RBAC 的权限控制系统
- **主机运维**: SSH 主机管理、WebShell 终端、Ansible 自动化
- **监控告警**: 主机性能监控、告警规则配置、多渠道通知
- **网络探测**: 支持 HTTP/HTTPS/WebSocket/TCP/UDP 协议探测
- **安全加固**: JWT 认证、密码加密传输、CSRF 防护、SQL 注入防护

### 技术选型理由

#### 前端技术栈

| 技术 | 版本 | 选型理由 |
|------|------|----------|
| React | 18.x | 成熟的前端框架，生态丰富，性能优秀 |
| TypeScript | 5.x | 类型安全，提高代码质量和可维护性 |
| Vite | 5.x | 快速的构建工具，开发体验好 |
| Tailwind CSS | 3.x | 实用优先的 CSS 框架，开发效率高 |
| Zustand | 4.x | 轻量级状态管理，API 简洁 |
| React Router | 6.x | 标准的 React 路由解决方案 |
| Axios | 1.x | 功能强大的 HTTP 客户端 |

#### 后端技术栈

| 技术 | 版本 | 选型理由 |
|------|------|----------|
| Flask | 3.x | 轻量级 Web 框架，灵活易扩展 |
| PostgreSQL | 12+ | 功能强大的关系型数据库，支持 JSON 类型 |
| Redis | 6+ | 高性能缓存，支持多种数据结构 |
| SQLAlchemy | 2.x | 成熟的 Python ORM 框架 |
| Alembic | 1.x | 数据库迁移工具 |
| Flask-JWT-Extended | 4.x | JWT 认证扩展 |
| Celery | 5.x | 分布式任务队列 |
| Paramiko | 3.x | SSH 连接库 |

## 技术架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         用户层                               │
│                    (Web Browser)                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      前端应用层                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  React 18 + TypeScript + Vite                        │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │  │
│  │  │  Components│  │   Pages    │  │   Router   │    │  │
│  │  └────────────┘  └────────────┘  └────────────┘    │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │  │
│  │  │   Store    │  │  Services  │  │   Utils    │    │  │
│  │  └────────────┘  └────────────┘  └────────────┘    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ REST API / WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      后端应用层                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Flask Application                                   │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │  │
│  │  │  API Layer │  │ Middleware │  │   Auth     │    │  │
│  │  └────────────┘  └────────────┘  └────────────┘    │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │  │
│  │  │  Services  │  │   Models   │  │   Tasks    │    │  │
│  │  └────────────┘  └────────────┘  └────────────┘    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│      数据存储层           │  │      缓存层               │
│  ┌────────────────────┐  │  │  ┌────────────────────┐  │
│  │   PostgreSQL       │  │  │  │      Redis         │  │
│  │  - 业务数据        │  │  │  │  - 会话缓存        │  │
│  │  - 多租户隔离      │  │  │  │  - 探测结果        │  │
│  │  - 事务支持        │  │  │  │  - 任务队列        │  │
│  └────────────────────┘  │  │  └────────────────────┘  │
└──────────────────────────┘  └──────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                      任务队列层                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Celery Worker                                       │  │
│  │  - 网络探测任务                                       │  │
│  │  - 定时任务调度                                       │  │
│  │  - 异步任务处理                                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 前端架构

#### 组件层次结构

```
App
├── Router
│   ├── Layout (主布局)
│   │   ├── Sidebar (侧边栏)
│   │   ├── Header (顶部导航)
│   │   └── Content (内容区域)
│   │       ├── Dashboard (仪表盘)
│   │       ├── Users (用户管理)
│   │       ├── Roles (角色管理)
│   │       ├── Menus (菜单管理)
│   │       ├── Logs (日志管理)
│   │       ├── Hosts (主机管理)
│   │       ├── Ansible (Ansible 管理)
│   │       ├── Monitor (监控告警)
│   │       └── Network (网络探测)
│   └── Login (登录页面)
└── ErrorBoundary (错误边界)
```

#### 状态管理

使用 Zustand 进行状态管理，主要包括：

- **认证状态** (`auth.ts`): 用户信息、Token、租户信息
- **应用状态** (`app.ts`): 全局配置、主题、语言

#### 路由设计

```typescript
// 路由配置
const routes = [
  {
    path: '/login',
    component: Login,
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: Layout,
    meta: { requiresAuth: true },
    children: [
      { path: 'dashboard', component: Dashboard },
      { path: 'users', component: Users },
      { path: 'roles', component: Roles },
      // ... 其他路由
    ]
  }
];
```

### 后端架构

#### 分层架构

```
┌─────────────────────────────────────────┐
│           API Layer (路由层)             │
│  - 接收 HTTP 请求                        │
│  - 参数验证                              │
│  - 调用 Service 层                       │
│  - 返回响应                              │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│        Service Layer (业务逻辑层)        │
│  - 业务逻辑处理                          │
│  - 数据转换                              │
│  - 调用 Model 层                         │
│  - 事务管理                              │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│         Model Layer (数据模型层)         │
│  - 数据模型定义                          │
│  - 数据库操作                            │
│  - 关系映射                              │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│       Database Layer (数据库层)          │
│  - PostgreSQL                           │
│  - Redis                                │
└─────────────────────────────────────────┘
```

#### 蓝图组织

```python
# 蓝图注册
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(users_bp, url_prefix='/api/users')
app.register_blueprint(roles_bp, url_prefix='/api/roles')
app.register_blueprint(menus_bp, url_prefix='/api/menus')
app.register_blueprint(logs_bp, url_prefix='/api/logs')
app.register_blueprint(hosts_bp, url_prefix='/api/hosts')
app.register_blueprint(ansible_bp, url_prefix='/api/ansible')
app.register_blueprint(monitor_bp, url_prefix='/api/monitor')
app.register_blueprint(network_bp, url_prefix='/api/network')
```

#### 中间件设计

```python
# 中间件执行顺序
Request
  ↓
CORS 中间件
  ↓
日志中间件
  ↓
JWT 认证中间件
  ↓
多租户中间件
  ↓
频率限制中间件
  ↓
路由处理
  ↓
Response
```

## 系统架构

### 多租户架构

#### 租户隔离方案

采用**表级隔离**方案，所有业务表包含 `tenant_id` 字段：

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    -- 其他字段
    UNIQUE(tenant_id, username)
);
```

#### 租户识别流程

```
1. 用户登录
   ↓
2. 后端验证用户名密码
   ↓
3. 生成 JWT Token (包含 user_id 和 tenant_id)
   ↓
4. 前端存储 Token
   ↓
5. 后续请求携带 Token
   ↓
6. 中间件解析 Token 获取 tenant_id
   ↓
7. 自动过滤查询条件 (WHERE tenant_id = ?)
```

#### 租户数据隔离

```python
# 基础模型类
class BaseModel(db.Model):
    __abstract__ = True
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# 自动过滤租户数据
@event.listens_for(Session, 'before_flush')
def receive_before_flush(session, flush_context, instances):
    tenant_id = get_current_tenant_id()
    for instance in session.new:
        if isinstance(instance, BaseModel):
            instance.tenant_id = tenant_id
```

### 认证授权架构

#### JWT Token 设计

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "user_id": 1,
    "tenant_id": 1,
    "username": "admin",
    "roles": ["admin"],
    "exp": 1640000000,
    "iat": 1639996400
  },
  "signature": "..."
}
```

#### 认证流程

```
1. 用户输入用户名和密码
   ↓
2. 前端使用 RSA 公钥加密密码
   ↓
3. 发送加密密码到后端
   ↓
4. 后端使用 RSA 私钥解密密码
   ↓
5. 验证用户名和密码 (bcrypt)
   ↓
6. 生成 Access Token 和 Refresh Token
   ↓
7. 返回 Token 给前端
   ↓
8. 前端存储 Token 到 localStorage
   ↓
9. 后续请求携带 Access Token
   ↓
10. Token 过期时使用 Refresh Token 刷新
```

#### 权限控制

基于 RBAC (Role-Based Access Control) 模型：

```
User (用户)
  ↓ N:M
Role (角色)
  ↓ 1:N
Permission (权限)
  ↓
Resource (资源)
```

### WebSocket 架构

#### WebShell 终端架构

```
前端 (xterm.js)
  ↓ WebSocket
Flask-SocketIO
  ↓ SSH
Paramiko
  ↓ SSH Protocol
远程主机
```

#### 会话管理

```python
# WebShell 会话管理
sessions = {
    'session_id_1': {
        'user_id': 1,
        'host_id': 1,
        'ssh_client': <paramiko.SSHClient>,
        'channel': <paramiko.Channel>,
        'created_at': datetime.now()
    }
}
```

### 任务队列架构

#### Celery 架构

```
Flask App
  ↓ 发送任务
Redis (Broker)
  ↓ 分发任务
Celery Worker
  ↓ 执行任务
Redis (Backend)
  ↓ 存储结果
Flask App
```

#### 网络探测任务流程

```
1. 用户创建探测任务
   ↓
2. 保存到数据库
   ↓
3. 用户点击"主动探测"或启用"自动探测"
   ↓
4. 创建 Celery 任务
   ↓
5. Celery Worker 执行探测
   ↓
6. 探测结果存储到 Redis (TTL=180s)
   ↓
7. 同时存储到数据库
   ↓
8. 通过 SSE 推送结果到前端
```

## 数据架构

### 数据库设计

#### ER 图

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Tenants   │──────<│    Users    │>──────│    Roles    │
└─────────────┘       └─────────────┘       └─────────────┘
                             │
                             │
                      ┌──────┴──────┐
                      │             │
                      ▼             ▼
              ┌─────────────┐ ┌─────────────┐
              │    Menus    │ │    Logs     │
              └─────────────┘ └─────────────┘

┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  SSH Hosts  │──────<│  Host Info  │       │Host Metrics │
└─────────────┘       └─────────────┘       └─────────────┘
       │
       │
       ▼
┌─────────────┐       ┌─────────────┐
│  Playbooks  │──────<│ Executions  │
└─────────────┘       └─────────────┘

┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│Alert Channel│──────<│Alert Rules  │──────<│Alert Records│
└─────────────┘       └─────────────┘       └─────────────┘

┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│Probe Groups │──────<│   Probes    │──────<│Probe Results│
└─────────────┘       └─────────────┘       └─────────────┘
```

#### 核心表结构

详见 `docs/DATABASE_DESIGN.md`

### 缓存设计

#### Redis 数据结构

```
# 用户会话
session:{user_id}:{tenant_id} -> Hash
  - access_token
  - refresh_token
  - user_info
  - expires_at

# 网络探测结果
network:probe:{probe_id}:results -> List
  - [result1, result2, result3, ...]
  - TTL: 180s

# 网络探测状态
network:probe:{probe_id}:status -> String
  - "running" | "stopped" | "error"
  - TTL: 300s

# 网络探测统计
network:probe:{probe_id}:stats -> Hash
  - total_count
  - success_count
  - failed_count
  - avg_response_time
  - TTL: 300s
```

#### 缓存策略

1. **探测结果缓存**:
   - 写入: 探测完成后立即写入 Redis
   - 读取: 优先从 Redis 读取，未命中则从数据库读取
   - 过期: TTL 180 秒自动过期
   - 更新: 页面数据变更时立即更新 Redis

2. **会话缓存**:
   - 写入: 用户登录后写入 Redis
   - 读取: 每次请求从 Redis 读取
   - 过期: 与 Token 过期时间一致
   - 更新: Token 刷新时更新

## 安全架构

### 认证安全

#### 密码加密传输

```
前端:
1. 获取 RSA 公钥
2. 使用公钥加密密码
3. 发送加密密码

后端:
1. 使用 RSA 私钥解密密码
2. 使用 bcrypt 验证密码
3. 生成 JWT Token
```

#### JWT Token 安全

- 使用 HS256 算法签名
- Access Token 有效期: 1 小时
- Refresh Token 有效期: 30 天
- Token 存储在 localStorage
- 每次请求携带 Token

### 数据安全

#### SQL 注入防护

- 使用 SQLAlchemy ORM
- 参数化查询
- 输入验证

#### XSS 防护

- 前端输入验证
- 输出转义
- Content-Security-Policy

#### CSRF 防护

- CSRF Token 验证
- SameSite Cookie
- Referer 检查

### 多租户安全

- 严格的租户数据隔离
- 中间件自动过滤租户数据
- 审计日志记录所有操作

## 部署架构

### Docker 部署架构

```
┌─────────────────────────────────────────────────────────┐
│                      Docker Host                        │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Nginx      │  │   Frontend   │  │   Backend    │ │
│  │   (80/443)   │  │   (3000)     │  │   (5000)     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│         │                                      │        │
│         └──────────────────────────────────────┘        │
│                          │                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ PostgreSQL   │  │    Redis     │  │Celery Worker │ │
│  │   (5432)     │  │   (6379)     │  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 生产环境架构

```
                    ┌─────────────┐
                    │   用户      │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  负载均衡   │
                    │  (Nginx)    │
                    └─────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌─────────────┐          ┌─────────────┐
       │  前端服务器  │          │  前端服务器  │
       │  (Node 1)   │          │  (Node 2)   │
       └─────────────┘          └─────────────┘
              │                         │
              └────────────┬────────────┘
                           ▼
                    ┌─────────────┐
                    │  负载均衡   │
                    │  (Nginx)    │
                    └─────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌─────────────┐          ┌─────────────┐
       │  后端服务器  │          │  后端服务器  │
       │  (Node 1)   │          │  (Node 2)   │
       └─────────────┘          └─────────────┘
              │                         │
              └────────────┬────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌─────────────┐          ┌─────────────┐
       │ PostgreSQL  │          │    Redis    │
       │  (Master)   │          │  (Cluster)  │
       └─────────────┘          └─────────────┘
              │
              ▼
       ┌─────────────┐
       │ PostgreSQL  │
       │  (Slave)    │
       └─────────────┘
```

### 扩展性设计

#### 水平扩展

- 前端: 静态资源部署到 CDN
- 后端: 无状态设计，支持多实例部署
- 数据库: 读写分离，主从复制
- 缓存: Redis 集群

#### 垂直扩展

- 增加服务器配置
- 优化数据库索引
- 使用连接池
- 代码优化

## 性能优化

### 前端性能优化

- 代码分割和懒加载
- 组件缓存 (React.memo)
- 虚拟滚动
- 图片懒加载
- CDN 加速

### 后端性能优化

- 数据库索引优化
- 查询优化
- Redis 缓存
- 连接池
- 异步任务

### 数据库性能优化

- 合理设计索引
- 分页查询
- 避免 N+1 查询
- 使用 EXPLAIN 分析查询
- 定期维护和优化

## 监控和日志

### 应用监控

- 性能监控
- 错误监控
- 用户行为监控
- API 调用监控

### 日志管理

- 应用日志
- 访问日志
- 错误日志
- 审计日志

### 告警机制

- 邮件告警
- 钉钉告警
- 短信告警
- 电话告警

## 总结

本架构设计文档详细描述了 MiTong运维平台的技术架构、系统架构、数据架构、安全架构和部署架构。系统采用现代化的技术栈，遵循最佳实践，具有良好的可扩展性、可维护性和安全性。

如有疑问或建议，请联系技术团队。
