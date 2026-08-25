import { EllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { FC, ReactNode } from 'react';
import type { EntityHeaderItem } from '../../models/entity';
import { buildCssVars } from '../../utils/build-css-vars';
import { mergeClasses } from '../../utils/merge-class';
import { EntityHeader } from '../EntityHeader/EntityHeader';
import styles from './ResourceSummary.module.scss';

/** CSS custom-property overrides for the `ResourceSummary` row. */
export interface ResourceSummaryColors {
  /** Row border color. Defaults to `--stroke-tertiary`. */
  border?: string;
  /** Row background color. Defaults to `--bg-layer-sunken`. */
  background?: string;
  /** Version tag border color. Defaults to `--stroke-tertiary`. */
  versionTagBorder?: string;
  /** Version tag background color. Defaults to `--bg-control-accent-alpha`. */
  versionTagBackground?: string;
  /** Version tag text color. Defaults to `--text-accent`. */
  versionTagText?: string;
}

/** Typography overrides for the `ResourceSummary` row. */
export interface ResourceSummaryTypography {
  /** Typography class applied to the version tag. Defaults to `'dial-tiny-text'`. */
  versionTagClassName?: string;
}

/** Style overrides for `ResourceSummary`. */
export interface ResourceSummaryStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: ResourceSummaryColors;
  /** Typography class overrides. */
  typography?: ResourceSummaryTypography;
}

/** Props for `ResourceSummary`. */
export interface ResourceSummaryProps {
  /** Entity shown in the row as an icon, type label, name, and version tag. Ignored when `children` is set. */
  item?: EntityHeaderItem;
  /** Row content rendered instead of the entity header and version tag. */
  children?: ReactNode;
  /** Version tag text; `{version}` is replaced with `item.version`. The tag is omitted when `item.version` is empty. Defaults to `'Version {version} · current'`. */
  versionLabel?: string;
  /** Whether the version is shown as a trailing tag. When `false` it is shown inline after the name instead. Defaults to `true`. */
  hasVersionTag?: boolean;
  /** Size of the entity icon. Defaults to `40`. */
  iconSize?: number;
  /** CSS class applied to the row. */
  className?: string;
  /** Style overrides. */
  styles?: ResourceSummaryStyles;
  /** Color overrides applied as CSS custom properties. Prefer `styles.colors`. */
  colors?: ResourceSummaryColors;
}

/** Bordered summary row pairing an entity's identity block with its current-version tag. */
export const ResourceSummary: FC<ResourceSummaryProps> = ({
  item,
  children,
  versionLabel = 'Version {version} · current',
  hasVersionTag = true,
  iconSize = 40,
  className,
  styles: stylesProp,
  colors: colorsProp,
}) => {
  const colors = stylesProp?.colors ?? colorsProp;
  const { versionTagClassName = 'dial-tiny-text' } =
    stylesProp?.typography ?? {};
  const cssVars = buildCssVars({
    '--rs-border': colors?.border,
    '--rs-bg': colors?.background,
    '--rs-version-tag-border': colors?.versionTagBorder,
    '--rs-version-tag-bg': colors?.versionTagBackground,
    '--rs-version-tag-text': colors?.versionTagText,
  });

  const entitySummary = item && (
    <>
      <div className="min-w-0 flex-1">
        <EntityHeader
          item={item}
          iconSize={iconSize}
          hasFeaturedTag={false}
          showVersion={!hasVersionTag}
        />
      </div>
      {hasVersionTag && item.version && (
        <span
          className={mergeClasses(
            'inline-flex h-[24px] max-w-[45%] shrink-0 items-center gap-1 rounded-lg border px-2',
            versionTagClassName,
            styles.versionTag,
          )}
        >
          <EllipsisTooltip
            text={versionLabel.replace('{version}', item.version)}
          />
        </span>
      )}
    </>
  );

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'flex items-center justify-between gap-3 rounded-xl border p-3',
        styles.row,
        className,
      )}
    >
      {children ?? entitySummary}
    </div>
  );
};
