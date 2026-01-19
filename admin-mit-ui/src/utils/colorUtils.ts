/**
 * Color utility functions for testing and color manipulation
 */

/**
 * Convert hex color to RGB format
 * @param hex - Hex color string (e.g., '#ECFDF5' or 'ECFDF5')
 * @returns RGB string (e.g., 'rgb(236, 253, 245)')
 */
export function hexToRgb(hex: string): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '')
  
  // Parse hex values
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Normalize color to RGB format for comparison
 * Handles both hex and RGB input formats
 * @param color - Color string in hex or RGB format
 * @returns Normalized RGB string
 */
export function normalizeColor(color: string): string {
  // If already in RGB format, normalize spacing
  if (color.startsWith('rgb')) {
    // Remove all spaces and convert to consistent format
    return color.replace(/\s+/g, '').toLowerCase()
  }
  
  // If hex format, convert to RGB
  if (color.startsWith('#') || /^[0-9A-Fa-f]{6}$/.test(color)) {
    return hexToRgb(color).replace(/\s+/g, '').toLowerCase()
  }
  
  // Return as-is if unknown format
  return color.toLowerCase()
}

/**
 * Compare two colors for equality, handling different formats
 * @param color1 - First color (hex or RGB)
 * @param color2 - Second color (hex or RGB)
 * @returns True if colors are equivalent
 */
export function colorsEqual(color1: string, color2: string): boolean {
  return normalizeColor(color1) === normalizeColor(color2)
}
