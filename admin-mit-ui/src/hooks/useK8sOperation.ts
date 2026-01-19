/**
 * K8S操作Hook
 * 提供统一的加载状态管理和操作反馈
 */

import { useState, useCallback } from 'react'
import {
  handleK8sError,
  showSuccessMessage,
  showLoadingMessage,
  type HandleK8sErrorOptions,
} from '../utils/k8s'

/**
 * 操作选项
 */
export interface OperationOptions {
  /** 成功消息 */
  successMessage?: string
  /** 加载消息 */
  loadingMessage?: string
  /** 错误处理选项 */
  errorOptions?: HandleK8sErrorOptions
  /** 成功回调 */
  onSuccess?: () => void
  /** 错误回调 */
  onError?: (error: any) => void
  /** 完成回调（无论成功或失败） */
  onFinally?: () => void
}

/**
 * 操作结果
 */
export interface OperationResult<T> {
  /** 操作是否成功 */
  success: boolean
  /** 返回数据 */
  data?: T
  /** 错误信息 */
  error?: any
}

/**
 * useK8sOperation Hook返回值
 */
export interface UseK8sOperationReturn {
  /** 是否正在加载 */
  loading: boolean
  /** 错误信息 */
  error: any | null
  /** 执行操作 */
  execute: <T>(
    operation: () => Promise<T>,
    options?: OperationOptions
  ) => Promise<OperationResult<T>>
  /** 重置状态 */
  reset: () => void
}

/**
 * K8S操作Hook
 * 
 * 功能：
 * 1. 管理加载状态
 * 2. 显示加载消息
 * 3. 处理错误
 * 4. 显示成功/失败反馈
 * 
 * @example
 * ```tsx
 * const { loading, execute } = useK8sOperation()
 * 
 * const handleCreate = async () => {
 *   const result = await execute(
 *     () => clustersService.createCluster(data),
 *     {
 *       loadingMessage: '正在创建集群...',
 *       successMessage: '集群创建成功',
 *       onSuccess: () => {
 *         // 刷新列表
 *       }
 *     }
 *   )
 * }
 * ```
 */
export const useK8sOperation = (): UseK8sOperationReturn => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<any | null>(null)

  /**
   * 执行操作
   */
  const execute = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      options: OperationOptions = {}
    ): Promise<OperationResult<T>> => {
      const {
        successMessage,
        loadingMessage,
        errorOptions = {},
        onSuccess,
        onError,
        onFinally,
      } = options

      // 重置错误状态
      setError(null)
      setLoading(true)

      // 显示加载消息
      let hideLoading: (() => void) | undefined
      if (loadingMessage) {
        hideLoading = showLoadingMessage(loadingMessage)
      }

      try {
        // 执行操作
        const data = await operation()

        // 显示成功消息
        if (successMessage) {
          showSuccessMessage(successMessage)
        }

        // 执行成功回调
        if (onSuccess) {
          onSuccess()
        }

        return {
          success: true,
          data,
        }
      } catch (err) {
        // 处理错误
        const errorResponse = handleK8sError(err, errorOptions)
        setError(errorResponse)

        // 执行错误回调
        if (onError) {
          onError(err)
        }

        return {
          success: false,
          error: errorResponse,
        }
      } finally {
        // 隐藏加载消息
        if (hideLoading) {
          hideLoading()
        }

        setLoading(false)

        // 执行完成回调
        if (onFinally) {
          onFinally()
        }
      }
    },
    []
  )

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
  }, [])

  return {
    loading,
    error,
    execute,
    reset,
  }
}

/**
 * 批量操作Hook
 * 用于处理多个并发操作
 */
export interface UseBatchOperationReturn {
  /** 是否正在加载 */
  loading: boolean
  /** 错误列表 */
  errors: any[]
  /** 执行批量操作 */
  executeBatch: <T>(
    operations: Array<() => Promise<T>>,
    options?: OperationOptions
  ) => Promise<OperationResult<T>[]>
  /** 重置状态 */
  reset: () => void
}

/**
 * 批量操作Hook
 * 
 * @example
 * ```tsx
 * const { loading, executeBatch } = useBatchK8sOperation()
 * 
 * const handleBatchDelete = async () => {
 *   const operations = selectedIds.map(id => 
 *     () => clustersService.deleteCluster(id)
 *   )
 *   
 *   const results = await executeBatch(operations, {
 *     loadingMessage: '正在批量删除...',
 *     successMessage: '批量删除完成',
 *   })
 * }
 * ```
 */
export const useBatchK8sOperation = (): UseBatchOperationReturn => {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<any[]>([])

  /**
   * 执行批量操作
   */
  const executeBatch = useCallback(
    async <T,>(
      operations: Array<() => Promise<T>>,
      options: OperationOptions = {}
    ): Promise<OperationResult<T>[]> => {
      const {
        successMessage,
        loadingMessage,
        errorOptions = {},
        onSuccess,
        onError,
        onFinally,
      } = options

      // 重置错误状态
      setErrors([])
      setLoading(true)

      // 显示加载消息
      let hideLoading: (() => void) | undefined
      if (loadingMessage) {
        hideLoading = showLoadingMessage(loadingMessage)
      }

      try {
        // 执行所有操作
        const results = await Promise.allSettled(
          operations.map((op) => op())
        )

        // 处理结果
        const operationResults: OperationResult<T>[] = []
        const errorList: any[] = []

        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            operationResults.push({
              success: true,
              data: result.value,
            })
          } else {
            const errorResponse = handleK8sError(result.reason, {
              ...errorOptions,
              showNotification: false, // 批量操作不显示每个错误的通知
            })
            errorList.push(errorResponse)
            operationResults.push({
              success: false,
              error: errorResponse,
            })
          }
        })

        setErrors(errorList)

        // 显示结果消息
        const successCount = operationResults.filter((r) => r.success).length
        const failCount = errorList.length

        if (failCount === 0) {
          // 全部成功
          if (successMessage) {
            showSuccessMessage(successMessage)
          }
          if (onSuccess) {
            onSuccess()
          }
        } else if (successCount === 0) {
          // 全部失败
          handleK8sError(
            { message: `批量操作失败：${failCount}个操作失败` },
            errorOptions
          )
          if (onError) {
            onError(errorList)
          }
        } else {
          // 部分成功
          showSuccessMessage(
            `批量操作完成：${successCount}个成功，${failCount}个失败`
          )
        }

        return operationResults
      } catch (err) {
        // 处理整体错误
        const errorResponse = handleK8sError(err, errorOptions)
        setErrors([errorResponse])

        if (onError) {
          onError(err)
        }

        return []
      } finally {
        // 隐藏加载消息
        if (hideLoading) {
          hideLoading()
        }

        setLoading(false)

        // 执行完成回调
        if (onFinally) {
          onFinally()
        }
      }
    },
    []
  )

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setLoading(false)
    setErrors([])
  }, [])

  return {
    loading,
    errors,
    executeBatch,
    reset,
  }
}

/**
 * 轮询操作Hook
 * 用于需要定期刷新的数据
 */
export interface UsePollingOperationOptions {
  /** 轮询间隔（毫秒） */
  interval?: number
  /** 是否立即执行 */
  immediate?: boolean
  /** 是否在错误时停止轮询 */
  stopOnError?: boolean
}

export interface UsePollingOperationReturn<T> {
  /** 数据 */
  data: T | null
  /** 是否正在加载 */
  loading: boolean
  /** 错误信息 */
  error: any | null
  /** 开始轮询 */
  start: () => void
  /** 停止轮询 */
  stop: () => void
  /** 手动刷新 */
  refresh: () => Promise<void>
  /** 是否正在轮询 */
  isPolling: boolean
}

/**
 * 轮询操作Hook
 * 
 * @example
 * ```tsx
 * const { data, loading, start, stop } = usePollingK8sOperation(
 *   () => clustersService.getClusterStatus(clusterId),
 *   { interval: 30000 } // 每30秒刷新一次
 * )
 * 
 * useEffect(() => {
 *   start()
 *   return () => stop()
 * }, [])
 * ```
 */
export const usePollingK8sOperation = <T,>(
  operation: () => Promise<T>,
  options: UsePollingOperationOptions = {}
): UsePollingOperationReturn<T> => {
  const {
    interval = 30000,
    immediate = true,
    stopOnError = false,
  } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<any | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null)

  /**
   * 执行操作
   */
  const executeOperation = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await operation()
      setData(result)
    } catch (err) {
      const errorResponse = handleK8sError(err, {
        showNotification: false, // 轮询错误不显示通知
      })
      setError(errorResponse)

      if (stopOnError) {
        stop()
      }
    } finally {
      setLoading(false)
    }
  }, [operation, stopOnError])

  /**
   * 开始轮询
   */
  const start = useCallback(() => {
    if (isPolling) return

    setIsPolling(true)

    // 立即执行一次
    if (immediate) {
      executeOperation()
    }

    // 设置定时器
    const id = setInterval(executeOperation, interval)
    setTimerId(id)
  }, [isPolling, immediate, executeOperation, interval])

  /**
   * 停止轮询
   */
  const stop = useCallback(() => {
    if (timerId) {
      clearInterval(timerId)
      setTimerId(null)
    }
    setIsPolling(false)
  }, [timerId])

  /**
   * 手动刷新
   */
  const refresh = useCallback(async () => {
    await executeOperation()
  }, [executeOperation])

  return {
    data,
    loading,
    error,
    start,
    stop,
    refresh,
    isPolling,
  }
}
