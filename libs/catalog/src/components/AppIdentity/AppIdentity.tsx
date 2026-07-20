import {
  DeploymentIcon,
  Highlight,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { FC, ReactNode } from 'react';
import { CatalogEntityType } from '../../types/entity-type';
import { EntityTypeLabel } from '../EntityTypeLabel/EntityTypeLabel';
import styles from './AppIdentity.module.scss';

/** Props for the shared AppIdentity block used in browse and favorite cards. */
export interface AppIdentityProps {
  /** Icon image URL. When absent, the DeploymentIcon renders a tinted fallback. */
  icon?: string | null;
  /** Entity type — rendered via the shared EntityTypeLabel (plain uppercase text, no pill). */
  type: CatalogEntityType;
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
  /** CSS class for the type label. Default: 'dial-caption-text font-semibold'. */
  typeClassName?: string;
  /** CSS class for the entity name. Default: 'dial-body-semi-text text-primary'. */
  nameClassName?: string;
  /** CSS class for the version string. Default: 'dial-tiny-text text-secondary'. */
  versionClassName?: string;
  /** CSS class for the last-used line text and icon. Default: 'dial-tiny-text text-secondary'. */
  lastUsedClassName?: string;
  /** Element rendered at the end of the last-used row (size 'lg' only). */
  lastUsedTrailing?: ReactNode;
  /** Additional CSS class applied to the icon wrapper div (e.g. for hover-scale animations). */
  iconClassName?: string;
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
  typeClassName,
  nameClassName = 'dial-body-semi-text text-primary',
  versionClassName = 'dial-tiny-text text-secondary',
  lastUsedClassName = 'dial-tiny-text text-tertiary',
  lastUsedTrailing,
  iconClassName,
}) => {
  const isLg = size === 'lg';
  const logoClass = isLg
    ? 'h-[54px] w-[54px] rounded-[14px]'
    : 'h-[44px] w-[44px] rounded-[12px]';
  const logoSize = isLg ? 54 : 44;

  return (
    <div
      className={mergeClasses('flex min-w-0 items-start gap-[14px]', className)}
    >
      {/* Logo — flex-shrink-0 so a long name can never squeeze the icon */}
      <div
        className={mergeClasses(
          'flex-shrink-0 overflow-hidden',
          logoClass,
          iconClassName,
        )}
      >
        <DeploymentIcon
          src={icon ?? undefined}
          size={logoSize}
          initialsName={name}
          styles={{
            badgeClassName: mergeClasses(
              isLg ? 'rounded-[14px]' : 'rounded-[12px]',
            ),
          }}
        />
      </div>

      {/* Text stack — type sits above a tightly grouped name+last-used cluster */}
      <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
        <EntityTypeLabel type={type} className={typeClassName} />

        {/* Name + last-used grouped tightly together */}
        <div className="flex min-w-0 flex-col">
          {/* Name + version: version sits immediately after name text */}
          <div className="flex min-w-0 items-start gap-1 overflow-hidden">
            <span
              className={mergeClasses(
                'flex-3 min-w-0 shrink truncate',
                nameClassName,
              )}
            >
              {query ? <Highlight text={name} query={query} /> : name}
            </span>
            {version != null && (
              <DialEllipsisTooltip
                text={version}
                className={mergeClasses(
                  'flex-1',
                  styles.numericText,
                  versionClassName,
                )}
              />
            )}
          </div>

          {/* Last-used row — rendered only in size 'lg' */}
          {isLg && lastUsed != null && (
            <div className="flex items-center gap-2">
              <span
                className={mergeClasses(styles.numericText, lastUsedClassName)}
              >
                {lastUsed}
              </span>
              {lastUsedTrailing}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
