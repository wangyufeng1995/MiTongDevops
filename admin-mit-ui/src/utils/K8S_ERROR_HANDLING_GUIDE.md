# K8S错误处理和加载状态管理指南

本指南介绍如何在K8S运维管理系统中使用统一的错误处理和加载状态管理功能。

## 目录

1. [错误处理](#错误处理)
2. [加载状态管理](#加载状态管理)
3. [操作反馈](#操作反馈)
4. [最佳实践](#最佳实践)

## 错误处理

### 1. 统一错误处理函数

`handleK8sError` 函数提供统一的错误处理功能：

```typescript
import { handleK8sError } from '../utils/k8s'

try {
  const result = await clustersService.createCluster(data)
} catch (error) {
  handleK8sError(error, {
    showNotification: true,
    customTitle: '创建失败',
    duration: 5,
    onError: (errorResponse) => {
      console.log('错误代码:', errorResponse.error_code)
    }
  })
}
```

### 2. 错误类型

系统支持以下错误类型：

- `CONNECTION_ERROR`: 连接错误
- `AUTHENTICATION_ERROR`: 认证失败
- `PERMISSION_DENIED`: 权限不足
- `RESOURCE_NOT_FOUND`: 资源不存在
- `VALIDATION_ERROR`: 参数验证失败
- `CONFLICT_ERROR`: 操作冲突
- `TIMEOUT_ERROR`: 操作超时
- `INTERNAL_ERROR`: 服务器错误
- `NETWORK_ERROR`: 网络错误

### 3. 错误处理选项

```typescript
interface HandleK8sErrorOptions {
  showNotification?: boolean      // 是否显示通知（默认true）
  customTitle?: string            // 自定义错误标题
  customMessage?: string          // 自定义错误消息
  duration?: number               // 通知持续时间（秒）
  onError?: (error) => void       // 错误回调函数
}
```

### 4. 自动错误处理

所有K8S服务方法都已集成错误处理，会自动：
- 记录错误日志
- 显示错误通知
- 根据错误类型执行特定操作

## 加载状态管理

### 1. useK8sOperation Hook

用于单个操作的加载状态管理：

```typescript
import { useK8sOperation } from '../hooks/useK8sOperation'

const MyComponent = () => {
  const { loading, execute } = useK8sOperation()

  const handleCreate = async () => {
    const result = await execute(
      () => clustersService.createCluster(data),
      {
        loadingMessage: '正在创建集群...',
        successMessage: '集群创建成功',
        onSuccess: () => {
          // 刷新列表
          loadClusters()
        }
      }
    )

    if (result.success) {
      console.log('创建的集群:', result.data)
    }
  }

  return (
    <Button onClick={handleCreate} loading={loading}>
      创建集群
    </Button>
  )
}
```

### 2. useBatchK8sOperation Hook

用于批量操作：

```typescript
import { useBatchK8sOperation } from '../hooks/useK8sOperation'

const MyComponent = () => {
  const { loading, executeBatch } = useBatchK8sOperation()
  const selectedIds = [1, 2, 3]

  const handleBatchDelete = async () => {
    const operations = selectedIds.map(
      id => () => clustersService.deleteCluster(id)
    )

    const results = await executeBatch(operations, {
      loadingMessage: '正在批量删除...',
      successMessage: '批量删除完成',
    })

    // 处理结果
    const successCount = results.filter(r => r.success).length
    console.log(`成功: ${successCount}, 失败: ${results.length - successCount}`)
  }

  return (
    <Button onClick={handleBatchDelete} loading={loading}>
      批量删除
    </Button>
  )
}
```

### 3. usePollingK8sOperation Hook

用于需要定期刷新的数据：

```typescript
import { usePollingK8sOperation } from '../hooks/useK8sOperation'
import { useEffect } from 'react'

const MyComponent = () => {
  const { data, loading, isPolling, start, stop, refresh } = usePollingK8sOperation(
    () => clustersService.getClusterStatus(clusterId),
    {
      interval: 30000,      // 每30秒刷新一次
      immediate: true,      // 立即执行第一次
      stopOnError: false,   // 错误时不停止轮询
    }
  )

  useEffect(() => {
    start()
    return () => stop()
  }, [])

  return (
    <div>
      <Button onClick={refresh} loading={loading}>刷新</Button>
      {data && <div>状态: {data.status}</div>}
    </div>
  )
}
```

## 操作反馈

### 1. 消息提示

```typescript
import {
  showSuccessMessage,
  showErrorMessage,
  showWarningMessage,
  showInfoMessage,
  showLoadingMessage,
} from '../utils/k8s'

// 成功消息
showSuccessMessage('操作成功')

// 错误消息
showErrorMessage('操作失败')

// 警告消息
showWarningMessage('请注意')

// 信息消息
showInfoMessage('提示信息')

// 加载消息
const hide = showLoadingMessage('正在处理...')
// 操作完成后关闭
hide()
```

### 2. 通知提示

```typescript
import {
  showSuccessNotification,
  showErrorNotification,
  showWarningNotification,
  showInfoNotification,
} from '../utils/k8s'

// 成功通知
showSuccessNotification('操作成功', '集群创建成功')

// 错误通知
showErrorNotification('操作失败', '集群连接失败，请检查配置')

// 警告通知
showWarningNotification('警告', '集群资源使用率过高')

// 信息通知
showInfoNotification('提示', '集群状态已更新')
```

### 3. 确认对话框

```typescript
import { confirmOperation, confirmDangerousOperation } from '../utils/k8s'

// 普通确认
confirmOperation(
  '确认操作',
  '确定要执行此操作吗？',
  async () => {
    // 确认后执行的操作
    await doSomething()
  }
)

// 危险操作确认（红色按钮）
confirmDangerousOperation(
  '确认删除',
  '删除后无法恢复，确定要删除吗？',
  async () => {
    // 确认后执行删除
    await deleteCluster()
  }
)
```

## 最佳实践

### 1. 在组件中使用

```typescript
import React from 'react'
import { Button, Card } from 'antd'
import { useK8sOperation } from '../hooks/useK8sOperation'
import { confirmDangerousOperation } from '../utils/k8s'
import { clustersService } from '../services/k8s/clusters'

const ClusterManagement: React.FC = () => {
  const { loading, execute } = useK8sOperation()

  const handleCreate = async (data) => {
    const result = await execute(
      () => clustersService.createCluster(data),
      {
        loadingMessage: '正在创建集群...',
        successMessage: '集群创建成功',
        onSuccess: () => {
          // 刷新列表
          loadClusters()
        },
      }
    )
  }

  const handleDelete = (clusterId) => {
    confirmDangerousOperation(
      '确认删除',
      '删除集群后将无法恢复，确定要删除吗？',
      async () => {
        await execute(
          () => clustersService.deleteCluster(clusterId),
          {
            loadingMessage: '正在删除集群...',
            successMessage: '集群删除成功',
            onSuccess: () => {
              loadClusters()
            },
          }
        )
      }
    )
  }

  return (
    <Card>
      <Button onClick={handleCreate} loading={loading}>
        创建集群
      </Button>
      <Button onClick={() => handleDelete(1)} loading={loading} danger>
        删除集群
      </Button>
    </Card>
  )
}
```

### 2. 错误处理最佳实践

1. **总是使用 execute 包装异步操作**
   ```typescript
   // ✅ 好的做法
   await execute(() => service.create(data), options)
   
   // ❌ 不好的做法
   try {
     await service.create(data)
   } catch (error) {
     // 手动处理错误
   }
   ```

2. **为用户提供清晰的反馈**
   ```typescript
   await execute(
     () => service.create(data),
     {
       loadingMessage: '正在创建集群...',  // 告诉用户正在做什么
       successMessage: '集群创建成功',      // 告诉用户操作成功
     }
   )
   ```

3. **危险操作使用确认对话框**
   ```typescript
   confirmDangerousOperation(
     '确认删除',
     '删除后无法恢复，确定要删除吗？',
     async () => {
       await execute(() => service.delete(id), options)
     }
   )
   ```

4. **批量操作使用 executeBatch**
   ```typescript
   const operations = ids.map(id => () => service.delete(id))
   await executeBatch(operations, {
     loadingMessage: '正在批量删除...',
     successMessage: '批量删除完成',
   })
   ```

### 3. 加载状态最佳实践

1. **在按钮上显示加载状态**
   ```typescript
   <Button onClick={handleCreate} loading={loading}>
     创建
   </Button>
   ```

2. **在表格上显示加载状态**
   ```typescript
   <Table
     dataSource={data}
     loading={loading}
     columns={columns}
   />
   ```

3. **使用 Spin 组件显示加载动画**
   ```typescript
   {loading && <Spin tip="加载中..." />}
   ```

### 4. 轮询最佳实践

1. **组件卸载时停止轮询**
   ```typescript
   useEffect(() => {
     start()
     return () => stop()
   }, [])
   ```

2. **错误时不停止轮询**
   ```typescript
   const { data } = usePollingK8sOperation(
     () => service.getStatus(id),
     { stopOnError: false }  // 错误时继续轮询
   )
   ```

3. **提供手动刷新按钮**
   ```typescript
   <Button onClick={refresh} loading={loading}>
     刷新
   </Button>
   ```

## 工具函数

### 格式化函数

```typescript
import {
  formatResourceName,
  validateResourceName,
  formatStorageCapacity,
  formatCPU,
  formatMemory,
  formatTimestamp,
  getStatusColor,
  calculateUsagePercentage,
} from '../utils/k8s'

// 格式化资源名称
const name = formatResourceName('My Cluster')  // 'my-cluster'

// 验证资源名称
const isValid = validateResourceName('my-cluster')  // true

// 格式化存储容量
const capacity = formatStorageCapacity('10737418240')  // '10.00Gi'

// 格式化CPU
const cpu = formatCPU('500m')  // '500m'

// 格式化内存
const memory = formatMemory('512Mi')  // '512Mi'

// 格式化时间戳
const time = formatTimestamp('2024-01-01T00:00:00Z')  // '2024-01-01 00:00'

// 获取状态颜色
const color = getStatusColor('Running')  // 'success'

// 计算使用百分比
const percentage = calculateUsagePercentage('5Gi', '10Gi')  // 50
```

## 示例代码

完整的示例代码请参考：
- `src/components/K8s/K8sOperationExample.tsx` - 操作示例组件
- `src/pages/K8s/Clusters/index.tsx` - 集群管理页面
- `src/hooks/useK8sOperation.ts` - 操作Hook实现
- `src/utils/k8s.ts` - 工具函数实现

## 常见问题

### Q: 如何禁用错误通知？

A: 在 errorOptions 中设置 `showNotification: false`：

```typescript
await execute(
  () => service.get(id),
  {
    errorOptions: {
      showNotification: false,
    }
  }
)
```

### Q: 如何自定义错误消息？

A: 使用 customTitle 和 customMessage：

```typescript
await execute(
  () => service.get(id),
  {
    errorOptions: {
      customTitle: '自定义标题',
      customMessage: '自定义消息',
    }
  }
)
```

### Q: 如何处理特定的错误类型？

A: 使用 onError 回调：

```typescript
await execute(
  () => service.get(id),
  {
    errorOptions: {
      onError: (error) => {
        if (error.error_code === 'RESOURCE_NOT_FOUND') {
          // 处理资源不存在的情况
        }
      }
    }
  }
)
```

### Q: 批量操作如何知道哪些成功哪些失败？

A: 检查返回的结果数组：

```typescript
const results = await executeBatch(operations)
results.forEach((result, index) => {
  if (result.success) {
    console.log(`操作 ${index} 成功:`, result.data)
  } else {
    console.log(`操作 ${index} 失败:`, result.error)
  }
})
```

### Q: 如何在轮询时处理错误？

A: 设置 stopOnError 选项：

```typescript
const { data } = usePollingK8sOperation(
  () => service.getStatus(id),
  {
    stopOnError: false,  // 错误时继续轮询
  }
)
```

## 总结

使用本指南中的工具和最佳实践，可以：

1. ✅ 统一的错误处理
2. ✅ 一致的用户反馈
3. ✅ 简化的加载状态管理
4. ✅ 更好的用户体验
5. ✅ 更少的重复代码

记住：**始终使用 execute 包装异步操作，为用户提供清晰的反馈！**
