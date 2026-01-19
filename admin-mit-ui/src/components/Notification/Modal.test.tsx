import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationModal from './Modal'

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

describe('Modal Component', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  describe('Modal open/close', () => {
    it('renders modal when isOpen is true', () => {
      render(
        <NotificationModal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Test Modal')).toBeInTheDocument()
      expect(screen.getByText('Modal content')).toBeInTheDocument()
    })

    it('does not render modal when isOpen is false', () => {
      render(
        <NotificationModal
          isOpen={false}
          onClose={vi.fn()}
          title="Test Modal"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup()
      const onCloseMock = vi.fn()

      render(
        <NotificationModal
          isOpen={true}
          onClose={onCloseMock}
          title="Test Modal"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      const closeButton = screen.getByRole('button', { name: /close modal/i })
      await user.click(closeButton)

      // Wait for the close animation
      await waitFor(() => {
        expect(onCloseMock).toHaveBeenCalledTimes(1)
      }, { timeout: 300 })
    })

    it('prevents body scroll when modal is open', () => {
      const { rerender } = render(
        <NotificationModal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      expect(document.body.style.overflow).toBe('hidden')

      rerender(
        <NotificationModal
          isOpen={false}
          onClose={vi.fn()}
          title="Test Modal"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      expect(document.body.style.overflow).toBe('')
    })
  })

  describe('Overlay click', () => {
    it('closes modal when overlay is clicked and closeOnOverlayClick is true (default)', async () => {
      const user = userEvent.setup()
      const onCloseMock = vi.fn()

      render(
        <NotificationModal
          isOpen={true}
          onClose={onCloseMock}
          title="Test Modal"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      // Find the overlay element (the one with aria-hidden="true")
      const overlay = document.querySelector('[aria-hidden="true"]') as HTMLElement
      expect(overlay).toBeInTheDocument()
      
      await user.click(overlay)

      await waitFor(() => {
        expect(onCloseMock).toHaveBeenCalledTimes(1)
      }, { timeout: 300 })
    })

    it('does not close modal when overlay is clicked and closeOnOverlayClick is false', async () => {
      const user = userEvent.setup()
      const onCloseMock = vi.fn()

      render(
        <NotificationModal
          isOpen={true}
          onClose={onCloseMock}
          title="Test Modal"
          closeOnOverlayClick={false}
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      const overlay = document.querySelector('[aria-hidden="true"]') as HTMLElement
      await user.click(overlay)

      // Wait a bit to ensure onClose is not called
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(onCloseMock).not.toHaveBeenCalled()
    })

    it('does not close modal when clicking inside modal content', async () => {
      const user = userEvent.setup()
      const onCloseMock = vi.fn()

      render(
        <NotificationModal
          isOpen={true}
          onClose={onCloseMock}
          title="Test Modal"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      const content = screen.getByText('Modal content')
      await user.click(content)

      // Wait a bit to ensure onClose is not called
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(onCloseMock).not.toHaveBeenCalled()
    })
  })

  describe('ESC key close', () => {
    it('closes modal when ESC key is pressed and closeOnEsc is true (default)', async () => {
      const user = userEvent.setup()
      const onCloseMock = vi.fn()

      render(
        <NotificationModal
          isOpen={true}
          onClose={onCloseMock}
          title="Test Modal"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      await user.keyboard('{Escape}')

      await waitFor(() => {
        expect(onCloseMock).toHaveBeenCalledTimes(1)
      }, { timeout: 300 })
    })

    it('does not close modal when ESC key is pressed and closeOnEsc is false', async () => {
      const user = userEvent.setup()
      const onCloseMock = vi.fn()

      render(
        <NotificationModal
          isOpen={true}
          onClose={onCloseMock}
          title="Test Modal"
          closeOnEsc={false}
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      await user.keyboard('{Escape}')

      // Wait a bit to ensure onClose is not called
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(onCloseMock).not.toHaveBeenCalled()
    })
  })

  describe('Modal sizes', () => {
    it('renders with default size (md)', () => {
      render(
        <NotificationModal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      const dialog = screen.getByRole('dialog')
      const modalContent = dialog.querySelector('[tabindex="-1"]')
      expect(modalContent).toHaveClass('max-w-[600px]')
    })

    it('renders with small size', () => {
      render(
        <NotificationModal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
          size="sm"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      const dialog = screen.getByRole('dialog')
      const modalContent = dialog.querySelector('[tabindex="-1"]')
      expect(modalContent).toHaveClass('max-w-[400px]')
    })

    it('renders with large size', () => {
      render(
        <NotificationModal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
          size="lg"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      const dialog = screen.getByRole('dialog')
      const modalContent = dialog.querySelector('[tabindex="-1"]')
      expect(modalContent).toHaveClass('max-w-[800px]')
    })

    it('renders with extra large size', () => {
      render(
        <NotificationModal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
          size="xl"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      const dialog = screen.getByRole('dialog')
      const modalContent = dialog.querySelector('[tabindex="-1"]')
      expect(modalContent).toHaveClass('max-w-[1000px]')
    })
  })

  describe('Footer', () => {
    it('renders footer when provided', () => {
      render(
        <NotificationModal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
          footer={
            <div>
              <button>Cancel</button>
              <button>Confirm</button>
            </div>
          }
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByText('Confirm')).toBeInTheDocument()
    })

    it('does not render footer when not provided', () => {
      render(
        <NotificationModal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      // Footer should not be in the document
      const dialog = screen.getByRole('dialog')
      const footers = dialog.querySelectorAll('.border-t')
      // Header has border-b, not border-t, so footer should not exist
      expect(footers.length).toBe(0)
    })
  })

  describe('Accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(
        <NotificationModal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title')
    })

    it('has accessible title', () => {
      render(
        <NotificationModal
          isOpen={true}
          onClose={vi.fn()}
          title="Accessible Modal Title"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      const title = screen.getByText('Accessible Modal Title')
      expect(title).toHaveAttribute('id', 'modal-title')
    })

    it('close button has accessible label', () => {
      render(
        <NotificationModal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      const closeButton = screen.getByRole('button', { name: /close modal/i })
      expect(closeButton).toHaveAttribute('aria-label', 'Close modal')
    })

    it('focuses modal content when opened', async () => {
      render(
        <NotificationModal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
        >
          <div>Modal content</div>
        </NotificationModal>
      )

      await waitFor(() => {
        const dialog = screen.getByRole('dialog')
        const modalContent = dialog.querySelector('[tabindex="-1"]')
        expect(document.activeElement).toBe(modalContent)
      }, { timeout: 200 })
    })
  })
})
