# Design: Add Theme-Based Favicon Support

## Overview

This design document describes how to implement dynamic favicon loading based on theme configuration. The favicon will be fetched from the theme API and updated when users change themes, providing a complete branded experience.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser Tab                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  [Favicon] Chat Application                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   React Application                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              FaviconManager                          │  │
│  │  - useEffect hook monitoring theme                   │  │
│  │  - Updates <link rel="icon"> dynamically             │  │
│  │  - Handles errors and fallback                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                 │
│                           ▼                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              ThemeContext                            │  │
│  │  - currentTheme                                      │  │
│  │  - themeConfig (includes images.chat-favicon)        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Theme API (Backend)                        │
│  GET /api/themes                                            │
│  Response: {                                                │
│    themes: [...],                                          │
│    images: {                                               │
│      "chat-logo-dark": "...",                             │
│      "chat-logo-light": "...",                            │
│      "chat-favicon": "https://cdn.../chat-favicon.png"    │
│    }                                                       │
│  }                                                         │
└─────────────────────────────────────────────────────────────┘
```

## Data Model

### Theme Configuration Schema Update

```typescript
interface ThemeConfiguration {
  themes: Array<Theme>;
  images: {
    'chat-logo-dark'?: string;
    'chat-logo-light'?: string;
    'chat-favicon'?: string;  // NEW: Favicon URL
    [key: string]: string | undefined;
  };
}
```

### Favicon Resource Structure

- **URL Format**: Full URL to PNG image (e.g., `https://cdn.example.com/themes/theme-name/chat-favicon.png`)
- **File Format**: PNG
- **Recommended Size**: 32x32 pixels (browser will scale as needed)
- **File Name**: `chat-favicon.png` (convention for theme creators)

## Implementation Details

### 1. Frontend: Favicon Manager Hook

Create a custom hook to manage favicon updates:

**File**: `apps/chat/src/hooks/useFavicon.ts`

```typescript
import { useEffect } from 'react';

/**
 * Custom hook to manage dynamic favicon based on URL
 * @param faviconUrl - URL to the favicon image
 */
export const useFavicon = (faviconUrl?: string) => {
  useEffect(() => {
    if (!faviconUrl) {
      // No favicon URL provided, keep default
      return;
    }

    // Find existing favicon link element
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;

    if (!link) {
      // Create new link element if none exists
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    // Update favicon with cache-busting to force reload
    const urlWithCache = `${faviconUrl}?v=${Date.now()}`;

    // Preload image to avoid broken icon flash
    const img = new Image();
    img.onload = () => {
      // Image loaded successfully, update favicon
      link.href = urlWithCache;
    };
    img.onerror = () => {
      // Image failed to load, log error but don't update favicon
      console.warn(`Failed to load favicon from ${faviconUrl}`);
      // Keep existing favicon (fallback behavior)
    };
    img.src = urlWithCache;

  }, [faviconUrl]);
};
```

### 2. Integration with ThemeContext

**File**: `apps/chat/src/context/ThemeContext.tsx`

Add favicon URL extraction from theme configuration:

```typescript
export const ThemeProvider: FC<ThemeProviderProps> = ({ children }) => {
  // ... existing state ...
  const [config, setConfig] = useState<ThemeConfiguration | undefined>();

  // Extract favicon URL from images
  const faviconUrl = config?.images?.['chat-favicon'];

  // Use the favicon hook
  useFavicon(faviconUrl);

  // ... rest of implementation ...
};
```

### 3. Update Main Application

**File**: `apps/chat/src/main.tsx`

Ensure default favicon is present in index.html:

```html
<!-- Default favicon as fallback -->
<link rel="icon" type="image/png" href="/favicon.png" />
```

### 4. Backend: Theme API Update

**File**: `apps/chat-api/src/themes/theme.service.ts`

No code changes needed - the theme configuration already supports arbitrary keys in the `images` object. Theme providers just need to include `chat-favicon` in their configuration.

**Example Theme Configuration**:

```json
{
  "themes": [
    {
      "id": "corporate-dark",
      "name": "Corporate Dark",
      "colors": { "...": "..." }
    }
  ],
  "images": {
    "chat-logo-dark": "https://cdn.example.com/themes/corporate/logo-dark.svg",
    "chat-logo-light": "https://cdn.example.com/themes/corporate/logo-light.svg",
    "chat-favicon": "https://cdn.example.com/themes/corporate/chat-favicon.png"
  }
}
```

## Error Handling

### Favicon Load Failure

```typescript
// In useFavicon hook
img.onerror = () => {
  console.warn(`Failed to load favicon from ${faviconUrl}`);
  // Options:
  // 1. Keep current favicon (no-op) - CHOSEN approach
  // 2. Revert to default favicon
  // 3. Show error indicator (too intrusive)
};
```

**Strategy**: Log warning and keep existing favicon. This provides graceful degradation without interrupting user experience.

### Missing Favicon in Theme Config

```typescript
// In ThemeProvider
const faviconUrl = config?.images?.['chat-favicon'];
// If undefined, useFavicon will be a no-op, keeping default
```

**Strategy**: Default favicon remains if theme doesn't provide one. Fully backward compatible.

### CORS Issues

**Prevention**: Ensure favicon CDN includes proper CORS headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET
```

**Detection**: Browser console will show CORS error, caught by img.onerror

## Browser Compatibility

### Supported Browsers

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 90+ | ✅ Full | Dynamic link.href updates work well |
| Firefox 88+ | ✅ Full | Dynamic link.href updates work well |
| Safari 14+ | ✅ Full | May need cache-busting |
| Edge 90+ | ✅ Full | Chromium-based, same as Chrome |

### Fallback Behavior

All browsers will gracefully fall back to the default favicon if:
- Theme doesn't provide favicon URL
- Favicon URL fails to load
- CORS prevents loading

## Performance Considerations

### Caching Strategy

```typescript
// Cache-busting when theme changes
const urlWithCache = `${faviconUrl}?v=${Date.now()}`;
```

**Pros**:
- Forces browser to load new favicon when theme changes
- Prevents stale favicon after theme switch

**Cons**:
- Bypasses browser cache, re-downloads on every theme change

**Alternative**: Use theme ID as cache key instead of timestamp

```typescript
const urlWithCache = `${faviconUrl}?theme=${currentTheme}`;
```

**Recommendation**: Use theme ID for better caching

### Loading Performance

- **Async Loading**: Favicon loads asynchronously, doesn't block page render
- **Preload Check**: Image preload prevents broken icon flash
- **No Layout Impact**: Favicon changes don't affect page layout or reflow

### Network Impact

- **Size**: Typical favicon ~2-5 KB
- **Frequency**: Only loads when theme changes
- **CDN**: Should be served from CDN for fast delivery

## Security Considerations

### Content Security Policy (CSP)

Update CSP to allow favicon from theme CDN:

```typescript
// In apps/chat-api/src/main.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: [
        "'self'",
        "data:",
        "https:",  // Allow HTTPS images including favicons
      ],
      // ... other directives ...
    },
  },
}));
```

### URL Validation

Ensure favicon URLs are from trusted sources:

```typescript
// In useFavicon hook (optional additional validation)
if (faviconUrl && !faviconUrl.startsWith('https://')) {
  console.warn('Favicon URL must use HTTPS');
  return;
}
```

## Testing Strategy

### Unit Tests

```typescript
// apps/chat/src/hooks/useFavicon.spec.ts
describe('useFavicon', () => {
  it('should update favicon when URL provided', () => {
    // Test favicon link element creation and update
  });

  it('should handle missing favicon URL gracefully', () => {
    // Test with undefined URL
  });

  it('should handle favicon load errors', () => {
    // Test img.onerror callback
  });

  it('should use cache-busting for theme changes', () => {
    // Test URL includes cache parameter
  });
});
```

### Integration Tests

```typescript
// apps/chat/src/context/ThemeContext.spec.tsx
describe('ThemeContext with Favicon', () => {
  it('should extract favicon URL from theme config', () => {
    // Test faviconUrl extraction
  });

  it('should update favicon when theme changes', () => {
    // Test favicon updates on setTheme()
  });
});
```

### Manual Testing

1. **Default Favicon**: Load app, verify default favicon shows
2. **Theme Favicon**: Change theme with custom favicon, verify it updates
3. **Fallback**: Use theme without favicon, verify default remains
4. **Error Handling**: Use invalid favicon URL, verify no broken icon
5. **Browser Tabs**: Open multiple tabs, verify favicon consistent

## Monitoring and Observability

### Logging

```typescript
// Success case
console.log(`Favicon updated to: ${faviconUrl}`);

// Error case
console.warn(`Failed to load favicon from ${faviconUrl}`);

// No favicon provided
console.debug('No favicon URL in theme config, using default');
```

### Metrics (Future)

Could track:
- Favicon load success/failure rate
- Favicon load time
- Themes with/without custom favicons

## Migration Strategy

### Phase 1: Implementation (Week 1)
- Add useFavicon hook
- Integrate with ThemeContext
- Add default favicon to public folder
- Update CSP headers

### Phase 2: Testing (Week 1)
- Unit tests for useFavicon
- Integration tests with ThemeContext
- Manual browser testing
- Document favicon specifications

### Phase 3: Documentation (Week 1)
- Update theme API documentation
- Create favicon design guidelines (32x32 PNG)
- Add example theme configurations

### Phase 4: Rollout (Week 2)
- Deploy to development environment
- Test with existing themes (all should use default)
- Add custom favicons to themes gradually
- Monitor for errors

## Rollback Plan

If issues arise:

1. **Quick Fix**: Comment out `useFavicon()` call in ThemeProvider
2. **Full Rollback**: Revert PR, all themes will use default favicon
3. **Impact**: No data loss, only visual branding reverts to default

## Future Enhancements

### Multiple Icon Formats

Support ICO, SVG formats:

```typescript
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" href="/favicon.png" />
```

### Apple Touch Icons

```typescript
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
```

### PWA Manifest Icons

```json
{
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Favicon Badge Notifications

Show unread message count on favicon (like Slack, Discord).

## Open Questions

**Q: Should we validate favicon image dimensions?**
A: No, browser will scale automatically. Document recommended 32x32 size.

**Q: Should we support both light and dark favicons?**
A: Not initially. Single favicon per theme. Can add `chat-favicon-dark` in future.

**Q: What if favicon URL returns 404?**
A: img.onerror will catch it, default favicon remains. Log warning to console.

**Q: Should favicon be cached in localStorage?**
A: No, browser cache is sufficient. Would add complexity for minimal benefit.

## Success Metrics

1. **Functional**: All browsers show correct favicon for selected theme
2. **Performance**: Favicon loads in < 500ms on average connection
3. **Reliability**: < 1% favicon load failures in production
4. **Adoption**: 50%+ of themes provide custom favicon within 3 months

## References

- [MDN: Link Rel Icon](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel#icon)
- [Favicon Best Practices](https://web.dev/articles/add-manifest)
- [WCAG 2.1 (no specific favicon requirements)](https://www.w3.org/WAI/WCAG21/quickref/)
