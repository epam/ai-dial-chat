# Design: add-chat-app-spec

## Overview

The chat application is a React-based single-page application built with Vite and TypeScript. It provides a conversational interface for users to interact with AI assistants. The application features dynamic theming, internationalization, and integrates with a backend API for theme configuration.

## Architecture

### Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + @epam/ai-dial-ui-kit
- **State Management**: React Context API + useState hooks
- **i18n**: react-i18next
- **HTTP Client**: Fetch API
- **Component Library**: @epam/ai-dial-conversation-input

### Application Structure

```
apps/chat/src/
├── app/
│   ├── app.tsx                 # Main App component
│   └── app.spec.tsx            # App tests
├── components/
│   └── Header/
│       ├── Header.tsx          # Header component
│       └── Logo.tsx            # Logo component with theme support
├── context/
│   └── ThemeContext.tsx        # Theme context provider
├── i18n/
│   ├── config.ts               # i18next configuration
│   └── i18next.d.ts            # TypeScript declarations
├── server-api/
│   └── base.ts                 # API client and endpoints
├── utils/
│   ├── apply-theme-colors.ts  # Dynamic theme application
│   ├── icon-path.ts           # Icon path resolution
│   └── local-storage.ts       # LocalStorage utilities
├── constants/
│   └── translation-keys.ts    # i18n key constants
└── main.tsx                    # Application entry point
```

## Components

### App Component (`app/app.tsx`)

**Responsibilities**:

- Main application layout
- Message state management
- Conversation flow orchestration
- Conditional rendering (welcome screen vs. conversation view)

**State**:

```typescript
messages: Array<{ role: 'user' | 'assistant'; content: string }>;
```

**Behavior**:

- Empty state: Shows centered ConversationInput with welcome text
- Active conversation: Shows message history + bottom input
- Simulates assistant responses with 500ms delay
- Uses i18n for all text content

**Layout**:

- Full-height flex column
- Header at top (fixed)
- Content area (flex-1, scrollable)
- Input area at bottom (when messages exist)

### Header Component (`components/Header/Header.tsx`)

**Responsibilities**:

- Application header bar
- Logo display
- Border and background styling

**Styling**:

- Fixed height: 49px minimum
- Border bottom (theme-aware)
- Background: layer-1 (theme variable)
- Centered logo

### Logo Component (`components/Header/Logo.tsx`)

**Responsibilities**:

- Display theme-specific logo
- Fetch logo from API based on current theme
- Fallback to text if logo unavailable

**Integration**:

- Uses `useTheme()` hook for current theme logo
- Fetches SVG from `/api/themes/icon?iconName={logo}`

## Theme System

### ThemeContext (`context/ThemeContext.tsx`)

**Purpose**: Global theme management with dynamic color application

**Context Interface**:

```typescript
interface ThemeContextType {
  currentTheme: string; // Current theme ID ('light' | 'dark')
  currentThemeLogo?: string; // Logo filename for current theme
  themes?: Theme[]; // Available themes from API
  setTheme: (themeId: string) => void; // Theme setter
}
```

**State Management**:

- `config`: ThemeConfiguration from API
- `currentThemeId`: Active theme ID
- `currentLogo`: Logo filename for current theme

**Lifecycle**:

1. On mount: Fetch theme config from `/api/themes`
2. On config load: Read theme from localStorage or use first theme
3. On theme change: Apply colors to document root + update logo

**Theme Application** (`utils/apply-theme-colors.ts`):

```typescript
function applyThemeColors(root: HTMLElement, theme?: Theme);
```

- Applies CSS custom properties to document root
- Maps theme colors to CSS variables
- Updates dark mode class on `<html>`

**LocalStorage**:

- Key: `'theme'`
- Stores current theme ID for persistence
- Read on initialization

### Default Theme

- **ID**: `'dark'`
- Used as fallback when no theme is stored
- Logo selection: dark theme → `chat-logo-dark`, otherwise → `chat-logo-light`

## Internationalization (i18n)

### Configuration (`i18n/config.ts`)

**Framework**: react-i18next

**Settings**:

- Default language: `'en'`
- Fallback language: `'en'`
- Resources: Inline translations (no external files)

**Available Translations**:

```typescript
en: {
  translation: {
    'chat.welcomeText': string,    // Welcome message
    'chat.placeholder': string,    // Input placeholder
    'chat.demoResponse': string,   // Simulated response
  }
}
```

**Usage**:

```typescript
const { t } = useTranslation();
t('chat.welcomeText'); // Returns translated string
```

## API Integration

### Base API Client (`server-api/base.ts`)

**Purpose**: HTTP client wrapper for backend API communication

**Endpoints**:

```typescript
enum ApiEndpoints {
  THEMES = '/api/themes',
  THEMES_ICON = '/api/themes/icon',
}
```

**Methods**:

```typescript
get<T>(endpoint: ApiEndpoints, params?: Record<string, string>): Promise<T>
```

**Features**:

- Generic type support for responses
- Query parameter support
- Error handling (returns rejected promise on non-OK response)

**Usage Example**:

```typescript
const config = await get<ThemeConfiguration>(ApiEndpoints.THEMES);
const iconSvg = await get<string>(ApiEndpoints.THEMES_ICON, {
  iconName: 'logo.svg',
});
```

## Message Display

### Message Structure

```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
}
```

### UI Layout

**User Messages**:

- Aligned right (ml-auto)
- Max width: 70%
- Background: light gray (theme-aware)
- Rounded bubble style (rounded-2xl)
- Padding: px-4 py-3

**Assistant Messages**:

- Full width container
- Background: light gray (theme-aware)
- Text padding: p-4
- Line height: leading-7
- Dark mode support

**Message List**:

- Scrollable container (overflow-y-auto)
- Gap between messages: gap-6
- Max width: 3xl (centered)
- Padding: px-4 py-8

## Conversation Flow

### Welcome State (No Messages)

- Centered layout (flex-centered)
- ConversationInput with welcome text
- No message history visible

### Active Conversation State

**Layout**:

1. Header (fixed at top)
2. Message history (scrollable, flex-1)
3. Input area (fixed at bottom)

**Input Area Styling**:

- Border top (theme-aware)
- Background: white (theme-aware)
- Padding: py-4

### Message Sending

1. User types message in ConversationInput
2. `handleSend` is called with message text
3. Message added to state with role: 'user'
4. After 500ms delay, assistant response is added
5. Response uses i18n key: `'chat.demoResponse'`

## Utilities

### LocalStorage (`utils/local-storage.ts`)

**Purpose**: Safe localStorage access with SSR compatibility

**Function**:

```typescript
getFromLocalStorage(key: string): string | null
```

**Behavior**:

- Checks for `window` existence (SSR safety)
- Returns null if not in browser environment
- Wraps `localStorage.getItem()` with error handling

### Icon Path (`utils/icon-path.ts`)

**Purpose**: Resolve icon URLs from API

**Function**:

```typescript
getIconPath(iconName: string): string
```

**Returns**: Full URL for icon endpoint

- Format: `/api/themes/icon?iconName={iconName}`

## Styling

### Tailwind CSS Configuration

**Content Paths**:

- `apps/chat/src/**/*.{ts,tsx,html}`
- Scans all source files for Tailwind classes

**Theme Extension**:

- Uses @epam/ai-dial-ui-kit for design tokens
- CSS custom properties for dynamic theming
- Dark mode support via class strategy

**Common Classes**:

- Layout: `flex`, `flex-col`, `size-full`, `h-full`
- Spacing: `p-4`, `py-8`, `gap-6`
- Colors: Theme-aware via CSS variables
- Typography: `text-base`, `leading-7`
- Borders: `border-t`, `border-secondary`

### Dark Mode

**Strategy**: Class-based (`dark:` prefix)

**Implementation**:

- Applied to `<html>` element via ThemeContext
- All components use `dark:` variants
- Colors use CSS custom properties that change per theme

## Build Configuration

### Vite Configuration (`vite.config.mts`)

**Mode**: SPA

**Features**:

- TypeScript support
- React plugin with SWC for fast refresh
- PostCSS for Tailwind processing
- Asset optimization

**Dev Server**:

- Port: Configured in Nx workspace
- HMR (Hot Module Replacement) enabled

**Build Output**:

- Target: `dist/apps/chat`
- Static assets with hashed filenames
- Optimized chunks for code splitting

## Known Gaps

### 1. Simulated AI Responses

**Issue**: Assistant responses are hardcoded and simulated with setTimeout

**Current Behavior**:

```typescript
setTimeout(() => {
  setMessages((prev) => [
    ...prev,
    {
      role: 'assistant',
      content: t('chat.demoResponse'),
    },
  ]);
}, 500);
```

**Impact**: Not integrated with real AI service

**Recommendation**: Integrate with AI DIAL API or similar service

### 2. No Message Persistence

**Issue**: Messages are lost on page refresh

**Impact**: Users cannot resume conversations

**Recommendation**:

- Add localStorage persistence for messages
- Or integrate with backend API for conversation history

### 3. No Error Handling for API Calls

**Issue**: Theme API failures are not displayed to users

**Current Behavior**: Silent failures, no retry logic

**Recommendation**:

- Add error states in ThemeContext
- Show error messages to users
- Implement retry logic or fallbacks

### 4. No Loading States

**Issue**: No visual feedback while fetching themes or icons

**Impact**: Users may see flashing content or blank screens

**Recommendation**:

- Add loading spinners/skeletons
- Implement suspense boundaries
- Show loading state in Logo component

### 5. No Keyboard Shortcuts

**Issue**: No keyboard navigation beyond input focus

**Recommendation**:

- Add shortcuts for theme switching
- Add navigation shortcuts
- Implement accessibility features

### 6. No Message History Scrolling

**Issue**: New messages don't auto-scroll to bottom

**Impact**: Users must manually scroll to see new messages

**Recommendation**:

- Add auto-scroll to bottom on new messages
- Add "scroll to bottom" button when scrolled up

### 7. No Tests for Components

**Issue**: Only app.spec.tsx exists, no tests for other components

**Impact**: Risk of regressions

**Recommendation**:

- Add tests for Header, Logo components
- Add tests for ThemeContext
- Add tests for utilities

## Testing Strategy

**Framework**: Vitest + @testing-library/react

### Recommended Coverage

| Component/Utility    | Test Type   | Priority |
| -------------------- | ----------- | -------- |
| App component        | Integration | High     |
| Header component     | Unit        | Medium   |
| Logo component       | Unit        | High     |
| ThemeContext         | Integration | High     |
| applyThemeColors     | Unit        | High     |
| API client (base.ts) | Unit        | High     |
| LocalStorage utility | Unit        | Medium   |
| Icon path utility    | Unit        | Low      |
| i18n configuration   | Integration | Medium   |

### Test Scenarios

**App Component**:

- Renders welcome screen when no messages
- Renders conversation view with messages
- Calls onSend when message is submitted
- Displays user messages on right
- Displays assistant messages on left
- Uses i18n for all text

**ThemeContext**:

- Fetches theme config on mount
- Applies theme from localStorage
- Updates theme on setTheme call
- Applies colors to document root
- Updates logo when theme changes

**Logo Component**:

- Fetches and displays logo
- Falls back to text on error
- Updates when theme changes

## Deployment Considerations

### Build Process

```bash
nx build chat          # Build application
nx serve chat          # Development server
```

### Environment Variables

Currently none required. Theme configuration comes from API at runtime.

### Static Hosting

- SPA routing requires server-side rewrite rules
- All routes should serve `index.html`
- API calls proxied to backend (typically configured in nginx/CDN)

### API Integration

**Required**:

- `/api/themes` endpoint available
- `/api/themes/icon` endpoint available
- CORS configured for frontend domain

## Future Enhancements

1. **Real AI Integration**: Replace simulated responses with actual AI API calls
2. **Conversation History**: Persist conversations in backend
3. **User Authentication**: Add login/logout functionality
4. **Multiple Conversations**: Support conversation switching
5. **Rich Media**: Support images, code blocks, markdown
6. **Streaming Responses**: Show assistant responses as they're generated
7. **Theme Picker UI**: Add theme selection dropdown
8. **Accessibility**: Full WCAG 2.1 AA compliance
9. **Offline Support**: Service worker for offline functionality
10. **Analytics**: Track usage metrics and errors
