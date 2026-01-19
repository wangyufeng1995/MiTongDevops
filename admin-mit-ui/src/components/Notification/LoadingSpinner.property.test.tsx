import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LoadingSpinner } from './LoadingSpinner'
import * as fc from 'fast-check'

/**
 * Feature: ai-assistant-notification-enhancement
 * Property 7: Loading State Visibility
 * 
 * For any data loading operation, a loading spinner should be visible until the operation completes.
 * Validates: Requirements 3.1, 3.3
 */
describe('LoadingSpinner - Property-Based Tests', () => {
  it('Property 7: Loading State Visibility - spinner is always visible when rendered', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        fc.constantFrom('primary', 'secondary', 'white'),
        fc.option(fc.string(), { nil: undefined }),
        fc.boolean(),
        (size, color, text, fullScreen) => {
          const { container } = render(
            <LoadingSpinner
              size={size as 'sm' | 'md' | 'lg'}
              color={color as 'primary' | 'secondary' | 'white'}
              text={text}
              fullScreen={fullScreen}
            />
          )

          // The spinner SVG should always be present
          const svg = container.querySelector('svg')
          expect(svg).toBeInTheDocument()

          // The spinner should have the animate-spin class
          expect(svg).toHaveClass('animate-spin')

          // If text is provided, it should be visible
          if (text) {
            expect(container.textContent).toContain(text)
          }

          // If fullScreen is true, the overlay should be present
          if (fullScreen) {
            const overlay = container.querySelector('.fixed.inset-0')
            expect(overlay).toBeInTheDocument()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 7: Loading State Visibility - spinner size matches configuration', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        (size) => {
          const sizeMap = {
            sm: 16,
            md: 32,
            lg: 48
          }

          const { container } = render(
            <LoadingSpinner size={size as 'sm' | 'md' | 'lg'} />
          )

          const svg = container.querySelector('svg')
          expect(svg).toBeInTheDocument()
          
          const expectedSize = sizeMap[size as keyof typeof sizeMap]
          expect(svg).toHaveAttribute('width', expectedSize.toString())
          expect(svg).toHaveAttribute('height', expectedSize.toString())
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 7: Loading State Visibility - fullScreen mode creates overlay', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (fullScreen) => {
          const { container } = render(
            <LoadingSpinner fullScreen={fullScreen} />
          )

          const overlay = container.querySelector('.fixed.inset-0')
          
          if (fullScreen) {
            // Overlay should exist in fullScreen mode
            expect(overlay).toBeInTheDocument()
            expect(overlay).toHaveClass('z-50')
          } else {
            // Overlay should not exist in inline mode
            expect(overlay).not.toBeInTheDocument()
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
