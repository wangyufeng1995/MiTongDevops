import React, { useState, useMemo } from 'react'
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Download
} from 'lucide-react'
import { clsx } from 'clsx'

export interface Column<T = any> {
  key: string
  title: string
  dataIndex?: string
  width?: number | string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  filterable?: boolean
  render?: (value: any, record: T, index: number) => React.ReactNode
  sorter?: (a: T, b: T) => number
  filters?: { text: string; value: any }[]
  fixed?: 'left' | 'right'
  ellipsis?: boolean
}

export interface PaginationConfig {
  current: number
  pageSize: number
  total: number
  showSizeChanger?: boolean
  showQuickJumper?: boolean
  showTotal?: boolean
  pageSizeOptions?: number[]
  onChange?: (page: number, pageSize: number) => void
}

export interface DataTableProps<T = any> {
  columns: Column<T>[]
  dataSource?: T[]
  loading?: boolean
  pagination?: PaginationConfig | false
  rowKey?: string | ((record: T) => string)
  rowSelection?: {
    type?: 'checkbox' | 'radio'
    selectedRowKeys?: (string | number)[]
    onChange?: (selectedRowKeys: (string | number)[], selectedRows: T[]) => void
    getCheckboxProps?: (record: T) => { disabled?: boolean }
  }
  scroll?: { x?: number | string; y?: number | string }
  size?: 'small' | 'middle' | 'large'
  bordered?: boolean
  showHeader?: boolean
  title?: () => React.ReactNode
  footer?: () => React.ReactNode
  expandable?: {
    expandedRowRender?: (record: T, index: number) => React.ReactNode
    expandRowByClick?: boolean
    expandedRowKeys?: (string | number)[]
    onExpand?: (expanded: boolean, record: T) => void
  }
  onRow?: (record: T, index: number) => React.HTMLAttributes<HTMLTableRowElement>
  className?: string
  emptyText?: React.ReactNode
  exportable?: boolean
  onExport?: () => void
}

export function DataTable<T = any>({
  columns,
  dataSource,
  loading = false,
  pagination,
  rowKey = 'id',
  rowSelection,
  scroll,
  size = 'middle',
  bordered = false,
  showHeader = true,
  title,
  footer,
  expandable,
  onRow,
  className,
  emptyText = '暂无数据',
  exportable = false,
  onExport
}: DataTableProps<T>) {
  // Ensure dataSource is always an array
  const safeDataSource = dataSource || []
  
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  } | null>(null)
  const [filterConfig, setFilterConfig] = useState<Record<string, any[]>>({})
  const [expandedKeys, setExpandedKeys] = useState<(string | number)[]>(
    expandable?.expandedRowKeys || []
  )

  // 获取行键
  const getRowKey = (record: T, index: number): string => {
    if (typeof rowKey === 'function') {
      return rowKey(record)
    }
    return (record as any)[rowKey] || index.toString()
  }

  // 处理排序
  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return

    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig?.key === column.key) {
      direction = sortConfig.direction === 'asc' ? 'desc' : 'asc'
    }

    setSortConfig({ key: column.key, direction })
  }

  // 处理筛选
  const handleFilter = (column: Column<T>, values: any[]) => {
    setFilterConfig(prev => ({
      ...prev,
      [column.key]: values
    }))
  }

  // 处理展开
  const handleExpand = (record: T) => {
    const key = getRowKey(record, 0)
    const newExpandedKeys = expandedKeys.includes(key)
      ? expandedKeys.filter(k => k !== key)
      : [...expandedKeys, key]
    
    setExpandedKeys(newExpandedKeys)
    expandable?.onExpand?.(!expandedKeys.includes(key), record)
  }

  // 处理行选择
  const handleRowSelect = (record: T, selected: boolean) => {
    if (!rowSelection) return

    const key = getRowKey(record, 0)
    const selectedKeys = rowSelection.selectedRowKeys || []
    
    let newSelectedKeys: (string | number)[]
    if (rowSelection.type === 'radio') {
      newSelectedKeys = selected ? [key] : []
    } else {
      newSelectedKeys = selected
        ? [...selectedKeys, key]
        : selectedKeys.filter(k => k !== key)
    }

    const selectedRows = safeDataSource.filter(item => 
      newSelectedKeys.includes(getRowKey(item, 0))
    )

    rowSelection.onChange?.(newSelectedKeys, selectedRows)
  }

  // 处理全选
  const handleSelectAll = (selected: boolean) => {
    if (!rowSelection) return

    const allKeys = safeDataSource.map((item, index) => getRowKey(item, index))
    const newSelectedKeys = selected ? allKeys : []
    const selectedRows = selected ? safeDataSource : []

    rowSelection.onChange?.(newSelectedKeys, selectedRows)
  }

  // 排序和筛选数据
  const processedData = useMemo(() => {
    let result = [...safeDataSource]

    // 应用筛选
    Object.entries(filterConfig).forEach(([key, values]) => {
      if (values.length === 0) return
      
      const column = columns.find(col => col.key === key)
      if (!column) return

      result = result.filter(record => {
        const value = column.dataIndex 
          ? (record as any)[column.dataIndex]
          : (record as any)[key]
        return values.includes(value)
      })
    })

    // 应用排序
    if (sortConfig) {
      const column = columns.find(col => col.key === sortConfig.key)
      if (column) {
        result.sort((a, b) => {
          if (column.sorter) {
            return sortConfig.direction === 'asc' 
              ? column.sorter(a, b)
              : column.sorter(b, a)
          }

          const aValue = column.dataIndex 
            ? (a as any)[column.dataIndex]
            : (a as any)[sortConfig.key]
          const bValue = column.dataIndex 
            ? (b as any)[column.dataIndex]
            : (b as any)[sortConfig.key]

          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
          return 0
        })
      }
    }

    return result
  }, [safeDataSource, sortConfig, filterConfig, columns])

  // 分页数据
  const paginatedData = useMemo(() => {
    if (!pagination) return processedData

    const start = (pagination.current - 1) * pagination.pageSize
    const end = start + pagination.pageSize
    return processedData.slice(start, end)
  }, [processedData, pagination])

  // 表格尺寸样式
  const sizeClasses = {
    small: 'text-xs',
    middle: 'text-sm',
    large: 'text-base'
  }

  const cellPadding = {
    small: 'px-2 py-1',
    middle: 'px-3 py-2',
    large: 'px-4 py-3'
  }

  // 渲染表头
  const renderHeader = () => {
    if (!showHeader) return null

    return (
      <thead className="bg-gray-50 dark:bg-gray-800">
        <tr>
          {/* 展开列 */}
          {expandable && (
            <th className={clsx('w-12', cellPadding[size], bordered && 'border-r border-gray-200')}>
              {/* 空白表头 */}
            </th>
          )}

          {/* 选择列 */}
          {rowSelection && (
            <th className={clsx('w-12', cellPadding[size], bordered && 'border-r border-gray-200')}>
              {rowSelection.type !== 'radio' && (
                <input
                  type="checkbox"
                  checked={
                    safeDataSource.length > 0 &&
                    safeDataSource.every((item, index) =>
                      rowSelection.selectedRowKeys?.includes(getRowKey(item, index))
                    )
                  }
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              )}
            </th>
          )}

          {/* 数据列 */}
          {columns.map((column) => (
            <th
              key={column.key}
              className={clsx(
                cellPadding[size],
                'font-medium text-gray-900 dark:text-white text-left',
                column.align === 'center' && 'text-center',
                column.align === 'right' && 'text-right',
                bordered && 'border-r border-gray-200 last:border-r-0',
                column.sortable && 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
              style={{ width: column.width }}
              onClick={() => handleSort(column)}
            >
              <div className={clsx(
                'flex items-center space-x-1',
                column.align === 'center' && 'justify-center',
                column.align === 'right' && 'justify-end'
              )}>
                <span>{column.title}</span>
                {column.sortable && (
                  <div className="flex flex-col">
                    {sortConfig?.key === column.key ? (
                      sortConfig.direction === 'asc' ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )
                    ) : (
                      <ChevronsUpDown className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                )}
              </div>
            </th>
          ))}
        </tr>
      </thead>
    )
  }

  // 渲染表体
  const renderBody = () => {
    if (loading) {
      return (
        <tbody>
          <tr>
            <td
              colSpan={columns.length + (expandable ? 1 : 0) + (rowSelection ? 1 : 0)}
              className={clsx('text-center text-gray-500', cellPadding[size])}
            >
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>加载中...</span>
              </div>
            </td>
          </tr>
        </tbody>
      )
    }

    if (paginatedData.length === 0) {
      return (
        <tbody>
          <tr>
            <td
              colSpan={columns.length + (expandable ? 1 : 0) + (rowSelection ? 1 : 0)}
              className={clsx('text-center text-gray-500', cellPadding[size])}
            >
              {emptyText}
            </td>
          </tr>
        </tbody>
      )
    }

    return (
      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
        {paginatedData.map((record, index) => {
          const key = getRowKey(record, index)
          const isExpanded = expandedKeys.includes(key)
          const isSelected = rowSelection?.selectedRowKeys?.includes(key) || false
          const rowProps = onRow?.(record, index) || {}

          return (
            <React.Fragment key={key}>
              <tr
                {...rowProps}
                className={clsx(
                  'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
                  isSelected && 'bg-blue-50 dark:bg-blue-900/20',
                  rowProps.className
                )}
              >
                {/* 展开列 */}
                {expandable && (
                  <td className={clsx(cellPadding[size], bordered && 'border-r border-gray-200')}>
                    <button
                      onClick={() => handleExpand(record)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                )}

                {/* 选择列 */}
                {rowSelection && (
                  <td className={clsx(cellPadding[size], bordered && 'border-r border-gray-200')}>
                    <input
                      type={rowSelection.type || 'checkbox'}
                      checked={isSelected}
                      onChange={(e) => handleRowSelect(record, e.target.checked)}
                      disabled={rowSelection.getCheckboxProps?.(record)?.disabled}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                )}

                {/* 数据列 */}
                {columns.map((column) => {
                  const value = column.dataIndex 
                    ? (record as any)[column.dataIndex]
                    : (record as any)[column.key]

                  return (
                    <td
                      key={column.key}
                      className={clsx(
                        cellPadding[size],
                        'text-gray-900 dark:text-white',
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right',
                        bordered && 'border-r border-gray-200 last:border-r-0',
                        column.ellipsis && 'truncate max-w-0'
                      )}
                      style={{ width: column.width }}
                    >
                      {column.render ? column.render(value, record, index) : value}
                    </td>
                  )
                })}
              </tr>

              {/* 展开行 */}
              {expandable && isExpanded && expandable.expandedRowRender && (
                <tr>
                  <td
                    colSpan={columns.length + (rowSelection ? 1 : 0) + 1}
                    className={clsx('bg-gray-50 dark:bg-gray-800', cellPadding[size])}
                  >
                    {expandable.expandedRowRender(record, index)}
                  </td>
                </tr>
              )}
            </React.Fragment>
          )
        })}
      </tbody>
    )
  }

  // 渲染分页
  const renderPagination = () => {
    if (!pagination) return null

    const { current, pageSize, total, showSizeChanger, showQuickJumper, showTotal } = pagination
    const totalPages = Math.ceil(total / pageSize)

    return (
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          {showTotal && (
            <span className="text-sm text-gray-700 dark:text-gray-300">
              共 {total} 条记录
            </span>
          )}
          
          {showSizeChanger && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">每页</span>
              <select
                value={pageSize}
                onChange={(e) => pagination.onChange?.(1, parseInt(e.target.value))}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                {(pagination.pageSizeOptions || [10, 20, 50, 100]).map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <span className="text-sm text-gray-700 dark:text-gray-300">条</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => pagination.onChange?.(current - 1, pageSize)}
            disabled={current <= 1}
            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-sm text-gray-700 dark:text-gray-300">
            {current} / {totalPages}
          </span>

          <button
            onClick={() => pagination.onChange?.(current + 1, pageSize)}
            disabled={current >= totalPages}
            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {showQuickJumper && (
            <div className="flex items-center space-x-2 ml-4">
              <span className="text-sm text-gray-700 dark:text-gray-300">跳至</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const page = parseInt((e.target as HTMLInputElement).value)
                    if (page >= 1 && page <= totalPages) {
                      pagination.onChange?.(page, pageSize)
                    }
                  }
                }}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">页</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('bg-white dark:bg-gray-900 rounded-lg shadow', className)}>
      {/* 表格标题和操作 */}
      {(title || exportable) && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>{title?.()}</div>
          <div className="flex items-center space-x-2">
            {exportable && (
              <button
                onClick={onExport}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                <span>导出</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 表格 */}
      <div className="overflow-auto" style={scroll}>
        <table className={clsx(
          'w-full divide-y divide-gray-200 dark:divide-gray-700',
          sizeClasses[size],
          bordered && 'border border-gray-200 dark:border-gray-700'
        )} style={{ tableLayout: 'fixed' }}>
          {renderHeader()}
          {renderBody()}
        </table>
      </div>

      {/* 分页 */}
      {renderPagination()}

      {/* 表格底部 */}
      {footer && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          {footer()}
        </div>
      )}
    </div>
  )
}

export default DataTable