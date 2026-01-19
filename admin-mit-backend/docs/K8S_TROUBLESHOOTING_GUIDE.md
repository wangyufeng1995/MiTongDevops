# K8S运维管理系统故障排查指南

## 概述

本文档提供K8S运维管理系统常见问题的排查方法和解决方案。

---

## 1. 集群连接问题

### 1.1 连接超时

**症状：** 添加集群或测试连接时提示"连接超时"

**排查步骤：**

1. **检查网络连通性**
   ```bash
   # 从后端服务器测试到K8S API Server的连接
   curl -k https://k8s.example.com:6443/version
   ```

2. **检查防火墙规则**
   - 确认后端服务器到K8S API Server的6443端口已开放
   - 检查安全组/网络策略配置

3. **检查DNS解析**
   ```bash
   nslookup k8s.example.com
   ```

4. **增加超时时间**
   - 在配置文件中调整K8S连接超时参数

### 1.2 认证失败

**症状：** 提示"K8S集群认证失败"或"Token无效"

**排查步骤：**

1. **验证Token有效性**
   ```bash
   # 使用Token直接调用K8S API
   curl -k -H "Authorization: Bearer <token>" \
     https://k8s.example.com:6443/api/v1/namespaces
   ```

2. **检查Token是否过期**
   - ServiceAccount Token通常有有效期
   - 检查Token创建时间和过期时间

3. **验证ServiceAccount权限**
   ```bash
   kubectl auth can-i --list --as=system:serviceaccount:<namespace>:<sa-name>
   ```

4. **检查Kubeconfig格式**
   - 确保YAML格式正确
   - 验证证书和密钥配置

### 1.3 权限不足

**症状：** 提示"权限不足"或"Forbidden"

**排查步骤：**

1. **检查RBAC配置**
   ```bash
   # 查看ClusterRole绑定
   kubectl get clusterrolebindings | grep <sa-name>
   
   # 查看Role绑定
   kubectl get rolebindings -A | grep <sa-name>
   ```

2. **创建必要的RBAC权限**
   ```yaml
   apiVersion: rbac.authorization.k8s.io/v1
   kind: ClusterRole
   metadata:
     name: k8s-admin-role
   rules:
   - apiGroups: ["*"]
     resources: ["*"]
     verbs: ["*"]
   ---
   apiVersion: rbac.authorization.k8s.io/v1
   kind: ClusterRoleBinding
   metadata:
     name: k8s-admin-binding
   subjects:
   - kind: ServiceAccount
     name: k8s-admin
     namespace: kube-system
   roleRef:
     kind: ClusterRole
     name: k8s-admin-role
     apiGroup: rbac.authorization.k8s.io
   ```

---

## 2. 资源操作问题

### 2.1 扩缩容失败

**症状：** 扩缩容操作返回错误

**排查步骤：**

1. **检查集群资源**
   ```bash
   kubectl describe nodes
   kubectl top nodes
   ```

2. **检查资源配额**
   ```bash
   kubectl describe resourcequota -n <namespace>
   ```

3. **查看K8S事件**
   ```bash
   kubectl get events -n <namespace> --sort-by='.lastTimestamp'
   ```

4. **检查Pod调度问题**
   ```bash
   kubectl describe pod <pod-name> -n <namespace>
   ```

### 2.2 重启失败

**症状：** 工作负载重启操作失败

**排查步骤：**

1. **检查Deployment状态**
   ```bash
   kubectl rollout status deployment/<name> -n <namespace>
   ```

2. **查看滚动更新历史**
   ```bash
   kubectl rollout history deployment/<name> -n <namespace>
   ```

3. **检查Pod启动日志**
   ```bash
   kubectl logs <pod-name> -n <namespace> --previous
   ```

### 2.3 配置删除失败

**症状：** 删除ConfigMap/Secret时提示"正在使用"

**排查步骤：**

1. **查找引用该配置的工作负载**
   ```bash
   # 查找使用ConfigMap的Deployment
   kubectl get deployments -A -o json | jq '.items[] | select(.spec.template.spec.volumes[]?.configMap.name == "<configmap-name>") | .metadata.name'
   
   # 查找使用Secret的Deployment
   kubectl get deployments -A -o json | jq '.items[] | select(.spec.template.spec.volumes[]?.secret.secretName == "<secret-name>") | .metadata.name'
   ```

2. **修改工作负载配置后再删除**

---

## 3. 前端页面问题

### 3.1 页面加载缓慢

**排查步骤：**

1. **检查后端API响应时间**
   - 使用浏览器开发者工具查看Network面板
   - 关注API请求的响应时间

2. **检查集群连接状态**
   - 离线集群会导致API调用超时

3. **优化分页参数**
   - 减少每页显示数量
   - 使用搜索功能缩小范围

### 3.2 数据不更新

**排查步骤：**

1. **手动刷新页面**
   - 点击刷新按钮或F5刷新

2. **检查浏览器缓存**
   - 清除浏览器缓存后重试

3. **检查WebSocket连接**（如果使用实时更新）
   - 查看浏览器控制台是否有WebSocket错误

---

## 4. 权限控制问题

### 4.1 普通用户无法查看资源

**排查步骤：**

1. **检查用户角色**
   - 确认用户已分配正确的角色

2. **检查租户配置**
   - 确认用户属于正确的租户
   - 确认集群属于该租户

### 4.2 管理员无法执行操作

**排查步骤：**

1. **检查角色权限**
   - 确认用户角色为"运维管理员"或"超级管理员"

2. **检查Session状态**
   - 尝试重新登录

3. **检查后端日志**
   ```bash
   tail -f logs/app.log | grep "Authorization failed"
   ```

---

## 5. 日志和监控

### 5.1 查看后端日志

```bash
# 查看应用日志
tail -f admin-mit-backend/logs/app.log

# 查看K8S操作日志
grep "K8S operation" admin-mit-backend/logs/app.log

# 查看错误日志
grep "ERROR" admin-mit-backend/logs/app.log
```

### 5.2 查看审计日志

1. 通过API查询：
   ```bash
   curl -H "Authorization: Bearer <token>" \
     "http://localhost:5000/api/k8s/audit/operations?status=failed"
   ```

2. 通过前端页面：
   - 进入"K8S管理" > "操作日志"
   - 筛选失败的操作

### 5.3 数据库查询

```sql
-- 查看最近的K8S操作
SELECT * FROM k8s_operations 
ORDER BY created_at DESC 
LIMIT 20;

-- 查看失败的操作
SELECT * FROM k8s_operations 
WHERE status = 'failed' 
ORDER BY created_at DESC;

-- 查看集群状态
SELECT id, name, status, last_connected_at 
FROM k8s_clusters;
```

---

## 6. 常见错误码

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| CONNECTION_ERROR | 无法连接到K8S集群 | 检查网络和API地址 |
| AUTHENTICATION_ERROR | 认证失败 | 检查Token/Kubeconfig |
| PERMISSION_DENIED | 权限不足 | 检查RBAC配置 |
| RESOURCE_NOT_FOUND | 资源不存在 | 确认资源名称和命名空间 |
| VALIDATION_ERROR | 参数验证失败 | 检查请求参数格式 |
| CONFLICT_ERROR | 操作冲突 | 稍后重试 |
| TIMEOUT_ERROR | 操作超时 | 检查集群负载 |

---

## 7. 联系支持

如果以上方法无法解决问题，请收集以下信息后联系技术支持：

1. 错误截图或错误信息
2. 后端日志（最近100行）
3. 浏览器控制台日志
4. 操作步骤描述
5. 集群版本信息
