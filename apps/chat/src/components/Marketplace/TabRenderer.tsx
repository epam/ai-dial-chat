import { useCallback, useMemo, useState } from 'react';

import { groupModelsAndSaveOrder } from '@/src/utils/app/conversation';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { isSmallScreen } from '@/src/utils/app/mobile';
import { doesEntityContainSearchTerm } from '@/src/utils/app/search';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import { ApplicationActionType } from '@/src/types/applications';
import { DialAIEntityModel } from '@/src/types/models';
import { SharingType } from '@/src/types/share';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/marketplace/marketplace.reducers';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';

import { FilterTypes, MarketplaceTabs } from '@/src/constants/marketplace';

import { PublishModal } from '@/src/components/Chat/Publish/PublishWizard';
import { ApplicationDialog } from '@/src/components/Common/ApplicationDialog';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import ApplicationDetails from '@/src/components/Marketplace/ApplicationDetails/ApplicationDetails';
import { CardsList } from '@/src/components/Marketplace/CardsList';
import { MarketplaceBanner } from '@/src/components/Marketplace/MarketplaceBanner';
import { SearchHeader } from '@/src/components/Marketplace/SearchHeader';

import { PublishActions, ShareEntity } from '@epam/ai-dial-shared';
import intersection from 'lodash-es/intersection';
import orderBy from 'lodash-es/orderBy';

enum DeleteType {
  DELETE,
  REMOVE,
}

const getDeleteConfirmationText = (
  action: DeleteType,
  entity: DialAIEntityModel,
) => {
  const translationVariables = {
    modelName: entity.name,
    modelVersion: entity.version
      ? translate(' (version {{version}})', { version: entity.version })
      : '',
  };

  const deleteConfirmationText = {
    [DeleteType.DELETE]: {
      heading: translate('Confirm deleting application'),
      description: translate(
        'Are you sure you want to delete the {{modelName}}{{modelVersion}}?',
        translationVariables,
      ),
      confirmLabel: translate('Delete'),
    },
    [DeleteType.REMOVE]: {
      heading: translate('Confirm removing application'),
      description: translate(
        'Are you sure you want to remove the {{modelName}}{{modelVersion}} from your list?',
        translationVariables,
      ),
      confirmLabel: translate('Remove'),
    },
  };

  return deleteConfirmationText[action];
};

interface TabRendererProps {
  isMobile?: boolean;
}

export const TabRenderer = ({ isMobile }: TabRendererProps) => {
  const dispatch = useAppDispatch();

  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const installedModels = useAppSelector(ModelsSelectors.selectInstalledModels);
  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);
  const selectedFilters = useAppSelector(
    MarketplaceSelectors.selectSelectedFilters,
  );
  const searchTerm = useAppSelector(MarketplaceSelectors.selectSearchTerm);
  const allModels = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

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
  const [detailsModelReference, setDetailsModelReference] = useState<string>();

  const displayedEntities = useMemo(() => {
    const filteredEntities = allModels.filter(
      (entity) =>
        (doesEntityContainSearchTerm(entity, searchTerm) ||
          (entity.version &&
            doesEntityContainSearchTerm(
              { name: entity.version },
              searchTerm,
            ))) &&
        (selectedFilters[FilterTypes.ENTITY_TYPE].length
          ? selectedFilters[FilterTypes.ENTITY_TYPE].includes(entity.type)
          : true) &&
        (selectedFilters[FilterTypes.TOPICS].length
          ? intersection(selectedFilters[FilterTypes.TOPICS], entity.topics)
              .length
          : true),
    );

    const entitiesForTab =
      selectedTab === MarketplaceTabs.MY_APPLICATIONS
        ? filteredEntities.filter((entity) =>
            installedModelIds.has(entity.reference),
          )
        : filteredEntities;

    const groupedEntities = groupModelsAndSaveOrder(entitiesForTab).slice(
      0,
      Number.MAX_SAFE_INTEGER,
    );

    const orderedEntities = groupedEntities.map(
      ({ entities }) => orderBy(entities, 'version', 'desc')[0],
    );

    return orderedEntities;
  }, [installedModelIds, allModels, searchTerm, selectedFilters, selectedTab]);

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

  const handleSetDetailsReference = useCallback(
    (entity: DialAIEntityModel) => {
      setDetailsModelReference(entity.reference);
    },
    [setDetailsModelReference],
  );

  const handleCloseApplicationDialog = useCallback(
    () => setApplicationModel(undefined),
    [setApplicationModel],
  );

  const handleCloseDetailsDialog = useCallback(
    () => setDetailsModelReference(undefined),
    [setDetailsModelReference],
  );

  const detailsModel = detailsModelReference
    ? modelsMap[detailsModelReference]
    : undefined;

  return (
    <>
      <header className="mb-4" data-qa="marketplace-header">
        <MarketplaceBanner />
        <SearchHeader
          items={displayedEntities.length}
          onAddApplication={handleAddApplication}
        />
      </header>

      <CardsList
        title={
          selectedTab === MarketplaceTabs.HOME ? 'All applications' : undefined
        }
        entities={displayedEntities}
        onCardClick={handleSetDetailsReference}
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
          {...getDeleteConfirmationText(deleteModel.action, deleteModel.entity)}
          onClose={handleDeleteClose}
          cancelLabel="Cancel"
        />
      )}
      {detailsModel && (
        <ApplicationDetails
          onPublish={handleSetPublishEntity}
          isMobileView={isMobile ?? isSmallScreen()}
          entity={detailsModel}
          onChangeVersion={handleSetDetailsReference}
          onClose={handleCloseDetailsDialog}
          onDelete={handleDelete}
          onRemove={handleRemove}
          onEdit={handleEditApplication}
          allEntities={allModels}
          isMyAppsTab={selectedTab === MarketplaceTabs.MY_APPLICATIONS}
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
