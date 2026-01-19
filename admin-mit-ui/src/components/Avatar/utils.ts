// 头像工具函数

import { createAvatar } from '@dicebear/core'
import { adventurer, adventurerNeutral, avataaars, avataaarsNeutral, bigEars, bigEarsNeutral, bigSmile, bottts, botttsNeutral, croodles, croodlesNeutral, funEmoji, icons, identicon, initials, lorelei, loreleiNeutral, micah, miniavs, notionists, notionistsNeutral, openPeeps, personas, pixelArt, pixelArtNeutral, shapes, thumbs } from '@dicebear/collection'

import type { AvatarStyle, AvatarConfig } from './types'

// 头像风格映射
const styleMap = {
  'adventurer': adventurer,
  'adventurer-neutral': adventurerNeutral,
  'avataaars': avataaars,
  'avataaars-neutral': avataaarsNeutral,
  'big-ears': bigEars,
  'big-ears-neutral': bigEarsNeutral,
  'big-smile': bigSmile,
  'bottts': bottts,
  'bottts-neutral': botttsNeutral,
  'croodles': croodles,
  'croodles-neutral': croodlesNeutral,
  'fun-emoji': funEmoji,
  'icons': icons,
  'identicon': identicon,
  'initials': initials,
  'lorelei': lorelei,
  'lorelei-neutral': loreleiNeutral,
  'micah': micah,
  'miniavs': miniavs,
  'notionists': notionists,
  'notionists-neutral': notionistsNeutral,
  'open-peeps': openPeeps,
  'personas': personas,
  'pixel-art': pixelArt,
  'pixel-art-neutral': pixelArtNeutral,
  'shapes': shapes,
  'thumbs': thumbs
}

/**
 * 生成头像 SVG 字符串
 */
export function generateAvatarSvg(config: AvatarConfig): string {
  const style = styleMap[config.style]
  
  if (!style) {
    throw new Error(`Unsupported avatar style: ${config.style}`)
  }

  const avatar = createAvatar(style, {
    seed: config.seed,
    size: config.size || 100,
    backgroundColor: config.backgroundColor,
    radius: config.radius,
    scale: config.scale,
    rotate: config.rotate,
    translateX: config.translateX,
    translateY: config.translateY,
    flip: config.flip
  })

  return avatar.toString()
}

/**
 * 生成头像数据 URL
 */
export function generateAvatarDataUrl(config: AvatarConfig): string {
  const svg = generateAvatarSvg(config)
  const base64 = btoa(unescape(encodeURIComponent(svg)))
  return `data:image/svg+xml;base64,${base64}`
}

/**
 * 生成随机种子值
 */
export function generateRandomSeed(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15)
}

/**
 * 生成随机头像配置
 */
export function generateRandomAvatarConfig(baseConfig?: Partial<AvatarConfig>): AvatarConfig {
  const styles: AvatarStyle[] = Object.keys(styleMap) as AvatarStyle[]
  const randomStyle = styles[Math.floor(Math.random() * styles.length)]
  
  return {
    style: randomStyle,
    seed: generateRandomSeed(),
    size: 100,
    backgroundColor: ['#FF6B6B'],
    radius: 50,
    scale: 100,
    rotate: 0,
    translateX: 0,
    translateY: 0,
    flip: false,
    ...baseConfig
  }
}

/**
 * 验证头像配置
 */
export function validateAvatarConfig(config: Partial<AvatarConfig>): string[] {
  const errors: string[] = []

  if (!config.style) {
    errors.push('头像风格不能为空')
  } else if (!styleMap[config.style]) {
    errors.push('不支持的头像风格')
  }

  if (!config.seed) {
    errors.push('种子值不能为空')
  }

  if (config.size && (config.size < 16 || config.size > 512)) {
    errors.push('头像尺寸必须在 16-512 之间')
  }

  if (config.radius && (config.radius < 0 || config.radius > 50)) {
    errors.push('圆角半径必须在 0-50 之间')
  }

  if (config.scale && (config.scale < 50 || config.scale > 200)) {
    errors.push('缩放比例必须在 50-200 之间')
  }

  if (config.rotate && (config.rotate < -180 || config.rotate > 180)) {
    errors.push('旋转角度必须在 -180 到 180 之间')
  }

  return errors
}

/**
 * 从用户名生成种子值
 */
export function generateSeedFromName(name: string): string {
  if (!name) return generateRandomSeed()
  
  // 简单的哈希函数，将用户名转换为一致的种子值
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 转换为32位整数
  }
  
  return Math.abs(hash).toString(36)
}

/**
 * 下载头像为 PNG 文件
 */
export async function downloadAvatarAsPng(
  config: AvatarConfig, 
  filename: string = 'avatar'
): Promise<void> {
  const svg = generateAvatarSvg(config)
  
  // 创建一个临时的 canvas 元素
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('无法创建 Canvas 上下文')
  }

  const size = config.size || 100
  canvas.width = size
  canvas.height = size

  // 创建图片对象
  const img = new Image()
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  return new Promise((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size)
      
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('无法生成图片'))
          return
        }

        // 创建下载链接
        const downloadUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = `${filename}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        // 清理资源
        URL.revokeObjectURL(url)
        URL.revokeObjectURL(downloadUrl)
        resolve()
      }, 'image/png')
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('无法加载 SVG 图片'))
    }

    img.src = url
  })
}

/**
 * 复制头像配置到剪贴板
 */
export async function copyAvatarConfig(config: AvatarConfig): Promise<void> {
  const configJson = JSON.stringify(config, null, 2)
  
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(configJson)
  } else {
    // 降级方案
    const textArea = document.createElement('textarea')
    textArea.value = configJson
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
  }
}