# Celery 任务队列配置和使用指南

## 概述

本项目使用 Celery 作为分布式任务队列，用于处理异步任务，特别是网络探测任务。Celery 使用 Redis 作为消息代理（Broker）和结果后端（Result Backend）。

## 架构设计

### 组件说明

1. **Celery App** (`app/celery_app.py`): Celery 应用配置和初始化
2. **任务模块** (`app/tasks/`): 定义各种异步任务
3. **Beat 调度** (`app/celery_beat_schedule.py`): 定时任务配置
4. **工具函数** (`app/celery_utils.py`): Celery 与 Flask 集成工具

### 任务队列

- `network_probes`: 网络探测任务队列
- `alerts`: 告警任务队列
- `ansible`: Ansible 任务队列

## 配置说明

### Redis 配置

Celery 使用配置文件 `config/redis.yaml` 中的 Redis 连接信息：

```yaml
redis:
  host: "172.30.3.135"
  port: 6379
  password: "your_password"
  db: 2  # Celery 使用 db 2
```

### Celery 配置

在 `config/app.yaml` 中配置 Celery：

```yaml
celery:
  broker_url: "redis://172.30.3.135:6379/2"
  result_backend: "redis://172.30.3.135:6379/2"
  task_serializer: "json"
  result_serializer: "json"
  accept_content: ["json"]
  timezone: "Asia/Shanghai"
```

## 启动 Celery

### 1. 启动 Worker

在项目根目录下运行：

```bash
# 启动单个 worker
celery -A celery_worker.celery worker --loglevel=info

# 启动多个 worker（并发数为 4）
celery -A celery_worker.celery worker --loglevel=info --concurrency=4

# 指定队列
celery -A celery_worker.celery worker --loglevel=info -Q network_probes,alerts
```

### 2. 启动 Beat 调度器

Beat 负责定时任务的调度：

```bash
# 启动 beat 调度器
celery -A celery_worker.celery beat --loglevel=info
```

### 3. 同时启动 Worker 和 Beat

```bash
# 同时启动 worker 和 beat
celery -A celery_worker.celery worker --beat --loglevel=info
```

### 4. 使用 Flower 监控（可选）

Flower 是 Celery 的 Web 监控工具：

```bash
# 安装 flower
pip install flower

# 启动 flower
celery -A celery_worker.celery flower --port=5555
```

访问 http://localhost:5555 查看任务监控界面。

## 任务使用示例

### 1. 执行单个网络探测任务

```python
from app.tasks.network_probe_tasks import execute_probe

# 异步执行
task = execute_probe.apply_async(
    kwargs={
        'probe_id': 1,
        'tenant_id': 1,
        'probe_type': 'manual'
    }
)

# 获取任务 ID
task_id = task.id

# 获取任务状态
from app.celery_utils import get_task_status
status = get_task_status(task_id)
```

### 2. 批量执行探测任务

```python
from app.tasks.network_probe_tasks import execute_batch_probes

result = execute_batch_probes.apply_async(
    kwargs={
        'probe_ids': [1, 2, 3],
        'tenant_id': 1,
        'probe_type': 'auto'
    }
)
```

### 3. 调度自动探测任务

```python
from app.tasks.network_probe_tasks import schedule_auto_probes

# 手动触发调度
result = schedule_auto_probes.apply_async()
```

### 4. 清理旧的探测结果

```python
from app.tasks.network_probe_tasks import cleanup_old_results

# 清理 30 天前的数据
result = cleanup_old_results.apply_async(kwargs={'days': 30})
```

## 任务状态跟踪

### 任务状态

- `PENDING`: 任务等待执行
- `STARTED`: 任务已开始执行
- `SUCCESS`: 任务执行成功
- `FAILURE`: 任务执行失败
- `RETRY`: 任务正在重试
- `REVOKED`: 任务已被撤销

### 查询任务状态

```python
from app.celery_utils import get_task_status

status = get_task_status('task-id-here')
print(status)
# {
#     'task_id': 'task-id-here',
#     'state': 'SUCCESS',
#     'ready': True,
#     'successful': True,
#     'result': {'success': True, 'probe_id': 1}
# }
```

### 撤销任务

```python
from app.celery_utils import revoke_task

# 撤销任务（不终止正在执行的任务）
result = revoke_task('task-id-here', terminate=False)

# 强制终止正在执行的任务
result = revoke_task('task-id-here', terminate=True)
```

## 任务重试机制

### 自动重试配置

所有网络探测任务都继承自 `NetworkProbeTask`，具有以下重试配置：

- **最大重试次数**: 3 次
- **重试延迟**: 60 秒
- **指数退避**: 启用（每次重试延迟时间递增）
- **最大退避时间**: 600 秒
- **随机抖动**: 启用（避免重试风暴）

### 重试触发条件

任务在遇到任何异常时都会自动重试，包括：
- 网络连接错误
- 超时错误
- 数据库错误
- 其他运行时异常

### 失败处理

任务失败后会：
1. 记录错误日志
2. 将失败信息保存到数据库
3. 触发失败回调函数

## 定时任务配置

定时任务在 `app/celery_beat_schedule.py` 中配置：

### 1. 自动探测任务调度

每 60 秒执行一次，调度所有启用自动探测的任务：

```python
'schedule-auto-probes': {
    'task': 'app.tasks.network_probe_tasks.schedule_auto_probes',
    'schedule': 60.0,
}
```

### 2. 清理旧探测结果

每天凌晨 2:00 清理 30 天前的数据：

```python
'cleanup-old-probe-results': {
    'task': 'app.tasks.network_probe_tasks.cleanup_old_results',
    'schedule': crontab(hour=2, minute=0),
    'kwargs': {'days': 30},
}
```

### 3. 深度清理

每周日凌晨 3:00 清理 90 天前的数据：

```python
'deep-cleanup-probe-results': {
    'task': 'app.tasks.network_probe_tasks.cleanup_old_results',
    'schedule': crontab(hour=3, minute=0, day_of_week=0),
    'kwargs': {'days': 90},
}
```

## 监控和管理

### 查看活跃任务

```python
from app.celery_utils import get_active_tasks

tasks = get_active_tasks()
for task in tasks:
    print(f"Worker: {task['worker']}, Task: {task['task_name']}")
```

### 查看已调度任务

```python
from app.celery_utils import get_scheduled_tasks

tasks = get_scheduled_tasks()
for task in tasks:
    print(f"Task: {task['task_name']}, ETA: {task['eta']}")
```

### 查看 Worker 统计

```python
from app.celery_utils import get_worker_stats

stats = get_worker_stats()
print(f"Total workers: {stats['total_workers']}")
for worker in stats['workers']:
    print(f"Worker: {worker['name']}, Concurrency: {worker['max_concurrency']}")
```

### 清空队列

```python
from app.celery_utils import purge_queue

# 清空所有队列
result = purge_queue()

# 清空指定队列
result = purge_queue('network_probes')
```

## 生产环境部署

### 使用 Supervisor 管理

创建 Supervisor 配置文件 `/etc/supervisor/conf.d/celery.conf`：

```ini
[program:celery-worker]
command=/path/to/venv/bin/celery -A celery_worker.celery worker --loglevel=info --concurrency=4
directory=/path/to/admin-mit-backend
user=www-data
numprocs=1
stdout_logfile=/var/log/celery/worker.log
stderr_logfile=/var/log/celery/worker.error.log
autostart=true
autorestart=true
startsecs=10
stopwaitsecs=600

[program:celery-beat]
command=/path/to/venv/bin/celery -A celery_worker.celery beat --loglevel=info
directory=/path/to/admin-mit-backend
user=www-data
numprocs=1
stdout_logfile=/var/log/celery/beat.log
stderr_logfile=/var/log/celery/beat.error.log
autostart=true
autorestart=true
startsecs=10
```

启动服务：

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start celery-worker
sudo supervisorctl start celery-beat
```

### 使用 systemd 管理

创建 systemd 服务文件 `/etc/systemd/system/celery-worker.service`：

```ini
[Unit]
Description=Celery Worker
After=network.target

[Service]
Type=forking
User=www-data
Group=www-data
WorkingDirectory=/path/to/admin-mit-backend
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/celery -A celery_worker.celery worker --loglevel=info --concurrency=4 --detach
ExecStop=/path/to/venv/bin/celery -A celery_worker.celery control shutdown
Restart=always

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable celery-worker
sudo systemctl start celery-worker
```

## 性能优化

### 1. 调整并发数

根据服务器 CPU 核心数调整 worker 并发数：

```bash
# 4 个并发进程
celery -A celery_worker.celery worker --concurrency=4

# 使用 gevent 池（适合 I/O 密集型任务）
celery -A celery_worker.celery worker --pool=gevent --concurrency=100
```

### 2. 任务优先级

为重要任务设置更高的优先级：

```python
execute_probe.apply_async(
    kwargs={'probe_id': 1, 'tenant_id': 1},
    priority=9  # 0-10，数字越大优先级越高
)
```

### 3. 任务路由

将不同类型的任务路由到不同的队列：

```bash
# 启动专门处理网络探测的 worker
celery -A celery_worker.celery worker -Q network_probes --concurrency=8

# 启动专门处理告警的 worker
celery -A celery_worker.celery worker -Q alerts --concurrency=4
```

## 故障排查

### 1. 任务未执行

检查：
- Worker 是否正在运行
- Redis 连接是否正常
- 任务是否被正确路由到队列
- 查看 Worker 日志

### 2. 任务执行失败

检查：
- 任务日志中的错误信息
- 数据库连接是否正常
- 任务参数是否正确
- 是否达到最大重试次数

### 3. 内存泄漏

如果 Worker 内存持续增长：
- 设置 `worker_max_tasks_per_child` 限制每个子进程执行的任务数
- 检查任务代码是否有内存泄漏
- 使用 `worker_pool_restarts` 定期重启 worker

### 4. 任务堆积

如果队列中任务堆积：
- 增加 worker 数量或并发数
- 优化任务执行时间
- 检查是否有慢查询或阻塞操作

## 测试

运行 Celery 任务测试：

```bash
# 运行所有 Celery 测试
pytest tests/test_celery_tasks.py -v

# 运行特定测试类
pytest tests/test_celery_tasks.py::TestExecuteProbeTask -v

# 查看测试覆盖率
pytest tests/test_celery_tasks.py --cov=app.tasks --cov=app.celery_app --cov=app.celery_utils
```

## 参考资料

- [Celery 官方文档](https://docs.celeryproject.org/)
- [Celery 最佳实践](https://docs.celeryproject.org/en/stable/userguide/tasks.html#best-practices)
- [Redis 配置指南](https://redis.io/documentation)
