import React, { useState } from 'react'
import { NetworkProbe } from '../../../types/network'
import { useTheme } from '../../../hooks/useTheme'

interface ProbeControlsProps {
  probe: NetworkProbe
  onStart: (probe: NetworkProbe) => Promise<void>
  onStop: (probe: NetworkProbe) => Promise<void>
  onProbe: (probe: NetworkProbe) => Promise<void>
  disabled?: boolean
}

export const ProbeControls: React.FC<ProbeControlsProps> = ({
  probe,
  onStart,
  onStop,
  onProbe,
  disabled = false,
}) => {
  const { isDark } = useTheme()
  const [loading, setLoading] = useState<'start' | 'stop' | 'probe' | null>(null)

  const handleStart = async () => {
    setLoading('start')
    try {
      await onStart(probe)
    } finally {
      setLoading(null)
    }
  }

  const handleStop = async () => {
    setLoading('stop')
    try {
      await onStop(probe)
    } finally {
      setLoading(null)
    }
  }

  const handleProbe = async () => {
    setLoading('probe')
    try {
      await onProbe(probe)
    } finally {
      setLoading(null)
    }
  }

  const isLoading = loading !== null
  const isDisabled = disabled || isLoading || !probe.enabled

  return (
    <div className="flex items-center gap-2">
      {/* Manual Probe Button */}
      <button
        onClick={handleProbe}
        disabled={isDisabled}
        className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          isDisabled
            ? isDark ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : isDark ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 focus:outline-none focus:ring-2 focus:ring-purple-500' : 'bg-purple-100 text-purple-700 hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500'
        }`}
        title={isDisabled ? '探测已禁用' : '立即执行手动探测'}
      >
        {loading === 'probe' ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            探测中...
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            立即探测
          </>
        )}
      </button>

      {/* Auto Probe Toggle Button */}
      {probe.auto_probe_enabled ? (
        <button
          onClick={handleStop}
          disabled={isDisabled}
          className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            isDisabled
              ? isDark ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : isDark ? 'bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 focus:outline-none focus:ring-2 focus:ring-orange-500' : 'bg-orange-100 text-orange-700 hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-500'
          }`}
          title={isDisabled ? '探测已禁用' : '停止自动探测'}
        >
          {loading === 'stop' ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              停止中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                />
              </svg>
              停止自动
            </>
          )}
        </button>
      ) : (
        <button
          onClick={handleStart}
          disabled={isDisabled}
          className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            isDisabled
              ? isDark ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : isDark ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30 focus:outline-none focus:ring-2 focus:ring-green-500' : 'bg-green-100 text-green-700 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500'
          }`}
          title={isDisabled ? '探测已禁用' : '启动自动探测'}
        >
          {loading === 'start' ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              启动中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              启动自动
            </>
          )}
        </button>
      )}
    </div>
  )
}
