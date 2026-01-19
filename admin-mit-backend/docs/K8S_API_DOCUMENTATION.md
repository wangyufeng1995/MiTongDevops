# K8S运维管理系统 API文档

## 概述

本文档描述K8S运维管理系统的REST API接口。所有API都需要认证，使用JWT Token进行身份验证。

## 认证

所有API请求需要在Header中携带：
```
Authorization: Bearer <access_token>
Cookie: session_id=<session_id>
```

## 通用响应格式

### 成功响应
```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

### 错误响应
```json
{
  "success": false,
  "error_code": "ERROR_CODE",
  "message": "错误描述",
  "details": "详细错误信息",
  "suggestions": ["建议1", "建议2"]
}
```

## 错误码说明

| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| CONNECTION_ERROR | 503 | 集群连接失败 |
| AUTHENTICATION_ERROR | 401 | 认证失败 |
| PERMISSION_DENIED | 403 | 权限不足 |
| RESOURCE_NOT_FOUND | 404 | 资源不存在 |
| VALIDATION_ERROR | 400 | 参数验证失败 |
| CONFLICT_ERROR | 409 | 操作冲突 |
| TIMEOUT_ERROR | 504 | 操作超时 |

---

## 集群管理 API

### 获取集群列表

**GET** `/api/k8s/clusters`

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | int | 否 | 页码，默认1 |
| per_page | int | 否 | 每页数量，默认20 |
| search | string | 否 | 搜索关键词 |

**响应：**
```json
{
  "success": true,
  "data": {
    "clusters": [
      {
        "id": 1,
        "name": "production-cluster",
        "api_server": "https://k8s.example.com:6443",
        "auth_type": "token",
        "status": "online",
        "node_count": 3,
        "pod_count": 50,
        "namespace_count": 10,
        "version": "v1.28.0",
        "description": "生产环境集群",
        "created_at": "2024-01-01T00:00:00Z",
        "last_connected_at": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

### 创建集群

**POST** `/api/k8s/clusters`

**权限：** 超级管理员、运维管理员

**请求体：**
```json
{
  "name": "production-cluster",
  "api_server": "https://k8s.example.com:6443",
  "auth_type": "token",
  "token": "eyJhbGciOiJSUzI1NiIs...",
  "description": "生产环境集群"
}
```

或使用Kubeconfig：
```json
{
  "name": "production-cluster",
  "api_server": "https://k8s.example.com:6443",
  "auth_type": "kubeconfig",
  "kubeconfig": "apiVersion: v1\nkind: Config\n...",
  "description": "生产环境集群"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "cluster": {
      "id": 1,
      "name": "production-cluster",
      "api_server": "https://k8s.example.com:6443",
      "status": "online"
    }
  },
  "message": "集群创建成功"
}
```

### 更新集群

**POST** `/api/k8s/clusters/update`

**权限：** 超级管理员、运维管理员

**请求体：**
```json
{
  "id": 1,
  "name": "production-cluster-updated",
  "description": "更新后的描述"
}
```

### 删除集群

**POST** `/api/k8s/clusters/delete`

**权限：** 超级管理员、运维管理员

**请求体：**
```json
{
  "id": 1
}
```

### 测试集群连接

**POST** `/api/k8s/clusters/test`

**请求体：**
```json
{
  "id": 1
}
```

或测试新配置：
```json
{
  "api_server": "https://k8s.example.com:6443",
  "auth_type": "token",
  "token": "eyJhbGciOiJSUzI1NiIs..."
}
```

### 获取集群状态

**GET** `/api/k8s/clusters/status`

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | int | 是 | 集群ID |

---

## 命名空间 API

### 获取命名空间列表

**GET** `/api/k8s/namespaces`

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cluster_id | int | 是 | 集群ID |
| search | string | 否 | 搜索关键词 |
| page | int | 否 | 页码 |
| per_page | int | 否 | 每页数量 |

**响应：**
```json
{
  "success": true,
  "data": {
    "namespaces": [
      {
        "name": "default",
        "status": "Active",
        "resource_quota": null,
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": { ... }
  }
}
```

### 创建命名空间

**POST** `/api/k8s/namespaces`

**权限：** 超级管理员、运维管理员

**请求体：**
```json
{
  "cluster_id": 1,
  "name": "my-namespace"
}
```

### 删除命名空间

**POST** `/api/k8s/namespaces/delete`

**权限：** 超级管理员、运维管理员

**请求体：**
```json
{
  "cluster_id": 1,
  "namespace": "my-namespace"
}
```

---

## 工作负载 API

### 获取工作负载列表

**GET** `/api/k8s/workloads`

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cluster_id | int | 是 | 集群ID |
| namespace | string | 是 | 命名空间 |
| type | string | 否 | 类型：deployment/statefulset/daemonset |
| page | int | 否 | 页码 |
| per_page | int | 否 | 每页数量 |

### 获取工作负载详情

**GET** `/api/k8s/workloads/detail`

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cluster_id | int | 是 | 集群ID |
| namespace | string | 是 | 命名空间 |
| type | string | 是 | 工作负载类型 |
| name | string | 是 | 工作负载名称 |

### 扩缩容工作负载

**POST** `/api/k8s/workloads/scale`

**权限：** 超级管理员、运维管理员

**请求体：**
```json
{
  "cluster_id": 1,
  "namespace": "default",
  "type": "deployment",
  "name": "nginx-deployment",
  "replicas": 5
}
```

### 重启工作负载

**POST** `/api/k8s/workloads/restart`

**权限：** 超级管理员、运维管理员

**请求体：**
```json
{
  "cluster_id": 1,
  "namespace": "default",
  "type": "deployment",
  "name": "nginx-deployment"
}
```

### 获取Pod日志

**GET** `/api/k8s/pods/logs`

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cluster_id | int | 是 | 集群ID |
| namespace | string | 是 | 命名空间 |
| pod_name | string | 是 | Pod名称 |
| container | string | 否 | 容器名称 |
| tail_lines | int | 否 | 返回行数，默认100 |

---

## 服务发现 API

### 获取Service列表

**GET** `/api/k8s/services`

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cluster_id | int | 是 | 集群ID |
| namespace | string | 是 | 命名空间 |
| type | string | 否 | 服务类型：ClusterIP/NodePort/LoadBalancer |

### 获取Ingress列表

**GET** `/api/k8s/ingresses`

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cluster_id | int | 是 | 集群ID |
| namespace | string | 是 | 命名空间 |

### 获取Service Endpoints

**GET** `/api/k8s/services/endpoints`

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cluster_id | int | 是 | 集群ID |
| namespace | string | 是 | 命名空间 |
| name | string | 是 | Service名称 |

---

## 配置管理 API

### 获取ConfigMap列表

**GET** `/api/k8s/configmaps`

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cluster_id | int | 是 | 集群ID |
| namespace | string | 是 | 命名空间 |

### 获取Secret列表

**GET** `/api/k8s/secrets`

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cluster_id | int | 是 | 集群ID |
| namespace | string | 是 | 命名空间 |

### 创建ConfigMap

**POST** `/api/k8s/configmaps`

**权限：** 超级管理员、运维管理员

**请求体：**
```json
{
  "cluster_id": 1,
  "namespace": "default",
  "name": "app-config",
  "data": {
    "key1": "value1",
    "key2": "value2"
  }
}
```

### 创建Secret

**POST** `/api/k8s/secrets`

**权限：** 超级管理员、运维管理员

**请求体：**
```json
{
  "cluster_id": 1,
  "namespace": "default",
  "name": "app-secret",
  "data": {
    "username": "admin",
    "password": "secret123"
  }
}
```

### 删除ConfigMap

**POST** `/api/k8s/configmaps/delete`

**权限：** 超级管理员、运维管理员

### 删除Secret

**POST** `/api/k8s/secrets/delete`

**权限：** 超级管理员、运维管理员

---

## 存储管理 API

### 获取PV列表

**GET** `/api/k8s/persistent-volumes`

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cluster_id | int | 是 | 集群ID |
| status | string | 否 | 状态筛选：Available/Bound/Released |

### 获取PVC列表

**GET** `/api/k8s/persistent-volume-claims`

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cluster_id | int | 是 | 集群ID |
| namespace | string | 是 | 命名空间 |

### 获取StorageClass列表

**GET** `/api/k8s/storage-classes`

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cluster_id | int | 是 | 集群ID |

---

## 审计日志 API

### 获取操作日志

**GET** `/api/k8s/audit/operations`

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cluster_id | int | 否 | 集群ID筛选 |
| operation_type | string | 否 | 操作类型筛选 |
| resource_type | string | 否 | 资源类型筛选 |
| status | string | 否 | 状态筛选：success/failed |
| page | int | 否 | 页码 |
| per_page | int | 否 | 每页数量 |

**响应：**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 1,
        "cluster_id": 1,
        "operation_type": "scale",
        "resource_type": "deployment",
        "resource_name": "nginx-deployment",
        "namespace": "default",
        "status": "success",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": { ... }
  }
}
```
