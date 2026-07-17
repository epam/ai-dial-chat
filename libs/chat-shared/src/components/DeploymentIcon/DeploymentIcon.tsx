import { DialTooltip } from '@epam/ai-dial-ui-kit';
import { type FC, type ReactNode, useEffect, useRef, useState } from 'react';
import { buildCssVars } from '../../utils/build-css-vars';
import { mergeClasses } from '../../utils/merge-class';
import { InitialsAvatar } from '../InitialsAvatar/InitialsAvatar';
import styles from './DeploymentIcon.module.scss';

/** CSS custom-property overrides for the `DeploymentIcon` component. */
export interface DeploymentIconColors {
  /** Badge background color. */
  background?: string;
}

/** User-visible strings for `DeploymentIcon`. */
export interface DeploymentIconLabels {
  /** When provided, a tooltip with this text is shown on hover/focus. */
  tooltip?: string;
}

/** Style overrides for `DeploymentIcon`. */
export interface DeploymentIconStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: DeploymentIconColors;
  /** Extra class applied to the outer badge wrapper, e.g. for a custom background variable. */
  badgeClassName?: string;
}

/** Props for `DeploymentIcon`. */
export interface DeploymentIconProps {
  /** Image URL to display. When absent the fallback is shown directly. */
  src?: string;
  /** Outer badge dimension in pixels. */
  size: number;
  /** Display name used to generate initials when no image is available. */
  initialsName: string;
  /** Custom node rendered when `src` is absent or the image fails to load. Overrides `initialsName`. */
  fallback?: ReactNode;
  /** User-visible strings. */
  labels?: DeploymentIconLabels;
  /** Style overrides. */
  styles?: DeploymentIconStyles;
}

/**
 * Renders a deployment icon inside a rounded badge.
 * The `size` prop is the outer badge dimension in pixels.
 * The icon image is inset by ~11 % (matching Figma) to leave a visible backdrop.
 * On image load error, or when `src` is absent, renders `InitialsAvatar` derived from
 * `initialsName` (or the custom `fallback` node when provided).
 * When `src` changes, the previous image stays visible until the new one has
 * finished preloading, avoiding the blank frame a browser shows while an
 * `<img>`'s `src` attribute is swapped in place.
 */
export const DeploymentIcon: FC<DeploymentIconProps> = ({
  src,
  size,
  initialsName,
  fallback,
  labels,
  styles: deploymentIconStyles,
}) => {
  const { tooltip } = labels ?? {};
  const { badgeClassName, colors } = deploymentIconStyles ?? {};
  const cssVars = buildCssVars({
    '--di-icon-bg': colors?.background,
  });
  const [displayedSrc, setDisplayedSrc] = useState(src);
  const [failedSrc, setFailedSrc] = useState<string>();
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (src === displayedSrc) return;

    if (src == null) {
      setDisplayedSrc(undefined);
      return;
    }

    let isCancelled = false;
    const preloadImg = new Image();
    preloadImg.onload = () => {
      if (!isCancelled) setDisplayedSrc(src);
    };
    preloadImg.onerror = () => {
      if (!isCancelled) {
        setFailedSrc(src);
        setDisplayedSrc(src);
      }
    };
    preloadImg.src = src;

    return () => {
      isCancelled = true;
    };
  }, [src, displayedSrc]);

  // Safety net for the rare case where the preload above succeeded (e.g. a
  // stale browser cache entry) but the actually-rendered <img> still fails.
  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const handler = () => setFailedSrc(displayedSrc);
    el.addEventListener('error', handler);
    return () => el.removeEventListener('error', handler);
  }, [displayedSrc]);

  const hasFailed = displayedSrc != null && failedSrc === displayedSrc;

  const defaultFallback = (
    <InitialsAvatar name={initialsName} size={size} className="shrink-0" />
  );

  const badge = (
    <div
      style={{ width: size, height: size, ...cssVars }}
      className={mergeClasses(
        styles.agentIconBadge,
        'shrink-0 overflow-hidden rounded-md',
        badgeClassName,
      )}
    >
      {!displayedSrc || hasFailed ? (
        <div className="flex size-full items-center justify-center">
          {fallback ?? defaultFallback}
        </div>
      ) : (
        <div className="size-full">
          <img
            ref={imgRef}
            src={displayedSrc}
            alt=""
            className="size-full object-contain"
          />
        </div>
      )}
    </div>
  );

  if (tooltip) {
    return (
      <DialTooltip tooltip={tooltip} triggerClassName="flex shrink-0">
        {badge}
      </DialTooltip>
    );
  }

  return badge;
};
