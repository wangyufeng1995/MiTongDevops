/**
 * Accessibility tests for notification components
 * Tests ARIA attributes, keyboard navigation, and screen reader support
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Toast from './Toast'
import AlertBox from './AlertBox'
import NotificationModal from './Modal'
import EmptyState from './EmptyState'
import LoadingSpinner from './LoadingSpinner'
import ProgressBar from './ProgressBar'
import { ThemeProvider } from '../../contexts/ThemeContext'

// Helper to wrap components with providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  )
}

describe('Accessibility Tests', () => {
  beforeEach(() => {
    // Mock matchMedia for theme detection
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

  describe('Toast Accessibility', () => {
    it('should have correct ARIA role for success toast', () => {
      render(
        <Toast
          id="test-toast"
          type="success"
          message="Success message"
          onClose={() => {}}
        />
      )

      const toast = screen.getByRole('status')
      expect(toast).toBeInTheDocument()
      expect(toast).toHaveAttribute('aria-live', 'polite')
      expect(toast).toHaveAttribute('aria-atomic', 'true')
    })

    it('should have correct ARIA role for error toast', () => {
      render(
        <Toast
          id="test-toast"
          type="error"
          message="Error message"
          onClose={() => {}}
        />
      )

      const toast = screen.getByRole('alert')
      expect(toast).toBeInTheDocument()
      expect(toast).toHaveAttribute('aria-live', 'assertive')
      expect(toast).toHaveAttribute('aria-atomic', 'true')
    })

    it('should have accessible close button', () => {
      render(
        <Toast
          id="test-toast"
          type="info"
          message="Info message"
          closable={true}
          onClose={() => {}}
        />
      )

      const closeButton = screen.getByLabelText('Close notification')
      expect(closeButton).toBeInTheDocument()
      expect(closeButton).toHaveAttribute('aria-label', 'Close notification')
    })
  })

  describe('AlertBox Accessibility', () => {
    it('should have correct ARIA role for error alert', () => {
      render(
        <AlertBox
          type="error"
          title="Error"
          message="Error message"
        />
      )

      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(alert).toHaveAttribute('aria-live', 'assertive')
    })

    it('should have correct ARIA role for info alert', () => {
      render(
        <AlertBox
          type="info"
          title="Information"
          message="Info message"
        />
      )

      const alert = screen.getByRole('status')
      expect(alert).toBeInTheDocument()
      expect(alert).toHaveAttribute('aria-live', 'polite')
    })

    it('should have accessible action buttons', () => {
      render(
        <AlertBox
          type="warning"
          message="Warning message"
          actions={[
            { label: 'Retry', onClick: () => {} },
            { label: 'Cancel', onClick: () => {}, variant: 'secondary' }
          ]}
        />
      )

      const retryButton = screen.getByText('Retry')
      const cancelButton = screen.getByText('Cancel')

      expect(retryButton).toBeInTheDocument()
      expect(cancelButton).toBeInTheDocument()
    })
  })

  describe('Modal Accessibility', () => {
    it('should have correct ARIA attributes', () => {
      render(
        <NotificationModal
          isOpen={true}
          onClose={() => {}}
          title="Test Modal"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      const modal = screen.getByRole('dialog')
      expect(modal).toBeInTheDocument()
      expect(modal).toHaveAttribute('aria-modal', 'true')
      expect(modal).toHaveAttribute('aria-labelledby', 'modal-title')
    })

    it('should have accessible title', () => {
      render(
        <NotificationModal
          isOpen={true}
          onClose={() => {}}
          title="Accessible Modal Title"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      const title = screen.getByText('Accessible Modal Title')
      expect(title).toBeInTheDocument()
      expect(title).toHaveAttribute('id', 'modal-title')
    })

    it('should have accessible close button', () => {
      render(
        <NotificationModal
          isOpen={true}
          onClose={() => {}}
          title="Test Modal"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      const closeButton = screen.getByLabelText('Close modal')
      expect(closeButton).toBeInTheDocument()
    })
  })

  describe('EmptyState Accessibility', () => {
    it('should have accessible action button', () => {
      renderWithProviders(
        <EmptyState
          title="No data"
          description="There is no data to display"
          action={{
            label: 'Add Data',
            onClick: () => {}
          }}
        />
      )

      const button = screen.getByText('Add Data')
      expect(button).toBeInTheDocument()
    })
  })

  describe('LoadingSpinner Accessibility', () => {
    it('should have correct ARIA attributes', () => {
      renderWithProviders(
        <LoadingSpinner text="Loading data..." />
      )

      const spinner = screen.getByRole('status')
      expect(spinner).toBeInTheDocument()
      expect(spinner).toHaveAttribute('aria-live', 'polite')
    })

    it('should have accessible text', () => {
      renderWithProviders(
        <LoadingSpinner text="Loading content..." />
      )

      expect(screen.getByText('Loading content...')).toBeInTheDocument()
    })
  })

  describe('ProgressBar Accessibility', () => {
    it('should have correct ARIA attributes', () => {
      renderWithProviders(
        <ProgressBar value={75} label="Progress" />
      )

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toBeInTheDocument()
      expect(progressBar).toHaveAttribute('aria-valuenow', '75')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    })

    it('should update aria-valuenow when value changes', () => {
      const { rerender } = renderWithProviders(
        <ProgressBar value={25} />
      )

      let progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '25')

      rerender(
        <ThemeProvider>
          <ProgressBar value={75} />
        </ThemeProvider>
      )

      progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '75')
    })
  })

  describe('Color Independence', () => {
    it('should use icons in addition to colors for status indication', () => {
      const { container: successContainer } = render(
        <Toast id="success" type="success" message="Success" onClose={() => {}} />
      )
      const { container: errorContainer } = render(
        <Toast id="error" type="error" message="Error" onClose={() => {}} />
      )
      const { container: infoContainer } = render(
        <Toast id="info" type="info" message="Info" onClose={() => {}} />
      )
      const { container: warningContainer } = render(
        <Toast id="warning" type="warning" message="Warning" onClose={() => {}} />
      )

      // Each toast should have an icon (svg element)
      expect(successContainer.querySelector('svg')).toBeInTheDocument()
      expect(errorContainer.querySelector('svg')).toBeInTheDocument()
      expect(infoContainer.querySelector('svg')).toBeInTheDocument()
      expect(warningContainer.querySelector('svg')).toBeInTheDocument()
    })

    it('should use icons in AlertBox for status indication', () => {
      const { container } = render(
        <AlertBox type="error" message="Error message" />
      )

      // AlertBox should have an icon
      expect(container.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should have focusable close button in Toast', () => {
      render(
        <Toast
          id="test"
          type="info"
          message="Test"
          closable={true}
          onClose={() => {}}
        />
      )

      const closeButton = screen.getByLabelText('Close notification')
      
      // Button should be focusable (not have tabindex="-1")
      expect(closeButton).not.toHaveAttribute('tabindex', '-1')
      expect(closeButton.tagName).toBe('BUTTON')
    })

    it('should have focusable buttons in AlertBox', () => {
      render(
        <AlertBox
          type="warning"
          message="Warning"
          actions={[
            { label: 'Action', onClick: () => {} }
          ]}
        />
      )

      const actionButton = screen.getByText('Action')
      expect(actionButton.tagName).toBe('BUTTON')
    })

    it('should have focusable close button in Modal', () => {
      render(
        <NotificationModal
          isOpen={true}
          onClose={() => {}}
          title="Test"
        >
          <div>Content</div>
        </NotificationModal>
      )

      const closeButton = screen.getByLabelText('Close modal')
      expect(closeButton.tagName).toBe('BUTTON')
    })
  })

  describe('Touch Target Size', () => {
    it('should have minimum 44px touch targets on mobile for Toast close button', () => {
      const { container } = render(
        <Toast
          id="test"
          type="info"
          message="Test"
          closable={true}
          onClose={() => {}}
        />
      )

      const closeButton = screen.getByLabelText('Close notification')
      
      // Check for mobile-friendly classes
      expect(closeButton.className).toContain('min-w-[44px]')
      expect(closeButton.className).toContain('min-h-[44px]')
    })

    it('should have minimum 44px touch targets on mobile for AlertBox close button', () => {
      render(
        <AlertBox
          type="info"
          message="Test"
          closable={true}
          onClose={() => {}}
        />
      )

      const closeButton = screen.getByLabelText('Close alert')
      
      // Check for mobile-friendly classes
      expect(closeButton.className).toContain('min-w-[44px]')
      expect(closeButton.className).toContain('min-h-[44px]')
    })

    it('should have minimum 44px touch targets for AlertBox action buttons', () => {
      render(
        <AlertBox
          type="warning"
          message="Warning"
          actions={[
            { label: 'Action', onClick: () => {} }
          ]}
        />
      )

      const actionButton = screen.getByText('Action')
      
      // Check for mobile-friendly classes
      expect(actionButton.className).toContain('min-h-[44px]')
    })
  })
})
