/**
 * WebShell 连接状态指示器组件 - 美化版
 */
import { WebSocketState } from '../../services/webshell'
import { 
  Wifi, 
  WifiOff, 
  Loader2, 
  AlertCircle,
  RefreshCw,
  Zap
} from 'lucide-react'

export interface ConnectionStatusProps {
  state: WebSocketState
  reconnectAttempt?: number
  reconnectDelay?: number
  className?: string
  compact?: boolean
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  state,
  reconnectAttempt = 0,
  reconnectDelay = 0,
  className = '',
  compact = false
}) => {
  const getStatusConfig = () => {
    switch (state) {
      case WebSocketState.CONNECTED:
        return {
          icon: <Zap size={compact ? 14 : 16} />,
          text: '已连接',
          color: 'text-emerald-400',
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/30',
          glowColor: 'shadow-emerald-500/20',
          dotColor: 'bg-emerald-400',
          animate: false
        }
      
      case WebSocketState.CONNECTING:
        return {
          icon: <Loader2 size={compact ? 14 : 16} className="animate-spin" />,
          text: '连接中',
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/30',
          glowColor: 'shadow-blue-500/20',
          dotColor: 'bg-blue-400',
          animate: true
        }
      
      case WebSocketState.RECONNECTING:
        return {
          icon: <RefreshCw size={compact ? 14 : 16} className="animate-spin" />,
          text: `重连中 (${reconnectAttempt}/5)`,
          color: 'text-amber-400',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/30',
          glowColor: 'shadow-amber-500/20',
          dotColor: 'bg-amber-400',
          animate: true
        }
      
      case WebSocketState.ERROR:
        return {
          icon: <AlertCircle size={compact ? 14 : 16} />,
          text: '连接错误',
          color: 'text-red-400',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          glowColor: 'shadow-red-500/20',
          dotColor: 'bg-red-400',
          animate: false
        }
      
      case WebSocketState.DISCONNECTED:
      default:
        return {
          icon: <WifiOff size={compact ? 14 : 16} />,
          text: '未连接',
          color: 'text-gray-400',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/30',
          glowColor: '',
          dotColor: 'bg-gray-400',
          animate: false
        }
    }
  }

  const config = getStatusConfig()

  if (compact) {
    return (
      <div className={`inline-flex items-center space-x-1.5 ${className}`}>
        <span className={`relative flex h-2 w-2`}>
          {config.animate && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dotColor} opacity-75`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor}`} />
        </span>
        <span className={`text-xs font-medium ${config.color}`}>
          {config.text}
        </span>
      </div>
    )
  }

  return (
    <div 
      className={`
        inline-flex items-center space-x-2 px-3 py-1.5 rounded-full 
        border backdrop-blur-sm transition-all duration-300
        ${config.bgColor} ${config.borderColor} ${config.glowColor}
        ${config.glowColor ? 'shadow-lg' : ''}
        ${className}
      `}
    >
      {/* 状态指示点 */}
      <span className="relative flex h-2 w-2">
        {config.animate && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dotColor} opacity-75`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor}`} />
      </span>

      {/* 图标 */}
      <span className={config.color}>
        {config.icon}
      </span>

      {/* 文本 */}
      <span className={`text-sm font-medium ${config.color}`}>
        {config.text}
      </span>

      {/* 重连延迟显示 */}
      {state === WebSocketState.RECONNECTING && reconnectDelay > 0 && (
        <span className="text-xs text-gray-500 font-mono">
          {Math.ceil(reconnectDelay / 1000)}s
        </span>
      )}
    </div>
  )
}

export default ConnectionStatus
