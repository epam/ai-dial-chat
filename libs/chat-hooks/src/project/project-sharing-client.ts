import type { ShareApi } from '@epam/ai-dial-chat-api-client';

/** Already-configured sharing operations required by project sharing hooks. Keep the instance stable. */
export type ProjectSharingClient = Pick<
  ShareApi,
  'getShareRecipientsCount' | 'revokeSharedAccess'
>;

const listeners = new WeakMap<
  ProjectSharingClient,
  Set<(projectId: string) => void>
>();

/** Subscribes a menu to successful revokes made through the same configured client. */
export const subscribeProjectAccessRevoked = (
  client: ProjectSharingClient,
  listener: (projectId: string) => void,
) => {
  let subscribers = listeners.get(client);
  if (!subscribers) {
    subscribers = new Set();
    listeners.set(client, subscribers);
  }
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
};

/** Invalidates recipient counts for one project and one configured client. */
export const notifyProjectAccessRevoked = (
  client: ProjectSharingClient,
  projectId: string,
) => {
  for (const listener of listeners.get(client) ?? []) listener(projectId);
};
