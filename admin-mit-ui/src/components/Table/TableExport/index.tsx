import React, { useState } from 'react'
import { Download, FileText, FileSpreadsheet } from 'lucide-react'
import { clsx } from 'clsx'

export interface ExportColumn {
  key: string
  title: string
  dataIndex?: string
  render?: (value: any, record: any) => string
}

export interface ExportOptions {
  filename?: string
  format: 'csv' | 'excel' | 'json'
  columns?: ExportColumn[]
  includeHeaders?: boolean
  dateFormat?: string
}

export interface TableExportProps {
  data: any[]
  columns: ExportColumn[]
  filename?: string
  onExport?: (data: any[], options: ExportOptions) => void
  className?: string
}

export const TableExport: React.FC<TableExportProps> = ({
  data,
  columns,
  filename = 'export',
  onExport,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    filename,
    format: 'csv',
    columns,
    includeHeaders: true,
    dateFormat: 'YYYY-MM-DD HH:mm:ss'
  })

  // 处理导出
  const handleExport = (format: 'csv' | 'excel' | 'json') => {
    const options = { ...exportOptions, format }
    
    if (onExport) {
      onExport(data, options)
    } else {
      // 默认导出逻辑
      switch (format) {
        case 'csv':
          exportToCSV(data, options)
          break
        case 'excel':
          exportToExcel(data, options)
          break
        case 'json':
          exportToJSON(data, options)
          break
      }
    }
    
    setIsOpen(false)
  }

  // 导出为 CSV
  const exportToCSV = (data: any[], options: ExportOptions) => {
    const { columns: exportColumns, includeHeaders, filename } = options
    const cols = exportColumns || columns

    let csvContent = ''

    // 添加表头
    if (includeHeaders) {
      const headers = cols.map(col => `"${col.title}"`).join(',')
      csvContent += headers + '\n'
    }

    // 添加数据行
    data.forEach(record => {
      const row = cols.map(col => {
        let value = col.dataIndex ? record[col.dataIndex] : record[col.key]
        
        if (col.render) {
          value = col.render(value, record)
        }
        
        // 处理特殊字符
        if (typeof value === 'string') {
          value = value.replace(/"/g, '""') // 转义双引号
        }
        
        return `"${value || ''}"`
      }).join(',')
      
      csvContent += row + '\n'
    })

    // 下载文件
    downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;')
  }

  // 导出为 Excel (简单的 CSV 格式，可以被 Excel 打开)
  const exportToExcel = (data: any[], options: ExportOptions) => {
    // 这里可以集成 xlsx 库来生成真正的 Excel 文件
    // 目前使用 CSV 格式作为简单实现
    exportToCSV(data, { ...options, filename: `${options.filename}.xlsx` })
  }

  // 导出为 JSON
  const exportToJSON = (data: any[], options: ExportOptions) => {
    const { columns: exportColumns, filename } = options
    const cols = exportColumns || columns

    const exportData = data.map(record => {
      const item: any = {}
      cols.forEach(col => {
        let value = col.dataIndex ? record[col.dataIndex] : record[col.key]
        
        if (col.render) {
          value = col.render(value, record)
        }
        
        item[col.key] = value
      })
      return item
    })

    const jsonContent = JSON.stringify(exportData, null, 2)
    downloadFile(jsonContent, `${filename}.json`, 'application/json;charset=utf-8;')
  }

  // 下载文件
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob(['\ufeff' + content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
  }

  // 格式化数据大小
  const formatDataSize = () => {
    const jsonSize = JSON.stringify(data).length
    if (jsonSize < 1024) return `${jsonSize} B`
    if (jsonSize < 1024 * 1024) return `${(jsonSize / 1024).toFixed(1)} KB`
    return `${(jsonSize / (1024 * 1024)).toFixed(1)} MB`
  }

  const exportFormats = [
    {
      key: 'csv',
      label: 'CSV 文件',
      description: '逗号分隔值，适合 Excel 打开',
      icon: <FileText className="w-4 h-4" />,
      extension: '.csv'
    },
    {
      key: 'excel',
      label: 'Excel 文件',
      description: 'Microsoft Excel 格式',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      extension: '.xlsx'
    },
    {
      key: 'json',
      label: 'JSON 文件',
      description: '结构化数据格式',
      icon: <FileText className="w-4 h-4" />,
      extension: '.json'
    }
  ]

  return (
    <div className={clsx('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
      >
        <Download className="w-4 h-4" />
        <span>导出</span>
      </button>

      {isOpen && (
        <>
          {/* 遮罩层 */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* 导出选项面板 */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div className="p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">导出数据</h3>
              
              {/* 数据信息 */}
              <div className="mb-4 p-3 bg-gray-50 rounded-md">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>数据行数:</span>
                  <span>{data.length} 行</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>数据列数:</span>
                  <span>{columns.length} 列</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>数据大小:</span>
                  <span>{formatDataSize()}</span>
                </div>
              </div>

              {/* 文件名设置 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  文件名
                </label>
                <input
                  type="text"
                  value={exportOptions.filename}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, filename: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入文件名"
                />
              </div>

              {/* 导出选项 */}
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeHeaders}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeHeaders: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">包含表头</span>
                </label>
              </div>

              {/* 导出格式 */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">选择格式</h4>
                {exportFormats.map(format => (
                  <button
                    key={format.key}
                    onClick={() => handleExport(format.key as any)}
                    className="w-full flex items-center p-3 text-left border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex-shrink-0 mr-3 text-gray-400">
                      {format.icon}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {format.label}
                      </div>
                      <div className="text-xs text-gray-500">
                        {format.description}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {format.extension}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default TableExport