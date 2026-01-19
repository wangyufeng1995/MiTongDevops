# 系统维护手册

## 手册概述

### 目标读者
- 系统管理员
- 运维工程师
- 技术支持人员

### 手册目的
- 提供系统维护指南
- 规范维护操作流程
- 降低系统故障风险
- 提高系统稳定性

---

## 第一部分：日常维护

### 1.1 系统健康检查

#### 每日检查项
- [ ] 检查系统服务状态
- [ ] 检查数据库连接
- [ ] 检查 Redis 缓存
- [ ] 检查磁盘空间
- [ ] 检查日志文件
- [ ] 检查告警记录

#### 检查命令
```bash
# 检查 Docker 容器状态
docker-compose ps

# 检查系统资源
df -h
free -h
top

# 检查日志
tail -f logs/app.log
tail -f logs/error.log
```

### 1.2 日志管理

#### 日志位置
- 应用日志: `admin-mit-backend/logs/app.log`
- 错误日志: `admin-mit-backend/logs/error.log`
- 访问日志: Nginx 日志
- 数据库日志: PostgreSQL 日志

#### 日志轮转
```bash
# 日志自动轮转配置
# 文件大小: 10MB
# 保留数量: 5 个
# 自动压缩: 是
```

#### 日志清理
```bash
# 清理 30 天前的日志
find logs/ -name "*.log.*" -mtime +30 -delete
```

### 1.3 数据库维护

#### 每周维护
```sql
-- 分析表统计信息
ANALYZE;

-- 清理死元组
VACUUM;

-- 重建索引
REINDEX DATABASE mitong_devops;
```

#### 性能监控
```sql
-- 查看慢查询
SELECT * FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;

-- 查看表大小
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

### 1.4 缓存管理

#### Redis 监控
```bash
# 连接 Redis
redis-cli

# 查看信息
INFO

# 查看内存使用
INFO memory

# 查看键数量
DBSIZE
```

#### 缓存清理
```bash
# 清理过期键
redis-cli --scan --pattern "expired:*" | xargs redis-cli DEL

# 清理特定前缀
redis-cli --scan --pattern "cache:*" | xargs redis-cli DEL
```

---

## 第二部分：备份与恢复

### 2.1 数据库备份

#### 自动备份脚本
```bash
#!/bin/bash
# 位置: admin-mit-backend/scripts/db_backup.sh

BACKUP_DIR="/backup/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="mitong_devops"

# 创建备份
pg_dump -U postgres -h localhost $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# 压缩备份
gzip $BACKUP_DIR/backup_$DATE.sql

# 删除 7 天前的备份
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
```

#### 手动备份
```bash
# 完整备份
pg_dump -U postgres -h localhost mitong_devops > backup.sql

# 仅备份数据
pg_dump -U postgres -h localhost --data-only mitong_devops > data.sql

# 仅备份结构
pg_dump -U postgres -h localhost --schema-only mitong_devops > schema.sql
```

### 2.2 数据库恢复

#### 恢复步骤
```bash
# 1. 停止应用服务
docker-compose stop backend

# 2. 删除现有数据库（谨慎操作）
dropdb -U postgres mitong_devops

# 3. 创建新数据库
createdb -U postgres mitong_devops

# 4. 恢复数据
psql -U postgres -h localhost mitong_devops < backup.sql

# 5. 启动应用服务
docker-compose start backend
```

### 2.3 文件备份

#### 备份内容
- 配置文件: `config/`
- 上传文件: `uploads/`
- 密钥文件: `keys/`
- 日志文件: `logs/`

#### 备份脚本
```bash
#!/bin/bash
BACKUP_DIR="/backup/files"
DATE=$(date +%Y%m%d)

# 备份配置文件
tar -czf $BACKUP_DIR/config_$DATE.tar.gz config/

# 备份上传文件
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz uploads/

# 备份密钥文件
tar -czf $BACKUP_DIR/keys_$DATE.tar.gz keys/
```

---

## 第三部分：性能优化

### 3.1 数据库优化

#### 索引优化
```sql
-- 查看缺失索引
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY n_distinct DESC;

-- 创建索引
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_operation_logs_created_at ON operation_logs(created_at);
```

#### 查询优化
```sql
-- 分析查询计划
EXPLAIN ANALYZE SELECT * FROM users WHERE tenant_id = 1;

-- 优化慢查询
-- 添加索引、重写查询、使用缓存
```

### 3.2 缓存优化

#### Redis 配置优化
```conf
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

#### 缓存策略
- 热点数据缓存
- 查询结果缓存
- 会话数据缓存
- 合理设置 TTL

### 3.3 应用优化

#### 连接池配置
```yaml
# config/database.yaml
database:
  postgresql:
    pool_size: 10
    max_overflow: 20
    pool_timeout: 30
    pool_recycle: 3600
```

#### Celery 优化
```yaml
# config/app.yaml
celery:
  worker_concurrency: 4
  task_time_limit: 300
  task_soft_time_limit: 240
```

---

## 第四部分：故障处理

### 4.1 常见故障

#### 服务无法启动
**症状**: Docker 容器启动失败
**排查步骤**:
1. 查看容器日志: `docker-compose logs`
2. 检查配置文件
3. 检查端口占用
4. 检查磁盘空间

**解决方案**:
```bash
# 重启服务
docker-compose restart

# 重建容器
docker-compose down
docker-compose up -d
```

#### 数据库连接失败
**症状**: 应用无法连接数据库
**排查步骤**:
1. 检查数据库服务状态
2. 检查连接配置
3. 检查网络连接
4. 检查防火墙规则

**解决方案**:
```bash
# 重启数据库
docker-compose restart postgres

# 检查连接
psql -U postgres -h localhost -d mitong_devops
```

#### Redis 连接失败
**症状**: 缓存功能异常
**排查步骤**:
1. 检查 Redis 服务状态
2. 检查连接配置
3. 检查内存使用
4. 检查日志错误

**解决方案**:
```bash
# 重启 Redis
docker-compose restart redis

# 清理缓存
redis-cli FLUSHDB
```

### 4.2 性能问题

#### 响应缓慢
**排查步骤**:
1. 检查系统资源使用
2. 检查数据库慢查询
3. 检查网络延迟
4. 检查应用日志

**优化措施**:
- 优化数据库查询
- 增加缓存
- 扩展服务器资源
- 优化代码逻辑

#### 内存占用高
**排查步骤**:
1. 查看进程内存使用
2. 检查内存泄漏
3. 检查缓存配置
4. 检查日志文件大小

**解决方案**:
```bash
# 查看内存使用
free -h
ps aux --sort=-%mem | head

# 清理缓存
sync; echo 3 > /proc/sys/vm/drop_caches

# 重启服务
docker-compose restart
```

---

## 第五部分：安全维护

### 5.1 安全检查

#### 定期检查项
- [ ] 检查用户权限
- [ ] 检查密码强度
- [ ] 检查操作日志
- [ ] 检查异常登录
- [ ] 检查系统漏洞
- [ ] 更新安全补丁

#### 安全扫描
```bash
# 运行安全检查脚本
python admin-mit-backend/scripts/security_check.py

# 检查依赖漏洞
pip-audit
npm audit
```

### 5.2 密钥管理

#### 密钥轮换
```bash
# 生成新密钥
python admin-mit-backend/scripts/generate_secrets.py

# 更新配置文件
# 重启服务
docker-compose restart
```

#### 密钥备份
```bash
# 备份密钥文件
tar -czf keys_backup.tar.gz keys/

# 加密备份
gpg -c keys_backup.tar.gz
```

### 5.3 访问控制

#### 防火墙配置
```bash
# 只允许特定 IP 访问
iptables -A INPUT -p tcp --dport 5000 -s 192.168.1.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 5000 -j DROP
```

#### 频率限制
```python
# 配置 API 频率限制
# 在 config/app.yaml 中配置
rate_limit:
  enabled: true
  requests_per_minute: 60
```

---

## 第六部分：监控告警

### 6.1 系统监控

#### Prometheus 配置
```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'backend'
    static_configs:
      - targets: ['backend:5000']
```

#### 监控指标
- CPU 使用率
- 内存使用率
- 磁盘使用率
- 网络流量
- 请求响应时间
- 错误率

### 6.2 告警配置

#### 告警规则
```yaml
# monitoring/alerts/application.yml
groups:
  - name: application
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
```

### 6.3 日志监控

#### 错误日志监控
```bash
# 监控错误日志
tail -f logs/error.log | grep -i "error\|exception"

# 统计错误数量
grep -c "ERROR" logs/app.log
```

---

## 第七部分：升级维护

### 7.1 系统升级

#### 升级前准备
1. 备份数据库
2. 备份配置文件
3. 备份应用代码
4. 通知用户
5. 准备回滚方案

#### 升级步骤
```bash
# 1. 停止服务
docker-compose down

# 2. 备份数据
./scripts/backup_all.sh

# 3. 拉取新代码
git pull origin main

# 4. 更新依赖
cd admin-mit-backend && pip install -r requirements.txt
cd admin-mit-ui && npm install

# 5. 数据库迁移
flask db upgrade

# 6. 启动服务
docker-compose up -d

# 7. 验证功能
./scripts/verify_functionality.py
```

### 7.2 回滚操作

#### 回滚步骤
```bash
# 1. 停止服务
docker-compose down

# 2. 恢复代码
git checkout <previous-version>

# 3. 恢复数据库
psql -U postgres mitong_devops < backup.sql

# 4. 启动服务
docker-compose up -d
```

---

## 第八部分：应急预案

### 8.1 服务中断

#### 应急响应
1. 确认故障范围
2. 通知相关人员
3. 启动应急预案
4. 快速恢复服务
5. 分析故障原因
6. 编写故障报告

### 8.2 数据丢失

#### 恢复流程
1. 评估数据丢失范围
2. 查找最近备份
3. 恢复数据库
4. 验证数据完整性
5. 恢复服务
6. 通知用户

### 8.3 安全事件

#### 处理流程
1. 隔离受影响系统
2. 收集证据
3. 分析攻击方式
4. 修复安全漏洞
5. 恢复服务
6. 加强安全措施

---

## 附录

### A. 维护检查清单

#### 每日检查
- [ ] 系统服务状态
- [ ] 磁盘空间
- [ ] 错误日志
- [ ] 告警记录

#### 每周检查
- [ ] 数据库维护
- [ ] 缓存清理
- [ ] 性能监控
- [ ] 安全检查

#### 每月检查
- [ ] 系统更新
- [ ] 备份验证
- [ ] 容量规划
- [ ] 安全审计

### B. 联系方式
- 技术支持: [邮箱]
- 紧急联系: [电话]
- 值班人员: [名单]

### C. 参考文档
- 部署指南
- API 文档
- 故障排查手册
