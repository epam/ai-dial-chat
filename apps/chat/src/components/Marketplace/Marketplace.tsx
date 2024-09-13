import { FloatingOverlay } from '@floating-ui/react';
import { useCallback, useEffect, useState } from 'react';

import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { isSmallScreen } from '@/src/utils/app/mobile';
import { ApiUtils } from '@/src/utils/server/api';

import { ShareEntity } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { PublishActions } from '@/src/types/publication';
import { SharingType } from '@/src/types/share';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { PublishModal } from '@/src/components/Chat/Publish/PublishWizard';
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

  const [detailsModel, setDetailsModel] = useState<DialAIEntityModel>();
  const [publishModel, setPublishModel] = useState<{
    entity: DialAIEntityModel;
    action: PublishActions;
  }>();
  const [isMobile, setIsMobile] = useState(isSmallScreen());

  const handleSetPublishEntity = useCallback(
    (entity: DialAIEntityModel, action: PublishActions) =>
      setPublishModel({ entity, action }),
    [],
  );

  const handlePublishClose = useCallback(() => setPublishModel(undefined), []);

  const showOverlay = (isFilterbarOpen || isProfileOpen) && isSmallScreen();

  const entityForPublish: ShareEntity | null = publishModel?.entity
    ? {
        name: publishModel.entity.name,
        id: ApiUtils.decodeApiUrl(publishModel.entity.id),
        folderId: getFolderIdFromEntityId(publishModel.entity.id),
      }
    : null;

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
              onPublish={handleSetPublishEntity}
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
      {!!(publishModel && entityForPublish && entityForPublish.id) && (
        <PublishModal
          entity={entityForPublish}
          type={SharingType.Application}
          isOpen={!!publishModel}
          onClose={handlePublishClose}
          publishAction={publishModel.action}
        />
      )}
    </div>
  );
};

export default Marketplace;
