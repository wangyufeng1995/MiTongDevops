import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import * as fc from 'fast-check'
import Toast, { ToastType } from './Toast'
import AlertBox, { AlertType } from './AlertBox'
import NotificationModal from './Modal'
import EmptyState from './EmptyState'
import LoadingSpinner from './LoadingSpinner'
import ProgressBar from './ProgressBar'

/**
 * Property-Based Tests for Accessibility Features
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

describe('Accessibility Property-Based Tests', () => {
  afterEach(() => {
    cleanup()
  })

  /**
   * Property 14: ARIA Attributes Presence
   * Validates: Requirements 12.1
   * 
   * For any notification component, appropriate ARIA attributes should be set for accessibility.
   */
  describe('Property 14: ARIA Attributes Presence', () => {
    it('should have appropriate ARIA attributes for any Toast notification', () => {
      const toastTypeArbitrary = fc.constantFrom<ToastType>(
        'success',
        'error',
        'info',
        'warning'
      )
      const messageArbitrary = fc.string({ minLength: 1, maxLength: 200 })
      const idArbitrary = fc.string({ minLength: 1, maxLength: 50 })

      fc.assert(
        fc.property(
          toastTypeArbitrary,
          messageArbitrary,
          idArbitrary,
          (type, message, id) => {
            const { container } = render(
              <Toast
                id={id}
                type={type}
                message={message}
                onClose={vi.fn()}
                duration={0}
              />
            )

            // Toast should have role attribute
            const toastElement = container.querySelector('[role]')
            expect(toastElement).toBeTruthy()
            
            // Should have either role="status" or role="alert"
            const role = toastElement?.getAttribute('role')
            expect(['status', 'alert']).toContain(role)

            // Should have aria-live attribute
            const ariaLive = toastElement?.getAttribute('aria-live')
            expect(ariaLive).toBeTruthy()
            expect(['polite', 'assertive']).toContain(ariaLive)

            // Should have aria-atomic attribute
            const ariaAtomic = toastElement?.getAttribute('aria-atomic')
            expect(ariaAtomic).toBe('true')

            // Close button should have aria-label
            const closeButton = container.querySelector('button[aria-label]')
            if (closeButton) {
              const ariaLabel = closeButton.getAttribute('aria-label')
              expect(ariaLabel).toBeTruthy()
              expect(ariaLabel?.toLowerCase()).toContain('close')
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should have appropriate ARIA attributes for any AlertBox', () => {
      const alertTypeArbitrary = fc.constantFrom<AlertType>(
        'success',
        'error',
        'info',
        'warning'
      )
      const messageArbitrary = fc.string({ minLength: 1, maxLength: 200 })
      const titleArbitrary = fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined })

      fc.assert(
        fc.property(
          alertTypeArbitrary,
          messageArbitrary,
          titleArbitrary,
          (type, message, title) => {
            const { container } = render(
              <AlertBox
                type={type}
                message={message}
                title={title}
                onClose={vi.fn()}
              />
            )

            // AlertBox should have role attribute
            const alertElement = container.querySelector('[role]')
            expect(alertElement).toBeTruthy()
            
            // Should have either role="status" or role="alert"
            const role = alertElement?.getAttribute('role')
            expect(['status', 'alert']).toContain(role)

            // Should have aria-live attribute
            const ariaLive = alertElement?.getAttribute('aria-live')
            expect(ariaLive).toBeTruthy()
            expect(['polite', 'assertive']).toContain(ariaLive)

            // Should have aria-atomic attribute
            const ariaAtomic = alertElement?.getAttribute('aria-atomic')
            expect(ariaAtomic).toBe('true')

            // Close button should have aria-label
            const closeButton = container.querySelector('button[aria-label]')
            if (closeButton) {
              const ariaLabel = closeButton.getAttribute('aria-label')
              expect(ariaLabel).toBeTruthy()
              expect(ariaLabel?.toLowerCase()).toContain('close')
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should have appropriate ARIA attributes for any Modal', () => {
      const titleArbitrary = fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 1)
      const contentArbitrary = fc.string({ minLength: 2, maxLength: 500 }).filter(s => s.trim().length > 1)

      fc.assert(
        fc.property(
          titleArbitrary,
          contentArbitrary,
          (title, content) => {
            const { container } = render(
              <NotificationModal
                isOpen={true}
                onClose={vi.fn()}
                title={title}
              >
                {content}
              </NotificationModal>
            )

            try {
              // Modal should have role="dialog"
              const modalElement = container.querySelector('[role="dialog"]')
              expect(modalElement).toBeTruthy()

              // Should have aria-modal="true"
              const ariaModal = modalElement?.getAttribute('aria-modal')
              expect(ariaModal).toBe('true')

              // Should have aria-labelledby pointing to title
              const ariaLabelledBy = modalElement?.getAttribute('aria-labelledby')
              expect(ariaLabelledBy).toBeTruthy()

              // Title element should exist with matching ID
              const titleElement = container.querySelector(`#${ariaLabelledBy}`)
              expect(titleElement).toBeTruthy()
              expect(titleElement?.textContent).toBe(title)

              // Close button should have aria-label
              const closeButton = container.querySelector('button[aria-label*="Close"]')
              expect(closeButton).toBeTruthy()

              // Overlay should have aria-hidden
              const overlay = container.querySelector('[aria-hidden="true"]')
              expect(overlay).toBeTruthy()

              return true
            } finally {
              cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should have appropriate ARIA attributes for any EmptyState', () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })
      const descriptionArbitrary = fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined })

      fc.assert(
        fc.property(
          titleArbitrary,
          descriptionArbitrary,
          (title, description) => {
            const { container } = render(
              <EmptyState
                title={title}
                description={description}
              />
            )

            // EmptyState should have role="status"
            const emptyStateElement = container.querySelector('[role="status"]')
            expect(emptyStateElement).toBeTruthy()

            // Should have aria-label
            const ariaLabel = emptyStateElement?.getAttribute('aria-label')
            expect(ariaLabel).toBeTruthy()
            expect(ariaLabel).toBe(title)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should have appropriate ARIA attributes for any LoadingSpinner', () => {
      const textArbitrary = fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined })
      const sizeArbitrary = fc.constantFrom('sm', 'md', 'lg')

      fc.assert(
        fc.property(
          textArbitrary,
          sizeArbitrary,
          (text, size) => {
            const { container } = render(
              <LoadingSpinner
                text={text}
                size={size}
              />
            )

            // LoadingSpinner should have role="status"
            const spinnerElement = container.querySelector('[role="status"]')
            expect(spinnerElement).toBeTruthy()

            // Should have aria-live="polite"
            const ariaLive = spinnerElement?.getAttribute('aria-live')
            expect(ariaLive).toBe('polite')

            // Should have aria-label
            const ariaLabel = spinnerElement?.getAttribute('aria-label')
            expect(ariaLabel).toBeTruthy()

            // Icon should have aria-hidden="true"
            const icon = container.querySelector('svg[aria-hidden="true"]')
            expect(icon).toBeTruthy()

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should have appropriate ARIA attributes for any ProgressBar', () => {
      const valueArbitrary = fc.integer({ min: 0, max: 100 })
      const labelArbitrary = fc.option(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0 && !/[:\[\]]/.test(s)), 
        { nil: undefined }
      )

      fc.assert(
        fc.property(
          valueArbitrary,
          labelArbitrary,
          (value, label) => {
            const { container } = render(
              <ProgressBar
                value={value}
                label={label}
              />
            )

            // ProgressBar should have role="progressbar"
            const progressElement = container.querySelector('[role="progressbar"]')
            expect(progressElement).toBeTruthy()

            // Should have aria-valuenow
            const ariaValueNow = progressElement?.getAttribute('aria-valuenow')
            expect(ariaValueNow).toBeTruthy()
            expect(parseInt(ariaValueNow!)).toBe(value)

            // Should have aria-valuemin
            const ariaValueMin = progressElement?.getAttribute('aria-valuemin')
            expect(ariaValueMin).toBe('0')

            // Should have aria-valuemax
            const ariaValueMax = progressElement?.getAttribute('aria-valuemax')
            expect(ariaValueMax).toBe('100')

            // Should have aria-label
            const ariaLabel = progressElement?.getAttribute('aria-label')
            expect(ariaLabel).toBeTruthy()

            // If label is provided, should have aria-describedby
            if (label) {
              const ariaDescribedBy = progressElement?.getAttribute('aria-describedby')
              expect(ariaDescribedBy).toBeTruthy()
              
              // The element with that ID should exist and contain the label
              const labelElement = container.querySelector(`#${ariaDescribedBy}`)
              expect(labelElement).toBeTruthy()
              expect(labelElement?.textContent).toBe(label)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 15: Alert Role for Errors
   * Validates: Requirements 12.2
   * 
   * For any error notification, the role="alert" ARIA attribute should be present.
   */
  describe('Property 15: Alert Role for Errors', () => {
    it('should use role="alert" for any error Toast notification', () => {
      const messageArbitrary = fc.string({ minLength: 1, maxLength: 200 })
      const idArbitrary = fc.string({ minLength: 1, maxLength: 50 })

      fc.assert(
        fc.property(
          messageArbitrary,
          idArbitrary,
          (message, id) => {
            const { container } = render(
              <Toast
                id={id}
                type="error"
                message={message}
                onClose={vi.fn()}
                duration={0}
              />
            )

            // Error toast should have role="alert"
            const toastElement = container.querySelector('[role="alert"]')
            expect(toastElement).toBeTruthy()

            // Should have aria-live="assertive" for errors
            const ariaLive = toastElement?.getAttribute('aria-live')
            expect(ariaLive).toBe('assertive')

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should use role="alert" for any error AlertBox', () => {
      const messageArbitrary = fc.string({ minLength: 1, maxLength: 200 })
      const titleArbitrary = fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined })

      fc.assert(
        fc.property(
          messageArbitrary,
          titleArbitrary,
          (message, title) => {
            const { container } = render(
              <AlertBox
                type="error"
                message={message}
                title={title}
                onClose={vi.fn()}
              />
            )

            // Error alert should have role="alert"
            const alertElement = container.querySelector('[role="alert"]')
            expect(alertElement).toBeTruthy()

            // Should have aria-live="assertive" for errors
            const ariaLive = alertElement?.getAttribute('aria-live')
            expect(ariaLive).toBe('assertive')

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should NOT use role="alert" for non-error notifications', () => {
      const nonErrorTypeArbitrary = fc.constantFrom<ToastType | AlertType>(
        'success',
        'info',
        'warning'
      )
      const messageArbitrary = fc.string({ minLength: 1, maxLength: 200 })

      fc.assert(
        fc.property(
          nonErrorTypeArbitrary,
          messageArbitrary,
          (type, message) => {
            // Test Toast
            const { container: toastContainer } = render(
              <Toast
                id={`test-${type}`}
                type={type as ToastType}
                message={message}
                onClose={vi.fn()}
                duration={0}
              />
            )

            // Non-error toast should have role="status", not role="alert"
            const toastElement = toastContainer.querySelector('[role="status"]')
            expect(toastElement).toBeTruthy()
            
            const toastAlertElement = toastContainer.querySelector('[role="alert"]')
            expect(toastAlertElement).toBeNull()

            cleanup()

            // Test AlertBox
            const { container: alertContainer } = render(
              <AlertBox
                type={type as AlertType}
                message={message}
                onClose={vi.fn()}
              />
            )

            // Non-error alert should have role="status", not role="alert"
            const alertElement = alertContainer.querySelector('[role="status"]')
            expect(alertElement).toBeTruthy()
            
            const alertAlertElement = alertContainer.querySelector('[role="alert"]')
            expect(alertAlertElement).toBeNull()

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 19: Color-Independent Status
   * Validates: Requirements 12.6
   * 
   * For any status indication using color, there should also be an icon and/or text label.
   */
  describe('Property 19: Color-Independent Status', () => {
    it('should have both icon and text for any Toast notification', () => {
      const toastTypeArbitrary = fc.constantFrom<ToastType>(
        'success',
        'error',
        'info',
        'warning'
      )
      const messageArbitrary = fc.string({ minLength: 1, maxLength: 200 })

      fc.assert(
        fc.property(
          toastTypeArbitrary,
          messageArbitrary,
          (type, message) => {
            const { container } = render(
              <Toast
                id={`test-${type}`}
                type={type}
                message={message}
                onClose={vi.fn()}
                duration={0}
              />
            )

            // Should have an icon (SVG element)
            const icon = container.querySelector('svg')
            expect(icon).toBeTruthy()

            // Should have text content (message)
            const toastElement = container.querySelector('[role]')
            expect(toastElement?.textContent).toContain(message)

            // Status is indicated by BOTH icon AND text, not just color
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should have both icon and text for any AlertBox', () => {
      const alertTypeArbitrary = fc.constantFrom<AlertType>(
        'success',
        'error',
        'info',
        'warning'
      )
      const messageArbitrary = fc.string({ minLength: 1, maxLength: 200 })

      fc.assert(
        fc.property(
          alertTypeArbitrary,
          messageArbitrary,
          (type, message) => {
            const { container } = render(
              <AlertBox
                type={type}
                message={message}
                onClose={vi.fn()}
              />
            )

            // Should have an icon (SVG element)
            const icon = container.querySelector('svg')
            expect(icon).toBeTruthy()

            // Should have text content (message)
            const alertElement = container.querySelector('[role]')
            expect(alertElement?.textContent).toContain(message)

            // Status is indicated by BOTH icon AND text, not just color
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should have both icon and text for any EmptyState', () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })
      const descriptionArbitrary = fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined })

      fc.assert(
        fc.property(
          titleArbitrary,
          descriptionArbitrary,
          (title, description) => {
            const { container } = render(
              <EmptyState
                title={title}
                description={description}
              />
            )

            // Should have an icon (SVG element)
            const icon = container.querySelector('svg')
            expect(icon).toBeTruthy()

            // Should have text content (title)
            const emptyStateElement = container.querySelector('[role="status"]')
            expect(emptyStateElement?.textContent).toContain(title)

            // Status is indicated by BOTH icon AND text, not just color
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should have both visual indicator and text for any LoadingSpinner', () => {
      const textArbitrary = fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined })

      fc.assert(
        fc.property(
          textArbitrary,
          (text) => {
            const { container } = render(
              <LoadingSpinner
                text={text}
              />
            )

            // Should have a visual indicator (spinner icon)
            const spinner = container.querySelector('svg')
            expect(spinner).toBeTruthy()

            // Should have aria-label for screen readers
            const spinnerContainer = container.querySelector('[role="status"]')
            const ariaLabel = spinnerContainer?.getAttribute('aria-label')
            expect(ariaLabel).toBeTruthy()

            // If text is provided, it should be visible
            if (text) {
              expect(spinnerContainer?.textContent).toContain(text)
            }

            // Status is indicated by BOTH visual spinner AND text/aria-label
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should have both visual bar and text for any ProgressBar', () => {
      const valueArbitrary = fc.integer({ min: 0, max: 100 })
      const labelArbitrary = fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined })

      fc.assert(
        fc.property(
          valueArbitrary,
          labelArbitrary,
          (value, label) => {
            const { container } = render(
              <ProgressBar
                value={value}
                label={label}
                showPercentage={true}
              />
            )

            // Should have visual progress bar
            const progressBar = container.querySelector('[role="progressbar"]')
            expect(progressBar).toBeTruthy()

            // Should have percentage text
            const percentageText = `${Math.round(value)}%`
            expect(container.textContent).toContain(percentageText)

            // Should have aria-label
            const ariaLabel = progressBar?.getAttribute('aria-label')
            expect(ariaLabel).toBeTruthy()

            // Status is indicated by BOTH visual bar AND percentage text
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should not rely solely on color for any notification type', () => {
      const notificationTypeArbitrary = fc.constantFrom<'toast' | 'alert'>(
        'toast',
        'alert'
      )
      const statusTypeArbitrary = fc.constantFrom<ToastType | AlertType>(
        'success',
        'error',
        'info',
        'warning'
      )
      const messageArbitrary = fc.string({ minLength: 1, maxLength: 200 })

      fc.assert(
        fc.property(
          notificationTypeArbitrary,
          statusTypeArbitrary,
          messageArbitrary,
          (notificationType, statusType, message) => {
            let container: any

            if (notificationType === 'toast') {
              const result = render(
                <Toast
                  id={`test-${statusType}`}
                  type={statusType as ToastType}
                  message={message}
                  onClose={vi.fn()}
                  duration={0}
                />
              )
              container = result.container
            } else {
              const result = render(
                <AlertBox
                  type={statusType as AlertType}
                  message={message}
                  onClose={vi.fn()}
                />
              )
              container = result.container
            }

            // Must have BOTH icon AND text
            const hasIcon = container.querySelector('svg') !== null
            const hasText = container.textContent && container.textContent.length > 0

            expect(hasIcon).toBe(true)
            expect(hasText).toBe(true)

            // This ensures status is communicated through multiple channels,
            // not just color alone
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
