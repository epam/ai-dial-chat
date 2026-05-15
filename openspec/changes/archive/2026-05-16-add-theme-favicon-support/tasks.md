# Tasks: add-theme-favicon-support

## Implementation Tasks

### High Priority: Core Implementation

- [x] Create useFavicon custom hook
  - Create `apps/chat/src/hooks/useFavicon.ts`
  - Implement useEffect to monitor faviconUrl parameter
  - Find or create `<link rel="icon">` element
  - Implement image preload to avoid broken icon flash
  - Add error handling for failed favicon loads
  - Add cache-busting using theme ID or timestamp
  - Add console logging for success/failure

- [x] Integrate useFavicon with ThemeContext
  - Extract `chat-favicon` from `config?.images`
  - Call `useFavicon(faviconUrl)` in ThemeProvider
  - Ensure favicon updates when theme changes
  - Test with theme that has favicon URL
  - Test with theme without favicon URL

- [x] Add default favicon to project
  - Create or obtain 32x32 PNG favicon
  - Add `favicon.png` to `apps/chat/public/` directory
  - Update `apps/chat/index.html` with default favicon link
  - Ensure default shows before theme loads

- [x] Update TypeScript types
  - Add `chat-favicon?: string` to ThemeConfiguration interface in `libs/chat-shared/src/models/theme.ts`
  - Document the new field with JSDoc comment
  - Export types if needed

### High Priority: Testing

- [x] Add unit tests for useFavicon hook
  - Test hook updates link element when URL provided
  - Test hook creates link element if none exists
  - Test hook handles undefined URL gracefully
  - Test image preload success path
  - Test image preload error path (onerror callback)
  - Test cache-busting parameter is applied
  - Mock DOM APIs (document.querySelector, createElement)

- [x] Add integration tests for ThemeContext
  - Test favicon URL extracted from theme config
  - Test useFavicon called with correct URL
  - Test favicon updates when setTheme() is called
  - Test backward compatibility (themes without favicon)
  - Mock useFavicon hook for easier testing

- [ ] Manual browser testing
  - Test in Chrome: verify favicon loads and updates
  - Test in Firefox: verify favicon loads and updates
  - Test in Safari: verify favicon loads and updates
  - Test in Edge: verify favicon loads and updates
  - Test favicon persists across page reloads
  - Test multiple tabs show same favicon
  - Test invalid URL doesn't break UX
  - Test missing favicon field shows default

### Medium Priority: Security & Configuration

- [ ] Update Content Security Policy
  - Review `apps/chat-api/src/main.ts` helmet configuration
  - Ensure `img-src` allows https: for favicons
  - Test CSP doesn't block favicon loading
  - Document CSP requirements for theme CDNs

- [ ] Add favicon URL validation (optional)
  - Validate URL starts with https://
  - Validate URL is from allowed domain (if restricting)
  - Log warning for invalid URLs
  - Fallback to default for invalid URLs

- [ ] Environment variable for default favicon
  - Add `DEFAULT_FAVICON_URL` env variable (optional)
  - Use env variable in useFavicon fallback
  - Document in README.md

### Medium Priority: Documentation

- [ ] Update theme API documentation
  - Document `images.chat-favicon` field in theme configuration schema
  - Provide example theme configuration with favicon
  - Document favicon file naming convention (`chat-favicon.png`)
  - Document recommended favicon size (32x32 PNG)

- [ ] Create favicon design guidelines
  - Document recommended dimensions: 32x32 pixels
  - Document format: PNG with transparency
  - Document file size: < 10 KB recommended
  - Provide design tips (simple, recognizable, high contrast)
  - Create example favicon template

- [ ] Update README.md
  - Document dynamic favicon feature
  - Explain how favicons are loaded from themes
  - Document fallback behavior
  - Link to favicon design guidelines

- [ ] Add JSDoc comments
  - Document useFavicon hook parameters and behavior
  - Document error handling and fallback logic
  - Document cache-busting strategy

### Low Priority: Polish & Enhancements

- [ ] Improve cache-busting strategy
  - Use theme ID instead of timestamp for better caching
  - Format: `${faviconUrl}?theme=${currentTheme}`
  - Test theme switching with new cache strategy
  - Verify browser caches favicon per theme

- [ ] Add loading state (optional)
  - Track favicon loading status in state
  - Expose loading status from useFavicon if needed
  - Could be used for loading indicator (though likely unnecessary)

- [ ] Add retry logic for failed loads (optional)
  - Retry failed favicon load once after 2 second delay
  - Max 1 retry attempt
  - Log retry attempts
  - Still fallback to default if retry fails

- [ ] Add favicon preconnect hint (optional)
  - Add `<link rel="preconnect">` for favicon CDN
  - Improves favicon load performance
  - Add to `apps/chat/index.html`

### Low Priority: Future Enhancements

- [ ] Support multiple favicon formats
  - Add SVG favicon support (`chat-favicon.svg`)
  - Add ICO favicon support (`chat-favicon.ico`)
  - Prioritize SVG > PNG > ICO
  - Update useFavicon to handle multiple formats

- [ ] Support light/dark mode favicons
  - Add `chat-favicon-light` and `chat-favicon-dark` fields
  - Detect system color scheme preference
  - Load appropriate favicon based on mode
  - Update when color scheme changes

- [ ] Add Apple touch icon support
  - Add `chat-apple-touch-icon` field to theme config
  - Create separate hook or extend useFavicon
  - Add `<link rel="apple-touch-icon">` to head
  - Document recommended size: 180x180 pixels

- [ ] Add PWA manifest icon support
  - Add `chat-icon-192` and `chat-icon-512` fields
  - Generate manifest.json dynamically
  - Include icons in manifest
  - Document PWA icon requirements

- [ ] Add favicon badge/notification support
  - Implement library for adding badge to favicon
  - Show unread message count on favicon
  - Update badge when messages received
  - Clear badge when messages read

### Testing Checklist

**Functional Tests:**
- [ ] Default favicon shows on initial load
- [ ] Favicon updates when theme changes
- [ ] Fallback works when theme has no favicon
- [ ] Error handling works for invalid URLs
- [ ] No broken icon flash during transitions
- [ ] Multiple tabs show consistent favicon
- [ ] Favicon persists after page reload

**Browser Compatibility:**
- [ ] Chrome 90+ shows favicon correctly
- [ ] Firefox 88+ shows favicon correctly
- [ ] Safari 14+ shows favicon correctly
- [ ] Edge 90+ shows favicon correctly

**Error Scenarios:**
- [ ] 404 URL doesn't break UI
- [ ] CORS error doesn't break UI
- [ ] Invalid image format doesn't break UI
- [ ] Network timeout doesn't break UI
- [ ] Missing images field in config works

**Performance:**
- [ ] Favicon loads asynchronously (doesn't block render)
- [ ] Favicon file size < 10 KB
- [ ] No memory leaks from frequent theme switches
- [ ] Browser cache works correctly

### Documentation Checklist

- [ ] API documentation updated with favicon field
- [ ] README includes favicon feature description
- [ ] Favicon design guidelines created
- [ ] Example theme configuration provided
- [ ] JSDoc comments on all functions
- [ ] Migration guide for theme creators

### Deployment Checklist

- [ ] All tests passing
- [ ] Linting passes
- [ ] Type checking passes
- [ ] Default favicon asset included in build
- [ ] CSP configuration updated
- [ ] Documentation merged
- [ ] Example themes updated with favicons (optional)

## Notes

- Keep implementation simple initially - can enhance later
- Prioritize backward compatibility - themes without favicon should work fine
- Focus on PNG format first, other formats can be added later
- Ensure no broken icon states - always have a fallback
- Monitor console for favicon loading issues in production

## Success Criteria

Implementation is complete when:
1. All high-priority tasks are finished
2. All tests pass (unit, integration, browser)
3. Documentation is complete
4. Works in all major browsers
5. No regressions in existing functionality
6. Backward compatible with existing themes
