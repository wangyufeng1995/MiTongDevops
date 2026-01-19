/**
 * AI助手页面
 */
import React, { useState, useEffect, useRef } from 'react'
import { Sparkles, MessageSquare, Send, Trash2, Settings, Loader2 } from 'lucide-react'
import { useNotification } from '../../hooks/useNotification'
import { aiAssistantService, ChatMessage } from '../../services/aiAssistant'
import { aiModelConfigService, AIModelConfig } from '../../services/aiModelConfig'

export const Assistant: React.FC = () => {
  const [inputMessage, setInputMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [configs, setConfigs] = useState<AIModelConfig[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<number | undefined>()
  const [loadingConfigs, setLoadingConfigs] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const notification = useNotification()

  // 加载模型配置列表
  useEffect(() => {
    loadConfigs()
  }, [])

  // 自动滚动到底部
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadConfigs = async () => {
    try {
      setLoadingConfigs(true)
      const response = await aiModelConfigService.getConfigs(true) // 只获取启用的配置
      if (response.code === 200 || response.success) {
        const configList = Array.isArray(response.data) ? response.data : []
        setConfigs(configList)
        // 不自动选择模型，让用户手动选择
      }
    } catch (error: any) {
      notification.error('加载模型配置失败')
    } finally {
      setLoadingConfigs(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) {
      notification.warning('请输入消息内容')
      return
    }

    if (!selectedConfigId) {
      notification.warning('请先选择AI模型')
      return
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setLoading(true)

    try {
      const response = await aiAssistantService.sendMessage({
        message: userMessage.content,
        model_config_id: selectedConfigId,
        conversation_history: messages
      })

      if (response.code === 200 || response.success) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.data.response,
          timestamp: new Date(),
          model: response.data.model
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        notification.error(response.message || '发送失败')
      }
    } catch (error: any) {
      notification.error(error.response?.data?.message || error.message || '发送失败')
      
      // 添加错误消息
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '抱歉，我遇到了一些问题。请稍后再试。',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleClearHistory = async () => {
    const confirmed = await notification.confirm(
      '清除对话',
      '确定要清除所有对话记录吗？此操作无法撤销。',
      true
    )
    
    if (confirmed) {
      setMessages([])
      notification.success('对话已清除')
    }
  }

  const getModelDisplayName = (configId: number) => {
    const config = configs.find(c => c.id === configId)
    return config?.name || '未知模型'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页面头部 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">AI助手</h1>
                <p className="text-gray-500 mt-1">智能运维助手，让运维更简单</p>
              </div>
            </div>

            {/* 模型选择 */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-gray-600" />
                <select
                  value={selectedConfigId || ''}
                  onChange={(e) => setSelectedConfigId(Number(e.target.value))}
                  disabled={loadingConfigs || configs.length === 0}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  {loadingConfigs ? (
                    <option>加载中...</option>
                  ) : configs.length === 0 ? (
                    <option>暂无可用模型</option>
                  ) : (
                    <>
                      <option value="">选择AI模型</option>
                      {configs.map(config => (
                        <option key={config.id} value={config.id}>
                          {config.name} {config.is_default ? '(默认)' : ''}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
              
              {messages.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>清除对话</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 对话区域 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">AI对话助手</h2>
              {selectedConfigId && (
                <span className="text-sm text-blue-100">
                  当前模型: {getModelDisplayName(selectedConfigId)}
                </span>
              )}
            </div>
          </div>
          
          <div className="p-6">
            {/* 消息列表 */}
            <div className="h-[500px] bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">开始对话</h3>
                  <p className="text-gray-500 text-sm max-w-md">
                    {configs.length === 0 
                      ? '请先在"AI模型配置"页面创建模型配置'
                      : selectedConfigId 
                        ? '输入你的问题，AI助手将为你提供专业的运维建议'
                        : '请先选择一个AI模型'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-900'
                        }`}
                      >
                        <div className="flex items-start space-x-2">
                          {message.role === 'assistant' && (
                            <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                            <p className={`text-xs mt-2 ${
                              message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                            }`}>
                              {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="max-w-[70%] rounded-lg px-4 py-3 bg-white border border-gray-200">
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                          <span className="text-sm text-gray-600">AI正在思考...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* 输入区域 */}
            <div className="flex space-x-3">
              <textarea
                placeholder={
                  configs.length === 0 
                    ? '请先创建AI模型配置...'
                    : !selectedConfigId 
                      ? '请先选择AI模型...'
                      : '输入你的问题... (Shift+Enter换行，Enter发送)'
                }
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading || !selectedConfigId || configs.length === 0}
                rows={3}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button 
                onClick={handleSendMessage}
                disabled={loading || !selectedConfigId || !inputMessage.trim() || configs.length === 0}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>发送中</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>发送</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 提示信息 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-1">使用提示</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• 选择合适的AI模型以获得最佳回答效果</li>
                <li>• 可以在"AI模型配置"页面管理和切换不同的模型</li>
                <li>• 支持多轮对话，AI会记住上下文</li>
                <li>• 按 Shift+Enter 可以换行，Enter 直接发送</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Assistant
