# 运维操作指南

## 目录

- [日常运维](#日常运维)
- [故障排查](#故障排查)
- [性能调优](#性能调优)
- [备份恢复](#备份恢复)
- [系统升级](#系统升级)
- [监控告警](#监控告警)

## 日常运维

### 服务管理

#### 启动服务

```bash
# 使用 Docker Compose
docker-compose up -d

# 或手动启动
# 后端
cd admin-mit-backend
source venv/bin/activate
python app.py &

# Celery Worker
celery -A celery_worker.celery worker --loglevel=info &

# Celery Beat
celery -A celery_worker.celery beat --loglevel=info &

# 前端
cd admin-mit-ui
npm run dev &
```

#### 停止服务

```bash
# 使用 Docker Compose
docker-compose down

# 或手动停止
pkill -f "python app.py"
pkill -f "celery worker"
pkill -f "celery beat"
pkill -f "npm run dev"
```

#### 重启服务

```bash
# 使用 Docker Compose
docker-compose restart

# 或手动重启
docker-compose restart backend
docker-compose restart frontend
docker-compose restart celery-worker
```

#### 查看服务状态

```bash
# Docker 服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 日志管理

#### 日志位置

- **后端日志**: `admin-mit-backend/logs/app.log`
- **错误日志**: `admin-mit-backend/logs/error.log`
- **Nginx 日志**: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- **Docker 日志**: `docker-compose logs`

#### 查看日志

```bash
# 实时查看后端日志
tail -f admin-mit-backend/logs/app.log

# 查看错误日志
tail -f admin-mit-backend/logs/error.log

# 查看最近 100 行日志
tail -n 100 admin-mit-backend/logs/app.log

# 搜索日志
grep "ERROR" admin-mit-backend/logs/app.log
grep "用户登录" admin-mit-backend/logs/app.log
```

#### 日志轮转

配置 logrotate:

```bash
# 创建配置文件
sudo nano /etc/logrotate.d/mitong-admin

# 添加配置
/path/to/admin-mit-backend/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload mitong-admin
    endscript
}

# 测试配置
sudo logrotate -d /etc/logrotate.d/mitong-admin

# 强制执行
sudo logrotate -f /etc/logrotate.d/mitong-admin
```

### 数据库维护

#### 数据库备份

```bash
# 手动备份
pg_dump -U postgres mitong_devops > backup_$(date +%Y%m%d_%H%M%S).sql

# 使用脚本备份
cd admin-mit-backend/scripts
./db_backup.sh

# 定时备份（crontab）
0 2 * * * /path/to/admin-mit-backend/scripts/db_backup.sh
```

#### 数据库恢复

```bash
# 恢复数据库
psql -U postgres mitong_devops < backup.sql

# 使用脚本恢复
cd admin-mit-backend/scripts
./db_restore.sh backup.sql
```

#### 数据库优化

```bash
# 分析数据库
psql -U postgres mitong_devops -c "ANALYZE;"

# 清理数据库
psql -U postgres mitong_devops -c "VACUUM FULL;"

# 重建索引
psql -U postgres mitong_devops -c "REINDEX DATABASE mitong_devops;"

# 查看数据库大小
psql -U postgres mitong_devops -c "SELECT pg_size_pretty(pg_database_size('mitong_devops'));"

# 查看表大小
psql -U postgres mitong_devops -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

### Redis 维护

#### Redis 监控

```bash
# 连接 Redis
redis-cli

# 查看信息
INFO

# 查看内存使用
INFO memory

# 查看连接数
INFO clients

# 查看键数量
DBSIZE

# 查看慢查询
SLOWLOG GET 10
```

#### Redis 清理

```bash
# 清理过期键
redis-cli --scan --pattern "expired:*" | xargs redis-cli DEL

# 清理特定前缀的键
redis-cli --scan --pattern "network:*" | xargs redis-cli DEL

# 清空数据库（谨慎使用）
redis-cli FLUSHDB
```

## 故障排查

### 常见问题诊断

#### 1. 服务无法启动

**检查步骤**:

```bash
# 检查端口占用
netstat -tulpn | grep :5000
netstat -tulpn | grep :3000

# 检查进程
ps aux | grep python
ps aux | grep node

# 检查日志
tail -f admin-mit-backend/logs/error.log
docker-compose logs backend

# 检查配置文件
cat admin-mit-backend/config/database.yaml
cat admin-mit-backend/config/redis.yaml
```

#### 2. 数据库连接失败

**检查步骤**:

```bash
# 检查 PostgreSQL 服务
systemctl status postgresql
sudo service postgresql status

# 测试连接
psql -h localhost -U postgres -d mitong_devops

# 检查配置
cat admin-mit-backend/config/database.yaml

# 查看 PostgreSQL 日志
tail -f /var/log/postgresql/postgresql-*.log
```

#### 3. Redis 连接失败

**检查步骤**:

```bash
# 检查 Redis 服务
systemctl status redis
sudo service redis-server status

# 测试连接
redis-cli ping

# 检查配置
cat admin-mit-backend/config/redis.yaml

# 查看 Redis 日志
tail -f /var/log/redis/redis-server.log
```

#### 4. API 响应慢

**诊断步骤**:

```bash
# 查看系统资源
top
htop
free -h
df -h

# 查看数据库连接
psql -U postgres mitong_devops -c "SELECT * FROM pg_stat_activity;"

# 查看慢查询
psql -U postgres mitong_devops -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# 查看 Redis 慢查询
redis-cli SLOWLOG GET 10

# 分析日志
grep "slow" admin-mit-backend/logs/app.log
```

### 错误日志分析

#### 常见错误及解决方案

**错误 1: Connection refused**

```
原因: 服务未启动或端口被占用
解决: 
1. 检查服务是否启动
2. 检查端口是否被占用
3. 检查防火墙设置
```

**错误 2: Database connection failed**

```
原因: 数据库连接配置错误或数据库未启动
解决:
1. 检查数据库服务状态
2. 检查配置文件
3. 测试数据库连接
```

**错误 3: Token expired**

```
原因: JWT Token 已过期
解决:
1. 前端自动刷新 Token
2. 用户重新登录
```

**错误 4: Permission denied**

```
原因: 用户无权限访问
解决:
1. 检查用户角色和权限
2. 分配相应权限
```

## 性能调优

### 数据库优化

#### 1. 索引优化

```sql
-- 查看缺失索引
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
AND n_distinct > 100
ORDER BY n_distinct DESC;

-- 创建索引
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_operation_logs_created_at ON operation_logs(created_at);

-- 查看索引使用情况
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

#### 2. 查询优化

```sql
-- 分析查询计划
EXPLAIN ANALYZE SELECT * FROM users WHERE tenant_id = 1;

-- 优化慢查询
-- 使用 JOIN 代替子查询
-- 使用 LIMIT 限制结果集
-- 避免 SELECT *
```

#### 3. 连接池配置

```yaml
# config/database.yaml
database:
  postgresql:
    pool_size: 20          # 连接池大小
    max_overflow: 40       # 最大溢出连接数
    pool_timeout: 30       # 连接超时时间
    pool_recycle: 3600     # 连接回收时间
```

### Redis 优化

#### 1. 内存优化

```bash
# 查看内存使用
redis-cli INFO memory

# 设置最大内存
redis-cli CONFIG SET maxmemory 2gb

# 设置淘汰策略
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

#### 2. 持久化配置

```bash
# RDB 持久化
redis-cli CONFIG SET save "900 1 300 10 60 10000"

# AOF 持久化
redis-cli CONFIG SET appendonly yes
redis-cli CONFIG SET appendfsync everysec
```

### 应用优化

#### 1. 前端优化

- 启用代码分割和懒加载
- 使用 CDN 加速静态资源
- 启用 Gzip 压缩
- 优化图片大小

#### 2. 后端优化

- 使用 Gunicorn 多进程部署
- 启用 Redis 缓存
- 优化数据库查询
- 使用异步任务处理耗时操作

## 备份恢复

### 完整备份方案

#### 1. 数据库备份

```bash
#!/bin/bash
# 备份脚本

BACKUP_DIR="/backup/database"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mitong_devops_$DATE.sql"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
pg_dump -U postgres mitong_devops > $BACKUP_FILE

# 压缩备份文件
gzip $BACKUP_FILE

# 删除 30 天前的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

#### 2. 配置文件备份

```bash
#!/bin/bash
# 备份配置文件

BACKUP_DIR="/backup/config"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份配置文件
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
  admin-mit-backend/config/ \
  admin-mit-ui/.env \
  docker-compose.yml

echo "Config backup completed"
```

#### 3. 文件备份

```bash
#!/bin/bash
# 备份上传文件和日志

BACKUP_DIR="/backup/files"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份文件
tar -czf $BACKUP_DIR/files_$DATE.tar.gz \
  admin-mit-backend/logs/ \
  admin-mit-backend/uploads/

echo "Files backup completed"
```

### 恢复流程

#### 1. 数据库恢复

```bash
# 停止服务
docker-compose down

# 恢复数据库
gunzip backup.sql.gz
psql -U postgres mitong_devops < backup.sql

# 启动服务
docker-compose up -d
```

#### 2. 配置文件恢复

```bash
# 解压配置文件
tar -xzf config_backup.tar.gz

# 复制到对应位置
cp -r config/* admin-mit-backend/config/
```

## 系统升级

### 升级前准备

1. **备份数据**:
   - 备份数据库
   - 备份配置文件
   - 备份上传文件

2. **通知用户**:
   - 提前通知用户升级时间
   - 预计升级时长

3. **准备回滚方案**:
   - 记录当前版本
   - 准备回滚脚本

### 升级步骤

```bash
# 1. 停止服务
docker-compose down

# 2. 备份数据
./scripts/backup_all.sh

# 3. 拉取最新代码
git pull origin main

# 4. 更新依赖
cd admin-mit-backend
pip install -r requirements.txt

cd ../admin-mit-ui
npm install

# 5. 执行数据库迁移
cd ../admin-mit-backend
flask db upgrade

# 6. 构建前端
cd ../admin-mit-ui
npm run build

# 7. 启动服务
cd ..
docker-compose up -d

# 8. 验证功能
./scripts/health_check.sh
```

### 回滚流程

```bash
# 1. 停止服务
docker-compose down

# 2. 回滚代码
git checkout <previous_version>

# 3. 回滚数据库
flask db downgrade

# 4. 恢复备份
psql -U postgres mitong_devops < backup.sql

# 5. 启动服务
docker-compose up -d
```

## 监控告警

### 系统监控

#### 1. 资源监控

```bash
# CPU 使用率
top
htop

# 内存使用
free -h
vmstat 1

# 磁盘使用
df -h
du -sh /*

# 网络流量
iftop
nethogs
```

#### 2. 服务监控

```bash
# 检查服务状态
systemctl status postgresql
systemctl status redis
systemctl status nginx

# 检查端口
netstat -tulpn | grep :5000
netstat -tulpn | grep :3000
netstat -tulpn | grep :5432
netstat -tulpn | grep :6379
```

### 告警配置

#### 1. 系统告警

- CPU 使用率 > 80%
- 内存使用率 > 85%
- 磁盘使用率 > 90%
- 服务不可用

#### 2. 应用告警

- API 响应时间 > 1s
- 错误率 > 5%
- 数据库连接数 > 80%
- Redis 内存使用 > 90%

### 健康检查

```bash
#!/bin/bash
# 健康检查脚本

# 检查后端服务
curl -f http://localhost:5000/api/health || echo "Backend is down"

# 检查前端服务
curl -f http://localhost:3000 || echo "Frontend is down"

# 检查数据库
psql -U postgres -c "SELECT 1" mitong_devops || echo "Database is down"

# 检查 Redis
redis-cli ping || echo "Redis is down"
```

## 安全加固

### 1. 系统安全

- 定期更新系统补丁
- 配置防火墙规则
- 禁用不必要的服务
- 使用强密码策略

### 2. 应用安全

- 启用 HTTPS
- 配置 CSRF 防护
- 限制 API 请求频率
- 定期更新依赖包

### 3. 数据安全

- 加密敏感数据
- 定期备份数据
- 限制数据库访问
- 审计日志记录

## 最佳实践

1. **定期备份**: 每天自动备份数据库和配置文件
2. **监控告警**: 配置完善的监控和告警系统
3. **日志管理**: 定期清理和归档日志文件
4. **性能优化**: 定期分析和优化系统性能
5. **安全加固**: 定期检查和更新安全配置
6. **文档更新**: 及时更新运维文档

## 获取帮助

如有问题，请：

1. 查看日志文件
2. 查看本运维指南
3. 联系技术支持
4. 提交工单

---

**祝运维顺利！**
