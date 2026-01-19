# Storybook Setup Guide for Notification Components

## Overview

This guide provides instructions for setting up Storybook to create interactive documentation and examples for the notification components. Storybook is optional but highly recommended for component development and testing.

## Why Storybook?

- **Interactive Documentation**: View and interact with components in isolation
- **Visual Testing**: See all component states and variants at a glance
- **Development Workflow**: Develop components without running the full application
- **Design System**: Create a living style guide for your team

## Installation

### 1. Install Storybook

```bash
cd admin-mit-ui
npx storybook@latest init
```

This will:
- Detect your project type (Vite + React)
- Install necessary dependencies
- Create `.storybook` configuration folder
- Add example stories

### 2. Install Additional Addons

```bash
npm install --save-dev @storybook/addon-a11y @storybook/addon-themes
```

- `addon-a11y`: Accessibility testing
- `addon-themes`: Theme switching support

### 3. Configure Storybook

Update `.storybook/main.ts`:

```typescript
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
}

export default config
```

### 4. Configure Theme Support

Update `.storybook/preview.ts`:

```typescript
import type { Preview } from '@storybook/react'
import { withThemeByDataAttribute } from '@storybook/addon-themes'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
  decorators: [
    withThemeByDataAttribute({
      themes: {
        light: 'light',
        dark: 'dark',
      },
      defaultTheme: 'light',
      attributeName: 'data-theme',
    }),
  ],
}

export default preview
```

## Creating Stories

### Story Structure

Each component should have its own `.stories.tsx` file in the same directory:

```
src/components/Notification/
├── Toast.tsx
├── Toast.stories.tsx
├── AlertBox.tsx
├── AlertBox.stories.tsx
└── ...
```

### Example Stories

#### Toast Stories

Create `src/components/Notification/Toast.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { Toast } from './Toast'

const meta = {
  title: 'Notification/Toast',
  component: Toast,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['success', 'error', 'info', 'warning'],
    },
    duration: {
      control: 'number',
    },
  },
} satisfies Meta<typeof Toast>

export default meta
type Story = StoryObj<typeof meta>

export const Success: Story = {
  args: {
    id: '1',
    type: 'success',
    message: 'Operation completed successfully!',
    closable: true,
  },
}

export const Error: Story = {
  args: {
    id: '2',
    type: 'error',
    message: 'An error occurred while processing your request.',
    closable: true,
  },
}

export const Info: Story = {
  args: {
    id: '3',
    type: 'info',
    message: 'New features are now available.',
    closable: true,
  },
}

export const Warning: Story = {
  args: {
    id: '4',
    type: 'warning',
    message: 'Your session will expire in 5 minutes.',
    closable: true,
  },
}

export const LongMessage: Story = {
  args: {
    id: '5',
    type: 'info',
    message: 'This is a very long message that demonstrates how the toast component handles longer text content. It should wrap appropriately and maintain good readability.',
    closable: true,
  },
}

export const NotClosable: Story = {
  args: {
    id: '6',
    type: 'success',
    message: 'This toast cannot be closed manually.',
    closable: false,
  },
}
```

#### AlertBox Stories

Create `src/components/Notification/AlertBox.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { AlertBox } from './AlertBox'

const meta = {
  title: 'Notification/AlertBox',
  component: AlertBox,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AlertBox>

export default meta
type Story = StoryObj<typeof meta>

export const Success: Story = {
  args: {
    type: 'success',
    title: 'Success',
    message: 'Your changes have been saved successfully.',
    closable: true,
  },
}

export const Error: Story = {
  args: {
    type: 'error',
    title: 'Error',
    message: 'Failed to connect to the server. Please check your internet connection.',
    closable: true,
  },
}

export const ErrorWithActions: Story = {
  args: {
    type: 'error',
    title: 'Connection Error',
    message: 'Unable to reach the server.',
    actions: [
      { label: 'Retry', onClick: () => alert('Retry clicked'), variant: 'primary' },
      { label: 'Cancel', onClick: () => alert('Cancel clicked'), variant: 'secondary' },
    ],
  },
}

export const Warning: Story = {
  args: {
    type: 'warning',
    title: 'Unsaved Changes',
    message: 'You have unsaved changes. Do you want to save them before leaving?',
    actions: [
      { label: 'Save', onClick: () => alert('Save clicked'), variant: 'primary' },
      { label: 'Discard', onClick: () => alert('Discard clicked'), variant: 'danger' },
    ],
  },
}

export const Info: Story = {
  args: {
    type: 'info',
    title: 'Information',
    message: 'This feature is currently in beta. Please report any issues you encounter.',
  },
}
```

#### Modal Stories

Create `src/components/Notification/Modal.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { Modal } from './Modal'
import { useState } from 'react'

const meta = {
  title: 'Notification/Modal',
  component: Modal,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Modal>

export default meta
type Story = StoryObj<typeof meta>

// Wrapper component to handle state
const ModalWrapper = (args: any) => {
  const [isOpen, setIsOpen] = useState(true)
  
  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Modal</button>
      <Modal {...args} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}

export const Small: Story = {
  render: (args) => <ModalWrapper {...args} />,
  args: {
    title: 'Small Modal',
    size: 'sm',
    children: <p>This is a small modal.</p>,
  },
}

export const Medium: Story = {
  render: (args) => <ModalWrapper {...args} />,
  args: {
    title: 'Medium Modal',
    size: 'md',
    children: <p>This is a medium modal (default size).</p>,
  },
}

export const Large: Story = {
  render: (args) => <ModalWrapper {...args} />,
  args: {
    title: 'Large Modal',
    size: 'lg',
    children: (
      <div>
        <p>This is a large modal with more content.</p>
        <p>It can contain multiple paragraphs and elements.</p>
      </div>
    ),
  },
}

export const DangerAction: Story = {
  render: (args) => <ModalWrapper {...args} />,
  args: {
    title: 'Delete Item',
    danger: true,
    children: (
      <p>Are you sure you want to delete this item? This action cannot be undone.</p>
    ),
    footer: (
      <div className="flex gap-2">
        <button className="btn-danger">Delete</button>
        <button className="btn-secondary">Cancel</button>
      </div>
    ),
  },
}
```

#### EmptyState Stories

Create `src/components/Notification/EmptyState.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { EmptyState } from './EmptyState'
import { Plus, Search, Database } from 'lucide-react'

const meta = {
  title: 'Notification/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const NoModels: Story = {
  args: {
    title: 'No Models Configured',
    description: 'Get started by adding your first AI model configuration.',
    action: {
      label: 'Add Model',
      onClick: () => alert('Add model clicked'),
      icon: <Plus size={16} />,
    },
    illustration: 'config',
  },
}

export const NoSearchResults: Story = {
  args: {
    title: 'No Results Found',
    description: 'Try adjusting your search terms or filters.',
    action: {
      label: 'Clear Filters',
      onClick: () => alert('Clear filters clicked'),
      icon: <Search size={16} />,
    },
    illustration: 'search',
  },
}

export const NoData: Story = {
  args: {
    title: 'No Data Available',
    description: 'There is no data to display at this time.',
    illustration: 'data',
  },
}

export const WithCustomIcon: Story = {
  args: {
    title: 'Database Empty',
    description: 'Your database is empty. Import data to get started.',
    icon: <Database size={64} className="text-gray-400" />,
    action: {
      label: 'Import Data',
      onClick: () => alert('Import clicked'),
    },
  },
}
```

#### LoadingSpinner Stories

Create `src/components/Notification/LoadingSpinner.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { LoadingSpinner } from './LoadingSpinner'

const meta = {
  title: 'Notification/LoadingSpinner',
  component: LoadingSpinner,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof LoadingSpinner>

export default meta
type Story = StoryObj<typeof meta>

export const Small: Story = {
  args: {
    size: 'sm',
  },
}

export const Medium: Story = {
  args: {
    size: 'md',
  },
}

export const Large: Story = {
  args: {
    size: 'lg',
  },
}

export const WithText: Story = {
  args: {
    size: 'md',
    text: 'Loading data...',
  },
}

export const FullScreen: Story = {
  args: {
    fullScreen: true,
    text: 'Initializing application...',
  },
  parameters: {
    layout: 'fullscreen',
  },
}
```

#### ProgressBar Stories

Create `src/components/Notification/ProgressBar.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { ProgressBar } from './ProgressBar'

const meta = {
  title: 'Notification/ProgressBar',
  component: ProgressBar,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ProgressBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    value: 45,
    label: 'Processing...',
    showPercentage: true,
  },
}

export const Success: Story = {
  args: {
    value: 100,
    variant: 'success',
    label: 'Upload complete',
    showPercentage: true,
  },
}

export const Warning: Story = {
  args: {
    value: 75,
    variant: 'warning',
    label: 'Storage almost full',
    showPercentage: true,
  },
}

export const Error: Story = {
  args: {
    value: 30,
    variant: 'error',
    label: 'Upload failed',
    showPercentage: true,
  },
}

export const NoLabel: Story = {
  args: {
    value: 60,
    showPercentage: true,
  },
}

export const NoPercentage: Story = {
  args: {
    value: 80,
    label: 'Downloading...',
    showPercentage: false,
  },
}
```

## Running Storybook

### Development Mode

```bash
npm run storybook
```

This will start Storybook on `http://localhost:6006`

### Build for Production

```bash
npm run build-storybook
```

This creates a static build in `storybook-static/` that can be deployed.

## Best Practices

### 1. Organize Stories

Group related stories using the `title` property:

```typescript
title: 'Notification/Toast'  // Creates Notification > Toast hierarchy
```

### 2. Use Controls

Enable interactive controls for props:

```typescript
argTypes: {
  type: {
    control: 'select',
    options: ['success', 'error', 'info', 'warning'],
  },
}
```

### 3. Document Components

Use JSDoc comments for automatic documentation:

```typescript
/**
 * Toast component for displaying temporary notifications
 * 
 * @param type - The type of toast (success, error, info, warning)
 * @param message - The message to display
 */
```

### 4. Test Accessibility

Use the a11y addon to check for accessibility issues:
- View the "Accessibility" tab in Storybook
- Fix any violations reported

### 5. Test All States

Create stories for:
- Default state
- All variants
- Edge cases (long text, no data, etc.)
- Interactive states (hover, focus, disabled)

## Integration with CI/CD

### Visual Regression Testing

Install Chromatic for visual regression testing:

```bash
npm install --save-dev chromatic
```

Add to `package.json`:

```json
{
  "scripts": {
    "chromatic": "chromatic --project-token=<your-token>"
  }
}
```

### Automated Testing

Run interaction tests:

```bash
npm run test-storybook
```

## Deployment

Deploy Storybook to various platforms:

### Netlify

```bash
npm run build-storybook
# Deploy storybook-static/ folder
```

### GitHub Pages

Add to `.github/workflows/storybook.yml`:

```yaml
name: Deploy Storybook

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm run build-storybook
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./storybook-static
```

## Troubleshooting

### Styles not loading

Ensure you import your CSS in `.storybook/preview.ts`:

```typescript
import '../src/index.css'
```

### Theme not working

Check that the theme decorator is properly configured and the `data-theme` attribute is being set.

### Components not rendering

Verify that all dependencies are installed and imported correctly.

## Resources

- [Storybook Documentation](https://storybook.js.org/docs)
- [Storybook Addons](https://storybook.js.org/addons)
- [Writing Stories](https://storybook.js.org/docs/react/writing-stories/introduction)
- [Testing with Storybook](https://storybook.js.org/docs/react/writing-tests/introduction)

---

**Note**: This is an optional setup. The notification components work perfectly without Storybook, but Storybook provides a better development and documentation experience.
