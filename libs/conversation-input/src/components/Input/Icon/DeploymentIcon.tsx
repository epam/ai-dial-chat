import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { type FC, type ReactNode, useEffect, useRef, useState } from 'react';
import FallbackEntityIcon from '../../../assets/fallback-entity-icon.svg?react';
import styles from './DeploymentIcon.module.scss';

/** Props for `DeploymentIcon`. */
export interface DeploymentIconProps {
  /** Image URL to display. When absent the `fallback` is shown directly. */
  src?: string;
  /** Outer badge dimension in pixels. */
  size: number;
  /** Node rendered when `src` is absent or the image fails to load. */
  fallback?: ReactNode;
  /** Extra class applied to the outer badge wrapper, e.g. for a custom background variable. */
  badgeClassName?: string;
}

/**
 * Renders a deployment icon inside a rounded badge.
 * The `size` prop is the outer badge dimension in pixels.
 * The icon image is inset by ~11 % (matching Figma) to leave a visible backdrop.
 * On image load error, or when `src` is absent, the `fallback` node is rendered centred inside the badge.
 */
export const DeploymentIcon: FC<DeploymentIconProps> = ({
  src,
  size,
  fallback = (
    <FallbackEntityIcon
      width={DIAL_ICON_SIZE.LG}
      height={DIAL_ICON_SIZE.LG}
      className="shrink-0"
    />
  ),
  badgeClassName,
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

  // ~11 % inset matches the Figma "inset-[11.11%]" applied to the icon inside its badge
  const padding = Math.round(size * 0.111);

  return (
    <div
      style={{ width: size, height: size }}
      className={mergeClasses(
        styles.agentIconBadge,
        badgeClassName,
        'shrink-0 overflow-hidden rounded-full',
      )}
    >
      {!src || hasFailed ? (
        <div className="flex size-full items-center justify-center">
          {fallback}
        </div>
      ) : (
        <div style={{ padding }} className="size-full">
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
};
