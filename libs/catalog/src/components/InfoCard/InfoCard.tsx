import { ResourceSummary } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import type { CatalogItem } from '../../models/catalog-item';
import { DetailsConfirmationVariant } from '../../types/details-confirmation';
import styles from './InfoCard.module.scss';

/** Props for `InfoCard`. */
export interface InfoCardProps {
  /** Item whose identity the card shows. */
  item: CatalogItem;
  /** Palette of the card surface. Default: `DetailsConfirmationVariant.Info`. */
  variant?: DetailsConfirmationVariant;
  /** Size of the entity icon in pixels. Default: `40`. */
  iconSize?: number;
}

/** Tinted card showing a catalog item's identity, used to anchor a message to the item it is about. */
export const InfoCard: FC<InfoCardProps> = ({
  item,
  variant = DetailsConfirmationVariant.Info,
  iconSize = 40,
}) => (
  <ResourceSummary
    item={item}
    iconSize={iconSize}
    hasVersionTag={false}
    className={
      variant === DetailsConfirmationVariant.Danger
        ? styles.danger
        : styles.info
    }
  />
);
