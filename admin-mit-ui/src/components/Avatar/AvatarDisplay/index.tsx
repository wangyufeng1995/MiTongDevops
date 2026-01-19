import React, { useMemo } from 'react'
import { clsx } from 'clsx'
import { generateAvatarDataUrl } from '../utils'
import type { AvatarDisplayProps } from '../types'

/**
 * 头像显示组件
 * 用于显示生成的头像，支持点击事件
 */
export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({
  config,
  className,
  alt = '用户头像',
  onClick
}) => {
  // 生成头像数据 URL
  const avatarUrl = useMemo(() => {
    try {
      return generateAvatarDataUrl(config)
    } catch (error) {
      console.error('生成头像失败:', error)
      return ''
    }
  }, [config])

  // 如果生成失败，显示默认头像
  if (!avatarUrl) {
    return (
      <div
        className={clsx(
          'flex items-center justify-center bg-gray-200 text-gray-500 rounded-full',
          onClick && 'cursor-pointer hover:bg-gray-300 transition-colors',
          className
        )}
        style={{ 
          width: config.size || 100, 
          height: config.size || 100 
        }}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        } : undefined}
      >
        <span className="text-xs">头像</span>
      </div>
    )
  }

  return (
    <img
      src={avatarUrl}
      alt={alt}
      className={clsx(
        'rounded-full object-cover',
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
      style={{ 
        width: config.size || 100, 
        height: config.size || 100 
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      } : undefined}
    />
  )
}

export default AvatarDisplay