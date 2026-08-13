# Chat Application

A modern, responsive chat application built with React, TypeScript, and Tailwind CSS. Features include message persistence, theme support, auto-scrolling, typing indicators, and a polished user experience.

## Features

### Core Functionality

- **Message Persistence**: Messages automatically save to localStorage and restore on reload
- **Conversation Metadata**: Tracks conversation ID, creation time, and last updated timestamp
- **Auto-scroll**: Automatically scrolls to the latest message
- **Scroll to Bottom Button**: Appears when scrolled up for easy navigation
- **Typing Indicator**: Animated dots while assistant is typing

### User Experience

- **Message Display**: User messages on right, assistant on left with timestamps and copy buttons
- **Keyboard Shortcuts**: ESC to clear focus
- **Loading States**: Skeleton loaders for theme and logo
- **Error Handling**: Error boundary, localStorage quota handling, logo fallback

### Theming

- **Dynamic Themes**: Fetches configuration from API
- **Theme Persistence**: Saves to localStorage
- **Dark/Light Mode**: Full theme support
- **Custom Logo**: Per-theme branding

### Architecture

- **Component-based**: Modular with clear separation
- **Type-safe**: Full TypeScript coverage
- **Performance**: React.memo, useCallback, lazy loading with Suspense
- **Internationalization**: react-i18next support

## Prerequisites

- Node.js (v24 or higher)
- npm

## Getting Started

### 1. Install Dependencies

From the root of the monorepo:

```bash
npm install
```

### 2. Development Mode

Start the development server:

```bash
npm exec nx serve chat
```

The application will be available at `http://localhost:4207`

### 3. Production Build

Build the application for production:

```bash
npm exec nx build chat
```

The built files will be output to `dist/apps/chat/`.

## Project Structure

```
apps/chat/
├── src/
│   ├── app/
│   │   ├── app.tsx              # Main App component with lazy loading
│   │   └── app.spec.tsx         # App component tests
│   ├── components/
│   │   ├── ConversationView/    # Message list and scroll handling
│   │   ├── ErrorBoundary/       # Error boundary component
│   │   ├── Header/              # Header with logo
│   │   └── Message/             # Individual message component
│   ├── context/
│   │   └── ThemeContext.tsx     # Theme state management
│   ├── i18n/
│   │   └── config.ts            # i18n configuration
│   ├── server-api/
│   │   └── base.ts              # API client with type guards
│   ├── types/
│   │   └── index.ts             # Centralized TypeScript types
│   ├── utils/
│   │   ├── apply-theme-colors.ts
│   │   ├── icon-path.ts
│   │   └── local-storage.ts
│   ├── main.tsx                 # Entry point
│   └── styles.scss              # Global styles
└── README.md                    # This file
```

## Environment Variables

The application uses the following environment variables (configured in the API backend):

- `THEMES_CONFIG_URL` - URL to fetch theme configuration (required)
- `THEMES_SERVICE_TIMEOUT_MS` - Timeout for theme API requests (default: 5000ms)

## API Integration

### Theme API

The application expects a theme configuration from `/api/themes`:

```typescript
interface ThemeConfiguration {
  themes: Array<{
    id: string;
    name: string;
    colors: Record<string, string>;
  }>;
  images: Record<string, string>;
}
```

### Message API (Future)

Currently uses simulated responses. When integrating with real backend, replace `handleSend` in `app.tsx` with actual API calls.

### Tailwind CSS

Tailwind is configured with custom color variables and themes:

- Custom color palette based on CSS variables
- Custom screen breakpoints (mobile, tablet, desktop)
- Integration with EPAM AI DIAL UI Kit
- Responsive design utilities

See `tailwind.config.js` for full configuration.

## Internationalization (i18n)

The application supports multiple languages using `i18next`:

### Supported Languages

- English (`en`) — the default, and the only locale shipped today

Adding one is a code change, not deployment configuration: create
`src/i18n/locales/<lang>.json` with every key from `en.json`, register it in
`src/i18n/config.ts`, add it to the language selector, and — for a right-to-left
language — add its code to `RTL_LANGUAGES` so `document.documentElement.dir`
flips.

### Language Detection

The app automatically detects the user's language from:

1. `localStorage` (saved preference)
2. Browser navigator settings

### Adding Translations

1. Add translation keys to `src/i18n/locales/en.json` and every other locale file, and declare each key in `src/constants/translation-keys.ts`
2. Use the `useTranslation` hook in components:

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <div>{t('my.translation.key')}</div>;
}
```

### Language Switcher

Use the `<LanguageSwitcher />` component to allow users to change languages.

## Styling

### Global Styles

Global styles are defined in `src/styles.scss` with Tailwind imports:

```scss
@use 'tailwindcss/base';
@use 'tailwindcss/components';
@use 'tailwindcss/utilities';
```

### Component Styles

Component-specific styles use SCSS modules:

- `app.scss` - Application layout
- `language-switcher.scss` - Language switcher styles

### Tailwind Utilities

The project uses Tailwind utility classes for rapid UI development.

## Components

### ConversationInput

Chat input component from EPAM AI DIAL UI Kit:

```typescript
<ConversationInput
  onSend={handleSend}
  welcomeText={t('chat.welcomeText')}
  placeholder={t('chat.placeholder')}
/>
```

### LanguageSwitcher

Component for switching between supported languages.

## Testing

The application uses Vitest for unit testing:

```bash
# Run all tests
npm exec nx test chat

# Run tests in watch mode
npm exec nx test chat -- --watch

# Run tests with coverage
npm exec nx test chat -- --coverage
```

Test configuration:

- Environment: `jsdom`
- Coverage provider: `v8`
- Coverage output: `./test-output/vitest/coverage`

## Linting

```bash
# Run linter
npm exec nx lint chat

# Auto-fix linting issues
npm exec nx lint chat -- --fix
```

## Performance Optimizations

1. **React.memo**: All presentational components are memoized
2. **useCallback**: Event handlers wrapped with useCallback
3. **Lazy Loading**: ConversationView and ConversationInput are lazy-loaded
4. **Suspense Boundaries**: Loading fallback while lazy components load
5. **localStorage**: Messages persist without API calls

## Accessibility

- Semantic HTML elements
- ARIA labels on interactive elements
- Keyboard navigation (ESC to clear focus)
- Screen reader friendly error messages

## Known Limitations

1. **Demo Mode**: Currently uses simulated assistant responses
2. **Single Conversation**: Only supports one active conversation
3. **No Markdown**: Assistant messages render as plain text
4. **No Message Export**: Cannot export conversation history

## Future Enhancements

See [tasks.md](../../openspec/changes/add-chat-app-spec/tasks.md) for planned features:

- Theme picker UI
- Markdown support for messages
- Message export functionality
- Conversation title editing
- Additional keyboard shortcuts

## Related Documentation

- [Design Document](../../openspec/changes/add-chat-app-spec/design.md)
- [API Specification](../chat-api/README.md)

## Contributing

1. Create a feature branch from `development`
2. Make your changes with tests
3. Ensure all tests pass: `npm exec nx test chat`
4. Ensure linting passes: `npm exec nx lint chat`
5. Create a pull request to `development`

## TypeScript

The project uses TypeScript with strict configuration:

- Strict mode enabled
- Type checking for all files
- Custom type definitions in `i18n/i18next.d.ts`

## Browser Support

The application supports modern browsers:

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

Copyright © EPAM Systems
