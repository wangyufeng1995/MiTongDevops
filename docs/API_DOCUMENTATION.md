# API 接口文档

## 目录

- [API 概述](#api-概述)
- [认证接口](#认证接口)
- [用户管理接口](#用户管理接口)
- [角色管理接口](#角色管理接口)
- [菜单管理接口](#菜单管理接口)
- [主机管理接口](#主机管理接口)
- [Ansible 管理接口](#ansible-管理接口)
- [监控告警接口](#监控告警接口)
- [网络探测接口](#网络探测接口)
- [错误码说明](#错误码说明)

## API 概述

### 基础信息

- **Base URL**: `http://localhost:5000/api`
- **协议**: HTTP/HTTPS
- **数据格式**: JSON
- **字符编码**: UTF-8
- **API 版本**: v1

### 通用请求头

```http
Content-Type: application/json
Authorization: Bearer <access_token>
X-Tenant-ID: <tenant_id>
```

### 通用响应格式

**成功响应**:
```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

**失败响应**:
```json
{
  "success": false,
  "error_code": "ERROR_CODE",
  "message": "错误信息",
  "details": { ... }
}
```

### 分页参数

```
page: 页码（从 1 开始）
per_page: 每页数量（默认 10）
```

### 分页响应

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "total": 100,
    "page": 1,
    "per_page": 10,
    "pages": 10
  }
}
```

## 认证接口

### 1. 获取 RSA 公钥

获取用于密码加密的 RSA 公钥。

**请求**:
```http
GET /api/auth/public-key
```

**响应**:
```json
{
  "success": true,
  "data": {
    "public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
  }
}
```

### 2. 用户登录

使用用户名和密码登录系统。

**请求**:
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "encrypted_password",  // RSA 加密后的密码
  "tenant_code": "default"           // 可选，租户代码
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "full_name": "管理员",
      "tenant_id": 1,
      "tenant_name": "默认租户",
      "roles": ["admin"]
    }
  }
}
```

### 3. 刷新 Token

使用 Refresh Token 刷新 Access Token。

**请求**:
```http
POST /api/auth/refresh
Authorization: Bearer <refresh_token>
```

**响应**:
```json
{
  "success": true,
  "data": {
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "token_type": "Bearer",
    "expires_in": 3600
  }
}
```

### 4. 用户登出

登出当前用户。

**请求**:
```http
POST /api/auth/logout
Authorization: Bearer <access_token>
```

**响应**:
```json
{
  "success": true,
  "message": "登出成功"
}
```

## 用户管理接口

### 1. 获取用户列表

获取用户列表，支持分页和搜索。

**请求**:
```http
GET /api/users?page=1&per_page=10&search=admin&status=1
Authorization: Bearer <access_token>
```

**查询参数**:
- `page`: 页码（默认 1）
- `per_page`: 每页数量（默认 10）
- `search`: 搜索关键词（用户名或邮箱）
- `status`: 状态筛选（1-启用，0-禁用）

**响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "username": "admin",
        "email": "admin@example.com",
        "full_name": "管理员",
        "avatar_style": "avataaars",
        "avatar_seed": "admin",
        "status": 1,
        "roles": [
          {
            "id": 1,
            "name": "管理员"
          }
        ],
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "per_page": 10,
    "pages": 1
  }
}
```

### 2. 获取用户详情

获取指定用户的详细信息。

**请求**:
```http
GET /api/users/{id}
Authorization: Bearer <access_token>
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "full_name": "管理员",
    "avatar_style": "avataaars",
    "avatar_seed": "admin",
    "avatar_config": {
      "backgroundColor": ["b6e3f4"],
      "accessories": ["prescription02"]
    },
    "status": 1,
    "roles": [
      {
        "id": 1,
        "name": "管理员",
        "permissions": ["user:read", "user:write"]
      }
    ],
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

### 3. 创建用户

创建新用户。

**请求**:
```http
POST /api/users
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "encrypted_password",  // RSA 加密后的密码
  "full_name": "新用户",
  "avatar_style": "avataaars",
  "avatar_seed": "newuser",
  "role_ids": [2],
  "status": 1
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": 2,
    "username": "newuser",
    "email": "newuser@example.com",
    "full_name": "新用户",
    "status": 1,
    "created_at": "2024-01-01T00:00:00Z"
  },
  "message": "用户创建成功"
}
```

### 4. 更新用户

更新用户信息。

**请求**:
```http
PUT /api/users/{id}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "email": "updated@example.com",
  "full_name": "更新后的名称",
  "role_ids": [2, 3],
  "status": 1
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": 2,
    "username": "newuser",
    "email": "updated@example.com",
    "full_name": "更新后的名称",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "message": "用户更新成功"
}
```

### 5. 删除用户

删除指定用户。

**请求**:
```http
POST /api/users/{id}/delete
Authorization: Bearer <access_token>
```

**响应**:
```json
{
  "success": true,
  "message": "用户删除成功"
}
```

### 6. 获取用户头像信息

获取用户的头像配置信息。

**请求**:
```http
GET /api/users/{id}/avatar
Authorization: Bearer <access_token>
```

**响应**:
```json
{
  "success": true,
  "data": {
    "avatar_style": "avataaars",
    "avatar_seed": "admin",
    "avatar_config": {
      "backgroundColor": ["b6e3f4"],
      "accessories": ["prescription02"]
    },
    "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=admin&..."
  }
}
```

### 7. 更新用户头像

更新用户的头像配置。

**请求**:
```http
PUT /api/users/{id}/avatar
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "avatar_style": "avataaars",
  "avatar_seed": "admin",
  "avatar_config": {
    "backgroundColor": ["b6e3f4"],
    "accessories": ["prescription02"]
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=admin&..."
  },
  "message": "头像更新成功"
}
```

### 8. 生成随机头像

为用户生成随机头像。

**请求**:
```http
POST /api/users/{id}/avatar/generate
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "avatar_style": "avataaars"  // 可选，默认使用当前风格
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "avatar_seed": "random_seed_123",
    "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=random_seed_123"
  },
  "message": "头像生成成功"
}
```

## 角色管理接口

### 1. 获取角色列表

获取角色列表。

**请求**:
```http
GET /api/roles?page=1&per_page=10
Authorization: Bearer <access_token>
```

**响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "管理员",
        "description": "系统管理员角色",
        "permissions": ["user:read", "user:write", "role:read", "role:write"],
        "user_count": 5,
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "per_page": 10,
    "pages": 1
  }
}
```

### 2. 创建角色

创建新角色。

**请求**:
```http
POST /api/roles
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "运维人员",
  "description": "负责系统运维",
  "permissions": ["host:read", "host:write", "ansible:execute"]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "运维人员",
    "description": "负责系统运维",
    "permissions": ["host:read", "host:write", "ansible:execute"],
    "created_at": "2024-01-01T00:00:00Z"
  },
  "message": "角色创建成功"
}
```

### 3. 更新角色

更新角色信息。

**请求**:
```http
PUT /api/roles/{id}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "高级运维人员",
  "description": "负责高级系统运维",
  "permissions": ["host:read", "host:write", "ansible:execute", "monitor:read"]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "高级运维人员",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "message": "角色更新成功"
}
```

### 4. 删除角色

删除指定角色。

**请求**:
```http
POST /api/roles/{id}/delete
Authorization: Bearer <access_token>
```

**响应**:
```json
{
  "success": true,
  "message": "角色删除成功"
}
```

完整的 API 文档请参考在线 Swagger 文档: http://localhost:5000/api/docs
