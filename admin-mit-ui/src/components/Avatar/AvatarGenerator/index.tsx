import React, { useState, useEffect } from 'react'
import { Shuffle, Save, RotateCcw } from 'lucide-react'
import { clsx } from 'clsx'
import { AvatarDisplay } from '../AvatarDisplay'
import { generateRandomAvatarConfig, generateSeedFromName } from '../utils'
import { DEFAULT_AVATAR_CONFIG } from '../types'
import type { AvatarGeneratorProps, AvatarConfig } from '../types'

/**
 * 头像生成器组件
 * 提供快速生成和保存头像的功能
 */
export const AvatarGenerator: React.FC<AvatarGeneratorProps> = ({
  initialConfig,
  onGenerate,
  onSave,
  className
}) => {
  const [config, setConfig] = useState<AvatarConfig>(() => ({
    ...DEFAULT_AVATAR_CONFIG,
    ...initialConfig
  }))
  const [userName, setUserName] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  // 当初始配置改变时更新状态
  useEffect(() => {
    if (initialConfig) {
      setConfig(prev => ({ ...prev, ...initialConfig }))
    }
  }, [initialConfig])

  // 生成随机头像
  const handleRandomGenerate = async () => {
    setIsGenerating(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const randomConfig = generateRandomAvatarConfig({
        size: config.size,
        backgroundColor: config.backgroundColor
      })
      setConfig(randomConfig)
      onGenerate?.(randomConfig)
    } finally {
      setIsGenerating(false)
    }
  }

  // 基于用户名生成头像
  const handleGenerateFromName = () => {
    if (!userName.trim()) return

    const seed = generateSeedFromName(userName.trim())
    const newConfig = {
      ...config,
      seed
    }
    setConfig(newConfig)
    onGenerate?.(newConfig)
  }

  // 重置配置
  const handleReset = () => {
    const resetConfig = {
      ...DEFAULT_AVATAR_CONFIG,
      ...initialConfig
    }
    setConfig(resetConfig)
    setUserName('')
    onGenerate?.(resetConfig)
  }

  // 保存头像
  const handleSave = () => {
    onSave?.(config)
  }

  return (
    <div className={clsx('bg-white rounded-lg shadow-lg p-6', className)}>
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-4">头像生成器</h3>
        
        {/* 头像预览 */}
        <div className="flex justify-center mb-6">
          <AvatarDisplay config={config} className="shadow-lg" />
        </div>

        {/* 用户名输入 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            基于用户名生成
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="输入用户名"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleGenerateFromName()
                }
              }}
            />
            <button
              onClick={handleGenerateFromName}
              disabled={!userName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              生成
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            相同的用户名会生成相同的头像
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col space-y-3">
          <button
            onClick={handleRandomGenerate}
            disabled={isGenerating}
            className="flex items-center justify-center space-x-2 w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Shuffle className={clsx('w-4 h-4', isGenerating && 'animate-spin')} />
            <span>{isGenerating ? '生成中...' : '随机生成'}</span>
          </button>

          <div className="flex space-x-2">
            <button
              onClick={handleReset}
              className="flex items-center justify-center space-x-2 flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>重置</span>
            </button>

            {onSave && (
              <button
                onClick={handleSave}
                className="flex items-center justify-center space-x-2 flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>保存</span>
              </button>
            )}
          </div>
        </div>

        {/* 当前配置信息 */}
        <div className="mt-4 p-3 bg-gray-50 rounded-md text-left">
          <h4 className="text-sm font-medium text-gray-700 mb-2">当前配置</h4>
          <div className="text-xs text-gray-600 space-y-1">
            <div>风格: {config.style}</div>
            <div>种子: {config.seed}</div>
            <div>尺寸: {config.size}px</div>
            <div>背景: {config.backgroundColor?.[0] || '默认'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AvatarGenerator