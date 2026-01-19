# 钉钉告警渠道配置示例

## 1. 创建钉钉机器人

1. 打开钉钉群设置 -> 智能群助手 -> 添加机器人
2. 选择"自定义"机器人
3. 设置机器人名称（如：运维告警机器人）
4. 选择安全设置方式（推荐使用"加签"）
5. 复制 Webhook 地址和签名密钥

## 2. API 创建告警渠道示例

### 请求示例

```bash
curl -X POST "http://localhost:5000/api/monitor/channels" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_token>" \
  -d '{
    "name": "运维告警钉钉群",
    "type": "dingtalk",
    "description": "用于接收系统运维告警通知",
    "status": 1,
    "config": {
      "webhook_url": "https://oapi.dingtalk.com/robot/send?access_token=a963966f39724a314ee629986484de85ecbef388adbb0323404d36ac1bd7b2c2",
      "secret": "SEC862da1b77d52d3a30155f66eca2897bc636b2c7220d2de5c204b1f03751453cc",
      "security_type": "signature",
      "name": "运维告警机器人",
      "at_mobiles": ["13800138000"],
      "at_all": false,
      "message_template": "### {{severity_emoji}} {{title}}\n\n**告警规则:** {{rule_name}}\n\n**主机名称:** {{host_name}}\n\n**监控指标:** {{metric_type}}\n\n**当前值:** {{current_value}}{{unit}}\n\n**阈值:** {{condition}} {{threshold_value}}{{unit}}\n\n**严重级别:** {{severity}}\n\n**触发时间:** {{triggered_at}}\n\n---\n\n**告警描述:** {{message}}\n\n---\n*发送时间: {{send_time}}*\n*此消息由 MiTong运维平台 自动发送*"
    }
  }'
```

### 响应示例

```json
{
  "success": true,
  "message": "告警渠道创建成功",
  "data": {
    "id": 1,
    "name": "运维告警钉钉群",
    "type": "dingtalk",
    "description": "用于接收系统运维告警通知",
    "status": 1,
    "config": {
      "webhook_url": "https://oapi.dingtalk.com/robot/send?access_token=xxx",
      "secret": "******",
      "security_type": "signature",
      "name": "运维告警机器人",
      "at_mobiles": ["13800138000"],
      "at_all": false
    },
    "created_at": "2026-01-09T10:00:00",
    "updated_at": "2026-01-09T10:00:00"
  }
}
```

## 3. 配置字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| webhook_url | string | 是 | 钉钉机器人 Webhook 地址 |
| secret | string | 条件必填 | 签名密钥（security_type 为 signature 时必填） |
| security_type | string | 否 | 安全类型：none/keyword/signature/ip，默认 signature |
| name | string | 否 | 机器人名称 |
| keywords | array | 条件必填 | 关键词列表（security_type 为 keyword 时必填） |
| at_mobiles | array | 否 | @指定成员的手机号列表 |
| at_all | boolean | 否 | 是否@所有人，默认 false |
| message_template | string | 否 | 自定义告警消息模板 |
| timeout | number | 否 | 请求超时时间（秒），默认 10 |

## 4. 告警模板变量

在自定义模板中可以使用以下变量：

| 变量 | 说明 |
|------|------|
| `{{title}}` | 告警标题 |
| `{{rule_name}}` | 告警规则名称 |
| `{{host_name}}` | 主机名称 |
| `{{metric_type}}` | 监控指标类型（CPU使用率/内存使用率/磁盘使用率/系统负载） |
| `{{current_value}}` | 当前监控值 |
| `{{threshold_value}}` | 阈值 |
| `{{unit}}` | 单位（%或空） |
| `{{condition}}` | 条件操作符（>、<、>=、<=、==） |
| `{{severity}}` | 严重级别（信息/警告/严重） |
| `{{severity_emoji}}` | 严重级别表情（🔵/🟡/🔴） |
| `{{triggered_at}}` | 触发时间 |
| `{{send_time}}` | 发送时间 |
| `{{message}}` | 告警描述信息 |

## 5. 默认告警模板

```markdown
### {{severity_emoji}} {{title}}

**告警规则:** {{rule_name}}

**主机名称:** {{host_name}}

**监控指标:** {{metric_type}}

**当前值:** {{current_value}}{{unit}}

**阈值:** {{condition}} {{threshold_value}}{{unit}}

**严重级别:** {{severity}}

**触发时间:** {{triggered_at}}

---

**告警描述:** {{message}}

---
*发送时间: {{send_time}}*
*此消息由 MiTong运维平台 自动发送*
```

## 6. 测试告警渠道

```bash
curl -X POST "http://localhost:5000/api/monitor/channels/1/test" \
  -H "Authorization: Bearer <your_token>"
```

## 7. 安全设置类型说明

### 加签（推荐）
- 最安全的方式
- 需要配置 `secret` 字段
- 系统会自动计算签名并添加到请求中

### 自定义关键词
- 消息内容必须包含至少一个配置的关键词
- 需要配置 `keywords` 数组
- 建议在模板中包含关键词

### IP地址（段）
- 需要在钉钉后台配置服务器IP白名单
- 适合固定IP的服务器环境

### 无
- 不推荐，安全性最低
- 仅用于测试环境

## 8. Python 代码示例

```python
from app.services.dingtalk_notification_service import dingtalk_notification_service
from app.models.monitor import AlertChannel

# 创建渠道配置
channel = AlertChannel(
    name="运维告警钉钉群",
    type="dingtalk",
    config={
        "webhook_url": "https://oapi.dingtalk.com/robot/send?access_token=xxx",
        "secret": "SECxxx",
        "security_type": "signature",
        "message_template": "### {{severity_emoji}} 自定义告警\n\n{{message}}"
    },
    status=1
)

# 发送测试消息
success, message = dingtalk_notification_service.send_test_notification(channel)
print(f"发送结果: {success}, 消息: {message}")
```
