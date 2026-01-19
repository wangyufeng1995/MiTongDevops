# CI/CD 流程指南

本文档详细说明项目的持续集成和持续部署流程。

## 目录

- [概述](#概述)
- [GitHub Actions 配置](#github-actions-配置)
- [GitLab CI 配置](#gitlab-ci-配置)
- [本地测试](#本地测试)
- [部署流程](#部署流程)
- [回滚策略](#回滚策略)
- [最佳实践](#最佳实践)

## 概述

### CI/CD 流程

```mermaid
graph LR
    A[代码提交] --> B[自动测试]
    B --> C[代码质量检查]
    C --> D[安全扫描]
    D --> E[构建镜像]
    E --> F{分支判断}
    F -->|develop| G[部署到开发环境]
    F -->|main| H[部署到生产环境]
    H --> I[健康检查]
    I --> J[通知]
```

### 流程阶段

1. **测试阶段** (Test)
   - 后端单元测试
   - 前端单元测试
   - 集成测试
   - 测试覆盖率报告

2. **质量检查** (Quality)
   - 代码格式检查
   - 代码规范检查
   - 类型检查
   - 复杂度分析

3. **安全扫描** (Security)
   - 依赖漏洞扫描
   - 代码安全扫描
   - Docker 镜像扫描

4. **构建阶段** (Build)
   - 构建 Docker 镜像
   - 推送到镜像仓库
   - 版本标记

5. **部署阶段** (Deploy)
   - 部署到目标环境
   - 数据库迁移
   - 健康检查
   - 通知

## GitHub Actions 配置

### 配置文件

配置文件位于 `.github/workflows/ci.yml`

### 触发条件

```yaml
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  workflow_dispatch:  # 手动触发
```

### 环境变量

在 GitHub 仓库设置中配置以下 Secrets：

| Secret 名称 | 说明 | 示例 |
|------------|------|------|
| DOCKER_USERNAME | Docker Hub 用户名 | your-username |
| DOCKER_PASSWORD | Docker Hub 密码 | your-password |
| PROD_HOST | 生产服务器地址 | 192.168.1.100 |
| PROD_USERNAME | 生产服务器用户名 | deploy |
| PROD_SSH_KEY | 生产服务器 SSH 私钥 | -----BEGIN RSA PRIVATE KEY----- |
| SLACK_WEBHOOK | Slack 通知 Webhook | https://hooks.slack.com/... |

### 配置步骤

1. **进入仓库设置**
   ```
   GitHub 仓库 → Settings → Secrets and variables → Actions
   ```

2. **添加 Secrets**
   - 点击 "New repository secret"
   - 输入名称和值
   - 点击 "Add secret"

3. **配置环境**
   ```
   Settings → Environments → New environment
   ```
   - 创建 `production` 环境
   - 配置保护规则（可选）
   - 添加环境特定的 Secrets

### 工作流任务

#### 1. 后端测试

```yaml
backend-test:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:15-alpine
    redis:
      image: redis:7-alpine
  steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-python@v4
    - run: pip install -r requirements.txt
    - run: pytest tests/ --cov=app
```

#### 2. 前端测试

```yaml
frontend-test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
    - run: npm ci
    - run: npm run test:coverage
```

#### 3. 代码质量检查

```yaml
code-quality:
  runs-on: ubuntu-latest
  steps:
    - run: flake8 app/
    - run: black --check app/
    - run: npm run lint
```

#### 4. 安全扫描

```yaml
security-scan:
  runs-on: ubuntu-latest
  steps:
    - uses: aquasecurity/trivy-action@master
    - run: bandit -r app/
```

#### 5. 构建和推送镜像

```yaml
build-docker:
  needs: [backend-test, frontend-test]
  steps:
    - uses: docker/build-push-action@v4
      with:
        push: true
        tags: username/admin-backend:latest
```

#### 6. 部署到生产

```yaml
deploy-production:
  needs: [build-docker]
  if: github.ref == 'refs/heads/main'
  steps:
    - uses: appleboy/ssh-action@master
      with:
        script: |
          cd /opt/admin-system-template
          docker-compose pull
          docker-compose up -d
```

### 查看工作流状态

```bash
# 在仓库页面查看
GitHub 仓库 → Actions → 选择工作流

# 查看徽章
[![CI/CD](https://github.com/username/repo/workflows/CI%2FCD%20Pipeline/badge.svg)](https://github.com/username/repo/actions)
```

## GitLab CI 配置

### 配置文件

配置文件位于 `.gitlab-ci.yml`

### 环境变量

在 GitLab 项目设置中配置以下变量：

```
Settings → CI/CD → Variables
```

| 变量名称 | 说明 | 保护 | 掩码 |
|---------|------|------|------|
| CI_REGISTRY_USER | 镜像仓库用户名 | ✓ | ✗ |
| CI_REGISTRY_PASSWORD | 镜像仓库密码 | ✓ | ✓ |
| DEV_HOST | 开发服务器地址 | ✗ | ✗ |
| DEV_USER | 开发服务器用户 | ✗ | ✗ |
| DEV_SSH_PRIVATE_KEY | 开发服务器 SSH 私钥 | ✓ | ✓ |
| PROD_HOST | 生产服务器地址 | ✓ | ✗ |
| PROD_USER | 生产服务器用户 | ✓ | ✗ |
| PROD_SSH_PRIVATE_KEY | 生产服务器 SSH 私钥 | ✓ | ✓ |

### 流水线阶段

```yaml
stages:
  - test        # 测试
  - quality     # 质量检查
  - security    # 安全扫描
  - build       # 构建镜像
  - deploy      # 部署
```

### 查看流水线

```bash
# 在项目页面查看
GitLab 项目 → CI/CD → Pipelines

# 查看徽章
[![pipeline status](https://gitlab.com/username/repo/badges/main/pipeline.svg)](https://gitlab.com/username/repo/-/commits/main)
```

## 本地测试

### 运行测试

#### 后端测试

```bash
cd admin-mit-backend

# 安装依赖
pip install -r requirements.txt

# 运行所有测试
pytest tests/ -v

# 运行测试并生成覆盖率报告
pytest tests/ --cov=app --cov-report=html

# 查看覆盖率报告
open htmlcov/index.html
```

#### 前端测试

```bash
cd admin-mit-ui

# 安装依赖
npm ci

# 运行测试
npm run test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 查看覆盖率报告
open coverage/index.html
```

### 代码质量检查

#### 后端

```bash
cd admin-mit-backend

# 代码格式检查
flake8 app/ --max-line-length=120

# 代码格式化
black app/

# 导入排序
isort app/

# 类型检查
mypy app/

# 安全检查
bandit -r app/
```

#### 前端

```bash
cd admin-mit-ui

# ESLint 检查
npm run lint

# 修复 ESLint 问题
npm run lint:fix

# Prettier 检查
npx prettier --check "src/**/*.{ts,tsx,js,jsx}"

# Prettier 格式化
npx prettier --write "src/**/*.{ts,tsx,js,jsx}"
```

### 本地构建 Docker 镜像

```bash
# 构建后端镜像
docker build -t admin-backend:local ./admin-mit-backend

# 构建前端镜像
docker build -t admin-frontend:local ./admin-mit-ui

# 运行本地镜像
docker-compose -f docker-compose.local.yml up -d
```

## 部署流程

### 开发环境部署

**触发条件**: 推送到 `develop` 分支

**流程**:
1. 运行所有测试
2. 构建 Docker 镜像
3. 推送镜像到仓库
4. SSH 连接到开发服务器
5. 拉取最新镜像
6. 重启服务
7. 运行数据库迁移

**命令**:
```bash
# 手动部署
git push origin develop

# 查看部署日志
# GitHub: Actions → 选择工作流
# GitLab: CI/CD → Pipelines → 选择流水线
```

### 生产环境部署

**触发条件**: 推送到 `main` 分支（需要手动批准）

**流程**:
1. 运行所有测试
2. 代码质量检查
3. 安全扫描
4. 构建 Docker 镜像
5. 等待手动批准
6. 部署到生产环境
7. 健康检查
8. 发送通知

**命令**:
```bash
# 1. 合并到 main 分支
git checkout main
git merge develop
git push origin main

# 2. 在 CI/CD 界面手动批准部署
# GitHub: Actions → 选择工作流 → Review deployments
# GitLab: CI/CD → Pipelines → 选择流水线 → Manual job

# 3. 监控部署状态
# 查看日志和健康检查结果
```

### 手动部署

如果 CI/CD 不可用，可以手动部署：

```bash
# 1. SSH 连接到服务器
ssh user@server

# 2. 进入项目目录
cd /opt/admin-system-template

# 3. 拉取最新代码
git pull origin main

# 4. 拉取最新镜像
docker-compose pull

# 5. 重启服务
docker-compose up -d

# 6. 运行数据库迁移
docker-compose exec backend flask db upgrade

# 7. 健康检查
curl http://localhost:5000/api/health
```

## 回滚策略

### 自动回滚

如果健康检查失败，CI/CD 会自动标记部署失败。

### 手动回滚

#### 方法 1: 回滚到上一个版本

```bash
# GitHub Actions
# 1. 进入 Actions → 选择之前成功的工作流
# 2. 点击 "Re-run all jobs"

# GitLab CI
# 1. 进入 CI/CD → Pipelines
# 2. 选择之前成功的流水线
# 3. 点击 "Retry"
```

#### 方法 2: 回滚 Git 提交

```bash
# 1. 回滚到上一个提交
git revert HEAD
git push origin main

# 2. 或者重置到特定提交
git reset --hard <commit-hash>
git push origin main --force

# 3. CI/CD 会自动触发部署
```

#### 方法 3: 手动回滚

```bash
# 1. SSH 连接到服务器
ssh user@server

# 2. 回滚 Git 代码
cd /opt/admin-system-template
git checkout HEAD~1

# 3. 回滚 Docker 镜像
docker-compose pull
docker-compose up -d

# 4. 回滚数据库（如果需要）
docker-compose exec backend flask db downgrade
```

### 数据库回滚

```bash
# 查看迁移历史
docker-compose exec backend flask db history

# 回滚到特定版本
docker-compose exec backend flask db downgrade <revision>

# 回滚一个版本
docker-compose exec backend flask db downgrade
```

## 最佳实践

### 1. 分支策略

采用 Git Flow 工作流：

```
main (生产)
  ↑
develop (开发)
  ↑
feature/* (功能分支)
hotfix/* (热修复分支)
```

**规则**:
- `main`: 仅用于生产发布
- `develop`: 开发主分支
- `feature/*`: 新功能开发
- `hotfix/*`: 紧急修复

### 2. 提交规范

使用 Conventional Commits 规范：

```bash
# 功能
git commit -m "feat: 添加用户管理功能"

# 修复
git commit -m "fix: 修复登录验证问题"

# 文档
git commit -m "docs: 更新 API 文档"

# 样式
git commit -m "style: 格式化代码"

# 重构
git commit -m "refactor: 重构用户服务"

# 测试
git commit -m "test: 添加用户测试用例"

# 构建
git commit -m "build: 更新依赖版本"
```

### 3. 版本标记

使用语义化版本：

```bash
# 创建版本标签
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# 版本号规则
# MAJOR.MINOR.PATCH
# 1.0.0 → 1.0.1 (补丁)
# 1.0.1 → 1.1.0 (次版本)
# 1.1.0 → 2.0.0 (主版本)
```

### 4. 测试覆盖率

**目标**:
- 后端: ≥ 85%
- 前端: ≥ 80%

**检查**:
```bash
# 后端
pytest tests/ --cov=app --cov-report=term-missing

# 前端
npm run test:coverage
```

### 5. 代码审查

**Pull Request 检查清单**:
- ✅ 所有测试通过
- ✅ 代码覆盖率达标
- ✅ 代码质量检查通过
- ✅ 安全扫描无高危漏洞
- ✅ 文档已更新
- ✅ 至少一人审查通过

### 6. 部署检查清单

**部署前**:
- ✅ 所有测试通过
- ✅ 代码已合并到目标分支
- ✅ 数据库迁移脚本已准备
- ✅ 配置文件已更新
- ✅ 备份已完成

**部署后**:
- ✅ 健康检查通过
- ✅ 关键功能验证
- ✅ 日志无错误
- ✅ 性能指标正常
- ✅ 通知相关人员

### 7. 监控和告警

**监控指标**:
- 应用健康状态
- API 响应时间
- 错误率
- 资源使用率
- 数据库性能

**告警渠道**:
- Slack
- 邮件
- 短信（紧急）

### 8. 文档维护

**必需文档**:
- README.md
- CHANGELOG.md
- API 文档
- 部署文档
- 故障排查指南

**更新时机**:
- 新功能发布
- API 变更
- 配置变更
- 已知问题

## 故障排查

### CI/CD 失败

#### 测试失败

```bash
# 查看测试日志
# GitHub: Actions → 选择工作流 → 查看日志
# GitLab: CI/CD → Pipelines → 查看日志

# 本地重现
pytest tests/ -v --tb=short

# 调试特定测试
pytest tests/test_file.py::test_function -v
```

#### 构建失败

```bash
# 检查 Dockerfile
docker build -t test ./admin-mit-backend

# 检查依赖
pip install -r requirements.txt
npm ci

# 查看构建日志
docker build --progress=plain -t test .
```

#### 部署失败

```bash
# 检查服务器连接
ssh user@server

# 检查 Docker 服务
docker ps
docker-compose ps

# 查看容器日志
docker-compose logs backend
docker-compose logs frontend

# 检查健康状态
curl http://localhost:5000/api/health
```

### 常见问题

#### 1. 测试超时

**解决方案**:
```yaml
# 增加超时时间
timeout-minutes: 30
```

#### 2. 依赖安装失败

**解决方案**:
```bash
# 清理缓存
pip cache purge
npm cache clean --force

# 重新安装
pip install -r requirements.txt --no-cache-dir
npm ci --prefer-offline
```

#### 3. Docker 镜像推送失败

**解决方案**:
```bash
# 检查登录状态
docker login

# 检查镜像标签
docker images

# 手动推送
docker push username/image:tag
```

## 参考资料

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [GitLab CI/CD 文档](https://docs.gitlab.com/ee/ci/)
- [Docker 文档](https://docs.docker.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
