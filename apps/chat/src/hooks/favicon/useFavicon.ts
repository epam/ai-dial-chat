import { useEffect } from 'react';
import { getIconPath } from '../../utils/icon-path';

/**
 * Custom hook to manage dynamic favicon based on URL.
 * Updates the page favicon when the URL changes, with support for:
 * - Image preloading to avoid broken icon flash
 * - Error handling for failed loads
 * - Cache-busting to force reload on theme changes
 *
 * @param faviconUrl - URL to the favicon image (typically PNG format)
 *
 * @example
 * ```tsx
 * const { faviconUrl } = useTheme();
 * useFavicon(faviconUrl);
 * ```
 */
export const useFavicon = (faviconUrl?: string) => {
  useEffect(() => {
    if (!faviconUrl) {
      // No favicon URL provided, keep default
      console.debug('No favicon URL provided, using default');
      return;
    }

    // Find existing favicon link element
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;

    if (!link) {
      // Create new link element if none exists
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      document.head.appendChild(link);
    }

    // Build URL
    const urlWithCache = getIconPath(faviconUrl);

    // Preload image to avoid broken icon flash
    const img = new Image();

    img.onload = () => {
      // Image loaded successfully, update favicon
      link.href = urlWithCache;
      console.log(`Favicon updated to: ${faviconUrl}`);
    };

    img.onerror = () => {
      // Image failed to load, log error but don't update favicon
      console.warn(`Failed to load favicon from ${faviconUrl}`);
      // Keep existing favicon (graceful fallback)
    };

    // Start loading the image
    img.src = urlWithCache;

    // Cleanup function (though link element persists)
    return () => {
      // No cleanup needed - favicon should persist
    };
  }, [faviconUrl]);
};
