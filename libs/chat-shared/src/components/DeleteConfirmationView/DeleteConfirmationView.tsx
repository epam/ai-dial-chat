import { ConfirmationPopupVariant } from '@epam/ai-dial-ui-kit';
import type { FC, ReactNode } from 'react';
import { mergeClasses } from '../../utils/merge-class';
import { ConfirmationIdentityRow } from '../ConfirmationIdentityRow/ConfirmationIdentityRow';
import {
  ConfirmationView,
  type ConfirmationViewColors,
} from '../ConfirmationView/ConfirmationView';
import { ResourceSummary } from '../ResourceSummary/ResourceSummary';
import styles from './DeleteConfirmationView.module.scss';

/** Default cap on the names listed for a multi-item delete. */
export const DELETE_CONFIRMATION_MAX_LISTED_NAMES = 10;

/** User-visible strings of `DeleteConfirmationView`. */
export interface DeleteConfirmationViewLabels {
  /** Last consequence bullet. Defaults to `'Cannot be undone'`. */
  cannotBeUndone?: string;
  /** Identity-card text for a multi-item delete. Defaults to `'{count} items'`. */
  itemCount?: (count: number) => string;
  /** Trailing list entry for names past `maxListedNames`. Defaults to `'… and {count} more'`. */
  moreItems?: (count: number) => string;
}

/** Color overrides for `DeleteConfirmationView`. */
export interface DeleteConfirmationViewColors extends ConfirmationViewColors {
  /** Type label above the name. Defaults to `--text-secondary`. */
  typeLabelText?: string;
}

/** Style overrides for `DeleteConfirmationView`. */
export interface DeleteConfirmationViewStyles {
  /** Typography class applied to the message, the name list, and the bullets. Defaults to `'dial-small-text'`. */
  messageClassName?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: DeleteConfirmationViewColors;
}

/** Props for `DeleteConfirmationView`. */
export interface DeleteConfirmationViewProps {
  /** Names of the resources about to be deleted. One name is shown in the identity card; several are counted there and listed under the message. */
  names: string[];
  /** Icon shown in the identity card ahead of a single name. Supplied by the host, which owns the glyph set. */
  icon?: ReactNode;
  /** Resource type shown above a single name. Pass it in sentence case — the label uppercases itself. */
  typeLabel?: string;
  /** Warning sentence, composed by the host so it can emphasise the name. */
  message: ReactNode;
  /** Consequences listed before the final "cannot be undone" bullet. */
  consequences?: string[];
  /** Maximum number of names listed for a multi-item delete. Defaults to `DELETE_CONFIRMATION_MAX_LISTED_NAMES` (10). */
  maxListedNames?: number;
  /** User-visible strings. */
  labels?: DeleteConfirmationViewLabels;
  /** Style overrides. */
  styles?: DeleteConfirmationViewStyles;
  /** Content rendered after the consequence bullets, for example an inline error. */
  children?: ReactNode;
}

const defaultItemCount = (count: number) =>
  count === 1 ? '1 item' : `${count} items`;
const defaultMoreItems = (count: number) => `… and ${count} more`;

/** Body of a delete confirmation: the identity card, the warning, the affected names, and the consequences. */
export const DeleteConfirmationView: FC<DeleteConfirmationViewProps> = ({
  names,
  icon,
  typeLabel,
  message,
  consequences = [],
  maxListedNames = DELETE_CONFIRMATION_MAX_LISTED_NAMES,
  labels,
  styles: stylesProp,
  children,
}) => {
  const {
    cannotBeUndone = 'Cannot be undone',
    itemCount = defaultItemCount,
    moreItems = defaultMoreItems,
  } = labels ?? {};
  const { typeLabelText, ...viewColors } = stylesProp?.colors ?? {};
  const messageClassName = stylesProp?.messageClassName ?? 'dial-small-text';

  const isSingle = names.length === 1;
  const listedNames = isSingle ? [] : names.slice(0, maxListedNames);
  const restCount = names.length - (isSingle ? 1 : listedNames.length);

  return (
    <ConfirmationView
      variant={ConfirmationPopupVariant.Danger}
      messageClassName={messageClassName}
      styles={{ colors: viewColors }}
      identity={
        <ResourceSummary>
          <ConfirmationIdentityRow
            icon={isSingle ? icon : undefined}
            typeLabel={isSingle ? typeLabel : undefined}
            name={isSingle ? names[0] : itemCount(names.length)}
            styles={{ colors: { typeLabelText } }}
          />
        </ResourceSummary>
      }
      message={message}
      details={
        listedNames.length > 0 && (
          <ul
            className={mergeClasses(
              'flex flex-col gap-1',
              messageClassName,
              styles.names,
            )}
          >
            {listedNames.map((name, index) => (
              <li key={`${index}-${name}`} className="truncate">
                {name}
              </li>
            ))}
            {restCount > 0 && (
              <li className={styles.more}>{moreItems(restCount)}</li>
            )}
          </ul>
        )
      }
      consequences={[...consequences, cannotBeUndone]}
    >
      {children}
    </ConfirmationView>
  );
};
