import React, { useState, useEffect } from 'react'
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react'
import { api } from '../../services/api'

interface CSRFStatusProps {
  className?: string
  showDetails?: boolean
}

export const CSRFStatus: React.FC<CSRFStatusProps> = ({ 
  className = '', 
  showDetails = false 
}) => {
  const [status, setStatus] = useState<'unknown' | 'active' | 'error'>('unknown')
  const [lastCheck, setLastCheck] = useState<Date | null>(null)

  useEffect(() => {
    checkCSRFStatus()
    const interval = setInterval(checkCSRFStatus, 30000) // Check every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const checkCSRFStatus = async () => {
    try {
      const csrfToken = api.getCSRFToken()
      if (csrfToken) {
        setStatus('active')
      } else {
        setStatus('error')
      }
      setLastCheck(new Date())
    } catch (error) {
      setStatus('error')
      setLastCheck(new Date())
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'active':
        return <ShieldCheck className="w-4 h-4 text-green-500" />
      case 'error':
        return <ShieldAlert className="w-4 h-4 text-red-500" />
      default:
        return <Shield className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'active':
        return 'CSRF 保护已启用'
      case 'error':
        return 'CSRF 保护异常'
      default:
        return 'CSRF 状态检查中'
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'active':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-500'
    }
  }

  if (!showDetails) {
    return (
      <div className={`flex items-center space-x-1 ${className}`} title={getStatusText()}>
        {getStatusIcon()}
      </div>
    )
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {getStatusIcon()}
      <div className="flex flex-col">
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
        {lastCheck && (
          <span className="text-xs text-gray-400">
            最后检查: {lastCheck.toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  )
}

export default CSRFStatus