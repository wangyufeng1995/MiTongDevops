/**
 * AI助手服务
 */
import { api } from './api'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  model?: string
}

export interface ChatRequest {
  message: string
  model_config_id?: number
  conversation_history?: ChatMessage[]
}

export interface ChatResponse {
  code: number
  message: string
  data: {
    response: string
    model: string
    tokens_used?: number
  }
}

class AIAssistantService {
  /**
   * 发送聊天消息
   */
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const response = await api.post<ChatResponse>('/api/ai-assistant/chat', request)
    return response as any
  }

  /**
   * 获取对话历史
   */
  async getHistory(limit: number = 50): Promise<any> {
    const response = await api.get(`/api/ai-assistant/history?limit=${limit}`)
    return response as any
  }

  /**
   * 清除对话历史
   */
  async clearHistory(): Promise<any> {
    const response = await api.delete('/api/ai-assistant/history')
    return response as any
  }
}

export const aiAssistantService = new AIAssistantService()
