import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { stripQueryParamsFromUrl } from '@/src/utils/app/url/query-params';

import { MarketplaceQueryParams } from '@/src/constants/marketplace';

import { MarketplaceEntitiesListWrapperRef } from './view-props';

interface Props {
  children: React.ReactNode;
  className?: string;
}

export const MarketplaceEntitiesListWrapper = forwardRef<
  MarketplaceEntitiesListWrapperRef,
  Props
>(({ children, className }, ref) => {
  const router = useRouter();

  const parentRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({ parentRef }));

  useEffect(() => {
    let previousUrl = router.asPath;

    const handleRouteChange = (url: string) => {
      const normalizedPrevUrl = stripQueryParamsFromUrl(previousUrl, [
        MarketplaceQueryParams.model,
        MarketplaceQueryParams.toolset,
      ]);
      const normalizedNewUrl = stripQueryParamsFromUrl(url, [
        MarketplaceQueryParams.model,
        MarketplaceQueryParams.toolset,
      ]);

      if (normalizedNewUrl !== normalizedPrevUrl) {
        parentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }

      previousUrl = url;
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
    // We don't need to re-run this effect when the router changes, because we just register the event listener once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      ref={parentRef}
      data-qa="entities-section"
      className={classNames(
        'relative flex grow overflow-y-auto overflow-x-hidden px-3 md:px-5 xl:px-16',
        className,
      )}
    >
      {children}
    </section>
  );
});
MarketplaceEntitiesListWrapper.displayName = 'MarketplaceEntitiesListWrapper';
