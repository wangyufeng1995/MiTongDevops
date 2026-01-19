/**
 * AI模型配置服务
 */
import { api } from './api'

export interface AIModelConfig {
  id?: number
  tenant_id?: number
  name: string
  description?: string
  api_key: string
  api_key_masked?: string
  api_endpoint?: string
  timeout?: number
  model_name: string
  temperature?: number
  max_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  system_prompt?: string
  is_active?: boolean
  is_default?: boolean
  created_at?: string
  updated_at?: string
}

export interface AIModelConfigListResponse {
  code: number
  message: string
  data: AIModelConfig[]
}

export interface AIModelConfigResponse {
  code: number
  message: string
  data: AIModelConfig
}

class AIModelConfigService {
  /**
   * 获取配置列表
   */
  async getConfigs(isActive?: boolean): Promise<AIModelConfigListResponse> {
    const params = isActive !== undefined ? { is_active: isActive } : {}
    const response = await api.get<AIModelConfigListResponse>('/api/ai-model-config', { params })
    // api.get 已经返回了完整的响应对象，不需要再访问 .data
    return response as any
  }

  /**
   * 获取单个配置（包含API密钥）
   */
  async getConfig(id: number): Promise<AIModelConfigResponse> {
    const response = await api.get<AIModelConfigResponse>(`/api/ai-model-config/${id}`)
    return response as any
  }

  /**
   * 创建配置
   */
  async createConfig(config: AIModelConfig): Promise<AIModelConfigResponse> {
    const response = await api.post<AIModelConfigResponse>('/api/ai-model-config', config)
    return response as any
  }

  /**
   * 更新配置
   */
  async updateConfig(id: number, config: Partial<AIModelConfig>): Promise<AIModelConfigResponse> {
    const response = await api.put<AIModelConfigResponse>(`/api/ai-model-config/${id}`, config)
    return response as any
  }

  /**
   * 删除配置 (使用 POST 方法)
   */
  async deleteConfig(id: number): Promise<{ code: number; message: string }> {
    const response = await api.post(`/api/ai-model-config/${id}/delete`)
    return response as any
  }

  /**
   * 设置为默认配置
   */
  async setDefault(id: number): Promise<AIModelConfigResponse> {
    const response = await api.post<AIModelConfigResponse>(`/api/ai-model-config/${id}/set-default`)
    return response as any
  }

  /**
   * 获取默认配置
   */
  async getDefaultConfig(): Promise<AIModelConfigResponse> {
    const response = await api.get<AIModelConfigResponse>('/api/ai-model-config/default')
    return response as any
  }
}

export const aiModelConfigService = new AIModelConfigService()
