# SSH 主机终端功能优化方案

## 架构概述

优化后的 SSH 终端采用 **xterm.js + Flask-SocketIO + Paramiko + WebSocket 转发桥接模式**，实现高性能、低延迟的 SSH 终端连接。

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   xterm.js      │     │  Flask-SocketIO │     │    Paramiko     │
│   (前端终端)     │◄───►│   (WebSocket)   │◄───►│   (SSH 客户端)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
   用户输入/显示          事件转发/认证           SSH 连接/命令执行
```

## 核心组件

### 1. 前端组件

#### Socket.IO 客户端 (`src/services/socketio.ts`)
- 封装 Socket.IO 连接管理
- 支持自动重连、心跳检测
- 事件监听和发送

#### SSH 终端服务 (`src/services/sshTerminal.ts`)
- 管理 SSH 会话生命周期
- 处理终端输入/输出
- 支持终端大小调整

#### SSH 终端组件 (`src/components/Terminal/SSHTerminal.tsx`)
- 集成 xterm.js 终端渲染
- 自动连接和重连
- 状态指示器

#### SSH 终端容器 (`src/components/Terminal/SSHTerminalContainer.tsx`)
- 完整的终端 UI
- 工具栏（复制、粘贴、清空、主题选择）
- 错误提示和命令阻止提示

### 2. 后端组件

#### SSH 终端桥接 (`app/services/ssh_terminal_bridge.py`)
- 高性能数据转发
- 非阻塞 I/O
- 速率控制
- 空闲超时管理

#### WebSocket 事件处理 (`app/core/websocket_events.py`)
- 终端创建/销毁
- 输入/输出转发
- 终端大小调整

## 优化特性

### 性能优化
1. **非阻塞 I/O**: 使用独立的读写线程，避免阻塞
2. **缓冲区管理**: 4KB 读取缓冲区，减少系统调用
3. **速率控制**: 限制输出速率，防止客户端过载
4. **连接池**: SSH 连接复用，减少连接开销

### 稳定性优化
1. **自动重连**: Socket.IO 自动重连机制
2. **心跳检测**: 定期心跳保持连接活跃
3. **空闲超时**: 自动清理空闲会话
4. **错误恢复**: 优雅处理连接错误

### 安全特性
1. **命令过滤**: 支持危险命令拦截
2. **审计日志**: 记录所有命令执行
3. **会话隔离**: 每个用户独立会话
4. **认证集成**: JWT token 认证

## 使用方式

### 前端使用

```tsx
import { SSHTerminalContainer } from '@/components/Terminal'

function MyPage() {
  return (
    <SSHTerminalContainer
      hostId={1}
      title="SSH Terminal"
      height="500px"
      showToolbar={true}
      showThemeSelector={true}
      onBlocked={(cmd, reason) => console.log('Blocked:', cmd, reason)}
    />
  )
}
```

### 后端配置

```python
# config.yaml
ssh:
  max_connections: 10
  connection_timeout: 30
  idle_timeout: 300
  retry_attempts: 3
```

## 事件流程

### 连接流程
1. 前端调用 `/api/hosts/{id}/webshell` 创建会话
2. 前端连接 Socket.IO
3. 发送 `webshell_create_terminal` 事件
4. 后端创建 SSH 桥接
5. 返回 `webshell_terminal_created` 事件

### 数据流程
1. 用户输入 → xterm.js `onData`
2. 前端发送 `webshell_input` 事件
3. 后端写入 SSH 通道
4. SSH 输出 → 后端读取
5. 后端发送 `webshell_output` 事件
6. 前端写入 xterm.js

### 断开流程
1. 用户点击断开或关闭页面
2. 前端发送 `webshell_terminate_terminal` 事件
3. 后端关闭 SSH 桥接
4. 清理资源

## 文件清单

### 前端新增/修改
- `src/services/socketio.ts` - Socket.IO 客户端
- `src/services/sshTerminal.ts` - SSH 终端服务
- `src/components/Terminal/SSHTerminal.tsx` - SSH 终端组件
- `src/components/Terminal/SSHTerminalContainer.tsx` - SSH 终端容器
- `src/components/Terminal/index.ts` - 导出更新
- `src/pages/DevOps/WebShell/index.tsx` - WebShell 页面

### 后端新增/修改
- `app/services/ssh_terminal_bridge.py` - SSH 终端桥接服务
- `app/core/websocket_events.py` - WebSocket 事件处理更新

### 依赖
- 前端: `socket.io-client` (已安装)
- 后端: `flask-socketio`, `paramiko` (已有)

## 注意事项

1. 确保后端 Flask-SocketIO 正确配置 CORS
2. 生产环境建议使用 Redis 作为 Socket.IO 消息队列
3. 大量并发连接时注意调整系统文件描述符限制
4. 定期清理过期会话避免资源泄漏
