import { AuthWindowLocationLike } from './auth-window-location-like';
import { delay } from './delay';
import { timeoutAsync } from './timeout-async';

export const signInInOverlay = async (
  url?: string,
  isSignInInSameWindow?: boolean,
) => {
  const timeout = 30 * 1000;
  let complete = false;
  await Promise.race([
    timeoutAsync(timeout),
    (async () => {
      const authWindowLocation = new AuthWindowLocationLike(
        url ?? `/api/auth/signin`,
        isSignInInSameWindow,
      );

      await authWindowLocation.ready; // ready after redirects
      const t = Math.max(100, timeout / 1000);
      // wait for redirection to back
      while (!complete) {
        try {
          if (authWindowLocation.href === window.location.href) {
            complete = true;
            authWindowLocation.destroy();
            break;
          }
        } catch {
          // Do nothing
        }
        await delay(t);
      }
      window.location.reload();

      return;
    })(),
  ]);
};
