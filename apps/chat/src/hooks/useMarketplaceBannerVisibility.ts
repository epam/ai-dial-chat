import { useEffect, useRef } from 'react';

import { useAppDispatch } from '../store/hooks';
import { MarketplaceActions } from '../store/marketplace/marketplace.reducers';

import throttle from 'lodash/throttle';

const BANNER_SCROLL_THRESHOLD = 100;

export const useMarketplaceBannerVisibility = (
  dataContainer: HTMLElement | null,
) => {
  const dispatch = useAppDispatch();
  const prevDataScrollRef = useRef(0);

  useEffect(() => {
    if (!dataContainer) return;

    const handleScroll = throttle(() => {
      const currentScroll = dataContainer.scrollTop;
      const currentScrollHeight = dataContainer.scrollHeight;
      const currentClientHeight = dataContainer.clientHeight;
      const wasAbove = prevDataScrollRef.current < BANNER_SCROLL_THRESHOLD;
      const isAbove = currentScroll < BANNER_SCROLL_THRESHOLD;

      if (
        wasAbove !== isAbove &&
        currentScrollHeight >
          currentClientHeight + (window.innerHeight - currentClientHeight)
      ) {
        dispatch(
          MarketplaceActions.setIsBannerVisible({
            isVisible: isAbove,
          }),
        );
      }

      prevDataScrollRef.current = currentScroll;
    }, 50);

    const handleResize = () => {
      const currentScroll = dataContainer.scrollTop;
      if (currentScroll < BANNER_SCROLL_THRESHOLD) {
        dispatch(
          MarketplaceActions.setIsBannerVisible({
            isVisible: true,
          }),
        );
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (dataContainer) {
      dataContainer.addEventListener('scroll', handleScroll);
      resizeObserver.observe(document.body);
    }

    return () => {
      if (dataContainer) {
        dataContainer.removeEventListener('scroll', handleScroll);
      }
      resizeObserver.disconnect();
      dispatch(MarketplaceActions.setIsBannerVisible({ isVisible: true }));
    };
  }, [dataContainer, dispatch]);
};
