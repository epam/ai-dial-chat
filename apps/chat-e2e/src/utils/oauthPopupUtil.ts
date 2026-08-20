import { Page } from '@playwright/test';

const POPUP_NAVIGATION_TIMEOUT = 30_000;

/**
 * Waits until the OAuth login window has left `about:blank`.
 *
 * The app reserves the window synchronously on click so Safari accepts it as
 * user-initiated, then points it at the authorization endpoint once the URL has
 * been built. Callers that inspect the popup's URL - or rely on the mocked
 * authorization route having captured the callback URL - must wait for that
 * second navigation rather than for the blank document.
 */
export const waitForOAuthPopupNavigation = async (
  popup: Page,
): Promise<void> => {
  try {
    await popup.waitForURL((url) => url.href !== 'about:blank', {
      timeout: POPUP_NAVIGATION_TIMEOUT,
    });
    await popup.waitForLoadState('domcontentloaded');
  } catch {
    // The popup can complete and close the whole flow before it settles here
  }
};
