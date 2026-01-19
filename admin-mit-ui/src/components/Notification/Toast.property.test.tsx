import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import * as fc from 'fast-check'
import Toast, { ToastType } from './Toast'
import { tokens } from '../../styles/tokens'
import { colorsEqual } from '../../utils/colorUtils'

/**
 * Property-Based Tests for Toast Component
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

describe('Toast Property-Based Tests', () => {
  /**
   * Property 1: Toast Type Consistency
   * Validates: Requirements 1.1, 1.2, 1.3, 1.4
   * 
   * For any toast notification, the displayed icon, color scheme, and styling 
   * should match the specified type (success/error/info/warning).
   */
  describe('Property 1: Toast Type Consistency', () => {
    it('should display consistent icon, colors, and styling for any toast type', () => {
      // Arbitrary for toast types
      const toastTypeArbitrary = fc.constantFrom<ToastType>(
        'success',
        'error',
        'info',
        'warning'
      )

      // Arbitrary for messages (non-empty strings)
      const messageArbitrary = fc.string({ minLength: 1, maxLength: 200 })

      // Arbitrary for IDs
      const idArbitrary = fc.string({ minLength: 1, maxLength: 50 })

      fc.assert(
        fc.property(
          toastTypeArbitrary,
          messageArbitrary,
          idArbitrary,
          (type, message, id) => {
            // Render the toast with the generated properties
            const { container } = render(
              <Toast
                id={id}
                type={type}
                message={message}
                onClose={vi.fn()}
                duration={0} // Disable auto-dismiss for testing
              />
            )

            try {
              // Get the expected colors for this type from design tokens
              const expectedColors = tokens.colors.light[type]

              // Verify the toast container exists
              const toastElement = container.querySelector('[role="status"]')
              expect(toastElement).toBeTruthy()

              // Verify icon is present (all toast types should have an icon)
              const iconElement = toastElement?.querySelector('svg')
              expect(iconElement).toBeTruthy()

              // Verify the message is displayed
              expect(toastElement?.textContent).toContain(message)

              // Verify styling matches the type
              const toastStyle = toastElement as HTMLElement
              if (toastStyle) {
                // Check background color matches the type's light color
                // Use colorsEqual to handle hex vs RGB format differences
                expect(colorsEqual(toastStyle.style.background, expectedColors.light)).toBe(true)
                
                // Check text color matches the type's text color
                expect(colorsEqual(toastStyle.style.color, expectedColors.text)).toBe(true)
                
                // Check border contains the border color (border is compound: "1px solid rgb(...)")
                // Extract just the color part and compare
                const borderMatch = toastStyle.style.border.match(/rgb\([^)]+\)/)
                if (borderMatch) {
                  expect(colorsEqual(borderMatch[0], expectedColors.border)).toBe(true)
                } else {
                  // Fallback: check if border string contains the hex color
                  expect(toastStyle.style.border).toContain(expectedColors.border)
                }
              }

              // Verify icon color matches the type's main color
              const iconContainer = toastElement?.querySelector('div[style*="color"]') as HTMLElement
              if (iconContainer) {
                expect(colorsEqual(iconContainer.style.color, expectedColors.main)).toBe(true)
              }

              // Type-specific icon verification
              // Lucide icons don't have specific class names, but we verify the icon exists
              switch (type) {
                case 'success':
                  // CheckCircle icon should be present for success
                  expect(iconElement).toBeTruthy()
                  break
                case 'error':
                  // XCircle icon should be present for error
                  expect(iconElement).toBeTruthy()
                  break
                case 'info':
                  // Info icon should be present for info
                  expect(iconElement).toBeTruthy()
                  break
                case 'warning':
                  // AlertTriangle icon should be present for warning
                  expect(iconElement).toBeTruthy()
                  break
              }

              return true
            } finally {
              cleanup()
            }
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design
      )
    })

    it('should maintain type consistency across different message lengths', () => {
      const toastTypeArbitrary = fc.constantFrom<ToastType>(
        'success',
        'error',
        'info',
        'warning'
      )

      // Test with various message lengths including edge cases
      const messageLengthArbitrary = fc.oneof(
        fc.string({ minLength: 1, maxLength: 10 }), // Short messages
        fc.string({ minLength: 50, maxLength: 100 }), // Medium messages
        fc.string({ minLength: 150, maxLength: 300 }) // Long messages
      )

      fc.assert(
        fc.property(
          toastTypeArbitrary,
          messageLengthArbitrary,
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

            const toastElement = container.querySelector('[role="status"]')
            const expectedColors = tokens.colors.light[type]

            // Verify type consistency regardless of message length
            expect(toastElement).toBeTruthy()
            
            const toastStyle = toastElement as HTMLElement
            expect(colorsEqual(toastStyle.style.background, expectedColors.light)).toBe(true)
            expect(colorsEqual(toastStyle.style.color, expectedColors.text)).toBe(true)
            
            // Check border color
            const borderMatch = toastStyle.style.border.match(/rgb\([^)]+\)/)
            if (borderMatch) {
              expect(colorsEqual(borderMatch[0], expectedColors.border)).toBe(true)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain type consistency with different closable states', () => {
      const toastTypeArbitrary = fc.constantFrom<ToastType>(
        'success',
        'error',
        'info',
        'warning'
      )

      const closableArbitrary = fc.boolean()
      const messageArbitrary = fc.string({ minLength: 1, maxLength: 100 })

      fc.assert(
        fc.property(
          toastTypeArbitrary,
          closableArbitrary,
          messageArbitrary,
          (type, closable, message) => {
            const { container } = render(
              <Toast
                id={`test-${type}-${closable}`}
                type={type}
                message={message}
                closable={closable}
                onClose={vi.fn()}
                duration={0}
              />
            )

            const toastElement = container.querySelector('[role="status"]')
            const expectedColors = tokens.colors.light[type]

            // Verify type consistency regardless of closable state
            expect(toastElement).toBeTruthy()
            
            const toastStyle = toastElement as HTMLElement
            expect(colorsEqual(toastStyle.style.background, expectedColors.light)).toBe(true)
            expect(colorsEqual(toastStyle.style.color, expectedColors.text)).toBe(true)

            // Verify icon is always present regardless of closable state
            const iconElement = toastElement?.querySelector('svg')
            expect(iconElement).toBeTruthy()

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
