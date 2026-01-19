import React, { useState } from 'react'
import { Edit, Shuffle, Download, Copy } from 'lucide-react'
import { clsx } from 'clsx'
import { AvatarDisplay } from '../AvatarDisplay'
import { AvatarEditor } from '../AvatarEditor'
import { 
  generateRandomAvatarConfig, 
  downloadAvatarAsPng,
  copyAvatarConfig 
} from '../utils'
import type { AvatarPreviewProps } from '../types'

/**
 * 头像预览组件
 * 提供头像预览和快速操作功能
 */
export const AvatarPreview: React.FC<AvatarPreviewProps> = ({
  config,
  size = 100,
  showControls = true,
  onConfigChange,
  className
}) => {
  const [showEditor, setShowEditor] = useState(false)

  // 处理随机生成
  const handleRandomGenerate = () => {
    if (onConfigChange) {
      const randomConfig = generateRandomAvatarConfig({
        size: config.size,
        backgroundColor: config.backgroundColor
      })
      onConfigChange(randomConfig)
    }
  }

  // 处理下载
  const handleDownload = async () => {
    try {
      await downloadAvatarAsPng(config, `avatar-${config.seed}`)
    } catch (error) {
      console.error('下载头像失败:', error)
    }
  }

  // 处理复制配置
  const handleCopyConfig = async () => {
    try {
      await copyAvatarConfig(config)
    } catch (error) {
      console.error('复制配置失败:', error)
    }
  }

  // 处理编辑器保存
  const handleEditorSave = (newConfig: typeof config) => {
    if (onConfigChange) {
      onConfigChange(newConfig)
    }
    setShowEditor(false)
  }

  if (showEditor) {
    return (
      <div className={className}>
        <AvatarEditor
          config={config}
          onChange={onConfigChange || (() => {})}
          onSave={handleEditorSave}
          onCancel={() => setShowEditor(false)}
        />
      </div>
    )
  }

  return (
    <div className={clsx('relative group', className)}>
      <AvatarDisplay
        config={{ ...config, size }}
        onClick={showControls && onConfigChange ? () => setShowEditor(true) : undefined}
      />

      {showControls && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-50 rounded-full">
          <div className="flex space-x-1">
            {onConfigChange && (
              <>
                <button
                  onClick={() => setShowEditor(true)}
                  className="p-1.5 bg-white text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
                  title="编辑头像"
                >
                  <Edit className="w-3 h-3" />
                </button>
                <button
                  onClick={handleRandomGenerate}
                  className="p-1.5 bg-white text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
                  title="随机生成"
                >
                  <Shuffle className="w-3 h-3" />
                </button>
              </>
            )}
            <button
              onClick={handleDownload}
              className="p-1.5 bg-white text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
              title="下载头像"
            >
              <Download className="w-3 h-3" />
            </button>
            <button
              onClick={handleCopyConfig}
              className="p-1.5 bg-white text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
              title="复制配置"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AvatarPreview