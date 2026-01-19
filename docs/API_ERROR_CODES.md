# API 错误码说明

## 错误响应格式

```json
{
  "success": false,
  "error_code": "ERROR_CODE",
  "message": "错误信息描述",
  "details": {
    "field": "字段名",
    "value": "字段值"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## HTTP 状态码

| 状态码 | 说明 | 使用场景 |
|--------|------|----------|
| 200 | OK | 请求成功 |
| 201 | Created | 资源创建成功 |
| 204 | No Content | 请求成功但无返回内容 |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 未认证或认证失败 |
| 403 | Forbidden | 无权限访问 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突 |
| 422 | Unprocessable Entity | 请求格式正确但语义错误 |
| 429 | Too Many Requests | 请求频率超限 |
| 500 | Internal Server Error | 服务器内部错误 |
| 503 | Service Unavailable | 服务暂时不可用 |

## 业务错误码

### 通用错误 (1000-1999)

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| INVALID_REQUEST | 400 | 无效的请求 |
| MISSING_PARAMETER | 400 | 缺少必需参数 |
| INVALID_PARAMETER | 400 | 参数格式错误 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |
| SERVICE_UNAVAILABLE | 503 | 服务暂时不可用 |
| RATE_LIMIT_EXCEEDED | 429 | 请求频率超限 |

### 认证错误 (2000-2999)

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| UNAUTHORIZED | 401 | 未认证 |
| INVALID_TOKEN | 401 | Token 无效 |
| TOKEN_EXPIRED | 401 | Token 已过期 |
| INVALID_CREDENTIALS | 401 | 用户名或密码错误 |
| ACCOUNT_DISABLED | 403 | 账号已禁用 |
| ACCOUNT_LOCKED | 403 | 账号已锁定 |
| PERMISSION_DENIED | 403 | 无权限访问 |

### 用户错误 (3000-3999)

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| USER_NOT_FOUND | 404 | 用户不存在 |
| USER_ALREADY_EXISTS | 409 | 用户已存在 |
| USERNAME_TAKEN | 409 | 用户名已被占用 |
| EMAIL_TAKEN | 409 | 邮箱已被占用 |
| INVALID_PASSWORD | 400 | 密码格式不正确 |
| PASSWORD_TOO_WEAK | 400 | 密码强度不够 |
| USER_CREATE_FAILED | 500 | 用户创建失败 |
| USER_UPDATE_FAILED | 500 | 用户更新失败 |
| USER_DELETE_FAILED | 500 | 用户删除失败 |

### 角色错误 (4000-4999)

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| ROLE_NOT_FOUND | 404 | 角色不存在 |
| ROLE_ALREADY_EXISTS | 409 | 角色已存在 |
| ROLE_IN_USE | 409 | 角色正在使用中 |
| ROLE_CREATE_FAILED | 500 | 角色创建失败 |
| ROLE_UPDATE_FAILED | 500 | 角色更新失败 |
| ROLE_DELETE_FAILED | 500 | 角色删除失败 |

### 主机错误 (5000-5999)

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| HOST_NOT_FOUND | 404 | 主机不存在 |
| HOST_ALREADY_EXISTS | 409 | 主机已存在 |
| HOST_CONNECTION_FAILED | 500 | 主机连接失败 |
| HOST_AUTH_FAILED | 401 | 主机认证失败 |
| HOST_TIMEOUT | 408 | 主机连接超时 |
| SSH_ERROR | 500 | SSH 连接错误 |
| WEBSHELL_SESSION_NOT_FOUND | 404 | WebShell 会话不存在 |
| WEBSHELL_SESSION_EXPIRED | 410 | WebShell 会话已过期 |

### Ansible 错误 (6000-6999)

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| PLAYBOOK_NOT_FOUND | 404 | Playbook 不存在 |
| PLAYBOOK_INVALID | 400 | Playbook 格式错误 |
| PLAYBOOK_EXECUTION_FAILED | 500 | Playbook 执行失败 |
| EXECUTION_NOT_FOUND | 404 | 执行记录不存在 |
| EXECUTION_IN_PROGRESS | 409 | Playbook 正在执行中 |

### 监控告警错误 (7000-7999)

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| CHANNEL_NOT_FOUND | 404 | 告警渠道不存在 |
| CHANNEL_TEST_FAILED | 500 | 告警渠道测试失败 |
| RULE_NOT_FOUND | 404 | 告警规则不存在 |
| RULE_INVALID | 400 | 告警规则配置错误 |
| ALERT_NOT_FOUND | 404 | 告警记录不存在 |
| NOTIFICATION_FAILED | 500 | 告警通知发送失败 |

### 网络探测错误 (8000-8999)

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| PROBE_NOT_FOUND | 404 | 探测任务不存在 |
| PROBE_ALREADY_RUNNING | 409 | 探测任务已在运行 |
| PROBE_NOT_RUNNING | 409 | 探测任务未运行 |
| PROBE_EXECUTION_FAILED | 500 | 探测执行失败 |
| PROBE_GROUP_NOT_FOUND | 404 | 探测分组不存在 |
| PROBE_GROUP_IN_USE | 409 | 探测分组正在使用中 |
| PROBE_GROUP_IS_DEFAULT | 409 | 默认分组不能删除 |

## 错误处理示例

### 前端错误处理

```typescript
import axios from 'axios';

// 响应拦截器
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // Token 过期，跳转登录
          if (data.error_code === 'TOKEN_EXPIRED') {
            // 尝试刷新 Token
            refreshToken();
          } else {
            // 跳转登录页
            router.push('/login');
          }
          break;
          
        case 403:
          // 无权限
          message.error('无权限访问');
          break;
          
        case 404:
          // 资源不存在
          message.error(data.message || '资源不存在');
          break;
          
        case 429:
          // 请求频率超限
          message.error('请求过于频繁，请稍后再试');
          break;
          
        case 500:
          // 服务器错误
          message.error('服务器错误，请稍后再试');
          break;
          
        default:
          message.error(data.message || '请求失败');
      }
    } else if (error.request) {
      // 网络错误
      message.error('网络连接失败，请检查网络');
    } else {
      // 其他错误
      message.error('请求失败');
    }
    
    return Promise.reject(error);
  }
);
```

### 后端错误处理

```python
from flask import jsonify
from datetime import datetime

class APIError(Exception):
    """API 错误基类"""
    def __init__(self, error_code, message, status_code=400, details=None):
        self.error_code = error_code
        self.message = message
        self.status_code = status_code
        self.details = details or {}

def handle_api_error(error):
    """处理 API 错误"""
    response = {
        'success': False,
        'error_code': error.error_code,
        'message': error.message,
        'details': error.details,
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }
    return jsonify(response), error.status_code

# 注册错误处理器
app.register_error_handler(APIError, handle_api_error)

# 使用示例
@app.route('/api/users/<int:user_id>')
def get_user(user_id):
    user = User.query.get(user_id)
    if not user:
        raise APIError(
            error_code='USER_NOT_FOUND',
            message='用户不存在',
            status_code=404,
            details={'user_id': user_id}
        )
    return jsonify({'success': True, 'data': user.to_dict()})
```

## 错误码版本管理

### 版本规则

- 错误码一旦定义，不应修改或删除
- 新增错误码应添加到对应的错误码范围
- 废弃的错误码应标记为 `DEPRECATED`

### 版本历史

#### v1.0.0 (2024-01-01)
- 初始版本
- 定义通用错误码 (1000-1999)
- 定义认证错误码 (2000-2999)
- 定义用户错误码 (3000-3999)
- 定义角色错误码 (4000-4999)
- 定义主机错误码 (5000-5999)
- 定义 Ansible 错误码 (6000-6999)
- 定义监控告警错误码 (7000-7999)
- 定义网络探测错误码 (8000-8999)

## 最佳实践

### 1. 错误信息国际化

```python
# 错误信息字典
ERROR_MESSAGES = {
    'en': {
        'USER_NOT_FOUND': 'User not found',
        'INVALID_PASSWORD': 'Invalid password'
    },
    'zh': {
        'USER_NOT_FOUND': '用户不存在',
        'INVALID_PASSWORD': '密码格式不正确'
    }
}

def get_error_message(error_code, lang='zh'):
    return ERROR_MESSAGES.get(lang, {}).get(error_code, 'Unknown error')
```

### 2. 错误日志记录

```python
import logging

logger = logging.getLogger(__name__)

def handle_api_error(error):
    # 记录错误日志
    logger.error(f'API Error: {error.error_code} - {error.message}', extra={
        'error_code': error.error_code,
        'status_code': error.status_code,
        'details': error.details
    })
    
    response = {
        'success': False,
        'error_code': error.error_code,
        'message': error.message,
        'details': error.details
    }
    return jsonify(response), error.status_code
```

### 3. 错误监控和告警

- 监控 5xx 错误率
- 监控特定错误码的频率
- 设置错误率告警阈值
- 定期分析错误日志

## 参考资料

- [HTTP 状态码](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Status)
- [REST API 错误处理最佳实践](https://www.rfc-editor.org/rfc/rfc7807)
- [Google API 设计指南](https://cloud.google.com/apis/design/errors)
