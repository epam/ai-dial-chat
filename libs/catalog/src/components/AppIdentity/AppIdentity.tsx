import {
  buildCssVars,
  CatalogEntityType,
  DeploymentIcon,
  EntityTypeLabel,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { EllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { FC, ReactNode } from 'react';
import { AppIdentityStyles } from '../../models/app-identity-styles';
import { DeploymentSize } from '../../types/deployment-icon-size';
import { ClampedName } from '../ClampedName/ClampedName';
import styles from './AppIdentity.module.scss';

/** Props for the shared AppIdentity block used in browse and favorite cards. */
export interface AppIdentityProps {
  /** Icon image URL. When absent, the DeploymentIcon renders a tinted fallback. */
  icon?: string | null;
  /** Entity type — rendered via the shared EntityTypeLabel (plain uppercase text, no pill). */
  type: CatalogEntityType;
  /** Display name. Wraps onto at most two lines and shows the full name in a tooltip once it is clipped. */
  name: string;
  /** Version string shown flush-end of the name, aligned to the top of the name. The name takes up to 66% of the row and the version the remaining 34%; whichever side is shorter keeps only its own width and hands the rest to the other. */
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
  /** Grouped color and typography overrides. */
  styles?: AppIdentityStyles;
  /** Element rendered at the end of the last-used row (size 'lg' only). */
  lastUsedTrailing?: ReactNode;
  /** Additional CSS class applied to the icon wrapper div (e.g. for hover-scale animations). */
  iconClassName?: string;
  /** Element anchored to the icon's bottom-end corner, overlapping its edge (e.g. a status badge). */
  iconOverlay?: ReactNode;
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
  styles: appIdentityStyles,
  lastUsedTrailing,
  iconClassName,
  iconOverlay,
}) => {
  const colors = appIdentityStyles?.colors;
  const typography = appIdentityStyles?.typography ?? {};

  const isLg = size === DeploymentSize.LG;
  const logoClass = isLg
    ? 'size-[52px] rounded-[14px]'
    : 'size-[44px] rounded-lg';
  const logoSize = isLg ? 54 : 44;
  const cssVars = buildCssVars({
    '--ai-name-text': colors?.nameColor,
    '--ai-last-used-text': colors?.lastUsedColor,
    '--ai-version-text': colors?.versionColor,
  });

  return (
    <div
      className={mergeClasses('flex min-w-0 items-start gap-3', className)}
      style={cssVars}
    >
      <div
        className={mergeClasses(
          'relative flex-shrink-0',
          logoClass,
          iconClassName,
        )}
      >
        <div className="size-full overflow-hidden rounded-[inherit]">
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
        {iconOverlay}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <EntityTypeLabel type={type} className={typography?.typeClassName} />

        <div className="flex min-w-0 flex-col">
          {/* With a version, name and version grow from 0 in a 66:34 ratio,
              each capped at its own content width (`max-w-max`): a short
              side keeps only its width and the other gets the rest, and only
              when both are long does the name stop at 66% of the row. A name
              wider than its share wraps onto a second line before clipping. */}
          <div className="flex min-w-0 items-start gap-1 overflow-hidden">
            <ClampedName
              name={name}
              query={query}
              className={mergeClasses(
                version ? 'max-w-max flex-[66_1_0%]' : 'flex-1',
                typography?.nameClassName ?? 'dial-body-semi-text',
                styles.name,
              )}
            />
            {version && (
              <EllipsisTooltip
                text={version}
                className={mergeClasses(
                  'min-w-0 max-w-max flex-[34_1_0%] tabular-nums',
                  typography?.versionClassName ?? 'dial-tiny-text',
                  styles.version,
                )}
              />
            )}
          </div>

          {isLg && lastUsed != null && (
            <div className="flex items-center gap-2">
              <span
                className={mergeClasses(
                  'tabular-nums',
                  typography?.lastUsedClassName ?? 'dial-tiny-text',
                  styles.lastUsed,
                )}
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
