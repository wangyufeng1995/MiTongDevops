# 数据库维护手册

本文档详细说明数据库的部署、备份、恢复和维护流程。

## 目录

- [数据库初始化](#数据库初始化)
- [数据库备份](#数据库备份)
- [数据库恢复](#数据库恢复)
- [数据库迁移](#数据库迁移)
- [性能监控](#性能监控)
- [常见问题](#常见问题)
- [维护计划](#维护计划)

## 数据库初始化

### 生产环境初始化

#### 1. 使用 Docker 部署

```bash
# 启动数据库容器
docker-compose up -d postgres

# 等待数据库就绪
docker-compose exec postgres pg_isready -U postgres

# 运行初始化脚本
docker-compose exec backend python scripts/db_init_prod.py
```

#### 2. 手动初始化

```bash
# 设置管理员密码（可选）
export ADMIN_PASSWORD="YourSecurePassword123!"

# 运行初始化脚本
cd admin-mit-backend
python scripts/db_init_prod.py
```

#### 3. 使用 Alembic 迁移

```bash
# 运行数据库迁移
docker-compose exec backend flask db upgrade

# 或手动运行
cd admin-mit-backend
flask db upgrade
```

### 初始化内容

初始化脚本会创建：

1. **默认租户**: 名称为"默认租户"
2. **管理员角色**: 超级管理员角色
3. **管理员用户**: 
   - 用户名: `admin`
   - 密码: `Admin@123456`（或环境变量 `ADMIN_PASSWORD`）
4. **默认菜单**: 系统所有功能菜单

⚠️ **重要**: 初始化后请立即修改管理员密码！

## 数据库备份

### 自动备份

#### 1. 配置定时任务

```bash
# 编辑 crontab
crontab -e

# 添加每天凌晨 2 点备份
0 2 * * * /path/to/admin-mit-backend/scripts/db_backup.sh >> /var/log/db_backup.log 2>&1
```

#### 2. 配置备份参数

```bash
# 设置环境变量
export BACKUP_DIR="/backups/database"
export RETENTION_DAYS=30
export BACKUP_VOLUMES=true

# 运行备份
./admin-mit-backend/scripts/db_backup.sh
```

### 手动备份

#### 使用备份脚本

```bash
# 基本备份
./admin-mit-backend/scripts/db_backup.sh

# 指定备份目录
BACKUP_DIR=/custom/backup/path ./admin-mit-backend/scripts/db_backup.sh

# 备份数据库和数据卷
BACKUP_VOLUMES=true ./admin-mit-backend/scripts/db_backup.sh
```

#### 使用 pg_dump

```bash
# Docker 环境
docker-compose exec postgres pg_dump -U postgres mitong_devops | gzip > backup.sql.gz

# 直接连接
pg_dump -h 172.30.3.135 -U postgres mitong_devops | gzip > backup.sql.gz

# 备份特定表
pg_dump -h 172.30.3.135 -U postgres -t users -t roles mitong_devops | gzip > tables_backup.sql.gz

# 仅备份数据（不包含结构）
pg_dump -h 172.30.3.135 -U postgres --data-only mitong_devops | gzip > data_only.sql.gz

# 仅备份结构（不包含数据）
pg_dump -h 172.30.3.135 -U postgres --schema-only mitong_devops | gzip > schema_only.sql.gz
```

### 备份验证

```bash
# 检查备份文件
gunzip -c backup.sql.gz | head -n 20

# 验证备份完整性
gunzip -t backup.sql.gz

# 查看备份大小
du -h backup.sql.gz

# 统计备份中的表数量
gunzip -c backup.sql.gz | grep "CREATE TABLE" | wc -l
```

### 备份策略

推荐的备份策略：

1. **每日全量备份**: 凌晨 2:00
2. **每周完整备份**: 周日凌晨 1:00
3. **每月归档备份**: 每月 1 号凌晨 0:00
4. **保留策略**:
   - 每日备份保留 7 天
   - 每周备份保留 4 周
   - 每月备份保留 12 个月

## 数据库恢复

### 使用恢复脚本

```bash
# 恢复数据库
./admin-mit-backend/scripts/db_restore.sh /backups/database/mitong_devops_20240101_120000.sql.gz

# 脚本会：
# 1. 创建当前数据库的安全备份
# 2. 断开所有连接
# 3. 删除并重建数据库
# 4. 恢复数据
# 5. 验证恢复结果
```

### 手动恢复

#### Docker 环境

```bash
# 停止应用服务
docker-compose stop backend celery-worker celery-beat

# 恢复数据库
gunzip -c backup.sql.gz | docker-compose exec -T postgres psql -U postgres -d mitong_devops

# 重启服务
docker-compose start backend celery-worker celery-beat
```

#### 直接连接

```bash
# 停止应用
systemctl stop admin-backend

# 恢复数据库
gunzip -c backup.sql.gz | psql -h 172.30.3.135 -U postgres -d mitong_devops

# 重启应用
systemctl start admin-backend
```

### 恢复验证

```bash
# 检查表数量
docker-compose exec postgres psql -U postgres -d mitong_devops -c "
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
"

# 检查数据行数
docker-compose exec postgres psql -U postgres -d mitong_devops -c "
    SELECT 
        schemaname,
        tablename,
        n_live_tup as row_count
    FROM pg_stat_user_tables
    ORDER BY n_live_tup DESC;
"

# 检查用户数据
docker-compose exec postgres psql -U postgres -d mitong_devops -c "
    SELECT COUNT(*) FROM users;
"
```

### 部分恢复

#### 恢复特定表

```bash
# 导出特定表
pg_dump -h 172.30.3.135 -U postgres -t users mitong_devops > users_backup.sql

# 恢复特定表
psql -h 172.30.3.135 -U postgres -d mitong_devops < users_backup.sql
```

#### 恢复到特定时间点（PITR）

需要配置 WAL 归档：

```bash
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /archive/%f'

# 恢复到特定时间
pg_restore --target-time='2024-01-01 12:00:00' backup.dump
```

## 数据库迁移

### Alembic 迁移管理

#### 创建迁移

```bash
# 自动生成迁移脚本
docker-compose exec backend flask db migrate -m "Add new column"

# 手动创建迁移脚本
docker-compose exec backend flask db revision -m "Custom migration"
```

#### 应用迁移

```bash
# 升级到最新版本
docker-compose exec backend flask db upgrade

# 升级到特定版本
docker-compose exec backend flask db upgrade <revision>

# 查看当前版本
docker-compose exec backend flask db current

# 查看迁移历史
docker-compose exec backend flask db history
```

#### 回滚迁移

```bash
# 回滚一个版本
docker-compose exec backend flask db downgrade

# 回滚到特定版本
docker-compose exec backend flask db downgrade <revision>

# 回滚到初始状态
docker-compose exec backend flask db downgrade base
```

### 迁移最佳实践

1. **测试迁移**: 在测试环境先测试
2. **备份数据**: 迁移前必须备份
3. **版本控制**: 迁移脚本纳入版本控制
4. **可回滚**: 确保迁移可以回滚
5. **数据验证**: 迁移后验证数据完整性

## 性能监控

### 连接监控

```sql
-- 查看当前连接数
SELECT COUNT(*) FROM pg_stat_activity;

-- 查看各数据库连接数
SELECT datname, count(*) 
FROM pg_stat_activity 
GROUP BY datname;

-- 查看活跃连接
SELECT pid, usename, application_name, client_addr, state, query
FROM pg_stat_activity
WHERE state = 'active';

-- 查看长时间运行的查询
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;
```

### 性能统计

```sql
-- 查看表大小
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 查看索引使用情况
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- 查看表访问统计
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del
FROM pg_stat_user_tables
ORDER BY seq_scan DESC;

-- 查看慢查询
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### 缓存命中率

```sql
-- 查看缓存命中率
SELECT 
    sum(heap_blks_read) as heap_read,
    sum(heap_blks_hit) as heap_hit,
    sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;

-- 理想值应该 > 0.99
```

### 锁监控

```sql
-- 查看锁等待
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

## 常见问题

### 1. 连接数过多

**问题**: 连接数达到上限

**解决方案**:

```sql
-- 查看最大连接数
SHOW max_connections;

-- 终止空闲连接
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND state_change < current_timestamp - INTERVAL '10 minutes';

-- 调整最大连接数（postgresql.conf）
max_connections = 200
```

### 2. 磁盘空间不足

**问题**: 数据库磁盘空间不足

**解决方案**:

```bash
# 清理 WAL 日志
docker-compose exec postgres pg_archivecleanup /var/lib/postgresql/data/pg_wal 000000010000000000000010

# 清理临时文件
docker-compose exec postgres find /var/lib/postgresql/data -name "pgsql_tmp*" -delete

# VACUUM 清理
docker-compose exec postgres psql -U postgres -d mitong_devops -c "VACUUM FULL;"
```

### 3. 查询性能慢

**问题**: 查询执行缓慢

**解决方案**:

```sql
-- 分析查询计划
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';

-- 创建索引
CREATE INDEX idx_users_email ON users(email);

-- 更新统计信息
ANALYZE users;

-- 重建索引
REINDEX TABLE users;
```

### 4. 数据库膨胀

**问题**: 表和索引膨胀

**解决方案**:

```sql
-- 查看膨胀情况
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 清理膨胀
VACUUM FULL ANALYZE users;
```

## 维护计划

### 每日维护

- ✅ 检查备份是否成功
- ✅ 监控磁盘空间使用
- ✅ 检查错误日志
- ✅ 监控连接数

### 每周维护

- ✅ 运行 VACUUM ANALYZE
- ✅ 检查慢查询日志
- ✅ 验证备份可恢复性
- ✅ 检查索引使用情况

### 每月维护

- ✅ 更新数据库统计信息
- ✅ 检查表和索引膨胀
- ✅ 审查性能指标
- ✅ 归档旧备份

### 每季度维护

- ✅ 数据库性能调优
- ✅ 清理历史数据
- ✅ 更新数据库版本
- ✅ 灾难恢复演练

## 监控指标

### 关键指标

| 指标 | 正常范围 | 告警阈值 |
|------|----------|----------|
| 连接数 | < 80% max_connections | > 90% |
| 缓存命中率 | > 99% | < 95% |
| 磁盘使用率 | < 70% | > 85% |
| 慢查询数 | < 10/小时 | > 50/小时 |
| 锁等待时间 | < 1秒 | > 5秒 |
| 复制延迟 | < 1秒 | > 10秒 |

### 监控工具

推荐使用以下工具：

- **pg_stat_statements**: 查询性能分析
- **pgBadger**: 日志分析
- **Prometheus + Grafana**: 指标监控
- **pgAdmin**: 数据库管理
- **Datadog / New Relic**: APM 监控

## 参考资料

- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [PostgreSQL 性能调优](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Alembic 文档](https://alembic.sqlalchemy.org/)
- [pg_dump 文档](https://www.postgresql.org/docs/current/app-pgdump.html)
