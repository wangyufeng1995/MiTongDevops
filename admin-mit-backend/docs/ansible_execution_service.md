# Ansible 执行服务文档

## 概述

Ansible 执行服务提供了完整的 Ansible Playbook 执行引擎，支持执行环境管理、结果收集和实时日志推送功能。

## 核心组件

### 1. AnsibleExecutionEnvironment

执行环境管理器，负责创建和管理 Ansible 执行所需的临时文件和目录。

**主要功能：**
- 创建临时工作目录
- 生成 Ansible inventory 文件
- 创建 Playbook 文件
- 管理变量文件
- 处理 SSH 密钥文件
- 自动清理临时文件

**使用示例：**
```python
with AnsibleExecutionEnvironment("execution_123") as env:
    inventory_file = env.create_inventory(hosts)
    playbook_file = env.create_playbook(playbook_content)
    vars_file = env.create_vars_file(variables)
    # 执行完成后自动清理
```

### 2. AnsibleExecutor

Ansible 执行器，负责实际执行 ansible-playbook 命令。

**主要功能：**
- 构建 ansible-playbook 命令
- 实时读取执行输出
- 解析执行进度
- 支持执行取消
- 处理执行超时

**配置参数：**
- `timeout`: 执行超时时间（默认3600秒）
- `forks`: 并发执行数（默认5）
- `ansible_timeout`: Ansible 连接超时时间
- `gathering`: 事实收集策略

### 3. AnsibleService

Ansible 服务主类，提供高级的执行管理功能。

**主要功能：**
- 管理并发执行
- 执行状态跟踪
- WebSocket 实时推送
- 执行结果解析
- 清理已完成的执行

## API 接口

### 执行 Playbook

```http
POST /api/ansible/playbooks/{playbook_id}/execute
Content-Type: application/json
Authorization: Bearer <token>

{
    "host_ids": [1, 2, 3],
    "variables": {
        "app_name": "myapp",
        "app_port": 8080
    }
}
```

**响应：**
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

### 获取执行状态

```http
GET /api/ansible/executions/{execution_uuid}/status
Authorization: Bearer <token>
```

**响应：**
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
            "total_hosts": 3,
            "total_tasks": 10,
            "completed_tasks": 5,
            "failed_tasks": 0,
            "skipped_tasks": 0,
            "success_rate": 50.0,
            "duration": 120
        }
    }
}
```

### 取消执行

```http
POST /api/ansible/executions/{execution_uuid}/cancel
Authorization: Bearer <token>
```

## WebSocket 实时推送

### 连接到执行房间

```javascript
// 连接到 WebSocket
const socket = io('ws://localhost:5000', {
    auth: {
        token: 'your-jwt-token'
    }
});

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

#### 客户端发送事件

- `join_ansible_execution`: 加入执行房间
- `leave_ansible_execution`: 离开执行房间

#### 服务端推送事件

- `ansible_log`: 执行日志
- `ansible_progress`: 执行进度
- `ansible_status`: 执行状态变更

## 配置说明

### 应用配置 (config/app.yaml)

```yaml
app:
  ansible:
    timeout: 3600  # Playbook 执行超时时间（秒）
    forks: 5  # 并发执行数
    max_concurrent_executions: 5  # 最大并发执行数量
    work_dir: "/tmp/ansible_executions"  # 工作目录
    log_level: "INFO"  # 日志级别
    gathering: "smart"  # 事实收集策略
    host_key_checking: false  # 是否检查主机密钥
    ssh_retries: 3  # SSH 重试次数
    callback_plugins: ["profile_tasks"]  # 回调插件
```

## 安全考虑

### 1. 文件权限

- 临时工作目录权限设置为 700
- SSH 私钥文件权限设置为 600
- 执行完成后自动清理所有临时文件

### 2. 执行隔离

- 每个执行使用独立的临时目录
- 支持多租户数据隔离
- 限制最大并发执行数量

### 3. 认证和授权

- 所有 API 接口需要 JWT 认证
- 支持租户级别的数据隔离
- 记录所有操作日志

## 错误处理

### 常见错误类型

1. **AnsibleExecutionError**: Ansible 执行相关错误
2. **SSH 连接错误**: 主机连接失败
3. **YAML 格式错误**: Playbook 格式不正确
4. **权限错误**: 文件或目录权限不足
5. **超时错误**: 执行超时

### 错误处理策略

- 详细的错误日志记录
- 用户友好的错误消息
- 自动清理失败的执行环境
- WebSocket 实时错误通知

## 性能优化

### 1. 连接池管理

- 复用 SSH 连接
- 连接池大小限制
- 自动清理空闲连接

### 2. 并发控制

- 限制最大并发执行数
- 队列管理待执行任务
- 资源使用监控

### 3. 内存管理

- 及时清理临时文件
- 限制输出日志大小
- 定期清理已完成的执行记录

## 监控和日志

### 执行监控

- 实时执行状态跟踪
- 执行进度监控
- 性能指标收集

### 日志记录

- 详细的执行日志
- 错误日志记录
- 操作审计日志
- WebSocket 事件日志

## 故障排查

### 常见问题

1. **执行卡住不动**
   - 检查 SSH 连接状态
   - 验证主机认证信息
   - 查看 Ansible 执行日志

2. **权限错误**
   - 检查工作目录权限
   - 验证 SSH 用户权限
   - 确认 Playbook 权限要求

3. **WebSocket 连接失败**
   - 检查 JWT token 有效性
   - 验证网络连接
   - 查看服务器日志

### 调试方法

1. 启用详细日志输出
2. 检查执行环境文件
3. 手动执行 ansible-playbook 命令
4. 查看 WebSocket 连接状态

## 最佳实践

### 1. Playbook 编写

- 使用幂等性任务
- 添加适当的错误处理
- 设置合理的超时时间
- 使用变量参数化

### 2. 主机管理

- 定期测试 SSH 连接
- 使用密钥认证
- 配置合适的超时时间
- 监控主机状态

### 3. 执行管理

- 合理设置并发数量
- 监控执行进度
- 及时处理失败的执行
- 定期清理历史记录

## 扩展开发

### 添加新的回调插件

```python
# 在 AnsibleExecutor 中添加自定义回调
def _parse_progress(self, line: str):
    # 自定义进度解析逻辑
    if "CUSTOM_PROGRESS" in line:
        # 处理自定义进度信息
        pass
```

### 扩展 WebSocket 事件

```python
# 添加新的 WebSocket 事件处理器
@socketio.on('custom_ansible_event')
def handle_custom_event(data):
    # 处理自定义事件
    pass
```

### 自定义执行环境

```python
class CustomExecutionEnvironment(AnsibleExecutionEnvironment):
    def setup_environment(self):
        super().setup_environment()
        # 添加自定义环境设置
        pass
```