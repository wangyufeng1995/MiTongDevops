import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ProgressBar } from './ProgressBar'
import * as fc from 'fast-check'

/**
 * Feature: ai-assistant-notification-enhancement
 * Property 11: Progress Value Bounds
 * Property 12: Progress Completion
 * 
 * For any progress bar, the displayed value should be clamped between 0 and the maximum value.
 * For any progress bar that reaches 100%, it should display a completion state.
 * Validates: Requirements 9.3, 9.5
 */
describe('ProgressBar - Property-Based Tests', () => {
  afterEach(() => {
    cleanup()
  })

  it('Property 11: Progress Value Bounds - value is always clamped between 0 and max', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }), // Any integer value
        fc.integer({ min: 1, max: 1000 }), // Max value (positive)
        (value, max) => {
          const { unmount } = render(<ProgressBar value={value} max={max} />)

          // Calculate expected percentage
          const clampedValue = Math.max(0, Math.min(value, max))
          const expectedPercentage = Math.round((clampedValue / max) * 100)

          // Check that the displayed percentage is within bounds
          const percentageText = screen.getByText(`${expectedPercentage}%`)
          expect(percentageText).toBeInTheDocument()

          // Verify percentage is between 0 and 100
          expect(expectedPercentage).toBeGreaterThanOrEqual(0)
          expect(expectedPercentage).toBeLessThanOrEqual(100)

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 11: Progress Value Bounds - negative values are clamped to 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: -1 }), // Negative values only
        (value) => {
          const { unmount } = render(<ProgressBar value={value} />)

          // Should display 0%
          expect(screen.getByText('0%')).toBeInTheDocument()

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 11: Progress Value Bounds - values above max are clamped to max', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }), // Max value
        fc.integer({ min: 1, max: 1000 }), // Excess amount
        (max, excess) => {
          const value = max + excess // Value above max
          const { unmount } = render(<ProgressBar value={value} max={max} />)

          // Should display 100%
          expect(screen.getByText('100%')).toBeInTheDocument()

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 12: Progress Completion - completion status shown when value equals max', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }), // Max value
        (max) => {
          const { unmount } = render(<ProgressBar value={max} max={max} />)

          // Should show completion status
          expect(screen.getByText('✓ Complete')).toBeInTheDocument()
          expect(screen.getByText('100%')).toBeInTheDocument()

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 12: Progress Completion - completion status shown when value exceeds max', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }), // Max value
        fc.integer({ min: 1, max: 500 }), // Excess amount
        (max, excess) => {
          const value = max + excess
          const { unmount } = render(<ProgressBar value={value} max={max} />)

          // Should show completion status
          expect(screen.getByText('✓ Complete')).toBeInTheDocument()

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 12: Progress Completion - no completion status when value is below max', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 1000 }), // Max value (at least 2)
        (max) => {
          const value = max - 1 // One less than max
          const { unmount } = render(<ProgressBar value={value} max={max} />)

          // Should NOT show completion status
          expect(screen.queryByText('✓ Complete')).not.toBeInTheDocument()

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 11 & 12: Progress percentage calculation is consistent', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }), // Value
        fc.integer({ min: 1, max: 1000 }), // Max
        (value, max) => {
          const { container, unmount } = render(<ProgressBar value={value} max={max} />)

          // Calculate expected values
          const clampedValue = Math.max(0, Math.min(value, max))
          const expectedPercentage = Math.round((clampedValue / max) * 100)
          const isComplete = clampedValue >= max

          // Check displayed percentage
          expect(screen.getByText(`${expectedPercentage}%`)).toBeInTheDocument()

          // Check completion status
          if (isComplete) {
            expect(screen.getByText('✓ Complete')).toBeInTheDocument()
          } else {
            expect(screen.queryByText('✓ Complete')).not.toBeInTheDocument()
          }

          // Check progress bar width
          const progressBar = container.querySelector('[style*="width"]')
          expect(progressBar).toBeInTheDocument()

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 11: Progress Value Bounds - works with different variants', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 200 }), // Any value
        fc.constantFrom('default', 'success', 'warning', 'error'),
        (value, variant) => {
          const { unmount } = render(
            <ProgressBar
              value={value}
              max={100}
              variant={variant as 'default' | 'success' | 'warning' | 'error'}
            />
          )

          // Calculate expected percentage
          const clampedValue = Math.max(0, Math.min(value, 100))
          const expectedPercentage = Math.round(clampedValue)

          // Should display clamped percentage
          expect(screen.getByText(`${expectedPercentage}%`)).toBeInTheDocument()

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })
})
