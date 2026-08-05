import {
  buildCssVars,
  DeploymentIcon,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { DialEllipsisTooltip, Highlight } from '@epam/ai-dial-ui-kit';
import { FC, ReactNode } from 'react';
import { AppIdentityColors } from '../../models/app-identity-styles';
import { DeploymentSize } from '../../types/deployment-icon-size';
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
  /** Size of the block, which controls the logo size and whether the last-used row is shown. */
  size: DeploymentSize;
  /** Search query used to highlight matching text in the name. */
  query?: string;
  /** Additional classes applied to the root element. */
  className?: string;
  /** CSS class for the type label. Default: 'dial-caption-semi-text'. */
  typeClassName?: string;
  /** Typography CSS class for the entity name. Default: 'dial-body-semi-text'. */
  nameClassName?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: AppIdentityColors;
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
  typeClassName = 'dial-caption-semi-text',
  nameClassName = 'dial-body-semi-text',
  colors,
  versionClassName = 'dial-tiny-text text-secondary',
  lastUsedClassName = 'dial-tiny-text text-tertiary',
  lastUsedTrailing,
  iconClassName,
}) => {
  const isLg = size === DeploymentSize.LG;
  const logoClass = isLg
    ? 'size-[54px] rounded-[14px]'
    : 'size-[44px] rounded-lg';
  const logoSize = isLg ? 54 : 44;
  const cssVars = buildCssVars({ '--ai-name-text': colors?.nameColor });

  return (
    <div
      className={mergeClasses(
        'flex min-w-0 items-start gap-[14px] rounded-xl',
        className,
      )}
      style={cssVars}
    >
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

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <EntityTypeLabel type={type} className={typeClassName} />

        <div className="flex min-w-0 flex-col">
          <div className="flex min-w-0 items-start gap-1 overflow-hidden">
            <span
              className={mergeClasses(
                'flex-3 min-w-0 truncate',
                nameClassName,
                styles.name,
              )}
            >
              {query ? <Highlight text={name} query={query} /> : name}
            </span>
            {version != null && (
              <DialEllipsisTooltip
                text={version}
                className={mergeClasses(
                  'flex-2 tabular-nums',
                  versionClassName,
                )}
              />
            )}
          </div>

          {isLg && lastUsed != null && (
            <div className="flex items-center gap-2">
              <span className={mergeClasses('tabular-nums', lastUsedClassName)}>
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
