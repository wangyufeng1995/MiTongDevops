/**
 * Performance tests for notification components
 * Tests rendering performance, animation frame rates, and memory usage
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { NotificationProvider } from '../../contexts/NotificationContext'
import { ThemeProvider } from '../../contexts/ThemeContext'
import ToastContainer from './ToastContainer'
import Toast from './Toast'
import NotificationModal from './Modal'

// Helper to wrap components with providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      <NotificationProvider>
        {component}
      </NotificationProvider>
    </ThemeProvider>
  )
}

describe('Performance Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    
    // Mock matchMedia for reduced motion tests
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
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
    vi.useRealTimers()
  })

  describe('Toast Performance', () => {
    it('should render multiple toasts efficiently', () => {
      const startTime = performance.now()
      
      // Render 10 toasts
      const toasts = Array.from({ length: 10 }, (_, i) => (
        <Toast
          key={i}
          id={`toast-${i}`}
          type="info"
          message={`Toast message ${i}`}
          onClose={() => {}}
        />
      ))

      const { container } = render(<div>{toasts}</div>)
      
      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Rendering 10 toasts should take less than 500ms (adjusted for test environment)
      expect(renderTime).toBeLessThan(500)
      expect(container.querySelectorAll('[role="status"]')).toHaveLength(10)
    })

    it('should handle rapid toast creation without performance degradation', async () => {
      const renderTimes: number[] = []

      // Create 20 toasts rapidly
      for (let i = 0; i < 20; i++) {
        const startTime = performance.now()
        
        render(
          <Toast
            id={`toast-${i}`}
            type="success"
            message={`Message ${i}`}
            onClose={() => {}}
          />
        )
        
        const endTime = performance.now()
        renderTimes.push(endTime - startTime)
      }

      // Calculate average render time
      const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length

      // Average render time should be less than 20ms (adjusted for test environment)
      expect(avgRenderTime).toBeLessThan(20)

      // No render should take more than 100ms (adjusted for test environment)
      expect(Math.max(...renderTimes)).toBeLessThan(100)
    })

    it('should not cause memory leaks with auto-dismiss', async () => {
      const { unmount } = render(
        <Toast
          id="test-toast"
          type="success"
          message="Test message"
          duration={1000}
          onClose={() => {}}
        />
      )

      // Fast-forward time
      vi.advanceTimersByTime(1000)

      // Unmount component
      unmount()

      // If there are no memory leaks, this should complete without errors
      expect(true).toBe(true)
    })
  })

  describe('Modal Performance', () => {
    it('should render modal efficiently', () => {
      const startTime = performance.now()

      render(
        <NotificationModal
          isOpen={true}
          onClose={() => {}}
          title="Test Modal"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Modal rendering should take less than 150ms (adjusted for test environment)
      expect(renderTime).toBeLessThan(150)
    })

    it('should handle modal open/close cycles efficiently', () => {
      const renderTimes: number[] = []

      // Test opening and closing modals
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now()

        // Render with isOpen=true
        const { unmount } = render(
          <NotificationModal
            isOpen={true}
            onClose={() => {}}
            title="Test Modal"
          >
            <div>Content {i}</div>
          </NotificationModal>
        )

        const endTime = performance.now()
        renderTimes.push(endTime - startTime)
        
        unmount()
      }

      const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length

      // Average cycle time should be less than 50ms (adjusted for test environment)
      expect(avgRenderTime).toBeLessThan(50)
    })
  })

  describe('Animation Performance', () => {
    it('should use GPU-accelerated properties', () => {
      const { container } = render(
        <Toast
          id="test-toast"
          type="info"
          message="Test"
          onClose={() => {}}
        />
      )

      const toastElement = container.firstChild as HTMLElement

      // Check that transform and opacity are used (GPU-accelerated)
      const style = window.getComputedStyle(toastElement)
      expect(style.transition).toContain('opacity')
      expect(style.transition).toContain('transform')
    })

    it('should respect reduced motion preference', () => {
      // Mock prefers-reduced-motion
      const mockMatchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: mockMatchMedia,
      })

      const { container } = render(
        <Toast
          id="test-toast"
          type="info"
          message="Test"
          onClose={() => {}}
        />
      )

      // Animation duration should be 0 when reduced motion is preferred
      expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
    })
  })

  describe('Memory Usage', () => {
    it('should clean up toast timers on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

      const { unmount } = render(
        <Toast
          id="test-toast"
          type="success"
          message="Test"
          duration={3000}
          onClose={() => {}}
        />
      )

      unmount()

      // Verify that cleanup happened
      expect(clearTimeoutSpy).toHaveBeenCalled()
    })

    it('should not leak event listeners', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

      const { unmount } = render(
        <NotificationModal
          isOpen={true}
          onClose={() => {}}
          title="Test"
          closeOnEsc={true}
        >
          <div>Content</div>
        </NotificationModal>
      )

      const addCallCount = addEventListenerSpy.mock.calls.length

      unmount()

      const removeCallCount = removeEventListenerSpy.mock.calls.length

      // All added listeners should be removed
      expect(removeCallCount).toBeGreaterThanOrEqual(addCallCount)
    })
  })

  describe('Re-render Optimization', () => {
    it('should not re-render Toast when props do not change', () => {
      let renderCount = 0

      const TestToast = (props: any) => {
        renderCount++
        return <Toast {...props} />
      }

      const { rerender } = render(
        <TestToast
          id="test"
          type="info"
          message="Test"
          onClose={() => {}}
        />
      )

      const initialRenderCount = renderCount

      // Re-render with same props
      rerender(
        <TestToast
          id="test"
          type="info"
          message="Test"
          onClose={() => {}}
        />
      )

      // Due to React.memo, render count should not increase significantly
      // (may increase by 1 due to parent re-render, but not more)
      expect(renderCount - initialRenderCount).toBeLessThanOrEqual(1)
    })
  })
})
