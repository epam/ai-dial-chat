import { useCallback } from 'react';
import { StorageKey } from '../../types/storage-key';
import type { AnnouncementContent } from '../../utils/announcement-message';
import { buildAnnouncementSignature } from '../../utils/announcement-message';
import useLocalStorage from '../useLocalStorage';

interface UseAnnouncementDismissalResult {
  isDismissed: boolean;
  dismiss: () => void;
}

/**
 * Persists a signature of the announcement the user has dismissed to
 * `localStorage` (via `useLocalStorage`), keyed by content rather than a
 * boolean flag: the banner reappears automatically once the operator changes
 * the title, the description, or the legacy message.
 *
 * Deliberately `localStorage`, not `sessionStorage` — a dismissed announcement
 * stays dismissed across browser restarts. Lives at the app edge because
 * `libs/chat-shared` must not access browser storage directly (library
 * isolation).
 */
export const useAnnouncementDismissal = (
  content: AnnouncementContent,
): UseAnnouncementDismissalResult => {
  const [dismissedSignature, setDismissedSignature] = useLocalStorage<string>(
    StorageKey.TextOfClosedAnnouncement,
    '',
  );

  const signature = buildAnnouncementSignature(content);

  const dismiss = useCallback(
    () => setDismissedSignature(signature),
    [setDismissedSignature, signature],
  );

  return { isDismissed: dismissedSignature === signature, dismiss };
};
