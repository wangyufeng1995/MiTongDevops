# 常见问题解答 (FAQ)

## 目录

- [安装和配置](#安装和配置)
- [开发问题](#开发问题)
- [部署问题](#部署问题)
- [功能使用](#功能使用)
- [性能优化](#性能优化)
- [安全问题](#安全问题)

## 安装和配置

### Q1: 如何安装项目依赖？

**A**: 分别安装前端和后端依赖：

```bash
# 前端
cd admin-mit-ui
npm install

# 后端
cd admin-mit-backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Q2: 数据库连接失败怎么办？

**A**: 检查以下几点：

1. PostgreSQL 服务是否启动
2. `config/database.yaml` 配置是否正确
3. 数据库是否已创建
4. 防火墙是否允许连接

```bash
# 测试数据库连接
psql -h localhost -U postgres -d mitong_devops

# 创建数据库
createdb mitong_devops
```

### Q3: Redis 连接失败怎么办？

**A**: 检查以下几点：

1. Redis 服务是否启动
2. `config/redis.yaml` 配置是否正确
3. Redis 密码是否正确

```bash
# 测试 Redis 连接
redis-cli ping
# 应返回 PONG

# 启动 Redis
redis-server
```

### Q4: 如何修改配置文件？

**A**: 配置文件位于 `admin-mit-backend/config/` 目录：

- `database.yaml`: 数据库配置
- `redis.yaml`: Redis 配置
- `app.yaml`: 应用配置
- `logging.yaml`: 日志配置

修改后重启服务即可生效。

### Q5: 如何初始化数据库？

**A**: 使用 Alembic 迁移工具：

```bash
cd admin-mit-backend

# 执行迁移
flask db upgrade

# 初始化示例数据
python init_database.py
```

## 开发问题

### Q6: npm install 失败怎么办？

**A**: 尝试以下解决方案：

```bash
# 清除缓存
npm cache clean --force

# 删除 node_modules 和 package-lock.json
rm -rf node_modules package-lock.json

# 重新安装
npm install

# 或使用 yarn
yarn install

# 或使用国内镜像
npm install --registry=https://registry.npmmirror.com
```

### Q7: 端口被占用怎么办？

**A**: 查找并关闭占用端口的进程：

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9

# 或修改端口
# 前端: 修改 vite.config.ts 中的 server.port
# 后端: 修改 config/app.yaml 中的 server.port
```

### Q8: TypeScript 类型错误怎么解决？

**A**: 常见解决方案：

1. 检查类型定义是否正确
2. 更新 `@types` 包
3. 使用类型断言 `as`
4. 临时忽略 `// @ts-ignore` (不推荐)

```typescript
// 类型断言
const data = response.data as User;

// 类型守卫
if (typeof data === 'object' && data !== null) {
  // data 是对象
}
```

### Q9: 如何调试前端代码？

**A**: 使用以下方法：

1. **Chrome DevTools**: 在浏览器中按 F12
2. **React DevTools**: 安装 React Developer Tools 扩展
3. **VS Code 调试**: 配置 `.vscode/launch.json`
4. **Console 日志**: `console.log()`, `console.error()`

### Q10: 如何调试后端代码？

**A**: 使用以下方法：

1. **PyCharm 调试**: 设置断点，Debug 模式运行
2. **VS Code 调试**: 配置 `.vscode/launch.json`
3. **日志调试**: 使用 `logging` 模块
4. **打印 SQL**: 设置 `SQLALCHEMY_ECHO = True`

```python
import logging

logger = logging.getLogger(__name__)
logger.debug("调试信息")
logger.info("普通信息")
logger.error("错误信息")
```

## 部署问题

### Q11: Docker 构建失败怎么办？

**A**: 检查以下几点：

1. Docker 服务是否启动
2. Dockerfile 语法是否正确
3. 网络连接是否正常
4. 使用国内镜像源

```bash
# 清理 Docker 缓存
docker system prune -a

# 重新构建
docker-compose build --no-cache

# 查看构建日志
docker-compose build --progress=plain
```

### Q12: 如何配置生产环境？

**A**: 生产环境配置步骤：

1. 修改配置文件中的密钥和密码
2. 配置 HTTPS 证书
3. 设置环境变量
4. 配置防火墙规则
5. 配置日志轮转
6. 配置监控告警

详见 `PRODUCTION_DEPLOYMENT_GUIDE.md`。

### Q13: 如何备份和恢复数据库？

**A**: 使用 PostgreSQL 工具：

```bash
# 备份数据库
pg_dump -U postgres mitong_devops > backup.sql

# 恢复数据库
psql -U postgres mitong_devops < backup.sql

# 或使用脚本
cd admin-mit-backend/scripts
./db_backup.sh
./db_restore.sh backup.sql
```

### Q14: 如何升级系统？

**A**: 升级步骤：

1. 备份数据库
2. 拉取最新代码
3. 安装新依赖
4. 执行数据库迁移
5. 重启服务
6. 验证功能

```bash
# 拉取代码
git pull origin main

# 安装依赖
npm install
pip install -r requirements.txt

# 数据库迁移
flask db upgrade

# 重启服务
docker-compose restart
```

## 功能使用

### Q15: 如何添加新用户？

**A**: 通过以下方式添加用户：

1. **Web 界面**: 登录后进入"用户管理"页面，点击"新增用户"
2. **API 接口**: 调用 `POST /api/users` 接口
3. **数据库脚本**: 使用 `init_database.py` 脚本

### Q16: 如何配置用户权限？

**A**: 权限配置步骤：

1. 创建角色: 进入"角色管理"页面
2. 分配权限: 为角色分配菜单和操作权限
3. 分配角色: 在"用户管理"中为用户分配角色

### Q17: 如何使用 WebShell？

**A**: WebShell 使用步骤：

1. 添加 SSH 主机: 进入"主机管理"页面
2. 配置连接信息: 填写主机地址、端口、用户名、密码/密钥
3. 测试连接: 点击"测试连接"按钮
4. 打开终端: 点击"WebShell"按钮

### Q18: 如何配置监控告警？

**A**: 监控告警配置步骤：

1. 配置告警渠道: 进入"监控告警" -> "告警渠道"
2. 添加邮箱或钉钉机器人
3. 配置告警规则: 进入"告警规则"页面
4. 设置监控指标和阈值
5. 选择告警渠道

### Q19: 如何使用网络探测？

**A**: 网络探测使用步骤：

1. 创建探测分组: 进入"网络探测" -> "探测分组"
2. 添加探测任务: 进入"探测任务"页面
3. 配置探测参数: 选择协议、目标地址、间隔等
4. 启动探测: 点击"启动自动探测"或"主动探测"
5. 查看结果: 在"探测监控"页面查看实时结果

### Q20: 如何执行 Ansible Playbook？

**A**: Ansible 执行步骤：

1. 上传 Playbook: 进入"Ansible 管理"页面
2. 编辑 Playbook: 使用在线编辑器编辑 YAML 文件
3. 选择目标主机: 选择要执行的主机
4. 配置变量: 设置执行参数
5. 执行 Playbook: 点击"执行"按钮
6. 查看日志: 实时查看执行日志

## 性能优化

### Q21: 前端页面加载慢怎么办？

**A**: 优化方案：

1. 使用 React DevTools Profiler 分析性能
2. 检查是否有不必要的重渲染
3. 使用 `React.memo` 优化组件
4. 使用代码分割和懒加载
5. 优化图片大小和格式
6. 使用 CDN 加速静态资源

```typescript
// 使用 React.memo
const UserList = React.memo(({ users }) => {
  // ...
});

// 使用懒加载
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
```

### Q22: API 响应慢怎么办？

**A**: 优化方案：

1. 检查数据库查询是否优化
2. 添加数据库索引
3. 使用 Redis 缓存热点数据
4. 使用分页查询
5. 优化 SQL 查询
6. 使用连接池

```python
# 添加索引
CREATE INDEX idx_users_tenant_id ON users(tenant_id);

# 使用缓存
@cache.memoize(timeout=300)
def get_user_list():
    return User.query.all()

# 使用分页
users = User.query.paginate(page=1, per_page=10)
```

### Q23: 数据库查询慢怎么办？

**A**: 优化方案：

1. 使用 EXPLAIN 分析查询计划
2. 添加合适的索引
3. 避免 N+1 查询
4. 使用 join 代替子查询
5. 定期维护数据库

```sql
-- 分析查询
EXPLAIN SELECT * FROM users WHERE tenant_id = 1;

-- 添加索引
CREATE INDEX idx_users_tenant_id ON users(tenant_id);

-- 使用 join
SELECT u.*, r.name FROM users u
JOIN roles r ON u.role_id = r.id
WHERE u.tenant_id = 1;
```

### Q24: 如何优化 Redis 缓存？

**A**: 优化方案：

1. 设置合理的 TTL
2. 使用合适的数据结构
3. 避免大 key
4. 使用 pipeline 批量操作
5. 定期清理过期数据

```python
# 设置 TTL
redis.setex('key', 300, 'value')

# 使用 pipeline
pipe = redis.pipeline()
pipe.set('key1', 'value1')
pipe.set('key2', 'value2')
pipe.execute()
```

## 安全问题

### Q25: 如何保证密码安全？

**A**: 密码安全措施：

1. 前端使用 RSA 加密传输
2. 后端使用 bcrypt 加密存储
3. 设置密码复杂度要求
4. 定期更换密码
5. 限制登录失败次数

### Q26: 如何防止 SQL 注入？

**A**: 防护措施：

1. 使用 SQLAlchemy ORM
2. 使用参数化查询
3. 输入验证和过滤
4. 最小权限原则

```python
# ✅ 安全: 使用 ORM
users = User.query.filter_by(username=username).all()

# ✅ 安全: 参数化查询
db.session.execute("SELECT * FROM users WHERE username = :username", {"username": username})

# ❌ 不安全: 字符串拼接
db.session.execute(f"SELECT * FROM users WHERE username = '{username}'")
```

### Q27: 如何防止 XSS 攻击？

**A**: 防护措施：

1. 前端输入验证
2. 输出转义
3. 使用 Content-Security-Policy
4. 避免使用 `dangerouslySetInnerHTML`

```typescript
// ✅ 安全: React 自动转义
<div>{userInput}</div>

// ❌ 不安全: 直接插入 HTML
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

### Q28: 如何防止 CSRF 攻击？

**A**: 防护措施：

1. 使用 CSRF Token
2. 验证 Referer
3. 使用 SameSite Cookie
4. 双重提交 Cookie

### Q29: 如何保证多租户数据隔离？

**A**: 数据隔离措施：

1. 所有表包含 `tenant_id` 字段
2. 中间件自动过滤租户数据
3. 查询时强制添加租户条件
4. 审计日志记录所有操作

```python
# 自动过滤租户数据
@event.listens_for(Session, 'before_flush')
def receive_before_flush(session, flush_context, instances):
    tenant_id = get_current_tenant_id()
    for instance in session.new:
        if isinstance(instance, BaseModel):
            instance.tenant_id = tenant_id
```

### Q30: 如何配置 HTTPS？

**A**: HTTPS 配置步骤：

1. 获取 SSL 证书
2. 配置 Nginx
3. 强制 HTTPS 重定向
4. 配置 HSTS

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # 强制 HTTPS
    add_header Strict-Transport-Security "max-age=31536000" always;
}

server {
    listen 80;
    server_name example.com;
    return 301 https://$server_name$request_uri;
}
```

## 其他问题

### Q31: 如何查看日志？

**A**: 日志位置：

- 前端日志: 浏览器 Console
- 后端日志: `admin-mit-backend/logs/app.log`
- 错误日志: `admin-mit-backend/logs/error.log`
- Nginx 日志: `/var/log/nginx/`

```bash
# 查看实时日志
tail -f admin-mit-backend/logs/app.log

# 查看错误日志
tail -f admin-mit-backend/logs/error.log
```

### Q32: 如何联系技术支持？

**A**: 获取帮助的方式：

1. 查看项目文档
2. 搜索已有 Issue
3. 创建新的 Issue
4. 联系项目维护者
5. 加入技术交流群

### Q33: 如何贡献代码？

**A**: 贡献流程：

1. Fork 项目
2. 创建功能分支
3. 提交代码
4. 创建 Pull Request
5. 代码审查
6. 合并代码

详见 `docs/CODE_STANDARDS.md`。

## 更多帮助

如果以上内容没有解决您的问题，请：

1. 查看完整文档: `docs/` 目录
2. 查看 API 文档: 访问 `/api/docs`
3. 提交 Issue: 在 GitHub/GitLab 上提交
4. 联系我们: 发送邮件或加入交流群

感谢使用 MiTong运维平台！
