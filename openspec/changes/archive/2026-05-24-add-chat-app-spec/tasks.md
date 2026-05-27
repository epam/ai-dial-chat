# Tasks: add-chat-app-spec

## Spec-driven improvements to chat application

These tasks resolve the gaps identified in `design.md` and bring the implementation and tests into alignment with the specification.

---

### High Priority: Testing

- [x] Add unit tests for Logo component
  - Test logo fetches from API with correct theme
  - Test fallback to text when fetch fails
  - Test logo updates when theme changes
  - Mock fetch API and ThemeContext

- [x] Add unit tests for Header component
  - Test renders Logo component
  - Test applies correct styling classes
  - Snapshot test for structure

- [x] Add integration tests for ThemeContext
  - Test fetches theme config on mount
  - Test reads theme from localStorage
  - Test applies theme to document root
  - Test setTheme updates current theme
  - Test logo updates with theme
  - Mock API responses and localStorage

- [x] Add unit tests for API client (`base.ts`)
  - Test `get()` method with valid response
  - Test `get()` method with query parameters
  - Test error handling for non-OK responses
  - Test error handling for network failures
  - Mock global fetch

- [x] Add unit tests for `applyThemeColors` utility
  - Test applies theme colors to root element
  - Test handles undefined theme (fallback)
  - Test updates CSS custom properties
  - Test adds/removes dark class

- [x] Add unit tests for `getFromLocalStorage` utility
  - Test returns value from localStorage
  - Test returns null when key not found
  - Test returns null in SSR environment (no window)
  - Mock localStorage

- [x] Add unit tests for `getIconPath` utility
  - Test returns correct URL format
  - Test handles special characters in icon name

- [x] Expand App component tests (`app.spec.tsx`)
  - Test renders welcome screen with no messages
  - Test renders conversation view with messages
  - Test user messages display on right
  - Test assistant messages display on left
  - Test onSend adds user message
  - Test simulated response is added after delay
  - Test uses i18n for all text content

### High Priority: Error Handling & UX

- [x] Add error handling to ThemeContext
  - Add error state for theme fetch failures
  - Display error message to user when theme fetch fails
  - Add retry mechanism or fallback theme
  - Log errors to console for debugging

- [x] Add loading state to ThemeContext
  - Add `isLoading` flag to context
  - Show loading indicator while fetching themes
  - Prevent theme operations during loading

- [x] Add error handling to Logo component
  - Handle logo fetch failures gracefully
  - Add error state and retry button (optional)
  - Log fetch errors for monitoring

- [x] Add loading state to Logo component
  - Show skeleton/spinner while fetching logo
  - Prevent layout shift when logo loads

- [x] Implement auto-scroll for new messages
  - Scroll to bottom when new message is added
  - Use `useEffect` with messages dependency
  - Use `scrollIntoView()` or `scrollTo()`

- [x] Add "scroll to bottom" button
  - Show button when user scrolls up
  - Hide button when at bottom
  - Smooth scroll on click

### Medium Priority: Features

- [x] Add message persistence to localStorage
  - Store messages array in localStorage
  - Load messages on app initialization
  - Add clear conversation function
  - Handle localStorage quota errors

- [x] Add conversation metadata
  - Track conversation ID
  - Track creation timestamp
  - Track last updated timestamp
  - Store in localStorage with messages

- [x] Add keyboard shortcuts
  - Escape to clear focus
  - Ctrl+K / Cmd+K for command palette (future)
  - Document shortcuts in help tooltip

- [x] Add loading state for assistant responses
  - Show typing indicator while waiting for response
  - Use "..." or animated dots
  - Replace with actual message when ready

- [x] Improve message display
  - Add timestamps to messages
  - Add message IDs for key prop
  - Add copy button for messages
  - Add message actions (optional: regenerate, edit)

### Medium Priority: Code Quality

- [x] Extract message display to separate component
  - Create `Message.tsx` component
  - Props: `message`, `isUser`
  - Reuse in App component
  - Add tests for Message component

- [x] Extract conversation view to separate component
  - Create `ConversationView.tsx` component
  - Props: `messages`, `onSend`
  - Move message list and input from App
  - Add tests for ConversationView component

- [x] Add TypeScript interfaces file
  - Create `types/message.ts` for Message interface
  - Create `types/theme.ts` for theme types (if not in shared lib)
  - Export from index for easy imports

- [x] Improve type safety in API client
  - Add response validation with Zod or similar
  - Add type guards for API responses
  - Handle malformed responses

### Low Priority: Performance

- [x] Add React.memo to components
  - Memoize Logo component
  - Memoize Header component
  - Memoize Message component (when created)
  - Prevent unnecessary re-renders

- [x] Add lazy loading for ConversationInput
  - Use React.lazy for code splitting
  - Add Suspense boundary with fallback

- [x] Optimize re-renders in App
  - Use useCallback for handleSend
  - Use useMemo for computed values
  - Profile with React DevTools

### Documentation

- [x] Add README.md for chat application
  - Document features and usage
  - List environment variables (if any added)
  - Add development instructions
  - Add build and deployment instructions
  - Link to design.md

- [x] Add JSDoc comments to components
  - Document props interfaces
  - Add component descriptions
  - Document hooks and utilities

- [x] Update i18n translations
  - Add more translation keys as needed
  - Add comments for translators
  - Consider extracting to separate files

### Accessibility

- [x] Add ARIA labels
  - Label conversation region
  - Label message list
  - Label input area
  - Add screen reader announcements for new messages

- [x] Add focus management
  - Focus input after sending message
  - Trap focus in modals (if any)
  - Add skip to content link

- [x] Add keyboard navigation
  - Navigate between messages with arrow keys
  - Add shortcuts for common actions
  - Ensure all interactive elements are keyboard accessible

- [x] Test with screen readers
  - Test with NVDA
  - Test with JAWS
  - Test with VoiceOver
  - Fix any issues found
