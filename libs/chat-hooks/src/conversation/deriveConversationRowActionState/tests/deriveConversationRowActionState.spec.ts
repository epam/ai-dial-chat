import type { PublishHistoryEntry } from '@epam/ai-dial-publish-panel';
import { describe, expect, it } from 'vitest';
import {
  RecipientsCountStatus,
  type RecipientsCountEntry,
} from '../../../useShareRecipientsCount/useShareRecipientsCount';
import { deriveConversationRowActionState } from '../deriveConversationRowActionState';

const resolvedRecipients = (count: number): RecipientsCountEntry => ({
  status: RecipientsCountStatus.Resolved,
  count,
});

const history = (folderPath: string[]): PublishHistoryEntry => ({
  folderPath,
  publishedAt: 1,
});

describe('deriveConversationRowActionState', () => {
  it('treats shared items as readonly and skips publish-folder computation', () => {
    const result = deriveConversationRowActionState(
      { sharedWithMe: true, publishedWithMe: false, isReadonly: false },
      [history(['Team', 'Folder'])],
      resolvedRecipients(1),
    );

    expect(result.isReadonly).toBe(true);
    expect(result.publishedFolders).toEqual([]);
  });

  it('deduplicates published folder paths and makes publish actions mutually exclusive', () => {
    const result = deriveConversationRowActionState(
      { sharedWithMe: false, publishedWithMe: false, isReadonly: false },
      [history(['Team', 'Folder']), history(['Team', 'Folder'])],
      resolvedRecipients(1),
    );

    expect(result.publishedFolders).toEqual(['Team/Folder']);
    expect(result.isPublishApplicable).toBe(false);
    expect(result.isUnpublishApplicable).toBe(true);
  });

  it('shows publish and hides unpublish when no published folder exists', () => {
    const result = deriveConversationRowActionState(
      { sharedWithMe: false, publishedWithMe: false, isReadonly: false },
      [],
      resolvedRecipients(1),
    );

    expect(result.isPublishApplicable).toBe(true);
    expect(result.isUnpublishApplicable).toBe(false);
  });

  it('hides revoke at a resolved zero and preserves it for an unknown count', () => {
    const item = {
      sharedWithMe: false,
      publishedWithMe: false,
      isReadonly: false,
    };

    expect(
      deriveConversationRowActionState(item, [], resolvedRecipients(0))
        .isRevokeVisible,
    ).toBe(false);
    expect(
      deriveConversationRowActionState(item, [], {
        status: RecipientsCountStatus.Unknown,
      }).isRevokeVisible,
    ).toBe(true);
  });
});
