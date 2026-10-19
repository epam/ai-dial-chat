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
  /** Version string. In size 'sm' it is shown flush-end of the name, which takes up to 66% of the row while the version takes the remaining 34%, a shorter side handing the rest to the other; in size 'lg' it opens the meta row below the name, leaving the name the full row width. */
  version?: string;
  /** Relative time string shown on the meta row (size 'lg' only). */
  lastUsed?: string;
  /** Size of the block, which controls the logo size and whether the meta row (version, last-used, trailing element) is shown below the name. */
  size: DeploymentSize;
  /** Search query used to highlight matching text in the name. */
  query?: string;
  /** Additional classes applied to the root element. */
  className?: string;
  /** Grouped color and typography overrides. */
  styles?: AppIdentityStyles;
  /** Element rendered flush-end of the meta row (size 'lg' only). */
  lastUsedTrailing?: ReactNode;
  /** Additional CSS class applied to the icon wrapper div (e.g. for hover-scale animations). */
  iconClassName?: string;
  /** Element anchored to the icon's bottom-end corner, overlapping its edge (e.g. a status badge). */
  iconOverlay?: ReactNode;
}

/** Shared identity block: logo + type + name + version, with an optional meta row in size 'lg'. */
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
  const isVersionInline = !isLg && !!version;
  const isMetaRowVisible =
    isLg && (!!version || lastUsed != null || lastUsedTrailing != null);
  const versionClassName = mergeClasses(
    typography?.versionClassName ?? 'dial-tiny-text',
    styles.version,
  );
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
          {/* With an inline version (size 'sm'), name and version grow from 0 in a 66:34 ratio,
              each capped at its own content width (`max-w-max`): a short
              side keeps only its width and the other gets the rest, and only
              when both are long does the name stop at 66% of the row. A name
              wider than its share wraps onto a second line before clipping. */}
          <div className="flex min-w-0 items-start gap-1 overflow-hidden">
            <ClampedName
              name={name}
              query={query}
              className={mergeClasses(
                isVersionInline ? 'max-w-max flex-[66_1_0%]' : 'flex-1',
                typography?.nameClassName ?? 'dial-body-semi-text',
                styles.name,
              )}
            />
            {isVersionInline && (
              <EllipsisTooltip
                text={version}
                className={mergeClasses(
                  'max-w-max min-w-0 flex-[34_1_0%] tabular-nums',
                  versionClassName,
                )}
              />
            )}
          </div>

          {/* Size 'lg' (Favorites cards) moves the version and the trailing
              element onto the meta row below the name, so the name gets the
              full width of the narrow card instead of 66% of it (#9325). */}
          {isMetaRowVisible && (
            <div className="flex min-w-0 items-center gap-2">
              {version && (
                <EllipsisTooltip
                  text={version}
                  className={mergeClasses(
                    'min-w-0 tabular-nums',
                    versionClassName,
                  )}
                />
              )}
              {lastUsed != null && (
                <span
                  className={mergeClasses(
                    'shrink-0 tabular-nums',
                    typography?.lastUsedClassName ?? 'dial-tiny-text',
                    styles.lastUsed,
                  )}
                >
                  {lastUsed}
                </span>
              )}
              {lastUsedTrailing != null && (
                <div className="ms-auto flex shrink-0">{lastUsedTrailing}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
