import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingSpinner } from './LoadingSpinner'

describe('LoadingSpinner', () => {
  it('renders with default props', () => {
    const { container } = render(<LoadingSpinner />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveClass('animate-spin')
  })

  it('renders with small size', () => {
    const { container } = render(<LoadingSpinner size="sm" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('width', '16')
    expect(svg).toHaveAttribute('height', '16')
  })

  it('renders with medium size', () => {
    const { container } = render(<LoadingSpinner size="md" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('width', '32')
    expect(svg).toHaveAttribute('height', '32')
  })

  it('renders with large size', () => {
    const { container } = render(<LoadingSpinner size="lg" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('width', '48')
    expect(svg).toHaveAttribute('height', '48')
  })

  it('renders with text', () => {
    render(<LoadingSpinner text="Loading data..." />)
    expect(screen.getByText('Loading data...')).toBeInTheDocument()
  })

  it('renders without text when not provided', () => {
    render(<LoadingSpinner />)
    const text = screen.queryByText(/loading/i)
    expect(text).not.toBeInTheDocument()
  })

  it('renders with primary color', () => {
    const { container } = render(<LoadingSpinner color="primary" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders with secondary color', () => {
    const { container } = render(<LoadingSpinner color="secondary" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders with white color', () => {
    const { container } = render(<LoadingSpinner color="white" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders in fullScreen mode', () => {
    const { container } = render(<LoadingSpinner fullScreen />)
    const fullScreenDiv = container.querySelector('.fixed.inset-0')
    expect(fullScreenDiv).toBeInTheDocument()
    expect(fullScreenDiv).toHaveClass('z-50')
  })

  it('renders inline when fullScreen is false', () => {
    const { container } = render(<LoadingSpinner fullScreen={false} />)
    const fullScreenDiv = container.querySelector('.fixed.inset-0')
    expect(fullScreenDiv).not.toBeInTheDocument()
  })

  it('renders fullScreen with text', () => {
    render(<LoadingSpinner fullScreen text="Please wait..." />)
    expect(screen.getByText('Please wait...')).toBeInTheDocument()
    const fullScreenDiv = document.querySelector('.fixed.inset-0')
    expect(fullScreenDiv).toBeInTheDocument()
  })

  it('applies animation class to spinner', () => {
    const { container } = render(<LoadingSpinner />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('animate-spin')
  })
})
