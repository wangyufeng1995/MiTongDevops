import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState } from './EmptyState'
import { Plus } from 'lucide-react'

describe('EmptyState', () => {
  it('renders with title', () => {
    render(<EmptyState title="No data available" />)
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('renders with description', () => {
    render(
      <EmptyState
        title="No data"
        description="There is no data to display at this time"
      />
    )
    expect(screen.getByText('There is no data to display at this time')).toBeInTheDocument()
  })

  it('renders with default illustration', () => {
    const { container } = render(<EmptyState title="Empty" />)
    // Check that an SVG icon is rendered
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders with custom icon', () => {
    const customIcon = <div data-testid="custom-icon">Custom</div>
    render(<EmptyState title="Empty" icon={customIcon} />)
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
  })

  it('renders action button when provided', () => {
    const handleClick = vi.fn()
    render(
      <EmptyState
        title="No data"
        action={{
          label: 'Create New',
          onClick: handleClick
        }}
      />
    )
    
    const button = screen.getByRole('button', { name: /create new/i })
    expect(button).toBeInTheDocument()
  })

  it('calls action onClick when button is clicked', () => {
    const handleClick = vi.fn()
    render(
      <EmptyState
        title="No data"
        action={{
          label: 'Create New',
          onClick: handleClick
        }}
      />
    )
    
    const button = screen.getByRole('button', { name: /create new/i })
    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('renders action button with icon', () => {
    const handleClick = vi.fn()
    render(
      <EmptyState
        title="No data"
        action={{
          label: 'Add Item',
          onClick: handleClick,
          icon: <Plus data-testid="action-icon" size={16} />
        }}
      />
    )
    
    expect(screen.getByTestId('action-icon')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument()
  })

  it('renders different illustration types', () => {
    const illustrations: Array<'default' | 'search' | 'config' | 'data'> = [
      'default',
      'search',
      'config',
      'data'
    ]

    illustrations.forEach((illustration) => {
      const { container } = render(
        <EmptyState title="Empty" illustration={illustration} />
      )
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })

  it('renders without action button when not provided', () => {
    render(<EmptyState title="No data" />)
    const button = screen.queryByRole('button')
    expect(button).not.toBeInTheDocument()
  })

  it('renders without description when not provided', () => {
    render(<EmptyState title="No data" />)
    // Only title should be present, no description paragraph
    const paragraphs = screen.queryAllByText(/./i).filter(
      (el) => el.tagName === 'P'
    )
    expect(paragraphs).toHaveLength(0)
  })
})
