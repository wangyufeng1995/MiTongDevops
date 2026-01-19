# WebShell API 接口文档

## 概述

WebShell API 提供了基于 Web 的 SSH 终端功能，允许用户通过浏览器连接和管理远程主机。

## 接口列表

### 1. 创建 WebShell 会话

**接口地址：** `POST /api/hosts/{host_id}/webshell`

**功能描述：** 为指定主机创建一个新的 WebShell 会话

**请求参数：**
```json
{
  "cols": 80,    // 终端列数，可选，默认80
  "rows": 24     // 终端行数，可选，默认24
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "session_id": "uuid-string",
    "host_id": 1,
    "host_name": "测试主机",
    "hostname": "192.168.1.100",
    "username": "testuser",
    "terminal_size": {
      "cols": 80,
      "rows": 24
    },
    "created_at": "2024-01-01T12:00:00Z"
  },
  "message": "WebShell 会话创建成功"
}
```

### 2. 获取 WebShell 会话信息

**接口地址：** `GET /api/hosts/webshell/{session_id}`

**功能描述：** 获取指定 WebShell 会话的详细信息

**响应示例：**
```json
{
  "success": true,
  "data": {
    "session_id": "uuid-string",
    "host_id": 1,
    "host_name": "测试主机",
    "hostname": "192.168.1.100",
    "username": "testuser",
    "status": "active",
    "terminal_size": {
      "cols": 80,
      "rows": 24
    },
    "created_at": "2024-01-01T12:00:00Z",
    "last_activity": "2024-01-01T12:05:00Z",
    "is_active": true
  }
}
```

### 3. 获取 WebShell 会话状态

**接口地址：** `GET /api/hosts/webshell/{session_id}/status`

**功能描述：** 获取 WebShell 会话的实时状态信息

**响应示例：**
```json
{
  "success": true,
  "data": {
    "session_id": "uuid-string",
    "webshell_status": "active",
    "terminal_active": true,
    "last_activity": "2024-01-01T12:05:00Z",
    "created_at": "2024-01-01T12:00:00Z",
    "is_connected": true
  }
}
```

### 4. 获取命令历史记录

**接口地址：** `GET /api/hosts/webshell/{session_id}/history`

**功能描述：** 获取 WebShell 会话的命令执行历史

**查询参数：**
- `limit`: 返回记录数量限制，默认100，最大1000

**响应示例：**
```json
{
  "success": true,
  "data": {
    "session_id": "uuid-string",
    "history": [
      {
        "command": "ls -la",
        "output": "total 8\ndrwxr-xr-x 2 user user 4096 Jan  1 12:00 .",
        "error": "",
        "exit_code": 0,
        "executed_at": "2024-01-01T12:01:00Z",
        "execution_time": 0.123
      }
    ],
    "total_count": 1
  }
}
```

### 5. 执行命令

**接口地址：** `POST /api/hosts/webshell/{session_id}/execute`

**功能描述：** 在 WebShell 会话中执行指定命令

**请求参数：**
```json
{
  "command": "ls -la",  // 要执行的命令
  "timeout": 30         // 超时时间（秒），可选，默认30
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "session_id": "uuid-string",
    "command_record": {
      "command": "ls -la",
      "output": "total 8\ndrwxr-xr-x 2 user user 4096 Jan  1 12:00 .",
      "error": "",
      "exit_code": 0,
      "executed_at": "2024-01-01T12:01:00Z",
      "execution_time": 0.123
    },
    "executed_at": "2024-01-01T12:01:00Z"
  },
  "message": "命令执行成功"
}
```

### 6. 调整终端大小

**接口地址：** `POST /api/hosts/webshell/{session_id}/resize`

**功能描述：** 调整 WebShell 终端的显示大小

**请求参数：**
```json
{
  "cols": 100,  // 终端列数，范围：10-300
  "rows": 30    // 终端行数，范围：5-100
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "session_id": "uuid-string",
    "terminal_size": {
      "cols": 100,
      "rows": 30
    }
  },
  "message": "终端大小调整成功"
}
```

### 7. 终止 WebShell 会话

**接口地址：** `POST /api/hosts/webshell/{session_id}/terminate`

**功能描述：** 终止指定的 WebShell 会话

**响应示例：**
```json
{
  "success": true,
  "data": {
    "session_id": "uuid-string",
    "terminated_at": "2024-01-01T12:10:00Z"
  },
  "message": "WebShell 会话已终止"
}
```

### 8. 获取用户会话列表

**接口地址：** `GET /api/hosts/webshell/sessions`

**功能描述：** 获取当前用户的所有 WebShell 会话列表

**响应示例：**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "session_id": "uuid-string-1",
        "host_id": 1,
        "host_name": "主机1",
        "hostname": "192.168.1.100",
        "username": "user1",
        "webshell_status": "active",
        "terminal_active": true,
        "terminal_size": {
          "cols": 80,
          "rows": 24
        },
        "created_at": "2024-01-01T12:00:00Z",
        "last_activity": "2024-01-01T12:05:00Z",
        "is_connected": true
      }
    ],
    "total_count": 1
  }
}
```

## WebSocket 事件

WebShell 还支持通过 WebSocket 进行实时交互：

### 连接事件
- `webshell_create_terminal`: 创建终端会话
- `webshell_input`: 发送终端输入
- `webshell_execute_command`: 执行命令
- `webshell_resize`: 调整终端大小
- `webshell_get_history`: 获取命令历史
- `webshell_terminate_terminal`: 终止终端会话

### 响应事件
- `webshell_terminal_created`: 终端会话创建成功
- `webshell_output`: 终端输出数据
- `webshell_command_result`: 命令执行结果
- `webshell_resized`: 终端大小调整完成
- `webshell_history`: 命令历史数据
- `webshell_terminal_terminated`: 终端会话已终止
- `webshell_error`: 错误信息

## 错误码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 403 | 无权限访问 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 使用示例

### 创建并使用 WebShell 会话

```javascript
// 1. 创建会话
const response = await fetch('/api/hosts/1/webshell', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-jwt-token'
  },
  body: JSON.stringify({
    cols: 80,
    rows: 24
  })
});

const { data } = await response.json();
const sessionId = data.session_id;

// 2. 执行命令
const cmdResponse = await fetch(`/api/hosts/webshell/${sessionId}/execute`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-jwt-token'
  },
  body: JSON.stringify({
    command: 'ls -la',
    timeout: 30
  })
});

// 3. 获取命令历史
const historyResponse = await fetch(`/api/hosts/webshell/${sessionId}/history?limit=50`, {
  headers: {
    'Authorization': 'Bearer your-jwt-token'
  }
});

// 4. 终止会话
await fetch(`/api/hosts/webshell/${sessionId}/terminate`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-jwt-token'
  }
});
```

## 安全注意事项

1. **认证授权**：所有接口都需要有效的 JWT token
2. **权限验证**：用户只能访问自己创建的会话
3. **会话管理**：会话有超时机制，长时间不活动会自动清理
4. **命令限制**：可以根据需要限制某些危险命令的执行
5. **日志记录**：所有命令执行都会被记录用于审计

## 性能优化

1. **连接池**：使用 SSH 连接池提高连接复用率
2. **缓存机制**：命令历史使用 Redis 缓存
3. **异步处理**：终端输入输出使用异步线程处理
4. **资源清理**：定期清理过期会话和连接