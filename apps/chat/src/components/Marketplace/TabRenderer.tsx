import { useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { isQuickApp } from '@/src/utils/app/application';
import { groupModelsAndSaveOrder } from '@/src/utils/app/conversation';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { isSmallScreen } from '@/src/utils/app/mobile';
import { doesEntityContainSearchTerm } from '@/src/utils/app/search';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import {
  ApplicationActionType,
  ApplicationType,
} from '@/src/types/applications';
import { ScreenState } from '@/src/types/common';
import { DialAIEntity, DialAIEntityModel } from '@/src/types/models';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/marketplace/marketplace.reducers';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';

import {
  DeleteType,
  FilterTypes,
  MarketplaceTabs,
} from '@/src/constants/marketplace';

import { PublishModal } from '@/src/components/Chat/Publish/PublishWizard';
import { ApplicationDialog } from '@/src/components/Common/ApplicationDialog';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { QuickAppDialog } from '@/src/components/Common/QuickAppDialog';
import ApplicationDetails from '@/src/components/Marketplace/ApplicationDetails/ApplicationDetails';
import { CardsList } from '@/src/components/Marketplace/CardsList';
import { MarketplaceBanner } from '@/src/components/Marketplace/MarketplaceBanner';
import { SearchHeader } from '@/src/components/Marketplace/SearchHeader';

import { PublishActions, ShareEntity } from '@epam/ai-dial-shared';
import intersection from 'lodash-es/intersection';
import orderBy from 'lodash-es/orderBy';

interface TabRendererProps {
  screenState: ScreenState;
}

export const TabRenderer = ({ screenState }: TabRendererProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);
  const selectedFilters = useAppSelector(
    MarketplaceSelectors.selectSelectedFilters,
  );
  const searchTerm = useAppSelector(MarketplaceSelectors.selectSearchTerm);
  const allModels = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const [applicationModel, setApplicationModel] = useState<{
    action: ApplicationActionType;
    type: ApplicationType;
    entity?: DialAIEntityModel;
  }>();
  const [deleteEntity, setDeleteEntity] = useState<
    DialAIEntityModel | undefined
  >();
  const [publishModel, setPublishModel] = useState<{
    entity: ShareEntity & { iconUrl?: string };
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

  const handleAddApplication = useCallback((type: ApplicationType) => {
    setApplicationModel({
      action: ApplicationActionType.ADD,
      type,
    });
  }, []);

  const handleEditApplication = useCallback(
    (entity: DialAIEntityModel) => {
      dispatch(ApplicationActions.get(entity.id));
      setApplicationModel({
        entity,
        action: ApplicationActionType.EDIT,
        type: isQuickApp(entity)
          ? ApplicationType.QUICK_APP
          : ApplicationType.CUSTOM_APP,
      });
    },
    [dispatch],
  );

  const handleDeleteClose = useCallback(
    (confirm: boolean) => {
      if (confirm && deleteEntity) {
        dispatch(ApplicationActions.delete(deleteEntity));
      }

      setDeleteEntity(undefined);
      setDetailsModelReference(undefined);
    },
    [deleteEntity, dispatch],
  );

  const handleSetPublishEntity = useCallback(
    (entity: DialAIEntityModel, action: PublishActions) =>
      setPublishModel({
        entity: {
          name: entity.name,
          id: ApiUtils.decodeApiUrl(entity.id),
          folderId: getFolderIdFromEntityId(entity.id),
          iconUrl: entity.iconUrl,
        },
        action,
      }),
    [],
  );

  const handlePublishClose = useCallback(() => setPublishModel(undefined), []);

  const handleDelete = useCallback(
    (entity: DialAIEntityModel) => {
      setDeleteEntity(entity);
    },
    [setDeleteEntity],
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

  const handleBookmarkClick = useCallback(
    (entity: DialAIEntity) => {
      if (installedModelIds.has(entity.id)) {
        dispatch(
          ModelsActions.removeInstalledModels({
            references: [entity.id],
            action: DeleteType.REMOVE,
          }),
        );
      } else {
        dispatch(ModelsActions.addInstalledModels({ references: [entity.id] }));
      }
    },
    [dispatch, installedModelIds],
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
        entities={displayedEntities}
        onCardClick={handleSetDetailsReference}
        onPublish={handleSetPublishEntity}
        onDelete={handleDelete}
        onEdit={handleEditApplication}
        isNotDesktop={screenState !== ScreenState.DESKTOP}
        onBookmarkClick={handleBookmarkClick}
      />

      {/* MODALS */}
      {!!(
        applicationModel && applicationModel.type === ApplicationType.CUSTOM_APP
      ) && (
        <ApplicationDialog
          isOpen={!!applicationModel}
          isEdit={applicationModel.action === ApplicationActionType.EDIT}
          currentReference={applicationModel.entity?.reference}
          onClose={handleCloseApplicationDialog}
        />
      )}
      {!!(
        applicationModel && applicationModel.type === ApplicationType.QUICK_APP
      ) && (
        <QuickAppDialog
          isOpen={!!applicationModel}
          isEdit={applicationModel.action === ApplicationActionType.EDIT}
          currentReference={applicationModel.entity?.reference}
          onClose={handleCloseApplicationDialog}
        />
      )}
      {!!deleteEntity && (
        <ConfirmDialog
          isOpen={!!deleteEntity}
          heading={t('Confirm deleting application')}
          description={
            t(
              'Are you sure you want to delete the {{modelName}}{{modelVersion}}?',
              {
                modelName: deleteEntity.name,
                modelVersion: deleteEntity.version
                  ? translate(' (version {{version}})', {
                      version: deleteEntity.version,
                    })
                  : '',
              },
            ) ?? ''
          }
          onClose={handleDeleteClose}
          confirmLabel={t('Delete')}
          cancelLabel={t('Cancel')}
        />
      )}
      {detailsModel && (
        <ApplicationDetails
          onPublish={handleSetPublishEntity}
          isMobileView={screenState === ScreenState.MOBILE ?? isSmallScreen()}
          entity={detailsModel}
          onChangeVersion={handleSetDetailsReference}
          onClose={handleCloseDetailsDialog}
          onDelete={handleDelete}
          onEdit={handleEditApplication}
          onBookmarkClick={handleBookmarkClick}
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
