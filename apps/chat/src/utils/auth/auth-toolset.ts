import { isTruthyQuery } from '@/src/utils/app/route';

import { Routes } from '@/src/constants/routes';
import {
  TOOLSET_AUTH_POPUP_NAME,
  ToolsetLoginQuery,
} from '@/src/constants/toolsets';

const POPUP_TIMEOUT = 60_000;

const getPopupFeatures = () => {
  const features = {
    popup: 'yes',
    width: 600,
    height: 700,
    left: 0,
    top: 100,
  };

  if (window) {
    features.left = Math.round(
      window.screenX + Math.max(0, (window.outerWidth - features.width) / 2),
    );
    features.top = Math.round(
      window.screenY + Math.max(0, (window.outerHeight - features.height) / 2),
    );
  }

  return Object.entries(features)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
};

export const signInToolset = async (
  url: string,
  isSignInInSameWindow?: boolean,
): Promise<boolean> => {
  if (isSignInInSameWindow) {
    window.location.assign(url.toString());
    return Promise.resolve(false);
  }

  const popup = window.open(url, TOOLSET_AUTH_POPUP_NAME, getPopupFeatures());

  if (!popup) {
    console.error('Unable to open popup');
    window.location.assign(url.toString());
    return Promise.resolve(false);
  }

  return await new Promise<boolean>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      try {
        popup.close();
      } catch {
        console.error('Could not close popup');
      }
      reject(new Error('Auth timeout'));
    }, POPUP_TIMEOUT);

    const intervalId = window.setInterval(() => {
      let popupUrl: URL | undefined = undefined;

      try {
        popupUrl = new URL(popup.location.href);
      } catch {
        // ignore
      }

      if (popup.closed) {
        cleanup();
        reject(new Error('Auth window closed'));
      }

      const loginCompleteQuery =
        popupUrl?.origin === window.origin &&
        popupUrl?.pathname === Routes.ToolsetSignIn
          ? popupUrl?.searchParams?.get(ToolsetLoginQuery.LoginComplete)
          : null;

      if (!loginCompleteQuery) return;

      if (isTruthyQuery(loginCompleteQuery)) {
        resolve(true);
      } else {
        resolve(false);
      }
      cleanup();
      try {
        popup.close();
      } catch {
        console.error('Could not close popup');
      }
    }, 300);

    const cleanup = () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  });
};
