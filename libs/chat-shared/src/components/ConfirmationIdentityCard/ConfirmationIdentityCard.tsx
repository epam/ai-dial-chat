import { ConfirmationPopupVariant } from '@epam/ai-dial-ui-kit';
import { FC, ReactNode } from 'react';
import type { EntityHeaderItem } from '../../models/entity';
import { ResourceSummary } from '../ResourceSummary/ResourceSummary';
import styles from './ConfirmationIdentityCard.module.scss';

/** Color overrides for `ConfirmationIdentityCard`. */
export interface ConfirmationIdentityCardColors {
  /** Card surface in the `Info` variant. Defaults to `--bg-info`. */
  background?: string;
  /** Card surface in the `Danger` variant. Defaults to `--bg-control-error-alpha-active`. */
  dangerBackground?: string;
  /** Card border in the `Danger` variant. Defaults to `--stroke-error-alpha`. */
  dangerBorder?: string;
}

/** Style overrides for `ConfirmationIdentityCard`. */
export interface ConfirmationIdentityCardStyles {
  /** Color overrides, applied to whichever surface `variant` selects. */
  colors?: ConfirmationIdentityCardColors;
}

/** Props for `ConfirmationIdentityCard`. */
export interface ConfirmationIdentityCardProps {
  /** Entity whose identity the card shows. Ignored when `children` is set. */
  item?: EntityHeaderItem;
  /** Row content rendered instead of the entity identity, for a resource that is not an `EntityHeaderItem`. */
  children?: ReactNode;
  /** Palette of the card surface. Default: `ConfirmationPopupVariant.Info`. */
  variant?: ConfirmationPopupVariant;
  /** Size of the entity icon in pixels. Default: `40`. */
  iconSize?: number;
  /** Style overrides. */
  styles?: ConfirmationIdentityCardStyles;
}

/** Tinted card echoing the resource a confirmation is about, so the user sees exactly what the action will affect. */
export const ConfirmationIdentityCard: FC<ConfirmationIdentityCardProps> = ({
  item,
  children,
  variant = ConfirmationPopupVariant.Info,
  iconSize = 40,
  styles: stylesProp,
}) => {
  const isDanger = variant === ConfirmationPopupVariant.Danger;
  const colors = stylesProp?.colors;

  /*
   * Only the selected variant's overrides are forwarded: `ResourceSummary`
   * sets them inline, and an inline `--rs-bg` would otherwise outrank the
   * class that paints the variant actually being rendered.
   */
  const resourceColors = isDanger
    ? { background: colors?.dangerBackground, border: colors?.dangerBorder }
    : { background: colors?.background };

  return (
    <ResourceSummary
      item={item}
      iconSize={iconSize}
      hasVersionTag={false}
      className={isDanger ? styles.danger : styles.info}
      styles={{ colors: resourceColors }}
    >
      {children}
    </ResourceSummary>
  );
};
