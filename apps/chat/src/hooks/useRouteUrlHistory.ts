import { useCallback, useEffect, useState } from 'react';

import { useRouter } from 'next/router';

export const useRouteUrlHistory = () => {
  const [previousRoute, setPreviousRouter] = useState('');
  const router = useRouter();

  const handleBeforeHistoryChange = useCallback(
    (url: string) => {
      const [nextUrl] = url?.split('?') || [];

      if (nextUrl !== router.asPath) {
        setPreviousRouter(router.asPath);
      }
    },
    [router.asPath],
  );

  useEffect(() => {
    router.events.on('beforeHistoryChange', handleBeforeHistoryChange);

    return () => {
      router.events.off('beforeHistoryChange', handleBeforeHistoryChange);
    };
  }, [handleBeforeHistoryChange, router.events]);

  return { previousRoute };
};
