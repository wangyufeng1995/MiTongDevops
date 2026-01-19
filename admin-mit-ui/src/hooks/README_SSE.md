# Network Probe SSE Hook

## Overview

The `useNetworkProbeSSE` hook provides a React interface for managing Server-Sent Events (SSE) connections to receive real-time network probe status updates.

## Features

- ✅ Automatic connection management
- ✅ Reconnection with exponential backoff
- ✅ Connection state tracking
- ✅ Real-time status updates
- ✅ Error handling
- ✅ TypeScript support

## Basic Usage

```typescript
import { useNetworkProbeSSE } from './hooks/useNetworkProbeSSE'

function MyComponent() {
  const {
    isConnected,
    latestStatus,
    connect,
    disconnect
  } = useNetworkProbeSSE({
    probeId: 1,
    autoConnect: true,
    onStatusUpdate: (event) => {
      console.log('New status:', event)
    }
  })

  return (
    <div>
      <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
      {latestStatus && (
        <p>Status: {latestStatus.status}</p>
      )}
    </div>
  )
}
```

## Hook Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `probeId` | `number` | required | The ID of the network probe to monitor |
| `autoConnect` | `boolean` | `false` | Automatically connect on mount |
| `reconnectAttempts` | `number` | `5` | Maximum number of reconnection attempts |
| `reconnectDelay` | `number` | `3000` | Initial delay between reconnection attempts (ms) |
| `onStatusUpdate` | `function` | - | Callback when status update is received |
| `onConnectionStateChange` | `function` | - | Callback when connection state changes |
| `onError` | `function` | - | Callback when an error occurs |

## Return Values

| Property | Type | Description |
|----------|------|-------------|
| `connectionState` | `SSEConnectionState` | Current connection state |
| `isConnected` | `boolean` | Whether the connection is active |
| `isConnecting` | `boolean` | Whether currently connecting |
| `isReconnecting` | `boolean` | Whether currently reconnecting |
| `latestStatus` | `SSEProbeStatusEvent \| null` | Most recent status update |
| `reconnectAttempt` | `number` | Current reconnection attempt number |
| `reconnectDelay` | `number` | Current reconnection delay (ms) |
| `connect` | `function` | Manually initiate connection |
| `disconnect` | `function` | Manually disconnect |
| `error` | `Error \| null` | Current error, if any |

## Connection States

```typescript
enum SSEConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting'
}
```

## Status Event Structure

```typescript
interface SSEProbeStatusEvent {
  probe_id: number
  status: 'success' | 'failed' | 'timeout' | 'running'
  response_time?: number
  status_code?: number
  error_message?: string
  timestamp: string
  result?: NetworkProbeResult
}
```

## Advanced Usage

### Manual Connection Control

```typescript
const { connect, disconnect, isConnected } = useNetworkProbeSSE({
  probeId: 1,
  autoConnect: false // Don't connect automatically
})

// Connect manually
const handleConnect = () => {
  connect()
}

// Disconnect manually
const handleDisconnect = () => {
  disconnect()
}
```

### Custom Reconnection Strategy

```typescript
const sse = useNetworkProbeSSE({
  probeId: 1,
  reconnectAttempts: 10, // Try 10 times
  reconnectDelay: 1000, // Start with 1 second
  // Delay increases exponentially: 1s, 1.5s, 2.25s, 3.375s, etc.
})
```

### Handling Connection States

```typescript
const { connectionState, reconnectAttempt } = useNetworkProbeSSE({
  probeId: 1,
  autoConnect: true,
  onConnectionStateChange: (state) => {
    switch (state) {
      case SSEConnectionState.CONNECTED:
        console.log('Connected successfully')
        break
      case SSEConnectionState.RECONNECTING:
        console.log(`Reconnecting (attempt ${reconnectAttempt})...`)
        break
      case SSEConnectionState.ERROR:
        console.error('Connection failed')
        break
    }
  }
})
```

## Component Example

See `src/components/Network/ProbeStatus/index.tsx` for a complete example of using the SSE hook in a React component.

## Testing

The hook includes comprehensive tests covering:
- Connection lifecycle
- Status updates
- Error handling
- Reconnection logic
- Manual control

Run tests with:
```bash
npm test -- useNetworkProbeSSE.test.tsx
```

## Notes

- The hook automatically cleans up connections on unmount
- Reconnection uses exponential backoff to avoid overwhelming the server
- Manual disconnect prevents automatic reconnection
- All callbacks are optional
