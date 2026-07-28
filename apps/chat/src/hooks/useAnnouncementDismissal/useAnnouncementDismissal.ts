import { useCallback } from 'react';
import { StorageKey } from '../../types/storage-key';
import useLocalStorage from '../useLocalStorage';

interface UseAnnouncementDismissalResult {
  dismissedText: string;
  dismiss: (text: string) => void;
}

/**
 * Persists the exact text of the announcement banner message the user has
 * dismissed to `localStorage` (via `useLocalStorage`), keyed by content rather
 * than a boolean flag: the banner reappears automatically once the operator
 * changes the message. Lives at the app edge because `libs/chat-shared` must
 * not access browser storage directly (library isolation).
 */
export const useAnnouncementDismissal = (): UseAnnouncementDismissalResult => {
  const [dismissedText, setDismissedText] = useLocalStorage<string>(
    StorageKey.TextOfClosedAnnouncement,
    '',
  );

  const dismiss = useCallback(
    (text: string) => setDismissedText(text),
    [setDismissedText],
  );

  return { dismissedText, dismiss };
};
