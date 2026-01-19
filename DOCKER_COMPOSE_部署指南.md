# Docker Compose 部署指南

本文档提供完整的 Docker Compose 部署方法，适用于开发、测试和生产环境。

## 📋 目录

- [系统要求](#系统要求)
- [快速部署](#快速部署)
- [详细步骤](#详细步骤)
- [服务说明](#服务说明)
- [常用操作](#常用操作)
- [故障排查](#故障排查)
- [生产环境配置](#生产环境配置)

---

## 系统要求

### 硬件要求
- CPU: 2核心及以上
- 内存: 4GB 及以上（推荐 8GB）
- 磁盘: 20GB 可用空间

### 软件要求
- Docker 20.10+
- Docker Compose 2.0+
- Git（用于克隆代码）

### 安装 Docker 和 Docker Compose

**Ubuntu/Debian:**
```bash
# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

**CentOS/RHEL:**
```bash
# 安装 Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl start docker
sudo systemctl enable docker

# 验证安装
docker --version
docker compose version
```

---

## 快速部署

### 一键启动（推荐）

```bash
# 1. 克隆项目
git clone <repository-url>
cd admin-system-template

# 2. 复制并配置环境变量
cp .env.example .env
nano .env  # 修改数据库密码等敏感信息

# 3. 启动所有服务
docker-compose up -d

# 4. 查看服务状态
docker-compose ps

# 5. 查看日志
docker-compose logs -f
```

### 访问应用

启动成功后，可以通过以下地址访问：

- **前端界面**: http://localhost:80
- **后端 API**: http://localhost:5000
- **API 文档**: http://localhost:5000/api/docs
- **健康检查**: http://localhost:5000/api/health

默认管理员账号：
- 用户名: `admin`
- 密码: 首次启动后在日志中查看或通过初始化脚本设置

---

## 详细步骤

### 步骤 1: 准备项目代码

```bash
# 克隆项目
git clone <repository-url>
cd admin-system-template

# 查看项目结构
ls -la
```

### 步骤 2: 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量文件
nano .env
```

**必须修改的配置项：**

```bash
# 数据库配置（生产环境必须修改密码）
DB_NAME=mitong_devops
DB_USER=postgres
DB_PASSWORD=your_secure_password_here  # ⚠️ 必须修改

# 后端安全配置（生产环境必须修改）
SECRET_KEY=your-secret-key-change-this-in-production  # ⚠️ 必须修改
JWT_SECRET_KEY=your-jwt-secret-key-change-this-in-production  # ⚠️ 必须修改

# 端口配置（可选）
BACKEND_PORT=5000
FRONTEND_PORT=80
DB_PORT=5432
REDIS_PORT=6379

# 环境配置
FLASK_ENV=production
TZ=Asia/Shanghai
```

**生成安全密钥：**

```bash
# 生成随机密钥
openssl rand -base64 32
# 输出示例: pbmvKayeEUBdk-HL6yjhFWnp8-_23Z9n2trLv6i1RqM=

# 将生成的密钥填入 .env 文件
```

### 步骤 3: 配置后端（可选）

如需自定义后端配置，编辑以下文件：

```bash
# 数据库配置
nano admin-mit-backend/config/database.yaml

# Redis 配置
nano admin-mit-backend/config/redis.yaml

# 应用配置
nano admin-mit-backend/config/app.yaml
```

**注意**: Docker 部署时，环境变量会覆盖配置文件中的设置。

### 步骤 4: 启动服务

```bash
# 构建并启动所有服务（后台运行）
docker-compose up -d

# 或者前台运行（查看实时日志）
docker-compose up
```

**启动过程说明：**

1. 拉取基础镜像（PostgreSQL、Redis、Nginx 等）
2. 构建后端镜像（安装 Python 依赖）
3. 构建前端镜像（编译 React 应用）
4. 启动数据库和 Redis
5. 运行数据库迁移
6. 启动后端服务
7. 启动 Celery Worker 和 Beat
8. 启动前端服务

### 步骤 5: 验证部署

```bash
# 查看所有服务状态
docker-compose ps

# 预期输出：
# NAME                   STATUS              PORTS
# admin-backend          Up (healthy)        0.0.0.0:5000->5000/tcp
# admin-celery-beat      Up                  
# admin-celery-worker    Up                  
# admin-frontend         Up (healthy)        0.0.0.0:80->80/tcp
# admin-postgres         Up (healthy)        0.0.0.0:5432->5432/tcp
# admin-redis            Up (healthy)        0.0.0.0:6379->6379/tcp

# 检查后端健康状态
curl http://localhost:5000/api/health

# 预期输出：
# {"status": "healthy", "database": "connected", "redis": "connected"}

# 查看服务日志
docker-compose logs -f backend
```

### 步骤 6: 初始化数据（首次部署）

```bash
# 进入后端容器
docker-compose exec backend bash

# 初始化菜单数据
python init_menu_data.py

# 创建管理员账号（如果需要）
flask create-admin --username admin --password your_password

# 退出容器
exit
```

---

## 服务说明

### 服务架构

```
┌─────────────┐
│   Frontend  │ (Nginx + React)
│   Port: 80  │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│   Backend   │────▶│  PostgreSQL  │
│  Port: 5000 │     │  Port: 5432  │
└──────┬──────┘     └──────────────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│Celery Worker│────▶│    Redis     │
│             │     │  Port: 6379  │
└─────────────┘     └──────────────┘
       ▲
       │
┌─────────────┐
│ Celery Beat │ (定时任务)
└─────────────┘
```

### 各服务详情

#### 1. PostgreSQL (postgres)
- **镜像**: `postgres:15-alpine`
- **用途**: 主数据库，存储所有业务数据
- **端口**: 5432
- **数据卷**: `postgres_data`（持久化存储）
- **健康检查**: 每 10 秒检查一次

#### 2. Redis (redis)
- **镜像**: `redis:7-alpine`
- **用途**: 缓存和消息队列
- **端口**: 6379
- **数据卷**: `redis_data`（持久化存储）
- **持久化**: AOF 模式

#### 3. Backend (backend)
- **构建**: 基于 `admin-mit-backend/Dockerfile`
- **用途**: Flask API 服务
- **端口**: 5000
- **依赖**: PostgreSQL、Redis
- **工作进程**: 4 个 Gunicorn worker

#### 4. Celery Worker (celery-worker)
- **构建**: 基于 `admin-mit-backend/Dockerfile`
- **用途**: 异步任务处理（如邮件发送、数据导出等）
- **并发**: 4 个工作进程
- **依赖**: PostgreSQL、Redis

#### 5. Celery Beat (celery-beat)
- **构建**: 基于 `admin-mit-backend/Dockerfile`
- **用途**: 定时任务调度器
- **依赖**: PostgreSQL、Redis

#### 6. Frontend (frontend)
- **构建**: 基于 `admin-mit-ui/Dockerfile`（多阶段构建）
- **用途**: Nginx + React 前端应用
- **端口**: 80
- **特性**: Gzip 压缩、静态资源缓存、API 反向代理

---

## 常用操作

### 服务管理

```bash
# 启动所有服务
docker-compose up -d

# 停止所有服务
docker-compose down

# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart backend

# 停止特定服务
docker-compose stop backend

# 启动特定服务
docker-compose start backend

# 查看服务状态
docker-compose ps

# 查看服务资源使用
docker stats
```

### 日志管理

```bash
# 查看所有服务日志
docker-compose logs

# 实时查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs backend
docker-compose logs frontend
docker-compose logs celery-worker

# 查看最近 100 行日志
docker-compose logs --tail=100 backend

# 查看带时间戳的日志
docker-compose logs -t backend
```

### 容器操作

```bash
# 进入后端容器
docker-compose exec backend bash

# 进入前端容器
docker-compose exec frontend sh

# 进入数据库容器
docker-compose exec postgres psql -U postgres -d mitong_devops

# 进入 Redis 容器
docker-compose exec redis redis-cli

# 在容器中执行命令（不进入容器）
docker-compose exec backend python --version
docker-compose exec backend flask --version
```

### 数据库操作

```bash
# 运行数据库迁移
docker-compose exec backend flask db upgrade

# 创建新的迁移
docker-compose exec backend flask db migrate -m "描述信息"

# 查看迁移历史
docker-compose exec backend flask db history

# 回滚迁移
docker-compose exec backend flask db downgrade

# 数据库备份
docker-compose exec postgres pg_dump -U postgres mitong_devops > backup_$(date +%Y%m%d).sql

# 数据库恢复
docker-compose exec -T postgres psql -U postgres mitong_devops < backup_20250119.sql

# 连接数据库
docker-compose exec postgres psql -U postgres -d mitong_devops
```

### 镜像管理

```bash
# 重新构建镜像
docker-compose build

# 重新构建特定服务
docker-compose build backend

# 不使用缓存重新构建
docker-compose build --no-cache

# 拉取最新基础镜像
docker-compose pull

# 查看镜像
docker images

# 删除未使用的镜像
docker image prune -a
```

### 数据卷管理

```bash
# 查看数据卷
docker volume ls

# 查看数据卷详情
docker volume inspect admin-system-template_postgres_data

# 备份数据卷
docker run --rm -v admin-system-template_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz -C /data .

# 恢复数据卷
docker run --rm -v admin-system-template_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres_backup.tar.gz -C /data

# 删除所有数据（谨慎使用）
docker-compose down -v
```

### 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build

# 或分步执行
docker-compose build
docker-compose down
docker-compose up -d
```

---

## 故障排查

### 1. 服务无法启动

**问题**: 容器启动后立即退出

```bash
# 查看容器日志
docker-compose logs backend

# 常见原因和解决方法：
```

**原因 1: 端口被占用**
```bash
# 检查端口占用
netstat -tulpn | grep 5000
lsof -i :5000

# 解决方法：修改 .env 中的端口
BACKEND_PORT=5001
```

**原因 2: 数据库连接失败**
```bash
# 检查 PostgreSQL 状态
docker-compose ps postgres

# 检查数据库日志
docker-compose logs postgres

# 测试数据库连接
docker-compose exec postgres psql -U postgres -c "SELECT 1"
```

**原因 3: 权限问题**
```bash
# 检查文件权限
ls -la admin-mit-backend/docker-entrypoint.sh

# 添加执行权限
chmod +x admin-mit-backend/docker-entrypoint.sh
```

### 2. 前端无法访问后端

**问题**: 前端页面加载正常，但 API 请求失败

```bash
# 检查 Nginx 配置
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf

# 检查后端健康状态
curl http://localhost:5000/api/health

# 检查网络连接
docker-compose exec frontend ping backend
```

**解决方法**:
- 确保 `nginx.conf` 中的 `proxy_pass` 指向 `http://backend:5000`
- 检查 Docker 网络配置

### 3. 数据库连接错误

**错误信息**: `FATAL: password authentication failed`

```bash
# 检查环境变量
docker-compose exec backend env | grep DB_

# 检查数据库密码
docker-compose exec postgres psql -U postgres -c "\du"

# 重置数据库密码
docker-compose exec postgres psql -U postgres -c "ALTER USER postgres PASSWORD 'new_password';"
```

### 4. Redis 连接失败

```bash
# 检查 Redis 状态
docker-compose ps redis

# 测试 Redis 连接
docker-compose exec redis redis-cli ping

# 检查 Redis 日志
docker-compose logs redis
```

### 5. Celery 任务不执行

```bash
# 检查 Celery Worker 状态
docker-compose logs celery-worker

# 检查 Celery Beat 状态
docker-compose logs celery-beat

# 检查任务队列
docker-compose exec redis redis-cli
> KEYS celery*
> LLEN celery

# 重启 Celery 服务
docker-compose restart celery-worker celery-beat
```

### 6. 内存不足

```bash
# 查看容器资源使用
docker stats

# 增加 Docker 内存限制
# 编辑 docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G
```

### 7. 磁盘空间不足

```bash
# 查看磁盘使用
df -h

# 清理 Docker 资源
docker system prune -a --volumes

# 清理日志
docker-compose exec backend rm -rf logs/*
```

### 8. 网络问题

```bash
# 查看 Docker 网络
docker network ls

# 检查网络详情
docker network inspect admin-system-template_admin-network

# 重建网络
docker-compose down
docker-compose up -d
```

---

## 生产环境配置

### 1. 安全加固

#### 修改默认密码

```bash
# 生成强密码
openssl rand -base64 32

# 更新 .env 文件
DB_PASSWORD=<生成的强密码>
SECRET_KEY=<生成的密钥>
JWT_SECRET_KEY=<生成的JWT密钥>
```

#### 限制端口暴露

编辑 `docker-compose.yml`：

```yaml
services:
  postgres:
    ports:
      - "127.0.0.1:5432:5432"  # 仅本地访问
  
  redis:
    ports:
      - "127.0.0.1:6379:6379"  # 仅本地访问
  
  backend:
    ports:
      - "127.0.0.1:5000:5000"  # 仅本地访问
```

#### 配置防火墙

```bash
# Ubuntu/Debian
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# CentOS/RHEL
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 2. HTTPS 配置

#### 使用 Let's Encrypt

```bash
# 安装 Certbot
sudo apt-get install certbot

# 获取证书
sudo certbot certonly --standalone -d your-domain.com

# 证书位置
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem
```

#### 配置 Nginx SSL

创建 `nginx-ssl.conf`：

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

更新 `docker-compose.yml`：

```yaml
services:
  nginx-proxy:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx-ssl.conf:/etc/nginx/conf.d/default.conf
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - frontend
    networks:
      - admin-network
```

### 3. 数据备份策略

#### 自动备份脚本

创建 `backup.sh`：

```bash
#!/bin/bash
set -e

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
echo "Backing up database..."
docker-compose exec -T postgres pg_dump -U postgres mitong_devops | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# 备份 PostgreSQL 数据卷
echo "Backing up PostgreSQL data volume..."
docker run --rm \
  -v admin-system-template_postgres_data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/postgres_data_$DATE.tar.gz -C /data .

# 备份 Redis 数据卷
echo "Backing up Redis data volume..."
docker run --rm \
  -v admin-system-template_redis_data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/redis_data_$DATE.tar.gz -C /data .

# 删除旧备份
echo "Cleaning up old backups..."
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $DATE"
```

#### 配置定时备份

```bash
# 添加执行权限
chmod +x backup.sh

# 编辑 crontab
crontab -e

# 添加定时任务（每天凌晨 2 点执行）
0 2 * * * /path/to/backup.sh >> /var/log/backup.log 2>&1
```

#### 恢复备份

```bash
# 恢复数据库
gunzip < /backups/db_20250119_020000.sql.gz | docker-compose exec -T postgres psql -U postgres mitong_devops

# 恢复数据卷
docker run --rm \
  -v admin-system-template_postgres_data:/data \
  -v /backups:/backup \
  alpine tar xzf /backup/postgres_data_20250119_020000.tar.gz -C /data
```

### 4. 监控和日志

#### 配置日志轮转

编辑 `docker-compose.yml`：

```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
  
  celery-worker:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

#### 集成 Prometheus 监控

添加到 `docker-compose.yml`：

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: admin-prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - admin-network

  grafana:
    image: grafana/grafana:latest
    container_name: admin-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - admin-network

volumes:
  prometheus_data:
  grafana_data:
```

### 5. 性能优化

#### 调整 Worker 数量

编辑 `docker-compose.yml`：

```yaml
services:
  backend:
    command: gunicorn --bind 0.0.0.0:5000 --workers 8 --threads 4 --timeout 120 app:app
  
  celery-worker:
    command: celery -A celery_worker.celery worker --loglevel=info --concurrency=8
```

#### 配置资源限制

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

#### 数据库优化

```bash
# 进入数据库容器
docker-compose exec postgres psql -U postgres -d mitong_devops

# 分析表
ANALYZE;

# 清理死元组
VACUUM FULL;

# 重建索引
REINDEX DATABASE mitong_devops;
```

### 6. 高可用配置

#### 使用 Docker Swarm

```bash
# 初始化 Swarm
docker swarm init

# 部署服务栈
docker stack deploy -c docker-compose.yml admin-stack

# 扩展服务
docker service scale admin-stack_backend=3
docker service scale admin-stack_celery-worker=5
```

#### 配置负载均衡

使用 Nginx 或 HAProxy 进行负载均衡：

```nginx
upstream backend_servers {
    server backend1:5000;
    server backend2:5000;
    server backend3:5000;
}

server {
    listen 80;
    location / {
        proxy_pass http://backend_servers;
    }
}
```

---

## 维护建议

### 日常维护

1. **每日检查**
   - 查看服务状态: `docker-compose ps`
   - 检查日志错误: `docker-compose logs --tail=100`
   - 监控资源使用: `docker stats`

2. **每周维护**
   - 清理日志文件
   - 检查磁盘空间
   - 验证备份完整性

3. **每月维护**
   - 更新基础镜像
   - 安全漏洞扫描
   - 性能优化分析

### 更新策略

```bash
# 1. 备份数据
./backup.sh

# 2. 拉取最新代码
git pull

# 3. 重新构建镜像
docker-compose build --no-cache

# 4. 停止服务
docker-compose down

# 5. 启动新版本
docker-compose up -d

# 6. 验证部署
docker-compose ps
curl http://localhost:5000/api/health
```

### 安全检查

```bash
# 扫描镜像漏洞
docker scan admin-system-template_backend

# 检查容器安全
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image admin-system-template_backend

# 审计日志
docker-compose logs | grep -i "error\|warning\|failed"
```

---

## 常见问题

### Q1: 如何修改端口？

编辑 `.env` 文件：
```bash
BACKEND_PORT=8000
FRONTEND_PORT=8080
```

然后重启服务：
```bash
docker-compose down
docker-compose up -d
```

### Q2: 如何重置数据库？

```bash
# 停止服务并删除数据卷
docker-compose down -v

# 重新启动（会创建新的数据库）
docker-compose up -d
```

### Q3: 如何查看实时日志？

```bash
# 所有服务
docker-compose logs -f

# 特定服务
docker-compose logs -f backend
```

### Q4: 如何更新代码？

```bash
git pull
docker-compose up -d --build
```

### Q5: 如何导出/导入数据？

```bash
# 导出
docker-compose exec postgres pg_dump -U postgres mitong_devops > data.sql

# 导入
docker-compose exec -T postgres psql -U postgres mitong_devops < data.sql
```

---

## 参考资料

- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)
- [Redis 文档](https://redis.io/documentation)
- [Nginx 文档](https://nginx.org/en/docs/)
- [Flask 文档](https://flask.palletsprojects.com/)
- [Celery 文档](https://docs.celeryproject.org/)

---

## 技术支持

如遇到问题，请：

1. 查看本文档的故障排查部分
2. 检查服务日志: `docker-compose logs`
3. 查看项目 Issues
4. 联系技术支持团队

---

**最后更新**: 2025-01-19
