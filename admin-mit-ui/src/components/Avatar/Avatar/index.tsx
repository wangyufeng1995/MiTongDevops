/**
 * 头像组件
 * 支持 DiceBear 头像显示和编辑，带有独立的 size 属性
 */
import React, { useState, useEffect } from 'react'
import clsx from 'clsx'

export interface AvatarConfig {
  style: string
  seed: string
  options?: Record<string, any>
}

interface AvatarProps {
  config?: AvatarConfig
  size?: 'tiny' | 'small' | 'medium' | 'large' | number
  className?: string
  editable?: boolean
  onChange?: (config: AvatarConfig) => void
}

const sizeMap: Record<string, number> = {
  tiny: 20,
  small: 24,
  medium: 40,
  large: 64,
}

// 简化的头像 URL 生成函数
const generateAvatarUrl = (config: AvatarConfig): string => {
  const style = config.style || 'avataaars'
  const seed = config.seed || 'default'
  const baseUrl = `https://api.dicebear.com/7.x/${style}/svg`
  const params = new URLSearchParams({ seed })

  // 添加配置参数
  if (config.options) {
    Object.entries(config.options).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        params.append(key, value.join(','))
      } else if (value !== undefined && value !== null) {
        params.append(key, String(value))
      }
    })
  }

  return `${baseUrl}?${params.toString()}`
}

export const Avatar: React.FC<AvatarProps> = ({
  config,
  size = 'medium',
  className,
  editable = false,
  onChange,
}) => {
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(
    config || { style: 'avataaars', seed: 'default', options: {} }
  )

  const avatarSize = typeof size === 'number' ? size : sizeMap[size]

  useEffect(() => {
    if (config) {
      setAvatarConfig(config)
    }
  }, [config])

  const avatarUrl = generateAvatarUrl(avatarConfig)

  return (
    <div className="relative inline-block flex-shrink-0">
      <div
        className={clsx(
          'rounded-full overflow-hidden bg-gray-100 border border-gray-200',
          editable && 'cursor-pointer hover:border-blue-400 transition-colors',
          className
        )}
        style={{ 
          width: avatarSize, 
          height: avatarSize,
          minWidth: avatarSize,
          minHeight: avatarSize,
          maxWidth: avatarSize,
          maxHeight: avatarSize
        }}
      >
        <img
          src={avatarUrl}
          alt="Avatar"
          className="w-full h-full object-cover"
          style={{
            width: '100%',
            height: '100%'
          }}
          onError={(e) => {
            // 降级到默认头像
            const target = e.target as HTMLImageElement
            target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${avatarConfig.seed}&backgroundColor=b6e3f4`
          }}
        />
      </div>
    </div>
  )
}

export default Avatar
