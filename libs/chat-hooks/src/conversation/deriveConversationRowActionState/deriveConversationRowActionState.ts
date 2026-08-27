import type { ConversationListItemDto } from '@epam/ai-dial-chat-api-client';
import type { PublishHistoryEntry } from '@epam/ai-dial-publish-panel';
import {
  RecipientsCountStatus,
  type RecipientsCountEntry,
} from '../../useShareRecipientsCount/useShareRecipientsCount';

/** Distilled row-action state for a single conversation item. */
export interface ConversationRowActionState {
  /** `true` when the item is read-only (shared-with-me, published-with-me, or explicitly readonly). */
  isReadonly: boolean;
  /**
   * Deduplicated list of folder paths (as joined slash-delimited strings)
   * to which this conversation has been published. Empty when the conversation
   * is unowned, readonly, or publish history is unavailable.
   */
  publishedFolders: string[];
  /**
   * `true` when the revoke-access action should be shown: either the
   * recipient count is unknown (lookup pending/failed) or at least one
   * recipient exists.
   */
  isRevokeVisible: boolean;
  /** `true` when publish is applicable (no published folders yet). */
  isPublishApplicable: boolean;
  /** `true` when unpublish is applicable (at least one published folder exists). */
  isUnpublishApplicable: boolean;
}

/**
 * Derives the row-action visibility state for a single conversation item.
 *
 * Extracted from `getActions` in `ConversationPanelView` to isolate the
 * readonly / publish / unpublish / revoke decision logic from the
 * `DropdownItem` construction and `t()` calls that remain in the app.
 *
 * @param item - Conversation DTO fields relevant to ownership classification.
 * @param publishHistory - Resolved publish-history entries, or `undefined`
 *   when history is unavailable or should be treated as empty (e.g. while
 *   loading or when the item is readonly).
 * @param recipients - Current share-recipients count entry for this item.
 */
export const deriveConversationRowActionState = (
  item: Pick<
    ConversationListItemDto,
    'sharedWithMe' | 'publishedWithMe' | 'isReadonly'
  >,
  publishHistory: PublishHistoryEntry[] | undefined,
  recipients: RecipientsCountEntry,
): ConversationRowActionState => {
  const isReadonly = !!(
    item.isReadonly ||
    item.sharedWithMe ||
    item.publishedWithMe
  );

  /*
   * Deduplicated: history may list one entry per publication event, so a
   * folder published to twice would otherwise appear twice. Keyed by the
   * joined path string; the value stored is that same string.
   */
  const publishedFolders =
    !isReadonly && publishHistory != null
      ? [...new Set(publishHistory.map((entry) => entry.folderPath.join('/')))]
      : [];

  const isRevokeVisible =
    recipients.status === RecipientsCountStatus.Unknown ||
    (recipients.status === RecipientsCountStatus.Resolved &&
      (recipients.count ?? 0) > 0);

  return {
    isReadonly,
    publishedFolders,
    isRevokeVisible,
    isPublishApplicable: publishedFolders.length === 0,
    isUnpublishApplicable: publishedFolders.length > 0,
  };
};
