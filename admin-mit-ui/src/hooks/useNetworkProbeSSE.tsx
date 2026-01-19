/**
 * Network Probe SSE Hook
 * 
 * Provides real-time status updates for network probes using Server-Sent Events
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { networkProbeService } from '../services/network'

export enum SSEConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

export interface ProbeStatusEvent {
  probe_id: number
  status: 'success' | 'failed' | 'timeout' | 'running'
  response_time?: number
  status_code?: number
  error_message?: string
  timestamp: string
}

export interface UseNetworkProbeSSEOptions {
  probeId: number
  autoConnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  onStatusUpdate?: (event: ProbeStatusEvent) => void
  onError?: (error: Error) => void
  onConnectionStateChange?: (state: SSEConnectionState) => void
}

export interface UseNetworkProbeSSEReturn {
  connectionState: SSEConnectionState
  isConnected: boolean
  isConnecting: boolean
  latestStatus: ProbeStatusEvent | null
  reconnectAttempt: number
  error: Error | null
  connect: () => void
  disconnect: () => void
}

export const useNetworkProbeSSE = ({
  probeId,
  autoConnect = true,
  reconnectInterval = 5000,
  maxReconnectAttempts = 5,
  onStatusUpdate,
  onError,
  onConnectionStateChange
}: UseNetworkProbeSSEOptions): UseNetworkProbeSSEReturn => {
  const [connectionState, setConnectionState] = useState<SSEConnectionState>(SSEConnectionState.DISCONNECTED)
  const [latestStatus, setLatestStatus] = useState<ProbeStatusEvent | null>(null)
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const [error, setError] = useState<Error | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  const updateConnectionState = useCallback((state: SSEConnectionState) => {
    if (!mountedRef.current) return
    
    setConnectionState(state)
    onConnectionStateChange?.(state)
  }, [onConnectionStateChange])

  const handleError = useCallback((err: Error) => {
    if (!mountedRef.current) return
    
    setError(err)
    onError?.(err)
    updateConnectionState(SSEConnectionState.ERROR)
  }, [onError, updateConnectionState])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    setReconnectAttempt(0)
    setError(null)
    updateConnectionState(SSEConnectionState.DISCONNECTED)
  }, [updateConnectionState])

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    
    // Close existing connection
    disconnect()

    try {
      updateConnectionState(SSEConnectionState.CONNECTING)
      
      // Get SSE URL from service
      const sseUrl = networkProbeService.getStatusSSEUrl(probeId)
      
      // Create EventSource
      const eventSource = new EventSource(sseUrl)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        if (!mountedRef.current) return
        
        setReconnectAttempt(0)
        setError(null)
        updateConnectionState(SSEConnectionState.CONNECTED)
      }

      eventSource.onmessage = (event) => {
        if (!mountedRef.current) return
        
        try {
          const data = JSON.parse(event.data) as ProbeStatusEvent
          setLatestStatus(data)
          onStatusUpdate?.(data)
        } catch (err) {
          console.error('Failed to parse SSE message:', err)
        }
      }

      eventSource.onerror = () => {
        if (!mountedRef.current) return
        
        const currentAttempt = reconnectAttempt + 1
        
        if (currentAttempt <= maxReconnectAttempts) {
          setReconnectAttempt(currentAttempt)
          updateConnectionState(SSEConnectionState.RECONNECTING)
          
          // Schedule reconnection
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect()
            }
          }, reconnectInterval)
        } else {
          handleError(new Error(`Failed to connect after ${maxReconnectAttempts} attempts`))
        }
      }

      // Handle specific event types
      eventSource.addEventListener('probe_status', (event) => {
        if (!mountedRef.current) return
        
        try {
          const data = JSON.parse(event.data) as ProbeStatusEvent
          setLatestStatus(data)
          onStatusUpdate?.(data)
        } catch (err) {
          console.error('Failed to parse probe_status event:', err)
        }
      })

      eventSource.addEventListener('error', (event) => {
        if (!mountedRef.current) return
        
        try {
          const errorData = JSON.parse(event.data)
          handleError(new Error(errorData.message || 'SSE connection error'))
        } catch (err) {
          handleError(new Error('Unknown SSE error'))
        }
      })

    } catch (err) {
      handleError(err instanceof Error ? err : new Error('Failed to create SSE connection'))
    }
  }, [
    probeId,
    reconnectAttempt,
    maxReconnectAttempts,
    reconnectInterval,
    disconnect,
    updateConnectionState,
    handleError,
    onStatusUpdate
  ])

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true
    
    if (autoConnect) {
      connect()
    }

    return () => {
      mountedRef.current = false
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      disconnect()
    }
  }, [disconnect])

  const isConnected = connectionState === SSEConnectionState.CONNECTED
  const isConnecting = connectionState === SSEConnectionState.CONNECTING || 
                      connectionState === SSEConnectionState.RECONNECTING

  return {
    connectionState,
    isConnected,
    isConnecting,
    latestStatus,
    reconnectAttempt,
    error,
    connect,
    disconnect
  }
}