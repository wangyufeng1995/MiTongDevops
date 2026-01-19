# Notification Components Documentation

## Overview

This document provides comprehensive documentation for the notification system components used in the AI Assistant application. The notification system includes Toast notifications, Alert boxes, Modals, Empty states, Loading spinners, and Progress bars.

All components support both light and dark themes and are fully accessible with ARIA attributes and keyboard navigation.

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Components](#components)
   - [Toast](#toast)
   - [AlertBox](#alertbox)
   - [Modal](#modal)
   - [EmptyState](#emptystate)
   - [LoadingSpinner](#loadingspinner)
   - [ProgressBar](#progressbar)
4. [Hooks](#hooks)
   - [useNotification](#usenotification)
   - [useTheme](#usetheme)
5. [Theme System](#theme-system)
6. [Accessibility](#accessibility)
7. [Examples](#examples)

## Installation

The notification components are built into the application. No additional installation is required.

## Quick Start

### 1. Wrap your app with providers

```tsx
import { ThemeProvider } from './contexts/ThemeContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { ToastContainer } from './components/Notification/ToastContainer'

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <YourApp />
        <ToastContainer />
      </NotificationProvider>
    </ThemeProvider>
  )
}
```

### 2. Use the notification hook

```tsx
import { useNotification } from './hooks/useNotification'

function MyComponent() {
  const { showToast, showModal } = useNotification()

  const handleSuccess = () => {
    showToast('success', 'Operation completed successfully!')
  }

  const handleDelete = async () => {
    const confirmed = await showModal({
      title: 'Confirm Delete',
      message: 'Are you sure you want to delete this item?',
      type: 'danger'
    })
    
    if (confirmed) {
      // Perform delete operation
    }
  }

  return (
    <div>
      <button onClick={handleSuccess}>Show Success</button>
      <button onClick={handleDelete}>Delete Item</button>
    </div>
  )
}
```

---

## Components

### Toast

Toast notifications are lightweight, temporary messages that appear at the corner of the screen and automatically dismiss after a few seconds.

#### Props

```typescript
interface ToastProps {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number // Default: 3000ms
  position?: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left'
  closable?: boolean // Default: true
  onClose?: () => void
}
```

#### Usage with Hook

```tsx
import { useNotification } from './hooks/useNotification'

function MyComponent() {
  const { showToast } = useNotification()

  // Success toast
  showToast('success', 'Data saved successfully!')

  // Error toast
  showToast('error', 'Failed to load data')

  // Info toast with custom duration
  showToast('info', 'New features available', { duration: 5000 })

  // Warning toast
  showToast('warning', 'Your session will expire soon')
}
```

#### Visual Design

- **Success**: Green gradient (#10B981 → #059669)
- **Error**: Red gradient (#EF4444 → #DC2626)
- **Info**: Blue gradient (#3B82F6 → #2563EB)
- **Warning**: Yellow gradient (#F59E0B → #D97706)
- **Animation**: Slides in from right, fades out
- **Max Width**: 480px
- **Border Radius**: 12px

---

### AlertBox

Alert boxes are persistent notifications that remain visible until dismissed by the user. They're ideal for important messages that require user attention.

#### Props

```typescript
interface AlertBoxProps {
  type: 'success' | 'error' | 'info' | 'warning'
  title?: string
  message: string
  closable?: boolean // Default: true
  actions?: AlertAction[]
  icon?: React.ReactNode
  onClose?: () => void
}

interface AlertAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger'
}
```

#### Usage

```tsx
import { AlertBox } from './components/Notification/AlertBox'

function MyComponent() {
  return (
    <div>
      {/* Simple error alert */}
      <AlertBox
        type="error"
        title="Connection Error"
        message="Unable to connect to the server. Please check your internet connection."
      />

      {/* Alert with actions */}
      <AlertBox
        type="warning"
        title="Unsaved Changes"
        message="You have unsaved changes. Do you want to save them?"
        actions={[
          { label: 'Save', onClick: handleSave, variant: 'primary' },
          { label: 'Discard', onClick: handleDiscard, variant: 'secondary' }
        ]}
      />

      {/* Info alert */}
      <AlertBox
        type="info"
        message="This feature is currently in beta. Please report any issues."
      />
    </div>
  )
}
```

#### Visual Design

- **Success**: Light green background (#ECFDF5) with dark green text (#065F46)
- **Error**: Light red background (#FEF2F2) with dark red text (#991B1B)
- **Info**: Light blue background (#EFF6FF) with dark blue text (#1E40AF)
- **Warning**: Light yellow background (#FFFBEB) with dark yellow text (#92400E)
- **Border**: 2px solid border in matching color
- **Border Radius**: 8px

---

### Modal

Modals are dialog boxes that appear on top of the main content, requiring user interaction before continuing.

#### Props

```typescript
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' // Default: 'md'
  closeOnOverlayClick?: boolean // Default: true
  closeOnEsc?: boolean // Default: true
  danger?: boolean // For dangerous operations
}
```

#### Usage with Hook

```tsx
import { useNotification } from './hooks/useNotification'

function MyComponent() {
  const { showModal } = useNotification()

  const handleDelete = async () => {
    const confirmed = await showModal({
      title: 'Delete Item',
      message: 'Are you sure you want to delete this item? This action cannot be undone.',
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    })

    if (confirmed) {
      // Perform delete
    }
  }

  return <button onClick={handleDelete}>Delete</button>
}
```

#### Direct Usage

```tsx
import { Modal } from './components/Notification/Modal'
import { useState } from 'react'

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Modal</button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Custom Modal"
        size="lg"
      >
        <div>
          <p>Modal content goes here...</p>
        </div>
      </Modal>
    </>
  )
}
```

#### Sizes

- **sm**: 400px
- **md**: 600px (default)
- **lg**: 800px
- **xl**: 1000px

---

### EmptyState

Empty state components display friendly messages when there's no data to show.

#### Props

```typescript
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
  illustration?: 'default' | 'search' | 'config' | 'data'
}
```

#### Usage

```tsx
import { EmptyState } from './components/Notification/EmptyState'
import { Plus } from 'lucide-react'

function MyComponent() {
  const models = []

  if (models.length === 0) {
    return (
      <EmptyState
        title="No Models Configured"
        description="Get started by adding your first AI model configuration."
        action={{
          label: 'Add Model',
          onClick: handleAddModel,
          icon: <Plus size={16} />
        }}
        illustration="config"
      />
    )
  }

  return <div>{/* Render models */}</div>
}
```

---

### LoadingSpinner

Loading spinners indicate that content is being loaded.

#### Props

```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' // Default: 'md'
  color?: 'primary' | 'secondary' | 'white' // Default: 'primary'
  text?: string
  fullScreen?: boolean // Default: false
}
```

#### Usage

```tsx
import { LoadingSpinner } from './components/Notification/LoadingSpinner'

function MyComponent() {
  const [loading, setLoading] = useState(true)

  if (loading) {
    return <LoadingSpinner text="Loading data..." />
  }

  return <div>{/* Content */}</div>
}

// Full screen loading
function App() {
  return (
    <div>
      {isInitializing && (
        <LoadingSpinner fullScreen text="Initializing application..." />
      )}
      {/* App content */}
    </div>
  )
}
```

#### Sizes

- **sm**: 16px
- **md**: 32px (default)
- **lg**: 48px

---

### ProgressBar

Progress bars show the completion status of an operation.

#### Props

```typescript
interface ProgressBarProps {
  value: number // 0-100
  max?: number // Default: 100
  label?: string
  showPercentage?: boolean // Default: true
  variant?: 'default' | 'success' | 'warning' | 'error' // Default: 'default'
  animated?: boolean // Default: true
}
```

#### Usage

```tsx
import { ProgressBar } from './components/Notification/ProgressBar'

function MyComponent() {
  const [progress, setProgress] = useState(0)

  return (
    <div>
      <ProgressBar
        value={progress}
        label="Uploading file..."
        showPercentage
      />

      {/* Success variant */}
      <ProgressBar
        value={100}
        variant="success"
        label="Upload complete"
      />

      {/* Error variant */}
      <ProgressBar
        value={45}
        variant="error"
        label="Upload failed"
      />
    </div>
  )
}
```

---

## Hooks

### useNotification

The main hook for displaying notifications.

#### API

```typescript
interface UseNotificationReturn {
  showToast: (
    type: ToastType,
    message: string,
    options?: ToastOptions
  ) => void
  
  showModal: (config: ModalConfig) => Promise<boolean>
  
  dismissToast: (id: string) => void
  
  dismissAllToasts: () => void
}
```

#### Methods

##### showToast

Display a toast notification.

```tsx
const { showToast } = useNotification()

// Basic usage
showToast('success', 'Operation completed')

// With options
showToast('error', 'Failed to save', {
  duration: 5000,
  position: 'top-center'
})
```

##### showModal

Display a confirmation modal and wait for user response.

```tsx
const { showModal } = useNotification()

const confirmed = await showModal({
  title: 'Confirm Action',
  message: 'Are you sure?',
  type: 'danger',
  confirmText: 'Yes, delete',
  cancelText: 'Cancel'
})

if (confirmed) {
  // User clicked confirm
} else {
  // User clicked cancel or closed modal
}
```

##### dismissToast

Manually dismiss a specific toast.

```tsx
const { showToast, dismissToast } = useNotification()

const toastId = showToast('info', 'Processing...')
// Later...
dismissToast(toastId)
```

##### dismissAllToasts

Dismiss all visible toasts.

```tsx
const { dismissAllToasts } = useNotification()

dismissAllToasts()
```

---

### useTheme

Hook for managing theme (light/dark mode).

#### API

```typescript
interface UseThemeReturn {
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void
}
```

#### Usage

```tsx
import { useTheme } from './hooks/useTheme'
import { Sun, Moon } from 'lucide-react'

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button onClick={toggleTheme}>
      {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  )
}
```

---

## Theme System

### Theme Detection

The theme system automatically detects the user's system preference and allows manual override.

**Priority Order:**
1. User's manual theme selection (stored in localStorage)
2. System theme preference (prefers-color-scheme)
3. Default to light theme

### Theme Switching

All notification components automatically adapt to the current theme. The theme transition is smooth (300ms) and affects:

- Background colors
- Text colors
- Border colors
- Shadow effects
- Icon colors

### Dark Mode Colors

In dark mode, components use adjusted colors for better visibility:

- **Backgrounds**: Darker shades (#1F2937, #111827)
- **Text**: Lighter shades (#F9FAFB, #D1D5DB)
- **Shadows**: Increased opacity for visibility
- **Borders**: Adjusted for contrast

---

## Accessibility

All notification components are built with accessibility in mind:

### ARIA Attributes

- Toast notifications use `role="status"` or `role="alert"`
- Modals use `role="dialog"` and `aria-modal="true"`
- All interactive elements have appropriate `aria-label` attributes

### Keyboard Navigation

- **Tab**: Navigate between interactive elements
- **Escape**: Close modals and dismissible notifications
- **Enter/Space**: Activate buttons

### Focus Management

- When a modal opens, focus moves to the first focusable element
- Focus is trapped within the modal
- When a modal closes, focus returns to the trigger element

### Screen Reader Support

- All status changes are announced to screen readers
- Error messages use `role="alert"` for immediate announcement
- Loading states provide appropriate feedback

### Color Independence

- Status is never indicated by color alone
- Icons and text labels accompany all color-coded states
- Sufficient contrast ratios (WCAG AA compliant)

---

## Examples

### Example 1: Form Submission with Toast

```tsx
import { useNotification } from './hooks/useNotification'

function MyForm() {
  const { showToast } = useNotification()

  const handleSubmit = async (data) => {
    try {
      await api.submitForm(data)
      showToast('success', 'Form submitted successfully!')
    } catch (error) {
      showToast('error', `Failed to submit: ${error.message}`)
    }
  }

  return <form onSubmit={handleSubmit}>{/* Form fields */}</form>
}
```

### Example 2: Delete Confirmation

```tsx
import { useNotification } from './hooks/useNotification'

function ItemList() {
  const { showModal, showToast } = useNotification()

  const handleDelete = async (itemId) => {
    const confirmed = await showModal({
      title: 'Delete Item',
      message: 'This action cannot be undone. Are you sure?',
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    })

    if (confirmed) {
      try {
        await api.deleteItem(itemId)
        showToast('success', 'Item deleted successfully')
      } catch (error) {
        showToast('error', 'Failed to delete item')
      }
    }
  }

  return <div>{/* Item list */}</div>
}
```

### Example 3: File Upload with Progress

```tsx
import { useState } from 'react'
import { ProgressBar } from './components/Notification/ProgressBar'
import { useNotification } from './hooks/useNotification'

function FileUpload() {
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const { showToast } = useNotification()

  const handleUpload = async (file) => {
    setUploading(true)
    setProgress(0)

    try {
      await api.uploadFile(file, (progressEvent) => {
        const percent = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        )
        setProgress(percent)
      })

      showToast('success', 'File uploaded successfully!')
    } catch (error) {
      showToast('error', 'Upload failed')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      {uploading && (
        <ProgressBar
          value={progress}
          label="Uploading..."
          showPercentage
        />
      )}
    </div>
  )
}
```

### Example 4: Empty State with Action

```tsx
import { EmptyState } from './components/Notification/EmptyState'
import { Plus } from 'lucide-react'

function ModelList() {
  const [models, setModels] = useState([])

  if (models.length === 0) {
    return (
      <EmptyState
        title="No AI Models"
        description="You haven't configured any AI models yet. Add your first model to get started."
        action={{
          label: 'Add Model',
          onClick: () => navigate('/models/new'),
          icon: <Plus size={16} />
        }}
        illustration="config"
      />
    )
  }

  return <div>{/* Render models */}</div>
}
```

### Example 5: Loading State

```tsx
import { LoadingSpinner } from './components/Notification/LoadingSpinner'

function DataTable() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])

  useEffect(() => {
    fetchData().then((result) => {
      setData(result)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <LoadingSpinner text="Loading data..." size="lg" />
  }

  return <table>{/* Render data */}</table>
}
```

### Example 6: Alert with Recovery Action

```tsx
import { AlertBox } from './components/Notification/AlertBox'

function DataView() {
  const [error, setError] = useState(null)

  const handleRetry = () => {
    setError(null)
    fetchData()
  }

  if (error) {
    return (
      <AlertBox
        type="error"
        title="Failed to Load Data"
        message={error.message}
        actions={[
          { label: 'Retry', onClick: handleRetry, variant: 'primary' },
          { label: 'Go Back', onClick: () => navigate(-1), variant: 'secondary' }
        ]}
      />
    )
  }

  return <div>{/* Data content */}</div>
}
```

---

## Best Practices

### Toast Notifications

1. **Keep messages concise** - Toast messages should be brief and to the point
2. **Use appropriate types** - Match the toast type to the message severity
3. **Don't overuse** - Too many toasts can be overwhelming
4. **Provide context** - Include enough information for users to understand what happened

### Modals

1. **Use for important actions** - Reserve modals for actions that require user confirmation
2. **Keep content focused** - Modal content should be clear and concise
3. **Provide clear actions** - Button labels should clearly indicate what will happen
4. **Use danger styling** - Apply danger styling for destructive actions

### Empty States

1. **Be helpful** - Provide guidance on what users should do next
2. **Use friendly language** - Make empty states welcoming, not discouraging
3. **Include actions** - Always provide a clear next step
4. **Use appropriate illustrations** - Choose illustrations that match the context

### Loading States

1. **Show immediately** - Display loading indicators as soon as an operation starts
2. **Provide context** - Include text that explains what's loading
3. **Use appropriate sizes** - Match spinner size to the context
4. **Consider skeleton screens** - For complex layouts, use skeleton screens instead

### Progress Bars

1. **Show accurate progress** - Update progress values in real-time
2. **Provide feedback** - Include labels that explain what's happening
3. **Handle errors** - Switch to error variant if operation fails
4. **Celebrate completion** - Use success variant when operation completes

---

## Troubleshooting

### Toasts not appearing

- Ensure `ToastContainer` is rendered in your app
- Check that `NotificationProvider` wraps your app
- Verify the toast is being called correctly

### Theme not switching

- Ensure `ThemeProvider` wraps your app
- Check that the `data-theme` attribute is set on the root element
- Verify localStorage is accessible

### Modal focus issues

- Ensure the modal has focusable elements
- Check that `closeOnEsc` is enabled if you want ESC to close
- Verify no other elements are capturing focus

### Accessibility warnings

- Run automated accessibility tests (axe-core)
- Ensure all interactive elements have labels
- Verify keyboard navigation works correctly

---

## API Reference Summary

### Components

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| Toast | Temporary notifications | type, message, duration |
| AlertBox | Persistent alerts | type, title, message, actions |
| Modal | Dialog boxes | isOpen, title, children, size |
| EmptyState | No data states | title, description, action |
| LoadingSpinner | Loading indicators | size, text, fullScreen |
| ProgressBar | Progress tracking | value, label, variant |

### Hooks

| Hook | Purpose | Returns |
|------|---------|---------|
| useNotification | Manage notifications | showToast, showModal, dismiss methods |
| useTheme | Manage theme | theme, setTheme, toggleTheme |

---

## Support

For issues or questions:
1. Check this documentation
2. Review the component source code
3. Check the design document at `.kiro/specs/ai-assistant-notification-enhancement/design.md`
4. Contact the development team

---

**Last Updated**: January 2026
**Version**: 1.0.0
