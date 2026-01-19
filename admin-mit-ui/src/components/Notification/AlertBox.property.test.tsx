import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import * as fc from 'fast-check'
import AlertBox, { AlertType } from './AlertBox'

/**
 * Property-Based Tests for AlertBox Component
 * Feature: ai-assistant-notification-enhancement
 */

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

describe('AlertBox Property-Based Tests', () => {
  /**
   * Property 5: Error Message Completeness
   * Validates: Requirements 4.1, 4.3
   * 
   * For any error notification, it should contain both an error icon 
   * and a descriptive message.
   */
  describe('Property 5: Error Message Completeness', () => {
    it('should always display both error icon and message for error alerts', () => {
      // Arbitrary for error messages (non-empty strings)
      const errorMessageArbitrary = fc.string({ minLength: 1, maxLength: 500 })

      // Arbitrary for optional title
      const optionalTitleArbitrary = fc.option(
        fc.string({ minLength: 1, maxLength: 100 }),
        { nil: undefined }
      )

      // Arbitrary for closable state
      const closableArbitrary = fc.boolean()

      fc.assert(
        fc.property(
          errorMessageArbitrary,
          optionalTitleArbitrary,
          closableArbitrary,
          (message, title, closable) => {
            // Render error alert with generated properties
            const { container } = render(
              <AlertBox
                type="error"
                message={message}
                title={title}
                closable={closable}
              />
            )

            // Verify the alert container exists with correct role
            const alertElement = container.querySelector('[role="alert"]')
            expect(alertElement).toBeTruthy()

            // Verify error icon is present
            // AlertBox uses XCircle icon for error type
            const iconElement = alertElement?.querySelector('svg')
            expect(iconElement).toBeTruthy()
            expect(iconElement).not.toBeNull()

            // Verify the message is displayed
            expect(alertElement?.textContent).toContain(message)

            // Verify message is not empty
            const messageText = alertElement?.textContent || ''
            expect(messageText.trim().length).toBeGreaterThan(0)

            // If title is provided, verify it's also displayed
            if (title) {
              expect(alertElement?.textContent).toContain(title)
            }

            return true
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design
      )
    })

    it('should display error icon even with very long messages', () => {
      // Test with various message lengths including very long ones
      const longMessageArbitrary = fc.string({ minLength: 100, maxLength: 1000 })

      fc.assert(
        fc.property(
          longMessageArbitrary,
          (message) => {
            const { container } = render(
              <AlertBox
                type="error"
                message={message}
              />
            )

            const alertElement = container.querySelector('[role="alert"]')
            
            // Icon should be present regardless of message length
            const iconElement = alertElement?.querySelector('svg')
            expect(iconElement).toBeTruthy()

            // Message should be fully displayed
            expect(alertElement?.textContent).toContain(message)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should display error icon even with special characters in message', () => {
      // Test with messages containing special characters
      const specialCharMessageArbitrary = fc.string({ minLength: 1, maxLength: 200 })

      fc.assert(
        fc.property(
          specialCharMessageArbitrary,
          (message) => {
            const { container } = render(
              <AlertBox
                type="error"
                message={message}
              />
            )

            const alertElement = container.querySelector('[role="alert"]')
            
            // Icon should be present regardless of message content
            const iconElement = alertElement?.querySelector('svg')
            expect(iconElement).toBeTruthy()

            // Message should be displayed
            const displayedText = alertElement?.textContent || ''
            expect(displayedText.length).toBeGreaterThan(0)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should display error icon with custom icon override', () => {
      const messageArbitrary = fc.string({ minLength: 1, maxLength: 200 })

      fc.assert(
        fc.property(
          messageArbitrary,
          (message) => {
            const CustomIcon = () => <div className="custom-error-icon">!</div>

            const { container } = render(
              <AlertBox
                type="error"
                message={message}
                icon={<CustomIcon />}
              />
            )

            const alertElement = container.querySelector('[role="alert"]')
            
            // Custom icon should be present
            const customIcon = container.querySelector('.custom-error-icon')
            expect(customIcon).toBeTruthy()

            // Message should still be displayed
            expect(alertElement?.textContent).toContain(message)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain error icon and message with action buttons', () => {
      const messageArbitrary = fc.string({ minLength: 1, maxLength: 200 })
      const actionLabelArbitrary = fc.string({ minLength: 1, maxLength: 50 })

      fc.assert(
        fc.property(
          messageArbitrary,
          actionLabelArbitrary,
          (message, actionLabel) => {
            const actions = [
              { label: actionLabel, onClick: vi.fn() }
            ]

            const { container } = render(
              <AlertBox
                type="error"
                message={message}
                actions={actions}
              />
            )

            const alertElement = container.querySelector('[role="alert"]')
            
            // Icon should be present even with action buttons
            const iconElement = alertElement?.querySelector('svg')
            expect(iconElement).toBeTruthy()

            // Message should be displayed
            expect(alertElement?.textContent).toContain(message)

            // Action button should also be present
            expect(alertElement?.textContent).toContain(actionLabel)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 6: Error Recovery Actions
   * Validates: Requirements 4.4
   * 
   * For any recoverable error, the error notification should include 
   * a retry or refresh button.
   */
  describe('Property 6: Error Recovery Actions', () => {
    it('should include retry or refresh button for recoverable errors', () => {
      // Arbitrary for error messages
      const errorMessageArbitrary = fc.string({ minLength: 1, maxLength: 200 })

      // Arbitrary for action button labels (retry, refresh, or similar recovery actions)
      const recoveryActionLabelArbitrary = fc.constantFrom(
        'Retry',
        'Refresh',
        'Try Again',
        'Reload',
        'Retry Operation'
      )

      // Arbitrary for optional title
      const optionalTitleArbitrary = fc.option(
        fc.string({ minLength: 1, maxLength: 100 }),
        { nil: undefined }
      )

      fc.assert(
        fc.property(
          errorMessageArbitrary,
          recoveryActionLabelArbitrary,
          optionalTitleArbitrary,
          (message, actionLabel, title) => {
            const mockOnClick = vi.fn()
            const actions = [
              { label: actionLabel, onClick: mockOnClick }
            ]

            const { container } = render(
              <AlertBox
                type="error"
                message={message}
                title={title}
                actions={actions}
              />
            )

            const alertElement = container.querySelector('[role="alert"]')
            expect(alertElement).toBeTruthy()

            // Verify the recovery action button is present
            const buttons = container.querySelectorAll('button')
            const actionButtons = Array.from(buttons).filter(
              btn => !btn.getAttribute('aria-label')?.includes('Close')
            )
            
            expect(actionButtons.length).toBeGreaterThan(0)

            // Verify the action button contains the recovery label
            const hasRecoveryButton = actionButtons.some(
              btn => btn.textContent?.includes(actionLabel)
            )
            expect(hasRecoveryButton).toBe(true)

            // Verify the error message is still displayed
            expect(alertElement?.textContent).toContain(message)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should include multiple recovery actions when provided', () => {
      const errorMessageArbitrary = fc.string({ minLength: 1, maxLength: 200 })

      // Generate 1-3 recovery actions
      const recoveryActionsArbitrary = fc.array(
        fc.record({
          label: fc.constantFrom('Retry', 'Refresh', 'Try Again', 'Cancel'),
          variant: fc.constantFrom('primary', 'secondary', 'danger')
        }),
        { minLength: 1, maxLength: 3 }
      )

      fc.assert(
        fc.property(
          errorMessageArbitrary,
          recoveryActionsArbitrary,
          (message, recoveryActions) => {
            const actions = recoveryActions.map(action => ({
              label: action.label,
              onClick: vi.fn(),
              variant: action.variant as 'primary' | 'secondary' | 'danger'
            }))

            const { container } = render(
              <AlertBox
                type="error"
                message={message}
                actions={actions}
              />
            )

            const alertElement = container.querySelector('[role="alert"]')
            expect(alertElement).toBeTruthy()

            // Verify all action buttons are present
            const buttons = container.querySelectorAll('button')
            const actionButtons = Array.from(buttons).filter(
              btn => !btn.getAttribute('aria-label')?.includes('Close')
            )

            // Should have at least as many action buttons as provided
            expect(actionButtons.length).toBeGreaterThanOrEqual(recoveryActions.length)

            // Verify each action label is present
            recoveryActions.forEach(action => {
              const hasButton = actionButtons.some(
                btn => btn.textContent?.includes(action.label)
              )
              expect(hasButton).toBe(true)
            })

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain recovery actions with different error message lengths', () => {
      // Test with various message lengths
      const messageLengthArbitrary = fc.oneof(
        fc.string({ minLength: 1, maxLength: 50 }),    // Short
        fc.string({ minLength: 100, maxLength: 300 }),  // Medium
        fc.string({ minLength: 500, maxLength: 1000 })  // Long
      )

      const actionLabelArbitrary = fc.constantFrom('Retry', 'Refresh', 'Try Again')

      fc.assert(
        fc.property(
          messageLengthArbitrary,
          actionLabelArbitrary,
          (message, actionLabel) => {
            const actions = [
              { label: actionLabel, onClick: vi.fn() }
            ]

            const { container } = render(
              <AlertBox
                type="error"
                message={message}
                actions={actions}
              />
            )

            const alertElement = container.querySelector('[role="alert"]')
            
            // Recovery button should be present regardless of message length
            const buttons = container.querySelectorAll('button')
            const actionButtons = Array.from(buttons).filter(
              btn => !btn.getAttribute('aria-label')?.includes('Close')
            )

            expect(actionButtons.length).toBeGreaterThan(0)
            
            const hasRecoveryButton = actionButtons.some(
              btn => btn.textContent?.includes(actionLabel)
            )
            expect(hasRecoveryButton).toBe(true)

            // Message should still be displayed
            expect(alertElement?.textContent).toContain(message)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should include recovery actions alongside close button', () => {
      const errorMessageArbitrary = fc.string({ minLength: 1, maxLength: 200 })
      const actionLabelArbitrary = fc.constantFrom('Retry', 'Refresh')
      const closableArbitrary = fc.boolean()

      fc.assert(
        fc.property(
          errorMessageArbitrary,
          actionLabelArbitrary,
          closableArbitrary,
          (message, actionLabel, closable) => {
            const actions = [
              { label: actionLabel, onClick: vi.fn() }
            ]

            const { container } = render(
              <AlertBox
                type="error"
                message={message}
                actions={actions}
                closable={closable}
              />
            )

            const alertElement = container.querySelector('[role="alert"]')
            expect(alertElement).toBeTruthy()

            // Verify recovery action button is present
            const buttons = container.querySelectorAll('button')
            const actionButtons = Array.from(buttons).filter(
              btn => !btn.getAttribute('aria-label')?.includes('Close')
            )

            expect(actionButtons.length).toBeGreaterThan(0)
            
            const hasRecoveryButton = actionButtons.some(
              btn => btn.textContent?.includes(actionLabel)
            )
            expect(hasRecoveryButton).toBe(true)

            // If closable, verify close button is also present
            if (closable) {
              const closeButton = container.querySelector('[aria-label="Close alert"]')
              expect(closeButton).toBeTruthy()
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should support different button variants for recovery actions', () => {
      const errorMessageArbitrary = fc.string({ minLength: 1, maxLength: 200 })
      const buttonVariantArbitrary = fc.constantFrom<'primary' | 'secondary' | 'danger'>(
        'primary',
        'secondary',
        'danger'
      )

      fc.assert(
        fc.property(
          errorMessageArbitrary,
          buttonVariantArbitrary,
          (message, variant) => {
            const actions = [
              { label: 'Retry', onClick: vi.fn(), variant }
            ]

            const { container } = render(
              <AlertBox
                type="error"
                message={message}
                actions={actions}
              />
            )

            const alertElement = container.querySelector('[role="alert"]')
            expect(alertElement).toBeTruthy()

            // Verify the action button is present
            const buttons = container.querySelectorAll('button')
            const actionButtons = Array.from(buttons).filter(
              btn => !btn.getAttribute('aria-label')?.includes('Close')
            )

            expect(actionButtons.length).toBeGreaterThan(0)
            
            const retryButton = actionButtons.find(
              btn => btn.textContent?.includes('Retry')
            )
            expect(retryButton).toBeTruthy()

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
