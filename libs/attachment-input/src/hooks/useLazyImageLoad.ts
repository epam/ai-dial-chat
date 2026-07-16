import { type RefObject, useEffect, useRef, useState } from 'react';

/** Lazy-image load lifecycle. */
export enum LazyImageLoadStatus {
  /** Not yet requested to load. */
  Idle = 'idle',
  /** Image request is in flight; skeleton should stay visible. */
  Loading = 'loading',
  /** Image loaded successfully and can be shown. */
  Loaded = 'loaded',
  /** The image failed to load. */
  Error = 'error',
}

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
  const [imageLoadStatus, setImageLoadStatus] = useState<LazyImageLoadStatus>(
    LazyImageLoadStatus.Idle,
  );

  useEffect(() => {
    setImageLoadStatus(
      enabled && src ? LazyImageLoadStatus.Loading : LazyImageLoadStatus.Idle,
    );
  }, [enabled, src]);

  useEffect(() => {
    const imageElement = imageRef.current;
    if (!imageElement || !enabled || !src) {
      return;
    }

    const handleImageLoad = (): void =>
      setImageLoadStatus(LazyImageLoadStatus.Loaded);
    const handleImageError = (): void =>
      setImageLoadStatus(LazyImageLoadStatus.Error);

    imageElement.addEventListener('load', handleImageLoad);
    imageElement.addEventListener('error', handleImageError);

    if (imageElement.complete) {
      setImageLoadStatus(
        imageElement.naturalWidth > 0
          ? LazyImageLoadStatus.Loaded
          : LazyImageLoadStatus.Error,
      );
    }

    return () => {
      imageElement.removeEventListener('load', handleImageLoad);
      imageElement.removeEventListener('error', handleImageError);
    };
  }, [enabled, src]);

  return { imageRef, imageLoadStatus };
};
