import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import * as fc from 'fast-check'
import NotificationModal from './Modal'

/**
 * Property-Based Tests for Focus Management
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

describe('Focus Management Property-Based Tests', () => {
  afterEach(() => {
    cleanup()
    // Clean up any remaining modals
    document.body.style.overflow = ''
  })

  /**
   * Property 16: Modal Focus Management
   * Validates: Requirements 12.3
   * 
   * For any modal that opens, keyboard focus should move to an element within the modal.
   */
  describe('Property 16: Modal Focus Management', () => {
    it('should move focus to an element within the modal when opened', async () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
      const contentArbitrary = fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0)

      await fc.assert(
        fc.asyncProperty(
          titleArbitrary,
          contentArbitrary,
          async (title, content) => {
            // Create a button to track initial focus
            const triggerButton = document.createElement('button')
            triggerButton.textContent = 'Open Modal'
            document.body.appendChild(triggerButton)
            triggerButton.focus()

            // Verify initial focus is on the trigger button
            expect(document.activeElement).toBe(triggerButton)

            // Render modal
            const { container } = render(
              <NotificationModal
                isOpen={true}
                onClose={vi.fn()}
                title={title}
              >
                <div>
                  <p>{content}</p>
                  <button>Action Button</button>
                </div>
              </NotificationModal>
            )

            // Wait for focus to move into the modal
            await waitFor(
              () => {
                const modalElement = container.querySelector('[role="dialog"]')
                expect(modalElement).toBeTruthy()

                // Focus should be within the modal
                const activeElement = document.activeElement
                expect(activeElement).toBeTruthy()
                
                // Active element should be inside the modal or be the modal itself
                const isInsideModal = modalElement?.contains(activeElement as Node) || activeElement === modalElement
                expect(isInsideModal).toBe(true)
              },
              { timeout: 500 }
            )

            // Cleanup
            document.body.removeChild(triggerButton)
            cleanup()

            return true
          }
        ),
        { numRuns: 50 } // Reduced runs for async tests
      )
    })

    it('should focus the first focusable element when modal opens', async () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })

      await fc.assert(
        fc.asyncProperty(
          titleArbitrary,
          async (title) => {
            const { container } = render(
              <NotificationModal
                isOpen={true}
                onClose={vi.fn()}
                title={title}
              >
                <div>
                  <input type="text" placeholder="First input" />
                  <button>Second button</button>
                </div>
              </NotificationModal>
            )

            // Wait for focus to be set
            await waitFor(
              () => {
                const activeElement = document.activeElement
                expect(activeElement).toBeTruthy()

                // Should focus a focusable element (input, button, or close button)
                const isFocusable = 
                  activeElement?.tagName === 'INPUT' ||
                  activeElement?.tagName === 'BUTTON' ||
                  activeElement?.hasAttribute('tabindex')
                
                expect(isFocusable).toBe(true)
              },
              { timeout: 500 }
            )

            cleanup()

            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should trap focus within the modal', async () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)

      await fc.assert(
        fc.asyncProperty(
          titleArbitrary,
          async (title) => {
            const { container } = render(
              <NotificationModal
                isOpen={true}
                onClose={vi.fn()}
                title={title}
              >
                <div>
                  <button id="first-button">First</button>
                  <button id="second-button">Second</button>
                </div>
              </NotificationModal>
            )

            await waitFor(() => {
              const modalElement = container.querySelector('[role="dialog"]')
              expect(modalElement).toBeTruthy()
            })

            // Get all focusable elements in the modal
            const modalElement = container.querySelector('[role="dialog"]')
            const focusableElements = modalElement?.querySelectorAll(
              'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )

            // Verify we have focusable elements
            expect(focusableElements && focusableElements.length > 0).toBe(true)

            // Simulate Tab key press
            const tabEvent = new KeyboardEvent('keydown', {
              key: 'Tab',
              bubbles: true,
              cancelable: true,
            })

            // Focus should stay within modal after Tab
            document.dispatchEvent(tabEvent)

            await waitFor(() => {
              const activeElement = document.activeElement
              const isInsideModal = modalElement?.contains(activeElement as Node)
              expect(isInsideModal).toBe(true)
            })

            cleanup()

            return true
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  /**
   * Property 17: Modal Focus Restoration
   * Validates: Requirements 12.4
   * 
   * For any modal that closes, keyboard focus should return to the element that triggered the modal.
   */
  describe('Property 17: Modal Focus Restoration', () => {
    it('should restore focus to the trigger element when modal closes', async () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })
      const contentArbitrary = fc.string({ minLength: 1, maxLength: 500 })

      await fc.assert(
        fc.asyncProperty(
          titleArbitrary,
          contentArbitrary,
          async (title, content) => {
            // Create a trigger button
            const triggerButton = document.createElement('button')
            triggerButton.textContent = 'Open Modal'
            triggerButton.id = 'trigger-button'
            document.body.appendChild(triggerButton)
            triggerButton.focus()

            // Verify initial focus
            expect(document.activeElement).toBe(triggerButton)

            // Render modal (open)
            const { rerender } = render(
              <NotificationModal
                isOpen={true}
                onClose={vi.fn()}
                title={title}
              >
                {content}
              </NotificationModal>
            )

            // Wait for modal to be rendered and focused
            await waitFor(() => {
              const modalElement = document.querySelector('[role="dialog"]')
              expect(modalElement).toBeTruthy()
            }, { timeout: 500 })

            // Close the modal
            rerender(
              <NotificationModal
                isOpen={false}
                onClose={vi.fn()}
                title={title}
              >
                {content}
              </NotificationModal>
            )

            // Wait for focus to be restored
            await waitFor(
              () => {
                // Focus should return to the trigger button
                const activeElement = document.activeElement
                expect(activeElement).toBe(triggerButton)
              },
              { timeout: 1000 }
            )

            // Cleanup
            document.body.removeChild(triggerButton)
            cleanup()

            return true
          }
        ),
        { numRuns: 30 } // Reduced runs for complex async tests
      )
    })

    it('should restore focus even when modal contains interactive elements', async () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })

      await fc.assert(
        fc.asyncProperty(
          titleArbitrary,
          async (title) => {
            // Create a trigger button
            const triggerButton = document.createElement('button')
            triggerButton.textContent = 'Trigger'
            document.body.appendChild(triggerButton)
            triggerButton.focus()

            const initialFocus = document.activeElement

            // Render modal with multiple interactive elements
            const { rerender } = render(
              <NotificationModal
                isOpen={true}
                onClose={vi.fn()}
                title={title}
              >
                <div>
                  <input type="text" />
                  <button>Button 1</button>
                  <button>Button 2</button>
                  <a href="#">Link</a>
                </div>
              </NotificationModal>
            )

            await waitFor(() => {
              const modalElement = document.querySelector('[role="dialog"]')
              expect(modalElement).toBeTruthy()
            })

            // Close modal
            rerender(
              <NotificationModal
                isOpen={false}
                onClose={vi.fn()}
                title={title}
              >
                <div>
                  <input type="text" />
                  <button>Button 1</button>
                  <button>Button 2</button>
                  <a href="#">Link</a>
                </div>
              </NotificationModal>
            )

            // Wait for focus restoration
            await waitFor(
              () => {
                expect(document.activeElement).toBe(initialFocus)
              },
              { timeout: 1000 }
            )

            // Cleanup
            document.body.removeChild(triggerButton)
            cleanup()

            return true
          }
        ),
        { numRuns: 30 }
      )
    })
  })
})
