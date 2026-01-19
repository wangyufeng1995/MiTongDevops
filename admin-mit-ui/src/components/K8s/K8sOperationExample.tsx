/**
 * K8S操作示例组件
 * 演示如何使用useK8sOperation Hook进行错误处理和加载状态管理
 * 
 * 这个文件作为参考示例，展示了如何在K8S页面中使用新的错误处理和加载状态功能
 */

import React, { useState } from 'react'
import { Button, Card, Space, Spin } from 'antd'
import { useK8sOperation, useBatchK8sOperation, usePollingK8sOperation } from '../../hooks/useK8sOperation'
import { clustersService } from '../../services/k8s/clusters'
import { confirmDangerousOperation } from '../../utils/k8s'
import type { CreateClusterRequest } from '../../types/k8s'

/**
 * 示例1: 基本操作 - 创建集群
 */
export const CreateClusterExample: React.FC = () => {
  const { loading, execute } = useK8sOperation()
  const [formData] = useState<CreateClusterRequest>({
    name: 'test-cluster',
    api_server: 'https://k8s.example.com:6443',
    auth_type: 'token',
    token: 'test-token',
  })

  const handleCreate = async () => {
    const result = await execute(
      () => clustersService.createCluster(formData),
      {
        loadingMessage: '正在创建集群...',
        successMessage: '集群创建成功',
        onSuccess: () => {
          console.log('集群创建成功，可以在这里刷新列表')
        },
        onError: (error) => {
          console.error('集群创建失败:', error)
        },
      }
    )

    if (result.success) {
      console.log('创建的集群:', result.data)
    }
  }

  return (
    <Card title="示例1: 创建集群">
      <Space>
        <Button type="primary" onClick={handleCreate} loading={loading}>
          创建集群
        </Button>
        {loading && <Spin />}
      </Space>
    </Card>
  )
}

/**
 * 示例2: 危险操作 - 删除集群（带确认）
 */
export const DeleteClusterExample: React.FC = () => {
  const { loading, execute } = useK8sOperation()
  const clusterId = 1

  const handleDelete = () => {
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
              console.log('集群删除成功，刷新列表')
            },
          }
        )
      }
    )
  }

  return (
    <Card title="示例2: 删除集群（带确认）">
      <Button danger onClick={handleDelete} loading={loading}>
        删除集群
      </Button>
    </Card>
  )
}

/**
 * 示例3: 批量操作 - 批量删除集群
 */
export const BatchDeleteExample: React.FC = () => {
  const { loading, executeBatch } = useBatchK8sOperation()
  const selectedIds = [1, 2, 3]

  const handleBatchDelete = async () => {
    confirmDangerousOperation(
      '批量删除',
      `确定要删除选中的 ${selectedIds.length} 个集群吗？`,
      async () => {
        const operations = selectedIds.map(
          (id) => () => clustersService.deleteCluster(id)
        )

        const results = await executeBatch(operations, {
          loadingMessage: '正在批量删除集群...',
          successMessage: '批量删除完成',
          onSuccess: () => {
            console.log('批量删除成功，刷新列表')
          },
        })

        console.log('批量操作结果:', results)
      }
    )
  }

  return (
    <Card title="示例3: 批量删除集群">
      <Button danger onClick={handleBatchDelete} loading={loading}>
        批量删除 ({selectedIds.length})
      </Button>
    </Card>
  )
}

/**
 * 示例4: 轮询操作 - 自动刷新集群状态
 */
export const PollingStatusExample: React.FC = () => {
  const clusterId = 1
  const { data, loading, isPolling, start, stop, refresh } = usePollingK8sOperation(
    () => clustersService.getClusterStatus(clusterId),
    {
      interval: 30000, // 每30秒刷新一次
      immediate: true, // 立即执行第一次
      stopOnError: false, // 错误时不停止轮询
    }
  )

  return (
    <Card title="示例4: 自动刷新集群状态">
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Space>
          <Button onClick={start} disabled={isPolling}>
            开始轮询
          </Button>
          <Button onClick={stop} disabled={!isPolling}>
            停止轮询
          </Button>
          <Button onClick={refresh} loading={loading}>
            手动刷新
          </Button>
        </Space>

        {loading && <Spin />}

        {data && (
          <div>
            <p>集群状态: {data.status}</p>
            <p>节点数量: {data.node_count}</p>
            <p>命名空间数量: {data.namespace_count}</p>
            <p>Pod数量: {data.pod_count}</p>
          </div>
        )}

        <p>轮询状态: {isPolling ? '运行中' : '已停止'}</p>
      </Space>
    </Card>
  )
}

/**
 * 示例5: 自定义错误处理
 */
export const CustomErrorHandlingExample: React.FC = () => {
  const { loading, execute } = useK8sOperation()

  const handleOperation = async () => {
    await execute(
      () => clustersService.getCluster(999), // 不存在的集群ID
      {
        loadingMessage: '正在加载集群...',
        errorOptions: {
          showNotification: true,
          customTitle: '自定义错误标题',
          customMessage: '这是一个自定义的错误消息',
          duration: 10, // 错误通知显示10秒
          onError: (error) => {
            console.log('自定义错误处理:', error)
            // 可以在这里执行特定的错误处理逻辑
            if (error.error_code === 'RESOURCE_NOT_FOUND') {
              console.log('资源不存在，执行特定处理')
            }
          },
        },
      }
    )
  }

  return (
    <Card title="示例5: 自定义错误处理">
      <Button onClick={handleOperation} loading={loading}>
        触发错误（资源不存在）
      </Button>
    </Card>
  )
}

/**
 * 完整示例页面
 */
export const K8sOperationExamples: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <h1>K8S操作示例</h1>
      <p>以下示例展示了如何使用新的错误处理和加载状态管理功能</p>

      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <CreateClusterExample />
        <DeleteClusterExample />
        <BatchDeleteExample />
        <PollingStatusExample />
        <CustomErrorHandlingExample />
      </Space>

      <Card title="使用说明" style={{ marginTop: '24px' }}>
        <h3>1. 基本操作</h3>
        <pre>{`
const { loading, execute } = useK8sOperation()

const handleCreate = async () => {
  const result = await execute(
    () => clustersService.createCluster(data),
    {
      loadingMessage: '正在创建...',
      successMessage: '创建成功',
      onSuccess: () => {
        // 刷新列表
      }
    }
  )
}
        `}</pre>

        <h3>2. 批量操作</h3>
        <pre>{`
const { loading, executeBatch } = useBatchK8sOperation()

const handleBatchDelete = async () => {
  const operations = ids.map(id => () => service.delete(id))
  const results = await executeBatch(operations, {
    loadingMessage: '正在批量删除...',
    successMessage: '批量删除完成',
  })
}
        `}</pre>

        <h3>3. 轮询操作</h3>
        <pre>{`
const { data, start, stop } = usePollingK8sOperation(
  () => service.getStatus(id),
  { interval: 30000 }
)

useEffect(() => {
  start()
  return () => stop()
}, [])
        `}</pre>
      </Card>
    </div>
  )
}
