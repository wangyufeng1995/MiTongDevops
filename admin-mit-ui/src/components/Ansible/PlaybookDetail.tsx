/**
 * Ansible Playbook 详情组件
 */
import React, { useState, useEffect } from 'react'
import { 
  FileText, 
  User, 
  Clock, 
  Tag, 
  Play, 
  Edit, 
  Copy, 
  Download, 
  Trash2,
  ArrowLeft 
} from 'lucide-react'
import { Loading } from '../Loading'
import { ansibleService } from '../../services/ansible'
import { AnsiblePlaybook } from '../../types/ansible'
import { formatDateTime } from '../../utils'

export interface PlaybookDetailProps {
  playbookId: number
  onEdit?: (playbook: AnsiblePlaybook) => void
  onExecute?: (playbook: AnsiblePlaybook) => void
  onCopy?: (playbook: AnsiblePlaybook) => void
  onDelete?: (playbook: AnsiblePlaybook) => void
  onExport?: (playbook: AnsiblePlaybook) => void
  onBack?: () => void
  className?: string
}

const PlaybookDetail: React.FC<PlaybookDetailProps> = ({
  playbookId,
  onEdit,
  onExecute,
  onCopy,
  onDelete,
  onExport,
  onBack,
  className = ''
}) => {
  const [playbook, setPlaybook] = useState<AnsiblePlaybook | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 加载 Playbook 详情
  useEffect(() => {
    const loadPlaybook = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await ansibleService.getPlaybook(playbookId)
        setPlaybook(data)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '加载 Playbook 详情失败'
        setError(errorMessage)
        console.error('Failed to load playbook:', err)
      } finally {
        setLoading(false)
      }
    }

    if (playbookId) {
      loadPlaybook()
    }
  }, [playbookId])

  // 格式化时间
  const formatTime = (timeString: string) => {
    return formatDateTime(timeString, 'YYYY/MM/DD HH:mm:ss')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-700">{error}</div>
      </div>
    )
  }

  if (!playbook) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-gray-700">Playbook 不存在</div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm ${className}`}>
      {/* 头部 */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {onBack && (
              <button
                onClick={onBack}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="flex items-center space-x-3">
              <FileText size={24} className="text-blue-500" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{playbook.name}</h1>
                {playbook.description && (
                  <p className="text-sm text-gray-600">{playbook.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center space-x-2">
            {onExecute && (
              <button
                onClick={() => onExecute(playbook)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <Play size={16} className="mr-2" />
                执行
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => onEdit(playbook)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Edit size={16} className="mr-2" />
                编辑
              </button>
            )}
            {onCopy && (
              <button
                onClick={() => onCopy(playbook)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Copy size={16} className="mr-2" />
                复制
              </button>
            )}
            {onExport && (
              <button
                onClick={() => onExport(playbook)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Download size={16} className="mr-2" />
                导出
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(playbook)}
                className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <Trash2 size={16} className="mr-2" />
                删除
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center space-x-2">
            <Tag size={16} className="text-gray-400" />
            <div>
              <div className="text-sm text-gray-500">版本</div>
              <div className="font-medium text-gray-900">{playbook.version}</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <User size={16} className="text-gray-400" />
            <div>
              <div className="text-sm text-gray-500">创建者</div>
              <div className="font-medium text-gray-900">
                {playbook.creator?.full_name || playbook.creator?.username || '未知'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Clock size={16} className="text-gray-400" />
            <div>
              <div className="text-sm text-gray-500">创建时间</div>
              <div className="font-medium text-gray-900">{formatTime(playbook.created_at)}</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Clock size={16} className="text-gray-400" />
            <div>
              <div className="text-sm text-gray-500">更新时间</div>
              <div className="font-medium text-gray-900">{formatTime(playbook.updated_at)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 执行统计 */}
      {(playbook.execution_count !== undefined || playbook.last_executed_at) && (
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-3">执行统计</h3>
          <div className="grid grid-cols-2 gap-4">
            {playbook.execution_count !== undefined && (
              <div>
                <div className="text-sm text-gray-500">执行次数</div>
                <div className="text-2xl font-bold text-blue-600">{playbook.execution_count}</div>
              </div>
            )}
            {playbook.last_executed_at && (
              <div>
                <div className="text-sm text-gray-500">最后执行时间</div>
                <div className="font-medium text-gray-900">{formatTime(playbook.last_executed_at)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 变量 */}
      {playbook.variables && Object.keys(playbook.variables).length > 0 && (
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-3">默认变量</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap">
              {JSON.stringify(playbook.variables, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Playbook 内容 */}
      <div className="px-6 py-4">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Playbook 内容</h3>
        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <pre className="text-sm text-gray-100 whitespace-pre-wrap">
            <code>{playbook.content}</code>
          </pre>
        </div>
      </div>
    </div>
  )
}

export default PlaybookDetail