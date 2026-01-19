# MiTong运维平台

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/)
[![Node](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18-blue.svg)](https://reactjs.org/)
[![Flask](https://img.shields.io/badge/flask-3-black.svg)](https://flask.palletsprojects.com/)

一个基于 React + Flask 的现代化运维管理平台，支持多租户架构，提供完整的用户权限管理、主机运维管理、监控告警、网络探测等功能。

## ✨ 核心特性

- 🏢 **多租户架构**: 支持多租户数据隔离，适用于 SaaS 场景
- 🔐 **安全可靠**: JWT 认证、密码 RSA 加密传输、CSRF 防护、SQL 注入防护
- 👥 **权限管理**: 基于 RBAC 的完整权限控制系统
- 🖥️ **主机运维**: SSH 主机管理、WebShell 终端、Ansible 自动化
- 📊 **监控告警**: 主机性能监控、告警规则配置、多渠道通知（邮件、钉钉）
- 🌐 **网络探测**: 支持 HTTP/HTTPS/WebSocket/TCP/UDP 协议探测
- 📱 **响应式设计**: 适配桌面和移动设备
- 🎨 **现代化 UI**: 基于 Tailwind CSS 的美观界面

## 🛠️ 技术栈

### 前端技术
- **框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **样式**: Tailwind CSS 3
- **状态管理**: Zustand 4
- **路由**: React Router v6
- **HTTP 客户端**: Axios
- **头像系统**: DiceBear
- **加密**: JSEncrypt (RSA)
- **终端**: xterm.js
- **测试**: Vitest + React Testing Library + Playwright

### 后端技术
- **框架**: Python Flask 3
- **数据库**: PostgreSQL 12+
- **缓存**: Redis 6+
- **ORM**: SQLAlchemy 2
- **迁移**: Alembic
- **认证**: Flask-JWT-Extended
- **WebSocket**: Flask-SocketIO
- **任务队列**: Celery 5
- **SSH**: Paramiko
- **测试**: pytest

## 🏗️ 项目结构

```
mitong-admin/
├── admin-mit-ui/              # 前端项目
│   ├── src/
│   │   ├── components/        # 公共组件
│   │   │   ├── Layout/        # 布局组件
│   │   │   ├── Form/          # 表单组件
│   │   │   ├── Table/         # 表格组件
│   │   │   ├── Avatar/        # 头像组件
│   │   │   ├── Terminal/      # WebShell 终端
│   │   │   └── ...
│   │   ├── pages/             # 页面组件
│   │   │   ├── Dashboard/     # 仪表盘
│   │   │   ├── Users/         # 用户管理
│   │   │   ├── Roles/         # 角色管理
│   │   │   ├── Hosts/         # 主机管理
│   │   │   ├── Ansible/       # Ansible 管理
│   │   │   ├── Monitor/       # 监控告警
│   │   │   └── Network/       # 网络探测
│   │   ├── services/          # API 服务
│   │   ├── store/             # 状态管理
│   │   ├── types/             # 类型定义
│   │   ├── utils/             # 工具函数
│   │   └── router/            # 路由配置
│   ├── e2e/                   # E2E 测试
│   ├── public/                # 静态资源
│   └── package.json
├── admin-mit-backend/         # 后端项目
│   ├── app/
│   │   ├── api/               # API 蓝图
│   │   │   ├── auth.py        # 认证接口
│   │   │   ├── users.py       # 用户管理
│   │   │   ├── hosts.py       # 主机管理
│   │   │   ├── ansible.py     # Ansible 管理
│   │   │   ├── monitor.py     # 监控告警
│   │   │   └── network.py     # 网络探测
│   │   ├── models/            # 数据模型
│   │   ├── services/          # 业务服务
│   │   ├── core/              # 核心配置
│   │   ├── tasks/             # Celery 任务
│   │   └── extensions.py      # 扩展初始化
│   ├── config/                # 配置文件
│   │   ├── database.yaml      # 数据库配置
│   │   ├── redis.yaml         # Redis 配置
│   │   ├── app.yaml           # 应用配置
│   │   └── logging.yaml       # 日志配置
│   ├── migrations/            # 数据库迁移
│   ├── tests/                 # 测试文件
│   ├── scripts/               # 工具脚本
│   ├── logs/                  # 日志文件
│   ├── app.py                 # 应用入口
│   ├── celery_worker.py       # Celery Worker
│   └── requirements.txt       # Python 依赖
├── docs/                      # 项目文档
│   ├── DEVELOPMENT_GUIDE.md   # 开发指南
│   ├── ARCHITECTURE.md        # 架构设计
│   ├── DATABASE_DESIGN.md     # 数据库设计
│   ├── CODE_STANDARDS.md      # 代码规范
│   └── FAQ.md                 # 常见问题
├── docker-compose.yml         # Docker Compose 配置
├── .gitlab-ci.yml             # GitLab CI/CD 配置
└── README.md                  # 项目说明
```

## 🧪 测试

### 前端测试

```bash
cd admin-mit-ui

# 运行单元测试
npm run test

# 查看测试覆盖率
npm run test:coverage

# 运行 E2E 测试
npm run test:e2e

# 运行 E2E 测试（UI 模式）
npm run test:e2e:ui
```

### 后端测试

```bash
cd admin-mit-backend

# 运行所有测试
pytest

# 查看测试覆盖率
pytest --cov=app

# 运行特定测试文件
pytest tests/test_user_service.py

# 详细输出
pytest -v
```

## 🔧 开发指南

### 代码规范

- **前端**: ESLint + Prettier
- **后端**: PEP 8 + Black
- **提交**: Conventional Commits

### 提交规范

```bash
# 新功能
git commit -m "feat(user): 添加用户头像上传功能"

# Bug 修复
git commit -m "fix(auth): 修复登录 Token 过期问题"

# 文档更新
git commit -m "docs: 更新 API 文档"

# 代码重构
git commit -m "refactor(user): 重构用户服务层代码"
```

### 开发流程

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

详见 [代码规范和贡献指南](docs/CODE_STANDARDS.md)。

## 🚀 快速开始

### 环境要求

- Node.js 18.0.0+
- Python 3.9.0+
- PostgreSQL 12.0+
- Redis 6.0+
- Git 2.30.0+

### 一键安装（推荐）

使用 Docker Compose 快速启动：

```bash
# 克隆项目
git clone <repository-url>
cd mitong-admin

# 启动所有服务
docker-compose up -d

# 访问应用
# 前端: http://localhost:3000
# 后端: http://localhost:5000
# 默认账号: admin / admin123
```

### 手动安装

#### 1. 安装数据库

**PostgreSQL**:
```bash
# Ubuntu
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# macOS
brew install postgresql@14
brew services start postgresql@14

# 创建数据库
createdb mitong_devops
createdb mitong_devops_test
```

**Redis**:
```bash
# Ubuntu
sudo apt install redis-server
sudo systemctl start redis-server

# macOS
brew install redis
brew services start redis
```

#### 2. 配置后端

```bash
cd admin-mit-backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置数据库连接
# 编辑 config/database.yaml
# 修改 host, port, username, password

# 配置 Redis 连接
# 编辑 config/redis.yaml

# 初始化数据库
flask db upgrade
python init_database.py

# 启动后端服务
python app.py
```

#### 3. 配置前端

```bash
cd admin-mit-ui

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置 API 地址

# 启动前端服务
npm run dev
```

#### 4. 启动 Celery（可选，用于网络探测）

```bash
cd admin-mit-backend

# 启动 Worker
celery -A celery_worker.celery worker --loglevel=info

# 启动 Beat（定时任务）
celery -A celery_worker.celery beat --loglevel=info
```

### 访问应用

- 前端地址: http://localhost:3000
- 后端地址: http://localhost:5000
- API 文档: http://localhost:5000/api/docs

**默认账号**:
- 用户名: `admin`
- 密码: `admin123`

## 📚 文档

### 开发文档
- [开发指南](docs/DEVELOPMENT_GUIDE.md) - 详细的开发环境搭建和开发指南
- [架构设计](docs/ARCHITECTURE.md) - 系统架构和技术选型说明
- [数据库设计](docs/DATABASE_DESIGN.md) - 数据库表结构和设计说明
- [代码规范](docs/CODE_STANDARDS.md) - 代码规范和贡献指南
- [常见问题](docs/FAQ.md) - 常见问题解答

### 部署文档
- [Docker 部署](DOCKER_DEPLOYMENT.md) - Docker 容器化部署指南
- [生产部署](PRODUCTION_DEPLOYMENT_GUIDE.md) - 生产环境部署指南
- [配置指南](CONFIGURATION_GUIDE.md) - 配置文件详细说明
- [数据库维护](DATABASE_MAINTENANCE.md) - 数据库备份和维护

### 运维文档
- [监控指南](MONITORING_GUIDE.md) - 监控和告警配置
- [性能优化](PERFORMANCE_QUICK_REFERENCE.md) - 性能优化建议
- [安全检查](SECURITY_CHECKLIST.md) - 安全加固清单
- [CI/CD 指南](CICD_GUIDE.md) - 持续集成和部署

### API 文档
- Swagger 文档: http://localhost:5000/api/docs
- API 设计规范: 详见 `docs/API_DESIGN.md`（待创建）

## 📦 功能模块

### 已实现功能

#### 基础功能
- ✅ 用户认证和授权 (JWT + RSA 加密)
- ✅ 多租户数据隔离
- ✅ 用户和角色管理
- ✅ 菜单权限管理
- ✅ 操作日志审计
- ✅ DiceBear 头像系统

#### 主机运维
- ✅ SSH 主机管理 (密码/密钥认证)
- ✅ WebShell 终端 (基于 xterm.js)
- ✅ 主机信息收集 (CPU、内存、磁盘)
- ✅ Ansible Playbook 管理和执行
- ✅ 实时执行日志查看

#### 监控告警
- ✅ 主机性能监控
- ✅ 告警规则配置
- ✅ 邮件告警通知
- ✅ 钉钉机器人告警
- ✅ 告警历史查询
- ✅ 监控大屏展示

#### 网络探测
- ✅ HTTP/HTTPS 探测
- ✅ WebSocket 探测
- ✅ TCP/UDP 探测
- ✅ 探测分组管理
- ✅ 主动探测和自动探测
- ✅ SSE 实时状态推送
- ✅ 探测结果缓存 (Redis)
- ✅ 探测告警配置

### 测试覆盖
- ✅ 前端单元测试 (80%+ 覆盖率)
- ✅ 后端单元测试 (85%+ 覆盖率)
- ✅ E2E 测试 (7 个测试套件)
- ✅ 性能测试和优化
- ✅ 安全测试和加固

## 🚀 部署

### Docker 部署（推荐）

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 生产环境部署

1. **配置环境**:
   - 修改配置文件中的密钥和密码
   - 配置 HTTPS 证书
   - 设置防火墙规则

2. **数据库准备**:
   - 创建生产数据库
   - 执行数据库迁移
   - 配置数据库备份

3. **启动服务**:
   - 使用 Gunicorn 运行后端
   - 使用 Nginx 反向代理
   - 配置进程管理器（Supervisor/Systemd）

4. **监控和日志**:
   - 配置日志轮转
   - 设置监控告警
   - 配置性能监控

详见 [生产部署指南](PRODUCTION_DEPLOYMENT_GUIDE.md)。

## 🔒 安全

### 安全特性

- ✅ JWT Token 认证
- ✅ 密码 RSA 加密传输
- ✅ 密码 bcrypt 加密存储
- ✅ CSRF 防护
- ✅ SQL 注入防护
- ✅ XSS 防护
- ✅ 多租户数据隔离
- ✅ API 频率限制
- ✅ 操作日志审计

### 安全建议

1. 定期更新依赖包
2. 使用强密码策略
3. 启用 HTTPS
4. 配置防火墙
5. 定期备份数据
6. 监控异常访问

详见 [安全检查清单](SECURITY_CHECKLIST.md)。

## 📊 性能

### 性能优化

- ✅ 前端代码分割和懒加载
- ✅ React 组件优化（memo、useMemo）
- ✅ 数据库索引优化
- ✅ Redis 缓存热点数据
- ✅ API 分页查询
- ✅ 数据库连接池
- ✅ 静态资源 CDN 加速

### 性能指标

- 前端首屏加载: < 2s
- API 响应时间: < 200ms
- 数据库查询: < 100ms
- 并发用户: 1000+

详见 [性能优化指南](PERFORMANCE_QUICK_REFERENCE.md)。

## 🤝 贡献

我们欢迎所有形式的贡献，包括但不限于：

- 🐛 报告 Bug
- 💡 提出新功能建议
- 📝 改进文档
- 🔧 提交代码

### 贡献步骤

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

详见 [贡献指南](docs/CODE_STANDARDS.md#贡献流程)。

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 👥 团队

- **项目负责人**: [Your Name]
- **技术负责人**: [Tech Lead Name]
- **贡献者**: 查看 [Contributors](https://github.com/your-repo/graphs/contributors)

## 🙏 致谢

感谢以下开源项目：

- [React](https://reactjs.org/)
- [Flask](https://flask.palletsprojects.com/)
- [PostgreSQL](https://www.postgresql.org/)
- [Redis](https://redis.io/)
- [Tailwind CSS](https://tailwindcss.com/)
- [xterm.js](https://xtermjs.org/)
- [DiceBear](https://dicebear.com/)

## 📞 联系我们

- **Email**: support@example.com
- **Issue**: [GitHub Issues](https://github.com/your-repo/issues)
- **文档**: [在线文档](https://docs.example.com)

## 🗺️ 路线图

### v1.1.0 (计划中)
- [ ] 多语言支持（i18n）
- [ ] 暗黑模式
- [ ] 移动端适配优化
- [ ] 更多监控指标
- [ ] 更多告警渠道（微信、短信）

### v1.2.0 (计划中)
- [ ] 容器管理（Docker/Kubernetes）
- [ ] 日志分析和检索
- [ ] 自定义仪表盘
- [ ] 工作流引擎
- [ ] API 网关集成

## ⭐ Star History

如果这个项目对您有帮助，请给我们一个 Star ⭐

[![Star History Chart](https://api.star-history.com/svg?repos=your-repo&type=Date)](https://star-history.com/#your-repo&Date)

---

**Made with ❤️ by MiTong Team**#   M i T o n g D e v o p s  
 