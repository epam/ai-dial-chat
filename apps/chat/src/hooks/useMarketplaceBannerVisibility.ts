import { useEffect, useRef } from 'react';

import { useAppDispatch } from '../store/hooks';
import { MarketplaceActions } from '../store/marketplace/marketplace.reducers';

import throttle from 'lodash/throttle';

const BANNER_SCROLL_THRESHOLD = 100;

export const useMarketplaceBannerVisibility = (
  dataContainerRef: React.RefObject<HTMLElement> | null,
) => {
  const dispatch = useAppDispatch();
  const prevDataScrollRef = useRef(0);

  useEffect(() => {
    if (!dataContainerRef) return;
    const dataContainer = dataContainerRef.current;
    if (!dataContainer) return;

    const handleScroll = throttle(() => {
      const currentScroll = dataContainer.scrollTop;
      const wasAbove = prevDataScrollRef.current < BANNER_SCROLL_THRESHOLD;
      const isAbove = currentScroll < BANNER_SCROLL_THRESHOLD;

      if (wasAbove !== isAbove) {
        dispatch(
          MarketplaceActions.setIsBannerVisible({
            isVisible: isAbove,
          }),
        );
      }

      prevDataScrollRef.current = currentScroll;
    }, 50);

    if (dataContainer) {
      dataContainer.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (dataContainer) {
        dataContainer.removeEventListener('scroll', handleScroll);
      }
      dispatch(MarketplaceActions.setIsBannerVisible({ isVisible: true }));
    };
  }, [dataContainerRef, dispatch]);
};
