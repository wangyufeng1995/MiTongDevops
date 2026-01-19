# 安全配置指南

## CSRF 保护

### 概述
系统已集成 Flask-WTF 的 CSRF 保护功能，可以防止跨站请求伪造攻击。

### 配置
CSRF 保护在 `config/app.yaml` 中配置：

```yaml
csrf:
  secret_key: "csrf-secret-key-change-in-production"
  time_limit: 3600  # CSRF token 有效期（秒）
  exempt_endpoints: []  # 免除 CSRF 检查的端点
```

### 使用方式

#### 1. 全局保护
默认情况下，所有非 GET 请求都受到 CSRF 保护。

#### 2. 免除保护
使用 `@exempt` 装饰器免除特定端点的 CSRF 检查：

```python
from flask_wtf.csrf import exempt

@auth_bp.route('/public-endpoint', methods=['POST'])
@exempt
def public_endpoint():
    return jsonify({'message': 'No CSRF required'})
```

#### 3. 手动验证
使用 `@csrf_required` 装饰器手动添加 CSRF 验证：

```python
from app.core.middleware import csrf_required

@api_bp.route('/protected', methods=['POST'])
@csrf_required
def protected_endpoint():
    return jsonify({'message': 'CSRF verified'})
```

### 前端集成

#### 1. 获取 CSRF Token
```typescript
const response = await api.get('/api/auth/csrf-token')
const csrfToken = response.data.csrf_token
```

#### 2. 发送请求
CSRF token 会自动添加到请求头中：
```
X-CSRFToken: <token_value>
```

### 错误处理
CSRF 验证失败时返回 400 状态码：

```json
{
  "success": false,
  "message": "CSRF token 验证失败",
  "error_code": "CSRF_ERROR"
}
```

## 密码安全

### RSA 加密传输
- 前端使用 RSA 公钥加密密码
- 后端使用私钥解密密码
- 密钥文件存储在 `keys/` 目录

### 密码哈希
- 使用 bcrypt 进行密码哈希
- 哈希轮数可在配置文件中调整

## JWT 安全

### Token 配置
```yaml
jwt:
  secret_key: "jwt-secret-key-change-in-production"
  access_token_expires: 3600  # 1小时
  refresh_token_expires: 2592000  # 30天
  algorithm: "HS256"
```

### 最佳实践
1. 定期轮换 JWT 密钥
2. 使用短期访问 token 和长期刷新 token
3. 实现 token 黑名单机制（可选）

## 生产环境安全检查清单

### 配置安全
- [ ] 更改所有默认密钥和密码
- [ ] 使用强密码和复杂密钥
- [ ] 启用 HTTPS
- [ ] 配置安全的 CORS 策略

### 数据库安全
- [ ] 使用专用数据库用户
- [ ] 限制数据库用户权限
- [ ] 启用数据库连接加密
- [ ] 定期备份数据库

### 服务器安全
- [ ] 配置防火墙规则
- [ ] 禁用不必要的服务
- [ ] 定期更新系统和依赖
- [ ] 配置日志监控

### 应用安全
- [ ] 启用请求频率限制
- [ ] 配置文件上传限制
- [ ] 实施输入验证和清理
- [ ] 定期安全审计

## 监控和日志

### 安全事件监控
- 登录失败次数
- CSRF 攻击尝试
- 异常 API 调用
- 权限提升尝试

### 日志配置
确保记录以下安全相关事件：
- 用户认证和授权
- 敏感操作（用户创建、权限修改等）
- 系统错误和异常
- 安全策略违规

## 应急响应

### 安全事件处理
1. 立即隔离受影响系统
2. 分析攻击向量和影响范围
3. 修复安全漏洞
4. 更新安全策略
5. 通知相关人员

### 恢复流程
1. 验证系统安全性
2. 恢复服务
3. 监控异常活动
4. 更新安全文档