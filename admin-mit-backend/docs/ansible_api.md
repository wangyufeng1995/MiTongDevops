# Ansible 管理 API 文档

## 概述

Ansible 管理 API 提供了完整的 Ansible Playbook 和执行管理功能，包括 Playbook 的 CRUD 操作、执行管理、历史查询和统计分析。

## 认证

所有 API 接口都需要 JWT 认证，请在请求头中包含：

```
Authorization: Bearer <your-jwt-token>
```

## API 接口

### 1. Playbook 管理

#### 1.1 获取 Playbook 列表

```http
GET /api/ansible/playbooks
```

**查询参数：**
- `page` (int): 页码，默认 1
- `per_page` (int): 每页数量，默认 10
- `search` (string): 搜索关键词（名称或描述）
- `category` (string): 分类过滤
- `is_active` (boolean): 状态过滤

**响应示例：**
```json
{
    "code": 200,
    "message": "获取成功",
    "data": {
        "playbooks": [
            {
                "id": 1,
                "name": "Web服务器配置",
                "description": "配置Nginx Web服务器",
                "version": "1.0",
                "category": "web_server",
                "is_active": true,
                "execution_stats": {
                    "total_executions": 10,
                    "success_rate": 90.0
                },
                "created_at": "2024-01-01T10:00:00",
                "updated_at": "2024-01-01T10:00:00"
            }
        ],
        "pagination": {
            "page": 1,
            "per_page": 10,
            "total": 1,
            "pages": 1,
            "has_prev": false,
            "has_next": false
        }
    }
}
```

#### 1.2 创建 Playbook

```http
POST /api/ansible/playbooks
```

**请求体：**
```json
{
    "name": "新建Playbook",
    "description": "Playbook描述",
    "content": "---\n- name: Test Playbook\n  hosts: all\n  tasks:\n    - debug: msg='Hello'",
    "variables": {
        "var1": "value1"
    },
    "version": "1.0",
    "tags": ["tag1", "tag2"],
    "category": "test",
    "is_active": true
}
```

**响应示例：**
```json
{
    "code": 200,
    "message": "创建成功",
    "data": {
        "id": 2,
        "name": "新建Playbook",
        "version": "1.0",
        "created_at": "2024-01-01T10:00:00"
    }
}
```

#### 1.3 获取 Playbook 详情

```http
GET /api/ansible/playbooks/{playbook_id}
```

**响应示例：**
```json
{
    "code": 200,
    "message": "获取成功",
    "data": {
        "id": 1,
        "name": "Web服务器配置",
        "description": "配置Nginx Web服务器",
        "content": "---\n- name: Configure Web Server\n  hosts: all\n  tasks: []",
        "variables": {
            "port": 80
        },
        "version": "1.0",
        "tags": ["web", "nginx"],
        "category": "web_server",
        "is_active": true,
        "execution_stats": {
            "total_executions": 10,
            "successful_executions": 9,
            "failed_executions": 1,
            "success_rate": 90.0
        },
        "required_variables": ["port", "server_name"],
        "task_count": 3,
        "created_at": "2024-01-01T10:00:00",
        "updated_at": "2024-01-01T10:00:00"
    }
}
```

#### 1.4 更新 Playbook

```http
PUT /api/ansible/playbooks/{playbook_id}
```

**请求体：**
```json
{
    "name": "更新后的Playbook",
    "description": "更新后的描述",
    "content": "---\n- name: Updated Playbook\n  hosts: all\n  tasks: []",
    "variables": {
        "new_var": "new_value"
    },
    "tags": ["updated"],
    "is_active": true
}
```

**响应示例：**
```json
{
    "code": 200,
    "message": "更新成功",
    "data": {
        "id": 1,
        "name": "更新后的Playbook",
        "version": "1.1",
        "updated_at": "2024-01-01T11:00:00"
    }
}
```

#### 1.5 删除 Playbook

```http
POST /api/ansible/playbooks/{playbook_id}/delete
```

**响应示例：**
```json
{
    "code": 200,
    "message": "删除成功"
}
```

#### 1.6 复制 Playbook

```http
POST /api/ansible/playbooks/{playbook_id}/copy
```

**请求体：**
```json
{
    "name": "复制的Playbook",
    "description": "这是复制的Playbook",
    "is_active": true
}
```

**响应示例：**
```json
{
    "code": 200,
    "message": "复制成功",
    "data": {
        "id": 3,
        "name": "复制的Playbook",
        "version": "1.0",
        "created_at": "2024-01-01T12:00:00"
    }
}
```

#### 1.7 验证 Playbook

```http
POST /api/ansible/playbooks/{playbook_id}/validate
```

**响应示例：**
```json
{
    "code": 200,
    "message": "验证成功",
    "data": {
        "is_valid": true,
        "message": "YAML格式正确",
        "task_count": 3,
        "required_variables": ["port", "server_name"],
        "tasks": [
            {
                "name": "Install Nginx",
                "package": {
                    "name": "nginx",
                    "state": "present"
                }
            }
        ]
    }
}
```

#### 1.8 获取 Playbook 分类

```http
GET /api/ansible/playbooks/categories
```

**响应示例：**
```json
{
    "code": 200,
    "message": "获取成功",
    "data": {
        "categories": ["web_server", "database", "monitoring", "security"]
    }
}
```

### 2. Playbook 执行

#### 2.1 执行 Playbook

```http
POST /api/ansible/playbooks/{playbook_id}/execute
```

**请求体：**
```json
{
    "host_ids": [1, 2, 3],
    "variables": {
        "port": 8080,
        "server_name": "test.example.com"
    }
}
```

**响应示例：**
```json
{
    "code": 200,
    "message": "执行已启动",
    "data": {
        "execution_id": 123,
        "execution_uuid": "uuid-string",
        "status": "running"
    }
}
```

#### 2.2 获取特定 Playbook 的执行记录

```http
GET /api/ansible/playbooks/{playbook_id}/executions
```

**查询参数：**
- `page` (int): 页码，默认 1
- `per_page` (int): 每页数量，默认 10
- `status` (string): 状态过滤

**响应示例：**
```json
{
    "code": 200,
    "message": "获取成功",
    "data": {
        "playbook": {
            "id": 1,
            "name": "Web服务器配置",
            "execution_stats": {
                "total_executions": 10,
                "success_rate": 90.0
            }
        },
        "executions": [
            {
                "id": 123,
                "status": "success",
                "progress": 100,
                "started_at": "2024-01-01T10:00:00",
                "finished_at": "2024-01-01T10:05:00",
                "host_names": ["server1", "server2"],
                "execution_summary": {
                    "total_hosts": 2,
                    "success_rate": 100.0,
                    "duration": 300
                }
            }
        ],
        "pagination": {
            "page": 1,
            "per_page": 10,
            "total": 1,
            "pages": 1
        }
    }
}
```

### 3. 执行记录管理

#### 3.1 获取执行记录列表

```http
GET /api/ansible/executions
```

**查询参数：**
- `page` (int): 页码，默认 1
- `per_page` (int): 每页数量，默认 10
- `playbook_id` (int): Playbook ID 过滤
- `status` (string): 状态过滤

**响应示例：**
```json
{
    "code": 200,
    "message": "获取成功",
    "data": {
        "executions": [
            {
                "id": 123,
                "playbook_id": 1,
                "playbook_name": "Web服务器配置",
                "status": "success",
                "progress": 100,
                "started_at": "2024-01-01T10:00:00",
                "finished_at": "2024-01-01T10:05:00",
                "host_names": ["server1", "server2"],
                "executor_name": "admin",
                "execution_summary": {
                    "total_hosts": 2,
                    "total_tasks": 6,
                    "completed_tasks": 6,
                    "failed_tasks": 0,
                    "success_rate": 100.0,
                    "duration": 300
                }
            }
        ],
        "pagination": {
            "page": 1,
            "per_page": 10,
            "total": 1,
            "pages": 1
        }
    }
}
```

#### 3.2 获取执行记录详情

```http
GET /api/ansible/executions/{execution_id}
```

**响应示例：**
```json
{
    "code": 200,
    "message": "获取成功",
    "data": {
        "id": 123,
        "playbook_id": 1,
        "playbook_name": "Web服务器配置",
        "playbook_version": "1.0",
        "host_ids": [1, 2],
        "host_names": ["server1", "server2"],
        "variables": {
            "port": 8080,
            "server_name": "test.example.com"
        },
        "status": "success",
        "progress": 100,
        "output": "PLAY [Configure Web Server] *****\n...",
        "error_message": null,
        "started_at": "2024-01-01T10:00:00",
        "finished_at": "2024-01-01T10:05:00",
        "execution_summary": {
            "total_hosts": 2,
            "total_tasks": 6,
            "completed_tasks": 6,
            "failed_tasks": 0,
            "skipped_tasks": 0,
            "success_rate": 100.0,
            "duration": 300
        },
        "created_at": "2024-01-01T09:59:00"
    }
}
```

#### 3.3 取消执行

```http
POST /api/ansible/executions/{execution_uuid}/cancel
```

**响应示例：**
```json
{
    "code": 200,
    "message": "执行已取消"
}
```

#### 3.4 获取执行状态

```http
GET /api/ansible/executions/{execution_uuid}/status
```

**响应示例：**
```json
{
    "code": 200,
    "message": "获取成功",
    "data": {
        "execution_id": "uuid-string",
        "status": "running",
        "progress": 50,
        "is_running": true,
        "started_at": "2024-01-01T10:00:00",
        "finished_at": null,
        "execution_summary": {
            "total_hosts": 2,
            "total_tasks": 6,
            "completed_tasks": 3,
            "failed_tasks": 0,
            "success_rate": 50.0,
            "duration": 150
        }
    }
}
```

#### 3.5 重试执行

```http
POST /api/ansible/executions/{execution_id}/retry
```

**响应示例：**
```json
{
    "code": 200,
    "message": "重试执行已启动",
    "data": {
        "execution_id": 124,
        "execution_uuid": "new-uuid-string",
        "status": "running",
        "original_execution_id": 123
    }
}
```

### 4. 执行历史和统计

#### 4.1 获取执行历史

```http
GET /api/ansible/executions/history
```

**查询参数：**
- `page` (int): 页码，默认 1
- `per_page` (int): 每页数量，默认 20
- `playbook_id` (int): Playbook ID 过滤
- `status` (string): 状态过滤
- `start_date` (string): 开始日期 (ISO 格式)
- `end_date` (string): 结束日期 (ISO 格式)
- `executor_id` (int): 执行者 ID 过滤

**响应示例：**
```json
{
    "code": 200,
    "message": "获取成功",
    "data": {
        "executions": [
            {
                "id": 123,
                "playbook_name": "Web服务器配置",
                "status": "success",
                "started_at": "2024-01-01T10:00:00",
                "executor_name": "admin"
            }
        ],
        "pagination": {
            "page": 1,
            "per_page": 20,
            "total": 1,
            "pages": 1
        },
        "statistics": {
            "total_executions": 100,
            "success_executions": 85,
            "failed_executions": 10,
            "running_executions": 5,
            "success_rate": 85.0
        }
    }
}
```

#### 4.2 获取执行统计

```http
GET /api/ansible/executions/statistics
```

**查询参数：**
- `days` (int): 统计天数，默认 30

**响应示例：**
```json
{
    "code": 200,
    "message": "获取成功",
    "data": {
        "period": {
            "days": 30,
            "start_date": "2023-12-02T10:00:00",
            "end_date": "2024-01-01T10:00:00"
        },
        "overall": {
            "total_executions": 100,
            "success_executions": 85,
            "failed_executions": 10,
            "cancelled_executions": 3,
            "running_executions": 2,
            "success_rate": 85.0
        },
        "by_playbook": [
            {
                "playbook_id": 1,
                "playbook_name": "Web服务器配置",
                "execution_count": 50,
                "success_count": 45,
                "failed_count": 5,
                "success_rate": 90.0
            }
        ],
        "daily_trend": [
            {
                "date": "2024-01-01",
                "total": 10,
                "success": 9,
                "failed": 1
            }
        ]
    }
}
```

### 5. 服务管理

#### 5.1 获取服务状态

```http
GET /api/ansible/service/status
```

**响应示例：**
```json
{
    "code": 200,
    "message": "获取成功",
    "data": {
        "running_executions": 3,
        "max_concurrent_executions": 5,
        "running_execution_ids": ["uuid1", "uuid2", "uuid3"]
    }
}
```

#### 5.2 清理服务

```http
POST /api/ansible/service/cleanup
```

**响应示例：**
```json
{
    "code": 200,
    "message": "清理完成"
}
```

## 错误响应

所有 API 在出错时都会返回统一的错误格式：

```json
{
    "code": 400,
    "message": "错误描述"
}
```

### 常见错误码

- `400`: 请求参数错误
- `401`: 未认证
- `403`: 权限不足
- `404`: 资源不存在
- `500`: 服务器内部错误

## WebSocket 实时推送

### 连接执行房间

```javascript
// 加入执行房间
socket.emit('join_ansible_execution', {
    execution_id: 'execution-uuid'
});

// 监听执行日志
socket.on('ansible_log', (data) => {
    console.log('日志:', data.message);
});

// 监听执行进度
socket.on('ansible_progress', (data) => {
    console.log('进度:', data.current_task);
});

// 监听执行状态
socket.on('ansible_status', (data) => {
    console.log('状态:', data.status, '进度:', data.progress);
});
```

### WebSocket 事件

#### 客户端发送

- `join_ansible_execution`: 加入执行房间
- `leave_ansible_execution`: 离开执行房间

#### 服务端推送

- `ansible_log`: 执行日志
- `ansible_progress`: 执行进度
- `ansible_status`: 执行状态变更

## 使用示例

### 创建并执行 Playbook

```javascript
// 1. 创建 Playbook
const createResponse = await fetch('/api/ansible/playbooks', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        name: 'Nginx 配置',
        content: `---
- name: Configure Nginx
  hosts: all
  tasks:
    - name: Install Nginx
      package:
        name: nginx
        state: present`,
        variables: {
            port: 80
        },
        category: 'web_server'
    })
});

const playbook = await createResponse.json();

// 2. 执行 Playbook
const executeResponse = await fetch(`/api/ansible/playbooks/${playbook.data.id}/execute`, {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        host_ids: [1, 2],
        variables: {
            port: 8080
        }
    })
});

const execution = await executeResponse.json();

// 3. 监控执行状态
const statusResponse = await fetch(`/api/ansible/executions/${execution.data.execution_uuid}/status`, {
    headers: {
        'Authorization': 'Bearer ' + token
    }
});

const status = await statusResponse.json();
console.log('执行状态:', status.data.status);
```

### 获取执行统计

```javascript
// 获取最近30天的执行统计
const statsResponse = await fetch('/api/ansible/executions/statistics?days=30', {
    headers: {
        'Authorization': 'Bearer ' + token
    }
});

const stats = await statsResponse.json();
console.log('成功率:', stats.data.overall.success_rate + '%');
console.log('按 Playbook 统计:', stats.data.by_playbook);
```

## 最佳实践

### 1. 分页处理

对于列表接口，建议使用分页参数：

```javascript
const response = await fetch('/api/ansible/playbooks?page=1&per_page=20');
```

### 2. 错误处理

始终检查响应状态和错误信息：

```javascript
const response = await fetch('/api/ansible/playbooks');
const result = await response.json();

if (result.code !== 200) {
    console.error('API 错误:', result.message);
    return;
}

// 处理成功响应
console.log('数据:', result.data);
```

### 3. 实时监控

对于长时间运行的执行，使用 WebSocket 进行实时监控：

```javascript
// 连接 WebSocket
const socket = io();

// 加入执行房间
socket.emit('join_ansible_execution', {
    execution_id: executionUuid
});

// 监听状态变更
socket.on('ansible_status', (data) => {
    if (data.status === 'success') {
        console.log('执行完成');
        // 离开房间
        socket.emit('leave_ansible_execution', {
            execution_id: executionUuid
        });
    }
});
```

### 4. 批量操作

对于批量操作，建议使用适当的并发控制：

```javascript
// 批量执行多个 Playbook
const executions = await Promise.all(
    playbookIds.map(async (id) => {
        const response = await fetch(`/api/ansible/playbooks/${id}/execute`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                host_ids: targetHosts,
                variables: commonVariables
            })
        });
        return response.json();
    })
);
```