/**
 * DiceBear 头像服务
 * 提供头像生成、配置和管理功能
 */
import { createAvatar } from '@dicebear/core'
import { avataaars, adventurer, bigEars, bottts, funEmoji, identicon, initials, lorelei, micah, miniavs, openPeeps, personas, pixelArt } from '@dicebear/collection'

// 头像风格配置
export const AVATAR_STYLES = {
  avataaars: { collection: avataaars, name: 'Avataaars', description: '卡通风格头像' },
  adventurer: { collection: adventurer, name: 'Adventurer', description: '冒险者风格' },
  'big-ears': { collection: bigEars, name: 'Big Ears', description: '大耳朵风格' },
  bottts: { collection: bottts, name: 'Bottts', description: '机器人风格' },
  'fun-emoji': { collection: funEmoji, name: 'Fun Emoji', description: '表情符号风格' },
  identicon: { collection: identicon, name: 'Identicon', description: '几何图形风格' },
  initials: { collection: initials, name: 'Initials', description: '首字母风格' },
  lorelei: { collection: lorelei, name: 'Lorelei', description: '女性风格' },
  micah: { collection: micah, name: 'Micah', description: '简约风格' },
  miniavs: { collection: miniavs, name: 'Miniavs', description: '迷你头像' },
  'open-peeps': { collection: openPeeps, name: 'Open Peeps', description: '开放式人物' },
  personas: { collection: personas, name: 'Personas', description: '人物角色' },
  'pixel-art': { collection: pixelArt, name: 'Pixel Art', description: '像素艺术' },
} as const

export type AvatarStyle = keyof typeof AVATAR_STYLES

// 头像配置接口
export interface AvatarConfig {
  style: AvatarStyle
  seed: string
  options?: Record<string, any>
}

// 默认头像配置
export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  style: 'avataaars',
  seed: 'default',
  options: {
    backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'],
  },
}

class AvatarService {
  /**
   * 生成头像 SVG
   */
  generateAvatar(config: AvatarConfig): string {
    const styleConfig = AVATAR_STYLES[config.style]
    if (!styleConfig) {
      throw new Error(`Unsupported avatar style: ${config.style}`)
    }

    const avatar = createAvatar(styleConfig.collection, {
      seed: config.seed,
      ...config.options,
    })

    return avatar.toString()
  }

  /**
   * 生成头像 Data URL
   */
  generateAvatarDataUrl(config: AvatarConfig): string {
    const svg = this.generateAvatar(config)
    const base64 = btoa(unescape(encodeURIComponent(svg)))
    return `data:image/svg+xml;base64,${base64}`
  }

  /**
   * 生成头像 URL（使用 DiceBear API）
   */
  generateAvatarUrl(config: AvatarConfig): string {
    const baseUrl = `https://api.dicebear.com/7.x/${config.style}/svg`
    const params = new URLSearchParams({
      seed: config.seed,
    })

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

  /**
   * 根据用户名或邮箱生成随机头像配置
   */
  generateRandomConfig(seed?: string): AvatarConfig {
    const styles = Object.keys(AVATAR_STYLES) as AvatarStyle[]
    const randomStyle = styles[Math.floor(Math.random() * styles.length)]
    const randomSeed = seed || Math.random().toString(36).substring(7)

    return {
      style: randomStyle,
      seed: randomSeed,
      options: this.getDefaultOptionsForStyle(randomStyle),
    }
  }

  /**
   * 获取指定风格的默认配置选项
   */
  getDefaultOptionsForStyle(style: AvatarStyle): Record<string, any> {
    const commonOptions = {
      backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'],
    }

    switch (style) {
      case 'avataaars':
        return {
          ...commonOptions,
          topType: ['ShortHairShortFlat', 'ShortHairSides', 'ShortHairThick', 'LongHairStraight'],
          accessoriesType: ['Blank', 'Prescription01', 'Prescription02', 'Round'],
          hairColor: ['BrownDark', 'Brown', 'Blonde', 'Auburn', 'Black'],
          facialHairType: ['Blank', 'BeardMedium', 'BeardLight', 'MoustacheFancy'],
          clotheType: ['BlazerShirt', 'BlazerSweater', 'CollarSweater', 'Hoodie'],
          eyeType: ['Default', 'Happy', 'Hearts', 'Side', 'Squint'],
          eyebrowType: ['Default', 'DefaultNatural', 'RaisedExcited', 'UnibrowNatural'],
          mouthType: ['Default', 'Eating', 'Grimace', 'Sad', 'ScreamOpen', 'Serious', 'Smile'],
          skinColor: ['Light', 'Yellow', 'Pale', 'DarkBrown', 'Brown'],
        }
      case 'adventurer':
        return {
          ...commonOptions,
          eyes: ['variant01', 'variant02', 'variant03', 'variant04'],
          mouth: ['variant01', 'variant02', 'variant03', 'variant04'],
        }
      case 'initials':
        return {
          ...commonOptions,
          fontSize: [40, 50, 60],
          fontWeight: [400, 600, 700],
        }
      default:
        return commonOptions
    }
  }

  /**
   * 验证头像配置
   */
  validateConfig(config: AvatarConfig): boolean {
    if (!config.style || !AVATAR_STYLES[config.style]) {
      return false
    }
    if (!config.seed || config.seed.trim() === '') {
      return false
    }
    return true
  }

  /**
   * 获取所有可用的头像风格
   */
  getAvailableStyles(): Array<{ key: AvatarStyle; name: string; description: string }> {
    return Object.entries(AVATAR_STYLES).map(([key, value]) => ({
      key: key as AvatarStyle,
      name: value.name,
      description: value.description,
    }))
  }

  /**
   * 预览头像配置
   */
  previewConfig(config: AvatarConfig): {
    svg: string
    dataUrl: string
    apiUrl: string
  } {
    return {
      svg: this.generateAvatar(config),
      dataUrl: this.generateAvatarDataUrl(config),
      apiUrl: this.generateAvatarUrl(config),
    }
  }
}

export const avatarService = new AvatarService()