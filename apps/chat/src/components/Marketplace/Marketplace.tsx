import { FloatingOverlay } from '@floating-ui/react';
import { useEffect, useState } from 'react';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { DialAIEntityModel } from '@/src/types/models';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { Spinner } from '@/src/components/Common/Spinner';
import { ApplicationCard } from '@/src/components/Marketplace/ApplicationCard';

import ApplicationDetails from './ApplicationDetails/ApplicationDetails';

const Marketplace = () => {
  const dispatch = useAppDispatch();

  const isFilterbarOpen = useAppSelector(
    UISelectors.selectShowMarketplaceFilterbar,
  );
  const isProfileOpen = useAppSelector(UISelectors.selectIsProfileOpen);

  const isModelsLoading = useAppSelector(ModelsSelectors.selectModelsIsLoading);
  const models = useAppSelector(ModelsSelectors.selectModels);

  const showOverlay = (isFilterbarOpen || isProfileOpen) && isSmallScreen();

  const [detailsModel, setDetailsModel] = useState<DialAIEntityModel>();
  const [isMobile, setIsMobile] = useState(isSmallScreen());

  useEffect(() => {
    const handleResize = () => setIsMobile(isSmallScreen());
    const resizeObserver = new ResizeObserver(handleResize);

    resizeObserver.observe(document.body);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    dispatch(ModelsActions.getModels());
  }, [dispatch]);

  return (
    <div className="grow overflow-auto px-6 py-4 xl:px-16">
      {isModelsLoading ? (
        <div className="flex h-full items-center justify-center">
          <Spinner size={60} className="mx-auto" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6 2xl:grid-cols-4">
          {models.map((model) => (
            <ApplicationCard
              key={model.id}
              entity={model}
              isMobile={isMobile}
              onClick={setDetailsModel}
              selected={model.id === detailsModel?.id}
            />
          ))}
          {showOverlay && <FloatingOverlay className="z-30 bg-blackout" />}
        </div>
      )}
      {detailsModel && (
        <ApplicationDetails
          entity={detailsModel}
          onClose={() => setDetailsModel(undefined)}
        />
      )}
    </div>
  );
};

export default Marketplace;
