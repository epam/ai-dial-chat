import { useCallback, useMemo, useState } from 'react';

import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { isSmallScreen } from '@/src/utils/app/mobile';
import { ApiUtils } from '@/src/utils/server/api';

import { ApplicationActionType } from '@/src/types/applications';
import { ShareEntity } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { PublishActions } from '@/src/types/publication';
import { SharingType } from '@/src/types/share';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/marketplace/marketplace.reducers';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';

import { MarketplaceTabs } from '@/src/constants/marketplace';

import { PublishModal } from '@/src/components/Chat/Publish/PublishWizard';
import { ApplicationDialog } from '@/src/components/Common/ApplicationDialog';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import ApplicationDetails from '@/src/components/Marketplace/ApplicationDetails/ApplicationDetails';
import { CardsList } from '@/src/components/Marketplace/CardsList';
import { MarketplaceBanner } from '@/src/components/Marketplace/MarketplaceBanner';
import { SearchHeader } from '@/src/components/Marketplace/SearchHeader';

enum DeleteType {
  DELETE,
  REMOVE,
}

const deleteConfirmationText = {
  [DeleteType.DELETE]: {
    heading: 'Confirm deleting application',
    description: 'Are you sure you want to delete the application?',
    confirmLabel: 'Delete',
  },
  [DeleteType.REMOVE]: {
    heading: 'Confirm removing application',
    description:
      'Are you sure you want to remove the application from your list?',
    confirmLabel: 'Remove',
  },
};

interface TabRendererProps {
  entities: DialAIEntityModel[];
  isMobile?: boolean;
}

export const TabRenderer = ({ entities, isMobile }: TabRendererProps) => {
  const dispatch = useAppDispatch();

  const installedModels = useAppSelector(ModelsSelectors.selectInstalledModels);
  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);

  const [applicationModel, setApplicationModel] = useState<{
    action: ApplicationActionType;
    entity?: DialAIEntityModel;
  }>();
  const [deleteModel, setDeleteModel] = useState<{
    action: DeleteType;
    entity: DialAIEntityModel;
  }>();
  const [publishModel, setPublishModel] = useState<{
    entity: ShareEntity;
    action: PublishActions;
  }>();
  const [detailsModel, setDetailsModel] = useState<DialAIEntityModel>();

  const handleAddApplication = useCallback(() => {
    setApplicationModel({
      action: ApplicationActionType.ADD,
    });
  }, []);

  const handleEditApplication = useCallback(
    (entity: DialAIEntityModel) => {
      dispatch(ApplicationActions.get(entity.id));
      setApplicationModel({
        entity,
        action: ApplicationActionType.EDIT,
      });
    },
    [dispatch],
  );

  const handleDeleteClose = useCallback(
    (confirm: boolean) => {
      if (confirm && deleteModel) {
        if (deleteModel.action === DeleteType.REMOVE) {
          const filteredModels = installedModels.filter(
            (model) => deleteModel.entity.id !== model.id,
          );
          dispatch(ModelsActions.updateInstalledModels(filteredModels));
        }
        if (deleteModel.action === DeleteType.DELETE) {
          dispatch(ApplicationActions.delete(deleteModel.entity));
        }
      }
      setDeleteModel(undefined);
    },
    [deleteModel, installedModels, dispatch],
  );

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

  const handlePublishClose = useCallback(() => setPublishModel(undefined), []);

  const handleDelete = useCallback(
    (entity: DialAIEntityModel) => {
      setDeleteModel({ entity, action: DeleteType.DELETE });
    },
    [setDeleteModel],
  );

  const handleRemove = useCallback(
    (entity: DialAIEntityModel) => {
      setDeleteModel({ entity, action: DeleteType.REMOVE });
    },
    [setDeleteModel],
  );

  const handleCardClick = useCallback(
    (entity: DialAIEntityModel) => {
      setDetailsModel(entity);
    },
    [setDetailsModel],
  );

  const handleCloseApplicationDialog = useCallback(
    () => setApplicationModel(undefined),
    [setApplicationModel],
  );

  const handleCloseDetailsDialog = useCallback(
    () => setDetailsModel(undefined),
    [setDetailsModel],
  );

  const filteredModels = useMemo(() => {
    if (selectedTab === MarketplaceTabs.MY_APPLICATIONS) {
      return entities.filter(
        (entity) => !!installedModels.find((model) => model.id === entity.id),
      );
    }
    return entities;
  }, [selectedTab, entities, installedModels]);

  return (
    <>
      <header className="mb-4" data-qa="marketplace-header">
        <MarketplaceBanner />
        <SearchHeader
          items={filteredModels.length}
          onAddApplication={handleAddApplication}
        />
      </header>

      <CardsList
        title={
          selectedTab === MarketplaceTabs.HOME ? 'All applications' : undefined
        }
        entities={filteredModels}
        onCardClick={handleCardClick}
        onPublish={handleSetPublishEntity}
        onDelete={handleDelete}
        onRemove={handleRemove}
        onEdit={handleEditApplication}
        isMobile={isMobile}
      />

      {/* MODALS */}
      {!!applicationModel && (
        <ApplicationDialog
          isOpen={!!applicationModel}
          isEdit={applicationModel.action === ApplicationActionType.EDIT}
          currentReference={applicationModel.entity?.reference}
          onClose={handleCloseApplicationDialog}
        />
      )}
      {!!deleteModel && (
        <ConfirmDialog
          isOpen={!!deleteModel}
          {...deleteConfirmationText[deleteModel.action]}
          onClose={handleDeleteClose}
          cancelLabel="Cancel"
        />
      )}
      {detailsModel && (
        <ApplicationDetails
          onPublish={handleSetPublishEntity}
          isMobileView={isMobile ?? isSmallScreen()}
          entity={detailsModel}
          onClose={handleCloseDetailsDialog}
          onEdit={handleEditApplication}
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
    </>
  );
};
