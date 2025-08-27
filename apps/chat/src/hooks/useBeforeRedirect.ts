import { useEffect } from 'react';

import { useRouter } from 'next/router';

import { escapeRegExp } from 'lodash';

export const useBeforeRedirect = (
  callback: () => void,
  match?: string | RegExp,
) => {
  const router = useRouter();

  useEffect(() => {
    const redirectHandler = (url: string) => {
      const pathname = new URL(url, window.location.origin).pathname;
      const safeMatch =
        typeof match === 'string' ? new RegExp(escapeRegExp(match)) : match;

      if (decodeURIComponent(pathname).match(safeMatch ?? '')) {
        callback();
      }
    };

    router.events.on('routeChangeStart', redirectHandler);

    return () => router.events.off('routeChangeStart', redirectHandler);
  }, [callback, match, router.events]);
};
