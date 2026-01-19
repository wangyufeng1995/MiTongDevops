/**
 * PromQL 查询编辑器组件
 * 
 * 支持即时查询和范围查询切换
 * 支持时间范围和步长配置
 * 
 * Requirements: 2.1, 2.2, 2.3
 */
import React, { useState, useEffect } from 'react'
import { Play, Save, Clock, Calendar, Settings } from 'lucide-react'

interface QueryEditorProps {
  configId: number
  initialQuery?: string
  onExecute: (query: string, queryType: 'instant' | 'range', options?: {
    time?: string
    start?: string
    end?: string
    step?: string
  }) => void
  onSave: (name: string, description?: string) => void
  loading?: boolean
}

// 预设时间范围选项
const TIME_RANGES = [
  { label: '最近 5 分钟', value: 5 * 60 * 1000 },
  { label: '最近 15 分钟', value: 15 * 60 * 1000 },
  { label: '最近 30 分钟', value: 30 * 60 * 1000 },
  { label: '最近 1 小时', value: 60 * 60 * 1000 },
  { label: '最近 3 小时', value: 3 * 60 * 60 * 1000 },
  { label: '最近 6 小时', value: 6 * 60 * 60 * 1000 },
  { label: '最近 12 小时', value: 12 * 60 * 60 * 1000 },
  { label: '最近 24 小时', value: 24 * 60 * 60 * 1000 },
  { label: '最近 7 天', value: 7 * 24 * 60 * 60 * 1000 },
]

// 步长选项
const STEP_OPTIONS = [
  { label: '15 秒', value: '15s' },
  { label: '30 秒', value: '30s' },
  { label: '1 分钟', value: '1m' },
  { label: '5 分钟', value: '5m' },
  { label: '15 分钟', value: '15m' },
  { label: '30 分钟', value: '30m' },
  { label: '1 小时', value: '1h' },
]

export const QueryEditor: React.FC<QueryEditorProps> = ({
  configId,
  initialQuery = '',
  onExecute,
  onSave,
  loading = false
}) => {
  // 查询状态
  const [query, setQuery] = useState(initialQuery)
  const [queryType, setQueryType] = useState<'instant' | 'range'>('instant')
  
  // 时间范围状态
  const [timeRange, setTimeRange] = useState(TIME_RANGES[3].value) // 默认 1 小时
  const [step, setStep] = useState('15s')
  const [customTimeRange, setCustomTimeRange] = useState(false)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  
  // 保存查询状态
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDescription, setSaveDescription] = useState('')

  // 同步外部传入的查询
  useEffect(() => {
    if (initialQuery !== query) {
      setQuery(initialQuery)
    }
  }, [initialQuery])

  // 执行查询
  const handleExecute = () => {
    if (!query.trim()) return

    if (queryType === 'instant') {
      onExecute(query, 'instant')
    } else {
      let start: string
      let end: string

      if (customTimeRange && startTime && endTime) {
        start = new Date(startTime).toISOString()
        end = new Date(endTime).toISOString()
      } else {
        end = new Date().toISOString()
        start = new Date(Date.now() - timeRange).toISOString()
      }

      onExecute(query, 'range', { start, end, step })
    }
  }

  // 保存查询
  const handleSave = () => {
    if (!saveName.trim()) return
    onSave(saveName.trim(), saveDescription.trim() || undefined)
    setShowSaveDialog(false)
    setSaveName('')
    setSaveDescription('')
  }

  // 键盘快捷键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleExecute()
    }
  }

  return (
    <div className="p-5 space-y-4">
      {/* 查询类型切换 */}
      <div className="flex items-center space-x-4">
        <div className="flex bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl p-1 shadow-inner">
          <button
            onClick={() => setQueryType('instant')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
              queryType === 'instant'
                ? 'bg-white text-blue-600 shadow-md scale-105'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            ⚡ 即时查询
          </button>
          <button
            onClick={() => setQueryType('range')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
              queryType === 'range'
                ? 'bg-white text-indigo-600 shadow-md scale-105'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            📊 范围查询
          </button>
        </div>

        {/* 范围查询时间配置 */}
        {queryType === 'range' && (
          <div className="flex items-center space-x-3 flex-wrap">
            <div className="flex items-center space-x-2 bg-white rounded-xl px-3 py-2 border-2 border-gray-200 shadow-sm">
              <Clock className="w-4 h-4 text-blue-600" />
              {!customTimeRange ? (
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(Number(e.target.value))}
                  className="text-sm font-medium text-gray-700 bg-transparent border-none focus:ring-0 cursor-pointer"
                >
                  {TIME_RANGES.map((range) => (
                    <option key={range.value} value={range.value}>
                      {range.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center space-x-2">
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="text-sm font-medium border-none bg-transparent focus:ring-0 text-gray-700"
                  />
                  <span className="text-gray-400 font-bold">→</span>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="text-sm font-medium border-none bg-transparent focus:ring-0 text-gray-700"
                  />
                </div>
              )}
              <button
                onClick={() => setCustomTimeRange(!customTimeRange)}
                className={`p-1.5 rounded-lg transition-all duration-200 ${
                  customTimeRange 
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                }`}
                title={customTimeRange ? '使用预设时间' : '自定义时间'}
              >
                <Calendar className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center space-x-2 bg-white rounded-xl px-3 py-2 border-2 border-gray-200 shadow-sm">
              <Settings className="w-4 h-4 text-indigo-600" />
              <select
                value={step}
                onChange={(e) => setStep(e.target.value)}
                className="text-sm font-medium text-gray-700 bg-transparent border-none focus:ring-0 cursor-pointer"
              >
                {STEP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    步长: {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 查询编辑器 */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入 PromQL 查询语句，例如：up{job=&quot;prometheus&quot;} 或 rate(http_requests_total[5m])"
          className="relative w-full h-36 px-4 py-3 font-mono text-sm bg-gradient-to-br from-gray-50 to-blue-50/30 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-400 focus:bg-white resize-none transition-all duration-200 shadow-sm hover:shadow-md"
          style={{ 
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'
          }}
        />
        <div className="absolute bottom-3 right-3 flex items-center space-x-2">
          <span className="inline-flex items-center px-2 py-1 bg-white/90 backdrop-blur-sm text-xs text-gray-500 rounded-lg shadow-sm border border-gray-200">
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-semibold">Ctrl</kbd>
            <span className="mx-1">+</span>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-semibold">Enter</kbd>
          </span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${queryType === 'instant' ? 'bg-blue-500' : 'bg-indigo-500'} animate-pulse`}></div>
          <div className="text-sm text-gray-600 font-medium">
            {queryType === 'instant' 
              ? '即时查询返回当前时间点的数据' 
              : '范围查询返回指定时间范围内的时间序列数据'
            }
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowSaveDialog(true)}
            disabled={!query.trim()}
            className="group flex items-center space-x-2 px-4 py-2.5 text-gray-700 hover:text-blue-600 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
          >
            <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="font-medium">保存查询</span>
          </button>
          <button
            onClick={handleExecute}
            disabled={loading || !query.trim()}
            className="group flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <Play className={`w-4 h-4 ${loading ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'}`} />
            <span className="font-semibold">{loading ? '执行中...' : '执行查询'}</span>
          </button>
        </div>
      </div>

      {/* 保存查询对话框 */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[480px] animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 mb-5">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                <Save className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">保存查询</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  查询名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="输入查询名称"
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  描述（可选）
                </label>
                <textarea
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder="输入查询描述"
                  rows={3}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-400 resize-none transition-all"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-5 py-2.5 border-2 border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QueryEditor
