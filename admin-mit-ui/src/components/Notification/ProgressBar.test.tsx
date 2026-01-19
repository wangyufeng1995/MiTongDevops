import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressBar } from './ProgressBar'

describe('ProgressBar', () => {
  it('renders with default props', () => {
    const { container } = render(<ProgressBar value={50} />)
    const progressBar = container.querySelector('[style*="width"]')
    expect(progressBar).toBeInTheDocument()
  })

  it('displays percentage by default', () => {
    render(<ProgressBar value={75} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('hides percentage when showPercentage is false', () => {
    render(<ProgressBar value={75} showPercentage={false} />)
    expect(screen.queryByText('75%')).not.toBeInTheDocument()
  })

  it('displays label when provided', () => {
    render(<ProgressBar value={50} label="Uploading..." />)
    expect(screen.getByText('Uploading...')).toBeInTheDocument()
  })

  it('clamps value to max', () => {
    render(<ProgressBar value={150} max={100} />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('clamps negative values to 0', () => {
    render(<ProgressBar value={-10} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('calculates percentage correctly with custom max', () => {
    render(<ProgressBar value={50} max={200} />)
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('renders with default variant', () => {
    const { container } = render(<ProgressBar value={50} variant="default" />)
    const progressBar = container.querySelector('[style*="width"]')
    expect(progressBar).toBeInTheDocument()
  })

  it('renders with success variant', () => {
    const { container } = render(<ProgressBar value={50} variant="success" />)
    const progressBar = container.querySelector('[style*="width"]')
    expect(progressBar).toBeInTheDocument()
  })

  it('renders with warning variant', () => {
    const { container } = render(<ProgressBar value={50} variant="warning" />)
    const progressBar = container.querySelector('[style*="width"]')
    expect(progressBar).toBeInTheDocument()
  })

  it('renders with error variant', () => {
    const { container } = render(<ProgressBar value={50} variant="error" />)
    const progressBar = container.querySelector('[style*="width"]')
    expect(progressBar).toBeInTheDocument()
  })

  it('shows completion status when value reaches max', () => {
    render(<ProgressBar value={100} />)
    expect(screen.getByText('✓ Complete')).toBeInTheDocument()
  })

  it('does not show completion status when value is below max', () => {
    render(<ProgressBar value={99} />)
    expect(screen.queryByText('✓ Complete')).not.toBeInTheDocument()
  })

  it('shows completion status with custom max', () => {
    render(<ProgressBar value={200} max={200} />)
    expect(screen.getByText('✓ Complete')).toBeInTheDocument()
  })

  it('applies animation class by default', () => {
    const { container } = render(<ProgressBar value={50} />)
    const progressBar = container.querySelector('[style*="width"]')
    expect(progressBar).toHaveClass('transition-all')
  })

  it('does not apply animation class when animated is false', () => {
    const { container } = render(<ProgressBar value={50} animated={false} />)
    const progressBar = container.querySelector('[style*="width"]')
    expect(progressBar).not.toHaveClass('transition-all')
  })

  it('updates progress value', () => {
    const { rerender } = render(<ProgressBar value={25} />)
    expect(screen.getByText('25%')).toBeInTheDocument()

    rerender(<ProgressBar value={75} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('rounds percentage to nearest integer', () => {
    render(<ProgressBar value={33.333} />)
    expect(screen.getByText('33%')).toBeInTheDocument()
  })

  it('handles zero value', () => {
    render(<ProgressBar value={0} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('handles max value', () => {
    render(<ProgressBar value={100} max={100} />)
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('✓ Complete')).toBeInTheDocument()
  })
})
