# 开发指南

本文档为 MiTong 运维平台的开发指南，帮助开发者快速上手项目开发。

## 目录

- [环境准备](#环境准备)
- [项目结构](#项目结构)
- [前端开发](#前端开发)
- [后端开发](#后端开发)
- [数据库操作](#数据库操作)
- [测试指南](#测试指南)
- [调试技巧](#调试技巧)
- [代码规范](#代码规范)
- [Git 工作流](#git-工作流)

---

## 环境准备

### 系统要求

- Node.js 18.0.0+
- Python 3.9.0+
- PostgreSQL 12.0+
- Redis 6.0+
- Git 2.30.0+

### 开发工具推荐

- **IDE**: VS Code / WebStorm / PyCharm
- **数据库工具**: DBeaver / pgAdmin
- **API 测试**: Postman / Insomnia
- **Redis 工具**: RedisInsight / Another Redis Desktop Manager

### VS Code 插件推荐

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-python.python",
    "ms-python.vscode-pylance",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense"
  ]
}
```

### 环境变量配置

创建 `.env` 文件：

```bash
# 后端配置
FLASK_ENV=development
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mitong_devops
DB_USER=postgres
DB_PASSWORD=your_password

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# 前端配置
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## 项目结构

### 前端结构 (admin-mit-ui)

```
admin-mit-ui/
├── src/
│   ├── components/          # 公共组件
│   │   ├── Layout/          # 布局组件
│   │   ├── Form/            # 表单组件
│   │   ├── Table/           # 表格组件
│   │   ├── Modal/           # 弹窗组件
│   │   ├── Avatar/          # 头像组件
│   │   ├── Terminal/        # 终端组件
│   │   ├── Network/         # 网络探测组件
│   │   └── ...
│   ├── pages/               # 页面组件
│   │   ├── Dashboard/       # 仪表盘
│   │   ├── Users/           # 用户管理
│   │   ├── Hosts/           # 主机管理
│   │   ├── Network/         # 网络探测
│   │   └── ...
│   ├── services/            # API 服务层
│   │   ├── api.ts           # Axios 实例
│   │   ├── auth.ts          # 认证服务
│   │   ├── users.ts         # 用户服务
│   │   └── ...
│   ├── store/               # 状态管理 (
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

#### 4. 配置后端环境

```bash
cd admin-mit-backend

# 创建 Python 虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置数据库连接
# 编辑 config/database.yaml
# 修改 host, port, username, password 等配置

# 配置 Redis 连接
# 编辑 config/redis.yaml

# 配置应用设置
# 编辑 config/app.yaml
# 修改 secret_key, jwt.secret_key 等配置

# 初始化数据库
flask db upgrade

# 运行初始化脚本（创建默认数据）
python init_database.py
```

#### 5. 配置前端环境

```bash
cd admin-mit-ui

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置 API 地址
# VITE_API_BASE_URL=http://localhost:5000
```

#### 6. 启动开发服务器

**启动后端**:
```bash
cd admin-mit-backend
# 确保虚拟环境已激活
python app.py
# 后端服务运行在 http://localhost:5000
```

**启动 Celery Worker** (用于网络探测等异步任务):
```bash
cd admin-mit-backend
celery -A celery_worker.celery worker --loglevel=info
```

**启动 Celery Beat** (用于定时任务):
```bash
cd admin-mit-backend
celery -A celery_worker.celery beat --loglevel=info
```

**启动前端**:
```bash
cd admin-mit-ui
npm run dev
# 前端服务运行在 http://localhost:3000
```

#### 7. 验证安装

访问 http://localhost:3000，使用默认账号登录：
- 用户名: `admin`
- 密码: `admin123`

## 项目结构说明

### 前端项目结构

```
admin-mit-ui/
├── src/
│   ├── assets/              # 静态资源
│   │   └── .gitkeep
│   ├── components/          # 公共组件
│   │   ├── Layout/          # 布局组件（侧边栏、顶部导航）
│   │   ├── Form/            # 表单组件（Input、Select、DatePicker）
│   │   ├── Table/           # 表格组件（DataTable、ActionColumn）
│   │   ├── Avatar/          # 头像组件（DiceBear 集成）
│   │   ├── Terminal/        # WebShell 终端组件
│   │   ├── Ansible/         # Ansible 相关组件
│   │   ├── Dashboard/       # 仪表盘组件
│   │   ├── Network/         # 网络探测组件
│   │   └── ...              # 其他公共组件
│   ├── pages/               # 页面组件
│   │   ├── Login/           # 登录页面
│   │   ├── Dashboard/       # 仪表盘页面
│   │   ├── Users/           # 用户管理页面
│   │   ├── Roles/           # 角色管理页面
│   │   ├── Menus/           # 菜单管理页面
│   │   ├── Logs/            # 日志管理页面
│   │   ├── Hosts/           # 主机管理页面
│   │   ├── Ansible/         # Ansible 管理页面
│   │   ├── Monitor/         # 监控告警页面
│   │   └── Network/         # 网络探测页面
│   ├── services/            # API 服务层
│   │   ├── api.ts           # Axios 基础配置
│   │   ├── auth.ts          # 认证服务
│   │   ├── users.ts         # 用户服务
│   │   ├── hosts.ts         # 主机服务
│   │   ├── ansible.ts       # Ansible 服务
│   │   ├── monitor.ts       # 监控告警服务
│   │   ├── network.ts       # 网络探测服务
│   │   └── ...              # 其他服务
│   ├── store/               # 状态管理（Zustand）
│   │   ├── auth.ts          # 认证状态
│   │   └── app.ts           # 应用全局状态
│   ├── types/               # TypeScript 类型定义
│   │   ├── auth.ts          # 认证相关类型
│   │   ├── user.ts          # 用户相关类型
│   │   ├── api.ts           # API 响应类型
│   │   └── ...              # 其他类型定义
│   ├── utils/               # 工具函数
│   │   ├── request.ts       # HTTP 请求封装
│   │   ├── storage.ts       # 本地存储封装
│   │   └── index.ts         # 通用工具函数
│   ├── router/              # 路由配置
│   ├── layouts/             # 布局模板
│   ├── App.tsx              # 根组件
│   ├── main.tsx             # 应用入口
│   └── index.css            # 全局样式
├── public/                  # 公共静态资源
├── e2e/                     # E2E 测试
├── .env.example             # 环境变量模板
├── package.json             # 项目配置
├── tsconfig.json            # TypeScript 配置
├── vite.config.ts           # Vite 配置
├── vitest.config.ts         # Vitest 测试配置
└── tailwind.config.js       # Tailwind CSS 配置
```

### 后端项目结构

```
admin-mit-backend/
├── app/
│   ├── api/                 # API 蓝图
│   │   ├── auth.py          # 认证接口
│   │   ├── users.py         # 用户管理接口
│   │   ├── roles.py         # 角色管理接口
│   │   ├── menus.py         # 菜单管理接口
│   │   ├── logs.py          # 日志管理接口
│   │   ├── hosts.py         # 主机管理接口
│   │   ├── ansible.py       # Ansible 管理接口
│   │   ├── monitor.py       # 监控告警接口
│   │   ├── network.py       # 网络探测接口
│   │   └── ...              # 其他接口
│   ├── models/              # 数据模型
│   │   ├── base.py          # 基础模型（包含 tenant_id）
│   │   ├── user.py          # 用户模型
│   │   ├── role.py          # 角色模型
│   │   ├── tenant.py        # 租户模型
│   │   ├── menu.py          # 菜单模型
│   │   ├── host.py          # 主机模型
│   │   ├── ansible.py       # Ansible 模型
│   │   ├── monitor.py       # 监控告警模型
│   │   ├── network.py       # 网络探测模型
│   │   └── ...              # 其他模型
│   ├── services/            # 业务服务层
│   │   ├── auth_service.py  # 认证服务
│   │   ├── user_service.py  # 用户服务
│   │   ├── ssh_service.py   # SSH 连接服务
│   │   ├── ansible_service.py # Ansible 执行服务
│   │   ├── network_probe_service.py # 网络探测服务
│   │   └── ...              # 其他服务
│   ├── core/                # 核心配置
│   │   ├── config_manager.py # 配置管理器
│   │   ├── middleware.py    # 中间件（多租户、日志）
│   │   ├── rate_limiter.py  # 频率限制
│   │   └── ...              # 其他核心模块
│   ├── tasks/               # Celery 任务
│   │   └── network_probe_tasks.py # 网络探测任务
│   ├── extensions.py        # Flask 扩展初始化
│   ├── celery_app.py        # Celery 应用配置
│   └── __init__.py          # 应用工厂
├── config/                  # 配置文件
│   ├── database.yaml        # 数据库配置
│   ├── redis.yaml           # Redis 配置
│   ├── app.yaml             # 应用配置
│   └── logging.yaml         # 日志配置
├── migrations/              # 数据库迁移文件
├── tests/                   # 测试文件
├── scripts/                 # 工具脚本
├── logs/                    # 日志文件
├── app.py                   # 应用入口
├── celery_worker.py         # Celery Worker 入口
├── init_database.py         # 数据库初始化脚本
├── requirements.txt         # Python 依赖
└── alembic.ini              # Alembic 配置
```

## 开发规范

### 代码风格

#### 前端代码规范

1. **命名规范**:
   - 组件文件: PascalCase (例如: `UserList.tsx`)
   - 工具函数文件: camelCase (例如: `formatDate.ts`)
   - 常量文件: UPPER_SNAKE_CASE (例如: `API_ENDPOINTS.ts`)
   - 组件名称: PascalCase (例如: `<UserList />`)
   - 函数名称: camelCase (例如: `getUserList()`)
   - 变量名称: camelCase (例如: `const userName = ''`)
   - 常量名称: UPPER_SNAKE_CASE (例如: `const API_BASE_URL = ''`)

2. **TypeScript 规范**:
   - 所有组件必须定义 Props 类型
   - 避免使用 `any` 类型，使用 `unknown` 或具体类型
   - 使用接口 (interface) 定义对象类型
   - 使用类型别名 (type) 定义联合类型或复杂类型

3. **React 规范**:
   - 使用函数组件和 Hooks
   - 组件拆分原则: 单一职责，可复用
   - 使用 `React.memo` 优化性能
   - 自定义 Hook 以 `use` 开头

4. **样式规范**:
   - 优先使用 Tailwind CSS 工具类
   - 复杂样式使用 CSS Modules
   - 避免内联样式

#### 后端代码规范

1. **命名规范**:
   - 文件名: snake_case (例如: `user_service.py`)
   - 类名: PascalCase (例如: `class UserService`)
   - 函数名: snake_case (例如: `def get_user_list()`)
   - 变量名: snake_case (例如: `user_name = ''`)
   - 常量名: UPPER_SNAKE_CASE (例如: `API_VERSION = 'v1'`)

2. **Python 规范**:
   - 遵循 PEP 8 规范
   - 使用类型注解 (Type Hints)
   - 文档字符串使用 Google 风格
   - 每个函数都应有文档字符串

3. **Flask 规范**:
   - 使用蓝图组织路由
   - API 接口使用 RESTful 风格
   - 使用装饰器进行权限控制
   - 统一的错误处理和响应格式

4. **数据库规范**:
   - 所有业务表必须包含 `tenant_id` 字段
   - 使用 Alembic 管理数据库迁移
   - 避免在代码中使用原生 SQL
   - 合理使用索引优化查询

### Git 提交规范

使用 Conventional Commits 规范:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 类型**:
- `feat`: 新功能
- `fix`: 修复 Bug
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建工具或辅助工具的变动

**示例**:
```
feat(user): 添加用户头像上传功能

- 集成 DiceBear 头像库
- 支持多种头像风格选择
- 添加头像预览功能

Closes #123
```

### 代码审查清单

#### 前端代码审查
- [ ] 组件是否有明确的职责
- [ ] Props 类型是否完整定义
- [ ] 是否有不必要的重渲染
- [ ] 错误处理是否完善
- [ ] 是否有内存泄漏风险
- [ ] 样式是否响应式
- [ ] 是否有单元测试

#### 后端代码审查
- [ ] API 接口是否符合 RESTful 规范
- [ ] 是否有权限控制
- [ ] 多租户数据隔离是否正确
- [ ] 错误处理是否完善
- [ ] 数据库查询是否优化
- [ ] 是否有 SQL 注入风险
- [ ] 是否有单元测试

## 调试指南

### 前端调试

#### 1. Chrome DevTools

**断点调试**:
1. 在 Chrome DevTools 的 Sources 面板中设置断点
2. 刷新页面或触发相关操作
3. 使用 Step Over、Step Into 等功能调试

**React DevTools**:
1. 安装 React Developer Tools 扩展
2. 查看组件树和 Props/State
3. 使用 Profiler 分析性能

#### 2. VS Code 调试

配置 `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/admin-mit-ui/src"
    }
  ]
}
```

#### 3. 网络请求调试

- 使用 Chrome DevTools 的 Network 面板
- 查看请求和响应数据
- 检查请求头和响应头
- 使用 Axios 拦截器打印日志

### 后端调试

#### 1. PyCharm 调试

1. 设置断点
2. 使用 Debug 模式运行 `app.py`
3. 使用 Step Over、Step Into 等功能调试

#### 2. VS Code 调试

配置 `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: Flask",
      "type": "python",
      "request": "launch",
      "module": "flask",
      "env": {
        "FLASK_APP": "app.py",
        "FLASK_ENV": "development"
      },
      "args": ["run", "--no-debugger", "--no-reload"],
      "jinja": true
    }
  ]
}
```

#### 3. 日志调试

```python
import logging

logger = logging.getLogger(__name__)

# 在代码中添加日志
logger.debug("调试信息")
logger.info("普通信息")
logger.warning("警告信息")
logger.error("错误信息")
```

#### 4. 数据库调试

```python
# 打印 SQL 语句
app.config['SQLALCHEMY_ECHO'] = True

# 或在配置文件中设置
# config/database.yaml
database:
  postgresql:
    echo: true
```

## 测试指南

### 前端测试

#### 单元测试

使用 Vitest 和 React Testing Library:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import UserList from './UserList';

describe('UserList', () => {
  it('should render user list', () => {
    render(<UserList />);
    expect(screen.getByText('用户列表')).toBeInTheDocument();
  });

  it('should handle user click', () => {
    const handleClick = vi.fn();
    render(<UserList onUserClick={handleClick} />);
    fireEvent.click(screen.getByText('用户1'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

运行测试:
```bash
npm run test
npm run test:coverage  # 查看覆盖率
```

#### E2E 测试

使用 Playwright:

```typescript
import { test, expect } from '@playwright/test';

test('user login flow', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('http://localhost:3000/dashboard');
});
```

运行 E2E 测试:
```bash
npm run test:e2e
```

### 后端测试

#### 单元测试

使用 pytest:

```python
import pytest
from app.services.user_service import UserService

def test_create_user(db_session):
    """测试创建用户"""
    user_data = {
        'username': 'testuser',
        'email': 'test@example.com',
        'password': 'password123'
    }
    user = UserService.create_user(user_data)
    assert user.username == 'testuser'
    assert user.email == 'test@example.com'

def test_get_user_list(db_session):
    """测试获取用户列表"""
    users = UserService.get_user_list(page=1, per_page=10)
    assert isinstance(users, list)
```

运行测试:
```bash
pytest
pytest --cov=app  # 查看覆盖率
pytest -v  # 详细输出
pytest tests/test_user_service.py  # 运行特定测试文件
```

#### API 测试

```python
def test_login_api(client):
    """测试登录接口"""
    response = client.post('/api/auth/login', json={
        'username': 'admin',
        'password': 'admin123'
    })
    assert response.status_code == 200
    assert 'access_token' in response.json

def test_get_users_api(client, auth_headers):
    """测试获取用户列表接口"""
    response = client.get('/api/users', headers=auth_headers)
    assert response.status_code == 200
    assert 'data' in response.json
```

## 常见问题

### 前端常见问题

#### Q1: npm install 失败

**解决方案**:
```bash
# 清除缓存
npm cache clean --force

# 删除 node_modules 和 package-lock.json
rm -rf node_modules package-lock.json

# 重新安装
npm install

# 或使用 yarn
yarn install
```

#### Q2: 端口被占用

**解决方案**:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

#### Q3: TypeScript 类型错误

**解决方案**:
- 检查类型定义是否正确
- 使用 `// @ts-ignore` 临时忽略（不推荐）
- 更新 `@types` 包

### 后端常见问题

#### Q1: 数据库连接失败

**解决方案**:
1. 检查 PostgreSQL 服务是否启动
2. 检查 `config/database.yaml` 配置是否正确
3. 检查数据库是否已创建
4. 检查防火墙设置

#### Q2: 导入模块失败

**解决方案**:
```bash
# 确保虚拟环境已激活
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate  # Windows

# 重新安装依赖
pip install -r requirements.txt

# 检查 PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:${PWD}"
```

#### Q3: 数据库迁移失败

**解决方案**:
```bash
# 删除迁移文件
rm -rf migrations/versions/*

# 重新生成迁移
flask db migrate -m "Initial migration"
flask db upgrade

# 或直接使用初始化脚本
python init_database.py
```

#### Q4: Redis 连接失败

**解决方案**:
1. 检查 Redis 服务是否启动
2. 检查 `config/redis.yaml` 配置是否正确
3. 测试 Redis 连接:
```bash
redis-cli ping
# 应返回 PONG
```

### 性能问题

#### Q1: 前端页面加载慢

**解决方案**:
- 使用 React DevTools Profiler 分析性能
- 检查是否有不必要的重渲染
- 使用 `React.memo` 优化组件
- 使用代码分割和懒加载

#### Q2: API 响应慢

**解决方案**:
- 检查数据库查询是否优化
- 添加数据库索引
- 使用 Redis 缓存热点数据
- 使用分页查询

### 部署问题

#### Q1: Docker 构建失败

**解决方案**:
- 检查 Dockerfile 语法
- 检查网络连接
- 使用国内镜像源

#### Q2: 生产环境配置

**解决方案**:
- 使用生产环境配置文件
- 修改密钥和密码
- 配置 HTTPS
- 设置环境变量

## 获取帮助

- **项目文档**: 查看 `docs/` 目录下的其他文档
- **API 文档**: 访问 `/api/docs` 查看 Swagger 文档
- **Issue 跟踪**: 在 GitHub/GitLab 提交 Issue
- **团队沟通**: 联系项目负责人或技术团队

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

感谢您的贡献！
