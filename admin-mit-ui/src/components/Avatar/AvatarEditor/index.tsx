import React, { useState, useCallback } from 'react'
import { 
  Palette, 
  RotateCcw, 
  Download, 
  Copy, 
  Save, 
  X,
  Shuffle,
  Settings
} from 'lucide-react'
import { clsx } from 'clsx'
import { AvatarDisplay } from '../AvatarDisplay'
import { 
  generateRandomAvatarConfig, 
  generateRandomSeed,
  downloadAvatarAsPng,
  copyAvatarConfig
} from '../utils'
import { AVATAR_STYLES, BACKGROUND_COLORS } from '../types'
import type { AvatarEditorProps, AvatarStyle } from '../types'

/**
 * 头像编辑器组件
 * 提供完整的头像编辑功能，包括风格选择、参数调整等
 */
export const AvatarEditor: React.FC<AvatarEditorProps> = ({
  config,
  onChange,
  onSave,
  onCancel,
  className
}) => {
  const [activeTab, setActiveTab] = useState<'style' | 'customize' | 'colors'>('style')
  const [isGenerating, setIsGenerating] = useState(false)

  // 处理配置更新
  const handleConfigChange = useCallback((updates: Partial<typeof config>) => {
    onChange({ ...config, ...updates })
  }, [config, onChange])

  // 生成随机头像
  const handleRandomGenerate = useCallback(async () => {
    setIsGenerating(true)
    try {
      // 添加一点延迟，让用户看到加载状态
      await new Promise(resolve => setTimeout(resolve, 300))
      const randomConfig = generateRandomAvatarConfig({
        size: config.size,
        backgroundColor: config.backgroundColor
      })
      onChange(randomConfig)
    } finally {
      setIsGenerating(false)
    }
  }, [config.size, config.backgroundColor, onChange])

  // 重置种子值
  const handleResetSeed = useCallback(() => {
    handleConfigChange({ seed: generateRandomSeed() })
  }, [handleConfigChange])

  // 下载头像
  const handleDownload = useCallback(async () => {
    try {
      await downloadAvatarAsPng(config, `avatar-${config.seed}`)
    } catch (error) {
      console.error('下载头像失败:', error)
      alert('下载失败，请重试')
    }
  }, [config])

  // 复制配置
  const handleCopyConfig = useCallback(async () => {
    try {
      await copyAvatarConfig(config)
      alert('配置已复制到剪贴板')
    } catch (error) {
      console.error('复制配置失败:', error)
      alert('复制失败，请重试')
    }
  }, [config])

  return (
    <div className={clsx('bg-white rounded-lg shadow-lg', className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">头像编辑器</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRandomGenerate}
            disabled={isGenerating}
            className="flex items-center space-x-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 rounded-md hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Shuffle className={clsx('w-4 h-4', isGenerating && 'animate-spin')} />
            <span>{isGenerating ? '生成中...' : '随机生成'}</span>
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* 头像预览 */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <AvatarDisplay
              config={config}
              className="shadow-lg"
            />
            <div className="absolute -bottom-2 -right-2 flex space-x-1">
              <button
                onClick={handleDownload}
                className="p-1.5 bg-white text-gray-600 hover:text-gray-800 border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all"
                title="下载头像"
              >
                <Download className="w-3 h-3" />
              </button>
              <button
                onClick={handleCopyConfig}
                className="p-1.5 bg-white text-gray-600 hover:text-gray-800 border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all"
                title="复制配置"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* 标签页 */}
        <div className="flex space-x-1 mb-4 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('style')}
            className={clsx(
              'flex-1 flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors',
              activeTab === 'style'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Settings className="w-4 h-4" />
            <span>风格</span>
          </button>
          <button
            onClick={() => setActiveTab('customize')}
            className={clsx(
              'flex-1 flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors',
              activeTab === 'customize'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <RotateCcw className="w-4 h-4" />
            <span>自定义</span>
          </button>
          <button
            onClick={() => setActiveTab('colors')}
            className={clsx(
              'flex-1 flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors',
              activeTab === 'colors'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Palette className="w-4 h-4" />
            <span>颜色</span>
          </button>
        </div>

        {/* 标签页内容 */}
        <div className="min-h-[300px]">
          {activeTab === 'style' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  头像风格
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {Object.entries(AVATAR_STYLES).map(([style, info]) => (
                    <button
                      key={style}
                      onClick={() => handleConfigChange({ style: style as AvatarStyle })}
                      className={clsx(
                        'p-3 text-left border rounded-lg transition-colors',
                        config.style === style
                          ? 'border-blue-500 bg-blue-50 text-blue-900'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      <div className="font-medium text-sm">{info.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{info.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  种子值
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={config.seed}
                    onChange={(e) => handleConfigChange({ seed: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="输入种子值"
                  />
                  <button
                    onClick={handleResetSeed}
                    className="px-3 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    title="重新生成"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  种子值决定头像的具体样式，相同的种子值会生成相同的头像
                </p>
              </div>
            </div>
          )}

          {activeTab === 'customize' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  尺寸: {config.size}px
                </label>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={config.size || 100}
                  onChange={(e) => handleConfigChange({ size: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  圆角: {config.radius}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={config.radius || 50}
                  onChange={(e) => handleConfigChange({ radius: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  缩放: {config.scale}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={config.scale || 100}
                  onChange={(e) => handleConfigChange({ scale: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  旋转: {config.rotate}°
                </label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={config.rotate || 0}
                  onChange={(e) => handleConfigChange({ rotate: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="flip"
                  checked={config.flip || false}
                  onChange={(e) => handleConfigChange({ flip: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="flip" className="ml-2 text-sm text-gray-700">
                  水平翻转
                </label>
              </div>
            </div>
          )}

          {activeTab === 'colors' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  背景颜色
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {BACKGROUND_COLORS.flat().map((color, index) => (
                    <button
                      key={index}
                      onClick={() => handleConfigChange({ backgroundColor: [color] })}
                      className={clsx(
                        'w-10 h-10 rounded-lg border-2 transition-all',
                        config.backgroundColor?.[0] === color
                          ? 'border-gray-800 scale-110'
                          : 'border-gray-200 hover:border-gray-400'
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  自定义颜色
                </label>
                <input
                  type="color"
                  value={config.backgroundColor?.[0] || '#FF6B6B'}
                  onChange={(e) => handleConfigChange({ backgroundColor: [e.target.value] })}
                  className="w-full h-10 border border-gray-300 rounded-md cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* 底部操作按钮 */}
        {onSave && (
          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
            )}
            <button
              onClick={() => onSave(config)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>保存</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AvatarEditor