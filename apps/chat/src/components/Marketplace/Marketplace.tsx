import { FloatingOverlay } from '@floating-ui/react';
import { useEffect } from 'react';

import { useRouter } from 'next/router';

import { useScreenState } from '@/src/hooks/useScreenState';

import { ScreenState } from '@/src/types/common';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  MarketplaceActions,
  MarketplaceSelectors,
} from '@/src/store/marketplace/marketplace.reducers';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { Spinner } from '@/src/components/Common/Spinner';
import { TabRenderer } from '@/src/components/Marketplace/TabRenderer';

import { UploadStatus } from '@epam/ai-dial-shared';

export const Marketplace = () => {
  const dispatch = useAppDispatch();

  const router = useRouter();

  const isFilterbarOpen = useAppSelector(
    UISelectors.selectShowMarketplaceFilterbar,
  );
  const isProfileOpen = useAppSelector(UISelectors.selectIsProfileOpen);
  const isLoading = useAppSelector(ModelsSelectors.selectModelsIsLoading);
  const applyModelStatus = useAppSelector(
    MarketplaceSelectors.selectApplyModelStatus,
  );

  const screenState = useScreenState();

  const showOverlay =
    (isFilterbarOpen || isProfileOpen) && screenState === ScreenState.MOBILE;

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
      className="flex grow flex-col overflow-auto px-3 py-4 md:p-5 xl:px-16 xl:py-6"
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
