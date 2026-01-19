/**
 * Network Probe SSE Connection Hook
 * 
 * This hook manages Server-Sent Events (SSE) connections for real-time
 * network probe status updates.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { networkProbeService } from '../services/network'
import { NetworkProbeResult } from '../types/network'

/**
 * SSE Connection States
 */
export enum SSEConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting'
}

/**
 * SSE Event Data
 */
export interface SSEProbeStatusEvent {
  probe_id: number
  status: 'success' | 'failed' | 'timeout' | 'running' | 'unknown'
  response_time?: number
  status_code?: number
  error_message?: string
  timestamp: string
  result?: NetworkProbeResult
  is_expired?: boolean
}

/**
 * Hook Options
 */
export interface UseNetworkProbeSSEOptions {
  probeId: number
  autoConnect?: boolean
  reconnectAttempts?: number
  reconnectDelay?: number
  onStatusUpdate?: (event: SSEProbeStatusEvent) => void
  onConnectionStateChange?: (state: SSEConnectionState) => void
  onError?: (error: Error) => void
}

/**
 * Hook Return Value
 */
export interface UseNetworkProbeSSEReturn {
  // Connection state
  connectionState: SSEConnectionState
  isConnected: boolean
  isConnecting: boolean
  isReconnecting: boolean
  
  // Latest status data
  latestStatus: SSEProbeStatusEvent | null
  
  // Reconnection info
  reconnectAttempt: number
  reconnectDelay: number
  
  // Control methods
  connect: () => void
  disconnect: () => void
  
  // Error info
  error: Error | null
}

/**
 * Network Probe SSE Hook
 */
export const useNetworkProbeSSE = (
  options: UseNetworkProbeSSEOptions
): UseNetworkProbeSSEReturn => {
  const {
    probeId,
    autoConnect = false,
    reconnectAttempts = 5,
    reconnectDelay: initialReconnectDelay = 3000,
    onStatusUpdate,
    onConnectionStateChange,
    onError
  } = options

  // State
  const [connectionState, setConnectionState] = useState<SSEConnectionState>(
    SSEConnectionState.DISCONNECTED
  )
  const [latestStatus, setLatestStatus] = useState<SSEProbeStatusEvent | null>(null)
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const [reconnectDelay, setReconnectDelay] = useState(initialReconnectDelay)
  const [error, setError] = useState<Error | null>(null)

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isManualDisconnectRef = useRef(false)

  /**
   * Update connection state and notify listeners
   */
  const updateConnectionState = useCallback((state: SSEConnectionState) => {
    setConnectionState(state)
    onConnectionStateChange?.(state)
  }, [onConnectionStateChange])

  /**
   * Handle SSE error
   */
  const handleError = useCallback((err: Error) => {
    setError(err)
    onError?.(err)
  }, [onError])

  /**
   * Clean up existing connection
   */
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  /**
   * Attempt to reconnect
   */
  const attemptReconnect = useCallback(() => {
    if (isManualDisconnectRef.current) {
      return
    }

    const nextAttempt = reconnectAttempt + 1
    
    if (nextAttempt > reconnectAttempts) {
      updateConnectionState(SSEConnectionState.ERROR)
      handleError(new Error(`Failed to connect after ${reconnectAttempts} attempts`))
      return
    }

    const nextDelay = initialReconnectDelay * Math.pow(1.5, nextAttempt - 1)
    
    setReconnectAttempt(nextAttempt)
    setReconnectDelay(nextDelay)
    updateConnectionState(SSEConnectionState.RECONNECTING)

    reconnectTimeoutRef.current = setTimeout(() => {
      connect()
    }, nextDelay)
  }, [reconnectAttempt, reconnectAttempts, initialReconnectDelay, updateConnectionState, handleError])

  /**
   * Connect to SSE endpoint
   */
  const connect = useCallback(() => {
    // Clean up existing connection
    cleanup()
    
    isManualDisconnectRef.current = false
    setError(null)
    updateConnectionState(SSEConnectionState.CONNECTING)

    try {
      const url = networkProbeService.getStatusSSEUrl(probeId)
      const eventSource = new EventSource(url)
      
      eventSourceRef.current = eventSource

      // Handle connection open
      eventSource.onopen = () => {
        updateConnectionState(SSEConnectionState.CONNECTED)
        setReconnectAttempt(0)
        setReconnectDelay(initialReconnectDelay)
      }

      // Handle status messages
      eventSource.addEventListener('status', (event: MessageEvent) => {
        try {
          const data: SSEProbeStatusEvent = JSON.parse(event.data)
          setLatestStatus(data)
          onStatusUpdate?.(data)
        } catch (err) {
          console.error('Failed to parse SSE status event:', err)
        }
      })

      // Handle probe result messages
      eventSource.addEventListener('result', (event: MessageEvent) => {
        try {
          const data: SSEProbeStatusEvent = JSON.parse(event.data)
          setLatestStatus(data)
          onStatusUpdate?.(data)
        } catch (err) {
          console.error('Failed to parse SSE result event:', err)
        }
      })

      // Handle errors
      eventSource.onerror = (event) => {
        console.error('SSE connection error:', event)
        
        // Only attempt reconnect if not manually disconnected
        if (!isManualDisconnectRef.current) {
          cleanup()
          
          const err = new Error('SSE connection error')
          handleError(err)
          
          // Attempt to reconnect
          attemptReconnect()
        }
      }

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create SSE connection')
      handleError(error)
      updateConnectionState(SSEConnectionState.ERROR)
    }
  }, [probeId, cleanup, updateConnectionState, initialReconnectDelay, onStatusUpdate, handleError, attemptReconnect])

  /**
   * Disconnect from SSE endpoint
   */
  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true
    cleanup()
    updateConnectionState(SSEConnectionState.DISCONNECTED)
    setReconnectAttempt(0)
    setReconnectDelay(initialReconnectDelay)
    setError(null)
    setLatestStatus(null)
  }, [cleanup, updateConnectionState, initialReconnectDelay])

  /**
   * Auto-connect on mount if enabled
   */
  useEffect(() => {
    if (autoConnect && probeId) {
      connect()
    }

    return () => {
      if (autoConnect) {
        disconnect()
      }
    }
  }, [probeId, autoConnect])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  // Derived state
  const isConnected = connectionState === SSEConnectionState.CONNECTED
  const isConnecting = connectionState === SSEConnectionState.CONNECTING
  const isReconnecting = connectionState === SSEConnectionState.RECONNECTING

  return {
    // Connection state
    connectionState,
    isConnected,
    isConnecting,
    isReconnecting,
    
    // Latest status data
    latestStatus,
    
    // Reconnection info
    reconnectAttempt,
    reconnectDelay,
    
    // Control methods
    connect,
    disconnect,
    
    // Error info
    error
  }
}
