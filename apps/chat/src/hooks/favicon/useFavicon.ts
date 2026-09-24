import { useEffect } from 'react';
import { getIconMimeType, getIconPath } from '../../utils/icon-path';

/**
 * Custom hook to manage dynamic favicon based on URL.
 * Updates the page favicon when the URL changes, with support for:
 * - Image preloading to avoid broken icon flash
 * - Error handling for failed loads
 * - Cache-busting to force reload on theme changes
 *
 * @param faviconUrl - Theme icon name of the favicon (SVG, PNG, ICO, …)
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
      console.error('No favicon URL provided, using default');
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
    let cancelled = false;

    img.onload = () => {
      if (cancelled) return;
      /*
       * Image loaded successfully, update favicon. The `type` must follow the
       * new icon: index.html ships `image/x-icon`, and a stale hint on an SVG
       * or PNG icon may make the browser skip it. An unknown extension drops
       * the hint so the browser sniffs the response instead. `href` goes
       * first so the new hint is never paired with the old icon URL.
       */
      link.href = urlWithCache;
      const mimeType = getIconMimeType(faviconUrl);
      if (mimeType) {
        link.type = mimeType;
      } else {
        link.removeAttribute('type');
      }
      console.info(`Favicon updated to: ${faviconUrl}`);
    };

    img.onerror = () => {
      if (cancelled) return;
      // Image failed to load, log error but don't update favicon
      console.warn(`Failed to load favicon from ${faviconUrl}`);
      // Keep existing favicon (graceful fallback)
    };

    // Start loading the image
    img.src = urlWithCache;

    /*
     * The favicon itself persists; only the in-flight preload is discarded so
     * a late load of a previous icon cannot overwrite the current one.
     */
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [faviconUrl]);
};
