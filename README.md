<div align="center">

# 🚀 MiTong 运维管理平台

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/)
[![Node](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18-blue.svg)](https://reactjs.org/)
[![Flask](https://img.shields.io/badge/flask-3-black.svg)](https://flask.palletsprojects.com/)
[![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)](https://www.docker.com/)

**一个基于 React + Flask AI大模型开发的现代化运维管理平台**

支持多租户架构 | 完整权限管理 | 主机运维 | 监控告警 | 网络探测

[快速开始](#-快速开始) • [功能特性](#-核心特性) • [在线文档](#-文档) • [部署指南](#-部署)

</div>

---

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

### 📋 环境要求

| 软件 | 版本要求 |
|------|---------|
| Node.js | 18.0.0+ |
| Python | 3.9.0+ |
| PostgreSQL | 12.0+ |
| Redis | 6.0+ |
| Docker | 20.10+ (可选) |
| Git | 2.30.0+ |

### ⚡ 一键安装（推荐）

使用 Docker Compose 快速启动：

```bash
# 1. 克隆项目
git clone https://github.com/wangyufeng1995/MiTongDevopsBackend.git
cd MiTongDevopsBackend

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，修改数据库密码等配置

# 3. 启动所有服务
docker-compose up -d

# 4. 查看服务状态
docker-compose ps

# 5. 访问应用
# 前端: http://localhost:80
# 后端: http://localhost:5000
# 默认账号: admin / admin123
```

> 💡 **提示**: 详细的 Docker 部署说明请查看 [Docker 部署指南](DOCKER_COMPOSE_部署指南.md)

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
celery -A celery_worker.celery worker -Q celery,network_probes,alerts,ansible,host_probes --loglevel=info --pool=threads --concurrency=4

# 启动 Beat（定时任务）
celery -A celery_worker.celery beat --loglevel=info

celery -A celery_worker:celery beat --loglevel=error

### 🌐 访问应用

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端界面 | http://localhost:80 | React 前端应用 |
| 后端 API | http://localhost:5000 | Flask API 服务 |
| API 文档 | http://localhost:5000/api/docs | Swagger 文档 |
| 健康检查 | http://localhost:5000/api/health | 服务健康状态 |

**🔑 默认账号**:
- 用户名: `admin`
- 密码: `admin123`

> ⚠️ **安全提示**: 首次登录后请立即修改默认密码！

## 📚 文档

<table>
<tr>
<td width="50%">

### 📖 开发文档
- [开发指南](docs/DEVELOPMENT_GUIDE.md)
- [架构设计](docs/ARCHITECTURE.md)
- [数据库设计](docs/DATABASE_DESIGN.md)
- [代码规范](docs/CODE_STANDARDS.md)
- [常见问题](docs/FAQ.md)

### 🚀 部署文档
- [Docker 部署](DOCKER_COMPOSE_部署指南.md)
- [生产部署](PRODUCTION_DEPLOYMENT_GUIDE.md)
- [配置指南](CONFIGURATION_GUIDE.md)
- [数据库维护](DATABASE_MAINTENANCE.md)

</td>
<td width="50%">

### 🔧 运维文档
- [监控指南](MONITORING_GUIDE.md)
- [安全检查](SECURITY_CHECKLIST.md)
- [CI/CD 指南](CICD_GUIDE.md)
- [系统维护手册](SYSTEM_MAINTENANCE_MANUAL.md)

### 📡 API 文档
- [API 文档](docs/API_DOCUMENTATION.md)
- [API 错误码](docs/API_ERROR_CODES.md)
- [Swagger 文档](http://localhost:5000/api/docs)

</td>
</tr>
</table>

## 📦 功能模块

<details open>
<summary><b>✅ 已实现功能</b></summary>

### 🔐 基础功能
- ✅ 用户认证和授权 (JWT + RSA 加密)
- ✅ 多租户数据隔离
- ✅ 用户和角色管理
- ✅ 菜单权限管理
- ✅ 操作日志审计
- ✅ DiceBear 头像系统

### 🖥️ 主机运维
- ✅ SSH 主机管理 (密码/密钥认证)
- ✅ WebShell 终端 (基于 xterm.js)
- ✅ 主机信息收集 (CPU、内存、磁盘)
- ✅ Ansible Playbook 管理和执行
- ✅ 实时执行日志查看
- ✅ 主机分组管理
- ✅ 批量操作支持

### 📊 监控告警
- ✅ 主机性能监控
- ✅ 告警规则配置
- ✅ 邮件告警通知
- ✅ 钉钉机器人告警
- ✅ 告警历史查询
- ✅ 监控大屏展示
- ✅ Grafana 集成
- ✅ 数据源管理

### 🌐 网络探测
- ✅ HTTP/HTTPS 探测
- ✅ WebSocket 探测
- ✅ TCP/UDP 探测
- ✅ 探测分组管理
- ✅ 主动探测和自动探测
- ✅ SSE 实时状态推送
- ✅ 探测结果缓存 (Redis)
- ✅ 探测告警配置

### 💾 数据库管理
- ✅ PostgreSQL 管理
- ✅ MySQL 管理
- ✅ Redis 管理
- ✅ SQL 查询编辑器
- ✅ 数据库备份恢复

### 🧪 测试覆盖
- ✅ 前端单元测试 (80%+ 覆盖率)
- ✅ 后端单元测试 (85%+ 覆盖率)
- ✅ E2E 测试 (7 个测试套件)
- ✅ 性能测试和优化
- ✅ 安全测试和加固

</details>

## 🚀 部署

### 🐳 Docker 部署（推荐）

```bash
# 1. 构建镜像
docker-compose build

# 2. 启动服务
docker-compose up -d

# 3. 查看服务状态
docker-compose ps

# 4. 查看日志
docker-compose logs -f

# 5. 停止服务
docker-compose down
```

**常用命令**:
```bash
# 重启服务
docker-compose restart

# 进入容器
docker-compose exec backend bash

# 查看资源使用
docker stats

# 清理资源
docker system prune -a
```

### 🏭 生产环境部署

<details>
<summary>点击展开详细步骤</summary>

#### 1️⃣ 配置环境
- ✅ 修改配置文件中的密钥和密码
- ✅ 配置 HTTPS 证书
- ✅ 设置防火墙规则
- ✅ 配置域名解析

#### 2️⃣ 数据库准备
- ✅ 创建生产数据库
- ✅ 执行数据库迁移
- ✅ 配置数据库备份
- ✅ 优化数据库性能

#### 3️⃣ 启动服务
- ✅ 使用 Gunicorn 运行后端
- ✅ 使用 Nginx 反向代理
- ✅ 配置进程管理器（Supervisor/Systemd）
- ✅ 配置负载均衡

#### 4️⃣ 监控和日志
- ✅ 配置日志轮转
- ✅ 设置监控告警
- ✅ 配置性能监控
- ✅ 集成 APM 工具

</details>

📖 **详细文档**: [生产部署指南](PRODUCTION_DEPLOYMENT_GUIDE.md) | [Docker 部署指南](DOCKER_COMPOSE_部署指南.md)

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

- **项目负责人**: [YufengWang]
- **技术负责人**: [Mizi]
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

**Made with  by MiTong Team**


---

<div align="center">

## 📞 联系我们

| 联系方式 | 链接 |
|---------|------|
- **Email**: wangyufeng@yunlizhihui.com
| 🐛 Issues | [GitHub Issues](https://github.com/wangyufeng1995/MiTongDevopsBackend/issues) |
| 📖 文档 | [项目文档](https://github.com/wangyufeng1995/MiTongDevopsBackend) |

**Made with ❤️ by MiTong Team**

[⬆ 回到顶部](#-mitong-运维管理平台)

</div>
