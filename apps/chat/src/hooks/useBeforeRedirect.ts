import { useEffect } from 'react';

import { useRouter } from 'next/router';

export const useBeforeRedirect = (
  callback: () => void,
  match?: string | RegExp,
) => {
  const router = useRouter();

  useEffect(() => {
    const redirectHandler = (url: string) => {
      const pathname = new URL(url, window.location.origin).pathname;

      if (decodeURIComponent(pathname).match(match ?? '')) {
        callback();
      }
    };

    router.events.on('routeChangeStart', redirectHandler);

    return () => router.events.off('routeChangeStart', redirectHandler);
  }, [callback, match, router.events]);
};
