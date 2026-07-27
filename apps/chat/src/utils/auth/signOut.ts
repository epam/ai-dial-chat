import { signOut } from 'next-auth/react';

import { parseUrl } from 'next/dist/shared/lib/router/utils/parse-url';

import { ConversationService } from '@/src/utils/app/data/conversation-service';

/**
 * Custom signOut function to handle federated logout.
 * - It first removes the session cookie using next-auth's signOut method.
 * - Then, it checks for a federated logout URL by calling the backend API.
 * - If a federated logout URL is returned, it redirects the user to the external identity provider for logout.
 *
 * @returns {Promise<void>}
 */
export const customSignOut = async (): Promise<void> => {
  // selectedConversationIds is stored in browser localStorage without user scoping,
  // so it must be cleared on logout to avoid leaking into the next user's session
  // in the same browser (see https://github.com/epam/ai-dial-chat/issues/2799)
  ConversationService.setSelectedConversationsIds([]).subscribe();

  try {
    const res = await fetch('/api/auth/federated-logout');
    const { url }: { url: string | null } = await res.json();

    await signOut({ redirect: true });

    if (url) {
      const parsedUrl = parseUrl(url);
      window.location.href = parsedUrl.href;
    }
  } catch {
    await signOut({ redirect: true });
  }
};
