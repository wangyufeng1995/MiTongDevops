/**
 * ThemeContext Unit Tests
 * Tests theme switching, system theme detection, and localStorage persistence
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, renderHook } from '@testing-library/react'
import { ThemeProvider, useThemeContext } from './ThemeContext'

describe('ThemeContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    
    // Reset document attributes
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
    
    // Setup default matchMedia mock
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Theme Initialization', () => {
    it('should initialize with light theme by default', () => {
      const { result } = renderHook(() => useThemeContext(), {
        wrapper: ThemeProvider
      })

      expect(result.current.theme).toBe('light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('should initialize with saved theme from localStorage', () => {
      localStorage.setItem('notification-theme', 'dark')

      const { result } = renderHook(() => useThemeContext(), {
        wrapper: ThemeProvider
      })

      expect(result.current.theme).toBe('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('should initialize with system theme when no saved preference', () => {
      // Mock system prefers dark mode
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      const { result } = renderHook(() => useThemeContext(), {
        wrapper: ThemeProvider
      })

      expect(result.current.theme).toBe('dark')
    })
  })

  describe('Theme Switching', () => {
    it('should switch theme using setTheme', () => {
      const { result } = renderHook(() => useThemeContext(), {
        wrapper: ThemeProvider
      })

      act(() => {
        result.current.setTheme('dark')
      })

      expect(result.current.theme).toBe('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(localStorage.getItem('notification-theme')).toBe('dark')
    })

    it('should toggle theme using toggleTheme', () => {
      const { result } = renderHook(() => useThemeContext(), {
        wrapper: ThemeProvider
      })

      // Initial theme is light
      expect(result.current.theme).toBe('light')

      // Toggle to dark
      act(() => {
        result.current.toggleTheme()
      })

      expect(result.current.theme).toBe('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

      // Toggle back to light
      act(() => {
        result.current.toggleTheme()
      })

      expect(result.current.theme).toBe('light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })
  })

  describe('localStorage Persistence', () => {
    it('should persist theme to localStorage when changed', () => {
      const { result } = renderHook(() => useThemeContext(), {
        wrapper: ThemeProvider
      })

      act(() => {
        result.current.setTheme('dark')
      })

      expect(localStorage.getItem('notification-theme')).toBe('dark')

      act(() => {
        result.current.setTheme('light')
      })

      expect(localStorage.getItem('notification-theme')).toBe('light')
    })

    it('should load persisted theme on mount', () => {
      localStorage.setItem('notification-theme', 'dark')

      const { result } = renderHook(() => useThemeContext(), {
        wrapper: ThemeProvider
      })

      expect(result.current.theme).toBe('dark')
    })
  })

  describe('System Theme Detection', () => {
    it('should follow system theme changes when no user preference', () => {
      const listeners: Array<(e: MediaQueryListEvent) => void> = []
      
      const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
          if (event === 'change') {
            listeners.push(listener)
          }
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: mockMatchMedia,
      })

      const { result } = renderHook(() => useThemeContext(), {
        wrapper: ThemeProvider
      })

      // Initial theme is light
      expect(result.current.theme).toBe('light')

      // Simulate system theme change to dark
      act(() => {
        listeners.forEach(listener => {
          listener({ matches: true } as MediaQueryListEvent)
        })
      })

      expect(result.current.theme).toBe('dark')
    })

    it('should not follow system theme changes when user has set preference', () => {
      localStorage.setItem('notification-theme', 'light')

      const listeners: Array<(e: MediaQueryListEvent) => void> = []
      
      const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
          if (event === 'change') {
            listeners.push(listener)
          }
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: mockMatchMedia,
      })

      const { result } = renderHook(() => useThemeContext(), {
        wrapper: ThemeProvider
      })

      // User preference is light
      expect(result.current.theme).toBe('light')

      // Simulate system theme change to dark
      act(() => {
        listeners.forEach(listener => {
          listener({ matches: true } as MediaQueryListEvent)
        })
      })

      // Should still be light because user has set preference
      expect(result.current.theme).toBe('light')
    })
  })

  describe('Error Handling', () => {
    it('should throw error when useThemeContext is used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useThemeContext())
      }).toThrow('useThemeContext must be used within a ThemeProvider')

      consoleSpy.mockRestore()
    })
  })

  describe('DOM Updates', () => {
    it('should update data-theme attribute on document root', () => {
      const { result } = renderHook(() => useThemeContext(), {
        wrapper: ThemeProvider
      })

      act(() => {
        result.current.setTheme('dark')
      })

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

      act(() => {
        result.current.setTheme('light')
      })

      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('should update dark class on document root', () => {
      const { result } = renderHook(() => useThemeContext(), {
        wrapper: ThemeProvider
      })

      act(() => {
        result.current.setTheme('dark')
      })

      expect(document.documentElement.classList.contains('dark')).toBe(true)

      act(() => {
        result.current.setTheme('light')
      })

      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
  })
})
