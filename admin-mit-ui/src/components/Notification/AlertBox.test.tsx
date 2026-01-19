import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AlertBox from './AlertBox'

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

describe('AlertBox Component', () => {
  describe('Rendering different types', () => {
    it('renders success alert with correct message and icon', () => {
      render(
        <AlertBox
          type="success"
          message="Operation completed successfully"
        />
      )
      
      expect(screen.getByText('Operation completed successfully')).toBeInTheDocument()
      expect(screen.getByRole('status')).toBeInTheDocument()
      // CheckCircle icon should be present
      const container = screen.getByRole('status')
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('renders error alert with correct message and icon', () => {
      render(
        <AlertBox
          type="error"
          message="An error occurred"
        />
      )
      
      expect(screen.getByText('An error occurred')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toBeInTheDocument()
      // XCircle icon should be present
      const container = screen.getByRole('alert')
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('renders info alert with correct message and icon', () => {
      render(
        <AlertBox
          type="info"
          message="Here is some information"
        />
      )
      
      expect(screen.getByText('Here is some information')).toBeInTheDocument()
      expect(screen.getByRole('status')).toBeInTheDocument()
      // Info icon should be present
      const container = screen.getByRole('status')
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('renders warning alert with correct message and icon', () => {
      render(
        <AlertBox
          type="warning"
          message="Please be careful"
        />
      )
      
      expect(screen.getByText('Please be careful')).toBeInTheDocument()
      expect(screen.getByRole('status')).toBeInTheDocument()
      // AlertTriangle icon should be present
      const container = screen.getByRole('status')
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('renders alert with title and message', () => {
      render(
        <AlertBox
          type="success"
          title="Success"
          message="Your changes have been saved"
        />
      )
      
      expect(screen.getByText('Success')).toBeInTheDocument()
      expect(screen.getByText('Your changes have been saved')).toBeInTheDocument()
    })

    it('renders alert with custom icon', () => {
      const CustomIcon = () => <div data-testid="custom-icon">Custom</div>
      
      render(
        <AlertBox
          type="info"
          message="Test message"
          icon={<CustomIcon />}
        />
      )
      
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
    })
  })

  describe('Action buttons functionality', () => {
    it('renders action buttons when provided', () => {
      const actions = [
        { label: 'Retry', onClick: vi.fn() },
        { label: 'Cancel', onClick: vi.fn(), variant: 'secondary' as const }
      ]
      
      render(
        <AlertBox
          type="error"
          message="Failed to save"
          actions={actions}
        />
      )
      
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('calls onClick handler when action button is clicked', async () => {
      const user = userEvent.setup()
      const onRetryMock = vi.fn()
      const actions = [
        { label: 'Retry', onClick: onRetryMock }
      ]
      
      render(
        <AlertBox
          type="error"
          message="Failed to save"
          actions={actions}
        />
      )
      
      const retryButton = screen.getByRole('button', { name: 'Retry' })
      await user.click(retryButton)
      
      expect(onRetryMock).toHaveBeenCalledTimes(1)
    })

    it('renders multiple action buttons and calls correct handlers', async () => {
      const user = userEvent.setup()
      const onRetryMock = vi.fn()
      const onCancelMock = vi.fn()
      const actions = [
        { label: 'Retry', onClick: onRetryMock },
        { label: 'Cancel', onClick: onCancelMock, variant: 'secondary' as const }
      ]
      
      render(
        <AlertBox
          type="error"
          message="Failed to save"
          actions={actions}
        />
      )
      
      const retryButton = screen.getByRole('button', { name: 'Retry' })
      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      
      await user.click(retryButton)
      expect(onRetryMock).toHaveBeenCalledTimes(1)
      expect(onCancelMock).not.toHaveBeenCalled()
      
      await user.click(cancelButton)
      expect(onCancelMock).toHaveBeenCalledTimes(1)
      expect(onRetryMock).toHaveBeenCalledTimes(1)
    })

    it('renders danger variant action button', () => {
      const actions = [
        { label: 'Delete', onClick: vi.fn(), variant: 'danger' as const }
      ]
      
      render(
        <AlertBox
          type="warning"
          message="This action cannot be undone"
          actions={actions}
        />
      )
      
      const deleteButton = screen.getByRole('button', { name: 'Delete' })
      expect(deleteButton).toBeInTheDocument()
    })

    it('does not render action buttons when actions array is empty', () => {
      render(
        <AlertBox
          type="info"
          message="Test message"
          actions={[]}
        />
      )
      
      // Should only have close button if closable
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(1) // Only close button
    })
  })

  describe('Close button functionality', () => {
    it('renders close button when closable is true (default)', () => {
      render(
        <AlertBox
          type="success"
          message="Test message"
        />
      )
      
      const closeButton = screen.getByRole('button', { name: /close alert/i })
      expect(closeButton).toBeInTheDocument()
    })

    it('does not render close button when closable is false', () => {
      render(
        <AlertBox
          type="success"
          message="Test message"
          closable={false}
        />
      )
      
      const closeButton = screen.queryByRole('button', { name: /close alert/i })
      expect(closeButton).not.toBeInTheDocument()
    })

    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup()
      const onCloseMock = vi.fn()
      
      render(
        <AlertBox
          type="success"
          message="Test message"
          onClose={onCloseMock}
        />
      )
      
      const closeButton = screen.getByRole('button', { name: /close alert/i })
      await user.click(closeButton)
      
      expect(onCloseMock).toHaveBeenCalledTimes(1)
    })

    it('renders both close button and action buttons', () => {
      const actions = [
        { label: 'Retry', onClick: vi.fn() }
      ]
      
      render(
        <AlertBox
          type="error"
          message="Test message"
          actions={actions}
          closable={true}
        />
      )
      
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /close alert/i })).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has role="alert" for error type', () => {
      render(
        <AlertBox
          type="error"
          message="Error message"
        />
      )
      
      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('aria-live', 'assertive')
      expect(alert).toHaveAttribute('aria-atomic', 'true')
    })

    it('has role="status" for non-error types', () => {
      render(
        <AlertBox
          type="success"
          message="Success message"
        />
      )
      
      const status = screen.getByRole('status')
      expect(status).toHaveAttribute('aria-live', 'polite')
      expect(status).toHaveAttribute('aria-atomic', 'true')
    })

    it('close button has accessible label', () => {
      render(
        <AlertBox
          type="info"
          message="Test message"
        />
      )
      
      const closeButton = screen.getByRole('button', { name: /close alert/i })
      expect(closeButton).toHaveAttribute('aria-label', 'Close alert')
    })
  })
})
