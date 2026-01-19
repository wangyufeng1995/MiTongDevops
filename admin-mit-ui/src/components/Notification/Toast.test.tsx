import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Toast from './Toast'

// Mock useTheme hook
vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    isDark: false,
    theme: 'light',
    resolvedTheme: 'light',
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
  }),
}))

describe('Toast Component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('Rendering different types', () => {
    it('renders success toast with correct message and icon', () => {
      render(
        <Toast
          id="test-1"
          type="success"
          message="Operation successful"
          onClose={vi.fn()}
        />
      )
      
      expect(screen.getByText('Operation successful')).toBeInTheDocument()
      expect(screen.getByRole('status')).toBeInTheDocument()
      // CheckCircle icon should be present
      const container = screen.getByRole('status')
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('renders error toast with correct message and icon', () => {
      render(
        <Toast
          id="test-2"
          type="error"
          message="Operation failed"
          onClose={vi.fn()}
        />
      )
      
      expect(screen.getByText('Operation failed')).toBeInTheDocument()
      expect(screen.getByRole('status')).toBeInTheDocument()
      // XCircle icon should be present
      const container = screen.getByRole('status')
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('renders info toast with correct message and icon', () => {
      render(
        <Toast
          id="test-3"
          type="info"
          message="Information message"
          onClose={vi.fn()}
        />
      )
      
      expect(screen.getByText('Information message')).toBeInTheDocument()
      expect(screen.getByRole('status')).toBeInTheDocument()
      // Info icon should be present
      const container = screen.getByRole('status')
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('renders warning toast with correct message and icon', () => {
      render(
        <Toast
          id="test-4"
          type="warning"
          message="Warning message"
          onClose={vi.fn()}
        />
      )
      
      expect(screen.getByText('Warning message')).toBeInTheDocument()
      expect(screen.getByRole('status')).toBeInTheDocument()
      // AlertTriangle icon should be present
      const container = screen.getByRole('status')
      expect(container.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Close button functionality', () => {
    it('renders close button when closable is true (default)', () => {
      render(
        <Toast
          id="test-5"
          type="success"
          message="Test message"
          onClose={vi.fn()}
        />
      )
      
      const closeButton = screen.getByRole('button', { name: /close notification/i })
      expect(closeButton).toBeInTheDocument()
    })

    it('does not render close button when closable is false', () => {
      render(
        <Toast
          id="test-6"
          type="success"
          message="Test message"
          closable={false}
          onClose={vi.fn()}
        />
      )
      
      const closeButton = screen.queryByRole('button', { name: /close notification/i })
      expect(closeButton).not.toBeInTheDocument()
    })

    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup({ delay: null })
      const onCloseMock = vi.fn()
      
      render(
        <Toast
          id="test-7"
          type="success"
          message="Test message"
          onClose={onCloseMock}
        />
      )
      
      const closeButton = screen.getByRole('button', { name: /close notification/i })
      await user.click(closeButton)
      
      // Wait for the exit animation (200ms)
      vi.advanceTimersByTime(200)
      
      expect(onCloseMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('Auto-dismiss timer', () => {
    it('auto-dismisses after default duration (3000ms)', () => {
      const onCloseMock = vi.fn()
      
      render(
        <Toast
          id="test-8"
          type="success"
          message="Test message"
          onClose={onCloseMock}
        />
      )
      
      expect(onCloseMock).not.toHaveBeenCalled()
      
      // Fast-forward time by 3000ms (default duration)
      vi.advanceTimersByTime(3000)
      
      // Wait for exit animation (200ms)
      vi.advanceTimersByTime(200)
      
      expect(onCloseMock).toHaveBeenCalledTimes(1)
    })

    it('auto-dismisses after custom duration', () => {
      const onCloseMock = vi.fn()
      const customDuration = 5000
      
      render(
        <Toast
          id="test-9"
          type="success"
          message="Test message"
          duration={customDuration}
          onClose={onCloseMock}
        />
      )
      
      expect(onCloseMock).not.toHaveBeenCalled()
      
      // Fast-forward time by custom duration
      vi.advanceTimersByTime(customDuration)
      
      // Wait for exit animation (200ms)
      vi.advanceTimersByTime(200)
      
      expect(onCloseMock).toHaveBeenCalledTimes(1)
    })

    it('does not auto-dismiss when duration is 0', () => {
      const onCloseMock = vi.fn()
      
      render(
        <Toast
          id="test-10"
          type="success"
          message="Test message"
          duration={0}
          onClose={onCloseMock}
        />
      )
      
      // Fast-forward time significantly
      vi.advanceTimersByTime(10000)
      
      expect(onCloseMock).not.toHaveBeenCalled()
    })

    it('clears timer when component unmounts', () => {
      const onCloseMock = vi.fn()
      
      const { unmount } = render(
        <Toast
          id="test-11"
          type="success"
          message="Test message"
          duration={3000}
          onClose={onCloseMock}
        />
      )
      
      // Unmount before timer completes
      vi.advanceTimersByTime(1000)
      unmount()
      
      // Continue time
      vi.advanceTimersByTime(3000)
      
      // onClose should not be called after unmount
      expect(onCloseMock).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(
        <Toast
          id="test-12"
          type="success"
          message="Test message"
          onClose={vi.fn()}
        />
      )
      
      const toast = screen.getByRole('status')
      expect(toast).toHaveAttribute('aria-live', 'polite')
      expect(toast).toHaveAttribute('aria-atomic', 'true')
    })

    it('close button has accessible label', () => {
      render(
        <Toast
          id="test-13"
          type="success"
          message="Test message"
          onClose={vi.fn()}
        />
      )
      
      const closeButton = screen.getByRole('button', { name: /close notification/i })
      expect(closeButton).toHaveAttribute('aria-label', 'Close notification')
    })
  })
})
