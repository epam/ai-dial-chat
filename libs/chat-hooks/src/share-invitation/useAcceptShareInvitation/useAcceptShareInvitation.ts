import { useEffect, useRef } from 'react';
import type { UseAcceptShareInvitationOptions } from '../models';
import { resolveAcceptShareInvitationError } from '../share-invitation-error';

/**
 * Accepts a share invitation once per mount, then refreshes the host's lists,
 * merges the backend-resolved summaries and calls `onAccepted`; any failure
 * goes to `onError` already classified. Callbacks are read at call time, so
 * new identities never re-run the accept.
 */
export const useAcceptShareInvitation = (
  options: UseAcceptShareInvitationOptions,
): void => {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });
  const hasStartedRef = useRef(false);
  const { invitationId } = options;

  useEffect(() => {
    if (!invitationId || hasStartedRef.current) return;
    hasStartedRef.current = true;

    const accept = async () => {
      const {
        acceptInvitation,
        refreshLists,
        onSharedItem,
        onSharedSkill,
        onAccepted,
      } = optionsRef.current;
      try {
        const response = await acceptInvitation(invitationId);
        /*
         * DIAL Core doesn't guarantee a bulk list refresh already reflects a
         * just-granted share, so the refresh can come back without the new
         * item. The backend-resolved summaries are merged after it (not
         * before or in parallel) so they always win over a stale refresh
         * instead of being overwritten by it.
         */
        if (refreshLists) await refreshLists(response);
        const { sharedDeployment, sharedToolset, sharedSkill } = response;
        const sharedItem = sharedDeployment ?? sharedToolset;
        if (sharedItem) onSharedItem?.(sharedItem);
        if (sharedSkill) onSharedSkill?.(sharedSkill);
        onAccepted(response);
      } catch (error) {
        const { labels, onError } = optionsRef.current;
        onError(await resolveAcceptShareInvitationError(error, labels));
      }
    };

    void accept();
  }, [invitationId]);
};
