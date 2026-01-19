# Notification Components

This directory contains the enhanced notification components for the AI Assistant feature, including Toast notifications, Alert boxes, and Modal dialogs with full theme support.

## Components

### 1. Toast (`Toast.tsx`)
Lightweight temporary notifications that auto-dismiss.

**Features:**
- 4 types: success, error, info, warning
- Auto-dismiss with configurable duration
- Manual close button
- Smooth slide-in/slide-out animations
- Full light/dark theme support
- ARIA attributes for accessibility

**Usage:**
```tsx
import { Toast } from './components/Notification'

<Toast
  id="unique-id"
  type="success"
  message="Operation completed successfully!"
  duration={3000}
  onClose={() => console.log('Toast closed')}
/>
```

### 2. AlertBox (`AlertBox.tsx`)
Persistent alert messages with optional action buttons.

**Features:**
- 4 types: success, error, info, warning
- Optional title and custom icon
- Action buttons with variants (primary, secondary, danger)
- Closable with close button
- Full light/dark theme support
- ARIA role="alert" for errors

**Usage:**
```tsx
import { AlertBox } from './components/Notification'

<AlertBox
  type="error"
  title="Error"
  message="An error occurred"
  actions={[
    { label: 'Retry', onClick: handleRetry, variant: 'primary' },
    { label: 'Cancel', onClick: handleCancel, variant: 'secondary' }
  ]}
  onClose={() => console.log('Alert closed')}
/>
```

### 3. NotificationModal (`Modal.tsx`)
Modal dialog with overlay and theme support.

**Features:**
- 4 sizes: sm (400px), md (600px), lg (800px), xl (1000px)
- Close on overlay click (configurable)
- Close on ESC key (configurable)
- Focus management (trap and restore)
- Smooth fade-in/scale animations
- Full light/dark theme support
- Custom footer support
- Danger mode for destructive actions

**Usage:**
```tsx
import { NotificationModal } from './components/Notification'

<NotificationModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Confirm Action"
  size="md"
  danger={true}
  footer={
    <div className="flex justify-end gap-3">
      <button onClick={() => setIsOpen(false)}>Cancel</button>
      <button onClick={handleConfirm}>Confirm</button>
    </div>
  }
>
  <p>Are you sure you want to proceed?</p>
</NotificationModal>
```

## Design Tokens

All components use the centralized design tokens from `src/styles/tokens.ts`:

- **Colors**: Light and dark theme color schemes for all notification types
- **Spacing**: Consistent spacing values (xs, sm, md, lg, xl, 2xl)
- **Typography**: Font sizes, weights, and line heights
- **Shadows**: Light and dark theme shadows
- **Border Radius**: Consistent corner rounding
- **Timing**: Animation durations and easing functions

## Theme Support

All components automatically adapt to the current theme using the `useTheme` hook:

```tsx
const { isDark } = useTheme()
```

The components will:
- Use appropriate colors for light/dark mode
- Adjust shadows for better visibility
- Maintain proper contrast ratios (4.5:1 minimum)
- Smooth transition when theme changes (300ms)

## Accessibility

All components follow accessibility best practices:

- **ARIA attributes**: Proper roles and labels
- **Keyboard navigation**: Full keyboard support
- **Focus management**: Proper focus trap in modals
- **Screen readers**: Descriptive labels and live regions
- **Color independence**: Icons and text, not just color

## Testing

Run tests with:
```bash
npm test -- Toast.test.tsx --run
```

## Demo

A demo component is available at `Demo.tsx` to showcase all notification components with theme switching.

## Requirements Validation

This implementation satisfies the following requirements:
- Requirements 1.1-1.8 (Toast notifications)
- Requirements 4.1-4.6 (Error messages)
- Requirements 5.1-5.6 (Success messages)
- Requirements 6.1-6.6 (Info messages)
- Requirements 7.1-7.6 (Warning messages)
- Requirements 8.1-8.8 (Modal dialogs)
- Requirements 13.1-13.10 (Theme support)

## Next Steps

To complete the notification system:
1. Implement EmptyState component (Task 2.1)
2. Implement LoadingSpinner component (Task 2.3)
3. Implement ProgressBar component (Task 2.6)
4. Create NotificationContext and hooks (Task 3)
5. Add animations (Task 4)
6. Integrate into AI Assistant pages (Task 7)
