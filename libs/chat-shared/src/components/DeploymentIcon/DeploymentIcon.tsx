import { DialTooltip } from '@epam/ai-dial-ui-kit';
import { type FC, type ReactNode, useEffect, useRef, useState } from 'react';
import { mergeClasses } from '../../utils/merge-class';
import { InitialsAvatar } from '../InitialsAvatar/InitialsAvatar';
import styles from './DeploymentIcon.module.scss';

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
  /** Extra class applied to the outer badge wrapper, e.g. for a custom background variable. */
  badgeClassName?: string;
  /** When provided, a tooltip with this text is shown on hover/focus. */
  tooltip?: string;
}

/**
 * Renders a deployment icon inside a rounded badge.
 * The `size` prop is the outer badge dimension in pixels.
 * The icon image is inset by ~11 % (matching Figma) to leave a visible backdrop.
 * On image load error, or when `src` is absent, renders `InitialsAvatar` derived from
 * `initialsName` (or the custom `fallback` node when provided).
 */
export const DeploymentIcon: FC<DeploymentIconProps> = ({
  src,
  size,
  initialsName,
  fallback,
  badgeClassName,
  tooltip,
}) => {
  const [hasFailed, setHasFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setHasFailed(false);
  }, [src]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => setHasFailed(true);
    el.addEventListener('error', handler);
    return () => el.removeEventListener('error', handler);
  }, [src]);

  const defaultFallback = (
    <InitialsAvatar name={initialsName} size={size} className="shrink-0" />
  );

  const badge = (
    <div
      style={{ width: size, height: size }}
      className={mergeClasses(
        styles.agentIconBadge,
        'shrink-0 overflow-hidden rounded-[6px]',
        badgeClassName,
      )}
    >
      {!src || hasFailed ? (
        <div className="flex size-full items-center justify-center">
          {fallback ?? defaultFallback}
        </div>
      ) : (
        <div className="size-full">
          <img
            ref={ref}
            src={src}
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
