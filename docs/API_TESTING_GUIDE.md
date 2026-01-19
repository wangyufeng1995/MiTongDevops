# API 测试指南

## 目录

- [测试工具](#测试工具)
- [环境准备](#环境准备)
- [认证测试](#认证测试)
- [用户管理测试](#用户管理测试)
- [自动化测试](#自动化测试)
- [性能测试](#性能测试)

## 测试工具

### 推荐工具

1. **Postman**: 功能强大的 API 测试工具
2. **curl**: 命令行 HTTP 客户端
3. **HTTPie**: 用户友好的命令行 HTTP 客户端
4. **pytest**: Python 自动化测试框架

### Postman 集合

导入 Postman 集合文件: `postman/MiTong_API.postman_collection.json`

## 环境准备

### 1. 配置环境变量

在 Postman 中配置环境变量：

```json
{
  "base_url": "http://localhost:5000/api",
  "access_token": "",
  "refresh_token": "",
  "tenant_id": "1"
}
```

### 2. 启动服务

```bash
# 启动后端服务
cd admin-mit-backend
python app.py

# 启动前端服务（可选）
cd admin-mit-ui
npm run dev
```

## 认证测试

### 1. 获取 RSA 公钥

**curl 示例**:
```bash
curl -X GET http://localhost:5000/api/auth/public-key
```

**HTTPie 示例**:
```bash
http GET http://localhost:5000/api/auth/public-key
```

**预期响应**:
```json
{
  "success": true,
  "data": {
    "public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
  }
}
```

### 2. 用户登录

**curl 示例**:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123",
    "tenant_code": "default"
  }'
```

**HTTPie 示例**:
```bash
http POST http://localhost:5000/api/auth/login \
  username=admin \
  password=admin123 \
  tenant_code=default
```

**预期响应**:
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
      "email": "admin@example.com"
    }
  }
}
```

### 3. 刷新 Token

**curl 示例**:
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Authorization: Bearer <refresh_token>"
```

**预期响应**:
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

## 用户管理测试

### 1. 获取用户列表

**curl 示例**:
```bash
curl -X GET "http://localhost:5000/api/users?page=1&per_page=10" \
  -H "Authorization: Bearer <access_token>"
```

**HTTPie 示例**:
```bash
http GET http://localhost:5000/api/users \
  page==1 \
  per_page==10 \
  Authorization:"Bearer <access_token>"
```

### 2. 创建用户

**curl 示例**:
```bash
curl -X POST http://localhost:5000/api/users \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "encrypted_password",
    "full_name": "测试用户",
    "role_ids": [2],
    "status": 1
  }'
```

### 3. 更新用户

**curl 示例**:
```bash
curl -X PUT http://localhost:5000/api/users/2 \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "updated@example.com",
    "full_name": "更新后的用户"
  }'
```

### 4. 删除用户

**curl 示例**:
```bash
curl -X POST http://localhost:5000/api/users/2/delete \
  -H "Authorization: Bearer <access_token>"
```

## 自动化测试

### pytest 测试示例

```python
import pytest
import requests

BASE_URL = "http://localhost:5000/api"

@pytest.fixture
def auth_token():
    """获取认证 Token"""
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    assert response.status_code == 200
    data = response.json()
    return data['data']['access_token']

def test_get_users(auth_token):
    """测试获取用户列表"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.get(f"{BASE_URL}/users", headers=headers)
    
    assert response.status_code == 200
    data = response.json()
    assert data['success'] is True
    assert 'items' in data['data']

def test_create_user(auth_token):
    """测试创建用户"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123",
        "full_name": "测试用户"
    }
    response = requests.post(f"{BASE_URL}/users", json=user_data, headers=headers)
    
    assert response.status_code == 201
    data = response.json()
    assert data['success'] is True
    assert data['data']['username'] == 'testuser'

def test_update_user(auth_token):
    """测试更新用户"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    update_data = {
        "email": "updated@example.com"
    }
    response = requests.put(f"{BASE_URL}/users/2", json=update_data, headers=headers)
    
    assert response.status_code == 200
    data = response.json()
    assert data['success'] is True

def test_delete_user(auth_token):
    """测试删除用户"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.post(f"{BASE_URL}/users/2/delete", headers=headers)
    
    assert response.status_code == 200
    data = response.json()
    assert data['success'] is True
```

### 运行测试

```bash
# 运行所有测试
pytest tests/test_api.py

# 运行特定测试
pytest tests/test_api.py::test_get_users

# 详细输出
pytest tests/test_api.py -v

# 生成测试报告
pytest tests/test_api.py --html=report.html
```

## 性能测试

### 使用 Apache Bench

```bash
# 测试登录接口
ab -n 1000 -c 10 -p login.json -T application/json \
  http://localhost:5000/api/auth/login

# 测试获取用户列表接口
ab -n 1000 -c 10 -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/users
```

### 使用 wrk

```bash
# 测试获取用户列表接口
wrk -t 4 -c 100 -d 30s \
  -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/users
```

## 测试最佳实践

1. **使用环境变量**: 不要在代码中硬编码 URL 和 Token
2. **清理测试数据**: 每次测试后清理创建的数据
3. **独立测试**: 每个测试应该独立运行
4. **断言完整**: 验证响应状态码、数据结构和内容
5. **错误测试**: 测试各种错误场景
6. **性能基准**: 建立性能基准，定期测试

## 常见问题

### Q1: 401 Unauthorized

**原因**: Token 无效或已过期

**解决**: 重新登录获取新的 Token

### Q2: 403 Forbidden

**原因**: 无权限访问

**解决**: 检查用户角色和权限配置

### Q3: 429 Too Many Requests

**原因**: 请求频率超限

**解决**: 降低请求频率或增加频率限制

## 参考资料

- [Postman 文档](https://learning.postman.com/)
- [pytest 文档](https://docs.pytest.org/)
- [HTTPie 文档](https://httpie.io/docs)
