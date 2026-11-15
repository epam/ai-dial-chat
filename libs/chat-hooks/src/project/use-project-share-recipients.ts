import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectSharingClient } from './project-sharing-client';
import { subscribeProjectAccessRevoked } from './project-sharing-client';

/** Reads current recipient counts on menu open; a successful revoke immediately clears both surfaces. */
export const useProjectShareRecipients = (client: ProjectSharingClient) => {
  const [counts, setCounts] = useState<Record<string, number | undefined>>({});
  const requests = useRef(new Map<string, object>());

  useEffect(() => {
    setCounts({});
    const pending = requests.current;
    const handleRevoked = (projectId: string) => {
      /* An older lookup must not restore access that was just revoked. */
      pending.delete(projectId);
      setCounts((current) => ({ ...current, [projectId]: 0 }));
    };
    const unsubscribe = subscribeProjectAccessRevoked(client, handleRevoked);
    return () => {
      unsubscribe();
      pending.clear();
    };
  }, [client]);

  const requestRecipients = useCallback(
    (projectId: string) => {
      if (requests.current.has(projectId)) return;
      const request = {};
      requests.current.set(projectId, request);
      const resolve = async () => {
        let count: number | undefined;
        try {
          const result = await client.getShareRecipientsCount({
            itemId: projectId,
          });
          count = result.recipientsCount;
        } catch {
          /* Offer revoke only after recipients have been confirmed. */
        }
        if (requests.current.get(projectId) !== request) return;
        requests.current.delete(projectId);
        setCounts((current) => ({ ...current, [projectId]: count }));
      };
      void resolve();
    },
    [client],
  );

  const canRevokeAccess = useCallback(
    (projectId: string) => (counts[projectId] ?? 0) > 0,
    [counts],
  );

  return { requestRecipients, canRevokeAccess };
};
