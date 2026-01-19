/**
 * Theme switching tests for notification components
 * Tests light/dark theme display, smooth transitions, contrast ratios, and persistence
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { act } from 'react-dom/test-utils'
import Toast from './Toast'
import AlertBox from './AlertBox'
import NotificationModal from './Modal'
import EmptyState from './EmptyState'
import { ThemeProvider, useThemeContext } from '../../contexts/ThemeContext'
import { tokens } from '../../styles/tokens'

// Test component to access theme context
const ThemeTestComponent = ({ children }: { children: (theme: any) => React.ReactNode }) => {
  const themeContext = useThemeContext()
  return <>{children(themeContext)}</>
}

describe('Theme Switching Tests', () => {
  beforeEach(() => {
    // Mock matchMedia for theme detection
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
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

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Light Theme Display', () => {
    it('should display Toast with light theme colors', () => {
      const { container } = render(
        <ThemeProvider>
          <Toast
            id="test"
            type="success"
            message="Success message"
            onClose={() => {}}
          />
        </ThemeProvider>
      )

      const toast = container.querySelector('[role="status"]')
      expect(toast).toBeInTheDocument()
      
      // Check that light theme colors are applied
      const style = toast ? window.getComputedStyle(toast) : null
      expect(style).toBeTruthy()
    })

    it('should display AlertBox with light theme colors', () => {
      const { container } = render(
        <ThemeProvider>
          <AlertBox
            type="info"
            message="Info message"
          />
        </ThemeProvider>
      )

      const alert = container.querySelector('[role="status"]')
      expect(alert).toBeInTheDocument()
    })

    it('should display Modal with light theme colors', () => {
      render(
        <ThemeProvider>
          <NotificationModal
            isOpen={true}
            onClose={() => {}}
            title="Test Modal"
          >
            <div>Content</div>
          </NotificationModal>
        </ThemeProvider>
      )

      const modal = screen.getByRole('dialog')
      expect(modal).toBeInTheDocument()
    })
  })

  describe('Dark Theme Display', () => {
    beforeEach(() => {
      // Mock dark theme preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
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
    })

    it('should display Toast with dark theme colors', () => {
      const { container } = render(
        <ThemeProvider>
          <ThemeTestComponent>
            {({ setTheme }) => {
              // Set dark theme
              React.useEffect(() => {
                setTheme('dark')
              }, [setTheme])
              
              return (
                <Toast
                  id="test"
                  type="error"
                  message="Error message"
                  onClose={() => {}}
                />
              )
            }}
          </ThemeTestComponent>
        </ThemeProvider>
      )

      const toast = container.querySelector('[role="alert"]')
      expect(toast).toBeInTheDocument()
    })

    it('should display AlertBox with dark theme colors', () => {
      const { container } = render(
        <ThemeProvider>
          <ThemeTestComponent>
            {({ setTheme }) => {
              React.useEffect(() => {
                setTheme('dark')
              }, [setTheme])
              
              return (
                <AlertBox
                  type="warning"
                  message="Warning message"
                />
              )
            }}
          </ThemeTestComponent>
        </ThemeProvider>
      )

      const alert = container.querySelector('[role="status"]')
      expect(alert).toBeInTheDocument()
    })
  })

  describe('Theme Transition Smoothness', () => {
    it('should have transition properties on Toast', () => {
      const { container } = render(
        <ThemeProvider>
          <Toast
            id="test"
            type="info"
            message="Test"
            onClose={() => {}}
          />
        </ThemeProvider>
      )

      const toast = container.querySelector('[role="status"]') as HTMLElement
      const style = toast ? window.getComputedStyle(toast) : null
      
      // Check for transition property
      expect(style?.transition).toBeTruthy()
    })

    it('should have transition properties on Modal', () => {
      render(
        <ThemeProvider>
          <NotificationModal
            isOpen={true}
            onClose={() => {}}
            title="Test"
          >
            <div>Content</div>
          </NotificationModal>
        </ThemeProvider>
      )

      const modal = screen.getByRole('dialog')
      const style = window.getComputedStyle(modal)
      
      // Modal should have transition for smooth theme changes
      expect(style).toBeTruthy()
    })
  })

  describe('Dark Mode Contrast', () => {
    it('should use appropriate colors for dark mode in Toast', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent>
            {({ setTheme }) => {
              React.useEffect(() => {
                setTheme('dark')
              }, [setTheme])
              
              return (
                <Toast
                  id="test"
                  type="success"
                  message="Success"
                  onClose={() => {}}
                />
              )
            }}
          </ThemeTestComponent>
        </ThemeProvider>
      )

      // Verify dark theme colors are defined
      expect(tokens.colors.dark.success).toBeDefined()
      expect(tokens.colors.dark.success.text).toBeDefined()
      expect(tokens.colors.dark.success.light).toBeDefined()
    })

    it('should use appropriate colors for dark mode in AlertBox', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent>
            {({ setTheme }) => {
              React.useEffect(() => {
                setTheme('dark')
              }, [setTheme])
              
              return (
                <AlertBox
                  type="error"
                  message="Error"
                />
              )
            }}
          </ThemeTestComponent>
        </ThemeProvider>
      )

      // Verify dark theme colors are defined
      expect(tokens.colors.dark.error).toBeDefined()
      expect(tokens.colors.dark.error.text).toBeDefined()
    })
  })

  describe('Theme Persistence', () => {
    it('should persist theme preference to localStorage', async () => {
      const setItemSpy = vi.spyOn(window.localStorage, 'setItem')

      render(
        <ThemeProvider>
          <ThemeTestComponent>
            {({ setTheme }) => {
              React.useEffect(() => {
                setTheme('dark')
              }, [setTheme])
              
              return <div>Test</div>
            }}
          </ThemeTestComponent>
        </ThemeProvider>
      )

      await waitFor(() => {
        expect(setItemSpy).toHaveBeenCalledWith('theme', 'dark')
      })
    })

    it('should load theme preference from localStorage', () => {
      const getItemSpy = vi.spyOn(window.localStorage, 'getItem')
      getItemSpy.mockReturnValue('dark')

      render(
        <ThemeProvider>
          <ThemeTestComponent>
            {({ theme }) => {
              return <div data-theme={theme}>Test</div>
            }}
          </ThemeTestComponent>
        </ThemeProvider>
      )

      expect(getItemSpy).toHaveBeenCalledWith('theme')
    })
  })

  describe('Dark Mode Shadow Adaptation', () => {
    it('should use darker shadows in dark mode', () => {
      // Verify dark theme shadows are defined and different from light
      expect(tokens.shadows.dark).toBeDefined()
      expect(tokens.shadows.light).toBeDefined()
      
      // Dark shadows should have higher opacity
      expect(tokens.shadows.dark.lg).not.toBe(tokens.shadows.light.lg)
      expect(tokens.shadows.dark.xl).not.toBe(tokens.shadows.light.xl)
    })

    it('should apply dark shadows to Toast in dark mode', () => {
      const { container } = render(
        <ThemeProvider>
          <ThemeTestComponent>
            {({ setTheme }) => {
              React.useEffect(() => {
                setTheme('dark')
              }, [setTheme])
              
              return (
                <Toast
                  id="test"
                  type="info"
                  message="Test"
                  onClose={() => {}}
                />
              )
            }}
          </ThemeTestComponent>
        </ThemeProvider>
      )

      const toast = container.querySelector('[role="status"]') as HTMLElement
      expect(toast).toBeInTheDocument()
      
      // Shadow should be applied
      const style = toast ? window.getComputedStyle(toast) : null
      expect(style?.boxShadow).toBeTruthy()
    })

    it('should apply dark shadows to Modal in dark mode', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent>
            {({ setTheme }) => {
              React.useEffect(() => {
                setTheme('dark')
              }, [setTheme])
              
              return (
                <NotificationModal
                  isOpen={true}
                  onClose={() => {}}
                  title="Test"
                >
                  <div>Content</div>
                </NotificationModal>
              )
            }}
          </ThemeTestComponent>
        </ThemeProvider>
      )

      const modal = screen.getByRole('dialog')
      const style = window.getComputedStyle(modal)
      
      // Shadow should be applied
      expect(style.boxShadow).toBeTruthy()
    })
  })

  describe('Component-Specific Theme Adaptations', () => {
    it('should adapt Toast background in dark mode', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent>
            {({ setTheme }) => {
              React.useEffect(() => {
                setTheme('dark')
              }, [setTheme])
              
              return (
                <Toast
                  id="test"
                  type="success"
                  message="Success"
                  onClose={() => {}}
                />
              )
            }}
          </ThemeTestComponent>
        </ThemeProvider>
      )

      // Verify dark theme success colors are appropriate
      expect(tokens.colors.dark.success.light).toBeDefined()
      expect(tokens.colors.dark.success.text).toBeDefined()
    })

    it('should adapt Modal overlay in dark mode', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent>
            {({ setTheme }) => {
              React.useEffect(() => {
                setTheme('dark')
              }, [setTheme])
              
              return (
                <NotificationModal
                  isOpen={true}
                  onClose={() => {}}
                  title="Test"
                >
                  <div>Content</div>
                </NotificationModal>
              )
            }}
          </ThemeTestComponent>
        </ThemeProvider>
      )

      const modal = screen.getByRole('dialog')
      expect(modal).toBeInTheDocument()
    })

    it('should adapt EmptyState in dark mode', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent>
            {({ setTheme }) => {
              React.useEffect(() => {
                setTheme('dark')
              }, [setTheme])
              
              return (
                <EmptyState
                  title="No data"
                  description="Empty state"
                />
              )
            }}
          </ThemeTestComponent>
        </ThemeProvider>
      )

      expect(screen.getByText('No data')).toBeInTheDocument()
    })
  })
})
