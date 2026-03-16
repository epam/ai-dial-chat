import { isTruthyQuery } from '@/src/utils/app/route';

import { Routes } from '@/src/constants/routes';
import {
  TOOLSET_AUTH_POPUP_NAME,
  ToolsetLoginQuery,
} from '@/src/constants/toolsets';

export const signInToolset = async (
  url: string,
  isSignInInSameWindow?: boolean,
): Promise<boolean> => {
  if (isSignInInSameWindow) {
    window.location.assign(url.toString());
    return Promise.resolve(false);
  }

  const popup = window.open(
    url,
    TOOLSET_AUTH_POPUP_NAME,
    'popup=yes,width=600,height=700,top=100',
  );

  if (!popup) {
    throw new Error('Unable to open popup');
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
    }, 30000);

    const intervalId = window.setInterval(() => {
      let popupUrl: URL | undefined = undefined;

      try {
        popupUrl = new URL(popup.location.href);
      } catch {
        // ignore
      }

      if (
        popupUrl?.origin === window.origin &&
        popupUrl?.pathname === Routes.ToolsetSignIn &&
        isTruthyQuery(
          popupUrl?.searchParams?.get(
            ToolsetLoginQuery.LoginComplete,
          ) as string,
        )
      ) {
        cleanup();
        try {
          popup.close();
        } catch {
          console.error('Could not close popup');
        }
        resolve(true);
      }
      if (popup.closed) {
        cleanup();
        reject(new Error('Auth window closed'));
      }
    }, 300);

    const cleanup = () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  });
};
