# 安全加固和监控指南

本文档提供生产环境部署的安全加固和监控配置指南。

## 目录

1. [HTTPS/SSL 配置](#httpsssl-配置)
2. [防火墙配置](#防火墙配置)
3. [API 请求频率限制](#api-请求频率限制)
4. [安全审计日志](#安全审计日志)
5. [系统监控和告警](#系统监控和告警)
6. [健康检查端点](#健康检查端点)
7. [安全配置检查清单](#安全配置检查清单)

---

## HTTPS/SSL 配置

### 1. 生成 SSL 证书

#### 使用 Let's Encrypt（推荐）

```bash
# 安装 certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# 生成证书
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

#### 使用自签名证书（仅用于测试）

```bash
# 生成私钥
openssl genrsa -out server.key 2048

# 生成证书签名请求
openssl req -new -key server.key -out server.csr

# 生成自签名证书
openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt

# 移动到正确位置
sudo mkdir -p /etc/ssl/private /etc/ssl/certs
sudo mv server.key /etc/ssl/private/
sudo mv server.crt /etc/ssl/certs/
sudo chmod 600 /etc/ssl/private/server.key
```

### 2. Nginx SSL 配置

创建或编辑 `/etc/nginx/sites-available/admin-system`:

```nginx
# HTTP 重定向到 HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;
    
    # Let's Encrypt 验证
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # 重定向到 HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS 配置
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL 协议和加密套件
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    
    # SSL 会话缓存
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/your-domain.com/chain.pem;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;
    
    # 安全响应头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'self';" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    
    # 前端静态文件
    location / {
        root /var/www/admin-frontend;
        try_files $uri $uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # 后端 API 代理
    location /api/ {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        
        # 代理头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 缓冲设置
        proxy_buffering off;
        proxy_request_buffering off;
    }
    
    # 健康检查端点
    location /health {
        proxy_pass http://backend:5000/health;
        access_log off;
    }
    
    # 日志配置
    access_log /var/log/nginx/admin-access.log;
    error_log /var/log/nginx/admin-error.log;
}
```

### 3. 启用配置

```bash
# 测试配置
sudo nginx -t

# 启用站点
sudo ln -s /etc/nginx/sites-available/admin-system /etc/nginx/sites-enabled/

# 重启 Nginx
sudo systemctl restart nginx

# 设置开机自启
sudo systemctl enable nginx
```

### 4. 验证 SSL 配置

```bash
# 使用 SSL Labs 测试
# 访问: https://www.ssllabs.com/ssltest/

# 或使用命令行工具
openssl s_client -connect your-domain.com:443 -tls1_2
```

---

## 防火墙配置

### 1. UFW 防火墙（Ubuntu/Debian）

```bash
# 安装 UFW
sudo apt-get install ufw

# 默认策略
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 允许 SSH（重要！先配置这个）
sudo ufw allow 22/tcp
# 或限制 SSH 访问频率
sudo ufw limit 22/tcp

# 允许 HTTP 和 HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 允许特定 IP 访问数据库（内网）
sudo ufw allow from 172.30.0.0/16 to any port 5432 proto tcp

# 允许特定 IP 访问 Redis（内网）
sudo ufw allow from 172.30.0.0/16 to any port 6379 proto tcp

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status verbose

# 查看规则编号
sudo ufw status numbered

# 删除规则（按编号）
sudo ufw delete 3
```

### 2. iptables 防火墙（高级配置）

```bash
# 清空现有规则
sudo iptables -F
sudo iptables -X
sudo iptables -Z

# 默认策略
sudo iptables -P INPUT DROP
sudo iptables -P FORWARD DROP
sudo iptables -P OUTPUT ACCEPT

# 允许本地回环
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A OUTPUT -o lo -j ACCEPT

# 允许已建立的连接
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# 允许 SSH
sudo iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --set
sudo iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --update --seconds 60 --hitcount 4 -j DROP
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# 允许 HTTP 和 HTTPS
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# 允许内网访问数据库
sudo iptables -A INPUT -s 172.30.0.0/16 -p tcp --dport 5432 -j ACCEPT

# 允许内网访问 Redis
sudo iptables -A INPUT -s 172.30.0.0/16 -p tcp --dport 6379 -j ACCEPT

# 防止 SYN 洪水攻击
sudo iptables -A INPUT -p tcp --syn -m limit --limit 1/s --limit-burst 3 -j ACCEPT
sudo iptables -A INPUT -p tcp --syn -j DROP

# 防止 ping 洪水攻击
sudo iptables -A INPUT -p icmp --icmp-type echo-request -m limit --limit 1/s -j ACCEPT
sudo iptables -A INPUT -p icmp --icmp-type echo-request -j DROP

# 记录被丢弃的包
sudo iptables -A INPUT -m limit --limit 5/min -j LOG --log-prefix "iptables denied: " --log-level 7

# 保存规则
sudo iptables-save > /etc/iptables/rules.v4

# 或使用 iptables-persistent
sudo apt-get install iptables-persistent
sudo netfilter-persistent save
```

### 3. Docker 网络安全

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    networks:
      - backend-network
    # 不暴露端口到主机
    expose:
      - "5000"
  
  postgres:
    networks:
      - backend-network
    # 仅内网访问
    expose:
      - "5432"
  
  redis:
    networks:
      - backend-network
    expose:
      - "6379"
  
  nginx:
    networks:
      - backend-network
    ports:
      - "80:80"
      - "443:443"

networks:
  backend-network:
    driver: bridge
    internal: false  # 允许访问外网
    ipam:
      config:
        - subnet: 172.30.0.0/16
```

---

## API 请求频率限制

### 1. 配置频率限制

编辑 `config/security.prod.yaml`:

```yaml
security:
  rate_limiting:
    enabled: true
    default_limit: 100
    default_window: 60
    
    endpoints:
      'auth.login':
        limit: 5
        window: 60
      'ansible.execute_playbook':
        limit: 10
        window: 300
```

### 2. 应用频率限制

```python
from app.core.rate_limiter import rate_limit

@api_bp.route('/sensitive-endpoint', methods=['POST'])
@rate_limit(limit=10, window=60)
def sensitive_endpoint():
    return jsonify({'message': 'Success'})
```

### 3. 监控频率限制

```python
from app.core.rate_limiter import get_rate_limit_status

# 获取当前用户的频率限制状态
status = get_rate_limit_status()
print(f"Remaining: {status['remaining']}/{status['limit']}")
print(f"Reset at: {status['reset']}")
```

### 4. 响应头

频率限制信息会自动添加到响应头：

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

---

## 安全审计日志

### 1. 启用审计日志

```python
from app.services.security_audit_service import security_audit_service

# 记录用户操作
security_audit_service.log_audit(
    operation='user_create',
    resource='user',
    resource_id=user.id,
    details={'username': user.username}
)

# 记录登录尝试
security_audit_service.log_login_attempt(
    username='admin',
    success=True,
    tenant_id=1
)

# 记录安全违规
security_audit_service.log_security_violation(
    violation_type='csrf',
    details={'endpoint': '/api/users'},
    severity='warning'
)
```

### 2. 使用装饰器

```python
from app.services.security_audit_service import audit_log

@api_bp.route('/users', methods=['POST'])
@audit_log(operation='user_create', resource='user')
def create_user():
    # 创建用户逻辑
    return jsonify({'success': True})
```

### 3. 查询审计日志

```python
# 查询审计日志
logs = security_audit_service.get_audit_logs(
    tenant_id=1,
    operation='login_failed',
    start_date=datetime.now() - timedelta(days=7),
    page=1,
    per_page=50
)
```

### 4. 配置日志轮转

编辑 `/etc/logrotate.d/admin-audit`:

```
/var/log/admin/audit.log {
    daily
    rotate 90
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload admin-backend
    endscript
}
```

---

## 系统监控和告警

### 1. Prometheus 监控

#### 安装 Prometheus

```bash
# 下载 Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.40.0/prometheus-2.40.0.linux-amd64.tar.gz
tar xvfz prometheus-*.tar.gz
cd prometheus-*

# 创建配置文件
cat > prometheus.yml <<EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'admin-backend'
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/metrics'
  
  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']
  
  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']
  
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']
EOF

# 启动 Prometheus
./prometheus --config.file=prometheus.yml
```

#### 配置 Flask 应用导出指标

```python
# app/__init__.py
from prometheus_flask_exporter import PrometheusMetrics

def create_app():
    app = Flask(__name__)
    
    # 启用 Prometheus 指标
    metrics = PrometheusMetrics(app)
    
    # 自定义指标
    metrics.info('app_info', 'Application info', version='1.0.0')
    
    return app
```

### 2. Grafana 可视化

#### 安装 Grafana

```bash
# 添加 Grafana 仓库
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -

# 安装
sudo apt-get update
sudo apt-get install grafana

# 启动
sudo systemctl start grafana-server
sudo systemctl enable grafana-server

# 访问 http://localhost:3000
# 默认用户名/密码: admin/admin
```

#### 配置数据源

1. 登录 Grafana
2. 添加 Prometheus 数据源
3. URL: `http://localhost:9090`
4. 保存并测试

#### 导入仪表板

1. 导入预制仪表板
2. 使用仪表板 ID: 
   - Flask: 10282
   - PostgreSQL: 9628
   - Redis: 11835
   - Node Exporter: 1860

### 3. 告警配置

#### Alertmanager 配置

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m
  smtp_smarthost: 'smtp.example.com:587'
  smtp_from: 'alertmanager@example.com'
  smtp_auth_username: 'alertmanager@example.com'
  smtp_auth_password: 'password'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'email-notifications'
  
  routes:
    - match:
        severity: critical
      receiver: 'critical-notifications'
      continue: true

receivers:
  - name: 'email-notifications'
    email_configs:
      - to: 'team@example.com'
        headers:
          Subject: '[Alert] {{ .GroupLabels.alertname }}'
  
  - name: 'critical-notifications'
    email_configs:
      - to: 'oncall@example.com'
        headers:
          Subject: '[CRITICAL] {{ .GroupLabels.alertname }}'
    webhook_configs:
      - url: 'https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN'
```

#### 告警规则

```yaml
# alerts.yml
groups:
  - name: admin_system_alerts
    rules:
      # 高错误率
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} (threshold: 0.05)"
      
      # 高内存使用
      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value | humanizePercentage }}"
      
      # 数据库连接失败
      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database is down"
          description: "PostgreSQL database is not responding"
      
      # Redis 连接失败
      - alert: RedisDown
        expr: up{job="redis"} == 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Redis is down"
          description: "Redis cache is not responding"
      
      # API 响应时间过长
      - alert: SlowAPIResponse
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow API response time"
          description: "95th percentile response time is {{ $value }}s"
      
      # 磁盘空间不足
      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Disk space low"
          description: "Available disk space is {{ $value | humanizePercentage }}"
```

### 4. 日志聚合（ELK Stack）

#### 安装 Elasticsearch

```bash
# 添加 Elasticsearch 仓库
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -
echo "deb https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list

# 安装
sudo apt-get update
sudo apt-get install elasticsearch

# 配置
sudo vim /etc/elasticsearch/elasticsearch.yml
# network.host: localhost
# http.port: 9200

# 启动
sudo systemctl start elasticsearch
sudo systemctl enable elasticsearch
```

#### 安装 Logstash

```bash
# 安装
sudo apt-get install logstash

# 配置
sudo vim /etc/logstash/conf.d/admin-system.conf
```

```
input {
  file {
    path => "/var/log/admin/app.log"
    type => "app"
    codec => json
  }
  file {
    path => "/var/log/admin/audit.log"
    type => "audit"
    codec => json
  }
  file {
    path => "/var/log/nginx/admin-access.log"
    type => "nginx-access"
  }
}

filter {
  if [type] == "nginx-access" {
    grok {
      match => { "message" => "%{COMBINEDAPACHELOG}" }
    }
    date {
      match => [ "timestamp", "dd/MMM/yyyy:HH:mm:ss Z" ]
    }
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "admin-system-%{type}-%{+YYYY.MM.dd}"
  }
}
```

```bash
# 启动
sudo systemctl start logstash
sudo systemctl enable logstash
```

#### 安装 Kibana

```bash
# 安装
sudo apt-get install kibana

# 配置
sudo vim /etc/kibana/kibana.yml
# server.port: 5601
# server.host: "localhost"
# elasticsearch.hosts: ["http://localhost:9200"]

# 启动
sudo systemctl start kibana
sudo systemctl enable kibana

# 访问 http://localhost:5601
```

---

## 健康检查端点

### 1. 健康检查端点

系统提供三个健康检查端点：

#### `/health` - 完整健康检查

检查所有依赖服务（数据库、Redis）的状态。

```bash
curl http://localhost:5000/health
```

响应示例：

```json
{
  "status": "healthy",
  "checks": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

#### `/ready` - 就绪检查

检查应用是否准备好接收流量。

```bash
curl http://localhost:5000/ready
```

#### `/live` - 存活检查

检查应用是否仍在运行。

```bash
curl http://localhost:5000/live
```

### 2. Docker 健康检查

在 `docker-compose.yml` 中配置：

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### 3. Kubernetes 健康检查

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: admin-backend
spec:
  containers:
  - name: backend
    image: admin-backend:latest
    livenessProbe:
      httpGet:
        path: /live
        port: 5000
      initialDelaySeconds: 30
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /ready
        port: 5000
      initialDelaySeconds: 5
      periodSeconds: 5
```

---

## 安全配置检查清单

### 部署前检查

使用自动化脚本检查安全配置：

```bash
cd admin-mit-backend

# 运行安全检查
python scripts/security_check.py

# 运行配置验证
python scripts/validate_config.py

# 扫描依赖漏洞
pip install safety
safety check

# 扫描代码安全问题
pip install bandit
bandit -r app/
```

### 手动检查清单

参考 [SECURITY_CHECKLIST.md](../../SECURITY_CHECKLIST.md) 进行完整的安全检查。

重点检查项：

- [ ] 修改所有默认密钥和密码
- [ ] 配置 HTTPS/SSL 证书
- [ ] 配置防火墙规则
- [ ] 启用 API 频率限制
- [ ] 配置安全审计日志
- [ ] 设置系统监控和告警
- [ ] 配置健康检查端点
- [ ] 关闭 Debug 模式
- [ ] 配置日志轮转
- [ ] 测试备份恢复流程

---

## 故障排查

### 1. SSL 证书问题

```bash
# 检查证书有效期
openssl x509 -in /etc/ssl/certs/server.crt -noout -dates

# 检查证书链
openssl s_client -connect your-domain.com:443 -showcerts

# 测试 SSL 配置
curl -vI https://your-domain.com
```

### 2. 防火墙问题

```bash
# 检查端口是否开放
sudo netstat -tulpn | grep :443

# 测试端口连接
telnet your-domain.com 443

# 检查防火墙日志
sudo tail -f /var/log/ufw.log
```

### 3. 监控问题

```bash
# 检查 Prometheus 状态
curl http://localhost:9090/-/healthy

# 检查指标端点
curl http://localhost:5000/metrics

# 查看 Grafana 日志
sudo journalctl -u grafana-server -f
```

---

## 参考资料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Nginx Security](https://nginx.org/en/docs/http/ngx_http_ssl_module.html)

---

## 支持

如有问题，请联系：

- 技术支持: support@example.com
- 安全团队: security@example.com
- 紧急联系: +86 xxx xxxx xxxx
