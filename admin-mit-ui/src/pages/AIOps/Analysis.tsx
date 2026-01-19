/**
 * 智能分析页面
 */
import React from 'react'
import { Zap, TrendingUp, AlertTriangle, CheckCircle, Activity, BarChart3 } from 'lucide-react'

export const Analysis: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页面头部 */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">智能分析</h1>
              <p className="text-gray-500 mt-1">AI驱动的系统分析与优化建议</p>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* 系统健康度 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-2xl font-bold text-green-600">92%</span>
            </div>
            <h3 className="text-sm font-medium text-gray-600">系统健康度</h3>
            <p className="text-xs text-gray-500 mt-1">整体运行良好</p>
          </div>

          {/* 性能评分 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-2xl font-bold text-blue-600">85</span>
            </div>
            <h3 className="text-sm font-medium text-gray-600">性能评分</h3>
            <p className="text-xs text-gray-500 mt-1">较上周提升5%</p>
          </div>

          {/* 待优化项 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
              <span className="text-2xl font-bold text-yellow-600">3</span>
            </div>
            <h3 className="text-sm font-medium text-gray-600">待优化项</h3>
            <p className="text-xs text-gray-500 mt-1">需要关注</p>
          </div>

          {/* 分析任务 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-2xl font-bold text-purple-600">12</span>
            </div>
            <h3 className="text-sm font-medium text-gray-600">分析任务</h3>
            <p className="text-xs text-gray-500 mt-1">本周完成</p>
          </div>
        </div>

        {/* 分析报告 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 性能分析 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                性能分析
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">CPU使用率</span>
                    <span className="text-sm font-semibold text-green-600">良好</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '45%' }}></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">平均使用率 45%，运行稳定</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">内存使用率</span>
                    <span className="text-sm font-semibold text-yellow-600">注意</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '78%' }}></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">平均使用率 78%，建议优化</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">磁盘I/O</span>
                    <span className="text-sm font-semibold text-green-600">良好</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '35%' }}></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">I/O负载正常，无瓶颈</p>
                </div>
              </div>
            </div>
          </div>

          {/* 优化建议 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-blue-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                优化建议
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">内存优化</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      检测到内存使用率较高，建议清理缓存或增加内存容量
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">数据库优化</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      建议对慢查询进行优化，添加适当的索引
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">缓存策略</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      可以启用Redis缓存来提升响应速度
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 提示信息 */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Zap className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-purple-900 mb-1">功能开发中</h4>
              <p className="text-sm text-purple-700">
                智能分析功能正在开发中，敬请期待。未来将支持实时性能分析、智能优化建议、异常检测等功能。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Analysis
