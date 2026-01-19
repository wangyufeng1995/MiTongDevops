/**
 * Network Probe Group Types
 */
export interface NetworkProbeGroup {
  id: number
  tenant_id: number
  name: string
  description?: string
  is_default: boolean
  is_system: boolean
  color: string
  sort_order: number
  created_by: number
  created_at: string
  updated_at: string
  probe_count?: number // Number of probes in this group
}

export interface CreateNetworkProbeGroupRequest {
  name: string
  description?: string
  color?: string
  sort_order?: number
}

export interface UpdateNetworkProbeGroupRequest {
  name?: string
  description?: string
  color?: string
  sort_order?: number
}

/**
 * Network Probe Types
 */
export interface NetworkProbe {
  id: number
  tenant_id: number
  group_id: number
  name: string
  description?: string
  protocol: 'http' | 'https' | 'websocket' | 'tcp' | 'udp'
  target_url: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  timeout: number
  interval_seconds: number
  auto_probe_enabled: boolean
  enabled: boolean
  created_by: number
  created_at: string
  updated_at: string
  group?: NetworkProbeGroup
  // 最近探测状态字段
  last_probe_status?: 'success' | 'failed' | 'timeout' | 'running'
  last_response_time?: number
  last_probed_at?: string
}

export interface CreateNetworkProbeRequest {
  group_id?: number
  name: string
  description?: string
  protocol: 'http' | 'https' | 'websocket' | 'tcp' | 'udp'
  target_url: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  timeout?: number
  interval_seconds?: number
  auto_probe_enabled?: boolean
  enabled?: boolean
}

export interface UpdateNetworkProbeRequest {
  group_id?: number
  name?: string
  description?: string
  protocol?: 'http' | 'https' | 'websocket' | 'tcp' | 'udp'
  target_url?: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  timeout?: number
  interval_seconds?: number
  auto_probe_enabled?: boolean
  enabled?: boolean
}

/**
 * Network Probe Result Types
 */
export interface NetworkProbeResult {
  id: number
  tenant_id: number
  probe_id: number
  probe_type: 'manual' | 'auto'
  status: 'success' | 'failed' | 'timeout'
  response_time?: number
  status_code?: number
  response_body?: string
  error_message?: string
  probed_at: string
}

/**
 * Network Alert Rule Types
 */
export interface NetworkAlertRule {
  id: number
  tenant_id: number
  probe_id: number
  name: string
  condition_type: 'response_time' | 'status_code' | 'availability'
  condition_operator: '>' | '<' | '>=' | '<=' | '==' | '!='
  threshold_value?: number
  consecutive_failures: number
  channel_ids: number[]
  enabled: boolean
  created_by: number
  created_at: string
  updated_at: string
}

/**
 * Network Alert Record Types
 */
export interface NetworkAlertRecord {
  id: number
  tenant_id: number
  rule_id: number
  probe_id: number
  status: 'active' | 'acknowledged' | 'resolved'
  message: string
  triggered_value?: number
  first_triggered_at: string
  last_triggered_at: string
  acknowledged_at?: string
  acknowledged_by?: number
  resolved_at?: string
  created_at: string
}

/**
 * Network Dashboard Statistics
 */
export interface NetworkDashboardStats {
  total_probes: number
  active_probes: number
  success_rate: number
  avg_response_time: number
  active_alerts: number
  probe_status_distribution: {
    success: number
    failed: number
    timeout: number
  }
}
