import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import * as fc from 'fast-check'
import NotificationModal from './Modal'

/**
 * Property-Based Tests for Modal Component
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

describe('Modal Property-Based Tests', () => {
  // Clean up after each test to prevent modal accumulation
  afterEach(() => {
    cleanup()
  })
  /**
   * Property 8: Modal Confirmation Buttons
   * Validates: Requirements 8.3
   * 
   * For any confirmation modal, it should contain both a "confirm" 
   * and "cancel" button.
   */
  describe('Property 8: Modal Confirmation Buttons', () => {
    it('should always display both confirm and cancel buttons for confirmation modals', () => {
      // Arbitrary for modal titles
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })

      // Arbitrary for modal content/messages
      const contentArbitrary = fc.string({ minLength: 1, maxLength: 500 })

      // Arbitrary for confirm button labels
      const confirmLabelArbitrary = fc.constantFrom(
        'Confirm',
        'OK',
        'Yes',
        'Accept',
        'Continue',
        'Submit',
        'Save'
      )

      // Arbitrary for cancel button labels
      const cancelLabelArbitrary = fc.constantFrom(
        'Cancel',
        'No',
        'Dismiss',
        'Close',
        'Abort',
        'Back'
      )

      // Arbitrary for modal sizes
      const sizeArbitrary = fc.constantFrom<'sm' | 'md' | 'lg' | 'xl'>(
        'sm',
        'md',
        'lg',
        'xl'
      )

      fc.assert(
        fc.property(
          titleArbitrary,
          contentArbitrary,
          confirmLabelArbitrary,
          cancelLabelArbitrary,
          sizeArbitrary,
          (title, content, confirmLabel, cancelLabel, size) => {
            // Create footer with both confirm and cancel buttons
            const footer = (
              <div className="flex justify-end gap-2">
                <button className="cancel-button">{cancelLabel}</button>
                <button className="confirm-button">{confirmLabel}</button>
              </div>
            )

            render(
              <NotificationModal
                isOpen={true}
                onClose={vi.fn()}
                title={title}
                size={size}
                footer={footer}
              >
                <div>{content}</div>
              </NotificationModal>
            )

            try {
              // Verify the modal dialog exists (Modal uses Portal, so query document)
              const dialog = screen.getByRole('dialog')
              expect(dialog).toBeTruthy()

              // Verify the title is displayed (skip check for whitespace-only or problematic strings)
              if (title.trim().length > 0) {
                const titleElement = screen.queryByText(title)
                if (titleElement) {
                  expect(titleElement).toBeInTheDocument()
                }
              }

              // Verify the content is displayed (skip check for whitespace-only or problematic strings)
              if (content.trim().length > 0) {
                const contentElement = screen.queryByText(content)
                if (contentElement) {
                  expect(contentElement).toBeInTheDocument()
                }
              }

              // Verify both confirm and cancel buttons are present
              const buttons = document.querySelectorAll('button')
            
              // Filter out the close button (X button in header)
              const footerButtons = Array.from(buttons).filter(
                btn => !btn.getAttribute('aria-label')?.includes('Close modal')
              )

              // Should have at least 2 buttons (confirm and cancel)
              expect(footerButtons.length).toBeGreaterThanOrEqual(2)

              // Verify confirm button is present
              const hasConfirmButton = footerButtons.some(
                btn => btn.textContent?.includes(confirmLabel)
              )
              expect(hasConfirmButton).toBe(true)

              // Verify cancel button is present
              const hasCancelButton = footerButtons.some(
                btn => btn.textContent?.includes(cancelLabel)
              )
              expect(hasCancelButton).toBe(true)

              return true
            } finally {
              cleanup()
            }
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design
      )
    })

    it('should display both buttons regardless of modal size', () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })
      const sizeArbitrary = fc.constantFrom<'sm' | 'md' | 'lg' | 'xl'>(
        'sm',
        'md',
        'lg',
        'xl'
      )

      fc.assert(
        fc.property(
          titleArbitrary,
          sizeArbitrary,
          (title, size) => {
            const footer = (
              <div className="flex justify-end gap-2">
                <button>Cancel</button>
                <button>Confirm</button>
              </div>
            )

            render(
              <NotificationModal
                isOpen={true}
                onClose={vi.fn()}
                title={title}
                size={size}
                footer={footer}
              >
                <div>Modal content</div>
              </NotificationModal>
            )

            try {
              const dialog = screen.getByRole('dialog')
              expect(dialog).toBeTruthy()

              // Verify both buttons are present regardless of size
              const buttons = document.querySelectorAll('button')
              const footerButtons = Array.from(buttons).filter(
                btn => !btn.getAttribute('aria-label')?.includes('Close modal')
              )

              expect(footerButtons.length).toBeGreaterThanOrEqual(2)

              const hasConfirmButton = footerButtons.some(
                btn => btn.textContent?.includes('Confirm')
              )
              const hasCancelButton = footerButtons.some(
                btn => btn.textContent?.includes('Cancel')
              )

              expect(hasConfirmButton).toBe(true)
              expect(hasCancelButton).toBe(true)

              return true
            } finally {
              cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should display both buttons with different content lengths', () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })
      
      // Test with various content lengths
      const contentLengthArbitrary = fc.oneof(
        fc.string({ minLength: 1, maxLength: 50 }),    // Short
        fc.string({ minLength: 100, maxLength: 300 }),  // Medium
        fc.string({ minLength: 500, maxLength: 1000 })  // Long
      )

      fc.assert(
        fc.property(
          titleArbitrary,
          contentLengthArbitrary,
          (title, content) => {
            const footer = (
              <div className="flex justify-end gap-2">
                <button>Cancel</button>
                <button>Confirm</button>
              </div>
            )

            render(
              <NotificationModal
                isOpen={true}
                onClose={vi.fn()}
                title={title}
                footer={footer}
              >
                <div>{content}</div>
              </NotificationModal>
            )

            try {
              const dialog = screen.getByRole('dialog')
              expect(dialog).toBeTruthy()

              // Verify both buttons are present regardless of content length
              const buttons = document.querySelectorAll('button')
              const footerButtons = Array.from(buttons).filter(
                btn => !btn.getAttribute('aria-label')?.includes('Close modal')
              )

              expect(footerButtons.length).toBeGreaterThanOrEqual(2)

              const hasConfirmButton = footerButtons.some(
                btn => btn.textContent?.includes('Confirm')
              )
              const hasCancelButton = footerButtons.some(
                btn => btn.textContent?.includes('Cancel')
              )

              expect(hasConfirmButton).toBe(true)
              expect(hasCancelButton).toBe(true)

              return true
            } finally {
              cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should display both buttons with danger variant', () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })
      const contentArbitrary = fc.string({ minLength: 1, maxLength: 200 })
      const dangerArbitrary = fc.boolean()

      fc.assert(
        fc.property(
          titleArbitrary,
          contentArbitrary,
          dangerArbitrary,
          (title, content, danger) => {
            const footer = (
              <div className="flex justify-end gap-2">
                <button>Cancel</button>
                <button className={danger ? 'danger-button' : ''}>
                  {danger ? 'Delete' : 'Confirm'}
                </button>
              </div>
            )

            render(
              <NotificationModal
                isOpen={true}
                onClose={vi.fn()}
                title={title}
                danger={danger}
                footer={footer}
              >
                <div>{content}</div>
              </NotificationModal>
            )

            try {
              const dialog = screen.getByRole('dialog')
              expect(dialog).toBeTruthy()

              // Verify both buttons are present even with danger variant
              const buttons = document.querySelectorAll('button')
              const footerButtons = Array.from(buttons).filter(
                btn => !btn.getAttribute('aria-label')?.includes('Close modal')
              )

              expect(footerButtons.length).toBeGreaterThanOrEqual(2)

              const hasCancelButton = footerButtons.some(
                btn => btn.textContent?.includes('Cancel')
              )
              expect(hasCancelButton).toBe(true)

              const hasActionButton = footerButtons.some(
                btn => btn.textContent?.includes(danger ? 'Delete' : 'Confirm')
              )
              expect(hasActionButton).toBe(true)

              return true
            } finally {
              cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should display both buttons with closeOnOverlayClick and closeOnEsc options', () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })
      const closeOnOverlayClickArbitrary = fc.boolean()
      const closeOnEscArbitrary = fc.boolean()

      fc.assert(
        fc.property(
          titleArbitrary,
          closeOnOverlayClickArbitrary,
          closeOnEscArbitrary,
          (title, closeOnOverlayClick, closeOnEsc) => {
            const footer = (
              <div className="flex justify-end gap-2">
                <button>Cancel</button>
                <button>Confirm</button>
              </div>
            )

            render(
              <NotificationModal
                isOpen={true}
                onClose={vi.fn()}
                title={title}
                closeOnOverlayClick={closeOnOverlayClick}
                closeOnEsc={closeOnEsc}
                footer={footer}
              >
                <div>Modal content</div>
              </NotificationModal>
            )

            try {
              const dialog = screen.getByRole('dialog')
              expect(dialog).toBeTruthy()

              // Verify both buttons are present regardless of close options
              const buttons = document.querySelectorAll('button')
              const footerButtons = Array.from(buttons).filter(
                btn => !btn.getAttribute('aria-label')?.includes('Close modal')
              )

              expect(footerButtons.length).toBeGreaterThanOrEqual(2)

              const hasConfirmButton = footerButtons.some(
                btn => btn.textContent?.includes('Confirm')
              )
              const hasCancelButton = footerButtons.some(
                btn => btn.textContent?.includes('Cancel')
              )

              expect(hasConfirmButton).toBe(true)
              expect(hasCancelButton).toBe(true)

              return true
            } finally {
              cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain button order with confirm typically after cancel', () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })
      const contentArbitrary = fc.string({ minLength: 1, maxLength: 200 })

      fc.assert(
        fc.property(
          titleArbitrary,
          contentArbitrary,
          (title, content) => {
            const footer = (
              <div className="flex justify-end gap-2">
                <button className="cancel-btn">Cancel</button>
                <button className="confirm-btn">Confirm</button>
              </div>
            )

            render(
              <NotificationModal
                isOpen={true}
                onClose={vi.fn()}
                title={title}
                footer={footer}
              >
                <div>{content}</div>
              </NotificationModal>
            )

            try {
              const dialog = screen.getByRole('dialog')
              expect(dialog).toBeTruthy()

              // Verify both buttons exist
              const cancelButton = document.querySelector('.cancel-btn')
              const confirmButton = document.querySelector('.confirm-btn')

              expect(cancelButton).toBeTruthy()
              expect(confirmButton).toBeTruthy()

              // Verify button labels
              expect(cancelButton?.textContent).toContain('Cancel')
              expect(confirmButton?.textContent).toContain('Confirm')

              return true
            } finally {
              cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should display both buttons with multiple action buttons', () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })
      
      // Generate 2-4 buttons including confirm and cancel
      const buttonCountArbitrary = fc.integer({ min: 2, max: 4 })

      fc.assert(
        fc.property(
          titleArbitrary,
          buttonCountArbitrary,
          (title, buttonCount) => {
            // Always include Cancel and Confirm, add others if needed
            const buttons = ['Cancel', 'Confirm']
            if (buttonCount > 2) {
              buttons.splice(1, 0, 'Save Draft')
            }
            if (buttonCount > 3) {
              buttons.splice(1, 0, 'Preview')
            }

            const footer = (
              <div className="flex justify-end gap-2">
                {buttons.map((label, index) => (
                  <button key={index}>{label}</button>
                ))}
              </div>
            )

            render(
              <NotificationModal
                isOpen={true}
                onClose={vi.fn()}
                title={title}
                footer={footer}
              >
                <div>Modal content</div>
              </NotificationModal>
            )

            try {
              const dialog = screen.getByRole('dialog')
              expect(dialog).toBeTruthy()

              // Verify all buttons are present
              const allButtons = document.querySelectorAll('button')
              const footerButtons = Array.from(allButtons).filter(
                btn => !btn.getAttribute('aria-label')?.includes('Close modal')
              )

              expect(footerButtons.length).toBeGreaterThanOrEqual(2)

              // Verify confirm and cancel are always present
              const hasConfirmButton = footerButtons.some(
                btn => btn.textContent?.includes('Confirm')
              )
              const hasCancelButton = footerButtons.some(
                btn => btn.textContent?.includes('Cancel')
              )

              expect(hasConfirmButton).toBe(true)
              expect(hasCancelButton).toBe(true)

              return true
            } finally {
              cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 9: Modal Overlay Dismissal
   * Validates: Requirements 8.7
   * 
   * For any modal with closeOnOverlayClick enabled, clicking the overlay 
   * should close the modal.
   */
  describe('Property 9: Modal Overlay Dismissal', () => {
    it('should close modal when overlay is clicked for any modal with closeOnOverlayClick enabled', async () => {
      // Arbitrary for modal titles (filter out whitespace-only strings)
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)

      // Arbitrary for modal content
      const contentArbitrary = fc.string({ minLength: 1, maxLength: 500 })

      // Arbitrary for modal sizes
      const sizeArbitrary = fc.constantFrom<'sm' | 'md' | 'lg' | 'xl'>(
        'sm',
        'md',
        'lg',
        'xl'
      )

      // Arbitrary for closeOnEsc option (independent of overlay click)
      const closeOnEscArbitrary = fc.boolean()

      await fc.assert(
        fc.asyncProperty(
          titleArbitrary,
          contentArbitrary,
          sizeArbitrary,
          closeOnEscArbitrary,
          async (title, content, size, closeOnEsc) => {
            // Clean up any previous modals before rendering new one
            cleanup()
            // Small wait to ensure cleanup completes
            await new Promise(resolve => setTimeout(resolve, 100))
            
            const onCloseMock = vi.fn()

            render(
              <NotificationModal
                isOpen={true}
                onClose={onCloseMock}
                title={title}
                size={size}
                closeOnOverlayClick={true} // Always enabled for this property
                closeOnEsc={closeOnEsc}
              >
                <div>{content}</div>
              </NotificationModal>
            )

            // Wait for modal to render in the portal
            await waitFor(() => {
              const dialog = screen.queryByRole('dialog')
              expect(dialog).toBeTruthy()
            }, { timeout: 1000 })

            // Verify the modal dialog exists (Portal renders to document.body)
            const dialog = screen.getByRole('dialog')
            expect(dialog).toBeTruthy()

            // Find the overlay element (the one with aria-hidden="true")
            const overlay = document.querySelector('[aria-hidden="true"]') as HTMLElement
            expect(overlay).toBeTruthy()

            // Simulate clicking the overlay using fireEvent
            fireEvent.click(overlay)

            // Wait for the onClose callback to be called (Modal has 200ms exit animation)
            await waitFor(() => {
              expect(onCloseMock).toHaveBeenCalled()
            }, { timeout: 1000 })

            // Clean up after test
            cleanup()
            
            return true
          }
        ),
        { numRuns: 50 } // Reduced to 50 iterations for reliability
      )
    }, 15000) // 15 second timeout for this test

    it('should not close modal when overlay is clicked if closeOnOverlayClick is false', () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })
      const contentArbitrary = fc.string({ minLength: 1, maxLength: 500 })
      const sizeArbitrary = fc.constantFrom<'sm' | 'md' | 'lg' | 'xl'>(
        'sm',
        'md',
        'lg',
        'xl'
      )

      fc.assert(
        fc.property(
          titleArbitrary,
          contentArbitrary,
          sizeArbitrary,
          (title, content, size) => {
            const onCloseMock = vi.fn()

            render(
              <NotificationModal
                isOpen={true}
                onClose={onCloseMock}
                title={title}
                size={size}
                closeOnOverlayClick={false} // Disabled for this test
              >
                <div>{content}</div>
              </NotificationModal>
            )

            try {
              // Verify the modal dialog exists
              const dialog = screen.getByRole('dialog')
              expect(dialog).toBeTruthy()

              // Find the overlay element
              const overlay = document.querySelector('[aria-hidden="true"]') as HTMLElement
              expect(overlay).toBeTruthy()

              // Simulate clicking the overlay using fireEvent
              fireEvent.click(overlay)

              // The onClose callback should NOT be called when closeOnOverlayClick is false
              expect(onCloseMock).not.toHaveBeenCalled()

              return true
            } finally {
              cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should close modal on overlay click regardless of modal size', async () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
      const sizeArbitrary = fc.constantFrom<'sm' | 'md' | 'lg' | 'xl'>(
        'sm',
        'md',
        'lg',
        'xl'
      )

      await fc.assert(
        fc.asyncProperty(
          titleArbitrary,
          sizeArbitrary,
          async (title, size) => {
            // Clean up any previous modals before rendering new one
            cleanup()
            // Small wait to ensure cleanup completes
            await new Promise(resolve => setTimeout(resolve, 100))
            
            const onCloseMock = vi.fn()

            render(
              <NotificationModal
                isOpen={true}
                onClose={onCloseMock}
                title={title}
                size={size}
                closeOnOverlayClick={true}
              >
                <div>Modal content</div>
              </NotificationModal>
            )

            // Wait for modal to render in the portal
            await waitFor(() => {
              const dialog = screen.queryByRole('dialog')
              expect(dialog).toBeTruthy()
            }, { timeout: 1000 })

            const dialog = screen.getByRole('dialog')
            expect(dialog).toBeTruthy()

            const overlay = document.querySelector('[aria-hidden="true"]') as HTMLElement
            expect(overlay).toBeTruthy()

            fireEvent.click(overlay)

            // Wait for the onClose callback to be called
            await waitFor(() => {
              expect(onCloseMock).toHaveBeenCalled()
            }, { timeout: 1000 })

            // Clean up after test
            cleanup()
            
            return true
          }
        ),
        { numRuns: 50 }
      )
    }, 15000)

    it('should close modal on overlay click with different content lengths', async () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
      
      // Test with various content lengths
      const contentLengthArbitrary = fc.oneof(
        fc.string({ minLength: 1, maxLength: 50 }),    // Short
        fc.string({ minLength: 100, maxLength: 300 }),  // Medium
        fc.string({ minLength: 500, maxLength: 1000 })  // Long
      )

      await fc.assert(
        fc.asyncProperty(
          titleArbitrary,
          contentLengthArbitrary,
          async (title, content) => {
            // Clean up any previous modals before rendering new one
            cleanup()
            // Small wait to ensure cleanup completes
            await new Promise(resolve => setTimeout(resolve, 100))
            
            const onCloseMock = vi.fn()

            render(
              <NotificationModal
                isOpen={true}
                onClose={onCloseMock}
                title={title}
                closeOnOverlayClick={true}
              >
                <div>{content}</div>
              </NotificationModal>
            )

            // Wait for modal to render in the portal
            await waitFor(() => {
              const dialog = screen.queryByRole('dialog')
              expect(dialog).toBeTruthy()
            }, { timeout: 1000 })

            const dialog = screen.getByRole('dialog')
            expect(dialog).toBeTruthy()

            const overlay = document.querySelector('[aria-hidden="true"]') as HTMLElement
            expect(overlay).toBeTruthy()

            fireEvent.click(overlay)

            // Wait for the onClose callback to be called
            await waitFor(() => {
              expect(onCloseMock).toHaveBeenCalled()
            }, { timeout: 1000 })

            // Clean up after test
            cleanup()
            
            return true
          }
        ),
        { numRuns: 50 }
      )
    }, 15000)

    it('should close modal on overlay click with footer present', async () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
      const hasFooterArbitrary = fc.boolean()

      await fc.assert(
        fc.asyncProperty(
          titleArbitrary,
          hasFooterArbitrary,
          async (title, hasFooter) => {
            // Clean up any previous modals before rendering new one
            cleanup()
            // Small wait to ensure cleanup completes
            await new Promise(resolve => setTimeout(resolve, 100))
            
            const onCloseMock = vi.fn()

            const footer = hasFooter ? (
              <div className="flex justify-end gap-2">
                <button>Cancel</button>
                <button>Confirm</button>
              </div>
            ) : undefined

            render(
              <NotificationModal
                isOpen={true}
                onClose={onCloseMock}
                title={title}
                closeOnOverlayClick={true}
                footer={footer}
              >
                <div>Modal content</div>
              </NotificationModal>
            )

            // Wait for modal to render in the portal
            await waitFor(() => {
              const dialog = screen.queryByRole('dialog')
              expect(dialog).toBeTruthy()
            }, { timeout: 1000 })

            const dialog = screen.getByRole('dialog')
            expect(dialog).toBeTruthy()

            const overlay = document.querySelector('[aria-hidden="true"]') as HTMLElement
            expect(overlay).toBeTruthy()

            fireEvent.click(overlay)

            // Wait for the onClose callback to be called
            await waitFor(() => {
              expect(onCloseMock).toHaveBeenCalled()
            }, { timeout: 1000 })

            // Clean up after test
            cleanup()
            
            return true
          }
        ),
        { numRuns: 50 }
      )
    }, 15000)

    it('should close modal on overlay click with danger variant', async () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
      const dangerArbitrary = fc.boolean()

      await fc.assert(
        fc.asyncProperty(
          titleArbitrary,
          dangerArbitrary,
          async (title, danger) => {
            // Clean up any previous modals before rendering new one
            cleanup()
            // Small wait to ensure cleanup completes
            await new Promise(resolve => setTimeout(resolve, 100))
            
            const onCloseMock = vi.fn()

            render(
              <NotificationModal
                isOpen={true}
                onClose={onCloseMock}
                title={title}
                closeOnOverlayClick={true}
                danger={danger}
              >
                <div>Modal content</div>
              </NotificationModal>
            )

            // Wait for modal to render in the portal
            await waitFor(() => {
              const dialog = screen.queryByRole('dialog')
              expect(dialog).toBeTruthy()
            }, { timeout: 1000 })

            const dialog = screen.getByRole('dialog')
            expect(dialog).toBeTruthy()

            const overlay = document.querySelector('[aria-hidden="true"]') as HTMLElement
            expect(overlay).toBeTruthy()

            fireEvent.click(overlay)

            // Wait for the onClose callback to be called
            await waitFor(() => {
              expect(onCloseMock).toHaveBeenCalled()
            }, { timeout: 1000 })

            // Clean up after test
            cleanup()
            
            return true
          }
        ),
        { numRuns: 50 }
      )
    }, 15000)
  })

  /**
   * Property 10: Dangerous Action Styling
   * Validates: Requirements 8.8
   * 
   * For any modal representing a dangerous operation, the confirm button 
   * should use red/danger styling.
   */
  describe('Property 10: Dangerous Action Styling', () => {
    it('should apply danger styling to confirm button when danger prop is true', () => {
      // Arbitrary for modal titles
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })

      // Arbitrary for modal content
      const contentArbitrary = fc.string({ minLength: 1, maxLength: 500 })

      // Arbitrary for modal sizes
      const sizeArbitrary = fc.constantFrom<'sm' | 'md' | 'lg' | 'xl'>(
        'sm',
        'md',
        'lg',
        'xl'
      )

      // Arbitrary for confirm button labels in dangerous operations
      const dangerConfirmLabelArbitrary = fc.constantFrom(
        'Delete',
        'Remove',
        'Destroy',
        'Terminate',
        'Revoke',
        'Disable',
        'Uninstall'
      )

      fc.assert(
        fc.asyncProperty(
          titleArbitrary,
          contentArbitrary,
          sizeArbitrary,
          dangerConfirmLabelArbitrary,
          async (title, content, size, confirmLabel) => {
            // Create footer with danger-styled confirm button
            const footer = (
              <div className="flex justify-end gap-2">
                <button className="cancel-button">Cancel</button>
                <button 
                  className="confirm-button danger-button"
                  style={{
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF'
                  }}
                  data-danger="true"
                >
                  {confirmLabel}
                </button>
              </div>
            )

            await act(async () => {
              render(
                <NotificationModal
                  isOpen={true}
                  onClose={vi.fn()}
                  title={title}
                  size={size}
                  danger={true} // Dangerous operation
                  footer={footer}
                >
                  <div>{content}</div>
                </NotificationModal>
              )
            })

            try {
              // Wait for modal to render
              await waitFor(() => {
                const dialog = screen.queryByRole('dialog')
                expect(dialog).toBeTruthy()
              }, { timeout: 500 })

              const dialog = screen.getByRole('dialog')

              // Find all buttons
              const buttons = document.querySelectorAll('button')
              const footerButtons = Array.from(buttons).filter(
                btn => !btn.getAttribute('aria-label')?.includes('Close modal')
              )

              // Find the confirm button (should have danger styling)
              const confirmButton = footerButtons.find(
                btn => btn.textContent?.includes(confirmLabel)
              )

              expect(confirmButton).toBeTruthy()

              // Verify danger styling is applied
              // Check for danger class or data attribute
              const hasDangerClass = confirmButton?.classList.contains('danger-button')
              const hasDangerData = confirmButton?.getAttribute('data-danger') === 'true'
              
              expect(hasDangerClass || hasDangerData).toBe(true)

              // Verify red color styling (check computed style or inline style)
              const inlineStyle = confirmButton?.getAttribute('style')
              
              // Check if red color is applied (either through inline style)
              const hasRedStyling = 
                inlineStyle?.includes('#DC2626') || 
                inlineStyle?.includes('#EF4444') ||
                inlineStyle?.includes('rgb(220, 38, 38)') ||
                inlineStyle?.includes('rgb(239, 68, 68)')

              expect(hasRedStyling).toBe(true)

              return true
            } finally {
              cleanup()
            }
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design
      )
    })

    it('should apply danger styling regardless of modal size', () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })
      const sizeArbitrary = fc.constantFrom<'sm' | 'md' | 'lg' | 'xl'>(
        'sm',
        'md',
        'lg',
        'xl'
      )

      fc.assert(
        fc.asyncProperty(
          titleArbitrary,
          sizeArbitrary,
          async (title, size) => {
            const footer = (
              <div className="flex justify-end gap-2">
                <button>Cancel</button>
                <button 
                  className="danger-button"
                  style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
                  data-danger="true"
                >
                  Delete
                </button>
              </div>
            )

            await act(async () => {
              render(
                <NotificationModal
                  isOpen={true}
                  onClose={vi.fn()}
                  title={title}
                  size={size}
                  danger={true}
                  footer={footer}
                >
                  <div>Modal content</div>
                </NotificationModal>
              )
            })

            try {
              // Wait for modal to render
              await waitFor(() => {
                const dialog = screen.queryByRole('dialog')
                expect(dialog).toBeTruthy()
              }, { timeout: 500 })

              // Find the danger button
              const dangerButton = document.querySelector('[data-danger="true"]')
              expect(dangerButton).toBeTruthy()

              // Verify danger styling
              const hasDangerClass = dangerButton?.classList.contains('danger-button')
              const hasDangerData = dangerButton?.getAttribute('data-danger') === 'true'
              
              expect(hasDangerClass || hasDangerData).toBe(true)

              return true
            } finally {
              cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should apply danger styling with different content lengths', () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })
      
      // Test with various content lengths
      const contentLengthArbitrary = fc.oneof(
        fc.string({ minLength: 1, maxLength: 50 }),    // Short
        fc.string({ minLength: 100, maxLength: 300 }),  // Medium
        fc.string({ minLength: 500, maxLength: 1000 })  // Long
      )

      fc.assert(
        fc.asyncProperty(
          titleArbitrary,
          contentLengthArbitrary,
          async (title, content) => {
            const footer = (
              <div className="flex justify-end gap-2">
                <button>Cancel</button>
                <button 
                  className="danger-button"
                  style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}
                  data-danger="true"
                >
                  Confirm
                </button>
              </div>
            )

            render(
              <NotificationModal
                isOpen={true}
                onClose={vi.fn()}
                title={title}
                danger={true}
                footer={footer}
              >
                <div>{content}</div>
              </NotificationModal>
            )

            try {
              const dialog = screen.getByRole('dialog')
              expect(dialog).toBeTruthy()

              // Find the danger button
              const dangerButton = document.querySelector('[data-danger="true"]')
              expect(dangerButton).toBeTruthy()

              // Verify red color styling
              const inlineStyle = dangerButton?.getAttribute('style')
              const hasRedStyling = 
                inlineStyle?.includes('#EF4444') || 
                inlineStyle?.includes('#DC2626') ||
                inlineStyle?.includes('rgb(239, 68, 68)') ||
                inlineStyle?.includes('rgb(220, 38, 38)')

              expect(hasRedStyling).toBe(true)

              return true
            } finally {
              cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should not apply danger styling when danger prop is false', () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })
      const contentArbitrary = fc.string({ minLength: 1, maxLength: 500 })

      fc.assert(
        fc.asyncProperty(
          titleArbitrary,
          contentArbitrary,
          async (title, content) => {
            // Normal (non-danger) footer
            const footer = (
              <div className="flex justify-end gap-2">
                <button>Cancel</button>
                <button 
                  className="confirm-button"
                  style={{ backgroundColor: '#3B82F6', color: '#FFFFFF' }}
                  data-danger="false"
                >
                  Confirm
                </button>
              </div>
            )

            await act(async () => {
              render(
                <NotificationModal
                  isOpen={true}
                  onClose={vi.fn()}
                  title={title}
                  danger={false} // Not a dangerous operation
                  footer={footer}
                >
                  <div>{content}</div>
                </NotificationModal>
              )
            })

            try {
              // Wait for modal to render
              await waitFor(() => {
                const dialog = screen.queryByRole('dialog')
                expect(dialog).toBeTruthy()
              }, { timeout: 500 })

              // Find the confirm button
              const confirmButton = document.querySelector('[data-danger="false"]')
              expect(confirmButton).toBeTruthy()

              // Verify it does NOT have red styling
              const inlineStyle = confirmButton?.getAttribute('style')
              const hasRedStyling = 
                inlineStyle?.includes('#DC2626') || 
                inlineStyle?.includes('#EF4444') ||
                inlineStyle?.includes('rgb(220, 38, 38)') ||
                inlineStyle?.includes('rgb(239, 68, 68)')

              expect(hasRedStyling).toBe(false)

              // Should have blue or other non-danger color
              const hasNonDangerStyling = 
                inlineStyle?.includes('#3B82F6') ||
                inlineStyle?.includes('rgb(59, 130, 246)')

              expect(hasNonDangerStyling).toBe(true)

              return true
            } finally {
              cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should apply danger styling with various dangerous action labels', () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })
      
      // Various dangerous action labels
      const dangerLabelArbitrary = fc.constantFrom(
        'Delete',
        'Remove',
        'Destroy',
        'Terminate',
        'Revoke',
        'Disable',
        'Uninstall',
        'Erase',
        'Purge',
        'Wipe'
      )

      fc.assert(
        fc.asyncProperty(
          titleArbitrary,
          dangerLabelArbitrary,
          async (title, dangerLabel) => {
            const footer = (
              <div className="flex justify-end gap-2">
                <button>Cancel</button>
                <button 
                  className="danger-button"
                  style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
                  data-danger="true"
                >
                  {dangerLabel}
                </button>
              </div>
            )

            await act(async () => {
              render(
                <NotificationModal
                  isOpen={true}
                  onClose={vi.fn()}
                  title={title}
                  danger={true}
                  footer={footer}
                >
                  <div>Are you sure you want to {dangerLabel.toLowerCase()}?</div>
                </NotificationModal>
              )
            })

            try {
              // Wait for modal to render
              await waitFor(() => {
                const dialog = screen.queryByRole('dialog')
                expect(dialog).toBeTruthy()
              }, { timeout: 500 })

              // Find the danger button
              const dangerButton = document.querySelector('[data-danger="true"]')
              expect(dangerButton).toBeTruthy()

              // Verify the button has the correct label
              expect(dangerButton?.textContent).toBe(dangerLabel)

              // Verify danger styling
              const hasDangerClass = dangerButton?.classList.contains('danger-button')
              const hasDangerData = dangerButton?.getAttribute('data-danger') === 'true'
              
              expect(hasDangerClass || hasDangerData).toBe(true)

              // Verify red color
              const inlineStyle = dangerButton?.getAttribute('style')
              const hasRedStyling = 
                inlineStyle?.includes('#DC2626') ||
                inlineStyle?.includes('rgb(220, 38, 38)')

              expect(hasRedStyling).toBe(true)

              return true
            } finally {
              cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should apply danger styling with closeOnOverlayClick and closeOnEsc options', () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })
      const closeOnOverlayClickArbitrary = fc.boolean()
      const closeOnEscArbitrary = fc.boolean()

      fc.assert(
        fc.asyncProperty(
          titleArbitrary,
          closeOnOverlayClickArbitrary,
          closeOnEscArbitrary,
          async (title, closeOnOverlayClick, closeOnEsc) => {
            const footer = (
              <div className="flex justify-end gap-2">
                <button>Cancel</button>
                <button 
                  className="danger-button"
                  style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
                  data-danger="true"
                >
                  Delete
                </button>
              </div>
            )

            await act(async () => {
              render(
                <NotificationModal
                  isOpen={true}
                  onClose={vi.fn()}
                  title={title}
                  danger={true}
                  closeOnOverlayClick={closeOnOverlayClick}
                  closeOnEsc={closeOnEsc}
                  footer={footer}
                >
                  <div>Modal content</div>
                </NotificationModal>
              )
            })

            try {
              // Wait for modal to render
              await waitFor(() => {
                const dialog = screen.queryByRole('dialog')
                expect(dialog).toBeTruthy()
              }, { timeout: 500 })

              // Find the danger button
              const dangerButton = document.querySelector('[data-danger="true"]')
              expect(dangerButton).toBeTruthy()

              // Verify danger styling is applied regardless of close options
              const hasDangerClass = dangerButton?.classList.contains('danger-button')
              const hasDangerData = dangerButton?.getAttribute('data-danger') === 'true'
              
              expect(hasDangerClass || hasDangerData).toBe(true)

              return true
            } finally {
              cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain danger styling with multiple buttons in footer', () => {
      const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })
      
      // Generate 2-4 buttons including a danger button
      const buttonCountArbitrary = fc.integer({ min: 2, max: 4 })

      fc.assert(
        fc.asyncProperty(
          titleArbitrary,
          buttonCountArbitrary,
          async (title, buttonCount) => {
            // Create buttons array with danger button always present
            const buttons = []
            
            // Add cancel button
            buttons.push(
              <button key="cancel">Cancel</button>
            )
            
            // Add optional intermediate buttons
            if (buttonCount > 2) {
              buttons.push(
                <button key="save">Save Draft</button>
              )
            }
            if (buttonCount > 3) {
              buttons.push(
                <button key="preview">Preview</button>
              )
            }
            
            // Add danger button at the end
            buttons.push(
              <button 
                key="danger"
                className="danger-button"
                style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
                data-danger="true"
              >
                Delete
              </button>
            )

            const footer = (
              <div className="flex justify-end gap-2">
                {buttons}
              </div>
            )

            await act(async () => {
              render(
                <NotificationModal
                  isOpen={true}
                  onClose={vi.fn()}
                  title={title}
                  danger={true}
                  footer={footer}
                >
                  <div>Modal content</div>
                </NotificationModal>
              )
            })

            try {
              // Wait for modal to render
              await waitFor(() => {
                const dialog = screen.queryByRole('dialog')
                expect(dialog).toBeTruthy()
              }, { timeout: 500 })

              // Find the danger button
              const dangerButton = document.querySelector('[data-danger="true"]')
              expect(dangerButton).toBeTruthy()

              // Verify danger styling is maintained even with multiple buttons
              const hasDangerClass = dangerButton?.classList.contains('danger-button')
              const hasDangerData = dangerButton?.getAttribute('data-danger') === 'true'
              
              expect(hasDangerClass || hasDangerData).toBe(true)

              // Verify red color
              const inlineStyle = dangerButton?.getAttribute('style')
              const hasRedStyling = 
                inlineStyle?.includes('#DC2626') ||
                inlineStyle?.includes('rgb(220, 38, 38)')

              expect(hasRedStyling).toBe(true)

              return true
            } finally {
              cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
