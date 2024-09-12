import { useEffect, useState } from 'react';

import { DialAIEntityModel } from '@/src/types/models';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';

import { Spinner } from '@/src/components/Common/Spinner';

import ApplicationDetails from './ApplicationDetails/ApplicationDetails';

const Marketplace = () => {
  const dispatch = useAppDispatch();

  const isModelsLoading = useAppSelector(ModelsSelectors.selectModelsIsLoading);
  const isModelsLoaded = useAppSelector(ModelsSelectors.selectIsModelsLoaded);
  const models = useAppSelector(ModelsSelectors.selectModels);

  const [detailsModel, setDetailsModel] = useState<DialAIEntityModel>();

  useEffect(() => {
    if (!isModelsLoaded && !isModelsLoading) {
      dispatch(ModelsActions.getModels());
    }
  }, [isModelsLoaded, isModelsLoading, dispatch]);

  return (
    <div className="grow overflow-auto px-6 py-4 xl:px-16">
      {isModelsLoading ? (
        <Spinner size={60} className="mx-auto" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-6">
          {models.map((model) => (
            <div
              key={model.id}
              onClick={() => setDetailsModel(model)}
              className="h-[92px] cursor-pointer rounded border border-primary bg-transparent p-4 md:h-[203px] xl:h-[207px]"
            >
              {model.name}
            </div>
          ))}
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
