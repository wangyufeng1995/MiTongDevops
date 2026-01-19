# Docker 部署指南

本文档详细说明如何使用 Docker 和 Docker Compose 部署 Admin System Template。

## 目录

- [前置要求](#前置要求)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [服务架构](#服务架构)
- [常用命令](#常用命令)
- [故障排查](#故障排查)
- [生产环境部署](#生产环境部署)

## 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- 至少 4GB 可用内存
- 至少 10GB 可用磁盘空间

### 安装 Docker

**Ubuntu/Debian:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

**CentOS/RHEL:**
```bash
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install docker-ce docker-ce-cli containerd.io
sudo systemctl start docker
sudo systemctl enable docker
```

### 安装 Docker Compose

```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd admin-system-template
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，设置数据库密码等敏感信息
nano .env
```

**重要配置项：**
- `DB_PASSWORD`: 数据库密码（必须修改）
- `SECRET_KEY`: Flask 应用密钥（必须修改）
- `JWT_SECRET_KEY`: JWT 密钥（必须修改）

### 3. 启动服务

```bash
# 使用启动脚本（推荐）
chmod +x docker-start.sh
./docker-start.sh

# 或手动启动
docker-compose up -d
```

### 4. 访问应用

- **前端**: http://localhost:80
- **后端 API**: http://localhost:5000
- **健康检查**: http://localhost:5000/api/health

### 5. 查看日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f celery-worker
```

## 配置说明

### 环境变量配置 (.env)

```bash
# 数据库配置
DB_NAME=mitong_devops              # 数据库名称
DB_USER=postgres                   # 数据库用户
DB_PASSWORD=your_secure_password   # 数据库密码（必须修改）
DB_PORT=5432                       # 数据库端口

# Redis 配置
REDIS_PORT=6379                    # Redis 端口

# 后端配置
BACKEND_PORT=5000                  # 后端服务端口
FLASK_ENV=production               # Flask 环境（production/development）
SECRET_KEY=change-this-key         # Flask 密钥（必须修改）
JWT_SECRET_KEY=change-this-jwt-key # JWT 密钥（必须修改）

# 前端配置
FRONTEND_PORT=80                   # 前端服务端口

# 时区配置
TZ=Asia/Shanghai                   # 时区设置
```

### 后端配置文件

后端配置文件位于 `admin-mit-backend/config/` 目录：

- `database.yaml`: 数据库连接配置
- `redis.yaml`: Redis 连接配置
- `app.yaml`: 应用配置
- `logging.yaml`: 日志配置

**注意**: Docker 部署时，这些配置文件中的主机地址会被环境变量覆盖。

## 服务架构

Docker Compose 部署包含以下服务：

### 1. PostgreSQL (postgres)
- **镜像**: postgres:15-alpine
- **端口**: 5432
- **数据卷**: postgres_data
- **用途**: 主数据库

### 2. Redis (redis)
- **镜像**: redis:7-alpine
- **端口**: 6379
- **数据卷**: redis_data
- **用途**: 缓存和消息队列

### 3. Backend (backend)
- **构建**: admin-mit-backend/Dockerfile
- **端口**: 5000
- **依赖**: postgres, redis
- **用途**: Flask API 服务

### 4. Celery Worker (celery-worker)
- **构建**: admin-mit-backend/Dockerfile
- **依赖**: postgres, redis
- **用途**: 异步任务处理

### 5. Celery Beat (celery-beat)
- **构建**: admin-mit-backend/Dockerfile
- **依赖**: postgres, redis
- **用途**: 定时任务调度

### 6. Frontend (frontend)
- **构建**: admin-mit-ui/Dockerfile
- **端口**: 80
- **依赖**: backend
- **用途**: Nginx + React 前端

### 服务依赖关系

```
frontend → backend → postgres
                  → redis
celery-worker → postgres
             → redis
celery-beat → postgres
           → redis
```

## 常用命令

### 启动和停止

```bash
# 启动所有服务
docker-compose up -d

# 停止所有服务
docker-compose down

# 停止并删除数据卷
docker-compose down -v

# 重启服务
docker-compose restart

# 重启特定服务
docker-compose restart backend
```

### 查看状态

```bash
# 查看服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend

# 查看最近 100 行日志
docker-compose logs --tail=100 backend
```

### 构建和更新

```bash
# 重新构建镜像
docker-compose build

# 重新构建特定服务
docker-compose build backend

# 不使用缓存重新构建
docker-compose build --no-cache

# 拉取最新镜像
docker-compose pull
```

### 进入容器

```bash
# 进入后端容器
docker-compose exec backend bash

# 进入前端容器
docker-compose exec frontend sh

# 进入数据库容器
docker-compose exec postgres psql -U postgres -d mitong_devops
```

### 数据库操作

```bash
# 运行数据库迁移
docker-compose exec backend flask db upgrade

# 创建新迁移
docker-compose exec backend flask db migrate -m "description"

# 数据库备份
docker-compose exec postgres pg_dump -U postgres mitong_devops > backup.sql

# 数据库恢复
docker-compose exec -T postgres psql -U postgres mitong_devops < backup.sql
```

### 清理

```bash
# 删除停止的容器
docker-compose rm

# 删除未使用的镜像
docker image prune -a

# 删除未使用的数据卷
docker volume prune

# 完全清理（谨慎使用）
docker system prune -a --volumes
```

## 故障排查

### 1. 服务无法启动

**检查日志：**
```bash
docker-compose logs backend
docker-compose logs postgres
```

**常见问题：**
- 端口被占用：修改 .env 中的端口配置
- 数据库连接失败：检查 postgres 服务是否正常启动
- 权限问题：确保 docker-entrypoint.sh 有执行权限

### 2. 数据库连接失败

```bash
# 检查 PostgreSQL 是否运行
docker-compose ps postgres

# 检查数据库日志
docker-compose logs postgres

# 测试数据库连接
docker-compose exec postgres psql -U postgres -c "SELECT 1"
```

### 3. Redis 连接失败

```bash
# 检查 Redis 是否运行
docker-compose ps redis

# 测试 Redis 连接
docker-compose exec redis redis-cli ping
```

### 4. 前端无法访问后端

**检查 Nginx 配置：**
```bash
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf
```

**检查后端健康状态：**
```bash
curl http://localhost:5000/api/health
```

### 5. Celery 任务不执行

```bash
# 检查 Celery Worker 日志
docker-compose logs celery-worker

# 检查 Celery Beat 日志
docker-compose logs celery-beat

# 检查 Redis 连接
docker-compose exec celery-worker python -c "from celery import Celery; app = Celery('test', broker='redis://redis:6379/2'); print(app.control.inspect().active())"
```

### 6. 容器内存不足

```bash
# 查看容器资源使用
docker stats

# 增加 Docker 内存限制（docker-compose.yml）
services:
  backend:
    mem_limit: 2g
    mem_reservation: 1g
```

## 生产环境部署

### 1. 安全加固

**修改默认密码：**
```bash
# 生成强密码
openssl rand -base64 32

# 更新 .env 文件
DB_PASSWORD=<generated-password>
SECRET_KEY=<generated-key>
JWT_SECRET_KEY=<generated-jwt-key>
```

**限制端口暴露：**
```yaml
# docker-compose.yml
services:
  postgres:
    ports:
      - "127.0.0.1:5432:5432"  # 仅本地访问
  redis:
    ports:
      - "127.0.0.1:6379:6379"  # 仅本地访问
```

### 2. 配置 HTTPS

使用 Nginx 反向代理配置 SSL：

```nginx
# nginx-ssl.conf
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

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

### 3. 数据备份策略

**自动备份脚本：**
```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# 备份数据库
docker-compose exec -T postgres pg_dump -U postgres mitong_devops | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# 备份数据卷
docker run --rm -v admin-system-template_postgres_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/postgres_data_$DATE.tar.gz -C /data .

# 删除 7 天前的备份
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete
```

**配置定时任务：**
```bash
# 添加到 crontab
0 2 * * * /path/to/backup.sh
```

### 4. 监控和日志

**配置日志轮转：**
```yaml
# docker-compose.yml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

**集成监控工具：**
- Prometheus + Grafana
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Datadog / New Relic

### 5. 性能优化

**调整 Worker 数量：**
```yaml
# docker-compose.yml
services:
  backend:
    command: gunicorn --bind 0.0.0.0:5000 --workers 8 --threads 4 app:app
  
  celery-worker:
    command: celery -A celery_worker.celery worker --concurrency=8
```

**配置资源限制：**
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

## 维护建议

1. **定期更新镜像**：每月检查并更新基础镜像
2. **监控磁盘空间**：定期清理日志和未使用的镜像
3. **备份验证**：定期测试备份恢复流程
4. **安全扫描**：使用 `docker scan` 扫描镜像漏洞
5. **性能监控**：监控容器资源使用情况

## 支持

如有问题，请查看：
- [项目文档](./README.md)
- [故障排查指南](#故障排查)
- [GitHub Issues](https://github.com/your-repo/issues)
