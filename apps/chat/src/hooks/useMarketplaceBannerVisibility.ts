import { useEffect, useRef } from 'react';

import { MarketplaceActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/selectors';

import throttle from 'lodash/throttle';

const BANNER_SCROLL_THRESHOLD = 100;

export const useMarketplaceBannerVisibility = (
  dataContainer: HTMLElement | null,
) => {
  const dispatch = useAppDispatch();
  const prevDataScrollRef = useRef(0);

  const agentsFilters = useAppSelector(
    MarketplaceSelectors.selectSelectedAgentsFilters,
  );
  const toolsetsFilters = useAppSelector(
    MarketplaceSelectors.selectSelectedToolsetsFilters,
  );

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
      resizeObserver.observe(dataContainer);
    }

    return () => {
      if (dataContainer) {
        dataContainer.removeEventListener('scroll', handleScroll);
      }
      resizeObserver.disconnect();
      dispatch(MarketplaceActions.setIsBannerVisible({ isVisible: true }));
    };
  }, [dataContainer, dispatch]);

  useEffect(() => {
    if (!dataContainer) return;

    if (dataContainer.scrollTop < BANNER_SCROLL_THRESHOLD) {
      dispatch(
        MarketplaceActions.setIsBannerVisible({
          isVisible: true,
        }),
      );
    }
  }, [agentsFilters, toolsetsFilters, dataContainer, dispatch]);
};
