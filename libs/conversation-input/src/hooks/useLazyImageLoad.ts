import { type RefObject, useEffect, useRef, useState } from 'react';

export type LazyImageLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface UseLazyImageLoadParams {
  enabled: boolean;
  src?: string;
}

/**
 * Tracks a lazily rendered image element so callers can keep a skeleton visible
 * until the browser either loads the image or reports a load error.
 */
export const useLazyImageLoad = ({
  enabled,
  src,
}: UseLazyImageLoadParams): {
  imageRef: RefObject<HTMLImageElement | null>;
  imageLoadStatus: LazyImageLoadStatus;
} => {
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoadStatus, setImageLoadStatus] =
    useState<LazyImageLoadStatus>('idle');

  useEffect(() => {
    setImageLoadStatus(enabled && src ? 'loading' : 'idle');
  }, [enabled, src]);

  useEffect(() => {
    const imageElement = imageRef.current;
    if (!imageElement || !enabled || !src) {
      return;
    }

    const handleImageLoad = (): void => setImageLoadStatus('loaded');
    const handleImageError = (): void => setImageLoadStatus('error');

    imageElement.addEventListener('load', handleImageLoad);
    imageElement.addEventListener('error', handleImageError);

    if (imageElement.complete) {
      setImageLoadStatus(imageElement.naturalWidth > 0 ? 'loaded' : 'error');
    }

    return () => {
      imageElement.removeEventListener('load', handleImageLoad);
      imageElement.removeEventListener('error', handleImageError);
    };
  }, [enabled, src]);

  return { imageRef, imageLoadStatus };
};
