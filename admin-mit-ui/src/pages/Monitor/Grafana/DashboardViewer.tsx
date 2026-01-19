/**
 * Grafana 仪表盘查看器组件
 * 
 * 使用 iframe 嵌入 Grafana 仪表盘
 * 支持全屏展示、刷新、处理加载失败
 * 
 * Requirements: 5.1, 5.2, 5.4, 5.5, 5.6
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Maximize2,
  Minimize2,
  ExternalLink,
  AlertCircle,
  BarChart3
} from 'lucide-react'
import { Loading } from '../../../components/Loading'
import { GrafanaDashboard, GrafanaConfig, grafanaService } from '../../../services/grafana'

interface DashboardViewerProps {
  dashboard: GrafanaDashboard | null
  config?: GrafanaConfig | null
  iframeHeight: number
  onRefresh?: () => void
}

export const DashboardViewer: React.FC<DashboardViewerProps> = ({
  dashboard,
  config,
  iframeHeight,
  onRefresh
}) => {
  // iframe 状态
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [iframeKey, setIframeKey] = useState(0)

  // 获取 iframe URL
  const getIframeUrl = useCallback(() => {
    if (!dashboard) return ''
    return grafanaService.buildIframeUrl(dashboard.url, config || undefined)
  }, [dashboard, config])

  // 当仪表盘变化时重置状态
  useEffect(() => {
    if (dashboard) {
      setLoading(true)
      setError(null)
      setIframeKey(prev => prev + 1)
    }
  }, [dashboard?.id])

  // iframe 加载完成
  const handleIframeLoad = () => {
    setLoading(false)
  }

  // iframe 加载错误
  const handleIframeError = () => {
    setLoading(false)
    setError('仪表盘加载失败，请检查 Grafana 服务器是否可访问')
  }

  // 刷新 iframe
  const handleRefresh = () => {
    if (dashboard) {
      setLoading(true)
      setError(null)
      setIframeKey(prev => prev + 1)
      onRefresh?.()
    }
  }

  // 全屏切换
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (err) {
      console.error('全屏切换失败:', err)
    }
  }

  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // 在新窗口打开
  const handleOpenInNewWindow = () => {
    if (dashboard) {
      window.open(dashboard.url, '_blank')
    }
  }

  // 无仪表盘时显示占位
  if (!dashboard) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 via-orange-50/30 to-red-50/20">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-orange-100 to-red-100 mb-6 shadow-lg">
            <BarChart3 className="w-12 h-12 text-orange-500" />
          </div>
          <h3 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-3">
            请选择仪表盘
          </h3>
          <p className="text-gray-600">
            从左侧列表选择一个仪表盘开始查看
          </p>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className={`flex flex-col h-full ${isFullscreen ? 'bg-white' : ''}`}
    >
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-white to-orange-50/50 border-b-2 border-orange-100 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-400 to-red-500">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-gray-900">{dashboard.name}</span>
            {dashboard.description && (
              <p className="text-xs text-gray-600 mt-0.5">{dashboard.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleOpenInNewWindow}
            className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-700 hover:text-orange-700 bg-white hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 rounded-lg transition-all shadow-sm hover:shadow-md border border-gray-200 hover:border-orange-300"
            title="在新窗口打开"
          >
            <ExternalLink className="w-4 h-4" />
            <span>新窗口</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-700 hover:text-orange-700 bg-white hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 rounded-lg transition-all shadow-sm hover:shadow-md border border-gray-200 hover:border-orange-300 disabled:opacity-50"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>刷新</span>
          </button>
          <button
            onClick={toggleFullscreen}
            className="flex items-center space-x-1 px-3 py-2 text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-all shadow-md hover:shadow-lg hover:scale-105"
            title={isFullscreen ? '退出全屏' : '全屏显示'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
            <span>{isFullscreen ? '退出全屏' : '全屏'}</span>
          </button>
        </div>
      </div>

      {/* iframe 容器 */}
      <div className="flex-1 relative bg-gray-100">
        {/* 加载指示器 */}
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
            <Loading size="lg" text="加载仪表盘中..." />
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-orange-50/30 to-red-50/20 flex items-center justify-center z-10">
            <div className="text-center max-w-md px-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-red-100 to-orange-100 mb-4">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent mb-3">加载失败</h3>
              <p className="text-gray-600 mb-6">{error}</p>
              <div className="flex justify-center space-x-3">
                <button
                  onClick={handleRefresh}
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 transition-all shadow-lg hover:shadow-xl hover:scale-105"
                >
                  重试
                </button>
                <button
                  onClick={handleOpenInNewWindow}
                  className="px-5 py-2.5 border-2 border-orange-300 text-orange-700 rounded-xl hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 transition-all"
                >
                  在新窗口打开
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-6 bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-gray-200">
                💡 提示：请确保 Grafana 服务器允许 iframe 嵌入（检查 X-Frame-Options 设置）
              </p>
            </div>
          </div>
        )}

        {/* iframe */}
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={getIframeUrl()}
          className="w-full border-0"
          style={{ 
            height: isFullscreen ? 'calc(100vh - 52px)' : iframeHeight,
            minHeight: 400
          }}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          title={dashboard.name}
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          allow="fullscreen"
        />
      </div>
    </div>
  )
}

export default DashboardViewer
