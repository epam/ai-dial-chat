import { FloatingOverlay } from '@floating-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { groupModelsAndSaveOrder } from '@/src/utils/app/conversation';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { isSmallScreen } from '@/src/utils/app/mobile';
import { doesEntityContainSearchTerm } from '@/src/utils/app/search';
import { ApiUtils } from '@/src/utils/server/api';

import { ShareEntity } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { PublishActions } from '@/src/types/publication';
import { SharingType } from '@/src/types/share';

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
  FilterTypes,
  MarketplaceQueryParams,
  MarketplaceTabs,
} from '@/src/constants/marketplace';

import { PublishModal } from '@/src/components/Chat/Publish/PublishWizard';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Spinner } from '@/src/components/Common/Spinner';
import { TabRenderer } from '@/src/components/Marketplace/TabRenderer';

import ApplicationDetails from './ApplicationDetails/ApplicationDetails';

const Marketplace = () => {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();

  const isFilterbarOpen = useAppSelector(
    UISelectors.selectShowMarketplaceFilterbar,
  );
  const isProfileOpen = useAppSelector(UISelectors.selectIsProfileOpen);

  const isModelsLoading = useAppSelector(ModelsSelectors.selectModelsIsLoading);
  const models = useAppSelector(ModelsSelectors.selectModels);
  const installedModels = useAppSelector(ModelsSelectors.selectInstalledModels);
  const searchTerm = useAppSelector(MarketplaceSelectors.selectSearchTerm);
  const selectedFilters = useAppSelector(
    MarketplaceSelectors.selectSelectedFilters,
  );

  const [detailsModel, setDetailsModel] = useState<DialAIEntityModel>();
  const [publishModel, setPublishModel] = useState<{
    entity: ShareEntity;
    action: PublishActions;
  }>();
  const [deleteModel, setDeleteModel] = useState<DialAIEntityModel>();
  const [isMobile, setIsMobile] = useState(isSmallScreen());

  const handleSetPublishEntity = useCallback(
    (entity: DialAIEntityModel, action: PublishActions) =>
      setPublishModel({
        entity: {
          name: entity.name,
          id: ApiUtils.decodeApiUrl(entity.id),
          folderId: getFolderIdFromEntityId(entity.id),
        },
        action,
      }),
    [],
  );

  const handleDeleteClose = useCallback(
    (confirm: boolean) => {
      if (confirm && deleteModel) {
        const filteredModels = installedModels.filter(
          (model) => deleteModel.id !== model.id,
        );

        dispatch(ModelsActions.updateInstalledModels(filteredModels));
      }

      setDeleteModel(undefined);
    },
    [deleteModel, dispatch, installedModels],
  );

  const handlePublishClose = useCallback(() => setPublishModel(undefined), []);

  const showOverlay = (isFilterbarOpen || isProfileOpen) && isSmallScreen();

  useEffect(() => {
    const handleResize = () => setIsMobile(isSmallScreen());
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

  const displayedEntities = useMemo(() => {
    const filteredEntities = models.filter(
      (entity) =>
        (doesEntityContainSearchTerm(entity, searchTerm) &&
          !selectedFilters[FilterTypes.ENTITY_TYPE].length) ||
        selectedFilters[FilterTypes.ENTITY_TYPE].includes(entity.type),
    );

    const grouped = groupModelsAndSaveOrder(filteredEntities).slice(
      0,
      Number.MAX_SAFE_INTEGER,
    );

    return grouped.map(({ entities }) => entities[0]);
  }, [models, searchTerm, selectedFilters]);

  return (
    <div className="grow overflow-auto px-6 py-4 xl:px-16">
      {isModelsLoading ? (
        <div className="flex h-full items-center justify-center">
          <Spinner size={60} className="mx-auto" />
        </div>
      ) : (
        <>
          <TabRenderer
            entities={displayedEntities}
            onCardClick={setDetailsModel}
            onPublish={handleSetPublishEntity}
            onDelete={setDeleteModel}
            isMobile={isMobile}
          />

          {showOverlay && <FloatingOverlay className="z-30 bg-blackout" />}

          {detailsModel && (
            <ApplicationDetails
              onPublish={handleSetPublishEntity}
              isMobileView={isMobile}
              entity={detailsModel}
              onClose={() => setDetailsModel(undefined)}
            />
          )}

          {!!(publishModel && publishModel?.entity?.id) && (
            <PublishModal
              entity={publishModel.entity}
              type={SharingType.Application}
              isOpen={!!publishModel}
              onClose={handlePublishClose}
              publishAction={publishModel.action}
            />
          )}

          {!!deleteModel && (
            <ConfirmDialog
              isOpen={!!deleteModel}
              heading="Confirm deleting application"
              description="Are you sure you want to delete the application?"
              confirmLabel="Delete"
              cancelLabel="Cancel"
              onClose={handleDeleteClose}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Marketplace;
