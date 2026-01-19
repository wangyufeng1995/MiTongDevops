/**
 * AI运维模块
 */
import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

// 懒加载组件
const Assistant = React.lazy(() => import('./Assistant'))
const Analysis = React.lazy(() => import('./Analysis'))
const ModelConfig = React.lazy(() => import('./ModelConfig'))

// 加载中组件
const Loading: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
      <p className="text-gray-600">加载中...</p>
    </div>
  </div>
)

export const AIOpsRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="assistant" replace />} />
      <Route
        path="assistant"
        element={
          <Suspense fallback={<Loading />}>
            <Assistant />
          </Suspense>
        }
      />
      <Route
        path="analysis"
        element={
          <Suspense fallback={<Loading />}>
            <Analysis />
          </Suspense>
        }
      />
      <Route
        path="model-config"
        element={
          <Suspense fallback={<Loading />}>
            <ModelConfig />
          </Suspense>
        }
      />
    </Routes>
  )
}

export default AIOpsRoutes
