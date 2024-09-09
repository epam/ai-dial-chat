import { signOut } from 'next-auth/react';

/**
 * Custom signOut function to handle federated logout.
 * - It first removes the session cookie using next-auth's signOut method.
 * - Then, it checks for a federated logout URL by calling the backend API.
 * - If a federated logout URL is returned, it redirects the user to the external identity provider for logout.
 *
 * @returns {Promise<void>}
 */
export const customSignOut = async (): Promise<void> => {
  try {
    const res = await fetch('/api/auth/federated-logout');
    const { url }: { url: string | null } = await res.json();

    await signOut({ redirect: true });

    if (url) {
      window.location.href = url;
    }
  } catch (error) {
    await signOut({ redirect: true });
  }
};
