import { useEffect, useRef } from 'react'

/**
 * Hook to trap focus within a container element (e.g., modal)
 * Implements focus management for accessibility
 * 
 * @param isActive - Whether the focus trap is active
 * @returns ref to attach to the container element
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(isActive: boolean) {
  const containerRef = useRef<T>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isActive) return

    // Save the currently focused element
    previousActiveElement.current = document.activeElement as HTMLElement

    const container = containerRef.current
    if (!container) return

    // Get all focusable elements within the container
    const getFocusableElements = (): HTMLElement[] => {
      if (!container) return []

      const focusableSelectors = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ')

      const elements = container.querySelectorAll<HTMLElement>(focusableSelectors)
      return Array.from(elements).filter(
        (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
      )
    }

    // Focus the first focusable element
    const focusableElements = getFocusableElements()
    if (focusableElements.length > 0) {
      // Small delay to ensure the element is rendered
      setTimeout(() => {
        focusableElements[0]?.focus()
      }, 100)
    } else {
      // If no focusable elements, focus the container itself
      container.focus()
    }

    // Handle Tab key to trap focus
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableElements = getFocusableElements()
      if (focusableElements.length === 0) {
        e.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement as HTMLElement

      if (e.shiftKey) {
        // Shift + Tab: moving backwards
        if (activeElement === firstElement || !container.contains(activeElement)) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        // Tab: moving forwards
        if (activeElement === lastElement || !container.contains(activeElement)) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    // Add event listener
    document.addEventListener('keydown', handleKeyDown)

    // Cleanup function
    return () => {
      document.removeEventListener('keydown', handleKeyDown)

      // Restore focus to the previously focused element
      if (previousActiveElement.current && document.body.contains(previousActiveElement.current)) {
        previousActiveElement.current.focus()
      }
    }
  }, [isActive])

  return containerRef
}

export default useFocusTrap
