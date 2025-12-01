import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import classNames from 'classnames';

import { stripQueryParamsFromUrl } from '@/src/utils/app/url/query-params';

import { Translation } from '@/src/types/translation';

import { MarketplaceQueryParams } from '@/src/constants/marketplace';

import { MarketplaceEntitiesListWrapperRef } from './view-props';

interface Props {
  children: React.ReactNode;
  separatorRowId: number;
  rowsHeight: number;
  className?: string;
}

export const MarketplaceEntitiesListWrapper = forwardRef<
  MarketplaceEntitiesListWrapperRef,
  Props
>(({ children, separatorRowId, rowsHeight, className }, ref) => {
  const { t } = useTranslation(Translation.Marketplace);

  const router = useRouter();

  const parentRef = useRef<HTMLDivElement>(null);
  const suggestedRowRef = useRef<HTMLSpanElement>(null);

  // Using useImperativeHandle to expose internal refs (parentRef and suggestedRowRef)
  // to the parent component. This allows the parent to control scrolling and positioning
  // of elements within this component.
  //
  // parentRef: Provides a reference to the virtual list container that manages scrolling.
  // suggestedRowRef: Provides a reference to the element representing the row text (separator).
  useImperativeHandle(ref, () => ({
    parentRef,
    suggestedRowRef,
  }));

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
      {separatorRowId >= 0 && (
        <span
          ref={suggestedRowRef}
          className="absolute flex max-w-full items-center px-3 text-xl"
          style={{
            height: `${rowsHeight}px`,
            top: `${separatorRowId * rowsHeight}px`,
          }}
          data-qa="marketplace-suggestions-label"
        >
          {t('Suggested results from DIAL Marketplace')}
        </span>
      )}

      {children}
    </section>
  );
});
MarketplaceEntitiesListWrapper.displayName = 'MarketplaceEntitiesListWrapper';
