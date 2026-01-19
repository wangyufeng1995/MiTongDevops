import { create } from 'zustand'

export interface BreadcrumbItem {
  title: string
  path?: string
  icon?: string
}

export type ThemeMode = 'light' | 'dark' | 'system'

interface AppState {
  sidebarCollapsed: boolean
  theme: ThemeMode
  resolvedTheme: 'light' | 'dark'  // 实际应用的主题
  loading: boolean
  breadcrumbs: BreadcrumbItem[]
  
  // Actions
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setTheme: (theme: ThemeMode) => void
  setResolvedTheme: (theme: 'light' | 'dark') => void
  setLoading: (loading: boolean) => void
  setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void
  addBreadcrumb: (breadcrumb: BreadcrumbItem) => void
  clearBreadcrumbs: () => void
}

// 获取系统主题偏好
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

// 从 localStorage 读取保存的主题设置
const getSavedTheme = (): ThemeMode => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('app-theme')
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved
    }
  }
  return 'system' // 默认跟随系统
}

// 应用主题到 DOM
const applyTheme = (theme: 'light' | 'dark') => {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

// 初始化主题
const initialTheme = getSavedTheme()
const initialResolvedTheme = initialTheme === 'system' ? getSystemTheme() : initialTheme

// 在 store 创建前应用初始主题
if (typeof window !== 'undefined') {
  applyTheme(initialResolvedTheme)
}

export const useAppStore = create<AppState>((set, get) => ({
  sidebarCollapsed: false,
  theme: initialTheme,
  resolvedTheme: initialResolvedTheme,
  loading: false,
  breadcrumbs: [],

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
  },

  setSidebarCollapsed: (collapsed) => {
    set({ sidebarCollapsed: collapsed })
  },

  setTheme: (theme) => {
    // 保存到 localStorage
    localStorage.setItem('app-theme', theme)
    
    // 计算实际主题
    const resolved = theme === 'system' ? getSystemTheme() : theme
    
    set({ theme, resolvedTheme: resolved })
    applyTheme(resolved)
  },

  setResolvedTheme: (resolved) => {
    set({ resolvedTheme: resolved })
    applyTheme(resolved)
  },

  setLoading: (loading) => {
    set({ loading })
  },

  setBreadcrumbs: (breadcrumbs) => {
    set({ breadcrumbs })
  },

  addBreadcrumb: (breadcrumb) => {
    set((state) => ({
      breadcrumbs: [...state.breadcrumbs, breadcrumb]
    }))
  },

  clearBreadcrumbs: () => {
    set({ breadcrumbs: [] })
  },
}))