import { FloatingOverlay } from '@floating-ui/react';
import { useEffect } from 'react';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { Spinner } from '@/src/components/Common/Spinner';
import { ApplicationCard } from '@/src/components/Marketplace/ApplicationCard';

const Marketplace = () => {
  const dispatch = useAppDispatch();

  const isFilterbarOpen = useAppSelector(
    UISelectors.selectShowMarketplaceFilterbar,
  );
  const isProfileOpen = useAppSelector(UISelectors.selectIsProfileOpen);

  const isModelsLoading = useAppSelector(ModelsSelectors.selectModelsIsLoading);
  const models = useAppSelector(ModelsSelectors.selectModels);

  const showOverlay = (isFilterbarOpen || isProfileOpen) && isSmallScreen();

  useEffect(() => {
    dispatch(ModelsActions.getModels());
  }, [dispatch]);

  return (
    <div className="grow overflow-auto px-6 py-4 xl:px-16">
      {isModelsLoading ? (
        <Spinner size={60} className="mx-auto" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6 2xl:grid-cols-4">
          {models.map((model) => (
            <ApplicationCard key={model.id} entity={model} />
          ))}
          {showOverlay && <FloatingOverlay className="z-30 bg-blackout" />}
        </div>
      )}
    </div>
  );
};

export default Marketplace;
