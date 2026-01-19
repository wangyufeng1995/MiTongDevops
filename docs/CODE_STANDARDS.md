# 代码规范和贡献指南

## 目录

- [代码规范](#代码规范)
- [Git 工作流](#git-工作流)
- [提交规范](#提交规范)
- [代码审查](#代码审查)
- [贡献流程](#贡献流程)

## 代码规范

### 前端代码规范

#### 1. 命名规范

**文件命名**:
- 组件文件: `PascalCase.tsx` (例如: `UserList.tsx`)
- 工具函数: `camelCase.ts` (例如: `formatDate.ts`)
- 类型定义: `camelCase.ts` (例如: `user.ts`)
- 样式文件: `kebab-case.css` (例如: `user-list.css`)

**变量命名**:
```typescript
// 组件名称 - PascalCase
const UserList = () => { ... };

// 函数名称 - camelCase
const getUserList = () => { ... };

// 变量名称 - camelCase
const userName = 'admin';

// 常量名称 - UPPER_SNAKE_CASE
const API_BASE_URL = 'http://localhost:5000';

// 私有变量 - 前缀下划线
const _privateVar = 'private';

// 布尔值 - is/has/can 前缀
const isLoading = false;
const hasPermission = true;
const canEdit = false;
```

#### 2. TypeScript 规范

**类型定义**:
```typescript
// 使用 interface 定义对象类型
interface User {
  id: number;
  username: string;
  email: string;
}

// 使用 type 定义联合类型或复杂类型
type Status = 'active' | 'inactive' | 'pending';
type UserWithRole = User & { role: string };

// 避免使用 any，使用 unknown 或具体类型
// ❌ 不推荐
const data: any = fetchData();

// ✅ 推荐
const data: unknown = fetchData();
const user = data as User;
```

**组件 Props**:
```typescript
// 定义 Props 接口
interface UserListProps {
  users: User[];
  onUserClick?: (user: User) => void;
  loading?: boolean;
}

// 使用 Props
const UserList: React.FC<UserListProps> = ({ users, onUserClick, loading = false }) => {
  // ...
};
```

#### 3. React 规范

**组件结构**:
```typescript
import React, { useState, useEffect } from 'react';

// 类型定义
interface Props {
  // ...
}

// 组件
const Component: React.FC<Props> = (props) => {
  // 1. Hooks
  const [state, setState] = useState();
  
  // 2. 副作用
  useEffect(() => {
    // ...
  }, []);
  
  // 3. 事件处理函数
  const handleClick = () => {
    // ...
  };
  
  // 4. 渲染
  return (
    <div>
      {/* ... */}
    </div>
  );
};

export default Component;
```

**Hooks 使用**:
```typescript
// 自定义 Hook 以 use 开头
const useUserList = () => {
  const [users, setUsers] = useState<User[]>([]);
  
  useEffect(() => {
    fetchUsers().then(setUsers);
  }, []);
  
  return { users };
};

// 使用 useMemo 优化计算
const filteredUsers = useMemo(() => {
  return users.filter(user => user.status === 'active');
}, [users]);

// 使用 useCallback 优化函数
const handleUserClick = useCallback((user: User) => {
  console.log(user);
}, []);
```

#### 4. 样式规范

**Tailwind CSS**:
```tsx
// ✅ 推荐: 使用 Tailwind 工具类
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
  <h1 className="text-2xl font-bold text-gray-900">标题</h1>
</div>

// ❌ 不推荐: 内联样式
<div style={{ display: 'flex', padding: '16px' }}>
  <h1 style={{ fontSize: '24px' }}>标题</h1>
</div>
```

**CSS Modules** (复杂样式):
```tsx
import styles from './UserList.module.css';

<div className={styles.container}>
  <h1 className={styles.title}>标题</h1>
</div>
```

### 后端代码规范

#### 1. 命名规范

**文件命名**:
- 模块文件: `snake_case.py` (例如: `user_service.py`)
- 类文件: `snake_case.py` (例如: `user_model.py`)

**变量命名**:
```python
# 类名 - PascalCase
class UserService:
    pass

# 函数名 - snake_case
def get_user_list():
    pass

# 变量名 - snake_case
user_name = 'admin'

# 常量名 - UPPER_SNAKE_CASE
API_VERSION = 'v1'

# 私有变量/方法 - 前缀下划线
_private_var = 'private'

def _private_method():
    pass
```

#### 2. Python 规范

**PEP 8 规范**:
```python
# 导入顺序
# 1. 标准库
import os
import sys

# 2. 第三方库
from flask import Flask
from sqlalchemy import Column

# 3. 本地模块
from app.models import User
from app.services import UserService

# 每行最多 79 个字符
# 使用 4 个空格缩进
# 函数和类之间空两行
# 方法之间空一行
```

**类型注解**:
```python
from typing import List, Optional, Dict, Any

def get_user_list(
    page: int = 1,
    per_page: int = 10,
    status: Optional[str] = None
) -> List[Dict[str, Any]]:
    """获取用户列表
    
    Args:
        page: 页码
        per_page: 每页数量
        status: 状态筛选
        
    Returns:
        用户列表
    """
    pass
```

**文档字符串**:
```python
def create_user(user_data: Dict[str, Any]) -> User:
    """创建用户
    
    Args:
        user_data: 用户数据字典，包含 username, email, password 等字段
        
    Returns:
        创建的用户对象
        
    Raises:
        ValueError: 当用户数据验证失败时
        DatabaseError: 当数据库操作失败时
        
    Example:
        >>> user_data = {'username': 'admin', 'email': 'admin@example.com'}
        >>> user = create_user(user_data)
        >>> print(user.username)
        'admin'
    """
    pass
```

#### 3. Flask 规范

**蓝图组织**:
```python
# app/api/users.py
from flask import Blueprint

users_bp = Blueprint('users', __name__)

@users_bp.route('/', methods=['GET'])
def get_users():
    """获取用户列表"""
    pass

@users_bp.route('/', methods=['POST'])
def create_user():
    """创建用户"""
    pass
```

**错误处理**:
```python
from flask import jsonify

@users_bp.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error_code': 'NOT_FOUND',
        'message': '资源不存在'
    }), 404

@users_bp.errorhandler(Exception)
def handle_exception(error):
    return jsonify({
        'success': False,
        'error_code': 'INTERNAL_ERROR',
        'message': str(error)
    }), 500
```

#### 4. 数据库规范

**模型定义**:
```python
from app.models.base import BaseModel
from app.extensions import db

class User(BaseModel):
    """用户模型"""
    
    __tablename__ = 'users'
    
    username = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    
    # 关系
    roles = db.relationship('Role', secondary='user_roles', backref='users')
    
    def __repr__(self):
        return f'<User {self.username}>'
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat()
        }
```

**查询优化**:
```python
# ✅ 推荐: 使用 ORM 查询
users = User.query.filter_by(tenant_id=tenant_id).all()

# ✅ 推荐: 使用分页
users = User.query.filter_by(tenant_id=tenant_id).paginate(page=1, per_page=10)

# ✅ 推荐: 使用 join 避免 N+1 查询
users = User.query.join(Role).filter(Role.name == 'admin').all()

# ❌ 不推荐: 使用原生 SQL
db.session.execute("SELECT * FROM users WHERE tenant_id = ?", [tenant_id])
```

## Git 工作流

### 分支策略

```
main (生产环境)
  ↓
develop (开发环境)
  ↓
feature/* (功能分支)
hotfix/* (紧急修复分支)
release/* (发布分支)
```

### 分支命名

- `feature/功能名称`: 新功能开发 (例如: `feature/user-avatar`)
- `bugfix/问题描述`: Bug 修复 (例如: `bugfix/login-error`)
- `hotfix/问题描述`: 紧急修复 (例如: `hotfix/security-patch`)
- `release/版本号`: 发布分支 (例如: `release/v1.0.0`)

### 工作流程

1. 从 `develop` 分支创建功能分支
2. 在功能分支上开发
3. 提交代码并推送到远程
4. 创建 Pull Request 到 `develop`
5. 代码审查通过后合并
6. 删除功能分支

## 提交规范

### Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建工具或辅助工具的变动
- `ci`: CI/CD 配置变更
- `revert`: 回滚提交

### Scope 范围

- `frontend`: 前端相关
- `backend`: 后端相关
- `api`: API 接口
- `ui`: UI 组件
- `db`: 数据库
- `config`: 配置文件
- `deps`: 依赖更新

### 提交示例

```bash
# 新功能
git commit -m "feat(user): 添加用户头像上传功能"

# Bug 修复
git commit -m "fix(auth): 修复登录 Token 过期问题"

# 文档更新
git commit -m "docs: 更新 API 文档"

# 代码重构
git commit -m "refactor(user): 重构用户服务层代码"

# 详细提交
git commit -m "feat(user): 添加用户头像上传功能

- 集成 DiceBear 头像库
- 支持多种头像风格选择
- 添加头像预览功能

Closes #123"
```

## 代码审查

### 审查清单

#### 前端代码
- [ ] 组件职责是否单一
- [ ] Props 类型是否完整
- [ ] 是否有不必要的重渲染
- [ ] 错误处理是否完善
- [ ] 是否有内存泄漏风险
- [ ] 样式是否响应式
- [ ] 是否有单元测试
- [ ] 代码是否符合规范

#### 后端代码
- [ ] API 接口是否符合 RESTful 规范
- [ ] 是否有权限控制
- [ ] 多租户数据隔离是否正确
- [ ] 错误处理是否完善
- [ ] 数据库查询是否优化
- [ ] 是否有 SQL 注入风险
- [ ] 是否有单元测试
- [ ] 代码是否符合规范

### 审查流程

1. 创建 Pull Request
2. 自动运行 CI/CD 检查
3. 指定审查人员
4. 审查人员提出意见
5. 修改代码并推送
6. 审查通过后合并

## 贡献流程

### 1. Fork 项目

在 GitHub/GitLab 上 Fork 项目到自己的账号下。

### 2. 克隆项目

```bash
git clone <your-fork-url>
cd mitong-admin
```

### 3. 添加上游仓库

```bash
git remote add upstream <original-repo-url>
```

### 4. 创建功能分支

```bash
git checkout -b feature/your-feature
```

### 5. 开发和提交

```bash
# 开发代码
# ...

# 提交代码
git add .
git commit -m "feat: 添加新功能"
```

### 6. 同步上游代码

```bash
git fetch upstream
git rebase upstream/develop
```

### 7. 推送到远程

```bash
git push origin feature/your-feature
```

### 8. 创建 Pull Request

在 GitHub/GitLab 上创建 Pull Request，描述你的更改。

### 9. 代码审查

等待维护者审查代码，根据反馈修改代码。

### 10. 合并代码

审查通过后，维护者会合并你的代码。

## 最佳实践

### 提交频率

- 小步提交，频繁提交
- 每个提交只做一件事
- 提交前运行测试
- 提交前格式化代码

### 代码质量

- 编写单元测试
- 保持代码简洁
- 避免重复代码
- 添加必要的注释
- 使用有意义的变量名

### 团队协作

- 及时同步代码
- 主动进行代码审查
- 分享技术经验
- 帮助新成员

## 工具配置

### ESLint 配置

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "no-console": "warn",
    "@typescript-eslint/no-explicit-any": "error"
  }
}
```

### Prettier 配置

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit

# 运行 lint
npm run lint

# 运行测试
npm run test

# 如果失败，阻止提交
if [ $? -ne 0 ]; then
  echo "Lint or tests failed. Please fix before committing."
  exit 1
fi
```

## 获取帮助

如有任何问题，请：

1. 查看项目文档
2. 搜索已有 Issue
3. 创建新的 Issue
4. 联系维护者

感谢您的贡献！
