# 安全配置检查清单

本文档提供生产环境部署前的安全配置检查清单。

## 部署前检查

### 1. 认证和授权

- [ ] 修改默认管理员密码
- [ ] 启用强密码策略（最少8位，包含大小写、数字、特殊字符）
- [ ] 配置 JWT token 过期时间（建议1小时）
- [ ] 启用 refresh token 机制
- [ ] 配置登录失败锁定（5次失败锁定15分钟）
- [ ] 实现多因素认证（MFA）（可选）

### 2. 数据加密

- [ ] 配置 HTTPS/SSL 证书
- [ ] 启用数据库连接加密
- [ ] 配置 Redis 密码认证
- [ ] 使用 RSA 加密传输密码
- [ ] 加密存储敏感配置信息
- [ ] 配置数据库字段级加密（敏感数据）

### 3. 网络安全

- [ ] 配置防火墙规则
- [ ] 限制数据库端口访问（仅内网）
- [ ] 限制 Redis 端口访问（仅内网）
- [ ] 配置 CORS 白名单
- [ ] 启用 API 速率限制
- [ ] 配置 DDoS 防护

### 4. 应用安全

- [ ] 关闭 Debug 模式
- [ ] 启用 CSRF 保护
- [ ] 配置 XSS 防护头
- [ ] 启用 SQL 注入防护
- [ ] 配置文件上传限制
- [ ] 实现输入验证和清理
- [ ] 配置安全响应头

### 5. Docker 安全

- [ ] 使用非 root 用户运行容器
- [ ] 限制容器资源使用
- [ ] 扫描镜像漏洞
- [ ] 使用最小化基础镜像
- [ ] 配置 Docker secrets
- [ ] 限制容器网络访问

### 6. 数据库安全

- [ ] 修改数据库默认密码
- [ ] 限制数据库远程访问
- [ ] 启用数据库审计日志
- [ ] 配置数据库备份加密
- [ ] 实现数据库连接池限制
- [ ] 配置数据库慢查询日志

### 7. 日志和监控

- [ ] 配置集中式日志收集
- [ ] 启用安全审计日志
- [ ] 配置日志轮转和归档
- [ ] 实现实时告警机制
- [ ] 配置性能监控
- [ ] 设置异常行为检测

### 8. 备份和恢复

- [ ] 配置自动备份策略
- [ ] 测试备份恢复流程
- [ ] 加密备份文件
- [ ] 异地备份存储
- [ ] 配置备份保留策略
- [ ] 文档化恢复流程

### 9. 依赖管理

- [ ] 扫描依赖漏洞
- [ ] 更新过时的依赖
- [ ] 锁定依赖版本
- [ ] 使用可信的包源
- [ ] 定期审查依赖
- [ ] 配置依赖自动更新

### 10. 访问控制

- [ ] 实现基于角色的访问控制（RBAC）
- [ ] 配置最小权限原则
- [ ] 定期审查用户权限
- [ ] 实现会话管理
- [ ] 配置会话超时
- [ ] 记录所有访问日志

## 运行安全检查

### 自动检查

```bash
# 运行安全检查脚本
cd admin-mit-backend
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

### 手动检查

#### 1. 检查文件权限

```bash
# 敏感文件应该是 600 或 400
ls -la config/
ls -la keys/
ls -la .env

# 修正权限
chmod 600 config/*.yaml
chmod 600 keys/private_key.pem
chmod 600 .env
```

#### 2. 检查环境变量

```bash
# 检查是否使用默认值
grep -i "change\|your\|default" .env

# 检查密钥长度
echo $SECRET_KEY | wc -c  # 应该 >= 32
```

#### 3. 检查 SSL 证书

```bash
# 检查证书有效期
openssl x509 -in /etc/nginx/ssl/cert.pem -noout -dates

# 检查证书信息
openssl x509 -in /etc/nginx/ssl/cert.pem -noout -text
```

#### 4. 检查防火墙

```bash
# 查看防火墙规则
sudo iptables -L -n

# 或使用 ufw
sudo ufw status

# 确保只开放必要端口
# 80 (HTTP), 443 (HTTPS)
```

#### 5. 检查 Docker 安全

```bash
# 检查容器运行用户
docker inspect <container> | grep User

# 检查容器资源限制
docker inspect <container> | grep -A 10 Resources

# 扫描镜像漏洞
docker scan admin-backend:latest
```

## 安全配置示例

### Nginx SSL 配置

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # SSL 协议
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;

    # 其他配置...
}
```

### 防火墙规则

```bash
# UFW 配置
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# iptables 配置
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -j DROP
```

### Docker Compose 安全配置

```yaml
services:
  backend:
    # 使用非 root 用户
    user: "1000:1000"
    
    # 只读根文件系统
    read_only: true
    
    # 临时文件系统
    tmpfs:
      - /tmp
    
    # 资源限制
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
    
    # 安全选项
    security_opt:
      - no-new-privileges:true
    
    # 限制能力
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

## 监控配置

### Prometheus 配置

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'admin-backend'
    static_configs:
      - targets: ['backend:9090']
    
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
    
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

### 告警规则

```yaml
# alerts.yml
groups:
  - name: admin_system
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
      
      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
      
      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database is down"
```

## 定期维护

### 每日

- [ ] 检查安全日志
- [ ] 监控异常登录
- [ ] 检查系统告警
- [ ] 验证备份成功

### 每周

- [ ] 审查访问日志
- [ ] 检查依赖更新
- [ ] 扫描安全漏洞
- [ ] 测试备份恢复

### 每月

- [ ] 审查用户权限
- [ ] 更新安全补丁
- [ ] 轮换密钥
- [ ] 安全培训

### 每季度

- [ ] 安全审计
- [ ] 渗透测试
- [ ] 灾难恢复演练
- [ ] 更新安全策略

## 应急响应

### 安全事件处理流程

1. **检测**: 发现安全事件
2. **隔离**: 隔离受影响系统
3. **分析**: 分析攻击方式和影响
4. **清除**: 清除恶意代码和后门
5. **恢复**: 恢复系统正常运行
6. **总结**: 总结经验教训

### 联系方式

- **安全团队**: security@example.com
- **紧急电话**: +86 xxx xxxx xxxx
- **事件报告**: https://security.example.com/report

## 参考资料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [PCI DSS](https://www.pcisecuritystandards.org/)
