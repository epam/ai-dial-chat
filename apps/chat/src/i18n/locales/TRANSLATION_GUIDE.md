# Translation Guide

This document provides context and guidelines for translators working on the Chat Application.

## Translation Keys Structure

### `chat.*` - Chat Interface

Main chat interface strings visible to users.

- **welcomeText**: Greeting message shown when starting a new conversation
  - Context: Displayed prominently in the center of an empty chat screen
  - Tone: Friendly and welcoming

- **placeholder**: Input field placeholder text
  - Context: Gray text inside the message input field
  - Note: The '/' character is a command trigger - keep it in translation

- **demoResponse**: Simulated response from the assistant
  - Context: Only visible in demo mode before API connection
  - Note: Should indicate this is not a real response

- **user**: Label for user messages
  - Context: Used in accessibility labels
  - Keep: Short and simple

- **assistant**: Label for assistant messages
  - Context: Used in accessibility labels
  - Keep: Short and simple

### `accessibility.*` - Accessibility Labels

Screen reader announcements and ARIA labels. These are NOT visible to sighted users but are critical for users with screen readers.

**Important**:

- Keep these concise but descriptive
- Focus on conveying purpose, not visual appearance
- Test with screen readers when possible

- **skipToContent**: Link to skip navigation
  - Context: First focusable element for keyboard users

- **conversationMessages**: Label for message list area
  - Context: Describes the scrollable message history region

- **messageInput**: Label for input area
  - Context: Describes where users type messages

- **welcomeScreen**: Label for initial empty state
  - Context: Describes the welcome screen before messages

- **userMessage**: Generic label for messages from the user
  - Context: Announced by screen readers for each user message

- **assistantMessage**: Generic label for messages from the assistant
  - Context: Announced by screen readers for each assistant message

- **assistantTyping**: Status message when assistant is responding
  - Context: Live region announcement while waiting for response

- **scrollToBottom**: Button to return to latest message
  - Context: Button label that appears when scrolled up

- **copyMessage**: Generic copy button label
  - Context: Used for copy functionality

- **copyUserMessage**: Specific label for copying user messages
  - Context: More descriptive label for screen readers

- **copyAssistantMessage**: Specific label for copying assistant messages
  - Context: More descriptive label for screen readers

- **logoLoading**: Status message while logo loads
  - Context: Temporary loading state for branding

### `actions.*` - Action Buttons

Generic action labels used throughout the interface.

- **copy**: Copy to clipboard action
  - Context: Tooltip and button text
  - Keep: Short (1-2 words)

- **send**: Send message action
  - Context: Submit button
  - Keep: Short and clear verb

- **loading**: Loading state indicator
  - Context: Shown during async operations
  - Note: Include ellipsis (...)

### `errors.*` - Error Messages

Error states and recovery options.

- **generic**: Generic error title
  - Context: Fallback error boundary title
  - Tone: Professional but not alarming

- **genericMessage**: Generic error explanation
  - Context: Detailed explanation in error boundary
  - Tone: Apologetic and helpful
  - Note: Should suggest refreshing the page

- **errorDetails**: Label for expandable error details
  - Context: Collapsible section in error boundary

- **tryAgain**: Retry button label
  - Context: Recovery action in error boundary
  - Keep: Short and action-oriented

- **failedToLoadTheme**: Theme loading error
  - Context: Console message and user notification
  - Note: Should indicate fallback is in use

- **failedToLoadLogo**: Logo loading error
  - Context: Console error message
  - Note: Not always visible to users

## Translation Best Practices

### General Guidelines

1. **Maintain tone consistency**: The app uses a friendly, professional tone
2. **Keep similar length**: Try to match the character length of the original text
3. **Preserve formatting**: Keep punctuation, ellipsis (...), and special characters
4. **Test RTL languages**: If translating to RTL languages, test the layout
5. **Cultural adaptation**: Adapt phrases to be culturally appropriate, not just literal

### Technical Considerations

1. **Placeholders**: If you see `{{variable}}` syntax in the future, do NOT translate the variable name
2. **HTML entities**: Preserve any HTML entities like `&nbsp;` or `&quot;`
3. **Line breaks**: Use `\n` for line breaks if needed (currently not used)
4. **Special characters**: Test that quotes and apostrophes display correctly

### Accessibility Translations

Screen reader text should:

- Be concise but informative
- Avoid redundancy (e.g., don't say "button" if it's already a button)
- Use action verbs for buttons (Copy, Send, Scroll)
- Use descriptive nouns for regions (Messages, Input, Screen)

### Quality Checklist

Before submitting translations:

- [ ] All keys from English (en.json) are present
- [ ] No untranslated English text remains
- [ ] Grammar and spelling are correct
- [ ] Tone is appropriate for the context
- [ ] Technical terms are translated consistently
- [ ] Tested in the application (if possible)
- [ ] Screen reader text is concise and clear

## Adding New Languages

To add a new language:

1. Copy `en.json` to a new file: `[language-code].json`
2. Translate all values (keep keys unchanged)
3. Add the new language to `i18n/config.ts`:

   ```typescript
   import newLang from './locales/[language-code].json';

   resources: {
     en: { translation: en },
     uk: { translation: uk },
     [language-code]: { translation: newLang },
   }
   ```

4. Test thoroughly with the language switcher

## Questions?

If you're unsure about any translation:

1. Check the context in this guide
2. Look at how it's used in the code
3. Ask the development team for clarification
4. Consider the user's perspective and experience

## Version History

- v1.0 (2026-05-08): Initial translation structure with accessibility support
