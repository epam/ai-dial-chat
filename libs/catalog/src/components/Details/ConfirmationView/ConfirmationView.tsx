import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC, ReactNode } from 'react';
import type { CatalogItem } from '../../../models/catalog-item';
import { DetailsConfirmationVariant } from '../../../types/details-confirmation';
import { InfoCard } from '../../InfoCard/InfoCard';
import styles from './ConfirmationView.module.scss';

/** Props for `ConfirmationView`. */
export interface ConfirmationViewProps {
  /** Item the confirmation is about, rendered as an identity card above the copy. */
  item: CatalogItem;
  /** Body copy explaining what confirming does. */
  message: ReactNode;
  /** Consequences listed as bullets under the message. An empty or omitted list renders nothing. */
  consequences?: string[];
  /** Palette of the identity card. Default: `DetailsConfirmationVariant.Info`. */
  variant?: DetailsConfirmationVariant;
  /** Typography class applied to the message and the bullet list. Defaults to `'dial-small-text'`. */
  messageClassName?: string;
}

/** Body of the details panel's in-place confirmation step: an item identity card, the confirmation copy, and an optional consequence list. */
export const ConfirmationView: FC<ConfirmationViewProps> = ({
  item,
  message,
  consequences,
  variant = DetailsConfirmationVariant.Info,
  messageClassName = 'dial-small-text',
}) => (
  <div className="flex flex-col gap-4 px-6 py-4">
    <InfoCard item={item} variant={variant} />

    <p className={mergeClasses(messageClassName, styles.message)}>{message}</p>

    {consequences != null && consequences.length > 0 && (
      <ul
        className={mergeClasses(
          'flex list-disc flex-col gap-2 ps-5',
          messageClassName,
          styles.consequences,
        )}
      >
        {consequences.map((consequence) => (
          <li key={consequence}>{consequence}</li>
        ))}
      </ul>
    )}
  </div>
);
