# 生产环境部署指南

本文档提供完整的生产环境部署步骤，包括安全加固、监控配置和运维指南。

## 目录

1. [部署前准备](#部署前准备)
2. [服务器配置](#服务器配置)
3. [安全加固](#安全加固)
4. [应用部署](#应用部署)
5. [监控配置](#监控配置)
6. [备份策略](#备份策略)
7. [运维指南](#运维指南)

---

## 部署前准备

### 1. 系统要求

**最低配置：**
- CPU: 2 核
- 内存: 4GB
- 磁盘: 50GB SSD
- 操作系统: Ubuntu 20.04 LTS 或更高版本

**推荐配置：**
- CPU: 4 核
- 内存: 8GB
- 磁盘: 100GB SSD
- 操作系统: Ubuntu 22.04 LTS

### 2. 软件依赖

```bash
# 更新系统
sudo apt-get update
sudo apt-get upgrade -y

# 安装基础工具
sudo apt-get install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    net-tools \
    ufw \
    fail2ban

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

### 3. 域名和 DNS 配置

```bash
# 配置 DNS A 记录
# your-domain.com -> 服务器 IP
# www.your-domain.com -> 服务器 IP
# api.your-domain.com -> 服务器 IP (可选)

# 验证 DNS 解析
nslookup your-domain.com
dig your-domain.com
```

---

## 服务器配置

### 1. 创建部署用户

```bash
# 创建部署用户
sudo adduser deploy
sudo usermod -aG sudo deploy
sudo usermod -aG docker deploy

# 配置 SSH 密钥认证
sudo su - deploy
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 将公钥添加到 authorized_keys
echo "your-public-key" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 2. SSH 安全配置

编辑 `/etc/ssh/sshd_config`:

```bash
# 禁用 root 登录
PermitRootLogin no

# 禁用密码认证
PasswordAuthentication no

# 只允许密钥认证
PubkeyAuthentication yes

# 修改 SSH 端口（可选）
Port 2222

# 限制登录用户
AllowUsers deploy

# 重启 SSH 服务
sudo systemctl restart sshd
```

### 3. 配置防火墙

```bash
# 配置 UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 允许 SSH（使用自定义端口）
sudo ufw allow 2222/tcp

# 允许 HTTP 和 HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status verbose
```

### 4. 配置 Fail2Ban

```bash
# 安装 Fail2Ban
sudo apt-get install fail2ban -y

# 创建配置文件
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# 编辑配置
sudo vim /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 2222
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
```

```bash
# 启动 Fail2Ban
sudo systemctl start fail2ban
sudo systemctl enable fail2ban

# 查看状态
sudo fail2ban-client status
```

---

## 安全加固

### 1. HTTPS/SSL 配置

详细步骤请参考 [安全加固和监控指南](admin-mit-backend/docs/SECURITY_HARDENING_GUIDE.md#httpsssl-配置)

```bash
# 安装 Certbot
sudo apt-get install certbot python3-certbot-nginx -y

# 生成证书
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 测试自动续期
sudo certbot renew --dry-run

# 配置自动续期
sudo crontab -e
# 添加: 0 0 * * * certbot renew --quiet
```

### 2. 配置安全响应头

Nginx 配置已包含在 [SECURITY_HARDENING_GUIDE.md](admin-mit-backend/docs/SECURITY_HARDENING_GUIDE.md) 中。

### 3. 配置 API 频率限制

```bash
# 复制生产配置
cd admin-mit-backend
cp config/security.prod.yaml config/security.yaml

# 编辑配置
vim config/security.yaml

# 根据实际需求调整频率限制
```

### 4. 配置安全审计日志

```bash
# 创建日志目录
sudo mkdir -p /var/log/admin
sudo chown deploy:deploy /var/log/admin

# 配置日志轮转
sudo vim /etc/logrotate.d/admin-system
```

```
/var/log/admin/*.log {
    daily
    rotate 90
    compress
    delaycompress
    notifempty
    create 0640 deploy deploy
    sharedscripts
    postrotate
        docker-compose -f /home/deploy/admin-system/docker-compose.yml restart backend
    endscript
}
```

---

## 应用部署

### 1. 克隆代码

```bash
# 切换到部署用户
sudo su - deploy

# 克隆代码
cd ~
git clone https://github.com/your-org/admin-system.git
cd admin-system
```

### 2. 配置环境变量

```bash
# 后端配置
cd admin-mit-backend
cp .env.example .env
vim .env
```

```bash
# 数据库配置
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=admin_system_prod
DATABASE_USER=admin_user
DATABASE_PASSWORD=<strong-password>

# Redis 配置
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<strong-password>

# JWT 配置
JWT_SECRET_KEY=<generate-strong-key>
JWT_ACCESS_TOKEN_EXPIRES=3600

# 应用配置
FLASK_ENV=production
DEBUG=False
SECRET_KEY=<generate-strong-key>
```

```bash
# 前端配置
cd ../admin-mit-ui
cp .env.example .env
vim .env
```

```bash
VITE_API_BASE_URL=https://your-domain.com/api
VITE_APP_TITLE=Admin System
```

### 3. 生成密钥

```bash
# 生成 RSA 密钥对
cd admin-mit-backend
python scripts/generate_secrets.py

# 生成随机密钥
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 4. 构建 Docker 镜像

```bash
# 构建镜像
docker-compose build

# 或使用生产配置
docker-compose -f docker-compose.prod.yml build
```

### 5. 初始化数据库

```bash
# 启动数据库
docker-compose up -d postgres redis

# 等待数据库启动
sleep 10

# 运行数据库迁移
docker-compose run --rm backend flask db upgrade

# 初始化数据
docker-compose run --rm backend python init_database.py
```

### 6. 启动应用

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 查看服务状态
docker-compose ps
```

### 7. 验证部署

```bash
# 检查健康状态
curl http://localhost:5000/health

# 检查前端
curl http://localhost

# 检查 HTTPS
curl https://your-domain.com
```

---

## 监控配置

### 1. Prometheus 配置

```bash
# 创建监控目录
mkdir -p ~/monitoring/{prometheus,grafana,alertmanager}

# 复制配置文件
cp monitoring/prometheus.yml ~/monitoring/prometheus/
cp monitoring/alerts/*.yml ~/monitoring/prometheus/alerts/
```

### 2. Grafana 配置

```bash
# 启动 Grafana
docker-compose -f docker-compose.monitoring.yml up -d grafana

# 访问 Grafana
# URL: http://your-domain.com:3000
# 默认用户名/密码: admin/admin

# 配置数据源
# 1. 添加 Prometheus 数据源
# 2. URL: http://prometheus:9090
# 3. 保存并测试

# 导入仪表板
# 1. 导入预制仪表板
# 2. 使用仪表板 ID 或上传 JSON 文件
```

### 3. Alertmanager 配置

```bash
# 编辑告警配置
vim ~/monitoring/alertmanager/alertmanager.yml

# 配置邮件通知
# 配置钉钉通知
# 配置 Slack 通知（可选）

# 重启 Alertmanager
docker-compose -f docker-compose.monitoring.yml restart alertmanager
```

### 4. 日志聚合（可选）

```bash
# 启动 ELK Stack
docker-compose -f docker-compose.elk.yml up -d

# 配置 Logstash
vim ~/monitoring/logstash/logstash.conf

# 配置 Kibana
# URL: http://your-domain.com:5601
```

---

## 备份策略

### 1. 数据库备份

```bash
# 创建备份脚本
vim ~/admin-system/scripts/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backup/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/admin_system_$DATE.sql.gz"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
docker-compose exec -T postgres pg_dump -U admin_user admin_system_prod | gzip > $BACKUP_FILE

# 删除 30 天前的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
```

```bash
# 设置执行权限
chmod +x ~/admin-system/scripts/backup.sh

# 配置定时任务
crontab -e
# 添加: 0 2 * * * /home/deploy/admin-system/scripts/backup.sh
```

### 2. 配置文件备份

```bash
# 备份配置文件
tar -czf config_backup_$(date +%Y%m%d).tar.gz \
    admin-mit-backend/config/ \
    admin-mit-backend/.env \
    admin-mit-ui/.env \
    docker-compose.yml

# 上传到远程存储（可选）
# aws s3 cp config_backup_*.tar.gz s3://your-bucket/backups/
```

### 3. 恢复流程

```bash
# 恢复数据库
gunzip < backup_file.sql.gz | docker-compose exec -T postgres psql -U admin_user admin_system_prod

# 恢复配置文件
tar -xzf config_backup_*.tar.gz
```

---

## 运维指南

### 1. 日常维护

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 重启服务
docker-compose restart backend

# 更新应用
git pull
docker-compose build
docker-compose up -d
```

### 2. 性能优化

```bash
# 查看资源使用
docker stats

# 优化数据库
docker-compose exec postgres psql -U admin_user admin_system_prod
# 运行 VACUUM ANALYZE

# 清理 Docker 资源
docker system prune -a
```

### 3. 故障排查

```bash
# 检查健康状态
curl http://localhost:5000/health

# 查看错误日志
tail -f admin-mit-backend/logs/error.log

# 检查数据库连接
docker-compose exec postgres psql -U admin_user admin_system_prod -c "SELECT 1"

# 检查 Redis 连接
docker-compose exec redis redis-cli ping
```

### 4. 安全审计

```bash
# 运行安全检查
cd admin-mit-backend
python scripts/security_check.py

# 扫描依赖漏洞
pip install safety
safety check

# 扫描代码安全问题
pip install bandit
bandit -r app/

# 查看审计日志
tail -f /var/log/admin/audit.log
```

### 5. 更新和升级

```bash
# 备份当前版本
./scripts/backup.sh

# 拉取最新代码
git pull origin main

# 更新依赖
cd admin-mit-backend
pip install -r requirements.txt

cd ../admin-mit-ui
npm install

# 运行数据库迁移
docker-compose run --rm backend flask db upgrade

# 重新构建和部署
docker-compose build
docker-compose up -d

# 验证更新
curl http://localhost:5000/health
```

---

## 监控指标

### 关键指标

1. **应用健康**
   - 健康检查状态
   - 响应时间
   - 错误率

2. **系统资源**
   - CPU 使用率
   - 内存使用率
   - 磁盘使用率

3. **数据库**
   - 连接数
   - 查询性能
   - 慢查询

4. **安全**
   - 登录失败次数
   - CSRF 攻击次数
   - 频率限制触发次数

### 告警阈值

- CPU 使用率 > 80%
- 内存使用率 > 90%
- 磁盘使用率 > 90%
- 错误率 > 5%
- 响应时间 > 2 秒
- 数据库连接失败
- Redis 连接失败

---

## 应急响应

### 1. 服务宕机

```bash
# 检查服务状态
docker-compose ps

# 查看日志
docker-compose logs --tail=100 backend

# 重启服务
docker-compose restart backend

# 如果无法恢复，回滚到上一个版本
git checkout <previous-commit>
docker-compose build
docker-compose up -d
```

### 2. 数据库问题

```bash
# 检查数据库连接
docker-compose exec postgres psql -U admin_user admin_system_prod

# 检查数据库大小
docker-compose exec postgres psql -U admin_user admin_system_prod -c "\l+"

# 优化数据库
docker-compose exec postgres psql -U admin_user admin_system_prod -c "VACUUM ANALYZE"

# 如果需要恢复
./scripts/restore.sh backup_file.sql.gz
```

### 3. 安全事件

```bash
# 查看审计日志
tail -f /var/log/admin/audit.log

# 查看访问日志
tail -f /var/log/nginx/admin-access.log

# 封禁 IP
sudo ufw deny from <malicious-ip>

# 重置用户密码
docker-compose exec backend flask shell
# >>> from app.models import User
# >>> user = User.query.filter_by(username='admin').first()
# >>> user.set_password('new-password')
# >>> db.session.commit()
```

---

## 联系方式

- **技术支持**: support@example.com
- **安全团队**: security@example.com
- **紧急联系**: +86 xxx xxxx xxxx

---

## 参考文档

- [安全加固和监控指南](admin-mit-backend/docs/SECURITY_HARDENING_GUIDE.md)
- [安全配置检查清单](SECURITY_CHECKLIST.md)
- [Docker 部署指南](DOCKER_DEPLOYMENT.md)
- [配置管理指南](CONFIGURATION_GUIDE.md)
- [数据库维护指南](DATABASE_MAINTENANCE.md)
- [监控指南](MONITORING_GUIDE.md)
