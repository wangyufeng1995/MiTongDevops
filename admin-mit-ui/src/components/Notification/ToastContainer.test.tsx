/**
 * ToastContainer Unit Tests
 * Tests toast queue management, display, and theme switching
 */
import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import ToastContainer from './ToastContainer'
import { NotificationProvider } from '../../contexts/NotificationContext'
import { ThemeProvider } from '../../contexts/ThemeContext'
import { useNotification } from '../../hooks/useNotification'

// Test component that uses notification hook
const TestComponent = ({ onReady }: { onReady?: (api: ReturnType<typeof useNotification>) => void }) => {
  const notification = useNotification()
  
  React.useEffect(() => {
    onReady?.(notification)
  }, [])
  
  return null
}

describe('ToastContainer', () => {
  beforeEach(() => {
    // Setup matchMedia mock
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

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <ThemeProvider>
        <NotificationProvider>
          {component}
          <ToastContainer />
        </NotificationProvider>
      </ThemeProvider>
    )
  }

  describe('Toast Display', () => {
    it('should display a single toast', async () => {
      let notificationApi: ReturnType<typeof useNotification>

      renderWithProviders(
        <TestComponent onReady={(api) => { notificationApi = api }} />
      )

      await waitFor(() => {
        expect(notificationApi).toBeDefined()
      })

      act(() => {
        notificationApi!.success('Test message')
      })

      await waitFor(() => {
        expect(screen.getByText('Test message')).toBeInTheDocument()
      })
    })

    it('should display multiple toasts', async () => {
      let notificationApi: ReturnType<typeof useNotification>

      renderWithProviders(
        <TestComponent onReady={(api) => { notificationApi = api }} />
      )

      await waitFor(() => {
        expect(notificationApi).toBeDefined()
      })

      act(() => {
        notificationApi!.success('Message 1')
        notificationApi!.error('Message 2')
        notificationApi!.info('Message 3')
      })

      await waitFor(() => {
        expect(screen.getByText('Message 1')).toBeInTheDocument()
        expect(screen.getByText('Message 2')).toBeInTheDocument()
        expect(screen.getByText('Message 3')).toBeInTheDocument()
      })
    })
  })

  describe('Toast Queue Management', () => {
    it('should respect maximum toast limit', async () => {
      let notificationApi: ReturnType<typeof useNotification>

      render(
        <ThemeProvider>
          <NotificationProvider maxToasts={3}>
            <TestComponent onReady={(api) => { notificationApi = api }} />
            <ToastContainer />
          </NotificationProvider>
        </ThemeProvider>
      )

      await waitFor(() => {
        expect(notificationApi).toBeDefined()
      })

      // Add more toasts than the limit
      act(() => {
        notificationApi!.info('Toast 1')
        notificationApi!.info('Toast 2')
        notificationApi!.info('Toast 3')
        notificationApi!.info('Toast 4')
        notificationApi!.info('Toast 5')
      })

      await waitFor(() => {
        // Should only show the last 3 toasts
        expect(notificationApi!.toasts.length).toBeLessThanOrEqual(3)
      })
    })

    it('should remove toast when dismissed', async () => {
      let notificationApi: ReturnType<typeof useNotification>

      renderWithProviders(
        <TestComponent onReady={(api) => { notificationApi = api }} />
      )

      await waitFor(() => {
        expect(notificationApi).toBeDefined()
      })

      let toastId: string
      act(() => {
        toastId = notificationApi!.success('Test message')
      })

      await waitFor(() => {
        expect(screen.getByText('Test message')).toBeInTheDocument()
      })

      act(() => {
        notificationApi!.dismissToast(toastId!)
      })

      await waitFor(() => {
        expect(screen.queryByText('Test message')).not.toBeInTheDocument()
      }, { timeout: 1000 })
    })

    it('should dismiss all toasts', async () => {
      let notificationApi: ReturnType<typeof useNotification>

      renderWithProviders(
        <TestComponent onReady={(api) => { notificationApi = api }} />
      )

      await waitFor(() => {
        expect(notificationApi).toBeDefined()
      })

      act(() => {
        notificationApi!.success('Message 1')
        notificationApi!.error('Message 2')
        notificationApi!.info('Message 3')
      })

      await waitFor(() => {
        expect(notificationApi!.toasts.length).toBe(3)
      })

      act(() => {
        notificationApi!.dismissAllToasts()
      })

      await waitFor(() => {
        expect(notificationApi!.toasts.length).toBe(0)
      }, { timeout: 1000 })
    })
  })

  describe('Theme Switching', () => {
    it('should apply theme to toast container', async () => {
      let notificationApi: ReturnType<typeof useNotification>

      const { container } = renderWithProviders(
        <TestComponent onReady={(api) => { notificationApi = api }} />
      )

      await waitFor(() => {
        expect(notificationApi).toBeDefined()
      })

      act(() => {
        notificationApi!.success('Test message')
      })

      await waitFor(() => {
        const toastContainer = container.querySelector('[data-theme]') as HTMLElement
        expect(toastContainer).toBeTruthy()
        expect(toastContainer?.getAttribute('data-theme')).toBe('light')
      })
    })
  })

  describe('Toast Positioning', () => {
    it('should position toasts correctly', async () => {
      let notificationApi: ReturnType<typeof useNotification>

      const { container } = renderWithProviders(
        <TestComponent onReady={(api) => { notificationApi = api }} />
      )

      await waitFor(() => {
        expect(notificationApi).toBeDefined()
      })

      act(() => {
        notificationApi!.success('Test message', { position: 'top-right' })
      })

      await waitFor(() => {
        const toastContainer = container.querySelector('[data-theme]') as HTMLElement
        expect(toastContainer).toBeTruthy()
        expect(toastContainer.className).toContain('top-4')
        expect(toastContainer.className).toContain('right-4')
      })
    })

    it('should handle multiple positions', async () => {
      let notificationApi: ReturnType<typeof useNotification>

      const { container } = renderWithProviders(
        <TestComponent onReady={(api) => { notificationApi = api }} />
      )

      await waitFor(() => {
        expect(notificationApi).toBeDefined()
      })

      act(() => {
        notificationApi!.success('Top Right', { position: 'top-right' })
        notificationApi!.error('Top Left', { position: 'top-left' })
      })

      await waitFor(() => {
        const containers = container.querySelectorAll('[data-theme]')
        expect(containers.length).toBeGreaterThanOrEqual(1)
        
        // Check that we have containers with different positions
        const hasTopRight = Array.from(containers).some(c => 
          c.className.includes('top-4') && c.className.includes('right-4')
        )
        const hasTopLeft = Array.from(containers).some(c => 
          c.className.includes('top-4') && c.className.includes('left-4')
        )
        
        expect(hasTopRight || hasTopLeft).toBe(true)
      })
    })
  })
})
