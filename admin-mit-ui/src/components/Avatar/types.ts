// 头像组件类型定义

export type AvatarStyle = 
  | 'adventurer'
  | 'adventurer-neutral'
  | 'avataaars'
  | 'avataaars-neutral'
  | 'big-ears'
  | 'big-ears-neutral'
  | 'big-smile'
  | 'bottts'
  | 'bottts-neutral'
  | 'croodles'
  | 'croodles-neutral'
  | 'fun-emoji'
  | 'icons'
  | 'identicon'
  | 'initials'
  | 'lorelei'
  | 'lorelei-neutral'
  | 'micah'
  | 'miniavs'
  | 'notionists'
  | 'notionists-neutral'
  | 'open-peeps'
  | 'personas'
  | 'pixel-art'
  | 'pixel-art-neutral'
  | 'shapes'
  | 'thumbs'

export interface AvatarConfig {
  style: AvatarStyle
  seed: string
  size?: number
  backgroundColor?: string[]
  radius?: number
  scale?: number
  rotate?: number
  translateX?: number
  translateY?: number
  flip?: boolean
}

export interface AvatarDisplayProps {
  config: AvatarConfig
  className?: string
  alt?: string
  onClick?: () => void
}

export interface AvatarEditorProps {
  config: AvatarConfig
  onChange: (config: AvatarConfig) => void
  onSave?: (config: AvatarConfig) => void
  onCancel?: () => void
  className?: string
}

export interface AvatarPreviewProps {
  config: AvatarConfig
  size?: number
  showControls?: boolean
  onConfigChange?: (config: AvatarConfig) => void
  className?: string
}

export interface AvatarGeneratorProps {
  initialConfig?: Partial<AvatarConfig>
  onGenerate?: (config: AvatarConfig) => void
  onSave?: (config: AvatarConfig) => void
  className?: string
}

// 预定义的头像风格配置
export const AVATAR_STYLES: Record<AvatarStyle, { name: string; description: string }> = {
  'adventurer': { name: '冒险家', description: '卡通风格的冒险家头像' },
  'adventurer-neutral': { name: '冒险家（中性）', description: '中性色调的冒险家头像' },
  'avataaars': { name: 'Avataaars', description: '经典的 Avataaars 风格' },
  'avataaars-neutral': { name: 'Avataaars（中性）', description: '中性色调的 Avataaars' },
  'big-ears': { name: '大耳朵', description: '可爱的大耳朵风格' },
  'big-ears-neutral': { name: '大耳朵（中性）', description: '中性色调的大耳朵' },
  'big-smile': { name: '大笑脸', description: '开心的笑脸风格' },
  'bottts': { name: '机器人', description: '机器人风格头像' },
  'bottts-neutral': { name: '机器人（中性）', description: '中性色调的机器人' },
  'croodles': { name: '涂鸦', description: '手绘涂鸦风格' },
  'croodles-neutral': { name: '涂鸦（中性）', description: '中性色调的涂鸦' },
  'fun-emoji': { name: '趣味表情', description: '有趣的表情符号' },
  'icons': { name: '图标', description: '简洁的图标风格' },
  'identicon': { name: '身份图标', description: '几何图形身份标识' },
  'initials': { name: '首字母', description: '基于首字母的头像' },
  'lorelei': { name: 'Lorelei', description: '优雅的 Lorelei 风格' },
  'lorelei-neutral': { name: 'Lorelei（中性）', description: '中性色调的 Lorelei' },
  'micah': { name: 'Micah', description: '现代的 Micah 风格' },
  'miniavs': { name: '迷你头像', description: '小巧的迷你头像' },
  'notionists': { name: 'Notionists', description: 'Notion 风格头像' },
  'notionists-neutral': { name: 'Notionists（中性）', description: '中性色调的 Notionists' },
  'open-peeps': { name: 'Open Peeps', description: '开放式人物头像' },
  'personas': { name: '人物角色', description: '个性化人物角色' },
  'pixel-art': { name: '像素艺术', description: '8位像素艺术风格' },
  'pixel-art-neutral': { name: '像素艺术（中性）', description: '中性色调的像素艺术' },
  'shapes': { name: '几何形状', description: '抽象几何形状' },
  'thumbs': { name: '拇指', description: '拇指风格头像' }
}

// 预定义的背景颜色
export const BACKGROUND_COLORS = [
  ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
  ['#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'],
  ['#F8C471', '#82E0AA', '#AED6F1', '#F1948A', '#D7BDE2'],
  ['#A9DFBF', '#F9E79F', '#D2B4DE', '#AED6F1', '#F5B7B1']
]

// 默认头像配置
export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  style: 'avataaars',
  seed: 'default',
  size: 100,
  backgroundColor: ['#FF6B6B'],
  radius: 50,
  scale: 100,
  rotate: 0,
  translateX: 0,
  translateY: 0,
  flip: false
}