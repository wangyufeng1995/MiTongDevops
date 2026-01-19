/**
 * 查询模板组件
 * 
 * 提供常用 PromQL 查询模板
 * 
 * Requirements: 2.9
 */
import React, { useState, useEffect, useCallback } from 'react'
import { 
  Search, 
  Play, 
  Cpu, 
  HardDrive, 
  Activity, 
  Wifi,
  Server,
  Database,
  RefreshCw,
  AlertCircle,
  Box
} from 'lucide-react'
import { datasourceService, QueryTemplate } from '../../../services/datasource'

interface QueryTemplatesProps {
  onLoad: (query: string) => void
  onClose: () => void
}

// 模板分类图标映射
const getCategoryIcon = (name: string) => {
  const lowerName = name.toLowerCase()
  if (lowerName.includes('cpu')) return <Cpu className="w-5 h-5" />
  if (lowerName.includes('内存') || lowerName.includes('memory')) return <Server className="w-5 h-5" />
  if (lowerName.includes('磁盘') || lowerName.includes('disk')) return <HardDrive className="w-5 h-5" />
  if (lowerName.includes('网络') || lowerName.includes('network')) return <Wifi className="w-5 h-5" />
  if (lowerName.includes('http') || lowerName.includes('请求')) return <Activity className="w-5 h-5" />
  if (lowerName.includes('容器') || lowerName.includes('container')) return <Box className="w-5 h-5" />
  return <Database className="w-5 h-5" />
}

// 默认模板（当 API 不可用时使用）
const DEFAULT_TEMPLATES: QueryTemplate[] = [
  {
    name: 'CPU 使用率',
    query: '100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
    description: '计算所有节点的 CPU 使用率百分比'
  },
  {
    name: '内存使用率',
    query: '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100',
    description: '计算内存使用率百分比'
  },
  {
    name: '磁盘使用率',
    query: '(1 - (node_filesystem_avail_bytes{fstype!="tmpfs"} / node_filesystem_size_bytes{fstype!="tmpfs"})) * 100',
    description: '计算磁盘使用率百分比'
  },
  {
    name: '网络接收速率',
    query: 'rate(node_network_receive_bytes_total[5m])',
    description: '计算网络接收速率 (bytes/s)'
  },
  {
    name: '网络发送速率',
    query: 'rate(node_network_transmit_bytes_total[5m])',
    description: '计算网络发送速率 (bytes/s)'
  },
  {
    name: 'HTTP 请求速率',
    query: 'sum(rate(http_requests_total[5m])) by (status_code)',
    description: '按状态码统计 HTTP 请求速率'
  },
  {
    name: '容器 CPU 使用率',
    query: 'sum(rate(container_cpu_usage_seconds_total[5m])) by (container_name) * 100',
    description: '计算容器 CPU 使用率'
  },
  {
    name: '容器内存使用',
    query: 'container_memory_usage_bytes / 1024 / 1024',
    description: '容器内存使用量 (MB)'
  },
  {
    name: '服务健康状态',
    query: 'up',
    description: '检查所有监控目标的健康状态'
  },
  {
    name: '系统负载',
    query: 'node_load1',
    description: '系统 1 分钟平均负载'
  }
]

export const QueryTemplates: React.FC<QueryTemplatesProps> = ({
  onLoad,
  onClose
}) => {
  const [templates, setTemplates] = useState<QueryTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // 加载模板
  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await datasourceService.getTemplates()
      setTemplates(data.length > 0 ? data : DEFAULT_TEMPLATES)
    } catch (err: any) {
      // 如果 API 失败，使用默认模板
      setTemplates(DEFAULT_TEMPLATES)
      setError(null) // 不显示错误，因为有默认模板
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // 过滤模板
  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.query.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="搜索模板..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 text-red-600 rounded-lg">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
          <button
            onClick={loadTemplates}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 加载状态 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <Database className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">没有匹配的模板</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
          {filteredTemplates.map((template, index) => (
            <div
              key={index}
              className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer group"
              onClick={() => onLoad(template.query)}
            >
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                  {getCategoryIcon(template.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">
                      {template.name}
                    </h4>
                    <Play className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {template.description}
                  </p>
                  <div className="mt-2 p-2 bg-gray-100 rounded font-mono text-xs text-gray-600 truncate group-hover:bg-white">
                    {template.query}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 底部按钮 */}
      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          关闭
        </button>
      </div>
    </div>
  )
}

export default QueryTemplates
