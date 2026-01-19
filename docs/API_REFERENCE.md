# API 接口文档

本文档详细描述 MiTong 运维平台的 RESTful API 接口。

## 基础信息

- **Base URL**: `http://localhost:5000/api`
- **认证方式**: JWT Bearer Token + Session Cookie
- **内容类型**: `application/json`

## 通用响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

### 错误响应

```json
{
  "success": false,
  "message": "错误描述",
  "error_code": "ERROR_CODE"
}
```

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

---

## 认证接口 (Auth)

### 获取 RSA 公钥

用于前端加密密码。

```
GET /api/auth/public-key
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "publicKey": "-----BEGIN PUBLIC KEY-----\n..."
  }
}
```

### 获取 CSRF Token

```
GET /api/auth/csrf-token
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "csrf_token": "xxx..."
  }
}
```

### 用户登录

```
POST /api/auth/login
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名 |
| password | string | 是 | RSA 加密后的密码 |

**请求示例:**

```json
{
  "username": "admin",
  "password": "encrypted_password_string"
}
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "roles": ["admin"]
    },
    "tenant": {
      "id": 1,
      "name": "默认租户"
    }
  }
}
```

### 刷新 Token

```
POST /api/auth/refresh
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| refresh_token | string | 是 | 刷新令牌 |

**响应示例:**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJ..."
  }
}
```

### 用户登出

```
POST /api/auth/logout
```

**响应示例:**

```json
{
  "success": true,
  "message": "登出成功"
}
```

### 获取当前用户信息

```
GET /api/auth/me
```

**Headers:**
- `Authorization: Bearer <access_token>`

**响应示例:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "avatar_config": { ... },
      "roles": ["admin"],
      "created_at": "2024-01-01T00:00:00Z"
    },
    "tenant": {
      "id": 1,
      "name": "默认租户"
    }
  }
}
```

---

## 用户管理接口 (Users)

### 获取用户列表

```
GET /api/users
```

**查询参数:**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | int | 1 | 页码 |
| per_page | int | 10 | 每页数量（最大100） |
| search | string | - | 搜索关键词 |

**响应示例:**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "username": "admin",
        "email": "admin@example.com",
        "status": "active",
        "roles": ["admin"]
      }
    ],
    "total": 100,
    "page": 1,
    "per_page": 10
  }
}
```

### 创建用户

```
POST /api/users
```

**权限要求:** `admin`, `super_admin`

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名 |
| email | string | 是 | 邮箱 |
| password | string | 是 | 密码 |
| role_ids | array | 否 | 角色ID列表 |

**请求示例:**

```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "password123",
  "role_ids": [2]
}
```

### 获取用户详情

```
GET /api/users/:user_id
```

### 更新用户

```
PUT /api/users/:user_id
```

**权限要求:** `admin`, `super_admin`

### 删除用户

```
POST /api/users/:user_id/delete
```

**权限要求:** `admin`, `super_admin`

### 检查用户名可用性

```
GET /api/users/check-username?username=xxx&exclude_id=1
```

### 检查邮箱可用性

```
GET /api/users/check-email?email=xxx@example.com&exclude_id=1
```

### 修改密码

```
POST /api/users/:user_id/change-password
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| current_password | string | 是* | 当前密码（修改自己密码时必填） |
| new_password | string | 是 | 新密码 |

### 重置密码（管理员）

```
POST /api/users/:user_id/reset-password
```

**权限要求:** `admin`, `super_admin`

### 获取用户头像

```
GET /api/users/:user_id/avatar
```

### 更新用户头像

```
PUT /api/users/:user_id/avatar
```

**请求参数:**

```json
{
  "style": "avataaars",
  "seed": "random_seed",
  "options": {
    "backgroundColor": ["#ffffff"]
  }
}
```

### 生成随机头像

```
POST /api/users/:user_id/avatar/generate
```

---

## 角色管理接口 (Roles)

### 获取角色列表

```
GET /api/roles
```

### 创建角色

```
POST /api/roles
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 角色名称 |
| code | string | 是 | 角色代码 |
| description | string | 否 | 角色描述 |
| permissions | array | 否 | 权限列表 |

### 更新角色

```
PUT /api/roles/:role_id
```

### 删除角色

```
POST /api/roles/:role_id/delete
```

---

## 主机管理接口 (Hosts)

### 获取主机列表

```
GET /api/hosts
```

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | int | 页码 |
| per_page | int | 每页数量 |
| search | string | 搜索关键词 |
| group_id | int | 分组ID |
| status | string | 状态筛选 |

### 创建主机

```
POST /api/hosts
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 主机名称 |
| ip | string | 是 | IP地址 |
| port | int | 否 | SSH端口（默认22） |
| username | string | 是 | SSH用户名 |
| auth_type | string | 是 | 认证方式：password/key |
| password | string | 否 | SSH密码 |
| private_key | string | 否 | SSH私钥 |
| group_id | int | 否 | 分组ID |

### 测试主机连接

```
POST /api/hosts/:host_id/test
```

### 获取主机信息

```
GET /api/hosts/:host_id/info
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "cpu": {
      "cores": 4,
      "usage": 25.5
    },
    "memory": {
      "total": 8192,
      "used": 4096,
      "usage": 50.0
    },
    "disk": {
      "total": 100,
      "used": 50,
      "usage": 50.0
    }
  }
}
```

---

## 网络探测接口 (Network)

### 分组管理

#### 获取分组列表

```
GET /api/network/groups
```

**查询参数:**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | int | 1 | 页码 |
| per_page | int | 20 | 每页数量 |
| search | string | - | 搜索关键词 |

#### 获取所有分组（不分页）

```
GET /api/network/groups/all
```

#### 创建分组

```
POST /api/network/groups
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 分组名称 |
| description | string | 否 | 分组描述 |
| color | string | 否 | 颜色（如 #1890ff） |
| sort_order | int | 否 | 排序顺序 |

#### 更新分组

```
PUT /api/network/groups/:group_id
```

#### 删除分组

```
POST /api/network/groups/:group_id/delete
```

#### 获取分组统计

```
GET /api/network/groups/statistics
```

### 探测任务管理

#### 获取探测任务列表

```
GET /api/network/probes
```

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | int | 页码 |
| per_page | int | 每页数量 |
| search | string | 搜索关键词 |
| group_id | int | 分组ID |
| protocol | string | 协议类型 |
| enabled | string | 启用状态 |

#### 获取所有探测任务（不分页）

```
GET /api/network/probes/all
```

#### 创建探测任务

```
POST /api/network/probes
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 任务名称 |
| protocol | string | 是 | 协议：http/https/websocket/tcp/udp |
| target_url | string | 是 | 目标地址 |
| group_id | int | 否 | 分组ID |
| method | string | 否 | HTTP方法（默认GET） |
| headers | object | 否 | 请求头 |
| body | string | 否 | 请求体 |
| timeout | int | 否 | 超时时间（默认30秒） |
| interval_seconds | int | 否 | 探测间隔（默认60秒） |
| auto_probe_enabled | bool | 否 | 是否启用自动探测 |
| enabled | bool | 否 | 是否启用 |

**请求示例:**

```json
{
  "name": "百度首页探测",
  "protocol": "https",
  "target_url": "https://www.baidu.com",
  "method": "GET",
  "timeout": 10,
  "interval_seconds": 60,
  "auto_probe_enabled": true
}
```

#### 更新探测任务

```
PUT /api/network/probes/:probe_id
```

#### 删除探测任务

```
POST /api/network/probes/:probe_id/delete
```

#### 启动自动探测

```
POST /api/network/probes/:probe_id/start
```

#### 停止自动探测

```
POST /api/network/probes/:probe_id/stop
```

#### 执行主动探测

```
POST /api/network/probes/:probe_id/probe
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "status": "success",
    "response_time": 125,
    "status_code": 200,
    "probed_at": "2024-01-01T12:00:00Z"
  }
}
```

#### 获取探测历史

```
GET /api/network/probes/:probe_id/history
```

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | int | 页码 |
| per_page | int | 每页数量 |
| start_time | string | 开始时间 |
| end_time | string | 结束时间 |

---

## 监控告警接口 (Monitor)

### 获取告警规则列表

```
GET /api/monitor/rules
```

### 创建告警规则

```
POST /api/monitor/rules
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 规则名称 |
| metric | string | 是 | 监控指标 |
| condition | string | 是 | 条件：gt/lt/eq |
| threshold | number | 是 | 阈值 |
| duration | int | 否 | 持续时间（秒） |
| notify_channels | array | 否 | 通知渠道 |

### 获取告警历史

```
GET /api/monitor/alerts
```

### 确认告警

```
POST /api/monitor/alerts/:alert_id/acknowledge
```

---

## Ansible 接口

### 获取 Playbook 列表

```
GET /api/ansible/playbooks
```

### 创建 Playbook

```
POST /api/ansible/playbooks
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | Playbook名称 |
| content | string | 是 | YAML内容 |
| description | string | 否 | 描述 |

### 执行 Playbook

```
POST /api/ansible/playbooks/:playbook_id/execute
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| host_ids | array | 是 | 目标主机ID列表 |
| extra_vars | object | 否 | 额外变量 |

### 获取执行日志

```
GET /api/ansible/executions/:execution_id/logs
```

---

## WebSocket 接口

### SSH 终端

```
WebSocket /api/ws/terminal/:host_id
```

**消息格式:**

```json
// 输入
{ "type": "input", "data": "ls -la\n" }

// 调整大小
{ "type": "resize", "cols": 80, "rows": 24 }
```

### 探测状态 SSE

```
GET /api/network/probes/:probe_id/sse
```

**事件类型:**
- `probe_result`: 探测结果
- `status_change`: 状态变化
- `heartbeat`: 心跳

---

## 系统接口

### 健康检查

```
GET /api/health
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": "connected",
    "redis": "connected",
    "version": "1.0.0"
  }
}
```

### 系统信息

```
GET /api/system/info
```

### 操作日志

```
GET /api/logs
```

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | int | 页码 |
| per_page | int | 每页数量 |
| user_id | int | 用户ID |
| action | string | 操作类型 |
| start_time | string | 开始时间 |
| end_time | string | 结束时间 |

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| UNAUTHORIZED | 未授权，需要登录 |
| FORBIDDEN | 权限不足 |
| NOT_FOUND | 资源不存在 |
| VALIDATION_ERROR | 参数验证失败 |
| INTERNAL_ERROR | 服务器内部错误 |
| TOKEN_EXPIRED | Token已过期 |
| SESSION_EXPIRED | Session已过期 |
| CSRF_INVALID | CSRF Token无效 |

---

## 请求示例

### cURL

```bash
# 登录
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"encrypted_password"}'

# 获取用户列表
curl -X GET http://localhost:5000/api/users \
  -H "Authorization: Bearer eyJ..." \
  -H "Cookie: session_id=xxx"
```

### JavaScript (Axios)

```javascript
import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true
})

// 登录
const login = async (username, password) => {
  const response = await api.post('/auth/login', {
    username,
    password: encryptPassword(password)
  })
  return response.data
}

// 获取用户列表
const getUsers = async (page = 1) => {
  const response = await api.get('/users', {
    params: { page, per_page: 10 },
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
  return response.data
}
```

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2024-01-01 | 初始版本 |
