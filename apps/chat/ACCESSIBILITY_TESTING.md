# Accessibility Testing Guide

This document provides guidance for testing the Chat Application with screen readers and other assistive technologies.

## Overview

The Chat Application has been built with accessibility in mind, following WCAG 2.1 AA guidelines. This guide helps you verify that all accessibility features work correctly.

## Prerequisites

Before testing, ensure:

- The application is running locally or on a test server
- You have at least one screen reader installed
- Your browser is up to date
- Keyboard is available for testing

## Screen Reader Testing

### Recommended Screen Readers

#### Windows

- **NVDA** (Free, Open Source)
  - Download: https://www.nvaccess.org/download/
  - Keyboard shortcut: Ctrl + Alt + N (to start)
  - Best with: Firefox or Chrome

- **JAWS** (Commercial, Trial Available)
  - Download: https://www.freedomscientific.com/products/software/jaws/
  - Most widely used in professional settings
  - Best with: Chrome or Edge

#### macOS

- **VoiceOver** (Built-in)
  - Enable: System Preferences → Accessibility → VoiceOver
  - Keyboard shortcut: Cmd + F5 (toggle)
  - Best with: Safari

#### Linux

- **Orca** (Built-in with most distributions)
  - Enable through Accessibility settings
  - Best with: Firefox

## Test Scenarios

### 1. Page Load and Initial Navigation

**Goal**: Verify the page structure is announced correctly

#### Steps:

1. Start the screen reader
2. Navigate to the application
3. Let the screen reader announce the page

#### Expected Behavior:

- Page title is announced
- "Skip to main content" link is announced first
- Header region with logo is announced
- Main content region is identified
- Welcome screen is announced with appropriate context

#### Pass Criteria:

- [ ] Page title announced
- [ ] Skip link is first focusable element
- [ ] Regions are properly identified
- [ ] Welcome message is read clearly

### 2. Skip to Main Content Link

**Goal**: Verify keyboard users can bypass navigation

#### Steps:

1. Press Tab when page loads
2. Verify "Skip to main content" is focused
3. Press Enter
4. Verify focus moves to main content area

#### Expected Behavior:

- First Tab focuses skip link
- Skip link is visually visible when focused
- Pressing Enter moves focus to #main-content
- Screen reader announces the main content region

#### Pass Criteria:

- [ ] Skip link receives focus first
- [ ] Skip link visible on focus
- [ ] Pressing Enter moves focus correctly
- [ ] Main content region announced

### 3. Sending a Message

**Goal**: Verify the message sending process is accessible

#### Steps:

1. Tab to the message input field
2. Type a message
3. Press Enter or Tab to Send button
4. Send the message

#### Expected Behavior:

- Input field purpose is announced ("Message input" region)
- Typing is reflected by screen reader
- Send action is available via Enter key
- After sending:
  - New user message appears in conversation
  - "Assistant is typing" status announced
  - Assistant response announced when ready

#### Pass Criteria:

- [ ] Input field properly labeled
- [ ] Message can be sent via keyboard
- [ ] User message announced after sending
- [ ] Typing indicator announced
- [ ] Assistant response announced

### 4. Message List Navigation

**Goal**: Verify messages are accessible and navigable

#### Steps:

1. Send several messages to create a conversation
2. Navigate through messages using screen reader commands
3. Use Tab to reach copy buttons

#### Expected Behavior:

- Message list identified as "Conversation messages" log region
- Each message announced with role (User/Assistant)
- New messages announced automatically (aria-live)
- Copy buttons accessible via Tab
- Timestamps available but not intrusive

#### Pass Criteria:

- [ ] Message list announced as log region
- [ ] Each message role identified
- [ ] New messages announced automatically
- [ ] Copy buttons keyboard accessible
- [ ] Timestamps read on demand

### 5. Typing Indicator

**Goal**: Verify typing status is announced to screen readers

#### Steps:

1. Send a message
2. Wait for typing indicator to appear

#### Expected Behavior:

- "Assistant is typing" announced via live region
- Announcement is polite (doesn't interrupt)
- Status clears when response arrives

#### Pass Criteria:

- [ ] Typing status announced
- [ ] Announcement is non-intrusive
- [ ] Status clears appropriately

### 6. Scroll to Bottom Button

**Goal**: Verify scroll button is accessible

#### Steps:

1. Create a long conversation (10+ messages)
2. Scroll up in the message list
3. Tab to "Scroll to bottom" button
4. Activate button

#### Expected Behavior:

- Button announced as "Scroll to bottom of conversation"
- Button only appears when scrolled up
- Activating scrolls smoothly to bottom
- Focus remains manageable

#### Pass Criteria:

- [ ] Button properly labeled
- [ ] Button appears only when needed
- [ ] Activation works via keyboard
- [ ] Smooth scroll behavior

### 7. Copy Message Functionality

**Goal**: Verify message copying is accessible

#### Steps:

1. Tab to a message's copy button
2. Activate the copy button
3. Verify content copied to clipboard

#### Expected Behavior:

- Copy button announced with context (e.g., "Copy user message")
- Button shows on focus (not just hover)
- Activation copies message content
- Feedback provided (visual or auditory)

#### Pass Criteria:

- [ ] Copy button has descriptive label
- [ ] Button visible on keyboard focus
- [ ] Copying works via keyboard
- [ ] Success feedback provided

### 8. Theme and Logo Loading

**Goal**: Verify loading states are communicated

#### Steps:

1. Reload the page with slow connection (throttle network)
2. Observe theme and logo loading

#### Expected Behavior:

- Loading states announced
- Theme loading doesn't block interaction
- Errors announced if loading fails

#### Pass Criteria:

- [ ] Loading states announced
- [ ] Fallback content accessible
- [ ] No blocking interactions
- [ ] Errors communicated clearly

### 9. Keyboard Navigation Throughout

**Goal**: Verify all features accessible via keyboard

#### Steps:

1. Navigate entire app using only keyboard
2. Use Tab, Shift+Tab, Enter, Space, Esc
3. Verify all actions are possible

#### Expected Behavior:

- Logical tab order
- All interactive elements reachable
- Visual focus indicators present
- Escape key clears focus as expected
- No keyboard traps

#### Pass Criteria:

- [ ] Tab order is logical
- [ ] All features keyboard accessible
- [ ] Focus indicators visible
- [ ] Escape key works
- [ ] No keyboard traps

### 10. Error States

**Goal**: Verify errors are communicated accessibly

#### Steps:

1. Trigger error boundary (if possible)
2. Simulate localStorage quota error
3. Trigger theme/logo loading failure

#### Expected Behavior:

- Error messages announced by screen reader
- Error boundaries show accessible fallback
- Recovery actions clearly labeled
- Error details available but not intrusive

#### Pass Criteria:

- [ ] Errors announced
- [ ] Fallback UI accessible
- [ ] Recovery options clear
- [ ] Details available on demand

## Testing Checklist

### General Accessibility

- [ ] All images have alt text or aria-labels
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Focus indicators visible on all interactive elements
- [ ] No content flashing more than 3 times per second
- [ ] Page can be zoomed to 200% without loss of functionality
- [ ] All functionality available via keyboard
- [ ] Heading hierarchy is logical (h1, h2, h3...)
- [ ] Form inputs have associated labels
- [ ] Buttons have descriptive text
- [ ] Links have descriptive text (no "click here")

### ARIA Implementation

- [ ] Roles used appropriately (log, region, article, status)
- [ ] Live regions announce updates (aria-live="polite")
- [ ] Labels are descriptive (aria-label, aria-labelledby)
- [ ] Hidden content properly marked (aria-hidden, hidden)
- [ ] Invalid/required states communicated (if applicable)
- [ ] Expanded/collapsed states communicated (if applicable)
- [ ] Current page/tab indicated (if applicable)

### Screen Reader Specific

- [ ] Skip navigation link works
- [ ] Landmark regions identified (header, main, navigation)
- [ ] Reading order is logical
- [ ] Interactive elements have clear names
- [ ] Status messages announced politely
- [ ] Errors announced assertively (if critical)
- [ ] Progress/loading states communicated

## Common Issues to Watch For

### Screen Reader Issues

- Content announced multiple times
- Important updates not announced
- Confusing or redundant announcements
- Incorrect element roles
- Missing or poor labels

### Keyboard Issues

- Elements not reachable via Tab
- Keyboard traps (can't Tab away)
- Non-standard keyboard shortcuts conflicting
- Focus lost after interactions
- Invisible focus indicators

### Visual Issues

- Insufficient color contrast
- Focus indicators not visible
- Content overlapping when zoomed
- Text not resizable
- Poor readability

## Reporting Issues

When reporting accessibility issues, include:

1. **Issue Type**: Screen reader, keyboard, visual, etc.
2. **Severity**: Critical, High, Medium, Low
3. **Environment**:
   - Operating System
   - Browser and version
   - Screen reader and version (if applicable)
4. **Steps to Reproduce**: Clear, numbered steps
5. **Expected Behavior**: What should happen
6. **Actual Behavior**: What actually happens
7. **WCAG Criteria**: Which guideline is violated (if known)
8. **Screenshots/Videos**: If helpful

## Resources

### Guidelines and Standards

- [WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Articles](https://webaim.org/articles/)

### Testing Tools

- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [Lighthouse (Chrome DevTools)](https://developers.google.com/web/tools/lighthouse)
- [NVDA Screen Reader](https://www.nvaccess.org/)

### Learning Resources

- [WebAIM Screen Reader User Survey](https://webaim.org/projects/screenreadersurvey/)
- [A11ycasts with Rob Dodson](https://www.youtube.com/playlist?list=PLNYkxOF6rcICWx0C9LVWWVqvHlYJyqw7g)
- [The A11Y Project](https://www.a11yproject.com/)

## Notes

- **Screen reader testing should be done by actual screen reader users when possible**
- This guide provides a baseline, but real users may encounter issues not covered here
- Accessibility is an ongoing process - continue testing with each update
- Consider hiring professional accessibility auditors for comprehensive testing

## Version History

- v1.0 (2026-05-08): Initial accessibility testing guide
