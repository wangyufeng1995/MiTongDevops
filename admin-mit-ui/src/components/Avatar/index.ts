// 头像组件统一导出

export { AvatarDisplay } from './AvatarDisplay'
export { AvatarEditor } from './AvatarEditor'
export { AvatarPreview } from './AvatarPreview'
export { AvatarGenerator } from './AvatarGenerator'

// 导出主要的 Avatar 组件（支持独立的 size 属性）
export { Avatar } from './Avatar'

export * from './types'
export * from './utils'

// 默认导出主要组件
export { Avatar as default } from './Avatar'