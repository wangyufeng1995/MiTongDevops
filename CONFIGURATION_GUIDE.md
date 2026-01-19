# 配置指南

本文档详细说明如何配置 Admin System Template 的生产环境。

## 目录

- [配置文件概述](#配置文件概述)
- [环境变量管理](#环境变量管理)
- [数据库配置](#数据库配置)
- [Redis 配置](#redis-配置)
- [应用配置](#应用配置)
- [日志配置](#日志配置)
- [安全配置](#安全配置)
- [配置验证](#配置验证)

## 配置文件概述

系统配置文件位于 `admin-mit-backend/config/` 目录：

```
config/
├── database.yaml       # 数据库配置
├── redis.yaml          # Redis 配置
├── app.yaml            # 应用配置
├── logging.yaml        # 日志配置
├── database.prod.yaml  # 生产环境数据库配置模板
├── redis.prod.yaml     # 生产环境 Redis 配置模板
├── app.prod.yaml       # 生产环境应用配置模板
└── logging.prod.yaml   # 生产环境日志配置模板
```

### 配置优先级

配置值的加载优先级（从高到低）：

1. **环境变量** - 最高优先级
2. **配置文件** - YAML 文件中的配置
3. **默认值** - 代码中的默认值

## 环境变量管理

### 开发环境

开发环境使用 `.env` 文件管理环境变量：

```bash
# 复制模板文件
cp .env.example .env

# 编辑配置
nano .env
```

### 生产环境

生产环境建议使用以下方式管理环境变量：

#### 1. 系统环境变量

```bash
# 在 /etc/environment 或 ~/.bashrc 中设置
export DB_PASSWORD="your_secure_password"
export SECRET_KEY="your_secret_key"
export JWT_SECRET_KEY="your_jwt_secret_key"
```

#### 2. Docker Secrets（推荐）

```yaml
# docker-compose.yml
services:
  backend:
    secrets:
      - db_password
      - secret_key
      - jwt_secret_key

secrets:
  db_password:
    file: ./secrets/db_password.txt
  secret_key:
    file: ./secrets/secret_key.txt
  jwt_secret_key:
    file: ./secrets/jwt_secret_key.txt
```

#### 3. 密钥管理服务

- **AWS Secrets Manager**
- **HashiCorp Vault**
- **Azure Key Vault**
- **Google Secret Manager**

### 生成安全密钥

使用提供的脚本生成安全密钥：

```bash
cd admin-mit-backend
python scripts/generate_secrets.py
```

## 数据库配置

### 基础配置

```yaml
# config/database.yaml
database:
  postgresql:
    host: "172.30.3.135"
    port: 5432
    database: "mitong_devops"
    username: "postgres"
    password: "${DB_PASSWORD}"  # 从环境变量读取
```

### 生产环境优化

```yaml
database:
  postgresql:
    # 连接池配置
    pool_size: 20                    # 连接池大小
    max_overflow: 40                 # 最大溢出连接数
    pool_timeout: 60                 # 连接超时（秒）
    pool_recycle: 3600               # 连接回收时间（秒）
    pool_pre_ping: true              # 连接前检查
    
    # 连接参数
    connect_args:
      connect_timeout: 10
      application_name: "admin_system_prod"
      options: "-c statement_timeout=30000"
```

### 只读副本配置

```yaml
database:
  postgresql_replica:
    enabled: true
    host: "172.30.3.136"
    port: 5432
    database: "mitong_devops"
    username: "postgres"
    password: "${DB_PASSWORD}"
    pool_size: 10
```

### 配置说明

| 参数 | 说明 | 推荐值 |
|------|------|--------|
| pool_size | 连接池大小 | 20-50 |
| max_overflow | 最大溢出连接 | pool_size * 2 |
| pool_timeout | 获取连接超时 | 30-60 秒 |
| pool_recycle | 连接回收时间 | 3600 秒 |
| pool_pre_ping | 连接前检查 | true |

## Redis 配置

### 基础配置

```yaml
# config/redis.yaml
redis:
  host: "172.30.3.135"
  port: 6379
  password: "${REDIS_PASSWORD}"
  db: 0
  socket_timeout: 5
```

### 生产环境优化

```yaml
redis:
  # 连接池配置
  connection_pool:
    max_connections: 100
    retry_on_timeout: true
    socket_keepalive: true
    socket_keepalive_options:
      TCP_KEEPIDLE: 60
      TCP_KEEPINTVL: 10
      TCP_KEEPCNT: 3
  
  # 缓存配置
  cache:
    default_timeout: 300
    network_probe_ttl: 180
    session_ttl: 3600
```

### Redis Sentinel 配置（高可用）

```yaml
redis:
  sentinel:
    enabled: true
    sentinels:
      - host: "172.30.3.137"
        port: 26379
      - host: "172.30.3.138"
        port: 26379
      - host: "172.30.3.139"
        port: 26379
    master_name: "mymaster"
```

### Redis Cluster 配置

```yaml
redis:
  cluster:
    enabled: true
    startup_nodes:
      - host: "172.30.3.140"
        port: 7000
      - host: "172.30.3.141"
        port: 7001
      - host: "172.30.3.142"
        port: 7002
```

## 应用配置

### 安全配置

```yaml
# config/app.yaml
app:
  debug: false                       # 生产环境必须为 false
  secret_key: "${SECRET_KEY}"
  
  jwt:
    secret_key: "${JWT_SECRET_KEY}"
    access_token_expires: 3600       # 1小时
    refresh_token_expires: 2592000   # 30天
  
  security:
    password_hash_rounds: 12
    max_login_attempts: 5
    lockout_duration: 900
    session_cookie_secure: true      # 需要 HTTPS
    session_cookie_httponly: true
```

### CORS 配置

```yaml
app:
  cors:
    enabled: true
    origins:
      - "https://your-domain.com"
      - "https://www.your-domain.com"
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    supports_credentials: true
```

### 速率限制配置

```yaml
app:
  rate_limit:
    enabled: true
    default_limits:
      - "200 per hour"
      - "50 per minute"
    login_limits:
      - "10 per hour"
      - "3 per minute"
```

### Celery 配置

```yaml
app:
  celery:
    broker_url: "redis://172.30.3.135:6379/2"
    result_backend: "redis://172.30.3.135:6379/2"
    task_time_limit: 3600
    task_soft_time_limit: 3000
    worker_prefetch_multiplier: 4
    worker_max_tasks_per_child: 1000
```

## 日志配置

### 日志级别

生产环境推荐日志级别：

- **INFO**: 正常操作信息
- **WARNING**: 警告信息
- **ERROR**: 错误信息
- **CRITICAL**: 严重错误

```yaml
# config/logging.yaml
root:
  level: INFO
  handlers: [console, app_file, error_file]
```

### 日志处理器

#### 文件日志

```yaml
handlers:
  app_file:
    class: logging.handlers.RotatingFileHandler
    level: INFO
    formatter: json
    filename: /app/logs/app.log
    maxBytes: 10485760                 # 10MB
    backupCount: 10
```

#### Syslog

```yaml
handlers:
  syslog:
    class: logging.handlers.SysLogHandler
    level: WARNING
    formatter: detailed
    address: /dev/log
    facility: local0
```

#### 邮件告警

```yaml
handlers:
  email:
    class: logging.handlers.SMTPHandler
    level: CRITICAL
    formatter: detailed
    mailhost: smtp.gmail.com
    fromaddr: alerts@example.com
    toaddrs:
      - admin@example.com
    subject: '[CRITICAL] Admin System Error'
```

### 日志格式

#### JSON 格式（推荐）

```yaml
formatters:
  json:
    class: pythonjsonlogger.jsonlogger.JsonFormatter
    format: '%(asctime)s %(name)s %(levelname)s %(message)s'
```

#### 详细格式

```yaml
formatters:
  detailed:
    format: '[%(asctime)s] %(levelname)s [%(name)s:%(lineno)d] %(message)s'
```

## 安全配置

### 1. 密码安全

```yaml
app:
  security:
    password_hash_rounds: 12           # bcrypt 加密轮数
    password_min_length: 8
    password_require_special_chars: true
    password_require_numbers: true
    password_require_uppercase: true
```

### 2. Session 安全

```yaml
app:
  security:
    session_cookie_secure: true        # 仅 HTTPS
    session_cookie_httponly: true      # 防止 XSS
    session_cookie_samesite: "Lax"     # 防止 CSRF
```

### 3. CSRF 保护

```yaml
app:
  csrf:
    enabled: true
    token_expires: 3600
    exempt_endpoints:
      - "/api/auth/login"
      - "/api/health"
```

### 4. 速率限制

```yaml
app:
  rate_limit:
    enabled: true
    login_limits:
      - "10 per hour"
      - "3 per minute"
```

### 5. 文件上传限制

```yaml
app:
  upload:
    max_content_length: 16777216       # 16MB
    allowed_extensions: ["txt", "pdf", "png", "jpg"]
```

## 配置验证

### 使用验证脚本

```bash
cd admin-mit-backend
python scripts/validate_config.py
```

### 验证检查项

验证脚本会检查：

1. ✅ 配置文件是否存在
2. ✅ 必需字段是否完整
3. ✅ 密码是否使用默认值
4. ✅ 密码强度是否足够
5. ✅ Debug 模式是否关闭
6. ✅ 连接池配置是否合理
7. ✅ 安全配置是否启用
8. ✅ 日志配置是否正确

### 手动验证

#### 1. 检查数据库连接

```bash
docker-compose exec backend python -c "
from app.extensions import db
db.session.execute('SELECT 1')
print('Database connection OK')
"
```

#### 2. 检查 Redis 连接

```bash
docker-compose exec backend python -c "
import redis
from app.core.config_manager import config_manager
config = config_manager.get_redis_config()
r = redis.Redis(host=config['host'], port=config['port'])
r.ping()
print('Redis connection OK')
"
```

#### 3. 检查配置加载

```bash
docker-compose exec backend python -c "
from app.core.config_manager import config_manager
print('Database:', config_manager.get_database_config())
print('Redis:', config_manager.get_redis_config())
print('App:', config_manager.get_app_config())
"
```

## 配置最佳实践

### 1. 敏感信息管理

❌ **不要做：**
- 将密码硬编码在配置文件中
- 将配置文件提交到版本控制
- 在日志中输出敏感信息

✅ **应该做：**
- 使用环境变量存储敏感信息
- 使用密钥管理服务
- 定期轮换密钥
- 加密存储敏感配置

### 2. 配置分离

- **开发环境**: 使用 `.env` 文件
- **测试环境**: 使用 `config/*.test.yaml`
- **生产环境**: 使用 `config/*.prod.yaml` + 环境变量

### 3. 配置版本控制

```bash
# .gitignore
.env
.env.local
config/database.yaml
config/redis.yaml
config/app.yaml
secrets.txt
keys/private_key.pem
```

### 4. 配置文档化

- 为每个配置项添加注释
- 说明配置的用途和影响
- 提供推荐值和范围
- 记录配置变更历史

### 5. 配置监控

- 监控配置文件变更
- 记录配置加载日志
- 定期审计配置安全性
- 测试配置变更影响

## 故障排查

### 配置加载失败

```bash
# 检查配置文件语法
python -c "import yaml; yaml.safe_load(open('config/app.yaml'))"

# 检查文件权限
ls -la config/

# 查看详细错误
docker-compose logs backend | grep -i config
```

### 环境变量未生效

```bash
# 检查环境变量
docker-compose exec backend env | grep DB_

# 重新加载环境变量
docker-compose down
docker-compose up -d
```

### 连接失败

```bash
# 测试数据库连接
docker-compose exec postgres psql -U postgres -c "SELECT 1"

# 测试 Redis 连接
docker-compose exec redis redis-cli ping

# 检查网络连接
docker-compose exec backend ping postgres
docker-compose exec backend ping redis
```

## 参考资料

- [Flask 配置文档](https://flask.palletsprojects.com/en/2.3.x/config/)
- [PostgreSQL 连接池](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [Redis 配置](https://redis.io/docs/management/config/)
- [Celery 配置](https://docs.celeryq.dev/en/stable/userguide/configuration.html)
- [Python Logging](https://docs.python.org/3/library/logging.html)
