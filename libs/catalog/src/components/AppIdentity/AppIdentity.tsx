import {
  DeploymentIcon,
  Highlight,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { FC, ReactNode } from 'react';

/** Props for the shared AppIdentity block used in browse and favorite cards. */
export interface AppIdentityProps {
  /** Icon image URL. When absent, the DeploymentIcon renders a tinted fallback. */
  icon?: string | null;
  /** Entity type label rendered as plain uppercase text — no pill, no background. */
  type: string;
  /** Display name. Truncates when the available width is exceeded. */
  name: string;
  /** Version string shown flush-right of the name, aligned to the top of the name. */
  version?: string;
  /**
   * Relative time string for the last-used row (size 'lg' only).
   * When undefined, the row is hidden even in size 'lg'.
   */
  lastUsed?: string;
  /**
   * 'sm' — browse cards: 44 px logo, radius 12 px, no last-used line.
   * 'lg' — favorite cards: 54 px logo, radius 14 px, includes last-used line.
   */
  size: 'sm' | 'lg';
  /** Search query used to highlight matching text in the name. */
  query?: string;
  /** Additional classes applied to the root element. */
  className?: string;
  /** CSS class for the type label. Default: 'dial-tiny-semi-text text-accent-primary'. */
  typeClassName?: string;
  /** Explicit color applied to the type label as an inline style — overrides typeClassName's color. */
  typeColor?: string;
  /** CSS class for the entity name. Default: 'dial-body-semi-text text-primary'. */
  nameClassName?: string;
  /** CSS class for the version string. Default: 'dial-tiny-text text-secondary'. */
  versionClassName?: string;
  /** CSS class for the last-used line text and icon. Default: 'dial-tiny-text text-secondary'. */
  lastUsedClassName?: string;
  /** Element rendered at the end of the last-used row (size 'lg' only). */
  lastUsedTrailing?: ReactNode;
  /** CSS class applied to the icon badge. Defaults to `'bg-layer-2'`. */
  badgeClassName?: string;
}

/** Shared identity block: logo + type + name + version + optional last-used row. */
export const AppIdentity: FC<AppIdentityProps> = ({
  icon,
  type,
  name,
  version,
  lastUsed,
  size,
  query,
  className,
  typeClassName = 'dial-caption-text font-semibold text-accent-primary',
  typeColor,
  nameClassName = 'dial-body-semi-text text-primary',
  versionClassName = 'dial-tiny-text text-secondary',
  lastUsedClassName = 'dial-tiny-text text-tertiary',
  lastUsedTrailing,
  badgeClassName = 'bg-layer-2',
}) => {
  const isLg = size === 'lg';
  const logoClass = isLg
    ? 'h-[54px] w-[54px] rounded-[14px]'
    : 'h-[44px] w-[44px] rounded-[12px]';
  const logoSize = isLg ? 54 : 44;

  return (
    <div className={mergeClasses('flex min-w-0 items-start gap-3', className)}>
      {/* Logo — flex-shrink-0 so a long name can never squeeze the icon */}
      <div className={mergeClasses('flex-shrink-0 overflow-hidden', logoClass)}>
        <DeploymentIcon
          src={icon ?? undefined}
          size={logoSize}
          badgeClassName={mergeClasses(
            isLg ? 'rounded-[14px]' : 'rounded-[12px]',
            badgeClassName,
          )}
        />
      </div>

      {/* Text stack — type sits above a tightly grouped name+last-used cluster */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Type: more space below separates it from the name group */}
        <span
          className={mergeClasses(
            'mb-2 uppercase tracking-[0.06em]',
            typeClassName,
          )}
          style={typeColor ? { color: typeColor } : undefined}
        >
          {type}
        </span>

        {/* Name + last-used grouped tightly together */}
        <div className="flex min-w-0 flex-col">
          {/* Name + version: version sits immediately after name text */}
          <div className="flex min-w-0 items-start gap-1 overflow-hidden">
            <span
              className={mergeClasses('min-w-0 flex-1 truncate', nameClassName)}
            >
              {query ? <Highlight text={name} query={query} /> : name}
            </span>
            {version != null && (
              <span className={mergeClasses('flex-shrink-0', versionClassName)}>
                {version}
              </span>
            )}
          </div>

          {/* Last-used row — rendered only in size 'lg' */}
          {isLg && lastUsed != null && (
            <div className="flex items-center gap-2">
              <span className={lastUsedClassName}>{lastUsed}</span>
              {lastUsedTrailing}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
