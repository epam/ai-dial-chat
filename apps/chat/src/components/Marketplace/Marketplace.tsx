import { FloatingOverlay } from '@floating-ui/react';
import { useEffect, useState } from 'react';

import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';

import { getScreenState, isSmallScreen } from '@/src/utils/app/mobile';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  MarketplaceActions,
  MarketplaceSelectors,
} from '@/src/store/marketplace/marketplace.reducers';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import {
  MarketplaceQueryParams,
  MarketplaceTabs,
} from '@/src/constants/marketplace';

import { Spinner } from '@/src/components/Common/Spinner';
import { TabRenderer } from '@/src/components/Marketplace/TabRenderer';

import { UploadStatus } from '@epam/ai-dial-shared';

export const Marketplace = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const searchParams = useSearchParams();

  const isFilterbarOpen = useAppSelector(
    UISelectors.selectShowMarketplaceFilterbar,
  );
  const isProfileOpen = useAppSelector(UISelectors.selectIsProfileOpen);
  const isLoading = useAppSelector(ModelsSelectors.selectModelsIsLoading);
  const applyModelStatus = useAppSelector(
    MarketplaceSelectors.selectApplyModelStatus,
  );

  const [screenState, setScreenState] = useState(getScreenState());

  const showOverlay = (isFilterbarOpen || isProfileOpen) && isSmallScreen();

  useEffect(() => {
    const handleResize = () => setScreenState(getScreenState());
    const resizeObserver = new ResizeObserver(handleResize);

    resizeObserver.observe(document.body);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    dispatch(ModelsActions.getModels());
  }, [dispatch]);

  useEffect(() => {
    dispatch(
      MarketplaceActions.setSelectedTab(
        searchParams.get(MarketplaceQueryParams.fromConversation)
          ? MarketplaceTabs.MY_APPLICATIONS
          : MarketplaceTabs.HOME,
      ),
    );
  }, [dispatch, searchParams]);

  useEffect(() => {
    if (applyModelStatus === UploadStatus.LOADED) {
      dispatch(
        MarketplaceActions.setApplyModelStatus(UploadStatus.UNINITIALIZED),
      );
      router.push('/');
    }
  }, [applyModelStatus, router, dispatch]);

  return (
    <div
      className="grow overflow-auto px-3 py-4 md:p-5 xl:px-16 xl:py-6"
      data-qa="marketplace"
    >
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <Spinner size={45} className="mx-auto" />
        </div>
      ) : (
        <>
          <TabRenderer screenState={screenState} />

          {showOverlay && <FloatingOverlay className="z-30 bg-blackout" />}
        </>
      )}
    </div>
  );
};
