import type { ConfirmationPopupVariant } from '@epam/ai-dial-ui-kit';
import type { ReactNode } from 'react';

/** One folder an item is currently published to, derived from its publish history. */
export interface PublishedFolder {
  /** Joined folder path, used for identity and display. Empty for the public root. */
  key: string;
  /** Folder path segments, the shape `onUnpublish` is handed. */
  segments: string[];
}

/** Everything the panel needs to render the confirmation step for one {@link DetailsConfirmationKind}. */
export interface ConfirmationContent {
  /** Sub-view title, shown next to the back button and used as the dialog's accessible name. */
  title: string;
  /** Confirmation body copy. */
  message: ReactNode;
  /** Consequences listed as bullets under the message. */
  consequences?: string[];
  /** Label of the confirming action button. */
  confirmLabel: string;
  /** Status text announced to assistive tech while the action is in flight. */
  loadingStatusLabel: string;
  /** Palette the confirm button (and its icon) is rendered with. */
  variant: ConfirmationPopupVariant;
  /**
   * Palette of the item identity card. Defaults to `variant` when absent —
   * only `DeleteApiKey` diverges, since removing one credential is far less
   * consequential than the whole-item actions that share the danger button.
   */
  cardVariant?: ConfirmationPopupVariant;
}
