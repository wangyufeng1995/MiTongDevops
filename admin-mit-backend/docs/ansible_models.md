# Ansible 数据模型文档

## 概述

Ansible 数据模型提供了完整的 Ansible Playbook 管理和执行记录功能，支持版本管理、执行跟踪和统计分析。

## 数据模型

### 1. AnsiblePlaybook 模型

**表名：** `ansible_playbooks`

**功能：** 管理 Ansible Playbook 的存储、版本控制和元数据

#### 主要字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | Integer | 主键 |
| tenant_id | Integer | 租户ID（多租户支持） |
| name | String(100) | Playbook名称 |
| description | Text | 描述信息 |
| content | Text | YAML内容 |
| variables | JSON | 默认变量 |
| version | String(20) | 版本号 |
| tags | JSON | 标签列表 |
| is_active | Boolean | 是否激活 |
| category | String(50) | 分类 |
| created_by | Integer | 创建者ID |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |

#### 主要方法

##### 1. validate_yaml_content()
验证 YAML 内容格式是否正确。

```python
playbook = AnsiblePlaybook(content="---\n- hosts: all\n  tasks: []")
is_valid, message = playbook.validate_yaml_content()
```

##### 2. get_playbook_tasks()
解析并获取 Playbook 中的任务列表。

```python
tasks = playbook.get_playbook_tasks()
# 返回任务列表，每个任务包含 name 等信息
```

##### 3. get_required_variables()
获取 Playbook 中需要的变量（通过解析 `{{ variable_name }}` 模式）。

```python
variables = playbook.get_required_variables()
# 返回变量名列表
```

##### 4. increment_version()
自动递增版本号。

```python
playbook.version = "1.0.0"
playbook.increment_version()  # 变为 "1.0.1"
```

##### 5. create_version_copy()
创建当前版本的副本（用于版本管理）。

```python
version_copy = playbook.create_version_copy()
# 创建一个非激活的历史版本副本
```

##### 6. get_execution_stats()
获取执行统计信息。

```python
stats = playbook.get_execution_stats()
# 返回：
# {
#     'total_executions': 10,
#     'successful_executions': 8,
#     'failed_executions': 2,
#     'running_executions': 0,
#     'success_rate': 80.0
# }
```

##### 7. to_dict(include_content=True, include_stats=False)
转换为字典格式，支持选择性包含内容和统计信息。

```python
# 基本信息
basic_info = playbook.to_dict(include_content=False)

# 包含统计信息
full_info = playbook.to_dict(include_stats=True)
```

### 2. PlaybookExecution 模型

**表名：** `playbook_executions`

**功能：** 记录 Playbook 的执行历史、状态和结果

#### 主要字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | Integer | 主键 |
| tenant_id | Integer | 租户ID |
| playbook_id | Integer | 关联的Playbook ID |
| host_ids | JSON | 目标主机ID数组 |
| variables | JSON | 执行时变量 |
| status | String(20) | 执行状态 |
| output | Text | 执行输出 |
| error_message | Text | 错误信息 |
| started_at | DateTime | 开始时间 |
| finished_at | DateTime | 结束时间 |
| created_by | Integer | 执行者ID |
| execution_id | String(100) | 外部执行ID |
| progress | Integer | 执行进度(0-100) |
| total_tasks | Integer | 总任务数 |
| completed_tasks | Integer | 已完成任务数 |
| failed_tasks | Integer | 失败任务数 |
| skipped_tasks | Integer | 跳过任务数 |

#### 执行状态

- `pending`: 等待执行
- `running`: 正在执行
- `success`: 执行成功
- `failed`: 执行失败
- `cancelled`: 已取消

#### 主要方法

##### 1. start_execution()
开始执行，设置状态和开始时间。

```python
execution.start_execution()
# 设置 status='running', started_at=now, progress=0
```

##### 2. finish_execution(success=True, error_message=None)
完成执行，设置结果状态。

```python
# 成功完成
execution.finish_execution(success=True)

# 失败完成
execution.finish_execution(success=False, error_message="执行失败")
```

##### 3. cancel_execution(reason=None)
取消执行。

```python
execution.cancel_execution("用户取消")
```

##### 4. update_progress(completed_tasks=None, failed_tasks=None, skipped_tasks=None)
更新执行进度。

```python
execution.total_tasks = 10
execution.update_progress(completed_tasks=5, failed_tasks=1, skipped_tasks=1)
# 自动计算 progress = 70%
```

##### 5. get_host_names()
获取目标主机名称列表。

```python
host_names = execution.get_host_names()
# 返回主机名称列表
```

##### 6. get_execution_summary()
获取执行摘要信息。

```python
summary = execution.get_execution_summary()
# 返回：
# {
#     'total_hosts': 3,
#     'total_tasks': 10,
#     'completed_tasks': 8,
#     'failed_tasks': 1,
#     'skipped_tasks': 1,
#     'success_rate': 80.0,
#     'duration': 120,  # 秒
#     'status': 'success',
#     'progress': 100
# }
```

##### 7. 状态检查方法

```python
# 检查是否正在运行
if execution.is_running():
    print("正在执行中")

# 检查是否已完成
if execution.is_finished():
    print("执行已完成")

# 检查是否可以取消
if execution.can_be_cancelled():
    execution.cancel_execution("用户取消")
```

##### 8. to_dict(include_output=True, include_hosts=False)
转换为字典格式。

```python
# 基本信息（不包含输出）
basic_info = execution.to_dict(include_output=False)

# 包含主机名称
full_info = execution.to_dict(include_hosts=True)
```

## 使用示例

### 1. 创建和管理 Playbook

```python
from app.models.ansible import AnsiblePlaybook

# 创建 Playbook
playbook = AnsiblePlaybook(
    tenant_id=1,
    name="Web服务器配置",
    description="配置Nginx Web服务器",
    content="""
---
- name: Configure Web Server
  hosts: web_servers
  vars:
    nginx_port: "{{ port | default(80) }}"
  tasks:
    - name: Install Nginx
      package:
        name: nginx
        state: present
    
    - name: Start Nginx
      service:
        name: nginx
        state: started
        enabled: yes
""",
    variables={
        "port": 80,
        "server_name": "example.com"
    },
    version="1.0",
    tags=["web", "nginx"],
    category="web_server",
    created_by=1
)

# 验证 YAML 格式
is_valid, message = playbook.validate_yaml_content()
if not is_valid:
    print(f"YAML格式错误: {message}")

# 获取需要的变量
required_vars = playbook.get_required_variables()
print(f"需要的变量: {required_vars}")

# 保存到数据库
db.session.add(playbook)
db.session.commit()
```

### 2. 版本管理

```python
# 创建版本副本（在更新前）
version_copy = playbook.create_version_copy()
db.session.add(version_copy)

# 更新 Playbook 内容
playbook.content = "新的YAML内容"
playbook.increment_version()  # 版本从 1.0 变为 1.1

db.session.commit()
```

### 3. 执行记录管理

```python
from app.models.ansible import PlaybookExecution

# 创建执行记录
execution = PlaybookExecution(
    tenant_id=1,
    playbook_id=playbook.id,
    host_ids=[1, 2, 3],  # 目标主机ID
    variables={
        "port": 8080,
        "server_name": "test.example.com"
    },
    total_tasks=5,
    created_by=1
)

# 开始执行
execution.start_execution()
db.session.commit()

# 更新进度
execution.update_progress(completed_tasks=2)
db.session.commit()

# 完成执行
execution.finish_execution(success=True)
execution.output = "执行成功的输出日志"
db.session.commit()

# 获取执行摘要
summary = execution.get_execution_summary()
print(f"执行摘要: {summary}")
```

### 4. 查询和统计

```python
# 查询租户的所有 Playbook
playbooks = AnsiblePlaybook.query_by_tenant(tenant_id=1).all()

# 查询活跃的 Playbook
active_playbooks = AnsiblePlaybook.query_by_tenant(tenant_id=1).filter_by(is_active=True).all()

# 查询特定分类的 Playbook
web_playbooks = AnsiblePlaybook.query_by_tenant(tenant_id=1).filter_by(category='web_server').all()

# 查询执行记录
executions = PlaybookExecution.query_by_tenant(tenant_id=1).filter_by(playbook_id=playbook.id).all()

# 查询正在运行的执行
running_executions = PlaybookExecution.query_by_tenant(tenant_id=1).filter_by(status='running').all()

# 获取 Playbook 的执行统计
stats = playbook.get_execution_stats()
print(f"成功率: {stats['success_rate']}%")
```

## 数据库迁移

新增字段的迁移文件已创建：`migrations/versions/002_enhance_ansible_models.py`

运行迁移：
```bash
flask db upgrade
```

## 测试

完整的测试套件位于 `tests/test_ansible_models.py`，包括：

- Playbook 创建和验证
- YAML 内容验证
- 版本管理功能
- 执行记录管理
- 进度跟踪
- 状态管理
- 数据转换

运行测试：
```bash
python -m pytest tests/test_ansible_models.py -v
```

## 注意事项

1. **多租户支持**：所有模型都支持多租户数据隔离
2. **版本管理**：支持自动版本递增和历史版本保存
3. **YAML验证**：创建前应验证YAML格式
4. **执行跟踪**：支持实时进度更新和状态管理
5. **关系管理**：正确设置了与用户、租户的关联关系
6. **性能考虑**：大型输出内容应考虑分页或截断